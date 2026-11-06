/* Northline Studio — sample design by Website Studio
   Menu, Lenis smooth scroll, GSAP ScrollTrigger (word reveals, pinned plan, scrubbed statement),
   static isometric fallback for the 3D model. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var lenis = null;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* Shared massing volumes: used by the Three.js scene (scene.js) and the SVG fallback below.
     cx, cz = centre on the ground plane; y = base height; w (x), d (z), h = size. */
  window.NL_VOLUMES = [
    { cx: -1.6, cz: -1.2, w: 2.2, d: 2.2, h: 3.4, y: 0 },
    { cx: 0.9,  cz: 0.9,  w: 3.4, d: 1.9, h: 1.4, y: 0 },
    { cx: 1.6,  cz: -1.7, w: 1.4, d: 1.4, h: 4.8, y: 0 },
    { cx: 0.3,  cz: -0.6, w: 3.6, d: 1.1, h: 0.5, y: 3.0, accent: true },
    { cx: -2.2, cz: 1.9,  w: 1.5, d: 1.5, h: 0.7, y: 0 }
  ];

  /* ---------- static isometric fallback (also the first paint) ---------- */
  function buildFallback() {
    var svg = $('#heroFallback');
    if (!svg) return;
    var k = 50, NS = 'http://www.w3.org/2000/svg';
    function P(x, y, z) { return [((x - z) * 0.866 * k).toFixed(1), (((x + z) * 0.5 * k) - y * k - 20).toFixed(1)]; }
    function poly(pts, cls, parent) {
      var p = document.createElementNS(NS, 'polygon');
      p.setAttribute('points', pts.map(function (q) { return q.join(','); }).join(' '));
      p.setAttribute('class', cls);
      parent.appendChild(p);
    }
    var list = window.NL_VOLUMES.slice().sort(function (a, b) { return (a.cx + a.cz + a.y) - (b.cx + b.cz + b.y); });
    // ground square
    var g0 = document.createElementNS(NS, 'g');
    var s = 4;
    var ground = document.createElementNS(NS, 'polygon');
    ground.setAttribute('points', [P(-s, 0, -s), P(s, 0, -s), P(s, 0, s), P(-s, 0, s)].map(function (q) { return q.join(','); }).join(' '));
    ground.setAttribute('fill', 'none');
    ground.setAttribute('stroke', 'rgba(18,18,18,0.35)');
    ground.setAttribute('stroke-width', '1');
    g0.appendChild(ground);
    svg.appendChild(g0);
    list.forEach(function (v) {
      var g = document.createElementNS(NS, 'g');
      if (v.accent) g.setAttribute('class', 'iso-acc');
      var x0 = v.cx - v.w / 2, x1 = v.cx + v.w / 2, z0 = v.cz - v.d / 2, z1 = v.cz + v.d / 2, y0 = v.y, y1 = v.y + v.h;
      poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], 'iso-l', g);
      poly([P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)], 'iso-r', g);
      poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], 'iso-top', g);
      svg.appendChild(g);
    });
  }

  /* ---------- word splitting ---------- */
  function splitWords(el) {
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            w.className = 'word';
            var i = document.createElement('span');
            i.className = 'word__in';
            i.textContent = part;
            w.appendChild(i);
            frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    }
    walk(el);
    return $$('.word__in', el);
  }

  /* ---------- mobile menu ---------- */
  function initMenu() {
    var toggle = $('.nav__toggle');
    var menu = $('#menu');
    if (!toggle || !menu) return;
    var open = false;
    var lastFocus = null;

    function setOpen(v) {
      open = v;
      menu.classList.toggle('is-open', v);
      menu.setAttribute('aria-hidden', v ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', v ? 'true' : 'false');
      document.body.style.overflow = v ? 'hidden' : '';
      if (lenis) { v ? lenis.stop() : lenis.start(); }
      if (v) {
        lastFocus = document.activeElement;
        var first = $('a', menu);
        setTimeout(function () { if (first) first.focus(); }, 50);
      } else if (lastFocus && toggle) {
        toggle.focus();
      }
    }
    // the header must stay above the menu so the toggle remains reachable
    toggle.addEventListener('click', function () { setOpen(!open); });
    document.addEventListener('keydown', function (e) {
      if (!open) return;
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'Tab') {
        var f = [toggle].concat($$('a', menu));
        var idx = f.indexOf(document.activeElement);
        if (e.shiftKey && idx <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && idx === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    window.addEventListener('resize', function () { if (open && window.innerWidth >= 900) setOpen(false); });
  }

  function initHeader() {
    var nav = $('.nav');
    function onScroll() { nav.classList.toggle('is-scrolled', window.scrollY > 8); }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- active project in the sticky list (works without motion too) ---------- */
  function initProjectList() {
    var links = $$('#plist a');
    var cards = $$('.proj');
    if (!links.length || !('IntersectionObserver' in window)) return;
    function set(i) {
      links.forEach(function (a, n) {
        a.classList.toggle('is-active', n === i);
        if (n === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) set(cards.indexOf(e.target));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    cards.forEach(function (c) { io.observe(c); });
  }

  /* ---------- anchors (scroll, then move keyboard focus to the target) ---------- */
  function navH() { return parseInt(getComputedStyle(root).getPropertyValue('--nav-h'), 10) || 64; }
  function initAnchors() {
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var isTop = id === '#top';
        var t = isTop ? $('#main') : $(id);
        if (!t) return;
        e.preventDefault();
        var off = (isTop || id === '#process') ? 0 : -navH();
        if (lenis) {
          lenis.scrollTo(isTop ? 0 : t, { offset: isTop ? 0 : off, duration: 1.4 });
        } else {
          var y = isTop ? 0 : t.getBoundingClientRect().top + window.scrollY + off;
          window.scrollTo({ top: y, behavior: 'auto' });
        }
        if (history.replaceState) history.replaceState(null, '', id);
        if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
        t.focus({ preventScroll: true });
      });
    });
  }

  /* ---------- pause-motion toggle (WCAG 2.2.2) ---------- */
  function initMotionToggle() {
    var btn = $('#motionBtn');
    if (!btn) return;
    if (reduce) { btn.hidden = true; return; }
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      root.classList.toggle('motion-off', on);
      window.dispatchEvent(new CustomEvent('nl:motion', { detail: { paused: on } }));
    });
  }

  /* ---------- motion ---------- */
  function initMotion() {
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('js-motion');

    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);

    /* hero intro */
    var heroWords = splitWords($('.hero__title'));
    gsap.set('.hero__title', { visibility: 'visible' });
    var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    gsap.set(heroWords, { yPercent: 115 });
    gsap.set('[data-hero-fade]', { y: 24, opacity: 0 });
    gsap.set('.hero__fig', { opacity: 0 });
    gsap.set('.hero__top', { opacity: 0 });
    tl.to('.hero__top', { opacity: 1, duration: 0.8 }, 0.05)
      .to(heroWords, { yPercent: 0, duration: 1.25, stagger: 0.09 }, 0.1)
      .to('.hero__fig', { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0.25)
      .to('[data-hero-fade]', { y: 0, opacity: 1, duration: 0.9, stagger: 0.12 }, 0.75)
      .fromTo('.hero__line', { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'power3.inOut' }, 1);

    /* pinned, scroll-drawn plan: created before every trigger below it so their positions include the pin spacer */
    initPlan();

    /* scrubbed statement: words fade up as you scroll */
    var st = $('#statement');
    if (st) {
      var sw = splitWords(st);
      sw.forEach(function (w) { w.parentNode.classList.add('w'); });
      gsap.set(sw, { opacity: 0.6 });
      gsap.to(sw, {
        opacity: 1, ease: 'none', stagger: 0.12,
        scrollTrigger: { trigger: st, start: 'top 82%', end: 'bottom 52%', scrub: 0.6 }
      });
    }

    /* word-reveal headings */
    $$('.h2[data-split], .cta__title[data-split]').forEach(function (h) {
      var words = splitWords(h);
      gsap.set(words, { yPercent: 115 });
      gsap.to(words, {
        yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.06,
        scrollTrigger: { trigger: h, start: 'top 88%', once: true }
      });
    });

    /* fade-up rows */
    gsap.set('[data-reveal]', { y: 36, opacity: 0 });
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 92%', once: true,
      onEnter: function (els) { gsap.to(els, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.1 }); }
    });

    /* project cards: clip reveal + inner parallax */
    $$('.proj').forEach(function (card) {
      var art = $('.proj__art', card);
      var svg = $('svg', art);
      var meta = $('.proj__meta', card);
      gsap.set(art, { clipPath: 'inset(0 0 100% 0)' });
      gsap.set(meta, { y: 24, opacity: 0 });
      gsap.to(art, {
        clipPath: 'inset(0 0 0% 0)', duration: 1.3, ease: 'power4.inOut',
        scrollTrigger: { trigger: card, start: 'top 82%', once: true }
      });
      gsap.to(meta, {
        y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', delay: 0.25,
        scrollTrigger: { trigger: card, start: 'top 82%', once: true }
      });
      gsap.fromTo(svg, { scale: 1.18 }, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    /* footer wordmark rises */
    gsap.from('.footer__word span', {
      yPercent: 40, opacity: 0, duration: 1.4, ease: 'power4.out',
      scrollTrigger: { trigger: '.footer__word', start: 'top 95%', once: true }
    });

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }

  function initPlan() {
    var sec = $('#process');
    var pin = $('.process__pin', sec);
    var steps = $$('#steps .step');
    var bar = $('#processBar');
    var svg = $('#planSvg');
    if (!sec || !svg) return;

    // Pin only when the viewport is tall enough for the whole panel; otherwise the plan stays fully drawn.
    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px) and (min-height: 740px), (max-width: 899px) and (min-height: 680px)', function () {
      sec.classList.add('is-pinned');

      var draws = {
        site: $$('.g-site .draw', svg),
        wall: $$('.g-wall .draw', svg),
        open: $$('.g-open .draw', svg)
      };
      var fades = {
        site: $$('.g-site .fade', svg),
        room: $$('.g-room .fade', svg),
        open: $$('.g-open .fade', svg)
      };
      // stage 1 (the site) is fully drawn at 0% so the frame is never empty
      ['wall', 'open'].forEach(function (k) {
        gsap.set(draws[k], { strokeDasharray: '1 1', strokeDashoffset: 1 });
      });
      gsap.set([].concat(fades.room, fades.open), { opacity: 0 });

      var tl = gsap.timeline({ defaults: { ease: 'none' } });
      // 4 phases, each 1 unit long
      tl.to({}, { duration: 0.9 }, 0) // stage 1: the site is already on the sheet
        .to(draws.wall, { strokeDashoffset: 0, duration: 0.7, stagger: 0.07 }, 1)
        .to(fades.room.filter(function (n) { return n.tagName.toLowerCase() === 'rect'; }), { opacity: 1, duration: 0.4, stagger: 0.08 }, 2)
        .to(fades.room.filter(function (n) { return n.tagName.toLowerCase() === 'text'; }), { opacity: 1, duration: 0.4, stagger: 0.08 }, 2.3)
        .to(draws.open, { strokeDashoffset: 0, duration: 0.7, stagger: 0.1 }, 3)
        .to(fades.open, { opacity: 1, duration: 0.3 }, 3.7)
        .to({}, { duration: 0.25 }, 4); // hold at the end

      var active = -1;
      function setStep(i) {
        if (i === active) return;
        active = i;
        steps.forEach(function (s, n) { s.classList.toggle('is-active', n === i); });
      }

      ScrollTrigger.create({
        trigger: sec,
        start: function () { return 'top top+=' + navH(); },
        end: function () { return '+=' + Math.round(window.innerHeight * 3.2); },
        pin: pin,
        scrub: 0.6,
        animation: tl,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          var p = self.progress;
          setStep(Math.min(3, Math.floor(p * 4.25)));
          if (bar) bar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
        }
      });

      return function () {
        // media query no longer matches: show the finished plan, no pin
        sec.classList.remove('is-pinned');
        steps.forEach(function (s) { s.classList.remove('is-active'); });
        if (bar) bar.style.transform = '';
      };
    });
  }

  /* ---------- boot ---------- */
  buildFallback();
  initMenu();
  initHeader();
  initProjectList();
  initMotionToggle();

  if (reduce || !hasGsap) {
    root.classList.add('no-motion');
    root.classList.remove('js-pre');
    initAnchors();
    return;
  }
  try {
    initMotion();
  } catch (err) {
    // If motion fails for any reason, fall back to the plain, fully visible page.
    root.classList.remove('js-motion', 'js-pre');
    root.classList.add('no-motion');
    $$('.hero__title').forEach(function (h) { h.style.visibility = 'visible'; });
    if (window.console) console.warn('Motion disabled:', err && err.message);
  }
  initAnchors();
})();
