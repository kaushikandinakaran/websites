// Forno Rosso - 3D scene controller: renderer, quality tiers, camera path, render loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, pizzaPose } from './world.js';
import { makeTextures } from './textures.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/* ---------- camera path: [J, position, look-at, view shift x, view shift y] ---------- */
const follow = (J, ox, oy, oz, lx, ly, lz) => {
  const p = pizzaPose(J);
  return { J, p: [ox, oy, p.z + oz], l: [lx + p.x, ly, p.z + lz] };
};
const KEYS = [
  { J: 0.0, p: [-1.6, 3.2, 12.2], l: [0.9, 1.2, 4.6], sx: 0.2, sy: 0.0 },
  { J: 0.55, p: [-1.2, 3.0, 10.0], l: [0.4, 0.45, 5.0], sx: 0.17, sy: 0.0 },
  { J: 1.0, p: [1.6, 2.9, 8.9], l: [0, 0.6, 5], sx: -0.03, sy: 0.0 },
  { J: 1.25, p: [4.4, 1.9, 11.6], l: [0, 1.15, 5], sx: -0.17, sy: 0.0 },
  { J: 1.65, p: [3.2, 3.4, 9.6], l: [0, 0.9, 5], sx: -0.17, sy: 0.0 },
  { J: 1.97, p: [0.3, 6.2, 7.2], l: [0, 0.2, 5], sx: -0.1, sy: 0.0 },
  { J: 2.18, p: [2.6, 2.4, 8.6], l: [0, 0.4, 4.4], sx: 0.1, sy: 0.0 },
  { ...follow(2.38, 2.3, 2.1, 5.4, 0, 0.4, -1), sx: 0.16, sy: 0 },
  { ...follow(2.55, 1.5, 1.8, 4.6, 0, 0.5, -2), sx: 0.1, sy: 0 },
  { J: 2.66, p: [0.7, 1.7, -1.8], l: [0.0, 1.0, -9.4], sx: 0.1, sy: 0 },
  { J: 2.8, p: [0.8, 1.55, -3.9], l: [-0.5, 0.8, -10.0], sx: 0.13, sy: 0 },
  { J: 2.92, p: [0.7, 1.55, -4.2], l: [-0.5, 0.8, -10.0], sx: 0.13, sy: 0 },
  { J: 3.15, p: [0.4, 1.9, -3.4], l: [0.3, 0.7, -7.8], sx: -0.08, sy: 0 },
  { J: 3.4, p: [-2.6, 2.9, 1.0], l: [0.3, 0.4, -4.4], sx: -0.14, sy: -0.08 },
  { J: 3.7, p: [-4.6, 3.0, 1.9], l: [0.2, 0.3, -4.4], sx: -0.2, sy: -0.15 },
  { J: 4.0, p: [-4.0, 3.4, 2.5], l: [0.3, 0.3, -4.5], sx: -0.2, sy: -0.15 },
  { J: 4.4, p: [0.6, 4.2, 1.8], l: [0, 0.5, -5.0], sx: 0.0, sy: 0.23 },
  { J: 5.0, p: [1.4, 4.3, 2.2], l: [0, 0.5, -5.0], sx: 0.0, sy: 0.23 },
];
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
const out = { p: new THREE.Vector3(), l: new THREE.Vector3(), sx: 0, sy: 0 };
function sampleCamera(J) {
  const n = KEYS.length;
  let i = 0;
  while (i < n - 2 && J > KEYS[i + 1].J) i++;
  const a = KEYS[Math.max(0, i - 1)], b = KEYS[i], c = KEYS[i + 1], d = KEYS[Math.min(n - 1, i + 2)];
  const f = clamp01((J - b.J) / (c.J - b.J));
  const s = f * f * (3 - 2 * f); // ease each leg so the camera settles on every station
  const u = 0.55 * s + 0.45 * f;
  for (let k = 0; k < 3; k++) {
    out.p.setComponent(k, cr(a.p[k], b.p[k], c.p[k], d.p[k], u));
    out.l.setComponent(k, cr(a.l[k], b.l[k], c.l[k], d.l[k], u));
  }
  out.sx = cr(a.sx, b.sx, c.sx, d.sx, u); out.sy = cr(a.sy, b.sy, c.sy, d.sy, u);
  return out;
}

export async function initScene(canvas, { reduce = false, onFirstFrame } = {}) {
  // ---- quality tier ----
  const small = Math.min(innerWidth, innerHeight) < 600 || innerWidth < 760;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  let tier = small ? 'low' : weak ? 'mid' : 'high';
  const useBloom = tier !== 'low';
  const useShadows = tier === 'high';

  // CPU work first (textures, geometry; split into short tasks), then the WebGL context: on a cold start the
  // first context creation waits for the GPU process, which is usually ready by then.
  const tex = await makeTextures(tier === 'low');
  const world = await buildWorld({ tier, shadows: useShadows, tex });
  await new Promise((r) => setTimeout(r, 0));

  let renderer;
  try {
    // get the context ourselves: when WebGL is unavailable we fall back quietly (three would log a console error)
    const attrs = { alpha: false, depth: true, stencil: false, antialias: !useBloom, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    const gl = canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs);
    if (!gl) { world.dispose(); return null; }
    renderer = new THREE.WebGLRenderer({ canvas, context: gl });
  } catch (e) { world.dispose(); return null; }
  const dprCap = tier === 'high' ? 1.5 : 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.info.autoReset = false;
  renderer.debug.checkShaderErrors = false; // lets programs link in parallel instead of blocking the page
  renderer.shadowMap.enabled = useShadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  await new Promise((r) => setTimeout(r, 0));
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 90);

  let composer = null, bloom = null, outPass = null;
  function size() {
    const w = Math.max(1, canvas.clientWidth || innerWidth), h = Math.max(1, canvas.clientHeight || innerHeight);
    return [w, h];
  }
  let [W, H] = size();
  renderer.setSize(W, H, false);
  if (useBloom) {
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(W * pr, H * pr, { type: THREE.HalfFloatType, samples: tier === 'high' ? 4 : 2 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(world.scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.5, 0.6, 0.9);
    composer.addPass(bloom);
    outPass = new OutputPass();
    composer.addPass(outPass);
    composer.setSize(W, H);
  }

  // ---- state ----
  let target = 0, cur = 0, simT = reduce ? 3.2 : 0, last = 0, raf = 0;
  let paused = false, still = reduce, hidden = document.hidden, offscreen = false, stillQueued = false, ready = false, dirty = true, disposed = false, lost = false, firstDone = false;
  let aspect = W / H;

  const camPos = new THREE.Vector3();
  function applyCamera() {
    const s = sampleCamera(cur);
    const portrait = aspect < 0.9;
    const p = camPos.copy(s.p);
    if (portrait) p.sub(s.l).multiplyScalar(Math.min(1.35, 1 + (0.9 - aspect) * 0.9)).add(s.l);
    camera.position.copy(p);
    camera.lookAt(s.l);
    camera.fov = portrait ? Math.min(62, 38 / Math.max(0.55, aspect * 1.1)) : 38;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // shift the subject so the text card never covers it: sideways on wide screens, upwards on phones
    let sx = s.sx, sy = s.sy;
    const shortLand = H <= 520 && W >= 600 && W > H; // compact side card (style.css, short landscape)
    if (W <= 760 && !shortLand) { // the text card sits at the bottom on phones: push the subject up
      const lead = Math.abs(sx) > 0.001 || Math.abs(sy) > 0.001;
      sy = lead ? 0.19 + Math.max(0, (700 - H) / 700) * 0.3 : sy; sx = 0;
    } else { // wide screens: keep the subject centred in the space beside the card
      const g = Math.min(56, Math.max(16, W * 0.04));
      const cw = shortLand ? Math.min(400, W * 0.54) : Math.min(560, W - 2 * g);
      const free = W - cw - 2 * g;
      sx *= Math.min(1.9, Math.max(0.8, (0.5 - (g + free / 2) / W) / 0.194));
    }
    if (sx || sy) camera.setViewOffset(W, H, -sx * W, sy * H, W, H);
    else camera.clearViewOffset();
  }

  function render() {
    renderer.info.reset();
    applyCamera();
    const m = world.update(cur, simT, camera);
    const pz = world.pizza.position;
    world.focus(pz.x, 0, pz.z);
    world.pxScale.value = (H * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    renderer.toneMappingExposure = m.exp;
    if (bloom) bloom.strength = m.bloom;
    if (composer) composer.render(); else renderer.render(world.scene, camera);
    if (!firstDone) { firstDone = true; onFirstFrame && onFirstFrame(); }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (!paused) simT += dt;
    const k = 1 - Math.exp(-dt * 5.5);
    cur += (target - cur) * k;
    const settled = Math.abs(target - cur) < 0.0004;
    if (settled) cur = target;
    if (paused && settled && !dirty) { stop(); return; }
    dirty = false;
    render();
  }
  function start() {
    if (raf || still || !ready || hidden || offscreen || disposed || lost) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function wake() {
    dirty = true;
    if (still) { // one still frame per animation frame, however many scroll events arrive
      if (stillQueued || !ready || hidden || offscreen || lost) return;
      stillQueued = true;
      requestAnimationFrame(() => { stillQueued = false; cur = target; render(); });
    } else start();
  }

  // ---- events ----
  const onVis = () => { hidden = document.hidden; hidden ? stop() : wake(); };
  document.addEventListener('visibilitychange', onVis);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; stop(); canvas.dispatchEvent(new CustomEvent('gl-lost')); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; canvas.dispatchEvent(new CustomEvent('gl-restored')); wake(); });
  let rz = 0;
  function doResize() {
    [W, H] = size(); aspect = W / H;
    renderer.setSize(W, H, false);
    if (composer) { composer.setSize(W, H); bloom.resolution.set(W / 2, H / 2); }
    wake();
  }
  const onResize = () => { clearTimeout(rz); rz = setTimeout(doResize, 120); };
  window.addEventListener('resize', onResize);
  // do not render while the footer (or anything else) fully covers the canvas
  const journey = document.getElementById('journey');
  let io = null;
  if (journey && 'IntersectionObserver' in window) {
    io = new IntersectionObserver((en) => {
      offscreen = !en[en.length - 1].isIntersecting;
      offscreen ? stop() : wake();
    });
    io.observe(journey);
  }

  // Compile all shader programs in parallel (also for props hidden at the start) and wait without blocking the page.
  applyCamera(); world.update(cur, simT, camera);
  const isLost = () => renderer.getContext().isContextLost();
  // never wait forever: if the context is lost mid-compile, three's readiness poll would never finish
  const settle = (p) => Promise.race([p, new Promise((r) => setTimeout(r, 4000))]);
  const nextTask = () => new Promise((r) => setTimeout(r, 0));
  if (isLost()) return null;
  try {
    const hid = [];
    world.scene.traverse((o) => { if (!o.visible) { hid.push(o); o.visible = true; } });
    // with bloom the scene renders into a render target (no tone mapping), which needs different programs than the screen
    if (composer) renderer.setRenderTarget(composer.readBuffer);
    await settle(renderer.compileAsync(world.scene, camera));
    renderer.setRenderTarget(null);
    hid.forEach((o) => { o.visible = false; });
    if (bloom && !isLost()) { // the post-processing programs too, compiled for the render targets they draw into
      const ppScene = new THREE.Scene();
      const quad = new THREE.PlaneGeometry(2, 2);
      // OutputPass sets its defines on first render; set the same ones now so its program can compile in parallel too
      outPass._outputColorSpace = renderer.outputColorSpace; outPass._toneMapping = renderer.toneMapping;
      outPass.material.defines = { SRGB_TRANSFER: '', ACES_FILMIC_TONE_MAPPING: '' };
      outPass.material.needsUpdate = true;
      [bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial, outPass.material].forEach((m) => ppScene.add(new THREE.Mesh(quad, m)));
      renderer.setRenderTarget(bloom.renderTargetsHorizontal[0]);
      await settle(renderer.compileAsync(ppScene, camera));
      renderer.setRenderTarget(null);
      quad.dispose();
    }
  } catch (e) { renderer.setRenderTarget(null); /* compiled on first use instead */ }
  if (isLost()) return null;
  aspect = W / H;
  // first frame in two short tasks: the shadow map + scene pass first, then post-processing
  if (composer && useShadows) {
    applyCamera(); world.update(cur, simT, camera);
    renderer.setRenderTarget(composer.readBuffer);
    renderer.render(world.scene, camera);
    renderer.setRenderTarget(null);
    await nextTask();
    if (isLost()) return null;
  }
  ready = true;
  render();
  if (!still) start();

  return {
    tier,
    setJ(J) { if (J === target) return; target = J; wake(); },
    setPaused(v) { paused = v; if (!v) wake(); },
    setStill(v) { still = v; if (v) { stop(); cur = target; render(); } else start(); },
    resize: doResize,
    dispose() {
      disposed = true; stop(); clearTimeout(rz); if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', onResize);
      world.dispose(); if (composer) composer.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
