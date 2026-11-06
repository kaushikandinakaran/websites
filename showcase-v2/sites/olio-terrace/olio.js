/* Olio Terrace: site-only enhancements (ES module, no dependencies, no network).
   Reads window.SITE (single source of truth for names and prices). Every Add button uses core's
   delegated [data-add] hook, so the cart, drawer and live region work unchanged.
   1. Renders the "Build a mezze table" list from the 'mezze' menu category.
   2. Keeps the mezze tally in step with the cart (site:cart event + the stored cart).
   3. Fills [data-price-of="<id>"] prices and the compact footer hours [data-hours-mini].
   Motion is CSS only (inside prefers-reduced-motion: no-preference); nothing here animates. */
const S = window.SITE || {};
const MENU = Array.isArray(S.menu) ? S.menu : [];
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);
let fmt;
try { fmt = new Intl.NumberFormat(S.locale || 'en-US', { style: 'currency', currency: S.currency || 'USD' }); }
catch { fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); }
const money = (n) => fmt.format(Number(n) || 0);
const items = new Map();
for (const c of MENU) for (const it of c.items || []) items.set(String(it.id), it);

/* 1. mezze builder */
const mezzeCat = MENU.find((c) => c.id === 'mezze');
const mezzeIds = new Set(mezzeCat ? (mezzeCat.items || []).map((i) => String(i.id)) : []);
const box = document.querySelector('[data-mezze-builder]');
if (box && mezzeCat) {
  const rows = (mezzeCat.items || []).map((it) => {
    const thumb = it.img && it.img.src
      ? `<img class="mz__img" src="${esc(it.img.src.replace('-800.', '-400.'))}" width="400" height="${Math.round((it.img.height || 534) / 2)}" alt="" loading="lazy" decoding="async">`
      : `<span class="mz__mono" aria-hidden="true">${esc(String(it.name).charAt(0))}</span>`;
    return `<li class="mz" data-mz="${esc(it.id)}">
      <span class="mz__thumb">${thumb}</span>
      <span class="mz__text"><span class="mz__name">${esc(it.name)}</span><span class="mz__desc">${esc(it.description || '')}</span></span>
      <span class="mz__price">${esc(money(it.price))}</span>
      <button type="button" class="mz__add dish__add" data-add="${esc(it.id)}"><span class="dish__add-label" aria-hidden="true">Add</span><span class="vh">Add ${esc(it.name)} to order</span></button>
    </li>`;
  }).join('');
  box.innerHTML = `<ul class="mz-list" role="list" aria-label="Mezze to add">${rows}</ul>
    <p class="mz-more"><a href="menu.html#cat-mezze">All mezze, salads and grill plates on the menu <span aria-hidden="true">&rarr;</span></a></p>`;
}

/* 2. tally: counts small plates (the mezze & salad category) in the cart; an item with `plates: N`
   (the platter of five dips) counts as N. The cart is read from storage (same key core uses);
   if storage is blocked, it falls back to counting this page's add/inc/dec/remove events. */
const KEY = `wsv2:cart:${S.slug || 'site'}`;
const mem = new Map();
function readStored() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return Array.isArray(c && c.lines) ? c.lines : null;
  } catch { return null; }
}
function mezzeCount() {
  const lines = readStored();
  if (lines) {
    mem.clear();
    for (const l of lines) mem.set(String(l.id), (mem.get(String(l.id)) || 0) + (Number(l.qty) || 0));
  }
  let n = 0;
  for (const [id, q] of mem) if (mezzeIds.has(id)) n += q * (Number((items.get(id) || {}).plates) || 1);
  return n;
}
const tally = document.querySelector('[data-tally]');
function paint(total) {
  if (!tally) return;
  const n = mezzeCount();
  const m = tally.querySelector('[data-tally-mezze]');
  if (m) m.textContent = String(n);
  const c = tally.querySelector('[data-tally-count]');
  if (c && typeof total === 'number') c.textContent = String(total);
  tally.querySelectorAll('[data-tally-plates] li').forEach((li, i) => li.toggleAttribute('data-on', i < n));
  for (const row of document.querySelectorAll('[data-mz]')) {
    const q = mem.get(row.dataset.mz) || 0;
    row.toggleAttribute('data-in', q > 0);
  }
}
document.addEventListener('site:cart', (e) => {
  const d = e.detail || {};
  const a = d.action || {};
  if (!readStored() && a.id != null) { // memory fallback when storage is blocked
    const id = String(a.id); const q = mem.get(id) || 0;
    if (a.type === 'add' || a.type === 'inc') mem.set(id, q + 1);
    else if (a.type === 'dec') mem.set(id, Math.max(0, q - 1));
    else if (a.type === 'remove') mem.delete(id);
  }
  if (a.type === 'clear') mem.clear();
  paint(d.count);
});
// initial paint (core may not dispatch on load): count from storage
{
  const lines = readStored();
  paint(lines ? lines.reduce((s, l) => s + (Number(l.qty) || 0), 0) : 0);
}

/* 3a. prices from SITE */
for (const el of document.querySelectorAll('[data-price-of]')) {
  const it = items.get(el.dataset.priceOf);
  if (it) el.textContent = money(it.price);
}

/* 3b. compact footer hours, grouped by identical days */
const mini = document.querySelector('[data-hours-mini]');
if (mini && Array.isArray(S.hours)) {
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const tf = new Intl.DateTimeFormat(S.locale || 'en-US', { hour: 'numeric', minute: '2-digit' });
  const t = (hm) => { const [h, m] = String(hm).split(':').map(Number); const d = new Date(2024, 0, 1, h || 0, m || 0); return tf.format(d); };
  const txt = DAYS.map((d) => {
    const r = S.hours.filter((h) => String(h.day).slice(0, 3).toLowerCase() === d && !h.closed && h.open && h.close);
    return r.length ? r.map((h) => `${t(h.open)}–${t(h.close)}`).join(', ') : 'Closed';
  });
  const groups = [];
  txt.forEach((v, i) => { const g = groups[groups.length - 1]; if (g && g.v === v) g.to = i; else groups.push({ from: i, to: i, v }); });
  mini.innerHTML = groups.map((g) => `<li><span class="hours-mini__d">${NAMES[g.from]}${g.to > g.from ? `–${NAMES[g.to]}` : ''}</span> <span class="hours-mini__t">${esc(g.v)}</span></li>`).join('');
}
