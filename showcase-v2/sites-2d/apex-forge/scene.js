// Apex Forge - hero 3D dumbbell. Loaded with a dynamic import() from main.js,
// so the page (menu, GSAP, Lenis) never waits for three.js and works if this file fails.
import * as THREE from 'three';

function hasWebGL() {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    return !!gl; // probe is dropped, not force-lost (loseContext logs a console warning)
  } catch (e) { return false; }
}

export function initScene(stage, canvas, { reduce = false, paused = false } = {}) {
  if (!hasWebGL()) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 50);
  camera.position.set(0, 1.1, 8);
  camera.lookAt(0, 0, 0);

  // Generated studio environment (softboxes) so the steel has something to reflect. No image files.
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(
    new THREE.SphereGeometry(20, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x2a3344, side: THREE.BackSide })
  ));
  const panel = (color, intensity, w, h, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(...pos); m.lookAt(0, 0, 0); envScene.add(m);
  };
  panel(0xffffff, 18, 14, 5, [0, 10, 5]);      // big top softbox
  panel(0xffffff, 9, 3, 12, [7, 2, 7]);        // vertical strip, key side
  panel(0xff6a2a, 16, 5, 12, [-11, 1, 3]);     // orange rim card
  panel(0x7aa2ff, 7, 4, 12, [11, 3, -3]);      // cool kicker
  panel(0xe63946, 8, 14, 3, [0, -9, 5]);       // red floor bounce
  panel(0xffffff, 5, 8, 3, [0, 3, -10]);       // back light
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(envScene, 0.03).texture;
  scene.environment = envTex;
  pmrem.dispose();

  const steel = new THREE.MeshStandardMaterial({ color: 0x8190a6, metalness: 1, roughness: .3, envMapIntensity: 1.2 });
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x4b5668, metalness: 1, roughness: .38 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe6f2, metalness: 1, roughness: .16 });
  const fire = new THREE.MeshStandardMaterial({ color: 0xff6a2a, metalness: .45, roughness: .3, emissive: 0xff3d00, emissiveIntensity: .35, envMapIntensity: 1.3 });

  const bell = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, 6, 32), chrome);
  bar.rotation.z = Math.PI / 2; bell.add(bar);
  for (let i = -5; i <= 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.165, .014, 6, 24), steelDark);
    ring.rotation.y = Math.PI / 2; ring.position.x = i * .18; bell.add(ring);
  }
  [-1, 1].forEach(side => {
    const add = (r, len, x, mat) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6, 1), mat);
      m.rotation.z = Math.PI / 2; m.position.x = side * x; bell.add(m);
    };
    add(1.0, .7, 1.6, steel);
    add(1.03, .14, 1.97, fire);
    add(.82, .5, 2.2, steel);
    add(.55, .35, 2.6, fire);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .3, 24), chrome);
    cap.rotation.z = Math.PI / 2; cap.position.x = side * 2.95; bell.add(cap);
  });
  bell.rotation.set(.35, -.5, -.2);
  scene.add(bell);

  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x3a2418, .7));
  const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(4, 6, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff5a1f, 4.5); rim.position.set(-6, 1, -4); scene.add(rim);
  const kick = new THREE.DirectionalLight(0x8fb0ff, 1.6); kick.position.set(6, -2, -3); scene.add(kick);

  function render() { renderer.render(scene, camera); }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = Math.max(8, 8 * (1.5 / camera.aspect));
    camera.updateProjectionMatrix();
    render();
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  stage.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - .5) * 2;
    pointer.ty = ((e.clientY - r.top) / r.height - .5) * 2;
  });
  stage.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; });

  let visible = true, running = false, isPaused = paused, last = 0, spin = 0, raf = 0;
  function frame(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, .05); last = t;
    spin += dt * .6;
    pointer.x += (pointer.tx - pointer.x) * .06;
    pointer.y += (pointer.ty - pointer.y) * .06;
    bell.rotation.y = -.5 + spin + pointer.x * .5 + (window.scrollY || 0) * .0015;
    bell.rotation.x = .35 + pointer.y * .25;
    bell.position.y = Math.sin(t / 900) * .12;
    render();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running || reduce || isPaused || !visible || document.hidden) return;
    running = true; last = performance.now(); raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }

  new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible ? start() : stop(); }, { threshold: 0 }).observe(stage);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  new ResizeObserver(resize).observe(stage);

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); stage.classList.remove('has-webgl'); });
  canvas.addEventListener('webglcontextrestored', () => { stage.classList.add('has-webgl'); render(); start(); });

  resize();
  stage.classList.add('has-webgl');
  start();

  return {
    setPaused(p) {
      isPaused = p;
      if (p) { stop(); render(); } else start();
    }
  };
}
