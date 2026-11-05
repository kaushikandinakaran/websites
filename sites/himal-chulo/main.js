// Himal Chulo - sample design by Website Studio.
// Page behaviour: smooth scroll, mobile menu, anchors that move focus, reveals, pause-motion control,
// scroll -> camera mapping, and the lazily imported 3D scene. Everything here works without WebGL.
const root = document.documentElement;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// GSAP/ScrollTrigger are not started under reduced motion (ScrollTrigger keeps its own rAF loop alive).
const hasGsap = !reduce && typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
// ScrollTrigger registers itself when its script loads and keeps a rAF loop alive: stop it when it is not used
if (reduce) {
  try { if (window.ScrollTrigger) window.ScrollTrigger.disable(false); if (window.gsap) window.gsap.ticker.sleep(); } catch (e) { /* nothing to stop */ }
}
const mobileMq = window.matchMedia('(max-width: 960px)');

const nav = $('#nav');
const toggle = $('#navToggle');
const menu = $('#navMenu');
const motionBtn = $('#motionBtn');
const mainEl = $('#main');
const footerEl = $('.footer');
const sections = $$('[data-station]');
const navLinks = $$('.nav__links a');
const loader = $('#loader');
const loaderBar = $('#loaderBar');

let ctl = null;
let motionOff = false;

/* ---------- Smooth scroll (Lenis), fully torn down while motion is paused ---------- */
let lenis = null, lenisTick = null, lenisRaf = 0;
if (hasGsap) { gsap.registerPlugin(ScrollTrigger); gsap.ticker.lagSmoothing(0); }
function startLenis() {
  if (reduce || lenis || typeof window.Lenis === 'undefined') return;
  lenis = new window.Lenis({ lerp: 0.08, smoothWheel: true });
  if (hasGsap) {
    lenis.on('scroll', ScrollTrigger.update);
    lenisTick = (t) => lenis.raf(t * 1000);
    gsap.ticker.add(lenisTick);
  } else {
    const raf = (t) => { lenis.raf(t); lenisRaf = requestAnimationFrame(raf); };
    lenisRaf = requestAnimationFrame(raf);
  }
  if (menu.classList.contains('is-open')) lenis.stop(); // never scroll the page behind an open menu
}
function stopLenis() {
  if (!lenis) return;
  if (lenisTick) { gsap.ticker.remove(lenisTick); lenisTick = null; }
  if (lenisRaf) { cancelAnimationFrame(lenisRaf); lenisRaf = 0; }
  lenis.destroy();
  lenis = null;
}
startLenis();

/* ---------- Mobile menu: modal layer with focus trap ---------- */
function setMenu(open, returnFocus) {
  const modal = open && mobileMq.matches;
  menu.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  root.style.overflow = modal ? 'hidden' : '';
  mainEl.inert = modal;
  footerEl.inert = modal;
  if (lenis) (modal ? lenis.stop() : lenis.start());
  if (!open && returnFocus) toggle.focus();
}
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', (e) => {
  if (!menu.classList.contains('is-open')) return;
  if (e.key === 'Escape') { setMenu(false, true); return; }
  if (e.key === 'Tab') {
    const f = $$('a[href], button', nav).filter((el) => !el.hidden && el.offsetParent !== null);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
mobileMq.addEventListener('change', (e) => { if (!e.matches && menu.classList.contains('is-open')) setMenu(false); });

/* ---------- Anchors: scroll, then really move focus ---------- */
const vh = () => window.innerHeight;
// On tall (portrait) screens a station "arrives" with its panel in the lower part of the screen, so the
// 3D subject has the upper part to itself; on wide screens the panel sits beside the subject.
const portrait = () => window.innerWidth / window.innerHeight < 0.9;
const panelOffset = (h) => (portrait() && h < vh() * 0.55 ? Math.min(vh() * 0.2, (vh() - h) / 2 - 16) : 0);
function scrollTargetFor(el) {
  if (el === mainEl || el === sections[0]) return 0;
  const panel = $('.panel', el);
  if (panel) {
    const r = panel.getBoundingClientRect();
    const navH = nav.offsetHeight;
    const off = panelOffset(r.height);
    if (off) return Math.max(0, r.top + window.scrollY + r.height / 2 - vh() / 2 - off);
    // centre the panel in the space under the header (or its top, when it is taller than that space)
    const free = vh() - navH;
    const y = r.top + window.scrollY - navH - Math.max(12, (free - r.height) / 2);
    return Math.max(0, y);
  }
  return el.getBoundingClientRect().top + window.scrollY;
}
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) setMenu(false);
    const y = scrollTargetFor(target);
    if (lenis) lenis.scrollTo(y, { duration: id === '#main' ? 0.6 : 1.8, force: true });
    else window.scrollTo({ top: y, behavior: (reduce || motionOff) ? 'auto' : 'smooth' });
    history.replaceState(null, '', id);
    target.focus({ preventScroll: true });
  });
});

/* ---------- Reveals (transform only; never depend on the 3D scene) ---------- */
const groups = $$('[data-rv-group]');
const showGroup = (g) => $$('[data-rv]', g).forEach((el, i) => { el.style.transitionDelay = (i * 0.07).toFixed(2) + 's'; el.classList.add('is-in'); });
if (!reduce) {
  root.classList.add('rv-on');
  showGroup(groups[0]);
  if (hasGsap) {
    groups.slice(1).forEach((g) => ScrollTrigger.create({ trigger: g, start: 'top 88%', once: true, onEnter: () => showGroup(g) }));
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { showGroup(x.target); io.unobserve(x.target); } }), { threshold: 0.05 });
    groups.slice(1).forEach((g) => io.observe(g));
  } else groups.forEach(showGroup);
}

/* ---------- Scroll -> station coordinate u (0..5) ---------- */
let anchors = [], holds = [], uTarget = 0, activeStation = -1;
function measure() {
  anchors = sections.map((s) => {
    const p = $('.panel', s) || s;
    const r = p.getBoundingClientRect();
    return { c: r.top + window.scrollY + r.height / 2 - panelOffset(r.height), h: r.height / 2 };
  });
  anchors[0].c = Math.min(anchors[0].c, vh() * 0.5); // the hero is station 0 from the very top
  holds = anchors.map((a, i) => {
    const prev = anchors[i - 1], next = anchors[i + 1];
    const gap = Math.min(prev ? a.c - prev.c : 1e9, next ? next.c - a.c : 1e9);
    return Math.max(vh() * 0.1, Math.min(a.h * 0.6 + vh() * 0.05, gap * 0.3));
  });
}
const sstep = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
function uFromScroll(y) {
  const s = y + vh() / 2, n = anchors.length;
  if (!n || s <= anchors[0].c + holds[0]) return 0;
  for (let i = 0; i < n - 1; i++) {
    if (s < anchors[i + 1].c) {
      const a = anchors[i].c + holds[i], b = anchors[i + 1].c - holds[i + 1];
      return i + sstep((s - a) / Math.max(1, b - a));
    }
  }
  return n - 1;
}
function onScroll() {
  uTarget = uFromScroll(window.scrollY);
  if (ctl) ctl.setU(uTarget);
  const st = Math.round(uTarget);
  if (st !== activeStation) {
    activeStation = st;
    navLinks.forEach((a) => {
      if (a.getAttribute('href') === '#' + sections[st].id) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  }
}
measure();
// The camera is fed by a plain scroll listener so it keeps working while the GSAP ticker sleeps.
window.addEventListener('scroll', onScroll, { passive: true });
if (hasGsap) ScrollTrigger.create({ trigger: mainEl, start: 'top top', end: 'bottom bottom', onRefresh: () => { measure(); onScroll(); } });
let rzT = 0;
const remeasure = () => { clearTimeout(rzT); rzT = setTimeout(() => { measure(); onScroll(); }, 120); };
window.addEventListener('resize', remeasure);
if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(mainEl);
onScroll();

/* ---------- Pause motion (WCAG 2.2.2): constant label, aria-pressed carries the state ---------- */
function setMotion(off) {
  motionOff = off;
  root.classList.toggle('motion-off', off);
  motionBtn.setAttribute('aria-pressed', String(off));
  if (ctl) ctl.setPaused(off);
  if (off) {
    stopLenis();
    if (hasGsap) { gsap.ticker.sleep(); ScrollTrigger.disable(false); } // also ends ScrollTrigger's own rAF loop
  } else {
    if (hasGsap) { ScrollTrigger.enable(); ScrollTrigger.getAll().forEach((t) => t.enable()); gsap.ticker.wake(); }
    startLenis();
  }
}
if (reduce) motionBtn.hidden = true;
else motionBtn.addEventListener('click', () => setMotion(!motionOff));

/* ---------- 3D scene (progressive enhancement) ---------- */
// The <head> probe set gl-able before first paint, so the layout never changes here: on failure the
// posters simply stay (fell-back), on success the canvas fades in over them (is-3d).
function fail() { root.classList.add('fell-back'); root.classList.remove('is-3d'); }
async function importScene() {
  try { return await import('./scene.js'); }
  catch (e) { await new Promise((r) => setTimeout(r, 400)); return import('./scene.js?r=1'); }
}
if (root.classList.contains('gl-able')) {
  importScene()
    .then((m) => m.initScene({
      canvas: $('#stage'),
      reduce,
      paused: motionOff,
      watch: mainEl,
      onProgress: (f) => { loaderBar.style.width = Math.round(f * 100) + '%'; },
      onLost: () => root.classList.remove('is-3d'),
      onRestored: () => root.classList.add('is-3d'),
    }))
    .then((c) => {
      if (!c) { fail(); return; }
      ctl = c;
      ctl.setU(uTarget);
      ctl.setPaused(motionOff);
      root.classList.add('is-3d');
      if (hasGsap) ScrollTrigger.refresh();
    })
    .catch(() => fail());
}
loader.hidden = false;

if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); onScroll(); });
window.addEventListener('load', () => { measure(); if (hasGsap) ScrollTrigger.refresh(); onScroll(); });
