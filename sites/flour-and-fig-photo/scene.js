// Flour & Fig (photo) - sample design. The 3D layer is two real 360-degree photographs (Poly Haven, CC0) shown as
// the world around the camera, with real scanned props (croissant, carrot cake, tea set, cutting board, basket)
// on a real oak table model in the foreground, lit by each photograph's own light (a prefiltered
// environment baked offline from the photo's HDR, plus one key light from the photo's brightest window).
// A few small procedural pieces: the tea and its pour, steam, ceramic plate, contact shadows, the film grade.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const V3 = THREE.Vector3;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));
const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 700 }) : setTimeout(r, 40)));

const ASSETS = '../../assets/polyhaven/';
// the two photographed places. light: direction of the brightest window in the photo (u = 0..1 across the panorama,
// v = 0 top .. 1 bottom), measured from the HDR when the environment was baked
const PANOS = {
  // big: an 8k photo on desktops (the sharp wide frame); the dining room is only seen softened, so 4k everywhere
  hall: { id: 'studio_country_hall', big: true, env: 'assets/env-country-hall-pmrem.hdr', light: { u: 0.732, v: 0.39 }, key: 2.6, keyCol: 0xfff1e2, envI: 1.0 },
  room: { id: 'bush_restaurant', big: false, env: 'assets/env-bush-restaurant-pmrem.hdr', light: { u: 0.629, v: 0.46 }, key: 2.4, keyCol: 0xfff3e6, envI: 1.0 },
};
// direction for a panorama coordinate, in the same convention three.js uses for equirectangular maps
function panoDir(u, v, out = new V3()) {
  const a = (u - 0.5) * Math.PI * 2, el = (0.5 - v) * Math.PI;
  return out.set(Math.cos(el) * Math.cos(a), Math.sin(el), Math.cos(el) * Math.sin(a));
}

function detectTier() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600 || window.innerWidth < 760;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  if (coarse || small || cores <= 2 || mem <= 2) return 'low';
  if (cores < 6 || mem < 4) return 'mid';
  return 'high';
}

function radialTex(size, inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, size * inner, size / 2, size / 2, size * outer);
  // an alpha map is read from the green channel, so the falloff is drawn as grey on black (not as canvas alpha)
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, 'rgb(115,115,115)'); gr.addColorStop(1, '#000');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); return t;
}

export async function initScene(canvas, opts = {}) {
  const reduce = !!opts.reduce;
  const progress = opts.onProgress || (() => {});
  const tier = detectTier();
  const high = tier === 'high', low = tier === 'low';
  let pr = Math.min(window.devicePixelRatio || 1, high ? 1.5 : low ? 1 : 1.25);

  // WebGL2 only (the photograph shader needs derivatives and gradient lookups). The <head> probe records 'gl2' when
  // it got a WebGL2 context, so a WebGL1-only device keeps the posters without three.js logging a failed context
  if (!document.documentElement.classList.contains('gl2')) return null;

  /* ---------- the GL context is created now (one short call), but three.js is attached to it only after the first
     files have arrived: the renderer's first synchronous driver queries waited 300-450 ms for the GPU process when
     they ran straight after the context was made; by then the GPU side has finished starting the context ---------- */
  let gl = null;
  try { gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
  if (!gl) return null; // no WebGL2: the posters stay
  // a fence that signals once the GPU process has finished starting the context: polled without blocking, and the
  // renderer is made only after it has signalled, so its first synchronous queries return at once
  let ctxFence = null;
  try { ctxFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); } catch (e) { ctxFence = null; }
  const gpuReady = () => new Promise((res) => {
    if (!ctxFence) { res(); return; }
    const t0 = performance.now();
    const poll = () => {
      let done = true;
      try { done = gl.getSyncParameter(ctxFence, gl.SYNC_STATUS) === gl.SIGNALED; } catch (e) { done = true; }
      if (done || performance.now() - t0 > 4000) { try { gl.deleteSync(ctxFence); } catch (e) { /* lost */ } ctxFence = null; res(); }
      else setTimeout(poll, 20);
    };
    poll();
  });
  let renderer = null, aniso = 4;
  const shadowsDirty = () => { if (renderer) renderer.shadowMap.needsUpdate = true; };
  function makeRenderer() {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false });
    renderer.debug.checkShaderErrors = false;
    renderer.setPixelRatio(pr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // props are tone-mapped; the photograph is shown as photographed
    renderer.toneMappingExposure = 0.92;
    // shadows on every tier, but rendered only when something changes (a prop arrives, the pot moves, the light
    // changes with the photograph), so phones pay for them once, not every frame
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = low ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor(0xd9cbb6, 1);
    aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  // photo files per tier: 8k on desktops (checked against the real texture limit once the renderer exists), 4k / 3k on phones
  let big = !low;
  const PANO_FILE = { hall: big ? '8k' : '4k', room: big ? '8k' : low ? '3k' : '4k' };
  const ENV_SUFFIX = low ? '-lo' : ''; // phones get a smaller prefiltered environment (cube 64 instead of 128)

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.02, 120);

  /* ---------- loaders and the loading line (stage 1 = what the first frame needs) ---------- */
  const gltfLoader = new GLTFLoader();
  const weights = { pano: big ? 4.5 : 1.3, env: low ? 0.15 : 0.47, table: 0.47 };
  const done = {};
  const stage1Total = Object.values(weights).reduce((a, b) => a + b, 0);
  const report = (k, f) => { if (!(k in weights)) return; done[k] = f * weights[k]; progress(Object.values(done).reduce((a, b) => a + b, 0) / stage1Total); };

  // panoramas: fetched and decoded in a worker (Chrome decodes a flipped bitmap on the calling thread, which froze
  // the page for 0.4-0.9 s), then uploaded by hand in strips of rows (uploadStriped), one task each
  let worker = null, wid = 0;
  const waiting = new Map();
  function workerDecode(url) {
    try {
      if (!worker) {
        const src = "self.onmessage=async(e)=>{let bmp=null;try{const r=await fetch(e.data.url);if(r.ok){const b=await r.blob();bmp=await createImageBitmap(b,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});}}catch(x){}self.postMessage({id:e.data.id,bmp},bmp?[bmp]:[]);};";
        worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        worker.onmessage = (e) => { const f = waiting.get(e.data.id); waiting.delete(e.data.id); if (f) f(e.data.bmp); };
        worker.onerror = () => { waiting.forEach((f) => f(undefined)); waiting.clear(); };
      }
      const id = ++wid;
      return new Promise((res) => { waiting.set(id, res); worker.postMessage({ id, url: new URL(url, location.href).href }); });
    } catch (e) { return Promise.resolve(undefined); }
  }
  async function loadPano(key) {
    const url = `assets/pano/${PANOS[key].id}_${PANO_FILE[key]}.jpg`;
    try {
      let img = window.createImageBitmap && window.Worker ? await workerDecode(url) : undefined, flip = false;
      if (img === null) return null; // the file failed
      if (!img) { // no worker: decode in the page
        const r = await fetch(url);
        if (!r.ok) return null;
        img = new Image(); img.src = URL.createObjectURL(await r.blob()); await img.decode(); flip = true;
      }
      if (key === 'hall') report('pano', 1);
      const t = new THREE.Texture(img);
      t.flipY = flip; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
      t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
      if (flip) t.needsUpdate = true; else t.userData.striped = true;
      return t;
    } catch (e) { return null; }
  }
  // the striped upload: immutable storage, rows uploaded a slice per task, mipmaps generated on the GPU at the end;
  // the GL texture is then handed to three.js
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
      // a short pause per strip lets the GPU process drain the transfer buffer, so the next strip does not stall
      // the page waiting for it (a 0 ms yield showed 200-430 ms waits on a busy GPU)
      await new Promise((r) => setTimeout(r, 24));
    }
    if (lost || gl.isContextLost()) return null;
    st.bindTexture(gl.TEXTURE_2D, glt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, aniso);
    gl.generateMipmap(gl.TEXTURE_2D);
    st.bindTexture(gl.TEXTURE_2D, null);
    const props = renderer.properties.get(tex);
    props.__webglTexture = glt; props.__webglInit = true; props.__version = tex.version;
    await yieldFrame();
    return glt;
  }
  async function uploadPano(tex, px) {
    if (tex.userData.striped) return !!(await uploadStriped(tex, px));
    renderer.initTexture(tex); await yieldFrame(); return true;
  }
  // prefiltered environment (CubeUV layout baked offline from the photo's HDR: no PMREM shader in the browser)
  const loadEnv = (key) => new Promise((res) => new RGBELoader().load(PANOS[key].env.replace('.hdr', `${ENV_SUFFIX}.hdr`), (t) => {
    t.mapping = THREE.CubeUVReflectionMapping; t.flipY = false; t.generateMipmaps = false;
    t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
    if (key === 'hall') report('env', 1);
    res(t);
  }, undefined, () => res(null)));
  // props: desktops load the full PBR set for the heroes; small props and every phone prop skip the normal and ARM
  // maps (constant roughness instead), which keeps the phone total near 8 MB
  const ROUGH = { croissant: 0.62, carrot_cake: 0.72, tea_set_01: 0.2, wooden_cutting_board: 0.55, wicker_basket_01: 0.8, wooden_table_02: 0.6 };
  const FULL = new Set(['croissant', 'carrot_cake', 'tea_set_01', 'wooden_cutting_board', 'wooden_table_02']);
  const loadModel = (id) => new Promise((res) => {
    const url = `${ASSETS}models/${id}/${id}_1k.gltf`;
    const ok = (g) => { if (id === 'wooden_table_02') report('table', 1); res(g.scene); };
    const bad = () => { if (id === 'wooden_table_02') report('table', 1); res(null); };
    if (!low && FULL.has(id)) { gltfLoader.load(url, ok, undefined, bad); return; }
    fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('gltf')))).then((j) => {
      (j.materials || []).forEach((m) => {
        delete m.normalTexture; delete m.occlusionTexture;
        const pb = m.pbrMetallicRoughness || (m.pbrMetallicRoughness = {});
        delete pb.metallicRoughnessTexture; pb.metallicFactor = 0; pb.roughnessFactor = ROUGH[id] || 0.6;
      });
      gltfLoader.parse(JSON.stringify(j), `${ASSETS}models/${id}/`, ok, bad);
    }).catch(bad);
  });

  /* ---------- the photograph: a sphere around the camera, two photos cross-dissolved by a mix uniform ---------- */
  const skyU = {
    tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uBlur: { value: 0 },
    uGain: { value: 1 }, uLift: { value: new THREE.Vector3(0, 0, 0) }, uHasB: { value: 0 },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyU,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tA; uniform sampler2D tB; uniform float uMix; uniform float uBlur; uniform float uGain; uniform vec3 uLift; uniform float uHasB;
      varying vec3 vDir;
      // equirectangular lookup with seam-safe gradients (no line where u wraps) and a mip bias for a soft background
      vec4 pano(sampler2D t, vec2 uv, vec2 dx, vec2 dy){ return texture2DGradEXT(t, uv, dx, dy); }
      void main(){
        vec3 d = normalize(vDir);
        float u = atan(d.z, d.x) * 0.15915494 + 0.5;
        float v = asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5;
        float u2 = fract(u + 0.5);
        float dux = dFdx(u), duy = dFdy(u), dux2 = dFdx(u2), duy2 = dFdy(u2);
        dux = abs(dux) < abs(dux2) ? dux : dux2; duy = abs(duy) < abs(duy2) ? duy : duy2;
        float s = exp2(uBlur);
        vec2 gx = vec2(dux, dFdx(v)) * s, gy = vec2(duy, dFdy(v)) * s;
        vec2 uv = vec2(u, v);
        vec3 c = pano(tA, uv, gx, gy).rgb;
        if (uHasB > 0.5 && uMix > 0.001) c = mix(c, pano(tB, uv, gx, gy).rgb, uMix);
        c = c * uGain + uLift;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 64, 32), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  /* ---------- the film grade over the whole frame: vignette, a touch of grain (2 x src x dst blending) ---------- */
  const gradeU = { uTime: { value: 0 }, uVig: { value: 0.32 }, uGrain: { value: low ? 0.035 : 0.05 }, uTint: { value: new THREE.Vector3(1.0, 0.995, 0.98) } };
  const gradeMat = new THREE.ShaderMaterial({
    uniforms: gradeU,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform float uTime; uniform float uVig; uniform float uGrain; uniform vec3 uTint;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
      void main(){
        vec2 d = vUv - 0.5; float v = 1.0 - uVig * smoothstep(0.2, 0.9, dot(d, d) * 2.0);
        float n = (h(gl_FragCoord.xy) + h(gl_FragCoord.xy + 17.3) - 1.0) * uGrain;
        gl_FragColor = vec4(0.5 * v * uTint * (1.0 + n), 1.0);
      }`,
    // transparent, so it is drawn after the steam, contact shadows and fading props too (last in the transparent list)
    depthTest: false, depthWrite: false, toneMapped: false, transparent: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.SrcColorFactor,
  });
  const grade = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), gradeMat);
  grade.frustumCulled = false; grade.renderOrder = 1000;
  scene.add(grade);

  /* ---------- lights: the photo's own light (environment) plus a key from its brightest window ---------- */
  const key = new THREE.DirectionalLight(0xfff1e2, 2.6);
  key.castShadow = true;
  { // the box covers the table and its feet on the floor
    key.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    const sc = key.shadow.camera; sc.left = -0.95; sc.right = 0.95; sc.top = 0.95; sc.bottom = -0.95; sc.near = 0.5; sc.far = 6;
    // the normal bias stays small on desktops (at 2 cm it erased the croissant's and the cup's own contact shadows);
    // phones use hard PCF on a coarser map, where a small bias showed acne rings and cross-hatching on the grazing-lit
    // table, so they take a larger bias and rely on the baked blobs for contact
    key.shadow.bias = low ? -0.0025 : -0.0006; key.shadow.normalBias = low ? 0.014 : 0.004;
    key.shadow.radius = high ? 6 : 3; key.shadow.blurSamples = 16;
  }
  scene.add(key, key.target);
  const mats = new Set();
  let envI = 1;
  const track = (m, k = 1) => { mats.add(m); m.userData.envK = k; if ('envMapIntensity' in m) m.envMapIntensity = envI * k; return m; };
  function setEnvI(v) { envI = v; mats.forEach((m) => { if ('envMapIntensity' in m) m.envMapIntensity = v * (m.userData.envK || 1); }); }

  /* ---------- stage 1: the hall photograph, its light and the oak table ---------- */
  let [panoHall, envHall, tableScene] = await Promise.all([loadPano('hall'), loadEnv('hall'), loadModel('wooden_table_02')]);
  await gpuReady();
  if (gl.isContextLost()) return null;
  makeRenderer();
  if (big && renderer.capabilities.maxTextureSize < 8192) { // a desktop GPU without 8k textures: 4k photos instead
    big = false; PANO_FILE.hall = '4k'; PANO_FILE.room = '4k';
    panoHall = await loadPano('hall');
  }
  if (!panoHall) { renderer.dispose(); return null; } // no photograph, no scene: the posters stay
  panoHall.anisotropy = aniso;
  skyU.tA.value = panoHall;
  const envs = { hall: envHall, room: null };
  scene.environment = envHall;
  let curPano = 'hall';

  /* ---------- placement: metres, floor y = 0; the camera stands where the photographer stood ---------- */
  const TABLE = new V3(1.2, 0, 0);
  let TOP = 0.8;
  const table = new THREE.Group(); table.position.copy(TABLE); scene.add(table);
  // props are softened toward the photograph: their colour maps are read a little blurred (a mip bias) and slightly
  // desaturated, because the photo behind them is an upsampled, softer image; sat < 1 also tames the scans' varnish
  const soften = (m, bias, sat, tint, minRough = 0) => {
    m.userData.soft = { bias, sat, tint };
    m.customProgramCacheKey = () => `soft-${bias}-${sat}-${minRough}`;
    m.onBeforeCompile = (sh) => {
      if (minRough > 0) sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = max( roughnessFactor, ${minRough.toFixed(2)} );`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv, ${bias.toFixed(2)} );
        float lumS = dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
        sampledDiffuseColor.rgb = mix( vec3( lumS ), sampledDiffuseColor.rgb, ${sat.toFixed(2)} ) * vec3( ${tint.map((v) => v.toFixed(3)).join(', ')} );
        diffuseColor *= sampledDiffuseColor;
      #endif`);
    };
  };
  const prep = (root, k = 1, soft = [0.6, 0.92, [1, 1, 1], 0]) => {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const m = o.material; track(m, k);
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach((kk) => { if (m[kk]) m[kk].anisotropy = Math.min(aniso, 4); });
      if (m.map && !m.userData.soft) soften(m, soft[0], soft[1], soft[2], soft[3] || 0);
      if (low && m.map) downscale(m);
    });
    shadowsDirty();
    return root;
  };
  function downscale(m) { // phones: halve the model textures at load so they upload fast and fit in memory
    ['map'].forEach((kk) => {
      const t = m[kk]; if (!t || !t.image || t.userData.small) return;
      const img = t.image, w = img.width, h = img.height; if (!w || w <= 512) return;
      const c = document.createElement('canvas'); c.width = w >> 1; c.height = h >> 1;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      t.image = c; t.userData.small = true; t.needsUpdate = true;
    });
  }
  const box = new THREE.Box3(), bsz = new V3();
  // put an object on a surface: rotations first, then lift so its lowest point touches y
  function sit(obj, x, y, z, rot = [0, 0, 0], parent = scene) {
    const g = new THREE.Group(); g.add(obj); g.rotation.set(rot[0], rot[1], rot[2]);
    g.updateMatrixWorld(true); box.setFromObject(g);
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    obj.position.x -= 0; // keep the model's own pivot
    g.position.set(x - cx, y - box.min.y, z - cz);
    parent.add(g); g.updateMatrixWorld(true);
    box.setFromObject(g); box.getSize(bsz);
    return { g, top: box.max.y, w: bsz.x, d: bsz.z, h: bsz.y };
  }
  const contactTex = radialTex(128, 0.0, 0.5);
  const contactGeo = new THREE.PlaneGeometry(1, 1); contactGeo.rotateX(-Math.PI / 2);
  function contact(w, d, x, z, o = 0.5, y = TOP + 0.0012) {
    const m = new THREE.Mesh(contactGeo, new THREE.MeshBasicMaterial({ color: 0x1a0f06, alphaMap: contactTex, transparent: true, opacity: o, depthWrite: false, toneMapped: false }));
    m.material.alphaMap.colorSpace = THREE.NoColorSpace;
    m.scale.set(w, 1, d); m.position.set(x, y, z); m.renderOrder = 2;
    scene.add(m); return m;
  }
  // phones: a soft baked blob stretched away from the key light under each prop, so props read as resting even when
  // the small shadow map is too coarse to show their own contact shadow
  function castBlob(sz, x, z, y = TOP + 0.0016, o = 0.5) {
    if (!low) return null;
    const len = Math.max(sz.w, sz.d) * 0.55;
    const m = contact(sz.w * 1.15 + len * 0.5, sz.d * 1.15 + len * 0.5, x - keyDir.x * len * 0.5, z - keyDir.z * len * 0.5, o, y);
    return m;
  }
  // a shadow catcher on the photographed floor under the table (only seen in the wide frames)
  const floorShadow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.28 }));
  floorShadow.position.set(TABLE.x, 0.001, TABLE.z); floorShadow.receiveShadow = true;
  scene.add(floorShadow);
  const floorAO = contact(1.5, 1.0, TABLE.x, TABLE.z, 0.5, 0.002);

  if (tableScene) {
    // the scan's varnish reads orange under ACES: desaturated, darkened and cooled toward the weathered,
    // pale oak in the photograph, and less glossy
    // and matte: at the low pastry angle a glossy top mirrored the bright window and read as a white table
    prep(tableScene, 0.45, [0.3, 0.55, [0.9, 0.87, 0.88], 0.82]);
    tableScene.traverse((o) => { if (o.isMesh) { o.material.color.setRGB(0.95, 0.93, 0.92); } });
    const r = sit(tableScene, TABLE.x, 0, TABLE.z, [0, Math.PI / 2, 0]);
    TOP = r.top; floorAO.scale.set(r.w * 1.2, 1, r.d * 1.2);
    // a darker soft spot under each leg where it meets the photographed floor
    const hw = r.w / 2 - 0.055, hd = r.d / 2 - 0.055;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx2, sz]) => { contact(0.28, 0.28, TABLE.x + sx2 * hw, TABLE.z + sz * hd, 0.75, 0.003); contact(0.12, 0.12, TABLE.x + sx2 * hw, TABLE.z + sz * hd, 1.0, 0.0035); });
  } else {
    // no table model: a plain oak-toned slab keeps the props standing
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, 1.14), track(new THREE.MeshStandardMaterial({ color: 0x9a7650, roughness: 0.6 })));
    slab.position.set(TABLE.x, 0.78, TABLE.z); slab.receiveShadow = true; scene.add(slab); TOP = 0.8;
  }

  // prop spots on the table top (camera looks along +x; +z is to the right)
  const P = {
    board: new V3(1.06, 0, -0.2), basket: new V3(1.36, 0, -0.36), plate: new V3(1.26, 0, 0.1),
    cup: new V3(1.02, 0, 0.3), pot: new V3(1.3, 0, 0.4),
  };
  const holders = {};
  for (const k of Object.keys(P)) { const g = new THREE.Group(); g.position.set(P[k].x, TOP, P[k].z); scene.add(g); holders[k] = g; }

  /* ---------- the key light follows the photo on screen ---------- */
  const keyDir = new V3();
  function applyLight(name) {
    const p = PANOS[name];
    panoDir(p.light.u, p.light.v, keyDir);
    keyDir.y = Math.max(keyDir.y, 0.32); keyDir.normalize(); // a window is above the table, never below
    key.position.copy(TABLE).setY(TOP).addScaledVector(keyDir, 3);
    key.target.position.copy(TABLE).setY(TOP);
    key.color.set(p.keyCol); key.intensity = p.key;
    setEnvI(p.envI);
    shadowsDirty();
  }
  applyLight('hall');

  /* ---------- stage 1 prop: the croissant on the board (both arrive in idle time if slow) ---------- */
  let croissantP = null, boardP = null; // requested right after the first frame

  /* ---------- camera path: one keyframe per station ---------- */
  // p = camera, t = look-at, f = vertical fov, sx = subject shift (panel on the other side), sy = phones,
  // b = background softness (mip bias on the photo), m = which photo (0 hall, 1 dining room)
  const KF = [
    { p: [0.0, 1.5, 0.02], t: [1.6, 0.98, 0.04], f: 52, sx: 0.12, sy: 0.1, b: 0.7, m: 0 },   // morning: the room and the table
    // pastry macro, low over the board into the window light; low enough that the far table edge hides the photo's furniture
    { p: [0.89, 0.925, -0.56], t: [1.08, 0.865, -0.16], f: 30, sx: -0.14, sy: 0.14, b: 2.8, m: 0 },
    { p: [0.7, 1.0, -0.04], t: [1.26, 0.88, 0.1], f: 30, sx: 0.14, sy: 0.14, b: 2.4, m: 0 },   // the cake
    // the pour, close on the cup: the pot enters from the top edge (as if held just out of frame)
    { p: [0.72, 1.02, 0.12], t: [1.05, 0.9, 0.32], f: 30, sx: -0.13, sy: 0.14, b: 2.4, m: 0 },
    { p: [0.0, 1.55, 0.0], t: [0.42, 1.42, 0.92], f: 50, sx: 0.0, sy: 0.0, b: 1.0, m: 1 },    // the menu: the dining room
    { p: [0.12, 1.38, -0.22], t: [1.6, 0.92, 0.18], f: 46, sx: 0.12, sy: 0.12, b: 1.2, m: 1 }, // visit: the table by the windows
  ];
  const N = KF.length;
  const posCurve = new THREE.CatmullRomCurve3(KF.map((k) => new V3(...k.p)), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(KF.map((k) => new V3(...k.t)), false, 'centripetal');

  /* ---------- sizing ---------- */
  let W = 1, H = 1, portrait = false;
  function resize() {
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    portrait = W / H < 0.95;
    wake();
  }
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(resize, 120); };
  window.addEventListener('resize', onResize);

  /* ---------- state ---------- */
  const cur = { t: 0, u: new Array(N).fill(0) }, tgt = { t: 0, u: new Array(N).fill(0) };
  const STILL_U = [0.6, 0.5, 0.5, 0.62, 0.5, 0.5];
  let intro = reduce ? 0 : 1, paused = false, clock = 0;
  function setState(st) {
    if (st.still !== undefined) { tgt.t = st.still; tgt.u = STILL_U.map((v, i) => (i < st.still ? 1 : i === st.still ? v : 0)); }
    else { tgt.t = st.t; for (let i = 0; i < N; i++) tgt.u[i] = st.u[i] || 0; }
    if (reduce) { cur.t = tgt.t; cur.u = tgt.u.slice(); }
    wake();
  }

  /* ---------- per-frame ---------- */
  const camPos = new V3(), camTg = new V3(), tmp = new V3();
  function sample(key, t) { const i = Math.floor(clamp(t, 0, N - 1 - 1e-6)), f = clamp(t, 0, N - 1) - i; return lerp(KF[i][key], KF[Math.min(N - 1, i + 1)][key], easeIO(f)); }
  function applyCamera() {
    const t = clamp(cur.t, 0, N - 1);
    posCurve.getPoint(t / (N - 1), camPos); tgtCurve.getPoint(t / (N - 1), camTg);
    // a slow push while each station is held (the 'dolly' feel), and a gentle arrival on load
    const i = Math.round(t), hold = cur.u[i] || 0;
    camPos.lerp(camTg, (hold - 0.5) * 0.06);
    const asp = camera.aspect;
    const k = Math.max(1, Math.pow(1.45 / asp, 0.45));
    camPos.sub(camTg).multiplyScalar(k).add(camTg);
    if (portrait) camPos.y += 0.06; // tall screens step back; a slightly higher eye keeps the table top (and the shadows on it) readable
    if (!paused && !reduce) { camPos.y += Math.sin(clock * 0.31) * 0.002; camPos.x += Math.sin(clock * 0.23 + 1.0) * 0.003; }
    camera.position.copy(camPos); camera.lookAt(camTg);
    let fov = sample('f', t) * (1 + 0.1 * intro * intro);
    if (portrait) fov = Math.min(75, fov * 1.12);
    camera.fov = fov;
    const sx = portrait ? 0 : sample('sx', t), sy = portrait ? sample('sy', t) : 0;
    camera.setViewOffset(W, H, -sx * W, sy * H, W, H);
    camera.updateProjectionMatrix();
    sky.position.copy(camera.position);
    // photo: background softness and the cross-dissolve between the two places
    skyU.uBlur.value = low ? sample('b', t) * 0.6 : sample('b', t);
    const mix = skyU.uHasB.value ? sstep(3.3, 3.75, t) : 0;
    skyU.uMix.value = mix;
    const want = mix > 0.5 ? 'room' : 'hall';
    if (want !== curPano && (want === 'hall' || envs.room)) {
      curPano = want; scene.environment = envs[want] || envs.hall; applyLight(want);
    }
  }

  const contactGeoS = () => { const g = new THREE.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2); return g; };
  /* ---------- tea, pour and steam ---------- */
  const timeU = { value: 0 };
  const CUP_Y = 0.0105, TIP_LOCAL = new V3(0, 0.1135, 0.1395);
  const potPivot = new THREE.Group(); scene.add(potPivot);
  const P_CUP = new V3(P.cup.x, TOP, P.cup.z), P_POT = new V3(P.pot.x, TOP, P.pot.z);
  const potYaw = Math.atan2(P_CUP.x - P_POT.x, P_CUP.z - P_POT.z);
  // tea surface: a dark glossy disc whose normals carry a meniscus (the rim curls up against the china) and soft
  // rings spreading from where the pour lands, so the window reflection bends like on real liquid
  const teaU = { uPour: { value: 0 }, uHit: { value: new THREE.Vector2(0, 0) } };
  const teaMat = track(new THREE.MeshStandardMaterial({ color: 0x3a1703, emissive: 0x160701, emissiveIntensity: 0.45, roughness: 0.04 }), 0.65);
  teaMat.customProgramCacheKey = () => 'tea-surface';
  teaMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, teaU, { uTime: timeU });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vTea;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTea = position.xy;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vTea; uniform float uPour; uniform vec2 uHit; uniform float uTime;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float r = length(vTea);
          vec2 d = vTea - uHit; float rh = length(d) + 1e-4;
          float ring = sin(rh * 34.0 - uTime * 11.0) * exp(-rh * 2.2) * uPour;
          vec2 tilt = (d / rh) * ring * 0.22 + (vTea / max(r, 1e-4)) * smoothstep(0.78, 1.0, r) * 0.9;
          vec3 tW = vec3(tilt.x, 0.0, -tilt.y);
          normal = normalize(normal + (viewMatrix * vec4(tW, 0.0)).xyz); }`);
  };
  const tea = new THREE.Mesh(new THREE.CircleGeometry(1, 48), teaMat);
  tea.rotation.x = -Math.PI / 2; tea.visible = false; scene.add(tea);
  const bez = { p0: { value: new V3() }, p1: { value: new V3() }, p2: { value: new V3() }, uR: { value: 0.0021 } };
  const streamMat = track(new THREE.MeshStandardMaterial({ color: 0x4a1a03, emissive: 0x2a0e02, emissiveIntensity: 0.5, roughness: 0.08 }), 0.4);
  streamMat.customProgramCacheKey = () => 'tea-stream';
  streamMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, bez, { uTime: timeU });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 p0; uniform vec3 p1; uniform vec3 p2; uniform float uR; uniform float uTime;\nvec3 bzP(float s){ float a = 1.0 - s; return a*a*p0 + 2.0*a*s*p1 + s*s*p2; }\nvec3 bzD(float s){ return 2.0*(1.0-s)*(p1-p0) + 2.0*s*(p2-p1); }\nvec3 bzN(vec2 xz, float s){ vec3 t = normalize(bzD(s)); vec3 a = normalize(cross(t, abs(t.y) > 0.9 ? vec3(1,0,0) : vec3(0,1,0))); vec3 b = cross(t, a); return a * xz.x + b * xz.y; }')
      .replace('#include <beginnormal_vertex>', 'float sS = position.y + 0.5; vec3 objectNormal = bzN(position.xz, sS);')
      .replace('#include <begin_vertex>', `float ang = atan(position.z, position.x);
float rr = uR * mix(1.35, 0.7, sqrt(sS)) * (1.0 + 0.035 * sin(sS * 22.0 - uTime * 16.0));
vec3 transformed = bzP(sS) + bzN(position.xz, sS) * rr;`);
  };
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14, 48, true), streamMat);
  stream.frustumCulled = false; stream.visible = false; scene.add(stream);
  // a soft splash ring where the pour meets the tea (a light, blurred annulus that breathes)
  const splashTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 31);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.35, '#bbb'); gr.addColorStop(0.55, '#fff'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
  })();
  const splash = new THREE.Mesh(contactGeoS(), new THREE.MeshBasicMaterial({ color: 0xc9a27a, alphaMap: splashTex, transparent: true, opacity: 0.55, depthWrite: false }));
  splash.visible = false; splash.renderOrder = 11; scene.add(splash);
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
        vec2 q = vec2(xx * 1.8, y * 2.4 - t * 0.42);
        float w1 = fbm(q), w2 = fbm(q * 1.7 + vec2(5.2, 1.3) + w1 * 1.6);
        float strand = pow(1.0 - abs(sin((xx * 2.2 + (w2 - 0.5) * 2.6 * y + y * 0.6) * 3.1416)), 4.0);
        float body = smoothstep(1.0, 0.0, abs(xx) / mix(0.16, 0.85, y));
        float veil = clamp(w1 * 1.7 - 0.55, 0.0, 1.0);
        float fil = strand * smoothstep(0.32, 0.7, w2) * smoothstep(0.0, 0.25, y);
        float a = body * smoothstep(0.0, 0.1, y) * smoothstep(1.0, 0.3, y) * (veil * 0.7 + fil * 0.6);
        gl_FragColor = vec4(uCol, clamp(a, 0.0, 1.0) * uAmt);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const steamGeo = new THREE.PlaneGeometry(0.15, 0.3); steamGeo.translate(0, 0.15, 0);
  const steam = new THREE.Mesh(steamGeo, steamMat);
  steam.renderOrder = 12; steam.visible = false; scene.add(steam);
  let potShadow = null, haveTea = false, lastLift = -1;
  const tip = new V3(), q = new THREE.Quaternion();
  function applyPour() {
    if (!haveTea) { tea.visible = stream.visible = steam.visible = false; return; }
    const u = cur.u[3];
    const come = easeIO(sstep(0.04, 0.32, u)), go = easeIO(sstep(0.86, 1.0, u)), lift = come * (1 - go);
    const tilt = 0.66 * lift;
    tip.set(0, TIP_LOCAL.y * Math.cos(tilt) - TIP_LOCAL.z * Math.sin(tilt), TIP_LOCAL.y * Math.sin(tilt) + TIP_LOCAL.z * Math.cos(tilt));
    tip.applyAxisAngle(tmp.set(0, 1, 0), potYaw);
    const dirx = Math.sin(potYaw), dirz = Math.cos(potYaw);
    const baseX = P_CUP.x - dirx * 0.012 - tip.x, baseY = P_CUP.y + 0.142 - tip.y, baseZ = P_CUP.z - dirz * 0.012 - tip.z;
    potPivot.position.set(lerp(P_POT.x, baseX, lift), lerp(P_POT.y, baseY, lift), lerp(P_POT.z, baseZ, lift));
    q.setFromAxisAngle(tmp.set(0, 1, 0), potYaw); potPivot.quaternion.copy(q);
    potPivot.rotateX(tilt);
    if (potShadow) potShadow.material.opacity = 0.5 * (1 - lift);
    if (Math.abs(lift - lastLift) > 1e-4) { lastLift = lift; shadowsDirty(); } // the pot's shadow follows it
    const fill = sstep(0.3, 0.84, u);
    const lvl = P_CUP.y + CUP_Y + lerp(0.04, 0.063, fill);
    tea.visible = fill > 0.002;
    const r = 0.0262 + (lvl - P_CUP.y - CUP_Y - 0.02) * 0.62;
    tea.scale.setScalar(r); tea.position.set(P_CUP.x, lvl, P_CUP.z);
    const pouring = lift > 0.985 && u > 0.33 && u < 0.86;
    stream.visible = pouring;
    teaU.uPour.value = pouring ? 1 : Math.max(0, teaU.uPour.value - 0.02);
    splash.visible = pouring;
    if (pouring) {
      splash.position.set(P_CUP.x - Math.sin(potYaw) * 0.004, lvl + 0.0008, P_CUP.z - Math.cos(potYaw) * 0.004);
      const k = 1 + 0.12 * Math.sin(clock * 9.0);
      splash.scale.set(0.011 * k, 1, 0.011 * k);
      // where the stream lands, in the tea disc's own coordinates (its radius is r)
      teaU.uHit.value.set(-Math.sin(potYaw) * 0.004 / r, Math.cos(potYaw) * 0.004 / r);
    }
    if (pouring) {
      potPivot.updateMatrixWorld(true);
      bez.p0.value.copy(TIP_LOCAL).applyMatrix4(potPivot.matrixWorld);
      bez.p1.value.copy(bez.p0.value).add(tmp.set(-dirx * 0.004, -0.02, -dirz * 0.004));
      bez.p2.value.set(P_CUP.x - dirx * 0.004, lvl, P_CUP.z - dirz * 0.004);
    }
    const st = sstep(0.55, 0.95, u) * (1 - sstep(4.4, 5.0, cur.t));
    steamMat.uniforms.uAmt.value = st * 0.8;
    steam.visible = st > 0.01;
    if (steam.visible) { steam.position.set(P_CUP.x, lvl + 0.004, P_CUP.z); steam.rotation.y = Math.atan2(camera.position.x - steam.position.x, camera.position.z - steam.position.z); }
  }

  /* ---------- upload and compile helpers (one texture per task; compile against the real target) ---------- */
  async function upload(root) {
    const seen = new Set();
    root.traverse((o) => { if (o.isMesh) ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach((k) => { if (o.material[k]) seen.add(o.material[k]); }); });
    for (const t of seen) { if (renderer.getContext().isContextLost()) return; renderer.initTexture(t); await yieldFrame(); }
  }
  async function compile(root) {
    if (renderer.getContext().isContextLost()) return;
    await Promise.race([renderer.compileAsync(root, camera, scene), new Promise((r) => setTimeout(r, 3000))]);
  }
  function draw() { renderer.render(scene, camera); }

  const fades = [];
  function applyFades(dt) {
    for (let i = fades.length - 1; i >= 0; i--) {
      const f = fades[i]; f.k = Math.min(1, f.k + dt / 0.7);
      f.mats.forEach((m) => { m.opacity = easeIO(f.k); });
      if (f.k >= 1) { f.mats.forEach((m) => { m.transparent = false; m.opacity = 1; }); fades.splice(i, 1); }
    }
  }

  /* ---------- render loop: continuous while motion is on, on demand while paused or settled ---------- */
  let raf = 0, last = 0, journeyVisible = true, tabVisible = !document.hidden, lost = false, guard = !low, frames = 0, slow = 0;
  let ready = false;
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
      const k = 1 - Math.exp(-dt * 4.0);
      cur.t += (tgt.t - cur.t) * k;
      for (let i = 0; i < N; i++) { cur.u[i] += (tgt.u[i] - cur.u[i]) * k; if (Math.abs(cur.u[i] - tgt.u[i]) < 0.0003) cur.u[i] = tgt.u[i]; }
      if (Math.abs(cur.t - tgt.t) < 0.0003) cur.t = tgt.t;
      if (!paused) clock += dt;
      if (intro > 0) intro = Math.max(0, intro - dt / 3.0);
    }
    timeU.value = clock;
    gradeU.uTime.value = paused || reduce ? 0 : (clock % 10);
    applyFades(dt);
    applyCamera(); applyPour();
    draw();
    // adaptive quality: a device that cannot hold ~40 fps sheds pixels, then soft shadows, then stops watching
    if (guard && !paused && !reduce && !document.hidden) {
      frames++; if (dt > 0.026) slow++;
      if (frames === 90) { if (slow > 55) degrade(); frames = 0; slow = 0; }
    }
    if (!raf && !reduce && (!paused || !settled())) raf = requestAnimationFrame(frame);
  }
  function degrade() {
    if (pr > 1) { pr = Math.max(1, pr - 0.25); resize(); return; }
    if (key.shadow.radius > 2) { key.shadow.radius = 2; key.shadow.blurSamples = 8; shadowsDirty(); return; }
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

  // context loss: the poster shows; on restore three re-uploads the models' textures and the environments from the
  // data it still holds; the photographs were uploaded by hand, so they are uploaded again (strips) before the scene shows
  const onLost = (e) => { e.preventDefault(); lost = true; stop(); opts.onLost && opts.onLost(); };
  const onRestored = () => {
    lost = false; resize();
    (async () => {
      for (const t of [skyU.tA.value, skyU.tB.value]) { if (t && t.userData.striped && !(await uploadStriped(t, 1.0e6))) return; }
      if (lost) return;
      shadowsDirty();
      opts.onRestored && opts.onRestored();
      wake();
    })();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  /* ---------- first frame: upload the photograph (the one long task, behind the loading line), compile, draw ---------- */
  resize();
  applyCamera();
  if (!(await uploadPano(panoHall, 1.0e6))) return null;
  if (tableScene) await upload(tableScene);
  [stream, steam, tea, splash].forEach((o) => { o.visible = true; });
  await compile(scene);
  if (renderer.getContext().isContextLost()) return null;
  applyPour();
  draw();
  progress(1);
  ready = true;
  wake();
  boardP = loadModel('wooden_cutting_board');
  croissantP = loadModel('croissant');

  /* ---------- the props arrive in order of the story, each fading in; the second photograph last ---------- */
  let alive = true, croissantSrc = null;
  async function addProp(promiseOrId, place, k = 1) {
    await idle();
    if (!alive) return null;
    const root = typeof promiseOrId === 'string' ? await loadModel(promiseOrId) : await promiseOrId;
    if (!root || !alive) return null;
    prep(root, k);
    const fm = [];
    root.traverse((o) => { if (o.isMesh) fm.push(o.material); });
    await upload(root);
    // both programs are warmed: the opaque one (used once the fade ends; three compiles a separate OPAQUE variant)
    // and the transparent one used while the prop fades in, so neither compiles inside a frame
    await compile(root);
    fm.forEach((m) => { m.transparent = true; m.opacity = 0; });
    await compile(root);
    if (!alive) return null;
    const r = place(root);
    shadowsDirty(); // the prop is in the scene now: its shadow joins the map on the next frame
    fades.push({ k: reduce || paused ? 1 : 0, mats: fm });
    wake();
    return r;
  }
  (async () => {
    // the board and the croissant
    let boardTop = TOP;
    await addProp(boardP, (r) => {
      const s = sit(r, P.board.x, TOP, P.board.z, [0, 0.35, 0]); castBlob(s, P.board.x, P.board.z, TOP + 0.0014, 0.4);
      boardTop = s.top - 0.002; contact(s.w * 1.05, s.d * 1.05, P.board.x, P.board.z, 0.42);
      return s;
    }, 0.9);
    await addProp(croissantP, (r) => {
      // rests a few millimetres into its own soft underside, so the tips do not lift it off the board
      const s = sit(r, P.board.x + 0.03, boardTop - 0.001, P.board.z + 0.035, [0, -0.6, 0]); // well inside the board, never over its edge
      contact(s.w * 1.0, s.d * 1.0, P.board.x + 0.03, P.board.z + 0.035, low ? 0.85 : 0.6, boardTop + 0.004);
      castBlob(s, P.board.x + 0.03, P.board.z + 0.035, boardTop + 0.0045);
      // the basket at the back holds more of the same bake (clones share the scan's geometry and textures)
      croissantSrc = r;
      return s;
    }, 0.85);
    // the cake on a plain ceramic plate
    // a stoneware plate with a foot ring, a shallow well and a raised, rounded rim (about 3 cm tall)
    const plateMat = track(new THREE.MeshPhysicalMaterial({ color: 0xe9e1d4, roughness: 0.38, clearcoat: low ? 0.2 : 0.6, clearcoatRoughness: 0.22 }), 0.9);
    const platePts = [[0, 0.004], [0.06, 0.004], [0.062, 0.0], [0.068, 0.0], [0.071, 0.004], [0.1, 0.009], [0.132, 0.017], [0.146, 0.024], [0.152, 0.028], [0.155, 0.031], [0.153, 0.0335], [0.148, 0.0325], [0.136, 0.025], [0.11, 0.016], [0.078, 0.0115], [0, 0.011]].map(([x, y]) => new THREE.Vector2(x, y));
    const plate = new THREE.Mesh(new THREE.LatheGeometry(platePts, low ? 48 : 96), plateMat);
    plate.castShadow = true; plate.receiveShadow = true; shadowsDirty();
    plate.position.set(P.plate.x, TOP, P.plate.z);
    await compile(plate);
    scene.add(plate);
    contact(0.36, 0.36, P.plate.x, P.plate.z, 0.45);
    castBlob({ w: 0.31, d: 0.31 }, P.plate.x, P.plate.z);
    await addProp('carrot_cake', (r) => sit(r, P.plate.x, TOP + 0.0108, P.plate.z, [0, 0.9, 0]), 0.85);
    // the tea service
    await addProp('tea_set_01', (r) => {
      const byName = (n) => r.getObjectByName(n);
      const take = (n, parent, y = 0) => { const o = byName(n); if (!o) return null; o.position.set(0, y, 0); parent.add(o); return o; };
      const cupHolder = holders.cup; cupHolder.rotation.y = 2.5;
      take('tea_set_01_saucer_circular_03', cupHolder);
      take('tea_set_01_cup_small_01', cupHolder, CUP_Y);
      const pot = take('tea_set_01_teapot_01', potPivot);
      take('tea_set_01_teapot_01_lid', potPivot);
      contact(0.2, 0.2, P.cup.x, P.cup.z, 0.45); castBlob({ w: 0.15, d: 0.15 }, P.cup.x, P.cup.z);
      potShadow = contact(0.26, 0.26, P.pot.x, P.pot.z, 0.5);
      haveTea = !!pot;
      return null;
    }, 1.0);
    // second photograph and its light, loaded before the menu station is reached
    await idle();
    if (!alive) return;
    const [panoRoom, envRoom] = await Promise.all([loadPano('room'), loadEnv('room')]);
    if (alive && panoRoom) {
      if (!(await uploadPano(panoRoom, 0.6e6))) return;
      skyU.tB.value = panoRoom; skyU.uHasB.value = 1; envs.room = envRoom;
      wake();
    }
    // small props last; phones skip them (budget)
    if (low) return;
    await addProp('wicker_basket_01', (r) => {
      const s = sit(r, P.basket.x, TOP, P.basket.z, [0, 0.5, 0]);
      contact(s.w * 1.05, s.d * 1.05, P.basket.x, P.basket.z, 0.5);
      if (croissantSrc) { // three croissants resting in the basket
        [[-0.06, -0.02, 0.3, 0.12], [0.06, 0.03, -0.5, -0.1], [0.0, 0.0, 1.4, 0.0]].forEach(([dx, dz, ry, rz], i) => {
          const c = croissantSrc.clone(true);
          const ss = sit(c, P.basket.x + dx, TOP + 0.02 + i * 0.03, P.basket.z + dz, [0, ry, rz]);
          ss.g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        });
      }
      return s;
    }, 0.85);
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
    setPaused(p) { paused = p; if (p) { intro = 0; fades.forEach((f) => { f.k = 1; }); } wake(); },
  };
}
