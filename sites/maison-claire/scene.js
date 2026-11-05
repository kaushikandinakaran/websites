// Maison Claire - the 3D scene. One laid table; scrolling flies the camera around it.
// Art direction: porcelain, silver and champagne gilt on ivory linen, lit by one candle.
import * as THREE from 'three';
// Addons are fetched one after another (not as a burst) so a simple dev server is never flooded;
// the phone tier skips the post-processing modules entirely.
let RoundedBoxGeometry, mergeVertices, mergeGeometries, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, FXAAShader;
// One import with a single retry (a busy dev server can refuse a request). The retry adds a query string so a
// cached failure is not reused. If it fails twice the error bubbles up and the page keeps its poster fallback.
async function imp(path) {
  try { return await import(path); }
  catch (e) {
    await new Promise((r) => setTimeout(r, 450));
    return import(path + '?r=1');
  }
}
async function loadAddons(withPost) {
  ({ RoundedBoxGeometry } = await imp('three/addons/geometries/RoundedBoxGeometry.js'));
  ({ mergeVertices, mergeGeometries } = await imp('three/addons/utils/BufferGeometryUtils.js'));
  if (!withPost) return;
  ({ EffectComposer } = await imp('three/addons/postprocessing/EffectComposer.js'));
  ({ RenderPass } = await imp('three/addons/postprocessing/RenderPass.js'));
  ({ UnrealBloomPass } = await imp('three/addons/postprocessing/UnrealBloomPass.js'));
  ({ OutputPass } = await imp('three/addons/postprocessing/OutputPass.js'));
  ({ ShaderPass } = await imp('three/addons/postprocessing/ShaderPass.js'));
  ({ FXAAShader } = await imp('three/addons/shaders/FXAAShader.js'));
}

const { Vector2, Vector3, Color } = THREE;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const outBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
// The world is built in short steps; between steps the page gets the main thread back (scroll, menu, input).
const nap = () => new Promise((r) => setTimeout(r, 0));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Bakes several static meshes that share one material into a single mesh (one draw call instead of many).
function mergeMeshes(meshes, material) {
  const gs = meshes.map((m) => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); });
  const g = mergeGeometries(gs, false);
  gs.forEach((x) => x.dispose()); meshes.forEach((m) => m.geometry.dispose());
  return new THREE.Mesh(g, material);
}
const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();

/* ------------------------------------------------------------------ camera path */
// th = orbit angle, ph = elevation, R = distance, tg = look target, sx = sideways frame shift (desktop),
// sy = upward frame shift (phones, where the text panel sits at the bottom).
const KF = [
  { th: 0.00, ph: 1.36, R: 21.0, tg: [-0.1, 0.0, 0.2], fov: 32, sx: 0.26, sy: 0.2, bo: 1 }, // 0 the table
  { th: -0.62, ph: 0.78, R: 11.5, tg: [0.0, 0.7, 0.5], fov: 32, sx: -0.2, sy: 0.2 }, // 1 the cloche
  { th: 0.25, ph: 0.16, R: 9.6, tg: [1.9, 1.3, -2.4], fov: 30, sx: 0.2, sy: 0.2 }, // 2 the wine
  { th: -0.9, ph: 0.62, R: 12.0, tg: [0.0, 0.5, -0.3], fov: 34, sx: 0.0, sy: 0.0 }, // 3 the menu
  { th: -0.35, ph: 1.3, R: 14.0, tg: [-0.3, 0.2, 0.3], fov: 32, sx: 0.2, sy: 0.2, bo: 1 }, // 4 reserve
];

/* ------------------------------------------------------------------ small texture helpers */
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const radialTex = (stops, size = 128) => canvasTex(size, size, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

/* ------------------------------------------------------------------ geometry helpers */
const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), seg);

function buildCloth() {
  const prof = [];
  for (let k = 17; k >= 0; k--) { // hem up to the table edge
    const y = -0.4 - k * 0.34;
    prof.push([4.78 + (17 - k) * 0 + k * 0.045, y]);
  }
  prof.push([4.78, -0.35], [4.7, -0.12], [4.56, -0.02], [4.3, 0], [2, 0], [0, 0]);
  let g = lathe(prof, 200);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < -0.3) {
      const s = clamp((-y - 0.3) / 2.4, 0, 1);
      const a = Math.atan2(z, x), r = Math.hypot(x, z);
      const r2 = r + s * (0.17 * Math.sin(a * 30) + 0.07 * Math.sin(a * 17 + 1.3) + 0.04 * Math.sin(a * 53));
      p.setXYZ(i, Math.cos(a) * r2, y + (y < -5.5 ? 0.1 * Math.sin(a * 30) : 0), Math.sin(a) * r2);
    }
  }
  g.computeVertexNormals();
  return g;
}

const PLATE_PROFILE = [[0, 0.03], [0.55, 0.03], [0.58, 0], [0.72, 0], [0.76, 0.03], [1.0, 0.07], [1.28, 0.17], [1.33, 0.2], [1.32, 0.215], [1.26, 0.21], [1.12, 0.16], [0.95, 0.1], [0.78, 0.075], [0, 0.075]];
const CHARGER_PROFILE = [[0, 0.03], [1.3, 0.03], [1.4, 0], [1.58, 0], [1.66, 0.05], [1.76, 0.17], [1.8, 0.2], [1.79, 0.235], [1.72, 0.23], [1.56, 0.19], [1.42, 0.13], [1.25, 0.12], [0, 0.12]];

// Wine glass: [r, y] outer profile from the foot up, then the inner bowl wall back down.
const GLASS_OUT = [[0, 0], [0.62, 0], [0.64, 0.03], [0.55, 0.06], [0.12, 0.12], [0.058, 0.22], [0.05, 0.85], [0.09, 0.96], [0.22, 1.07], [0.38, 1.24], [0.47, 1.5], [0.485, 1.72], [0.43, 1.98], [0.375, 2.15]];
const GLASS_IN = GLASS_OUT.slice(6).map(([r, y]) => [Math.max(0, r - 0.028), y + 0.02]).reverse();
const BOWL_IN = GLASS_IN.slice().reverse(); // inner wall bottom->top, used for the wine volume
function bowlRadiusAt(y) {
  for (let i = 0; i < BOWL_IN.length - 1; i++) {
    const [r0, y0] = BOWL_IN[i], [r1, y1] = BOWL_IN[i + 1];
    if (y <= y1) return lerp(r0, r1, clamp((y - y0) / (y1 - y0), 0, 1));
  }
  return BOWL_IN[BOWL_IN.length - 1][0];
}

/* ------------------------------------------------------------------ main entry */
export async function initScene(canvas, opts = {}) {
  const reduce = !!opts.reduce;
  const small = window.innerWidth <= 760;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const lowCpu = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const tier = small || coarse || lowCpu ? 'low' : 'high';
  let guard = true; // adaptive-quality watcher, switched off after its last stage
  let ready = false; // nothing renders until the world is built and its shaders are compiled
  const dprCap = small || coarse ? 1.0 : lowCpu ? 1.25 : 1.5;
  await loadAddons(tier === 'high');

  // The context is created on its own step (it can wait on a busy GPU process), then three.js sets up on the next.
  const glAttrs = { alpha: false, antialias: tier === 'low', depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
  const context = canvas.getContext('webgl2', glAttrs) || undefined;
  await nap();
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: tier === 'low', powerPreference: 'high-performance', alpha: false, stencil: false });
  renderer.setClearColor(0x0d0c0b, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  // no synchronous getProgramInfoLog after each link: programs compile in parallel and the page is not blocked
  renderer.debug.checkShaderErrors = false;
  renderer.shadowMap.enabled = tier === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let pr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(pr);
  await nap();

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.024);
  scene.fog.color.setRGB(0.05, 0.03, 0.018);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 160);

  /* ---------- post-processing (desktop tier) */
  let composer = null, bloom = null, fxaa = null, outPass = null;
  const size = new Vector2();
  function makeComposer() {
    if (tier !== 'high') return;
    renderer.getDrawingBufferSize(size);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 0 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new Vector2(256, 256), 0.5, 0.75, 1.15);
    composer.addPass(bloom);
    outPass = new OutputPass();
    composer.addPass(outPass);
    // anti-aliasing after tone mapping (an MSAA render target is avoided: it renders black tiles on some AMD/ANGLE drivers)
    // the stock shader asks for a -100 sample bias (clamped, with a console warning, and pointless on targets without
    // mipmaps): sample plainly instead
    fxaa = new ShaderPass({ ...FXAAShader, fragmentShader: FXAAShader.fragmentShader.replace(/,\s*-100\.0\)/g, ')') });
    composer.addPass(fxaa);
  }
  makeComposer();

  // Shader programs are compiled in parallel, off the main thread, while the world is still being built: each
  // finished part is handed to the GPU driver at once. With post-processing the scene renders into the composer's
  // target (no tone mapping), which needs other programs than the screen, so it is compiled against that target.
  const jobs = [];
  function precompile() {
    try {
      renderer.setRenderTarget(composer ? composer.readBuffer : null);
      jobs.push(renderer.compileAsync(scene, camera));
    } catch (e) { /* compiled on first use instead */ }
    renderer.setRenderTarget(null);
  }
  // the post-processing programs too: every pass but the last draws into a render target, the last to the screen
  if (composer) {
    try {
      // the output pass picks its defines on its first render; set them now so that render reuses this program
      outPass._outputColorSpace = renderer.outputColorSpace; outPass._toneMapping = renderer.toneMapping;
      outPass.material.defines = renderer.outputColorSpace === THREE.SRGBColorSpace ? { SRGB_TRANSFER: '' } : {};
      if (renderer.toneMapping === THREE.ACESFilmicToneMapping) outPass.material.defines.ACES_FILMIC_TONE_MAPPING = '';
      outPass.material.needsUpdate = true;
      const quad = new THREE.PlaneGeometry(2, 2), qcam = new THREE.Camera();
      const toTarget = new THREE.Scene(), toScreen = new THREE.Scene();
      [bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial, outPass.material]
        .forEach((m) => toTarget.add(new THREE.Mesh(quad, m)));
      toScreen.add(new THREE.Mesh(quad, fxaa.material));
      renderer.setRenderTarget(composer.readBuffer);
      jobs.push(renderer.compileAsync(toTarget, qcam));
      renderer.setRenderTarget(null);
      jobs.push(renderer.compileAsync(toScreen, qcam));
    } catch (e) { renderer.setRenderTarget(null); }
  }

  /* ---------- environment (a dark room with warm lamps, for metal / glass / porcelain reflections) */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMats = new Set();
  let envTex = null;
  function envScene() {
    const e = new THREE.Scene();
    e.add(new THREE.Mesh(new THREE.BoxGeometry(34, 18, 34), new THREE.MeshBasicMaterial({ color: 0x1a1613, side: THREE.BackSide })));
    const panel = (w, h, col, k, pos, look) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(...look); e.add(m);
    };
    panel(14, 9, 0xfff0d8, 3.2, [0, 8.6, 2], [0, 0, 0]); // overhead soft box
    panel(5, 9, 0xffe0b0, 3.2, [-14, 3, 3], [0, 0, 0]); // warm lamp left
    panel(5, 9, 0xffd7a0, 2.6, [14, 3, -2], [0, 0, 0]); // warm lamp right
    panel(18, 2, 0xa9b9e0, 1.6, [0, 3, -16], [0, 0, 0]); // cool back strip
    panel(10, 2.5, 0xfff4e0, 1.4, [0, 2, 16], [0, 0, 0]); // front fill
    return e;
  }
  function buildEnv(e = envScene()) {
    const rt = pmrem.fromScene(e, 0.03);
    e.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    return rt.texture;
  }
  await nap();
  {
    // the room's own (tiny) programs compile in parallel first, so the bake below only renders
    const e = envScene(), tmp = new THREE.WebGLRenderTarget(1, 1);
    try {
      renderer.setRenderTarget(tmp);
      const job = renderer.compileAsync(e, camera);
      renderer.setRenderTarget(null);
      await Promise.race([job, sleep(3000)]);
    } catch (err) { renderer.setRenderTarget(null); }
    tmp.dispose();
    await nap();
    envTex = buildEnv(e);
  }
  await nap();
  const withEnv = (mat, k = 1) => { mat.envMap = envTex; mat.envMapIntensity = k; envMats.add(mat); return mat; };

  /* ---------- backdrop: dim room with a warm horizon glow */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(90, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec3 vP; void main(){
        float h = vP.y;
        vec3 low = vec3(0.045,0.040,0.036);
        vec3 glow = vec3(0.05,0.03,0.018);
        vec3 top = vec3(0.020,0.019,0.019);
        vec3 c = mix(low, glow, smoothstep(-0.25,0.05,h)*(1.0-smoothstep(0.05,0.55,h)));
        c = mix(c, top, smoothstep(0.1,0.8,h));
        gl_FragColor = vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
  );
  scene.add(sky);

  /* ---------- lights */
  scene.add(new THREE.HemisphereLight(0x75757c, 0x24180f, 0.3));
  const key = new THREE.SpotLight(0xfff0d6, 72, 0, 0.42, 0.75, 2);
  key.position.set(1.5, 13.5, 5);
  key.target.position.set(0, 0, -0.2);
  key.castShadow = tier === 'high';
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 6; key.shadow.camera.far = 24;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x8ea6e0, 0.6);
  rim.position.set(-6, 5, -10);
  scene.add(rim);
  const candleLight = new THREE.PointLight(0xffa850, 12, 0, 2);
  scene.add(candleLight);
  const dishGlow = new THREE.PointLight(0xffd9a0, 0, 5, 2);
  dishGlow.position.set(0, 1.5, 0.6);
  scene.add(dishGlow);

  /* ---------- table, cloth, floor */
  const world = new THREE.Group();
  scene.add(world);

  const clothMat = new THREE.MeshStandardMaterial({ color: 0xfff7e2, roughness: 0.94, metalness: 0, side: THREE.DoubleSide });
  const cloth = new THREE.Mesh(buildCloth(), clothMat);
  cloth.receiveShadow = true; cloth.castShadow = false;
  world.add(cloth);
  precompile(); await nap();
  const goldMat = withEnv(new THREE.MeshStandardMaterial({ color: 0xe7d09a, metalness: 1, roughness: 0.3 }), 1.5);
  // the two gilt hem lines are one mesh
  const hemMat = new THREE.MeshBasicMaterial({ color: 0xcfae6a, transparent: true, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const hem = mergeMeshes([new THREE.Mesh(new THREE.RingGeometry(3.98, 4.02, 160)), new THREE.Mesh(new THREE.RingGeometry(3.86, 3.875, 160))], hemMat);
  hem.rotation.x = -Math.PI / 2; hem.position.y = 0.004;
  world.add(hem);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(70, 48), new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 0.85, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -6.6; floor.receiveShadow = true;
  scene.add(floor);

  // soft contact shadows (all tiers; cheap) so objects sit on the linen
  const blobTex = radialTex([[0, 'rgba(0,0,0,0.85)'], [0.55, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, opacity: 0.8 });
  const blobMats = new Map(); // one material per opacity, shared
  const blobGeo = new THREE.PlaneGeometry(2, 2);
  const blob = (x, z, r, sx = 1, sz = 1, op = 0.8) => {
    if (!blobMats.has(op)) { const bm = blobMat.clone(); bm.opacity = op; blobMats.set(op, bm); }
    const m = new THREE.Mesh(blobGeo, blobMats.get(op));
    sx *= r; sz *= r; m.rotation.x = -Math.PI / 2; m.position.set(x, 0.006, z); m.scale.set(sx, sz, 1);
    world.add(m); return m;
  };

  /* ---------- place setting */
  const PZ = 0.6; // plate centre z
  const porcelain = withEnv(new THREE.MeshPhysicalMaterial({ color: 0xf6f2e8, roughness: 0.38, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.3 }), 0.25);
  const charger = new THREE.Mesh(lathe(CHARGER_PROFILE, 96), goldMat);
  charger.position.set(0, 0, PZ); charger.castShadow = charger.receiveShadow = true;
  world.add(charger);
  const plate = new THREE.Mesh(lathe(PLATE_PROFILE, 96), porcelain);
  plate.position.set(0, 0.12, PZ); plate.castShadow = plate.receiveShadow = true;
  world.add(plate);
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(1.255, 0.011, 8, 120), goldMat);
  rimRing.rotation.x = Math.PI / 2; rimRing.position.set(0, 0.12 + 0.206, PZ);
  world.add(rimRing);
  blob(0, PZ + 0.1, 2.35, 1, 1, 0.9);

  // napkin: two folds and a wine-red band
  const napkin = new THREE.Group();
  const linen = new THREE.MeshStandardMaterial({ color: 0xf3ecdc, roughness: 0.98 });
  const n2 = new THREE.Mesh(new RoundedBoxGeometry(1.26, 0.07, 1.1, 4, 0.03));
  n2.position.set(0.02, 0.085, 0.45); n2.rotation.y = 0.04;
  const n1 = mergeMeshes([new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.1, 2.05, 4, 0.045)), n2], linen);
  const band = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.22, 0.17, 3, 0.045), new THREE.MeshStandardMaterial({ color: 0x7b1e32, roughness: 0.55 }));
  band.position.set(0, 0.04, -0.15);
  napkin.add(n1, band);
  napkin.children.forEach((m) => { m.castShadow = m.receiveShadow = true; });
  napkin.position.set(-3.35, 0.06, PZ + 0.1); napkin.rotation.y = 0.05;
  world.add(napkin);
  blob(-3.35, PZ + 0.1, 1.5, 0.85, 1.35, 0.55);

  // gilt flatware
  const extrude = (shape) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 2, curveSegments: 10 });
    const m = new THREE.Mesh(g);
    m.rotation.x = -Math.PI / 2; return m;
  };
  const forkShape = () => {
    const s = new THREE.Shape();
    s.moveTo(-0.075, 0); s.bezierCurveTo(-0.085, 0.45, -0.065, 0.9, -0.075, 1.15);
    s.bezierCurveTo(-0.08, 1.3, -0.19, 1.34, -0.19, 1.5);
    const xs = [-0.19, -0.085, 0.02, 0.125];
    xs.forEach((x, k) => {
      s.lineTo(x, 1.93); s.quadraticCurveTo(x + 0.035, 2.02, x + 0.07, 1.93); s.lineTo(x + 0.07, 1.62);
      if (k < 3) s.lineTo(xs[k + 1], 1.62);
    });
    s.lineTo(0.195, 1.5); s.bezierCurveTo(0.195, 1.34, 0.08, 1.3, 0.075, 1.15);
    s.bezierCurveTo(0.065, 0.9, 0.085, 0.45, 0.075, 0); s.quadraticCurveTo(0, -0.06, -0.075, 0);
    return s;
  };
  const knifeShape = () => {
    const s = new THREE.Shape();
    s.moveTo(-0.07, 0); s.lineTo(-0.07, 1.0); s.bezierCurveTo(-0.07, 1.08, -0.1, 1.12, -0.1, 1.2); s.lineTo(-0.1, 2.0);
    s.bezierCurveTo(-0.1, 2.26, 0.1, 2.24, 0.1, 1.9); s.lineTo(0.1, 1.3); s.bezierCurveTo(0.1, 1.14, 0.07, 1.08, 0.07, 1.0);
    s.lineTo(0.07, 0); s.quadraticCurveTo(0, -0.06, -0.07, 0);
    return s;
  };
  const spoonShape = () => {
    const s = new THREE.Shape();
    s.moveTo(-0.065, 0); s.lineTo(-0.045, 1.1); s.bezierCurveTo(-0.045, 1.22, -0.21, 1.3, -0.21, 1.62);
    s.bezierCurveTo(-0.21, 1.98, -0.1, 2.12, 0, 2.12); s.bezierCurveTo(0.1, 2.12, 0.21, 1.98, 0.21, 1.62);
    s.bezierCurveTo(0.21, 1.3, 0.045, 1.22, 0.045, 1.1); s.lineTo(0.065, 0); s.quadraticCurveTo(0, -0.06, -0.065, 0);
    return s;
  };
  const fork = extrude(forkShape()); fork.position.set(-2.2, 0.02, PZ + 1.0);
  const knife = extrude(knifeShape()); knife.position.set(2.15, 0.02, PZ + 1.05);
  const spoon = extrude(spoonShape()); spoon.position.set(2.62, 0.02, PZ + 0.95);
  const flatware = mergeMeshes([fork, knife, spoon], goldMat); // static: one mesh, one draw
  flatware.castShadow = flatware.receiveShadow = true;
  world.add(flatware);
  precompile(); await nap();

  /* ---------- wine glass + wine (clipped volume) */
  const glassGroup = new THREE.Group();
  glassGroup.position.set(2.75, 0.012, -1.9);
  world.add(glassGroup);
  const glassMat = withEnv(new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, roughness: 0.02, metalness: 0, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }), 1.5);
  glassMat.onBeforeCompile = (sh) => { // glass reads by its edges: opaque at grazing angles, clear face-on
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
      float gf = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 3.0);
      gl_FragColor.a = clamp(0.05 + gf * 0.36, 0.0, 1.0);`);
  };
  const glass = new THREE.Mesh(lathe([...GLASS_OUT, ...GLASS_IN], 72), glassMat);
  glass.renderOrder = 4;
  glassGroup.add(glass);
  const wineMat = withEnv(new THREE.MeshPhysicalMaterial({ color: 0x3d0612, roughness: 0.05, metalness: 0, clearcoat: 1, emissive: 0x52091b, emissiveIntensity: 0.85, side: THREE.DoubleSide }), 1.8);
  // the wine surface cuts the volume in the shader (a uniform, not a renderer clipping plane), so the program is
  // known in advance and compiles with the rest instead of on the first frame of the pour
  const wineClip = { value: 0 };
  wineMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWineClip = wineClip;
    sh.vertexShader = 'varying float vWineY;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWineY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = 'varying float vWineY;\nuniform float uWineClip;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (vWineY > uWineClip) discard;');
  };
  wineMat.customProgramCacheKey = () => 'mc-wine';
  const wineBody = new THREE.Mesh(lathe([[0, BOWL_IN[0][1]], ...BOWL_IN.map(([r, y]) => [r * 0.985, y])], 64), wineMat);
  wineBody.renderOrder = 1;
  glassGroup.add(wineBody);
  const meniscus = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x7a1428, roughness: 0.04, metalness: 0.1, emissive: 0x4a0a18, emissiveIntensity: 1.1 }));
  meniscus.rotation.x = -Math.PI / 2; meniscus.renderOrder = 1;
  glassGroup.add(meniscus);
  blob(glassGroup.position.x, glassGroup.position.z, 1.0, 1, 1, 0.7);
  const GLASS_FILL0 = BOWL_IN[0][1] + 0.02, GLASS_FILL1 = 1.62;
  function setWine(level, show) {
    wineBody.visible = meniscus.visible = show;
    const y = lerp(GLASS_FILL0, GLASS_FILL1, level);
    wineClip.value = y + glassGroup.position.y; // world height (the table group sits at the origin)
    meniscus.position.y = y;
    const r = bowlRadiusAt(y) * 0.985;
    meniscus.scale.set(r, r, 1);
    return y;
  }

  /* ---------- wine bottle (pours in at the wine station) */
  const bottleRoot = new THREE.Group(); // origin = bottle mouth
  const bottleTilt = new THREE.Group();
  bottleRoot.add(bottleTilt);
  const bottleMat = withEnv(new THREE.MeshPhysicalMaterial({ color: 0x0b1a12, roughness: 0.07, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 }), 1.8);
  const BOT = [[0, 0.02], [0.33, 0.02], [0.38, 0.07], [0.385, 1.7], [0.36, 2.0], [0.27, 2.25], [0.16, 2.46], [0.14, 2.62], [0.15, 2.7], [0.0, 2.7]];
  const bottle = new THREE.Mesh(lathe(BOT, 56), bottleMat);
  bottle.position.y = -2.7;
  bottleTilt.add(bottle);
  const foil = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.152, 0.5, 40), new THREE.MeshStandardMaterial({ color: 0x7b1e32, roughness: 0.4, metalness: 0.2 }));
  foil.position.y = -0.27;
  bottleTilt.add(foil);
  const labelTex = canvasTex(512, 600, (g, w, h) => {
    g.fillStyle = '#f1e9d6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8955a'; g.lineWidth = 5; g.strokeRect(22, 22, w - 44, h - 44);
    g.lineWidth = 1.5; g.strokeRect(34, 34, w - 68, h - 68);
    g.fillStyle = '#7b1e32'; g.textAlign = 'center';
    g.font = '500 150px "Cormorant Garamond", Georgia, serif'; g.fillText('MC', w / 2, 230);
    g.fillStyle = '#1d1a17'; g.font = '500 54px "Cormorant Garamond", Georgia, serif'; g.fillText('Maison Claire', w / 2, 330);
    g.fillStyle = '#7a5c24'; g.fillRect(w / 2 - 60, 362, 120, 3);
    g.fillStyle = '#4d463d'; g.font = '500 30px "Jost", sans-serif'; g.fillText('SAMPLE LABEL', w / 2, 430);
  });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.392, 0.392, 0.82, 40, 1, true, -0.95, 1.9), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.7, side: THREE.DoubleSide }));
  label.position.y = -2.7 + 0.82;
  label.rotation.y = Math.PI / 2 + 0.0; // turn the label toward the camera side
  bottleTilt.add(label);
  bottleTilt.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  bottleRoot.rotation.y = -1.0;
  world.add(bottleRoot);
  bottleRoot.visible = false;
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.016, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x8e1f36, transparent: true, opacity: 0.9, depthWrite: false }));
  stream.geometry.translate(0, -0.5, 0); // hangs down from its origin
  stream.visible = false;
  world.add(stream);
  precompile(); await nap();

  /* ---------- candle in a gilt stick, with a shader flame */
  const CX = 0.55, CZ = -3.05;
  const candle = new THREE.Group();
  candle.position.set(CX, 0, CZ);
  const stick = new THREE.Mesh(lathe([[0, 0], [0.56, 0], [0.6, 0.04], [0.52, 0.1], [0.22, 0.24], [0.12, 0.32], [0.1, 0.52], [0.18, 0.64], [0.1, 0.76], [0.1, 0.92], [0.2, 1.04], [0.27, 1.12], [0.44, 1.2], [0.46, 1.26], [0.4, 1.24], [0.26, 1.16], [0, 1.16]], 64), goldMat);
  const wax = new THREE.Mesh(lathe([[0, 0], [0.205, 0], [0.205, 1.8], [0.195, 1.85], [0.14, 1.82], [0.06, 1.77], [0, 1.77]], 40), new THREE.MeshStandardMaterial({ color: 0xf3ead6, roughness: 0.55, emissive: 0xffa040, emissiveIntensity: 0.12 }));
  wax.position.y = 1.16;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.12, 6), new THREE.MeshBasicMaterial({ color: 0x1a120c }));
  wick.position.y = 1.16 + 1.8;
  candle.add(stick, wax, wick);
  candle.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  world.add(candle);
  blob(CX, CZ, 1.05, 1, 1, 0.75);

  const flameY = 1.16 + 1.8 + 0.05;
  const flameProfile = [];
  for (let i = 0; i <= 26; i++) { const y = i / 26; flameProfile.push([Math.max(0, 0.092 * Math.sin(Math.PI * Math.pow(y, 0.58)) * (1 - 0.28 * y)), y * 0.52]); }
  const flameMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vec3 p = position; float h = clamp(p.y/0.52, 0.0, 1.0);
        p.x += (sin(uTime*7.0 + p.y*9.0)*0.02 + sin(uTime*13.0 + p.y*17.0)*0.008) * h*h*1.6;
        p.z += cos(uTime*6.0 + p.y*8.0) * 0.016 * h*h*1.6;
        p.y *= 1.0 + 0.07*sin(uTime*11.0 + 1.3);
        vec4 mv = modelViewMatrix*vec4(p,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vY = h; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.3);
        vec3 base = vec3(0.30,0.50,1.0)*0.9; vec3 core = vec3(1.0,0.92,0.7)*2.6; vec3 mid = vec3(1.0,0.6,0.16)*1.9; vec3 tip = vec3(1.0,0.34,0.07)*1.2;
        vec3 c = mix(base, mix(core, mix(mid, tip, smoothstep(0.45,1.0,vY)), smoothstep(0.12,0.5,vY)), smoothstep(0.0,0.2,vY));
        float a = f*(1.0 - pow(vY, 2.2))*0.95;
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const flame = new THREE.Mesh(lathe(flameProfile, 20), flameMat);
  flame.position.set(CX, flameY, CZ);
  flame.renderOrder = 6;
  world.add(flame);
  const glowTex = radialTex([[0, 'rgba(255,200,120,1)'], [0.25, 'rgba(255,160,70,0.5)'], [1, 'rgba(255,120,40,0)']], 128);
  const glowA = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.6 }));
  glowA.position.set(CX, flameY + 0.2, CZ); glowA.scale.set(2.2, 2.2, 1); glowA.renderOrder = 7;
  const glowB = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, fog: false, opacity: 0.075 }));
  glowB.position.copy(glowA.position); glowB.scale.set(8, 8, 1); glowB.renderOrder = 8;
  world.add(glowA, glowB);
  candleLight.position.set(CX, flameY + 0.35, CZ);
  precompile(); await nap();

  /* ---------- silver cloche */
  const cloche = new THREE.Group();
  const silver = withEnv(new THREE.MeshStandardMaterial({ color: 0xdfe2e6, metalness: 1, roughness: 0.13 }), 1.6);
  {
    const R = 1.12, H = 1.28, th = 0.035, pts = [[R + 0.05, 0], [R + 0.05, 0.05], [R + 0.01, 0.07]];
    for (let i = 1; i <= 28; i++) { const a = (i / 28) * Math.PI / 2; pts.push([R * Math.cos(a), 0.07 + H * Math.sin(a)]); }
    for (let i = 27; i >= 0; i--) { const a = (i / 28) * Math.PI / 2; pts.push([(R - th) * Math.cos(a), 0.07 + (H - th) * Math.sin(a)]); }
    pts.push([R - th - 0.0, 0.06]);
    const dome = new THREE.Mesh(lathe(pts, 96));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16));
    knob.position.y = 0.07 + H + 0.1;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.12, 16));
    neck.position.y = 0.07 + H + 0.0;
    const body = mergeMeshes([dome, knob, neck], silver); // one mesh, one draw
    body.castShadow = true;
    cloche.add(body);
  }
  world.add(cloche);
  precompile(); await nap();

  /* ---------- the dish (revealed under the cloche) */
  const dish = new THREE.Group();
  dish.position.set(0, 0.12 + 0.075, PZ);
  world.add(dish);
  const dishItems = [];
  const addItem = (mesh, delay, ox = 0, oy = 0, oz = 0) => {
    const holder = new THREE.Group(); holder.position.set(ox, oy, oz); holder.add(mesh);
    holder.userData.delay = delay; dish.add(holder); dishItems.push(holder);
    mesh.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return holder;
  };
  const pure = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 14), withEnv(new THREE.MeshPhysicalMaterial({ color: 0xe8dcb0, roughness: 0.5, clearcoat: 0.3 }), 0.5));
  pure.scale.set(0.62, 0.1, 0.5); pure.position.set(0, 0.05, 0);
  addItem(pure, 0, -0.08, 0, 0.12);
  const swooshPts = []; for (let i = 0; i <= 20; i++) { const a = lerp(Math.PI * 0.12, Math.PI * 0.95, i / 20); swooshPts.push(new Vector3(Math.cos(a) * 0.86, 0, -Math.sin(a) * 0.66 + 0.1)); }
  const sauceMat = withEnv(new THREE.MeshPhysicalMaterial({ color: 0x6a1124, roughness: 0.1, clearcoat: 1, emissive: 0x2b0610, emissiveIntensity: 0.6 }), 1.2);
  const swoosh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(swooshPts), 40, 0.05, 10, false), sauceMat);
  swoosh.scale.y = 0.4; swoosh.position.y = 0.035;
  addItem(swoosh, 0.1);
  for (let i = 0; i < 6; i++) {
    const a = lerp(Math.PI * 1.12, Math.PI * 1.75, i / 5), r = 0.88 - i * 0.015;
    const d = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), sauceMat);
    const sz = 0.075 - i * 0.009; d.scale.set(sz, sz * 0.55, sz); d.position.set(0, 0.02, 0);
    addItem(d, 0.12 + i * 0.04, Math.cos(a) * r, 0, -Math.sin(a) * 0.62 * r + 0.15);
  }
  const puckMat = withEnv(new THREE.MeshPhysicalMaterial({ color: 0x5d2f16, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.25 }), 0.8);
  const puck = new THREE.Mesh(lathe([[0, 0], [0.38, 0], [0.43, 0.05], [0.44, 0.27], [0.4, 0.34], [0.3, 0.36], [0, 0.36]], 48), puckMat);
  puck.position.y = 0.05;
  addItem(puck, 0.04, -0.1, 0, 0.0);
  const leafGeo = new THREE.SphereGeometry(1, 8, 6);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }), 22);
  const tmp = new THREE.Object3D(), col = new Color();
  for (let i = 0; i < 22; i++) {
    const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * 0.2;
    tmp.position.set(Math.cos(a) * rr, 0.36 + rand() * 0.07 + 0.02, Math.sin(a) * rr);
    tmp.rotation.set((rand() - 0.5) * 1.2, rand() * 6.28, (rand() - 0.5) * 1.2);
    const s = 0.07 + rand() * 0.07; tmp.scale.set(s * 1.8, s * 0.22, s);
    tmp.updateMatrix(); leaves.setMatrixAt(i, tmp.matrix);
    col.setHSL(0.26 + rand() * 0.06, 0.45, 0.28 + rand() * 0.14); leaves.setColorAt(i, col);
  }
  leaves.instanceMatrix.needsUpdate = true; leaves.instanceColor.needsUpdate = true;
  addItem(leaves, 0.3, -0.1, 0.05, 0);
  // gold leaf flakes: eight tiny static boxes baked into one mesh that reuses the gilt program
  const flakeParts = [];
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2, rr = rand() * 0.28;
    const f = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    f.position.set(Math.cos(a) * rr, 0.4 + rand() * 0.04, Math.sin(a) * rr);
    f.rotation.set(rand() * 3, rand() * 6, rand() * 3); const s = 0.03 + rand() * 0.035; f.scale.set(s, s * 0.12, s * 0.8);
    flakeParts.push(f);
  }
  const flakes = mergeMeshes(flakeParts, goldMat);
  addItem(flakes, 0.4, -0.1, 0.05, 0);
  precompile(); await nap();

  /* ---------- particles: steam over the dish, dust in the candle light, far bokeh */
  const px = { value: 1 };
  const uniformsShared = { uTime: { value: 0 }, uPx: px };
  function points({ n, vert, frag, extra = {}, blending = THREE.AdditiveBlending, setup }) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { setup(i, pos); for (let k = 0; k < 4; k++) seed[i * 4 + k] = rand(); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = new THREE.ShaderMaterial({ uniforms: { ...uniformsShared, ...extra }, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending, fog: false });
    const p = new THREE.Points(g, m); p.frustumCulled = false; return p;
  }
  const steam = points({
    n: tier === 'high' ? 110 : 48, blending: THREE.NormalBlending, extra: { uAmount: { value: 0 } },
    setup: (i, a) => { const r = Math.sqrt(rand()) * 0.34, t = rand() * 6.28; a[i * 3] = Math.cos(t) * r; a[i * 3 + 1] = 0.5; a[i * 3 + 2] = Math.sin(t) * r + PZ; },
    vert: `attribute vec4 aSeed; uniform float uTime, uAmount, uPx; varying float vA;
      void main(){ float life = fract(aSeed.x + uTime*(0.045 + aSeed.y*0.045)); vec3 p = position;
        p.y += life*2.6; p.x += sin(uTime*0.6 + aSeed.z*6.28 + life*4.0)*(0.06 + life*0.4); p.z += cos(uTime*0.5 + aSeed.w*6.28 + life*3.0)*(0.06 + life*0.4);
        vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
        gl_PointSize = (0.3 + life*0.9)*(0.6 + aSeed.y*0.8)*uPx/-mv.z;
        vA = sin(3.14159*life)*uAmount*(0.16 + aSeed.w*0.2); }`,
    frag: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(1.0,0.95,0.86), a*a*vA); }`,
  });
  world.add(steam);
  const dust = points({
    n: tier === 'high' ? 70 : 26, extra: { uAmount: { value: 1 } },
    setup: (i, a) => { const t = rand() * 6.28, r = 0.6 + rand() * 6; a[i * 3] = CX + Math.cos(t) * r; a[i * 3 + 1] = rand() * 6; a[i * 3 + 2] = CZ + Math.sin(t) * r; },
    vert: `attribute vec4 aSeed; uniform float uTime, uPx; varying float vA;
      void main(){ vec3 p = position; p.y = mod(p.y + uTime*(0.05 + aSeed.y*0.08), 6.5); p.x += sin(uTime*0.3 + aSeed.z*6.28)*0.4; p.z += cos(uTime*0.25 + aSeed.w*6.28)*0.4;
        vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = (0.035 + aSeed.x*0.035)*uPx/-mv.z;
        float tw = 0.5 + 0.5*sin(uTime*1.3 + aSeed.x*30.0); vA = (0.25 + 0.75*tw) * (1.0 - smoothstep(4.5, 6.5, p.y)); }`,
    frag: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d); gl_FragColor = vec4(1.0,0.78,0.5, a*vA*0.8); }`,
  });
  world.add(dust);
  const bokeh = points({
    n: tier === 'high' ? 46 : 20, extra: {},
    setup: (i, a) => { const t = rand() * 6.28, r = 16 + rand() * 18; a[i * 3] = Math.cos(t) * r; a[i * 3 + 1] = -1 + rand() * 11; a[i * 3 + 2] = Math.sin(t) * r; },
    vert: `attribute vec4 aSeed; uniform float uTime, uPx; varying float vA; varying float vH;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = (1.1 + aSeed.x*2.4)*uPx/-mv.z;
        vH = aSeed.y; vA = (0.05 + aSeed.z*0.12) * (0.75 + 0.25*sin(uTime*0.4 + aSeed.w*20.0)); }`,
    frag: `varying float vA; varying float vH; void main(){ float d = length(gl_PointCoord - 0.5)*2.0; if(d>1.0) discard;
        float a = smoothstep(1.0,0.82,d)*(0.55 + 0.45*smoothstep(0.35,0.95,d)); vec3 c = mix(vec3(1.0,0.62,0.28), vec3(1.0,0.82,0.55), vH); gl_FragColor = vec4(c, a*vA); }`,
  });
  scene.add(bokeh);
  precompile(); await nap();

  /* ---------- sizing */
  let W = 1, H = 1, portrait = false;
  function resize() {
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(pr); composer.setSize(W, H); fxaa.material.uniforms.resolution.value.set(1 / (W * pr), 1 / (H * pr)); }
    camera.aspect = W / H;
    portrait = W <= 760 && H >= W * 0.75; // short landscape screens keep the side framing (panels sit at the side there)
    wake();
  }
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(resize, 120); };
  window.addEventListener('resize', onResize);

  /* ---------- state: scroll-driven (t = camera station, u[i] = progress inside station i) */
  const cur = { t: 0, u: [0, 0, 0, 0, 0] };
  const tgt = { t: 0, u: [0, 0, 0, 0, 0] };
  const STILL_U = [0, 1, 0.58, 1, 1]; // what each still frame shows (reduced motion)
  let intro = reduce ? 0 : 1; // opening dolly: the camera settles onto the table
  let paused = false, clock = 1.0, pointer = new Vector2(), pointerCur = new Vector2();
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine && !reduce) window.addEventListener('pointermove', (e) => { if (paused) return; pointer.set((e.clientX / W) * 2 - 1, (e.clientY / H) * 2 - 1); wake(); }, { passive: true });

  function setState(s) {
    if (s.still !== undefined) { // reduced motion: jump between stations, resolved state per station
      tgt.t = s.still;
      tgt.u = STILL_U.map((v, i) => (i < s.still ? 1 : i === s.still ? v : 0));
    } else { tgt.t = s.t; tgt.u = s.u.slice(); }
    if (reduce) { cur.t = tgt.t; cur.u = tgt.u.slice(); }
    wake();
  }

  /* ---------- per-frame scene update */
  const camPos = new Vector3(), camTg = new Vector3(), v3 = new Vector3();
  function applyCamera() {
    const t = clamp(cur.t, 0, KF.length - 1 - 1e-6);
    const i = Math.floor(t), f = t - i, a = KF[i], b = KF[i + 1];
    let th = lerp(a.th, b.th, f), ph = lerp(a.ph, b.ph, f), R = lerp(a.R, b.R, f);
    const fov = lerp(a.fov, b.fov, f);
    camTg.set(lerp(a.tg[0], b.tg[0], f), lerp(a.tg[1], b.tg[1], f), lerp(a.tg[2], b.tg[2], f));
    const asp = camera.aspect;
    R *= Math.max(1, Math.pow(1.5 / asp, 0.72)) * (1 + 0.22 * intro * intro);
    th += 0.5 * intro * intro; ph -= 0.18 * intro * intro;
    if (!paused && !reduce) { th += Math.sin(clock * 0.15) * 0.018; ph += Math.sin(clock * 0.11 + 1) * 0.008; }
    th += pointerCur.x * 0.035; ph -= pointerCur.y * 0.018;
    camPos.set(Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)).multiplyScalar(R).add(camTg);
    camera.position.copy(camPos);
    camera.lookAt(camTg);
    if (Math.abs(camera.fov - fov) > 1e-4) { camera.fov = fov; }
    const boost = lerp(a.bo ? clamp(1.6 / asp, 1, 1.5) : 1, b.bo ? clamp(1.6 / asp, 1, 1.5) : 1, f);
    const sx = portrait ? 0 : lerp(a.sx, b.sx, f) * boost, sy = portrait ? lerp(a.sy, b.sy, f) : 0;
    camera.setViewOffset(W, H, -sx * W, sy * H, W, H);
    camera.updateProjectionMatrix();
    px.value = (renderer.domElement.height) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }

  const _away = new Vector3(), _pour = new Vector3(), _p = new Vector3();
  function updateScene() {
    const t = cur.t, u = cur.u;
    // cloche: flies in during the move to station 1, lifts at station 1, floats away on the way to the wine
    const arrive = easeIO(sstep(0.15, 0.92, t));
    const lift = easeIO(clamp((u[1] - 0.06) / 0.62, 0, 1));
    const exit = sstep(1.35, 2.0, t);
    cloche.position.set(
      lerp(-8.5, 0, arrive) + lerp(0, -1.7, lift) + 2.4 * exit,
      lerp(9, 0.24, arrive) + lift * 3.1 + exit * 11,
      PZ + lerp(-3, 0, arrive) + lift * -0.5,
    );
    cloche.rotation.set(lift * 0.22 + (1 - arrive) * 0.5, 0, lift * 0.38 - (1 - arrive) * 0.4);
    cloche.visible = exit < 0.999 && arrive > 0.001;
    // dish pops in as the dome clears it
    dish.visible = t > 0.3;
    dishItems.forEach((h) => {
      const k = clamp((lift - h.userData.delay * 0.55) / 0.4, 0, 1);
      const s = k <= 0 ? 0.0001 : outBack(k);
      h.scale.setScalar(Math.max(0.0001, s));
    });
    dishGlow.intensity = 3.2 * sstep(0.1, 0.9, lift) * (1 - sstep(1.2, 1.8, t));
    steam.material.uniforms.uAmount.value = sstep(0.55, 1, lift) * (1 - sstep(1.5, 2.1, t));
    steam.visible = steam.material.uniforms.uAmount.value > 0.01;

    // wine: bottle glides in, tilts, pours, withdraws
    const w = u[2];
    const poured = sstep(0.2, 0.78, w);
    const level = tgtLevel(w);
    const filledY = setWine(level, level > 0.001);
    const come = easeIO(sstep(0.0, 0.2, w)), go = easeIO(sstep(0.82, 1.0, w));
    const present = w > 0.0005 && w < 0.9995;
    bottleRoot.visible = present;
    if (present) {
      const gx = glassGroup.position.x, gz = glassGroup.position.z;
      _away.set(9.5, 6.5, gz + 0.3); _pour.set(gx + 0.4, 3.0, gz);
      _p.copy(_away).lerp(_pour, come).lerp(_away, go);
      bottleRoot.position.copy(_p);
      bottleTilt.rotation.z = lerp(0.15, 1.78, come) * (1 - go) + 0.35 * go + sstep(0.2, 0.8, w) * 0.2 * (1 - go);
      const pouring = come > 0.97 && go < 0.02 && level < 0.999;
      stream.visible = pouring;
      if (pouring) {
        stream.position.set(gx + 0.2, 2.95, gz);
        stream.scale.set(1, Math.max(0.01, 2.95 - (filledY + glassGroup.position.y)), 1);
      }
    } else stream.visible = false;

    // lights + flame
    const T = clock;
    const fl = 1 + 0.07 * Math.sin(T * 13.1) + 0.05 * Math.sin(T * 23.7 + 1.2) + 0.03 * Math.sin(T * 41.3);
    candleLight.intensity = 12 * fl;
    flameMat.uniforms.uTime.value = T;
    glowA.material.opacity = 0.6 * (0.92 + 0.08 * fl);
    steam.material.uniforms.uTime.value = T;
    dust.material.uniforms.uTime.value = T;
    bokeh.material.uniforms.uTime.value = T;
    // quiet the key light a touch while the menu card is on screen
    renderer.toneMappingExposure = lerp(1.12, 0.9, sstep(2.4, 3.0, t) * (1 - sstep(3.2, 3.8, t)));
  }
  function tgtLevel(w) { return easeIO(sstep(0.2, 0.78, w)); }

  /* ---------- render loop (on demand when settled or paused) */
  let raf = 0, last = 0, journeyVisible = true, tabVisible = !document.hidden, lost = false;
  const canRun = () => !lost && tabVisible && journeyVisible;
  let frames = 0, slow = 0;
  function settled() {
    if (Math.abs(cur.t - tgt.t) > 0.0005) return false;
    for (let i = 0; i < 5; i++) if (Math.abs(cur.u[i] - tgt.u[i]) > 0.0005) return false;
    return paused || pointerCur.distanceToSquared(pointer) < 1e-6;
  }
  function frame(ts) {
    raf = 0;
    if (!canRun()) return;
    const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000 || 0.016)); last = ts;
    if (!reduce) {
      const k = paused ? 1 : 1 - Math.exp(-dt * 5.2); // paused: the view jumps to the scroll position, no easing
      cur.t += (tgt.t - cur.t) * k;
      for (let i = 0; i < 5; i++) cur.u[i] += (tgt.u[i] - cur.u[i]) * k;
      if (Math.abs(cur.t - tgt.t) < 0.0004) cur.t = tgt.t;
      for (let i = 0; i < 5; i++) if (Math.abs(cur.u[i] - tgt.u[i]) < 0.0004) cur.u[i] = tgt.u[i];
      const fp = 1 - Math.exp(-dt * 4);
      if (!paused) pointerCur.lerp(pointer, fp); // paused: the pointer drift freezes where it is
      if (!paused) clock += dt;
      if (intro > 0) intro = Math.max(0, intro - dt / 2.6);
    }
    applyCamera();
    updateScene();
    if (composer) composer.render(); else renderer.render(scene, camera);
    // adaptive quality: if a desktop machine cannot hold ~40 fps, shed cost in stages, then stop watching
    if (guard && !paused && !reduce && tier === 'high' && !document.hidden) {
      frames++; if (dt > 0.026) slow++;
      if (frames === 90) { if (slow > 55) degrade(); frames = 0; slow = 0; }
    }
    // never queue a second callback: degrade() -> resize() -> wake() may already have queued this frame's successor
    if (!raf && !reduce && (!paused || !settled())) raf = requestAnimationFrame(frame);
  }
  function degrade() {
    if (pr <= 1 && !renderer.shadowMap.enabled) { guard = false; return; } // last stage already reached
    pr = Math.max(1, pr - 0.25);
    if (bloom) bloom.strength = 0.3;
    if (pr <= 1) { renderer.shadowMap.enabled = false; key.castShadow = false; guard = false; }
    resize();
  }
  function wake() {
    if (!ready || raf || !canRun()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  const io = new IntersectionObserver((e) => { journeyVisible = e[0].isIntersecting; journeyVisible ? wake() : stop(); }, { threshold: 0 });
  const jr = document.getElementById('journey');
  if (jr) io.observe(jr);
  const onVis = () => { tabVisible = !document.hidden; tabVisible ? wake() : stop(); };
  document.addEventListener('visibilitychange', onVis);
  const onLost = (e) => { e.preventDefault(); lost = true; stop(); opts.onLost && opts.onLost(); };
  const onRestored = () => {
    lost = false;
    // The old environment map and composer belong to the dead context. three.js has already rebuilt its own
    // registries, so they are only dropped here (a dispose() would delete stale GPU handles and log errors) and collected.
    envTex = buildEnv();
    envMats.forEach((m) => { m.envMap = envTex; m.needsUpdate = true; });
    composer = bloom = fxaa = null;
    if (tier === 'high') makeComposer();
    opts.onRestored && opts.onRestored();
    resize();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  /* ---------- compile, warm up, first frame, then hand the controller back */
  resize();
  const draw = () => { if (composer) composer.render(); else renderer.render(scene, camera); };
  // 1. Wait (without blocking the page) until every program handed over during the build is linked.
  [cloche, dish, bottleRoot, wineBody, meniscus, stream, steam].forEach((o) => { o.visible = true; });
  applyCamera();
  try {
    precompile(); // last pass over the finished world, hidden parts included
    await Promise.race([Promise.all(jobs), sleep(10000)]); // never wait forever (e.g. a context lost meanwhile)
  } catch (e) { renderer.setRenderTarget(null); /* programs then compile on first use */ }
  await nap();
  // 2. Warm-up: one draw with every part showing uploads geometry and textures and builds the shadow programs,
  //    so nothing stalls mid-scroll. 3. The real first frame follows on a later task.
  if (!lost) draw();
  await nap();
  applyCamera(); updateScene();
  if (!lost) draw();
  ready = true;
  wake();

  function detach() { // stop everything that runs; no GPU calls
    stop(); io.disconnect();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
  }
  function dispose() {
    detach();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    envTex && envTex.dispose(); pmrem.dispose(); composer && composer.dispose(); renderer.dispose();
  }
  // bfcache: a page that may come back via Back keeps its scene running afterwards
  // On a real unload the browser frees the GPU memory itself: only detach (explicit GPU deletes after a context
  // restore would hit stale handles and log errors). dispose() stays available for tearing the scene down by hand.
  window.addEventListener('pagehide', (e) => { if (!e.persisted) detach(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) { tabVisible = !document.hidden; wake(); } });

  return {
    still: reduce,
    setState,
    setPaused(p) {
      paused = p;
      if (p) { // takes effect at once: the opening move and any easing jump to their resting state, one still frame
        intro = 0;
        cur.t = tgt.t; cur.u = tgt.u.slice();
      }
      wake();
    },
    resize, dispose,
    get tier() { return tier; },
  };
}
