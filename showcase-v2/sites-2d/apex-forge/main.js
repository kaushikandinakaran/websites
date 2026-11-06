// Apex Forge - sample design. Motion + interaction.
// three.js is NOT imported here: scene.js is loaded with a dynamic import() at the bottom,
// so the menu, GSAP and Lenis never wait for it and keep working if it fails.
const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduce) root.classList.add('motion-off');
const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
const NAV_H = 72;
let lenis = null;
let paused = false;               // user "Pause motion" toggle
const pauseHooks = [];            // functions called with (paused)
window.__apexReady = true;

/* ---------- nav: solid on scroll + mobile menu ---------- */
const nav = document.getElementById('nav');
const burger = document.getElementById('burger');
const menu = document.getElementById('menu');
const onScrollNav = () => nav.classList.toggle('is-solid', window.scrollY > 40);
window.addEventListener('scroll', onScrollNav, { passive: true });
onScrollNav();

function setMenu(open, returnFocus) {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  menu.hidden = !open;
  nav.classList.toggle('is-open', open);
  root.style.overflow = open ? 'hidden' : '';
  if (lenis) open ? lenis.stop() : lenis.start();
  if (!open && returnFocus) burger.focus();
}
burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', e => {
  if (burger.getAttribute('aria-expanded') !== 'true') return;
  if (e.key === 'Escape') { setMenu(false, true); return; }
  if (e.key === 'Tab') { // keep focus inside the open menu
    const items = [burger, ...menu.querySelectorAll('a')];
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
window.matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

/* ---------- in-page links (skip link, nav, menu, footer): scroll, then move focus ---------- */
function focusTarget(target) {
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    const wasOpen = burger.getAttribute('aria-expanded') === 'true';
    if (wasOpen) setMenu(false);
    if (reduce) {            // native jump; just make sure focus follows
      if (wasOpen) { e.preventDefault(); target.scrollIntoView(); history.replaceState(null, '', id); }
      focusTarget(target);
      return;
    }
    e.preventDefault();
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { offset: -NAV_H + 1, duration: 1.2 });
    else window.scrollTo({ top: id === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY - NAV_H + 1, behavior: 'smooth' });
    history.replaceState(null, '', id);
    focusTarget(target);
  });
});

/* ---------- Pause motion toggle (WCAG 2.2.2) ---------- */
const pauseBtn = document.getElementById('pause');
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.setAttribute('aria-pressed', String(paused));
  root.classList.toggle('motion-paused', paused);
  pauseHooks.forEach(fn => fn(paused));
});

/* ---------- GSAP + Lenis ---------- */
if (hasGsap && !reduce) {
  gsap.registerPlugin(ScrollTrigger);

  if (typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // hero title: line mask reveal
  gsap.fromTo('.hero__title .line > span', { y: '110%' }, { y: '0%', duration: 1.1, ease: 'power4.out', stagger: 0.12, delay: 0.15 });
  gsap.from('.hero__copy .eyebrow, .hero__lede, .hero__actions', { y: 24, opacity: 0, duration: .9, ease: 'power3.out', stagger: .12, delay: .6 });
  gsap.from('.hero__stage', { scale: .85, opacity: 0, duration: 1.3, ease: 'power3.out', delay: .3 });

  // generic reveals. The raised "Hero" tier uses the CSS `translate` property for its lift,
  // so GSAP's inline `transform` never overrides it.
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: els => gsap.to(els, { opacity: 1, y: 0, duration: .9, ease: 'power3.out', stagger: .1 })
  });

  // SIGNATURE 1: giant type rows slide opposite ways with scroll (frozen by "Pause motion")
  const rows = [...document.querySelectorAll('.giant__row')].map(row => {
    const dir = Number(row.dataset.dir) || -1;
    const from = dir < 0 ? 0 : -35, to = dir < 0 ? -35 : 0;
    gsap.set(row, { xPercent: from });
    return { setX: gsap.quickTo(row, 'xPercent', { duration: .6, ease: 'power2.out' }), kill: () => gsap.killTweensOf(row), from, to };
  });
  const giantST = ScrollTrigger.create({
    trigger: '.giant', start: 'top bottom', end: 'bottom top',
    onUpdate: self => { if (!paused) rows.forEach(r => r.setX(r.from + (r.to - r.from) * self.progress)); }
  });
  pauseHooks.push(p => {
    if (p) rows.forEach(r => r.kill());
    else rows.forEach(r => r.setX(r.from + (r.to - r.from) * giantST.progress));
  });

  // hero parallax out
  gsap.to('.hero__copy', { yPercent: -12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // SIGNATURE 2: sticky method section, phases switch on scroll
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px) and (min-height: 620px)', () => {
    const phases = [...document.querySelectorAll('.phase')];
    const bar = document.querySelector('.method__progress i');
    ScrollTrigger.create({
      trigger: '.method', start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: self => {
        const idx = Math.min(phases.length - 1, Math.floor(self.progress * phases.length));
        phases.forEach((p, i) => p.classList.toggle('is-active', i === idx));
        gsap.set(bar, { scaleX: (idx + 1) / phases.length });
      }
    });
  });

  // SIGNATURE 3: 3D tilt on icon cards (CSS 3D, pointer driven)
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('[data-tilt]').forEach(card => {
      const rx = gsap.quickTo(card, 'rotationX', { duration: .4, ease: 'power2.out' });
      const ry = gsap.quickTo(card, 'rotationY', { duration: .4, ease: 'power2.out' });
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - .5) * 16);
        rx(-((e.clientY - r.top) / r.height - .5) * 16);
      });
      card.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  gsap.from('.footer__word', { yPercent: 30, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.footer__word', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  window.addEventListener('load', () => ScrollTrigger.refresh());
} else {
  root.classList.add('motion-off');
}

/* ---------- hero 3D dumbbell: loaded on demand, page works without it ---------- */
const stage = document.getElementById('stage');
const canvas = document.getElementById('stage-canvas');
import('./scene.js')
  .then(m => m.initScene(stage, canvas, { reduce, paused }))
  .then(ctl => { if (ctl) pauseHooks.push(p => ctl.setPaused(p)); })
  .catch(() => { stage.classList.remove('has-webgl'); /* SVG dumbbell fallback stays */ });
