// Blue Pearl - the 3D scene: renderer, camera path, lighting by depth, post effects and the render loop.
import * as THREE from 'three';

// Add-ons are fetched one after another (never as a burst, which a simple server can refuse), leaf modules
// first so every dependency is already loaded when the module that needs it arrives. Each import is retried
// twice after a short pause; the last try adds a query string so no cached failure is reused. If all tries
// fail the error reaches main.js, which keeps the poster.
async function imp(spec) {
  for (let k = 0; ; k++) {
    try { return await import(k < 2 ? spec : spec + '?r=' + Date.now()); }
    catch (e) { if (k >= 2) throw e; await new Promise((r) => setTimeout(r, 300 + k * 500)); }
  }
}
let loading = null;
// main.js starts this while it is still checking for WebGL, so the downloads overlap the GPU start-up.
export function prepare(withPost) { return loading || (loading = loadModules(withPost)); }
let W, RoomEnvironment, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, FXAA;
async function loadModules(withPost) {
  await imp('three/addons/utils/BufferGeometryUtils.js');
  W = await imp('./world.js');
  ({ RoomEnvironment } = await imp('three/addons/environments/RoomEnvironment.js'));
  if (!withPost) return;
  const A = 'three/addons/';
  for (const m of ['shaders/CopyShader.js', 'shaders/LuminosityHighPassShader.js', 'shaders/OutputShader.js', 'postprocessing/Pass.js', 'postprocessing/MaskPass.js']) await imp(A + m);
  const { FXAAShader } = await imp(A + 'shaders/FXAAShader.js');
  ({ ShaderPass } = await imp(A + 'postprocessing/ShaderPass.js'));
  ({ EffectComposer } = await imp(A + 'postprocessing/EffectComposer.js'));
  ({ RenderPass } = await imp(A + 'postprocessing/RenderPass.js'));
  ({ UnrealBloomPass } = await imp(A + 'postprocessing/UnrealBloomPass.js'));
  ({ OutputPass } = await imp(A + 'postprocessing/OutputPass.js'));
  // FXAA samples with a -100 texture bias; Direct3D clamps it and logs a console warning, so drop the bias (the targets have no mipmaps).
  FXAA = { ...FXAAShader, fragmentShader: FXAAShader.fragmentShader.replace(/,\s*-100\.0\)/g, ')') };
}

// Give the browser a turn (input, paint) between the building steps, so no single task blocks the page for long.
const breathe = () => new Promise((r) => {
  if (globalThis.scheduler && typeof scheduler.yield === 'function') scheduler.yield().then(r);
  else { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); }
});

const { clamp, lerp, smoothstep } = THREE.MathUtils;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* Five stations: surface, the dive, the catch, menu, reserve. */
const POS = [V(-4, -3.4, 15), V(3, -25, 9), V(-5, -54, 8), V(9, -58.4, -1), V(0.6, -58.8, -13)];
const LOOK = [V(8, 1.4, -12), V(-3, -30, -16), V(3, -61, -10), V(-3, -61.2, -18), V(0, -60.0, -28.5)];
// Scene content is shifted sideways (desktop) or upward (narrow) so the 3D subject stays clear of the text panel.
const SHIFT_WIDE = [[0.16, 0], [0, 0], [0, 0.05], [0, 0], [0.17, 0]];
const SHIFT_NARROW = [[0, 0.2], [0, 0.05], [0, 0.16], [0, 0], [0, 0.21]];

const KEYS = {
  fog:      ['#2fa9b0', '#0f6f7a', '#0a4a57', '#083b48', '#062f3a'].map((c) => new THREE.Color(c)),
  density:  [0.020, 0.024, 0.034, 0.036, 0.036],
  domeTop:  ['#62d4cf', '#2ea9ae', '#127b86', '#0c5f6c', '#08414e'].map((c) => new THREE.Color(c)),
  domeBot:  ['#0e7581', '#085863', '#06424f', '#05333f', '#04262f'].map((c) => new THREE.Color(c)),
  hemi:     [1.3, 0.9, 0.55, 0.5, 0.45],
  sun:      [2.0, 1.2, 0.6, 0.45, 0.3],
  shaft:    [1.3, 0.8, 0.1, 0, 0],
  caus:     [0.15, 0.35, 0.9, 0.8, 0.55],
  sunGlow:  [1, 0.35, 0, 0, 0],
  bloom:    [0.35, 0.25, 0.22, 0.22, 0.32],
};
function sample(arr, s, out) {
  const i = clamp(Math.floor(s), 0, arr.length - 2), f = clamp(s - i, 0, 1);
  if (arr[0].isColor) return out.copy(arr[i]).lerp(arr[i + 1], f);
  return lerp(arr[i], arr[i + 1], f);
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

export async function createScene({ canvas, tier = 'high', still = false, adaptive = true, onLost, onRestored }) {
  const isLow = tier === 'low', isMid = tier === 'mid';
  await prepare(!isLow);   // phones never load the post-processing modules
  let renderer;
  // Ask the canvas for its context ourselves: if the page cannot get WebGL (the worker probe in main.js can say yes
  // when the page itself cannot), return quietly instead of letting three.js log errors, then hand it over.
  const glAttrs = { antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: still };
  let gl = null;
  try { gl = canvas.getContext('webgl2', glAttrs) || canvas.getContext('webgl', glAttrs); } catch (e) { gl = null; }
  if (!gl) return null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, ...glAttrs });
  } catch (e) { return null; }
  if (!renderer.getContext()) return null;

  let pixelRatioCap = isLow ? 1 : isMid ? 1.25 : 1.5;
  renderer.debug.checkShaderErrors = false;   // no blocking error queries: programs link in parallel off the main thread
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor('#0a4954');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#0a4954', 0.03);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 700);
  await breathe();
  const U = W.makeUniforms(tier);
  await breathe();

  // reflections for glossy shells and the pearl. Baked into a GPU target, so it is rebuilt after a context restore.
  let envRT = null;
  async function buildEnvironment() {
    if (envRT) { envRT.dispose(); envRT = null; }
    const room = new RoomEnvironment();
    // Compile the programs the bake uses (room and background box, drawn into a float target) in parallel first,
    // so the bake itself does not stall the page. The warm-up objects live until the bake is done, so the
    // compiled programs are still cached when the bake asks for them.
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    const bg = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false }));
    try {
      const cam = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
      renderer.setRenderTarget(rt);
      const a = renderer.compileAsync(room, cam), b = renderer.compileAsync(bg, cam);
      renderer.setRenderTarget(null);
      await Promise.all([a, b]);
    } catch (e) { /* compiled during the bake instead */ }
    const pmrem = new THREE.PMREMGenerator(renderer);
    envRT = pmrem.fromScene(room, 0.04);
    room.dispose(); pmrem.dispose();
    rt.dispose(); bg.geometry.dispose(); bg.material.dispose();
    scene.environment = envRT.texture;
  }
  await buildEnvironment();
  await breathe();

  // lights
  const hemi = new THREE.HemisphereLight('#7fdcd7', '#0b4350', 1);
  const sunLight = new THREE.DirectionalLight('#e8fff8', 2);
  sunLight.position.set(8, 30, -6);
  scene.add(hemi, sunLight);

  const camSpline = new THREE.CatmullRomCurve3(POS, false, 'centripetal');
  const lookSpline = new THREE.CatmullRomCurve3(LOOK, false, 'centripetal');
  W.setPath(camSpline.getPoints(90));

  // world, built in small steps
  const dome = W.makeDome(U);
  const surface = W.makeSurface(U);
  const shafts = W.makeShafts(U, isLow ? 2 : isMid ? 3 : 4);
  await breathe();
  const seabed = W.makeSeabed(U, tier);
  await breathe();
  const garden = W.makeGarden(U, tier);
  await breathe();
  const fish = W.makeSchools(U, tier);
  const bubbles = W.makeBubbles(U, isLow ? 160 : isMid ? 300 : 460);
  const snow = W.makeSnow(U, isLow ? 260 : 620);
  const dust = W.makeSnow(U, isLow ? 160 : 420, true);
  await breathe();
  const hero = W.makeHeroOyster(U);
  const burst = W.makeBurst(U, isLow ? 28 : 56, new THREE.Vector3(W.HERO.x, hero.position.y + 1.5, W.HERO.z));
  const beam = W.makePearlBeam(U, new THREE.Vector3(W.HERO.x, hero.position.y + 1, W.HERO.z));
  // The giant oyster (the heaviest shaders: iridescent nacre and pearl) joins the scene only once its programs
  // are ready, after the first frame. It is first seen at the last station, so nobody waits for it.
  scene.add(dome, surface, shafts, seabed, garden, fish, hero.userData.lights, bubbles, burst, beam, snow, dust);
  fish.userData.update(0);
  await breathe();

  // post: bloom (desktop only). Anti-aliasing is FXAA: a 4x MSAA half-float target halved the frame rate on integrated GPUs.
  let composer = null, bloom = null, fxaa = null;
  let bloomOn = !isLow;
  function buildComposer(w, h, pr) {
    const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.5, 0.7, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    fxaa = new ShaderPass(FXAA); composer.addPass(fxaa); setFxaa(w, h, pr);
  }
  function setFxaa(w, h, pr) { if (fxaa) fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr)); }
  function dropComposer() {   // free the big targets once bloom is switched off
    if (!composer) return;
    composer.passes.forEach((p) => p.dispose && p.dispose());
    composer.dispose();
    composer = null; bloom = null; fxaa = null;
  }

  /* -------- sizing */
  let width = 1, height = 1, narrow = false, pr = 1;
  function resize() {
    width = Math.max(1, canvas.clientWidth || window.innerWidth);
    height = Math.max(1, canvas.clientHeight || window.innerHeight);
    pr = Math.min(window.devicePixelRatio || 1, pixelRatioCap);
    narrow = width / height < 1.0;
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = narrow ? clamp(62 + (1 - width / height) * 14, 62, 76) : 48;
    camera.updateProjectionMatrix();
    if (bloomOn) {
      if (!composer) buildComposer(width, height, pr);
      else { composer.setPixelRatio(pr); composer.setSize(width, height); bloom.setSize(width / 2, height / 2); setFxaa(width, height, pr); }
    }
    snow.material.uniforms.uPx.value = dust.material.uniforms.uPx.value = pr * (height / 900);
    wake();
  }
  let resizeTimer = 0;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); };
  window.addEventListener('resize', onResize);

  /* -------- state */
  const target = { s: 0 }, cur = { s: 0 };
  let clock = still ? 28.6 : 0;
  let motionOff = false, dirty = true, last = 0, raf = 0, running = false, visible = true, destroyed = false;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onPointer = (e) => { if (motionOff) return; pointer.tx = (e.clientX / window.innerWidth) * 2 - 1; pointer.ty = (e.clientY / window.innerHeight) * 2 - 1; };
  if (finePointer && !still) window.addEventListener('pointermove', onPointer, { passive: true });

  const tmpC = new THREE.Color(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), right = new THREE.Vector3(), upv = new THREE.Vector3();

  function updateScene() {
    const s = clamp(cur.s, 0, 4);
    // camera along the path
    camSpline.getPoint(s / 4, camPos);
    lookSpline.getPoint(s / 4, camLook);
    const sway = still ? 0 : 1;
    camPos.x += Math.sin(clock * 0.31) * 0.28 * sway;
    camPos.y += Math.cos(clock * 0.26) * 0.2 * sway;
    pointer.x += (pointer.tx - pointer.x) * 0.06; pointer.y += (pointer.ty - pointer.y) * 0.06;
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    if (finePointer && !still) {
      camera.updateMatrixWorld();
      right.setFromMatrixColumn(camera.matrixWorld, 0); upv.setFromMatrixColumn(camera.matrixWorld, 1);
      camera.position.addScaledVector(right, pointer.x * 0.9).addScaledVector(upv, -pointer.y * 0.5);
      camera.lookAt(camLook);
    }
    // shift the subject away from the text panel
    const arr = narrow ? SHIFT_NARROW : SHIFT_WIDE;
    const i = clamp(Math.floor(s), 0, 3), f = s - i;
    const sx = lerp(arr[i][0], arr[i + 1][0], f), sy = lerp(arr[i][1], arr[i + 1][1], f);
    if (Math.abs(sx) + Math.abs(sy) > 1e-4) camera.setViewOffset(width, height, -sx * width, sy * height, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();

    // water by depth
    sample(KEYS.fog, s, tmpC); scene.fog.color.copy(tmpC); U.fogColor.value.copy(tmpC); renderer.setClearColor(tmpC);
    const dens = sample(KEYS.density, s); scene.fog.density = dens; U.fogDensity.value = dens;
    sample(KEYS.domeTop, s, dome.material.uniforms.uTop.value);
    sample(KEYS.domeBot, s, dome.material.uniforms.uBottom.value);
    dome.material.uniforms.uSunStr.value = sample(KEYS.sunGlow, s);
    dome.position.copy(camera.position);
    hemi.intensity = sample(KEYS.hemi, s);
    sunLight.intensity = sample(KEYS.sun, s);
    U.shaft.value = sample(KEYS.shaft, s);
    U.caus.value = sample(KEYS.caus, s);
    shafts.visible = U.shaft.value > 0.01;
    surface.visible = s < 1.6;
    U.open.value = smoothstep(s, 3.05, 3.95);
    if (bloom) bloom.strength = sample(KEYS.bloom, s) * (0.6 + 0.4 * (1 - U.open.value)) + U.open.value * 0.25;
    hero.userData.update(U.open.value, clock, !motionOff);
    fish.userData.update(clock);
    U.time.value = clock;
  }

  function render() {
    if (composer && bloomOn) composer.render();
    else renderer.render(scene, camera);
  }

  /* -------- shader programs: compiled in parallel, off the main thread, before they are first needed */
  // With bloom the scene renders into the composer's target (no tone mapping), which needs different programs
  // from the screen, so compile against the target that will really be used.
  function compileFor(root, toScreen) {
    renderer.setRenderTarget(toScreen || !composer ? null : composer.readBuffer);
    const p = renderer.compileAsync(root, camera, scene);
    renderer.setRenderTarget(null);
    return p;
  }
  function postPrograms() {   // bloom, output and FXAA passes
    if (!composer) return [];
    const quad = new THREE.PlaneGeometry(2, 2), inRT = new THREE.Scene(), onScreen = new THREE.Scene();
    const out = composer.passes.find((p) => p instanceof OutputPass);
    if (out) {   // the output pass sets its defines on first render; set them now so its program can be compiled early
      const m = out.material; m.defines = {};
      if (THREE.ColorManagement.getTransfer(renderer.outputColorSpace) === THREE.SRGBTransfer) m.defines.SRGB_TRANSFER = '';
      if (renderer.toneMapping === THREE.ACESFilmicToneMapping) m.defines.ACES_FILMIC_TONE_MAPPING = '';
      m.needsUpdate = true; out._outputColorSpace = renderer.outputColorSpace; out._toneMapping = renderer.toneMapping;
      inRT.add(new THREE.Mesh(quad, m));
    }
    [bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial, composer.copyPass.material]
      .forEach((m) => inRT.add(new THREE.Mesh(quad, m)));
    if (fxaa) onScreen.add(new THREE.Mesh(quad, fxaa.material));
    renderer.setRenderTarget(composer.readBuffer);
    const a = renderer.compileAsync(inRT, camera);
    renderer.setRenderTarget(null);
    const b = renderer.compileAsync(onScreen, camera);
    return [Promise.all([a, b]).finally(() => quad.dispose())];
  }
  async function warmUp(withHero) {
    try {
      const jobs = [compileFor(scene), ...postPrograms()];
      if (withHero && !hero.parent) jobs.push(compileFor(hero));
      await Promise.all(jobs);
    } catch (e) { /* anything left compiles on first use instead */ }
  }
  async function addHero() {   // after the first frame: compile the oyster's programs, then show it
    try { await compileFor(hero); } catch (e) { /* compiled on first use */ }
    if (destroyed || hero.parent) return;
    scene.add(hero);
    wake();
  }

  /* -------- loop: runs only while something changes; a paused, settled scene costs nothing */
  let accum = 0, frames = 0, adaptStage = 0, warm = 0, shedding = false;
  function tick(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const ds = target.s - cur.s;
    if (!motionOff) clock += dt * (1 + Math.min(2.2, Math.abs(ds) * 16));   // the world speeds up a little while you dive
    cur.s += ds * (1 - Math.exp(-dt * 6));
    const moving = Math.abs(ds) > 2e-4 || (finePointer && (Math.abs(pointer.tx - pointer.x) > 2e-3 || Math.abs(pointer.ty - pointer.y) > 2e-3));
    if (motionOff && !moving && !dirty) { running = false; return; }   // nothing to draw: sleep until wake()
    raf = requestAnimationFrame(tick);
    updateScene();
    render();
    dirty = false;
    if (adaptive && !motionOff && !shedding) { // step quality down if the device cannot hold ~40 fps
      warm += dt;
      if (warm > 2.5) { accum += dt; frames++; if (frames >= 90) { const avg = accum / frames; accum = 0; frames = 0;
        if (avg > 0.026 && adaptStage < 2) { adaptStage++; warm = 1.5;
          if (adaptStage === 1) { pixelRatioCap = 1; resize(); }
          else {   // compile the direct-to-screen programs first, so switching bloom off does not stall
            shedding = true;
            Promise.all([compileFor(scene, true), hero.parent ? null : compileFor(hero, true)]).catch(() => {}).then(() => {
              shedding = false; if (destroyed) return; bloomOn = false; dropComposer(); wake(); });
          } } } }
    }
  }
  function start() {
    if (running || destroyed || still) return;
    running = true; last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function sync() { if (visible && !document.hidden && !contextLost && ready) start(); else stop(); }
  function wake() { dirty = true; if (still) scheduleStill(); else sync(); }

  let stillQueued = false;
  function scheduleStill() {
    if (stillQueued || destroyed || !ready) return;
    stillQueued = true;
    requestAnimationFrame(() => { stillQueued = false; if (destroyed || contextLost) return; cur.s = target.s; updateScene(); render(); });
  }

  /* -------- lifecycle: visibility, context loss */
  let contextLost = false, ready = false;
  const onVis = () => sync();
  document.addEventListener('visibilitychange', onVis);
  // Pause when the page content is out of view (the canvas itself is fixed and always "visible").
  const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; sync(); });
  io.observe(document.getElementById('main') || canvas);
  const lost = (e) => { e.preventDefault(); contextLost = true; stop(); onLost && onLost(); };
  const restored = async () => {
    // The old GPU objects died with the context. Disposing them now would delete handles that belong to the dead
    // context (console warnings), so just forget them and rebuild the environment map and post targets.
    contextLost = false; dirty = true; ready = false;   // no frames until the programs are rebuilt
    envRT = null; composer = null; bloom = null; fxaa = null;
    await buildEnvironment(); resize();
    await warmUp(false);
    if (destroyed || contextLost) return;
    ready = true; sync(); if (still) scheduleStill(); onRestored && onRestored(); };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);

  resize();
  await warmUp(false);
  if (destroyed) return null;
  ready = true;
  updateScene(); render();
  if (!still) start();
  addHero();

  const api = {
    tier,
    setStation(s) { target.s = clamp(s, 0, 4); wake(); },
    jump(s) { target.s = cur.s = clamp(s, 0, 4); wake(); },
    setMotionOff(v) { motionOff = !!v; if (motionOff) { pointer.tx = pointer.x; pointer.ty = pointer.y; } wake(); },
    forceRender() { wake(); },
    destroy() {
      destroyed = true; stop();
      window.removeEventListener('resize', onResize); window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVis); io.disconnect();
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
      if (!hero.parent) W.disposeTree(hero);
      W.disposeTree(scene);
      if (U.causTex.value) U.causTex.value.dispose();
      if (envRT) envRT.dispose();
      dropComposer();
      renderer.dispose();
    },
  };
  return api;
}
