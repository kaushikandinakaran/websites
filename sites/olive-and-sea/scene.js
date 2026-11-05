// Olive & Sea - renderer, lighting, staged asset loading, camera path, post-processing and the render loop.
import * as THREE from 'three';
import { createWorld, ASSETS, DUSK_GLSL, SUN_AZ, WORLD_ROT } from './world.js';

// One import with a single retry (a busy dev server can refuse a request); a second failure reaches the poster fallback.
async function imp(path) {
  try { return await import(path); }
  catch (e) { await new Promise((r) => setTimeout(r, 450)); return import(path + '?r=1'); }
}
const yieldTask = () => new Promise((r) => setTimeout(r, 0));
const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 400 }) : setTimeout(r, 40)));
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);

const { clamp, lerp, smoothstep, degToRad } = THREE.MathUtils;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------------ the journey (terrace-local coordinates) */
// p = camera, t = look target, fov, sx/sy = frame shift so the subject clears the text panel (desktop / phones)
const KEYS = [
  { p: V(2.15, 1.22, 5.3), t: V(-0.5, 0.95, -4.6), fov: 36, sx: 0.17, sy: 0.17, blur: 0.05 }, // 0 arrival
  { p: V(-3.0, 1.12, 2.35), t: V(1.25, 0.82, -3.6), fov: 34, sx: -0.15, sy: 0.15, blur: 0.06 }, // 1 the terrace
  { p: V(-1.08, 0.99, -0.1), t: V(-1.86, 0.76, -0.26), fov: 27, sx: 0.15, sy: 0.1, blur: 0.2 }, // 2 lemons and ceramics
  { p: V(2.85, 1.28, 0.95), t: V(-0.45, 1.42, -3.2), fov: 34, sx: -0.14, sy: 0.18, blur: 0.09 }, // 3 dinner at dusk
  { p: V(-0.55, 2.05, -0.3), t: V(0.56, 0.72, -2.72), fov: 33, sx: -0.2, sy: 0.0, blur: 0.08 }, // 4 menu
  { p: V(3.95, 1.85, 5.45), t: V(-0.6, 1.35, -3.6), fov: 38, sx: 0.16, sy: 0.18, blur: 0.05 }, // 5 reserve
];
// t ranges the page holds on each station (must match LO/HI in main.js); the camera only drifts a little inside a hold
const HOLD = [[0, 0.2], [-0.12, 0.12], [-0.12, 0.12], [-0.3, 0.3], [-0.12, 0.12], [-0.12, 0]];
const KNOTS = [];
HOLD.forEach(([lo, hi], i) => { KNOTS.push([i + lo, i === 0 ? 0 : i - 0.05], [i + hi, i === HOLD.length - 1 ? i : i + 0.05]); });
function camParam(t) {
  if (t <= KNOTS[0][0]) return KNOTS[0][1];
  for (let k = 1; k < KNOTS.length; k++) {
    const [t1, s1] = KNOTS[k];
    if (t <= t1) { const [t0, s0] = KNOTS[k - 1]; const f = (t - t0) / Math.max(1e-6, t1 - t0); return s0 + (s1 - s0) * (f * f * (3 - 2 * f)); }
  }
  return KNOTS[KNOTS.length - 1][1];
}
const SUN_SWING = 0.62, SUN_I = 7.0, ENV_GOLD = 0.55, EXPO_GOLD = 0.74;
const STILL_T = [0.1, 1, 2, 3.3, 4, 5]; // reduced motion: one resolved frame per station

/* ------------------------------------------------------------------ main entry */
export async function initScene(canvas, opts = {}) {
  const reduce = !!opts.reduce;
  const onProgress = opts.onProgress || (() => {});
  const small = Math.min(window.innerWidth, window.innerHeight) <= 760 && window.innerWidth <= 900;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const lowCpu = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const tier = small || coarse ? 'low' : lowCpu ? 'mid' : 'high';
  const hi = tier === 'high', low = tier === 'low';

  // addons are fetched one after another, never as a burst: a simple dev server refuses parallel connections
  const P = (path) => imp('three/addons/' + path);
  const { GLTFLoader } = await P('loaders/GLTFLoader.js');
  const { RGBELoader } = await P('loaders/RGBELoader.js');
  const { RoundedBoxGeometry } = await P('geometries/RoundedBoxGeometry.js');
  /* ---------- loading: station 1 first (with a progress line), the rest in idle time */
  // A simple dev server refuses bursts of connections, so every image (ours and the glTF textures) goes through a
  // small queue: at most two image requests in flight.
  const manager = new THREE.LoadingManager();
  // Images are decoded off the main thread (ImageBitmap), so the GPU upload later is a plain copy, not a decode.
  // glTF textures keep their own orientation (flipY false); our tiling textures are flipped at decode instead.
  const bmpGltf = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const bmpFlip = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  let active = 0; const waiting = [];
  const limited = (fn) => new Promise((res, rej) => {
    const run = () => { active++; fn().then(res, rej).finally(() => { active--; if (waiting.length) waiting.shift()(); }); };
    if (active < 2) run(); else waiting.push(run);
  });
  const queuedTexLoader = { load(url, onLoad, onProgress, onError) { limited(() => bmpGltf.loadAsync(url)).then((b) => { const t = new THREE.Texture(b); t.needsUpdate = true; onLoad(t); }, onError); } };
  manager.addHandler(/\.(jpe?g|png|webp)(\?.*)?$/i, queuedTexLoader);
  const gltfLoader = new GLTFLoader(manager);
  const loadBmp = (url) => limited(() => bmpFlip.loadAsync(url)).catch(() => null);
  const loadGLTF = (url) => gltfLoader.loadAsync(url).then((g) => g.scene).catch(() => null);
  // phones: the lemon without its normal and ARM maps (1.3 MB less; it is small on a phone screen)
  const loadLite = (url, rough) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('gltf')))).then((j) => {
    (j.materials || []).forEach((m) => {
      delete m.normalTexture; delete m.occlusionTexture;
      const pb = m.pbrMetallicRoughness || (m.pbrMetallicRoughness = {});
      delete pb.metallicRoughnessTexture; pb.metallicFactor = 0; pb.roughnessFactor = rough;
    });
    return gltfLoader.parseAsync(JSON.stringify(j), url.slice(0, url.lastIndexOf('/') + 1));
  }).then((g) => g.scene).catch(() => null);
  // the lighting map: the Poly Haven 'venice_sunset' HDRI, prefiltered once offline into three's CubeUV layout
  // (assets/env-*.hdr), so the visitor's browser never runs the PMREM blur (shader compile + passes on load)
  const loadEnv = () => new RGBELoader(manager).loadAsync(low ? ASSETS.env128 : ASSETS.env256).then((t) => {
    t.mapping = THREE.CubeUVReflectionMapping; t.flipY = false; t.generateMipmaps = false;
    t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  }).catch(() => null);
  // station-1 downloads start now, in a queue (one file group at a time), while the renderer and world are built
  let queue = Promise.resolve();
  const enqueue = (fn) => { const p = queue.then(fn, fn); queue = p.catch(() => null); return p; };
  const hdrP = enqueue(loadEnv);
  const setP = enqueue(() => loadGLTF(ASSETS.set));
  const floorP = enqueue(() => Promise.all([loadBmp(ASSETS.floor + 'diff_1k.jpg'), low ? null : loadBmp(ASSETS.floor + 'nor_1k.jpg'), low ? null : loadBmp(ASSETS.floor + 'arm_1k.jpg')]));
  const plasterP = enqueue(() => Promise.all([loadBmp(ASSETS.plaster + 'diff_1k.jpg'), low ? null : loadBmp(ASSETS.plaster + 'nor_1k.jpg'), low ? null : loadBmp(ASSETS.plaster + 'arm_1k.jpg')]));
  const chairP = low ? Promise.resolve(null) : enqueue(() => loadGLTF(ASSETS.chair));
  let EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, FXAAShader;
  if (hi) { // two small groups: never more than three module requests at once
    [{ EffectComposer }, { RenderPass }, { ShaderPass }] = await Promise.all([P('postprocessing/EffectComposer.js'), P('postprocessing/RenderPass.js'), P('postprocessing/ShaderPass.js')]);
    [{ UnrealBloomPass }, { OutputPass }, { FXAAShader }] = await Promise.all([P('postprocessing/UnrealBloomPass.js'), P('postprocessing/OutputPass.js'), P('shaders/FXAAShader.js')]);
  }
  onProgress(0.08);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !hi, powerPreference: 'high-performance', alpha: false });
  } catch (e) { return null; }
  if (!renderer.getContext()) return null;
  const dprCap = low ? 1.0 : tier === 'mid' ? 1.25 : 1.5;
  let pr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(pr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 2000);

  /* ---------- the world */
  const world = createWorld({ tier, maxAniso, RoundedBoxGeometry });
  scene.add(world.group);
  const toWorld = (v, out) => out.copy(v).applyAxisAngle(THREE.Object3D.DEFAULT_UP, WORLD_ROT);

  /* ---------- lights: low sun (shadows), dusk sky fill */
  const sun = new THREE.DirectionalLight(0xffc690, 3.0);
  sun.castShadow = !low;
  if (!low) {
    const sz = hi ? 2048 : 1024;
    sun.shadow.mapSize.set(sz, sz);
    Object.assign(sun.shadow.camera, { left: -7.8, right: 7.8, top: 4.4, bottom: -4.4, near: 0.5, far: 50 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035; sun.shadow.radius = 3;
  }
  const sunTarget = new THREE.Object3D(); sunTarget.position.set(0.6, 0.8, 1.2);
  world.group.add(sun, sunTarget); sun.target = sunTarget;
  const hemi = new THREE.HemisphereLight(0x7088c8, 0x2a1d16, 0);
  scene.add(hemi);

  /* ---------- dusk grade over the HDRI background: a multiply dome drawn right after the background */
  const sunDirWorld = SUN_AZ.clone().setY(Math.tan(degToRad(3.5))).normalize();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
    uniforms: { uDusk: { value: 0 }, uNight: { value: 0 }, uSunDir: { value: sunDirWorld } },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: DUSK_GLSL + /* glsl */`varying vec3 vDir; void main(){ gl_FragColor = vec4(duskTint(normalize(vDir)), 1.0); }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, blendEquation: THREE.AddEquation,
  }));
  dome.renderOrder = -1000; dome.frustumCulled = false; dome.visible = false;
  scene.add(dome);

  /* ---------- environment (rebuilt on context restore) */
  // the prefiltered map is plain texture data: three re-uploads it by itself after a context restore
  let hdrTex = null;
  function buildEnv() {
    if (!hdrTex) return;
    scene.environment = hdrTex;
    scene.background = hdrTex;
  }

  /* ---------- post (desktop high tier): bloom on highlights, FXAA, gentle vignette + grain */
  let composer = null, bloom = null, fxaa = null, grain = null, bloomReady = false;
  const size = new THREE.Vector2();
  const GrainShader = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.028 }, uVig: { value: 0.26 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVig; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; d.x *= 1.25;
        c.rgb *= mix(1.0 - uVig, 1.0, smoothstep(0.78, 0.18, length(d)));
        c.rgb += (h(vUv * 997.0 + fract(uTime) * 61.0) - 0.5) * uGrain;
        gl_FragColor = c; }`,
  };
  function makeComposer() {
    if (!hi) return;
    renderer.getDrawingBufferSize(size);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 0 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.2, 0.55, 1.6);
    bloom.enabled = bloomReady; // its eight shaders compile in idle time after the first frame, not before it
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    // the stock FXAA asks for a -100 texture bias (clamped with a console warning on ANGLE/D3D): sample plainly
    fxaa = new ShaderPass({ ...FXAAShader, fragmentShader: FXAAShader.fragmentShader.replace(/,\s*-100\.0\)/g, ')') });
    composer.addPass(fxaa);
    grain = new ShaderPass(GrainShader);
    composer.addPass(grain);
  }

  /* ---------- sizing */
  let raf = 0, last = 0, tabVisible = !document.hidden, inView = true, guard = hi || tier === 'mid', frames = 0, slow = 0;
  let lost = false, ready = false;
  const canRun = () => ready && !lost && tabVisible && inView;
  let W = 1, H = 1, portrait = false;
  function resize() {
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(pr); composer.setSize(W, H); fxaa.material.uniforms.resolution.value.set(1 / (W * pr), 1 / (H * pr)); }
    camera.aspect = W / H;
    portrait = W / H < 0.9;
    wake();
  }
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(resize, 120); };
  window.addEventListener('resize', onResize);

  const upload = async (obj) => { // push textures to the GPU one at a time, yielding between them
    const seen = new Set();
    obj.traverse((o) => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { for (const k in m) { const v = m[k]; if (v && v.isTexture) seen.add(v); } }); });
    for (const t of seen) { renderer.initTexture(t); await yieldTask(); }
  };
  // whitewash: the Poly Haven plaster keeps its relief and grain, but is repainted lime-white
  function whitewash(t) {
    if (!t || !t.image) return t;
    const img = t.image, n = 512, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, n, n);
    const id = g.getImageData(0, 0, n, n), d = id.data;
    let mean = 0; for (let i = 0; i < d.length; i += 4) mean += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    mean /= d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / mean;
      const k = clamp(0.93 + (l - 1) * 0.9, 0.6, 1.08);
      d[i] = Math.min(255, 246 * k); d[i + 1] = Math.min(255, 242 * k); d[i + 2] = Math.min(255, 233 * k);
    }
    g.putImageData(id, 0, 0);
    const out = new THREE.CanvasTexture(c); out.colorSpace = THREE.SRGBColorSpace; out.wrapS = out.wrapT = THREE.RepeatWrapping;
    return out;
  }

  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  const STAGE_A = 6;
  let doneA = 0;
  const stepA = () => { doneA++; onProgress(0.1 + 0.85 * (doneA / STAGE_A)); };
  // decoded ImageBitmap -> texture (orientation already applied at decode, so flipY stays off)
  const bmpTex = (b, srgb) => { if (!b) return null; const t = new THREE.Texture(b); t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
  hdrTex = await hdrP; stepA();
  buildEnv();
  await yieldTask();
  const setScene = await setP; if (setScene) world.addSet(setScene, low); stepA();
  await yieldTask();
  const fl = await floorP;
  world.applyFloor({ map: bmpTex(fl[0], true), normalMap: bmpTex(fl[1]), arm: bmpTex(fl[2]) }); stepA();
  await yieldTask();
  const pl = await plasterP;
  const pd = bmpTex(pl[0], true);
  const ww = whitewash(pd); if (pd && ww !== pd) { pd.dispose(); if (pl[0] && pl[0].close) pl[0].close(); }
  world.applyPlaster({ map: ww, normalMap: bmpTex(pl[1]), arm: bmpTex(pl[2]) }); stepA();
  await yieldTask();
  const ch = await chairP; if (ch) world.addChairs(ch);
  stepA();
  if (lost) return null;
  await upload(scene);
  dome.visible = !!hdrTex;
  makeComposer();
  resize();
  // shadows: the map is redrawn only when the sun moves or a prop arrives (nothing else that casts one moves)
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  const lastSun = new THREE.Vector3(1e9, 0, 0);

  /* ---------- scroll state */
  const cur = { t: 0 }, tgt = { t: 0 };
  let intro = reduce ? 0 : 1, paused = false, clock = 0;
  const pointer = new THREE.Vector2(), pointerCur = new THREE.Vector2();
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onPointer = (e) => { if (paused || reduce) return; pointer.set((e.clientX / W) * 2 - 1, (e.clientY / H) * 2 - 1); };
  if (fine) window.addEventListener('pointermove', onPointer, { passive: true });

  function setState(s) {
    tgt.t = s.still ? STILL_T[clamp(Math.round(s.t), 0, 5)] : clamp(s.t, 0, 5);
    if (reduce || s.still) cur.t = tgt.t;
    wake();
  }

  /* ---------- camera along the journey */
  const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.p), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.t), false, 'centripetal');
  const camL = new THREE.Vector3(), tgL = new THREE.Vector3(), camW = new THREE.Vector3(), tgW = new THREE.Vector3();
  const sunL = new THREE.Vector3();
  const keyLerp = (s, f) => { const i = Math.min(KEYS.length - 2, Math.floor(s)), u = s - i; const e = u * u * (3 - 2 * u); return lerp(KEYS[i][f], KEYS[i + 1][f], e); };
  let pxScale = 400;
  function applyState() {
    const t = cur.t;
    const s = camParam(t);
    posCurve.getPoint(s / (KEYS.length - 1), camL);
    tgtCurve.getPoint(s / (KEYS.length - 1), tgL);
    // opening move: the camera settles in from slightly further back
    const k = intro * intro;
    camL.z += 1.2 * k; camL.y += 0.25 * k;
    if (!paused && !reduce) { camL.x += Math.sin(clock * 0.21) * 0.025; camL.y += Math.sin(clock * 0.17 + 1.3) * 0.012; }
    tgL.x += pointerCur.x * 0.12; tgL.y -= pointerCur.y * 0.06;
    camera.position.copy(toWorld(camL, camW));
    camera.lookAt(toWorld(tgL, tgW));
    camera.fov = keyLerp(s, 'fov') * (portrait ? 1.18 : 1);
    const sx = portrait ? 0 : keyLerp(s, 'sx'), sy = portrait ? keyLerp(s, 'sy') : 0;
    camera.setViewOffset(W, H, -sx * W, sy * H, W, H);
    camera.updateProjectionMatrix();
    pxScale = renderer.domElement.height / (2 * Math.tan(degToRad(camera.fov) / 2));

    // light: golden hour -> dusk -> blue hour
    const dusk = smoothstep(t, 2.72, 3.22);
    const night = smoothstep(t, 3.5, 5.0);
    // the key light comes from the sun's side of the sky, swung a little to the right so the house wall catches it
    const elev = degToRad(lerp(12, -3, smoothstep(t, 2.7, 3.15)));
    sunL.set(Math.sin(SUN_SWING) * Math.cos(elev), Math.sin(elev), -Math.cos(SUN_SWING) * Math.cos(elev)).multiplyScalar(20);
    sun.position.copy(sunTarget.position).add(sunL);
    if (sun.position.distanceToSquared(lastSun) > 1e-8) { lastSun.copy(sun.position); renderer.shadowMap.needsUpdate = true; }
    sun.intensity = SUN_I * smoothstep(elev, degToRad(-0.5), degToRad(4));
    sun.color.setRGB(1, lerp(0.78, 0.5, dusk), lerp(0.56, 0.3, dusk));
    hemi.intensity = lerp(0, 0.55, dusk) * (1 - 0.4 * night);
    dome.material.uniforms.uDusk.value = dusk;
    dome.material.uniforms.uNight.value = night;
    scene.backgroundBlurriness = keyLerp(s, 'blur');
    const envScale = lerp(ENV_GOLD, 0.16, dusk) * (1 - 0.45 * night);
    renderer.toneMappingExposure = lerp(EXPO_GOLD, 1.2, dusk) * lerp(1, 1.08, night) * (1 - 0.06 * smoothstep(s, 1.4, 2) * (1 - smoothstep(s, 2, 2.6)));
    if (bloom) bloom.strength = lerp(0.18, 0.62, dusk);
    world.update({ t, dusk, time: clock, flicker: !paused && !reduce, envScale, pxScale });
    if (grain) grain.uniforms.uTime.value = paused ? 0.5 : clock;
  }
  function draw() { if (composer) composer.render(); else renderer.render(scene, camera); }

  /* ---------- precompile for the target we really render to, then the first frame */
  // Everything drawn later is compiled here in parallel (KHR_parallel_shader_compile), so no frame ever links a
  // program synchronously: the scene, the sky background box, the shadow depth variants, and the post passes
  // (bloom's eight materials, output, FXAA for both its targets, grain) with the defines they really use.
  function bgWarm() {
    if (!hdrTex) return null;
    const L = THREE.ShaderLib.backgroundCube;
    const m = new THREE.ShaderMaterial({ name: 'BackgroundCubeMaterial', uniforms: THREE.UniformsUtils.clone(L.uniforms), vertexShader: L.vertexShader, fragmentShader: L.fragmentShader, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false });
    Object.defineProperty(m, 'envMap', { get() { return this.uniforms.envMap.value; } });
    m.uniforms.envMap.value = hdrTex;
    const g = new THREE.BoxGeometry(1, 1, 1); g.deleteAttribute('normal'); g.deleteAttribute('uv');
    return new THREE.Mesh(g, m);
  }
  function depthWarm() { // the shadow pass's depth programs (front faces are drawn as back faces, double stays double)
    const s = new THREE.Scene(), g = new THREE.PlaneGeometry(1, 1);
    [THREE.BackSide, THREE.DoubleSide].forEach((side) => {
      const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side });
      s.add(new THREE.Mesh(g, m)); s.add(new THREE.InstancedMesh(g, m, 1));
    });
    return s;
  }
  function compileTo(root, rt, target) {
    renderer.setRenderTarget(rt);
    const p = renderer.compileAsync(root, camera, target || null);
    renderer.setRenderTarget(null);
    return p;
  }
  let shadowRT = null;
  function warmPrograms() {
    const jobs = [];
    const rt = composer ? composer.readBuffer : null;
    jobs.push(compileTo(scene, rt));
    const bg = bgWarm(); if (bg) { const s = new THREE.Scene(); s.add(bg); jobs.push(compileTo(s, rt)); }
    if (sun.castShadow) { shadowRT = shadowRT || new THREE.WebGLRenderTarget(4, 4); jobs.push(compileTo(depthWarm(), shadowRT, scene)); }
    if (composer) {
      const quad = new THREE.PlaneGeometry(2, 2), inRT = new THREE.Scene(), onScreen = new THREE.Scene();
      const out = composer.passes.find((p) => p instanceof OutputPass);
      if (out) {
        const m = out.material; m.defines = {};
        if (THREE.ColorManagement.getTransfer(renderer.outputColorSpace) === THREE.SRGBTransfer) m.defines.SRGB_TRANSFER = '';
        if (renderer.toneMapping === THREE.ACESFilmicToneMapping) m.defines.ACES_FILMIC_TONE_MAPPING = '';
        m.needsUpdate = true; out._outputColorSpace = renderer.outputColorSpace; out._toneMapping = renderer.toneMapping;
        inRT.add(new THREE.Mesh(quad, m));
      }
      [bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial, composer.copyPass.material, fxaa.material]
        .forEach((m) => inRT.add(new THREE.Mesh(quad, m)));
      onScreen.add(new THREE.Mesh(quad, grain.material));
      const fx2 = new THREE.Mesh(quad, fxaa.material.clone()); onScreen.add(fx2); // FXAA drawn to the screen once grain is shed
      jobs.push(compileTo(inRT, rt), compileTo(onScreen, null));
    }
    return withTimeout(Promise.all(jobs).catch(() => null), 6000);
  }
  applyState();
  await warmPrograms();
  if (lost || renderer.getContext().isContextLost()) return null;
  onProgress(1);

  /* ---------- render loop: one rAF id, never two; pause = no callbacks at all */
  function settled() { return Math.abs(cur.t - tgt.t) < 0.0004 && intro <= 0 && pointerCur.distanceToSquared(pointer) < 1e-6; }
  function frame(ts) {
    raf = 0;
    if (!canRun()) return;
    const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000 || 0.016)); last = ts;
    if (!reduce) {
      cur.t += (tgt.t - cur.t) * (1 - Math.exp(-dt * 4.2));
      if (Math.abs(cur.t - tgt.t) < 0.0004) cur.t = tgt.t;
      if (!paused) { pointerCur.lerp(pointer, 1 - Math.exp(-dt * 3)); clock += dt; }
      if (intro > 0) intro = Math.max(0, intro - dt / 2.4);
    }
    applyState();
    draw();
    if (guard && !paused && !reduce && !document.hidden) {
      frames++; if (dt > 0.026) slow++;
      if (frames >= 90) { if (slow > 50) degrade(); frames = 0; slow = 0; }
    }
    // degrade() -> resize() -> wake() may already have queued the next frame: never queue a second one
    if (!raf && !reduce && (!paused || !settled())) raf = requestAnimationFrame(frame);
  }
  let stage = 0;
  function degrade() { // idempotent steps; stops watching after the last one
    if (stage === 0 && pr > 1) { pr = Math.max(1, pr - 0.25); if (pr <= 1) stage = 1; resize(); return; }
    if (stage <= 1 && composer && grain.enabled) { bloomReady = false; bloom.enabled = false; grain.enabled = false; stage = 2; return; }
    // shadows stay on for the page's lifetime (switching them off relinks every lit program at once): shrink the map
    if (stage <= 2 && sun.castShadow && sun.shadow.mapSize.x > 512) {
      sun.shadow.mapSize.set(512, 512); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      renderer.shadowMap.needsUpdate = true; stage = 3; guard = false; return;
    }
    guard = false;
  }
  function wake() {
    if (raf || !canRun()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  // off-screen pause watches the real content container (not the fixed canvas)
  const io = new IntersectionObserver((en) => { inView = en[0].isIntersecting; inView ? wake() : stop(); }, { threshold: 0 });
  if (opts.watch) io.observe(opts.watch);
  const onVis = () => { tabVisible = !document.hidden; tabVisible ? wake() : stop(); };
  document.addEventListener('visibilitychange', onVis);

  function onLost(e) { e.preventDefault(); lost = true; stop(); opts.onLost && opts.onLost(); }
  async function onRestored() {
    if (!ready) { lost = false; return; } // during boot: boot builds everything afterwards
    lost = false; ready = false; // no frames until the programs are rebuilt in parallel
    // objects of the dead context are forgotten, not disposed (three has rebuilt its registries)
    composer = bloom = fxaa = grain = null; shadowRT = null; sun.shadow.map = null;
    buildEnv();
    makeComposer();
    if (bloom) bloom.enabled = bloomReady && stage < 2;
    if (grain && stage >= 2) grain.enabled = false;
    renderer.shadowMap.needsUpdate = true;
    resize();
    await warmPrograms();
    if (lost) return;
    ready = true;
    opts.onRestored && opts.onRestored();
    resize();
  }

  ready = true;
  draw();
  wake();

  /* ---------- the rest of the props stream in while the reader looks at the first station */
  (async () => {
    const later = [['jug', world.addJug], ['lemon', world.addLemons], ['lime', world.addLimes], ['vase', world.addVase], ['plant', world.addPlant]]
      .filter(([k]) => !low || k === 'lemon'); // phones: lemons only (about 5.5 MB of 3D in total)
    for (const [key, add] of later) {
      await idle();
      if (lost) return;
      const g = await (low && key === 'lemon' ? loadLite(ASSETS[key], 0.45) : loadGLTF(ASSETS[key]));
      if (!g || lost) continue;
      // prepare off-scene: upload the textures one by one and compile the programs in parallel, THEN show it
      world.prep(g, key);
      await upload(g);
      try {
        if (!renderer.getContext().isContextLost()) {
          const jobs = [compileTo(g, composer ? composer.readBuffer : null, scene)];
          if (sun.castShadow && key === 'plant') { // leaves cut out by alpha need their own shadow depth program
            const s = new THREE.Scene(); const pg = new THREE.PlaneGeometry(1, 1);
            g.traverse((o) => { if (o.isMesh && o.material.alphaTest > 0) s.add(new THREE.Mesh(pg, new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: o.material.map, alphaTest: o.material.alphaTest, side: o.material.side === THREE.DoubleSide ? THREE.DoubleSide : THREE.BackSide }))); });
            shadowRT = shadowRT || new THREE.WebGLRenderTarget(4, 4);
            jobs.push(compileTo(s, shadowRT, scene));
          }
          await withTimeout(Promise.all(jobs), 4000);
        }
      } catch (e) { /* compiled on first draw instead */ }
      if (lost) return;
      add(g);
      renderer.shadowMap.needsUpdate = true;
      wake();
      if (paused || reduce) { applyState(); draw(); }
    }
    if (composer && bloom && !lost && stage < 2) { // bloom's programs were compiled before the first frame
      await idle();
      bloomReady = true; bloom.enabled = true;
      applyState(); draw();
    }
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
    setPaused(p) { paused = p; if (p) { pointer.copy(pointerCur); intro = 0; } wake(); if (p && !raf) { applyState(); draw(); } },
    resize,
  };
}
