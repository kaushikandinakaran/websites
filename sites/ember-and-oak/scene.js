// Ember & Oak - the 3D room: renderer, real Poly Haven assets streamed by station, camera flown by scroll,
// post-processing, render loop with pause / off-screen / context-loss handling.
import * as THREE from 'three';
import { shared, buildFire, buildWoodpile, buildTable, buildSteak, buildKnife, buildRosemary, buildSalt, blobTexture, contactShadow, buildDust } from './world.js';

const PH = '../../assets/polyhaven/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 400 }) : setTimeout(r, 30)));
async function imp(path) {
  try { return await import(path); } catch (e) { await wait(400); return import(path + '?r=1'); }
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* camera keyframes: two per station (arrive, settle). pos, target, fov, exposure, sx = horizontal subject shift
   on wide screens (positive moves the subject right, away from a left panel), sy = vertical shift on phones */
const KEYS = [
  // 0 the fire: wide, low, the room around it
  { p: [-0.8, 1.0, 3.4], t: [0.3, 0.62, 0.0], fov: 34, e: 1.15, sx: 0.32, sy: 0.17 },
  // 1 push into the flames
  { p: [-0.42, 0.86, 1.95], t: [0.05, 0.62, 0.0], fov: 32, e: 1.0, sx: 0.24, sy: 0.12 },
  // 2 the board: arrive above the table
  { p: [1.82, 1.2, 1.62], t: [2.43, 0.8, 0.98], fov: 30, e: 1.05, sx: -0.26, sy: 0.17 },
  // 3 macro in raking light
  { p: [2.04, 1.04, 1.4], t: [2.43, 0.79, 0.98], fov: 27, e: 1.05, sx: -0.24, sy: 0.15 },
  // 4 the cellar: barrels along the brick wall
  { p: [1.3, 1.25, -0.9], t: [3.5, 0.85, -3.55], fov: 34, e: 1.1, sx: 0.18, sy: 0.17 },
  // 5 glide along the barrels
  { p: [2.6, 1.05, -1.75], t: [4.55, 0.8, -3.6], fov: 32, e: 1.1, sx: 0.16, sy: 0.15 },
  // 6 the table: pull back, lamp over the table, fire behind
  { p: [4.3, 1.5, 2.75], t: [2.2, 1.05, 0.6], fov: 36, e: 1.05, sx: 0, sy: 0.12 },
  // 7
  { p: [4.7, 1.6, 3.3], t: [1.9, 1.0, 0.3], fov: 38, e: 1.0, sx: 0, sy: 0.12 },
  // 8 reserve: the whole room, fire glowing at its heart
  { p: [-3.4, 2.1, 4.4], t: [0.4, 0.55, -0.6], fov: 38, e: 1.05, sx: 0.2, sy: 0.17 },
  // 9
  { p: [-2.7, 1.55, 3.4], t: [0.3, 0.6, -0.4], fov: 34, e: 1.08, sx: 0.2, sy: 0.15 },
];
const STILL = [0.35, 3, 5, 7, 9]; // reduced motion: one resolved frame per station

export async function initScene(canvas, opts = {}) {
  const reduce = !!opts.reduce;
  const progress = opts.onProgress || (() => {});
  const small = Math.min(window.innerWidth, window.innerHeight) <= 760 && window.innerWidth <= 900;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const lowCpu = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  let tier = small || coarse ? 0 : lowCpu ? 1 : 2;

  const [{ GLTFLoader }, { RGBELoader }] = await Promise.all([imp('three/addons/loaders/GLTFLoader.js'), imp('three/addons/loaders/RGBELoader.js')]);
  let EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, FXAAShader, RoomEnvironment;
  if (tier > 0) {
    [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { ShaderPass }, { FXAAShader }] = await Promise.all([
      imp('three/addons/postprocessing/EffectComposer.js'), imp('three/addons/postprocessing/RenderPass.js'),
      imp('three/addons/postprocessing/UnrealBloomPass.js'), imp('three/addons/postprocessing/OutputPass.js'),
      imp('three/addons/postprocessing/ShaderPass.js'), imp('three/addons/shaders/FXAAShader.js')]);
  } else {
    ({ RoomEnvironment } = await imp('three/addons/environments/RoomEnvironment.js'));
  }

  /* ---------- renderer */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: tier === 0, powerPreference: 'high-performance', alpha: false, stencil: false });
  } catch (e) { return null; }
  let lost = false, onLostH = null, onRestoredH = null;
  const lostL = (e) => { e.preventDefault(); lost = true; if (onLostH) onLostH(); };
  const restoredL = () => { if (onRestoredH) onRestoredH(); else lost = false; };
  canvas.addEventListener('webglcontextlost', lostL);
  canvas.addEventListener('webglcontextrestored', restoredL);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x080605, 1);
  renderer.shadowMap.enabled = tier > 0;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCF with a radius: soft enough, much cheaper to compile than PCFSoft
  // the shadow casters and both shadow lights never move: the maps are drawn once per stage (and after a context
  // restore), never every frame, and shadowMap.enabled never changes, so no program is ever relinked for it
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const dprCap = tier === 0 ? 1.0 : tier === 1 ? 1.25 : 1.5;
  let pr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(pr);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070504);
  scene.fog = new THREE.FogExp2(0x0a0706, 0.055);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);

  /* ---------- loading helpers */
  const NOR = px(128, 128, 255), ARM = px(255, 205, 0); // stand-ins for maps we choose not to download
  function px(r, g, b) { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(0, 0, 1, 1); return c.toDataURL('image/png'); }
  const skip = (u) => {
    // never needed at this framing: label paper and lamp glass normals, label / bottle / onion roughness, small normals
    if (/paper_nor|label_[a-z_0-9]+_arm|glass_nor|hanging_industrial_lamp_(nor|arm)|wine_bottles_01_(arm|nor_gl)|yellow_onion_(arm|nor_gl)/.test(u)) return true;
    if (tier === 0 && /_(nor_gl|arm)_1k/.test(u)) return true; // phones: no normal or ARM maps (about 5 MB budget)
    return false;
  };
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((u) => (skip(u) ? (/nor/.test(u) ? NOR : ARM) : u));
  const gltfLoader = new GLTFLoader(manager);
  const texLoader = new THREE.TextureLoader(manager);
  const loadGltf = (id) => new Promise((res) => gltfLoader.load(`${PH}models/${id}/${id}_1k.gltf`, (g) => res(g.scene), undefined, () => res(null)));
  const loadTex = (url, srgb) => new Promise((res) => texLoader.load(url, (t) => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = maxAniso; t.wrapS = t.wrapT = THREE.RepeatWrapping; res(t); }, undefined, () => res(null)));
  async function upload(obj) { // push textures to the GPU one at a time, yielding between them
    const seen = new Set();
    obj.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap'].forEach((k) => { if (m[k]) seen.add(m[k]); }); }); });
    for (const t of seen) { if (lost) return; t.anisotropy = maxAniso; renderer.initTexture(t); await wait(0); }
  }
  // compile programs for the target we really draw into (the composer's buffer on desktop), without blocking:
  // KHR_parallel_shader_compile lets the GPU process link while the page stays responsive
  async function compile(obj = scene) {
    if (lost || renderer.getContext().isContextLost()) return;
    renderer.setRenderTarget(composer ? composer.readBuffer : null);
    let p = null;
    try { p = renderer.compileAsync(obj, camera, scene); } catch (e) { /* compile lazily on first draw */ }
    renderer.setRenderTarget(null);
    if (p) { try { await Promise.race([p, wait(20000)]); } catch (e) { /* ignore */ } }
  }
  // the post-processing passes' own shaders, compiled the same non-blocking way before the first composed frame
  async function compilePost() {
    if (!composer || lost) return;
    const tmp = new THREE.Scene(), geo = new THREE.PlaneGeometry(1, 1), mats = new Set();
    composer.passes.forEach((pass) => {
      Object.values(pass).forEach((v) => { [].concat(v).forEach((m) => { if (m && m.isMaterial) mats.add(m); }); });
      if (pass.fsQuad && pass.fsQuad.material) mats.add(pass.fsQuad.material);
    });
    // OutputPass sets its defines inside render(): set them now, exactly as it will, so the compiled variant is the one used
    output._outputColorSpace = renderer.outputColorSpace; output._toneMapping = renderer.toneMapping;
    output.material.defines = { SRGB_TRANSFER: '', ACES_FILMIC_TONE_MAPPING: '' }; output.material.needsUpdate = true;
    const toScreen = new THREE.Scene(); // the last pass (grade) draws to the canvas: a different program key
    mats.forEach((m) => (m === grade.material ? toScreen : tmp).add(new THREE.Mesh(geo, m)));
    [tmp, toScreen].forEach((g) => g.traverse((o) => { o.frustumCulled = false; }));
    const ps = [];
    for (const [g, rt] of [[tmp, composer.readBuffer], [toScreen, null]]) {
      renderer.setRenderTarget(rt);
      try { ps.push(renderer.compileAsync(g, camera)); } catch (e) { /* compile on first draw */ }
    }
    renderer.setRenderTarget(null);
    try { await Promise.race([Promise.all(ps), wait(8000)]); } catch (e) { /* ignore */ }
    geo.dispose();
  }
  const ENV_K = 0.55;
  const prepModel = (root, { shadow = true, receive = true, env = ENV_K } = {}) => {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = shadow && tier > 0; o.receiveShadow = receive;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { m.envMapIntensity = env; if (m.map) m.map.anisotropy = maxAniso; });
    });
    return root;
  };

  /* ---------- environment light (HDRI: Poly Haven "fireplace"; phones use a generated room) */
  const pmrem = new THREE.PMREMGenerator(renderer);
  let hdr = null, envRT = null;
  function buildEnv() {
    if (envRT && !lost) { /* the previous target belongs to this context: free it */ envRT.dispose(); }
    if (hdr) { envRT = pmrem.fromEquirectangular(hdr); hdr.dispose(); } // GPU copy freed; the CPU data stays for a restore
    else { const room = new RoomEnvironment(renderer); envRT = pmrem.fromScene(room, 0.04); room.dispose(); }
    scene.environment = envRT.texture;
  }

  /* ---------- stage A: the room and the fire (first frame) */
  progress(0.08);
  const stageA = await Promise.all([
    tier > 0 ? new Promise((res) => new RGBELoader(manager).load(`${PH}hdri/fireplace/fireplace_1k.hdr`, res, undefined, () => res(null))) : Promise.resolve(null),
    loadTex(`${PH}textures/dark_brick_wall/dark_brick_wall_diff_1k.jpg`, true),
    tier > 0 ? loadTex(`${PH}textures/slate_floor/slate_floor_diff_1k.jpg`, true) : Promise.resolve(null),
    loadGltf('stone_fire_pit'),
  ]);
  progress(0.45);
  const [hdrTex, brickDiff, slateDiff, firePit] = stageA;
  if (hdrTex) { hdrTex.mapping = THREE.EquirectangularReflectionMapping; hdr = hdrTex; }
  if (!hdr && !RoomEnvironment) ({ RoomEnvironment } = await imp('three/addons/environments/RoomEnvironment.js'));
  buildEnv();

  const blob = blobTexture();
  // floor: slate
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xb4ada6, roughness: 0.62, metalness: 0, envMapIntensity: 0.45 });
  if (slateDiff) { slateDiff.repeat.set(7, 6); floorMat.map = slateDiff; floorMat.bumpMap = slateDiff; floorMat.bumpScale = 0.6; }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -0.5); floor.receiveShadow = true;
  scene.add(floor);
  // walls: dark brick, with the brick texture as its own bump map (no extra download)
  const brickMat = (rx, ry) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x8c8078, roughness: 0.92, envMapIntensity: 0.3 });
    if (brickDiff) { const t = brickDiff.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; m.map = t; m.bumpMap = t; m.bumpScale = 1.6; }
    return m;
  };
  const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.4), brickMat(5.6, 1.76));
  back.position.set(0, 2.2, -4.2); back.receiveShadow = true; scene.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.4), brickMat(4.8, 1.76));
  left.rotation.y = Math.PI / 2; left.position.set(-6.2, 2.2, 0.8); left.receiveShadow = true; scene.add(left);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.4), brickMat(4.8, 1.76));
  right.rotation.y = -Math.PI / 2; right.position.set(6.6, 2.2, 0.8); right.receiveShadow = true; scene.add(right);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), new THREE.MeshStandardMaterial({ color: 0x0e0b09, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.0, -0.5); scene.add(ceil);

  // fire pit (Poly Haven stone_fire_pit) + procedural fire
  const fireRoot = new THREE.Group(); scene.add(fireRoot);
  if (firePit) { prepModel(firePit); firePit.position.y = 0.194; fireRoot.add(firePit); }
  const fire = buildFire(tier); fireRoot.add(fire.group);
  const pitShadow = contactShadow(blob, 2.1, 2.1, 0.75); pitShadow.position.y = 0.002; fireRoot.add(pitShadow);
  const woodpile = buildWoodpile(tier); woodpile.position.set(-3.2, 0, -3.55); woodpile.rotation.y = Math.PI / 2; scene.add(woodpile);
  const wpShadow = contactShadow(blob, 1.1, 0.6, 0.7); wpShadow.position.set(-3.2, 0.002, -3.55); wpShadow.rotation.z = Math.PI / 2; scene.add(wpShadow);

  /* ---------- lights */
  // cool moonlight-like rim from behind: colour contrast against the firelight
  const rim = new THREE.DirectionalLight(0x8aa6d8, 0.55); rim.position.set(-4, 5, -6); scene.add(rim);
  // raking key across the board (warm tungsten, low and from the side)
  const boardKey = new THREE.SpotLight(0xffd6a8, 7, 0, 0.38, 0.85, 2);
  boardKey.position.set(3.75, 1.12, 1.55); boardKey.target.position.set(2.4, 0.76, 0.98);
  scene.add(boardKey, boardKey.target);
  // lamp over the table
  const lampLight = new THREE.SpotLight(0xffc489, 5, 0, 0.9, 0.85, 2);
  lampLight.position.set(2.4, 1.62, 0.9); lampLight.target.position.set(2.4, 0, 0.9);
  scene.add(lampLight, lampLight.target);
  // wall grazer over the cellar: rakes the brick and the barrel staves
  const cellarLight = new THREE.SpotLight(0xffb070, 30, 0, 0.6, 0.8, 2);
  cellarLight.position.set(3.6, 3.6, -2.6); cellarLight.target.position.set(3.6, 0.6, -4.0);
  scene.add(cellarLight, cellarLight.target);
  // a second pool of light on the far-left brick: an off-screen wall lamp, so the hero has depth behind the fire
  const wallLight = new THREE.SpotLight(0xffa860, 14, 0, 0.55, 0.9, 2);
  wallLight.position.set(-3.0, 3.4, -3.3); wallLight.target.position.set(-3.0, 0.4, -4.2);
  scene.add(wallLight, wallLight.target);
  const setShadow = (l, size, bias, nb) => { l.castShadow = tier > 0; l.shadow.mapSize.set(size, size); l.shadow.bias = bias; l.shadow.normalBias = nb; l.shadow.camera.near = 0.2; l.shadow.camera.far = 8; l.shadow.radius = 4; };
  const sm = tier === 2 ? 2048 : 1024;
  setShadow(boardKey, sm, -0.0004, 0.012);
  setShadow(lampLight, sm, -0.0003, 0.02);

  /* ---------- post-processing (desktop tiers) */
  let composer = null, bloom = null, fxaa = null, heat = null, grade = null, output = null;
  let heatOff = false, bloomOff = false; // degrade() choices, kept across a context restore
  const size = new THREE.Vector2();
  const HeatShader = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uC: { value: new THREE.Vector2(0.5, 0.5) }, uR: { value: new THREE.Vector2(0.1, 0.2) }, uAmp: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAmp; uniform vec2 uC, uR; varying vec2 vUv;
      void main(){
        vec2 d = (vUv - uC) / uR;
        float m = exp(-dot(d, d) * 1.4) * smoothstep(-1.1, 0.1, d.y);
        vec2 off = vec2(sin(vUv.y * 90.0 - uTime * 7.0 + sin(vUv.x * 40.0 + uTime * 2.3) * 1.6),
                        cos(vUv.y * 70.0 - uTime * 5.5 + vUv.x * 50.0)) * uAmp * m;
        gl_FragColor = texture2D(tDiffuse, vUv + off);
      }`,
  };
  const GradeShader = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float v = smoothstep(1.05, 0.32, length((vUv - 0.5) * vec2(1.0, 0.82)));
        c.rgb *= mix(0.62, 1.0, v);
        c.rgb += (hash(floor(vUv * uRes) + fract(uTime) * 61.0) - 0.5) * 0.028;
        gl_FragColor = c;
      }`,
  };
  function makeComposer() {
    if (tier === 0) return;
    renderer.getDrawingBufferSize(size);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 0 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.addPass(new RenderPass(scene, camera));
    if (tier === 2 && !heatOff) { heat = new ShaderPass(HeatShader); composer.addPass(heat); }
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.92);
    bloom.enabled = !bloomOff;
    composer.addPass(bloom);
    output = new OutputPass(); composer.addPass(output);
    fxaa = new ShaderPass({ ...FXAAShader, fragmentShader: FXAAShader.fragmentShader.replace(/,\s*-100\.0\)/g, ')') });
    composer.addPass(fxaa);
    grade = new ShaderPass(GradeShader); composer.addPass(grade);
  }
  function dropComposer(disposeIt) {
    if (composer && disposeIt) { composer.passes.forEach((p) => p.dispose && p.dispose()); composer.dispose(); }
    composer = bloom = fxaa = heat = grade = output = null;
  }
  makeComposer();

  /* ---------- sizing */
  let dust = null;
  let W = 1, H = 1, portrait = false;
  function resize() {
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    if (composer) {
      composer.setPixelRatio(pr); composer.setSize(W, H);
      fxaa.material.uniforms.resolution.value.set(1 / (W * pr), 1 / (H * pr));
      grade.material.uniforms.uRes.value.set(W * pr, H * pr);
    }
    camera.aspect = W / H;
    portrait = W / H < 0.9;
    const k = (H * pr) / (2 * Math.tan((34 * Math.PI) / 360));
    fire.px.value = k; if (dust) dust.px.value = k;
    wake();
  }
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(resize, 120); };
  window.addEventListener('resize', onResize);

  /* ---------- camera path */
  const curveP = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.p)), false, 'centripetal');
  const curveT = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.t)), false, 'centripetal');
  const NK = KEYS.length - 1;
  let tgtS = reduce ? STILL[0] : 0, curS = tgtS;
  const camP = new THREE.Vector3(), camT = new THREE.Vector3(), tmp = new THREE.Vector3();
  const pointer = new THREE.Vector2(), pointerCur = new THREE.Vector2();
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let paused = false;
  const onPointer = (e) => { if (paused || reduce) return; pointer.set((e.clientX / W) * 2 - 1, (e.clientY / H) * 2 - 1); wake(); };
  if (fine && !reduce) window.addEventListener('pointermove', onPointer, { passive: true });
  function applyCamera() {
    const s = clamp(curS, 0, NK);
    curveP.getPoint(s / NK, camP); curveT.getPoint(s / NK, camT);
    const i = Math.min(NK - 1, Math.floor(s)), f = s - i, a = KEYS[i], b = KEYS[i + 1];
    const fov = lerp(a.fov, b.fov, f);
    // narrow screens: step back a little so the subject still fits
    const asp = camera.aspect;
    const back = Math.max(1, Math.pow(1.45 / asp, 0.5));
    if (back > 1) { tmp.copy(camP).sub(camT).multiplyScalar(back); camP.copy(camT).add(tmp); }
    camP.x += pointerCur.x * 0.05; camP.y -= pointerCur.y * 0.03;
    camera.position.copy(camP);
    camera.lookAt(camT);
    camera.fov = portrait ? Math.min(fov * 1.08, 44) : fov;
    // panels take a larger share of narrower screens: push the subject further into the free side
    const k = clamp(Math.pow(1440 / W, 1.15), 0.85, 1.6);
    const sx = portrait ? 0 : lerp(a.sx, b.sx, f) * k, sy = portrait ? lerp(a.sy, b.sy, f) : 0;
    camera.setViewOffset(W, H, -sx * W * 0.5, sy * H * 0.5, W, H);
    camera.updateProjectionMatrix();
    renderer.toneMappingExposure = lerp(a.e, b.e, f);
  }

  /* ---------- heat shimmer target + fire level of detail */
  const heatTop = new THREE.Vector3(0, 1.0, 0), heatBot = new THREE.Vector3(0, 0.35, 0);
  function updateHeat() {
    if (!heat) return;
    tmp.copy(heatTop).project(camera); const cx = tmp.x * 0.5 + 0.5, cy = tmp.y * 0.5 + 0.5, cz = tmp.z;
    tmp.copy(heatBot).project(camera); const by = tmp.y * 0.5 + 0.5;
    const r = Math.abs(cy - by);
    heat.uniforms.uC.value.set(cx, cy - r * 0.2);
    heat.uniforms.uR.value.set(r * 0.55 * (H / W), r * 1.1);
    heat.uniforms.uAmp.value = cz < 1 && cz > -1 ? clamp(r * 0.012, 0, 0.0035) : 0;
  }

  /* ---------- render loop: one rAF id, on demand while paused or settled */
  let raf = 0, last = 0, journeyVisible = true, tabVisible = !document.hidden, guard = tier > 0, frames = 0, slow = 0;
  let clock = 0, ready = false;
  const canRun = () => ready && !lost && tabVisible && journeyVisible;
  const settled = () => Math.abs(curS - tgtS) < 0.0004 && pointerCur.distanceToSquared(pointer) < 1e-6;
  function draw() {
    applyCamera();
    shared.time.value = clock;
    fire.update(clock);
    updateHeat();
    if (heat) heat.uniforms.uTime.value = clock;
    if (grade) grade.uniforms.uTime.value = clock;
    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  function frame(ts) {
    raf = 0;
    if (!canRun()) return;
    const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000 || 0.016)); last = ts;
    if (!reduce) {
      curS += (tgtS - curS) * (1 - Math.exp(-dt * 4.2));
      if (Math.abs(curS - tgtS) < 0.0003) curS = tgtS;
      if (!paused) { pointerCur.lerp(pointer, 1 - Math.exp(-dt * 3)); clock += dt; }
    }
    draw();
    if (guard && !paused && !reduce && !document.hidden) {
      frames++; if (dt > 0.026) slow++;
      if (frames === 90) { if (slow > 50) degrade(); frames = 0; slow = 0; }
    }
    // never queue a second callback: degrade() -> resize() -> wake() may already have queued one
    if (!raf && !reduce && (!paused || !settled())) raf = requestAnimationFrame(frame);
  }
  // staged, idempotent, and never relinks a program (no shadow or define change): pixel ratio first, then the heat
  // shimmer, then bloom (a disabled pass is simply skipped), then half the embers; then stop watching
  function degrade() {
    if (pr > 1) { pr = Math.max(1, pr - 0.25); resize(); return; }
    // only the pass's own material is freed: its quad geometry is shared by every pass (and may predate a context restore)
    if (heat) { composer.passes.splice(composer.passes.indexOf(heat), 1); heat.material.dispose(); heat = null; heatOff = true; return; }
    if (bloom && bloom.enabled) { bloom.enabled = false; bloomOff = true; return; }
    const eg = fire.embers.geometry;
    if (eg.drawRange.count === Infinity) { eg.setDrawRange(0, Math.floor(eg.attributes.position.count / 2)); return; }
    guard = false;
  }
  function wake() {
    if (raf || !canRun()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  // off-screen pause watches the real content container, not the fixed canvas
  const io = new IntersectionObserver((e) => { journeyVisible = e[0].isIntersecting; journeyVisible ? wake() : stop(); }, { threshold: 0 });
  const jr = document.getElementById('journey'); if (jr) io.observe(jr);
  const onVis = () => { tabVisible = !document.hidden; tabVisible ? wake() : stop(); };
  document.addEventListener('visibilitychange', onVis);
  const onLost = () => { stop(); opts.onLost && opts.onLost(); };
  const onRestored = () => {
    lost = false;
    renderer.shadowMap.needsUpdate = true; // the maps died with the old context
    // old env target and composer belong to the dead context: forget them (no dispose), rebuild
    envRT = null; buildEnv();
    dropComposer(false); makeComposer();
    resize();
    opts.onRestored && opts.onRestored();
    wake();
  };
  onLostH = onLost; onRestoredH = onRestored;

  /* ---------- first frame */
  resize();
  curS = tgtS; applyCamera();
  await upload(scene);
  await compile();
  await compilePost();
  if (lost || renderer.getContext().isContextLost()) return null;
  ready = true;
  draw();
  opts.onReady && opts.onReady();
  wake();

  /* ---------- stage B (board, steak, table) and stage C (cellar, lamp), streamed in idle time */
  const tableX = 2.4, tableZ = 0.9, topY = 0.76;
  (async () => {
    await idle();
    if (lost) return;
    const [board, onion, woodDiff] = await Promise.all([
      loadGltf('wooden_cutting_board'), tier > 0 ? loadGltf('yellow_onion') : Promise.resolve(null),
      loadTex(`${PH}textures/wood_table_worn/wood_table_worn_diff_1k.jpg`, true),
    ]);
    progress(0.7);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xc8b8a4, roughness: 0.7, envMapIntensity: 0.45 });
    if (woodDiff) { woodDiff.repeat.set(1.2, 0.6); woodMat.map = woodDiff; woodMat.bumpMap = woodDiff; woodMat.bumpScale = 0.5; }
    const stB = new THREE.Group(); // built and compiled off-scene, then added in one step
    const table = buildTable(woodMat, tier); table.position.set(tableX, 0, tableZ); stB.add(table);
    const tShadow = contactShadow(blob, 2.4, 1.4, 0.7); tShadow.position.set(tableX, 0.002, tableZ); stB.add(tShadow);
    const set = new THREE.Group(); set.position.set(tableX, topY, tableZ); stB.add(set);
    if (board) { prepModel(board); board.rotation.y = 0.18; set.add(board); }
    const bTop = 0.0415;
    const steak = buildSteak(tier); steak.position.set(0.02, bTop, 0.06); steak.rotation.y = 1.45; set.add(steak);
    const ros2 = buildRosemary(); ros2.position.set(0.04, bTop + steak.userData.topY + 0.002, 0.115); ros2.rotation.set(0, 1.2, 0.04); ros2.scale.setScalar(0.8); set.add(ros2);
    const handleWood = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.5, envMapIntensity: 0.5 });
    if (woodDiff) { const t = woodDiff.clone(); t.repeat.set(0.15, 0.08); t.needsUpdate = true; handleWood.map = t; }
    const knife = buildKnife(handleWood); knife.position.set(-0.12, bTop + 0.001, 0.11); knife.rotation.set(-Math.PI / 2, 0, 0.35); set.add(knife);
    const ros = buildRosemary(); ros.position.set(-0.16, bTop + 0.003, -0.05); ros.rotation.y = 0.5; set.add(ros);
    const salt = buildSalt(tier === 0 ? 25 : 45, [0.16, 0.12], () => bTop + 0.0006); salt.position.set(-0.04, 0, 0.04); salt.rotation.y = 0.18; set.add(salt);
    if (onion) { prepModel(onion); onion.position.set(0.33, 0, -0.12); onion.rotation.set(0.2, 1.1, 0.1); set.add(onion); const o2 = onion.clone(); o2.position.set(0.41, 0, 0.0); o2.rotation.set(1.4, 0.3, 0.2); o2.scale.setScalar(0.9); set.add(o2); }
    await upload(stB);
    await compile(stB);
    if (lost) return;
    scene.add(stB);
    renderer.shadowMap.needsUpdate = true;
    wake();

    await idle();
    if (lost) return;
    const [barrel, bottles, lamp] = await Promise.all([loadGltf('wine_barrel_01'), tier > 0 ? loadGltf('wine_bottles_01') : Promise.resolve(null), tier > 0 ? loadGltf('hanging_industrial_lamp') : Promise.resolve(null)]);
    progress(0.95);
    const stC = new THREE.Group();
    if (barrel) {
      prepModel(barrel, { env: 0.5 });
      const cellar = new THREE.Group(); stC.add(cellar);
      const cradle = new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.85 });
      if (woodDiff) { const t = woodDiff.clone(); t.repeat.set(2, 0.2); t.needsUpdate = true; cradle.map = t; cradle.color.set(0x6a5644); }
      const R = 0.33; // barrel radius at the belly after scaling
      const bScale = 1.12;
      // bottom row lying on a timber cradle, heads toward the room
      for (let i = 0; i < 4; i++) {
        const b = barrel.clone(); b.scale.setScalar(bScale);
        b.rotation.set(Math.PI / 2, 0, 0);
        b.position.set(2.0 + i * 0.7, 0.12 + R, -3.35 - 0.47); cellar.add(b);
      }
      for (let i = 0; i < 3; i++) {
        const b = barrel.clone(); b.scale.setScalar(bScale);
        b.rotation.set(Math.PI / 2, 0, 0.3 * i);
        b.position.set(2.35 + i * 0.7, 0.12 + R + 0.6, -3.35 - 0.47); cellar.add(b);
      }
      [-0.35, 0.35].forEach((dz) => { const c = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 0.12), cradle); c.position.set(3.05, 0.06, -3.82 + dz); c.castShadow = tier > 0; c.receiveShadow = true; cellar.add(c); });
      const up = barrel.clone(); up.scale.setScalar(bScale); up.position.set(5.35, 0, -3.1); up.rotation.y = 0.6; cellar.add(up);
      const cs = contactShadow(blob, 3.6, 1.3, 0.8); cs.position.set(3.1, 0.002, -3.7); cellar.add(cs);
      const cs2 = contactShadow(blob, 0.95, 0.95, 0.8); cs2.position.set(5.35, 0.002, -3.1); cellar.add(cs2);
      if (bottles) {
        prepModel(bottles, { env: 1.1 });
        bottles.traverse((o) => {
          if (!o.isMesh) return;
          const m = o.material;
          if (/_wine_(red|clear|light_red)$/.test(m.name)) { o.visible = false; return; } // liquid hidden behind dark glass
          if (m.transmission !== undefined && m.transmission > 0) { // no transmission: dark glass with clear reflections
            m.transmission = 0; m.roughness = 0.08; m.metalness = 0; m.envMapIntensity = 1.4; m.color.multiplyScalar(0.55);
            if (m.clearcoat !== undefined) { m.clearcoat = 1; m.clearcoatRoughness = 0.05; }
          }
        });
        const bs = bottles.clone(); bs.scale.setScalar(1.0); bs.position.set(5.08, 0.84 * bScale, -3.25); bs.rotation.y = -0.4; cellar.add(bs);
        const one = bottles.getObjectByName('wine_bottles_01_bordeaux');
        if (one) { const b1 = one.clone(); b1.position.set(tableX + 0.55, topY, tableZ - 0.2); b1.rotation.y = 0.8; stC.add(b1); }
      }
    }
    if (lamp) {
      prepModel(lamp, { shadow: false });
      lamp.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material;
        if (m.emissiveIntensity !== undefined && m.emissiveMap) m.emissiveIntensity = 22;
        if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = 0.22; m.depthWrite = false; }
      });
      lamp.position.set(tableX, 2.95, tableZ); stC.add(lamp);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.05, 6), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }));
      cord.position.set(tableX, 3.48, tableZ); stC.add(cord);
    }
    dust = buildDust(tier, new THREE.Vector3(tableX, 0.8, tableZ), [0.9, 0.85, 0.7]);
    if (dust) stC.add(dust.points);
    await upload(stC);
    await compile(stC);
    if (lost) return;
    scene.add(stC);
    renderer.shadowMap.needsUpdate = true;
    if (dust) resize();
    progress(1);
    opts.onLoaded && opts.onLoaded();
    wake();
  })().catch(() => { opts.onLoaded && opts.onLoaded(); });

  function detach() {
    stop(); io.disconnect();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('webglcontextlost', lostL);
    canvas.removeEventListener('webglcontextrestored', restoredL);
  }
  window.addEventListener('pagehide', (e) => { if (!e.persisted) detach(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) { tabVisible = !document.hidden; wake(); } });

  return {
    still: reduce,
    setKey(s) { const v = clamp(s, 0, NK); if (v === tgtS) return; tgtS = v; wake(); },
    setStill(i) { const v = STILL[clamp(i, 0, STILL.length - 1)]; if (v === tgtS && curS === v) return; tgtS = curS = v; if (canRun()) draw(); },
    setPaused(p) { paused = p; if (p) pointer.copy(pointerCur); wake(); },
  };
}
