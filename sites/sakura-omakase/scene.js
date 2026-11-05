/* Sakura Omakase - 3D scene controller.
   One fixed canvas. Scroll sets a station coordinate u (0..4); the camera glides along a
   keyframed path with damping. No continuous loop when nothing moves (paused / reduced motion). */
import * as THREE from 'three';
import { makeEnvironment, buildWorld, L, ss, clamp01, yieldTask } from './world.js';
import { buildFood } from './food.js';
import { buildPetals } from './petals.js';

/* Camera path. u = station index. sx/sy: shifts the subject so it never hides behind the text panel. */
const KEYS = [
  { u: 0,    pos: [1.0, 1.7, 25.0],  look: [0.5, 2.7, 4.0],    fov: 44, sx: 0.17 },   // arrival: torii, noren, moon
  { u: 0.55, pos: [1.25, 1.7, 10.5],   look: [0.7, 1.8, -2.0],    fov: 52, sx: 0.06 },
  { u: 1,    pos: [1.85, 1.5, -1.0],  look: [0.1, 1.14, -9.5],   fov: 46, sx: -0.16 },  // the counter
  { u: 2,    pos: [1.15, 1.42, -11.7], look: [0.04, 1.1, -13.0], fov: 33, sx: 0.27 },   // omakase board
  { u: 3,    pos: [1.55, 2.25, -19.2], look: [-0.02, 1.12, -20.5], fov: 38, sx: -0.2 }, // chef's tools
  { u: 3.55, pos: [1.2, 2.0, -26.0],  look: [1.0, 2.6, -40.0],   fov: 46, sx: 0.0 },
  { u: 4,    pos: [0.9, 2.0, -31.0], look: [2.6, 6.2, -62.0],   fov: 54, sx: 0.2 },     // reserve: moon and blossom
];

/* Hermite interpolation: camera comes to rest at every station (zero tangent) and keeps
   smooth momentum through the in-between waypoints. No overshoot, no swinging.
   Channels are flattened once so sampling allocates nothing per frame. */
const CH = [
  (k) => k.pos[0], (k) => k.pos[1], (k) => k.pos[2],
  (k) => k.look[0], (k) => k.look[1], (k) => k.look[2],
  (k) => k.fov, (k) => k.sx,
];
const VAL = CH.map((get) => KEYS.map(get));
const TAN = VAL.map((v) => v.map((_, i) => {
  if (Number.isInteger(KEYS[i].u) || i === 0 || i === KEYS.length - 1) return 0;
  return (v[i + 1] - v[i - 1]) / (KEYS[i + 1].u - KEYS[i - 1].u);
}));
function hermite(p1, p2, m1, m2, t) {
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * m2;
}
const SAMPLE = new Float64Array(CH.length);
function sampleKeys(u, out) {
  const n = KEYS.length;
  u = Math.min(KEYS[n - 1].u, Math.max(0, u));
  let i = 0; while (i < n - 2 && u > KEYS[i + 1].u) i++;
  const du = KEYS[i + 1].u - KEYS[i].u, t = (u - KEYS[i].u) / du;
  for (let c = 0; c < CH.length; c++) SAMPLE[c] = hermite(VAL[c][i], VAL[c][i + 1], TAN[c][i] * du, TAN[c][i + 1] * du, t);
  out.pos[0] = SAMPLE[0]; out.pos[1] = SAMPLE[1]; out.pos[2] = SAMPLE[2];
  out.look[0] = SAMPLE[3]; out.look[1] = SAMPLE[4]; out.look[2] = SAMPLE[5];
  out.fov = SAMPLE[6]; out.sx = SAMPLE[7];
}

function detectTier() {
  const small = Math.min(innerWidth, innerHeight) < 600 || innerWidth < 760;
  const coarse = matchMedia('(pointer: coarse)').matches;
  // deviceMemory only exists in Chromium: an unknown value must not demote Safari / Firefox desktops.
  const cores = navigator.hardwareConcurrency || 8, mem = navigator.deviceMemory || 8;
  if (small || (coarse && innerWidth < 1100)) return 0;
  if (cores <= 4 || mem <= 4) return 1;
  return 2;
}

export async function initScene({ canvas, reduce = false, motionOff = false, watch = null } = {}) {
  let tier = detectTier();
  const root = document.documentElement;

  // Native MSAA stays on for every tier so dropping the composer still leaves a smooth canvas.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setClearColor(0x120812);
  // Production: do not read shader logs right after compiling. Reading them forces the driver to finish
  // each program on the spot (seconds of frozen page on Direct3D); without it compileAsync links in parallel.
  renderer.debug.checkShaderErrors = false;

  /* ---- post-processing (desktop tier only; loaded on demand) ---- */
  let composer = null, bloom = null, fxaa = null, outPass = null;
  async function enableComposer() {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { ShaderPass }, { FXAAShader }] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/OutputPass.js'),
      import('three/addons/postprocessing/ShaderPass.js'), import('three/addons/shaders/FXAAShader.js'),
    ]);
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.6, 0.78);
    composer.addPass(bloom);
    outPass = new OutputPass();
    composer.addPass(outPass);
    // the stock shader asks for a -100 sample bias, which Direct3D clamps with a console warning; the targets have no mipmaps, so drop it
    fxaa = new ShaderPass({ ...FXAAShader, fragmentShader: FXAAShader.fragmentShader.replace(/,\s*-100\.0\)/g, ')') });
    composer.addPass(fxaa);
  }

  /* ---- scene: built in slices, yielding between them, so the page keeps answering ---- */
  await yieldTask();
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0x24101e);
  scene.fog = new THREE.FogExp2(fogColor, 0.024);
  let envRT = makeEnvironment(renderer);   scene.environment = envRT.texture;
  const camera = new THREE.PerspectiveCamera(48, 1, 0.08, 800);
  scene.add(camera);

  const lightA = new THREE.PointLight(0xffa862, 6, 10, 2); lightA.position.set(0.5, 0.7, -0.6); camera.add(lightA);
  const lightB = new THREE.PointLight(0xff7040, 8, 10, 2); lightB.position.set(-0.8, 0.2, -3.4); camera.add(lightB);
  scene.add(new THREE.HemisphereLight(0x3a2a58, 0x24100c, 0.3));
  const moonLight = new THREE.DirectionalLight(0x93a6ff, 0.55); moonLight.position.copy(L.moon); scene.add(moonLight);
  const heroLight = new THREE.PointLight(0xffb878, 1.4, 4.5, 2); heroLight.position.set(0.4, 2.05, -13.0); scene.add(heroLight);
  const toolLight = new THREE.PointLight(0xffb878, 1.4, 4.5, 2); toolLight.position.set(0.2, 2.2, -20.4); scene.add(toolLight);

  await yieldTask();
  const world = await buildWorld({ tier });   scene.add(world.group);
  await yieldTask();
  const food = await buildFood({ tier });   scene.add(food.group);
  await yieldTask();
  const petalCounts = [220, 420, 700];
  const petals = buildPetals({ count: 700, fogColor, fogDensity: 0.024 });
  petals.setCount(petalCounts[tier]);
  scene.add(petals.mesh);

  /* ---- state ---- */
  const cam = { pos: [0, 0, 0], look: [0, 0, 0], fov: 48, sx: 0 };
  const lookV = new THREE.Vector3();
  let target = 0, cur = 0, tIdle = 3.7, frozen = !!motionOff, reduced = !!reduce;
  let raf = 0, last = 0, ctxLost = false, inView = true, disposed = false, ready = false;
  let W = 1, H = 1, pointerX = 0, pointerY = 0, px = 0, py = 0;
  let slow = 0, frames = 0, hasSet = false;

  function pixelRatioFor() { return Math.min(window.devicePixelRatio || 1, tier === 2 ? 1.5 : 1); }
  function resize() {
    const host = canvas.parentElement;
    const w = Math.max(2, host.clientWidth), h = Math.max(2, host.clientHeight);
    W = w; H = h;
    renderer.setPixelRatio(pixelRatioFor());
    renderer.setSize(w, h, false);
    if (composer) {
      composer.setPixelRatio(pixelRatioFor()); composer.setSize(w, h);
      if (fxaa) fxaa.material.uniforms.resolution.value.set(1 / (w * pixelRatioFor()), 1 / (h * pixelRatioFor()));
    }
    camera.aspect = w / h;
    schedule();
  }
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(resize, 120); };
  window.addEventListener('resize', onResize);

  if (tier === 2) { try { await enableComposer(); } catch (e) { composer = null; } }
  resize();

  function applyCamera(t) {
    sampleKeys(cur, cam);
    camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    if (!frozen && !reduced) {
      camera.position.x += Math.sin(t * 0.37) * 0.012;
      camera.position.y += Math.sin(t * 0.51) * 0.01;
    }
    lookV.set(cam.look[0], cam.look[1], cam.look[2]);
    camera.lookAt(lookV);
    px += (pointerX - px) * 0.06; py += (pointerY - py) * 0.06;
    if (!frozen && !reduced) { camera.rotateY(-px * 0.022); camera.rotateX(py * 0.014); }
    const aspect = W / H;
    let fov = cam.fov;
    if (aspect < 1) fov = Math.min(86, fov * (1 + 0.62 * clamp01((1 - aspect) / 0.55)));
    else if (aspect < 1.4) fov *= 1 + (1.4 - aspect) * 0.3;
    camera.fov = fov;
    const portrait = aspect < 0.95;
    const sx = portrait ? 0 : cam.sx * (aspect < 1.3 ? 1.25 : 1);
    const sy = portrait ? 0.17 : 0;
    camera.setViewOffset(W, H, -sx * W, sy * H, W, H);
    camera.updateMatrixWorld();
  }

  const state = { u: 0, t: 0, dt: 0.016, camPos: camera.position, pixelRatio: 1, reduce: reduced };
  function prepare(dt) {
    state.u = cur; state.t = tIdle; state.dt = dt; state.pixelRatio = pixelRatioFor(); state.reduce = reduced;
    applyCamera(tIdle);
    world.update(state);
    food.update(state);
    petals.update(tIdle, camera.position, ss(2.9, 3.9, cur));
    heroLight.intensity = 1.4 * (0.55 + 0.45 * ss(1.0, 1.7, cur)) * (1 - ss(2.6, 3.3, cur) * 0.5);
    toolLight.intensity = 1.4 * ss(2.4, 3.0, cur);
  }
  function render(dt) {
    prepare(dt);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  /* Compile every shader program in parallel and wait without blocking the page.
     Programs depend on where the scene is drawn: with the composer it goes into a linear render target
     (no tone mapping), without it straight to the screen, so compile against the target really used. */
  async function compileScene(target) {
    prepare(0.016); // creates per-instance colour buffers etc. so the programs match the first real frame
    // One object per distinct program, a few programs per task: even queuing all ~30 programs at once
    // costs the main thread over half a second.
    const reps = [], keys = new Set();
    scene.traverse((o) => {
      if (!o.material || Array.isArray(o.material)) { if (o.material) reps.push(o); return; }
      const k = o.material.uuid + (o.isInstancedMesh ? (o.instanceColor ? 'ic' : 'i') : '') + (o.isPoints ? 'p' : '') + (o.isLine ? 'l' : '');
      if (!keys.has(k)) { keys.add(k); reps.push(o); }
    });
    // compile() walks materials of hidden objects too (hero pieces, slices); lights, fog and environment come from `scene`.
    const waits = [];
    for (let i = 0; i < reps.length; i += 3) {
      renderer.setRenderTarget(target);
      try { reps.slice(i, i + 3).forEach((o) => waits.push(renderer.compileAsync(o, camera, scene))); }
      finally { renderer.setRenderTarget(null); }
      await yieldTask();
    }
    await Promise.all(waits);
  }
  async function compilePost() {
    if (!composer) return;
    // OutputPass picks its defines on first render: set them now so its program is the one compiled here.
    outPass._outputColorSpace = renderer.outputColorSpace; outPass._toneMapping = renderer.toneMapping;
    outPass.material.defines = { SRGB_TRANSFER: '', ACES_FILMIC_TONE_MAPPING: '' }; outPass.material.needsUpdate = true;
    const quad = new THREE.PlaneGeometry(2, 2);
    const off = new THREE.Scene(), onScreen = new THREE.Scene();
    [bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial, outPass.material]
      .forEach((m) => off.add(new THREE.Mesh(quad, m)));
    onScreen.add(new THREE.Mesh(quad, fxaa.material)); // the last pass draws to the screen
    renderer.setRenderTarget(composer.readBuffer);
    const a = renderer.compileAsync(off, camera);
    renderer.setRenderTarget(null);
    const b = renderer.compileAsync(onScreen, camera);
    await Promise.all([a, b]);
    quad.dispose();
  }
  // Upload the canvas textures one per task while the programs link, so the first frame has nothing left to send.
  async function uploadTextures() {
    const seen = new Set();
    scene.traverse((o) => {
      if (!o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        Object.values(m).forEach((v) => { if (v && v.isTexture) seen.add(v); });
      });
    });
    for (const t of seen) { renderer.initTexture(t); await yieldTask(); }
  }
  try {
    await Promise.all([compileScene(composer ? composer.readBuffer : null), compilePost(), uploadTextures()]);
  } catch (e) { /* compiled on first use instead */ }

  function canRun() { return ready && !document.hidden && inView && !ctxLost && !disposed; } // no frame before the programs are compiled
  function schedule() { if (raf || !canRun()) return; raf = requestAnimationFrame(frame); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } last = 0; }

  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    if (reduced) cur = target;
    else { cur += (target - cur) * (1 - Math.exp(-dt * 4.2)); if (Math.abs(target - cur) < 0.0005) cur = target; }
    const continuous = !reduced && !frozen;
    if (continuous) tIdle += dt;
    render(dt);
    // adaptive quality: step down if the GPU cannot keep up 
    if (continuous && tier > 0) {
      frames++;
      if (frames > 50) { slow = dt > 0.036 ? slow + 1 : Math.max(0, slow - 1); if (slow > 45) { degrade(); slow = 0; frames = 0; } }
    }
    if (continuous || cur !== target) schedule(); else last = 0;
  }

  function disposeComposer() {
    if (!composer) return;
    if (bloom) bloom.dispose();
    if (fxaa) fxaa.dispose();
    composer.dispose();
    composer = bloom = fxaa = null;
  }

  let degrading = false;
  function degrade() {
    if (degrading) return;
    if (composer) {
      // without the composer the scene draws to the screen with other programs: compile those first, off-thread
      degrading = true;
      compileScene(null).catch(() => {}).then(() => {
        degrading = false;
        if (disposed) return;
        disposeComposer(); renderer.setSize(W, H, false); resize();
      });
      return;
    }
    else if (tier > 1) tier = 1;
    else if (tier === 1) { tier = 0; }
    petals.setCount(petalCounts[Math.min(tier, 2)]);
    resize();
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else schedule(); });
  if (watch && 'IntersectionObserver' in window) {
    new IntersectionObserver((e) => { inView = e[0].isIntersecting; if (inView) schedule(); else stop(); }, { threshold: 0 }).observe(watch);
  }
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); ctxLost = true; stop();
    root.classList.add('gl-lost'); // the page shows the poster while the GPU context is gone
  });
  canvas.addEventListener('webglcontextrestored', () => {
    // The PMREM environment lived in a GPU render target: it comes back empty, so bake it again.
    envRT = makeEnvironment(renderer); // old target died with the context: nothing to dispose
    scene.environment = envRT.texture;
    root.classList.remove('gl-lost'); // un-hide the stage first, or resize() measures a 0px host
    ctxLost = false; resize();
    schedule();
  });
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => { pointerX = e.clientX / innerWidth - 0.5; pointerY = e.clientY / innerHeight - 0.5; if (!frozen && !reduced) schedule(); }, { passive: true });
  }

  // first frame, synchronously, so the canvas never fades in empty
  cur = target = 0;
  ready = true;
  render(0.016);   schedule();

  return {
    setU(u) { const nt = reduced ? Math.round(u) : u; if (!hasSet) { hasSet = true; cur = nt; } if (nt === target) return; target = nt; schedule(); },
    setPaused(p) { frozen = !!p; last = 0; schedule(); },
    highlight(i) { food.highlight(i); schedule(); },
    dispose() {
      disposed = true; stop(); window.removeEventListener('resize', onResize);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { Object.values(m).forEach((v) => v && v.isTexture && v.dispose()); m.dispose(); }); });
      disposeComposer(); envRT.dispose();
      renderer.dispose();
    },
  };
}
