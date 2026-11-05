// Olive & Sea (photo edition) - renderer, photo loading and residency, camera, cross-dissolves, final grade, loop.
// The world is real 360-degree photographs; the camera turns, pushes its lens and cross-dissolves between
// photographed places like a virtual tour, with real scanned props standing on the photos' floors.
import * as THREE from 'three';
import { PLACES, MODELS, makePlace, uDir } from './world.js';

async function imp(path) {
  try { return await import(path); }
  catch (e) { await new Promise((r) => setTimeout(r, 450)); return import(path + '?r=1'); }
}
const yieldTask = () => new Promise((r) => setTimeout(r, 0));
const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 500 }) : setTimeout(r, 40)));
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
const { clamp, lerp, smoothstep, degToRad } = THREE.MathUtils;

/* ------------------------------------------------------------------ the journey */
// place: which photograph; u: where the camera looks (equirect column); pitch (deg); fov; dolly: metres forward;
// sx/sy: frame shift so the subject clears the text panel (desktop / portrait); blur: background softening;
// pu: extra turn on portrait screens; drift: slow turn (in u) across the station's hold.
const KEYS = [
  { place: 0, u: 0.565, pitch: -2, fov: 50, dolly: 0.0, sx: 0.16, sy: 0.14, blur: 0, soft: 0, pu: 0.035, drift: 0.008 }, // 0 arrival: the deck, the sea through the open side
  { place: 0, u: 0.652, pitch: -9, fov: 40, dolly: 0.12, sx: -0.15, sy: 0.14, blur: 0, soft: 0, pu: 0.0, drift: 0.006 }, // 1 the terrace: tables by the water
  { place: 0, u: 0.352, pitch: -30, fov: 33, dolly: 0.0, sx: 0.14, sy: 0.1, blur: 3.5, soft: 0.55, pu: 0.022, drift: 0.004, focus: true }, // 2 lemons and ceramics on our table
  { place: 1, u: 0.515, pitch: -15, fov: 48, dolly: 0.0, sx: -0.14, sy: 0.14, blur: 0.8, soft: 0.35, pu: 0.0, drift: 0.006, focus: true }, // 3 golden hour at the water's edge
  { place: 2, u: 0.64, pitch: 3, fov: 50, dolly: 0.0, sx: -0.18, sy: 0.0, blur: 0, soft: 0, pu: -0.01, drift: 0.008 }, // 4 menu: dusk over the sea
  { place: 2, u: 0.585, pitch: 1, fov: 46, dolly: 0.0, sx: 0.16, sy: 0.16, blur: 0, soft: 0, pu: 0.0, drift: 0.006 }, // 5 reserve
];
// t ranges the page holds on each station (must match LO/HI in main.js)
const HOLD = [[0, 0.2], [-0.12, 0.12], [-0.12, 0.12], [-0.3, 0.3], [-0.12, 0.12], [-0.12, 0]];
const STILL_T = [0.1, 1, 2, 3, 4, 5];
// cross-dissolve windows per place: fade in a..b, fade out c..d (in journey t)
const WIN = [[-9, -9, 2.22, 2.62], [2.22, 2.62, 3.42, 3.82], [3.42, 3.82, 99, 99]];
const wantW = (i, t) => (WIN[i][0] < -1 ? 1 : smoothstep(t, WIN[i][0], WIN[i][1])) * (1 - smoothstep(t, WIN[i][2], WIN[i][3]));

/* ------------------------------------------------------------------ final pass: dissolve, film curve, grade */
const FINAL = {
  uniforms: {
    tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uSoft: { value: 0 }, uPx: { value: new THREE.Vector2(1e-3, 1e-3) }, uTime: { value: 0 }, uGrain: { value: 0.022 }, uVig: { value: 0.2 },
    uWB_A: { value: new THREE.Vector3(1, 1, 1) }, uWB_B: { value: new THREE.Vector3(1, 1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tA, tB; uniform float uMix, uTime, uGrain, uVig, uSoft; uniform vec2 uPx; uniform vec3 uWB_A, uWB_B; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 toSRGB(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    vec3 film(vec3 x){ return mix(x, 0.6 + 0.4 * (1.0 - exp(-(x - 0.6) / 0.4)), step(0.6, x)); }
    void main(){
      vec3 a = film(texture2D(tA, vUv).rgb) * uWB_A;
      if (uSoft > 0.001) { // the lens softness of the photograph, applied to the props too (they render razor sharp)
        vec3 bl = film(texture2D(tA, vUv + vec2(uPx.x, 0.0)).rgb) + film(texture2D(tA, vUv - vec2(uPx.x, 0.0)).rgb)
                + film(texture2D(tA, vUv + vec2(0.0, uPx.y)).rgb) + film(texture2D(tA, vUv - vec2(0.0, uPx.y)).rgb);
        a = mix(a, bl * 0.25 * uWB_A, uSoft);
      }
      if (uMix > 0.0005) a = mix(a, film(texture2D(tB, vUv).rgb) * uWB_B, uMix);
      vec2 d = vUv - 0.5; d.x *= 1.3;
      a *= mix(1.0 - uVig, 1.0, smoothstep(0.82, 0.2, length(d)));
      float lum = dot(a, vec3(0.2126, 0.7152, 0.0722));
      a *= 1.0 - 0.07 * smoothstep(0.78, 1.0, lum); // keep clipped photo whites off pure paper white
      vec3 c = toSRGB(a);
      c += (h(vUv * 911.0 + fract(uTime * 7.0) * 37.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/* ------------------------------------------------------------------ main entry */
export async function initScene(canvas, opts = {}) {
  const reduce = !!opts.reduce;
  const onProgress = opts.onProgress || (() => {});
  const small = Math.min(window.innerWidth, window.innerHeight) <= 760 && window.innerWidth <= 900;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const lowCpu = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const tier = small || coarse ? 'low' : lowCpu ? 'mid' : 'high';
  const low = tier === 'low';

  const P = (path) => imp('three/addons/' + path);
  const { GLTFLoader } = await P('loaders/GLTFLoader.js');
  const { RGBELoader } = await P('loaders/RGBELoader.js');
  onProgress(0.06);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false }); }
  catch (e) { return null; }
  const gl = renderer.getContext();
  if (!gl || !renderer.capabilities.isWebGL2 || renderer.capabilities.maxTextureSize < 4096) { renderer.dispose(); return null; }
  renderer.debug.checkShaderErrors = false;
  const bigTex = !low && renderer.capabilities.maxTextureSize >= 8192;
  const dprCap = low ? 1.0 : tier === 'mid' ? 1.25 : 1.5;
  let pr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(pr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // the final pass owns the film curve
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2000);

  const places = PLACES.map((d) => makePlace(d, { tier, maxAniso }));

  /* ---------- render targets and the final pass (rebuilt on context restore) */
  let rtA = null, rtB = null, W = 1, H = 1, portrait = false;
  const finalMat = new THREE.ShaderMaterial({ ...FINAL, uniforms: THREE.UniformsUtils.clone(FINAL.uniforms), depthTest: false, depthWrite: false });
  const post = new THREE.Scene(); const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), finalMat); quad.frustumCulled = false; post.add(quad);
  const postCam = new THREE.Camera();
  const size = new THREE.Vector2();
  function makeTargets() {
    renderer.getDrawingBufferSize(size);
    rtA = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
    rtB = null; // only the dissolves need a second target: made on first use, lighter (2x MSAA)
  }
  function resize() {
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    renderer.getDrawingBufferSize(size);
    if (rtA) rtA.setSize(size.x, size.y); if (rtB) rtB.setSize(size.x, size.y);
    camera.aspect = W / H;
    portrait = W / H < 0.9;
    wake();
  }
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(resize, 120); };
  window.addEventListener('resize', onResize);

  /* ---------- loading */
  const gltfLoader = new GLTFLoader();
  const loadGLTF = (url) => gltfLoader.loadAsync(url).then((g) => g.scene).catch(() => null);
  const loadLite = (url, rough) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('gltf')))).then((j) => {
    (j.materials || []).forEach((m) => {
      delete m.normalTexture; delete m.occlusionTexture;
      const pb = m.pbrMetallicRoughness || (m.pbrMetallicRoughness = {});
      delete pb.metallicRoughnessTexture; pb.metallicFactor = 0; pb.roughnessFactor = rough;
    });
    return gltfLoader.parseAsync(JSON.stringify(j), url.slice(0, url.lastIndexOf('/') + 1));
  }).then((g) => g.scene).catch(() => null);
  const loadEnv = (url) => new RGBELoader().loadAsync(url).then((t) => {
    t.mapping = THREE.CubeUVReflectionMapping; t.flipY = false; t.generateMipmaps = false;
    t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  }).catch(() => null);
  async function fetchBlob(url, onP) {
    const r = await fetch(url);
    if (!r.ok || !r.body) throw new Error('pano');
    const total = +r.headers.get('content-length') || 0;
    const rd = r.body.getReader(); const parts = []; let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (onP && total) onP(got / total); }
    return new Blob(parts, { type: 'image/jpeg' });
  }
  // decode in a worker: Chrome decodes a flipped bitmap on the calling thread, which froze the page for a few
  // hundred ms (pattern from jade-teahouse-photo); no worker -> decode in the page
  let worker = null, wid = 0;
  const waiting = new Map();
  function decode(blob) {
    const opt = { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' };
    try {
      if (!worker) {
        const src = "self.onmessage=async(e)=>{let bmp=null;try{bmp=await createImageBitmap(e.data.blob,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});}catch(x){}self.postMessage({id:e.data.id,bmp},bmp?[bmp]:[]);};";
        worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        worker.onmessage = (e) => { const f = waiting.get(e.data.id); waiting.delete(e.data.id); if (f) f(e.data.bmp); };
        worker.onerror = () => { waiting.forEach((f) => f(undefined)); waiting.clear(); };
      }
      const id = ++wid;
      return new Promise((res) => { waiting.set(id, res); worker.postMessage({ id, blob }); })
        .then((bmp) => bmp || createImageBitmap(blob, opt));
    } catch (e) { return createImageBitmap(blob, opt); }
  }
  // upload in strips of rows, one task each, so no single task stalls the page; mipmaps on the GPU at the end.
  // The GL texture is handed to three afterwards (texture version 0: three never re-uploads it).
  async function uploadStriped(tex, px, live) {
    const img = tex.image, w = img.width, h = img.height, st = renderer.state;
    const glt = gl.createTexture();
    const bail = () => { if (!gl.isContextLost()) gl.deleteTexture(glt); return null; };
    st.bindTexture(gl.TEXTURE_2D, glt);
    gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(w, h))) + 1, gl.SRGB8_ALPHA8, w, h);
    st.bindTexture(gl.TEXTURE_2D, null);
    const rows = Math.max(32, Math.floor(px / w));
    for (let y = 0; y < h; y += rows) {
      if (!live() || gl.isContextLost()) return bail();
      st.bindTexture(gl.TEXTURE_2D, glt);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, w); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, w, Math.min(rows, h - y), gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0); gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
      st.bindTexture(gl.TEXTURE_2D, null);
      await yieldTask();
    }
    if (!live() || gl.isContextLost()) return bail();
    st.bindTexture(gl.TEXTURE_2D, glt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
    gl.generateMipmap(gl.TEXTURE_2D);
    st.bindTexture(gl.TEXTURE_2D, null);
    const pp = renderer.properties.get(tex);
    pp.__webglTexture = glt; pp.__webglInit = true; pp.__version = tex.version;
    await yieldTask();
    return glt;
  }
  function freeTex(t, glt) { // our own GL texture: three does not own it
    if (glt && !lost && !gl.isContextLost()) gl.deleteTexture(glt);
    if (t) renderer.properties.remove(t);
  }
  let chain = Promise.resolve();
  const enqueue = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => null); return p; };
  // Every await is followed by a liveness check (still wanted, same generation, context alive): a load that is
  // dropped, superseded or hit by a context loss rolls back completely and never ends as ready-without-texture.
  function ensurePlace(i, onP) {
    const pl = places[i];
    pl.want = true;
    if (pl.ready) return Promise.resolve(true);
    if (pl.loading) return pl.loading;
    const gen = ++pl.gen;
    const live = () => pl.want && !lost && gen === pl.gen;
    const job = enqueue(async () => {
      let bmp = null, t = null, glt = null, ok = false;
      try {
        if (!live()) return false;
        if (!pl.blob) { const b = await fetchBlob(bigTex ? pl.def.pano.hi : pl.def.pano.lo, onP); if (!pl.blob) pl.blob = b; }
        if (pl.def.env && !pl.envTex) { const e = await loadEnv(pl.def.env); if (!pl.envTex && e) { pl.envTex = e; pl.scene.environment = e; } }
        if (!live()) return false;
        bmp = await decode(pl.blob);
        if (!bmp || !live()) return false;
        t = new THREE.Texture(bmp);
        t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
        t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
        t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = maxAniso;
        glt = await uploadStriped(t, ready ? 0.3e6 : 2.0e6, live);
        if (!glt || !live()) return false;
        pl.pano.material.uniforms.map.value = t;
        if (!compiled.has(i)) { await compilePlace(pl); if (!live()) return false; compiled.add(i); }
        pl.tex = t; pl.glt = glt; pl.ready = true; ok = true;
        return true;
      } catch (e) { return false; } finally {
        if (bmp && bmp.close) bmp.close(); // the GPU holds it now; a later load re-decodes from the kept blob
        if (!ok) {
          if (t && pl.pano.material.uniforms.map.value === t) pl.pano.material.uniforms.map.value = pl.tex;
          if (t) freeTex(t, glt);
        }
        if (gen === pl.gen) pl.loading = null;
        wake();
      }
    });
    pl.loading = job;
    return job;
  }
  function dropPlace(i) {
    const pl = places[i];
    pl.want = false; pl.gen++; pl.loading = null; // an in-flight load sees the new generation and rolls back
    if (pl.tex) { pl.pano.material.uniforms.map.value = null; freeTex(pl.tex, pl.glt); pl.tex = null; pl.glt = null; }
    pl.ready = false;
  }
  const compiled = new Set();
  function compileTo(root, rt) {
    renderer.setRenderTarget(rt);
    const p = renderer.compileAsync(root, camera);
    renderer.setRenderTarget(null);
    return p;
  }
  function compilePlace(pl) { return withTimeout(compileTo(pl.scene, rtA).catch(() => null), 5000); }

  /* ---------- state */
  const cur = { t: 0 }, tgt = { t: 0 };
  let intro = reduce ? 0 : 1, paused = false, clock = 0, lost = false, ready = false;
  let raf = 0, last = 0, tabVisible = !document.hidden, inView = true;
  const canRun = () => ready && !lost && tabVisible && inView;
  const pointer = new THREE.Vector2(), pointerCur = new THREE.Vector2();
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onPointer = (e) => { if (paused || reduce) return; pointer.set((e.clientX / W) * 2 - 1, (e.clientY / H) * 2 - 1); };
  if (fine) window.addEventListener('pointermove', onPointer, { passive: true });
  const t0 = clamp(+opts.t0 || 0, 0, 5);
  cur.t = tgt.t = reduce ? STILL_T[Math.round(t0)] : t0;

  // which two photographs may live on the GPU: the pair around the current part of the journey
  let pair = cur.t < 3 ? [0, 1] : [1, 2];
  function updatePairNow(t) { // a hard choice (restore): the pair for where the reader is now
    const np = t < 3.01 ? [0, 1] : [1, 2];
    if (np[0] !== pair[0]) { pair = np; places.forEach((p, i) => { if (!pair.includes(i)) dropPlace(i); }); }
  }
  function updatePair(t) {
    const np = t < 2.66 ? [0, 1] : t > 3.36 ? [1, 2] : pair; // switch only at the edges of the dusk hold, never inside it
    if (np[0] !== pair[0]) { pair = np; places.forEach((p, i) => { if (!pair.includes(i)) dropPlace(i); }); }
    // reload a missing photograph when the props have started, or at once when the reader is at (or next to) its stations
    if (bootDone) pair.forEach((i) => { if (!places[i].ready && !places[i].loading && (propsStarted || wantW(i, t + 0.45) > 0 || wantW(i, t - 0.45) > 0)) ensurePlace(i); });
  }
  let bootRestore = null, lostInBoot = false;
  const dw = [0, 0, 0];
  let bootDone = false, propsStarted = false;
  function weights(snap, dt) {
    const w = [0, 0, 0];
    pair.forEach((i) => { w[i] = places[i].ready ? wantW(i, cur.t) : 0; });
    let s = w[0] + w[1] + w[2];
    if (s < 1e-4) { // nothing wanted is ready: keep showing whichever photograph is
      const r = pair.filter((i) => places[i].ready).sort((a, b) => wantW(b, cur.t) - wantW(a, cur.t));
      if (r.length) { w[r[0]] = 1; s = 1; }
    }
    for (let i = 0; i < 3; i++) {
      const target = s > 0 ? w[i] / s : 0;
      dw[i] = snap ? target : dw[i] + (target - dw[i]) * (1 - Math.exp(-dt * 7));
      if (Math.abs(dw[i] - target) < 0.002) dw[i] = target;
      if (!places[i].ready) dw[i] = 0;
    }
  }

  function setState(s) {
    tgt.t = s.still ? STILL_T[clamp(Math.round(s.t), 0, 5)] : clamp(s.t, 0, 5);
    if (reduce || s.still) cur.t = tgt.t;
    wake();
  }

  /* ---------- camera along the journey */
  const knots = [];
  HOLD.forEach(([lo, hi], i) => { knots.push([i + lo, i === 0 ? 0 : i - 0.04], [i + hi, i === HOLD.length - 1 ? i : i + 0.04]); });
  function camParam(t) {
    if (t <= knots[0][0]) return knots[0][1];
    for (let k = 1; k < knots.length; k++) {
      const [t1, s1] = knots[k];
      if (t <= t1) { const [ta, sa] = knots[k - 1]; const f = (t - ta) / Math.max(1e-6, t1 - ta); return sa + (s1 - sa) * (f * f * (3 - 2 * f)); }
    }
    return knots[knots.length - 1][1];
  }
  const key = (s, f) => { const i = Math.min(KEYS.length - 2, Math.floor(s)), u = s - i; const e = u * u * (3 - 2 * u); return lerp(KEYS[i][f], KEYS[i + 1][f], e); };
  function keyU(s) { // shortest way round the panorama
    const i = Math.min(KEYS.length - 2, Math.floor(s)), u = s - i, e = u * u * (3 - 2 * u);
    let a = KEYS[i].u, b = KEYS[i + 1].u; if (b - a > 0.5) b -= 1; if (a - b > 0.5) b += 1;
    return a + (b - a) * e;
  }
  const look = new THREE.Vector3(), fwd = new THREE.Vector3(), camOff = new THREE.Vector3();
  let blurNow = 0, softNow = 0, fovNow = 45;
  let sNow = 0, jitU = 0, jitP = 0;
  function applyState() {
    const t = cur.t, s = camParam(t);
    const st = clamp(Math.round(t), 0, 5), hold = HOLD[st];
    const hp = clamp((t - st - hold[0]) / Math.max(1e-6, hold[1] - hold[0]), 0, 1); // progress through this station's hold
    jitU = reduce ? 0 : (hp - 0.5) * KEYS[st].drift * (Math.abs(t - st) < 0.5 ? 1 : 0);
    jitP = 0;
    if (!paused && !reduce) { jitU += Math.sin(clock * 0.13) * 0.0008; jitP += Math.sin(clock * 0.11 + 1.1) * 0.12; }
    jitU += pointerCur.x * 0.0035; jitP -= pointerCur.y * 0.6;
    sNow = s;
    camAt(s);
  }
  // the part of the journey each photograph may be seen from: deck stations 0-2, waterfront 3, promenade 4-5
  const SPAN = [[0, 2.04], [2.96, 3.04], [3.96, 5]];
  function camAt(s) {
    const u = keyU(s) + (portrait ? key(s, 'pu') : 0) + jitU;
    const pitch = key(s, 'pitch') + jitP;
    uDir(u, pitch, look);
    fwd.set(look.x, 0, look.z).normalize();
    camOff.copy(fwd).multiplyScalar(key(s, 'dolly'));
    fovNow = key(s, 'fov') * (portrait ? 1.28 : 1) + 5 * intro * intro;
    camera.fov = Math.min(fovNow, 80);
    const sx = portrait ? 0 : key(s, 'sx'), sy = portrait ? key(s, 'sy') : 0;
    camera.setViewOffset(W, H, -sx * W, sy * H, W, H);
    camera.updateProjectionMatrix();
    blurNow = key(s, 'blur'); softNow = key(s, 'soft');
  }
  function aimFor(pl) {
    camera.position.set(camOff.x, pl.def.eye, camOff.z);
    camera.lookAt(camera.position.x + look.x, camera.position.y + look.y, camera.position.z + look.z);
    camera.updateMatrixWorld();
    const un = pl.pano.material.uniforms;
    un.uBlur.value = low ? blurNow * 0.6 : blurNow;
    un.uFocus.value = pl.focus ? camera.position.distanceTo(pl.focus) : 3;
  }
  function renderPlace(pl, rt) {
    const sp = SPAN[places.indexOf(pl)];
    camAt(clamp(sNow, sp[0], sp[1]));
    aimFor(pl);
    renderer.shadowMap.needsUpdate = pl.shadowDirty; pl.shadowDirty = false;
    renderer.setRenderTarget(rt);
    renderer.render(pl.scene, camera);
  }
  function setFade(pl, f) {
    if (pl.fade === f || (Math.abs(pl.fade - f) < 0.004 && f < 1)) return;
    pl.fade = f;
    pl.props.visible = f > 0.01;
    pl.props.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m.userData.o0 === undefined) m.userData.o0 = m.opacity;
      m.opacity = m.userData.o0 * f; // props are transparent from the start: toggling it would relink every program
    });
  }
  function draw() {
    const vis = [0, 1, 2].filter((i) => dw[i] > 0.002 && places[i].ready);
    if (!vis.length) return false;
    const a = places[vis[0]];
    const sum = vis.reduce((m, i) => m + dw[i], 0);
    // props of the outgoing and incoming photographs fade faster than the photos, so they never hang as ghosts
    vis.forEach((i) => setFade(places[i], vis.length > 1 ? smoothstep(dw[i] / sum, 0.72, 0.97) : 1));
    renderPlace(a, rtA);
    const fu = finalMat.uniforms;
    fu.tA.value = rtA.texture; fu.uWB_A.value.fromArray(a.def.grade);
    if (vis.length > 1) {
      const b = places[vis[1]];
      if (!rtB) { renderer.getDrawingBufferSize(size); rtB = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 2, depthBuffer: true }); }
      renderPlace(b, rtB);
      fu.tB.value = rtB.texture; fu.uWB_B.value.fromArray(b.def.grade);
      fu.uMix.value = dw[vis[1]] / (dw[vis[0]] + dw[vis[1]]);
    } else { fu.uMix.value = 0; fu.tB.value = rtA.texture; }
    fu.uTime.value = paused || reduce ? 0.37 : clock;
    fu.uSoft.value = softNow; fu.uPx.value.set(0.8 / rtA.width, 0.8 / rtA.height);
    renderer.setRenderTarget(null);
    renderer.render(post, postCam);
    return true;
  }

  /* ---------- context loss */
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);
  function onLost(e) { e.preventDefault(); lost = true; if (!ready) lostInBoot = true; stop(); opts.onLost && opts.onLost(); }
  async function onRestored() {
    if (!ready) { lost = false; if (bootRestore) bootRestore(); return; } // during boot: boot retries the first photograph
    lost = false; ready = false;
    // objects of the dead context are forgotten, not disposed; the photographs re-decode from their kept files
    places.forEach((p) => { p.shadowDirty = true; p.gen++; p.loading = null; p.ready = false; p.tex = null; p.glt = null; p.pano.material.uniforms.map.value = null; if (p.sun) p.sun.shadow.map = null; });
    compiled.clear();
    makeTargets();
    resize();
    updatePairNow(tgt.t);
    const need = tgt.t >= 3.42 ? 2 : tgt.t >= 2.42 ? 1 : 0;
    await ensurePlace(pair.includes(need) ? need : pair[0]);
    if (lost) return;
    try { await withTimeout(compileTo(post, null), 3000); } catch (e) { /* compiled on first draw */ }
    if (lost) return;
    ready = true;
    weights(true, 0);
    opts.onRestored && opts.onRestored();
    resize();
    pair.forEach((i) => { if (!places[i].ready) ensurePlace(i); });
    startProps();
  }

  /* ---------- boot: the photograph for where the reader is, then the first frame */
  makeTargets();
  resize();
  const first = pair.includes(cur.t >= 3.4 ? 2 : cur.t >= 2.4 ? 1 : 0) ? (cur.t >= 3.4 ? 2 : cur.t >= 2.4 ? 1 : 0) : pair[0];
  // boot, with up to two retries if the context is lost while the first photograph loads or the final pass compiles
  const glDead = () => lost || renderer.getContext().isContextLost();
  let booted = false;
  for (let attempt = 0; attempt < 3 && !booted; attempt++) {
    if (attempt > 0) {
      if (!lostInBoot) break;
      await new Promise((r) => { bootRestore = r; setTimeout(r, 8000); if (!glDead()) r(); });
      bootRestore = null;
      if (glDead()) return null;
      places.forEach((p) => { p.gen++; p.loading = null; p.ready = false; p.tex = null; p.glt = null; p.pano.material.uniforms.map.value = null; if (p.sun) p.sun.shadow.map = null; });
      compiled.clear(); makeTargets(); resize();
    }
    lostInBoot = false;
    const ok = await ensurePlace(first, (f) => onProgress(0.08 + 0.8 * f));
    if (!ok || glDead()) { lostInBoot = lostInBoot || glDead(); continue; }
    onProgress(0.92);
    await withTimeout(compileTo(post, null).catch(() => null), 3000);
    if (glDead() || lostInBoot) { lostInBoot = true; continue; }
    booted = true;
  }
  if (!booted) return null;
  if (opts.onRestored && document.documentElement.classList.contains('gl-lost')) opts.onRestored();
  ready = true; bootDone = true;
  applyState();
  weights(true, 0);
  draw();
  onProgress(1);
  wake();

  /* ---------- loop: one rAF id, never two; pause = no callbacks at all */
  function settled() {
    return Math.abs(cur.t - tgt.t) < 0.0004 && intro <= 0 && pointerCur.distanceToSquared(pointer) < 1e-6 && !dwMoving;
  }
  let dwMoving = false, guard = !low, frames = 0, slow = 0;
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
    updatePair(cur.t);
    const before = dw.slice();
    weights(reduce, dt);
    dwMoving = dw.some((v, i) => Math.abs(v - before[i]) > 1e-4);
    applyState();
    draw();
    if (guard && !paused && !reduce && !document.hidden) {
      frames++; if (dt > 0.026) slow++;
      if (frames >= 90) { if (slow > 50) degrade(); frames = 0; slow = 0; }
    }
    if (!raf && !reduce && (!paused || !settled())) raf = requestAnimationFrame(frame);
  }
  let stage = 0;
  function degrade() {
    if (stage === 0 && pr > 1) { pr = Math.max(1, pr - 0.25); if (pr <= 1) stage = 1; resize(); return; }
    if (stage <= 1) { finalMat.uniforms.uGrain.value = 0.018; stage = 2; guard = false; }
  }
  function wake() {
    if (raf || !canRun()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  const io = new IntersectionObserver((en) => { inView = en[0].isIntersecting; inView ? wake() : stop(); }, { threshold: 0 });
  if (opts.watch) io.observe(opts.watch);
  const onVis = () => { tabVisible = !document.hidden; tabVisible ? wake() : stop(); };
  document.addEventListener('visibilitychange', onVis);

  /* ---------- in idle time: the props, then the next photographs */
  const M = {};
  let propsRunning = false, propsDone = false;
  const startProps = () => { if (propsRunning || propsDone) return; propsRunning = true; propLoader().finally(() => { propsRunning = false; }); };
  async function propLoader() {
    const list = low ? [['set', false], ['lemon', true], ['jug', false]] : [['set'], ['jug'], ['lemon'], ['lime'], ['vase']];
    for (const [k, lite] of list) {
      if (M[k] !== undefined) continue;
      await idle(); if (lost) return;
      M[k] = await (lite ? loadLite(MODELS[k], 0.45) : loadGLTF(MODELS[k]));
    }
    for (const i of [0, 1]) {
      await idle(); if (lost) return;
      const pl = places[i];
      if (pl.propsAdded) continue;
      const g = pl.buildProps(M);
      // upload textures one by one and compile off-scene, then show
      const seen = new Set();
      g.traverse((o) => { if (o.isMesh) for (const kk in o.material) { const v = o.material[kk]; if (v && v.isTexture) seen.add(v); } });
      for (const tx of seen) { if (lost) return; renderer.initTexture(tx); await yieldTask(); }
      if (lost) return;
      pl.props.add(g); pl.propsAdded = true; pl.shadowDirty = true;
      if (pl.ready) { try { await withTimeout(compileTo(pl.scene, rtA), 4000); } catch (e) { /* first draw compiles */ } }
      if (lost) return;
      if (paused || reduce) { applyState(); draw(); }
      wake();
      if (i === 0) { await idle(); propsStarted = true; pair.forEach((j) => { if (!places[j].ready) ensurePlace(j); }); }
    }
    propsStarted = true; propsDone = true;
    pair.forEach((j) => { if (!places[j].ready) ensurePlace(j); });
  }
  startProps();

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
