/* Ember & Table | sample design by Website Studio
   Lenis smooth scroll, GSAP ScrollTrigger (pinned horizontal menu, reveals, marquee),
   Three.js steam hero with CSS fallback. */

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

if (!hasGSAP) root.classList.remove('js'); // content stays visible without GSAP

/* ---------------------------------------------------------
   Smooth scroll (Lenis) wired into GSAP
--------------------------------------------------------- */
let lenis = null;
let motionOff = false;      // set by the "Pause motion" button
let marqueeLoop = null;     // GSAP marquee tween (paused with the button)
if (hasGSAP) {
  gsap.registerPlugin(ScrollTrigger);
  if (!reduced && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
}

/* ---------------------------------------------------------
   Navbar: scrolled state, mobile menu, anchors
--------------------------------------------------------- */
const nav = $('.nav');
const toggle = $('.nav__toggle');
const mobile = $('#mobile-menu');
let menuOpen = false;
let closeTimer = 0;

const onScrollNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
window.addEventListener('scroll', onScrollNav, { passive: true });
onScrollNav();

function setMenu(open) {
  if (open === menuOpen) return;
  menuOpen = open;
  clearTimeout(closeTimer);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  if (open) {
    mobile.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => mobile.classList.add('is-open')));
    lenis && lenis.stop();
    document.body.style.overflow = 'hidden';
    const first = $('a', mobile);
    first && setTimeout(() => first.focus({ preventScroll: true }), 60);
  } else {
    mobile.classList.remove('is-open');
    closeTimer = setTimeout(() => { mobile.hidden = true; }, reduced ? 0 : 360);
    lenis && lenis.start();
    document.body.style.overflow = '';
  }
}
toggle.addEventListener('click', () => setMenu(!menuOpen));
$$('a', mobile).forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => {
  if (!menuOpen) return;
  if (e.key === 'Escape') { setMenu(false); toggle.focus(); return; }
  if (e.key === 'Tab') { // keep focus inside the open menu
    const f = [toggle, ...$$('a', mobile)];
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); toggle.focus(); }
  }
});
window.matchMedia('(min-width: 900px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });

// In-page links: smooth scroll with Lenis, then move focus to the target so the
// skip link and menu links really bypass content for keyboard / screen-reader users.
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = id === '#top' ? $('#main') : document.querySelector(id);
    if (!target) return;
    if (lenis) {
      e.preventDefault();
      lenis.scrollTo(id === '#top' ? 0 : target, { offset: 0, duration: 1.4 });
      history.replaceState(null, '', id);
    }
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: !!lenis });
  });
});

/* ---------------------------------------------------------
   Pause motion (WCAG 2.2.2): stops the marquee, steam and idle CSS animation
--------------------------------------------------------- */
const pauseBtn = $('.pause');
if (reduced) {
  pauseBtn.hidden = true; // nothing moves on its own in reduced-motion mode
} else {
  pauseBtn.addEventListener('click', () => {
    motionOff = !motionOff;
    pauseBtn.setAttribute('aria-pressed', String(motionOff));
    root.classList.toggle('motion-off', motionOff);
    if (marqueeLoop) marqueeLoop.paused(motionOff);
    document.dispatchEvent(new CustomEvent('motion-toggle'));
  });
}

/* ---------------------------------------------------------
   Magnetic buttons + 3D tilt cards (mouse only)
--------------------------------------------------------- */
if (!reduced && finePointer) {
  $$('.btn--ember').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      b.style.setProperty('--mx', `${(e.clientX - r.left - r.width / 2) * 0.22}px`);
      b.style.setProperty('--my', `${(e.clientY - r.top - r.height / 2) * 0.3}px`);
    });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
  });

  $$('.tilt__inner').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.classList.add('is-active');
      card.style.setProperty('--ry', `${(px - 0.5) * 14}deg`);
      card.style.setProperty('--rx', `${(0.5 - py) * 12}deg`);
      card.style.setProperty('--gx', `${px * 100}%`);
      card.style.setProperty('--gy', `${py * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-active');
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--gy', '0%');
    });
  });
}

/* ---------------------------------------------------------
   Text splitting helper (keeps real spaces so screen readers read words)
--------------------------------------------------------- */
function splitWords(el, wrapClass, innerClass) {
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  el.textContent = '';
  const words = [];
  text.split(' ').forEach((word, i, arr) => {
    const outer = document.createElement('span');
    outer.className = wrapClass;
    const inner = document.createElement('span');
    inner.className = innerClass;
    inner.textContent = word;
    outer.appendChild(inner);
    el.appendChild(outer);
    if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    words.push(inner);
  });
  return words;
}

/* ---------------------------------------------------------
   Motion: hero intro, reveals, story words, marquee, pinned menu
--------------------------------------------------------- */
const hero = $('.hero');

// Pinned horizontal menu (desktop). On phones / reduced motion the track is a swipeable, snap-scrolling strip.
// Created BEFORE the reveal triggers below so everything under the pin is measured with its spacer.
const menu = $('.menu');
const viewport = $('.menu__viewport');
const track = $('.menu__track');
const bar = $('.menu__progress');
const setProgress = (p) => bar.style.setProperty('--p', Math.max(0.04, Math.min(1, p)).toFixed(4));

viewport.addEventListener('scroll', () => {
  if (menu.classList.contains('is-pinned')) { viewport.scrollLeft = 0; return; } // the track moves by transform only
  const max = viewport.scrollWidth - viewport.clientWidth;
  setProgress(max > 0 ? viewport.scrollLeft / max : 0);
}, { passive: true });

if (reduced) $('.marquee').setAttribute('tabindex', '0'); // scrollable region must be keyboard reachable

if (hasGSAP) {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)', () => {
    menu.classList.add('is-pinned');
    viewport.scrollLeft = 0;
    viewport.removeAttribute('tabindex'); // not scrollable while pinned, so not a focus stop
    const dist = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
    const tw = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: menu, start: 'top top', end: () => '+=' + dist(),
        pin: true, scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (s) => setProgress(s.progress),
      },
    });
    const st = tw.scrollTrigger;
    gsap.to('.plate', { rotation: 140, ease: 'none',
      scrollTrigger: { trigger: menu, start: 'top top', end: () => '+=' + dist(), scrub: true, invalidateOnRefresh: true } });

    // Tabbing to a control in an off-screen card: scroll the page to where that card is visible.
    const onFocusIn = (e) => {
      viewport.scrollLeft = 0; // undo the browser's own scroll of the hidden container
      const card = e.target.closest('.course');
      if (!card || !st) return;
      const vr = viewport.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      if (cr.left >= vr.left && cr.right <= vr.right) return; // already visible
      const gutter = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      const x = Math.min(dist(), Math.max(0, card.offsetLeft + card.offsetWidth - viewport.clientWidth + gutter));
      const y = st.start + (dist() ? x / dist() : 0) * (st.end - st.start);
      if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
    };
    track.addEventListener('focusin', onFocusIn);
    return () => {
      track.removeEventListener('focusin', onFocusIn);
      viewport.setAttribute('tabindex', '0');
      menu.classList.remove('is-pinned');
      gsap.set([track, '.plate'], { clearProps: 'transform' });
    };
  });
}

if (hasGSAP && !reduced) {
  // hero intro
  const title = $('[data-split]');
  const words = splitWords(title, 'w', 'wi');
  title.style.visibility = 'visible';
  const tl = gsap.timeline({ delay: 0.15 });
  tl.from(words, { yPercent: 115, duration: 1.2, ease: 'expo.out', stagger: 0.09 })
    .fromTo($$('[data-hero="fade"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.12 }, '-=0.8');

  gsap.to('.hero__inner', {
    yPercent: -10, autoAlpha: 0.15, ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  });

  // generic reveals
  gsap.utils.toArray('.section__head > *, .cta__inner > *, .story__text > *:not(.story__big)').forEach((el) => {
    gsap.from(el, { y: 40, autoAlpha: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%', once: true,
    onEnter: (batch) => gsap.fromTo(batch, { autoAlpha: 0, y: 56 }, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.14, ease: 'power3.out', overwrite: true, clearProps: 'transform' }),
  });

  // story: words light up as you read
  const big = $('[data-words]');
  if (big) {
    const sw = splitWords(big, 'swo', 'sw');
    gsap.to(sw, { opacity: 1, ease: 'none', stagger: 0.12,
      scrollTrigger: { trigger: big, start: 'top 82%', end: 'bottom 52%', scrub: 0.4 } });
  }

  // marquee: GSAP-driven, speeds up and reverses with scroll velocity
  const track = $('.marquee__track');
  track.classList.add('is-js');
  const loop = marqueeLoop = gsap.to(track, { xPercent: -50, ease: 'none', duration: 46, repeat: -1 });
  ScrollTrigger.create({
    trigger: '.marquee', start: 'top bottom', end: 'bottom top',
    onUpdate: (self) => {
      const v = Math.min(Math.abs(self.getVelocity()) / 260, 7);
      if (motionOff) return;
      loop.timeScale((self.direction || 1) * (1 + v));
      gsap.to(loop, { timeScale: 1, duration: 1.4, ease: 'power2.out', overwrite: true });
    },
  });

  // footer wordmark rises into view
  gsap.from('.footer__word', { yPercent: 45, ease: 'none',
    scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
}

window.addEventListener('load', () => hasGSAP && ScrollTrigger.refresh());

/* ---------------------------------------------------------
   Three.js steam hero (falls back to CSS steam if WebGL is unavailable)
--------------------------------------------------------- */
const VERT = /* glsl */`
  attribute vec4 aSeed;            // x: lateral pos (-1..1), y: phase, z: speed, w: size (css px)
  uniform float uTime;
  uniform float uPx;
  uniform float uSpread;
  uniform float uMaxPoint;
  uniform float uGrow;
  uniform float uScale;
  uniform vec2 uMouse;
  varying float vA;
  varying float vLife;
  void main() {
    float life = fract(aSeed.y + uTime * aSeed.z);
    vec3 p;
    float wander = sin(uTime * 0.35 + aSeed.y * 40.0 + life * 5.0) * 0.45 * life
                 + sin(uTime * 0.9 + aSeed.x * 9.0) * 0.08;
    p.x = aSeed.x * uSpread * (0.5 + 0.5 * life) + wander + uMouse.x * 0.7 * life;
    p.y = -3.5 + life * 7.4 + uMouse.y * 0.25 * life;
    p.z = (fract(aSeed.y * 17.0) - 0.5) * 3.2;
    vA = smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.4, 1.0, life));
    vLife = life;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = aSeed.w * uScale * (1.0 + life * uGrow);
    gl_PointSize = min(size * uPx * (6.0 / -mv.z), uMaxPoint);
    gl_Position = projectionMatrix * mv;
  }`;

const FRAG = /* glsl */`
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform float uAlpha;
  uniform float uSoft;
  uniform float uTwinkle;
  uniform float uTime;
  varying float vA;
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = 1.0 - smoothstep(uSoft, 1.0, d);
    a *= a;
    float tw = 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(uTime * 9.0 + vLife * 60.0));
    vec3 col = mix(uColA, uColB, vLife);
    gl_FragColor = vec4(col, a * vA * uAlpha * tw);
  }`;

async function initSteam() {
  const canvas = $('#steam');
  let probe = null;
  try {
    const c = document.createElement('canvas');
    probe = c.getContext('webgl2') || c.getContext('webgl');
  } catch (err) { probe = null; }
  if (!probe) { hero.classList.add('no-webgl'); return; } // no WebGL: CSS steam only, no Three.js download
  let THREE;
  try {
    THREE = await import('three');
  } catch (err) {
    hero.classList.add('no-webgl');
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'default' });
  } catch (err) {
    hero.classList.add('no-webgl');
    return;
  }
  if (!renderer.getContext()) { hero.classList.add('no-webgl'); return; }

  const gl = renderer.getContext();
  const maxPoint = (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) || [1, 64])[1];
  const dpr = Math.min(window.devicePixelRatio || 1, 0.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.debug.onShaderError = (g, prog, vs, fs) => { console.info('steam: shader error', g.getProgramInfoLog(prog)); // shader failed on this GPU: use the CSS steam instead
    running = false;
    hero.classList.add('no-webgl');
    canvas.style.display = 'none';
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
  camera.position.set(0, 0, 6);

  const small = window.innerWidth < 700;
  const mouse = new THREE.Vector2(0, 0);
  const mouseT = new THREE.Vector2(0, 0);

  function layer({ count, size, speed, grow, colA, colB, alpha, soft, twinkle }) {
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const r = Math.random() + Math.random() + Math.random() - 1.5; // soft bell curve
      seeds[i * 4] = Math.max(-1, Math.min(1, r * 0.9));
      seeds[i * 4 + 1] = Math.random();
      seeds[i * 4 + 2] = speed[0] + Math.random() * (speed[1] - speed[0]);
      seeds[i * 4 + 3] = size[0] + Math.random() * (size[1] - size[0]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uPx: { value: dpr }, uSpread: { value: 3 }, uMaxPoint: { value: maxPoint },
        uGrow: { value: grow }, uMouse: { value: mouse },
        uColA: { value: new THREE.Color(...colA) }, uColB: { value: new THREE.Color(...colB) },
        uAlpha: { value: alpha }, uScale: { value: 1 }, uSoft: { value: soft }, uTwinkle: { value: twinkle },
      },
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    return { pts, geo, mat };
  }

  const steam = layer({
    count: small ? 150 : 280,
    size: [120, 240], speed: [0.018, 0.034], grow: 1.8,
    colA: [1.0, 0.52, 0.26], colB: [0.86, 0.8, 0.72], alpha: 0.12, soft: 0.0, twinkle: 0,
  });
  const sparks = layer({
    count: small ? 28 : 64,
    size: [5, 11], speed: [0.05, 0.1], grow: -0.4,
    colA: [1.0, 0.7, 0.35], colB: [1.0, 0.35, 0.1], alpha: 0.95, soft: 0.1, twinkle: 0.6,
  });
  const layers = [steam, sparks];

  function resize() {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfW = Math.tan((camera.fov * Math.PI) / 360) * 6 * camera.aspect;
    layers.forEach((l) => { l.mat.uniforms.uSpread.value = halfW * 1.05; });
    // smaller / dimmer puffs on small or short heroes (phones, 200% zoom) so the text never gets washed out
    steam.mat.uniforms.uScale.value = Math.max(0.4, Math.min(1, Math.min(w, h) / 800));
    steam.mat.uniforms.uAlpha.value = h < 600 ? 0.07 : 0.12;
    if (!running) renderFrame();
  }

  let t = reduced ? 9 : 0;
  function renderFrame() {
    layers.forEach((l) => { l.mat.uniforms.uTime.value = t; });
    renderer.render(scene, camera);
  }

  let running = false;
  let visible = true;
  let last = 0;
  let rafId = 0;
  function tick(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
    last = now;
    t += dt;
    mouse.lerp(mouseT, 0.04);
    renderFrame();
    rafId = requestAnimationFrame(tick);
  }
  function update() {
    const should = visible && !document.hidden && !reduced && !motionOff;
    if (should && !running) { running = true; last = performance.now(); rafId = requestAnimationFrame(tick); }
    else if (!should && running) { running = false; cancelAnimationFrame(rafId); }
  }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }, { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', update);
  document.addEventListener('motion-toggle', update);
  new ResizeObserver(resize).observe(hero);

  if (finePointer && !reduced) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      mouseT.set(((e.clientX - r.left) / r.width - 0.5) * 2, -((e.clientY - r.top) / r.height - 0.5) * 2);
    });
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // lets the browser restore the context
    running = false;
    cancelAnimationFrame(rafId);
    hero.classList.add('no-webgl'); // CSS steam covers the gap
  });
  canvas.addEventListener('webglcontextrestored', () => {
    hero.classList.remove('no-webgl');
    renderFrame();
    update();
  });

  resize();
  renderFrame();
  update();

  if (!reduced) { // gentle fade-in of the scene
    canvas.style.opacity = '0';
    canvas.style.transition = 'opacity 2.4s ease';
    requestAnimationFrame(() => requestAnimationFrame(() => { canvas.style.opacity = '1'; }));
  }
}

initSteam().catch(() => hero.classList.add('no-webgl'));
