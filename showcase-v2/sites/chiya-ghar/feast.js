/* Chiya Ghar Family Feast picker. Uses only public hooks: it adds trays to the shared cart by clicking a
   [data-add] button (core's delegated handler), once per tray, and counts the 'site:cart' add events to know
   how many really went in (core caps each line at SITE.order.maxQty). Prices come from window.SITE.menu. */
(function () {
  var root = document.querySelector('[data-feast]');
  var S = window.SITE, F = S && S.feast;
  if (!root || !F || !S) return;
  var items = {};
  (S.menu || []).forEach(function (c) { (c.items || []).forEach(function (it) { items[it.id] = it; }); });
  var maxQty = (S.order && S.order.maxQty) || 20;
  var fmt;
  try { fmt = new Intl.NumberFormat(S.locale || 'en-US', { style: 'currency', currency: S.currency || 'USD' }); }
  catch (e) { fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); }
  var cents = function (n) { return Math.round(n * 100); };
  var money = function (c) { return fmt.format(c / 100); };

  var guests = F.presets[1] || 20;
  var valid = true;
  var radios = root.querySelectorAll('input[name="feast-size"]');
  var custom = root.querySelector('#feast-custom');
  var customWrap = root.querySelector('[data-feast-custom]');
  var list = root.querySelector('[data-feast-list]');
  var totalEl = root.querySelector('[data-feast-total]');
  var perEl = root.querySelector('[data-feast-per]');
  var guestsEl = root.querySelector('[data-feast-guests]');
  var addBtn = root.querySelector('[data-feast-add]');
  var addTotal = root.querySelector('[data-feast-add-total]');
  var status = root.querySelector('[data-feast-status]');
  var err = root.querySelector('#feast-custom-error');
  var proxy = root.querySelector('[data-feast-proxy]');
  var on = {};
  var rows = {};
  F.trays.forEach(function (t) { on[t.id] = !!t.on; });

  // Build the tray rows once; render() only updates text, so focus is never lost.
  F.trays.forEach(function (t) {
    if (!items[t.id]) return;
    var li = document.createElement('li');
    li.className = 'feast-line';
    var id = 'ft-' + t.id;
    li.innerHTML = '<input type="checkbox" id="' + id + '"><label for="' + id + '"><span class="feast-line__name"></span>' +
      '<span class="feast-line__meta"></span></label><span class="feast-line__sum"></span>';
    var box = li.querySelector('input');
    box.checked = on[t.id];
    li.querySelector('.feast-line__name').textContent = t.label;
    box.addEventListener('change', function () { on[t.id] = box.checked; render(); });
    list.appendChild(li);
    rows[t.id] = li;
  });

  function n() { return Math.ceil(guests / F.perTray); }
  function plan() {
    return F.trays.filter(function (t) { return on[t.id] && items[t.id]; })
      .map(function (t) { return { id: t.id, label: t.label, it: items[t.id], qty: n() }; });
  }
  function render() {
    var total = 0, k = valid ? n() : 0;
    F.trays.forEach(function (t) {
      var li = rows[t.id]; if (!li) return;
      var it = items[t.id], c = cents(it.price) * k;
      li.classList.toggle('is-off', !on[t.id]);
      li.querySelector('.feast-line__meta').textContent = valid ? k + ' × ' + fmt.format(it.price) : fmt.format(it.price) + ' per tray';
      li.querySelector('.feast-line__sum').textContent = !on[t.id] ? 'Not included' : valid ? money(c) : '–';
      if (on[t.id]) total += c;
    });
    var p = plan();
    totalEl.textContent = valid ? money(total) : '–';
    addTotal.textContent = valid ? money(total) : '–';
    guestsEl.textContent = valid ? guests : '?';
    perEl.textContent = !valid ? 'Enter a valid number of guests' : p.length ? 'About ' + money(total / guests) + ' per guest' : 'Pick at least one tray';
    addBtn.disabled = !valid || !p.length;
  }

  radios.forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      customWrap.hidden = r.value !== 'custom';
      if (r.value === 'custom') { readCustom(); } else { valid = true; err.hidden = true; custom.removeAttribute('aria-invalid'); guests = Number(r.value); render(); }
    });
  });
  function readCustom() {
    var raw = custom.value.trim(), v = Number(raw);
    if (!raw || !Number.isInteger(v) || v < F.min || v > F.max) {
      err.textContent = 'Enter a whole number of guests from ' + F.min + ' to ' + F.max + '.';
      err.hidden = false; custom.setAttribute('aria-invalid', 'true');
      valid = false; render(); return false;
    }
    err.hidden = true; custom.removeAttribute('aria-invalid');
    valid = true; guests = v; render(); return true;
  }
  custom.addEventListener('input', readCustom);

  // Hero shortcut buttons: [data-feast-preset="10|20|30"] pick a headcount and scroll here.
  document.querySelectorAll('[data-feast-preset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var r = root.querySelector('input[name="feast-size"][value="' + b.dataset.feastPreset + '"]');
      if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  });

  addBtn.addEventListener('click', function () {
    var custSel = root.querySelector('input[name="feast-size"][value="custom"]');
    if (custSel && custSel.checked && !readCustom()) { custom.focus(); return; }
    var p = plan(), wanted = 0, added = 0, addedCents = 0, capped = [];
    var counting = null;
    function onCart(e) { if (counting && e.detail && e.detail.action && e.detail.action.type === 'add') counting.got++; }
    document.addEventListener('site:cart', onCart);
    p.forEach(function (l) {
      counting = { got: 0 };
      proxy.dataset.add = l.id;
      for (var i = 0; i < l.qty; i++) proxy.click();
      wanted += l.qty; added += counting.got; addedCents += counting.got * cents(l.it.price);
      if (counting.got < l.qty) capped.push(l.label + ' (' + counting.got + ' of ' + l.qty + ')');
    });
    counting = null;
    document.removeEventListener('site:cart', onCart);
    var msg;
    if (!capped.length) msg = 'Added ' + added + ' trays for ' + guests + ' guests to your order (' + money(addedCents) + ').';
    else msg = 'Added ' + added + ' of ' + wanted + ' trays (' + money(addedCents) + '). The limit is ' + maxQty + ' of each tray per order, and it was reached for: ' + capped.join(', ') + '. For a bigger party, please call us.';
    status.textContent = msg + ' Open your order to review or change quantities.';
    status.classList.toggle('is-warn', capped.length > 0);
    root.classList.remove('is-added'); void root.offsetWidth; root.classList.add('is-added');
  });
  render();
})();
