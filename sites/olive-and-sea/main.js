// Olive & Sea - sample design. Page behaviour: smooth scroll, menu, anchors, pause-motion control,
// scroll -> scene state, HTML reveals, loading line, lazy 3D scene. The page works fully without the scene.
const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

const toggle = $('#navToggle');
const menu = $('#navMenu');
const nav = $('#nav');
const motionBtn = $('#motionBtn');
const mainEl = $('#main');
const footerEl = $('.footer');
const sections = $$('.station');
const navLinks = $$('.nav__links a');
const mobileMq = window.matchMedia('(max-width: 900px)');
let ctl = null; // 3D scene controller, once loaded
let motionOff = false;

/* ---------- Smooth scroll (Lenis). Fully torn down while motion is paused. ---------- */
let lenis = null, lenisTick = null, lenisRaf = 0;
if (hasGsap) { gsap.registerPlugin(ScrollTrigger); gsap.ticker.lagSmoothing(0); }
function startLenis() {
  if (reduce || lenis || typeof window.Lenis === 'undefined') return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
  if (hasGsap) {
    lenis.on('scroll', ScrollTrigger.update);
    lenisTick = (t) => lenis.raf(t * 1000);
    gsap.ticker.add(lenisTick);
  } else {
    const raf = (t) => { lenis.raf(t); lenisRaf = requestAnimationFrame(raf); };
    lenisRaf = requestAnimationFrame(raf);
  }
  if (menu.classList.contains('is-open')) lenis.stop(); // never scroll the page behind the open menu
}
function stopLenis() {
  if (!lenis) return;
  if (lenisTick) { gsap.ticker.remove(lenisTick); lenisTick = null; }
  if (lenisRaf) { cancelAnimationFrame(lenisRaf); lenisRaf = 0; }
  lenis.destroy();
  lenis = null;
}
startLenis();

/* ---------- Mobile menu: modal layer with focus trap; every exit clears inert ---------- */
function setMenu(open, returnFocus) {
  if (open && !mobileMq.matches) open = false;
  menu.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  root.style.overflow = open ? 'hidden' : '';
  mainEl.inert = open; footerEl.inert = open;
  if (lenis) open ? lenis.stop() : lenis.start();
  if (!open && returnFocus) toggle.focus();
}
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', (e) => {
  if (!menu.classList.contains('is-open')) return;
  if (e.key === 'Escape') { setMenu(false, true); return; }
  if (e.key === 'Tab') {
    const f = $$('a, button:not([hidden])', nav).filter((el) => el.getClientRects().length > 0);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
mobileMq.addEventListener('change', (e) => { if (!e.matches) setMenu(false); });

/* ---------- Scroll map: scroll position -> continuous station value t (0..5) ---------- */
// Each station holds while its panel is pinned (A..B), the camera travels between holds.
let map = [];
function measure() {
  const vh = window.innerHeight, sy = window.scrollY;
  map = sections.map((s) => {
    const r = s.getBoundingClientRect();
    const top = r.top + sy, h = r.height;
    const stick = $('.station__stick', s);
    const pinned = getComputedStyle(stick).position === 'sticky' && h > vh * 1.2;
    let A, B;
    if (pinned) { A = top; B = top + h - vh; } else { const c = top + h / 2 - vh / 2; A = c - vh * 0.15; B = c + vh * 0.15; }
    return { A, B, top, pinned };
  });
  if (!map.length) return;
  map[0].A = Math.min(map[0].A, 0);
  for (let i = 1; i < map.length; i++) {
    if (map[i].A < map[i - 1].B + 1) map[i].A = map[i - 1].B + 1;
    if (map[i].B < map[i].A) map[i].B = map[i].A + 1;
  }
}
const smooth = (x) => x * x * (3 - 2 * x);
// In a hold the value drifts from i-0.12 to i+0.12 (or 0..0.2 at the start, ends at the last station);
// station 3 (dusk) uses its whole hold as the light change, so it gets a wider range.
const LO = [0, -0.12, -0.12, -0.3, -0.12, -0.12], HI = [0.2, 0.12, 0.12, 0.3, 0.12, 0];
function stateAt(y) {
  const last = map.length - 1;
  for (let i = 0; i <= last; i++) {
    const m = map[i];
    if (y <= m.B) return i + LO[i] + (HI[i] - LO[i]) * clamp01((y - m.A) / Math.max(1, m.B - m.A));
    if (i < last && y < map[i + 1].A) {
      const f = smooth((y - m.B) / (map[i + 1].A - m.B));
      const a = i + HI[i], b = i + 1 + LO[i + 1];
      return a + (b - a) * f;
    }
  }
  return last + HI[last];
}
function activeIndex() {
  const mid = window.innerHeight * 0.5;
  let idx = 0;
  sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= mid) idx = i; });
  return idx;
}
let lastActive = -1;
function onScroll() {
  const idx = activeIndex();
  if (idx !== lastActive) {
    lastActive = idx;
    const id = '#' + sections[idx].id;
    navLinks.forEach((a) => { if (a.getAttribute('href') === id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  if (ctl && map.length) ctl.setState(ctl.still ? { t: idx, still: true } : { t: stateAt(window.scrollY) });
}
measure();
// A plain scroll listener drives the camera, so it keeps working while the GSAP ticker sleeps (motion paused).
window.addEventListener('scroll', onScroll, { passive: true });
if (hasGsap) ScrollTrigger.create({ trigger: '#journey', start: 'top top', end: 'bottom bottom', onRefresh: () => { measure(); onScroll(); } });
let rzT = 0;
const remeasure = () => { clearTimeout(rzT); rzT = setTimeout(() => { measure(); onScroll(); }, 120); };
window.addEventListener('resize', remeasure);
if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(mainEl);
onScroll();

/* ---------- Anchor links: scroll, then move focus to the target ---------- */
function scrollToTarget(target) {
  const i = sections.indexOf(target);
  let y = 0;
  if (i > 0) y = map[i] ? (map[i].pinned ? map[i].A + 1 : map[i].top) : target.getBoundingClientRect().top + window.scrollY;
  else if (i < 0) y = target.getBoundingClientRect().top + window.scrollY;
  if (lenis) lenis.scrollTo(y, { duration: 1.8, easing: (x) => 1 - Math.pow(1 - x, 4) });
  else window.scrollTo({ top: y, behavior: 'auto' });
}
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#main' ? mainEl : $(id);
    if (!target) return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) setMenu(false);
    if (target !== mainEl) scrollToTarget(target);
    history.replaceState(null, '', id);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: target !== mainEl ? true : false });
  });
});

/* ---------- Pause motion (WCAG 2.2.2): constant label, aria-pressed carries the state ---------- */
function setMotion(off) {
  motionOff = off;
  root.classList.toggle('motion-off', off);
  motionBtn.setAttribute('aria-pressed', String(off));
  if (ctl) ctl.setPaused(off);
  if (off) { // stop every loop we own; scrolling stays native and still moves the camera
    stopLenis();
    if (hasGsap) { gsap.ticker.sleep(); ScrollTrigger.disable(false); }
  } else {
    if (hasGsap) { ScrollTrigger.enable(); ScrollTrigger.getAll().forEach((t) => t.enable()); gsap.ticker.wake(); }
    startLenis();
  }
}
if (reduce) motionBtn.hidden = true;
else motionBtn.addEventListener('click', () => setMotion(!motionOff));

/* ---------- HTML reveals (independent of the 3D scene; content is visible without JS) ---------- */
if (hasGsap && !reduce) {
  const tweens = [];
  $$('[data-rv-group]').forEach((group, gi) => {
    const items = $$('[data-rv]', group);
    const tw = gsap.from(items, {
      y: 22, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', delay: gi === 0 ? 0.15 : 0,
      clearProps: 'transform,opacity',
      scrollTrigger: gi === 0 ? null : { trigger: group.closest('.station'), start: 'top 75%', once: true },
    });
    tweens.push({ tw, items });
  });
  setTimeout(() => { // safety net: anything on screen still hidden after 4 s is shown
    tweens.forEach(({ tw, items }) => {
      if (tw.progress() < 1 && items.some((el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })) tw.progress(1);
    });
  }, 4000);
}

/* ---------- 3D scene (progressive enhancement) ---------- */
// The <head> probe set gl-able before first paint, so the layout never changes here: the scene only fades in
// over the posters, and a late failure only brings the posters back (class fell-back).
const loaderBar = $('#loaderBar');
function progress(p) { if (loaderBar) loaderBar.style.transform = `scaleX(${Math.max(0.04, Math.min(1, p)).toFixed(3)})`; }
function fail() { root.classList.add('fell-back'); root.classList.remove('is-3d'); }
async function importScene() {
  try { return await import('./scene.js'); }
  catch (e) { await new Promise((r) => setTimeout(r, 450)); return import('./scene.js?r=1'); }
}
async function bootScene() {
  if (!root.classList.contains('gl-able')) return;
  try {
    if (document.readyState !== 'complete') await new Promise((r) => window.addEventListener('load', r, { once: true }));
    const m = await importScene();
    const c = await m.initScene($('#stage'), {
      reduce,
      watch: $('#journey'),
      onProgress: progress,
      onLost: () => { root.classList.add('gl-lost'); },
      onRestored: () => { root.classList.remove('gl-lost'); onScroll(); },
    });
    if (!c) { fail(); return; }
    ctl = c;
    ctl.setPaused(motionOff);
    measure();
    onScroll();
    root.classList.add('is-3d');
  } catch (e) { fail(); }
}
window.addEventListener('load', () => { measure(); onScroll(); if (hasGsap) ScrollTrigger.refresh(); });
bootScene();
root.classList.add('js-ready');
