// Himal Chulo (photo edition) - the 3D scene. The scenery is two real 360-degree photographs (Poly Haven, CC0):
// a mountain lookout at dusk for the arrival and a warm restaurant at night for the rest of the story. Real scanned
// props (a wooden table, a brass diya lantern, a brass pot, a carved plate, limes, a tea set) stand in front of the
// photograph and are lit by it (prefiltered environment maps baked from the same photographs) plus one key light.
// Made in code: prayer-flag cloth, a marigold garland, the brass thali, the momo steamer, steam and the tea stream.
import * as THREE from 'three';

let GLTFLoader, RGBELoader, mergeVertices, RoundedBoxGeometry;
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
const yieldNow = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); r(); }; c.port2.postMessage(0); });
const D2R = Math.PI / 180;

/* ------------------------------------------------------------------ panoramas and framing */
// Panorama column u (0..1 across the photograph) -> world direction. This matches three's equirectangular
// convention, so the baked environment maps line up with the photographs.
const dirU = (u, pitchDeg = 0) => {
  const a = 2 * Math.PI * u, p = pitchDeg * D2R;
  return new Vector3(-Math.cos(a) * Math.cos(p), Math.sin(p), -Math.sin(a) * Math.cos(p));
};
const yawU = (u) => Math.PI / 2 - 2 * Math.PI * u;
// hi = desktop, lo = phones / GPUs without 8k textures. The restaurant photograph is our own 6k and 4k copy
// (assets/pano/) with the emergency-exit sign painted out; the room stations are softened, so 6k is enough and
// keeps the two resident photographs at about 280 MB of GPU memory instead of 360 MB.
const PANOS = [
  { hi: `${A}/pano/fouriesburg_mountain_lookout/fouriesburg_mountain_lookout_8k.jpg`, lo: `${A}/pano/fouriesburg_mountain_lookout/fouriesburg_mountain_lookout_4k.jpg`, env: 'assets/env-fouriesburg-pmrem128.hdr' },
  { hi: 'assets/pano/warm_restaurant_night_6k.jpg', lo: 'assets/pano/warm_restaurant_night_4k.jpg', env: 'assets/env-warm-restaurant-night-pmrem128.hdr' },
];
const EYE = 1.6;     // the photographs were taken at about standing eye height: the virtual floor sits 1.6 m below
const TABLE_U = 0.30, TABLE_D = 1.3; // where our table stands in the restaurant photograph (column, metres away)
const FLAG_U = 0.52; // the arrival looks into the dusk, the sun just right of centre
const FIRE_U = 0.028; // the real fireplace in the restaurant photograph

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
const NL = new Float32Array(256 * 256);
for (let i = 0; i < NL.length; i++) NL[i] = rnd();
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = NL[((yi & 255) << 8) | (xi & 255)], b = NL[((yi & 255) << 8) | ((xi + 1) & 255)];
  const c = NL[(((yi + 1) & 255) << 8) | (xi & 255)], d = NL[(((yi + 1) & 255) << 8) | ((xi + 1) & 255)];
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
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
function catenary(a, b, sag, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(new Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t) - sag * 4 * t * (1 - t), lerp(a.z, b.z, t)));
  }
  return out;
}

/* ------------------------------------------------------------------ shaders */
// The photograph: an inward sphere with the sphere's own UVs (no per-pixel atan, so mipmapping has no seam).
// Two photographs are mixed in the shader for the dissolve; a mip bias gives a cheap background defocus; the
// grade (exposure, saturation, white balance) is applied to the photo only and the props are matched to it.
const PANO_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PANO_FRAG = /* glsl */`
uniform sampler2D mapA; uniform sampler2D mapB;
uniform float uMix; uniform float uBlur;
uniform vec4 gradeA; uniform vec4 gradeB; // rgb = white balance * exposure, a = saturation
varying vec2 vUv;
vec3 grade(vec3 c, vec4 g) { c *= g.rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); return max(mix(vec3(l), c, g.a), 0.0); }
void main() {
  vec3 a = grade(texture2D(mapA, vUv, uBlur).rgb, gradeA);
  vec3 c = a;
  if (uMix > 0.001) c = mix(a, grade(texture2D(mapB, vUv, uBlur).rgb, gradeB), uMix);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

// cylindrical billboard steam (fades when seen from straight above)
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
  float a = body * wisps * fade * uAmount * 0.3 * vSide;
  gl_FragColor = vec4(uColor, a);
}`;

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
  ({ RGBELoader } = await imp('three/addons/loaders/RGBELoader.js'));
  ({ mergeVertices } = await imp('three/addons/utils/BufferGeometryUtils.js'));
  ({ RoundedBoxGeometry } = await imp('three/addons/geometries/RoundedBoxGeometry.js'));
  progress(0.08);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  renderer.debug.checkShaderErrors = false;
  renderer.setClearColor(0x120d0a, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = tier >= 1;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(pr);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  // phones and any GPU that cannot hold an 8k texture get the 4k photographs
  const big = tier === 2 && renderer.capabilities.maxTextureSize >= 8192;
  const gl = renderer.getContext();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.03, 120);
  const U = { time: { value: 0 } };
  const steams = [];

  /* ---------- loaders */
  // The photograph is fetched and decoded in a Web Worker (Chrome decodes a flipped ImageBitmap on the calling
  // thread, which froze the page for 0.5-1 s), then uploaded by hand in strips of rows, one strip per task.
  let worker = null, wid = 0;
  const waiting = new Map();
  function workerDecode(url) {
    try {
      if (!worker) {
        const src = "self.onmessage=async(e)=>{let bmp=null;try{const r=await fetch(e.data.url);if(r.ok){const b=await r.blob();bmp=await createImageBitmap(b,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});}}catch(x){}self.postMessage({id:e.data.id,bmp},bmp?[bmp]:[]);};";
        worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        worker.onmessage = (e) => { const f = waiting.get(e.data.id); waiting.delete(e.data.id); f && f(e.data.bmp); };
        worker.onerror = () => { waiting.forEach((f) => f(undefined)); waiting.clear(); };
      }
      const id = ++wid;
      return new Promise((res) => { waiting.set(id, res); worker.postMessage({ id, url: new URL(url, location.href).href }); });
    } catch (e) { return Promise.resolve(undefined); }
  }
  async function loadPano(i) {
    const url = big ? PANOS[i].hi : PANOS[i].lo;
    try {
      let img = window.createImageBitmap && window.Worker && gl instanceof WebGL2RenderingContext ? await workerDecode(url) : undefined, flip = false;
      if (img === null) return null; // the file failed
      if (!img) { // no worker: decode in the page and let three upload it
        const r = await fetch(url);
        if (!r.ok) return null;
        img = new Image(); img.src = URL.createObjectURL(await r.blob()); await img.decode(); flip = true;
      }
      const t = new THREE.Texture(img);
      t.flipY = flip; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = maxAniso; t.generateMipmaps = true;
      if (flip) t.needsUpdate = true; else t.userData.striped = true;
      return t;
    } catch (e) { return null; }
  }
  async function uploadStriped(tex, px) {
    const img = tex.image, w = img.width, h = img.height, st = renderer.state;
    const glt = gl.createTexture();
    const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
    st.bindTexture(gl.TEXTURE_2D, glt);
    gl.texStorage2D(gl.TEXTURE_2D, levels, gl.SRGB8_ALPHA8, w, h);
    const rows = Math.max(32, Math.floor(px / w));
    for (let y = 0; y < h; y += rows) {
      if (lost || gl.isContextLost()) return false;
      st.bindTexture(gl.TEXTURE_2D, glt);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, w); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, w, Math.min(rows, h - y), gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0); gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
      await yieldNow(); // a new task without setTimeout's 4 ms clamp
    }
    if (lost || gl.isContextLost()) return false;
    st.bindTexture(gl.TEXTURE_2D, glt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
    gl.generateMipmap(gl.TEXTURE_2D);
    st.bindTexture(gl.TEXTURE_2D, null);
    const props = renderer.properties.get(tex);
    props.__webglTexture = glt; props.__webglInit = true; props.__version = tex.version;
    await tick(0);
    return true;
  }
  // the first photograph uploads behind the poster in larger strips, the second while the page is live in small ones
  async function uploadPano(tex) {
    if (tex.userData.striped) return uploadStriped(tex, 0.4e6);
    renderer.initTexture(tex); await tick(0); return true;
  }
  // environment: the same photograph's HDR, prefiltered offline into three's CubeUV layout (skips the runtime PMREM
  // shader, which compiles for seconds on Windows/ANGLE). Plain texture data: it survives a context loss.
  const loadEnv = (i) => new Promise((ok) => new RGBELoader().load(PANOS[i].env, (t) => {
    t.mapping = THREE.CubeUVReflectionMapping; t.flipY = false; t.generateMipmaps = false;
    t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; ok(t);
  }, undefined, () => ok(null)));

  /* ---------- the photograph sphere */
  const panoGeo = new THREE.SphereGeometry(60, 128, 64).scale(1, 1, -1);
  const panoMat = new THREE.ShaderMaterial({
    vertexShader: PANO_VERT, fragmentShader: PANO_FRAG, side: THREE.DoubleSide, depthWrite: false, depthTest: false,
    uniforms: {
      mapA: { value: null }, mapB: { value: null }, uMix: { value: 0 }, uBlur: { value: 0 },
      // dusk lookout: a touch cooler and darker; restaurant: the photo is very yellow, so pull the saturation and
      // the yellow down a little and darken it toward an evening mood
      gradeA: { value: new THREE.Vector4(0.9, 0.9, 0.95, 1.0) },
      gradeB: { value: new THREE.Vector4(0.74, 0.68, 0.64, 0.92) },
    },
  });
  const pano = new THREE.Mesh(panoGeo, panoMat);
  pano.renderOrder = -10; pano.frustumCulled = false;
  scene.add(pano);

  /* ---------- the table's frame in the restaurant photograph */
  const tableG = new THREE.Group(); // local: x to the right, -z away from the photo's camera, y up from the floor
  tableG.position.copy(dirU(TABLE_U).multiplyScalar(TABLE_D)).setY(0);
  tableG.rotation.y = yawU(TABLE_U);
  scene.add(tableG);
  tableG.updateMatrixWorld(true);
  const L = (x, y, z) => new Vector3(x, y, z).applyMatrix4(tableG.matrixWorld); // table-local -> world
  const TY = 0.8; // table top height (Poly Haven wooden_table_02)

  /* ---------- camera stations (one per HTML section). m = which photograph (0 dusk, 1 room). */
  const eye = new Vector3(0, EYE, 0);
  const diyaAt = new Vector3(-0.47, TY, 0.25);
  const fireDir = dirU(FIRE_U, -3);
  // reserve: from the right of the diya, looking across it toward the real fireplace in the photograph
  const fireH = dirU(FIRE_U), fireRight = new Vector3(-fireH.z, 0, fireH.x);
  const reserveP = L(diyaAt.x, TY + 0.24, diyaAt.z).addScaledVector(fireH, -0.62).addScaledVector(fireRight, -0.2);
  const ST = [
    { p: eye.clone(), t: eye.clone().add(dirU(FLAG_U, 3.5)), fov: 50, m: 0, blur: 0, ex: 1.0, sx: 0.12, sy: -0.2 },
    { p: eye.clone().addScaledVector(dirU(0.47), 0.9), t: eye.clone().addScaledVector(dirU(0.47), 0.9).add(dirU(0.43, -4)), fov: 54, m: 1, blur: 0, ex: 0.68, sx: 0.1, sy: 0.06 },
    { p: eye.clone(), t: L(0.02, TY - 0.06, -0.02), fov: 38, m: 1, blur: 0.9, ex: 0.64, sx: -0.12, sy: 0.18 },
    { p: L(0.78, 1.22, 0.78), t: L(0.36, TY + 0.05, 0.06), fov: 33, m: 1, blur: 2.2, ex: 0.64, sx: 0.14, sy: 0.2 },
    { p: L(0.08, 1.78, 0.62), t: L(0.02, TY, -0.04), fov: 44, m: 1, blur: 1.0, ex: 0.64, sx: -0.2, sy: 0.0 },
    { p: reserveP, t: L(diyaAt.x, TY + 0.13, diyaAt.z).addScaledVector(fireH, 1.4), fov: 40, m: 1, blur: 1.6, ex: 0.72, sx: -0.24, sy: 0.22 },
  ];
  const qOf = (s) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(s.p, s.t, new Vector3(0, 1, 0)));
  ST.forEach((s) => { s.q = qOf(s); });

  /* ---------- material registry */
  const propMats = new Set();
  let envA = null, envB = null;
  const trackB = (m, env = 1) => { m.userData.env = env; propMats.add(m); if (envB) { m.envMap = envB; m.envMapIntensity = env; m.needsUpdate = true; } return m; };

  /* ---------- arrival: prayer-flag cloth and a marigold garland against the dusk photograph */
  const flagsG = new THREE.Group();
  flagsG.position.copy(eye).setY(0);
  flagsG.rotation.y = yawU(FLAG_U);
  scene.add(flagsG);
  const flagMats = [];
  const flagPrint = canvasTex(128, 160, (g, w, h) => {
    g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.24; g.strokeStyle = '#26221e'; g.fillStyle = '#26221e';
    g.lineWidth = 3; g.strokeRect(20, 22, w - 40, h - 52);
    g.beginPath(); g.arc(w / 2, 62, 18, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2;
    for (let r = 0; r < 6; r++) { let x = 28; const y = 94 + r * 8; while (x < w - 30) { const l = 3 + rnd() * 9; g.fillRect(x, y, l, 2); x += l + 2 + rnd() * 3; } }
    g.globalAlpha = 1;
    const img = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, n = vnoise(x * 0.08, y * 0.08) * 0.6 + vnoise(x * 0.5, y * 0.03) * 0.4;
      const k = 0.88 + n * 0.14;
      img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
      if (y > h - 14 && vnoise(x * 0.6, 3.3) * 14 > h - y) img.data[i + 3] = 0; // frayed bottom edge
    }
    g.putImageData(img, 0, 0);
  });
  const weave = normalTex(64, (x, y) => (Math.sin(x * Math.PI / 2) * 0.5 + Math.sin(y * Math.PI / 2) * 0.5) * 0.5 + vnoise(x * 0.3, y * 0.3) * 0.3, 2.2);
  weave.repeat.set(5, 6);
  const flagMat = new THREE.MeshStandardMaterial({ map: flagPrint, normalMap: weave, normalScale: new Vector2(0.5, 0.5), roughness: 0.92, side: THREE.DoubleSide, alphaTest: 0.5, transparent: true });
  flagMats.push(flagMat);
  const backU = { value: 0.0 };
  flagMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time; sh.uniforms.uBack = backU;
    // wind: two travelling waves plus a flutter at the free edge; the normal follows the analytic slope so the
    // folds catch the light. Thin cotton glows where the low sun shines through it.
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
    sh.fragmentShader = 'uniform float uBack;\nvarying float vFold;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      diffuseColor.rgb *= 1.0 - 0.2 * abs(vFold);
      totalEmissiveRadiance += diffuseColor.rgb * uBack * (0.6 + 0.7 * (1.0 - abs(vFold)));`);
  };
  {
    const FLAG_COLS = [0x2f5ea8, 0xeeeae0, 0xb4312b, 0x2f7d4c, 0xe0b23a].map((c) => new Color(c));
    const flagGeo = new THREE.PlaneGeometry(0.24, 0.3, 10, 10).translate(0, -0.15, 0);
    // strung from the rocks on the left, across the view, to an anchor out of frame on the right
    const lines = [
      [new Vector3(-6.5, 4.1, -5.5), new Vector3(5.0, 4.6, -11.5), 1.0],
      [new Vector3(-6.0, 4.9, -4.2), new Vector3(1.2, 4.7, -13.0), 0.9],
    ];
    const spots = [];
    const stringMat = new THREE.MeshStandardMaterial({ color: 0x3a322a, roughness: 0.9, transparent: true });
    flagMats.push(stringMat);
    lines.forEach(([a, b, sag]) => {
      const pts = catenary(a, b, sag, 70);
      flagsG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.005, 4, false), stringMat));
      let acc = 0.12;
      for (let i = 1; i < pts.length; i++) {
        const seg = pts[i].distanceTo(pts[i - 1]);
        acc += seg;
        while (acc >= 0.31) {
          acc -= 0.31;
          const t = 1 - acc / seg;
          const p = pts[i - 1].clone().lerp(pts[i], t);
          const dir = pts[i].clone().sub(pts[i - 1]).normalize();
          spots.push({ p, yaw: Math.atan2(-dir.z, dir.x) });
        }
      }
    });
    const flags = new THREE.InstancedMesh(flagGeo, flagMat, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new Vector3(1, 1, 1);
    spots.forEach((f, i) => {
      e.set(0, f.yaw, 0, 'YXZ'); q.setFromEuler(e);
      s.set(1, 0.92 + rnd() * 0.16, 1);
      m4.compose(f.p, q, s); flags.setMatrixAt(i, m4);
      const c = FLAG_COLS[i % 5].clone().lerp(new Color(0.86, 0.83, 0.76), rnd() * rnd() * 0.5).multiplyScalar(0.8 + rnd() * 0.18);
      flags.setColorAt(i, c);
    });
    flags.frustumCulled = false;
    flagsG.add(flags);
  }
  await tick(0);
  // marigold garland: tied to the lower line near its left end, hanging in one swag
  {
    const PS = 128, ROWS = 7, COLS = 11, ph = new Float32Array(PS * PS);
    for (let y = 0; y < PS; y++) for (let x = 0; x < PS; x++) {
      const v = (y / PS) * ROWS, j = Math.floor(v), t = v - j;
      const c = (x / PS) * COLS + j * 0.5 + vnoise(j * 3.1, x * 0.05) * 0.6;
      const cf = c - Math.floor(c);
      ph[y * PS + x] = Math.pow(Math.sin(Math.PI * cf), 0.6) * Math.pow(1 - t, 0.6) + vnoise(x * 0.6, y * 0.6) * 0.25;
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
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: petalC, normalMap: petalN, normalScale: new Vector2(1.1, 1.1), roughness: 0.72, transparent: true });
    flagMats.push(mat);
    // points on the lower line (same catenary as above) a third of the way along
    const line = catenary(new Vector3(-6.5, 4.1, -5.5), new Vector3(5.0, 4.6, -11.5), 1.0, 70);
    const a = line[8], b = line[17];
    const strands = [catenary(a, b, 0.42, 40)];
    const spots = [];
    strands.forEach((pts) => {
      let acc = 0;
      for (let i = 1; i < pts.length; i++) {
        const seg = pts[i].distanceTo(pts[i - 1]); acc += seg;
        while (acc >= 0.034) { acc -= 0.034; spots.push(pts[i - 1].clone().lerp(pts[i], 1 - acc / seg)); }
      }
    });
    const per = 2;
    const mm = new THREE.InstancedMesh(g, mat, spots.length * per);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new Vector3();
    const cA = new Color(0xe5780c), cB = new Color(0xf3a915), cC = new Color(0xd85f0a);
    let n = 0;
    spots.forEach((pt, i) => {
      for (let j = 0; j < per; j++) {
        const off = new Vector3((rnd() - 0.5) * 0.012, (rnd() - 0.5) * 0.012, j ? 0.014 : -0.006);
        e.set(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3); q.setFromEuler(e);
        const sc = 0.02 + rnd() * 0.008; s.set(sc, sc * (0.85 + rnd() * 0.2), sc);
        m4.compose(pt.clone().add(off), q, s); mm.setMatrixAt(n, m4);
        const band = Math.floor(i / 9) % 3;
        mm.setColorAt(n, (band === 0 ? cA : band === 1 ? cB : cC).clone().lerp(rnd() < 0.5 ? cB : cC, rnd() * 0.35).multiplyScalar(0.82 + rnd() * 0.22));
        n++;
      }
    });
    mm.frustumCulled = false;
    flagsG.add(mm);
  }
  await tick(0);
  // the low sun: behind and to the right of the flags (it is in the photograph at about this direction)
  const sun = new THREE.DirectionalLight(0xffd2a0, 2.2);
  sun.position.copy(dirU(0.6, 4)).multiplyScalar(20).add(eye);
  sun.target.position.copy(eye);
  const skyFill = new THREE.HemisphereLight(0x9fb6d8, 0x5a4634, 0.12);
  scene.add(sun, sun.target, skyFill);

  /* ---------- the room: key light from the warm pendant bulbs, fire glow from the real fireplace */
  const key = new THREE.SpotLight(0xffc796, 5.5, 0, 0.62, 0.85, 2);
  key.position.copy(L(0.35, 2.75, 0.15));
  key.target.position.copy(L(0, TY, -0.05));
  if (tier >= 1) {
    key.castShadow = true;
    key.shadow.mapSize.set(tier === 2 ? 2048 : 1024, tier === 2 ? 2048 : 1024);
    key.shadow.camera.near = 1.0; key.shadow.camera.far = 4.0;
    key.shadow.bias = -0.0002; key.shadow.normalBias = 0.01; key.shadow.radius = 5;
    key.shadow.autoUpdate = false; key.shadow.needsUpdate = true;
  }
  const fireL = new THREE.PointLight(0xff8a3a, 3.2, 0, 2);
  fireL.position.copy(L(0, 0.9, 0)).addScaledVector(dirU(FIRE_U), 1.6);
  const diyaL = new THREE.PointLight(0xffa04a, 0, 1.6, 2);
  diyaL.position.copy(L(diyaAt.x, TY + 0.1, diyaAt.z));
  // the room lights stay in the scene at all times and are faded by intensity: the light set (part of every
  // program's key) never changes, so no shader recompiles when the dissolve reaches the room
  scene.add(key, key.target, fireL, diyaL);

  // shadow catchers: the floor of the photograph under the table, and soft contact shadows
  const floorCatch = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ color: 0x1a0c04, opacity: 0.5, depthWrite: false }));
  floorCatch.rotation.x = -Math.PI / 2; floorCatch.position.y = 0.002; floorCatch.receiveShadow = tier >= 1;
  const blobTex = canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.8)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false, color: 0x1a0d05 });
  const blob = (x, z, rx, rz, y, op) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, rz * 2), blobMat.clone());
    m.material.opacity = op; m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.0015, z); m.renderOrder = 1;
    tableG.add(m); return m;
  };
  tableG.add(floorCatch);
  blob(0, 0, 0.8, 0.56, 0, 0.8); // ambient occlusion of the table on the floor
  blob(0, 0, 0.6, 0.38, 0.001, 0.55);
  [[-0.53, -0.32], [0.53, -0.32], [-0.53, 0.32], [0.53, 0.32]].forEach(([x, z]) => blob(x, z, 0.07, 0.07, 0.002, 0.9)); // feet

  /* ---------- model loading (maps the framing does not need are dropped before parsing, so never requested) */
  const gltfLoader = new GLTFLoader();
  async function loadModel(id, opt = {}) {
    try {
      const base = `${A}/models/${id}/`;
      const r = await fetch(`${base}${id}_1k.gltf`);
      if (!r.ok) return null;
      const json = await r.json();
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
        trackB(m, opt.env ?? 1);
        if (/glass/.test(m.name)) { m.transparent = true; m.opacity = 0.3; m.roughness = 0.05; m.depthWrite = false; o.castShadow = false; }
        if (/flame/.test(m.name)) { m.emissive = new Color(1, 0.62, 0.25); m.emissiveIntensity = 6; m.depthWrite = false; o.castShadow = false; }
      });
      return obj;
    } catch (e) { return null; }
  }
  async function prepare(obj) { // upload textures one per task
    const texs = new Set();
    obj.traverse((o) => {
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach((m) => ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'].forEach((k) => { if (m[k]) texs.add(m[k]); }));
    });
    for (const t of texs) { if (renderer.properties.get(t).__webglTexture === undefined) { renderer.initTexture(t); await tick(0); } }
  }

  await tick(0);
  /* ---------- the thali (brass plate, katoris, rice, dal, greens, curry, pickle): illustrative food */
  const brassRough = canvasTex(128, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = vnoise(x * 0.05, y * 0.05) * 0.55 + vnoise(x * 0.2, y * 0.6) * 0.25 + vnoise(x * 0.9, y * 0.9) * 0.2;
      const v = 255 * (0.34 + n * 0.3), i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, false);
  const brass = trackB(new THREE.MeshStandardMaterial({ color: new Color(0.72, 0.52, 0.27), metalness: 1, roughness: 1, roughnessMap: brassRough }), 0.85);
  const food = new THREE.Group();
  food.position.set(-0.19, TY, 0.08);
  food.visible = false;
  tableG.add(food);
  const plate = new THREE.Mesh(lathe([[0, 0.002], [0.15, 0.002], [0.158, 0.005], [0.17, 0.019], [0.175, 0.024], [0.169, 0.024], [0.157, 0.01], [0.145, 0.008], [0, 0.008]], 96), brass);
  plate.castShadow = plate.receiveShadow = tier >= 1;
  food.add(plate);
  await tick(0);
  const katoriG = lathe([[0, 0], [0.028, 0], [0.04, 0.008], [0.046, 0.026], [0.047, 0.034], [0.044, 0.034], [0.043, 0.026], [0.037, 0.011], [0.026, 0.005], [0, 0.005]], 64);
  const ripple = normalTex(128, (x, y) => vnoise(x * 0.09, y * 0.09) * 0.6 + vnoise(x * 0.25, y * 0.25) * 0.4, 3.5);
  const dalMat = trackB(new THREE.MeshStandardMaterial({ vertexColors: true, color: new Color(0.6, 0.42, 0.15), roughness: 0.3, normalMap: ripple, normalScale: new Vector2(0.6, 0.6) }), 0.8);
  const saagMat = trackB(new THREE.MeshStandardMaterial({ vertexColors: true, color: new Color(0.13, 0.16, 0.06), roughness: 0.5, normalMap: ripple, normalScale: new Vector2(1.6, 1.6) }), 0.7);
  const curryMat = trackB(new THREE.MeshStandardMaterial({ vertexColors: true, color: new Color(0.4, 0.17, 0.07), roughness: 0.32, normalMap: ripple, normalScale: new Vector2(0.8, 0.8) }), 0.8);
  const acharMat = trackB(new THREE.MeshStandardMaterial({ vertexColors: true, color: new Color(0.42, 0.13, 0.05), roughness: 0.26, normalMap: ripple, normalScale: new Vector2(0.3, 0.3) }), 0.8);
  const potatoMat = trackB(new THREE.MeshStandardMaterial({ color: new Color(0.85, 0.6, 0.22), roughness: 0.5 }), 0.6);
  const gheeMat = trackB(new THREE.MeshStandardMaterial({ color: new Color(0.95, 0.6, 0.1), roughness: 0.08 }), 1);
  const redOilMat = trackB(new THREE.MeshStandardMaterial({ color: new Color(0.72, 0.15, 0.02), roughness: 0.08 }), 1);
  const herbMat = trackB(new THREE.MeshStandardMaterial({ color: new Color(0.11, 0.26, 0.05), roughness: 0.55, side: THREE.DoubleSide }), 0.5);
  const surfH = (x, z, r, h, f, seed) => { const d = Math.min(1, Math.hypot(x, z) / r); return h * (1 - d * d) * (0.7 + 0.6 * vnoise(x * f + seed, -z * f - seed)); };
  const mound = (r, h, mat, seed, f = 120) => {
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
    surf.position.y = lvl; k.add(surf);
    const sAt = (sx, sz) => surfH(sx, sz, R, h, f, seed);
    if (mat === curryMat) {
      const pg = new RoundedBoxGeometry(0.014, 0.012, 0.013, 2, 0.004);
      const pc = new THREE.InstancedMesh(pg, potatoMat, 6); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion();
      for (let j = 0; j < 6; j++) { q.setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd())); m4.compose(new Vector3((rnd() - 0.5) * 0.05, lvl + 0.002, (rnd() - 0.5) * 0.05), q, new Vector3(1, 1, 1)); pc.setMatrixAt(j, m4); }
      k.add(pc);
      scatter(k, beadG, redOilMat, 16, 0.036, lvl, 0.0022, 0.00035, 0, sAt);
      scatter(k, flakeG, herbMat, 9, 0.03, lvl + 0.0006, 0.0026, 0, 0.5, sAt);
    }
    if (mat === dalMat) {
      const sg = new THREE.SphereGeometry(1, 6, 4);
      const sm = trackB(new THREE.MeshStandardMaterial({ roughness: 0.5 }), 0.4);
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
  await tick(0);
  {
    const riceMat = trackB(new THREE.MeshStandardMaterial({ color: new Color(1.0, 0.95, 0.83), roughness: 0.34, emissive: new Color(0.045, 0.036, 0.022) }), 0.55);
    const heap = (th, ph) => 1 + 0.12 * (vnoise(Math.cos(th) * 3 + 5, Math.sin(th) * 3 + ph * 2) - 0.5) + 0.06 * Math.sin(th * 3 + 1);
    const baseG = new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    { const p = baseG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = heap(Math.atan2(z, x), Math.acos(clamp(y, -1, 1))); p.setXYZ(i, x * k, y * k, z * k); } baseG.computeVertexNormals(); }
    const baseMat = trackB(riceMat.clone(), 0.5); baseMat.color.setRGB(0.92, 0.85, 0.7);
    const base = new THREE.Mesh(baseG, baseMat);
    base.scale.set(0.062, 0.018, 0.05); base.position.set(-0.005, 0.008, 0.045); food.add(base);
    const n = tier === 0 ? 500 : 2400;
    const grain = new THREE.CapsuleGeometry(0.0011, 0.0056, 2, 5);
    const rice = new THREE.InstancedMesh(grain, riceMat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new Vector3(0, 1, 0), nrm = new Vector3(), tan = new Vector3(), sc = new Vector3();
    const cIvory = new Color(1, 0.985, 0.95), cWarm = new Color(1, 0.94, 0.84), c = new Color();
    for (let i = 0; i < n; i++) {
      const loose = i < n * 0.03;
      const th = rnd() * Math.PI * 2, ph = loose ? Math.PI / 2 - 0.02 : Math.acos(rnd() * 0.98);
      nrm.set(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
      const k = loose ? 1.08 + rnd() * 0.22 : heap(th, ph) * (0.99 + rnd() * 0.04);
      const pos = new Vector3(nrm.x * 0.063 * k, loose ? 0.001 : nrm.y * 0.02 * k, nrm.z * 0.052 * k).add(base.position);
      tan.set(-Math.sin(th), 0, Math.cos(th)).applyAxisAngle(nrm, rnd() * 6.28);
      if (loose) tan.set(rnd() - 0.5, 0, rnd() - 0.5);
      q.setFromUnitVectors(up, tan.normalize());
      const s = 0.85 + rnd() * 0.3; sc.set(s, 0.8 + rnd() * 0.4, s);
      m4.compose(pos, q, sc); rice.setMatrixAt(i, m4);
      const shade = (loose ? 0.95 : 0.8 + 0.2 * Math.pow(nrm.y, 0.6)) * (0.92 + rnd() * 0.08) * (k < 1 ? 0.94 : 1);
      rice.setColorAt(i, c.copy(cIvory).lerp(cWarm, rnd()).multiplyScalar(shade * (0.9 + rnd() * 0.1) * (rnd() < 0.1 ? 1.12 : 1)));
    }
    rice.castShadow = false; rice.receiveShadow = tier >= 1;
    food.add(rice);
  }
  blob(-0.19, 0.08, 0.2, 0.2, TY, 0.55);

  await tick(0);
  /* ---------- the momo steamer: woven bamboo, pleated dumplings, a lid lifted by scroll */
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
  const bambooMat = trackB(new THREE.MeshStandardMaterial({ map: bamboo, roughness: 0.62, side: THREE.DoubleSide }), 0.55);
  const weaveMat = trackB(new THREE.MeshStandardMaterial({ map: weaveCol, roughness: 0.75, side: THREE.DoubleSide }), 0.5);
  const SX = 0.14, SZ = -0.13;
  const steamer = new THREE.Group();
  steamer.position.set(SX, TY, SZ);
  steamer.visible = false;
  tableG.add(steamer);
  const SR = 0.115;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(SR, SR, 0.068, 64, 1, true), bambooMat);
  wall.position.y = 0.034; wall.castShadow = wall.receiveShadow = tier >= 1; steamer.add(wall);
  const wallIn = new THREE.Mesh(new THREE.CylinderGeometry(SR - 0.006, SR - 0.006, 0.066, 64, 1, true), bambooMat);
  wallIn.position.y = 0.034; steamer.add(wallIn);
  const rimG = new THREE.TorusGeometry(SR - 0.003, 0.0035, 8, 64);
  [0.0035, 0.0675].forEach((y) => { const r = new THREE.Mesh(rimG, bambooMat); r.rotation.x = Math.PI / 2; r.position.y = y; steamer.add(r); });
  const floorDisc = new THREE.Mesh(new THREE.CircleGeometry(SR - 0.005, 48), weaveMat);
  floorDisc.rotation.x = -Math.PI / 2; floorDisc.position.y = 0.012; floorDisc.receiveShadow = tier >= 1; steamer.add(floorDisc);
  await tick(0);
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
      const pleat = sstep(-0.05, 0.55, y) * (1 - sstep(0.88, 1.0, y));
      const wob = Math.sin(phi * 2.0 + 0.7) * 0.32 + Math.sin(phi * 3.0 + 2.1) * 0.18;
      const ridge01 = Math.pow(Math.abs(Math.sin(phi * 5.5 + wob + y * (5.0 + wob * 2.0))), 0.35);
      const ridgeP = ridge01 * 2 - 1;
      const depth = 0.75 + 0.5 * vnoise(phi * 1.6 + 20, 3.1);
      w *= 1 + 0.2 * pleat * ridgeP * depth;
      w *= 1 + 0.05 * Math.sin(phi + 0.4) * (1 - Math.abs(y));
      let yy = y < 0 ? y * 0.36 : y * 0.8 + pleat * 0.06 * ridgeP * depth;
      if (y > 0.86) { yy += (y - 0.86) * 0.8; w *= 0.6; }
      if (y < 0 && y > -0.8) w *= 1.05;
      p.setXYZ(i, x * w, yy, z * w);
      const mott = vnoise(x * 3.3 + 7, z * 3.3 + y * 2.0 + 3) * 0.6 + vnoise(x * 9 + 1, z * 9 - y * 6) * 0.4;
      const shoulder = sstep(-0.3, 0.15, y) * (1 - sstep(0.35, 0.7, y));
      const c = 1 - 0.46 * pleat * (1 - ridge01) * depth - (y < -0.2 ? 0.12 : 0) - 0.12 * shoulder * mott;
      const spot = sstep(0.7, 0.82, vnoise(x * 4.5 + 11, z * 4.5 + y * 3.5 + 5)) * (y < 0.75 ? 1 : 0);
      col[i * 3] = c * (1 - 0.02 * mott) * (1 - 0.12 * spot); col[i * 3 + 1] = c * (0.955 - 0.03 * shoulder * mott) * (1 - 0.22 * spot); col[i * 3 + 2] = c * (0.89 - 0.06 * shoulder * mott) * (1 - 0.38 * spot);
    }
    mg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    mg.computeVertexNormals();
  }
  await tick(0);
  // steamed dough: pale, soft, slightly translucent (a warm emissive lift where light would scatter through)
  const doughMat = trackB(new THREE.MeshStandardMaterial({
    vertexColors: true, color: new Color(0.78, 0.72, 0.6), roughness: 0.62, emissive: new Color(0.06, 0.045, 0.025),
  }), 0.6);
  const momoCount = 6;
  const momos = new THREE.InstancedMesh(mg, doughMat, momoCount);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < momoCount; i++) {
      const a = (i / (momoCount - 1)) * Math.PI * 2 + (rnd() - 0.5) * 0.25, rr = i === momoCount - 1 ? 0.006 : 0.062 + rnd() * 0.006;
      const sc = 0.027 + rnd() * 0.004;
      q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.16, rnd() * 6.28, (rnd() - 0.5) * 0.16));
      m4.compose(new Vector3(Math.cos(a) * rr, 0.012 + sc * 0.42, Math.sin(a) * rr), q, new Vector3(sc * (0.96 + rnd() * 0.08), sc * (0.88 + rnd() * 0.12), sc * (0.96 + rnd() * 0.08)));
      momos.setMatrixAt(i, m4);
      momos.setColorAt(i, new Color(1, 1, 1).lerp(new Color(1.0, 0.9, 0.74), rnd() * 0.6).multiplyScalar(0.92 + rnd() * 0.1));
    }
  }
  momos.castShadow = tier >= 1; momos.receiveShadow = tier >= 1;
  steamer.add(momos);
  const lid = new THREE.Group();
  const lidWall = new THREE.Mesh(new THREE.CylinderGeometry(SR + 0.004, SR + 0.004, 0.048, 64, 1, true), bambooMat);
  lidWall.position.y = 0.024; lidWall.castShadow = tier >= 1; lid.add(lidWall);
  const lidTop = new THREE.Mesh(new THREE.CircleGeometry(SR + 0.004, 48), weaveMat);
  lidTop.rotation.x = -Math.PI / 2; lidTop.position.y = 0.045; lidTop.castShadow = tier >= 1; lid.add(lidTop);
  const lidRim = new THREE.Mesh(new THREE.TorusGeometry(SR + 0.003, 0.004, 8, 64), bambooMat); lidRim.rotation.x = Math.PI / 2; lidRim.position.y = 0.046; lid.add(lidRim);
  lid.position.y = 0.0685;
  steamer.add(lid);
  blob(SX, SZ, 0.15, 0.15, TY, 0.6);

  /* ---------- steam */
  function makeSteam(parent, x, y, z, w, h, seed, color = new Color(0.95, 0.9, 0.84)) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.ShaderMaterial({
      vertexShader: STEAM_VERT, fragmentShader: STEAM_FRAG, transparent: true, depthWrite: false,
      uniforms: { uTime: U.time, uAmount: { value: 1 }, uSeed: { value: seed }, uColor: { value: color } },
    }));
    m.position.set(x, y, z); m.scale.set(w, h, 1); m.renderOrder = 2; m.frustumCulled = false; m.visible = false;
    parent.add(m); steams.push(m);
    return m;
  }
  const momoSteam = [makeSteam(tableG, SX, TY + 0.07, SZ, 0.3, 0.5, 0.3), makeSteam(tableG, SX + 0.02, TY + 0.07, SZ - 0.02, 0.24, 0.42, 1.7)];
  const dalSteam = makeSteam(tableG, -0.1, TY + 0.03, 0.02, 0.13, 0.26, 2.9);

  /* ---------- glow for the diya flame */
  const glowTex = canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,220,160,0.8)'); gr.addColorStop(0.12, 'rgba(255,175,85,0.42)'); gr.addColorStop(0.4, 'rgba(255,135,55,0.1)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  glow.renderOrder = 3;

  /* ---------- sizing and the camera */
  let W = 1, H = 1, portrait = false;
  function resize() {
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    portrait = W / H < 0.9;
    wake();
  }
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(resize, 140); };
  window.addEventListener('resize', onResize);

  let uCur = 0, uTgt = 0, paused = !!opts.paused, clock = 0, lost = false, tabVisible = !document.hidden, inView = true;
  let bReady = false, roomMix = 0;
  const camPos = new Vector3(), camQ = new THREE.Quaternion();
  const sv = (u, k) => { const i = Math.min(Math.floor(u), ST.length - 2), f = easeIO(u - i); return lerp(ST[i][k], ST[i + 1][k], f); };
  function applyCamera() {
    const u = clamp(uCur, 0, ST.length - 1);
    const i = Math.min(Math.floor(u), ST.length - 2), f = easeIO(u - i);
    const a = ST[i], b = ST[i + 1];
    camPos.lerpVectors(a.p, b.p, f);
    camQ.slerpQuaternions(a.q, b.q, f);
    if (!paused && !reduce) { // a slow breath of handheld drift, frozen when motion is paused
      camPos.x += Math.sin(clock * 0.21) * 0.006; camPos.y += Math.sin(clock * 0.17 + 1.3) * 0.004;
    }
    camera.position.copy(camPos);
    camera.quaternion.copy(camQ);
    camera.fov = sv(u, 'fov') * (portrait ? 1.3 : 1);
    const sx = portrait ? 0 : sv(u, 'sx') * clamp((W / H) / 1.6, 0.6, 1.2);
    const sy = portrait ? sv(u, 'sy') : 0;
    camera.setViewOffset(W, H, -sx * W, sy * H, W, H);
    camera.updateProjectionMatrix();
    renderer.toneMappingExposure = sv(u, 'ex');
    pano.position.copy(camPos); // the photograph is at infinity: it travels with the camera
    // the dissolve from the dusk lookout into the room, while the camera walks under the flags
    // (a shorter, eased dissolve: the camera first walks under the flags, then the room comes through)
    const mix = bReady ? sstep(0.42, 0.8, u) : 0;
    roomMix = mix;
    panoMat.uniforms.uMix.value = mix;
    panoMat.uniforms.uBlur.value = sv(u, 'blur') * (tier === 0 ? 0.7 : 1);
    flagsG.visible = mix < 0.999;
    const fo = 1 - sstep(0.0, 0.7, mix); // the cloth fades out with the dusk photograph, never pops
    flagMats.forEach((m) => { m.opacity = fo; });
    tableG.visible = bReady && mix > 0.001;
  }

  // tea set (loaded later); pour pose computed once the model is in
  const tea = { drops: [], pot: null, potInner: null, rest: new THREE.Matrix4(), pour: new THREE.Matrix4(), tip: new Vector3(), cup: new Vector3(), stream: null, liquid: null, steam: null };
  const _p = new Vector3(), _q = new THREE.Quaternion(), _s = new Vector3(), _p2 = new Vector3(), _q2 = new THREE.Quaternion(), _s2 = new Vector3();
  let diyaOn = false;

  function updateScene() {
    const u = uCur, t = clock;
    U.time.value = t;
    backU.value = 0.32; // the low sun shines through the cotton
    // the lid is lifted and set ajar on the rim (it rests on the steamer: never floats)
    const open = easeIO(sstep(1.3, 1.95, u));
        lid.position.set(0.085 * open, 0.0685, -0.03 * open);
    lid.rotation.set(0, 0.4 * open, 0);
    const burst = sstep(1.3, 2.0, u) * (1 - 0.5 * sstep(2.3, 3.2, u));
    momoSteam[0].material.uniforms.uAmount.value = 0.15 + burst * 1.0;
    momoSteam[1].material.uniforms.uAmount.value = burst * 0.8;
    dalSteam.material.uniforms.uAmount.value = 0.3;
    if (tea.pot) {
      const pour = easeIO(sstep(2.45, 2.95, u)) * (1 - easeIO(sstep(3.3, 3.75, u)));
      tea.rest.decompose(_p, _q, _s); tea.pour.decompose(_p2, _q2, _s2);
      _p.lerp(_p2, pour); _q.slerp(_q2, pour);
      tea.pot.position.copy(_p); tea.pot.quaternion.copy(_q);
      tea.pot.updateMatrixWorld(true);
      const level = sstep(2.62, 3.05, u);
      const cupY = tea.cup.y + 0.012 + level * 0.04;
      tea.liquid.position.set(tea.cup.x, cupY, tea.cup.z);
      tea.liquid.scale.setScalar(lerp(0.03, 0.04, level));
      tea.liquid.visible = level > 0.01;
      const flowing = pour > 0.92 && u < 3.32;
      tea.stream.visible = flowing;
      tea.drops.forEach((d) => { d.visible = flowing; });
      if (flowing) {
        _p.copy(tea.tip).applyMatrix4(tea.potInner.matrixWorld);
        tableG.worldToLocal(_p);
        const gap = Math.max(0.01, _p.y - cupY), len = gap * 0.7;
        tea.stream.position.copy(_p);
        const wob = 1 + Math.sin(t * 23) * 0.08;
        tea.stream.scale.set(wob, len, wob);
        tea.drops.forEach((d, k) => { const f = (t * 2.6 + k / 3) % 1; d.position.set(_p.x, _p.y - len - f * (gap - len), _p.z); d.scale.set(1, 1.3, 1); });
      }
      tea.steam.material.uniforms.uAmount.value = level * 0.8;
      tea.steam.position.set(tea.cup.x, cupY, tea.cup.z);
    }
    // the fire in the photograph flickers: so does its light on the props
    const fl = 1 + 0.08 * Math.sin(t * 12.7) + 0.05 * Math.sin(t * 23.1 + 1.2) + 0.04 * Math.sin(t * 37.3);
    fireL.intensity = 3.2 * roomMix * (1 + 0.12 * Math.sin(t * 8.1) + 0.08 * Math.sin(t * 17.3 + 1));
    key.intensity = 5.5 * roomMix;
    sun.intensity = 2.2 * (1 - roomMix); skyFill.intensity = 0.12 * (1 - roomMix);
    if (diyaOn) {
      const lit = sstep(3.9, 4.8, u);
      diyaL.intensity = 0.35 * lit * fl * roomMix;
      glow.material.opacity = 0.85 * lit * (0.95 + (fl - 1) * 0.6);
    }
  }

  let shadowU = -1;
  function draw() {
    applyCamera();
    updateScene();
    // the only moving casters (steamer lid, teapot) follow the scroll position: redraw the shadow map only then
    if (key.castShadow && tableG.visible && uCur !== shadowU) { shadowU = uCur; key.shadow.needsUpdate = true; }
    renderer.render(scene, camera);
  }

  /* ---------- loop (one rAF at most; sleeps when paused and settled, off-screen or hidden) */
  let raf = 0, last = 0, guard = tier >= 1, frames = 0, slow = 0;
  const canRun = () => !lost && tabVisible && inView;
  function frame(ts) {
    raf = 0;
    if (!canRun()) return;
    const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000 || 0.016)); last = ts;
    if (reduce) uCur = uTgt;
    else {
      uCur += (uTgt - uCur) * (1 - Math.exp(-dt * 3.6));
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
  function degrade() { // shed cost in stages, then stop watching
    if (pr > 1) { pr = Math.max(1, pr - 0.25); resize(); return; }
    if (key.castShadow && key.shadow.mapSize.x > 1024) { key.shadow.mapSize.set(1024, 1024); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } key.shadow.needsUpdate = true; return; }
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
    // three re-creates its GL state; RGBE data and canvases re-upload from their kept sources. The photographs were
    // uploaded by hand: they are uploaded again in strips (poster still shown), shaders are compiled, then the
    // scene comes back. Objects of the dead context are forgotten, not disposed.
    lost = false;
    if (key.castShadow) { key.shadow.map = null; key.shadow.needsUpdate = true; }
    shadowU = -1;
    resize();
    (async () => {
      const ts = [...new Set([panoMat.uniforms.mapA.value, panoMat.uniforms.mapB.value])].filter(Boolean);
      for (const t of ts) { if (!(await uploadPano(t)) || lost) return; }
      await compileFor(scene);
      if (lost) return;
      opts.onRestored && opts.onRestored();
      wake();
    })();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  async function compileFor(obj) {
    if (renderer.getContext().isContextLost()) return;
    renderer.setRenderTarget(null);
    let p = null;
    try { p = renderer.compileAsync(obj, camera, scene); } catch (e) { /* compiles on first draw instead */ }
    if (p) await Promise.race([p.catch(() => {}), tick(4000)]);
  }
  // the shadow pass uses three's internal depth materials: their variants (one/double-sided, instanced, alpha-tested)
  // are compiled ahead so the first shadow render in the room does not stall
  async function warmShadows() {
    if (!renderer.shadowMap.enabled) return;
    const rt = new THREE.WebGLRenderTarget(4, 4);
    const geo = new THREE.BoxGeometry(), g = new THREE.Group();
    [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide].forEach((side) => {
      const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side });
      g.add(new THREE.Mesh(geo, dm), new THREE.InstancedMesh(geo, dm, 1));
    });
    g.traverse((o) => { o.frustumCulled = false; });
    renderer.setRenderTarget(rt);
    let p = null;
    try { p = renderer.compileAsync(g, camera, scene); } catch (e) { /* first shadow pass compiles instead */ }
    renderer.setRenderTarget(null); // before any await: frames in between must keep drawing to the canvas
    if (p) await Promise.race([p.catch(() => {}), tick(6000)]);
    geo.dispose(); rt.dispose();
  }
  const warmCam = new THREE.PerspectiveCamera(40, 1, 0.03, 120);
  warmCam.layers.set(1);
  [sun, skyFill, key, fireL, diyaL].forEach((l) => l.layers.enable(1));
  async function warmDraw(obj) {
    if (lost || renderer.getContext().isContextLost()) return;
    const s2 = ST[2], s3 = ST[3];
    for (const s of [s2, s3]) {
      warmCam.position.copy(s.p); warmCam.quaternion.copy(s.q); warmCam.aspect = camera.aspect; warmCam.updateProjectionMatrix();
      const vis = tableG.visible, ov = obj.visible;
      tableG.visible = true; obj.visible = true;
      obj.traverse((o) => o.layers.enable(1));
      const su = key.shadow.needsUpdate; key.shadow.needsUpdate = false;
      renderer.setRenderTarget(null);
      renderer.setScissorTest(true); renderer.setScissor(0, 0, 1, 1);
      renderer.render(scene, warmCam);
      renderer.setScissorTest(false);
      key.shadow.needsUpdate = su;
      obj.traverse((o) => o.layers.disable(1));
      tableG.visible = vis; obj.visible = ov;
      if (ready) draw(); // the visitor's frame is drawn again in the same task: the 1 px warm draw is never seen
      await tick(16);
    }
  }
  const setEnv = (group, env) => group.traverse((o) => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if ('envMap' in m && !(m instanceof THREE.ShaderMaterial) && !(m instanceof THREE.ShadowMaterial) && !(m instanceof THREE.SpriteMaterial) && !(m instanceof THREE.MeshBasicMaterial)) { m.envMap = env; m.envMapIntensity = m.userData.env ?? 0.8; m.needsUpdate = true; } });
  });

  /* ---------- phase A: the dusk photograph and the flags, then the first frame */
  const [texA, eA] = await Promise.all([loadPano(0), loadEnv(0)]);
  if (!texA) return null;
  progress(0.75);
  envA = eA;
  if (envA) flagMats.forEach((m) => { m.envMap = envA; m.envMapIntensity = 0.32; m.needsUpdate = true; });
  panoMat.uniforms.mapA.value = texA; panoMat.uniforms.mapB.value = texA;
  resize();
  uCur = uTgt;
  // the photograph's upload (strips, then mipmaps): done while the poster is still shown
  if (!(await uploadPano(texA))) return null;
  for (const t of [flagPrint, weave]) { renderer.initTexture(t); await tick(0); }
  tableG.visible = false;
  scene.remove(tableG); // the room's props compile later, once their light map is in (phase B)
  await compileFor(scene); // the photograph and the arrival cloth, for the final light set
  scene.add(tableG);
  if (lost || renderer.getContext().isContextLost()) return null;
  draw();
  ready = true;
  progress(1);
  wake();

  /* ---------- phase B (idle time): the room photograph, its light, the table and the props */
  (async () => {
    await tick(60);
    const [texB, eB] = await Promise.all([loadPano(1), loadEnv(1)]);
    if (!texB || lost) return;
    envB = eB;
    if (!(await uploadPano(texB)) || lost) return;
    panoMat.uniforms.mapB.value = texB;
    if (envB) propMats.forEach((m) => { m.envMap = envB; m.envMapIntensity = m.userData.env ?? 1; m.needsUpdate = true; });
    // the procedural thali and steamer first (no downloads), compiled hidden, then shown
    food.visible = true; steamer.visible = true; steams.forEach((s) => { s.visible = true; });
    for (const t of [brassRough, ripple, bamboo, weaveCol, blobTex, glowTex]) { renderer.initTexture(t); await tick(0); }
    await compileFor(tableG);
    await warmShadows(); // the room's shadow pass, before the room can be shown
    for (const o of [...food.children, ...steamer.children, ...steams, floorCatch]) await warmDraw(o);
    if (lost) return;
    bReady = true;
    wake();
    const place = async (id, fn, opt) => {
      if (lost) return;
      const m = await loadModel(id, opt);
      if (!m) return;
      await prepare(m);
      const g = new THREE.Group();
      g.visible = false;
      tableG.add(g);
      fn(m, g);
      if (envB) setEnv(g, envB);
      await compileFor(g);
      for (const o of g.children) await warmDraw(o);
      g.visible = true;
      shadowU = -1;
      wake();
      await tick(30);
    };
    await place('wooden_table_02', (m, g) => {
      // this scan's finish is a bright orange-red: knock it back toward the dark, oiled wood of the room
      // and toward the matte, grey-brown benches in the photograph: desaturated in the shader, darker, rougher
      m.traverse((o) => {
        if (!o.isMesh) return;
        const mt = o.material;
        mt.color.setRGB(0.54, 0.5, 0.47); mt.roughnessMap = null; mt.roughness = 0.8;
        mt.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, 0.42);
            #ifdef USE_MAP
              float gv = 0.86 + 0.1 * sin(vMapUv.x * 41.0 + sin(vMapUv.y * 7.0) * 2.5) + 0.06 * sin(vMapUv.y * 3.0 + vMapUv.x * 13.0);
              diffuseColor.rgb *= gv;
              vec2 eu = min(vMapUv, 1.0 - vMapUv);
              diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.35 + 0.03, (1.0 - smoothstep(0.0, 0.012, min(eu.x, eu.y))) * 0.5);
            #endif`);
        };
        mt.customProgramCacheKey = () => 'hc-table-desat';
      });
      g.add(m);
    }, { env: 0.45 });
    await place('brass_diya_lantern', (m, g) => {
      m.children.slice().forEach((c) => { if (/chain|connection/.test(c.name)) m.remove(c); });
      m.position.copy(diyaAt); m.rotation.y = 0.5; g.add(m);
      glow.position.set(diyaAt.x + 0.004, TY + 0.1, diyaAt.z); glow.scale.setScalar(0.32); g.add(glow);
      blob(diyaAt.x, diyaAt.z, 0.08, 0.08, TY, 0.6);
      diyaOn = true;
    }, { rough: 0.3, metal: 1, env: 1 });
    await place('food_lime_01', (m, g) => {
      [[0.06, 0.2, 0], [0.12, 0.23, 1.4], [0.09, 0.27, 2.6]].forEach(([x, z, r], i) => {
        const l = i ? m.clone() : m; l.position.set(x, TY + (tier >= 1 ? 0.016 : 0), z); l.rotation.set(i === 2 ? 1.4 : 0, r, 0); g.add(l);
        blob(x, z, 0.04, 0.04, TY + (tier >= 1 ? 0.016 : 0), 0.85); // contact shadow (also the only shadow on phones)
      });
    }, { noNormal: true, rough: 0.45, metal: 0, env: 0.8 });
    // phones (byte budget): no carved plate and no brass pot; the limes sit on the table
    if (tier >= 1) await place('carved_wooden_plate', (m, g) => {
      m.position.set(0.1, TY, 0.23); m.rotation.y = 0.3; g.add(m);
      blob(0.1, 0.23, 0.15, 0.14, TY, 0.45);
    }, { noNormal: tier < 2, env: 0.8 });
    if (tier >= 1) await place('brass_pot_01', (m, g) => {
      m.scale.setScalar(0.52); m.position.set(-0.08, TY, -0.24); m.rotation.y = 1.1; g.add(m);
      blob(-0.08, -0.24, 0.1, 0.1, TY, 0.55);
    }, { rough: 0.34, metal: 1, env: 1 });
    await place('tea_set_01', (m, g) => {
      const keep = ['tea_set_01_teapot_01', 'tea_set_01_teapot_01_lid', 'tea_set_01_cup_small_01', 'tea_set_01_saucer_circular_04'];
      const byName = {};
      m.children.slice().forEach((c) => { if (!keep.includes(c.name)) m.remove(c); else byName[c.name] = c; });
      const pot = byName.tea_set_01_teapot_01, potLid = byName.tea_set_01_teapot_01_lid;
      const cup = byName.tea_set_01_cup_small_01, saucer = byName.tea_set_01_saucer_circular_04;
      if (!pot || !cup || !saucer || !potLid) return;
      const CUPX = 0.4, CUPZ = 0.12;
      saucer.position.set(CUPX, TY, CUPZ); cup.position.set(CUPX, TY + 0.012, CUPZ); cup.rotation.y = 2.2;
      g.add(saucer, cup);
      blob(CUPX, CUPZ, 0.08, 0.08, TY, 0.5);
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
      const inner = new THREE.Group();
      pot.position.set(0, 0, 0); potLid.position.set(0, 0.002, 0);
      inner.add(pot, potLid);
      const pivot = new THREE.Group(); pivot.add(inner); g.add(pivot);
      tea.pot = pivot; tea.potInner = inner; tea.tip.copy(tip);
      tea.cup.set(CUPX, TY + 0.012, CUPZ);
      const restPos = new Vector3(0.45, TY, -0.12);
      const toCup = new Vector3(CUPX - restPos.x, 0, CUPZ - restPos.z).normalize();
      const tipDir = new Vector3(axisZ ? 0 : Math.sign(tip.x), 0, axisZ ? Math.sign(tip.z) : 0);
      const yaw = Math.atan2(tipDir.x, tipDir.z) - Math.atan2(toCup.x, toCup.z);
      const qRest = new THREE.Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -yaw);
      tea.rest.compose(restPos, qRest, new Vector3(1, 1, 1));
      const across = new Vector3(0, 1, 0).cross(toCup).normalize();
      let qPour = null, pourPos = null;
      const vv = new Vector3();
      for (let a = 0.8; a >= 0.3 && !qPour; a -= 0.05) {
        const q = new THREE.Quaternion().setFromAxisAngle(across, a).multiply(qRest);
        let minY = 1e9;
        for (let i = 0; i < pp.count; i += 5) { vv.fromBufferAttribute(pp, i).applyQuaternion(q); if (vv.y < minY) minY = vv.y; }
        const tw = tip.clone().applyQuaternion(q);
        if (tw.y - minY >= 0.085) { qPour = q; pourPos = new Vector3(CUPX - tw.x, TY - minY, CUPZ - tw.z); }
      }
      if (!qPour) { qPour = new THREE.Quaternion().setFromAxisAngle(across, 0.72).multiply(qRest); pourPos = new Vector3(CUPX, TY + 0.142, CUPZ).sub(tip.clone().applyQuaternion(qPour)); }
      tea.pour.compose(pourPos, qPour, new Vector3(1, 1, 1));
      blob(restPos.x, restPos.z, 0.09, 0.09, TY, 0.5);
      const chai = trackB(new THREE.MeshStandardMaterial({ color: new Color(0.42, 0.24, 0.12), roughness: 0.1 }), 1);
      tea.stream = new THREE.Mesh(new THREE.CylinderGeometry(0.0021, 0.0014, 1, 10, 1, true).translate(0, -0.5, 0), chai);
      tea.drops = [0, 1, 2].map(() => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.0019, 8, 6), chai); d.visible = false; g.add(d); return d; });
      tea.liquid = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), chai);
      tea.stream.visible = tea.liquid.visible = false;
      g.add(tea.stream, tea.liquid);
      tea.steam = makeSteam(g, CUPX, TY + 0.05, CUPZ, 0.11, 0.24, 6.6);
      tea.steam.visible = true;
    }, { rough: 0.2, metal: 0, env: 0.9 });
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
