/* Green Table: small site-only enhancements (no network, no globals).
   1) Prices, timings and the compact footer hours are rendered from window.SITE so hand-written text can never drift.
   2) Gentle reveal for content below the first screen, started only after core adds html.js-ready.
   3) Cart badge "pop" on add. All motion is skipped under prefers-reduced-motion. */
(function () {
  'use strict';
  var S = window.SITE || {};
  var doc = document;
  var root = doc.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function money(n) {
    try { return new Intl.NumberFormat(S.locale || 'en-US', { style: 'currency', currency: S.currency || 'USD' }).format(n); }
    catch (e) { return '$' + Number(n).toFixed(2); }
  }
  function findItem(id) {
    var cats = Array.isArray(S.menu) ? S.menu : [];
    for (var i = 0; i < cats.length; i++) {
      var items = cats[i].items || [];
      for (var j = 0; j < items.length; j++) if (String(items[j].id) === id) return items[j];
    }
    return null;
  }
  var DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  var DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function fmtClock(hhmm) {
    var p = String(hhmm).split(':');
    var d = new Date(2024, 0, 1, Number(p[0]) || 0, Number(p[1]) || 0);
    try { return new Intl.DateTimeFormat(S.locale || 'en-US', { hour: 'numeric', minute: '2-digit' }).format(d); }
    catch (e) { return hhmm; }
  }
  function dayText(i) {
    var ranges = (S.hours || []).filter(function (h) { return String(h.day || '').slice(0, 3).toLowerCase() === DAY_KEYS[i] && !h.closed && h.open && h.close; });
    if (!ranges.length) return 'Closed';
    return ranges.map(function (h) { return fmtClock(h.open) + ' – ' + fmtClock(h.close); }).join(', ');
  }

  function fill() {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-gt-price]'), function (el) {
      var it = findItem(el.getAttribute('data-gt-price'));
      if (it && typeof it.price === 'number') el.textContent = money(it.price);
    });
    var timing = S.timing || {};
    Array.prototype.forEach.call(doc.querySelectorAll('[data-gt-timing]'), function (el) {
      var k = el.getAttribute('data-gt-timing');
      var v = k === 'delivery' ? timing.deliveryMinutes : timing.pickupMinutes;
      if (v) el.textContent = String(v);
    });
    // compact hours: group consecutive days with identical text
    var box = doc.querySelector('[data-gt-hours]');
    if (box && Array.isArray(S.hours)) {
      var groups = [];
      for (var i = 0; i < 7; i++) {
        var t = dayText(i), last = groups[groups.length - 1];
        if (last && last.text === t) last.end = i; else groups.push({ start: i, end: i, text: t });
      }
      box.innerHTML = '';
      var tag = box.tagName === 'UL' || box.tagName === 'OL' ? 'li' : 'span';
      groups.forEach(function (g) {
        var li = doc.createElement(tag);
        var label = g.start === g.end ? DAY_SHORT[g.start] : DAY_SHORT[g.start] + '–' + DAY_SHORT[g.end];
        li.textContent = label + ' ' + g.text;
        box.appendChild(li);
      });
    }
  }

  function reveal() {
    if (reduce || !('IntersectionObserver' in window)) return;
    var vh = window.innerHeight || 800;
    var els = Array.prototype.filter.call(doc.querySelectorAll('[data-rv]'), function (el) {
      return el.getBoundingClientRect().top > vh * 0.92;
    });
    if (!els.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (el) { el.classList.add('rv'); io.observe(el); });
  }

  function whenReady(fn) {
    if (root.classList.contains('js-ready')) { fn(); return; }
    var mo = new MutationObserver(function () {
      if (root.classList.contains('js-ready')) { mo.disconnect(); fn(); }
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  fill();
  whenReady(function () {
    // core re-renders the signature grid: mark its items for the reveal too
    var sel = '.bento__grid .dish-grid > li, .bowl-card, .club-card, .story__media, .story__copy, .visit__media, .reserve__img, .menu-cat .dish-grid > li';
    Array.prototype.forEach.call(doc.querySelectorAll(sel), function (li) { li.setAttribute('data-rv', ''); });
    reveal();
  });

  if (!reduce) {
    doc.addEventListener('site:cart', function (e) {
      var a = e.detail && e.detail.action;
      if (!a || (a.type !== 'add' && a.type !== 'inc')) return;
      Array.prototype.forEach.call(doc.querySelectorAll('.cart-btn .badge'), function (b) {
        b.classList.remove('is-pop');
        void b.offsetWidth;
        b.classList.add('is-pop');
      });
    });
  }
})();
