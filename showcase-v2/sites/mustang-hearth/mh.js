/* Mustang Hearth: small site-only enhancements (no network, no dependencies).
   1. Prices in hand-built strips ([data-price-of="<itemId>"]) come from SITE.menu, so they never drift.
   2. Gentle scroll reveal (.reveal), only when the visitor has not asked for reduced motion.
   (The optional 3D diya was removed after QA: 2.9 MB was too heavy. The diya photo stays.) */
(function () {
  'use strict';
  var S = window.SITE || {};
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. prices
  try {
    var fmt = new Intl.NumberFormat(S.locale || 'en-US', { style: 'currency', currency: S.currency || 'USD' });
    var price = {};
    (S.menu || []).forEach(function (c) { (c.items || []).forEach(function (it) { price[it.id] = it.price; }); });
    document.querySelectorAll('[data-price-of]').forEach(function (el) {
      var p = price[el.getAttribute('data-price-of')];
      if (typeof p === 'number') el.textContent = fmt.format(p);
    });
  } catch (e) { /* keep the hard-coded fallback prices */ }

  // 2. reveal
  var els = document.querySelectorAll('.reveal');
  if (!reduce && 'IntersectionObserver' in window && els.length) {
    document.documentElement.classList.add('mh-motion');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (el) {
      // Anything already on screen shows at once (no flash of hidden content above the fold).
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.92) el.classList.add('is-in'); else io.observe(el);
    });
  }

})();
