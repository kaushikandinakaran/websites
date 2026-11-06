// Nova Labs - sample design. Motion + interaction.
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
const NAV_H = 72;

/* ---------- Smooth scroll (Lenis) ---------- */
let lenis = null;
if (!reduce && typeof window.Lenis !== 'undefined') {
  lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
} else if (hasGsap) {
  gsap.registerPlugin(ScrollTrigger);
}

/* ---------- Navbar ---------- */
const nav = $('#nav');
const toggle = $('#navToggle');
const menu = $('#navMenu');
const mobileMq = window.matchMedia('(max-width: 860px)');

const heroEl = document.getElementById('hero');
const onScrollNav = () => {
  nav.classList.toggle('is-scrolled', window.scrollY > 24);
  nav.classList.toggle('is-past-hero', window.scrollY > heroEl.offsetHeight - NAV_H);
};
window.addEventListener('scroll', onScrollNav, { passive: true });
onScrollNav();

function setMenu(open, returnFocus) {
  menu.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  document.documentElement.style.overflow = open ? 'hidden' : '';
  if (lenis) open ? lenis.stop() : lenis.start();
  if (!open && returnFocus) toggle.focus();
}
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', (e) => {
  if (!menu.classList.contains('is-open')) return;
  if (e.key === 'Escape') { setMenu(false, true); return; }
  if (e.key === 'Tab') { // keep focus inside the open menu
    const f = [toggle, ...$$('a', menu)];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
mobileMq.addEventListener('change', (e) => { if (!e.matches) setMenu(false); });
// Menu is hidden with visibility when closed on mobile, so it is out of the tab order.

/* ---------- Anchor links ---------- */
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) setMenu(false);
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { offset: -NAV_H + 1, duration: 1.2 });
    else window.scrollTo({ top: id === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY - NAV_H + 1, behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', id);
    if (target !== document.body) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
  });
});

/* ---------- Word split (keeps the heading readable for screen readers) ---------- */
function splitWords(el) {
  const label = el.textContent.replace(/\s+/g, ' ').trim();
  el.setAttribute('aria-label', label);
  const walk = (node, grad) => {
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          const i = document.createElement('span'); i.className = 'wi' + (grad ? ' grad' : '');
          i.textContent = part; w.appendChild(i); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) {
        const isGrad = n.classList.contains('grad');
        if (isGrad) n.classList.remove('grad');
        walk(n, grad || isGrad);
      }
    });
  };
  walk(el, false);
  return $$('.wi', el);
}

/* ---------- Pause motion control (WCAG 2.2.2) ---------- */
let motionOff = false;
let marqueeLoop = null;
const motionBtn = $('#motionBtn');
function setMotion(off) {
  motionOff = off;
  document.documentElement.classList.toggle('motion-off', off);
  motionBtn.setAttribute('aria-pressed', String(off));
  motionBtn.querySelector('.motion-btn__text').textContent = off ? 'Play motion' : 'Pause motion';
  motionBtn.setAttribute('aria-label', off ? 'Play motion' : 'Pause motion');
  if (heroCtl) heroCtl.setPaused(off);
  if (marqueeLoop) marqueeLoop.paused(off);
}
if (reduce) motionBtn.hidden = true; // everything already stops under reduced motion
else motionBtn.addEventListener('click', () => setMotion(!motionOff));

/* ---------- Hero 3D (progressive enhancement) ---------- */
const hero = $('#hero');
const canvas = $('#heroCanvas');
let heroCtl = null;
import('./hero3d.js')
  .then((m) => m.initHero(hero, canvas, { reduce }))
  .then((ctl) => { if (ctl) { heroCtl = ctl; hero.classList.add('is-3d'); heroCtl.setPaused(motionOff); } })
  .catch(() => { /* gradient fallback stays visible */ });

/* ---------- Card spotlight + 3D tilt ---------- */
$$('.card').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.style.setProperty('--mx', px * 100 + '%');
    card.style.setProperty('--my', py * 100 + '%');
    if (finePointer && !reduce) {
      card.style.transform = `perspective(900px) rotateX(${((0.5 - py) * 7).toFixed(2)}deg) rotateY(${((px - 0.5) * 8).toFixed(2)}deg)`;
    }
  });
  card.addEventListener('pointerleave', () => { card.style.transform = ''; });
});

const ctaSection = $('#start');
new IntersectionObserver((e) => ctaSection.classList.toggle('is-idle', !e[0].isIntersecting)).observe(ctaSection);
const cta = $('#ctaPanel');
cta.addEventListener('pointermove', (e) => {
  const r = cta.getBoundingClientRect();
  cta.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
  cta.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
});

/* ---------- GSAP motion ---------- */
if (hasGsap && !reduce) {
  document.documentElement.classList.add('js-motion');

  // Hero intro
  const heroWords = splitWords($('.hero__title'));
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.from(nav, { y: -24, opacity: 0, duration: 0.8 }, 0)
    .from(heroWords, { yPercent: 115, duration: 1.1, stagger: 0.055, ease: 'power4.out' }, 0.15)
    .from($$('[data-hero]'), { y: 24, opacity: 0, duration: 0.9, stagger: 0.12 }, 0.3);

  // Hero content drifts away on scroll
  gsap.to('.hero__content', { yPercent: -10, opacity: 0.25, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

  // Section titles: masked word reveal
  $$('.section__title').forEach((h) => {
    const words = splitWords(h);
    gsap.from(words, { yPercent: 115, duration: 1, stagger: 0.04, ease: 'power4.out', scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
  });

  // Simple reveals
  $$('[data-reveal]').forEach((el) => {
    gsap.from(el, { y: 28, opacity: 0, duration: 0.9, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  $$('[data-stagger]').forEach((wrap) => {
    gsap.from(wrap.children, { y: 48, opacity: 0, duration: 0.9, stagger: 0.09, ease: 'power3.out', clearProps: 'transform,opacity', onComplete() { Array.from(wrap.children).forEach((c) => c.classList.add('is-revealed')); }, scrollTrigger: { trigger: wrap, start: 'top 85%', once: true } });
  });

  // Marquee: loops forever, speeds up with scroll velocity
  const track = $('#marqueeTrack');
  const loop = gsap.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
  marqueeLoop = loop;
  if (motionOff) loop.paused(true);
  ScrollTrigger.create({
    trigger: '.marquee', start: 'top bottom', end: 'bottom top',
    onUpdate: (self) => {
      const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 260, 5);
      gsap.to(loop, { timeScale: self.direction * boost, duration: 0.25, overwrite: true });
      gsap.to(loop, { timeScale: self.direction, duration: 1.2, delay: 0.25, overwrite: false });
    },
  });

  // Process: scrubbed rail + active step
  const process = $('#process');
  process.classList.add('is-enhanced');
  gsap.fromTo('#processFill', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.process__list', start: 'top 60%', end: 'bottom 60%', scrub: true } });
  $$('.step').forEach((step) => {
    ScrollTrigger.create({ trigger: step, start: 'top 62%', end: 'bottom 62%', toggleClass: { targets: step, className: 'is-active' } });
  });

  // Work art parallax
  $$('[data-parallax]').forEach((el) => {
    gsap.fromTo(el, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // CTA headline rises in
  gsap.from('.cta__panel > :not(.cta__glow):not(.cta__bg):not(.cta__ring)', { y: 36, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: '.cta__panel', start: 'top 80%', once: true } });

  window.addEventListener('load', () => ScrollTrigger.refresh());
}
