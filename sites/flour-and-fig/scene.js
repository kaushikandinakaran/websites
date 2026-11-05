// Flour & Fig - sample design. The 3D layer: a sunlit bakery counter built from Poly Haven CC0 assets
// (croissant, carrot cake, tea set, cutting board, oak and plaster textures, a photo-studio HDRI) plus a few
// procedural pieces (counter, wall and window, cake stand, crumbs, linen, steam, the pour, light shafts and dust).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const V3 = THREE.Vector3;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));
const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 600 }) : setTimeout(r, 30)));

const ASSETS = '../../assets/polyhaven/';

/* ---------- room geometry shared by the meshes and the light-shaft shader ---------- */
const WALL_IN = -0.45, WALL_OUT = -0.59, FRAME_Z = -0.52;
const WIN = { x0: -1.0, x1: 1.0, y0: 0.16, y1: 1.36 };
const FW = 0.05, MW = 0.03, MULL_X = [-0.333, 0.333], MULL_Y = 0.9;

const GLSL_COMMON = /* glsl */`
uniform vec3 uSun;
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i), n100 = hash13(i + vec3(1,0,0)), n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1)), n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}
float boxSoft(vec2 q, vec4 r, float e){
  return smoothstep(r.x - e, r.x + e, q.x) * smoothstep(-r.z - e, -r.z + e, -q.x) * smoothstep(r.y - e, r.y + e, q.y) * smoothstep(-r.w - e, -r.w + e, -q.y);
}
float barSoft(float d, float hw, float e){ return smoothstep(hw - e, hw + e, abs(d)); }
// how much direct sun reaches point p through the window (wall reveal, frame and glazing bars)
float aperture(vec3 p){
  if (uSun.z > -0.02) return 0.0;
  float sIn = (${WALL_IN.toFixed(3)} - p.z) / uSun.z;
  if (sIn < 0.0) return 1.0; // inside the window recess itself
  vec3 qi = p + uSun * sIn;
  vec3 qo = p + uSun * ((${WALL_OUT.toFixed(3)} - p.z) / uSun.z);
  vec3 qf = p + uSun * ((${FRAME_Z.toFixed(3)} - p.z) / uSun.z);
  float e = 0.002 + sIn * 0.012;
  vec4 r = vec4(${WIN.x0.toFixed(3)}, ${WIN.y0.toFixed(3)}, ${WIN.x1.toFixed(3)}, ${WIN.y1.toFixed(3)});
  float a = boxSoft(qi.xy, r, e) * boxSoft(qo.xy, r, e);
  a *= boxSoft(qf.xy, r + vec4(${FW.toFixed(3)}, ${FW.toFixed(3)}, -${FW.toFixed(3)}, -${FW.toFixed(3)}), e);
  a *= barSoft(qf.x - (${MULL_X[0].toFixed(3)}), ${(MW / 2).toFixed(4)}, e) * barSoft(qf.x - ${MULL_X[1].toFixed(3)}, ${(MW / 2).toFixed(4)}, e) * barSoft(qf.y - ${MULL_Y.toFixed(3)}, ${(MW / 2).toFixed(4)}, e);
  return a;
}
`;

function detectTier() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600 || window.innerWidth < 760;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  if (coarse || small || cores <= 2 || mem <= 2) return 'low';
  if (cores < 6 || mem < 4) return 'mid';
  return 'high';
}

/* ---------- small procedural textures ---------- */
function radialTex(size, inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, size * inner, size / 2, size / 2, size * outer);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}
function weaveTextures(aniso) { // linen: a small woven normal map and a slub colour variation map
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'); const img = g.createImageData(N, N);
  const d = document.createElement('canvas'); d.width = d.height = N;
  const gd = d.getContext('2d'); const id = gd.createImageData(N, N);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const slubX = Array.from({ length: N }, () => 0.85 + rnd() * 0.3), slubY = Array.from({ length: N }, () => 0.85 + rnd() * 0.3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const over = ((x >> 1) + (y >> 1)) & 1; // plain weave: threads alternate over and under
    const tx = Math.sin(((x % 2) + 0.5) / 2 * Math.PI), ty = Math.sin(((y % 2) + 0.5) / 2 * Math.PI);
    const nx = over ? (x % 2 ? 0.35 : -0.35) * ty : 0, ny = over ? 0 : (y % 2 ? 0.35 : -0.35) * tx;
    const i = (y * N + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = 230; img.data[i + 3] = 255;
    const v = (over ? slubX[x] : slubY[y]) * (0.92 + 0.08 * (over ? tx : ty));
    id.data[i] = id.data[i + 1] = id.data[i + 2] = clamp(v * 210, 0, 255); id.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); gd.putImageData(id, 0, 0);
  const nt = new THREE.CanvasTexture(c), ct = new THREE.CanvasTexture(d);
  [nt, ct].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(26, 15); t.anisotropy = aniso; });
  nt.colorSpace = THREE.NoColorSpace; ct.colorSpace = THREE.SRGBColorSpace;
  return { nt, ct };
}

function standWearTextures() { // glaze: faint pinholes and specks (colour), rubbed dull patches and fine knife marks (roughness)
  const N = 256, mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
  const a = mk(), ga = a.getContext('2d'), b = mk(), gb = b.getContext('2d');
  let seed = 19; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ga.fillStyle = '#fff'; ga.fillRect(0, 0, N, N);
  for (let i = 0; i < 260; i++) { ga.fillStyle = `rgba(${90 + rnd() * 40},${80 + rnd() * 30},${70 + rnd() * 20},${0.12 + rnd() * 0.25})`; ga.beginPath(); ga.arc(rnd() * N, rnd() * N, 0.4 + rnd() * 0.8, 0, 6.283); ga.fill(); }
  for (let i = 0; i < 18; i++) { const g = ga.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(225,215,198,.18)'); g.addColorStop(1, 'rgba(225,215,198,0)');
    ga.save(); ga.translate(rnd() * N, rnd() * N); ga.scale(10 + rnd() * 30, 6 + rnd() * 14); ga.fillStyle = g; ga.fillRect(-1, -1, 2, 2); ga.restore(); }
  gb.fillStyle = 'rgb(62,62,62)'; gb.fillRect(0, 0, N, N); // base sheen ~0.24
  for (let i = 0; i < 26; i++) { const g = gb.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(140,140,140,.35)'); g.addColorStop(1, 'rgba(140,140,140,0)');
    gb.save(); gb.translate(rnd() * N, N * (0.55 + rnd() * 0.45)); gb.scale(12 + rnd() * 34, 5 + rnd() * 12); gb.fillStyle = g; gb.fillRect(-1, -1, 2, 2); gb.restore(); }
  gb.lineWidth = 0.6;
  for (let i = 0; i < 70; i++) { gb.strokeStyle = `rgba(170,170,170,${0.25 + rnd() * 0.35})`; const x = rnd() * N, y = N * (0.78 + rnd() * 0.22), l = 4 + rnd() * 22; gb.beginPath(); gb.moveTo(x, y); gb.lineTo(x + l, y + (rnd() - 0.5) * 3); gb.stroke(); }
  const map = new THREE.CanvasTexture(a), rough = new THREE.CanvasTexture(b);
  map.colorSpace = THREE.SRGBColorSpace; rough.colorSpace = THREE.NoColorSpace;
  [map, rough].forEach((t) => { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(3, 1); });
  return { map, rough };
}
function doilyTexture() { // cotton lace: scalloped edge, a ring of eyelets, petals and an open mesh band (alpha only)
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), C = N / 2, R = N / 2;
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(C, C, R * 0.9, 0, 6.283); g.fill();
  for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283; g.beginPath(); g.arc(C + Math.cos(a) * R * 0.915, C + Math.sin(a) * R * 0.915, R * 0.07, 0, 6.283); g.fill(); }
  g.fillStyle = '#000';
  for (let i = 0; i < 40; i++) { const a = (i + 0.5) / 40 * 6.283; g.beginPath(); g.arc(C + Math.cos(a) * R * 0.955, C + Math.sin(a) * R * 0.955, R * 0.03, 0, 6.283); g.fill(); }
  for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283; g.beginPath(); g.arc(C + Math.cos(a) * R * 0.9, C + Math.sin(a) * R * 0.9, R * 0.022, 0, 6.283); g.fill(); }
  for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; g.save(); g.translate(C + Math.cos(a) * R * 0.8, C + Math.sin(a) * R * 0.8); g.rotate(a); g.beginPath(); g.ellipse(0, 0, R * 0.055, R * 0.022, 0, 0, 6.283); g.fill(); g.restore(); }
  for (let ring = 0; ring < 3; ring++) { const rr = R * (0.66 + ring * 0.035), n = 64 + ring * 6;
    for (let i = 0; i < n; i++) { const a = (i + (ring % 2) * 0.5) / n * 6.283; g.beginPath(); g.arc(C + Math.cos(a) * rr, C + Math.sin(a) * rr, R * 0.011, 0, 6.283); g.fill(); } }
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.save(); g.translate(C + Math.cos(a) * R * 0.3, C + Math.sin(a) * R * 0.3); g.rotate(a); g.beginPath(); g.ellipse(0, 0, R * 0.12, R * 0.04, 0, 0, 6.283); g.fill(); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
  return t;
}

export async function initScene(canvas, opts = {}) {
  const reduce = !!opts.reduce;
  const progress = opts.onProgress || (() => {});
  const tier = detectTier();
  const high = tier === 'high', low = tier === 'low';
  let pr = Math.min(window.devicePixelRatio || 1, high ? 1.5 : low ? 1 : 1.25);

  // post-processing modules: desktop high tier only, loaded here so phones fetch fewer files
  let PP = null;
  if (high) {
    try {
      const [ec, rp, ub, op, sp, fx] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/OutputPass.js'),
        import('three/addons/postprocessing/ShaderPass.js'), import('three/addons/shaders/FXAAShader.js')]);
      PP = { EffectComposer: ec.EffectComposer, RenderPass: rp.RenderPass, UnrealBloomPass: ub.UnrealBloomPass, OutputPass: op.OutputPass, ShaderPass: sp.ShaderPass, FXAAShader: fx.FXAAShader };
    } catch (e) { PP = null; } // the scene still renders, without bloom, grain and FXAA
  }
  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !(high && PP), alpha: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(pr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0xe9dcc8, 1);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.02, 30);

  /* ---------- loaders with a shared progress line ---------- */
  const manager = new THREE.LoadingManager();
  const gltfLoader = new GLTFLoader(manager);
  const texLoader = new THREE.TextureLoader(manager);
  const weights = { env: low ? 0 : 1.5, tex: low ? 0.7 : 1.2, board: low ? 0.9 : 1.9, croissant: low ? 0.6 : 2.05 }; // stage-1 MB
  const done = {};
  const stage1Total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const report = (k, f) => { done[k] = f * (weights[k] || 0); progress(Object.values(done).reduce((a, b) => a + b, 0) / stage1Total); };

  const loadTex = (url, srgb, key) => new Promise((res) => {
    texLoader.load(url, (t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
      res(t);
    }, undefined, () => res(null)); // a missing texture leaves the plain material
  });
  // phones: the glTF is parsed without its normal and ARM maps (constant roughness instead), which keeps the
  // whole phone scene near 5 MB; desktops load the full PBR set
  const ROUGH = { croissant: 0.62, carrot_cake: 0.72, tea_set_01: 0.22, wooden_cutting_board: 0.55 };
  const loadModel = (id, key) => new Promise((res) => {
    const url = `${ASSETS}models/${id}/${id}_1k.gltf`;
    const ok = (g) => { report(key, 1); res(g.scene); }, bad = () => { report(key, 1); res(null); }; // a failed model is skipped
    if (!low) {
      gltfLoader.load(url, ok, (e) => { if (e && e.total) report(key, Math.min(0.95, e.loaded / e.total)); }, bad);
      return;
    }
    fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('gltf')))).then((j) => {
      (j.materials || []).forEach((m) => {
        delete m.normalTexture; delete m.occlusionTexture;
        const pb = m.pbrMetallicRoughness || (m.pbrMetallicRoughness = {});
        delete pb.metallicRoughnessTexture; pb.metallicFactor = 0; pb.roughnessFactor = ROUGH[id] || 0.6;
      });
      gltfLoader.parse(JSON.stringify(j), `${ASSETS}models/${id}/`, ok, bad);
    }).catch(bad);
  });

  /* ---------- environment light (HDRI on desktop, a generated room on phones) ---------- */
  let hdrTex = null, envRT = null;
  function buildEnv() {
    const p = new THREE.PMREMGenerator(renderer);
    let rt;
    if (hdrTex) rt = p.fromEquirectangular(hdrTex);
    else { const room = new RoomEnvironment(renderer); rt = p.fromScene(room, 0.04); room.dispose(); }
    p.dispose();
    return rt;
  }
  // every stage-1 request starts at once; later stations wait for idle time
  const T = `${ASSETS}textures/`;
  const texP = Promise.all([
    loadTex(`${T}oak_veneer_01/oak_veneer_01_diff_1k.jpg`, true),
    low ? null : loadTex(`${T}oak_veneer_01/oak_veneer_01_nor_1k.jpg`, false),
    loadTex(`${T}beige_wall_001/beige_wall_001_diff_1k.jpg`, true),
    low ? null : loadTex(`${T}beige_wall_001/beige_wall_001_nor_1k.jpg`, false),
    low ? null : loadTex(`${T}beige_wall_001/beige_wall_001_arm_1k.jpg`, false),
  ]).then((r) => { report('tex', 1); return r; });
  const modelsP = Promise.all([loadModel('wooden_cutting_board', 'board'), loadModel('croissant', 'croissant')]);
  if (!low) {
    hdrTex = await new Promise((res) => new RGBELoader(manager).setDataType(THREE.HalfFloatType)
      .load(`${ASSETS}hdri/brown_photostudio_05/brown_photostudio_05_1k.hdr`, (t) => { t.mapping = THREE.EquirectangularReflectionMapping; res(t); }, undefined, () => res(null)));
    report('env', 1);
  }
  await yieldFrame();
  envRT = buildEnv();
  scene.environment = envRT.texture;
  if (hdrTex) hdrTex.dispose(); // frees the GPU copy only; the CPU data stays for a context restore
  await yieldFrame();

  /* ---------- lights ---------- */
  const sunColor = new THREE.Color(1.0, 0.86, 0.68);
  const sun = new THREE.DirectionalLight(sunColor, low ? 3.2 : 6.5);
  sun.castShadow = !low;
  if (!low) {
    sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    const sc = sun.shadow.camera; sc.left = -1.05; sc.right = 1.05; sc.top = 0.75; sc.bottom = -0.75; sc.near = 2.0; sc.far = 4.6;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.028; sun.shadow.radius = high ? 4 : 2.5;
  }
  scene.add(sun, sun.target);
  sun.target.position.set(0, 0.25, 0);
  const bounce = new THREE.DirectionalLight(0xffeedd, 0.35); // white card from the camera side
  bounce.position.set(-0.6, 1.2, 2.5);
  scene.add(bounce);
  const hemi = new THREE.HemisphereLight(0xfff2e2, 0x8a6542, 0.35); // warm bounce from the oak and the plaster
  scene.add(hemi);
  const rim = new THREE.PointLight(0xffd7a8, 0.0, 2.2, 2); // warm practical glow by the window
  rim.position.set(0.4, 0.55, -0.25);
  scene.add(rim);
  const sunDir = new V3(); // toward the sun
  const sunU = { value: sunDir };
  const timeU = { value: 0 };

  const envMats = new Set();
  const ENV_I = low ? 0.5 : 0.42;
  // The window pattern of the sun is an analytic light cookie inside every lit material (soft, exact penumbrae on every
  // tier, phones included); the shadow map only has to handle the props, so its frustum stays tight and crisp.
  const LIGHTS_SUN = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );',
    `getDirectionalLightInfo( directionalLight, directLight );
#if UNROLLED_LOOP_INDEX == 0
directLight.color *= aperture( vApW );
#endif`);
  const AP_VERT = `#include <project_vertex>
{ vec4 apw = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
apw = instanceMatrix * apw;
#endif
vApW = (modelMatrix * apw).xyz; }`;
  function patchSun(m) {
    if (!m || !m.isMeshStandardMaterial || m.userData.sunCookie) return;
    m.userData.sunCookie = true;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSun = sunU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vApW;').replace('#include <project_vertex>', AP_VERT);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vApW;\n' + GLSL_COMMON)
        .replace('#include <lights_fragment_begin>', LIGHTS_SUN);
    };
    m.customProgramCacheKey = () => 'sun-cookie';
  }
  const track = (m, k = ENV_I) => { m.envMapIntensity = k; envMats.add(m); patchSun(m); return m; };

  /* ---------- textures for the built set ---------- */
  const [oakD, oakN, wallD, wallN, wallA] = await texP;

  /* ---------- counter ---------- */
  const counterMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: oakD, normalMap: oakN, roughness: 0.42, metalness: 0 }));
  if (oakN) counterMat.normalScale.set(0.6, 0.6);
  [oakD, oakN].forEach((t) => { if (t) { t.repeat.set(2.0, 0.56); t.rotation = 0; } });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.05, 0.9), counterMat);
  counter.position.set(0, -0.025, 0);
  counter.receiveShadow = true;
  scene.add(counter);
  const cabinetMat = track(new THREE.MeshStandardMaterial({ color: 0x3f2236, roughness: 0.55 }));
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.9, 0.84), cabinetMat);
  cabinet.position.set(0, -0.5, -0.02);
  scene.add(cabinet);

  /* ---------- back wall with the window opening ---------- */
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-3.2, -1); wallShape.lineTo(3.2, -1); wallShape.lineTo(3.2, 2.6); wallShape.lineTo(-3.2, 2.6); wallShape.lineTo(-3.2, -1);
  const hole = new THREE.Path();
  hole.moveTo(WIN.x0, WIN.y0); hole.lineTo(WIN.x0, WIN.y1); hole.lineTo(WIN.x1, WIN.y1); hole.lineTo(WIN.x1, WIN.y0); hole.lineTo(WIN.x0, WIN.y0);
  wallShape.holes.push(hole);
  const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: WALL_IN - WALL_OUT, bevelEnabled: false, curveSegments: 1 });
  wallGeo.translate(0, 0, WALL_OUT);
  [wallD, wallN, wallA].forEach((t) => { if (t) t.repeat.set(0.75, 0.75); });
  const wallMat = track(new THREE.MeshStandardMaterial({ color: 0xfff5e8, map: wallD, normalMap: wallN, roughness: 0.92, aoMap: null }));
  if (wallA) { wallMat.roughnessMap = wallA; }
  if (wallN) wallMat.normalScale.set(1.25, 1.25);
  // hand-trowelled lime plaster: a world-space (never tiling) trowel relief, a soft mottle in colour and sheen, and a
  // gentle falloff toward the corners and the ceiling; the relief is skipped on phones
  { const sunCookie = wallMat.onBeforeCompile;
    wallMat.customProgramCacheKey = () => 'sun-cookie-wall' + (low ? '-lo' : '');
    wallMat.onBeforeCompile = (sh, r) => {
      sunCookie(sh, r);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <uv_pars_fragment>', '#include <uv_pars_fragment>\n' + (low ? '' : '#define PLASTER_RELIEF\n') + `
float trowel(vec2 P){
  // overlapping swept strokes: noise stretched along a slowly turning direction, plus fine grit
  float a = vnoise(vec3(P * 1.3, 4.1)) * 3.1416;
  vec2 d = vec2(cos(a), sin(a));
  vec2 Q = vec2(dot(P, d), dot(P, vec2(-d.y, d.x)));
  return vnoise(vec3(Q.x * 5.0, Q.y * 17.0, 1.3)) * 0.55 + vnoise(vec3(P * 38.0, 7.7)) * 0.12;
}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 wp = vApW;
  float m = vnoise(vec3(wp.xy * vec2(1.7, 2.3), 2.0)) * 0.65 + vnoise(vec3(wp.xy * 6.0, 5.0)) * 0.35;
  float g = 1.0 - 0.10 * smoothstep(1.2, 2.5, wp.y) - 0.07 * smoothstep(1.4, 3.1, abs(wp.x)) + 0.05 * (1.0 - smoothstep(0.0, 1.6, length(wp.xy - vec2(0.0, 0.8))));
  diffuseColor.rgb *= g * mix(0.93, 1.05, m) * mix(vec3(1.0, 0.985, 0.96), vec3(1.0), m); }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * mix(0.78, 1.08, vnoise(vec3(vApW.xy * 3.1, 9.0))), 0.35, 1.0);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef PLASTER_RELIEF
{ vec2 P = vApW.xy; const float e = 0.004;
  float h0 = trowel(P), hx = trowel(P + vec2(e, 0.0)), hy = trowel(P + vec2(0.0, e));
  vec3 fz = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  vec3 dW = vec3(-(hx - h0), -(hy - h0), 0.0) / e * 0.010;
  normal = normalize(normal + (viewMatrix * vec4(dW, 0.0)).xyz * abs(dot(normal, fz))); }
#endif`);
    };
  }
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.receiveShadow = true;
  scene.add(wall);
  // window: an oak sill with a rounded nose and an apron under it, and a painted frame whose bars have softened edges
  const ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0, cx = (WIN.x0 + WIN.x1) / 2, cy = (WIN.y0 + WIN.y1) / 2;
  const extrudeX = (shape, len, segs = 5) => { // a profile drawn in (z, y), run along x and centred on x = 0
    const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: segs });
    g.rotateY(-Math.PI / 2); g.translate(len / 2, 0, 0);
    return g;
  };
  { const z0 = WALL_OUT, z1 = WALL_IN + 0.06, t = 0.032, r = 0.013, sh = new THREE.Shape();
    sh.moveTo(z0, -t); sh.lineTo(z1 - r, -t); sh.quadraticCurveTo(z1, -t, z1, -t + r); sh.lineTo(z1, -r * 0.6);
    sh.quadraticCurveTo(z1, 0, z1 - r * 0.8, 0); sh.lineTo(z0, 0); sh.lineTo(z0, -t);
    const sill = new THREE.Mesh(extrudeX(sh, ww + 0.12), counterMat);
    sill.position.set(0, WIN.y0, 0); sill.receiveShadow = true; sill.castShadow = !low;
    scene.add(sill);
    const ap = new THREE.Shape(); // apron moulding under the sill
    ap.moveTo(WALL_IN, 0); ap.lineTo(WALL_IN + 0.016, 0); ap.quadraticCurveTo(WALL_IN + 0.02, -0.02, WALL_IN + 0.008, -0.045); ap.lineTo(WALL_IN, -0.048); ap.lineTo(WALL_IN, 0);
    const apron = new THREE.Mesh(extrudeX(ap, ww + 0.02, 6), counterMat);
    apron.position.set(0, WIN.y0 - t, 0); apron.receiveShadow = true;
    scene.add(apron);
  }
  const frameMat = track(new THREE.MeshStandardMaterial({ color: 0x4a3343, roughness: 0.42 }));
  const winFrame = new THREE.Group();
  const barGeo = (w, h, d, b) => { // a box with chamfered, slightly rounded edges
    const s2 = new THREE.Shape(); s2.moveTo(-w / 2 + b, -h / 2 + b); s2.lineTo(w / 2 - b, -h / 2 + b); s2.lineTo(w / 2 - b, h / 2 - b); s2.lineTo(-w / 2 + b, h / 2 - b); s2.lineTo(-w / 2 + b, -h / 2 + b);
    const g = new THREE.ExtrudeGeometry(s2, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 1 });
    g.translate(0, 0, -(d - 2 * b) / 2); return g;
  };
  const bar = (w, h, x, y, d, b, z = FRAME_Z) => { const m = new THREE.Mesh(barGeo(w, h, d, b), frameMat); m.position.set(x, y, z); m.receiveShadow = true; winFrame.add(m); };
  bar(ww, FW, cx, WIN.y0 + FW / 2, 0.05, 0.007); bar(ww, FW, cx, WIN.y1 - FW / 2, 0.05, 0.007);
  bar(FW, wh, WIN.x0 + FW / 2, cy, 0.05, 0.007); bar(FW, wh, WIN.x1 - FW / 2, cy, 0.05, 0.007);
  MULL_X.forEach((x) => bar(MW, wh - 2 * FW, x, cy, 0.04, 0.0065, FRAME_Z + 0.004));
  bar(ww - 2 * FW, MW, cx, MULL_Y, 0.04, 0.0065, FRAME_Z + 0.004);
  scene.add(winFrame);
  // faint glazing: catches a reflection of the room, never casts a shadow
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww - 2 * FW, wh - 2 * FW), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.07, depthWrite: false }));
  glass.position.set(cx, cy, FRAME_Z + 0.006);
  track(glass.material, 0.9);
  scene.add(glass);

  /* ---------- outside: a bright, out-of-focus morning garden (overexposed on purpose) ---------- */
  const backdropMat = new THREE.ShaderMaterial({
    uniforms: { uTime: timeU, uLevel: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform float uTime; uniform float uLevel;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
      void main(){
        vec2 uv = vUv;
        // a sunny garden seen out of focus: sky, a tree canopy, a hedge, sun catching the leaves
        vec3 sky = mix(vec3(1.0, 0.93, 0.82), vec3(0.86, 0.92, 1.0), smoothstep(0.45, 1.0, uv.y)) * 2.4;
        float canopy = smoothstep(0.40, 0.66, fbm(uv * vec2(11.0, 7.0) + vec2(uTime * 0.006, 0.0))) * smoothstep(1.0, 0.55, uv.y);
        float hedge = smoothstep(0.47, 0.36, uv.y + (fbm(uv * vec2(16.0, 2.0)) - 0.5) * 0.08);
        vec3 leaf = mix(vec3(0.16, 0.24, 0.10), vec3(0.55, 0.62, 0.30), fbm(uv * 20.0 + 2.0));
        vec3 col = mix(sky, leaf * 1.3, canopy * 0.9);
        col = mix(col, leaf * 0.85, hedge);
        col += vec3(1.0, 0.9, 0.6) * smoothstep(0.6, 0.85, fbm(uv * 30.0 + 5.0)) * (canopy + hedge) * 0.45; // sun on the leaves
        col = mix(col, vec3(1.3, 1.16, 0.95), smoothstep(0.2, 0.0, uv.y));
        gl_FragColor = vec4(col * uLevel, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.4), backdropMat);
  backdrop.position.set(0.2, 0.9, -2.1);
  scene.add(backdrop);

  /* ---------- light shafts through the window (ray-marched, desktop tiers) ---------- */
  const BOX_MIN = new V3(-1.9, 0.0, WALL_IN + 0.002), BOX_MAX = new V3(1.9, 1.5, 0.75);
  let beam = null;
  if (!low) {
    const beamMat = new THREE.ShaderMaterial({
      uniforms: { uSun: sunU, uTime: timeU, uColor: { value: sunColor.clone() }, uDensity: { value: 0.034 }, uBoxMin: { value: BOX_MIN }, uBoxMax: { value: BOX_MAX } },
      defines: { STEPS: high ? 26 : 14 },
      vertexShader: 'varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: GLSL_COMMON + /* glsl */`
        varying vec3 vWorld; uniform float uTime; uniform vec3 uColor; uniform float uDensity; uniform vec3 uBoxMin; uniform vec3 uBoxMax;
        void main(){
          vec3 ro = cameraPosition; vec3 rd = normalize(vWorld - ro);
          vec3 inv = 1.0 / rd; vec3 t0 = (uBoxMin - ro) * inv, t1 = (uBoxMax - ro) * inv;
          vec3 tmn = min(t0, t1), tmx = max(t0, t1);
          float tn = max(max(max(tmn.x, tmn.y), tmn.z), 0.0);
          float tf = min(min(tmx.x, tmx.y), tmx.z);
          // the ray ends on the counter top (analytic, so the haze never z-fights with the oak)
          if (rd.y < 0.0) { float tc = -ro.y / rd.y; vec3 pc = ro + rd * tc; if (abs(pc.x) < 2.2 && pc.z < 0.45) tf = min(tf, tc); }
          if (tf <= tn) discard;
          float dt = (tf - tn) / float(STEPS);
          float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          float acc = 0.0;
          for (int i = 0; i < STEPS; i++){
            vec3 p = ro + rd * (tn + (float(i) + j) * dt);
            float a = aperture(p);
            if (a > 0.002){
              float d = vnoise(p * vec3(4.0, 2.6, 4.0) + vec3(uTime * 0.05, -uTime * 0.03, 0.0));
              acc += a * (0.2 + 0.8 * d * d) * dt;
            }
          }
          vec3 col = uColor * acc * uDensity;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const bs = BOX_MAX.clone().sub(BOX_MIN), bc = BOX_MAX.clone().add(BOX_MIN).multiplyScalar(0.5);
    beam = new THREE.Mesh(new THREE.BoxGeometry(bs.x, bs.y, bs.z), beamMat);
    beam.position.copy(bc);
    beam.renderOrder = 10;
    beam.frustumCulled = false;
    scene.add(beam);
  }

  /* ---------- dust in the sunbeam ---------- */
  const DUST = high ? 700 : low ? 160 : 360;
  const dGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(DUST * 3), dSeed = new Float32Array(DUST);
  let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < DUST; i++) { dPos[i * 3] = lerp(-1.6, 1.6, rnd()); dPos[i * 3 + 1] = rnd() * 1.3; dPos[i * 3 + 2] = lerp(WALL_IN, 0.6, rnd()); dSeed[i] = rnd(); }
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dGeo.setAttribute('aSeed', new THREE.BufferAttribute(dSeed, 1));
  const pxU = { value: 800 };
  const dust = new THREE.Points(dGeo, new THREE.ShaderMaterial({
    uniforms: { uSun: sunU, uTime: timeU, uPx: pxU, uColor: { value: sunColor.clone().multiplyScalar(2.4) } },
    vertexShader: GLSL_COMMON + /* glsl */`
      attribute float aSeed; uniform float uTime; uniform float uPx; varying float vB;
      void main(){
        vec3 p = position;
        float t = uTime * (0.6 + aSeed * 0.8);
        p.y = mod(p.y + t * 0.006, 1.3);
        p.x += sin(t * 0.21 + aSeed * 40.0) * 0.03;
        p.z += cos(t * 0.17 + aSeed * 23.0) * 0.025;
        vB = aperture(p) * (0.35 + 0.65 * fract(aSeed * 7.31)) * (0.6 + 0.4 * sin(t * 1.3 + aSeed * 60.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = vB < 0.01 ? 0.0 : clamp((0.0011 + aSeed * 0.0012) * uPx / -mv.z, 1.0, 7.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; varying float vB;
      void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)); gl_FragColor = vec4(uColor * vB * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  dust.frustumCulled = false;
  dust.renderOrder = 11;
  scene.add(dust);

  /* ---------- contact shadows (soft grounding the shadow map misses) ---------- */
  const blobTex = radialTex(128, 0.0, 0.5);
  const contact = (w, d, x, z, o, y = 0.0008) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: o, depthWrite: false, color: 0x2a1a10, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 1; scene.add(m); return m;
  };

  /* ---------- props: placement in metres on the counter (y = 0 is the oak surface) ---------- */
  const CUP_Y = 0.0105; // the cup sits in the saucer's well
  const P_BOARD = new V3(-0.74, 0, 0.06), P_STAND = new V3(-0.06, 0, -0.06), P_CUP = new V3(0.44, 0, 0.13), P_POT = new V3(0.70, 0, -0.1);
  const prep = (root, k = ENV_I) => {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = !low; o.receiveShadow = !low;
      const m = o.material; track(m, k);
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach((key) => { if (m[key]) m[key].anisotropy = aniso; });
      if (low && m.map) downscale(m);
    });
    return root;
  };
  function downscale(m) { // phones: halve the model textures at load so they upload fast and fit in memory
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach((key) => {
      const t = m[key]; if (!t || !t.image || t.userData.small) return;
      const img = t.image, w = img.width, h = img.height; if (!w || w <= 512) return;
      const c = document.createElement('canvas'); c.width = w >> 1; c.height = h >> 1;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      if (img.close) img.close();
      t.image = c; t.userData.small = true; t.needsUpdate = true;
    });
  }
  async function upload(root) { // one texture at a time with a yield between, so no single task blocks the page
    const seen = new Set();
    root.traverse((o) => { if (o.isMesh) ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach((k) => { if (o.material[k]) seen.add(o.material[k]); }); });
    for (const t of seen) { renderer.initTexture(t); await yieldFrame(); }
  }
  async function precompilePasses() { // post-processing programs, compiled for the targets each pass really draws into
    if (!composer || renderer.getContext().isContextLost()) return;
    const pp = new THREE.Scene(), quad = new THREE.PlaneGeometry(2, 2);
    const add = (m) => { if (m && m.isMaterial) { const o = new THREE.Mesh(quad, m); o.frustumCulled = false; pp.add(o); } };
    composer.passes.forEach((pass) => Object.values(pass).forEach((v) => (Array.isArray(v) ? v.forEach(add) : add(v))));
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(composer.writeBuffer);
    const p1 = renderer.compileAsync(pp, camera);
    renderer.setRenderTarget(null);
    const p2 = renderer.compileAsync(pp, camera);
    renderer.setRenderTarget(prev);
    await Promise.race([Promise.all([p1, p2]), new Promise((r) => setTimeout(r, 3000))]);
    quad.dispose();
  }
  async function compile(root) {
    if (renderer.getContext().isContextLost()) return;
    const prev = renderer.getRenderTarget();
    if (composer) renderer.setRenderTarget(composer.readBuffer);
    const p = renderer.compileAsync(root, camera, scene);
    renderer.setRenderTarget(prev);
    await Promise.race([p, new Promise((r) => setTimeout(r, 3000))]);
  }

  // stage 1: board + croissant (in the first frame)
  const [boardScene, croissantScene] = await modelsP;
  const board = new THREE.Group(); board.position.copy(P_BOARD); board.rotation.y = 0.12; scene.add(board);
  if (boardScene) { prep(boardScene); board.add(boardScene); contact(0.62, 0.38, P_BOARD.x, P_BOARD.z, 0.55); }
  const croissant = new THREE.Group();
  croissant.position.set(-0.02, 0.0405, 0.0); croissant.rotation.y = -0.55;
  board.add(croissant);
  if (croissantScene) { prep(croissantScene, 0.85); croissant.add(croissantScene); }

  // crumbs and flakes around the croissant (two instanced meshes): crumbs are small rounded lumps with smooth
  // normals, flakes are thin curled shells of crust
  const crumbGeo = new THREE.SphereGeometry(1, 9, 7);
  { const pa = crumbGeo.attributes.position; // soft irregular lumps: the jitter depends on the position, so the seam stays closed
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const j = 0.82 + 0.16 * Math.sin(x * 2.7 + y * 1.9 + 0.4) * Math.cos(z * 2.3 - x * 1.1) + 0.06 * Math.sin(y * 6.1 + z * 4.7);
      pa.setXYZ(i, x * j, y * j * 0.8, z * j);
    }
    crumbGeo.computeVertexNormals(); }
  const flakeGeo = new THREE.PlaneGeometry(1, 1, 5, 5);
  { const pa = flakeGeo.attributes.position; // a curled shell with a ragged outline
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), edge = Math.max(Math.abs(x), Math.abs(y)) > 0.49;
      const rag = edge ? 0.72 + 0.32 * (0.5 + 0.5 * Math.sin(x * 23.0 + y * 17.0)) : 1;
      pa.setXYZ(i, x * rag, y * rag, 0.28 * x * x - 0.12 * y * y + 0.03 * Math.sin(x * 9 + y * 7));
    }
    flakeGeo.rotateX(-Math.PI / 2); flakeGeo.computeVertexNormals(); }
  const crumbMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
  const flakeMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }));
  const CR = low ? 40 : 100, FL = low ? 12 : 34;
  const crumbs = new THREE.InstancedMesh(crumbGeo, crumbMat, CR), flakes = new THREE.InstancedMesh(flakeGeo, flakeMat, FL);
  { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V3(), p = new V3(), col = new THREE.Color(); let k = 3;
    const r2 = () => ((k = (k * 48271) % 2147483647) / 2147483647);
    const spot = () => { const a = r2() * Math.PI * 2, d = 0.075 + Math.pow(r2(), 2.2) * 0.12; p.set(-0.02 + Math.cos(a) * d * 1.25, 0.0408, Math.sin(a) * d * 0.7); };
    for (let i = 0; i < CR; i++) {
      spot();
      const pale = r2() < 0.5, sz = 0.0004 + Math.pow(r2(), 1.6) * 0.0011;
      sc.set(sz * (0.8 + r2() * 0.5), sz * (0.6 + r2() * 0.3), sz * (0.8 + r2() * 0.5));
      p.y += sc.y * 0.55;
      e.set((r2() - 0.5) * 0.6, r2() * Math.PI, (r2() - 0.5) * 0.6); q.setFromEuler(e);
      crumbs.setMatrixAt(i, m4.compose(p, q, sc));
      // crumbs from the inside are pale, bits of crust are deep gold
      if (pale) col.setRGB(0.86 + r2() * 0.06, 0.74 + r2() * 0.06, 0.52 + r2() * 0.06, THREE.SRGBColorSpace);
      else col.setRGB(0.62 + r2() * 0.12, 0.38 + r2() * 0.08, 0.16 + r2() * 0.06, THREE.SRGBColorSpace);
      crumbs.setColorAt(i, col);
    }
    for (let i = 0; i < FL; i++) {
      spot();
      const sz = 0.0014 + r2() * 0.0022;
      sc.set(sz * (0.9 + r2() * 0.6), sz * (0.6 + r2() * 0.6), sz * (0.6 + r2() * 0.5));
      p.y += sz * 0.1;
      e.set((r2() - 0.5) * 0.35, r2() * Math.PI * 2, (r2() - 0.5) * 0.35); q.setFromEuler(e);
      flakes.setMatrixAt(i, m4.compose(p, q, sc));
      col.setRGB(0.66 + r2() * 0.12, 0.40 + r2() * 0.08, 0.15 + r2() * 0.06, THREE.SRGBColorSpace);
      flakes.setColorAt(i, col);
    }
  }
  [crumbs, flakes].forEach((m) => { m.castShadow = !low; m.receiveShadow = !low; board.add(m); });

  // a fig-dyed linen cloth under the cake stand
  const weave = weaveTextures(aniso);
  const linenGeo = new THREE.PlaneGeometry(0.58, 0.34, 48, 28);
  { const pa = linenGeo.attributes.position; // soft folds and a slightly lifted hem
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i);
      const edge = Math.max(Math.abs(x) / 0.29, Math.abs(y) / 0.17);
      pa.setZ(i, 0.0012 * Math.sin(x * 38 + y * 9) * edge + 0.0018 * Math.max(0, edge - 0.9) * 10 * (0.5 + 0.5 * Math.sin(x * 21)));
    }
    linenGeo.computeVertexNormals(); }
  const linenMat = track(new THREE.MeshStandardMaterial({ color: 0x8e5b78, map: weave.ct, normalMap: weave.nt, roughness: 0.95, side: THREE.DoubleSide }));
  linenMat.normalScale.set(0.7, 0.7);
  const linen = new THREE.Mesh(linenGeo, linenMat);
  linen.rotation.x = -Math.PI / 2; linen.rotation.z = 0.08;
  linen.position.set(P_STAND.x + 0.02, 0.0016, P_STAND.z + 0.08);
  linen.receiveShadow = !low;
  scene.add(linen);

  const standPts = [[0.0, 0.0], [0.062, 0.0], [0.064, 0.004], [0.05, 0.012], [0.024, 0.03], [0.018, 0.06], [0.02, 0.072], [0.05, 0.078], [0.14, 0.082], [0.152, 0.086], [0.153, 0.09], [0.145, 0.091], [0.0, 0.088]].map(([x, y]) => new THREE.Vector2(x, y));
  // ceramic cake stand (lathe), glazed, with a little use: faint pinholes and greyed specks in the glaze, and a sheen
  // that is duller where knives and plates have rubbed the top
  const standTex = standWearTextures();
  const standMat = track(new THREE.MeshPhysicalMaterial({ color: 0xf6f0e6, map: standTex.map, roughnessMap: standTex.rough, roughness: 1, clearcoat: low ? 0 : 0.55, clearcoatRoughness: 0.16 }), 0.9);
  const stand = new THREE.Mesh(new THREE.LatheGeometry(standPts, low ? 40 : 72), standMat);
  stand.position.copy(P_STAND); stand.castShadow = !low; stand.receiveShadow = !low;
  scene.add(stand);
  contact(0.24, 0.24, P_STAND.x, P_STAND.z, 0.5, 0.0024);
  // a cotton lace doily on the plate (alpha-tested lace drawn on a canvas); it follows the plate's shallow cone
  { const dGeo = new THREE.CircleGeometry(0.136, 72); dGeo.rotateX(-Math.PI / 2);
    const pa = dGeo.attributes.position;
    for (let i = 0; i < pa.count; i++) { const r = Math.hypot(pa.getX(i), pa.getZ(i)); pa.setY(i, 0.088 + 0.003 * r / 0.145 + 0.0007); }
    dGeo.computeVertexNormals();
    const doilyMat = track(new THREE.MeshStandardMaterial({ color: 0xfbf7ef, alphaMap: doilyTexture(), alphaTest: 0.5, roughness: 0.95, side: THREE.DoubleSide }), 0.8);
    const doily = new THREE.Mesh(dGeo, doilyMat);
    doily.position.set(P_STAND.x, 0, P_STAND.z); doily.rotation.y = 0.3; doily.receiveShadow = !low;
    scene.add(doily); }
  const cakeHolder = new THREE.Group(); cakeHolder.position.set(P_STAND.x, 0.0905, P_STAND.z); cakeHolder.rotation.y = 0.6;
  scene.add(cakeHolder);

  // two oak shelves on the wall beside the window, with stacked bowls, plates and a crock (procedural ceramics)
  { const plank = new THREE.BoxGeometry(0.62, 0.024, 0.15);
    const ironMat = track(new THREE.MeshStandardMaterial({ color: 0x2a2320, metalness: 0.55, roughness: 0.5 }));
    const figGlaze = track(new THREE.MeshPhysicalMaterial({ color: 0x6a3757, roughness: 0.3, clearcoat: low ? 0 : 0.5, clearcoatRoughness: 0.2 }), 0.9);
    const stoneGlaze = track(new THREE.MeshStandardMaterial({ color: 0xc9b9a2, map: standTex.map, roughness: 0.62 }));
    const lathe = (pts, segs = low ? 28 : 48) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs);
    const bowlG = lathe([[0, 0], [0.03, 0], [0.032, 0.004], [0.05, 0.019], [0.06, 0.04], [0.057, 0.042], [0.046, 0.023], [0.028, 0.008], [0, 0.007]]);
    const plateG = lathe([[0, 0], [0.05, 0], [0.052, 0.003], [0.1, 0.012], [0.11, 0.016], [0.105, 0.0175], [0.05, 0.0065], [0, 0.0065]]);
    const crockG = lathe([[0, 0], [0.045, 0], [0.048, 0.006], [0.05, 0.1], [0.046, 0.114], [0.049, 0.12], [0.043, 0.123], [0.041, 0.112], [0.043, 0.1], [0, 0.098]]);
    const put = (g, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = !low; o.receiveShadow = !low; scene.add(o); return o; };
    const shelf = (cx2, y) => {
      const zc = WALL_IN + 0.075;
      put(plank, counterMat, cx2, y - 0.012, zc);
      [-0.22, 0.22].forEach((dx) => { // L brackets
        put(new THREE.BoxGeometry(0.012, 0.11, 0.008), ironMat, cx2 + dx, y - 0.079, WALL_IN + 0.004);
        put(new THREE.BoxGeometry(0.012, 0.008, 0.12), ironMat, cx2 + dx, y - 0.028, WALL_IN + 0.064);
      });
      return { y, zc };
    };
    const R = shelf(1.5, 0.52), L = shelf(-1.5, 0.52);
    for (let i = 0; i < 3; i++) put(bowlG, i === 1 ? figGlaze : standMat, 1.36, R.y + i * 0.013, R.zc, i);
    put(crockG, figGlaze, 1.6, R.y, R.zc - 0.005);
    for (let i = 0; i < 4; i++) put(plateG, stoneGlaze, -1.62, L.y + i * 0.0065, L.zc, i * 0.7);
    put(crockG, standMat, -1.38, L.y, L.zc);
  }

  // tea service holders (filled later)
  const cupHolder = new THREE.Group(); cupHolder.position.copy(P_CUP); cupHolder.rotation.y = 2.5; scene.add(cupHolder);
  const potPivot = new THREE.Group(); scene.add(potPivot);
  const toCup = new V3(P_CUP.x - P_POT.x, 0, P_CUP.z - P_POT.z);
  const potYaw = Math.atan2(toCup.x, toCup.z);
  contact(0.2, 0.2, P_CUP.x, P_CUP.z, 0.5);
  const potShadow = contact(0.26, 0.26, P_POT.x, P_POT.z, 0.55);

  // tea in the cup: a glossy disc that rises, and the pour stream
  const teaMat = track(new THREE.MeshStandardMaterial({ color: 0x3e1903, emissive: 0x2c0e01, emissiveIntensity: 0.6, roughness: 0.06 }), 0.32);
  const tea = new THREE.Mesh(new THREE.CircleGeometry(1, 40), teaMat);
  tea.rotation.x = -Math.PI / 2;
  tea.visible = false;
  scene.add(tea);
  const bez = { p0: { value: new V3() }, p1: { value: new V3() }, p2: { value: new V3() }, uR: { value: 0.0026 } };
  const streamMat = track(new THREE.MeshStandardMaterial({ color: 0x4a1a03, emissive: 0x4a1803, emissiveIntensity: 0.42, roughness: 0.1 }), 0.22);
  const sunCookie = streamMat.onBeforeCompile;
  streamMat.customProgramCacheKey = () => 'sun-cookie-stream';
  streamMat.onBeforeCompile = (sh, r) => {
    sunCookie(sh, r);
    Object.assign(sh.uniforms, bez, { uTime: timeU });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 p0; uniform vec3 p1; uniform vec3 p2; uniform float uR; uniform float uTime;\nvec3 bzP(float s){ float a = 1.0 - s; return a*a*p0 + 2.0*a*s*p1 + s*s*p2; }\nvec3 bzD(float s){ return 2.0*(1.0-s)*(p1-p0) + 2.0*s*(p2-p1); }\nvec3 bzN(vec2 xz, float s){ vec3 t = normalize(bzD(s)); vec3 a = normalize(cross(t, abs(t.y) > 0.9 ? vec3(1,0,0) : vec3(0,1,0))); vec3 b = cross(t, a); return a * xz.x + b * xz.y; }')
      .replace('#include <beginnormal_vertex>', 'float sS = position.y + 0.5; vec3 objectNormal = bzN(position.xz, sS);')
      // a real pour necks as it falls, ripples travel down it and the cross-section is never quite round
      .replace('#include <begin_vertex>', `float ang = atan(position.z, position.x);
float rr = uR * mix(1.2, 0.62, sS) * (1.0 + 0.13 * sin(sS * 46.0 - uTime * 28.0) + 0.07 * sin(sS * 97.0 - uTime * 53.0 + 1.3)
  + 0.06 * sin(ang * 2.0 + sS * 13.0 - uTime * 9.0) + 0.035 * sin(ang * 3.0 - sS * 21.0 + uTime * 17.0));
vec3 wob = bzN(vec2(1.0, 0.0), sS) * (0.00055 * sin(sS * 19.0 - uTime * 15.0)) + bzN(vec2(0.0, 1.0), sS) * (0.0004 * sin(sS * 27.0 - uTime * 21.0 + 0.7));
vec3 transformed = bzP(sS) + wob * sS + bzN(position.xz, sS) * rr;`);
  };
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14, 48, true), streamMat);
  stream.frustumCulled = false; stream.visible = false;
  scene.add(stream);

  // steam (soft noise sheets that turn to face the camera)
  const steamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: timeU, uAmt: { value: 0 }, uCol: { value: new THREE.Color(1, 0.98, 0.95) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform float uTime; uniform float uAmt; uniform vec3 uCol;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * n(p); p = p * 2.02 + 3.1; a *= 0.5; } return s; }
      void main(){
        float y = vUv.y, x = (vUv.x - 0.5) * 2.0, t = uTime;
        float sway = (fbm(vec2(y * 1.6 - t * 0.22, 4.0)) - 0.5) * 1.3 * y;
        float xx = x - sway;
        // a soft veil plus thin filaments that curl: the strand pattern is advected upward through a warped field
        vec2 q = vec2(xx * 1.8, y * 2.4 - t * 0.42);
        float w1 = fbm(q);
        float w2 = fbm(q * 1.7 + vec2(5.2, 1.3) + w1 * 1.6);
        float strand = pow(1.0 - abs(sin((xx * 2.2 + (w2 - 0.5) * 2.6 * y + y * 0.6) * 3.1416)), 4.0);
        float w = mix(0.16, 0.85, y);
        float body = smoothstep(1.0, 0.0, abs(xx) / w);
        float veil = clamp(w1 * 1.7 - 0.55, 0.0, 1.0);
        float fil = strand * smoothstep(0.32, 0.7, w2) * smoothstep(0.0, 0.25, y);
        float a = body * smoothstep(0.0, 0.1, y) * smoothstep(1.0, 0.3, y) * (veil * 0.8 + fil * 0.75);
        gl_FragColor = vec4(uCol, clamp(a, 0.0, 1.0) * uAmt);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const steamGeo = new THREE.PlaneGeometry(0.15, 0.3); steamGeo.translate(0, 0.15, 0);
  const steam = new THREE.Mesh(steamGeo, steamMat);
  steam.position.set(P_CUP.x, 0.07, P_CUP.z);
  steam.renderOrder = 12; steam.visible = false;
  scene.add(steam);

  /* ---------- post-processing (desktop high tier) ---------- */
  let composer = null, bloom = null, fxaa = null, grain = null;
  const GrainShader = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmt: { value: 0.035 }, uVig: { value: 0.28 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmt; uniform float uVig; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        vec2 d = vUv - 0.5; float v = 1.0 - uVig * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
        c.rgb *= v;
        c.rgb += (h(vUv * 913.0) - 0.5) * uAmt;
        gl_FragColor = c;
      }`,
  };
  function makeComposer() {
    if (!high || !PP) return;
    const { EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, FXAAShader } = PP;
    const sz = new THREE.Vector2(); renderer.getDrawingBufferSize(sz);
    const rt = new THREE.WebGLRenderTarget(sz.x, sz.y, { type: THREE.HalfFloatType, samples: 0 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.16, 0.4, 1.35);
    composer.addPass(bloom);
    // OutputPass is created with the defines render() would set (sRGB + ACES are fixed here), so the precompiled
    // program is the one really used and the first composed frame does not compile it again
    const output = new OutputPass();
    output.material.defines = { SRGB_TRANSFER: '', ACES_FILMIC_TONE_MAPPING: '' };
    output._outputColorSpace = renderer.outputColorSpace; output._toneMapping = renderer.toneMapping;
    composer.addPass(output);
    grain = new ShaderPass(GrainShader); composer.addPass(grain);
    // the stock FXAA asks for a -100 texture bias (clamped with a warning on ANGLE/D3D, pointless without mipmaps)
    fxaa = new ShaderPass({ ...FXAAShader, fragmentShader: FXAAShader.fragmentShader.replace(/,\s*-100\.0\)/g, ')') });
    composer.addPass(fxaa);
  }
  makeComposer();

  /* ---------- camera path: one keyframe per station ---------- */
  // p = camera, t = look-at, f = vertical fov, sx = horizontal shift of the subject (panel on the other side), sy = phones
  const KF = [
    { p: [-0.40, 0.40, 1.16], t: [0.16, 0.13, -0.14], f: 34, sx: 0.17, sy: 0.12 },  // morning: the counter in window light
    { p: [-0.50, 0.16, 0.37], t: [-0.77, 0.045, 0.04], f: 28, sx: -0.16, sy: 0.16 }, // pastry macro
    { p: [0.20, 0.28, 0.52], t: [-0.06, 0.135, -0.06], f: 30, sx: 0.16, sy: 0.15 },  // cake on the stand
    { p: [0.14, 0.27, 0.56], t: [0.50, 0.10, 0.03], f: 30, sx: -0.15, sy: 0.15 },    // the pour
    { p: [0.0, 1.6, 1.25], t: [0.0, 0.0, -0.76], f: 34, sx: 0.0, sy: 0.0 },     // high angle for the menu: the spread sits below the card
    { p: [-0.02, 0.3, 0.98], t: [0.5, 0.22, -0.3], f: 34, sx: 0.16, sy: 0.14 },   // by the window
  ];
  const posCurve = new THREE.CatmullRomCurve3(KF.map((k) => new V3(...k.p)), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(KF.map((k) => new V3(...k.t)), false, 'centripetal');
  // sun per station: azimuth (radians, + = sun to the right) and elevation; exposure
  const SUN = [ // az: + = sun to the right; el: elevation; ex: exposure; bk: brightness outside the window
    { az: -0.18, el: 0.36, ex: 1.12, bk: 1.25 },
    { az: 0.38, el: 0.34, ex: 1.12, bk: 1.25 },
    { az: -0.12, el: 0.40, ex: 1.12, bk: 1.25 },
    { az: 0.26, el: 0.36, ex: 1.12, bk: 1.25 },
    { az: 0.05, el: 0.62, ex: 1.05, bk: 1.25 },
    { az: 0.40, el: 0.26, ex: 1.05, bk: 1.05 },
  ];

  /* ---------- sizing ---------- */
  let W = 1, H = 1, portrait = false;
  function resize() {
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(pr); composer.setSize(W, H); fxaa.material.uniforms.resolution.value.set(1 / (W * pr), 1 / (H * pr)); }
    camera.aspect = W / H;
    portrait = W / H < 0.95;
    pxU.value = (H * pr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    wake();
  }
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(resize, 120); };
  window.addEventListener('resize', onResize);

  /* ---------- state ---------- */
  const N = KF.length;
  const cur = { t: 0, u: new Array(N).fill(0) }, tgt = { t: 0, u: new Array(N).fill(0) };
  const STILL_U = [0.6, 0.5, 0.5, 0.62, 0.5, 0.5];
  let intro = reduce ? 0 : 1, paused = false, clock = 0;
  function setState(st) {
    if (st.still !== undefined) { tgt.t = st.still; tgt.u = STILL_U.map((v, i) => (i < st.still ? 1 : i === st.still ? v : 0)); }
    else { tgt.t = st.t; for (let i = 0; i < N; i++) tgt.u[i] = st.u[i] || 0; }
    if (reduce) { cur.t = tgt.t; cur.u = tgt.u.slice(); }
    wake();
  }

  /* ---------- per-frame update ---------- */
  const camPos = new V3(), camTg = new V3(), tmp = new V3(), tip = new V3(), q = new THREE.Quaternion();
  const TIP_LOCAL = new V3(0, 0.1135, 0.1395); // teapot spout tip in the model's own space
  function sample(arr, t, key) { const i = Math.floor(clamp(t, 0, N - 1 - 1e-6)), f = clamp(t, 0, N - 1) - i; const a = arr[i][key], b = arr[Math.min(N - 1, i + 1)][key]; return lerp(a, b, easeIO(f)); }
  function applyCamera() {
    const t = clamp(cur.t, 0, N - 1);
    posCurve.getPoint(t / (N - 1), camPos); tgtCurve.getPoint(t / (N - 1), camTg);
    const asp = camera.aspect;
    // narrow screens: step back so the subject still fits; the intro starts a little further out
    const k = Math.max(1, Math.pow(1.45 / asp, 0.52)) * (1 + 0.18 * intro * intro);
    camPos.sub(camTg).multiplyScalar(k).add(camTg);
    if (intro > 0) camPos.x -= 0.2 * intro * intro;
    if (!paused && !reduce) { camPos.y += Math.sin(clock * 0.31) * 0.003; camPos.x += Math.sin(clock * 0.23 + 1.0) * 0.004; }
    camera.position.copy(camPos); camera.lookAt(camTg);
    const fov = sample(KF, t, 'f');
    if (Math.abs(camera.fov - fov) > 1e-4) { camera.fov = fov; pxU.value = (H * pr) / (2 * Math.tan((fov * Math.PI) / 360)); }
    const sx = portrait ? 0 : sample(KF, t, 'sx'), sy = portrait ? sample(KF, t, 'sy') : 0;
    camera.setViewOffset(W, H, -sx * W, sy * H, W, H);
    camera.updateProjectionMatrix();
  }
  function applySun() {
    const t = clamp(cur.t, 0, N - 1);
    let az = sample(SUN, t, 'az'), el = sample(SUN, t, 'el');
    az += (cur.u[0] - 0.5) * 0.18 * (1 - sstep(0.6, 1.2, t)); // the morning sweep while the hero is held
    az -= 0.55 * intro * intro; el -= 0.08 * intro * intro;  // first light slides in on arrival
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 3.2);
    renderer.toneMappingExposure = sample(SUN, t, 'ex');
    backdropMat.uniforms.uLevel.value = sample(SUN, t, 'bk');
  }
  function applyPour() {
    const u = cur.u[3];
    const come = easeIO(sstep(0.04, 0.32, u)), go = easeIO(sstep(0.86, 1.0, u)), lift = come * (1 - go);
    const tilt = 0.66 * lift;
    // spout position after the tilt (about the pot's own x axis), then turned toward the cup
    tip.set(0, TIP_LOCAL.y * Math.cos(tilt) - TIP_LOCAL.z * Math.sin(tilt), TIP_LOCAL.y * Math.sin(tilt) + TIP_LOCAL.z * Math.cos(tilt));
    tip.applyAxisAngle(tmp.set(0, 1, 0), potYaw);
    const dirx = Math.sin(potYaw), dirz = Math.cos(potYaw);
    const pourBase = tmp.set(P_CUP.x - dirx * 0.012 - tip.x, 0.142 - tip.y, P_CUP.z - dirz * 0.012 - tip.z);
    potPivot.position.set(lerp(P_POT.x, pourBase.x, lift), lerp(0, pourBase.y, lift), lerp(P_POT.z, pourBase.z, lift));
    q.setFromAxisAngle(tmp.set(0, 1, 0), potYaw); potPivot.quaternion.copy(q);
    potPivot.rotateX(tilt);
    potShadow.material.opacity = 0.55 * (1 - lift);
    // tea level and stream
    const fill = sstep(0.3, 0.84, u);
    const lvl = CUP_Y + lerp(0.04, 0.063, fill);
    tea.visible = fill > 0.002;
    const r = 0.0262 + (lvl - CUP_Y - 0.02) * 0.62;
    tea.scale.setScalar(r); tea.position.set(P_CUP.x, lvl, P_CUP.z);
    const pouring = lift > 0.985 && u > 0.33 && u < 0.86;
    stream.visible = pouring;
    if (pouring) {
      potPivot.updateMatrixWorld(true);
      bez.p0.value.copy(TIP_LOCAL).applyMatrix4(potPivot.matrixWorld);
      bez.p1.value.copy(bez.p0.value).add(tmp.set(-dirx * 0.004, -0.02, -dirz * 0.004));
      bez.p2.value.set(P_CUP.x - dirx * 0.004, lvl, P_CUP.z - dirz * 0.004);
    }
    const st = sstep(0.55, 0.95, u) * (1 - sstep(4.6, 5.2, cur.t)); // steam rises once the cup is full
    steamMat.uniforms.uAmt.value = st;
    steam.visible = st > 0.01;
    if (steam.visible) { steam.position.y = lvl + 0.004; steam.rotation.y = Math.atan2(camera.position.x - steam.position.x, camera.position.z - steam.position.z); }
  }
  const fades = [];
  function applyFades(dt) {
    for (let i = fades.length - 1; i >= 0; i--) {
      const f = fades[i]; f.k = Math.min(1, f.k + dt / 0.7);
      f.mats.forEach((m) => { m.opacity = easeIO(f.k); });
      if (f.k >= 1) { f.mats.forEach((m) => { m.transparent = false; m.opacity = 1; }); fades.splice(i, 1); }
    }
  }
  function draw() { if (composer) composer.render(); else renderer.render(scene, camera); }

  /* ---------- render loop: continuous while motion is on, on demand while paused or settled ---------- */
  let raf = 0, last = 0, journeyVisible = true, tabVisible = !document.hidden, lost = false, guard = high, frames = 0, slow = 0;
  let ready = false; // no frame may run before the shaders are compiled and the first frame is drawn
  const canRun = () => ready && !lost && tabVisible && journeyVisible;
  function settled() {
    if (Math.abs(cur.t - tgt.t) > 0.0004 || intro > 0 || fades.length) return false;
    for (let i = 0; i < N; i++) if (Math.abs(cur.u[i] - tgt.u[i]) > 0.0004) return false;
    return true;
  }
  function frame(ts) {
    raf = 0;
    if (!canRun()) return;
    const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000 || 0.016)); last = ts;
    if (!reduce) {
      const k = 1 - Math.exp(-dt * 4.2);
      cur.t += (tgt.t - cur.t) * k;
      for (let i = 0; i < N; i++) { cur.u[i] += (tgt.u[i] - cur.u[i]) * k; if (Math.abs(cur.u[i] - tgt.u[i]) < 0.0003) cur.u[i] = tgt.u[i]; }
      if (Math.abs(cur.t - tgt.t) < 0.0003) cur.t = tgt.t;
      if (!paused) clock += dt;
      if (intro > 0) intro = Math.max(0, intro - dt / 3.2);
    }
    timeU.value = clock;
    if (grain) grain.uniforms.uTime.value = paused ? 0 : (clock % 10);
    applyFades(dt);
    applyCamera(); applySun(); applyPour();
    draw();
    // adaptive quality: a desktop that cannot hold ~40 fps sheds cost in stages, then stops watching
    if (guard && !paused && !reduce && !document.hidden) {
      frames++; if (dt > 0.026) slow++;
      if (frames === 90) { if (slow > 55) degrade(); frames = 0; slow = 0; }
    }
    // never queue a second callback: degrade() -> resize() -> wake() may already have queued one
    if (!raf && !reduce && (!paused || !settled())) raf = requestAnimationFrame(frame);
  }
  function degrade() {
    if (pr > 1) { pr = Math.max(1, pr - 0.25); resize(); return; }
    if (bloom) { bloom.enabled = false; return; }
    if (beam && beam.material.defines.STEPS > 12) { beam.material.defines.STEPS = 12; beam.material.needsUpdate = true; }
    guard = false;
  }
  function wake() {
    if (raf || !canRun()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  // off-screen: watch the real content container (the canvas itself is fixed and always "visible")
  const io = new IntersectionObserver((e) => { journeyVisible = e[0].isIntersecting; journeyVisible ? wake() : stop(); }, { threshold: 0 });
  const jr = document.getElementById('journey'); if (jr) io.observe(jr);
  const onVis = () => { tabVisible = !document.hidden; tabVisible ? wake() : stop(); };
  document.addEventListener('visibilitychange', onVis);

  const onLost = (e) => { e.preventDefault(); lost = true; stop(); opts.onLost && opts.onLost(); };
  const onRestored = () => {
    // objects of the dead context are forgotten, not disposed (three has rebuilt its registries already)
    lost = false;
    envRT = buildEnv();
    scene.environment = envRT.texture;
    if (hdrTex) hdrTex.dispose();
    composer = bloom = fxaa = grain = null;
    makeComposer();
    opts.onRestored && opts.onRestored();
    resize();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  /* ---------- first frame: compile against the target we actually render to, upload, draw ---------- */
  resize();
  applyCamera(); applySun();
  [stream, steam, tea].forEach((o) => { o.visible = true; });
  if (boardScene) await upload(boardScene);
  if (croissantScene) await upload(croissantScene);
  await compile(scene);
  await precompilePasses();
  if (renderer.getContext().isContextLost()) return null;
  applyPour();
  draw();
  progress(1);
  ready = true;
  wake();

  /* ---------- later stations stream in during idle time ---------- */
  let alive = true;
  async function addLate(id, key, place) {
    await idle();
    if (!alive) return;
    const root = await loadModel(id, key);
    if (!root || !alive) return;
    prep(root);
    // compiled in the state of their first visible frames (transparent, fading in); the opaque programs already exist
    const mats = [];
    root.traverse((o) => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0; mats.push(o.material); } });
    await upload(root);
    await compile(root);
    if (!alive) return;
    place(root);
    fades.push({ k: reduce || paused ? 1 : 0, mats }); // paused: models appear at once, no fade frames
    wake();
  }
  (async () => {
    await addLate('carrot_cake', 'cake', (r) => cakeHolder.add(r));
    await addLate('tea_set_01', 'tea', (r) => {
      const byName = (n) => r.getObjectByName(n);
      const take = (n, parent) => { const o = byName(n); if (!o) return null; o.position.set(0, o.position.y, 0); parent.add(o); return o; };
      take('tea_set_01_saucer_circular_03', cupHolder);
      const cup = take('tea_set_01_cup_small_01', cupHolder);
      if (cup) cup.position.y = CUP_Y;
      const potBody = take('tea_set_01_teapot_01', potPivot);
      const lid = take('tea_set_01_teapot_01_lid', potPivot);
      if (!potBody && !lid) return;
    });
  })();

  function detach() {
    alive = false; stop(); io.disconnect();
    window.removeEventListener('resize', onResize);
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
    // pausing snaps the opening camera move to its end at once; one frame draws that state, then the loop sleeps
    setPaused(p) { paused = p; if (p) { intro = 0; fades.forEach((f) => { f.k = 1; }); } wake(); },
  };
}
