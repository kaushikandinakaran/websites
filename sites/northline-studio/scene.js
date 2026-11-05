/* Northline Studio — 3D massing model (Three.js).
   Orthographic architectural view, flat-shaded volumes with black edge lines.
   Falls back to the static SVG if WebGL is unavailable. Pauses when off-screen. */
import * as THREE from 'three';

const fig = document.getElementById('heroFig');
const canvas = document.getElementById('scene');
const stage = fig && fig.querySelector('.hero__stage');

function boot() {
  if (!fig || !canvas || !stage) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const volumes = window.NL_VOLUMES || [];
  const root = document.documentElement;
  let paused = reduce || root.classList.contains('motion-off');

  // Probe for WebGL first so unsupported browsers fall back quietly (no console noise).
  let gl = null;
  try {
    const probe = document.createElement('canvas');
    gl = probe.getContext('webgl2') || probe.getContext('webgl');
  } catch (_) { gl = null; }
  if (!gl) { fig.classList.add('is-fallback'); return; }
  const lose = gl.getExtension && gl.getExtension('WEBGL_lose_context');
  if (lose) lose.loseContext();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) {
    fig.classList.add('is-fallback');
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 100);
  camera.position.set(9, 8, 9);
  camera.lookAt(0, 1.6, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a857a, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(6, 10, 3);
  scene.add(sun);

  const model = new THREE.Group();
  scene.add(model);

  // ground: plinth + hairline grid
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(8.4, 0.12, 8.4).translate(0, -0.06, 0),
    new THREE.MeshStandardMaterial({ color: 0xe3dfd5, roughness: 1, metalness: 0 })
  );
  model.add(plinth);
  const plinthEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(plinth.geometry),
    new THREE.LineBasicMaterial({ color: 0x121212, transparent: true, opacity: 0.7 })
  );
  model.add(plinthEdges);
  const grid = new THREE.GridHelper(8.4, 14, 0x121212, 0x121212);
  grid.material.transparent = true;
  grid.material.opacity = 0.13;
  grid.position.y = 0.005;
  model.add(grid);

  // volumes
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xf1eee7, roughness: 1, metalness: 0 });
  const accMat = new THREE.MeshStandardMaterial({ color: 0xa8774f, roughness: 1, metalness: 0 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x121212 });
  const floorMat = new THREE.LineBasicMaterial({ color: 0x121212, transparent: true, opacity: 0.28 });

  const groups = volumes.map((v, i) => {
    const g = new THREE.Group();
    g.position.set(v.cx, v.y, v.cz);
    const geo = new THREE.BoxGeometry(v.w, v.h, v.d).translate(0, v.h / 2, 0);
    g.add(new THREE.Mesh(geo, v.accent ? accMat : baseMat));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    // floor lines every 0.8 units, like storey datums
    const pts = [];
    const hw = v.w / 2, hd = v.d / 2;
    for (let y = 0.8; y < v.h - 0.05; y += 0.8) {
      pts.push(-hw, y, -hd, hw, y, -hd, hw, y, -hd, hw, y, hd, hw, y, hd, -hw, y, hd, -hw, y, hd, -hw, y, -hd);
    }
    if (pts.length) {
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.add(new THREE.LineSegments(lg, floorMat));
    }
    g.userData.delay = 0.35 + i * 0.16;
    g.scale.y = reduce ? 1 : 0.001;
    model.add(g);
    return g;
  });

  /* sizing */
  function resize() {
    const w = Math.max(stage.clientWidth, 1);
    const h = Math.max(stage.clientHeight, 1);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const E = 6.1;
    const halfW = aspect >= 1 ? E * aspect : E;
    const halfH = aspect >= 1 ? E : E / aspect;
    camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
    camera.updateProjectionMatrix();
    renderOnce();
  }

  /* drag to rotate */
  let dragYaw = 0, targetYaw = 0, dragging = false, lastX = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    targetYaw += (e.clientX - lastX) * 0.008;
    lastX = e.clientX;
    renderOnce();
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  // keyboard: arrow keys rotate the model while the canvas is focused
  canvas.addEventListener('keydown', (e) => {
    let d = 0;
    if (e.key === 'ArrowLeft') d = -0.22;
    else if (e.key === 'ArrowRight') d = 0.22;
    if (!d) return;
    e.preventDefault();
    targetYaw += d;
    renderOnce();
  });

  /* render loop: only while visible */
  let tAcc = 0, last = performance.now();
  let visible = true, raf = 0, shown = false;
  const ease = (x) => 1 - Math.pow(1 - x, 3);

  function draw() {
    const t = tAcc;
    if (!paused) {
      groups.forEach((g) => {
        const k = Math.min(Math.max((t - g.userData.delay) / 1.4, 0), 1);
        g.scale.y = Math.max(ease(k), 0.001);
      });
    } else {
      groups.forEach((g) => { g.scale.y = 1; });
    }
    dragYaw += (targetYaw - dragYaw) * 0.08;
    const auto = reduce ? 0 : t * 0.11;
    model.rotation.y = 0.55 + auto + dragYaw + window.scrollY * 0.0006;
    renderer.render(scene, camera);
    if (!shown) { shown = true; fig.classList.add('is-3d'); }
  }
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden || paused) return;
    tAcc += Math.min((now - last) / 1000, 0.1);
    last = now;
    draw();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || paused) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function renderOnce() {
    if (raf) return; // the loop will draw the next frame
    dragYaw = targetYaw; // no loop running (paused / reduced motion): apply the change immediately
    draw();
  }
  // "Pause motion" button in the page
  window.addEventListener('nl:motion', () => {
    paused = reduce || root.classList.contains('motion-off');
    if (paused) { cancelAnimationFrame(raf); raf = 0; renderOnce(); }
    else start();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }, { threshold: 0 }).observe(fig);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf); raf = 0;
    fig.classList.remove('is-3d');
  });
  canvas.addEventListener('webglcontextrestored', () => { shown = false; start(); renderOnce(); });

  resize();
  start();
}

try { boot(); } catch (err) {
  if (fig) fig.classList.add('is-fallback');
  if (window.console) console.warn('3D scene disabled:', err && err.message);
}
