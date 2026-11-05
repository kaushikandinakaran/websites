// Flour & Fig - sample design. Page behaviour: smooth scroll, menu, anchors, pause-motion control,
// scroll -> scene state, HTML reveals (independent of 3D), lazy 3D scene with a designed loading line.
const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

const nav = $('#nav');
const toggle = $('#navToggle');
const menu = $('#navMenu');
const motionBtn = $('#motionBtn');
const mainEl = $('#main');
const footerEl = $('.footer');
const sections = $$('.station');
const navLinks = $$('.nav__links a');
const loaderBar = $('#loaderBar');
const mobileMq = window.matchMedia('(max-width: 860px)');
let ctl = null;
let motionOff = false;

/* ---------- smooth scroll (Lenis on the GSAP ticker); fully torn down while motion is paused ---------- */
let lenis = null;
let tickerFn = null;
if (hasGsap) gsap.registerPlugin(ScrollTrigger);
// ScrollTrigger keeps an animation-frame loop alive while it is enabled; reduced motion needs none of it
if (hasGsap && reduce) ScrollTrigger.disable(false);
function startLenis() {
  if (reduce || lenis || typeof window.Lenis === 'undefined') return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
  if (hasGsap) {
    lenis.on('scroll', ScrollTrigger.update);
    tickerFn = (t) => { if (lenis) lenis.raf(t * 1000); };
    gsap.ticker.add(tickerFn);
    gsap.ticker.lagSmoothing(0);
  }
  if (menu.classList.contains('is-open')) lenis.stop(); // never scroll the page behind an open menu
}
function stopLenis() {
  if (!lenis) return;
  if (tickerFn && hasGsap) gsap.ticker.remove(tickerFn);
  tickerFn = null;
  lenis.destroy(); lenis = null;
}
startLenis();

/* ---------- header and mobile menu (modal while open) ---------- */
const onScrollNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 16);
window.addEventListener('scroll', onScrollNav, { passive: true });
onScrollNav();

function setMenu(open, returnFocus) {
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
    const f = $$('a, button', nav).filter((el) => !el.hidden && el.getClientRects().length);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
mobileMq.addEventListener('change', (e) => { if (!e.matches && menu.classList.contains('is-open')) setMenu(false); });

/* ---------- scroll map: scroll position -> camera station t and per-station progress u ---------- */
let map = [];
function measure() {
  const vh = window.innerHeight, sy = window.scrollY;
  const navH = nav.offsetHeight;
  map = sections.map((s) => {
    const r = s.getBoundingClientRect();
    const top = r.top + sy, h = r.height;
    const stick = $('.station__stick', s);
    const sticky = getComputedStyle(stick).position === 'sticky';
    let A, B;
    if (sticky && h > vh * 1.15) { A = top - navH; B = top + h - vh; }
    else { const c = top + h / 2 - vh / 2; A = c - vh * 0.25; B = c + vh * 0.25; }
    return { A, B, top };
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
  const lo = (i) => (i === 0 ? 0 : -0.06), hi = (i) => (i === last ? 0 : 0.06);
  let t = last;
  for (let i = 0; i <= last; i++) {
    const m = map[i];
    if (y <= m.B) { t = i + lo(i) + (hi(i) - lo(i)) * u[i]; break; }
    if (i < last && y < map[i + 1].A) {
      const f = smooth((y - m.B) / (map[i + 1].A - m.B));
      t = (i + hi(i)) + ((i + 1 + lo(i + 1)) - (i + hi(i))) * f; break;
    }
  }
  return { t, u };
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
  if (ctl && map.length) {
    if (ctl.still) ctl.setState({ still: idx });
    else ctl.setState(stateAt(window.scrollY));
  }
}
// the camera follows the native scroll position (Lenis drives it), so it keeps working while motion is paused
window.addEventListener('scroll', onScroll, { passive: true });
let rzTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(rzTimer);
  rzTimer = setTimeout(() => { measure(); onScroll(); if (hasGsap && !motionOff && !reduce) ScrollTrigger.refresh(); }, 150);
});

/* ---------- anchor links: scroll, then move focus ---------- */
function scrollToTarget(target) {
  const i = sections.indexOf(target);
  let y;
  if (i === 0) y = 0;
  else if (i > 0 && map[i]) y = Math.max(map[i].A + 2, (map[i].A + map[i].B) / 2 - window.innerHeight * 0.1);
  else y = target.getBoundingClientRect().top + window.scrollY - nav.offsetHeight - 16;
  if (i > 0 && map[i] && sections[i].classList.contains('station--menu')) y = map[i].top + window.innerHeight * 0.3;
  if (lenis) lenis.scrollTo(y, { duration: 1.5, easing: (x) => 1 - Math.pow(1 - x, 4) });
  else window.scrollTo({ top: y, behavior: 'auto' });
}
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id.length > 1 ? $(id) : null;
    if (!target) return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) setMenu(false);
    const section = target.closest('.station') || target;
    if (target === mainEl) window.scrollTo({ top: Math.max(window.scrollY, 1), behavior: 'auto' });
    else scrollToTarget(section);
    history.replaceState(null, '', id);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
});

/* ---------- HTML reveals (never depend on the 3D scene) ---------- */
const rvTweens = [];
if (hasGsap && !reduce) {
  $$('[data-rv-group]').forEach((group, gi) => {
    const items = $$('[data-rv]', group);
    const tw = gsap.from(items, {
      y: 22, opacity: 0, duration: 0.9, stagger: 0.09, ease: 'power3.out', delay: gi === 0 ? 0.15 : 0,
      clearProps: 'transform,opacity',
      scrollTrigger: gi === 0 ? null : { trigger: group.closest('.station'), start: 'top 75%', once: true },
    });
    rvTweens.push({ tw, items });
  });
  setTimeout(() => { // safety net: anything on screen still hidden after 4 s is shown
    rvTweens.forEach(({ tw, items }) => {
      if (tw.progress() < 1 && items.some((el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })) tw.progress(1);
    });
  }, 4000);
}
function finishReveals() { // used when motion is paused: show everything now and remove every scroll trigger
  rvTweens.forEach(({ tw }) => { tw.progress(1); if (tw.scrollTrigger) tw.scrollTrigger.kill(); tw.kill(); });
  rvTweens.length = 0;
}

/* ---------- pause motion (WCAG 2.2.2): zero animation frames while paused and idle ---------- */
function setMotion(off) {
  motionOff = off;
  root.classList.toggle('motion-off', off);
  motionBtn.setAttribute('aria-pressed', String(off));
  if (off) {
    finishReveals();
    stopLenis();
    if (hasGsap) { ScrollTrigger.disable(false); gsap.ticker.sleep(); } // zero animation frames while idle
  } else {
    if (hasGsap) { gsap.ticker.wake(); ScrollTrigger.enable(); }
    startLenis();
  }
  if (ctl) ctl.setPaused(off);
}
if (reduce) motionBtn.hidden = true;
else motionBtn.addEventListener('click', () => setMotion(!motionOff));

/* ---------- 3D scene (progressive enhancement) ---------- */
// The <head> probe already set gl-able and fixed the page layout from the first paint; nothing here changes layout.
function fail() { root.classList.add('fell-back'); }
async function bootScene() {
  if (!root.classList.contains('gl-able')) return;
  try {
    if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
    let m;
    try { m = await import('./scene.js'); }
    catch (e) { await new Promise((r) => setTimeout(r, 400)); m = await import('./scene.js?r=1'); }
    const c = await m.initScene($('#stage'), {
      reduce,
      onProgress: (p) => { loaderBar.style.transform = `scaleX(${Math.max(0.04, Math.min(1, p)).toFixed(3)})`; },
      onLost: () => { root.classList.remove('is-3d'); },
      onRestored: () => { root.classList.add('is-3d'); onScroll(); },
    });
    if (!c) { fail(); return; }
    ctl = c;
    root.classList.add('is-3d');
    ctl.setPaused(motionOff);
    measure();
    onScroll();
  } catch (e) { fail(); }
}
window.addEventListener('load', () => { measure(); onScroll(); if (hasGsap && !motionOff && !reduce) ScrollTrigger.refresh(); });
measure();
onScroll();
root.classList.add('js-ready');
bootScene();
