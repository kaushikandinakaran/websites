// Maison Claire - sample design. Page behaviour: smooth scroll, menu, anchors,
// pause-motion control, scroll -> scene state, HTML reveals, lazy 3D scene.
const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// GSAP / ScrollTrigger are not even started under reduced motion (they would keep a rAF loop alive for nothing).
const hasGsap = !reduce && typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

const nav = $('#nav');
const toggle = $('#navToggle');
const menu = $('#navMenu');
const motionBtn = $('#motionBtn');
const mainEl = $('#main');
const footerEl = $('.footer');
const sections = $$('.station');
const navLinks = $$('.nav__links a');
const mobileMq = window.matchMedia('(max-width: 860px)');
let ctl = null; // 3D scene controller, once loaded
let motionOff = false;

/* ---------- Smooth scroll (Lenis) + ScrollTrigger sync. Fully torn down while motion is paused. ---------- */
let lenis = null, lenisTick = null, lenisRaf = 0;
if (hasGsap) { gsap.registerPlugin(ScrollTrigger); gsap.ticker.lagSmoothing(0); }
else if (reduce) { // the vendor files register themselves on load: stop the loops they started
  try { if (window.ScrollTrigger) window.ScrollTrigger.disable(false); if (window.gsap) window.gsap.ticker.sleep(); } catch (e) { /* not loaded */ }
}
function startLenis() {
  if (reduce || lenis || typeof window.Lenis === 'undefined') return;
  lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true });
  if (hasGsap) {
    lenis.on('scroll', ScrollTrigger.update);
    lenisTick = (t) => lenis.raf(t * 1000);
    gsap.ticker.add(lenisTick);
  } else {
    const raf = (t) => { lenis.raf(t); lenisRaf = requestAnimationFrame(raf); };
    lenisRaf = requestAnimationFrame(raf);
  }
  if (menu.classList.contains('is-open')) lenis.stop(); // an open menu keeps the page still
}
function stopLenis() {
  if (!lenis) return;
  if (lenisTick) { gsap.ticker.remove(lenisTick); lenisTick = null; }
  if (lenisRaf) { cancelAnimationFrame(lenisRaf); lenisRaf = 0; }
  lenis.destroy();
  lenis = null;
}
startLenis();

/* ---------- Header: scrolled state, mobile menu with focus trap ---------- */
const onScrollNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
window.addEventListener('scroll', onScrollNav, { passive: true });
onScrollNav();

function setMenu(open, returnFocus) {
  menu.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  root.style.overflow = open ? 'hidden' : '';
  mainEl.inert = open; footerEl.inert = open; // the open menu is a modal layer
  if (lenis) open ? lenis.stop() : lenis.start();
  if (!open && returnFocus) toggle.focus();
}
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', (e) => {
  if (!menu.classList.contains('is-open')) return;
  if (e.key === 'Escape') { setMenu(false, true); return; }
  if (e.key === 'Tab') { // keep focus inside the open menu
    const f = $$('a, button:not([hidden])', nav).filter((el) => el.offsetParent !== null || el === toggle || menu.contains(el));
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
mobileMq.addEventListener('change', (e) => { if (!e.matches) setMenu(false); });

/* ---------- Scroll map: scroll position -> camera station + per-station progress ---------- */
const STATIONS = sections.length;
let map = [];
function measure() {
  const vh = window.innerHeight, sy = window.scrollY;
  map = sections.map((s) => {
    const r = s.getBoundingClientRect();
    const top = r.top + sy, h = r.height;
    const stick = $('.station__stick', s);
    const sticky = getComputedStyle(stick).position === 'sticky';
    let A, B;
    if (sticky && h > vh * 1.15) { A = top; B = top + h - vh; }
    else { const c = top + h / 2 - vh / 2; A = c - vh * 0.2; B = c + vh * 0.2; }
    return { A, B, top, h };
  });
  map[0].A = Math.min(map[0].A, 0);
  for (let i = 1; i < map.length; i++) {
    if (map[i].A < map[i - 1].B + 1) map[i].A = map[i - 1].B + 1;
    if (map[i].B < map[i].A) map[i].B = map[i].A + 1;
  }
}
const smooth = (x) => x * x * (3 - 2 * x);
function stateAt(y) {
  const u = map.map((m) => clamp01((y - m.A) / Math.max(1, m.B - m.A)));
  const last = map.length - 1;
  const lo = (i) => (i === 0 ? 0 : -0.1), hi = (i) => (i === last ? 0 : (i === 0 ? 0.2 : 0.1));
  let t = last + hi(last);
  for (let i = 0; i <= last; i++) {
    const m = map[i];
    if (y <= m.B) { t = i + lo(i) + (hi(i) - lo(i)) * u[i]; break; }
    if (i < last && y < map[i + 1].A) {
      const f = smooth((y - m.B) / (map[i + 1].A - m.B));
      const a = i + hi(i), b = i + 1 + lo(i + 1);
      t = a + (b - a) * f; break;
    }
  }
  return { t, u };
}
function activeIndex() {
  const mid = window.innerHeight * 0.5;
  let idx = 0;
  sections.forEach((s, i) => { const r = s.getBoundingClientRect(); if (r.top <= mid) idx = i; });
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
  if (ctl && map.length) {
    if (ctl.still) ctl.setState({ t: idx, still: idx });
    else ctl.setState(stateAt(window.scrollY));
  }
}
// A plain scroll listener drives the scene state (camera + per-station progress) and the nav highlight, so both
// keep working while the GSAP ticker sleeps (paused motion) or GSAP is not started (reduced motion).
window.addEventListener('scroll', onScroll, { passive: true });
if (hasGsap) ScrollTrigger.create({ trigger: '#journey', start: 'top top', end: 'bottom bottom', onRefresh: () => { measure(); onScroll(); } });

let rzTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(rzTimer);
  rzTimer = setTimeout(() => { measure(); onScroll(); if (hasGsap) ScrollTrigger.refresh(); }, 150);
});

/* ---------- Anchor links: scroll, then move focus ---------- */
function scrollToTarget(target, id) {
  let y = 0;
  if (id !== '#table') {
    const i = sections.indexOf(target);
    const base = i >= 0 && map[i] ? map[i].top : target.getBoundingClientRect().top + window.scrollY;
    y = base + 1;
  }
  if (lenis) lenis.scrollTo(y, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4), force: true });
  else window.scrollTo({ top: y, behavior: reduce || motionOff ? 'auto' : 'smooth' });
}
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) setMenu(false);
    scrollToTarget(target, id);
    history.replaceState(null, '', id);
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
});

/* ---------- Pause motion control (WCAG 2.2.2) ---------- */
function setMotion(off) {
  motionOff = off;
  root.classList.toggle('motion-off', off);
  motionBtn.setAttribute('aria-pressed', String(off));
  if (off) $$('.btn').forEach((b) => { b.style.transform = ''; });
  if (ctl) ctl.setPaused(off);
  // Stop every loop we own: Lenis smoothing, the shared GSAP ticker and ScrollTrigger. Scrolling stays native.
  if (off) {
    rvTweens.forEach(({ tw }) => tw.progress(1)); // reveals finish now (nothing can stay hidden while asleep)
    stopLenis();
    if (hasGsap) { ScrollTrigger.disable(false); gsap.ticker.sleep(); }
  } else {
    if (hasGsap) { ScrollTrigger.enable(); ScrollTrigger.getAll().forEach((t) => t.enable()); gsap.ticker.wake(); }
    startLenis();
    measure(); onScroll(); // camera, per-station progress and nav highlight match where the page now is
  }
}
if (reduce) motionBtn.hidden = true; // everything is already still under reduced motion
else motionBtn.addEventListener('click', () => setMotion(!motionOff));

/* ---------- HTML reveals (do not depend on the 3D scene) ---------- */
const rvTweens = [];
if (hasGsap && !reduce) {
  $$('[data-rv-group]').forEach((group, gi) => {
    const items = $$('[data-rv]', group);
    const isHero = gi === 0;
    const tw = gsap.from(items, {
      y: 26, opacity: 0, duration: 1, stagger: 0.11, ease: 'power3.out', delay: isHero ? 0.2 : 0,
      clearProps: 'transform,opacity',
      scrollTrigger: isHero ? null : { trigger: group.closest('.station'), start: 'top 72%', once: true },
    });
    rvTweens.push({ tw, items });
  });
  // Safety net: anything in view still hidden after 4 s is shown.
  setTimeout(() => {
    rvTweens.forEach(({ tw, items }) => {
      if (tw.progress() < 1 && items.some((el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })) tw.progress(1);
    });
  }, 4000);
}

/* ---------- Magnetic buttons (fine pointers, motion on) ---------- */
if (finePointer && !reduce) {
  $$('.btn').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      if (motionOff) return;
      const r = b.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / r.width, y = (e.clientY - (r.top + r.height / 2)) / r.height;
      b.style.transform = `translate(${(x * 10).toFixed(1)}px, ${(y * 8).toFixed(1)}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
}

/* ---------- 3D scene (progressive enhancement) ---------- */
// The inline <head> probe already tested WebGL (class gl-able) and fixed the page layout from first paint,
// so nothing here changes layout: the scene only fades in over the posters.
async function importScene() {
  try { return await import('./scene.js'); }
  catch (e) { // one retry after a short pause; a second failure leaves the poster fallback in place
    await new Promise((r) => setTimeout(r, 450));
    return import('./scene.js?r=1');
  }
}
async function bootScene() {
  if (!root.classList.contains('gl-able')) return; // posters stay in place
  try {
    if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    if (document.readyState !== 'complete') await new Promise((r) => window.addEventListener('load', r, { once: true }));
    await new Promise((r) => setTimeout(r, 60)); // let the page's own requests finish first
    const m = await importScene();
    const c = await m.initScene($('#stage'), {
      reduce,
      onLost: () => { root.classList.remove('is-3d'); }, // posters return; layout does not change
      onRestored: () => { root.classList.add('is-3d'); onScroll(); },
    });
    if (!c) return;
    ctl = c;
    root.classList.add('is-3d');
    ctl.setPaused(motionOff);
    onScroll();
  } catch (e) { /* the designed poster fallback stays */ }
}
// fonts and images can nudge section heights slightly: re-measure once everything has loaded
window.addEventListener('load', () => { measure(); onScroll(); if (hasGsap) ScrollTrigger.refresh(); });
measure();
onScroll();
bootScene();
