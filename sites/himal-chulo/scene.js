// Himal Chulo - the 3D scene. One grounded room at dusk: a courtyard under prayer flags, a doorway with
// marigold garlands, a clay hearth with brass pots, a table with a thali-style spread and a momo steamer,
// a tea pour, and a diya lantern in the window against blue mountains.
// Real CC0 assets from Poly Haven (models, HDRI, PBR textures); food and cloth are built in code.
import * as THREE from 'three';

let GLTFLoader, RGBELoader, mergeVertices, RoundedBoxGeometry;
let EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, FXAAShader;
async function imp(path) { // one retry: a busy dev server can refuse a request
  try { return await import(path); }
  catch (e) { await new Promise((r) => setTimeout(r, 400)); return import(path + '?r=1'); }
}

const A = '../../assets/polyhaven';
const { Vector2, Vector3, Color } = THREE;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rnd = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ camera path */
// Knots: p = camera position, t = look target, fov, sx = sideways frame shift on wide screens (text panel side),
// sy = vertical frame shift on portrait screens (text panel at the bottom). Stations sit on STATION_KNOT.
const KNOTS = [
  { p: [1.7, 1.5, 8.4], t: [-0.25, 2.05, 0], fov: 36, sx: 0.17, sy: -0.1, ex: 1.15 }, // 0 arrival
  { p: [0.35, 1.58, 2.6], t: [0.0, 1.45, -2], fov: 38, sx: 0.06, sy: 0.05, ex: 1.0 },
  { p: [0.0, 1.6, -0.25], t: [-1.7, 1.1, -2.3], fov: 38, sx: 0.08, sy: 0.12, ex: 1.05 },
  { p: [-0.55, 1.32, -1.15], t: [-2.95, 0.82, -2.7], fov: 38, sx: 0.15, sy: 0.24, ex: 1.05 }, // 3 kitchen
  { p: [1.5, 1.32, -3.3], t: [0.55, 0.8, -4.32], fov: 32, sx: -0.15, sy: 0.24, ex: 1.05 }, // 4 table
  { p: [1.82, 1.1, -3.9], t: [1.06, 0.9, -4.5], fov: 32, sx: 0.15, sy: 0.24, ex: 1.05 }, // 5 tea
  { p: [0.66, 2.3, -3.72], t: [0.6, 0.78, -4.42], fov: 38, sx: -0.2, sy: 0.0, ex: 1.0 }, // 6 menu overhead
  { p: [0.62, 1.36, -5.5], t: [0.02, 1.4, -7.2], fov: 31, sx: -0.15, sy: 0.24, ex: 1.0 }, // 7 reserve window
];
const STATION_KNOT = [0, 3, 4, 5, 6, 7];

/* ------------------------------------------------------------------ small helpers */
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// cheap value noise for canvas art (lattice precomputed, no closures per call)
const NL = new Float32Array(256 * 256);
for (let i = 0; i < NL.length; i++) NL[i] = rnd();
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = NL[((yi & 255) << 8) | (xi & 255)], b = NL[((yi & 255) << 8) | ((xi + 1) & 255)];
  const c = NL[(((yi + 1) & 255) << 8) | (xi & 255)], d = NL[(((yi + 1) & 255) << 8) | ((xi + 1) & 255)];
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// normal map from a tileable height function, written into a small canvas
function normalTex(size, height, strength) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = height(x, y);
  return canvasTex(size, size, (g) => {
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
      const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
      let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, false);
}
const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), seg);
function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }
// box with UVs in world units (k metres per texture tile); grain = axis the wood grain runs along
function box(w, h, d, k = 1.2, grain = 'x') {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const swap = grain === 'y' ? [1, 1, 0, 0, 1, 1] : grain === 'z' ? [0, 0, 1, 1, 0, 0] : [0, 0, 0, 0, 0, 0];
  for (let f = 0; f < 6; f++) for (let j = 0; j < 4; j++) {
    const i = f * 4 + j;
    let u = (uv.getX(i) * dims[f][0]) / k, v = (uv.getY(i) * dims[f][1]) / k;
    if (swap[f]) { const s = u; u = v; v = s; }
    uv.setXY(i, u, v);
  }
  return g;
}
function catenary(a, b, sag, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(new Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t) - sag * 4 * t * (1 - t), lerp(a.z, b.z, t)));
  }
  return out;
}

/* ------------------------------------------------------------------ shaders */
const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = /* glsl */`
varying vec3 vDir;
float n1(float a) { return sin(a * 3.0) * 0.5 + sin(a * 7.0 + 1.7) * 0.25 + sin(a * 13.0 + 0.3) * 0.125 + sin(a * 29.0 + 2.1) * 0.0625 + sin(a * 61.0 + 4.0) * 0.03; }
float ridge(float a) { return 1.0 - abs(n1(a)); }
float crag(float a) { return sin(a * 97.0) * 0.5 + sin(a * 151.0 + 1.3) * 0.3 + sin(a * 233.0 + 0.7) * 0.2; }
float hFar(float az) { float r = ridge(az + 0.6); return 0.026 + 0.07 * pow(r, 3.0) + 0.014 * pow(ridge(az * 3.0 + 2.0), 2.0) + 0.006 * abs(crag(az)) + 0.003 * abs(crag(az * 2.3 + 1.0)); }
float hNear(float az) { return 0.008 + 0.026 * pow(ridge(az * 2.0 + 5.0), 1.7) + 0.006 * ridge(az * 5.0 + 1.0) + 0.0015 * crag(az * 1.7); }
void main() {
  vec3 d = normalize(vDir);
  float e = d.y;
  float az = atan(d.z, d.x);
  vec2 sun = normalize(vec2(-0.35, -1.0));
  float sunA = max(dot(normalize(d.xz + 1e-5), sun), 0.0);
  vec3 zen = vec3(0.010, 0.018, 0.052);
  vec3 mid = vec3(0.040, 0.075, 0.185);
  vec3 hor = vec3(0.21, 0.19, 0.27);
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.2, e));
  col = mix(col, zen, smoothstep(0.18, 0.8, e));
  col += vec3(0.95, 0.42, 0.15) * pow(sunA, 5.0) * exp(-max(e, 0.0) * 8.0) * 0.85;
  // a few stars high up
  vec3 sp = d * 260.0; vec3 cell = floor(sp);
  float r = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  if (r > 0.9965) { float s = smoothstep(0.42, 0.0, length(fract(sp) - 0.5)); col += vec3(0.85, 0.9, 1.0) * s * 0.5 * smoothstep(0.2, 0.55, e); }
  float aa = fwidth(e) * 1.5 + 1e-5;
  // far range with snow and alpenglow
  float hf = hFar(az);
  float mf = smoothstep(aa, -aa, e - hf);
  float slope = (hFar(az + 0.003) - hFar(az - 0.003)) / 0.006;
  float lit = clamp(0.5 + 0.5 * (slope * 1.2 * sin(az - atan(sun.y, sun.x))) / (1.0 + abs(slope * 1.2 * sin(az - atan(sun.y, sun.x)))), 0.0, 1.0);
  float snowLine = max(0.05, hf - (0.01 + 0.016 * ridge(az * 4.0 + 3.0) + 0.004 * crag(az * 0.7)));
  float snow = smoothstep(snowLine - 0.004, snowLine + 0.004, e);
  vec3 rock = vec3(0.06, 0.08, 0.14);
  vec3 snowCol = mix(vec3(0.3, 0.35, 0.52), mix(vec3(0.66, 0.68, 0.82), vec3(0.95, 0.64, 0.56), pow(sunA, 1.5)), lit);
  vec3 farCol = mix(rock, snowCol * 1.25, snow * (0.75 + 0.25 * lit));
  farCol = mix(farCol, hor, 0.3);
  farCol = mix(farCol, hor * 1.05, (1.0 - smoothstep(0.0, hf, e)) * 0.45); // valley haze
  col = mix(col, farCol, mf);
  // near ridge, darker and closer
  float hn = hNear(az);
  float mn = smoothstep(aa, -aa, e - hn);
  col = mix(col, mix(vec3(0.012, 0.016, 0.03), hor * 0.3, 0.25), mn);
  col = mix(col, vec3(0.010, 0.010, 0.016), smoothstep(0.0, -0.02, e));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// cylindrical billboard: the column turns to face the camera around its vertical axis and fades out
// when seen from straight above (where a flat card would read as a white disc)
const STEAM_VERT = /* glsl */`
varying vec2 vUv; varying float vSide;
void main() {
  vUv = uv;
  vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec2 sc = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
  vec3 toCam = cameraPosition - c;
  vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + 1e-5);
  vSide = 1.0 - smoothstep(0.55, 0.92, abs(normalize(toCam).y));
  vec3 w = c + right * position.x * sc.x + vec3(0.0, position.y * sc.y, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const STEAM_FRAG = /* glsl */`
uniform float uTime; uniform float uAmount; uniform float uSeed; uniform vec3 uColor;
varying vec2 vUv; varying float vSide;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
void main() {
  float t = uTime * 0.55 + uSeed * 10.0;
  vec2 uv = vUv;
  float sway = (fbm(vec2(uv.y * 2.0 - t * 0.4, uSeed * 3.0)) - 0.5) * 0.5 * uv.y;
  float x = uv.x - 0.5 - sway;
  float w = 0.08 + 0.32 * uv.y;
  float body = smoothstep(w, w * 0.15, abs(x));
  float n = fbm(vec2(x * 5.0 + uSeed, uv.y * 3.2 - t));
  float n2 = fbm(vec2(x * 11.0 - uSeed, uv.y * 6.0 - t * 1.6));
  float wisps = smoothstep(0.38, 0.85, n * 0.7 + n2 * 0.45);
  float fade = smoothstep(0.0, 0.3, uv.y) * smoothstep(1.0, 0.45, uv.y);
  float a = body * wisps * fade * uAmount * 0.32 * vSide;
  gl_FragColor = vec4(uColor, a);
}`;

const FIRE_FRAG = /* glsl */`
uniform float uTime; varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.1 + 3.7; a *= 0.5; } return v; }
void main() {
  vec2 uv = vUv;
  float n = fbm(vec2(uv.x * 4.0, uv.y * 2.5 - uTime * 1.7));
  float shape = (1.0 - uv.y) * 1.25 - abs(uv.x - 0.5) * 1.6 + (n - 0.5) * 0.9;
  float f = smoothstep(0.05, 0.75, shape) * smoothstep(0.5, 0.36, abs(uv.x - 0.5));
  vec3 col = mix(vec3(0.6, 0.08, 0.0), vec3(1.0, 0.45, 0.08), f);
  col = mix(col, vec3(1.0, 0.85, 0.5), smoothstep(0.65, 1.0, f));
  float ember = smoothstep(0.82, 1.0, uv.y < 0.25 ? fbm(uv * 18.0 + uTime * 0.2) + 0.25 : 0.0);
  gl_FragColor = vec4(col * (f * 3.2 + ember * 2.0), 1.0);
}`;

const FINISH = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      float v = smoothstep(0.9, 0.28, length(q * vec2(1.0, 0.92)));
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, 0.86);
      c.rgb = c.rgb * 0.97 + 0.012;
      c.rgb *= mix(0.74, 1.0, v);
      c.rgb += (hash(floor(vUv * uRes) + fract(uTime) * 91.7) - 0.5) * 0.022;
      gl_FragColor = c;
    }`,
};

/* ------------------------------------------------------------------ main entry */
export async function initScene(opts) {
  const canvas = opts.canvas;
  const reduce = !!opts.reduce;
  const progress = opts.onProgress || (() => {});
  const small = Math.min(window.innerWidth, window.innerHeight) <= 640 || window.innerWidth <= 760;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const lowCpu = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const tier = small || coarse ? 0 : lowCpu ? 1 : 2; // 0 phone, 1 modest laptop, 2 desktop
  let pr = Math.min(window.devicePixelRatio || 1, tier === 2 ? 1.5 : tier === 1 ? 1.25 : 1.0);

  ({ GLTFLoader } = await imp('three/addons/loaders/GLTFLoader.js'));
  ({ mergeVertices } = await imp('three/addons/utils/BufferGeometryUtils.js'));
  ({ RoundedBoxGeometry } = await imp('three/addons/geometries/RoundedBoxGeometry.js'));
  if (tier >= 1) ({ RGBELoader } = await imp('three/addons/loaders/RGBELoader.js'));
  if (tier === 2) {
    ({ EffectComposer } = await imp('three/addons/postprocessing/EffectComposer.js'));
    ({ RenderPass } = await imp('three/addons/postprocessing/RenderPass.js'));
    ({ UnrealBloomPass } = await imp('three/addons/postprocessing/UnrealBloomPass.js'));
    ({ OutputPass } = await imp('three/addons/postprocessing/OutputPass.js'));
    ({ ShaderPass } = await imp('three/addons/postprocessing/ShaderPass.js'));
    ({ FXAAShader } = await imp('three/addons/shaders/FXAAShader.js'));
  }
  progress(0.1);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier < 2, powerPreference: 'high-performance', alpha: false });
  renderer.setClearColor(0x0a0a10, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = tier >= 1;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(pr);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new Color(0.03, 0.032, 0.048), 0.022);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 520);

  /* ---------- shared uniforms and materials */
  const U = { time: { value: 0 }, back: { value: 0.22 } };
  const allMats = new Set();
  const track = (m, env = 0.6) => { m.envMapIntensity = env; allMats.add(m); return m; };
  const steams = [];
  const later = []; // hidden until their programs are compiled (keeps the first frame fast)
  let detailReady = false;

  /* ---------- textures */
  // JPEGs are decoded off the main thread (ImageBitmap) where the browser can; upload happens later, one at a time
  const useBitmap = typeof createImageBitmap !== 'undefined' && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const texLoader = useBitmap ? new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY' }) : new THREE.TextureLoader();
  const loadTex = (url, srgb) => new Promise((res) => {
    texLoader.load(url, (img) => {
      const t = useBitmap ? new THREE.Texture(img) : img;
      if (useBitmap) { t.flipY = false; t.needsUpdate = true; }
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = maxAniso;
      res(t);
    }, undefined, () => res(null));
  });
  const T = `${A}/textures`;
  const wantArm = tier === 2;
  const wantNor = tier >= 1;
  const [clayD, clayN, clayA, woodD, woodN, woodA] = await Promise.all([
    loadTex(`${T}/clay_plaster/clay_plaster_diff_1k.jpg`, true),
    wantNor ? loadTex(`${T}/clay_plaster/clay_plaster_nor_1k.jpg`, false) : null,
    null, // plaster roughness is near constant: its ARM map is skipped to stay inside the byte budget
    loadTex(`${T}/wood_table_worn/wood_table_worn_diff_1k.jpg`, true),
    wantNor ? loadTex(`${T}/wood_table_worn/wood_table_worn_nor_1k.jpg`, false) : null,
    wantArm ? loadTex(`${T}/wood_table_worn/wood_table_worn_arm_1k.jpg`, false) : null,
  ]);
  progress(0.3);

  const plaster = (color, env = 0.25, rough = 0.95) => track(new THREE.MeshStandardMaterial({
    color, map: clayD, normalMap: clayN, normalScale: new Vector2(0.9, 0.9),
    roughness: clayA ? 1 : rough, roughnessMap: clayA, aoMap: clayA, aoMapIntensity: 0.8,
  }), env);
  const wood = (color = 0xffffff, env = 0.5) => track(new THREE.MeshStandardMaterial({
    color, map: woodD, normalMap: woodN, roughness: woodA ? 1 : 0.62, roughnessMap: woodA, aoMap: woodA,
  }), env);

  const matFacade = plaster(new Color(1.25, 0.62, 0.45), 0.14);
  const matPlinth = plaster(new Color(0.45, 0.33, 0.28), 0.12);
  const matWallIn = plaster(new Color(1.6, 1.58, 1.52), 0.35);
  const matDado = plaster(new Color(1.05, 0.46, 0.34), 0.35);
  const matCeil = plaster(new Color(0.8, 0.76, 0.72), 0.3);
  const matFloor = plaster(new Color(0.72, 0.58, 0.47), 0.4, 0.9);
  const matGround = plaster(new Color(0.62, 0.58, 0.58), 0.08);
  const matWood = wood(new Color(0.85, 0.8, 0.76), 0.45);
  const matWoodDark = wood(new Color(0.5, 0.44, 0.4), 0.4);
  const matTable = wood(new Color(0.95, 0.9, 0.85), 0.55);

  /* ---------- sky with Himalayan ridges */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    extensions: { derivatives: true },
  }));
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  /* ---------- the building: facade, doorway, room */
  const root = new THREE.Group();
  scene.add(root);
  const add = (geo, mat, x = 0, y = 0, z = 0, opt = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (opt.ry) m.rotation.y = opt.ry;
    if (opt.rx) m.rotation.x = opt.rx;
    m.castShadow = !!opt.cast && tier >= 1;
    m.receiveShadow = opt.recv !== false && tier >= 1;
    (opt.parent || root).add(m);
    return m;
  };
  const K_CLAY = 1.7, K_WOOD = 1.1;
  // front wall with a door and two latticed windows
  const FW = 3.95, FH = 3.4, DW = 0.62, DH = 2.15;
  const wallShape = (holes) => {
    const s = new THREE.Shape();
    s.moveTo(-FW, 0); s.lineTo(FW, 0); s.lineTo(FW, FH); s.lineTo(-FW, FH); s.lineTo(-FW, 0);
    holes.forEach(([x0, y0, x1, y1]) => { const h = new THREE.Path(); h.moveTo(x0, y0); h.lineTo(x0, y1); h.lineTo(x1, y1); h.lineTo(x1, y0); h.lineTo(x0, y0); s.holes.push(h); });
    return s;
  };
  const frontHoles = [[-DW, 0, DW, DH], [-2.85, 1.1, -2.05, 1.95], [2.05, 1.1, 2.85, 1.95]];
  const wallGeo = new THREE.ExtrudeGeometry(wallShape(frontHoles), { depth: 0.36, bevelEnabled: false });
  scaleUV(wallGeo, 1 / K_CLAY, 1 / K_CLAY);
  add(wallGeo, matWallIn, 0, 0, -0.18, { cast: true });
  const skinGeo = new THREE.ShapeGeometry(wallShape(frontHoles));
  scaleUV(skinGeo, 1 / K_CLAY, 1 / K_CLAY);
  add(skinGeo, matFacade, 0, 0, 0.183);
  add(box(FW * 2 + 0.06, 0.62, 0.06, K_CLAY), matPlinth, 0, 0.31, 0.2);
  // door frame: dark carved timber, lintel running past the jambs as in hill-house doorways
  add(box(0.16, 2.36, 0.46, K_WOOD, 'y'), matWood, -DW - 0.08, 1.18, 0.0, { cast: true });
  add(box(0.16, 2.36, 0.46, K_WOOD, 'y'), matWood, DW + 0.08, 1.18, 0.0, { cast: true });
  add(box(2.1, 0.2, 0.5, K_WOOD), matWood, 0, 2.27, 0.0, { cast: true });
  add(box(1.7, 0.07, 0.56, K_WOOD), matWoodDark, 0, 2.41, 0.0);
  add(box(1.5, 0.06, 0.62, K_WOOD), matWoodDark, 0, 0.03, 0.02);
  // door leaves, opened inwards
  const leafG = box(0.6, 2.1, 0.05, K_WOOD, 'y');
  add(leafG.clone().translate(0.3, 0, 0), matWoodDark, -DW + 0.02, 1.06, -0.21, { cast: true, ry: 1.35 });
  add(leafG.clone().translate(-0.3, 0, 0), matWoodDark, DW - 0.02, 1.06, -0.21, { cast: true, ry: -1.35 });
  // windows: carved lattice in front of a warm glow
  const lattice = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 7;
    for (let i = -8; i <= 16; i++) {
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + h, h); g.stroke();
      g.beginPath(); g.moveTo(i * 32, h); g.lineTo(i * 32 + h, 0); g.stroke();
    }
    g.lineWidth = 16; g.strokeRect(0, 0, w, h);
  });
  const latticeMat = track(new THREE.MeshStandardMaterial({ color: 0x3a2418, alphaMap: lattice, alphaTest: 0.5, roughness: 0.7, side: THREE.DoubleSide, map: woodD }), 0.3);
  const glowMat = new THREE.MeshBasicMaterial({ color: new Color(1.0, 0.55, 0.22).multiplyScalar(1.6), fog: false });
  [-2.45, 2.45].forEach((x) => {
    add(new THREE.PlaneGeometry(0.8, 0.85), latticeMat, x, 1.525, 0.1);
    add(new THREE.PlaneGeometry(0.8, 0.85), glowMat, x, 1.525, -0.1, { recv: false });
    add(box(1.0, 0.1, 0.42, K_WOOD), matWood, x, 1.06, 0.03);
    add(box(1.0, 0.12, 0.42, K_WOOD), matWood, x, 2.0, 0.03);
    add(box(0.08, 0.85, 0.4, K_WOOD, 'y'), matWood, x - 0.44, 1.525, 0.03);
    add(box(0.08, 0.85, 0.4, K_WOOD, 'y'), matWood, x + 0.44, 1.525, 0.03);
  });
  // eave with rafter ends
  add(box(FW * 2 + 0.6, 0.14, 0.95, K_WOOD), matWoodDark, 0, FH + 0.07, 0.28, { cast: true });
  {
    const n = 23, g = box(0.08, 0.09, 0.42, K_WOOD, 'z');
    const raf = new THREE.InstancedMesh(g, matWoodDark, n);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m4.makeTranslation(-FW + 0.1 + i * ((FW * 2 - 0.2) / (n - 1)), FH - 0.04, 0.42); raf.setMatrixAt(i, m4); }
    root.add(raf);
  }
  // ground outside (packed earth), floor inside (mud-plastered, as in many hill homes)
  const groundG = new THREE.PlaneGeometry(60, 40); scaleUV(groundG, 60 / 2.2, 40 / 2.2);
  add(groundG, matGround, 0, -0.002, 6, { rx: -Math.PI / 2 });
  const RW = 3.6, RD = 7.04, RH = 3.0; // room half-width, depth to the back wall face, height
  const floorG = new THREE.PlaneGeometry(RW * 2, RD - 0.18); scaleUV(floorG, (RW * 2) / 1.5, (RD - 0.18) / 1.5);
  add(floorG, matFloor, 0, 0.001, -(RD + 0.18) / 2, { rx: -Math.PI / 2 });
  // side walls, ceiling, back wall with a window
  const sideG = new THREE.PlaneGeometry(RD, RH); scaleUV(sideG, RD / K_CLAY, RH / K_CLAY);
  add(sideG, matWallIn, -RW, RH / 2, -RD / 2, { ry: Math.PI / 2 });
  add(sideG.clone(), matWallIn, RW, RH / 2, -RD / 2, { ry: -Math.PI / 2 });
  const ceilG = new THREE.PlaneGeometry(RW * 2, RD); scaleUV(ceilG, (RW * 2) / K_CLAY, RD / K_CLAY);
  add(ceilG, matCeil, 0, RH, -RD / 2, { rx: Math.PI / 2 });
  {
    const n = 11, g = box(0.14, 0.16, RD, K_WOOD, 'z');
    const beams = new THREE.InstancedMesh(g, matWoodDark, n);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m4.makeTranslation(-RW + 0.3 + i * ((RW * 2 - 0.6) / (n - 1)), RH - 0.08, -RD / 2); beams.setMatrixAt(i, m4); }
    beams.receiveShadow = tier >= 1;
    root.add(beams);
  }
  // red-ochre dado: the lower walls of many hill homes are finished in red clay
  {
    const DH2 = 0.92;
    const dg = (len) => scaleUV(new THREE.PlaneGeometry(len, DH2), len / K_CLAY, DH2 / K_CLAY);
    add(dg(RD), matDado, -RW + 0.004, DH2 / 2, -RD / 2, { ry: Math.PI / 2 });
    add(dg(RD), matDado, RW - 0.004, DH2 / 2, -RD / 2, { ry: -Math.PI / 2 });
    add(dg(RW * 2), matDado, 0, DH2 / 2, -RD + 0.004);
    const side = RW - DW - 0.16;
    add(dg(side), matDado, -DW - 0.16 - side / 2, DH2 / 2, -0.184, { ry: Math.PI });
    add(dg(side), matDado, DW + 0.16 + side / 2, DH2 / 2, -0.184, { ry: Math.PI });
  }
  const WX = 0.72, WY0 = 0.95, WY1 = 2.15;
  const backShape = new THREE.Shape();
  backShape.moveTo(-RW - 0.2, 0); backShape.lineTo(RW + 0.2, 0); backShape.lineTo(RW + 0.2, RH + 0.4); backShape.lineTo(-RW - 0.2, RH + 0.4); backShape.lineTo(-RW - 0.2, 0);
  { const h = new THREE.Path(); h.moveTo(-WX, WY0); h.lineTo(-WX, WY1); h.lineTo(WX, WY1); h.lineTo(WX, WY0); h.lineTo(-WX, WY0); backShape.holes.push(h); }
  const backG = new THREE.ExtrudeGeometry(backShape, { depth: 0.34, bevelEnabled: false });
  scaleUV(backG, 1 / K_CLAY, 1 / K_CLAY);
  add(backG, matWallIn, 0, 0, -RD - 0.34);
  // window frame and sill
  add(box(WX * 2 + 0.24, 0.09, 0.46, K_WOOD), matWood, 0, WY0 - 0.02, -RD - 0.1);
  add(box(WX * 2 + 0.24, 0.12, 0.42, K_WOOD), matWood, 0, WY1 + 0.06, -RD - 0.14);
  add(box(0.1, WY1 - WY0, 0.4, K_WOOD, 'y'), matWood, -WX - 0.05, (WY0 + WY1) / 2, -RD - 0.14);
  add(box(0.1, WY1 - WY0, 0.4, K_WOOD, 'y'), matWood, WX + 0.05, (WY0 + WY1) / 2, -RD - 0.14);
  add(box(0.05, WY1 - WY0, 0.06, K_WOOD, 'y'), matWood, 0, (WY0 + WY1) / 2, -RD - 0.3);

  // warm light spilling from the doorway onto the packed earth (a soft additive pool; the interior lights
  // cannot reach this far with physical falloff)
  {
    const spill = canvasTex(64, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, 0, 2, w / 2, 0, h);
      gr.addColorStop(0, 'rgba(255,170,90,0.9)'); gr.addColorStop(0.45, 'rgba(255,140,60,0.25)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const m = add(new THREE.PlaneGeometry(2.2, 3.2), new THREE.MeshBasicMaterial({ map: spill, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.004, 1.78, { rx: -Math.PI / 2, recv: false });
    m.renderOrder = 1;
  }

  /* ---------- prayer flags: printed cotton, instanced, with a wind shader */
  const flagPrint = canvasTex(128, 160, (g, w, h) => {
    g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.28; g.strokeStyle = '#26221e'; g.fillStyle = '#26221e';
    g.lineWidth = 3; g.strokeRect(20, 22, w - 40, h - 52);
    g.beginPath(); g.arc(w / 2, 62, 18, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2;
    for (let r = 0; r < 6; r++) { let x = 28; const y = 94 + r * 8; while (x < w - 30) { const l = 3 + rnd() * 9; g.fillRect(x, y, l, 2); x += l + 2 + rnd() * 3; } }
    g.globalAlpha = 1;
    // faded, weathered cloth
    const img = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, n = vnoise(x * 0.08, y * 0.08) * 0.6 + vnoise(x * 0.5, y * 0.03) * 0.4;
      const k = 0.9 + n * 0.12;
      img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
      // frayed bottom edge
      if (y > h - 12 && vnoise(x * 0.6, 3.3) * 12 > h - y) img.data[i + 3] = 0;
    }
    g.putImageData(img, 0, 0);
  });
  const weave = normalTex(64, (x, y) => (Math.sin(x * Math.PI / 2) * 0.5 + Math.sin(y * Math.PI / 2) * 0.5) * 0.5 + vnoise(x * 0.3, y * 0.3) * 0.3, 2.2);
  weave.repeat.set(5, 6);
  const flagMat = new THREE.MeshStandardMaterial({ map: flagPrint, normalMap: weave, normalScale: new Vector2(0.5, 0.5), roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5 });
  track(flagMat, 0.15);
  flagMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time; sh.uniforms.uBack = U.back;
    // wind: two travelling waves plus a quicker flutter at the free bottom edge, with a per-flag phase and
    // strength; the normal is bent with the analytic slope so the folds catch the light (cloth shading)
    sh.vertexShader = 'uniform float uTime;\nvarying float vFold;\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', `
      float hang = clamp(-position.y / 0.3, 0.0, 1.0);
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
      #else
        float ph = 0.0;
      #endif
      float amp = 0.035 + 0.035 * fract(sin(ph * 12.9898) * 43758.5453);
      float a1 = uTime * 2.3 + ph + position.x * 9.0, a2 = uTime * 3.6 + ph * 1.3 + position.x * 17.0;
      float a3 = uTime * 8.7 + ph * 2.1 + position.x * 31.0 + position.y * 23.0;
      float wv = sin(a1) * 0.6 + sin(a2) * 0.4;
      float fl = sin(a3) * 0.12 * hang;
      float dz = (wv + fl) * amp * hang;
      float dzdx = amp * hang * (cos(a1) * 5.4 + cos(a2) * 6.8 + cos(a3) * 31.0 * 0.12 * hang);
      float dzdy = -(wv * amp / 0.3) * step(position.y, 0.0) * step(-0.3, position.y) + amp * hang * cos(a3) * 23.0 * 0.12 * hang;
      vec3 objectNormal = normalize(vec3(-dzdx, -dzdy, 1.0));
      vFold = clamp(dzdx * 0.25, -1.0, 1.0);
      #ifdef USE_TANGENT
        vec3 objectTangent = vec3( tangent.xyz );
      #endif`).replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.z += dz;
      transformed.x += sin(uTime * 1.1 + ph) * 0.015 * hang;`);
    // light through thin cotton: the back glow is stronger where the cloth faces away, and the creases darken
    sh.fragmentShader = 'uniform float uBack;\nvarying float vFold;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      diffuseColor.rgb *= 1.0 - 0.18 * abs(vFold);
      totalEmissiveRadiance += diffuseColor.rgb * uBack * (0.7 + 0.6 * (1.0 - abs(vFold)));`);
  };
  const FLAG_COLS = [0x2f5ea8, 0xeeeae0, 0xb4312b, 0x2f7d4c, 0xe0b23a].map((c) => new Color(c));
  const flagGeo = new THREE.PlaneGeometry(0.24, 0.3, 10, 10).translate(0, -0.15, 0);
  const lines = [
    [new Vector3(-3.6, 3.42, 0.62), new Vector3(2.8, 3.25, 12.5), 0.85],
    [new Vector3(3.6, 3.42, 0.62), new Vector3(-2.4, 3.35, 12.5), 0.85],
    [new Vector3(-0.2, 3.47, 0.62), new Vector3(0.6, 3.9, 13.0), 0.7],
    [new Vector3(-3.7, 3.3, 0.62), new Vector3(-6.5, 2.6, 9.0), 0.5],
  ];
  const flagSpots = [];
  const stringMat = new THREE.MeshStandardMaterial({ color: 0x2a241e, roughness: 0.9 });
  lines.forEach(([a, b, sag]) => {
    const pts = catenary(a, b, sag, 60);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.0045, 4, false), stringMat));
    // walk the string and hang a flag every 0.31 m
    let acc = 0.15;
    for (let i = 1; i < pts.length; i++) {
      const seg = pts[i].distanceTo(pts[i - 1]);
      acc += seg;
      while (acc >= 0.31) {
        acc -= 0.31;
        const t = 1 - acc / seg;
        const p = pts[i - 1].clone().lerp(pts[i], t);
        const dir = pts[i].clone().sub(pts[i - 1]).normalize();
        flagSpots.push({ p, yaw: Math.atan2(-dir.z, dir.x), tilt: Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) });
      }
    }
  });
  const flags = new THREE.InstancedMesh(flagGeo, flagMat, flagSpots.length);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new Vector3(1, 1, 1);
    flagSpots.forEach((f, i) => {
      e.set(0, f.yaw, 0, 'YXZ'); q.setFromEuler(e);
      s.set(1, 0.92 + rnd() * 0.16, 1);
      m4.compose(f.p, q, s); flags.setMatrixAt(i, m4);
      // sun-faded to different degrees (some flags are new, some have hung for a season)
      const c = FLAG_COLS[i % 5].clone().lerp(new Color(0.86, 0.83, 0.76), rnd() * rnd() * 0.45).multiplyScalar(0.82 + rnd() * 0.18);
      flags.setColorAt(i, c);
    });
  }
  flags.frustumCulled = false;
  root.add(flags);

  /* ---------- marigold garlands over the doorway */
  {
    // flower head: a sphere wrapped in a petal map (rows of ruffled, overlapping petals with dark creases,
    // as colour + normal map), its outline broken up by a low-frequency lump so no two heads read as balls
    const PS = 128, ROWS = 7, COLS = 11, ph = new Float32Array(PS * PS);
    for (let y = 0; y < PS; y++) for (let x = 0; x < PS; x++) {
      const v = (y / PS) * ROWS, j = Math.floor(v), t = v - j;
      const c = (x / PS) * COLS + j * 0.5 + vnoise(j * 3.1, x * 0.05) * 0.6;
      const cf = c - Math.floor(c);
      const ruff = vnoise(x * 0.6, y * 0.6) * 0.25;
      ph[y * PS + x] = Math.pow(Math.sin(Math.PI * cf), 0.6) * Math.pow(1 - t, 0.6) + ruff;
    }
    const petalN = normalTex(PS, (x, y) => ph[y * PS + x], 3.2);
    const petalC = canvasTex(PS, PS, (g2) => {
      const img = g2.createImageData(PS, PS);
      for (let i = 0; i < PS * PS; i++) {
        const k = clamp(0.35 + 0.75 * ph[i], 0, 1.1);
        img.data[i * 4] = Math.min(255, 255 * k); img.data[i * 4 + 1] = Math.min(255, 235 * k * k); img.data[i * 4 + 2] = Math.min(255, 200 * k * k * k); img.data[i * 4 + 3] = 255;
      }
      g2.putImageData(img, 0, 0);
    });
    petalN.repeat.set(1, 1); petalC.repeat.set(1, 1);
    const g = new THREE.SphereGeometry(1, 14, 10);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const v = new Vector3().fromBufferAttribute(p, i);
      const n = vnoise(v.x * 2.2 + 10, v.y * 2.2 + v.z * 1.7 + 10) * 0.7 + vnoise(v.x * 5 + 3, v.z * 5 - v.y * 3 + 7) * 0.3;
      const r = 0.84 + 0.24 * n;
      v.multiplyScalar(r); v.y *= 0.8;
      p.setXYZ(i, v.x, v.y, v.z);
      const shade = 0.6 + 0.4 * clamp((r - 0.84) / 0.24, 0, 1);
      col[i * 3] = shade; col[i * 3 + 1] = shade * 0.94; col[i * 3 + 2] = shade * 0.88;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mat = track(new THREE.MeshStandardMaterial({ vertexColors: true, map: petalC, normalMap: petalN, normalScale: new Vector2(1.1, 1.1), roughness: 0.72 }), 0.25);
    const strands = [];
    // three swags along the lintel and two hanging strands at the jambs
    const y0 = 2.5, zf = 0.3;
    for (let k = 0; k < 3; k++) strands.push(catenary(new Vector3(-0.95 + k * 0.633, y0, zf), new Vector3(-0.95 + (k + 1) * 0.633, y0, zf), 0.16, 18));
    strands.push(catenary(new Vector3(-0.95, y0, zf), new Vector3(-0.9, 1.45, zf + 0.02), 0.0, 24));
    strands.push(catenary(new Vector3(0.95, y0, zf), new Vector3(0.9, 1.45, zf + 0.02), 0.0, 24));
    // and a long swag under the eave
    strands.push(catenary(new Vector3(-2.9, 3.18, 0.6), new Vector3(2.9, 3.18, 0.6), 0.32, 70));
    const spots = [];
    strands.forEach((pts) => {
      let acc = 0;
      for (let i = 1; i < pts.length; i++) {
        const seg = pts[i].distanceTo(pts[i - 1]); acc += seg;
        while (acc >= 0.036) { acc -= 0.036; spots.push(pts[i - 1].clone().lerp(pts[i], 1 - acc / seg)); }
      }
    });
    const per = tier === 0 ? 1 : 2;
    const mm = new THREE.InstancedMesh(g, mat, spots.length * per);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new Vector3();
    const cA = new Color(0xe5780c), cB = new Color(0xf3a915), cC = new Color(0xd85f0a);
    let n = 0;
    spots.forEach((pt, i) => {
      for (let j = 0; j < per; j++) {
        const off = new Vector3((rnd() - 0.5) * 0.012, (rnd() - 0.5) * 0.012, j ? 0.014 : -0.006);
        e.set(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3); q.setFromEuler(e);
        const sc = 0.019 + rnd() * 0.008; s.set(sc, sc * (0.85 + rnd() * 0.2), sc);
        m4.compose(pt.clone().add(off), q, s); mm.setMatrixAt(n, m4);
        const band = Math.floor(i / 9) % 3;
        mm.setColorAt(n, (band === 0 ? cA : band === 1 ? cB : cC).clone().lerp(rnd() < 0.5 ? cB : cC, rnd() * 0.35).multiplyScalar(0.82 + rnd() * 0.22));
        n++;
      }
    });
    mm.castShadow = false;
    root.add(mm);
  }

  /* ---------- lights */
  const hemi = new THREE.HemisphereLight(0x6a7cab, 0x1a120c, 0.5);
  scene.add(hemi);
  const dusk = new THREE.DirectionalLight(0x9fb4e0, 2.4);
  dusk.position.set(6, 9, 14);
  scene.add(dusk);
  const pend = new THREE.SpotLight(0xffdcb4, 5, 0, 0.8, 0.9, 2);
  pend.position.set(0.55, 1.58, -4.4);
  pend.target.position.set(0.55, 0.78, -4.4);
  scene.add(pend, pend.target);
  if (tier >= 1) {
    pend.castShadow = true;
    // 1024 is still under 2 mm a texel on the table; the map is redrawn only when a caster moves (see draw())
    pend.shadow.mapSize.set(1024, 1024);
    pend.shadow.autoUpdate = false; pend.shadow.needsUpdate = true;
    pend.shadow.camera.near = 0.4; pend.shadow.camera.far = 3.5;
    pend.shadow.bias = -0.0004; pend.shadow.normalBias = 0.012; pend.shadow.radius = 4;
  }
  const fill = new THREE.PointLight(0xffd6b0, 5.5, 0, 2);
  fill.position.set(-0.6, 2.55, -2.6);
  scene.add(fill);
  const fireL = new THREE.PointLight(0xff7a30, 2.2, 0, 2);
  fireL.position.set(-2.05, 0.32, -2.42);
  scene.add(fireL);
  const doorL = new THREE.PointLight(0xffa04a, 2.4, 0, 2);
  doorL.position.set(1.02, 1.66, 0.5);
  scene.add(doorL);
  const winL = new THREE.PointLight(0xffa850, 1.8, 0, 2);
  winL.position.set(0.0, 1.38, -6.8);
  scene.add(winL);

  /* ---------- environment (HDRI on laptops/desktops, a small built room on phones) */
  const pmrem = new THREE.PMREMGenerator(renderer);
  let hdrTex = null, envRT = null;
  function buildEnv() {
    if (hdrTex) {
      envRT = pmrem.fromEquirectangular(hdrTex);
      // (hdrTex is NOT disposed here: tried, and with three r160 the brass then rendered with blown-out
      // reflections; the 1k HDR costs about 4 MB of VRAM and is kept for a context restore)
    }
    else {
      const s = new THREE.Scene();
      s.add(new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8), new THREE.MeshBasicMaterial({ color: 0x1c140f, side: THREE.BackSide })));
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), new THREE.MeshBasicMaterial({ color: new Color(6, 3.6, 1.8) }));
      lamp.position.set(0, 3.5, 1); s.add(lamp);
      const lamp2 = lamp.clone(); lamp2.position.set(-3, 1, -2); lamp2.scale.setScalar(0.6); s.add(lamp2);
      envRT = pmrem.fromScene(s, 0.04);
      s.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
    scene.environment = envRT.texture;
  }
  if (tier >= 1) {
    hdrTex = await new Promise((res) => new RGBELoader().load(`${A}/hdri/warm_restaurant_night/warm_restaurant_night_1k.hdr`, res, undefined, () => res(null)));
    if (hdrTex) hdrTex.mapping = THREE.EquirectangularReflectionMapping;
  }
  buildEnv();
  progress(0.5);

  /* ---------- model loading. Maps the framing does not show are removed from the glTF before parsing, so their
     images are never requested: phones drop normal and ARM maps (constant roughness/metalness instead), and each
     model can drop either map on every tier (opt.noNormal / opt.noArm, opt.rough / opt.metal for the constants). */
  const gltfLoader = new GLTFLoader();
  async function loadModel(id, opt = {}) {
    try {
      const base = `${A}/models/${id}/`;
      const res = await fetch(`${base}${id}_1k.gltf`);
      if (!res.ok) return null;
      const json = await res.json();
      json.materials.forEach((m) => {
        if (tier === 0 || opt.noNormal) delete m.normalTexture;
        if (tier === 0 || opt.noArm) {
          delete m.occlusionTexture;
          const pbr = m.pbrMetallicRoughness || (m.pbrMetallicRoughness = {});
          delete pbr.metallicRoughnessTexture;
          pbr.roughnessFactor = opt.rough ?? 0.5;
          pbr.metallicFactor = /glass|flame/.test(m.name) ? 0 : (opt.metal ?? 0);
        }
      });
      const gltf = await new Promise((ok, bad) => gltfLoader.parse(JSON.stringify(json), base, ok, bad));
      const obj = gltf.scene;
      obj.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = tier >= 1; o.receiveShadow = tier >= 1;
        const m = o.material;
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach((k) => { if (m[k]) m[k].anisotropy = maxAniso; });
        track(m, 0.75);
        if (/glass/.test(m.name)) { m.transparent = true; m.opacity = 0.32; m.roughness = 0.06; m.depthWrite = false; o.castShadow = false; }
        if (/flame/.test(m.name)) { m.emissiveIntensity = 5; m.depthWrite = false; o.castShadow = false; }
      });
      return obj;
    } catch (e) { return null; }
  }
  // upload textures one at a time (a yield between each), so no single task holds the main thread for long
  async function prepare(obj, skip) {
    const texs = new Set();
    const walk = (o) => {
      if (skip && skip.has(o)) return; // and not its children
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach((m) => ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'clearcoatNormalMap'].forEach((k) => { if (m[k]) texs.add(m[k]); }));
      o.children.forEach(walk);
    };
    walk(obj);
    for (const t of texs) { if (renderer.properties.get(t).__webglTexture === undefined) { renderer.initTexture(t); await tick(0); } }
  }

  /* ---------- brass, made to match the Poly Haven brass */
  const brassRough = canvasTex(128, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = vnoise(x * 0.05, y * 0.05) * 0.55 + vnoise(x * 0.2, y * 0.6) * 0.25 + vnoise(x * 0.9, y * 0.9) * 0.2;
      const v = 255 * (0.22 + n * 0.32), i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, false);
  const brass = track(new THREE.MeshStandardMaterial({ color: new Color(0.86, 0.62, 0.3), metalness: 1, roughness: 1, roughnessMap: brassRough }), 0.9);
  const brassIn = track(new THREE.MeshStandardMaterial({ color: new Color(0.7, 0.48, 0.22), metalness: 1, roughness: 1, roughnessMap: brassRough, side: THREE.DoubleSide }), 0.7);

  /* ---------- the table */
  const TX = 0.55, TZ = -4.4, TY = 0.78;
  add(box(1.75, 0.055, 0.96, K_WOOD), matTable, TX, TY - 0.0275, TZ, { cast: true });
  [[-0.8, -0.41], [0.8, -0.41], [-0.8, 0.41], [0.8, 0.41]].forEach(([dx, dz]) => add(box(0.07, TY - 0.055, 0.07, K_WOOD, 'y'), matTable, TX + dx, (TY - 0.055) / 2, TZ + dz, { cast: true }));
  add(box(1.55, 0.06, 0.04, K_WOOD), matTable, TX, TY - 0.1, TZ + 0.43);
  add(box(1.55, 0.06, 0.04, K_WOOD), matTable, TX, TY - 0.1, TZ - 0.43);
  // benches
  [[0.78], [-0.78]].forEach(([dz]) => {
    add(box(1.5, 0.05, 0.32, K_WOOD), matWood, TX, 0.45, TZ + dz, { cast: true });
    [-0.66, 0.66].forEach((dx) => add(box(0.06, 0.43, 0.26, K_WOOD, 'y'), matWood, TX + dx, 0.215, TZ + dz, { cast: true }));
  });
  // soft contact shadow under the table pieces the shadow map misses
  const blobTex = canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false });
  const blob = (x, z, r, y = TY, op = 1) => { const m = add(new THREE.PlaneGeometry(r * 2, r * 2), blobMat, x, y + 0.0015, z, { rx: -Math.PI / 2, recv: false }); m.material = blobMat.clone(); m.material.opacity = op; return m; };

  /* ---------- the thali: brass plate, katoris, rice, dal, greens, curry, pickle */
  const food = new THREE.Group();
  food.position.set(TX - 0.3, TY, TZ + 0.05);
  root.add(food); later.push(food);
  blob(TX - 0.3, TZ + 0.05, 0.22, TY, 0.8);
  const plate = new THREE.Mesh(lathe([[0, 0.002], [0.15, 0.002], [0.158, 0.005], [0.17, 0.019], [0.175, 0.024], [0.169, 0.024], [0.157, 0.01], [0.145, 0.008], [0, 0.008]], 96), brass);
  plate.castShadow = plate.receiveShadow = tier >= 1;
  food.add(plate);
  const katoriG = lathe([[0, 0], [0.028, 0], [0.04, 0.008], [0.046, 0.026], [0.047, 0.034], [0.044, 0.034], [0.043, 0.026], [0.037, 0.011], [0.026, 0.005], [0, 0.005]], 64);
  const ripple = normalTex(128, (x, y) => vnoise(x * 0.09, y * 0.09) * 0.6 + vnoise(x * 0.25, y * 0.25) * 0.4, 3.5);
  // sauces: polar-grid surfaces (a plain circle has no inner vertices to shape) with fine lumps, a darker
  // meniscus at the brass and a mottled colour; ghee or oil beads and a few garnish flakes break the gloss
  const dalMat = track(new THREE.MeshPhysicalMaterial({ vertexColors: true, color: new Color(0.8, 0.5, 0.12), roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.25, normalMap: ripple, normalScale: new Vector2(0.6, 0.6) }), 0.8);
  const saagMat = track(new THREE.MeshStandardMaterial({ vertexColors: true, color: new Color(0.17, 0.22, 0.07), roughness: 0.45, normalMap: ripple, normalScale: new Vector2(1.6, 1.6) }), 0.7);
  const curryMat = track(new THREE.MeshPhysicalMaterial({ vertexColors: true, color: new Color(0.55, 0.2, 0.06), roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.28, normalMap: ripple, normalScale: new Vector2(0.8, 0.8) }), 0.8);
  const acharMat = track(new THREE.MeshPhysicalMaterial({ vertexColors: true, color: new Color(0.6, 0.16, 0.04), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }), 0.8);
  const potatoMat = track(new THREE.MeshStandardMaterial({ color: new Color(0.85, 0.6, 0.22), roughness: 0.5 }), 0.6);
  const gheeMat = track(new THREE.MeshPhysicalMaterial({ color: new Color(0.95, 0.6, 0.1), roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 }), 1);
  const redOilMat = track(new THREE.MeshPhysicalMaterial({ color: new Color(0.72, 0.15, 0.02), roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 }), 1);
  const herbMat = track(new THREE.MeshStandardMaterial({ color: new Color(0.11, 0.26, 0.05), roughness: 0.55, side: THREE.DoubleSide }), 0.5);
  const katoris = [];
  const surfH = (x, z, r, h, f, seed) => { const d = Math.min(1, Math.hypot(x, z) / r); return h * (1 - d * d) * (0.7 + 0.6 * vnoise(x * f + seed, -z * f - seed)); };
  const mound = (r, h, mat, seed, f = 120) => { // a soft lumpy surface for thick dishes
    const g = new THREE.RingGeometry(0, r, 48, 12);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), d = Math.hypot(x, y) / r;
      p.setZ(i, surfH(x, -y, r, h, f, seed));
      const c = (1 - 0.3 * sstep(0.72, 1, d)) * (0.86 + 0.24 * vnoise(x * 260 + seed, y * 260));
      col[i * 3] = c; col[i * 3 + 1] = c * (0.97 + 0.03 * d); col[i * 3 + 2] = c;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; return m;
  };
  const beadG = new THREE.SphereGeometry(1, 8, 4), flakeG = new THREE.CircleGeometry(1, 5);
  function scatter(parent, geo, mat, n, r, y, sxz, sy, tilt, surf) {
    const im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let j = 0; j < n; j++) {
      const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * r, x = Math.cos(a) * rr, z = Math.sin(a) * rr, s = sxz * (0.5 + rnd());
      e.set(tilt ? -Math.PI / 2 + (rnd() - 0.5) * tilt : 0, rnd() * 6.28, 0, 'YXZ'); q.setFromEuler(e);
      m4.compose(new Vector3(x, y + (surf ? surf(x, z) : 0) + sy * 0.4, z), q, new Vector3(s, tilt ? s * (0.5 + rnd() * 0.5) : sy, tilt ? 1 : s));
      im.setMatrixAt(j, m4);
    }
    parent.add(im); return im;
  }
  [[0.098, -0.06, dalMat, 0.022, 0.003, 300], [0.035, -0.112, saagMat, 0.02, 0.008, 120], [-0.04, -0.112, curryMat, 0.021, 0.0045, 160], [-0.104, -0.062, acharMat, 0.018, 0.008, 120]].forEach(([x, z, mat, lvl, h, f], i) => {
    const k = new THREE.Group(); k.position.set(x, 0.008, z); food.add(k);
    const kb = new THREE.Mesh(katoriG, brass); kb.castShadow = kb.receiveShadow = tier >= 1; k.add(kb);
    const R = 0.0415, seed = i * 13;
    const surf = mound(R, h, mat, seed, f);
    surf.position.y = lvl; k.add(surf); katoris.push(k);
    const sAt = (sx, sz) => surfH(sx, sz, R, h, f, seed);
    if (mat === curryMat) { // potato pieces, red oil beads, coriander
      const pg = new RoundedBoxGeometry(0.014, 0.012, 0.013, 2, 0.004);
      const pc = new THREE.InstancedMesh(pg, potatoMat, 6); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion();
      for (let j = 0; j < 6; j++) { q.setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd())); m4.compose(new Vector3((rnd() - 0.5) * 0.05, lvl + 0.002, (rnd() - 0.5) * 0.05), q, new Vector3(1, 1, 1)); pc.setMatrixAt(j, m4); }
      k.add(pc);
      scatter(k, beadG, redOilMat, 16, 0.036, lvl, 0.0022, 0.00035, 0, sAt);
      scatter(k, flakeG, herbMat, 9, 0.03, lvl + 0.0006, 0.0026, 0, 0.5, sAt);
    }
    if (mat === dalMat) { // tempering specks (cumin, chilli, coriander), ghee beads
      const sg = new THREE.SphereGeometry(1, 6, 4);
      const sm = track(new THREE.MeshStandardMaterial({ roughness: 0.5 }), 0.4);
      const sp = new THREE.InstancedMesh(sg, sm, 26); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion();
      const cols = [new Color(0.18, 0.1, 0.04), new Color(0.5, 0.06, 0.02), new Color(0.12, 0.3, 0.06)];
      for (let j = 0; j < 26; j++) {
        const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * 0.034, sx = Math.cos(a) * rr, sz = Math.sin(a) * rr;
        q.setFromEuler(new THREE.Euler(0, rnd() * 6, 0));
        m4.compose(new Vector3(sx, lvl + sAt(sx, sz) + 0.0006, sz), q, new Vector3(0.0028, 0.0007, j % 3 === 2 ? 0.003 : 0.0012));
        sp.setMatrixAt(j, m4); sp.setColorAt(j, cols[j % 3]);
      }
      k.add(sp);
      scatter(k, beadG, gheeMat, 18, 0.036, lvl, 0.002, 0.0003, 0, sAt);
    }
  });
  // rice: a soft mound covered with real grains
  {
    // grains: slender (long-grain rice is about 7 x 1.8 mm), slightly translucent ivory with a touch of warm
    // variation; a lumpy heap rather than a dome, and the grains at the bottom and in the hollows are darker
    // (they sit in each other's shade), which is what stops the mound reading as a flat white disc
    const riceMat = track(new THREE.MeshStandardMaterial({ color: new Color(0.9, 0.88, 0.82), roughness: 0.42, emissive: new Color(0.02, 0.018, 0.014) }), 0.5);
    const heap = (th, ph) => 1 + 0.12 * (vnoise(Math.cos(th) * 3 + 5, Math.sin(th) * 3 + ph * 2) - 0.5) + 0.06 * Math.sin(th * 3 + 1);
    const baseG = new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    { const p = baseG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = heap(Math.atan2(z, x), Math.acos(clamp(y, -1, 1))); p.setXYZ(i, x * k, y * k, z * k); } baseG.computeVertexNormals(); }
    const base = new THREE.Mesh(baseG, riceMat);
    base.scale.set(0.07, 0.034, 0.058); base.material = riceMat.clone(); base.material.color.setRGB(0.62, 0.6, 0.55); base.position.set(-0.005, 0.008, 0.045); food.add(base);
    const n = tier === 0 ? 400 : 2400;
    const grain = new THREE.CapsuleGeometry(0.0009, 0.0052, 2, 5);
    const rice = new THREE.InstancedMesh(grain, riceMat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new Vector3(0, 1, 0), nrm = new Vector3(), tan = new Vector3(), sc = new Vector3();
    const cIvory = new Color(1, 0.985, 0.95), cWarm = new Color(1, 0.94, 0.84), c = new Color();
    for (let i = 0; i < n; i++) {
      const loose = i < n * 0.03; // a few grains fallen onto the plate
      const th = rnd() * Math.PI * 2, ph = loose ? Math.PI / 2 - 0.02 : Math.acos(rnd() * 0.98);
      nrm.set(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
      const k = loose ? 1.08 + rnd() * 0.22 : heap(th, ph) * (0.99 + rnd() * 0.04);
      const pos = new Vector3(nrm.x * 0.072 * k, loose ? 0.001 : nrm.y * 0.036 * k, nrm.z * 0.06 * k).add(base.position);
      tan.set(-Math.sin(th), 0, Math.cos(th)).applyAxisAngle(nrm, rnd() * 6.28);
      if (loose) tan.set(rnd() - 0.5, 0, rnd() - 0.5);
      q.setFromUnitVectors(up, tan.normalize());
      const s = 0.85 + rnd() * 0.3; sc.set(s, 0.8 + rnd() * 0.4, s);
      m4.compose(pos, q, sc); rice.setMatrixAt(i, m4);
      const shade = (loose ? 0.95 : 0.8 + 0.2 * Math.pow(nrm.y, 0.6)) * (0.92 + rnd() * 0.08) * (k < 1 ? 0.94 : 1);
      rice.setColorAt(i, c.copy(cIvory).lerp(cWarm, rnd() * 0.7).multiplyScalar(shade));
    }
    rice.castShadow = false; rice.receiveShadow = tier >= 1;
    food.add(rice);
  }
  // brass tumbler of water
  {
    const tg = lathe([[0, 0], [0.03, 0], [0.033, 0.004], [0.036, 0.1], [0.034, 0.1], [0.031, 0.006], [0, 0.006]], 48);
    const t = new THREE.Mesh(tg, brass); t.position.set(TX - 0.58, TY, TZ - 0.12); t.castShadow = t.receiveShadow = tier >= 1; root.add(t); later.push(t);
    blob(TX - 0.58, TZ - 0.12, 0.06, TY, 0.7);
  }

  /* ---------- the momo steamer: woven bamboo, pleated dumplings */
  const bamboo = canvasTex(512, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 8) {
      const v = 0.72 + rnd() * 0.22;
      g.fillStyle = `rgb(${Math.round(201 * v)},${Math.round(164 * v)},${Math.round(106 * v)})`; g.fillRect(x, 0, 8, h);
      g.fillStyle = 'rgba(70,45,20,0.45)'; g.fillRect(x + 7, 0, 1, h);
      if (rnd() > 0.7) { g.fillStyle = 'rgba(110,80,40,0.35)'; g.fillRect(x, (rnd() * h) | 0, 8, 2); }
    }
    g.fillStyle = 'rgba(80,52,24,0.55)'; g.fillRect(0, 0, w, 7); g.fillRect(0, h - 7, w, 7);
    g.fillStyle = 'rgba(60,38,18,0.35)'; for (let x = 0; x < w; x += 22) g.fillRect(x, 0, 2, 7);
  });
  const weaveCol = canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#b8935b'; g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 8) for (let x = 0; x < w; x += 8) {
      const over = ((x + y) / 8) % 2 === 0, v = 0.82 + rnd() * 0.2;
      g.fillStyle = `rgba(${Math.round(214 * v)},${Math.round(176 * v)},${Math.round(116 * v)},1)`;
      if (over) g.fillRect(x, y + 1, 8, 6); else g.fillRect(x + 1, y, 6, 8);
      g.fillStyle = 'rgba(60,40,20,0.35)'; g.fillRect(x, y, 8, 1); g.fillRect(x, y, 1, 8);
    }
  });
  weaveCol.repeat.set(3, 3);
  const bambooMat = track(new THREE.MeshStandardMaterial({ map: bamboo, roughness: 0.62, side: THREE.DoubleSide }), 0.55);
  const weaveMat = track(new THREE.MeshStandardMaterial({ map: weaveCol, roughness: 0.75, side: THREE.DoubleSide }), 0.5);
  const steamer = new THREE.Group();
  steamer.position.set(TX + 0.22, TY, TZ + 0.02);
  root.add(steamer); later.push(steamer);
  blob(TX + 0.22, TZ + 0.02, 0.17, TY, 0.85);
  const SR = 0.125;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(SR, SR, 0.072, 64, 1, true), bambooMat);
  wall.position.y = 0.036; wall.castShadow = wall.receiveShadow = tier >= 1; steamer.add(wall);
  const wallIn = new THREE.Mesh(new THREE.CylinderGeometry(SR - 0.006, SR - 0.006, 0.07, 64, 1, true), bambooMat);
  wallIn.position.y = 0.036; steamer.add(wallIn);
  const rimG = new THREE.TorusGeometry(SR - 0.003, 0.0035, 8, 64);
  [0.0035, 0.0715].forEach((y) => { const r = new THREE.Mesh(rimG, bambooMat); r.rotation.x = Math.PI / 2; r.position.y = y; steamer.add(r); });
  const floorDisc = new THREE.Mesh(new THREE.CircleGeometry(SR - 0.005, 48), weaveMat);
  floorDisc.rotation.x = -Math.PI / 2; floorDisc.position.y = 0.012; floorDisc.receiveShadow = tier >= 1; steamer.add(floorDisc);
  // pleated momo
  let mg = new THREE.SphereGeometry(1, 88, 40);
  mg.deleteAttribute('uv'); mg.deleteAttribute('normal');
  mg = mergeVertices(mg);
  {
    const p = mg.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const phi = Math.atan2(z, x);
      let w = 1;
      if (y > 0) w = 1 - 0.72 * Math.pow(y, 1.3);
      // pleats gathered and twisted toward a small knot at the top; hand-folded, so the spacing and depth wander
      const pleat = sstep(-0.05, 0.55, y) * (1 - sstep(0.88, 1.0, y));
      const wob = Math.sin(phi * 2.0 + 0.7) * 0.32 + Math.sin(phi * 3.0 + 2.1) * 0.18;
      const ridge01 = Math.pow(Math.abs(Math.sin(phi * 5.5 + wob + y * (5.0 + wob * 2.0))), 0.35);
      const ridgeP = ridge01 * 2 - 1;
      const depth = 0.75 + 0.5 * vnoise(phi * 1.6 + 20, 3.1);
      w *= 1 + 0.2 * pleat * ridgeP * depth;
      // a slightly lopsided body (dough sags to one side in the steamer)
      w *= 1 + 0.05 * Math.sin(phi + 0.4) * (1 - Math.abs(y));
      let yy = y < 0 ? y * 0.36 : y * 0.8 + pleat * 0.06 * ridgeP * depth;
      if (y > 0.86) { yy += (y - 0.86) * 0.8; w *= 0.6; }
      if (y < 0 && y > -0.8) w *= 1.05;
      p.setXYZ(i, x * w, yy, z * w);
      // creases read darker (the dough folds in on itself there); thin dough over the filling reads a little
      // darker and warmer on the shoulders, and the base that sat on the cloth is slightly greyer
      const mott = vnoise(x * 3.3 + 7, z * 3.3 + y * 2.0 + 3) * 0.6 + vnoise(x * 9 + 1, z * 9 - y * 6) * 0.4;
      const shoulder = sstep(-0.3, 0.15, y) * (1 - sstep(0.35, 0.7, y));
      const c = 1 - 0.46 * pleat * (1 - ridge01) * depth - (y < -0.2 ? 0.12 : 0) - 0.12 * shoulder * mott;
      col[i * 3] = c * (1 - 0.02 * mott); col[i * 3 + 1] = c * (0.955 - 0.03 * shoulder * mott); col[i * 3 + 2] = c * (0.89 - 0.06 * shoulder * mott);
    }
    mg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    mg.computeVertexNormals();
  }
  // (the merged sphere has no UVs, so the dough gets its detail from the pleats, not a normal map)
  // steamed dough: a damp film (thin clearcoat, broken up by a fine noise normal) over a soft, slightly
  // translucent body (warm emissive lift where light would scatter through the thin wrapper)
  const doughDamp = normalTex(64, (x, y) => vnoise(x * 0.35, y * 0.35) * 0.7 + vnoise(x * 0.9, y * 0.9) * 0.3, 1.6);
  const doughMat = track(new THREE.MeshPhysicalMaterial({
    vertexColors: true, color: new Color(0.66, 0.57, 0.43), roughness: 0.5,
    sheen: 0.6, sheenRoughness: 0.5, sheenColor: new Color(0.9, 0.78, 0.6),
    clearcoat: 0.35, clearcoatRoughness: 0.32, emissive: new Color(0.05, 0.03, 0.014),
  }), 0.6);
  // the merged sphere has no UVs: the damp film's normal is sampled by object position instead
  doughMat.onBeforeCompile = (sh) => {
    sh.uniforms.tDamp = { value: doughDamp };
    sh.vertexShader = 'varying vec3 vObjPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vObjPos = position;');
    sh.fragmentShader = 'uniform sampler2D tDamp;\nvarying vec3 vObjPos;\n' + sh.fragmentShader.replace('#include <clearcoat_normal_fragment_begin>', `#include <clearcoat_normal_fragment_begin>
      { vec3 dn = texture2D(tDamp, vObjPos.xz * 1.7 + vObjPos.y * 0.9).xyz * 2.0 - 1.0;
        clearcoatNormal = normalize(clearcoatNormal + (dn.x * normalize(cross(clearcoatNormal, vec3(0.0, 1.0, 0.0001))) + dn.y * normalize(cross(clearcoatNormal, vec3(1.0, 0.0, 0.0001)))) * 0.35); }`);
  };
  const momoCount = 7;
  const momos = new THREE.InstancedMesh(mg, doughMat, momoCount);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < momoCount; i++) {
      const a = (i / (momoCount - 1)) * Math.PI * 2 + (rnd() - 0.5) * 0.25, rr = i === momoCount - 1 ? 0.006 : 0.068 + rnd() * 0.008;
      const sc = 0.028 + rnd() * 0.004;
      q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.16, rnd() * 6.28, (rnd() - 0.5) * 0.16));
      m4.compose(new Vector3(Math.cos(a) * rr, 0.012 + sc * 0.42, Math.sin(a) * rr), q, new Vector3(sc * (0.96 + rnd() * 0.08), sc * (0.88 + rnd() * 0.12), sc * (0.96 + rnd() * 0.08)));
      momos.setMatrixAt(i, m4);
      // each one a touch different: some steamed longer (more translucent and golden), some paler
      const k = rnd();
      momos.setColorAt(i, new Color(1, 1, 1).lerp(new Color(1.0, 0.9, 0.74), k * 0.6).multiplyScalar(0.92 + rnd() * 0.1));
    }
  }
  momos.castShadow = tier >= 1; momos.receiveShadow = tier >= 1;
  steamer.add(momos);
  // lid: hinged off by scroll
  const lid = new THREE.Group();
  const lidWall = new THREE.Mesh(new THREE.CylinderGeometry(SR + 0.004, SR + 0.004, 0.05, 64, 1, true), bambooMat);
  lidWall.position.y = 0.025; lidWall.castShadow = tier >= 1; lid.add(lidWall);
  const lidTop = new THREE.Mesh(new THREE.CircleGeometry(SR + 0.004, 48), weaveMat);
  lidTop.rotation.x = -Math.PI / 2; lidTop.position.y = 0.047; lidTop.castShadow = tier >= 1; lid.add(lidTop);
  const lidRim = new THREE.Mesh(new THREE.TorusGeometry(SR + 0.003, 0.004, 8, 64), bambooMat); lidRim.rotation.x = Math.PI / 2; lidRim.position.y = 0.048; lid.add(lidRim);
  lid.position.y = 0.07;
  steamer.add(lid);
  // dipping sauce
  {
    const k = new THREE.Group(); k.position.set(TX + 0.2, TY, TZ + 0.24);
    const kb = new THREE.Mesh(katoriG, brass); kb.scale.setScalar(0.85); kb.castShadow = tier >= 1; k.add(kb);
    const s = mound(0.035, 0.004, acharMat, 77); s.position.y = 0.022; k.add(s);
    root.add(k); later.push(k);
    blob(TX + 0.2, TZ + 0.24, 0.06, TY, 0.6);
  }

  /* ---------- steam (billboarded noise wisps) */
  function makeSteam(x, y, z, w, h, seed, color = new Color(0.95, 0.9, 0.84)) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.ShaderMaterial({
      vertexShader: STEAM_VERT, fragmentShader: STEAM_FRAG, transparent: true, depthWrite: false,
      uniforms: { uTime: U.time, uAmount: { value: 1 }, uSeed: { value: seed }, uColor: { value: color } },
    }));
    m.position.set(x, y, z); m.scale.set(w, h, 1); m.renderOrder = 2; m.frustumCulled = false;
    scene.add(m); steams.push(m); if (!detailReady) later.push(m);
    return m;
  }
  const momoSteam = [makeSteam(TX + 0.22, TY + 0.07, TZ + 0.02, 0.34, 0.55, 0.3), makeSteam(TX + 0.24, TY + 0.07, TZ + 0.0, 0.26, 0.45, 1.7)];
  const dalSteam = makeSteam(TX - 0.25, TY + 0.03, TZ - 0.02, 0.14, 0.28, 2.9);

  /* ---------- the clay hearth (chulo) with fire */
  const CX = -2.75, CZ = -2.45;
  const matClayHearth = plaster(new Color(0.55, 0.36, 0.26), 0.35, 0.95);
  {
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.5, 1.15, 4, 0.08), matClayHearth);
    scaleUV(body.geometry, 0.7, 0.7);
    body.position.set(CX, 0.25, CZ); body.castShadow = body.receiveShadow = tier >= 1; root.add(body);
    // fire mouth on the room side, glowing
    const archTex = canvasTex(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const soot = g.createRadialGradient(w / 2, h * 0.62, 6, w / 2, h * 0.62, w * 0.62);
      soot.addColorStop(0, 'rgba(0,0,0,1)'); soot.addColorStop(0.55, 'rgba(10,6,4,0.85)'); soot.addColorStop(1, 'rgba(20,12,8,0)');
      g.fillStyle = soot; g.fillRect(0, 0, w, h);
      g.fillStyle = '#000'; g.beginPath(); g.moveTo(26, h); g.lineTo(26, 62); g.arc(w / 2, 62, 38, Math.PI, 0); g.lineTo(102, h); g.closePath(); g.fill();
    });
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.3), new THREE.MeshBasicMaterial({ map: archTex, transparent: true, depthWrite: false }));
    mouth.position.set(CX + 0.362, 0.15, CZ + 0.18); mouth.rotation.y = Math.PI / 2; mouth.renderOrder = 1; root.add(mouth);
    const fire = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.13), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: FIRE_FRAG, uniforms: { uTime: U.time }, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false,
    }));
    fire.position.set(CX + 0.366, 0.09, CZ + 0.18); fire.rotation.y = Math.PI / 2; fire.renderOrder = 3; root.add(fire); later.push(fire); // always over the sooty arch
    const mouth2 = mouth.clone(); mouth2.position.z = CZ - 0.24; root.add(mouth2);
    const fire2 = fire.clone(); fire2.position.z = CZ - 0.24; root.add(fire2); later.push(fire2);
    fireL.position.set(CX + 0.62, 0.16, CZ - 0.03);
    // a wooden counter and wall shelf beside it
    add(box(0.55, 0.05, 0.95, K_WOOD, 'z'), matWood, -3.3, 0.8, -3.75, { cast: true });
    add(box(0.5, 0.035, 0.9, K_WOOD, 'z'), matWoodDark, -3.3, 0.22, -3.75, { cast: true });
    [[-0.24, -0.43], [0.24, -0.43], [-0.24, 0.43], [0.24, 0.43]].forEach(([dx, dz]) => add(box(0.05, 0.78, 0.05, K_WOOD, 'y'), matWood, -3.3 + dx, 0.39, -3.75 + dz, { cast: true }));
    add(box(0.3, 0.045, 1.9, K_WOOD), matWoodDark, -3.44, 1.5, -2.4, { cast: true });
  }
  const potSteam = [makeSteam(CX, 0.82, CZ - 0.24, 0.3, 0.75, 4.1), makeSteam(CX + 0.02, 0.8, CZ - 0.22, 0.22, 0.6, 5.3)];

  /* ---------- hanging lanterns and diyas: one asset, placed where the light is */
  const lanterns = [];
  const glowTex = canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,220,160,0.85)'); gr.addColorStop(0.1, 'rgba(255,175,85,0.5)'); gr.addColorStop(0.38, 'rgba(255,135,55,0.12)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const glowSprite = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const chainMat = track(new THREE.MeshStandardMaterial({ color: 0x5a4020, metalness: 1, roughness: 0.45 }), 0.6);
  function hangLantern(src, x, y, z, s, ceilY, withGlow = true) {
    const l = src.clone();
    l.scale.setScalar(s); l.position.set(x, y, z);
    l.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    root.add(l);
    if (ceilY) { // extend the chain to the ceiling
      const top = y + 0.38 * s, len = ceilY - top;
      if (len > 0.01) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, len, 5), chainMat); c.position.set(x + 0.005 * s, top + len / 2, z - 0.006 * s); root.add(c); }
    }
    if (withGlow) {
      const glow = new THREE.Sprite(glowSprite);
      glow.position.set(x + 0.004 * s, y + 0.055 * s, z - 0.006 * s); glow.scale.setScalar(0.34 * s / 1.7);
      root.add(glow);
    }
    lanterns.push(l);
    return l;
  }

  /* ---------- sizing, camera, render */
  let composer = null, bloom = null, fxaa = null, finish = null, output = null;
  const size = new Vector2();
  function makeComposer() {
    if (tier !== 2) return;
    renderer.getDrawingBufferSize(size);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 0 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new Vector2(256, 256), 0.38, 0.5, 1.25);
    composer.addPass(bloom);
    output = new OutputPass();
    composer.addPass(output);
    // the stock FXAA asks for a -100 texture bias (clamped with a warning on ANGLE/D3D and useless without mips)
    fxaa = new ShaderPass({ ...FXAAShader, fragmentShader: FXAAShader.fragmentShader.replace(/,\s*-100\.0\)/g, ')') });
    composer.addPass(fxaa);
    finish = new ShaderPass(FINISH);
    composer.addPass(finish);
  }
  function dropComposer(dispose) {
    if (!composer) return;
    if (dispose) { composer.passes.forEach((p) => p.dispose && p.dispose()); composer.dispose(); }
    composer = bloom = fxaa = finish = null;
  }
  makeComposer();

  let W = 1, H = 1, portrait = false;
  function resize() {
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    if (composer) {
      composer.setPixelRatio(pr); composer.setSize(W, H);
      fxaa.material.uniforms.resolution.value.set(1 / (W * pr), 1 / (H * pr));
      finish.material.uniforms.uRes.value.set(W * pr, H * pr);
    }
    camera.aspect = W / H;
    portrait = W / H < 0.9;
    wake();
  }
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(resize, 140); };
  window.addEventListener('resize', onResize);

  // camera curves
  const posCurve = new THREE.CatmullRomCurve3(KNOTS.map((k) => new Vector3(...k.p)), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(KNOTS.map((k) => new Vector3(...k.t)), false, 'centripetal');
  const NK = KNOTS.length - 1;
  function knotAt(u) { // station coordinate -> fractional knot index
    const s = clamp(u, 0, STATION_KNOT.length - 1);
    const i = Math.min(Math.floor(s), STATION_KNOT.length - 2), f = s - i;
    return lerp(STATION_KNOT[i], STATION_KNOT[i + 1], easeIO(f));
  }
  const kv = (k, key) => { const i = Math.min(Math.floor(k), NK - 1), f = k - i; return lerp(KNOTS[i][key], KNOTS[i + 1][key], f); };

  let uCur = 0, uTgt = 0, paused = !!opts.paused, clock = 0, lost = false, tabVisible = !document.hidden, inView = true;
  const camPos = new Vector3(), camTg = new Vector3();
  function applyCamera() {
    const k = knotAt(uCur);
    posCurve.getPoint(k / NK, camPos);
    tgtCurve.getPoint(k / NK, camTg);
    // a slow breath of handheld drift, frozen when motion is paused
    if (!paused && !reduce) { camPos.x += Math.sin(clock * 0.21) * 0.012; camPos.y += Math.sin(clock * 0.17 + 1.3) * 0.008; }
    camera.position.copy(camPos);
    camera.lookAt(camTg);
    // wide screens: push the scene away from the text panel; tall screens: lift it above the bottom panel
    const narrowFov = portrait ? 1.22 : 1;
    camera.fov = kv(k, 'fov') * narrowFov;
    const sx = portrait ? 0 : kv(k, 'sx') * clamp((W / H) / 1.6, 0.6, 1.2);
    const sy = portrait ? kv(k, 'sy') : 0;
    camera.setViewOffset(W, H, -sx * W, sy * H, W, H);
    camera.updateProjectionMatrix();
    renderer.toneMappingExposure = kv(k, 'ex');
  }

  // tea set (loaded later); pour pose computed once the model is in
  const tea = { pot: null, rest: new THREE.Matrix4(), pour: new THREE.Matrix4(), tip: new Vector3(), cup: new Vector3(), stream: null, liquid: null, steam: null };
  const _m = new THREE.Matrix4(), _p = new Vector3(), _q = new THREE.Quaternion(), _s = new Vector3(), _p2 = new Vector3(), _q2 = new THREE.Quaternion(), _s2 = new Vector3();

  function updateScene() {
    const u = uCur, t = clock;
    U.time.value = t;
    // momo lid: lifts and swings aside on the way into the table station
    const open = easeIO(sstep(1.25, 1.95, u));
    const side = sstep(0.3, 1, open);
    lid.position.set(-0.04 * side, 0.07 + 0.17 * Math.sin(Math.PI * open) + 0.06 * side, -0.235 * side);
    lid.rotation.set(-1.25 * side, 0, 0);
    const burst = sstep(1.3, 2.0, u) * (1 - 0.5 * sstep(2.3, 3.2, u));
    momoSteam[0].material.uniforms.uAmount.value = 0.15 + burst * 1.1;
    momoSteam[1].material.uniforms.uAmount.value = burst * 0.9;
    momoSteam.forEach((m) => { m.visible = detailReady && m.material.uniforms.uAmount.value > 0.02; });
    dalSteam.material.uniforms.uAmount.value = 0.35;
    potSteam.forEach((m, i) => { m.material.uniforms.uAmount.value = 0.9 - i * 0.2; });
    // tea pour
    if (tea.pot) {
      const pour = easeIO(sstep(2.45, 2.95, u)) * (1 - easeIO(sstep(3.3, 3.75, u)));
      tea.rest.decompose(_p, _q, _s); tea.pour.decompose(_p2, _q2, _s2);
      _p.lerp(_p2, pour); _q.slerp(_q2, pour);
      tea.pot.position.copy(_p); tea.pot.quaternion.copy(_q);
      tea.pot.updateMatrixWorld(true);
      const level = sstep(2.62, 3.05, u);
      const cupY = tea.cup.y + 0.012 + level * 0.044;
      tea.liquid.position.set(tea.cup.x, cupY, tea.cup.z);
      tea.liquid.scale.setScalar(lerp(0.034, 0.046, level));
      tea.liquid.visible = level > 0.01;
      const flowing = pour > 0.92 && u < 3.32;
      tea.stream.visible = flowing;
      if (flowing) {
        _p.copy(tea.tip).applyMatrix4(tea.potInner.matrixWorld);
        const len = Math.max(0.01, _p.y - cupY);
        tea.stream.position.set(_p.x, _p.y, _p.z);
        const wob = 1 + Math.sin(t * 23) * 0.06;
        tea.stream.scale.set(wob, len, wob);
      }
      tea.steam.material.uniforms.uAmount.value = level * 0.8;
      tea.steam.position.set(tea.cup.x, cupY, tea.cup.z);
    }
    // flicker on every flame
    const fl = 1 + 0.08 * Math.sin(t * 12.7) + 0.05 * Math.sin(t * 23.1 + 1.2) + 0.04 * Math.sin(t * 37.3);
    const fl2 = 1 + 0.06 * Math.sin(t * 10.3 + 2) + 0.05 * Math.sin(t * 19.7);
    fireL.intensity = 2.2 * (1 + 0.15 * Math.sin(t * 8.1) + 0.1 * Math.sin(t * 17.3 + 1));
    doorL.intensity = 2.4 * fl;
    winL.intensity = 1.9 * fl2;
    pend.intensity = 5 * (1 + (fl - 1) * 0.25);
    U.back.value = 0.22;
    // the cool dusk light only reaches the courtyard: fade it out once the camera is inside
    const outside = 1 - sstep(0.35, 0.8, u);
    dusk.intensity = 2.4 * outside;
    hemi.intensity = 0.1 + 0.6 * outside;
    if (finish) finish.material.uniforms.uTime.value = t;
  }

  let shadowU = -1;
  function draw() {
    applyCamera();
    updateScene();
    // the light is fixed and the only moving casters (steamer lid, teapot) follow the scroll position
    if (uCur !== shadowU || !detailReady) { shadowU = detailReady ? uCur : -1; pend.shadow.needsUpdate = true; }
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  /* ---------- loop (one rAF at most; sleeps when paused and settled, off-screen or hidden) */
  let raf = 0, last = 0, guard = tier === 2, frames = 0, slow = 0, bloomOff = false;
  const canRun = () => !lost && tabVisible && inView;
  function frame(ts) {
    raf = 0;
    if (!canRun()) return;
    const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000 || 0.016)); last = ts;
    if (reduce) uCur = uTgt;
    else {
      uCur += (uTgt - uCur) * (1 - Math.exp(-dt * 4.2));
      if (Math.abs(uTgt - uCur) < 0.0005) uCur = uTgt;
      if (!paused) clock += dt;
    }
    draw();
    if (guard && !paused && !reduce && !document.hidden) {
      frames++; if (dt > 0.024) slow++;
      if (frames === 120) { if (slow > 70) degrade(); frames = 0; slow = 0; }
    }
    const moving = uCur !== uTgt;
    if (!raf && !reduce && (!paused || moving)) raf = requestAnimationFrame(frame);
  }
  function degrade() { // shed cost in stages (no stage recompiles shaders), then stop watching
    if (bloom && bloom.enabled) { bloom.enabled = false; bloomOff = true; return; }
    if (pr > 1) { pr = Math.max(1, pr - 0.25); resize(); return; }
    if (pend.castShadow && pend.shadow.autoUpdate) { pend.shadow.autoUpdate = false; pend.shadow.needsUpdate = true; return; } // keep the last shadow map
    guard = false;
  }
  function wake() {
    if (raf || !canRun() || !ready) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  let ready = false;

  const io = new IntersectionObserver((e) => { inView = e[0].isIntersecting; inView ? wake() : stop(); }, { threshold: 0 });
  if (opts.watch) io.observe(opts.watch);
  const onVis = () => { tabVisible = !document.hidden; tabVisible ? wake() : stop(); };
  document.addEventListener('visibilitychange', onVis);
  const onLost = (e) => { e.preventDefault(); lost = true; stop(); opts.onLost && opts.onLost(); };
  const onRestored = () => {
    // Objects of the dead context are forgotten, not disposed (three has already reset its registries).
    lost = false;
    envRT = null; buildEnv();
    dropComposer(false); makeComposer();
    if (bloom && bloomOff) bloom.enabled = false; // keep what degrade() shed
    pend.shadow.needsUpdate = true; // a frozen shadow map is empty in the new context
    resize();
    opts.onRestored && opts.onRestored();
    wake();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  // Compile an object's programs (hidden or not) for the target it is really drawn into. compile() only starts
  // the driver work; with KHR_parallel_shader_compile the wait happens off the main thread.
  // (fog and the light set are part of a program's key, so passes that draw without them compile against a
  // bare scene, and the shadow pass compiles against the lit scene with its fog lifted for that one call)
  const bare = new THREE.Scene();
  async function compileFor(obj, target = composer ? composer.readBuffer : null, ctx = scene, noFog = false) {
    if (renderer.getContext().isContextLost()) return;
    renderer.setRenderTarget(target);
    const fog = scene.fog;
    if (noFog) scene.fog = null;
    let p = null;
    try { p = renderer.compileAsync(obj, camera, ctx); } catch (e) { /* falls back to compiling on first draw */ }
    scene.fog = fog;
    renderer.setRenderTarget(null);
    if (p) await Promise.race([p.catch(() => {}), tick(4000)]);
  }
  // the post-processing programs, warmed the same way (OutputPass defines are set as its render() would)
  async function warmPost() {
    if (!composer) return;
    output._outputColorSpace = renderer.outputColorSpace; output._toneMapping = renderer.toneMapping;
    output.material.defines = { SRGB_TRANSFER: '', ACES_FILMIC_TONE_MAPPING: '' };
    output.material.needsUpdate = true;
    const quad = new THREE.PlaneGeometry(2, 2), toRT = new THREE.Group(), toScreen = new THREE.Group();
    [bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial, output.material, fxaa.material]
      .forEach((m) => toRT.add(new THREE.Mesh(quad, m)));
    toScreen.add(new THREE.Mesh(quad, finish.material));
    [toRT, toScreen].forEach((g) => g.traverse((o) => { o.frustumCulled = false; }));
    await Promise.all([compileFor(toRT, composer.readBuffer, bare), compileFor(toScreen, null, bare)]);
    quad.dispose();
  }
  // the shadow pass uses three's internal depth material; the same program variants (one-sided, double-sided,
  // instanced) are compiled ahead so the first shadow render does not stall
  async function warmShadows() {
    if (!renderer.shadowMap.enabled) return;
    const rt = new THREE.WebGLRenderTarget(4, 4);
    const geo = new THREE.BoxGeometry(), g = new THREE.Group();
    [THREE.BackSide, THREE.DoubleSide].forEach((side) => {
      const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side });
      g.add(new THREE.Mesh(geo, dm), new THREE.InstancedMesh(geo, dm, 1));
      g.add(new THREE.Mesh(geo, new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side, map: flagPrint, alphaTest: 0.5 })));
    });
    g.traverse((o) => { o.frustumCulled = false; });
    await compileFor(g, rt, scene, true);
    geo.dispose(); rt.dispose();
  }

  /* ---------- phase A: the arrival (door lantern), then the first frame */
  const diya = await loadModel('brass_diya_lantern', { rough: 0.3, metal: 1 });
  progress(0.8);
  if (diya) {
    await prepare(diya);
    hangLantern(diya, 1.02, 1.55, 0.5, 1.7, 0);            // by the door, on a bracket
    hangLantern(diya, TX, 1.62, TZ, 1.8, RH, false);      // over the table
    hangLantern(diya, 0.0, 1.22, -6.86, 1.7, WY1 - 0.02); // in the window
    // bracket for the door lantern
    add(box(0.035, 0.035, 0.42, K_WOOD, 'z'), matWoodDark, 1.02, 2.235, 0.39);
    add(box(0.03, 0.03, 0.4, K_WOOD, 'z'), matWoodDark, 1.02, 2.07, 0.3, { rx: 0.62 });
  }
  resize();
  uCur = uTgt;
  later.forEach((o) => { o.visible = false; });
  const first = [...scene.children, ...root.children].filter((o) => o !== root && !later.includes(o));
  await prepare(scene, new Set(later));
  await Promise.all([...first.map((o) => compileFor(o)), warmPost(), warmShadows()]);
  if (lost || renderer.getContext().isContextLost()) return null;
  draw();
  ready = true;
  progress(1);
  wake();

  /* ---------- phase B: the table and hearth details, then the kitchen, produce and tea set in the background */
  (async () => {
    await tick(16);
    for (const o of later) await compileFor(o);
    later.forEach((o) => { o.visible = true; });
    detailReady = true;
    wake();
    // each model goes into its own hidden group, is compiled, then shown ('root' inside fn is that group)
    const place = async (id, fn, opt) => {
      if (lost) return;
      const m = await loadModel(id, opt);
      if (!m) return;
      await prepare(m);
      const g = new THREE.Group();
      g.visible = false;
      root.add(g);
      fn(m, g);
      await compileFor(g);
      g.visible = true;
      shadowU = -1; // a new caster: redraw the shadow map once
      wake();
      await tick(30);
    };
    await place('brass_pot_01', (m, root) => {
      m.position.set(CX, 0.5, CZ - 0.24); root.add(m);
      const m2 = m.clone(); m2.scale.setScalar(0.72); m2.position.set(-3.44, 1.522, -2.95); root.add(m2);
      const m3 = m.clone(); m3.scale.setScalar(0.55); m3.position.set(-3.44, 1.522, -1.65); m3.rotation.y = 1; root.add(m3);
    }, { rough: 0.34, metal: 1 });
    // the second pot is a background prop: phones (byte budget) do without it
    if (tier >= 1) await place('brass_pot_02', (m, root) => {
      m.position.set(CX + 0.02, 0.5, CZ + 0.2); m.rotation.y = 0.6; root.add(m);
      const m2 = m.clone(); m2.position.set(-3.3, 0.2375, -3.8); m2.rotation.y = -0.3; root.add(m2);
    }, { noNormal: true, rough: 0.36, metal: 1 });
    await place('food_lime_01', (m, root) => {
      [[TX - 0.02, TZ - 0.22, 0], [TX + 0.04, TZ - 0.25, 1.4], [-3.15, -3.62, 2], [-3.08, -3.58, 0.7]].forEach(([x, z, r], i) => {
        const l = i ? m.clone() : m; l.position.set(x, x < -1 ? 0.825 : TY, z); l.rotation.y = r; root.add(l);
      });
    }, { noNormal: true, noArm: true, rough: 0.5, metal: 0 }); // limes are small in frame: their roughness map is not worth its bytes
    await place('tea_set_01', (m, root) => {
      const keep = ['tea_set_01_teapot_01', 'tea_set_01_teapot_01_lid', 'tea_set_01_cup_small_01', 'tea_set_01_saucer_circular_04'];
      const byName = {};
      m.children.slice().forEach((c) => { if (!keep.includes(c.name)) m.remove(c); else byName[c.name] = c; });
      const pot = byName.tea_set_01_teapot_01, potLid = byName.tea_set_01_teapot_01_lid;
      const cup = byName.tea_set_01_cup_small_01, saucer = byName.tea_set_01_saucer_circular_04;
      if (!pot || !cup || !saucer || !potLid) return;
      const CUPX = TX + 0.5, CUPZ = TZ - 0.12;
      saucer.position.set(CUPX, TY, CUPZ); cup.position.set(CUPX, TY + 0.012, CUPZ); cup.rotation.y = 2.2;
      root.add(saucer, cup);
      blob(CUPX, CUPZ, 0.09, TY, 0.6);
      // spout tip = the vertex furthest along the long axis of the pot, on the higher end
      const pp = pot.geometry.attributes.position;
      const box3 = new THREE.Box3().setFromBufferAttribute(pp);
      const axisZ = (box3.max.z - box3.min.z) > (box3.max.x - box3.min.x);
      const v = new Vector3(); let hiEnd = { max: -1e9, p: null }, loEnd = { max: -1e9, p: null };
      for (let i = 0; i < pp.count; i++) {
        v.fromBufferAttribute(pp, i);
        const a = axisZ ? v.z : v.x;
        const sHi = a * 10 + v.y, sLo = -a * 10 + v.y;
        if (sHi > hiEnd.max) hiEnd = { max: sHi, p: v.clone() };
        if (sLo > loEnd.max) loEnd = { max: sLo, p: v.clone() };
      }
      const tip = hiEnd.p.y >= loEnd.p.y ? hiEnd.p : loEnd.p;
      // wrap pot + lid in a pivot so they move together
      const inner = new THREE.Group();
      pot.position.set(0, 0, 0); potLid.position.set(0, 0.002, 0);
      inner.add(pot, potLid);
      const pivot = new THREE.Group(); pivot.add(inner); root.add(pivot);
      tea.pot = pivot; tea.potInner = inner; tea.tip.copy(tip);
      tea.cup.set(CUPX, TY + 0.012, CUPZ);
      // rest pose: on the table, spout toward the cup
      const restPos = new Vector3(TX + 0.68, TY, TZ - 0.3);
      const toCup = new Vector3(CUPX - restPos.x, 0, CUPZ - restPos.z).normalize();
      const tipDir = new Vector3(axisZ ? 0 : Math.sign(tip.x), 0, axisZ ? Math.sign(tip.z) : 0);
      const yaw = Math.atan2(tipDir.x, tipDir.z) - Math.atan2(toCup.x, toCup.z);
      const qRest = new THREE.Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -yaw);
      tea.rest.compose(restPos, qRest, new Vector3(1, 1, 1));
      // pour pose: tilted about the axis across the spout, with the tip right above the cup
      const across = new Vector3(0, 1, 0).cross(toCup).normalize();
      const qPour = new THREE.Quaternion().setFromAxisAngle(across, 0.72).multiply(qRest);
      const tipW = tip.clone().applyQuaternion(qPour);
      const pourPos = new Vector3(CUPX, TY + 0.012 + 0.14, CUPZ).sub(tipW);
      tea.pour.compose(pourPos, qPour, new Vector3(1, 1, 1));
      blob(restPos.x, restPos.z, 0.1, TY, 0.6);
      // stream, liquid, steam
      const chai = track(new THREE.MeshPhysicalMaterial({ color: new Color(0.42, 0.24, 0.12), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }), 1);
      tea.stream = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0042, 1, 10, 1, true).translate(0, -0.5, 0), chai);
      tea.liquid = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), chai);
      root.add(tea.stream, tea.liquid);
      tea.steam = makeSteam(CUPX, TY + 0.05, CUPZ, 0.12, 0.26, 6.6);
    }, { rough: 0.2, metal: 0 });
    opts.onAllLoaded && opts.onAllLoaded();
  })().catch(() => { /* a late prop failed: keep the scene as it is */ });

  function detach() {
    stop(); io.disconnect();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
  }
  window.addEventListener('pagehide', (e) => { if (!e.persisted) detach(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) { tabVisible = !document.hidden; wake(); } });

  return {
    still: reduce,
    setU(u) {
      const v = reduce ? Math.round(u) : u;
      if (v === uTgt) return;
      uTgt = v;
      wake();
    },
    setPaused(p) { paused = !!p; wake(); },
    get tier() { return tier; },
  };
}
