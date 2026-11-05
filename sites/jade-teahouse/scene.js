// Jade Teahouse - the 3D tea room: renderer, station-by-station asset streaming, lights, camera path,
// scroll-driven moments (the pour, the steamer lid), post effects and a guarded render loop.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import * as W from './world.js';

const { clamp, lerp, smoothstep } = THREE.MathUtils;
const PH = '../../assets/polyhaven/';
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sstep = (a, b, x) => smoothstep(x, a, b);
const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// FXAA without the -100 texture bias (Direct3D clamps it with a console warning; the targets have no mipmaps)
const FXAA = { ...FXAAShader, fragmentShader: FXAAShader.fragmentShader.replace(/,\s*-100\.0\)/g, ')') };
const GRAIN = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = (vUv - 0.5) * vec2(1.0, 0.86);
      c.rgb *= mix(0.74, 1.0, smoothstep(0.82, 0.22, length(q)));
      float n = fract(sin(dot(floor(vUv * uRes) + floor(uTime * 24.0) * 7.13, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * 0.022;
      gl_FragColor = c;
    }`,
};

/* ---------- placement (metres; the tea table stands at the origin, its top at y = 0.5) */
const TOP = 0.5;
const POT = V3(-0.19, TOP, 0.03);
const CUP = V3(0.05, TOP, 0.15);
const CUP2 = V3(-0.1, TOP, 0.27);
const STEAMER = V3(0.2, TOP, -0.17);
const SPOUT_TIP = V3(0, 0.117, 0.136);
const LID_REST = V3(-0.222, 0, 0.0); // where the lid is set down, beside the steamer (steamer space)
const CH_Y = 2.62; // chandelier hook height; the lantern body hangs 0.86 m below it // teapot local space, found from the model's geometry

/* ---------- camera stations: position, look-at, vertical fov, mid-control point to the next station,
   sideways shift on wide screens (subject away from the panel), upward shift on phones, exposure */
const KF = [
  { p: V3(0.6, 1.25, 4.15), t: V3(0.3, 1.05, 0.0), fov: 34, m: V3(0.4, 1.05, 2.4), sx: 0.16, sy: 0.16, ex: 1.0, push: 0.1 },
  { p: V3(0.66, 0.86, 0.86), t: V3(-0.07, 0.57, 0.08), fov: 30, m: V3(0.62, 0.86, 0.3), sx: -0.16, sy: 0.15, ex: 1.0, push: 0.08 },
  { p: V3(0.6, 0.93, 0.28), t: V3(0.17, 0.6, -0.2), fov: 30, m: V3(0.9, 0.95, 0.75), sx: 0.17, sy: 0.17, ex: 1.0, push: 0.06 },
  { p: V3(-0.5, 0.9, 1.75), t: V3(0.05, 2.0, -0.35), fov: 42, m: V3(0.9, 1.35, 3.1), sx: 0, sy: 0, ex: 1.05, push: 0.04 },
  { p: V3(-0.62, 1.2, 2.75), t: V3(0.4, 1.02, -1.1), fov: 38, m: null, sx: 0.16, sy: 0.17, ex: 0.95, push: 0.05 },
];
const STILL_U = [0, 0.62, 0.78, 1, 1];

function detectTier() {
  const small = Math.min(window.innerWidth, window.innerHeight) <= 760 && window.innerWidth <= 900;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const lowCpu = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  return small || coarse || lowCpu ? 'low' : 'high';
}
const yieldTask = () => new Promise((r) => setTimeout(r, 0));
const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 400 }) : setTimeout(r, 30)));

export async function initScene(canvas, opts = {}) {
  const reduce = !!opts.reduce;
  const tier = detectTier();
  const high = tier === 'high';
  let guard = high; // adaptive quality watcher
  let pr = Math.min(window.devicePixelRatio || 1, high ? 1.5 : 1);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !high, powerPreference: 'high-performance', alpha: false, stencil: false });
  } catch (e) { return null; }
  if (!renderer.getContext()) return null;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x080605, 1);
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // the shadow map is re-rendered only when something that casts it moves
  renderer.setPixelRatio(pr);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let lost = false, ready = false; // context state; the loop only runs once the first frame is compiled
  const bootLost = (e) => { e.preventDefault(); lost = true; }; // a loss during boot ends the boot quietly (posters stay)
  canvas.addEventListener('webglcontextlost', bootLost);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080605);
  scene.fog = new THREE.FogExp2(new THREE.Color(0.03, 0.022, 0.016), 0.085);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.03, 40);

  /* ---------- materials registry (for env intensity, restore and dispose) */
  const mats = new Set();
  let envIntensity = high ? 0.45 : 0.7;
  const track = (m) => { mats.add(m); if ('envMapIntensity' in m) m.envMapIntensity = envIntensity * (m.userData.envScale ?? 1); return m; };

  /* ---------- environment: the Poly Haven HDRI 'warm_restaurant_night', prefiltered once offline into the
     CubeUV layout that PMREMGenerator produces (assets/env-...-pmrem128.hdr). Loading the prefiltered map skips the
     runtime PMREM blur shader, which takes several seconds to compile synchronously on Windows/ANGLE. It is plain
     texture data, so it also survives a context loss without a rebuild. */
  let envTex = null;
  const loadEnv = () => new Promise((res) => new RGBELoader().load('assets/env-warm-restaurant-night-pmrem128.hdr', (t) => {
    t.mapping = THREE.CubeUVReflectionMapping; t.flipY = false; t.generateMipmaps = false;
    t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; res(t);
  }, undefined, () => res(null)));

  /* ---------- lights: the chandelier as key (soft shadows), lantern practicals, a cool rim from the moon window */
  const hemi = new THREE.HemisphereLight(0x3c4a44, 0x1a120c, 0.25);
  const key = new THREE.SpotLight(0xffd6a8, 5.5, 0, 0.66, 0.9, 2);
  key.position.set(0.04, 1.8, 0.06);
  key.target.position.set(0.02, TOP, 0);
  if (high) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.4; key.shadow.camera.far = 3.0;
    key.shadow.bias = -0.0002; key.shadow.normalBias = 0.012;
  }
  const glow = new THREE.PointLight(0xffa860, 1.6, 0, 2);
  glow.position.set(0, 2.15, 0);
  const rim = new THREE.DirectionalLight(0xa9e0cd, 0.6);
  rim.position.set(W.MOON.x + 0.3, 2.6, W.ROOM.backZ - 2.0);
  rim.target.position.set(0, 0.5, 0);
  const lampA = new THREE.PointLight(0xffa458, 2.4, 0, 2);
  lampA.position.set(W.LANTERNS[6][0], W.LANTERNS[6][1] - 0.05, W.LANTERNS[6][2]);
  const lampB = new THREE.PointLight(0xffa458, 1.8, 0, 2);
  lampB.position.set(W.LANTERNS[1][0], W.LANTERNS[1][1] - 0.05, W.LANTERNS[1][2]);
  scene.add(hemi, key, key.target, glow, rim, rim.target, lampA);
  if (high) scene.add(lampB);

  /* ---------- procedural set (instant) */
  const lanterns = W.buildLanterns(tier);
  lanterns.userData.mats.forEach(track);
  const garden = W.buildGarden(tier);
  const steamer = W.buildSteamer(track);
  steamer.position.copy(STEAMER);
  const tea = W.buildTea(track);
  const steamerSteam = W.buildSteam(high ? 40 : 22, { rise: 0.45, spread: 0.06, size: 0.12, rate: 0.18, drift: 0.05, opacity: 0.22, seed: 9, color: 0xcfc4b6 });
  const steamerCols = W.buildSteamColumns(high ? 7 : 4, { rise: 0.42, spread: 0.06, width: 0.09, opacity: 0.3, speed: 0.28, seed: 31, color: 0xd9cfc2 });
  steamerCols.position.set(STEAMER.x, STEAMER.y + 0.07, STEAMER.z);
  const cupCols = W.buildSteamColumns(high ? 3 : 2, { rise: 0.18, spread: 0.012, width: 0.04, opacity: 0.26, speed: 0.26, seed: 5, color: 0xdcd2c4 });
  cupCols.position.set(CUP.x, CUP.y + 0.07, CUP.z);
  const cone = W.buildLightCone(V3(0, 1.78, 0), TOP + 0.02, 0.6, tier);
  steamerSteam.position.set(STEAMER.x, STEAMER.y + 0.08, STEAMER.z);
  const cupSteam = W.buildSteam(high ? 12 : 6, { rise: 0.18, spread: 0.016, size: 0.04, rate: 0.2, drift: 0.02, opacity: 0.18, seed: 4, color: 0xd2c8ba });
  cupSteam.position.set(CUP.x, CUP.y + 0.07, CUP.z);
  scene.add(lanterns, garden, steamer, steamerSteam, steamerCols, cupSteam, cupCols, cone, tea.liquid, tea.stream);
  const shadows = new THREE.Group();
  [[STEAMER, 0.3, 0.6], [POT, 0.26, 0.5], [CUP, 0.18, 0.45], [CUP2, 0.18, 0.4]].forEach(([p, s, o]) => {
    const cs = W.contactShadow(s, s, o); cs.position.set(p.x, TOP + 0.001, p.z); shadows.add(cs);
  });
  const tableShadow = W.contactShadow(1.5, 1.5, 0.7); tableShadow.position.set(0, 0.002, 0); shadows.add(tableShadow);
  scene.add(shadows);

  /* ---------- loading: by station; the hero set first, the rest in idle time */
  const ext = { pot: null, lidPot: null, cup: null, chandelier: null, room: null };
  let loaded = 0;
  const BYTES = { tex: high ? 3.06e6 : 0.79e6, screen: 1.69e6, table: 1.58e6, env: 0.45e6, teaset: 2.28e6, chand: 2.16e6, vase: high ? 0.42e6 : 0 };
  const total = Object.values(BYTES).reduce((s, v) => s + v, 0);
  const tick = (k) => { loaded += BYTES[k] || 0; opts.onProgress && opts.onProgress(loaded / total); };

  // phones skip normal and ARM maps inside the models: those URLs are answered with a 1x1 neutral image
  const manager = new THREE.LoadingManager();
  if (!high) {
    const flat = (r, g, b) => { const c = W.makeCanvas(1, 1), x = c.getContext('2d'); x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(0, 0, 1, 1); return c.toDataURL(); };
    const NOR = flat(128, 128, 255), ARM = flat(255, 140, 0);
    manager.setURLModifier((url) => (/_nor_gl_/.test(url) ? NOR : /_arm_/.test(url) ? ARM : url));
  }
  const gltfLoader = new GLTFLoader(manager);
  const texLoader = new THREE.TextureLoader();
  const loadModel = (id) => new Promise((res) => gltfLoader.load(`${PH}models/${id}/${id}_1k.gltf`, (g) => res(g.scene), undefined, () => res(null)));
  const loadTex = (url, srgb) => new Promise((res) => texLoader.load(url, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; res(t); }, undefined, () => res(null)));
  const texSet = async (id, nor = high) => {
    const [map, normalMap] = await Promise.all([loadTex(`${PH}textures/${id}/${id}_diff_1k.jpg`, true), nor ? loadTex(`${PH}textures/${id}/${id}_nor_1k.jpg`, false) : Promise.resolve(null)]);
    return map ? { map, normalMap } : null;
  };
  function prepModel(root, { shadow = true, rough = null } = {}) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = shadow && high; o.receiveShadow = high;
      const m = o.material;
      if (!high) { m.normalMap = null; m.roughnessMap = null; m.metalnessMap = null; m.aoMap = null; m.roughness = rough ?? 0.6; m.metalness = 0; }
      ['map', 'normalMap', 'roughnessMap', 'emissiveMap'].forEach((k) => { if (m[k]) m[k].anisotropy = maxAniso; });
      m.needsUpdate = true;
      track(m);
    });
    return root;
  }
  async function upload(root) { // one texture per task so no single task stalls on decode and upload
    const seen = new Set();
    root.traverse((o) => { if (o.material) ['map', 'normalMap', 'roughnessMap', 'emissiveMap', 'bumpMap'].forEach((k) => { const t = o.material[k]; if (t) seen.add(t); }); });
    for (const t of seen) { if (lost) return; renderer.initTexture(t); await yieldTask(); }
  }
  // compile shaders in parallel (KHR_parallel_shader_compile) for the target the frame really renders into,
  // with the scene's lights and environment, before the object is ever drawn
  async function compile(obj) {
    if (lost || renderer.getContext().isContextLost()) return;
    renderer.setRenderTarget(composer ? composer.readBuffer : null);
    try { await Promise.race([renderer.compileAsync(obj, camera, scene), new Promise((r) => setTimeout(r, 6000))]); } catch (e) { /* compiled on first draw instead */ }
    renderer.setRenderTarget(null);
  }

  /* --- station 1: room shell, carved screen, tea table (phones: the bamboo wall is drawn on a canvas, which keeps
     the phone tier under 5 MB; the small lime-plaster texture is shared by both tiers) */
  const [floorT, bambooT, plasterT, screenM, tableM, env] = await Promise.all([texSet('old_wood_floor'), high ? texSet('bamboo_wall') : Promise.resolve(null), texSet('beige_wall_001'), loadModel('chinese_screen_panels'), loadModel('chinese_tea_table'), loadEnv()]);
  tick('tex'); tick('screen'); tick('table'); tick('env');
  if (env) { envTex = env; scene.environment = env; } else hemi.intensity = 0.6;
  const T = {};
  if (floorT) {
    const fw = W.ROOM.rightX - W.ROOM.leftX, fd = W.ROOM.frontZ - W.ROOM.backZ;
    floorT.map.repeat.set(fw / 2.2, fd / 2.2); if (floorT.normalMap) floorT.normalMap.repeat.copy(floorT.map.repeat);
    T.floor = { map: floorT.map, normalMap: floorT.normalMap };
  }
  if (bambooT) {
    bambooT.map.repeat.set(1 / 1.3, 1 / 1.3); if (bambooT.normalMap) bambooT.normalMap.repeat.set(1 / 1.3, 1 / 1.3);
    T.bamboo = bambooT;
  } else { T.slat = W.slatTexture(); T.slat.repeat.set(1 / 1.3, 1 / 1.3); T.slat.anisotropy = maxAniso; }
  if (plasterT) {
    const fd = W.ROOM.frontZ - W.ROOM.backZ, ph = W.ROOM.ceilY - 0.95;
    plasterT.map.repeat.set(fd / 1.8, ph / 1.8); if (plasterT.normalMap) plasterT.normalMap.repeat.copy(plasterT.map.repeat);
    T.plaster = plasterT;
  }
  const room = W.buildRoom(T, track);
  ext.room = room;
  scene.add(room);
  if (screenM) {
    prepModel(screenM);
    screenM.scale.setScalar(1.12);
    screenM.position.set(1.45, 0, 3.0);
    screenM.rotation.y = -0.25;
    scene.add(screenM);
    const ss = W.contactShadow(1.7, 0.7, 0.6); ss.position.set(1.45, 0.002, 2.93); ss.rotation.z = 0.25; shadows.add(ss);
  }
  if (tableM) {
    prepModel(tableM, { rough: 0.5 }); tableM.traverse((o) => { if (o.isMesh) o.material.envMapIntensity = envIntensity * 0.3; }); scene.add(tableM);
    // the same table model again, as a side table against the back wall (no extra download)
    const side = tableM.clone(); side.position.copy(room.userData.sideTable); side.rotation.y = 0.04; scene.add(side);
    const sts = W.contactShadow(1.2, 1.2, 0.6); sts.position.set(side.position.x, 0.002, side.position.z); shadows.add(sts);
  }
  // steamer and procedural pieces sit on the table even before the tea set arrives

  /* ---------- post-processing (desktop tier) */
  let composer = null, bloom = null, fxaa = null, grain = null;
  const dbs = new THREE.Vector2();
  function makeComposer() {
    if (!high) return;
    renderer.getDrawingBufferSize(dbs);
    const rt = new THREE.WebGLRenderTarget(dbs.x, dbs.y, { type: THREE.HalfFloatType, samples: 0 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.62, 0.92);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    fxaa = new ShaderPass(FXAA); composer.addPass(fxaa);
    grain = new ShaderPass(GRAIN); composer.addPass(grain);
  }
  // compile the post-processing shaders in parallel too, so the first composed frame does not link them synchronously
  async function precompilePost() {
    if (!composer || lost) return;
    const out = composer.passes.find((q) => q instanceof OutputPass);
    if (out) { // the same defines OutputPass.render() would set on its first call
      out._outputColorSpace = renderer.outputColorSpace; out._toneMapping = renderer.toneMapping;
      out.material.defines = { SRGB_TRANSFER: '', ACES_FILMIC_TONE_MAPPING: '' };
      out.material.needsUpdate = true;
    }
    const geo = new THREE.PlaneGeometry(2, 2), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const toScene = (list) => { const sc = new THREE.Scene(); list.forEach((m) => { if (m) { const q = new THREE.Mesh(geo, m); q.frustumCulled = false; sc.add(q); } }); return sc; };
    const inner = [bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial, out && out.material, fxaa.material];
    const race = (p) => Promise.race([p, new Promise((r) => setTimeout(r, 6000))]);
    try {
      renderer.setRenderTarget(composer.readBuffer);
      await race(renderer.compileAsync(toScene(inner), cam));
      renderer.setRenderTarget(null);
      await race(renderer.compileAsync(toScene([grain.material]), cam));
    } catch (e) { /* compiled on first draw instead */ }
    renderer.setRenderTarget(null);
    geo.dispose();
  }
  function dropComposer() {
    if (!composer) return;
    composer.passes.forEach((p) => p.dispose && p.dispose());
    composer.dispose();
    composer = bloom = fxaa = grain = null;
  }

  /* ---------- sizing */
  let Wd = 1, Ht = 1, portrait = false;
  function resize() {
    Wd = Math.max(1, window.innerWidth); Ht = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(Wd, Ht, false);
    if (high && !composer && bloomOn) makeComposer();
    if (composer) {
      composer.setPixelRatio(pr); composer.setSize(Wd, Ht);
      fxaa.material.uniforms.resolution.value.set(1 / (Wd * pr), 1 / (Ht * pr));
      grain.material.uniforms.uRes.value.set(Wd * pr, Ht * pr);
    }
    camera.aspect = Wd / Ht;
    portrait = Wd / Ht < 0.9;
    wake();
  }
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(resize, 120); };
  window.addEventListener('resize', onResize);
  let bloomOn = high;

  /* ---------- state (scroll-driven) */
  const N = KF.length;
  const cur = { t: 0, u: [0, 0, 0, 0, 0] }, tgt = { t: 0, u: [0, 0, 0, 0, 0] };
  let intro = reduce ? 0 : 1, paused = false, clock = 3.0;
  const pointer = new THREE.Vector2(), pointerCur = new THREE.Vector2();
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onPointer = (e) => { if (paused) return; pointer.set((e.clientX / Wd) * 2 - 1, (e.clientY / Ht) * 2 - 1); wake(); };
  if (fine && !reduce) window.addEventListener('pointermove', onPointer, { passive: true });

  function setState(s) {
    if (s.still !== undefined) {
      tgt.t = s.still;
      tgt.u = STILL_U.map((v, i) => (i < s.still ? 1 : i === s.still ? v : 0));
    } else { tgt.t = s.t; for (let i = 0; i < N; i++) tgt.u[i] = s.u[i] || 0; }
    if (reduce) { cur.t = tgt.t; cur.u = tgt.u.slice(); }
    wake();
  }

  /* ---------- camera */
  const camPos = V3(0, 0, 0), camTg = V3(0, 0, 0), tmp = V3(0, 0, 0), right = V3(0, 0, 0), upv = V3(0, 0, 0);
  function applyCamera() {
    const t = clamp(cur.t, 0, N - 1 - 1e-6);
    const i = Math.floor(t), f = t - i, a = KF[i], b = KF[i + 1];
    const mid = a.m || tmp.copy(a.p).lerp(b.p, 0.5);
    // quadratic path through the mid control point (keeps the camera clear of the screen and the table)
    const k0 = (1 - f) * (1 - f), k1 = 2 * (1 - f) * f, k2 = f * f;
    camPos.set(a.p.x * k0 + mid.x * k1 + b.p.x * k2, a.p.y * k0 + mid.y * k1 + b.p.y * k2, a.p.z * k0 + mid.z * k1 + b.p.z * k2);
    camTg.copy(a.t).lerp(b.t, f);
    // gentle push-in while a station is held
    const st = Math.round(t), ul = cur.u[st] || 0, push = KF[st].push * easeIO(clamp(ul, 0, 1));
    if (Math.abs(t - st) < 0.12) camPos.lerp(camTg, push);
    let fov = lerp(a.fov, b.fov, f);
    const asp = camera.aspect;
    if (asp < 1.25) { // keep the horizontal framing on narrow screens
      const hf = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * 1.25);
      fov = Math.min(68, (2 * Math.atan(Math.tan(hf / 2) / asp) * 180) / Math.PI);
    }
    if (intro > 0) { const e = intro * intro; camPos.lerp(camTg, -0.22 * e); camPos.y += 0.12 * e; }
    if (!paused && !reduce) { camPos.x += Math.sin(clock * 0.21) * 0.012; camPos.y += Math.sin(clock * 0.17 + 1) * 0.008; }
    camera.position.copy(camPos);
    camera.lookAt(camTg);
    if (fine && !reduce) {
      camera.updateMatrixWorld();
      right.setFromMatrixColumn(camera.matrixWorld, 0); upv.setFromMatrixColumn(camera.matrixWorld, 1);
      const d = camPos.distanceTo(camTg) * 0.018;
      camera.position.addScaledVector(right, pointerCur.x * d).addScaledVector(upv, -pointerCur.y * d * 0.6);
      camera.lookAt(camTg);
    }
    camera.fov = fov;
    const sx = portrait ? 0 : lerp(a.sx, b.sx, f), sy = portrait ? lerp(a.sy, b.sy, f) : 0;
    if (Math.abs(sx) + Math.abs(sy) > 1e-4) camera.setViewOffset(Wd, Ht, -sx * Wd, sy * Ht, Wd, Ht);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    renderer.toneMappingExposure = lerp(a.ex, b.ex, f);
    cone.userData.dust.material.uniforms.uPx.value = (Ht * pr) / (2 * Math.tan((fov * Math.PI) / 360));
  }

  /* ---------- scroll-driven moments */
  const potGroup = new THREE.Group(); potGroup.name = 'pot';
  potGroup.position.copy(POT);
  const yaw = Math.atan2(CUP.x - POT.x, CUP.z - POT.z); // spout (+z) points at the cup
  potGroup.rotation.order = 'YXZ';
  scene.add(potGroup);
  const tipW = V3(0, 0, 0), surf = V3(0, 0, 0), dirV = V3(0, 0, 0), downY = V3(0, -1, 0);
  function updateScene() {
    const u = cur.u, t = cur.t;
    // the pour (station 2): lift, tilt, stream, the cup fills, the pot returns
    const p = u[1];
    const lift = easeIO(sstep(0.04, 0.3, p)) * (1 - easeIO(sstep(0.82, 0.98, p)));
    const tilt = easeIO(sstep(0.22, 0.42, p)) * (1 - easeIO(sstep(0.7, 0.86, p)));
    const level = easeIO(sstep(0.38, 0.72, p));
    potGroup.position.copy(POT); potGroup.position.y += lift * 0.085;
    potGroup.rotation.set(tilt * 0.82, yaw, 0);
    potGroup.updateMatrixWorld();
    tipW.copy(SPOUT_TIP); potGroup.localToWorld(tipW);
    // slide the pot so the spout sits over the cup while it is lifted
    potGroup.position.x += (CUP.x + 0.006 - tipW.x) * lift;
    potGroup.position.z += (CUP.z - 0.004 - tipW.z) * lift;
    potGroup.updateMatrixWorld();
    tipW.copy(SPOUT_TIP); potGroup.localToWorld(tipW);
    const cupBase = CUP.y + 0.008;
    const fillY = cupBase + lerp(0.012, 0.054, level);
    tea.liquid.visible = !!ext.cup && level > 0.002;
    tea.liquid.position.set(CUP.x, fillY, CUP.z);
    const rr = lerp(0.034, 0.047, (fillY - cupBase - 0.012) / 0.042);
    tea.liquid.scale.set(rr, rr, 1);
    const pouring = !!ext.pot && tilt > 0.9 && level < 0.999 && level > 0.0;
    tea.stream.visible = pouring || (!!ext.pot && tilt > 0.9 && p > 0.36 && p < 0.72);
    if (tea.stream.visible) {
      surf.set(CUP.x, fillY, CUP.z);
      dirV.subVectors(surf, tipW);
      const len = dirV.length();
      tea.stream.position.copy(tipW);
      tea.stream.quaternion.setFromUnitVectors(downY, dirV.normalize());
      tea.stream.scale.set(0.0021, len, 0.0021);
    }
    cupSteam.userData.U.uAmount.value = ext.cup ? (0.35 + 0.65 * level) * (1 - sstep(2.2, 3.0, t)) * (t > 0.4 ? 1 : 0.6) : 0;
    cupSteam.position.y = fillY + 0.012;
    cupCols.userData.U.uAmount.value = cupSteam.userData.U.uAmount.value;
    cupCols.position.y = fillY + 0.004;

    // the steamer (station 3): steam leaks, the lid lifts and tips back, a bloom of steam
    const s = u[2];
    const open = easeIO(sstep(0.12, 0.6, s)) * (1 - easeIO(sstep(2.55, 3.0, t)));
    const lid = steamer.userData.lid;
    const up = sstep(0.0, 0.3, open), carry = easeIO(sstep(0.22, 0.86, open)), down = sstep(0.62, 0.9, open);
    const st = clamp((open - 0.88) / 0.12, 0, 1), settle = open > 0.88 ? Math.sin(st * 11.0) * Math.exp(-st * 4.5) * 0.05 : 0;
    const air = up * (1 - down);
    lid.position.set(LID_REST.x * carry, lerp(steamer.userData.lidY, 0, carry) + 0.085 * air + Math.abs(settle) * 0.11, LID_REST.z * carry);
    lid.rotation.set(-0.32 * air + settle, 0.5 * carry, 0.22 * air + settle * 0.6);
    steamerSteam.userData.U.uAmount.value = (0.22 + 0.95 * sstep(0.1, 0.5, s)) * (1 - 0.55 * sstep(0.85, 1, s)) * (1 - sstep(3.1, 3.8, t));
    steamerSteam.userData.U.uSpread.value = lerp(0.075, 0.06, open);
    steamerSteam.position.y = STEAMER.y + lerp(0.085, 0.07, open);
    steamerCols.userData.U.uAmount.value = steamerSteam.userData.U.uAmount.value;

    // lantern ceiling (station 4): lanterns and chandelier warm up; dusk deepens at the window for reserve
    const lamp = 1 + 0.32 * sstep(2.4, 3.0, t) * (1 - 0.4 * sstep(3.4, 4, t));
    lanterns.userData.U.uPower.value = lamp;
    const fl = paused || reduce ? 1 : 1 + 0.035 * Math.sin(clock * 7.1) + 0.02 * Math.sin(clock * 12.7);
    key.intensity = 5.5 * fl * (1 + 0.12 * (lamp - 1));
    glow.intensity = 1.6 * fl * lamp;
    lampA.intensity = 2.4 * lamp; lampB.intensity = 1.8 * lamp;
    if (ext.chandelier) ext.chandelier.userData.mat.emissiveIntensity = 0.55 * fl * lamp;
    garden.userData.U.uGlow.value = lerp(1, 0.72, sstep(3.2, 4, t));

    const T = clock;
    lanterns.userData.U.uTime.value = T;
    garden.userData.U.uTime.value = T;
    steamerSteam.userData.U.uTime.value = T;
    cupSteam.userData.U.uTime.value = T;
    steamerCols.userData.U.uTime.value = T; cupCols.userData.U.uTime.value = T;
    cone.userData.U.uTime.value = T; cone.userData.U.uStrength.value = lamp;
    if (grain) grain.material.uniforms.uTime.value = T;
  }

  /* ---------- render loop (on demand when paused and settled; nothing runs off-screen or hidden) */
  let raf = 0, last = 0, journeyVisible = true, tabVisible = !document.hidden, stillQueued = false;
  const canRun = () => ready && !lost && tabVisible && journeyVisible;
  let frames = 0, slow = 0;
  const shadowKey = [NaN, NaN, NaN, NaN, NaN, NaN]; // pot x, y, tilt, lid x, lid y, scene size at the last shadow render
  function draw() {
    if (renderer.shadowMap.enabled) { // re-render the shadow map only when the pot or the lid has moved
      const lp = steamer.userData.lid.position;
      const v0 = potGroup.position.x, v1 = potGroup.position.y, v2 = potGroup.rotation.x, v3 = lp.x, v4 = lp.y, v5 = scene.children.length;
      const sk = shadowKey;
      if (Math.abs(v0 - sk[0]) > 1e-4 || Math.abs(v1 - sk[1]) > 1e-4 || Math.abs(v2 - sk[2]) > 1e-4 || Math.abs(v3 - sk[3]) > 1e-4 || Math.abs(v4 - sk[4]) > 1e-4 || v5 !== sk[5] || sk[0] !== sk[0]) {
        sk[0] = v0; sk[1] = v1; sk[2] = v2; sk[3] = v3; sk[4] = v4; sk[5] = v5; renderer.shadowMap.needsUpdate = true;
      }
    }
    if (composer && bloomOn) composer.render(); else renderer.render(scene, camera);
  }
  function settled() {
    if (Math.abs(cur.t - tgt.t) > 0.0005) return false;
    for (let i = 0; i < N; i++) if (Math.abs(cur.u[i] - tgt.u[i]) > 0.0005) return false;
    return pointerCur.distanceToSquared(pointer) < 1e-6 || paused;
  }
  function frame(ts) {
    raf = 0;
    if (!canRun()) return;
    const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000 || 0.016)); last = ts;
    const k = 1 - Math.exp(-dt * 4.2);
    cur.t += (tgt.t - cur.t) * k;
    for (let i = 0; i < N; i++) cur.u[i] += (tgt.u[i] - cur.u[i]) * k;
    if (Math.abs(cur.t - tgt.t) < 0.0004) cur.t = tgt.t;
    for (let i = 0; i < N; i++) if (Math.abs(cur.u[i] - tgt.u[i]) < 0.0004) cur.u[i] = tgt.u[i];
    if (!paused) { pointerCur.lerp(pointer, 1 - Math.exp(-dt * 3.5)); clock += dt; }
    if (intro > 0) intro = Math.max(0, intro - dt / 2.8);
    applyCamera(); updateScene(); draw();
    if (guard && !paused && !document.hidden) { // adaptive quality: shed cost in stages, then stop watching
      frames++; if (dt > 0.024) slow++;
      if (frames === 120) { if (slow > 70) degrade(); frames = 0; slow = 0; }
    }
    // never queue a second callback: degrade() -> resize() -> wake() may already have queued the next frame
    if (!raf && (!paused || !settled() || intro > 0)) raf = requestAnimationFrame(frame);
  }
  // adaptive quality without shader recompiles (turning shadows or the composer off would relink every program)
  function degrade() {
    if (pr > 1) { pr = Math.max(1, pr - 0.25); resize(); return; }
    if (bloom && bloom.enabled) { bloom.enabled = false; return; }
    guard = false;
  }
  function stillFrame() { // reduced motion: one frame per state change
    if (stillQueued || lost) return;
    stillQueued = true;
    requestAnimationFrame(() => { stillQueued = false; if (!ready || lost) return; applyCamera(); updateScene(); draw(); });
  }
  function wake() {
    if (reduce) { stillFrame(); return; }
    if (raf || !canRun()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  const io = new IntersectionObserver((e) => { journeyVisible = e[0].isIntersecting; journeyVisible ? wake() : stop(); }, { threshold: 0 });
  if (opts.journey) io.observe(opts.journey);
  const onVis = () => { tabVisible = !document.hidden; tabVisible ? wake() : stop(); };
  document.addEventListener('visibilitychange', onVis);
  const onLost = (e) => { e.preventDefault(); lost = true; stop(); opts.onLost && opts.onLost(); };
  const onRestored = () => {
    if (!ready) { lost = false; return; } // the boot had already given up: the posters stay
    // GPU objects of the dead context are forgotten (not disposed): rebuild env map and post targets
    lost = false;
    composer = bloom = fxaa = grain = null; // the env map and all textures are re-uploaded from their CPU copies on first use
    shadowKey[0] = NaN; // the shadow map target is new and empty: render it again
    resize();
    opts.onRestored && opts.onRestored();
    wake();
  };
  canvas.removeEventListener('webglcontextlost', bootLost);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  /* ---------- first frame */
  resize();
  await upload(scene);
  if (reduce) { cur.t = tgt.t; cur.u = tgt.u.slice(); }
  applyCamera(); updateScene();
  await Promise.all([compile(scene), precompilePost()]);
  if (lost) return null;
  ready = true;
  draw();
  opts.onFirstFrame && opts.onFirstFrame();
  wake();

  /* ---------- later stations stream in behind the first frame */
  (async () => {
    const add = async (obj) => { await upload(obj); await compile(obj); if (lost) return; scene.add(obj); wake(); await idle(); };
    try {
      // tea set: teapot (pours), two cups on saucers, a plate under the steamer
      await idle();
      const set = await loadModel('tea_set_01'); tick('teaset');
      if (set && !lost) {
        prepModel(set, { rough: 0.25 });
        const byName = {}; set.traverse((o) => { if (o.isMesh) byName[o.name] = o; });
        const take = (n) => { const o = byName[n] || set.getObjectByName(n); if (o) { o.parent && o.parent.remove(o); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); } return o; };
        const group = new THREE.Group();
        scene.remove(potGroup); // the pot joins the scene again inside `group`, after its upload and compile
        const pot = take('tea_set_01_teapot_01'), plid = take('tea_set_01_teapot_01_lid');
        if (pot) { potGroup.add(pot); ext.pot = pot; }
        if (plid) { plid.position.y = 0.002; potGroup.add(plid); }
        const place = (n, v, ry = 0) => { const o = take(n); if (o) { o.position.copy(v); o.rotation.y = ry; group.add(o); } return o; };
        place('tea_set_01_saucer_circular_03', CUP);
        ext.cup = place('tea_set_01_cup_small_01', V3(CUP.x, CUP.y + 0.0065, CUP.z), 2.4);
        place('tea_set_01_saucer_circular_04', CUP2);
        place('tea_set_01_cup_small_02', V3(CUP2.x, CUP2.y + 0.0065, CUP2.z), 0.6);
        group.add(potGroup);
        await add(group);
      }
      // the chandelier above the table: painted silk panels lit from inside
      const ch = await loadModel('chinese_chandelier'); tick('chand');
      if (ch && !lost) {
        prepModel(ch, { shadow: false });
        ch.traverse((o) => {
          if (o.isMesh) {
            const m = o.material;
            m.emissive = new THREE.Color(0xffb46a); m.emissiveMap = m.map; m.emissiveIntensity = 0.55;
            ch.userData.mat = m;
          }
        });
        ch.scale.setScalar(1.15);
        ch.position.set(0, CH_Y, 0);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, W.ROOM.ceilY - CH_Y, 6), track(new THREE.MeshStandardMaterial({ color: 0x1a0e08, roughness: 0.5 })));
        cord.position.set(0, (W.ROOM.ceilY + CH_Y) / 2, 0); scene.add(cord);
        ext.chandelier = ch;
        await add(ch);
      }
      // a glazed vase on the side table
      const vase = high ? await loadModel('ceramic_vase_01') : null; tick('vase'); // desktop only (phone budget)
      if (vase && !lost) {
        prepModel(vase, { rough: 0.3 });
        vase.scale.setScalar(1.25);
        vase.position.set(room.userData.sideTable.x + 0.12, TOP, room.userData.sideTable.z - 0.05);
        await add(vase);
      }
    } catch (e) { /* a missing asset only leaves that object out */ }
    opts.onDone && opts.onDone();
  })();

  function detach() {
    stop(); io.disconnect();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
  }
  window.addEventListener('pagehide', (e) => { if (!e.persisted) detach(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) { tabVisible = !document.hidden; wake(); } });

  return {
    still: reduce,
    tier,
    setState,
    setPaused(p) {
      paused = p;
      if (p) { // takes effect at once: the opening move snaps to its end and one still frame is drawn
        pointer.copy(pointerCur); intro = 0;
        cur.t = tgt.t; for (let i = 0; i < N; i++) cur.u[i] = tgt.u[i];
      }
      wake();
    },
    dispose() { detach(); W.disposeTree(scene); envTex && envTex.dispose(); dropComposer(); renderer.dispose(); },
  };
}
