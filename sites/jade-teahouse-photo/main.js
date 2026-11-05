// Jade Teahouse - sample design. Page behaviour: smooth scroll, menu, anchors with focus,
// pause-motion control, scroll -> scene state, reveals, and the lazy 3D scene.
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
  if (menu.classList.contains('is-open')) lenis.stop();
}
function stopLenis() {
  if (!lenis) return;
  if (lenisTick) { gsap.ticker.remove(lenisTick); lenisTick = null; }
  if (lenisRaf) { cancelAnimationFrame(lenisRaf); lenisRaf = 0; }
  lenis.destroy();
  lenis = null;
}
startLenis();

/* ---------- Header: scrolled state, mobile menu (modal: main and footer inert) ---------- */
const onScrollNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
window.addEventListener('scroll', onScrollNav, { passive: true });
onScrollNav();

function setMenu(open, returnFocus) {
  menu.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  root.style.overflow = open ? 'hidden' : '';
  const modal = open && mobileMq.matches;
  mainEl.inert = modal; footerEl.inert = modal;
  if (lenis) (open ? lenis.stop() : lenis.start());
  if (!open && returnFocus) toggle.focus();
}
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', (e) => {
  if (!menu.classList.contains('is-open')) return;
  if (e.key === 'Escape') { setMenu(false, true); return; }
  if (e.key === 'Tab') { // keep focus inside the open menu
    const f = $$('a[href], button', nav).filter((el) => !el.hidden && el.offsetParent !== null);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
mobileMq.addEventListener('change', (e) => { if (!e.matches && menu.classList.contains('is-open')) setMenu(false); });

/* ---------- Scroll map: scroll position -> camera station t + progress u[i] inside each station ---------- */
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
  if (!map.length) return;
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
  // the camera holds on a station while its panel is pinned, then travels in the gaps
  const lo = (i) => (i === 0 ? 0 : -0.08), hi = (i) => (i === last ? 0 : 0.08);
  let t = last;
  for (let i = 0; i <= last; i++) {
    const m = map[i];
    if (y <= m.B) { t = i + lo(i) + (hi(i) - lo(i)) * u[i]; break; }
    if (i < last && y < map[i + 1].A) {
      const f = smooth((y - m.B) / (map[i + 1].A - m.B));
      const a = i + hi(i), b = i + 1 + lo(i + 1);
      t = a + (b - a) * f; break;
    }
  }
  return { t: Math.max(0, t), u };
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
measure();
// ScrollTrigger keeps the anchors in step with layout changes; a plain scroll listener drives the camera,
// so it keeps working while the GSAP ticker sleeps (motion paused).
if (hasGsap) ScrollTrigger.create({ trigger: '#journey', start: 'top top', end: 'bottom bottom', onRefresh: () => { measure(); onScroll(); } });
window.addEventListener('scroll', onScroll, { passive: true });
let rzT = 0;
window.addEventListener('resize', () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => { measure(); onScroll(); if (hasGsap) ScrollTrigger.refresh(); }, 150);
});

/* ---------- Anchor links: scroll, then really move focus ---------- */
function scrollTargetFor(target, id) {
  if (id === '#arrival' || target === mainEl) return 0;
  const i = sections.indexOf(target);
  if (i >= 0 && map[i]) {
    // land where the station's scene is fully arrived (a little into the pinned range)
    const m = map[i];
    return Math.max(0, Math.min(m.B, m.A + (m.B - m.A) * 0.35));
  }
  return target.getBoundingClientRect().top + window.scrollY;
}
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) setMenu(false);
    const y = scrollTargetFor(target, id);
    if (lenis) lenis.scrollTo(y, { duration: id === '#main' ? 0.6 : 1.8, force: true });
    else window.scrollTo({ top: y, behavior: (reduce || motionOff) ? 'auto' : 'smooth' });
    history.replaceState(null, '', id);
    target.focus({ preventScroll: true });
  });
});

/* ---------- Pause motion (WCAG 2.2.2): constant label, aria-pressed carries the state ---------- */
function setMotion(off) {
  motionOff = off;
  root.classList.toggle('motion-off', off);
  motionBtn.setAttribute('aria-pressed', String(off));
  if (ctl) ctl.setPaused(off);
  // stop every ticker this page owns: Lenis smoothing, the shared GSAP ticker and ScrollTrigger's loop
  if (off) {
    stopLenis();
    if (hasGsap) { gsap.ticker.sleep(); ScrollTrigger.disable(false); }
  } else {
    if (hasGsap) { ScrollTrigger.enable(); ScrollTrigger.getAll().forEach((t) => t.enable()); gsap.ticker.wake(); }
    startLenis();
  }
}
if (reduce) motionBtn.hidden = true;
else motionBtn.addEventListener('click', () => setMotion(!motionOff));

/* ---------- Reveals (independent of the 3D scene) ---------- */
const rvEls = $$('[data-rv]');
if ('IntersectionObserver' in window && !reduce) {
  // observe each panel's (unclipped) wrapper: Chrome counts the target's own clip-path, so a fully clipped
  // panel would never report as intersecting
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.querySelectorAll('[data-rv]').forEach((el) => el.classList.add('is-in')); io.unobserve(en.target); } });
  }, { threshold: 0.05 });
  rvEls.forEach((el) => io.observe(el.parentElement));
} else {
  rvEls.forEach((el) => el.classList.add('is-in'));
}
root.classList.add('js-ready');

/* ---------- 3D scene (progressive enhancement) ---------- */
// The inline head probe tested WebGL (gl-able) and fixed the layout from first paint, so nothing here changes
// layout: the scene only fades in over the posters, and the posters come back if it is lost or fails.
const loaderBar = $('#loaderBar');
function progress(p) { if (loaderBar) loaderBar.style.transform = `scaleX(${Math.max(0.04, Math.min(1, p)).toFixed(3)})`; }
async function importScene() {
  try { return await import('./scene.js'); }
  catch (e) {
    await new Promise((r) => setTimeout(r, 450));
    return import('./scene.js?r=1');
  }
}
// the head script warms WebGL up in a worker; wait for it (at most 4 s) before creating the page's own context
function glWarm() {
  return new Promise((res) => {
    if (root.getAttribute('data-gl')) { res(root.getAttribute('data-gl') === 'warm'); return; }
    const t = setTimeout(() => res(true), 4000); // no answer: try anyway (initScene creates the context silently and gives up if it fails)
    root.addEventListener('glwarm', () => { clearTimeout(t); res(root.getAttribute('data-gl') === 'warm'); }, { once: true });
  });
}
async function bootScene() {
  if (!root.classList.contains('gl-able')) return;
  root.classList.add('is-loading');
  try {
    if (!(await glWarm())) { root.classList.add('is-loaded'); return; } // no usable WebGL2: the posters stay
    const m = await importScene();
    const c = await m.initScene($('#stage'), {
      reduce,
      journey: $('#journey'),
      onProgress: progress,
      onFirstFrame: () => { root.classList.add('is-3d'); },
      onDone: () => { root.classList.add('is-loaded'); },
      onLost: () => { root.classList.remove('is-3d'); },
      onRestored: () => { root.classList.add('is-3d'); onScroll(); },
    });
    if (!c) { root.classList.add('is-loaded'); return; }
    ctl = c;
    ctl.setPaused(motionOff);
    onScroll();
  } catch (e) {
    root.classList.remove('is-3d');
    root.classList.add('is-loaded'); // the designed posters stay
  }
}
window.addEventListener('load', () => {
  measure(); onScroll();
  if (hasGsap) ScrollTrigger.refresh();
  // reduced motion: nothing animates, so ScrollTrigger's background rAF loop and the GSAP ticker are switched off
  // (the plain scroll and resize listeners above keep the scene and the nav in step)
  if (reduce && hasGsap) { ScrollTrigger.disable(false); gsap.ticker.sleep(); }
});
onScroll();
bootScene();
