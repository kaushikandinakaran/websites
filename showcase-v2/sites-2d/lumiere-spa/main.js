/* Lumière — motion, menu, accordion, orbs ---------------------------------- */
const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

window.__lumiereReady = true;
const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
if (!hasGsap) root.classList.add('no-anim');

let lenis = null;

/* Nav: stuck state ---------------------------------------------------------- */
const nav = $('#nav');
const onScrollNav = () => nav.classList.toggle('is-stuck', window.scrollY > 40);
window.addEventListener('scroll', onScrollNav, { passive: true });
onScrollNav();

/* Mobile menu ---------------------------------------------------------------- */
const burger = $('#burger');
const menu = $('#menu');
function setMenu(open) {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  menu.classList.toggle('is-open', open);
  nav.classList.toggle('menu-open', open);
  menu.toggleAttribute('inert', !open);
  menu.setAttribute('aria-hidden', String(!open));
  document.body.style.overflow = open ? 'hidden' : '';
  if (lenis) open ? lenis.stop() : lenis.start();
  if (open) setTimeout(() => $('a', menu).focus({ preventScroll: true }), 120);
}
burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); burger.focus(); }
  // keep focus inside the open menu (burger + menu links)
  if (e.key === 'Tab' && menu.classList.contains('is-open')) {
    const f = [burger, ...$$('a', menu)];
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }
});
window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

/* Smooth scroll (Lenis) + anchors ------------------------------------------- */
if (hasGsap && !reduce && typeof window.Lenis !== 'undefined') {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) setMenu(false);
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { offset: id === '#top' ? 0 : -10, duration: 1.4 });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', id);
    const focusEl = id === '#top' ? $('#main') : target;
    if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
    focusEl.focus({ preventScroll: true });
  });
});

/* Marquee: duplicate content only when it will animate ---------------------- */
const track = $('.marquee__track');
if (track && !reduce) { const one = track.innerHTML; track.innerHTML = one.repeat(4); }

/* Accordion ------------------------------------------------------------------ */
const arches = $$('.arch');
const items = $$('.acc__item');
let refreshT;
function setPanel(it, on) {
  it.classList.toggle('is-open', on);
  $('.acc__btn', it).setAttribute('aria-expanded', String(on));
  const p = $('.acc__panel', it);
  p.toggleAttribute('inert', !on);
  p.setAttribute('aria-hidden', String(!on));
}
function openItem(item) {
  items.forEach((it) => setPanel(it, it === item));
  const tone = item ? Number($('.acc__btn', item).dataset.tone) : -1;
  arches.forEach((a, i) => a.classList.toggle('is-on', i === tone));
  clearTimeout(refreshT);
  refreshT = setTimeout(() => hasGsap && ScrollTrigger.refresh(), 900);
}
items.forEach((item) => {
  $('.acc__btn', item).addEventListener('click', () => {
    const open = item.classList.contains('is-open');
    if (open) { // allow collapsing; keep the last visual in place
      setPanel(item, false);
      clearTimeout(refreshT);
      refreshT = setTimeout(() => hasGsap && ScrollTrigger.refresh(), 900);
    } else openItem(item);
  });
});

/* GSAP animation ------------------------------------------------------------- */
function splitWords(el) {
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  el.textContent = '';
  const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = text;
  el.appendChild(sr);
  text.split(' ').forEach((w, i, arr) => {
    const m = document.createElement('span');
    m.className = 'word-m'; m.setAttribute('aria-hidden', 'true');
    const s = document.createElement('span'); s.textContent = w;
    m.appendChild(s);
    el.appendChild(m);
    if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
}

if (hasGsap) {
  gsap.registerPlugin(ScrollTrigger);
  $$('[data-split]').forEach(splitWords);

  if (!reduce) {
    // Hero intro (on load)
    const tl = gsap.timeline({ delay: 0.15, defaults: { ease: 'expo.out' } });
    tl.to('.hero .mask__in', { yPercent: 0, y: 0, duration: 1.6, stagger: 0.14 })
      .to('.hero .reveal', { opacity: 1, y: 0, duration: 1.2, stagger: 0.12 }, '-=1.1');

    // Hero parallax on scroll
    gsap.to('.hero__copy', { yPercent: -12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

    // Mask-reveal headings
    $$('.title, .cta__title').forEach((h) => {
      gsap.to($$('.mask__in', h), { y: 0, duration: 1.4, stagger: 0.14, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
    });
    // Word-by-word statement
    $$('[data-split]').forEach((h) => {
      gsap.to($$('.word-m > span', h), { y: 0, duration: 1.1, stagger: 0.035, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%', once: true } });
    });
    // Generic fade-ups
    $$('.reveal').filter((el) => !el.closest('.hero')).forEach((el) => {
      gsap.to(el, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
    // Parallax shapes
    $$('.shape').forEach((s) => {
      gsap.to(s, { y: Number(s.dataset.speed || 40), ease: 'none', scrollTrigger: { trigger: '.philosophy', start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
    });
    gsap.to('.shape--ring', { rotate: 40, ease: 'none', scrollTrigger: { trigger: '.philosophy', start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
    gsap.to('.shape--leaf', { rotate: -18, ease: 'none', scrollTrigger: { trigger: '.philosophy', start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
    // Steps
    gsap.from('.step', { y: 70, opacity: 0, duration: 1.2, stagger: 0.15, ease: 'expo.out', scrollTrigger: { trigger: '.steps', start: 'top 82%', once: true } });
    // Accordion items
    gsap.from('.acc__item', { y: 30, opacity: 0, duration: 1, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.acc', start: 'top 85%', once: true } });

    // 3D tilt cards (mouse only)
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      $$('.tilt').forEach((card) => {
        const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
        const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
        gsap.set(card, { transformPerspective: 900 });
        card.addEventListener('pointermove', (e) => {
          const r = card.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 12);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 12);
        });
        card.addEventListener('pointerleave', () => { rx(0); ry(0); });
      });
    }
  }
}

/* Pause motion toggle (WCAG 2.2.2) ------------------------------------------ */
const motionBtn = $('#motion');
function setMotionOff(off, save) {
  window.__motionOff = off;
  root.classList.toggle('motion-off', off);
  motionBtn.setAttribute('aria-pressed', String(off));
  window.dispatchEvent(new Event('motionchange'));
  if (save) { try { localStorage.setItem('lumiere-motion-off', off ? '1' : '0'); } catch (e) {} }
}
motionBtn.addEventListener('click', () => setMotionOff(motionBtn.getAttribute('aria-pressed') !== 'true', true));
try { if (localStorage.getItem('lumiere-motion-off') === '1') setMotionOff(true, false); } catch (e) {}

/* Soft 3D orbs (Three.js) with static fallback ------------------------------- */
const orbsBox = $('#orbs');
const canvas = $('#orbs-canvas');

async function initOrbs() {
  let THREE;
  try { THREE = await import('three'); } catch (e) { return; }

  let renderer;
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) { return; }

  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.z = 10;
  const halfH = Math.tan(THREE.MathUtils.degToRad(35 / 2)) * 10;

  const vert = `
    varying vec3 vN; varying vec3 vV;
    void main(){
      vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      vV = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`;
  const frag = `
    precision mediump float;
    varying vec3 vN; varying vec3 vV;
    uniform vec3 uLight; uniform vec3 uShade; uniform vec3 uRim;
    void main(){
      vec3 n = normalize(vN); vec3 v = normalize(vV);
      float l = dot(n, normalize(vec3(-0.45, 0.65, 0.6))) * 0.5 + 0.5;
      float f = pow(1.0 - max(dot(n, v), 0.0), 2.6);
      vec3 col = mix(uShade, uLight, smoothstep(0.08, 0.95, l));
      col += uRim * f * 0.28;
      float spec = pow(max(dot(reflect(-normalize(vec3(-0.45,0.65,0.6)), n), v), 0.0), 18.0);
      col += vec3(1.0, 0.97, 0.9) * spec * 0.18;
      gl_FragColor = vec4(col, 0.96);
    }`;
  const mat = (light, shade, rim) => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true,
    uniforms: { uLight: { value: new THREE.Color(light) }, uShade: { value: new THREE.Color(shade) }, uRim: { value: new THREE.Color(rim) } },
  });

  const geo = new THREE.SphereGeometry(1, 48, 32);
  // x,y in viewport-half units; r relative to half height; z depth; phase for float
  const defs = [
    { c: ['#F7EEDA', '#DCC590', '#FFF3D6'], x: 0.5, y: 0.1, r: 0.5, z: 0, k: 0.5, p: 0 },
    { c: ['#E8EFDF', '#AABBA2', '#F4F8EE'], x: 0.84, y: -0.42, r: 0.34, z: 1.2, k: 0.9, p: 2 },
    { c: ['#F8EEDA', '#D9BE8A', '#FFFFFF'], x: 0.3, y: -0.62, r: 0.2, z: 2.2, k: 1.3, p: 4 },
    { c: ['#EEE6D5', '#A9B7A0', '#FFFFFF'], x: 0.9, y: 0.66, r: 0.14, z: 2.8, k: 1.7, p: 1 },
  ];
  const orbs = defs.map((d) => {
    const m = new THREE.Mesh(geo, mat(...d.c));
    scene.add(m);
    return { m, d };
  });

  let W = 1, H = 1, aspect = 1;
  function layout() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); aspect = W / H;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(W, H, false);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    const halfW = halfH * aspect;
    const portrait = aspect < 0.9;
    orbs.forEach(({ m, d }, i) => {
      // portrait: shift orbs to the edges/top & bottom and shrink so text stays readable
      const x = portrait ? [0.62, 0.78, -0.55, -0.7][i] : d.x;
      const y = portrait ? [0.62, -0.55, -0.78, 0.2][i] : d.y;
      const s = portrait ? d.r * 0.62 : d.r;
      m.userData.bx = x * halfW; m.userData.by = y * halfH;
      m.scale.setScalar(s * halfH);
      m.position.z = d.z;
    });
  }
  layout();
  let ro;
  if ('ResizeObserver' in window) { ro = new ResizeObserver(() => { layout(); if (!running) draw(0); }); ro.observe(canvas); }
  else window.addEventListener('resize', () => { layout(); if (!running) draw(0); });

  // pointer parallax + scroll drift
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  let running = false, visible = true, raf = 0;
  function draw(t) {
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    const sy = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1.2);
    orbs.forEach(({ m, d }) => {
      const fy = reduce ? 0 : Math.sin(t * 0.00055 * d.k + d.p) * 0.22;
      const fx = reduce ? 0 : Math.cos(t * 0.00042 * d.k + d.p) * 0.1;
      m.position.x = m.userData.bx + fx + mouse.x * 0.28 * (1 + d.z * 0.35);
      m.position.y = m.userData.by + fy - mouse.y * 0.2 * (1 + d.z * 0.35) + sy * (0.9 + d.z * 0.5);
      if (!reduce) m.rotation.y = t * 0.0001 * d.k;
    });
    renderer.render(scene, camera);
  }
  function loop(t) { if (!running) return; draw(t); raf = requestAnimationFrame(loop); }
  function start() { if (running || reduce || window.__motionOff || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  // pause when off-screen or tab hidden
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }, { threshold: 0 }).observe(orbsBox);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  // context loss -> fall back to CSS orbs
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); orbsBox.classList.remove('is-live'); });
  canvas.addEventListener('webglcontextrestored', () => { orbsBox.classList.add('is-live'); draw(0); start(); });

  window.addEventListener('motionchange', () => { if (window.__motionOff) { stop(); draw(performance.now()); } else start(); });
  draw(0);
  orbsBox.classList.add('is-live');
  start();
}
initOrbs();
