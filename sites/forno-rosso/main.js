// Forno Rosso - sample design. Page logic: smooth scroll, nav, accessibility, scroll journey -> 3D scene.
const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
/* ---------- Smooth scroll (Lenis) + ScrollTrigger ----------
   Loaded only when motion is allowed: under reduced motion GSAP / ScrollTrigger / Lenis are never
   fetched (ScrollTrigger keeps an idle rAF loop alive). While "Pause motion" is on, every loop we own
   is stopped: Lenis is destroyed, the GSAP ticker sleeps, ScrollTrigger is disabled. A plain scroll
   listener drives the camera and nav in every mode, so nothing depends on these libraries. */
let hasGsap = false;
let lenis = null, lenisTick = null, lenisRaf = 0;
let motionOff = false;
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = false; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
function startLenis() {
  if (reduce || motionOff || lenis || typeof window.Lenis === 'undefined') return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
  if (hasGsap) {
    lenis.on('scroll', ScrollTrigger.update);
    lenisTick = (t) => lenis.raf(t * 1000);
    gsap.ticker.add(lenisTick);
  } else {
    const raf = (t) => { lenis.raf(t); lenisRaf = requestAnimationFrame(raf); };
    lenisRaf = requestAnimationFrame(raf);
  }
  if (menu.classList.contains('is-open')) lenis.stop();
}
function stopLenis() {
  if (!lenis) return;
  if (lenisTick) { gsap.ticker.remove(lenisTick); lenisTick = null; }
  if (lenisRaf) { cancelAnimationFrame(lenisRaf); lenisRaf = 0; }
  lenis.destroy();
  lenis = null;
}
function sleepGsap(off) {
  if (!hasGsap) return;
  if (off) { gsap.ticker.sleep(); ScrollTrigger.disable(false); } // also ends ScrollTrigger's own rAF loop
  else { ScrollTrigger.enable(); ScrollTrigger.getAll().forEach((t) => t.enable()); gsap.ticker.wake(); }
}
if (!reduce) {
  const V = '../../vendor/';
  Promise.all([loadScript(V + 'gsap.min.js'), loadScript(V + 'ScrollTrigger.min.js'), loadScript(V + 'lenis.min.js')])
    .catch(() => {})
    .then(() => {
      hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
      if (hasGsap) {
        gsap.registerPlugin(ScrollTrigger);
        gsap.ticker.lagSmoothing(0);
        ScrollTrigger.create({ trigger: '#journey', start: 'top top', end: 'bottom bottom', onRefresh: () => { measure(); feed(); } });
        if (motionOff) sleepGsap(true);
      }
      startLenis();
      if (hasGsap && !motionOff) ScrollTrigger.refresh();
    });
}

/* ---------- Navbar, mobile menu (focus trap), anchors ---------- */
const nav = $('#nav');
const toggle = $('#navToggle');
const menu = $('#navMenu');
const mobileMq = window.matchMedia('(max-width: 860px)');
const NAV_H = 0;

function setMenu(open, returnFocus) {
  menu.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  root.style.overflow = open ? 'hidden' : '';
  const inertOn = open && mobileMq.matches; // page behind the open menu is not reachable
  $('#main').inert = inertOn; $('.footer').inert = inertOn;
  if (lenis) open ? lenis.stop() : lenis.start();
  if (!open && returnFocus) toggle.focus();
}
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', (e) => {
  if (!menu.classList.contains('is-open')) return;
  if (e.key === 'Escape') { setMenu(false, true); return; }
  if (e.key === 'Tab') {
    // cycle through every visible control in the header: brand, Pause, Menu, links, Reserve
    const f = $$('a[href], button', nav).filter((el) => !el.hidden && el.getClientRects().length);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
mobileMq.addEventListener('change', (e) => { if (!e.matches) setMenu(false); });

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? $('#main') : $(id);
    if (!target) return;
    e.preventDefault();
    const wasOpen = menu.classList.contains('is-open');
    if (wasOpen) setMenu(false);
    const y = id === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY - NAV_H;
    if (lenis) lenis.scrollTo(y, { duration: 1.4, immediate: false });
    else window.scrollTo({ top: y, behavior: (reduce || motionOff) ? 'auto' : 'smooth' });
    history.replaceState(null, '', id);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
});

/* ---------- Pause motion (WCAG 2.2.2) ---------- */
let ctl = null;
const motionBtn = $('#motionBtn');
function setMotion(off) {
  motionOff = off;
  root.classList.toggle('motion-off', off);
  motionBtn.setAttribute('aria-pressed', String(off));
  if (ctl) ctl.setPaused(off);
  // stop every loop we own while paused; scrolling stays native, the scroll listener keeps the camera in step
  if (off) { stopLenis(); sleepGsap(true); }
  else { sleepGsap(false); startLenis(); refresh(); }
}
if (reduce) motionBtn.hidden = true;
else motionBtn.addEventListener('click', () => setMotion(!motionOff));

/* ---------- Cards fade in as their station arrives (never depends on 3D) ---------- */
const cards = $$('[data-card]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px', threshold: 0.01 });
  cards.forEach((c) => io.observe(c));
} else cards.forEach((c) => c.classList.add('is-in'));
setTimeout(() => $('#dough [data-card]').classList.add('is-in'), 120);

/* ---------- The journey: scroll position -> J (0..5) ---------- */
const stations = $$('.station');
const railDots = $$('#rail li');
const navLinks = $$('.nav__links a');
const layerItems = $$('#layers li');
const REST = [0.42, 1.28, 2.84, 3.72, 4.5]; // still frames used for reduced motion
let tops = [], heights = [], J = 0, lastIdx = -1;

function measure() {
  tops = stations.map((s) => s.getBoundingClientRect().top + window.scrollY);
  heights = stations.map((s) => s.offsetHeight);
}
function currentJ() {
  const y = window.scrollY;
  if (!tops.length) return 0;
  let i = 0;
  for (let k = 0; k < tops.length; k++) if (y >= tops[k] - 1) i = k;
  const f = Math.min(1, Math.max(0, (y - tops[i]) / Math.max(1, heights[i] - window.innerHeight)));
  return i + f;
}
function markStation(idx) {
  if (idx === lastIdx) return;
  lastIdx = idx;
  railDots.forEach((d, i) => d.classList.toggle('is-on', i === idx));
  navLinks.forEach((a) => { const on = a.getAttribute('href') === '#' + (stations[idx] && stations[idx].id); a.classList.toggle('is-current', on); if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
}
function feed() {
  J = currentJ();
  const idx = Math.min(stations.length - 1, Math.floor(J + 0.0001));
  // reduced motion: viewport-centre decides which still frame is shown
  let sceneJ = J;
  if (reduce) {
    const mid = window.scrollY + window.innerHeight * 0.5;
    let ri = 0;
    for (let k = 0; k < tops.length; k++) if (mid >= tops[k]) ri = k;
    sceneJ = REST[ri];
  }
  markStation(reduce ? Math.min(4, Math.max(0, REST.indexOf(sceneJ))) : idx);
  layerItems.forEach((li, i) => li.classList.toggle('is-active', J >= [1.0, 1.35, 1.5, 1.7][i]));
  if (ctl) ctl.setJ(sceneJ);
}
let queued = false;
function refresh() { // coalesce resize / layout changes into one measure per frame
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; measure(); feed(); });
}
refresh(); // first measure in the first frame, not while the module runs (avoids a forced layout during startup)
// a plain scroll listener drives the scene, so it keeps working while the GSAP ticker sleeps
window.addEventListener('scroll', feed, { passive: true });
if ('ResizeObserver' in window) new ResizeObserver(refresh).observe($('#journey'));
else window.addEventListener('resize', refresh);
const stRefresh = () => { refresh(); if (hasGsap && !motionOff) ScrollTrigger.refresh(); };
window.addEventListener('load', stRefresh);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(stRefresh);

/* ---------- 3D scene (lazy, optional) ---------- */
const canvas = $('#stage');
function fallback() {
  // keep the tall station layout (no layout shift): only the posters come back
  ctl = null;
  root.classList.remove('gl');
}
async function bootScene() {
  if (!root.classList.contains('gl-able')) return;
  try {
    const mod = await import('./scene.js');
    const c = await mod.initScene(canvas, { reduce, onFirstFrame: () => root.classList.add('gl') });
    if (!c) { fallback(); return; }
    ctl = c;
    ctl.setPaused(motionOff);
    canvas.addEventListener('gl-lost', () => root.classList.remove('gl'));
    canvas.addEventListener('gl-restored', () => root.classList.add('gl'));
    feed();
  } catch (err) {
    fallback();
  }
}
// start the scene once the page has loaded and the browser is idle, so text and menu work first
function bootWhenIdle() {
  if ('requestIdleCallback' in window) requestIdleCallback(bootScene, { timeout: 1500 });
  else setTimeout(bootScene, 200);
}
if (document.readyState === 'complete') bootWhenIdle();
else window.addEventListener('load', bootWhenIdle, { once: true });

// setup finished: from here the 4 s "show everything" fallback in index.html is no longer needed
root.classList.add('js-ready');
