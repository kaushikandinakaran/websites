// Saffron Court - sample design. Page behaviour: smooth scroll, menu, focus, reveals, and the lazy 3D scene.
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const root = document.documentElement;
  const NAV_H = 72;

  /* ---------- 3D modules: fetched first thing (the scene itself starts after load) ---------- */
  const cores = navigator.hardwareConcurrency || 8, mem = navigator.deviceMemory || 8;
  const mobile = window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches;
  const low = cores <= 4 || mem <= 4;
  // The WebGL probe IS the scene's context (creating a context is slow, so it happens only once).
  // Without bloom (phones, low-end) the context itself antialiases.
  function webglContext(canvas) {
    const attrs = { alpha: false, depth: true, stencil: false, antialias: mobile || low, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    try { return canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs) || null; } catch (_) { return null; }
  }

  // Modules load one after another; each failed request is retried (then with a cache-busting query)
  // before the page settles for the posters.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function imp(path) {
    for (let i = 0; ; i++) {
      try { return await import(i < 2 ? path : `${path}?r=${i}`); }
      catch (e) { if (i >= 3) throw e; await wait(250 + i * 400); }
    }
  }
  // Start fetching the modules right away (they do not block the page); the context and scene wait for load.
  const modules = 'WebGLRenderingContext' in window
    ? (async () => {
      await imp('three'); await imp('./art.js');
      const m = await imp('./scene.js');
      m.preload(!mobile && !low); // the add-ons download while the page settles
      return m;
    })()
    : Promise.reject(new Error('no WebGL'));
  modules.catch(() => { /* handled in initScene */ });

  /* ---------- Smooth scroll (Lenis) + ScrollTrigger ----------
     Reduced motion: neither GSAP nor ScrollTrigger is started (native scroll, still frames).
     Pause motion: Lenis is torn down, the GSAP ticker sleeps and ScrollTrigger is disabled, so no
     animation frame runs at all; resuming restores all three. A plain scroll listener drives the scene. */
  const useGsap = hasGsap && !reduce;
  let lenis = null, lenisTick = null, lenisRaf = 0;
  if (useGsap) { gsap.registerPlugin(ScrollTrigger); gsap.ticker.lagSmoothing(0); }
  else if (hasGsap) { try { ScrollTrigger.disable(false); gsap.ticker.sleep(); } catch (_) { /* not started */ } }
  function startLenis() {
    if (reduce || lenis || typeof window.Lenis === 'undefined') return;
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    if (useGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      lenisTick = (t) => lenis.raf(t * 1000);
      gsap.ticker.add(lenisTick);
      const m = document.getElementById('navMenu');
      if (m && m.classList.contains('is-open')) lenis.stop(); // resumed while the mobile menu is open
    } else {
      const raf = (t) => { lenis.raf(t); lenisRaf = requestAnimationFrame(raf); };
      lenisRaf = requestAnimationFrame(raf);
    }
  }
  function stopLenis() {
    if (!lenis) return;
    if (lenisTick) { gsap.ticker.remove(lenisTick); lenisTick = null; }
    if (lenisRaf) { cancelAnimationFrame(lenisRaf); lenisRaf = 0; }
    lenis.destroy(); lenis = null;
  }
  startLenis();

  /* ---------- Navbar + mobile menu (focus trap) ---------- */
  const nav = $('#nav'), toggle = $('#navToggle'), menu = $('#navMenu');
  const mobileMq = window.matchMedia('(max-width: 1040px)');
  const onScrollNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  function setMenu(open, returnFocus) {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    root.style.overflow = open ? 'hidden' : '';
    [$('#main'), $('.footer')].forEach((el) => { if (el) el.inert = open; });
    if (lenis) (open ? lenis.stop() : lenis.start());
    if (!open && returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (!menu.classList.contains('is-open')) return;
    if (e.key === 'Escape') { setMenu(false, true); return; }
    if (e.key === 'Tab') {
      // cycle through everything focusable in the header (brand, pause, toggle, menu links)
      const f = $$('a[href], button', nav).filter((x) => !x.hidden && !x.disabled && x.getClientRects().length > 0);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  mobileMq.addEventListener('change', (e) => { if (!e.matches) setMenu(false); });

  /* ---------- In-page links: scroll, then really move focus ---------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const isTop = id === '#top';
      const target = isTop ? document.body : $(id);
      if (!target) return;
      e.preventDefault();
      const wasOpen = menu.classList.contains('is-open');
      if (wasOpen) setMenu(false);
      const offset = id === '#booking' ? -(NAV_H + 24) : 0;
      if (lenis) lenis.scrollTo(isTop ? 0 : target, { offset, duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 3) });
      else window.scrollTo({ top: isTop ? 0 : target.getBoundingClientRect().top + window.scrollY + offset, behavior: reduce ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
      if (!isTop) { if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    });
  });

  /* ---------- Reveals (transform only; text is never transparent) ---------- */
  {
    const targets = $$('.reveal, .display, .title');
    const mark = (el) => el.classList.add('is-in');
    if ('IntersectionObserver' in window && !reduce) {
      const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { mark(en.target); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
      targets.forEach((el) => io.observe(el));
    } else targets.forEach(mark);
  }

  /* ---------- Pause motion (WCAG 2.2.2) ---------- */
  let ctl = null;
  let motionOff = false;
  const motionBtn = $('#motionBtn');
  function setMotion(off) {
    motionOff = off;
    root.classList.toggle('motion-off', off);
    motionBtn.setAttribute('aria-pressed', String(off));
    if (ctl) ctl.setPaused(off);
    if (off) {
      stopLenis();
      if (useGsap) { gsap.ticker.sleep(); ScrollTrigger.disable(false); } // also ends ScrollTrigger's own frame loop
    } else {
      if (useGsap) { ScrollTrigger.enable(); ScrollTrigger.getAll().forEach((t) => t.enable()); gsap.ticker.wake(); }
      startLenis();
    }
  }
  if (reduce) motionBtn.hidden = true;
  else motionBtn.addEventListener('click', () => setMotion(!motionOff));

  /* ---------- Scroll state: rail, menu steps, scene driver ---------- */
  const stations = [
    { el: $('#gate'), num: '01', name: 'The gate' },
    { el: $('#spice'), num: '02', name: 'The spice orbit' },
    { el: $('#hall'), num: '—', name: 'The market hall' },
    { el: $('#tandoor'), num: '03', name: 'The tandoor' },
    { el: $('#menu'), num: '04', name: 'The thali menu' },
    { el: $('#reserve'), num: '05', name: 'Reserve' },
  ];
  const railNum = $('#railNum'), railName = $('#railName'), railFill = $('#railFill');
  const menuSec = $('#menu');
  const steps = $$('.menu-step', menuSec);
  let lastStation = -1, lastGroup = -2, lastMP = -1;

  function onScroll(y) {
    const vh = window.innerHeight, mid = vh / 2;
    // 1. all layout reads first
    const stRects = stations.map((s) => s.el.getBoundingClientRect());
    const mr = menuSec.getBoundingClientRect();
    const menuActive = mr.top < vh * 0.85 && mr.bottom > vh * 0.15;
    const stepRects = menuActive ? steps.map((el) => el.getBoundingClientRect()) : [];
    const maxY = Math.max(1, document.documentElement.scrollHeight - vh);
    // 2. compute
    let best = 0, bestD = Infinity;
    stRects.forEach((r, i) => { const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid)); if (d < bestD) { bestD = d; best = i; } });
    let group = -1;
    if (menuActive) {
      let bd = Infinity;
      stepRects.forEach((r, i) => { const d = Math.abs((r.top + r.bottom) / 2 - vh * 0.55); if (d < bd) { bd = d; group = parseInt(steps[i].dataset.group, 10); } });
    }
    const mp = Math.min(1, Math.max(0, (y - (mr.top + y - vh * 0.1)) / Math.max(1, mr.height - vh * 0.8)));
    // 3. writes
    if (best !== lastStation) { lastStation = best; railNum.textContent = stations[best].num; railName.textContent = stations[best].name; }
    railFill.style.transform = `scaleX(${Math.min(1, y / maxY).toFixed(3)})`;
    if (group !== lastGroup) { lastGroup = group; steps.forEach((el) => el.classList.toggle('is-active', parseInt(el.dataset.group, 10) === group && group >= 0)); }
    if (ctl) { ctl.setScroll(y); if (group !== ctl._g || Math.abs(mp - lastMP) > 0.002) { ctl._g = group; lastMP = mp; ctl.setMenu(group, mp); } }
  }
  // A plain scroll listener drives rail and scene, so it keeps working while the GSAP ticker sleeps.
  window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
  onScroll(window.scrollY);

  function computeAnchors() {
    const vh = window.innerHeight, list = [];
    $$('[data-station]').forEach((el) => {
      const top = el.getBoundingClientRect().top + window.scrollY, h = el.offsetHeight, s = parseFloat(el.dataset.station);
      if (el.hasAttribute('data-hold')) list.push({ y: top - 0.1 * vh, s }, { y: top + h - 0.9 * vh, s });
      else { const m = top + h / 2 - vh / 2; list.push({ y: m - 0.2 * vh, s }, { y: m + 0.2 * vh, s }); }
    });
    list.sort((a, b) => a.y - b.y);
    for (let i = 1; i < list.length; i++) if (list[i].y <= list[i - 1].y) list[i].y = list[i - 1].y + 1;
    return list;
  }
  let anchorT = 0;
  const syncAnchors = () => { if (ctl) { ctl.setAnchors(computeAnchors()); ctl.setScroll(window.scrollY); } };
  window.addEventListener('resize', () => { clearTimeout(anchorT); anchorT = setTimeout(syncAnchors, 160); });
  window.addEventListener('load', () => { if (useGsap) ScrollTrigger.refresh(); syncAnchors(); });
  if (useGsap) ScrollTrigger.addEventListener('refresh', syncAnchors);

  /* ---------- The 3D scene (progressive enhancement) ---------- */
  async function initScene() {
    const canvas = $('#scene');
    let mod;
    try { mod = await modules; } catch (_) { return; } // posters stay
    // Create the context once the page's first frames are painted and the GPU is free: creating it while the
    // GPU is still rasterising the page makes the call wait (it blocked for 0.6-0.8 s at load).
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0))));
    const context = webglContext(canvas);
    if (!context) return;
    try {
      const c = await mod.createScene({ canvas, context, reduce, mobile, low, observe: $('#main') });
      ctl = c;
      ctl.setAnchors(computeAnchors());
      ctl.setScroll(window.scrollY);
      ctl.setPaused(motionOff);
      if (reduce) ctl.setStill(true);
      ctl.firstFrame();
      root.classList.add('is3d');
      if (!reduce) ctl.start();
      canvas.addEventListener('scene:lost', () => root.classList.remove('is3d'));
      canvas.addEventListener('scene:restored', () => { root.classList.add('is3d'); syncAnchors(); });
      if (useGsap) ScrollTrigger.refresh(); else syncAnchors();
      onScroll(window.scrollY);
    } catch (err) {
      ctl = null; root.classList.remove('is3d'); // posters stay visible; content is unaffected
    }
  }
  const boot = () => requestAnimationFrame(() => setTimeout(initScene, 0));
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot);
})();
