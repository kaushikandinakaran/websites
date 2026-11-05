// Saffron Court - the whole page is one 3D scene. Scrolling flies a camera through it.
import * as THREE from 'three';
import * as A from './art.js';

/* Add-ons load one at a time (leaf modules first) with a retry, so a busy server never costs the whole scene.
   If the post-processing add-ons still fail, the scene runs without bloom instead of falling back to posters. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const yieldNow = () => new Promise((r) => setTimeout(r, 0));
async function imp(path) {
  for (let i = 0; ; i++) {
    try { return await import(i < 2 ? path : `${path}?r=${i}`); }
    catch (e) { if (i >= 3) throw e; await sleep(250 + i * 400); }
  }
}
let RoundedBoxGeometry = null, EffectComposer = null, RenderPass = null, UnrealBloomPass = null, OutputPass = null;
const group = (paths) => Promise.all(paths.map((p) => imp('three/addons/' + p)));
async function loadAddons(withComposer) {
  // three small groups, leaf modules first, so no request burst and every dependency is already loaded
  const box = imp('three/addons/geometries/RoundedBoxGeometry.js').then((m) => { RoundedBoxGeometry = m.RoundedBoxGeometry; }, () => { RoundedBoxGeometry = null; });
  if (!withComposer) { await box; return false; }
  try {
    await group(['shaders/CopyShader.js', 'postprocessing/Pass.js', 'shaders/LuminosityHighPassShader.js', 'shaders/OutputShader.js']);
    await group(['postprocessing/MaskPass.js', 'postprocessing/ShaderPass.js']);
    [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await group(['postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/UnrealBloomPass.js', 'postprocessing/OutputPass.js']);
    await box;
    return true;
  } catch (e) { await box; return false; }
}
let addons = null;
/* Called by the page as soon as this module has loaded, so the add-ons download while the page settles. */
export function preload(withComposer) { if (!addons) addons = loadAddons(withComposer); return addons; }
/* Rounded box, or a plain box if the add-on could not load. */
const rbox = (w, h, d, seg, r) => (RoundedBoxGeometry ? new RoundedBoxGeometry(w, h, d, seg, r) : new THREE.BoxGeometry(w, h, d));

/* Merge meshes that share one material into a single static mesh (world space). Keeps position, normal, uv. */
function mergeGeometries(list) {
  let nv = 0, ni = 0;
  list.forEach(({ g }) => { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  let vo = 0, io = 0;
  list.forEach(({ g, m }) => {
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, n = P.count;
    nm.getNormalMatrix(m);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z; }
      if (U) { uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i); }
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo;
    else for (let i = 0; i < n; i++) idx[io++] = i + vo;
    vo += n;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

const V3 = THREE.Vector3;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hdr = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);

/* World landmarks */
const C_ORBIT = new V3(0, 3.8, -20);
const TANDOOR = new V3(-3.2, 0, -101);
const THALI = new V3(7.5, 1.22, -101);
const HALL_Z0 = -37, HALL_STEP = 7, HALL_N = 8;
const sAtZ = (z) => 1.42 + 0.54 * ((-38.5 - z) / 52);

/* ------------------------------------------------------------------ */
/* Point-sprite shader: glows, motes, embers, steam, floating lanterns */
/* ------------------------------------------------------------------ */
const POINT_VS = /* glsl */`
attribute vec4 aSeed; attribute vec3 aColor; attribute float aLit;
uniform float uTime, uScale, uS, uRise, uSway, uGrow, uSpeed, uSize, uMaxPx, uOpacity;
varying vec3 vColor; varying float vAlpha;
void main(){
  vec3 p = position; float t = 0.0; float fade = 1.0;
  #ifdef RISE
    t = fract(aSeed.x + uTime * uSpeed * (0.6 + aSeed.z * 0.8));
    p.y += t * uRise;
    p.x += sin(uTime * 0.7 * aSeed.w + aSeed.x * 40.0) * uSway * (0.25 + t);
    p.z += cos(uTime * 0.6 * aSeed.w + aSeed.x * 33.0) * uSway * (0.25 + t);
    fade = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.5, 1.0, t));
  #else
    p.x += sin(uTime * 0.35 * aSeed.z + aSeed.x * 40.0) * uSway;
    p.y += sin(uTime * 0.28 * aSeed.w + aSeed.x * 23.0) * uSway * 0.6;
    p.z += cos(uTime * 0.3 * aSeed.z + aSeed.x * 17.0) * uSway;
    fade = 0.72 + 0.28 * sin(uTime * (1.5 + aSeed.z * 2.0) + aSeed.x * 60.0);
  #endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float lit = 1.0;
  #ifdef LIT
    lit = smoothstep(aLit - 0.24, aLit - 0.12, uS);
  #endif
  float px = aSeed.y * uSize * (1.0 + t * uGrow) * uScale / max(-mv.z, 0.1);
  gl_PointSize = lit > 0.002 ? min(px, uMaxPx) : 0.0;
  gl_Position = projectionMatrix * mv;
  vAlpha = fade * lit * uOpacity; vColor = aColor;
}`;
const POINT_FS = /* glsl */`
varying vec3 vColor; varying float vAlpha; uniform float uIntensity;
void main(){
  vec2 q = (gl_PointCoord - 0.5) * 2.0; float r = length(q);
  #if SHAPE == 1
    vec2 b = abs(q * vec2(1.0, 0.85)) - vec2(0.34, 0.46);
    float sd = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0) - 0.07;
    float body = 1.0 - smoothstep(-0.03, 0.03, sd);
    float halo = exp(-max(sd, 0.0) * 4.5) * 0.5;
    float rib = 0.82 + 0.18 * step(0.5, fract(q.x * 3.2 + 0.5));
    vec3 col = mix(vColor * 0.55, vColor * 1.6, smoothstep(-0.6, 0.5, q.y));
    float a = body * rib + halo * (1.0 - body);
    gl_FragColor = vec4(col * uIntensity, a * vAlpha);
  #else
    if (r > 1.0) discard;
    #if SHAPE == 2
      float a = (1.0 - r) * (1.0 - r) * 0.55;
    #else
      float a = exp(-r * r * 3.6);
    #endif
    gl_FragColor = vec4(vColor * uIntensity, a * vAlpha);
  #endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/* Builds the world in small chunks (yielding to the page between them), compiles every shader program in
   parallel without blocking the main thread, and resolves with the controller once the first frame can draw. */
export async function createScene({ canvas, context = undefined, reduce = false, mobile = false, low = false, observe = null }) {
  /* ---------- Tiers ---------- */
  const useComposer = (await preload(!mobile && !low)) && !!EffectComposer;
  const density = mobile || low ? 0.45 : 1;
  let prCap = mobile ? 1 : 1.5;
  const MAX_PIXELS = 3.4e6;

  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: !useComposer, powerPreference: 'high-performance' });
  renderer.debug.checkShaderErrors = false; // programs link in parallel instead of stalling the page
  renderer.setClearColor(0x1c0610, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x2a0a16, 0.0125);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);

  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };
  const updaters = [];
  const pointMats = [];

  /* ---------- State ---------- */
  const st = {
    anchors: [], scrollY: 0, s: 0, sTarget: 0, menuP: 0, group: -1, paused: false, still: reduce, running: false, raf: 0,
    time: reduce ? 6.5 : 0, last: 0, dirty: true, hidden: false, ready: false, lost: false,
    px: 0, py: 0, pxT: 0, pyT: 0, w: 0, h: 0, pr: 0, offscreen: false, frames: 0, slow: 0, emaDt: 0.016,
  };

  function sFromScroll(y) {
    const A2 = st.anchors; if (!A2.length) return 0;
    if (y <= A2[0].y) return A2[0].s;
    if (y >= A2[A2.length - 1].y) return A2[A2.length - 1].s;
    let i = 0; while (i < A2.length - 2 && y > A2[i + 1].y) i++;
    const a = A2[i], b = A2[i + 1]; if (a.s === b.s || b.y === a.y) return a.s;
    const u = (y - a.y) / (b.y - a.y);
    return lerp(a.s, b.s, 0.35 * u + 0.65 * u * u * (3 - 2 * u));
  }

  /* ---------- Composer / sizing ---------- */
  let composer = null, bloom = null;
  const BLOOM_BASE = 0.34;
  function buildComposer(w, h) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(w, h), BLOOM_BASE, 0.55, 1.0);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  // Resizing the drawing buffer waits for the GPU, so it only happens when the size really changed.
  function resize(force = false) {
    const w = Math.max(1, canvas.clientWidth || window.innerWidth), h = Math.max(1, canvas.clientHeight || window.innerHeight);
    let pr = Math.min(window.devicePixelRatio || 1, prCap);
    if (w * h * pr * pr > MAX_PIXELS) pr = Math.max(1, Math.sqrt(MAX_PIXELS / (w * h)));
    const changed = force || w !== st.w || h !== st.h || pr !== st.pr;
    st.w = w; st.h = h; st.pr = pr;
    if (changed) { renderer.setPixelRatio(pr); renderer.setSize(w, h, false); }
    camera.aspect = w / h;
    const pf = clamp((1.15 - camera.aspect) / 0.7, 0, 1);
    camera.fov = 50 + pf * 14; st.pf = pf;
    camera.updateProjectionMatrix();
    if (useComposer) { const fresh = !composer; if (fresh) buildComposer(w, h); if (changed || fresh) { composer.setPixelRatio(pr); composer.setSize(w, h); } }
    const scale = (h * pr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    pointMats.forEach((m) => { m.uniforms.uScale.value = scale; });
    st.dirty = true; wake();
  }
  resize(); // size the drawing buffer now, while the GPU is idle

  /* ---------- Environment (designed reflections for brass; rebuilt after a context restore) ---------- */
  let envRT = null;
  async function buildEnv(warm) {
    const env = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.BoxGeometry(30, 16, 30), new THREE.MeshBasicMaterial({ color: 0x2a0a16, side: THREE.BackSide }));
    env.add(room);
    const panel = (w, h, col, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 3, 0); env.add(m); };
    panel(12, 6, hdr(5.5, 2.9, 0.8), -12, 4, -2);
    panel(9, 5, hdr(0.5, 3.4, 3.2), 12, 3, -6);
    panel(10, 10, hdr(2.4, 2.1, 1.8), 0, 14, 0);
    panel(8, 4, hdr(3.5, 1.6, 0.5), 2, 2, 13);
    const pm = new THREE.PMREMGenerator(renderer);
    if (warm) {
      // The PMREM blur shader takes seconds to compile on Windows/ANGLE, and fromScene() would draw with it at once,
      // stalling the page. Compile its programs in parallel first (into a linear half-float target, exactly as
      // PMREM renders), then bake. Uses r160 internals of PMREMGenerator; if they ever differ, it simply bakes.
      const tmpRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace, depthBuffer: false });
      try {
        pm._setSize(256);
        const t = pm._allocateTargets(); t.dispose();
        const cam = new THREE.PerspectiveCamera(90, 1, 0.1, 100), quad = new THREE.PlaneGeometry(2, 2);
        renderer.setRenderTarget(tmpRT);
        await renderer.compileAsync(new THREE.Mesh(quad, pm._blurMaterial), cam);
        await renderer.compileAsync(env, cam);
        quad.dispose();
      } catch (e) { /* bake below compiles on use */ }
      renderer.setRenderTarget(null); tmpRT.dispose();
    }
    const rt = pm.fromScene(env, 0.03);
    scene.environment = rt.texture;
    if (envRT) envRT.dispose();
    envRT = rt; pm.dispose();
    env.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
  const envReady = buildEnv(true); // its shaders compile in the background while the world is built below
  await yieldNow();

  /* ---------- Materials ---------- */
  const std = (o) => track(new THREE.MeshStandardMaterial(o));
  const MAT = {
    brass: std({ color: '#c9a24b', metalness: 1, roughness: 0.36, envMapIntensity: 0.95 }),
    brassDim: std({ color: '#a07f36', metalness: 1, roughness: 0.42, envMapIntensity: 1 }),
    plaster: std({ color: '#5a1426', roughness: 0.85, envMapIntensity: 0.35 }),
    sand: std({ color: '#74192f', roughness: 0.8, envMapIntensity: 0.35 }),
    teal: std({ color: '#128a84', roughness: 0.28, metalness: 0.2, envMapIntensity: 0.9 }),
    clay: std({ color: '#a2502e', roughness: 0.82, envMapIntensity: 0.3 }),
    ivory: std({ color: '#f1e4c8', roughness: 0.7, envMapIntensity: 0.4 }),
  };

  /* ---------- Lights ---------- */
  scene.add(new THREE.HemisphereLight(0x9a6a9a, 0x2a0a14, density >= 1 ? 0.55 : 1.0));
  const moonLight = new THREE.DirectionalLight(0x86d0dc, 0.55); moonLight.position.set(-26, 40, 22); scene.add(moonLight);
  const camLight = new THREE.PointLight(0xffd29a, 18, 18, 1.8); scene.add(camLight);
  // One "station" light travels with the story (gate -> spice orbit -> thali -> orbit again for the overview) instead of
  // three fixed lights: every lit pixel then loops over fewer lights. It fades out, moves while dark, and fades in.
  const stationLight = new THREE.PointLight(0xffb070, 0, 26, 1.6); if (density >= 1) scene.add(stationLight);
  const STATION_LIGHTS = [
    { a: -1, b: 0.62, pos: new V3(0, 5.5, 12), col: new THREE.Color(0xffb070), i: 46, d: 26, decay: 1.5 },
    { a: 0.78, b: 1.42, pos: C_ORBIT.clone(), col: new THREE.Color(0xffa640), i: 34, d: 26, decay: 1.7, flicker: true },
    { a: 2.45, b: 3.25, pos: new V3(THALI.x + 1, 5.2, THALI.z + 2), col: new THREE.Color(0xffc27a), i: 34, d: 14, decay: 1.6 },
    { a: 3.55, b: 9, pos: C_ORBIT.clone(), col: new THREE.Color(0xffa640), i: 34, d: 26, decay: 1.7, flicker: true },
  ];
  const fireLight = new THREE.PointLight(0xff7a22, 60, 26, 1.7); fireLight.position.set(TANDOOR.x, 4.2, TANDOOR.z); scene.add(fireLight);

  /* ---------- Sky, stars, moon ---------- */
  const skyMat = track(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color('#0d0410') }, uMid: { value: new THREE.Color('#2e0b20') }, uHor: { value: new THREE.Color('#36101c') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 uTop, uMid, uHor;
      void main(){ vec3 d = normalize(vP); float h = d.y;
        vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.22, h)); c = mix(c, uTop, smoothstep(0.18, 0.7, h));
        c = mix(c, uHor * 0.5, smoothstep(0.0, -0.3, h));
        float glow = exp(-pow(h * 4.0, 2.0)) * smoothstep(0.2, -0.9, d.z) * 0.8; c += uHor * glow;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const sky = new THREE.Mesh(track(new THREE.SphereGeometry(400, 24, 16)), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

  const moonTex = track(A.moonTexture());
  const moon = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, transparent: true })));
  moon.position.set(78, 70, -250); moon.scale.set(46, 46, 1); scene.add(moon);

  /* ---------- Point system factory ---------- */
  function makePoints({ pos, color, size = 1, sizeJitter = 0.4, seed = 1, rise = 0, sway = 0, grow = 0, speed = 1, lit = null, intensity = 1, shape = 0, opacity = 1, sizes = null, maxPx = 150 }) {
    const n = pos.length / 3, r = rng(seed);
    const g = track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    const seeds = new Float32Array(n * 4), cols = new Float32Array(n * 3), litA = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      seeds[i * 4] = r(); seeds[i * 4 + 1] = sizes ? sizes[i] : 1 - sizeJitter + r() * sizeJitter * 2; seeds[i * 4 + 2] = r(); seeds[i * 4 + 3] = 0.5 + r();
      const c = typeof color === 'function' ? color(i, r) : color;
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      litA[i] = lit ? lit[i] : -9;
    }
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    g.setAttribute('aColor', new THREE.BufferAttribute(cols, 3));
    g.setAttribute('aLit', new THREE.BufferAttribute(litA, 1));
    const defines = { SHAPE: shape };
    if (rise > 0) defines.RISE = '';
    if (lit) defines.LIT = '';
    const m = track(new THREE.ShaderMaterial({
      defines, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: { value: 0 }, uScale: { value: 800 }, uS: { value: 0 }, uRise: { value: rise }, uSway: { value: sway }, uGrow: { value: grow }, uSpeed: { value: speed }, uSize: { value: size }, uMaxPx: { value: maxPx }, uOpacity: { value: opacity }, uIntensity: { value: intensity } },
      vertexShader: POINT_VS, fragmentShader: POINT_FS,
    }));
    pointMats.push(m);
    const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p);
    return p;
  }
  const flat = (arr) => { const f = new Float32Array(arr.length * 3); arr.forEach((v, i) => { f[i * 3] = v.x; f[i * 3 + 1] = v.y; f[i * 3 + 2] = v.z; }); return f; };

  // stars
  {
    const r = rng(7), n = Math.round(260 * density + 40), pts = [];
    for (let i = 0; i < n; i++) { const th = r() * Math.PI * 2, ph = Math.acos(0.05 + r() * 0.95); pts.push(new V3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)).multiplyScalar(360)); }
    makePoints({ pos: flat(pts), color: (i, rr) => new THREE.Color().setRGB(1, 0.9 + rr() * 0.1, 0.75 + rr() * 0.2), size: 1.4, sizeJitter: 0.6, seed: 3, intensity: 1.1, maxPx: 7 });
  }

  await yieldNow();
  /* ---------- Floor ---------- */
  const floorTex = track(A.floorTexture([14, 30]));
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(84, 180)), std({ map: floorTex, roughness: 0.55, metalness: 0.15, envMapIntensity: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -45); scene.add(floor);

  // rangoli under the orbit
  const rangoliTex = track(A.rangoliTexture());
  const rangoli = new THREE.Mesh(track(new THREE.CircleGeometry(10, 64)), std({ map: rangoliTex, emissive: 0xffffff, emissiveMap: rangoliTex, emissiveIntensity: 0.4, roughness: 0.8, transparent: true }));
  rangoli.rotation.x = -Math.PI / 2; rangoli.position.set(C_ORBIT.x, 0.03, C_ORBIT.z); rangoli.userData.dyn = true; scene.add(rangoli);
  await yieldNow();

  /* ---------- Walls ---------- */
  const wallTex = track(A.wallTexture(null));
  const pierTex = track(A.pierTexture()); // shared by the gate piers (repeated) and the hall arches
  await yieldNow();
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  const wallMat = std({ map: wallTex, emissive: 0xffffff, emissiveMap: wallTex, emissiveIntensity: 0.16, roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.3 });
  const gateWallMat = std({ map: wallTex, emissive: 0xffffff, emissiveMap: wallTex, emissiveIntensity: 0.55, roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.3 });
  const wallPlane = (w, h, tileCenter = false) => {
    const g = track(new THREE.PlaneGeometry(w, h)); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) { let u = uv.getX(i) * (w / 7); if (tileCenter) u += (1 - w / 7) / 2; uv.setXY(i, u, uv.getY(i) * (h / 9.6)); }
    return g;
  };
  const addWall = (w, h, x, y, z, ry, center) => { const m = new THREE.Mesh(wallPlane(w, h, center), wallMat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };

  /* ---------- Gate ---------- */
  {
    const g = new THREE.Group(); scene.add(g);
    const GA = { a: 2.9, h0: 4.6, rise: 4.2 };
    const frame = new THREE.Mesh(track(A.archFrameGeometry({ width: 14, height: 11.6, ...GA, depth: 1.8, scallops: 7, amp: 0.2 })), MAT.sand);
    frame.position.y = 0; g.add(frame);
    // brass inlay band around the opening
    const trimMat = track(new THREE.MeshBasicMaterial({ color: hdr(1.7, 1.2, 0.45) }));
    const trim = new THREE.Mesh(track(A.archTrimGeometry(GA.a, GA.h0, GA.rise, 0.07, 7, 0.2)), trimMat); trim.position.z = 0.92; g.add(trim);
    const trimB = new THREE.Mesh(trim.geometry, trimMat); trimB.position.z = -0.92; g.add(trimB);
    const outer = new THREE.Mesh(track(A.archTrimGeometry(3.7, 4.6, 5.2, 0.05)), track(new THREE.MeshBasicMaterial({ color: hdr(0.12, 0.9, 0.85) }))); outer.position.z = 0.93; g.add(outer);
    // jali screen with a warm glow behind it
    const jali = track(A.jaliTexture([3.2, 2.4]));
    jali.wrapS = jali.wrapT = THREE.RepeatWrapping;
    const fillG = track(A.archFillGeometry(GA.a - 0.04, GA.h0, GA.rise - 0.04, 7, 0.2));
    const screen = new THREE.Mesh(fillG, track(new THREE.MeshStandardMaterial({ color: '#d8b050', metalness: 1, roughness: 0.35, alphaMap: jali, alphaTest: 0.5, side: THREE.DoubleSide, envMapIntensity: 1.1 })));
    screen.position.z = 0.1; g.add(screen);
    const glowPlane = new THREE.Mesh(fillG, track(new THREE.MeshBasicMaterial({ color: hdr(1.9, 0.8, 0.2), side: THREE.DoubleSide })));
    glowPlane.position.z = -0.25; g.add(glowPlane);
    // flanking walls, with merlons
    [-1, 1].forEach((sx) => {
      const w = new THREE.Mesh(track(new THREE.BoxGeometry(9, 9.6, 1.8)), MAT.sand); w.position.set(sx * 11.5, 4.8, 0); g.add(w);
      const face = addWall(9, 9.6, sx * 11.5, 4.8, 0.93, 0, true); face.material = gateWallMat;
    });
    // piers beside the arch: tiled diamond columns in brass frames, plus a cornice
    const gPierTex = track(pierTex.clone()); gPierTex.wrapS = gPierTex.wrapT = THREE.RepeatWrapping; gPierTex.repeat.set(1, 1.7);
    const gPierMat = std({ map: gPierTex, emissive: 0xffffff, emissiveMap: gPierTex, emissiveIntensity: 0.42, roughness: 0.8, envMapIntensity: 0.3 });
    const gPierG = track(new THREE.PlaneGeometry(2.9, 9.3));
    const gFrameG = track(rbox(3.15, 9.55, 0.1, 2, 0.04));
    [-1, 1].forEach((sx) => {
      const pm = new THREE.Mesh(gPierG, gPierMat); pm.position.set(sx * 5.3, 4.8, 1.03); g.add(pm);
      const pf = new THREE.Mesh(gFrameG, MAT.brass); pf.position.set(sx * 5.3, 4.8, 0.97); g.add(pf);
    });
    const cornice = new THREE.Mesh(track(rbox(14.6, 0.26, 2.2, 2, 0.06)), MAT.brass); cornice.position.set(0, 10.6, 0.2); g.add(cornice);
    const corniceTeal = new THREE.Mesh(track(new THREE.BoxGeometry(14.2, 0.5, 2.0)), MAT.teal); corniceTeal.position.set(0, 10.2, 0.2); g.add(corniceTeal);
    const merlons = [];
    for (let sx = -1; sx <= 1; sx += 2) for (let i = 0; i < 6; i++) merlons.push([sx * (7.9 + i * 1.5), 9.9, 0]);
    for (let sx = -1; sx <= 1; sx += 2) for (let i = 0; i < 24; i++) merlons.push([sx * 15.9, 9.9, -2 - i * 1.5]);
    const mg = track(rbox(0.9, 0.9, 0.9, 2, 0.12));
    const mm = new THREE.InstancedMesh(mg, MAT.sand, merlons.length); const d = new THREE.Object3D();
    merlons.forEach((m, i) => { d.position.set(...m); d.updateMatrix(); mm.setMatrixAt(i, d.matrix); }); g.add(mm);
    // onion domes
    const domeG = track(A.onionDomeGeometry());
    const drumG = track(new THREE.CylinderGeometry(1.05, 1.15, 1.1, 20));
    [-1, 1].forEach((sx) => {
      const drum = new THREE.Mesh(drumG, MAT.sand); drum.position.set(sx * 5.4, 11.6 + 0.55, 0); g.add(drum);
      const collar = new THREE.Mesh(track(new THREE.TorusGeometry(1.1, 0.07, 6, 28)), MAT.brass); collar.rotation.x = Math.PI / 2; collar.position.set(sx * 5.4, 12.75, 0); g.add(collar);
      const dome = new THREE.Mesh(domeG, MAT.teal); dome.position.set(sx * 5.4, 12.7, 0); dome.scale.setScalar(1.05); g.add(dome);
      const fin = new THREE.Mesh(track(new THREE.SphereGeometry(0.14, 10, 8)), MAT.brass); fin.position.set(sx * 5.4, 12.7 + 2.2, 0); g.add(fin);
    });
    // marigold toran garland over the arch
    {
      const r = rng(21), beads = [];
      const pts = A.archPoints(GA.a + 0.35, GA.h0, GA.rise + 0.35, 40);
      pts.forEach((p, i) => { beads.push([p.x, p.y, 1.05, r()]); if (i % 3 === 0 && p.y > 5) { const L = 1 + r() * 1.5; for (let k = 1; k <= Math.floor(L / 0.24); k++) beads.push([p.x + (r() - 0.5) * 0.04, p.y - k * 0.24, 1.05, r()]); } });
      const bg = track(new THREE.SphereGeometry(0.1, 8, 6));
      const bm = new THREE.InstancedMesh(bg, track(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, emissive: '#552200', emissiveIntensity: 0.6 })), beads.length);
      const palette = [new THREE.Color('#f5a524'), new THREE.Color('#e8751a'), new THREE.Color('#ffc43a'), new THREE.Color('#f58a1f')];
      const dd = new THREE.Object3D();
      beads.forEach((b, i) => { dd.position.set(b[0], b[1], b[2]); dd.scale.setScalar(0.85 + b[3] * 0.5); dd.updateMatrix(); bm.setMatrixAt(i, dd.matrix); bm.setColorAt(i, palette[Math.floor(b[3] * 4) % 4]); });
      g.add(bm);
    }
  }

  await yieldNow();
  /* Court walls + end wall */
  addWall(37, 9.6, -16, 4.8, -18.5, Math.PI / 2, false);
  addWall(37, 9.6, 16, 4.8, -18.5, -Math.PI / 2, false);
  addWall(9, 9.6, -11.5, 4.8, -37.2, 0, true);
  addWall(9, 9.6, 11.5, 4.8, -37.2, 0, true);
  // hall walls and alcove
  const hallLen = HALL_N * HALL_STEP;
  addWall(hallLen, 9.9, -7, 4.95, HALL_Z0 - hallLen / 2, Math.PI / 2, false);
  addWall(hallLen, 9.9, 7, 4.95, HALL_Z0 - hallLen / 2, -Math.PI / 2, false);
  addWall(34, 9.6, -17, 4.8, -101, Math.PI / 2, false);
  addWall(34, 9.6, 17, 4.8, -101, -Math.PI / 2, false);
  addWall(34, 9.6, 0, 4.8, -118, 0, true);
  addWall(10, 9.6, -12, 4.8, -92.5, Math.PI, true);
  addWall(10, 9.6, 12, 4.8, -92.5, Math.PI, true);

  /* ---------- Orbit court ---------- */
  const orbit = new THREE.Group(); orbit.position.copy(C_ORBIT); orbit.userData.dyn = true; scene.add(orbit);
  const spiceCols = ['#f2b01e', '#c4301f', '#e8751a', '#7aa34a', '#c08a3c', '#7a4a25', '#d9a441', '#9b2a1c', '#b89b5e'].map((c) => new THREE.Color(c));
  const rings = [];
  {
    const bowlG = track(A.bowlGeometry()), moundG = track(A.moundGeometry());
    const moundMat = std({ color: '#ffffff', roughness: 0.92, flatShading: true, envMapIntensity: 0.25 });
    const mk = (n, r, tiltX, tiltZ, speed, y0) => {
      const grp = new THREE.Group(); grp.rotation.set(tiltX, 0, tiltZ); orbit.add(grp);
      const bowls = new THREE.InstancedMesh(bowlG, MAT.brass, n);
      const mounds = new THREE.InstancedMesh(moundG, moundMat, n);
      for (let i = 0; i < n; i++) mounds.setColorAt(i, spiceCols[(i * 2 + (r > 4 ? 1 : 0)) % spiceCols.length]);
      bowls.frustumCulled = false; mounds.frustumCulled = false;
      grp.add(bowls, mounds);
      rings.push({ grp, bowls, mounds, n, r, speed, y0, inv: new THREE.Quaternion() });
    };
    mk(7, 3.4, 0.2, 0.12, 0.2, 0);
    mk(Math.round(12 * (density > 0.9 ? 1 : 0.75)), 6.1, -0.16, -0.1, -0.12, 0.2);
    // spice pieces ring
    const pieces = [];
    const pg = [
      [track(A.starAniseGeometry()), std({ color: '#6b3a1c', roughness: 0.6, envMapIntensity: 0.4 }), 0.8],
      [track(new THREE.CapsuleGeometry(0.1, 0.26, 4, 8)), std({ color: '#7fae4e', roughness: 0.5, envMapIntensity: 0.4 }), 1],
      [track(new THREE.ConeGeometry(0.11, 0.7, 8)), std({ color: '#c4301f', roughness: 0.4, envMapIntensity: 0.6 }), 1],
      [track(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8)), std({ color: '#b8793c', roughness: 0.7, envMapIntensity: 0.3 }), 1],
    ];
    const per = Math.round(7 * (density > 0.9 ? 1 : 0.7));
    const pgrp = new THREE.Group(); pgrp.rotation.set(0.1, 0, -0.08); orbit.add(pgrp);
    pg.forEach(([geo, mat, sc], k) => {
      const im = new THREE.InstancedMesh(geo, mat, per); im.frustumCulled = false; pgrp.add(im);
      pieces.push({ im, k, sc, per });
    });
    rings.pieces = pieces;
  }
  // saffron sun + armillary rings
  const sunMat = track(new THREE.MeshBasicMaterial({ color: hdr(2.6, 1.4, 0.3) }));
  const sun = new THREE.Mesh(track(new THREE.SphereGeometry(0.34, 24, 16)), sunMat); orbit.add(sun);
  const armA = new THREE.Mesh(track(new THREE.TorusGeometry(1.3, 0.025, 6, 64)), MAT.brass), armB = new THREE.Mesh(track(new THREE.TorusGeometry(1.8, 0.025, 6, 64)), MAT.brass);
  orbit.add(armA, armB);
  makePoints({ pos: new Float32Array([C_ORBIT.x, C_ORBIT.y, C_ORBIT.z]), color: hdr(1.5, 0.75, 0.18), size: 5.5, sizeJitter: 0, intensity: 0.7, maxPx: 260 });
  // spice dust swirling up
  makePoints({ pos: (() => { const r = rng(5), a = []; const n = Math.round(150 * density); for (let i = 0; i < n; i++) { const th = r() * 6.283, rr = 0.3 + r() * 7; a.push(new V3(C_ORBIT.x + Math.cos(th) * rr, 0.2 + r() * 2, C_ORBIT.z + Math.sin(th) * rr)); } return flat(a); })(),
    color: (i, r) => spiceCols[Math.floor(r() * spiceCols.length)].clone().multiplyScalar(1.7), size: 0.2, sizeJitter: 0.5, seed: 11, rise: 7, sway: 1.1, speed: 0.07, intensity: 1.2, maxPx: 22 });

  await yieldNow();
  /* ---------- Hall ---------- */
  // arch frames merge into one static mesh; the two glowing trims are instanced (one draw each) and
  // light up arch by arch through their per-instance colour
  const hallLit = [];
  let hallTrims = null;
  {
    const archG = track(A.pierUV(A.archFrameGeometry({ width: 14, height: 9.9, a: 3.3, h0: 4.4, rise: 3.9, depth: 0.9, bevel: 0.05 }), 3.3, 14, 9.9));
    const pierMat = std({ map: pierTex, emissive: 0xffffff, emissiveMap: pierTex, emissiveIntensity: 0.22, roughness: 0.8, envMapIntensity: 0.3 });
    const trimG = track(A.archTrimGeometry(3.3, 4.4, 3.9, 0.07));
    const trimG2 = track(A.archTrimGeometry(3.7, 4.4, 4.4, 0.04));
    const trimMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const t1 = new THREE.InstancedMesh(trimG, trimMat, HALL_N), t2 = new THREE.InstancedMesh(trimG2, trimMat, HALL_N);
    const d = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < HALL_N; i++) {
      const z = HALL_Z0 - i * HALL_STEP;
      const m = new THREE.Mesh(archG, pierMat); m.position.set(0, 0, z); scene.add(m);
      d.position.set(0, 0, z + 0.47); d.updateMatrix(); t1.setMatrixAt(i, d.matrix); t2.setMatrixAt(i, d.matrix);
      t1.setColorAt(i, c.setRGB(0.16, 0.1, 0.04)); t2.setColorAt(i, c.setRGB(0.04, 0.18, 0.17));
      hallLit.push({ s: sAtZ(z - 3), l: -1 });
    }
    t1.computeBoundingSphere(); t2.computeBoundingSphere();
    scene.add(t1, t2); hallTrims = [t1, t2];
  }

  await yieldNow();
  // string lights
  {
    const bulbs = [], lit = [];
    const warm = hdr(2.4, 1.3, 0.4), warm2 = hdr(2.6, 1.7, 0.6), teal = hdr(0.3, 1.9, 1.7);
    const strand = (p0, p1, sag, n, litS, cols = [warm, warm2, warm, teal]) => {
      for (let i = 0; i <= n; i++) {
        const u = i / n; const p = new V3().lerpVectors(p0, p1, u); p.y -= Math.sin(u * Math.PI) * sag;
        bulbs.push({ p, c: cols[i % cols.length], s: litS });
      }
    };
    // gate: posts to arch, across the front
    for (const sx of [-1, 1]) {
      strand(new V3(sx * 3.6, 3.7, 7.5), new V3(sx * 6.8, 10.3, 1.3), 0.5, 14, -9);
      strand(new V3(sx * 3.6, 3.7, 7.5), new V3(sx * 7.5, 9.8, 3), 0.4, 12, -9);
    }
    strand(new V3(-3.6, 3.7, 7.5), new V3(3.6, 3.7, 7.5), 0.55, 18, -9);
    // courtyard: along the side walls
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) strand(new V3(sx * 15.4, 7.2, -2 - k * 9), new V3(sx * 15.4, 7.2, -2 - (k + 1) * 9), 0.9, 14, -9);
    // hall
    for (let i = 0; i < HALL_N; i++) {
      const z0 = HALL_Z0 - i * HALL_STEP, z1 = z0 - HALL_STEP, zm = z0 - HALL_STEP / 2, sL = sAtZ(zm);
      strand(new V3(-6.5, 7.2, z0 - 0.7), new V3(-6.5, 7.2, z1 + 0.7), 0.8, 10, sL);
      strand(new V3(6.5, 7.2, z0 - 0.7), new V3(6.5, 7.2, z1 + 0.7), 0.8, 10, sL);
      strand(new V3(-6.6, 8.4, zm), new V3(6.6, 8.4, zm), 1.9, 22, sL);
    }
    // bulbs tracing every hall arch: they ignite one arch at a time
    for (let i = 0; i < HALL_N; i++) {
      const z = HALL_Z0 - i * HALL_STEP + 0.62, sL = sAtZ(HALL_Z0 - i * HALL_STEP - 3);
      const pts = A.archPoints(3.02, 4.4, 3.78, 34); let k = 0;
      for (const p of pts) { bulbs.push({ p: new V3(p.x, p.y, z), c: [warm, warm2, warm, teal][k++ % 4], s: sL }); }
      for (let q = 0; q < 8; q++) for (const sx of [-1, 1]) bulbs.push({ p: new V3(sx * 3.02, 0.5 + q * 0.5, z), c: [warm2, warm][q % 2], s: sL });
    }
    const n = bulbs.length, pos = new Float32Array(n * 3);
    bulbs.forEach((b, i) => { pos.set([b.p.x, b.p.y, b.p.z], i * 3); lit.push(b.s); });
    makePoints({ pos, color: (i) => bulbs[i].c, size: 0.4, sizeJitter: 0.15, lit, seed: 31, intensity: 1.0, maxPx: 48 });
  }

  // lanterns (hung in the hall, on posts at the gate)
  {
    const L = [];
    for (let i = 0; i < HALL_N; i++) L.push({ x: (i % 2 ? -1 : 1) * (1.2 + (i % 3) * 0.5), y: 5.6, z: HALL_Z0 - i * HALL_STEP - 3.5, hang: true, s: sAtZ(HALL_Z0 - i * HALL_STEP - 3.5) });
    for (const sx of [-1, 1]) L.push({ x: sx * 3.6, y: 3.8, z: 7.5, post: true, s: -9 }, { x: sx * 10, y: 5.2, z: -12, hang: false, s: -9 });
    const shellG = track(A.lanternShellGeometry()), bodyG = track(new THREE.CylinderGeometry(0.27, 0.27, 0.5, 12, 1, true));
    const shells = new THREE.InstancedMesh(shellG, MAT.brass, L.length);
    const bodies = new THREE.InstancedMesh(bodyG, track(new THREE.MeshBasicMaterial({ color: hdr(2.6, 1.3, 0.35), side: THREE.DoubleSide })), L.length);
    const d = new THREE.Object3D(); const cord = [];
    L.forEach((l, i) => {
      d.position.set(l.x, l.y, l.z); d.scale.setScalar(1.1); d.updateMatrix(); shells.setMatrixAt(i, d.matrix);
      d.position.set(l.x, l.y + 0.2 * 1.1 + 0.25 * 1.1, l.z); d.updateMatrix(); bodies.setMatrixAt(i, d.matrix);
      if (l.hang) cord.push(l.x, l.y + 1.1, l.z, l.x, 8.3, l.z);
      if (l.post) { cord.push(l.x, 0, l.z, l.x, l.y, l.z); }
    });
    scene.add(shells, bodies);
    const cg = track(new THREE.BufferGeometry()); cg.setAttribute('position', new THREE.Float32BufferAttribute(cord, 3));
    scene.add(new THREE.LineSegments(cg, track(new THREE.LineBasicMaterial({ color: 0xc9a24b }))));
    const gp = new Float32Array(L.length * 3), gl = [];
    L.forEach((l, i) => { gp.set([l.x, l.y + 0.55, l.z], i * 3); gl.push(l.s); });
    makePoints({ pos: gp, color: hdr(2.2, 1.1, 0.3), size: 1.7, sizeJitter: 0.1, lit: gl, seed: 41, intensity: 0.6, maxPx: 110 });
  }

  // diyas
  {
    const D = [];
    for (let i = 0; i < 11; i++) { D.push([-1.5, 13 - i * 1.7], [1.5, 13 - i * 1.7]); }
    for (let i = 0; i < HALL_N; i++) { const z = HALL_Z0 - i * HALL_STEP; for (let k = 0; k < 3; k++) { D.push([-6 + k * 0.5, z - 0.9 - k * 0.2], [6 - k * 0.5, z - 0.9 - k * 0.2]); } }
    for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.283; D.push([TANDOOR.x + Math.cos(a) * 4.4, TANDOOR.z + Math.sin(a) * 4.4]); }
    for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283; D.push([C_ORBIT.x + Math.cos(a) * 9.8, C_ORBIT.z + Math.sin(a) * 9.8]); }
    const dg = track(A.diyaGeometry());
    const dm = new THREE.InstancedMesh(dg, MAT.clay, D.length);
    const fg = track(new THREE.SphereGeometry(0.06, 8, 6)); fg.scale(1, 1.9, 1);
    const fm = new THREE.InstancedMesh(fg, track(new THREE.MeshBasicMaterial({ color: hdr(4, 2.2, 0.5) })), D.length);
    const d = new THREE.Object3D(); const gpos = new Float32Array(D.length * 3);
    D.forEach(([x, z], i) => { d.position.set(x, 0, z); d.updateMatrix(); dm.setMatrixAt(i, d.matrix); d.position.set(x, 0.2, z); d.updateMatrix(); fm.setMatrixAt(i, d.matrix); gpos.set([x, 0.3, z], i * 3); });
    scene.add(dm, fm);
    makePoints({ pos: gpos, color: hdr(2.4, 1.2, 0.3), size: 0.7, sizeJitter: 0.25, sway: 0, seed: 51, intensity: 0.85, maxPx: 44 });
  }

  await yieldNow();
  /* ---------- Tandoor ---------- */
  const flames = [];
  {
    const g = new THREE.Group(); g.position.copy(TANDOOR); scene.add(g);
    const tt = track(A.tandoorTexture());
    const body = new THREE.Mesh(track(A.tandoorGeometry()), std({ map: tt, roughness: 0.8, envMapIntensity: 0.4 })); g.add(body);
    [[0.35, 1.9], [1.9, 2.0], [2.7, 1.55]].forEach(([y, r]) => { const t = new THREE.Mesh(track(new THREE.TorusGeometry(r, 0.06, 6, 40)), MAT.brass); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); });
    const rim = new THREE.Mesh(track(new THREE.TorusGeometry(1.05, 0.1, 8, 36)), MAT.brass); rim.rotation.x = Math.PI / 2; rim.position.y = 3.58; g.add(rim);
    const mouth = new THREE.Mesh(track(new THREE.CircleGeometry(0.93, 28)), track(new THREE.MeshBasicMaterial({ color: hdr(2.6, 1.0, 0.2) })));
    mouth.rotation.x = -Math.PI / 2; mouth.position.y = 3.2; g.add(mouth);
    const fm = track(new THREE.MeshBasicMaterial({ color: hdr(2.0, 0.75, 0.12), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    const cone = track(new THREE.ConeGeometry(0.3, 1.5, 10)); cone.translate(0, 0.75, 0);
    for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(cone, fm); const a = i / 5 * 6.283; f.position.set(Math.cos(a) * 0.42, 3.25, Math.sin(a) * 0.42); g.add(f); flames.push({ f, ph: i * 1.3 }); }
    // skewers + cubes
    const sk = track(new THREE.CylinderGeometry(0.022, 0.022, 3.4, 5)); sk.translate(0, 1.7, 0);
    const skewers = new THREE.InstancedMesh(sk, MAT.brass, 7);
    const cubeG = track(rbox(0.26, 0.26, 0.26, 2, 0.05));
    const cubes = new THREE.InstancedMesh(cubeG, std({ color: '#fff', roughness: 0.55, envMapIntensity: 0.4 }), 7 * 4);
    const cc = ['#e0682a', '#f0e2b8', '#5f9a3a', '#c23b22'].map((c) => new THREE.Color(c));
    const d = new THREE.Object3D(); const up = new V3(0, 1, 0); let ci = 0;
    for (let i = 0; i < 7; i++) {
      const az = (i / 7) * 6.283, tilt = 0.45 + (i % 2) * 0.08;
      const dir = new V3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az));
      d.position.set(0, 3.35, 0); d.quaternion.setFromUnitVectors(up, dir); d.scale.setScalar(1); d.updateMatrix(); skewers.setMatrixAt(i, d.matrix);
      for (let k = 0; k < 4; k++) { const dist = 1.2 + k * 0.45; d.position.set(dir.x * dist, 3.35 + dir.y * dist, dir.z * dist); d.quaternion.setFromUnitVectors(up, dir); d.updateMatrix(); cubes.setMatrixAt(ci, d.matrix); cubes.setColorAt(ci, cc[(k + i) % 4]); ci++; }
    }
    g.add(skewers, cubes);
    // floor glow
    const gc = document.createElement('canvas'); gc.width = gc.height = 128; const cx = gc.getContext('2d');
    const gr = cx.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,150,50,.9)'); gr.addColorStop(0.5, 'rgba(255,100,20,.28)'); gr.addColorStop(1, 'rgba(255,80,10,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const gt = track(new THREE.CanvasTexture(gc)); gt.colorSpace = THREE.SRGBColorSpace;
    const gl = new THREE.Mesh(track(new THREE.PlaneGeometry(15, 15)), track(new THREE.MeshBasicMaterial({ map: gt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.32 })));
    gl.rotation.x = -Math.PI / 2; gl.position.y = 0.04; g.add(gl);
    // halo + embers + steam
    makePoints({ pos: new Float32Array([TANDOOR.x, 3.9, TANDOOR.z]), color: hdr(1.8, 0.8, 0.15), size: 5, sizeJitter: 0, intensity: 0.45, maxPx: 260 });
    const rr = rng(61), ep = []; const ne = Math.round(160 * density);
    for (let i = 0; i < ne; i++) { const a = rr() * 6.283, rad = Math.sqrt(rr()) * 0.8; ep.push(new V3(TANDOOR.x + Math.cos(a) * rad, 3.3, TANDOOR.z + Math.sin(a) * rad)); }
    makePoints({ pos: flat(ep), color: (i, r) => hdr(3.4, 1.1 + r() * 0.8, 0.2), size: 0.13, sizeJitter: 0.6, seed: 62, rise: 9, sway: 0.9, speed: 0.16, intensity: 1.3, maxPx: 16 });
    const sp = []; const nsteam = Math.round(34 * density + 8);
    for (let i = 0; i < nsteam; i++) { const a = rr() * 6.283, rad = Math.sqrt(rr()) * 0.7; sp.push(new V3(TANDOOR.x + Math.cos(a) * rad, 3.7, TANDOOR.z + Math.sin(a) * rad)); }
    makePoints({ pos: flat(sp), color: hdr(0.85, 0.5, 0.3), size: 1.5, sizeJitter: 0.4, seed: 63, rise: 6.5, sway: 1.2, grow: 2.2, speed: 0.06, intensity: 0.5, shape: 2, maxPx: 220, opacity: 0.55 });
  }

  await yieldNow();
  /* ---------- Thali table ---------- */
  const katoris = [];
  let thaliGroup;
  {
    const g = new THREE.Group(); g.position.set(THALI.x, 0, THALI.z); g.userData.dyn = true; scene.add(g); thaliGroup = g;
    const P2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
    const table = new THREE.Mesh(track(new THREE.LatheGeometry(P2([[0, 0], [1.2, 0], [1.25, 0.1], [0.5, 0.25], [0.32, 0.5], [0.34, 0.95], [0.8, 1.05], [3.0, 1.1], [3.2, 1.16], [3.2, 1.22], [0, 1.22]]), 48)), MAT.teal); g.add(table);
    const trim = new THREE.Mesh(track(new THREE.TorusGeometry(3.18, 0.05, 6, 56)), MAT.brass); trim.rotation.x = Math.PI / 2; trim.position.y = 1.2; g.add(trim);
    const tray = new THREE.Mesh(track(A.thaliTrayGeometry()), MAT.brass); tray.position.y = 1.22; g.add(tray);
    const eng = new THREE.Mesh(track(new THREE.TorusGeometry(1.45, 0.012, 4, 64)), MAT.brassDim); eng.rotation.x = Math.PI / 2; eng.position.y = 1.31; g.add(eng);
    const bowlG = track(A.bowlGeometry(24));
    const sauceG = track(new THREE.LatheGeometry(P2([[0.57, 0.3], [0.52, 0.31], [0.3, 0.325], [0, 0.33]]), 24));
    const curry = ['#7aa86a', '#e0a21c', '#4d7a2e', '#d2561f', '#8a5a2b', '#efe3d0', '#f0dcb0'];
    const rr = rng(77);
    // glossy sauces: standard material (clearcoat cost a whole extra physical shader for little visible gain)
    const swirlG = track(new THREE.TorusGeometry(0.2, 0.04, 6, 24));
    const leafG = new THREE.SphereGeometry(0.05, 6, 4), leafMat = std({ color: '#3f8a35', roughness: 0.6 });
    const lm = new THREE.Matrix4(), lq = new THREE.Quaternion(), lsc = new V3(1.4, 0.4, 1);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.283 + 0.3;
      const k = new THREE.Group(); k.position.set(Math.cos(a) * 1.28, 1.3, Math.sin(a) * 1.28); k.scale.setScalar(0.55); g.add(k);
      const b = new THREE.Mesh(bowlG, MAT.brass); k.add(b);
      const sauce = new THREE.Mesh(sauceG, track(new THREE.MeshStandardMaterial({ color: curry[i], roughness: 0.22, metalness: 0.05, emissive: curry[i], emissiveIntensity: 0.0, envMapIntensity: 0.85 })));
      k.add(sauce);
      if (i === 3 || i === 6) { const sw = new THREE.Mesh(swirlG, MAT.ivory); sw.rotation.x = Math.PI / 2; sw.position.y = 0.34; k.add(sw); }
      if (i === 1 || i === 4 || i === 2) { // four herb leaves, merged into one mesh per bowl
        const parts = [];
        for (let q = 0; q < 4; q++) parts.push({ g: leafG, m: lm.compose(new V3((rr() - 0.5) * 0.4, 0.34, (rr() - 0.5) * 0.4), lq, lsc).clone() });
        k.add(new THREE.Mesh(track(mergeGeometries(parts)), leafMat));
      }
      katoris.push({ k, y0: 1.3, lift: 0, a, mat: sauce.material });
    }
    leafG.dispose();
    const rice = new THREE.Mesh(track(A.moundGeometry(0.62, 0.52)), std({ color: '#f4ead2', roughness: 0.8, envMapIntensity: 0.3 }));
    rice.position.y = 1.32; rice.scale.setScalar(0.95); g.add(rice); katoris.rice = rice;
    // naan on a small plate, water cup, chillies
    const nt = track(A.naanTexture());
    const nm = std({ map: nt, roughness: 0.85, envMapIntensity: 0.2 });
    const plate = new THREE.Mesh(track(new THREE.CylinderGeometry(0.85, 0.7, 0.07, 28)), MAT.brass); plate.position.set(-1.9, 1.26, 1.9); g.add(plate);
    const naan = new THREE.Group(); naan.position.set(-1.9, 1.34, 1.9);
    const naanG = track(new THREE.CylinderGeometry(0.66, 0.66, 0.06, 28));
    for (let i = 0; i < 2; i++) { const n = new THREE.Mesh(naanG, nm); n.scale.set(1.05, 1, 0.82); n.position.y = i * 0.07; n.rotation.y = i * 0.7; naan.add(n); }
    g.add(naan); katoris.naan = naan; katoris.naanBase = naan.position.y;
    const cup = new THREE.Mesh(track(new THREE.LatheGeometry(P2([[0, 0], [0.2, 0], [0.26, 0.02], [0.3, 0.55], [0.28, 0.55], [0.24, 0.05], [0, 0.04]]), 18)), MAT.brass); cup.position.set(2.2, 1.22, 1.6); g.add(cup);
    const chG = track(new THREE.ConeGeometry(0.07, 0.6, 7)), chM = std({ color: '#c4301f', roughness: 0.4 });
    for (let i = 0; i < 3; i++) { const ch = new THREE.Mesh(chG, chM); ch.rotation.set(Math.PI / 2, 0, 0.5 + i * 0.7); ch.position.set(2.1 + i * 0.12, 1.27, -1.9 + i * 0.25); g.add(ch); }
    // the table turns as one piece: merge its fixed parts per material (in table space); rice, naan and bowls still move
    rice.userData.dyn = true;
    for (const grp of [g, naan]) {
      const byMat = new Map();
      grp.children.forEach((o) => { if (o.isMesh && !o.userData.dyn && !o.material.transparent) { if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(o); } });
      byMat.forEach((list, mat) => {
        if (list.length < 2) return;
        list.forEach((o) => o.updateMatrix());
        const merged = new THREE.Mesh(track(mergeGeometries(list.map((o) => ({ g: o.geometry, m: o.matrix })))), mat);
        list.forEach((o) => grp.remove(o)); grp.add(merged);
      });
    }
    // steam over the thali
    const sp = []; const nst = Math.round(20 * density + 6); const r2 = rng(81);
    for (let i = 0; i < nst; i++) sp.push(new V3(THALI.x + (r2() - 0.5) * 2.2, 1.9, THALI.z + (r2() - 0.5) * 2.2));
    const steam = makePoints({ pos: flat(sp), color: hdr(0.8, 0.55, 0.38), size: 0.9, sizeJitter: 0.4, seed: 82, rise: 3.4, sway: 0.4, grow: 1.6, speed: 0.08, intensity: 0.5, shape: 2, maxPx: 120, opacity: 0.5 });
    steam.material.userData.thali = true;
    // soft pool of light on the thali
    makePoints({ pos: new Float32Array([THALI.x, 1.6, THALI.z]), color: hdr(1.3, 0.7, 0.22), size: 5, sizeJitter: 0, intensity: 0.28, maxPx: 240 });
  }

  await yieldNow();
  /* ---------- Gold dust + floating lanterns ---------- */
  {
    const r = rng(91), n = Math.round(380 * density), a = [];
    for (let i = 0; i < n; i++) a.push(new V3((r() - 0.5) * 30, 0.4 + r() * 9, 14 - r() * 125));
    makePoints({ pos: flat(a), color: (i, rr) => hdr(1.4, 1.05 + rr() * 0.3, 0.5), size: 0.09, sizeJitter: 0.7, seed: 92, sway: 0.9, intensity: 1, maxPx: 12 });
    const r2 = rng(93), nl = Math.round(34 * density + 6), b = [];
    for (let i = 0; i < nl; i++) b.push(new V3((r2() - 0.5) * 26, 0.5 + r2() * 4, -26 - r2() * 80));
    makePoints({ pos: flat(b), color: (i, rr) => (rr() > 0.82 ? hdr(0.5, 1.4, 1.3) : hdr(1.9, 1.0, 0.3)), size: 1.15, sizeJitter: 0.3, seed: 94, rise: 30, sway: 1.8, speed: 0.012, intensity: 1, shape: 1, maxPx: 130 });
  }

  /* ---------- Merge static meshes: one draw per shared opaque material ---------- */
  {
    sky.userData.dyn = true;
    scene.updateMatrixWorld(true);
    const groups = new Map();
    scene.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.transparent) return;
      for (let p = o; p; p = p.parent) if (p.userData.dyn) return;
      if (!groups.has(o.material)) groups.set(o.material, []);
      groups.get(o.material).push(o);
    });
    groups.forEach((list, mat) => {
      if (list.length < 2) return;
      const merged = new THREE.Mesh(track(mergeGeometries(list.map((o) => ({ g: o.geometry, m: o.matrixWorld })))), mat);
      list.forEach((o) => o.parent.remove(o));
      scene.add(merged);
    });
  }
  await yieldNow();

  /* ---------- Camera path ---------- */
  // key: s, pos, look, shift [x, y] (desktop), shiftM [x, y] (portrait), roll
  const K = [];
  const key = (s, p, l, sh = [0, 0], shm = [0, 0], roll = 0) => K.push({ s, v: [p[0], p[1], p[2], l[0], l[1], l[2], sh[0], sh[1], shm[0], shm[1], roll] });
  const orbitPos = (phi, r, y) => [C_ORBIT.x + r * Math.sin(phi), y, C_ORBIT.z + r * Math.cos(phi)];
  const LOOK_C = [C_ORBIT.x, C_ORBIT.y - 0.1, C_ORBIT.z];
  key(0.0, [0, 3.1, 23], [0, 5.4, 0], [0.17, 0], [0, 0.17]);
  key(0.12, [0.6, 3.1, 21.2], [0, 5.4, 0], [0.17, 0], [0, 0.17]);
  key(0.42, [0, 2.8, 8], [0, 4.6, -8], [0.1, 0], [0, 0.1]);
  key(0.7, [-0.4, 3.0, -3], [0, 4.2, -18], [-0.08, 0], [0, 0.12]);
  key(0.88, orbitPos(-0.35, 12.4, 4.8), LOOK_C, [-0.18, 0], [0, 0.2]);
  key(1.0, orbitPos(0.0, 12.4, 5.0), LOOK_C, [-0.19, 0], [0, 0.2]);
  key(1.12, orbitPos(0.35, 12.4, 4.9), LOOK_C, [-0.19, 0], [0, 0.2]);
  key(1.25, orbitPos(1.6, 12.2, 4.4), LOOK_C, [-0.08, 0], [0, 0.12]);
  key(1.34, orbitPos(2.55, 10.6, 3.9), [0, 3.7, -48], [0, 0], [0, 0.05], 0.03);
  for (let i = 0; i <= 15; i++) {
    const u = i / 15, s = 1.42 + 0.54 * u, th = u * Math.PI * 2 * 1.5, z = -38.5 - 52 * u;
    const x = 1.5 * Math.sin(th), y = 3.3 + 0.8 * Math.sin(th + 0.4);
    key(s, [x, y, z], [x * 0.3, 3.4 + 0.3 * Math.sin(th + 1), z - 12], [0, 0], [0, 0.04], 0.2 * Math.cos(th));
  }
  key(2.0, [-0.2, 5.4, -89.0], [TANDOOR.x, 2.9, TANDOOR.z], [0.17, 0], [0, 0.2]);
  key(2.12, [0.4, 5.5, -88.6], [TANDOOR.x, 2.9, TANDOOR.z], [0.17, 0], [0, 0.2]);
  key(2.55, [3.4, 7.0, -90], [3.5, 1.6, -100], [0.12, 0], [0, 0.1]);
  key(2.88, [THALI.x, 8.6, THALI.z + 7.6], [THALI.x, 1.3, THALI.z], [0.2, 0], [0, 0.26]);
  key(3.12, [THALI.x, 8.6, THALI.z + 7.6], [THALI.x, 1.3, THALI.z], [0.2, 0], [0, 0.26]);
  key(3.5, [3.5, 24, -78], [0, 1.5, -92], [0.1, 0], [0, 0.1]);
  key(3.82, [0.5, 30, -48], [0, 0, -24], [0.15, 0], [0, 0.12]);
  key(3.94, [0.4, 29, -14], [0, 0, -22], [0.2, 0], [0, 0.18]);
  key(4.0, [0.4, 29.5, -12], [0, 0, -22], [0.2, 0], [0, 0.18]);
  K.sort((a, b) => a.s - b.s);
  const N_V = 11;
  const smp = new Array(N_V).fill(0);
  function samplePath(s) {
    s = clamp(s, K[0].s, K[K.length - 1].s);
    let i = 0; while (i < K.length - 2 && s > K[i + 1].s) i++;
    const k0 = K[Math.max(i - 1, 0)].v, k1 = K[i].v, k2 = K[i + 1].v, k3 = K[Math.min(i + 2, K.length - 1)].v;
    const t = (s - K[i].s) / (K[i + 1].s - K[i].s || 1), t2 = t * t, t3 = t2 * t;
    for (let c = 0; c < N_V; c++) {
      const p0 = k0[c], p1 = k1[c], p2 = k2[c], p3 = k3[c];
      smp[c] = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    return smp;
  }

  let resizeT = 0;
  const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(resize, 120); };
  window.addEventListener('resize', onResize);

  const onPointer = (e) => { st.pxT = (e.clientX / window.innerWidth - 0.5) * 2; st.pyT = (e.clientY / window.innerHeight - 0.5) * 2; };
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine && !reduce) window.addEventListener('pointermove', onPointer, { passive: true });

  /* ---------- Frame ---------- */
  const dummy = new THREE.Object3D(), invQ = new THREE.Quaternion(), cp = new V3(), cl = new V3();
  const _pos = new V3(), _look = new V3(), _col = new THREE.Color();
  function updateWorld(t, s) {
    // orbit rings
    rings.forEach((r) => {
      invQ.copy(r.grp.quaternion).invert();
      for (let i = 0; i < r.n; i++) {
        const a = (i / r.n) * 6.283 + t * r.speed;
        const bob = Math.sin(t * 0.9 + i * 1.7) * 0.22 + r.y0;
        const sc = 0.92 + ((i * 37) % 7) / 7 * 0.28;
        dummy.position.set(Math.cos(a) * r.r, bob, Math.sin(a) * r.r);
        dummy.quaternion.copy(invQ); dummy.rotation.y += 0; dummy.scale.setScalar(sc * 0.88); dummy.updateMatrix();
        r.bowls.setMatrixAt(i, dummy.matrix);
        dummy.position.y += 0.05 * sc * 0.88; dummy.updateMatrix(); r.mounds.setMatrixAt(i, dummy.matrix);
      }
      r.bowls.instanceMatrix.needsUpdate = true; r.mounds.instanceMatrix.needsUpdate = true;
    });
    rings.pieces.forEach(({ im, k, sc, per }) => {
      for (let i = 0; i < per; i++) {
        const a = ((i * 4 + k) / (per * 4)) * 6.283 - t * 0.07;
        const rr = 9.6 + Math.sin(i * 2.1 + k) * 0.5;
        dummy.position.set(Math.cos(a) * rr, Math.sin(t * 0.6 + i * 2 + k) * 0.5 + 0.4, Math.sin(a) * rr);
        dummy.rotation.set(t * 0.4 + i, t * 0.55 + k, t * 0.3 + i * 0.5); dummy.scale.setScalar(sc * 0.72); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    });
    armA.rotation.set(t * 0.3, t * 0.2, 0); armB.rotation.set(1.2, t * -0.25, t * 0.15);
    sun.scale.setScalar(1 + Math.sin(t * 2.2) * 0.04);
    rangoli.rotation.z = t * 0.02;
    // fire
    flames.forEach(({ f, ph }) => { const k = 0.85 + 0.35 * Math.sin(t * 7 + ph) * Math.sin(t * 3.1 + ph * 2); f.scale.set(1 - 0.12 * k, 0.8 + 0.6 * k, 1 - 0.12 * k); });
    fireLight.intensity = (44 + 14 * Math.sin(t * 9) * Math.sin(t * 4.3)) * (0.6 + 0.6 * ss(1.5, 2.0, s));
    { // station light: pick the station whose window holds s, with a 0.12 fade at each edge
      let best = null, bw = 0;
      for (const L of STATION_LIGHTS) { const w = ss(L.a - 0.12, L.a, s) * (1 - ss(L.b, L.b + 0.12, s)); if (w > bw) { bw = w; best = L; } }
      if (best) {
        stationLight.position.copy(best.pos); stationLight.color.copy(best.col); stationLight.distance = best.d; stationLight.decay = best.decay;
        stationLight.intensity = bw * (best.flicker ? best.i - 4 + 8 * Math.sin(t * 1.7) : best.i);
      } else stationLight.intensity = 0;
    }
    // arches ignite as the camera approaches
    let trimsDirty = false;
    hallLit.forEach((h, i) => {
      const l = ss(h.s - 0.24, h.s - 0.12, s);
      if (Math.abs(l - h.l) < 1e-4) return;
      h.l = l; trimsDirty = true;
      hallTrims[0].setColorAt(i, _col.setRGB(0.16 + 2.4 * l, 0.1 + 1.55 * l, 0.04 + 0.6 * l));
      hallTrims[1].setColorAt(i, _col.setRGB(0.04, 0.2 + 1.3 * l, 0.19 + 1.2 * l));
    });
    if (trimsDirty) { hallTrims[0].instanceColor.needsUpdate = true; hallTrims[1].instanceColor.needsUpdate = true; }
    // thali katoris
    katoris.forEach((k, i) => {
      const act = (st.group === 0 && (i === 0 || i === 5)) || (st.group === 1 && (i >= 1 && i <= 4)) || (st.group === 3 && i === 6);
      k.lift += ((act ? 1 : 0) - k.lift) * 0.12;
      k.k.position.y = k.y0 + k.lift * 0.5 + Math.sin(t * 1.4 + i) * 0.02 * k.lift;
      k.k.scale.setScalar(0.55 * (1 + k.lift * 0.1));
      k.mat.emissiveIntensity = k.lift * 0.28;
    });
    const riceAct = st.group === 2;
    katoris.riceLift = (katoris.riceLift || 0) + ((riceAct ? 1 : 0) - (katoris.riceLift || 0)) * 0.12;
    katoris.rice.position.y = 1.32 + katoris.riceLift * 0.4; katoris.naan.position.y = katoris.naanBase + katoris.riceLift * 0.45;
    thaliGroup.rotation.y = t * 0.12 + st.menuP * 1.2;
    // uniforms
    pointMats.forEach((m) => {
      m.uniforms.uTime.value = t; m.uniforms.uS.value = s;
      if (m.userData.thali) m.uniforms.uOpacity.value = 0.5 * ss(2.3, 2.8, s);
    });
    if (bloom) bloom.strength = BLOOM_BASE * (1 + 0.75 * ss(1.6, 2.0, s) * (1 - ss(2.7, 3.1, s)) + 0.15 * ss(3.4, 4, s));
  }

  function updateCamera(t, dt) {
    const s = st.s;
    const v = samplePath(s);
    _pos.set(v[0], v[1], v[2]); _look.set(v[3], v[4], v[5]);
    const portrait = st.pf > 0.01;
    // portrait: pull back so the subject fits
    if (portrait) _pos.sub(_look).multiplyScalar(1 + st.pf * lerp(0.6, 0.22, ss(1.3, 1.6, s))).add(_look);
    // menu: orbit the thali while the menu scrolls
    const mw = ss(2.7, 2.95, s) * (1 - ss(3.1, 3.4, s));
    if (mw > 0.001) {
      const ang = (st.menuP - 0.5) * 1.0 * mw;
      const ox = _pos.x - THALI.x, oz = _pos.z - THALI.z, ca = Math.cos(ang), sa = Math.sin(ang);
      _pos.x = THALI.x + ox * ca - oz * sa; _pos.z = THALI.z + ox * sa + oz * ca;
    }
    if (!st.still) {
      _pos.x += Math.sin(t * 0.31) * 0.16 + st.px * 0.5; _pos.y += Math.sin(t * 0.23) * 0.1 - st.py * 0.22;
      _look.x += st.px * 0.4;
    }
    camera.position.copy(_pos);
    camera.up.set(Math.sin(v[10]), Math.cos(v[10]), 0);
    camera.lookAt(_look);
    camLight.position.copy(_pos).add(cl.set(0, 1.2, -1.5));
    sky.position.copy(_pos);
    // placement of the subject in the free half of the screen
    const sx = portrait ? v[8] : v[6], sy = portrait ? v[9] : v[7];
    camera.setViewOffset(st.w, st.h, -sx * st.w, sy * st.h, st.w, st.h);
    camera.updateProjectionMatrix();
  }

  function renderFrame(now) {
    const dt = Math.min(0.1, Math.max(0.001, (now - st.last) / 1000)); st.last = now;
    // camera damping toward the scroll target
    const target = st.still ? Math.round(st.sTarget * 1) : st.sTarget;
    const prevS = st.s;
    if (st.still) st.s = target; else st.s += (target - st.s) * (1 - Math.exp(-dt * 4.5));
    if (Math.abs(st.s - target) < 0.0004) st.s = target;
    const moving = Math.abs(st.s - prevS) > 1e-5;
    st.px += (st.pxT - st.px) * (1 - Math.exp(-dt * 3)); st.py += (st.pyT - st.py) * (1 - Math.exp(-dt * 3));
    if (!st.paused && !st.still) st.time += dt;
    const needsDraw = st.dirty || moving || (!st.paused && !st.still);
    if (!needsDraw) return false;
    updateWorld(st.time, st.s);
    updateCamera(st.time, dt);
    if (composer) composer.render(dt); else renderer.render(scene, camera);
    st.dirty = false;
    // adaptive quality: if the machine is slow, lower the pixel ratio, then drop bloom
    if (!st.paused && !st.still) {
      st.emaDt = st.emaDt * 0.95 + dt * 0.05; st.frames++;
      if (st.frames > 90 && st.emaDt > 0.032) {
        st.slow++; st.frames = 0;
        if (prCap > 1) { prCap = Math.max(1, prCap - 0.25); setTimeout(resize, 0); } // never resize inside a frame
        else if (composer && bloom && st.slow > 3) { composer.removePass(bloom); bloom.dispose(); bloom = null; st.slow = 0; } // once only
        st.emaDt = 0.02;
      }
    }
    return true;
  }

  function loop(now) {
    st.raf = 0;
    if (!st.running) return;
    const drew = renderFrame(now);
    // paused and settled: sleep until something changes (wake)
    if ((drew || (!st.paused && !st.still)) && !st.raf) st.raf = requestAnimationFrame(loop);
  }
  function wake() { if (st.running && !st.raf && !st.hidden && !st.lost) { st.last = performance.now(); st.raf = requestAnimationFrame(loop); } }
  function start() {
    if (st.running || st.lost || st.offscreen || !st.ready) return; // never draw before the programs are compiled
    st.running = true; st.last = performance.now();
    if (!st.raf) st.raf = requestAnimationFrame(loop);
  }
  function stop() { st.running = false; if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; } }
  function kick() { // still mode / paused: draw one frame on demand
    st.dirty = true;
    if (st.still && st.ready && !st.hidden && !st.lost) requestAnimationFrame((n) => { if (!st.raf) { st.last = n - 16; renderFrame(n); } });
  }

  const onVis = () => { st.hidden = document.hidden; if (st.hidden) stop(); else if (st.offscreen) return; else if (!st.still) start(); else kick(); };
  document.addEventListener('visibilitychange', onVis);
  // The canvas is fixed and always "visible"; watch the page content instead. When it has scrolled
  // completely away (only the opaque footer is on screen) the scene is covered, so stop drawing.
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((e) => { const vis = e[e.length - 1].isIntersecting; st.offscreen = !vis; if (!vis) stop(); else if (!st.hidden && !st.still && !st.lost) start(); }) : null;
  if (io) io.observe(observe || canvas);

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); st.lost = true; stop(); canvas.dispatchEvent(new CustomEvent('scene:lost')); });
  canvas.addEventListener('webglcontextrestored', () => {
    st.lost = false; st.dirty = true; envRT = null; /* old target died with the context */ buildEnv(false); resize(true);
    canvas.dispatchEvent(new CustomEvent('scene:restored'));
    if (!st.still) start(); else kick();
  });

  /* ---------- Compile every program in parallel (off the main thread) while textures upload ---------- */
  await envReady; // programs depend on the environment map, so it must exist first
  resize();
  st.s = st.sTarget; updateWorld(st.time, st.s); updateCamera(st.time, 0.016);
  const compiling = [];
  try {
    // with bloom the scene renders into a half-float target (no tone mapping), which needs other programs than the screen
    if (composer) renderer.setRenderTarget(composer.readBuffer);
    compiling.push(renderer.compileAsync(scene, camera));
    if (composer) { // the post-processing programs too (bloom draws into targets; the output pass is a raw shader)
      const pp = new THREE.Scene(), quad = track(new THREE.PlaneGeometry(2, 2));
      const outPass = composer.passes[composer.passes.length - 1];
      if (outPass && outPass.material && outPass.uniforms && 'toneMappingExposure' in outPass.uniforms) {
        outPass._outputColorSpace = renderer.outputColorSpace; outPass._toneMapping = renderer.toneMapping;
        outPass.material.defines = { SRGB_TRANSFER: '', ACES_FILMIC_TONE_MAPPING: '' }; outPass.material.needsUpdate = true;
        pp.add(new THREE.Mesh(quad, outPass.material));
      }
      if (bloom) [bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial].forEach((m) => pp.add(new THREE.Mesh(quad, m)));
      compiling.push(renderer.compileAsync(pp, camera));
    }
  } catch (e) { /* programs then compile on first use */ }
  renderer.setRenderTarget(null);
  for (const d of disposables) if (d.isTexture) { renderer.initTexture(d); await yieldNow(); }
  try { await Promise.all(compiling); } catch (e) { /* compiled on first use instead */ }
  await yieldNow();

  /* ---------- Public controller ---------- */
  st.ready = true;
  const ctl = {
    setAnchors(list) { st.anchors = list.slice().sort((a, b) => a.y - b.y); st.sTarget = sFromScroll(st.scrollY); if (st.still) kick(); },
    setScroll(y) { st.scrollY = y; st.sTarget = sFromScroll(y); st.dirty = true; if (st.still) kick(); else wake(); },
    setMenu(group, progress) { st.group = group; st.menuP = progress; st.dirty = true; if (st.still) kick(); else wake(); },
    setPaused(p) { st.paused = p; st.dirty = true; if (!st.still) { if (!p) start(); wake(); } },
    setStill(v) { st.still = v; if (v) { stop(); st.time = 6.5; kick(); } else start(); },
    start, stop, resize,
    firstFrame() { st.last = performance.now(); st.s = st.sTarget; renderFrame(performance.now()); },
    get s() { return st.s; },
    destroy() {
      stop(); clearTimeout(resizeT);
      window.removeEventListener('resize', onResize); window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVis); if (io) io.disconnect();
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
      disposables.forEach((d) => d.dispose && d.dispose());
      if (composer) composer.dispose(); renderer.dispose();
    },
  };
  return ctl;
}
