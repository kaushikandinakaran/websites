// Nova Labs hero: particle sphere + wireframe solids that react to the cursor.
// Returns false if WebGL is unavailable so the CSS gradient fallback stays visible.
import * as THREE from 'three';

const VERT = /* glsl */`
  attribute float aSeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform vec3 uMouse;
  uniform float uPx;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float wave = sin(uTime * 0.6 + aSeed * 6.2831 + p.y * 1.5) * 0.07;
    p += normalize(p) * wave;
    vec3 d = p - uMouse;
    float dist = length(d);
    float f = smoothstep(1.7, 0.0, dist);
    p += normalize(d + vec3(1e-4)) * f * 0.85;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (2.2 + aSeed * 3.0) * uPx * (7.0 / -mv.z) * (1.0 + f * 0.9);
    vColor = mix(aColor, vec3(1.0), f * 0.45);
    vAlpha = 0.55 + 0.45 * aSeed;
  }
`;
const FRAG = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

export function initHero(container, canvas, { reduce = false } = {}) {
  let renderer;
  try {
    // Probe on a throwaway canvas first so a missing GPU does not log errors.
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return false;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance' });
    if (!renderer.getContext()) return false;
  } catch (e) {
    return false;
  }
  renderer.setClearColor(0x000000, 0);

  const small = window.innerWidth < 700;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.set(0, 0, 8);

  const group = new THREE.Group();
  scene.add(group);

  // --- particles: a shell plus loose dust
  const SHELL = small ? 1100 : 2600;
  const DUST = small ? 300 : 700;
  const total = SHELL + DUST;
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const seed = new Float32Array(total);
  const violet = new THREE.Color('#8b5cf6');
  const cyan = new THREE.Color('#22d3ee');
  const tmp = new THREE.Color();
  for (let i = 0; i < total; i++) {
    let x, y, z, t;
    if (i < SHELL) {
      const yy = 1 - (2 * (i + 0.5)) / SHELL;
      const r = Math.sqrt(1 - yy * yy);
      const phi = i * 2.399963;
      const R = 2.5 + (Math.random() - 0.5) * 0.5;
      x = Math.cos(phi) * r * R; y = yy * R; z = Math.sin(phi) * r * R;
      t = Math.min(1, Math.max(0, (yy + 1) / 2 + (Math.random() - 0.5) * 0.35));
    } else {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u), R = 3.6 + Math.random() * 4;
      x = Math.cos(th) * r * R; y = u * R; z = Math.sin(th) * r * R;
      t = Math.random() * 0.6;
    }
    pos.set([x, y, z], i * 3);
    tmp.copy(violet).lerp(cyan, t);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
    seed[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uTime: { value: 0 }, uMouse: { value: new THREE.Vector3(99, 99, 99) }, uPx: { value: 1 } };
  const pMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  group.add(new THREE.Points(pGeo, pMat));

  // --- wireframe solids
  const wireOuter = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.75, 1)),
    new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  const wireInner = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.05, 0)),
    new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  const ring = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.TorusGeometry(2.8, 0.012, 3, 120)),
    new THREE.LineBasicMaterial({ color: 0xe879f9, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.rotation.x = Math.PI / 2.3;
  group.add(wireOuter, wireInner, ring);

  // --- layout: sphere sits right on wide screens, above the text on phones
  function layout(w, h) {
    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    if (aspect > 1.3) { group.position.set(Math.min(aspect * 1.55, 3.4), 0, 0); group.scale.setScalar(1); }
    else if (aspect > 0.9) { group.position.set(0, 1.0, 0); group.scale.setScalar(0.8); }
    else { group.position.set(0, 1.55, 0); group.scale.setScalar(0.55); }
  }

  const size = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    uniforms.uPx.value = dpr;
    layout(w, h);
    if (reduce || !running) draw(t);
  };

  // --- pointer
  const target = new THREE.Vector2(0, 0), smooth = new THREE.Vector2(0, 0);
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  let pointerIn = false;
  function onMove(e) {
    const r = container.getBoundingClientRect();
    target.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    pointerIn = e.clientY >= r.top && e.clientY <= r.bottom;
  }
  if (!reduce) window.addEventListener('pointermove', onMove, { passive: true });

  let running = false, raf = 0, inView = true, paused = false;
  let t = 0, last = 0; // accumulated time, so pausing never snaps the scene back

  function draw(t) {
    uniforms.uTime.value = t;
    smooth.lerp(target, 0.06);
    group.rotation.y = t * 0.09 + smooth.x * 0.4;
    group.rotation.x = -smooth.y * 0.22 + Math.sin(t * 0.2) * 0.05;
    wireOuter.rotation.y = -t * 0.12; wireOuter.rotation.x = t * 0.05;
    wireInner.rotation.y = t * 0.3; wireInner.rotation.z = t * 0.18;
    ring.rotation.z = t * 0.1;
    group.updateMatrixWorld(true);
    if (pointerIn && !reduce) {
      ray.setFromCamera(smooth, camera);
      plane.constant = -group.position.z;
      if (ray.ray.intersectPlane(plane, hit)) uniforms.uMouse.value.copy(group.worldToLocal(hit));
    } else {
      uniforms.uMouse.value.set(99, 99, 99);
    }
    renderer.render(scene, camera);
  }
  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    t += (now - last) / 1000; last = now;
    draw(t);
  }
  function start() { if (running || reduce) return; running = true; last = performance.now(); frame(); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function update() { (inView && !document.hidden && !paused) ? start() : stop(); }

  new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; update(); }, { threshold: 0 }).observe(container);
  document.addEventListener('visibilitychange', update);
  new ResizeObserver(size).observe(container);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); stop();
    container.classList.remove('is-3d');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    container.classList.add('is-3d');
    size(); update();
  });

  size();
  draw(0.01);
  update();
  // user pause control: freezes the idle spin and the pointer response
  return { setPaused(v) { paused = !!v; update(); } };
}
