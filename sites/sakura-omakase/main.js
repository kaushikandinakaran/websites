/* Sakura Omakase - page behaviour: smooth scroll, menu, focus, reveals, motion toggle,
   and the scroll -> camera mapping. The 3D scene (scene.js) is imported lazily:
   everything here works if Three.js or WebGL is missing. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // GSAP / ScrollTrigger are not even downloaded under reduced motion (ScrollTrigger keeps its own rAF loop alive).
  // Otherwise they are injected after start-up and attached when ready (attachGsap); until then Lenis runs on its own rAF.
  let hasGsap = false;
  const mobileMq = window.matchMedia('(max-width: 1100px)');

  const nav = $('#nav');
  const toggle = $('#navToggle');
  const menu = $('#navMenu');
  const motionBtn = $('#motionBtn');
  const mainEl = $('#main');
  const footerEl = $('.footer');
  const sections = $$('[data-station]');
  const railItems = $$('#rail li');
  const navLinks = $$('.nav__links a');

  /* ---------- Smooth scroll (Lenis). Fully torn down while motion is paused. ---------- */
  let lenis = null, lenisTick = null, lenisRaf = 0;
  let motionOff = false;
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
    if (menu.classList.contains('is-open')) lenis.stop(); // resumed under an open menu: the page behind stays put
  }
  function stopLenis() {
    if (!lenis) return;
    if (lenisTick) { gsap.ticker.remove(lenisTick); lenisTick = null; }
    if (lenisRaf) { cancelAnimationFrame(lenisRaf); lenisRaf = 0; }
    lenis.destroy();
    lenis = null;
  }
  startLenis();

  /* ---------- Mobile menu: toggle, Escape, focus trap ---------- */
  function setMenu(open, returnFocus) {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    root.style.overflow = open ? 'hidden' : '';
    mainEl.inert = open && mobileMq.matches;
    footerEl.inert = open && mobileMq.matches;
    if (lenis) (open ? lenis.stop() : lenis.start());
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
  mobileMq.addEventListener('change', (e) => { if (!e.matches) setMenu(false); });

  /* ---------- Anchors: scroll, then really move focus ---------- */
  const vh = () => window.innerHeight;
  function scrollTargetFor(el) {
    if (el === mainEl || el === document.body) return 0;
    const panel = $('.panel', el);
    if (panel) {
      const r = panel.getBoundingClientRect();
      const y = r.top + window.scrollY + r.height / 2 - (vh() - 64) / 2 - 8;
      return Math.max(0, y);
    }
    return el.getBoundingClientRect().top + window.scrollY;
  }
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? $('#arrival') : $(id);
      if (!target) return;
      e.preventDefault();
      if (menu.classList.contains('is-open')) setMenu(false);
      const y = id === '#top' ? 0 : scrollTargetFor(target);
      if (lenis) lenis.scrollTo(y, { duration: id === '#main' ? 0.6 : 1.8, force: true });
      else window.scrollTo({ top: y, behavior: (reduce || motionOff) ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
      target.focus({ preventScroll: true });
    });
  });

  /* ---------- Reveal on view (no dependency on 3D) ---------- */
  const revealEls = $$('[data-rv]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Scroll -> station coordinate u (0..4) ---------- */
  let anchors = [], holds = [], uTarget = 0, ctl = null, activeStation = -1;
  function measure() {
    anchors = sections.map((s) => {
      const p = $('.panel', s) || s;
      const r = p.getBoundingClientRect();
      return { c: r.top + window.scrollY + r.height / 2, h: r.height / 2 };
    });
    holds = anchors.map((a, i) => {
      const prev = anchors[i - 1], next = anchors[i + 1];
      const gap = Math.min(prev ? a.c - prev.c : 1e9, next ? next.c - a.c : 1e9);
      return Math.max(vh() * 0.12, Math.min(a.h + vh() * 0.05, gap * 0.38));
    });
  }
  const sstep = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
  function uFromScroll(y) {
    const s = y + vh() / 2;
    const n = anchors.length;
    if (!n) return 0;
    if (s <= anchors[0].c) return 0;
    for (let i = 0; i < n - 1; i++) {
      if (s < anchors[i + 1].c) {
        const a = anchors[i].c + holds[i], b = anchors[i + 1].c - holds[i + 1];
        return i + sstep((s - a) / Math.max(1, b - a));
      }
    }
    return n - 1;
  }
  const scrollY = () => window.scrollY;
  function onScroll() {
    uTarget = uFromScroll(scrollY());
    if (ctl) ctl.setU(uTarget);
    const st = Math.round(uTarget);
    if (st !== activeStation) {
      activeStation = st;
      railItems.forEach((li, i) => li.classList.toggle('is-active', i === st));
      navLinks.forEach((a) => {
        const on = a.getAttribute('href') === '#' + (sections[st] && sections[st].id);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    }
  }
  measure();
  // A plain scroll listener drives the camera, so it keeps working when the GSAP ticker sleeps.
  window.addEventListener('scroll', onScroll, { passive: true });
  let rzT = 0;
  window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { measure(); onScroll(); }, 120); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { clearTimeout(rzT); rzT = setTimeout(() => { measure(); onScroll(); }, 120); }).observe(mainEl);
  onScroll();

  /* ---------- Pause motion (WCAG 2.2.2): constant label, aria-pressed carries state ---------- */
  function setMotion(off) {
    motionOff = off;
    root.classList.toggle('motion-off', off);
    motionBtn.setAttribute('aria-pressed', String(off));
    if (ctl) ctl.setPaused(off);
    // Stop every ticker we own: Lenis smoothing and the shared GSAP ticker. Scrolling stays native.
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

  /* ---------- Menu rows light the matching piece in 3D (mouse only, decorative) ---------- */
  if (finePointer) {
    $$('[data-piece]').forEach((li) => {
      const i = Number(li.dataset.piece);
      li.addEventListener('pointerenter', () => { li.classList.add('is-lit'); if (ctl) ctl.highlight(i); });
      li.addEventListener('pointerleave', () => { li.classList.remove('is-lit'); if (ctl) ctl.highlight(-1); });
    });
  }

  /* ---------- 3D scene (progressive enhancement) ---------- */
  // Failing late keeps the tall layout (no jump under the reader): only the posters take over.
  function fail() { root.classList.add('fell-back'); root.classList.remove('is-3d'); }
  if (!root.classList.contains('no-3d')) {
    import('./scene.js')
      .then((m) => m.initScene({ canvas: $('#stage'), reduce, motionOff, watch: mainEl }))
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

  /* ---------- GSAP + ScrollTrigger: loaded on demand, never under reduced motion ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = rej; document.head.appendChild(el); });
  }
  function attachGsap() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') return;
    hasGsap = true;
    gsap.registerPlugin(ScrollTrigger);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.create({ trigger: mainEl, start: 'top top', end: 'bottom bottom', onRefresh: () => { measure(); onScroll(); } });
    if (motionOff) { gsap.ticker.sleep(); ScrollTrigger.disable(false); return; }
    if (lenis) { stopLenis(); startLenis(); } // move Lenis from its own rAF onto the shared GSAP ticker
    ScrollTrigger.refresh();
  }
  if (!reduce) {
    loadScript('../../vendor/gsap.min.js').then(() => loadScript('../../vendor/ScrollTrigger.min.js')).then(attachGsap).catch(() => {});
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); if (hasGsap) ScrollTrigger.refresh(); onScroll(); });
  window.addEventListener('load', () => { measure(); if (hasGsap) ScrollTrigger.refresh(); onScroll(); });
})();
