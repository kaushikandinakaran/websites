// Blue Pearl - sample design. Page behaviour: smooth scroll, menu, reveals, station tracking, 3D scene loader.
const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const gsapLoaded = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
// Under reduced motion GSAP and ScrollTrigger are never started: the scene shows a still per station instead.
const hasGsap = gsapLoaded && !reduce;
const NAV_H = 84;
if (gsapLoaded && reduce) { ScrollTrigger.disable(false); gsap.ticker.sleep(); }

/* ---------- Smooth scroll (Lenis) + GSAP wiring ---------- */
let lenis = null, lenisTick = null, lenisRaf = 0;
if (hasGsap) { gsap.registerPlugin(ScrollTrigger); gsap.ticker.lagSmoothing(0); }
function startLenis() {
  if (reduce || lenis || typeof window.Lenis === 'undefined') return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
  const m = document.getElementById('navMenu');
  if (m && m.classList.contains('is-open')) lenis.stop();   // resumed under an open menu: keep the page still
  if (hasGsap) {
    lenis.on('scroll', ScrollTrigger.update);
    lenisTick = (t) => lenis.raf(t * 1000);
    gsap.ticker.add(lenisTick);
  } else {
    const raf = (t) => { lenis.raf(t); lenisRaf = requestAnimationFrame(raf); };
    lenisRaf = requestAnimationFrame(raf);
  }
}
function stopLenis() {   // scrolling stays native while Lenis is off
  if (!lenis) return;
  if (lenisTick) { gsap.ticker.remove(lenisTick); lenisTick = null; }
  if (lenisRaf) { cancelAnimationFrame(lenisRaf); lenisRaf = 0; }
  lenis.destroy(); lenis = null;
}
startLenis();

/* ---------- Menu (mobile) with focus trap ---------- */
const toggle = $('#navToggle');
const menu = $('#navMenu');
const mobileMq = window.matchMedia('(max-width: 860px)');
const inertEls = ['#main', '.footer', '#rail'].map((s) => $(s)).filter(Boolean);
function setMenu(open, returnFocus) {
  menu.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  root.style.overflow = open ? 'hidden' : '';
  inertEls.forEach((el) => { if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
  if (lenis) open ? lenis.stop() : lenis.start();
  if (!open && returnFocus) toggle.focus();
}
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', (e) => {
  if (!menu.classList.contains('is-open')) return;
  if (e.key === 'Escape') { setMenu(false, true); return; }
  if (e.key === 'Tab') { // focus stays inside the open menu, in visual order
    const f = [$('.brand'), $('#motionBtn'), toggle, ...$$('a', menu)].filter((el) => el && !el.hidden && el.getClientRects().length);
    const i = f.indexOf(document.activeElement);
    e.preventDefault();
    f[i === -1 ? 0 : (i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
});
mobileMq.addEventListener('change', (e) => { if (!e.matches) setMenu(false); });

/* ---------- Anchors: scroll with Lenis, then really move focus ---------- */
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) setMenu(false);
    const focusEl = id === '#top' ? $('#main') : target;
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { offset: -NAV_H, duration: 1.6 });
    else window.scrollTo({ top: id === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY - NAV_H, behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', id);
    if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
    focusEl.focus({ preventScroll: true });
  });
});

/* ---------- Reveals (no GSAP needed: they work even if scripts fail) ---------- */
const revealEls = $$('[data-reveal]');
if (reduce || !('IntersectionObserver' in window)) revealEls.forEach((el) => el.classList.add('is-in'));
else {
  const rio = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); rio.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  revealEls.forEach((el) => rio.observe(el));
}
root.classList.add('js-ready');

/* ---------- Stations: nav state, poster layer, rail ---------- */
const sections = $$('.station');
const navLinks = $$('.nav__links a');
const layers = $$('.poster__layer');
const railItems = $$('#rail li');
let activeStation = -1;
let scene = null;
function setActive(i) {
  if (i === activeStation) return;
  activeStation = i;
  const id = sections[i].id;
  navLinks.forEach((l) => { if (l.getAttribute('href') === '#' + id) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current'); });
  layers.forEach((l, k) => l.classList.toggle('is-on', k === i));
  railItems.forEach((l, k) => l.classList.toggle('is-on', k === i));
  if (reduce && scene) scene.jump(i);
}
if ('IntersectionObserver' in window) {
  const sio = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) setActive(sections.indexOf(en.target)); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  sections.forEach((s) => sio.observe(s));
}
setActive(0);

/* ---------- Pause motion (WCAG 2.2.2) ---------- */
let motionOff = false;
const motionBtn = $('#motionBtn');
function setMotion(off) {
  motionOff = off;
  root.classList.toggle('motion-off', off);
  motionBtn.setAttribute('aria-pressed', String(off));
  if (scene) scene.setMotionOff(off);
  // Stop every loop we own: Lenis smoothing, the shared GSAP ticker and ScrollTrigger. While paused a plain
  // scroll listener moves the camera (the scene draws only when something changes); resume restores all.
  if (off) {
    stopLenis();
    if (hasGsap) { gsap.ticker.sleep(); ScrollTrigger.disable(false); }
    onScrollPaused();
  } else {
    if (hasGsap) { ScrollTrigger.enable(); ScrollTrigger.getAll().forEach((t) => t.enable()); gsap.ticker.wake(); }
    startLenis();
    pausedAnchors = null;
    buildScroll();
    if (hasGsap) ScrollTrigger.refresh();
  }
}
if (reduce) motionBtn.hidden = true;
else motionBtn.addEventListener('click', () => setMotion(!motionOff));

/* ---------- 3D scene (lazy, optional) ---------- */
function pickTier() {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
  if (small) return 'low';
  return cores <= 4 || mem <= 4 ? 'mid' : 'high';
}

// Station anchors: the scroll position where each section is centred in the viewport.
function anchors() {
  const vh = window.innerHeight;
  const max = Math.max(1, document.documentElement.scrollHeight - vh);
  const a = sections.map((el, i) => {
    if (i === 0) return 0;
    const r = el.getBoundingClientRect();
    return clamp(r.top + window.scrollY + r.height / 2 - vh / 2, 0, max);
  });
  for (let i = 1; i < a.length; i++) a[i] = Math.max(a[i], a[i - 1] + 1);
  return { a, max: Math.max(max, a[a.length - 1]) };
}
const ease = (t) => t * t * (3 - 2 * t);
function sFromScroll(y, A) {
  const a = A.a;
  if (y <= a[0]) return 0;
  for (let i = 1; i < a.length; i++) if (y <= a[i]) return i - 1 + ease((y - a[i - 1]) / (a[i] - a[i - 1]));
  return a.length - 1;
}

let timeline = null;
const state = { s: 0 };
let lastKey = '';
function buildScroll(force) {
  if (!scene || reduce || (motionOff && hasGsap)) return;   // while paused the timeline is built on resume
  const A = anchors();
  const key = A.a.map(Math.round).join(',') + '|' + Math.round(A.max);
  if (!force && key === lastKey && (timeline || onScrollPlain)) return;   // nothing moved: keep the existing timeline
  lastKey = key;
  if (hasGsap) {
    if (timeline) { timeline.scrollTrigger && timeline.scrollTrigger.kill(); timeline.kill(); }
    timeline = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: () => scene && scene.setStation(state.s),
      scrollTrigger: { trigger: root, start: 0, end: A.max, scrub: true, invalidateOnRefresh: false },
    });
    for (let i = 1; i < A.a.length; i++) {
      timeline.fromTo(state, { s: i - 1 }, { s: i, duration: A.a[i] - A.a[i - 1], ease: 'power2.inOut', immediateRender: false }, A.a[i - 1]);
    }
    if (A.max > A.a[A.a.length - 1]) timeline.to({}, { duration: A.max - A.a[A.a.length - 1] }, A.a[A.a.length - 1]);
  } else {
    // No GSAP: same mapping from a plain scroll listener.
    onScrollPlain = () => scene && scene.setStation(sFromScroll(window.scrollY, A));
    onScrollPlain();
  }
}
let onScrollPlain = null, pausedAnchors = null;
function onScrollPaused() {   // camera follows native scroll while motion is paused (GSAP asleep)
  if (!scene || reduce || !hasGsap || !motionOff) return;
  if (!pausedAnchors) pausedAnchors = anchors();
  scene.setStation(sFromScroll(window.scrollY, pausedAnchors));
}
window.addEventListener('scroll', () => { if (onScrollPlain) onScrollPlain(); else onScrollPaused(); }, { passive: true });

let rebuildTimer = 0, lastW = window.innerWidth;
window.addEventListener('resize', () => {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {   // height-only changes (phone URL bar) do not move the stations enough to rebuild
    if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 120) return;
    lastW = window.innerWidth; lastH = window.innerHeight; pausedAnchors = null;
    buildScroll(); if (hasGsap && !motionOff) ScrollTrigger.refresh();
  }, 220);
});
let lastH = window.innerHeight;

(async function initScene() {
  const canvas = $('#scene');
  const probeHere = () => {   // no logging; the probe context is released straight away
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return false;
      const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext();
      return true;
    } catch (e) { return false; }
  };
  // The first WebGL context of a page starts the GPU connection, which can block for most of a second.
  // Do that first probe in a worker so the page stays responsive; fall back to probing here if workers or
  // OffscreenCanvas cannot answer.
  const probeWorker = () => new Promise((resolve) => {
    try {
      if (typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') return resolve(null);
      const src = "let ok=false;try{const c=new OffscreenCanvas(1,1);const g=c.getContext('webgl2')||c.getContext('webgl');ok=!!g;if(g){const x=g.getExtension('WEBGL_lose_context');if(x)x.loseContext();}}catch(e){}postMessage(ok);";
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      const w = new Worker(url);
      const done = (v) => { clearTimeout(t); w.terminate(); URL.revokeObjectURL(url); resolve(v); };
      const t = setTimeout(() => done(null), 4000);
      w.onmessage = (e) => done(e.data === true ? true : null);
      w.onerror = () => done(null);
    } catch (e) { resolve(null); }
  });
  // Fetch the scene code while the probe runs. Retried like the add-ons inside scene.js: a busy server can
  // refuse one request; only after three failed tries does the poster stay.
  const tier = pickTier();
  const modP = (async () => {
    for (let k = 0; ; k++) {
      try { return await import(k < 2 ? './scene.js' : './scene.js?r=' + Date.now()); }
      catch (e) { if (k >= 2) throw e; await new Promise((r) => setTimeout(r, 300 + k * 500)); }
    }
  })();
  modP.then((m) => m.prepare(tier !== 'low')).catch(() => {});
  const probe = (await probeWorker()) || probeHere();
  if (!probe) { root.classList.add('no-3d'); return; }
  try {
    const mod = await modP;
    scene = await mod.createScene({
      canvas, tier, still: reduce,
      onLost: () => root.classList.remove('scene-on'),
      onRestored: () => root.classList.add('scene-on'),
    });
    if (!scene) { root.classList.add('no-3d'); return; }
    root.classList.add('scene-on');
    if (motionOff) scene.setMotionOff(true);
    if (reduce) scene.jump(Math.max(0, activeStation));
    else buildScroll(true);
    if (hasGsap && !motionOff) ScrollTrigger.refresh();
    if (motionOff) onScrollPaused();   // paused before the scene arrived
    const settle = () => { pausedAnchors = null; buildScroll(); if (hasGsap && !motionOff) ScrollTrigger.refresh(); };   // rebuilds only if layout moved
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
    window.addEventListener('load', settle);
  } catch (err) {
    root.classList.add('no-3d'); // the poster background and all content stay
  }
})();
