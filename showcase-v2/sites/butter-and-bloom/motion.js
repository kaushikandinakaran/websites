/* Butter & Bloom: gentle scroll reveal. Content is fully visible without this script;
   it only runs when the visitor has not asked for reduced motion. No globals. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  var els = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  if (!els.length) return;
  root.classList.add('js-motion');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach(function (el) { io.observe(el); });
  // Anchor jumps (e.g. #reserve from the phone bar) reveal their section at once.
  function revealHash() {
    var t = location.hash && document.getElementById(location.hash.slice(1));
    if (!t) return;
    els.forEach(function (el) { if (t.contains(el)) { el.classList.add('is-in'); io.unobserve(el); } });
  }
  addEventListener('hashchange', revealHash);
  revealHash();
})();
