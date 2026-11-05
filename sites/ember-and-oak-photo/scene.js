// Ember & Oak (photo) - the 3D layer: real 360-degree photographs (Poly Haven, CC0) are the scenery, real scanned
// props stand in front of them, lit by the photo's own light (prefiltered environment baked offline from each
// panorama's HDR). The camera turns, zooms and travels a little inside each photo and cross-dissolves between them.
import * as THREE from 'three';

const PH = '../../assets/polyhaven/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 500 }) : setTimeout(r, 40)));
async function imp(path) {
  try { return await import(path); } catch (e) { await wait(400); return import(path + '?r=1'); }
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

/* The photographed places. h = photo camera height above its floor (m), r = room radius used for the ground
   projection, grade = [exposure, saturation, contrast, r, g, b], env = prop environment strength,
   key = main light direction (pano u, elevation deg), colour and strength, matched to the photo's brightest source. */
const PANOS = [
  { id: 'warm_bar', h: 1.4, r: 5.0, grade: [0.64, 0.68, 1.14, 1.0, 0.93, 0.86], env: 0.9, fire: 1,
    desk: 'assets/bar_6k.jpg', phone: 'assets/bar_4k.jpg', envUrl: 'assets/env-warm-bar-pmrem128.hdr',
    key: { u: 0.700, el: 68, color: 0xffc98e, i: 2.2 } },
  { id: 'castle_zavelstein_cellar', h: 1.55, r: 4.0, grade: [0.62, 0.78, 1.16, 1.0, 0.92, 0.82], env: 0.85, fire: 0,
    desk: 'assets/cellar_6k.jpg', phone: 'assets/cellar_3k.jpg', envUrl: 'assets/env-cellar-pmrem128.hdr',
    key: { u: 0.600, el: 22, color: 0xfff1de, i: 2.6 } },
  { id: 'warm_reception_dinner', h: 1.5, r: 9.0, grade: [0.82, 0.72, 1.10, 1.0, 0.94, 0.88], env: 0.9, fire: 0,
    desk: 'assets/dinner_6k.jpg', envUrl: 'assets/env-warm-reception-dinner-pmrem128.hdr',
    key: { u: 0.560, el: 55, color: 0xffcf96, i: 1.8 } },
];
// the bar counter in the first photo: its top is BAR_DROP metres below the photo's camera point
const BAR_DROP = 0.30;

/* Camera keys, two per station (arrive, settle). u = heading as a position across the panorama (0..1),
   v = pitch in degrees, fov, p = small travel from the photo's camera point, e = exposure for the props,
   blur = background softness (depth of field), sx = subject shift on wide screens, sy on phones. */
const KEYS = [
  { pano: 0, u: 0.046, v: -9, pv: -15, fov: 60, p: [0, 0, 0], blur: 1, sx: 0.30, sy: 0.16 },                  // 0 the fire and the room
  { pano: 0, u: 0.036, v: -15, pv: -17, fov: 40, p: [-0.28, -0.04, -0.06], blur: 1, sx: 0.24, sy: 0.12 },      // 1 closer to the flames
  { pano: 0, u: 0.700, v: -12, pv: -14, fov: 46, p: [0, 0, 0], blur: 3.4, by: -0.25, sx: -0.26, sy: 0.16 },  // 2 the cut: board on the bar counter
  { pano: 0, u: 0.703, v: -16, pv: -17, fov: 32, p: [0, 0, 0], blur: 4.6, by: -0.27, sx: -0.22, sy: 0.14 },  // 3 closer
  { pano: 1, u: 0.640, v: -10, fov: 50, p: [0, 0, 0], blur: 1, sx: 0.20, sy: 0.16 },                          // 4 the cellar
  { pano: 1, u: 0.660, v: -14, fov: 40, p: [0.3, -0.1, 0.32], blur: 1.3, sx: 0.18, sy: 0.14 },                // 5 along the barrels
  { pano: 2, u: 0.690, v: -4, fov: 58, p: [0, 0, 0], blur: 1, sx: 0, sy: 0.12 },                              // 6 the dining room (menu)
  { pano: 2, u: 0.700, v: -7, fov: 50, p: [0.15, -0.03, 0.15], blur: 1, sx: 0, sy: 0.12 },
  { pano: 2, u: 0.458, v: -8, fov: 60, p: [0, 0, 0], blur: 1, sx: 0.20, sy: 0.16 },                           // 8 reserve: the barrel by the stove
  { pano: 2, u: 0.472, v: -12, fov: 50, p: [-0.1, -0.04, 0.12], blur: 1.2, sx: 0.20, sy: 0.14 },
];
const STILL = [0.35, 3, 5, 7, 9];
const dirFromU = (u, el = 0, out = new THREE.Vector3()) => {
  const t = (u - 0.5) * TAU, c = Math.cos((el * Math.PI) / 180);
  return out.set(Math.cos(t) * c, Math.sin((el * Math.PI) / 180), Math.sin(t) * c);
};

const SKY_VS = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }';
const SKY_FS = `
  uniform sampler2D tA, tB; uniform float uMix, uTime, uFlick, uBlur, uBlurY, fireA, fireB;
  uniform vec3 uCam; uniform vec2 pA, pB; uniform vec3 gA0, gA1, gB0, gB1;
  varying vec3 vDir;
  const float INV2PI = 0.15915494, INVPI = 0.31830989;
  vec3 proj(vec3 d, vec2 hr){
    vec3 O = uCam; float b = dot(O, d), c = dot(O, O) - hr.y * hr.y;
    float t = -b + sqrt(max(b * b - c, 0.0));
    if (d.y < -0.001) t = min(t, (-hr.x - O.y) / d.y);
    return normalize(O + t * d);
  }
  float box(vec2 uv, vec4 r, float s){ return smoothstep(r.x - s, r.x + s, uv.x) * smoothstep(r.z + s, r.z - s, uv.x) * smoothstep(r.y - s, r.y + s, uv.y) * smoothstep(r.w + s, r.w - s, uv.y); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  vec3 samp(sampler2D t, vec3 dir, vec3 g0, vec3 g1, float fire){
    vec2 uv = vec2(atan(dir.z, dir.x) * INV2PI + 0.5, asin(clamp(dir.y, -1.0, 1.0)) * INVPI + 0.5);
    vec2 dx = dFdx(uv), dy = dFdy(uv);
    float ax = dFdx(fract(uv.x + 0.5)), ay = dFdy(fract(uv.x + 0.5));
    if (abs(ax) < abs(dx.x)) dx.x = ax; if (abs(ay) < abs(dy.x)) dy.x = ay;
    float glow = 1.0;
    if (fire > 0.5) {
      // the photo's own flames and logs, set moving: three noise warp layers rising at different speeds inside
      // the fire bed only (a few pixels of displacement), brightness breathing through the flame body, a slower
      // pulse in the embers. No painted flame: every pixel shown is a pixel of the photographed fire.
      float m = box(uv, vec4(0.0175, 0.381, 0.0485, 0.416), 0.0025);
      if (m > 0.0) {
        vec2 q = (uv - vec2(0.0175, 0.381)) / vec2(0.031, 0.035);       // 0..1 across the fire bed
        float n1 = vnoise(vec2(q.x * 7.0, q.y * 4.0 - uTime * 1.9));
        float n2 = vnoise(vec2(q.x * 15.0 + 3.1, q.y * 9.0 - uTime * 3.4));
        float n3 = vnoise(vec2(q.x * 30.0 + 7.7, q.y * 18.0 - uTime * 5.6));
        float up = smoothstep(0.15, 0.9, q.y);                           // flames move more than the log bed
        vec2 off = vec2((n1 - 0.5) * 0.00055 + (n2 - 0.5) * 0.00028,
                        -(n1 * 0.0011 + n2 * 0.0006 + n3 * 0.0003) * up);
        uv += off * m;
        float body = 0.82 + 0.34 * vnoise(vec2(q.x * 5.0 + 1.7, q.y * 3.0 - uTime * 2.6));
        float ember = 0.9 + 0.12 * sin(uTime * 1.7 + q.x * 9.0) * (1.0 - up);
        glow = mix(1.0, uFlick * mix(ember, body, up), m);
      }
      // the hearth, the screen and the near floor take the same flicker, weaker with distance from the fire
      float h = box(uv, vec4(-0.01, 0.30, 0.075, 0.45), 0.03);
      glow *= 1.0 + (uFlick - 1.0) * (0.8 * h + 0.12);
    }
    // depth of field: soften only what lies above uBlurY (the far room), keep the near counter sharp
    float bw = smoothstep(uBlurY - 0.05, uBlurY + 0.03, dir.y);
    float bl = mix(1.0, uBlur, bw);
    vec3 c = pow(textureGrad(t, uv, dx * bl, dy * bl).rgb, vec3(2.2)) * glow; // sRGB photo to linear
    c *= g0.x;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, g0.y);
    c = pow(max(c, 0.0), vec3(1.0 / 2.2));
    c = clamp((c - 0.45) * g0.z + 0.45, 0.0, 4.0);
    c = pow(c, vec3(2.2)) * g1;
    return c;
  }
  void main(){
    vec3 d = normalize(vDir);
    vec3 c = samp(tA, proj(d, pA), gA0, gA1, fireA);
    if (uMix > 0.001) c = mix(c, samp(tB, proj(d, pB), gB0, gB1, fireB), uMix);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;
// one full-screen quad that multiplies the finished frame by 2*src: vignette and a fine film grain, no render target
const FX_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FX_FS = `uniform float uTime; uniform vec2 uRes; uniform float uGrain; varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    float v = smoothstep(1.12, 0.30, length((vUv - 0.5) * vec2(1.0, 0.86)));
    float g = (hash(floor(vUv * uRes) + fract(uTime * 7.0) * 113.0) - 0.5) * uGrain;
    gl_FragColor = vec4(vec3(0.5 * mix(0.66, 1.0, v) * (1.0 + g)), 1.0);
  }`;

export async function initScene(canvas, opts = {}) {
  const reduce = !!opts.reduce;
  const progress = opts.onProgress || (() => {});
  const small = Math.min(window.innerWidth, window.innerHeight) <= 760 && window.innerWidth <= 900;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const lowCpu = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const tier = small || coarse ? 0 : lowCpu ? 1 : 2;

  const [{ GLTFLoader }, { RGBELoader }] = await Promise.all([imp('three/addons/loaders/GLTFLoader.js'), imp('three/addons/loaders/RGBELoader.js')]);

  /* ---------- renderer */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
  } catch (e) { return null; }
  if (!renderer.capabilities.isWebGL2) { renderer.dispose(); return null; } // the panorama shader needs textureGrad
  renderer.debug.checkShaderErrors = false;
  let lost = false, onLostH = null, onRestoredH = null;
  const lostL = (e) => { e.preventDefault(); lost = true; if (onLostH) onLostH(); };
  const restoredL = () => { if (onRestoredH) onRestoredH(); else lost = false; };
  canvas.addEventListener('webglcontextlost', lostL);
  canvas.addEventListener('webglcontextrestored', restoredL);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x0b0806, 1);
  renderer.autoClear = false;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const dprCap = tier === 0 ? 1.0 : tier === 1 ? 1.25 : 1.5;
  let pr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(pr);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const big = tier > 0 && renderer.capabilities.maxTextureSize >= 8192; // phones and small GPUs: 4k panoramas

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 120);
  scene.add(camera);

  /* ---------- the panorama sphere (follows the camera; the shader projects the photo's floor onto a plane) */
  const blackTex = new THREE.DataTexture(new Uint8Array([10, 8, 6, 255]), 1, 1); blackTex.needsUpdate = true;
  const skyU = {
    tA: { value: blackTex }, tB: { value: blackTex }, uMix: { value: 0 }, uTime: { value: 0 }, uFlick: { value: 1 }, uBlur: { value: 1 }, uBlurY: { value: -2 },
    fireA: { value: 0 }, fireB: { value: 0 }, uCam: { value: new THREE.Vector3() },
    pA: { value: new THREE.Vector2(1.5, 5) }, pB: { value: new THREE.Vector2(1.5, 5) },
    gA0: { value: new THREE.Vector3(1, 1, 1) }, gA1: { value: new THREE.Vector3(1, 1, 1) },
    gB0: { value: new THREE.Vector3(1, 1, 1) }, gB1: { value: new THREE.Vector3(1, 1, 1) },
  };
  const skyMat = new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 64, 32), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);

  const fxU = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uGrain: { value: tier === 0 ? 0.05 : 0.065 } };
  const fxMat = new THREE.ShaderMaterial({
    uniforms: fxU, vertexShader: FX_VS, fragmentShader: FX_FS, depthTest: false, depthWrite: false, toneMapped: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.SrcColorFactor,
  });
  const fxScene = new THREE.Scene();
  const fxQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fxMat); fxQuad.frustumCulled = false; fxScene.add(fxQuad);
  const fxCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /* ---------- panoramas: decoded off the main thread, uploaded one at a time, at most two on the GPU */
  const tex = new Map(); // pano index -> texture
  const pending = new Map();
  const panoUrl = (i) => {
    const P = PANOS[i];
    if (big) return P.desk || `${PH}pano/${P.id}/${P.id}_8k.jpg`;
    return P.phone || `${PH}pano/${P.id}/${P.id}_4k.jpg`;
  };
  let gen = 0; // bumps on context restore so stale loads are dropped
  const gl = renderer.getContext();
  const yieldTask = () => new Promise((r) => setTimeout(r, 0));
  // decode in a worker and cut the photo into strips of rows there: Chrome decodes a flipped ImageBitmap on the
  // calling thread (a 0.5-1 s freeze for an 8k JPG), and ImageBitmap uploads take a slow conversion path, so the
  // worker hands over raw RGBA rows: each strip is then a plain memory copy to the GPU
  let worker = null, wid = 0;
  const waiting = new Map();
  const WSRC = "self.onmessage=async(e)=>{const{id,url,rows}=e.data;let out=null;try{const r=await fetch(url);if(r.ok){const b=await r.blob();const bmp=await createImageBitmap(b,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});const w=bmp.width,h=bmp.height,strips=[];const cv=new OffscreenCanvas(w,rows),cx=cv.getContext('2d',{willReadFrequently:true});for(let y=0;y<h;y+=rows){const n=Math.min(rows,h-y);cx.clearRect(0,0,w,rows);cx.drawImage(bmp,0,y,w,n,0,0,w,n);strips.push(new Uint8Array(cx.getImageData(0,0,w,n).data.buffer));}bmp.close();out={w,h,rows,strips};}}catch(x){}self.postMessage({id,out},out?out.strips.map((a)=>a.buffer):[]);};";
  function decode(url, px) {
    return new Promise((res) => {
      try {
        if (!worker) {
          worker = new Worker(URL.createObjectURL(new Blob([WSRC], { type: 'text/javascript' })));
          worker.onmessage = (e) => { const f = waiting.get(e.data.id); waiting.delete(e.data.id); f && f(e.data.out); };
          worker.onerror = () => { waiting.forEach((f) => f(null)); waiting.clear(); };
        }
        const id = ++wid, w = big ? 6144 : 4096;
        waiting.set(id, res);
        worker.postMessage({ id, url: new URL(url, location.href).href, rows: Math.max(32, Math.floor(px / w)) });
      } catch (e) { res(null); }
    });
  }
  const closeAll = (d) => { d.strips.length = 0; };
  // upload one strip per task into immutable storage; mipmaps are generated on the GPU in a last task
  async function uploadStriped(t, d, myGen) {
    const { w, h, rows, strips } = d, st = renderer.state;
    const glt = gl.createTexture();
    const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
    st.bindTexture(gl.TEXTURE_2D, glt);
    // plain RGBA8 (decoded to linear in the shader): SRGB8 storage stalls for 100-300 ms on some uploads under ANGLE/D3D11
    gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, w, h);
    const dead = () => lost || myGen !== gen || gl.isContextLost();
    for (let k = 0; k < strips.length; k++) {
      if (dead()) return null;
      st.bindTexture(gl.TEXTURE_2D, glt);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, k * rows, w, strips[k].length / (4 * w), gl.RGBA, gl.UNSIGNED_BYTE, strips[k]);
      strips[k] = null;
      // paced: back-to-back strips fill the GPU process's transfer buffer and the next call then blocks for 100s of ms
      await (shown() && !d.urgent ? wait(14) : yieldTask());
    }
    if (dead()) { if (!gl.isContextLost()) gl.deleteTexture(glt); return null; }
    st.bindTexture(gl.TEXTURE_2D, glt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
    st.bindTexture(gl.TEXTURE_2D, null);
    await yieldTask();
    if (dead()) { if (!gl.isContextLost()) gl.deleteTexture(glt); return null; }
    st.bindTexture(gl.TEXTURE_2D, glt);
    gl.generateMipmap(gl.TEXTURE_2D); // its own task
    st.bindTexture(gl.TEXTURE_2D, null);
    await gpuDone(); // the first draw with this photo must not wait for the GPU on the main thread
    if (dead()) { if (!gl.isContextLost()) gl.deleteTexture(glt); return null; }
    const props = renderer.properties.get(t);
    props.__webglTexture = glt; props.__webglInit = true; props.__version = t.version;
    await yieldTask();
    return glt;
  }
  // poll a fence across tasks instead of letting a draw call block until the uploads land on the GPU
  async function gpuDone() {
    let f = null;
    try { f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); } catch (e) { return; }
    const t0 = performance.now();
    while (!lost && !gl.isContextLost() && performance.now() - t0 < 4000) {
      const st = gl.getSyncParameter(f, gl.SYNC_STATUS);
      if (st === gl.SIGNALED) break;
      await wait(16);
    }
    if (!gl.isContextLost()) gl.deleteSync(f);
  }
  let restoring = false;
  const shown = () => ready && !restoring; // while the poster covers the canvas, upload faster
  function freeTex(t) { // three.js does not own the GL texture of a striped upload: delete it ourselves
    if (t.userData.glt && !gl.isContextLost()) gl.deleteTexture(t.userData.glt);
    t.userData.glt = null; t.dispose();
  }
  let upChain = Promise.resolve();
  const failed = new Set(); // a photo that failed to load is not retried every frame
  function loadPano(i) {
    if (failed.has(i) && !tex.has(i)) return Promise.resolve(null);
    if (tex.has(i) || pending.has(i)) return pending.get(i) || Promise.resolve(tex.get(i));
    const myGen = gen;
    const p = (async () => {
      try {
        // the first photo uploads behind the poster in big strips; later ones while the page is in use, in small ones
        const w0 = big ? 6144 : 4096;
        // a photo the camera is already waiting for uploads in big strips without pacing; a prefetch is paced
        const urgent = !shown() || i === segA || i === segB;
        const d = await decode(panoUrl(i), (urgent ? 64 : 32) * w0);
        d && (d.urgent = urgent);
        if (!d) { failed.add(i); return null; }
        // one upload at a time, so two photos can never allocate together
        const turn = upChain; let done; upChain = new Promise((r) => { done = r; });
        try { await turn; } catch (e) { /* previous upload failed */ }
        try {
        if (lost || myGen !== gen || (ready && !needed.has(i))) { closeAll(d); return null; } // scrolled away meanwhile
        makeRoom(i); // free the photo we have moved away from before allocating the new one: two at most, always
        const t = new THREE.Texture();
        t.image = { width: d.w, height: d.h };
        t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.generateMipmaps = false;
        t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
        t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
        const glt = await uploadStriped(t, d, myGen);
        if (!glt) { closeAll(d); return null; }
        t.userData.glt = glt;
        tex.set(i, t);
        evict();
        wake();
        return t;
        } finally { done(); }
      } catch (e) { return null; } finally { if (pending.get(i) === p) pending.delete(i); }
    })();
    pending.set(i, p);
    return p;
  }
  function makeRoom(i) {
    for (const [k, t] of tex) {
      if (tex.size < 2) break;
      if (k !== i && !needed.has(k)) { freeTex(t); tex.delete(k); weight[k] = 0; }
    }
  }
  const needed = new Set([0]);
  function evict() { // the brief's rule: never more than two photos on the GPU
    if (tex.size <= 2) return;
    for (const [i, t] of tex) {
      if (tex.size <= 2) break;
      if (!needed.has(i) && weight[i] < 0.001) { freeTex(t); tex.delete(i); weight[i] = 0; }
    }
  }

  /* ---------- environment light per photo: PMREM prefiltered offline from the panorama's own HDR */
  const envs = new Map();
  const rgbe = new RGBELoader();
  const envName = (i) => PANOS[i].envUrl;
  function loadEnv(i) {
    if (envs.has(i)) return envs.get(i);
    const p = new Promise((res) => rgbe.load(envName(i), (t) => {
      t.mapping = THREE.CubeUVReflectionMapping; t.flipY = false; t.generateMipmaps = false;
      t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; res(t);
    }, undefined, () => res(null)));
    envs.set(i, p);
    return p;
  }
  const envTex = [];

  /* ---------- props: real Poly Haven scans */
  const NOR = px(128, 128, 255), ARM = px(255, 205, 0);
  function px(r, g, b) { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(0, 0, 1, 1); return c.toDataURL('image/png'); }
  const skip = (u) => {
    if (/paper_nor|label_[a-z_0-9]+_arm|glass_nor|wine_bottles_01_(arm|nor_gl)|yellow_onion_(arm|nor_gl)|wine_barrel_01_arm/.test(u)) return true;
    if (tier === 0 && /_(nor_gl|arm)_1k/.test(u)) return true;
    return false;
  };
  const manager = new THREE.LoadingManager();
  // phones: colour maps from site-local 512 px copies (about 8 MB total budget)
  const small512 = (u) => (tier === 0 && /(wooden_cutting_board|yellow_onion|wine_barrel_01|wine_bottles_01_label_[a-z_0-9]+)_diff_1k\.jpg$/.test(u) ? 'assets/m/' + u.split('/').pop().replace('_1k', '_512') : u);
  manager.setURLModifier((u) => (skip(u) ? (/nor/.test(u) ? NOR : ARM) : small512(u)));
  const gltfLoader = new GLTFLoader(manager);
  const loadGltf = (id) => new Promise((res) => gltfLoader.load(`${PH}models/${id}/${id}_1k.gltf`, (g) => res(g.scene), undefined, () => res(null)));
  const fadeMats = [[], [], []]; // per panorama: materials that fade with its photo
  const groups = PANOS.map(() => { const g = new THREE.Group(); g.visible = false; scene.add(g); return g; });
  function prep(root, pano, { cast = true, receive = true } = {}) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = cast; o.receiveShadow = receive;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => {
        if (m.map) m.map.anisotropy = maxAniso;
        if (!m.userData.faded && 'envMapIntensity' in m) m.envMapIntensity *= PANOS[pano].env;
        if (!m.userData.faded) { m.userData.faded = true; m.transparent = true; fadeMats[pano].push(m); }
      });
    });
    return root;
  }
  function cl(obj) { // a copy with its own materials, so each photo fades its own props
    const c = obj.clone();
    c.traverse((o) => { if (o.isMesh) { const u = o.material.userData; o.material = o.material.clone(); o.material.userData = { base: u.base, glass: u.glass }; } });
    return c;
  }
  let blobTex = null;
  function blob(pano, w, d, opacity) { // soft contact occlusion where a prop meets the photo's floor
    if (!blobTex) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      const g = x.createRadialGradient(64, 64, 4, 64, 64, 63); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); blobTex = new THREE.CanvasTexture(c);
    }
    const m = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false, color: 0x000000, toneMapped: false });
    m.userData.base = opacity; m.userData.shadow = true; fadeMats[pano].push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = -2;
    return mesh;
  }
  function catcher(pano, w, d, opacity) { // receives the props' shadows on the photo's floor
    const m = new THREE.ShadowMaterial({ opacity, transparent: true, depthWrite: false });
    m.userData.base = opacity; m.userData.shadow = true; fadeMats[pano].push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true; mesh.renderOrder = -1;
    return mesh;
  }
  async function upload(obj) {
    const seen = new Set();
    obj.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach((k) => { if (m[k]) seen.add(m[k]); }); }); });
    for (const t of seen) { if (lost) return; renderer.initTexture(t); await wait(0); }
  }
  async function compile(obj) {
    if (lost || renderer.getContext().isContextLost()) return;
    let p = null;
    try { p = renderer.compileAsync(obj, camera, scene); } catch (e) { /* compile on first draw */ }
    if (p) { try { await Promise.race([p, wait(15000)]); } catch (e) { /* ignore */ } }
  }

  /* ---------- lights: one key per photo matched to its brightest source, the fire as a flickering practical */
  const key = new THREE.DirectionalLight(0xffffff, 1);
  key.castShadow = true;
  key.shadow.mapSize.set(tier === 0 ? 1024 : 2048, tier === 0 ? 1024 : 2048);
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.008; key.shadow.radius = 5;
  const sc = key.shadow.camera; sc.left = -1.6; sc.right = 1.6; sc.top = 1.6; sc.bottom = -1.6; sc.near = 0.2; sc.far = 12;
  scene.add(key, key.target);
  const fireLight = new THREE.PointLight(0xff8a3c, 0, 0, 2);
  scene.add(fireLight);
  const keyCol = [new THREE.Color(), new THREE.Color()];
  // where each photo's props sit (set when they load); the key light aims there
  const focus = PANOS.map(() => new THREE.Vector3());

  /* ---------- sizing */
  let W = 1, H = 1, portrait = false;
  function resize() {
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    fxU.uRes.value.set(W * pr, H * pr);
    camera.aspect = W / H;
    portrait = W / H < 0.9;
    wake();
  }
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(resize, 120); };
  window.addEventListener('resize', onResize);

  /* ---------- camera */
  const NK = KEYS.length - 1;
  let tgtS = reduce ? STILL[0] : 0, curS = tgtS;
  const weight = PANOS.map((_, i) => (i === 0 ? 1 : 0));
  const target = PANOS.map(() => 0);
  const camP = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();
  const pointer = new THREE.Vector2(), pointerCur = new THREE.Vector2();
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let paused = false;
  const onPointer = (e) => { if (paused || reduce) return; pointer.set((e.clientX / W) * 2 - 1, (e.clientY / H) * 2 - 1); wake(); };
  if (fine && !reduce) window.addEventListener('pointermove', onPointer, { passive: true });
  let segA = 0, segB = 0, segW = 0, blurNow = 1, blurY = -2, scrollDir = 1;
  function applyCamera() {
    const s = clamp(curS, 0, NK);
    const i = Math.min(NK - 1, Math.floor(s)), f = s - i, a = KEYS[i], b = KEYS[i + 1];
    let du = b.u - a.u; du -= Math.round(du);
    let u = a.u + du * f;
    if (portrait) { let dp = (b.pu ?? b.u) - (a.pu ?? a.u); dp -= Math.round(dp); u = (a.pu ?? a.u) + dp * f; }
    const v = portrait ? lerp(a.pv ?? a.v, b.pv ?? b.v, f) : lerp(a.v, b.v, f);
    camP.set(lerp(a.p[0], b.p[0], f), lerp(a.p[1], b.p[1], f), lerp(a.p[2], b.p[2], f));
    dirFromU(u + pointerCur.x * 0.004, v - pointerCur.y * 0.8, look);
    camera.position.copy(camP);
    camera.lookAt(tmp.copy(camP).add(look));
    const fov = lerp(a.fov, b.fov, f);
    camera.fov = portrait ? Math.min(fov * 1.25, 64) : fov;
    const k = clamp(Math.pow(1440 / W, 1.15), 0.85, 1.6);
    const sx = portrait ? 0 : lerp(a.sx, b.sx, f) * k, sy = portrait ? lerp(a.sy, b.sy, f) : 0;
    camera.setViewOffset(W, H, -sx * W * 0.5, sy * H * 0.5, W, H);
    camera.updateProjectionMatrix();
    blurNow = lerp(a.blur, b.blur, f); blurY = lerp(a.by ?? -2, b.by ?? -2, f);
    // which photos this scroll position wants
    segA = a.pano; segB = b.pano; segW = a.pano === b.pano ? 0 : sstep(0.3, 0.7, f);
    needed.clear(); needed.add(a.pano); needed.add(b.pano);
    const nx = KEYS[scrollDir < 0 ? Math.max(0, i - 1) : Math.min(NK, i + 2)].pano; if (needed.size < 2) needed.add(nx);
  }
  function updateWeights(dt, snap) {
    target.fill(0);
    target[segA] += 1 - segW; target[segB] += segW;
    let sum = 0;
    for (let i = 0; i < PANOS.length; i++) { if (!tex.has(i)) target[i] = 0; sum += target[i]; }
    if (sum < 1e-4) { // nothing wanted is ready yet: hold whatever is on screen
      for (let i = 0; i < PANOS.length; i++) target[i] = tex.has(i) ? weight[i] : 0;
      sum = target.reduce((x, y) => x + y, 0) || 1;
    }
    const k = snap ? 1 : 1 - Math.exp(-dt * 5);
    for (let i = 0; i < PANOS.length; i++) {
      target[i] /= sum; // normalised, so settled() compares against what the weights really ease to
      weight[i] += (target[i] - weight[i]) * k;
      if (Math.abs(weight[i] - target[i]) < 0.002) weight[i] = target[i];
    }
    for (const i of needed) if (!tex.has(i)) loadPano(i);
    if (tex.size > 2) evict();
  }
  const wSettled = () => { for (let i = 0; i < PANOS.length; i++) { if (Math.abs(weight[i] - target[i]) > 0.002 && tex.has(i)) return false; } return true; };

  /* ---------- per-frame scene state */
  let clock = 0, flick = 1;
  const kp = new THREE.Vector3(), kf = new THREE.Vector3(), lastKey = new THREE.Vector3(1e9, 0, 0);
  function setGrade(i, g0, g1, p, fire) {
    const P = PANOS[i], G = P.grade;
    g0.value.set(G[0], G[1], G[2]); g1.value.set(G[3], G[4], G[5]);
    p.value.set(P.h, P.r); fire.value = P.fire;
  }
  function updateScene() {
    // the two strongest photos go to the shader
    let A, B;
    for (let i = 0; i < PANOS.length; i++) {
      if (!tex.has(i)) continue;
      if (A === undefined || weight[i] > weight[A]) { B = A; A = i; } else if (B === undefined || weight[i] > weight[B]) B = i;
    }
    if (A !== undefined) { skyU.tA.value = tex.get(A); setGrade(A, skyU.gA0, skyU.gA1, skyU.pA, skyU.fireA); }
    if (B !== undefined && weight[B] > 0.001) {
      skyU.tB.value = tex.get(B); setGrade(B, skyU.gB0, skyU.gB1, skyU.pB, skyU.fireB);
      skyU.uMix.value = weight[B] / Math.max(1e-4, weight[A] + weight[B]);
    } else { skyU.uMix.value = 0; skyU.tB.value = skyU.tA.value; }
    // the ground projection is measured from the photo's own camera point; travel moves us off it
    skyU.uCam.value.copy(camera.position);
    skyU.uBlur.value = blurNow; skyU.uBlurY.value = blurY;
    skyU.uTime.value = clock;
    // fire: a calm flicker, two slow sines and a faster ripple, never strobing
    flick = reduce ? 1 : 1 + 0.05 * Math.sin(clock * 6.1) + 0.035 * Math.sin(clock * 13.7 + 1.3) + 0.02 * Math.sin(clock * 23.3 + 0.4);
    skyU.uFlick.value = flick;
    // props fade with their photo; the environment and key light blend toward the dominant photo
    for (let i = 0; i < PANOS.length; i++) {
      // props are solid or gone: they switch in the middle of a dissolve, never hang half-transparent over the photos
      const w = sstep(0.47, 0.53, weight[i]);
      groups[i].visible = w > 0.01;
      if (groups[i].visible) fadeMats[i].forEach((m) => { m.opacity = (m.userData.base ?? 1) * w; m.depthWrite = !m.userData.shadow && !m.userData.glass && w > 0.98; });
    }
    const dom = A === undefined ? 0 : A;
    if (envTex[dom]) scene.environment = envTex[dom];
    let ki = 0; keyCol[0].setRGB(0, 0, 0); kp.set(0, 0, 0); kf.set(0, 0, 0);
    for (let i = 0; i < PANOS.length; i++) {
      const w = weight[i]; if (w < 0.001) continue;
      const K = PANOS[i].key;
      keyCol[1].set(K.color); keyCol[0].add(keyCol[1].multiplyScalar(w));
      ki += K.i * w * (PANOS[i].fire ? 1 + (flick - 1) * 0.35 : 1);
      kf.addScaledVector(focus[i], w);
      kp.addScaledVector(dirFromU(K.u, K.el, tmp).multiplyScalar(5), w);
    }
    key.color.copy(keyCol[0]); key.intensity = ki;
    key.target.position.copy(kf); key.position.copy(kf).add(kp);
    if (key.position.distanceToSquared(lastKey) > 1e-6) { lastKey.copy(key.position); shadowsDirty = true; }
    fireLight.intensity = weight[0] * 9 * flick * flick;
    fxU.uTime.value = clock;
  }

  /* ---------- render loop: one rAF id, on demand while paused or settled */
  let raf = 0, last = 0, journeyVisible = true, tabVisible = !document.hidden, ready = false, guard = true, frames = 0, slow = 0;
  const canRun = () => ready && !lost && tabVisible && journeyVisible;
  const settled = () => Math.abs(curS - tgtS) < 0.0004 && pointerCur.distanceToSquared(pointer) < 1e-6 && wSettled();
  let shadowsDirty = true;
  function draw(dt = 0, snap = false) {
    applyCamera();
    updateWeights(dt, snap);
    updateScene();
    if (shadowsDirty) { renderer.shadowMap.needsUpdate = true; shadowsDirty = false; }
    renderer.clear();
    renderer.render(scene, camera);
    renderer.render(fxScene, fxCam);
  }
  function frame(ts) {
    raf = 0;
    if (!canRun()) return;
    const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000 || 0.016)); last = ts;
    if (!reduce) {
      curS += (tgtS - curS) * (1 - Math.exp(-dt * 4.0));
      if (Math.abs(curS - tgtS) < 0.0003) curS = tgtS;
      if (!paused) { pointerCur.lerp(pointer, 1 - Math.exp(-dt * 3)); clock += dt; }
    }
    draw(dt, reduce);
    if (guard && !paused && !reduce && !document.hidden) {
      frames++; if (dt > 0.026) slow++;
      if (frames === 90) { if (slow > 50) degrade(); frames = 0; slow = 0; }
    }
    if (!raf && !reduce && (!paused || !settled())) raf = requestAnimationFrame(frame);
  }
  function degrade() {
    if (pr > 1) { pr = Math.max(1, pr - 0.25); resize(); return; }
    guard = false;
  }
  function wake() {
    if (raf || !canRun()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  const io = new IntersectionObserver((e) => { journeyVisible = e[0].isIntersecting; journeyVisible ? wake() : stop(); }, { threshold: 0 });
  const jr = document.getElementById('journey'); if (jr) io.observe(jr);
  const onVis = () => { tabVisible = !document.hidden; tabVisible ? wake() : stop(); };
  document.addEventListener('visibilitychange', onVis);
  const onLost = () => { stop(); opts.onLost && opts.onLost(); };
  const onRestored = () => {
    lost = false;
    gen++;
    // the panoramas died with the old context (their decoded images were released): forget them, fetch again
    tex.clear(); pending.clear(); failed.clear(); // GL objects of the old context are gone: forget, never delete
    skyU.tA.value = skyU.tB.value = blackTex;
    shadowsDirty = true;
    resize();
    const first = segW > 0.5 ? segB : segA;
    const want = new Set([first]);
    restoring = true;
    loadPano(first).then(() => {
      restoring = false;
      if (lost) return;
      PANOS.forEach((_, i) => { weight[i] = i === first && tex.has(i) ? 1 : 0; }); // the other photo of a dissolve fades in when it arrives
      opts.onRestored && opts.onRestored();
      wake();
    });
  };
  onLostH = onLost; onRestoredH = onRestored;

  /* ---------- first frame: the fire photo and its light */
  resize();
  progress(0.1);
  const [t0, e0] = await Promise.all([loadPano(0), loadEnv(0)]);
  if (!t0) { renderer.dispose(); return null; }
  envTex[0] = e0;
  progress(0.6);
  curS = tgtS; applyCamera();
  await compile(scene);
  try { await Promise.race([renderer.compileAsync(fxScene, fxCam), wait(4000)]); } catch (e) { /* compiles on first draw */ }
  if (lost || renderer.getContext().isContextLost()) return null;
  ready = true;
  draw(0, true);
  opts.onReady && opts.onReady();
  wake();

  /* ---------- props, streamed in idle time */
  const C = (u, dist, y, out = new THREE.Vector3()) => dirFromU(u, 0, out).multiplyScalar(dist).setY(y);
  const faceU = (u) => -((u - 0.5) * TAU) - Math.PI / 2; // rotation.y that turns an object's +z toward the camera point
  // props sit in the photographs' own light: colours pulled a little toward the photo (less saturated, less bright,
  // rougher), labels toned down, dark glass slightly see-through
  function photoMatch(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (/_wine_(red|clear|light_red)$/.test(m.name)) { o.visible = false; return; }
      if (m.transmission !== undefined && m.transmission > 0) {
        m.transmission = 0; m.roughness = 0.08; m.metalness = 0; m.envMapIntensity = 1.1; m.color.setRGB(0.035, 0.05, 0.03);
        if (m.clearcoat !== undefined) { m.clearcoat = 0.8; m.clearcoatRoughness = 0.08; }
        m.userData.base = 0.9; m.userData.glass = true;
        return;
      }
      if (/label|paper/.test(m.name)) { m.color.multiplyScalar(0.5); m.roughness = Math.max(m.roughness, 0.85); return; }
      m.color.multiplyScalar(0.86); m.roughness = Math.min(1, (m.roughness ?? 0.6) * 1.15 + 0.05);
    });
    return root;
  }
  function pick(set, name) { // one bottle out of the set, standing at its own origin
    const o = set.getObjectByName(name);
    if (!o) return null;
    const c = cl(o); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0);
    const bb = new THREE.Box3().setFromObject(c); c.position.y = -bb.min.y;
    const g = new THREE.Group(); g.add(c); return g;
  }
  (async () => {
    await idle();
    if (lost) return;
    // the cut: a board, two onions and a dark bottle on the photographed bar counter, under the bar's lamps
    const [board, onion, bottles] = await Promise.all([loadGltf('wooden_cutting_board'), loadGltf('yellow_onion'), loadGltf('wine_bottles_01')]);
    progress(0.75);
    if (board) { photoMatch(board); board.traverse((o) => { if (o.isMesh) { o.material.color.multiply(new THREE.Color(0.7, 0.6, 0.54)); o.material.envMapIntensity = 0.55; o.material.roughness = Math.min(1, o.material.roughness + 0.15); } }); }
    if (onion) photoMatch(onion);
    if (bottles) photoMatch(bottles);
    const g0 = new THREE.Group();
    const BU = 0.703, BD = 1.12, topY = -BAR_DROP;
    const set = new THREE.Group(); set.position.copy(C(BU, BD, topY)); set.rotation.y = faceU(BU); g0.add(set);
    if (board) { const b = cl(board); prep(b, 0); b.position.set(0.08, 0.001, 0.0); b.rotation.y = 0.16; set.add(b); }
    if (onion) {
      const o1 = cl(onion); prep(o1, 0); o1.position.set(-0.24, 0.0, 0.1); o1.rotation.set(0.2, 1.1, 0.1); set.add(o1);
      const o2 = cl(onion); prep(o2, 0); o2.position.set(-0.31, 0.0, 0.02); o2.rotation.set(1.4, 0.3, 0.2); o2.scale.setScalar(0.85); set.add(o2);
    }
    const bord = bottles && pick(bottles, 'wine_bottles_01_bordeaux');
    if (bord) { const b1 = cl(bord); prep(b1, 0); b1.position.set(-0.2, 0.0, -0.16); b1.rotation.y = 0.8; set.add(b1); }
    // contact shadows on the counter: a soft occlusion under each prop and a shadow catcher for the lamp shadows
    const ab = blob(0, 0.55, 0.36, 0.55); ab.position.set(0.08, 0.0015, 0); ab.rotation.z = 0.16; set.add(ab);
    [[-0.24, 0.1, 0.13], [-0.31, 0.02, 0.11], [-0.2, -0.16, 0.13]].forEach(([x, z, r]) => { const a = blob(0, r, r, 0.7); a.position.set(x, 0.0012, z); set.add(a); });
    const cs0 = catcher(0, 0.95, 0.42, 0.5); cs0.position.set(0, 0.001, -0.02); set.add(cs0);
    set.updateMatrixWorld(true);
    focus[0].copy(set.position);
    fireLight.position.copy(C(0.033, 3.4, -PANOS[0].h + 0.5));
    await upload(g0); await compile(g0);
    if (lost) return;
    groups[0].add(g0); shadowsDirty = true; wake();

    // the cellar: barrels on the stone floor, a bottle on the upright one, light from the small window
    await idle();
    loadEnv(1).then((t) => { envTex[1] = t; });
    const barrel = await loadGltf('wine_barrel_01');
    if (barrel) photoMatch(barrel);
    const P1 = PANOS[1], g1 = new THREE.Group(), floor1 = -P1.h;
    let bh = 0.84;
    if (barrel) {
      prep(barrel, 1);
      const bb = new THREE.Box3().setFromObject(barrel);
      bh = bb.max.y - bb.min.y; const R = (bb.max.x - bb.min.x) / 2;
      const row = [[0.70, 2.3], [0.745, 2.15], [0.79, 2.05]];
      row.forEach(([u, d], i) => {
        const b = barrel.clone(); b.position.copy(C(u, d, floor1 + R * 0.98));
        b.rotation.order = 'YXZ'; b.rotation.set(Math.PI / 2, faceU(u) + i * 0.05, 0.4 * i); g1.add(b);
      });
      const up = barrel.clone(); up.position.copy(C(0.635, 1.75, floor1 - bb.min.y)); up.rotation.y = 0.7; g1.add(up);
      if (bord) {
        const b2 = cl(bord); prep(b2, 1); b2.position.copy(C(0.635, 1.75, floor1 + bh - 0.008)); b2.position.x -= 0.07; b2.position.z += 0.05; b2.rotation.y = 2.2; g1.add(b2);
        const a = blob(1, 0.12, 0.12, 0.7); a.position.copy(b2.position); a.position.y += 0.002; g1.add(a);
      }
      focus[1].copy(C(0.68, 2.0, floor1 + 0.5));
    }
    [[0.70, 2.3], [0.745, 2.15], [0.79, 2.05]].forEach(([u, d]) => { const a = blob(1, 0.95, 0.75, 0.6); a.position.copy(C(u, d, floor1 + 0.003)); a.rotation.z = faceU(u); g1.add(a); });
    { const a = blob(1, 0.9, 0.9, 0.65); a.position.copy(C(0.635, 1.75, floor1 + 0.003)); g1.add(a); }
    const cs1 = catcher(1, 5, 5, 0.6); cs1.position.copy(C(0.7, 2.0, floor1 + 0.002)); g1.add(cs1);
    await upload(g1); await compile(g1);
    if (lost) return;
    groups[1].add(g1); shadowsDirty = true; wake();

    // the dining room: an upright barrel used as a standing table near the iron stove, two bottles standing on it
    await idle();
    loadEnv(2).then((t) => { envTex[2] = t; });
    const P2 = PANOS[2], g2 = new THREE.Group(), floor2 = -P2.h;
    if (barrel) {
      const bb = new THREE.Box3().setFromObject(barrel);
      const RU = 0.49, RD = 1.55;
      const up2 = cl(barrel); prep(up2, 2); up2.position.copy(C(RU, RD, floor2 - bb.min.y)); up2.rotation.y = 1.1; g2.add(up2);
      const s2 = new THREE.Group(); s2.position.copy(C(RU, RD, floor2 + bh - 0.004)); s2.rotation.y = faceU(RU); g2.add(s2);
      // both bottles well inside the lid (radius about 0.27 m), each with its own contact shadow
      [['wine_bottles_01_bordeaux', -0.07, 0.03, 0.6], ['wine_bottles_01_burgundy', 0.09, -0.05, 2.1]].forEach(([n, x, z, ry]) => {
        const b = bottles && pick(bottles, n); if (!b) return;
        prep(b, 2); b.position.set(x, -0.004, z); b.rotation.y = ry; s2.add(b);
        const a = blob(2, 0.12, 0.12, 0.7); a.position.set(x, 0.002, z); s2.add(a);
      });
      focus[2].copy(C(RU, RD, floor2 + 0.6));
      const ao2 = blob(2, 0.95, 0.95, 0.7); ao2.position.copy(C(RU, RD, floor2 + 0.003)); g2.add(ao2);
      const cs3 = catcher(2, 2.2, 2.2, 0.55); cs3.position.copy(C(RU, RD, floor2 + 0.002)); g2.add(cs3);
      const cs4 = catcher(2, 0.6, 0.6, 0.45); cs4.position.copy(s2.position); cs4.position.y += 0.001; g2.add(cs4);
    }
    await upload(g2); await compile(g2);
    if (lost) return;
    groups[2].add(g2); shadowsDirty = true;
    progress(1);
    opts.onLoaded && opts.onLoaded();
    wake();
  })().catch(() => { opts.onLoaded && opts.onLoaded(); });

  function detach() {
    stop(); io.disconnect();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('webglcontextlost', lostL);
    canvas.removeEventListener('webglcontextrestored', restoredL);
  }
  window.addEventListener('pagehide', (e) => { if (!e.persisted) detach(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) { tabVisible = !document.hidden; wake(); } });

  return {
    still: reduce,
    setKey(s) { const v = clamp(s, 0, NK); if (v === tgtS) return; scrollDir = v < tgtS ? -1 : 1; tgtS = v; wake(); },
    setStill(i) {
      const v = STILL[clamp(i, 0, STILL.length - 1)]; if (v === tgtS && curS === v) return; tgtS = curS = v;
      if (!canRun()) return;
      applyCamera();
      const p = segW > 0.5 ? segB : segA;
      if (!tex.has(p)) { loadPano(p).then(() => { if (canRun() && tgtS === v) draw(0, true); }); }
      draw(0, true);
    },
    setPaused(p) { paused = p; if (p) pointer.copy(pointerCur); wake(); },
  };
}
