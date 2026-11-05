// Ember & Oak - sample design. Page behaviour: smooth scroll, menu, anchors, pause-motion control,
// scroll -> camera keyframe, HTML reveals, lazy 3D scene. The page works fully without the scene.
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
const mobileMq = window.matchMedia('(max-width: 860px)');
let ctl = null; // 3D scene controller once loaded
let motionOff = false;

/* ---------- Smooth scroll (Lenis), fully torn down while motion is paused ---------- */
let lenis = null, lenisTick = null, lenisRaf = 0;
if (hasGsap) { gsap.registerPlugin(ScrollTrigger); gsap.ticker.lagSmoothing(0); }
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

/* ---------- Header: scrolled state, mobile menu (modal: inert page, focus trap) ---------- */
const onScrollNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
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
    const f = $$('a, button', nav).filter((el) => !el.hidden && el.getClientRects().length > 0);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
mobileMq.addEventListener('change', (e) => { if (!e.matches && menu.classList.contains('is-open')) setMenu(false); });

/* ---------- Scroll map: scroll position -> camera keyframe s (2 keys per station: arrive, settle) ---------- */
let map = [];
function measure() {
  const vh = window.innerHeight, sy = window.scrollY;
  map = sections.map((s) => {
    const r = s.getBoundingClientRect();
    const top = r.top + sy, h = r.height;
    const sticky = getComputedStyle($('.station__stick', s)).position === 'sticky';
    let A, B;
    if (sticky && h > vh * 1.15) { A = top; B = top + h - vh; }
    else { const c = top + h / 2 - vh / 2; A = c - vh * 0.2; B = c + vh * 0.2; }
    return { A, B, top };
  });
  map[0].A = Math.min(map[0].A, 0);
  for (let i = 1; i < map.length; i++) {
    if (map[i].A < map[i - 1].B + 1) map[i].A = map[i - 1].B + 1;
    if (map[i].B < map[i].A) map[i].B = map[i].A + 1;
  }
}
const smooth = (x) => x * x * (3 - 2 * x);
function keyAt(y) {
  const last = map.length - 1;
  for (let i = 0; i <= last; i++) {
    const m = map[i];
    if (y <= m.B) return 2 * i + clamp01((y - m.A) / Math.max(1, m.B - m.A));
    if (i < last && y < map[i + 1].A) return 2 * i + 1 + smooth((y - m.B) / (map[i + 1].A - m.B));
  }
  return 2 * last + 1;
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
    if (ctl.still) ctl.setStill(idx);
    else ctl.setKey(keyAt(window.scrollY));
  }
}
measure();
// A plain scroll listener drives the camera, so it keeps working while the GSAP ticker sleeps (paused motion).
window.addEventListener('scroll', onScroll, { passive: true });
if (hasGsap) ScrollTrigger.create({ trigger: '#journey', start: 'top top', end: 'bottom bottom', onRefresh: () => { measure(); onScroll(); } });
let rzT = 0;
window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { measure(); onScroll(); }, 140); });

/* ---------- Anchor links: scroll, then move focus to the target ---------- */
function scrollToTarget(target, id) {
  let y = 0;
  if (id !== '#fire') {
    const i = sections.indexOf(target);
    y = (i >= 0 && map[i] ? map[i].top : target.getBoundingClientRect().top + window.scrollY) + 1;
    if (i < 0) y -= 120; // an element inside a section: leave room for the header
  }
  if (lenis) lenis.scrollTo(y, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4) });
  else window.scrollTo({ top: y, behavior: 'auto' });
}
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#main' ? mainEl : $(id);
    if (!target) return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) setMenu(false);
    if (id !== '#main') scrollToTarget(target, id);
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
    rvTweens.push(tw);
  });
}
const finishReveals = () => rvTweens.forEach((tw) => { if (tw.progress() < 1) tw.progress(1); });
// Safety net: anything on screen still hidden after 4 s is shown.
setTimeout(() => {
  rvTweens.forEach((tw) => {
    const els = tw.targets();
    if (tw.progress() < 1 && els.some((el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })) tw.progress(1);
  });
}, 4000);

/* ---------- Pause motion (WCAG 2.2.2): zero rAF callbacks while paused and settled ---------- */
function setMotion(off) {
  motionOff = off;
  root.classList.toggle('motion-off', off);
  motionBtn.setAttribute('aria-pressed', String(off));
  if (ctl) ctl.setPaused(off);
  if (off) {
    finishReveals(); // nothing stays half-faded while the tickers sleep
    stopLenis();
    if (hasGsap) { gsap.ticker.sleep(); ScrollTrigger.disable(false); }
  } else {
    if (hasGsap) { ScrollTrigger.enable(); ScrollTrigger.getAll().forEach((t) => t.enable()); gsap.ticker.wake(); }
    startLenis();
  }
}
if (reduce) motionBtn.hidden = true;
else motionBtn.addEventListener('click', () => setMotion(!motionOff));

root.classList.add('js-ready');

/* ---------- 3D scene (progressive enhancement) ---------- */
const bar = $('#loaderBar');
function fail() { root.classList.add('fell-back'); root.classList.remove('is-3d'); }
async function importScene() {
  try { return await import('./scene.js'); }
  catch (e) { await new Promise((r) => setTimeout(r, 450)); return import('./scene.js?r=1'); }
}
async function bootScene() {
  if (!root.classList.contains('gl-able')) return; // the head probe found no WebGL: posters stay
  try {
    if (document.readyState !== 'complete') await new Promise((r) => window.addEventListener('load', r, { once: true }));
    const m = await importScene();
    const c = await m.initScene($('#stage'), {
      reduce,
      onProgress: (p) => { if (bar) bar.style.transform = `scaleX(${Math.max(0.04, p).toFixed(3)})`; },
      onReady: () => { root.classList.add('is-3d'); },
      onLoaded: () => { root.classList.add('loaded'); },
      onLost: () => { root.classList.remove('is-3d'); },
      onRestored: () => { root.classList.add('is-3d'); onScroll(); },
    });
    if (!c) { fail(); return; }
    ctl = c;
    ctl.setPaused(motionOff);
    measure();
    onScroll();
  } catch (e) { fail(); }
}
window.addEventListener('load', () => { measure(); onScroll(); if (hasGsap) ScrollTrigger.refresh(); });
onScroll();
bootScene();
