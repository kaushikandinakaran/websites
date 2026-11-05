// Jade Teahouse (photo edition) - the scenery is two real 360-degree photographs (a Chinese garden in sun and a
// warm timber dining room at night). The camera turns, zooms and travels a little inside each photo and dissolves
// between them; real scanned props stand in front, lit by the photo's own light (baked environment + a matched key).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as W from './world.js';

const { clamp, lerp, smoothstep } = THREE.MathUtils;
const PH = '../../assets/polyhaven/';
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sstep = (a, b, x) => smoothstep(x, a, b);
const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const TAU = Math.PI * 2;
// a horizontal direction in the photo's own frame: u is the panorama's x position (0..1), like three's equirectUv
const dirU = (u) => { const a = (u - 0.5) * TAU; return [Math.cos(a), Math.sin(a)]; };

/* ---------- the two photographs. height = the photo camera's height above its floor (metres), radius = where
   the projected floor meets the far wall. Grades are applied in the final pass to photo and props together. */
const WORLDS = {
  G: { // garden: clear morning sun
    hi: 'assets/pano/chinese_garden_6k.jpg', lo: 'assets/pano/chinese_garden_4k.jpg', env: 'assets/env-chinese-garden-pmrem128.hdr',
    height: 1.8, radius: 9, gain: 1.0, envI: 0.45,
    grade: [1.1, 0.9, 0.2, 1.04], lift: [0.010, 0.014, 0.016],
  },
  I: { // dining room: warm lamps at night
    hi: 'assets/pano/warm_restaurant_night_6k.jpg', lo: 'assets/pano/warm_restaurant_night_4k.jpg', env: 'assets/env-warm-restaurant-night-pmrem128.hdr',
    height: 1.6, radius: 10, gain: 0.95, envI: 0.75,
    grade: [1.0, 0.78, -0.45, 1.05], lift: [0.012, 0.010, 0.010],
  },
};

/* ---------- placement (metres, photo frame: the photo camera stands at x = z = 0) */
const GT = (() => { const [x, z] = dirU(0.975); return V3(x * 3.0, 0, z * 3.0); })(); // tea table on the sunlit path
const RIG_LOCAL_CAM = V3(0.62, 0.0, 0.8); // the side of the table the camera comes from (table space)
const TOP = 0.5; // tea table top
// the teapot stays on the table and tips forward on the front edge of its foot, spout just above the cup rim
const POT = V3(-0.12, TOP, 0.0), CUP = V3(0.024, TOP, 0.108), CUP2 = V3(-0.15, TOP, 0.24);
const PZ = 0.055; // pot origin -> front edge of its foot (model space)
const SPOUT_TIP = V3(0, 0.117, 0.136 - PZ); // spout tip relative to that edge
const TILT = 0.3; // radians at full pour: keeps the tip about 1 cm above the cup rim
const SUN = (() => { const [x, z] = dirU(0.6), e = (31 * Math.PI) / 180; return V3(x * Math.cos(e), Math.sin(e), z * Math.cos(e)); })();
// dining room: the same low tea table stands on the photographed tile floor in front of the real bench and table
const TT_I = (() => { const [x, z] = dirU(0.455); return V3(x * 1.55, 0, z * 1.55); })();
const STEAMER = V3(TT_I.x - 0.06, TOP, TT_I.z - 0.04);
const CUP_I = V3(TT_I.x + 0.02, TOP, TT_I.z + 0.23);
const LID_REST = V3(-0.2, 0, 0.07);

/* ---------- camera stations. Either p + look (a point) or p + u/pitch (a direction in the photo).
   fov desktop / pf phone portrait, sx/sy view offsets (subject away from the panel), blur = photo depth of field */
const ST = [
  { w: 'G', p: V3(0, 1.8, 0), u: 0.68, pitch: 4, fov: 62, pf: 66, sx: 0.14, sy: 0.12, blur: 1, soft: 0 },
  { w: 'G', rig: true, p: V3(1.25, 1.32, 1.6), look: V3(-0.05, 0.52, 0.08), fov: 30, pf: 46, sx: -0.15, sy: 0.14, blur: 2.2, soft: 0.8 },
  { w: 'I', p: V3(0, 1.6, 0), look: V3(STEAMER.x, STEAMER.y + 0.26, STEAMER.z), fov: 34, pf: 50, sx: 0.15, sy: 0.14, blur: 1.6, soft: 0 },
  { w: 'I', p: V3(0, 1.6, 0), u: 0.22, pitch: 18, fov: 58, pf: 70, sx: 0, sy: 0, blur: 1.0, soft: 0 },
  { w: 'G', p: V3(0, 1.8, 0), u: 0.955, pitch: -8, pp: -20, fov: 48, pf: 64, sx: 0.14, sy: 0.14, blur: 1, soft: 0.3 },
];
const STILL_U = [0, 0.62, 0.78, 1, 1];
const PROPS = [false, true, true, false, false]; // stations with props in frame (they get the multisampled target)

function detectTier() {
  const small = Math.min(window.innerWidth, window.innerHeight) <= 760 && window.innerWidth <= 900;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const lowCpu = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  return small || coarse || lowCpu ? 'low' : 'high';
}
const yieldTask = () => new Promise((r) => setTimeout(r, 0));
const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 400 }) : setTimeout(r, 30)));

/* ---------- the photograph as a world: the floor of the photo becomes a real ground plane at its height,
   the rest a sphere. Ray from the real camera (not the origin), seam-safe mip selection, a blur control. */
function panoMaterial(tex, cfg) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, height: { value: cfg.height }, radius: { value: cfg.radius }, uBlur: { value: 1 }, uGain: { value: cfg.gain } },
    side: THREE.BackSide, depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform float height, radius, uBlur, uGain; varying vec3 vWorld;
      float sphereHit(vec3 ro, vec3 rd, float ra){ float b = dot(ro, rd), c = dot(ro, ro) - ra * ra, h = b * b - c; return h < 0.0 ? -1.0 : -b + sqrt(h); }
      float diskHit(vec3 ro, vec3 rd, float hy, float r){ if (rd.y >= 0.0) return 1e6; float t = (hy - ro.y) / rd.y; vec3 q = ro + rd * t; return dot(q.xz, q.xz) < r * r ? t : 1e6; }
      void main(){
        vec3 rd = normalize(vWorld - cameraPosition);
        vec3 ro = cameraPosition; ro.y -= height;
        float t1 = sphereHit(ro, rd, radius), t2 = diskHit(ro, rd, -height, radius);
        vec3 d = t1 > 0.0 ? normalize(ro + min(t1, t2) * rd) : vec3(0.0, 1.0, 0.0);
        vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
        vec2 uv2 = vec2(fract(uv.x + 0.5), uv.y);
        vec2 dx = dFdx(uv), dy = dFdy(uv), dx2 = dFdx(uv2), dy2 = dFdy(uv2);
        if (dot(dx2, dx2) + dot(dy2, dy2) < dot(dx, dx) + dot(dy, dy)) { dx = dx2; dy = dy2; }
        gl_FragColor = vec4(textureGrad(map, uv, dx * uBlur, dy * uBlur).rgb * uGain, 1.0);
      }`,
  });
}

/* ---------- final pass: grade each world (photo and props together), dissolve, soft shoulder, vignette, grain */
const FINAL = {
  uniforms: {
    tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    gA: { value: new THREE.Vector4(1, 1, 0, 1) }, gB: { value: new THREE.Vector4(1, 1, 0, 1) },
    lA: { value: new THREE.Vector3() }, lB: { value: new THREE.Vector3() }, uSoft: { value: 0 }, uGrain: { value: 0.03 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tA, tB; uniform float uMix, uTime, uSoft, uGrain; uniform vec2 uRes; uniform vec4 gA, gB; uniform vec3 lA, lB;
    varying vec2 vUv;
    vec3 fetch(sampler2D t){
      vec3 c = texture2D(t, vUv).rgb;
      if (uSoft > 0.01) { // match the props' sharpness to the enlarged photograph (8 taps around the pixel)
        vec2 o = uSoft / uRes; vec2 e = o * 0.7071;
        vec3 s = texture2D(t, vUv + vec2(o.x, 0.0)).rgb + texture2D(t, vUv - vec2(o.x, 0.0)).rgb + texture2D(t, vUv + vec2(0.0, o.y)).rgb + texture2D(t, vUv - vec2(0.0, o.y)).rgb
          + texture2D(t, vUv + e).rgb + texture2D(t, vUv - e).rgb + texture2D(t, vUv + vec2(e.x, -e.y)).rgb + texture2D(t, vUv + vec2(-e.x, e.y)).rgb;
        c = c * 0.2 + s * 0.1;
      }
      return c;
    }
    vec3 grade(vec3 c, vec4 g, vec3 lift){
      c *= g.x;
      c *= vec3(1.0 + 0.05 * g.z, 1.0, 1.0 - 0.07 * g.z);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max(mix(vec3(l), c, g.y), 0.0);
      c = pow(c / 0.18, vec3(g.w)) * 0.18;
      return c + lift * (1.0 - clamp(c, 0.0, 1.0));
    }
    vec3 shoulder(vec3 c){ vec3 k = vec3(0.78); vec3 o = max(c - k, 0.0); return min(c, k) + (1.0 - k) * (1.0 - exp(-o / (1.0 - k))); }
    vec3 toSRGB(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    void main(){
      vec3 c = grade(fetch(tA), gA, lA);
      if (uMix > 0.0) c = mix(c, grade(fetch(tB), gB, lB), uMix);
      c = shoulder(c);
      vec2 q = (vUv - 0.5) * vec2(1.0, 0.82);
      c *= mix(0.8, 1.0, smoothstep(0.78, 0.2, length(q)));
      c = toSRGB(c);
      float n = fract(sin(dot(floor(vUv * uRes) + floor(uTime * 24.0) * 7.13, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export async function initScene(canvas, opts = {}) {
  const reduce = !!opts.reduce;
  const tier = detectTier();
  const high = tier === 'high';
  let guard = high;
  let pr = Math.min(window.devicePixelRatio || 1, high ? 1.5 : 1);

  // the driver finishes starting the context on its first real call (about 0.2 s on Windows/ANGLE): make that call
  // in a task of its own, so it does not add to the module start-up task or the renderer's set-up task
  await yieldTask();
  // the context is created here (silently: no console noise if WebGL2 is unavailable) and handed to three.js
  let g0 = null;
  try { g0 = canvas.getContext('webgl2', { alpha: false, antialias: false, stencil: false, depth: true, powerPreference: 'high-performance' }); } catch (e) { g0 = null; }
  if (!g0) return null; // the posters stay
  try { g0.getExtension('EXT_color_buffer_float'); } catch (e) { /* checked again by the renderer */ }
  await yieldTask();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: g0, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
  } catch (e) { return null; }
  const gl = renderer.getContext();
  if (!gl || !renderer.capabilities.isWebGL2) { renderer.dispose(); return null; } // the panorama path needs WebGL2
  renderer.debug.checkShaderErrors = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // tone and grade happen in the final pass
  renderer.setClearColor(0x0c1411, 1);
  renderer.shadowMap.enabled = true; // phones too: maps are small and only re-rendered when something moves
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // re-rendered per world only when something that casts has moved (wd.shadowDirty)
  renderer.setPixelRatio(pr);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const bigPano = high && renderer.capabilities.maxTextureSize >= 8192;
  let lost = false, ready = false;
  const bootLost = (e) => { e.preventDefault(); lost = true; };
  canvas.addEventListener('webglcontextlost', bootLost);

  /* ---------- loaders */
  const BYTES = high ? { G: 3.95e6, envG: 0.49e6, table: 1.58e6, teaset: 2.28e6, I: 5.2e6, envI: 0.45e6 } : { G: 1.81e6, envG: 0.49e6, table: 0.5e6, teaset: 0.9e6, I: 1.5e6, envI: 0.45e6 };
  const total = Object.values(BYTES).reduce((s, v) => s + v, 0);
  let loaded = 0;
  const tick = (k) => { loaded += BYTES[k] || 0; opts.onProgress && opts.onProgress(loaded / total); };
  const manager = new THREE.LoadingManager();
  if (!high) { // phones skip the models' normal and ARM maps (a flat 1x1 image answers those URLs)
    const flat = (r, g, b) => { const c = W.makeCanvas(1, 1), x = c.getContext('2d'); x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(0, 0, 1, 1); return c.toDataURL(); };
    const NOR = flat(128, 128, 255), ARM = flat(255, 150, 0);
    manager.setURLModifier((url) => (/_nor_gl_/.test(url) ? NOR : /_arm_/.test(url) ? ARM : url));
  }
  const gltfLoader = new GLTFLoader(manager);
  const loadModel = (id) => new Promise((res) => gltfLoader.load(`${PH}models/${id}/${id}_1k.gltf`, (g) => res(g.scene), undefined, () => res(null)));
  const loadEnv = (url) => new Promise((res) => new RGBELoader().load(url, (t) => {
    t.mapping = THREE.CubeUVReflectionMapping; t.flipY = false; t.generateMipmaps = false;
    t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; res(t);
  }, undefined, () => res(null)));
  // the panorama is decoded off the main thread (createImageBitmap), then uploaded once with mipmaps
  // (in a worker: Chrome decodes a flipped bitmap on the calling thread, which froze the page for 0.5-1 s)
  let worker = null, wid = 0;
  const waiting = new Map();
  function workerDecode(url) {
    try {
      if (!worker) {
        const src = "self.onmessage=async(e)=>{let bmp=null;try{const r=await fetch(e.data.url);if(r.ok){const b=await r.blob();bmp=await createImageBitmap(b,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});}}catch(x){}self.postMessage({id:e.data.id,bmp},bmp?[bmp]:[]);};";
        const wu = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        worker = new Worker(wu); URL.revokeObjectURL(wu);
        worker.onmessage = (e) => { const f = waiting.get(e.data.id); waiting.delete(e.data.id); f && f(e.data.bmp); };
        worker.onerror = () => { waiting.forEach((f) => f(undefined)); waiting.clear(); };
      }
      const id = ++wid;
      return new Promise((res) => { waiting.set(id, res); worker.postMessage({ id, url: new URL(url, location.href).href }); });
    } catch (e) { return Promise.resolve(undefined); }
  }
  async function loadPano(url) {
    try {
      let img = window.createImageBitmap && window.Worker ? await workerDecode(url) : undefined, flip = false;
      if (img === null) return null; // the file failed
      if (!img) { // no worker: decode in the page
        const r = await fetch(url);
        if (!r.ok) return null;
        img = new Image(); img.src = URL.createObjectURL(await r.blob()); await img.decode(); URL.revokeObjectURL(img.src); flip = true;
      }
      const t = new THREE.Texture(img);
      t.flipY = flip; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = maxAniso; t.generateMipmaps = true;
      if (flip) t.needsUpdate = true; else t.userData.striped = true; // a decoded bitmap is uploaded in strips (uploadStriped)
      return t;
    } catch (e) { return null; }
  }

  /* ---------- the two worlds */
  function makeWorld(key) {
    const cfg = WORLDS[key];
    const scene = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 12), panoMaterial(null, cfg));
    sky.scale.setScalar(60); sky.frustumCulled = false; sky.renderOrder = -10; sky.visible = false;
    scene.add(sky);
    return { key, cfg, scene, sky, tex: null, env: null, ready: false, shadowDirty: true, closed: false, mats: new Set(), cam: new THREE.PerspectiveCamera(50, 1, 0.03, 120) };
  }
  const G = makeWorld('G'), I = makeWorld('I');
  const worlds = { G, I };
  const trackIn = (wd) => (m) => { wd.mats.add(m); if ('envMapIntensity' in m) m.envMapIntensity = wd.cfg.envI * (m.userData.envScale ?? 1); return m; };
  function prepModel(root, wd, { shadow = true, rough = null, receive = true } = {}) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = shadow; o.receiveShadow = receive;
      const m = o.material;
      if (!high) { m.normalMap = null; m.roughnessMap = null; m.metalnessMap = null; m.aoMap = null; m.roughness = rough ?? 0.6; m.metalness = 0; }
      ['map', 'normalMap', 'roughnessMap', 'emissiveMap'].forEach((k) => { if (m[k]) m[k].anisotropy = maxAniso; });
      m.needsUpdate = true;
      trackIn(wd)(m);
    });
    return root;
  }
  async function upload(root) {
    const seen = new Set();
    root.traverse((o) => { if (o.material) ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach((k) => { const t = o.material[k]; if (t) seen.add(t); }); });
    for (const t of seen) { if (lost) return; renderer.initTexture(t); await yieldTask(); }
  }
  async function compile(obj, wd) {
    if (lost || gl.isContextLost()) return;
    renderer.setRenderTarget(rtA);
    try { await Promise.race([renderer.compileAsync(obj, wd.cam, wd.scene), new Promise((r) => setTimeout(r, 6000))]); } catch (e) { /* compiled on first draw instead */ }
    renderer.setRenderTarget(null);
  }

  /* ---------- garden: the tea table, its lights and shadows */
  const rig = new THREE.Group();
  rig.position.copy(GT);
  { const w = V3(-GT.x, 0, -GT.z).normalize(); rig.rotation.y = Math.atan2(w.x, w.z) - Math.atan2(RIG_LOCAL_CAM.x, RIG_LOCAL_CAM.z); }
  rig.updateMatrixWorld(true);
  G.scene.add(rig);
  const sun = new THREE.DirectionalLight(0xfff0dc, 4.5);
  sun.position.copy(GT).addScaledVector(SUN, 6); sun.target.position.copy(GT);
  {
    sun.castShadow = true; sun.shadow.mapSize.set(high ? 1024 : 512, high ? 1024 : 512);
    const c = sun.shadow.camera; c.left = -1.4; c.right = 1.4; c.top = 1.4; c.bottom = -1.4; c.near = 2; c.far = 10;
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 2.5;
  }
  const skyFill = new THREE.HemisphereLight(0xbcd4ff, 0x8a7a66, 0.0); // env carries the fill; kept for the no-env case
  G.scene.add(sun, sun.target, skyFill);
  // the sun shadow lands only where the photograph shows ground (cobbles, soil), not on the hedges that the ground
  // projection also lays flat: the catcher samples the photo under each point and fades out over green foliage
  const catchMat = new THREE.ShadowMaterial({ color: 0x1a2436, opacity: 0.52, depthWrite: false });
  const catchU = { uPano: { value: null }, uPH: { value: WORLDS.G.height } };
  catchMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, catchU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCW; uniform sampler2D uPano; uniform float uPH;')
      .replace('gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );', `
        vec3 d = normalize(vCW - vec3(0.0, uPH, 0.0));
        vec2 puv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
        vec3 pc = textureLod(uPano, puv, 4.0).rgb;
        float green = pc.g - max(pc.r, pc.b);
        float onGround = 1.0 - smoothstep(0.015, 0.06, green);
        gl_FragColor = vec4(color, opacity * onGround * (1.0 - getShadowMask()));`);
  };
  catchMat.customProgramCacheKey = () => 'catchG';
  const catcherG = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), catchMat);
  catcherG.rotation.x = -Math.PI / 2; catcherG.position.set(GT.x, 0.001, GT.z); catcherG.receiveShadow = true; catcherG.renderOrder = 1;
  G.scene.add(catcherG);
  const shadowsG = new THREE.Group();
  [[0, 0, 1.25, 1.0, 0.45]].forEach(([x, z, w, d, o]) => { const cs = W.contactShadow(w, d, o); cs.position.set(x, 0.002, z); shadowsG.add(cs); });
  rig.add(shadowsG);
  [[POT, 0.24, 0.42], [CUP, 0.15, 0.4], [CUP2, 0.15, 0.36]].forEach(([p, s, o]) => { const cs = W.contactShadow(s, s, o); cs.position.set(p.x, TOP + 0.001, p.z); rig.add(cs); });

  // the pour pieces (procedural tea and steam; the porcelain is the real scan)
  const tea = W.buildTea(trackIn(G));
  const cupSteam = W.buildSteam(high ? 12 : 6, { rise: 0.16, spread: 0.016, size: 0.04, rate: 0.2, drift: 0.02, opacity: 0.12, seed: 4, color: 0xf2efe8 });
  const cupCols = W.buildSteamColumns(high ? 3 : 2, { rise: 0.16, spread: 0.012, width: 0.04, opacity: 0.18, speed: 0.26, seed: 5, color: 0xf4f1ea });
  tea.stream.geometry.dispose();
  { const sg = new THREE.CylinderGeometry(1.5, 0.75, 1, 10, 1, true); sg.translate(0, -0.5, 0); tea.stream.geometry = sg; } // thicker where it leaves the spout
  const lip = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 12, 8), tea.stream.material); lip.visible = false; // tea gathering at the spout lip
  rig.add(tea.liquid, tea.stream, lip, cupSteam, cupCols);
  const potGroup = new THREE.Group(); potGroup.rotation.order = 'YXZ';
  const potYaw = Math.atan2(CUP.x - POT.x, CUP.z - POT.z);
  const PIVOT = POT.clone().add(V3(Math.sin(potYaw) * PZ, 0, Math.cos(potYaw) * PZ));
  potGroup.position.copy(PIVOT);
  rig.add(potGroup);

  /* ---------- dining room: the steamer on the photographed table */
  const steamer = W.buildSteamer(trackIn(I));
  steamer.position.copy(STEAMER); steamer.rotation.y = 0.4; steamer.visible = false; // shown once its table has arrived
  // steam: mostly fine filaments; the soft puffs only thicken the base a little
  const steamerSteam = W.buildSteam(high ? 12 : 8, { rise: 0.3, spread: 0.05, size: 0.07, rate: 0.16, drift: 0.04, opacity: 0.08, seed: 9, color: 0xfff4e6 });
  steamerSteam.position.set(STEAMER.x, STEAMER.y + 0.08, STEAMER.z);
  const steamerCols = W.buildSteamColumns(high ? 6 : 4, { rise: 0.42, spread: 0.07, width: 0.045, opacity: 0.42, speed: 0.24, seed: 31, color: 0xfff6ea });
  steamerCols.position.set(STEAMER.x, STEAMER.y + 0.07, STEAMER.z);
  const key = new THREE.SpotLight(0xffd6ae, 9, 0, 0.6, 0.85, 2);
  key.position.set(STEAMER.x - 0.5, STEAMER.y + 1.7, STEAMER.z + 0.3); key.target.position.copy(STEAMER);
  // a warm light behind the basket (the lamps over the real table) rims the bamboo and lights the steam from behind
  const rimI = new THREE.PointLight(0xffc48a, 0.9, 0, 2);
  rimI.position.set(STEAMER.x + 0.75, STEAMER.y + 0.5, STEAMER.z - 0.35);
  { key.castShadow = true; key.shadow.mapSize.set(high ? 1024 : 512, high ? 1024 : 512); key.shadow.camera.near = 0.6; key.shadow.camera.far = 3.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.01; key.shadow.radius = 4; }
  key.shadow.camera.far = 3.4;
  const catcherI = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.ShadowMaterial({ color: 0x2a1408, opacity: 0.5, depthWrite: false }));
  catcherI.rotation.x = -Math.PI / 2; catcherI.position.set(TT_I.x, 0.001, TT_I.z); catcherI.receiveShadow = true; catcherI.renderOrder = 1; catcherI.visible = false;
  const shI = W.contactShadow(0.34, 0.34, 0.5); shI.position.set(STEAMER.x, TOP + 0.0015, STEAMER.z); shI.visible = false;
  const shTI = W.contactShadow(1.3, 1.1, 0.5); shTI.position.set(TT_I.x, 0.002, TT_I.z); shTI.visible = false;
  const propsI = new THREE.Group(); propsI.add(steamer, steamerSteam, steamerCols, catcherI, shI, shTI);
  I.scene.add(propsI, key, key.target, rimI);
  G.props = rig; I.props = propsI;
  steamer.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  /* ---------- render targets and the final pass */
  let rtA = null, rtB = null, rtP = null; // rtP: plain (no MSAA) target for photo-only stations, much cheaper to fill
  const dbs = new THREE.Vector2();
  const makeRT = () => new THREE.WebGLRenderTarget(dbs.x, dbs.y, { type: THREE.HalfFloatType, samples: high ? 4 : 2, depthBuffer: true });
  const finalMat = new THREE.ShaderMaterial({ ...FINAL, uniforms: THREE.UniformsUtils.clone(FINAL.uniforms), depthTest: false, depthWrite: false });
  finalMat.uniforms.uGrain.value = high ? 0.03 : 0.024;
  const finalScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), finalMat); quad.frustumCulled = false; finalScene.add(quad);
  const finalCam = new THREE.Camera();

  /* ---------- sizing */
  let Wd = 1, Ht = 1, portrait = false;
  function resize() {
    Wd = Math.max(1, window.innerWidth); Ht = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(Wd, Ht, false);
    renderer.getDrawingBufferSize(dbs);
    if (!rtA) rtA = makeRT(); else rtA.setSize(dbs.x, dbs.y);
    if (rtB) rtB.setSize(dbs.x, dbs.y); // the second target exists only once a dissolve has needed it
    if (rtP) rtP.setSize(dbs.x, dbs.y);
    finalMat.uniforms.uRes.value.set(dbs.x, dbs.y);
    G.cam.aspect = I.cam.aspect = Wd / Ht;
    portrait = Wd / Ht < 0.9;
    wake();
  }
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(resize, 120); };
  window.addEventListener('resize', onResize);

  /* ---------- state */
  const N = ST.length;
  const cur = { t: 0, u: [0, 0, 0, 0, 0] }, tgt = { t: 0, u: [0, 0, 0, 0, 0] };
  let intro = reduce ? 0 : 1, paused = false, clock = 3.0;
  const pointer = new THREE.Vector2(), pointerCur = new THREE.Vector2();
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onPointer = (e) => { if (paused) return; pointer.set((e.clientX / Wd) * 2 - 1, (e.clientY / Ht) * 2 - 1); wake(); };
  if (fine && !reduce) window.addEventListener('pointermove', onPointer, { passive: true });
  function setState(s) {
    if (s.still !== undefined) { tgt.t = s.still; tgt.u = STILL_U.map((v, i) => (i < s.still ? 1 : i === s.still ? v : 0)); }
    else { tgt.t = s.t; for (let i = 0; i < N; i++) tgt.u[i] = s.u[i] || 0; }
    if (reduce) { cur.t = tgt.t; cur.u = tgt.u.slice(); }
    wake();
  }

  /* ---------- stations resolved to position, yaw, pitch */
  const tmpV = V3(0, 0, 0);
  const SR = ST.map((s) => {
    const p = s.rig ? rig.localToWorld(s.p.clone()) : s.p.clone();
    let yaw, pitch;
    if (s.look) {
      const l = s.rig ? rig.localToWorld(s.look.clone()) : s.look.clone();
      tmpV.subVectors(l, p).normalize();
      yaw = Math.atan2(tmpV.z, tmpV.x); pitch = Math.asin(tmpV.y);
    } else { yaw = (s.u - 0.5) * TAU; pitch = (s.pitch * Math.PI) / 180; }
    return { ...s, P: p, yaw, pitch, pitchP: s.pp !== undefined ? (s.pp * Math.PI) / 180 : pitch };
  });
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const fwdOf = (yaw, pitch, out) => out.set(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch));
  const pose = { p: V3(0, 0, 0), yaw: 0, pitch: 0, fov: 50, sx: 0, sy: 0, blur: 1, soft: 0 };
  function poseAt(i, j, f, out) { // interpolate station i -> j (same world)
    const a = SR[i], b = SR[j];
    out.p.copy(a.P).lerp(b.P, f);
    out.yaw = a.yaw + wrapA(b.yaw - a.yaw) * f;
    out.pitch = lerp(portrait ? a.pitchP : a.pitch, portrait ? b.pitchP : b.pitch, f);
    out.fov = lerp(portrait ? a.pf : a.fov, portrait ? b.pf : b.fov, f);
    out.sx = lerp(a.sx, b.sx, f); out.sy = lerp(a.sy, b.sy, f);
    out.blur = lerp(a.blur, b.blur, f); out.soft = lerp(a.soft, b.soft, f);
    return out;
  }
  const fwd = V3(0, 0, 0), right = V3(0, 0, 0), upv = V3(0, 0, 0);
  function applyPose(wd, ps, push, holdPush) {
    const cam = wd.cam;
    fwdOf(ps.yaw, ps.pitch, fwd);
    cam.position.copy(ps.p).addScaledVector(fwd, push + holdPush);
    let yaw = ps.yaw, pitch = ps.pitch;
    if (!paused && !reduce) { yaw += Math.sin(clock * 0.11) * 0.006; pitch += Math.sin(clock * 0.09 + 1) * 0.004; }
    if (fine && !reduce) { yaw += pointerCur.x * 0.012; pitch -= pointerCur.y * 0.008; }
    fwdOf(yaw, pitch, fwd);
    cam.lookAt(tmpV.copy(cam.position).add(fwd));
    let fov = ps.fov * (1 - 0.06 * holdPush / 0.12);
    if (intro > 0) fov *= 1 + 0.12 * intro * intro;
    cam.fov = fov;
    const sx = portrait ? 0 : ps.sx, sy = portrait ? ps.sy : 0;
    if (Math.abs(sx) + Math.abs(sy) > 1e-4) cam.setViewOffset(Wd, Ht, -sx * Wd, sy * Ht, Wd, Ht); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    wd.sky.material.uniforms.uBlur.value = ps.blur;
    wd.sky.position.copy(cam.position);
  }
  // which worlds to draw this frame and with what weight
  const draws = [{ wd: null, w: 1, soft: 0 }, { wd: null, w: 0, soft: 0 }];
  const poseA = { p: V3(0, 0, 0) }, poseB = { p: V3(0, 0, 0) };
  function applyCamera() {
    const t = clamp(cur.t, 0, N - 1 - 1e-6);
    const i = Math.floor(t), f = t - i, a = SR[i], b = SR[i + 1];
    const st = Math.round(t), ul = cur.u[st] || 0, hold = Math.abs(t - st) < 0.12 ? 0.12 * easeIO(clamp(ul, 0, 1)) : 0;
    if (a.w === b.w) {
      poseAt(i, i + 1, easeIO(f), poseA);
      applyPose(worlds[a.w], poseA, 0, hold);
      draws[0].wd = worlds[a.w]; draws[0].w = 1; draws[0].soft = poseA.soft; draws[1].w = 0;
      worlds[a.w].props.visible = true;
    } else { // a dissolve between photographs: A pushes on, B arrives from slightly behind
      const m = sstep(0.45, 0.58, f); // a quick dissolve of the photographs only
      // props never double-expose: each world shows its props only while it is the stronger image
      worlds[a.w].props.visible = m < 0.5; worlds[b.w].props.visible = m >= 0.5;
      poseAt(i, i, 0, poseA); poseAt(i + 1, i + 1, 0, poseB);
      applyPose(worlds[a.w], poseA, 0.35 * f, f < 0.5 ? hold * (1 - f * 2) : 0);
      applyPose(worlds[b.w], poseB, -0.35 * (1 - f), 0);
      draws[0].wd = worlds[a.w]; draws[0].w = 1 - m; draws[0].soft = poseA.soft;
      draws[1].wd = worlds[b.w]; draws[1].w = m; draws[1].soft = poseB.soft;
    }
  }

  /* ---------- scroll-driven moments */
  const tipW = V3(0, 0, 0), surf = V3(0, 0, 0), dirV = V3(0, 0, 0), downY = V3(0, -1, 0);
  const ext = { pot: null, cup: null };
  let lastTilt = NaN, lastLid = NaN;
  function updateScene() {
    const u = cur.u, t = cur.t;
    // the pour (station 2): lift, tilt, stream, the cup fills, the pot returns (all in table space)
    const p = u[1];
    const tilt = easeIO(sstep(0.16, 0.38, p)) * (1 - easeIO(sstep(0.76, 0.92, p)));
    const level = easeIO(sstep(0.36, 0.74, p));
    if (Math.abs(tilt - lastTilt) > 1e-4) { G.shadowDirty = true; lastTilt = tilt; }
    potGroup.position.copy(PIVOT);
    potGroup.rotation.set(tilt * TILT, potYaw, 0);
    potGroup.updateMatrix();
    tipW.copy(SPOUT_TIP).applyMatrix4(potGroup.matrix);
    const cupBase = CUP.y + 0.008;
    const fillY = cupBase + lerp(0.012, 0.054, level);
    tea.liquid.visible = !!ext.cup && level > 0.002;
    tea.liquid.position.set(CUP.x, fillY, CUP.z);
    const rr = lerp(0.034, 0.047, (fillY - cupBase - 0.012) / 0.042);
    tea.liquid.scale.set(rr, rr, 1);
    tea.stream.visible = !!ext.pot && tilt > 0.93 && p > 0.34 && p < 0.76;
    lip.visible = !!ext.pot && tilt > 0.75 && p < 0.8; if (lip.visible) lip.position.copy(tipW);
    if (tea.stream.visible) { // a thin stream falling almost straight from the spout, leaning a little toward the cup centre
      surf.set(lerp(tipW.x, CUP.x, 0.35), fillY, lerp(tipW.z, CUP.z, 0.35));
      dirV.subVectors(surf, tipW);
      const len = dirV.length();
      tea.stream.position.copy(tipW);
      tea.stream.quaternion.setFromUnitVectors(downY, dirV.normalize());
      tea.stream.scale.set(0.0016, len, 0.0016);
      lip.position.copy(tipW);
    }
    const cupAmt = ext.cup ? (0.35 + 0.65 * level) * (1 - sstep(1.4, 1.9, t)) : 0;
    cupSteam.userData.U.uAmount.value = cupAmt; cupSteam.position.set(CUP.x, fillY + 0.012, CUP.z);
    cupCols.userData.U.uAmount.value = cupAmt; cupCols.position.set(CUP.x, fillY + 0.004, CUP.z);

    // the steamer (station 3): steam leaks, the lid lifts and is set down beside it, a bloom of steam
    const s = u[2];
    const open = easeIO(sstep(0.12, 0.6, s)) * (1 - easeIO(sstep(3.55, 4.0, t)));
    const lid = steamer.userData.lid;
    const up = sstep(0.0, 0.3, open), carry = easeIO(sstep(0.22, 0.86, open)), down = sstep(0.62, 0.9, open);
    const sl = clamp((open - 0.88) / 0.12, 0, 1), settle = open > 0.88 ? Math.sin(sl * 11.0) * Math.exp(-sl * 4.5) * 0.05 : 0;
    const air = up * (1 - down);
    lid.position.set(LID_REST.x * carry, lerp(steamer.userData.lidY, 0, carry) + 0.085 * air + Math.abs(settle) * 0.11, LID_REST.z * carry);
    lid.rotation.set(-0.32 * air + settle, 0.5 * carry, 0.22 * air + settle * 0.6);
    const lk = lid.position.x + lid.position.y * 3 + lid.rotation.x;
    if (Math.abs(lk - lastLid) > 1e-4) { I.shadowDirty = true; lastLid = lk; }
    const sa = steamer.visible ? (0.3 + 0.9 * sstep(0.1, 0.5, s)) * (1 - 0.45 * sstep(0.85, 1, s)) * (1 - sstep(2.6, 3.2, t)) : 0;
    steamerSteam.userData.U.uAmount.value = sa; steamerCols.userData.U.uAmount.value = sa;
    steamerSteam.userData.U.uSpread.value = lerp(0.075, 0.06, open);
    steamerSteam.position.y = STEAMER.y + lerp(0.085, 0.07, open);

    const T = clock;
    steamerSteam.userData.U.uTime.value = T; cupSteam.userData.U.uTime.value = T;
    steamerCols.userData.U.uTime.value = T; cupCols.userData.U.uTime.value = T;
    finalMat.uniforms.uTime.value = T;
  }

  /* ---------- render */
  function renderWorld(wd, rt) {
    renderer.shadowMap.needsUpdate = wd.shadowDirty; wd.shadowDirty = false;
    renderer.setRenderTarget(rt);
    renderer.render(wd.scene, wd.cam);
  }
  function setGrade(slot, wd) {
    const g = wd.cfg.grade, l = wd.cfg.lift, u = finalMat.uniforms;
    (slot ? u.gB : u.gA).value.set(g[0], g[1], g[2], g[3]);
    (slot ? u.lB : u.lA).value.set(l[0], l[1], l[2]);
  }
  function draw() {
    const d0 = draws[0], d1 = draws[1], U = finalMat.uniforms;
    const a = d0.wd && d0.wd.ready ? d0 : null, b = d1.w > 0 && d1.wd && d1.wd.ready ? d1 : null;
    if (a && b && d0.w > 0.001 && d1.w < 0.999) {
      if (!rtB) rtB = makeRT();
      renderWorld(a.wd, rtA); renderWorld(b.wd, rtB);
      setGrade(0, a.wd); setGrade(1, b.wd); U.uMix.value = d1.w; U.uSoft.value = lerp(a.soft, b.soft, d1.w);
    } else {
      const one = b && d1.w >= 0.5 ? b : a || b;
      if (!one) return;
      let rt = rtA;
      if (high && !PROPS[Math.round(clamp(cur.t, 0, N - 1))]) { if (!rtP) rtP = new THREE.WebGLRenderTarget(dbs.x, dbs.y, { type: THREE.HalfFloatType, samples: 0 }); rt = rtP; }
      renderWorld(one.wd, rt); setGrade(0, one.wd); U.uMix.value = 0; U.uSoft.value = one.soft;
      U.tA.value = rt.texture;
    }
    U.uSoft.value *= high ? pr : 1;
    if (U.uMix.value > 0) U.tA.value = rtA.texture;
    U.tB.value = rtB ? rtB.texture : U.tA.value;
    renderer.setRenderTarget(null);
    renderer.render(finalScene, finalCam);
  }

  /* ---------- loop */
  let raf = 0, last = 0, journeyVisible = true, tabVisible = !document.hidden, stillQueued = false;
  const canRun = () => ready && !lost && tabVisible && journeyVisible;
  let frames = 0, slow = 0;
  function settled() {
    if (Math.abs(cur.t - tgt.t) > 0.0005) return false;
    for (let i = 0; i < N; i++) if (Math.abs(cur.u[i] - tgt.u[i]) > 0.0005) return false;
    return pointerCur.distanceToSquared(pointer) < 1e-6 || paused;
  }
  function frame(ts) {
    raf = 0;
    if (!canRun()) return;
    const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000 || 0.016)); last = ts;
    const k = 1 - Math.exp(-dt * 3.6);
    cur.t += (tgt.t - cur.t) * k;
    for (let i = 0; i < N; i++) cur.u[i] += (tgt.u[i] - cur.u[i]) * k;
    if (Math.abs(cur.t - tgt.t) < 0.0004) cur.t = tgt.t;
    for (let i = 0; i < N; i++) if (Math.abs(cur.u[i] - tgt.u[i]) < 0.0004) cur.u[i] = tgt.u[i];
    if (!paused) { pointerCur.lerp(pointer, 1 - Math.exp(-dt * 3.0)); clock += dt; }
    if (intro > 0) intro = Math.max(0, intro - dt / 3.2);
    applyCamera(); updateScene(); draw();
    if (guard && !paused && !document.hidden) {
      frames++; if (dt > 0.024) slow++;
      if (frames === 120) { if (slow > 70) degrade(); frames = 0; slow = 0; }
    }
    if (!raf && (!paused || !settled() || intro > 0)) raf = requestAnimationFrame(frame);
  }
  function degrade() {
    if (pr > 1) { pr = Math.max(1, pr - 0.25); resize(); return; }
    guard = false;
  }
  function stillFrame() {
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
  const waiters = [];
  const alive = () => (lost ? new Promise((r) => waiters.push(r)) : Promise.resolve());
  const onLost = (e) => { e.preventDefault(); lost = true; stop(); opts.onLost && opts.onLost(); };
  const onRestored = () => {
    if (!ready) { lost = false; return; }
    lost = false;
    rtA = rtB = rtP = null; // targets of the dead context are forgotten, not disposed; textures re-upload from their CPU copies
    resize();
    // the panoramas were uploaded by hand: upload them again (strips), then show the scene
    // (a world whose upload the loss interrupted is finished here too)
    // (a world still loading when the context died is finished by the loader below, which waits for this restore)
    const up = [G, I].filter((wd) => wd.tex && wd.ready);
    up.forEach((wd) => { wd.ready = false; wd.glt = null; wd.shadowDirty = true; });
    (async () => {
      for (const wd of up) { if (await uploadPano(wd)) { await compile(wd.scene, wd); wd.ready = !lost; } }
      if (lost) return;
      opts.onRestored && opts.onRestored();
      // programs half-built in the dead context are rebuilt from scratch
      [G, I].forEach((wd) => wd.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); }));
      waiters.splice(0).forEach((f) => f()); // let the interrupted loader carry on
      wake();
    })();
  };
  canvas.removeEventListener('webglcontextlost', bootLost);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  /* ---------- the panorama upload, split into strips of rows (one task each) so no single task stalls the page;
     the texture object is handed to three.js afterwards. Mipmaps are generated on the GPU at the end. */
  // wait (without blocking) until the GPU has finished everything issued so far: a fence polled between tasks
  async function gpuDone(maxMs = 400) {
    if (lost || gl.isContextLost()) return;
    const f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!f) { await yieldTask(); return; }
    gl.flush();
    const t0 = performance.now();
    await yieldTask();
    while (!lost && !gl.isContextLost() && gl.getSyncParameter(f, gl.SYNC_STATUS) !== gl.SIGNALED && performance.now() - t0 < maxMs) await new Promise((r) => setTimeout(r, 4));
    if (!gl.isContextLost()) gl.deleteSync(f);
  }
  async function uploadStriped(tex, px) {
    const img = tex.image, w = img.width, h = img.height, st = renderer.state;
    const glt = gl.createTexture();
    const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
    st.bindTexture(gl.TEXTURE_2D, glt);
    gl.texStorage2D(gl.TEXTURE_2D, levels, gl.SRGB8_ALPHA8, w, h);
    const rows = Math.max(32, Math.floor(px / w));
    for (let y = 0; y < h; y += rows) {
      if (lost || gl.isContextLost()) return null;
      st.bindTexture(gl.TEXTURE_2D, glt);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, w); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, w, Math.min(rows, h - y), gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0); gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
      await gpuDone(); // pace the strips by the GPU, so the page never blocks waiting for command-buffer space
    }
    if (lost || gl.isContextLost()) return null;
    st.bindTexture(gl.TEXTURE_2D, glt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
    gl.generateMipmap(gl.TEXTURE_2D);
    st.bindTexture(gl.TEXTURE_2D, null);
    await gpuDone();
    const props = renderer.properties.get(tex);
    props.__webglTexture = glt; props.__webglInit = true; props.__version = tex.version;
    await yieldTask();
    return glt;
  }
  async function uploadPano(wd) {
    if (!wd.tex.userData.striped) { renderer.initTexture(wd.tex); await yieldTask(); return true; }
    if (wd.closed) { // the decoded copy was released after the first upload: decode the (cached) file again
      const bmp = await workerDecode(wd.url);
      if (!bmp || lost) return false;
      wd.tex.image = bmp; wd.closed = false;
    }
    // the first photograph uploads behind the poster in larger strips; the second while the page is in use, in small ones
    wd.glt = await uploadStriped(wd.tex, ready ? 0.4e6 : 0.8e6);
    if (wd.glt && wd.tex.image.close) { wd.tex.image.close(); wd.closed = true; } // frees the CPU copy (tens of MB)
    return !!wd.glt;
  }

  /* ---------- world loading: the panorama and its light, uploaded while the poster still shows */
  async function bringUp(wd, kPano, kEnv) {
    wd.url = bigPano ? wd.cfg.hi : wd.cfg.lo;
    const [tex, env] = await Promise.all([loadPano(wd.url), loadEnv(wd.cfg.env)]);
    tick(kPano); tick(kEnv);
    if (!tex || lost) return false;
    wd.tex = tex; wd.sky.material.uniforms.map.value = tex; wd.sky.visible = true;
    if (env) { wd.env = env; wd.scene.environment = env; }
    if (!(await uploadPano(wd)) || lost) return false;
    if (env) { renderer.initTexture(env); await yieldTask(); }
    await compile(wd.scene, wd);
    wd.ready = !lost;
    return wd.ready;
  }

  /* ---------- first frame: the garden photograph */
  resize();
  if (reduce) { cur.t = tgt.t; cur.u = tgt.u.slice(); }
  applyCamera(); updateScene();
  const finalCompile = (async () => { try { await Promise.race([renderer.compileAsync(finalScene, finalCam), new Promise((r) => setTimeout(r, 6000))]); } catch (e) { /* first draw */ } })();
  const okG = await bringUp(G, 'G', 'envG');
  catchU.uPano.value = G.tex;
  await finalCompile;
  if (lost || !okG) return null;
  ready = true;
  applyCamera(); draw();
  opts.onFirstFrame && opts.onFirstFrame();
  wake();

  /* ---------- the rest streams in behind it: tea table and porcelain, then the dining room */
  (async () => {
    // a context loss mid-load does not drop the object: wait for the restore and upload it again
    const add = async (obj, wd, parent) => {
      for (;;) { await alive(); await upload(obj); await compile(obj, wd); if (!lost) break; }
      (parent || wd.scene).add(obj); wd.shadowDirty = true; wake(); await idle();
    };
    try {
      await idle();
      const [tableM, set] = await Promise.all([loadModel('chinese_tea_table'), loadModel('tea_set_01')]);
      tick('table'); tick('teaset');
      if (tableM) { // (a context loss here is handled inside add(), which waits for the restore)
        prepModel(tableM, G, { rough: 0.5 });
        tableM.traverse((o) => { // the scan's lacquer reads too red in daylight: take some saturation out
          if (!o.isMesh) return;
          o.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, 0.52) * 1.12;'); };
          o.material.customProgramCacheKey = () => 'desat52';
          o.material.roughness = Math.min(1, (o.material.roughness ?? 0.5) + 0.12);
        });
        await add(tableM, G, rig);
        G.shadowDirty = true;
        // the same table in the dining room, with the steamer on it
        const tI = tableM.clone();
        tI.position.copy(TT_I); tI.rotation.y = Math.atan2(-TT_I.x, -TT_I.z) + 0.2;
        tI.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        await add(tI, I, propsI);
        steamer.visible = catcherI.visible = shI.visible = shTI.visible = true; I.shadowDirty = true;
      }
      if (set) {
        prepModel(set, G, { rough: 0.22 });
        const byName = {}; set.traverse((o) => { if (o.isMesh) byName[o.name] = o; });
        const take = (n) => { const o = byName[n] || set.getObjectByName(n); if (o) { o.parent && o.parent.remove(o); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); } return o; };
        const group = new THREE.Group();
        const pot = take('tea_set_01_teapot_01'), plid = take('tea_set_01_teapot_01_lid');
        if (pot) { potGroup.add(pot); ext.pot = pot; }
        if (plid) { plid.position.y = 0.002; potGroup.add(plid); }
        const place = (n, v, ry = 0) => { const o = take(n); if (o) { o.position.copy(v); o.rotation.y = ry; group.add(o); } return o; };
        place('tea_set_01_saucer_circular_03', CUP);
        ext.cup = place('tea_set_01_cup_small_01', V3(CUP.x, CUP.y + 0.0065, CUP.z), 2.4);
        place('tea_set_01_saucer_circular_04', CUP2);
        place('tea_set_01_cup_small_02', V3(CUP2.x, CUP2.y + 0.0065, CUP2.z), 0.6);
        if (pot) pot.position.z = -PZ; // pivot on the front edge of the foot
        if (plid) plid.position.z = -PZ;
        await upload(potGroup); await compile(potGroup, G);
        await add(group, G, rig);
        G.shadowDirty = true;
        // a cup beside the steamer in the dining room (copies of the same scanned porcelain)
        const gi = new THREE.Group();
        const sc = group.children.find((o) => o.name === 'tea_set_01_saucer_circular_03');
        if (sc && ext.cup) {
          const s2 = sc.clone(), c2 = ext.cup.clone();
          s2.position.copy(CUP_I); c2.position.set(CUP_I.x, CUP_I.y + 0.0065, CUP_I.z); c2.rotation.y = -0.6;
          gi.add(s2, c2);
          const cs = W.contactShadow(0.16, 0.16, 0.4); cs.position.set(CUP_I.x, TOP + 0.001, CUP_I.z); gi.add(cs);
          await add(gi, I, propsI); I.shadowDirty = true;
        }
      }
      // the dining room photograph and its light (the steamer is procedural and already built)
      await idle();
      for (let k = 0; k < 4; k++) { await alive(); if (await bringUp(I, 'I', 'envI')) break; }
      for (;;) { await alive(); await upload(I.scene); if (!lost) break; }
      wake();
    } catch (e) { /* a missing asset only leaves that object out */ }
    if (worker) { worker.terminate(); worker = null; }
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
      if (p) { pointer.copy(pointerCur); intro = 0; cur.t = tgt.t; for (let i = 0; i < N; i++) cur.u[i] = tgt.u[i]; }
      wake();
    },
    dispose() {
      detach();
      [G, I].forEach((wd) => { W.disposeTree(wd.scene); wd.glt && gl.deleteTexture(wd.glt); wd.tex && wd.tex.dispose(); wd.env && wd.env.dispose(); });
      rtA && rtA.dispose(); rtB && rtB.dispose(); rtP && rtP.dispose(); finalMat.dispose(); renderer.dispose();
    },
  };
}
