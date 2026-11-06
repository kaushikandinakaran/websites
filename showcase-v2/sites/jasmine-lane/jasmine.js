/* Jasmine Lane: site-only enhancements (ES module, no dependencies, no network).
   Reads window.SITE only (single source of truth for names and prices).
   1. [data-pairings]       renders the "one pot, one basket" tea and dim sum list. Its Add buttons use
                            core's delegated [data-add] hook, so cart, drawer and live region work unchanged.
   2. [data-price-of="id"]  fills a price for a menu item (hero card).
   3. [data-hours-compact]  short weekly hours list for the footer. */
const S = window.SITE || {};
const $ = (s, r = document) => r.querySelector(s);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);
let fmt;
try { fmt = new Intl.NumberFormat(S.locale || 'en-US', { style: 'currency', currency: S.currency || 'USD' }); }
catch { fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); }
const money = (n) => fmt.format(Number(n) || 0);

const ITEMS = new Map();
for (const cat of S.menu || []) for (const it of cat.items || []) ITEMS.set(String(it.id), it);

/* 1. pairings */
function thumb(it) {
  const img = it.img;
  if (!img || !img.src) return '<span class="pair__thumb pair__thumb--lid" aria-hidden="true"></span>';
  return `<img class="pair__thumb" src="${esc(img.src.replace(/-(800|720|1600)\.webp$/, '-400.webp'))}" alt="" width="400" height="${Math.round(400 * (img.height / img.width)) || 400}" loading="lazy" decoding="async">`;
}
function side(it, kind) {
  return `<div class="pair__side pair__side--${kind}">${thumb(it)}`
    + `<div class="pair__text"><p class="pair__kind">${kind === 'tea' ? 'Tea' : 'Dim sum'}</p>`
    + `<p class="pair__name">${esc(it.name)}</p>`
    + `<button type="button" class="pair__add" data-add="${esc(it.id)}"><span class="dish__add-label" aria-hidden="true">Add</span>`
    + `<span class="pair__price" aria-hidden="true">${esc(money(it.price))}</span>`
    + `<span class="vh">Add ${esc(it.name)} to order, ${esc(money(it.price))}</span></button></div></div>`;
}
const box = $('[data-pairings]');
if (box && Array.isArray(S.pairings)) {
  const rows = S.pairings.map((p) => {
    const tea = ITEMS.get(p.tea), dish = ITEMS.get(p.dish);
    if (!tea || !dish) return '';
    return `<li class="pair">${side(tea, 'tea')}`
      + `<div class="pair__join"><span class="pair__with" aria-hidden="true">with</span><p class="pair__note">${esc(p.note || '')}</p></div>`
      + `${side(dish, 'dish')}</li>`;
  }).join('');
  if (rows) box.innerHTML = rows;
}

/* 2. prices */
for (const el of document.querySelectorAll('[data-price-of]')) {
  const it = ITEMS.get(el.dataset.priceOf);
  if (it) el.textContent = money(it.price);
}

/* 3. compact hours */
const hc = $('[data-hours-compact]');
if (hc && Array.isArray(S.hours)) {
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const tf = new Intl.DateTimeFormat(S.locale || 'en-US', { hour: 'numeric', minute: '2-digit' });
  const t = (hm) => { const [h, m] = String(hm).split(':').map(Number); return tf.format(new Date(2024, 0, 1, h, m)); };
  const txt = DAYS.map((d) => {
    const r = S.hours.filter((h) => String(h.day).slice(0, 3) === d && !h.closed && h.open && h.close);
    return r.length ? r.map((h) => `${t(h.open)} – ${t(h.close)}`).join(', ') : 'Closed';
  });
  const groups = [];
  txt.forEach((v, i) => { const g = groups[groups.length - 1]; if (g && g.v === v) g.to = i; else groups.push({ from: i, to: i, v }); });
  hc.innerHTML = groups.map((g) => `<li><span class="footer__days">${NAMES[g.from]}${g.to > g.from ? `–${NAMES[g.to]}` : ''}</span> <span>${esc(g.v)}</span></li>`).join('');
}
