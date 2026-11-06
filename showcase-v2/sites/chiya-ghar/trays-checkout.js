/* Chiya Ghar checkout rule (site-level, shared/ untouched): party trays need notice.
   When the cart holds any tray-* item, "Schedule for later" is selected, "As soon as possible" is disabled and a
   visible note explains why. Cart contents come from the 'site:cart' event and the stored cart (read only). */
(function () {
  var form = document.querySelector('[data-checkout]');
  if (!form) return;
  var asap = document.getElementById('when-asap');
  var later = document.getElementById('when-later');
  var note = document.querySelector('[data-tray-note]');
  if (!asap || !later || !note) return;
  var KEY = 'wsv2:cart:' + ((window.SITE && window.SITE.slug) || '');
  var hasTrays = false;

  function readStored() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || 'null');
      return !!(c && c.lines && c.lines.some(function (l) { return /^tray-/.test(l.id) && l.qty > 0; }));
    } catch (e) { return hasTrays; }
  }
  function apply() {
    note.hidden = !hasTrays;
    if (hasTrays) {
      if (!later.checked) { later.checked = true; later.dispatchEvent(new Event('change', { bubbles: true })); }
      asap.disabled = true;
      asap.closest('label') && asap.closest('label').classList.add('is-disabled');
    }
  }
  document.addEventListener('site:cart', function (e) {
    var had = hasTrays;
    hasTrays = readStored();
    if (had && !hasTrays) { asap.disabled = false; var l = asap.closest('label'); if (l) l.classList.remove('is-disabled'); }
    apply();
  });
  // core re-checks ASAP every minute (open/closed); re-apply the tray rule after it.
  setInterval(apply, 3000);
  function boot() { hasTrays = readStored(); apply(); }
  if (document.documentElement.classList.contains('js-ready')) boot();
  else { document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); }); setTimeout(boot, 400); }
})();
