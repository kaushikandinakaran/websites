/* Casa Marigold: small site-only enhancements (no network, no dependencies, classic deferred script).
   1. Prices in hand-built tiles ([data-price-of="<itemId>"]) come from SITE.menu, so they never drift.
   2. Footer hours ([data-hours-compact]) are rendered from SITE.hours, so they always match the hours table.
   3. Taco-night tray hint follows the cart (site:cart event); a tile flashes "Added" when tapped.
   4. Gentle reveal on scroll, only without prefers-reduced-motion, and only after core adds html.js-ready. */
(function () {
  'use strict';
  var S = window.SITE || {};
  var doc = document;
  var root = doc.documentElement;

  // 1. prices
  try {
    var fmt = new Intl.NumberFormat(S.locale || 'en-US', { style: 'currency', currency: S.currency || 'USD' });
    var price = {};
    (S.menu || []).forEach(function (c) { (c.items || []).forEach(function (it) { price[it.id] = it.price; }); });
    doc.querySelectorAll('[data-price-of]').forEach(function (el) {
      var p = price[el.getAttribute('data-price-of')];
      if (typeof p === 'number') el.textContent = fmt.format(p);
    });
  } catch (e) { /* keep the hard-coded fallback prices */ }

  // 2. compact hours: group consecutive days with identical ranges
  try {
    var box = doc.querySelector('[data-hours-compact]');
    if (box && Array.isArray(S.hours)) {
      var order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      var names = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
      var tf = new Intl.DateTimeFormat(S.locale || 'en-US', { hour: 'numeric', minute: '2-digit' });
      var t = function (hm) { var p = hm.split(':'); var d = new Date(2000, 0, 1, +p[0], +p[1]); return tf.format(d); };
      var text = order.map(function (day) {
        var rs = S.hours.filter(function (h) { return h.day === day; });
        if (!rs.length || rs.some(function (h) { return h.closed; })) return 'Closed';
        return rs.map(function (h) { return t(h.open) + ' – ' + t(h.close); }).join(', ');
      });
      var groups = [];
      text.forEach(function (v, i) {
        var g = groups[groups.length - 1];
        if (g && g.v === v) g.end = i; else groups.push({ start: i, end: i, v: v });
      });
      box.innerHTML = groups.map(function (g) {
        var d = names[order[g.start]] + (g.end > g.start ? '–' + names[order[g.end]] : '');
        return '<li><span>' + d + '</span> <span>' + g.v + '</span></li>';
      }).join('');
    }
  } catch (e) { /* leave the fallback text */ }

  // 3. tray hint + tile feedback
  var hint = doc.querySelector('[data-tray-hint]');
  function resetTile(b) {
    var tile = b.closest('.tile');
    if (tile) tile.classList.remove('is-added');
    var lab = b.querySelector('[aria-hidden]');
    if (lab) lab.textContent = 'Add';
  }
  doc.addEventListener('site:cart', function (e) {
    var d = e.detail || {};
    if (hint) hint.textContent = d.count ? 'Nice. Add a side and a drink, then check out.' : 'Tap Add on any tile to start.';
    if (d.action && d.action.type === 'add') {
      doc.querySelectorAll('.tile__add[data-add="' + d.action.id + '"]').forEach(function (b) {
        var tile = b.closest('.tile');
        if (!tile) return;
        tile.classList.remove('is-added');
        void tile.offsetWidth;
        tile.classList.add('is-added');
        var lab = b.querySelector('[aria-hidden]');
        if (lab) lab.textContent = 'Added';
        clearTimeout(b._cmT);
        b._cmT = setTimeout(function () { resetTile(b); }, 1400);
      });
    }
    // removing or clearing items never leaves a tile looking "added"
    if (d.action && (d.action.type === 'remove' || d.action.type === 'clear' || d.action.type === 'dec' || !d.count)) {
      doc.querySelectorAll('.tile__add').forEach(function (b) {
        if (!d.count || d.action.type === 'clear' || b.getAttribute('data-add') === d.action.id) { clearTimeout(b._cmT); resetTile(b); }
      });
    }
  });

  // 4. reveal
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  function start() {
    var els = doc.querySelectorAll('.reveal');
    if (!els.length) return;
    root.classList.add('cm-motion');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.95) el.classList.add('is-in'); else io.observe(el);
    });
  }
  if (root.classList.contains('js-ready')) start();
  else {
    var mo = new MutationObserver(function () { if (root.classList.contains('js-ready')) { mo.disconnect(); start(); } });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    setTimeout(function () { mo.disconnect(); }, 4000);
  }
})();
