/*!
 * Website Studio, Showcase V2 shared core (ES module, no dependencies, no network).
 * Load order on every page:  <script src="site.js"></script>  then
 *                            <script type="module" src="../../shared/core.js"></script>
 * Pages must be served over http (ES modules do not run from file://).
 *
 * ============================== CONTRACT ==============================
 * Site builders: keep every hook below. Restyle freely; do not rename.
 * Missing optional hooks are skipped silently (core never throws for them).
 *
 * INPUT   window.SITE (see shared/README.md for the full shape). Nothing else is read.
 * OUTPUT  no globals. Event: document 'site:cart' CustomEvent, detail =
 *         {count, subtotal, total, mode, action:{type:'add'|'inc'|'dec'|'remove'|'clear'|'opts'|'sync'|'mode'|'tip', id}}
 *         (money values are numbers in currency units).
 *
 * PAGE      body[data-page="home"|"menu"|"checkout"]
 *           a.skip-link[href="#main"]   main#main[tabindex="-1"]
 * HEADER    [data-header]              fixed header; core sets [data-scrolled] after 16px of scroll
 *           [data-nav]#site-nav        main nav (collapses below 56em)
 *           [data-nav-toggle]          button, aria-controls="site-nav", aria-expanded managed by core
 * CART      [data-cart-open]           any button that opens the cart drawer (header, sticky bar, checkout)
 *           [data-cart-count]          item count text (core sets [data-empty] when 0)
 *           [data-cart-count-label]    visually hidden " items"/" item" after the count
 *           [data-cart-total]          subtotal text
 *           [data-add="<itemId>"]      any button: adds one of that menu item (delegated, works on injected markup)
 *           Drawer markup is INJECTED by core: #cart-drawer[data-cart-drawer] > .drawer__panel[role=dialog]
 *           (classes: drawer, drawer__backdrop, drawer__panel, drawer__head, drawer__title, drawer__close,
 *            drawer__body, drawer__foot, cart-lines, cart-line, qty, qty__btn, qty__val, totals, cart-empty)
 *           [data-live]                injected polite live region (do not hide with display:none)
 * MOBILE    [data-mobile-bar]          sticky bottom bar (phones). Inside it:
 *           [data-mbar-order]          link to the menu, shown while the cart is empty
 *           [data-mbar-cart]           button (also has data-cart-open), shown while the cart has items;
 *                                       its [data-mbar-cart-label] gets "View order (2) · $24.00"
 *           [data-tel]                 any link: href becomes tel:SITE.contact.phoneTel
 *           [data-to-top]              "back to top" button (core toggles [hidden])
 * CONTENT   [data-site="path.in.SITE"] text filled from SITE, e.g. data-site="contact.address"
 *           [data-directions]          link: href = SITE.contact.directionsUrl or "#map"
 *           [data-delivery-apps]       filled with SITE.deliveryApps as plain text placeholders
 *           [data-year]                current year
 * HOURS     [data-open-status]         filled with open/closed text; core sets data-state="open|closing|closed|unknown"
 *           [data-hours]               container: core renders the weekly hours table (today highlighted)
 * MENU      [data-signature][data-limit="4"]  home strip of items with popular:true
 *           [data-menu]                full menu sections (menu.html)
 *           [data-menu-nav]            category jump bar container (sticky, scroll-spy, aria-current)
 *           [data-menu-search]         input[type=search] (needs its own <label>)
 *           [data-menu-filters]        container (give it role="group" + aria-label); chips injected
 *           [data-menu-status]         role="status" text: "Showing 4 of 10 dishes"
 *           [data-menu-empty]          hidden message shown when nothing matches; contains [data-menu-clear] button
 *           Card classes: dish, dish__media, dish__img, dish__body, dish__name, dish__badge, dish__desc,
 *            dish__tags, tag, tag--<tag>, dish__foot, dish__price, dish__add, dish-grid, menu-cat, menu-cat__title
 * BOOKING   form#reserve-form[data-reserve][novalidate]
 *           fields (name = id): r-date (date) r-time (select) r-party (select) r-name r-phone (tel) r-email (email, optional) r-notes
 *           [data-error-summary] (tabindex=-1, hidden) at the top of each form
 *           [data-reserve-confirm] hidden panel with [data-reserve-confirm-heading] (tabindex=-1),
 *           [data-reserve-ref], [data-reserve-summary], [data-reserve-again]
 * CHECKOUT  [data-checkout-empty]      shown when the cart is empty
 *           [data-checkout-root]       wraps the form and the summary (hidden after the order is placed)
 *           form#checkout-form[data-checkout][novalidate]
 *           radios name="mode" (pickup|delivery); fieldset[data-delivery-fields] (c-address1, c-address2, c-postcode, c-instructions)
 *           [data-pickup-info] (shows address), [data-ready-estimate]
 *           c-name, c-phone (tel), c-email (optional)
 *           radios name="when" (asap|later); [data-slot-wrap] > select#c-slot[data-slot-select]
 *           [data-tip-options] (radios injected, name="tip")
 *           radios name="pay" (card|later); fieldset[data-card-fields] (c-ccname, c-ccnumber, c-ccexp, c-cccsc; never stored)
 *           [data-pay-later-label] text switches "Pay at pickup" / "Pay on delivery"
 *           button[data-wallet="Apple Pay"|"Google Pay"] demo wallet buttons
 *           [data-place-order] submit; [data-place-total] inside it gets the total
 *           [data-order-summary] summary body; details[data-summary-details] (open on desktop) with [data-summary-total]
 *           [data-edit-order] button opens the drawer (also give it data-cart-open)
 *           [data-confirmation] hidden view: [data-conf-heading] (tabindex=-1), [data-conf-number], [data-conf-time],
 *            [data-conf-mode], [data-conf-name], [data-conf-pay], [data-conf-summary]
 * Validation messages appear in p.field-error#<fieldId>-error (created after the control inside .field if absent).
 * Override a message with data-err-required="..." on the control.
 * =====================================================================
 */

const S = window.SITE || {};
const doc = document;
const root = doc.documentElement;
const body = doc.body;
const $ = (s, r = doc) => r.querySelector(s);
const $$ = (s, r = doc) => Array.from(r.querySelectorAll(s));
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const mqPhone = matchMedia('(max-width: 47.99em)');
const mqNavDesk = matchMedia('(min-width: 56em)');
const mqDesk = matchMedia('(min-width: 60em)');
const mqToTopFloat = matchMedia('(min-width: 80em)');
const LOCALE = S.locale || 'en-US';
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);
const ui = Object.assign({ cartTitle: 'Your order', popularLabel: 'Signature', addLabel: 'Add', addedLabel: 'Added' }, S.ui);
const order = Object.assign({ delivery: true, deliveryFee: 0, deliveryMinimum: 0, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0, maxQty: 20 }, S.order);
const timing = Object.assign({ pickupMinutes: 20, deliveryMinutes: 45, slotStepMinutes: 15 }, S.timing);
const contact = Object.assign({ address: '[address]', phone: '[phone]', phoneTel: '', email: '[email]', directionsUrl: '' }, S.contact);
const behavior = () => (mqReduce.matches ? 'auto' : 'smooth');

let moneyFmt;
try { moneyFmt = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: S.currency || 'USD' }); }
catch { moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); }
const money = (cents) => moneyFmt.format(cents / 100);
const toCents = (n) => Math.round((Number(n) || 0) * 100);
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
const fmtTime = (d) => timeFmt.format(d);

/* ---------- menu index ---------- */
const MENU = Array.isArray(S.menu) ? S.menu : [];
const ITEMS = new Map();
for (const cat of MENU) for (const it of cat.items || []) if (it && it.id != null) ITEMS.set(String(it.id), Object.assign({ cat }, it, { id: String(it.id) }));
const TAGS = S.tags || {};
const tagLabel = (t) => (TAGS[t] && TAGS[t].label) || t;

/* ---------- storage (try/catch, memory fallback) ---------- */
const store = (() => {
  const mem = {};
  let ok = false;
  try { const k = '__wsv2_probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); ok = true; } catch { ok = false; }
  return {
    get(k) { if (ok) { try { return localStorage.getItem(k); } catch { /* fall through */ } } return k in mem ? mem[k] : null; },
    set(k, v) { mem[k] = v; if (ok) { try { localStorage.setItem(k, v); } catch { /* memory only */ } } },
  };
})();

/* ---------- helpers ---------- */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
const focusables = (c) => $$(FOCUSABLE, c).filter((el) => !el.closest('[inert]') && visible(el));
function focusEl(el, scroll) {
  if (!el) return;
  if (!el.matches(FOCUSABLE) && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: !scroll });
}
function trapTab(e, container) {
  if (e.key !== 'Tab') return;
  const f = focusables(container);
  if (!f.length) { e.preventDefault(); return; }
  const first = f[0], last = f[f.length - 1], a = doc.activeElement;
  if (e.shiftKey && (a === first || a === container || !container.contains(a))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (a === last || !container.contains(a))) { e.preventDefault(); first.focus(); }
}
const inerted = new Set();
function setInert(keep, on) {
  if (on) {
    for (const el of Array.from(body.children)) {
      if (el === keep || el.contains(keep) || el.matches('script,[data-live]') || el.inert) continue;
      el.inert = true; inerted.add(el);
    }
  } else { for (const el of inerted) el.inert = false; inerted.clear(); }
}
let locks = 0;
function lockScroll(on) {
  locks = Math.max(0, locks + (on ? 1 : -1));
  if (locks && !root.classList.contains('is-locked')) {
    root.style.setProperty('--scrollbar', `${Math.max(0, innerWidth - root.clientWidth)}px`);
    root.classList.add('is-locked');
  } else if (!locks) root.classList.remove('is-locked');
}
let liveEl;
function announce(msg) {
  if (!liveEl) return;
  liveEl.textContent = '';
  setTimeout(() => { liveEl.textContent = msg; }, 60);
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function randomCode(len, chars) {
  const a = new Uint32Array(len);
  try { crypto.getRandomValues(a); } catch { for (let i = 0; i < len; i++) a[i] = Math.floor(Math.random() * 1e9); }
  return Array.from(a, (n) => chars[n % chars.length]).join('');
}
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/* ---------- hours / open now (viewer's local time) ---------- */
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEK = 10080;
const dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
const dayName = (i) => dayFmt.format(new Date(2024, 0, 1 + i)); // 2024-01-01 is a Monday
const toMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim()); return m ? Math.min(+m[1], 24) * 60 + Math.min(+m[2], 59) : NaN; };
const INTERVALS = (() => {
  const out = [];
  for (const h of Array.isArray(S.hours) ? S.hours : []) {
    const d = DAYS.indexOf(String(h.day || '').slice(0, 3).toLowerCase());
    if (d < 0 || h.closed) continue;
    const o = toMin(h.open), c0 = toMin(h.close);
    if (Number.isNaN(o) || Number.isNaN(c0)) continue;
    const c = c0 <= o ? c0 + 1440 : c0; // overnight
    out.push([d * 1440 + o, d * 1440 + c]);
  }
  return out.sort((a, b) => a[0] - b[0]);
})();
const weekMin = (d) => ((d.getDay() + 6) % 7) * 1440 + d.getHours() * 60 + d.getMinutes();
const minToDate = (now, wm) => { const d = new Date(now); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() + (wm - weekMin(now))); return d; };
function openState(now = new Date()) {
  const n = weekMin(now);
  for (const [s, e] of INTERVALS) for (const sh of [0, -WEEK]) if (n >= s + sh && n < e + sh) return { open: true, closesIn: e + sh - n, closeAt: minToDate(now, e + sh) };
  let next = Infinity;
  for (const [s] of INTERVALS) for (const sh of [0, WEEK]) if (s + sh > n && s + sh < next) next = s + sh;
  if (next === Infinity) return { open: false, unknown: true };
  return { open: false, openAt: minToDate(now, next) };
}
function relDay(date, now) {
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(date); b.setHours(0, 0, 0, 0);
  const diff = Math.round((b - a) / 864e5);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return `on ${dayName((b.getDay() + 6) % 7)}`;
}
function renderOpenStatus() {
  const els = $$('[data-open-status]');
  if (!els.length) return;
  const now = new Date(), st = openState(now);
  let state, main, detail;
  if (st.unknown) { state = 'unknown'; main = 'Hours'; detail = '[to confirm]'; }
  else if (st.open) { state = st.closesIn <= 45 ? 'closing' : 'open'; main = state === 'closing' ? 'Closing soon' : 'Open now'; detail = `until ${fmtTime(st.closeAt)}`; }
  else { state = 'closed'; main = 'Closed now'; detail = `opens ${relDay(st.openAt, now)} at ${fmtTime(st.openAt)}`; }
  const note = S.hoursAreSample ? '<span class="open-status__note"> (sample hours)</span>' : '';
  const html = `<span class="open-status__dot" aria-hidden="true"></span><span class="open-status__main">${esc(main)}</span><span class="open-status__detail"> · ${esc(detail)}</span>${note}`;
  for (const el of els) { if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } el.dataset.state = state; }
}
function renderHours() {
  const box = $('[data-hours]');
  if (!box) return;
  const today = (new Date().getDay() + 6) % 7;
  const rows = DAYS.map((d, i) => {
    const ranges = (S.hours || []).filter((h) => String(h.day || '').slice(0, 3).toLowerCase() === d && !h.closed && h.open && h.close);
    const txt = ranges.length ? ranges.map((h) => `${fmtTime(minToDate(new Date(2024, 0, 1), toMin(h.open)))} – ${fmtTime(minToDate(new Date(2024, 0, 1), toMin(h.close)))}`).join(', ') : 'Closed';
    const cur = i === today;
    return `<tr${cur ? ' class="is-today" aria-current="date"' : ''}><th scope="row">${esc(dayName(i))}${cur ? ' <span class="hours__today">Today</span>' : ''}</th><td>${esc(txt)}</td></tr>`;
  }).join('');
  const cap = S.hoursAreSample ? 'Opening hours (sample hours, to confirm)' : 'Opening hours';
  box.innerHTML = `<table class="hours"><caption>${esc(cap)}</caption><tbody>${rows}</tbody></table>`;
}
/* absolute open windows [start, end] (Dates) from the start of `from`'s day for `days` days */
function openWindows(from, days) {
  const out = [];
  const base = new Date(from); base.setHours(0, 0, 0, 0);
  for (let k = -1; k < days; k++) {
    const day = new Date(base); day.setDate(base.getDate() + k);
    const wd = (day.getDay() + 6) % 7;
    for (const [s, e] of INTERVALS) {
      if (Math.floor(s / 1440) !== wd) continue;
      const st = new Date(day); st.setMinutes(s - wd * 1440);
      const en = new Date(day); en.setMinutes(e - wd * 1440);
      out.push([st, en]);
    }
  }
  return out;
}
const ceilTo = (d, step) => { const x = new Date(d); x.setSeconds(0, 0); const m = x.getMinutes(); const r = Math.ceil(m / step) * step; x.setMinutes(r); return x; };
const addMin = (d, m) => new Date(d.getTime() + m * 60000);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseYmd = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };

/* ---------- cart state ---------- */
const deliveryOn = order.delivery !== false;
const tipOptions = (Array.isArray(order.tips) ? order.tips : [0]).map(Number).filter((n) => n >= 0 && n <= 50);
const slug = S.slug || (location.pathname.split('/').filter(Boolean).slice(-2, -1)[0]) || 'site';
const CART_KEY = `wsv2:cart:${slug}`;
const maxQty = Math.max(1, Number(order.maxQty) || 20);
const clampQty = (q) => Math.max(0, Math.min(maxQty, Math.floor(Number(q) || 0)));
const choiceLabel = (c) => (typeof c === 'object' && c ? String(c.label) : String(c));
const choicePrice = (c) => (typeof c === 'object' && c ? toCents(c.price) : 0);
function cleanOpts(it, opts) {
  const out = {};
  for (const o of Array.isArray(it.options) ? it.options : []) {
    const labels = (o.choices || []).map(choiceLabel);
    if (!labels.length) continue;
    const want = opts && typeof opts === 'object' ? String(opts[o.name] ?? '') : '';
    out[o.name] = labels.includes(want) ? want : labels[0];
  }
  return out;
}
const lineKey = (id, opts) => `${id}|${Object.keys(opts).sort().map((k) => `${k}=${opts[k]}`).join(';')}`;
function unitCents(it, opts) {
  let c = toCents(it.price);
  for (const o of Array.isArray(it.options) ? it.options : []) {
    const ch = (o.choices || []).find((x) => choiceLabel(x) === opts[o.name]);
    if (ch) c += choicePrice(ch);
  }
  return c;
}
function sanitize(d) {
  const defTip = tipOptions.includes(Number(order.defaultTip)) ? Number(order.defaultTip) : (tipOptions[0] || 0);
  const out = { lines: [], mode: 'pickup', tip: defTip };
  if (!d || typeof d !== 'object') return out;
  if (d.mode === 'delivery' && deliveryOn) out.mode = 'delivery';
  if (tipOptions.includes(Number(d.tip))) out.tip = Number(d.tip);
  for (const l of Array.isArray(d.lines) ? d.lines : []) {
    const it = l && ITEMS.get(String(l.id));
    const qty = it ? clampQty(l.qty) : 0;
    if (!qty) continue;
    const opts = cleanOpts(it, l.opts);
    const key = lineKey(it.id, opts);
    const note = typeof l.note === 'string' ? l.note.slice(0, 140) : '';
    const ex = out.lines.find((x) => x.key === key);
    if (ex) ex.qty = clampQty(ex.qty + qty); else out.lines.push({ key, id: it.id, qty, opts, note });
  }
  return out;
}
function loadCart() { try { return sanitize(JSON.parse(store.get(CART_KEY) || 'null')); } catch { return sanitize(null); } }
let cart = loadCart();
function totals() {
  let count = 0, sub = 0;
  for (const l of cart.lines) { count += l.qty; sub += unitCents(ITEMS.get(l.id), l.opts) * l.qty; }
  const fee = cart.mode === 'delivery' && count ? toCents(order.deliveryFee) : 0;
  const tip = Math.round((sub * cart.tip) / 100);
  const tax = order.taxRate ? Math.round(sub * Number(order.taxRate)) : 0;
  return { count, sub, fee, tip, tax, total: sub + fee + tip + tax };
}
function persist() { store.set(CART_KEY, JSON.stringify({ v: 1, lines: cart.lines.map(({ id, qty, opts, note }) => ({ id, qty, opts, note })), mode: cart.mode, tip: cart.tip })); }
function commit(action) {
  persist();
  renderCart();
  const t = totals();
  doc.dispatchEvent(new CustomEvent('site:cart', { detail: { count: t.count, subtotal: t.sub / 100, total: t.total / 100, mode: cart.mode, action } }));
}
function addItem(id) {
  const it = ITEMS.get(String(id));
  if (!it) return null;
  const opts = cleanOpts(it, null);
  const key = lineKey(it.id, opts);
  const ex = cart.lines.find((l) => l.key === key);
  if (ex) { if (ex.qty >= maxQty) return it; ex.qty += 1; } else cart.lines.push({ key, id: it.id, qty: 1, opts, note: '' });
  commit({ type: 'add', id: it.id });
  return it;
}
function setQty(key, qty) {
  const l = cart.lines.find((x) => x.key === key);
  if (!l) return;
  const q = clampQty(qty);
  const type = q === 0 ? 'remove' : q > l.qty ? 'inc' : 'dec';
  if (q === 0) cart.lines = cart.lines.filter((x) => x !== l); else l.qty = q;
  commit({ type, id: l.id });
}
addEventListener('storage', (e) => {
  if (e.key !== CART_KEY) return;
  cart = loadCart();
  renderCart();
  const t = totals();
  doc.dispatchEvent(new CustomEvent('site:cart', { detail: { count: t.count, subtotal: t.sub / 100, total: t.total / 100, mode: cart.mode, action: { type: 'sync' } } }));
});

/* ---------- markup builders ---------- */
function imgHTML(img, cls, eager) {
  if (!img || !img.src) return `<div class="${cls} dish__img--ph" aria-hidden="true"><span>[photo]</span></div>`;
  const a = [`class="${cls}"`, `src="${esc(img.src)}"`, `alt="${esc(img.alt || '')}"`];
  if (img.srcset) a.push(`srcset="${esc(img.srcset)}"`, `sizes="${esc(img.sizes || '(min-width: 60em) 30vw, (min-width: 40em) 45vw, 92vw')}"`);
  if (img.width) a.push(`width="${Number(img.width)}"`);
  if (img.height) a.push(`height="${Number(img.height)}"`);
  a.push(`loading="${eager ? 'eager' : 'lazy'}"`, 'decoding="async"');
  return `<img ${a.join(' ')}>`;
}
function dishHTML(it, h = 3, eager = false) {
  const tags = (it.tags || []).filter(Boolean);
  const tagsHTML = tags.length ? `<ul class="dish__tags" aria-label="Dietary notes">${tags.map((t) => `<li class="tag tag--${esc(String(t).replace(/[^a-z0-9-]/gi, ''))}">${esc(tagLabel(t))}</li>`).join('')}</ul>` : '';
  return `<article class="dish" data-dish="${esc(it.id)}">`
    + `<div class="dish__media">${imgHTML(it.img, 'dish__img', eager)}</div>`
    + `<div class="dish__body"><h${h} class="dish__name">${esc(it.name)}</h${h}>`
    + (it.popular ? `<p class="dish__badge">${esc(ui.popularLabel)}</p>` : '')
    + (it.description ? `<p class="dish__desc">${esc(it.description)}</p>` : '')
    + tagsHTML
    + `<div class="dish__foot"><p class="dish__price">${esc(money(toCents(it.price)))}</p>`
    + `<button type="button" class="btn btn--primary dish__add" data-add="${esc(it.id)}"><span class="dish__add-label" aria-hidden="true">${esc(ui.addLabel)}</span><span class="vh">Add ${esc(it.name)} to order</span></button></div>`
    + '</div></article>';
}
function totalsHTML(t, full) {
  const row = (k, v, cls = '') => `<div class="totals__row${cls}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`;
  let h = row('Subtotal', money(t.sub));
  if (full) {
    if (cart.mode === 'delivery') h += row('Delivery fee', money(t.fee));
    if (t.tip) h += row(`Tip (${cart.tip}%)`, money(t.tip));
    if (t.tax) h += row('Tax (sample rate)', money(t.tax));
    h += row('Total', money(t.total), ' totals__row--total');
  }
  return `<dl class="totals">${h}</dl>`;
}
const optsText = (opts) => Object.keys(opts).map((k) => `${k}: ${opts[k]}`).join(', ');

/* ---------- cart drawer ---------- */
let drawer, drawerPanel, drawerLines, drawerFoot, drawerEmpty, lastFocus, hideTimer;
function buildDrawer() {
  liveEl = doc.createElement('div');
  liveEl.className = 'vh';
  liveEl.setAttribute('aria-live', 'polite');
  liveEl.setAttribute('aria-atomic', 'true');
  liveEl.dataset.live = '';
  body.appendChild(liveEl);
  if (!$('[data-cart-open]')) return;
  drawer = doc.createElement('div');
  drawer.id = 'cart-drawer';
  drawer.className = 'drawer';
  drawer.dataset.cartDrawer = '';
  drawer.hidden = true;
  const menuHref = body.dataset.page === 'menu' ? '#main' : 'menu.html';
  drawer.innerHTML = '<div class="drawer__backdrop" data-cart-close></div>'
    + '<section class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="cart-title" tabindex="-1">'
    + `<header class="drawer__head"><h2 class="drawer__title" id="cart-title">${esc(ui.cartTitle)}</h2>`
    + '<button type="button" class="drawer__close" data-cart-close aria-label="Close order"><span aria-hidden="true">&times;</span></button></header>'
    + `<div class="drawer__body"><div class="cart-empty" data-cart-empty><p>Nothing here yet.</p><a class="btn btn--secondary" href="${menuHref}" data-cart-browse>Browse the menu</a></div><ul class="cart-lines" data-cart-lines></ul></div>`
    + '<footer class="drawer__foot" data-cart-foot></footer></section>';
  body.appendChild(drawer);
  drawerPanel = $('.drawer__panel', drawer);
  drawerLines = $('[data-cart-lines]', drawer);
  drawerFoot = $('[data-cart-foot]', drawer);
  drawerEmpty = $('[data-cart-empty]', drawer);
  drawer.addEventListener('click', onDrawerClick);
  drawer.addEventListener('change', onDrawerChange);
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeCart(); return; }
    trapTab(e, drawerPanel);
  });
}
function openCart(trigger) {
  if (!drawer) return;
  if (navOpen) closeNav(false);
  clearTimeout(hideTimer);
  if (!drawer.hidden && drawer.classList.contains('is-open')) return;
  lastFocus = trigger || doc.activeElement;
  drawer.hidden = false;
  setInert(drawer, true);
  lockScroll(true);
  void drawer.offsetWidth; // start the slide-in from the closed state
  drawer.classList.add('is-open');
  drawerPanel.focus({ preventScroll: true });
}
function closeCart() {
  if (!drawer || drawer.hidden) return;
  drawer.classList.remove('is-open');
  setInert(null, false);
  lockScroll(false);
  hideTimer = setTimeout(() => { drawer.hidden = true; }, mqReduce.matches ? 0 : 260);
  let back = lastFocus;
  if (!back || !back.isConnected || !visible(back) || back.closest('[inert]')) back = $$('[data-cart-open]').find(visible) || $('#main');
  focusEl(back);
}
function lineHTML(l) {
  const it = ITEMS.get(l.id);
  const unit = unitCents(it, l.opts);
  const k = esc(l.key), n = esc(it.name);
  let opts = '';
  (Array.isArray(it.options) ? it.options : []).forEach((o, i) => {
    const id = `opt-${randomCode(6, 'abcdefghijklmnopqrstuvwxyz')}-${i}`;
    opts += `<div class="cart-line__opt"><label for="${id}">${esc(o.name)}</label><select id="${id}" data-action="opt" data-opt="${esc(o.name)}">`
      + (o.choices || []).map((c) => { const lb = choiceLabel(c), p = choicePrice(c); return `<option value="${esc(lb)}"${lb === l.opts[o.name] ? ' selected' : ''}>${esc(lb)}${p ? ` (+${esc(money(p))})` : ''}</option>`; }).join('')
      + '</select></div>';
  });
  const nid = `note-${randomCode(6, 'abcdefghijklmnopqrstuvwxyz')}`;
  return `<li class="cart-line" data-key="${k}">`
    + `<div class="cart-line__info"><p class="cart-line__name">${n}</p><p class="cart-line__price">${esc(money(unit * l.qty))}${l.qty > 1 ? ` <span class="cart-line__each">(${esc(money(unit))} each)</span>` : ''}</p></div>`
    + `<div class="qty" role="group" aria-label="Quantity of ${n}">`
    + `<button type="button" class="qty__btn" data-action="dec" aria-label="${l.qty === 1 ? 'Remove' : 'One fewer'} ${n}"><span aria-hidden="true">&minus;</span></button>`
    + `<span class="qty__val">${l.qty}</span>`
    + `<button type="button" class="qty__btn" data-action="inc" aria-label="One more ${n}"${l.qty >= maxQty ? ' disabled' : ''}><span aria-hidden="true">+</span></button></div>`
    + `<button type="button" class="cart-line__remove" data-action="remove">Remove<span class="vh"> ${n}</span></button>`
    + opts
    + `<details class="cart-line__note"${l.note ? ' open' : ''}><summary>Note for the kitchen<span class="vh"> about ${n}</span></summary><label class="vh" for="${nid}">Note for ${n}</label><input id="${nid}" type="text" maxlength="140" data-action="note" value="${esc(l.note)}" placeholder="e.g. no onions" autocomplete="off"></details>`
    + '</li>';
}
function renderDrawer(t) {
  if (!drawer) return;
  // remember focus inside the list so it survives the re-render
  const a = doc.activeElement;
  let fk = null, fa = null, fo = null, idx = -1;
  if (a && drawerLines.contains(a)) {
    const li = a.closest('[data-key]');
    fk = li && li.dataset.key; fa = a.dataset.action || (a.tagName === 'SUMMARY' ? 'summary' : null); fo = a.dataset.opt || null;
    idx = $$('[data-key]', drawerLines).indexOf(li);
  }
  drawerLines.innerHTML = cart.lines.map(lineHTML).join('');
  drawerEmpty.hidden = !!cart.lines.length;
  drawerLines.hidden = !cart.lines.length;
  drawerFoot.innerHTML = cart.lines.length
    ? `${totalsHTML(t, false)}<p class="drawer__note">${deliveryOn ? 'Delivery fee and optional tip are added at checkout.' : 'Optional tip is added at checkout.'}</p>`
      + `<a class="btn btn--primary btn--block" href="checkout.html" data-cart-checkout>Checkout · ${esc(money(t.sub))}</a>`
      + '<button type="button" class="btn btn--ghost btn--block" data-cart-close>Keep browsing</button>'
    : '';
  if (fk !== null || idx >= 0) {
    const key = renderDrawer.nextKey || fk;
    renderDrawer.nextKey = null;
    const li = $$('[data-key]', drawerLines).find((x) => x.dataset.key === key);
    let target = null;
    if (li) target = fa === 'summary' ? $('summary', li) : $(`[data-action="${fa}"]${fo ? `[data-opt="${CSS.escape(fo)}"]` : ''}`, li) || $('[data-action="dec"]', li);
    if (target && target.disabled) target = $('[data-action="dec"]', li);
    if (!target) { const lis = $$('[data-key]', drawerLines); const n = lis[Math.min(idx, lis.length - 1)]; target = n ? $('[data-action="dec"]', n) : $('[data-cart-browse]', drawer); }
    if (target) focusEl(target);
  }
}
function onDrawerClick(e) {
  if (e.target.closest('[data-cart-close]')) { closeCart(); return; }
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.tagName === 'SELECT' || btn.tagName === 'INPUT') return;
  const li = btn.closest('[data-key]');
  const l = li && cart.lines.find((x) => x.key === li.dataset.key);
  if (!l) return;
  const it = ITEMS.get(l.id);
  const act = btn.dataset.action;
  const q = act === 'inc' ? l.qty + 1 : act === 'dec' ? l.qty - 1 : act === 'remove' ? 0 : l.qty;
  setQty(l.key, q);
  const t = totals();
  announce(q === 0 ? `Removed ${it.name}. ${plural(t.count, 'item', 'items')}, subtotal ${money(t.sub)}.` : `${it.name}: quantity ${Math.min(q, maxQty)}. Subtotal ${money(t.sub)}.`);
}
function onDrawerChange(e) {
  const el = e.target;
  const li = el.closest('[data-key]');
  const l = li && cart.lines.find((x) => x.key === li.dataset.key);
  if (!l) return;
  if (el.dataset.action === 'note') { l.note = el.value.slice(0, 140); persist(); return; }
  if (el.dataset.action === 'opt') {
    const it = ITEMS.get(l.id);
    const opts = cleanOpts(it, Object.assign({}, l.opts, { [el.dataset.opt]: el.value }));
    const key = lineKey(l.id, opts);
    const other = cart.lines.find((x) => x.key === key && x !== l);
    if (other) { other.qty = clampQty(other.qty + l.qty); cart.lines = cart.lines.filter((x) => x !== l); }
    else { l.opts = opts; l.key = key; }
    renderDrawer.nextKey = key;
    commit({ type: 'opts', id: l.id });
    announce(`${it.name}: ${optsText(opts)}. Subtotal ${money(totals().sub)}.`);
  }
}

/* ---------- render everything that shows the cart ---------- */
function renderCart() {
  const t = totals();
  for (const el of $$('[data-cart-count]')) { el.textContent = String(t.count); el.toggleAttribute('data-empty', !t.count); }
  for (const el of $$('[data-cart-count-label]')) el.textContent = t.count === 1 ? ' item' : ' items';
  // Header-style cart buttons get an explicit name from their own word + count, so the name survives even if
  // a site hides the visible word at narrow widths (e.g. display:none).
  for (const btn of $$('[data-cart-open]')) {
    if (!$('[data-cart-count]', btn) || btn.hasAttribute('data-mbar-cart')) continue;
    const wordEl = $('.cart-btn__text', btn);
    if (wordEl && !btn.dataset.cartWord) btn.dataset.cartWord = wordEl.textContent.trim();
    btn.setAttribute('aria-label', `${btn.dataset.cartWord || 'Cart'}, ${plural(t.count, 'item', 'items')}`);
  }
  for (const el of $$('[data-cart-total]')) el.textContent = money(t.sub);
  for (const el of $$('[data-mbar-order]')) el.hidden = !!t.count;
  for (const el of $$('[data-mbar-cart]')) el.hidden = !t.count;
  for (const el of $$('[data-mbar-cart-label]')) el.textContent = `View order (${t.count}) · ${money(t.sub)}`;
  renderDrawer(t);
  renderCheckout(t);
}

/* ---------- add buttons ---------- */
doc.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) {
    const it = addItem(add.dataset.add);
    if (!it) return;
    const t = totals();
    announce(`Added ${it.name}. ${plural(t.count, 'item', 'items')} in your order, subtotal ${money(t.sub)}.`);
    const lab = $('.dish__add-label', add);
    add.dataset.state = 'added';
    if (lab) lab.textContent = ui.addedLabel;
    clearTimeout(add._t);
    add._t = setTimeout(() => { delete add.dataset.state; if (lab) lab.textContent = ui.addLabel; }, 1600);
    return;
  }
  const opener = e.target.closest('[data-cart-open]');
  if (opener && !(drawer && drawer.contains(opener))) { e.preventDefault(); openCart(opener); }
});

/* ---------- nav, header, anchors, sticky bar ---------- */
let navOpen = false;
const header = $('[data-header]');
const navToggle = $('[data-nav-toggle]');
const nav = $('[data-nav]');
function onNavKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); closeNav(true); return; }
  if (header) trapTab(e, header);
}
function openNav() {
  if (!navToggle || !nav || navOpen) return;
  navOpen = true;
  navToggle.setAttribute('aria-expanded', 'true');
  header.setAttribute('data-nav-open', '');
  setInert(header, true);
  lockScroll(true);
  doc.addEventListener('keydown', onNavKey);
}
function closeNav(returnFocus) {
  if (!navOpen) return;
  navOpen = false;
  navToggle.setAttribute('aria-expanded', 'false');
  header.removeAttribute('data-nav-open');
  setInert(null, false);
  lockScroll(false);
  doc.removeEventListener('keydown', onNavKey);
  if (returnFocus) navToggle.focus();
}
if (navToggle && nav && header) {
  navToggle.addEventListener('click', () => (navOpen ? closeNav(true) : openNav()));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) closeNav(false); });
  mqNavDesk.addEventListener('change', () => { if (mqNavDesk.matches) closeNav(false); });
}
function goTo(target, hash) {
  const field = target.matches('input,select,textarea');
  target.scrollIntoView({ behavior: behavior(), block: field ? 'center' : 'start' });
  focusEl(target);
  if (hash && location.hash !== hash) { try { history.pushState(null, '', hash); } catch { /* ignore */ } }
}
doc.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href*="#"]');
  if (!a) return;
  const url = new URL(a.getAttribute('href'), location.href);
  if (url.pathname !== location.pathname || url.search !== location.search || !url.hash || url.hash === '#') return;
  const t = doc.getElementById(decodeURIComponent(url.hash.slice(1)));
  if (!t) return;
  e.preventDefault();
  if (drawer && drawer.contains(a)) closeCart();
  goTo(t, url.hash);
});
const toTop = $('[data-to-top]');
if (toTop) toTop.addEventListener('click', () => {
  scrollTo({ top: 0, behavior: behavior() });
  focusEl((header && focusables(header)[0]) || $('#main'));
});
// hide the sticky bar while typing on phones so it never sits over the keyboard area
const typingField = (el) => el && el.matches && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),textarea,select');
doc.addEventListener('focusin', (e) => { if (mqPhone.matches && typingField(e.target)) body.classList.add('is-typing'); });
doc.addEventListener('focusout', () => { setTimeout(() => { if (!typingField(doc.activeElement)) body.classList.remove('is-typing'); }, 0); });

/* ---------- static content fill ---------- */
function fillContent() {
  for (const el of $$('[data-site]')) { const v = getPath(S, el.dataset.site); if (v != null && typeof v !== 'object') el.textContent = String(v); }
  const tel = String(contact.phoneTel || '').replace(/[^\d+]/g, '');
  for (const a of $$('[data-tel]')) { if (tel) a.href = `tel:${tel}`; }
  for (const a of $$('[data-directions]')) a.href = contact.directionsUrl || '#map';
  for (const el of $$('[data-year]')) el.textContent = String(new Date().getFullYear());
  const apps = Array.isArray(S.deliveryApps) ? S.deliveryApps : [];
  for (const el of $$('[data-delivery-apps]')) el.innerHTML = apps.map((n) => `<span class="delivery-app">${esc(n)}</span>`).join('<span aria-hidden="true"> · </span>');
}

/* ---------- menu ---------- */
function renderSignature() {
  for (const box of $$('[data-signature]')) {
    const lim = Number(box.dataset.limit) || 4;
    let list = Array.from(ITEMS.values()).filter((i) => i.popular);
    if (!list.length) list = Array.from(ITEMS.values());
    box.innerHTML = `<ul class="dish-grid dish-grid--strip" role="list">${list.slice(0, lim).map((it) => `<li>${dishHTML(it, 3)}</li>`).join('')}</ul>`;
  }
}
function renderMenu() {
  const box = $('[data-menu]');
  if (!box) return;
  box.innerHTML = MENU.map((cat, ci) => {
    const id = `cat-${String(cat.id || ci).replace(/[^a-z0-9-]/gi, '')}`;
    return `<section class="menu-cat" id="${id}" aria-labelledby="${id}-h" data-cat="${esc(id)}">`
      + `<h2 class="menu-cat__title" id="${id}-h">${esc(cat.name)}</h2>`
      + (cat.description ? `<p class="menu-cat__desc">${esc(cat.description)}</p>` : '')
      + `<ul class="dish-grid" role="list">${(cat.items || []).map((raw) => { const it = ITEMS.get(String(raw.id)); return it ? `<li data-item="${esc(it.id)}">${dishHTML(it, 3)}</li>` : ''; }).join('')}</ul></section>`;
  }).join('');
  const navBox = $('[data-menu-nav]');
  if (navBox) {
    navBox.innerHTML = `<ul class="catbar__list" role="list">${$$('.menu-cat', box).map((s) => `<li><a class="catbar__link" href="#${s.id}" data-cat-link="${s.id}">${esc($('.menu-cat__title', s).textContent)}</a></li>`).join('')}</ul>`;
    const setH = () => root.style.setProperty('--catbar-h', `${navBox.offsetHeight}px`);
    setH();
    addEventListener('resize', setH, { passive: true });
  }
  setupFilters(box);
}
let spyLinks = [];
function spy() {
  if (!spyLinks.length) return;
  const off = (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) + 8;
  let cur = null;
  const cats = $$('.menu-cat:not([hidden])');
  for (const s of cats) if (s.getBoundingClientRect().top - off <= 0) cur = s.id;
  if (!cur && cats[0]) cur = cats[0].id;
  // at the very bottom the last categories can never reach the top: pick the last one that is on screen
  if (cats.length && innerHeight + scrollY >= root.scrollHeight - 4) {
    const onScreen = cats.filter((s) => s.getBoundingClientRect().top < innerHeight * 0.85);
    if (onScreen.length) cur = onScreen[onScreen.length - 1].id;
  }
  for (const a of spyLinks) {
    const on = a.dataset.catLink === cur;
    if (on && a.getAttribute('aria-current') !== 'true') {
      a.setAttribute('aria-current', 'true');
      const bar = a.closest('ul');
      if (bar && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: a.offsetLeft - 16, behavior: behavior() });
    } else if (!on) a.removeAttribute('aria-current');
  }
}
function setupFilters(box) {
  spyLinks = $$('[data-cat-link]');
  const search = $('[data-menu-search]');
  const chipsBox = $('[data-menu-filters]');
  const status = $('[data-menu-status]');
  const empty = $('[data-menu-empty]');
  const used = new Set();
  for (const it of ITEMS.values()) for (const t of it.tags || []) if (TAGS[t]) used.add(t);
  const active = new Set();
  if (chipsBox) {
    chipsBox.innerHTML = Object.keys(TAGS).filter((t) => used.has(t)).map((t) => `<button type="button" class="chip" aria-pressed="false" data-filter="${esc(t)}">${esc(tagLabel(t))}</button>`).join('');
    chipsBox.addEventListener('click', (e) => {
      const c = e.target.closest('[data-filter]');
      if (!c) return;
      const on = c.getAttribute('aria-pressed') !== 'true';
      c.setAttribute('aria-pressed', String(on));
      if (on) active.add(c.dataset.filter); else active.delete(c.dataset.filter);
      apply(true);
    });
  }
  const total = ITEMS.size;
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function apply(speak) {
    const q = norm(search ? search.value.trim() : '');
    let shown = 0;
    for (const li of $$('[data-item]', box)) {
      const it = ITEMS.get(li.dataset.item);
      const hay = norm(`${it.name} ${it.description || ''} ${(it.tags || []).map(tagLabel).join(' ')} ${it.cat.name}`);
      const ok = (!q || q.split(/\s+/).every((w) => hay.includes(w))) && [...active].every((t) => (it.tags || []).includes(t));
      li.hidden = !ok;
      if (ok) shown++;
    }
    for (const s of $$('.menu-cat', box)) {
      const any = $$('[data-item]', s).some((li) => !li.hidden);
      s.hidden = !any;
      const link = $(`[data-cat-link="${s.id}"]`);
      if (link) link.parentElement.hidden = !any;
    }
    if (empty) empty.hidden = shown > 0;
    if (status) {
      const msg = shown === 0 ? 'No dishes match your search or filters.' : shown === total ? `Showing all ${total} dishes.` : `Showing ${shown} of ${total} dishes.`;
      if (speak || !status.textContent) status.textContent = msg;
    }
    spy();
  }
  if (search) {
    let t;
    search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => apply(true), 180); });
    search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; apply(true); } });
  }
  for (const b of $$('[data-menu-clear]')) b.addEventListener('click', () => {
    if (search) search.value = '';
    active.clear();
    for (const c of $$('[data-filter]')) c.setAttribute('aria-pressed', 'false');
    apply(true);
    focusEl(search || box);
  });
  apply(false);
}
function injectSchema() {
  if (S.schema === false || !['home', 'menu'].includes(body.dataset.page)) return;
  const spec = [];
  for (const [s, e] of INTERVALS) {
    const d = Math.floor(s / 1440);
    const hm = (m) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    spec.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][d]}`, opens: hm(s), closes: hm(e) });
  }
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: S.name || '',
    description: 'SAMPLE DESIGN by Website Studio. Business, menu, prices and hours are samples, not real data.',
    servesCuisine: S.cuisine || undefined,
    address: contact.address,
    telephone: contact.phone,
    currenciesAccepted: S.currency || 'USD',
    acceptsReservations: true,
    openingHoursSpecification: spec,
    hasMenu: {
      '@type': 'Menu',
      name: `${S.name || ''} menu (sample)`,
      hasMenuSection: MENU.map((c) => ({
        '@type': 'MenuSection',
        name: c.name,
        hasMenuItem: (c.items || []).map((i) => ({
          '@type': 'MenuItem', name: i.name, description: i.description || undefined,
          offers: { '@type': 'Offer', price: (toCents(i.price) / 100).toFixed(2), priceCurrency: S.currency || 'USD' },
        })),
      })),
    },
  };
  const sc = doc.createElement('script');
  sc.type = 'application/ld+json';
  sc.dataset.sample = 'true';
  sc.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  doc.head.appendChild(sc);
}

/* ---------- form validation (shared by booking and checkout) ---------- */
function labelText(f) {
  if (f.dataset.label) return f.dataset.label;
  const l = f.labels && f.labels[0];
  const c = l ? l.cloneNode(true) : null;
  if (c) for (const x of $$('.optional,.hint,.req,[aria-hidden="true"]', c)) x.remove();
  return (c ? c.textContent : f.name).replace(/\s+/g, ' ').replace(/[*:]/g, '').trim();
}
function fieldError(f) {
  if (f.matches(':disabled') || f.closest('[hidden]')) return '';
  const v = (f.value || '').trim();
  const lbl = labelText(f);
  if (f.required && !v) return f.dataset.errRequired || (f.tagName === 'SELECT' ? `Choose a ${lbl.toLowerCase()}.` : `Enter your ${lbl.toLowerCase()}.`);
  if (!v) return '';
  if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter an email address like name@example.com.';
  if (f.type === 'tel' && v.replace(/\D/g, '').length < 7) return 'Enter a phone number with at least 7 digits.';
  if (f.minLength > 0 && v.length < f.minLength) return `${lbl} looks too short. Enter at least ${f.minLength} characters.`;
  if (f.type === 'date') {
    if (f.min && v < f.min) return 'Choose today or a later date.';
    if (f.max && v > f.max) return 'Choose a date within the booking window.';
  }
  const kind = f.dataset.validate;
  if (kind === 'card' && !/^\d{12,19}$/.test(v.replace(/[\s-]/g, ''))) return 'Enter a card number of 12 to 19 digits (demo: any digits).';
  if (kind === 'exp') {
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(v);
    const now = new Date();
    if (!m || +m[1] < 1 || +m[1] > 12) return 'Enter the expiry as MM/YY.';
    if (2000 + +m[2] < now.getFullYear() || (2000 + +m[2] === now.getFullYear() && +m[1] < now.getMonth() + 1)) return 'This expiry date has passed.';
  }
  if (kind === 'cvc' && !/^\d{3,4}$/.test(v)) return 'Enter the 3 or 4 digit security code.';
  return '';
}
function showFieldError(f, msg) {
  const id = `${f.id}-error`;
  let p = doc.getElementById(id);
  if (!p && msg) {
    p = doc.createElement('p');
    p.id = id;
    p.className = 'field-error';
    const host = f.closest('.field') || f.parentElement;
    host.appendChild(p);
  }
  const ids = new Set((f.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  if (msg) { p.textContent = msg; p.hidden = false; f.setAttribute('aria-invalid', 'true'); ids.add(id); }
  else { if (p) { p.textContent = ''; p.hidden = true; } f.removeAttribute('aria-invalid'); ids.delete(id); }
  if (ids.size) f.setAttribute('aria-describedby', [...ids].join(' ')); else f.removeAttribute('aria-describedby');
}
const formFields = (form) => $$('input,select,textarea', form).filter((f) => f.id && !['radio', 'checkbox', 'hidden', 'button', 'submit'].includes(f.type));
function renderSummary(form, errs, moveFocus) {
  const sum = $('[data-error-summary]', form);
  if (!errs.length) { if (sum) { sum.hidden = true; sum.innerHTML = ''; } return; }
  if (sum) {
    sum.innerHTML = `<h2 class="error-summary__title">${errs.length === 1 ? 'There is 1 problem' : `There are ${errs.length} problems`}</h2><ul>${errs.map((x) => `<li><a href="#${esc(x.id)}">${esc(x.msg)}</a></li>`).join('')}</ul>`;
    sum.hidden = false;
    if (moveFocus) { sum.scrollIntoView({ behavior: behavior(), block: 'center' }); focusEl(sum); }
  } else if (moveFocus) focusEl(doc.getElementById(errs[0].id));
}
// Checks every field in one pass, shows each message inline and lists ALL of them in the summary.
function collectErrors(form) {
  const errs = [];
  for (const f of formFields(form)) { const m = fieldError(f); showFieldError(f, m); if (m) errs.push({ id: f.id, msg: m }); }
  return errs;
}
function validateForm(form, extra = []) {
  form.dataset.tried = '1';
  form._extra = extra;
  const errs = collectErrors(form).concat(extra);
  renderSummary(form, errs, true);
  return !errs.length;
}
// After the first submit, keep inline messages and the summary in step with what the guest types (no focus moves),
// so the summary never shows stale messages.
function liveRevalidate(form) {
  const re = (e) => {
    if (!form.dataset.tried || !formFields(form).includes(e.target)) return;
    const extra = (form._extra || []).filter((x) => x.id !== e.target.id && x.id !== e.target.name);
    form._extra = extra;
    renderSummary(form, collectErrors(form).concat(extra), false);
  };
  form.addEventListener('change', re);
  form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid') === 'true') re(e); });
}

/* ---------- reservation ---------- */
const resv = Object.assign({ stepMinutes: 30, lastSeatingMinutes: 60, leadMinutes: 60, maxParty: 8, daysAhead: 60, defaultParty: 2 }, S.reservation);
function reserveSlots(date) {
  const now = new Date();
  const out = [];
  const day = new Date(date); day.setHours(0, 0, 0, 0);
  const next = new Date(day); next.setDate(day.getDate() + 1);
  for (const [st, en] of openWindows(day, 1)) {
    if (st < day || st >= next) continue;
    for (let t = ceilTo(st, resv.stepMinutes); t <= addMin(en, -resv.lastSeatingMinutes); t = addMin(t, resv.stepMinutes)) {
      if (t < addMin(now, resv.leadMinutes)) continue;
      out.push(t);
    }
  }
  return out;
}
function setupReservation() {
  const form = $('[data-reserve]');
  if (!form) return;
  const date = $('#r-date', form), time = $('#r-time', form), party = $('#r-party', form);
  const confirm = $('[data-reserve-confirm]');
  const today = new Date();
  if (date) {
    date.min = ymd(today);
    const max = new Date(today); max.setDate(today.getDate() + resv.daysAhead); date.max = ymd(max);
    let first = new Date(today);
    for (let i = 0; i < 14; i++) { const d = new Date(today); d.setDate(today.getDate() + i); if (reserveSlots(d).length) { first = d; break; } }
    if (!date.value) date.value = ymd(first);
  }
  if (party && !party.options.length) {
    for (let i = 1; i <= resv.maxParty; i++) party.add(new Option(`${i} ${i === 1 ? 'guest' : 'guests'}`, String(i), false, i === resv.defaultParty));
  }
  function fillTimes() {
    if (!time) return;
    const prev = time.value;
    const d = parseYmd(date && date.value);
    const slots = d ? reserveSlots(d) : [];
    time.innerHTML = '';
    if (!slots.length) {
      time.add(new Option(d ? 'No tables on this day' : 'Choose a date first', ''));
      time.dataset.errRequired = d ? 'No tables on the chosen day (closed or fully past). Choose another date.' : 'Choose a date first.';
    } else {
      delete time.dataset.errRequired;
      for (const t of slots) { const v = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; time.add(new Option(fmtTime(t), v)); }
      if (slots.some((t) => `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` === prev)) time.value = prev;
    }
  }
  fillTimes();
  if (date) date.addEventListener('change', fillTimes);
  liveRevalidate(form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;
    const d = parseYmd(date.value);
    const [hh, mm] = time.value.split(':').map(Number);
    d.setHours(hh, mm, 0, 0);
    const ref = `WS-${randomCode(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789')}`;
    const when = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
    const n = Number(party.value);
    if (confirm) {
      $('[data-reserve-ref]', confirm).textContent = ref;
      $('[data-reserve-summary]', confirm).textContent = `${plural(n, 'guest', 'guests')} on ${when} at ${fmtTime(d)}, under the name ${$('#r-name', form).value.trim()}.`;
      form.hidden = true;
      confirm.hidden = false;
      focusEl($('[data-reserve-confirm-heading]', confirm) || confirm);
    }
    announce(`Table request received. Reference ${ref}.`);
  });
  const again = confirm && $('[data-reserve-again]', confirm);
  if (again) again.addEventListener('click', () => {
    form.reset();
    delete form.dataset.tried;
    for (const f of formFields(form)) showFieldError(f, '');
    const sum = $('[data-error-summary]', form); if (sum) sum.hidden = true;
    setupDefaults();
    confirm.hidden = true;
    form.hidden = false;
    focusEl($('#r-name', form) || form);
  });
  function setupDefaults() {
    const t = new Date();
    for (let i = 0; i < 14; i++) { const d = new Date(t); d.setDate(t.getDate() + i); if (reserveSlots(d).length) { date.value = ymd(d); break; } }
    party.value = String(resv.defaultParty);
    fillTimes();
  }
}

/* ---------- checkout ---------- */
let co = null; // checkout elements
function pickupSlots() {
  const now = new Date();
  const lead = cart.mode === 'delivery' ? timing.deliveryMinutes : timing.pickupMinutes;
  const step = timing.slotStepMinutes;
  const out = [];
  for (const [st, en] of openWindows(now, 3)) {
    for (let t = ceilTo(new Date(Math.max(+st + lead * 60000, +addMin(now, lead))), step); t <= en && out.length < 60; t = addMin(t, step)) {
      if (t > addMin(now, 48 * 60)) break;
      out.push(t);
    }
  }
  return out;
}
function canAsap() {
  const st = openState();
  const lead = cart.mode === 'delivery' ? timing.deliveryMinutes : timing.pickupMinutes;
  return st.open && st.closesIn >= Math.min(lead, 30);
}
function slotLabel(t) {
  const r = relDay(t, new Date());
  return `${r === 'today' ? 'Today' : r === 'tomorrow' ? 'Tomorrow' : r.replace(/^on /, '')}, ${fmtTime(t)}`;
}
function setupCheckout() {
  const form = $('[data-checkout]');
  if (!form) return;
  co = {
    form,
    root: $('[data-checkout-root]'),
    empty: $('[data-checkout-empty]'),
    delivery: $('[data-delivery-fields]', form),
    pickup: $('[data-pickup-info]', form),
    estimate: $('[data-ready-estimate]'),
    slotWrap: $('[data-slot-wrap]', form),
    slot: $('[data-slot-select]', form),
    tips: $('[data-tip-options]', form),
    card: $('[data-card-fields]', form),
    summary: $('[data-order-summary]'),
    details: $('[data-summary-details]'),
    conf: $('[data-confirmation]'),
    wallet: null,
    done: false,
  };
  if (!deliveryOn) { const d = $('input[name="mode"][value="delivery"]', form); if (d) { d.closest('label, .choice')?.remove(); } }
  const modeR = $(`input[name="mode"][value="${cart.mode}"]`, form);
  if (modeR) modeR.checked = true;
  if (co.tips) {
    co.tips.innerHTML = tipOptions.map((p) => `<label class="chip chip--radio"><input type="radio" name="tip" value="${p}"${p === cart.tip ? ' checked' : ''}><span>${p ? `${p}%` : 'No tip'}</span></label>`).join('');
  }
  const syncDetails = () => { if (co.details && mqDesk.matches) co.details.open = true; };
  syncDetails();
  mqDesk.addEventListener('change', syncDetails);
  form.addEventListener('change', (e) => {
    const n = e.target.name;
    if (n === 'mode') { cart.mode = e.target.value === 'delivery' && deliveryOn ? 'delivery' : 'pickup'; commit({ type: 'mode' }); fillSlots(); }
    else if (n === 'tip') { cart.tip = Number(e.target.value) || 0; commit({ type: 'tip' }); }
    else if (n === 'when' || n === 'pay' || n === 'c-slot' || e.target === co.slot) syncCheckoutUI();
    if (n === 'mode' || n === 'tip') { const t = totals(); announce(`Total ${money(t.total)}.`); }
  });
  liveRevalidate(form);
  for (const w of $$('[data-wallet]', form)) w.addEventListener('click', () => { co.wallet = w.dataset.wallet; if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true })); });
  form.addEventListener('submit', (e) => { e.preventDefault(); placeOrder(); co.wallet = null; });
  fillSlots();
  setInterval(() => { if (!co.done) { fillSlots(); } }, 60000);
}
function fillSlots() {
  if (!co || !co.slot) return;
  const prev = co.slot.value;
  const slots = pickupSlots();
  co.slot.innerHTML = slots.length ? '' : '<option value="">No times available in the next two days</option>';
  for (const t of slots) co.slot.add(new Option(slotLabel(t), t.toISOString()));
  if (slots.some((t) => t.toISOString() === prev)) co.slot.value = prev;
  const asap = $('input[name="when"][value="asap"]', co.form);
  const later = $('input[name="when"][value="later"]', co.form);
  if (asap && later) {
    const ok = canAsap();
    asap.disabled = !ok;
    const lab = asap.closest('label');
    if (lab) lab.classList.toggle('is-disabled', !ok);
    if (!ok && asap.checked) later.checked = true;
  }
  syncCheckoutUI();
}
function syncCheckoutUI() {
  if (!co) return;
  const f = co.form;
  const deliv = cart.mode === 'delivery';
  if (co.delivery) { co.delivery.hidden = !deliv; co.delivery.disabled = !deliv; }
  if (co.pickup) co.pickup.hidden = deliv;
  for (const el of $$('[data-pay-later-label]', f)) el.textContent = deliv ? 'Pay on delivery' : 'Pay at pickup';
  const when = ($('input[name="when"]:checked', f) || {}).value || 'asap';
  if (co.slotWrap) co.slotWrap.hidden = when !== 'later';
  if (co.slot) co.slot.disabled = when !== 'later';
  const pay = ($('input[name="pay"]:checked', f) || {}).value || 'later';
  if (co.card) { co.card.hidden = pay !== 'card'; co.card.disabled = pay !== 'card'; }
  if (co.estimate) {
    const st = openState();
    const mins = deliv ? timing.deliveryMinutes : timing.pickupMinutes;
    let txt;
    if (when === 'later' && co.slot && co.slot.value) txt = `${deliv ? 'Delivery' : 'Ready for pickup'}: ${slotLabel(new Date(co.slot.value))}`;
    else if (canAsap()) txt = `${deliv ? 'Arrives in' : 'Ready in'} about ${mins} minutes (around ${fmtTime(ceilTo(addMin(new Date(), mins), 5))})`;
    else txt = st.unknown ? 'Choose a time below.' : `We are closed right now. Choose a time: we open ${relDay(st.openAt || new Date(), new Date())} at ${st.openAt ? fmtTime(st.openAt) : ''}.`;
    co.estimate.textContent = txt;
  }
}
function summaryHTML(t) {
  return `<ul class="osum__lines" role="list">${cart.lines.map((l) => { const it = ITEMS.get(l.id); const o = optsText(l.opts); return `<li class="osum__line"><span class="osum__qty">${l.qty}&times;</span> <span class="osum__name">${esc(it.name)}${o ? `<span class="osum__opts">${esc(o)}</span>` : ''}${l.note ? `<span class="osum__opts">Note: ${esc(l.note)}</span>` : ''}</span> <span class="osum__price">${esc(money(unitCents(it, l.opts) * l.qty))}</span></li>`; }).join('')}</ul>${totalsHTML(t, true)}`;
}
function renderCheckout(t) {
  if (!co || co.done) return;
  const has = cart.lines.length > 0;
  if (co.empty) co.empty.hidden = has;
  if (co.root) co.root.hidden = !has;
  if (co.summary) co.summary.innerHTML = summaryHTML(t);
  for (const el of $$('[data-summary-total]')) el.textContent = money(t.total);
  for (const el of $$('[data-place-total]')) el.textContent = money(t.total);
  const m = $(`input[name="mode"][value="${cart.mode}"]`, co.form);
  if (m && !m.checked) { m.checked = true; }
  for (const r of $$('input[name="tip"]', co.form)) r.checked = Number(r.value) === cart.tip;
  syncCheckoutUI();
}
function placeOrder() {
  const f = co.form;
  const t = totals();
  if (!t.count) { renderCheckout(t); return; }
  const extra = [];
  const minC = toCents(order.deliveryMinimum);
  if (cart.mode === 'delivery' && minC && t.sub < minC) extra.push({ id: 'mode-delivery', msg: `Delivery needs a subtotal of at least ${money(minC)} (sample rule). Add more or choose pickup.` });
  if (co.wallet && co.card) { co.card.disabled = true; }
  const when = ($('input[name="when"]:checked', f) || {}).value || 'asap';
  if (when === 'asap' && !canAsap()) extra.push({ id: 'when-later', msg: 'We are closed right now. Choose a time for later.' });
  const ok = validateForm(f, extra);
  if (!ok) { syncCheckoutUI(); return; }
  const pay = co.wallet ? `${co.wallet} (demo, no payment taken)` : (($('input[name="pay"]:checked', f) || {}).value === 'card' ? 'Card (demo, no payment taken)' : (cart.mode === 'delivery' ? 'Pay on delivery' : 'Pay at pickup'));
  // card data is never kept: wipe the fields before anything else happens
  for (const i of $$('[data-card-fields] input', f)) i.value = '';
  const mins = cart.mode === 'delivery' ? timing.deliveryMinutes : timing.pickupMinutes;
  const readyAt = when === 'later' && co.slot && co.slot.value ? new Date(co.slot.value) : ceilTo(addMin(new Date(), mins), 5);
  const name = ($('#c-name', f) || {}).value || '';
  const html = summaryHTML(t);
  const num = String(1000 + (parseInt(randomCode(4, '0123456789'), 10) % 9000));
  const modeTxt = cart.mode === 'delivery' ? `Delivery to ${[($('#c-address1', f) || {}).value, ($('#c-postcode', f) || {}).value].filter(Boolean).join(', ')}` : `Pickup at ${contact.address}`;
  co.done = true;
  // per-order state ends with the order: lines (and their kitchen notes) and the tip go back to defaults.
  // Pickup/delivery stays as the guest's preference; the time choice is never stored (form reset below).
  cart.lines = [];
  cart.tip = sanitize(null).tip;
  commit({ type: 'clear' });
  f.reset();
  if (co.root) co.root.hidden = true;
  if (co.empty) co.empty.hidden = true;
  const c = co.conf;
  if (c) {
    const set = (sel, v) => { const el = $(sel, c); if (el) el.textContent = v; };
    set('[data-conf-number]', `#${num}`);
    set('[data-conf-time]', `${slotLabel(readyAt)}${when === 'asap' ? ` (about ${mins} minutes)` : ''}`);
    set('[data-conf-mode]', modeTxt);
    set('[data-conf-name]', name.trim());
    set('[data-conf-pay]', pay);
    const s = $('[data-conf-summary]', c); if (s) s.innerHTML = html;
    c.hidden = false;
    scrollTo({ top: 0, behavior: 'auto' });
    focusEl($('[data-conf-heading]', c) || c);
  }
  announce(`Order placed. Order number ${num}.`);
}

/* ---------- boot ---------- */
function onScroll() {
  const y = scrollY;
  if (header) header.toggleAttribute('data-scrolled', y > 16);
  if (toTop) {
    // wide screens: float in the gutter after scrolling; narrower: only when the reserved end strip is in view
    const atEnd = root.scrollHeight - (innerHeight + y) <= 8;
    toTop.hidden = mqToTopFloat.matches ? y < innerHeight * 1.2 : !(atEnd && y > innerHeight * 0.5);
  }
  spy();
}
let ticking = false;
const queueScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); } };
addEventListener('scroll', queueScroll, { passive: true });
addEventListener('resize', queueScroll, { passive: true });

// Each step is guarded so one failure cannot keep the page hidden: base.css keeps JS-filled regions
// invisible until html.js-ready (layout-shift guard). Errors are rethrown asynchronously so QA still sees them.
for (const step of [buildDrawer, fillContent, renderOpenStatus, renderHours, renderSignature, renderMenu, injectSchema, setupReservation, setupCheckout, renderCart, onScroll]) {
  try { step(); } catch (err) { setTimeout(() => { throw err; }); }
}
// Reveal in the same frame as the render: everything was laid out while invisible, so nothing visible moves.
root.classList.add('js-ready');
setInterval(renderOpenStatus, 60000);
if (location.hash.length > 1) {
  const t = doc.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (t) requestAnimationFrame(() => { t.scrollIntoView({ block: 'start' }); focusEl(t); });
}
