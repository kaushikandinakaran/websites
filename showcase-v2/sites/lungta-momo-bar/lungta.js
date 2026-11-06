/* Lungta Momo Bar extras (ES module, no network, no globals).
   1. [data-lg] text from SITE timing.
   2. Momo box builder ([data-boxer]): chips built from the "momo-box" item options in site.js, live price,
      "Add box" puts the box with the chosen options into the shared cart.
      How: core keeps the cart in localStorage under wsv2:cart:<slug> and reloads it on a 'storage' event.
      We append the line there and dispatch a synthetic StorageEvent, so core re-reads, merges and re-renders.
      If storage is blocked, we fall back to core's own [data-add] (default options; guest changes them in the cart). */
const S = window.SITE || {};
const doc = document;

let fmt;
try { fmt = new Intl.NumberFormat(S.locale || 'en-US', { style: 'currency', currency: S.currency || 'USD' }); }
catch { fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); }
const money = (n) => fmt.format(n);

const timing = Object.assign({ pickupMinutes: 15, deliveryMinutes: 40 }, S.timing);
for (const el of doc.querySelectorAll('[data-lg]')) {
  const v = { pickup: timing.pickupMinutes, delivery: timing.deliveryMinutes }[el.dataset.lg];
  if (v != null) el.textContent = String(v);
}

const BOX_ID = 'momo-box';
let item = null;
for (const c of S.menu || []) for (const it of c.items || []) if (it.id === BOX_ID) item = it;
const form = doc.querySelector('[data-boxer]');

const label = (c) => (typeof c === 'string' ? c : c.label);
const price = (c) => (typeof c === 'string' ? 0 : Number(c.price) || 0);
const short = (s) => s.replace(/\s*\(.*\)$/, '');

if (form && item) {
  const groups = item.options || [];
  const picks = {};
  groups.forEach((g, gi) => {
    const box = form.querySelector(`[data-pick="${g.name}"]`);
    if (!box) return;
    picks[g.name] = label(g.choices[0]);
    box.innerHTML = g.choices.map((c, i) => {
      const id = `bx-${gi}-${i}`, p = price(c);
      return `<span class="pchip"><input type="radio" id="${id}" name="bx-${gi}" value="${label(c).replace(/"/g, '&quot;')}"${i === 0 ? ' checked' : ''}>`
        + `<label for="${id}">${short(label(c))}${p ? `<span class="pchip__plus"> +${money(p)}</span>` : ''}</label></span>`;
    }).join('');
  });

  const status = form.querySelector('[data-box-status]');
  const unit = () => groups.reduce((sum, g) => sum + price(g.choices.find((c) => label(c) === picks[g.name]) || 0), Number(item.price) || 0);
  const update = () => {
    const t = money(unit());
    form.querySelectorAll('[data-box-price], [data-box-price-tag]').forEach((el) => { el.textContent = t; });
    const more = form.querySelector('[data-box-more-sum]');
    if (more) more.textContent = `${short(picks.Achar || '')} · ${picks.Size || ''}`;
    const tag = form.querySelector('.boxer__price-tag');
    if (tag) { tag.classList.remove('is-bump'); void tag.offsetWidth; tag.classList.add('is-bump'); }
  };

  form.addEventListener('change', (e) => {
    const r = e.target;
    if (r.type !== 'radio') return;
    const gi = Number(r.name.slice(3));
    if (groups[gi]) picks[groups[gi].name] = r.value;
    update();
  });

  const KEY = `wsv2:cart:${S.slug}`;
  function addWithOptions() {
    try {
      const probe = '__lg_probe';
      localStorage.setItem(probe, '1'); localStorage.removeItem(probe);
      let data;
      try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { data = null; }
      if (!data || typeof data !== 'object' || !Array.isArray(data.lines)) data = { v: 1, lines: [], mode: 'pickup', tip: (S.order && S.order.defaultTip) || 0 };
      data.lines = data.lines.filter((l) => l && typeof l === 'object');
      const opts = Object.assign({}, picks);
      const max = (S.order && S.order.maxQty) || 20;
      const same = data.lines.find((l) => l.id === BOX_ID && JSON.stringify(Object.keys(l.opts || {}).sort().map((k) => [k, l.opts[k]])) === JSON.stringify(Object.keys(opts).sort().map((k) => [k, opts[k]])));
      if (same && (Number(same.qty) || 0) >= max) return 'max';
      if (same) same.qty = (Number(same.qty) || 0) + 1;
      else data.lines.push({ id: BOX_ID, qty: 1, opts, note: '' });
      const nv = JSON.stringify(data);
      localStorage.setItem(KEY, nv);
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: nv }));
      return true;
    } catch { return false; }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const res = addWithOptions();
    const ok = res === true;
    if (res === 'max') {
      if (status) status.textContent = `Limit reached: you already have ${(S.order && S.order.maxQty) || 20} of this box in your order.`;
      return;
    }
    if (!ok) {
      // storage blocked: let core add the default box; the guest picks options in the cart
      const b = doc.createElement('button');
      b.type = 'button'; b.hidden = true; b.dataset.add = BOX_ID;
      doc.body.appendChild(b); b.click(); b.remove();
    }
    const desc = `${picks.Filling}, ${short(picks.Style)}, ${picks.Size}`;
    if (status) status.textContent = ok
      ? `Added: ${desc} box, ${money(unit())}. Open your order to check out.`
      : `Added a momo box. Choose filling and style in your order.`;
    const btn = form.querySelector('.boxer__add');
    if (btn) { btn.classList.remove('is-added'); void btn.offsetWidth; btn.classList.add('is-added'); }
  });

  update();
}

/* marquee pause/play (WCAG 2.2.2) */
const mq = doc.querySelector('[data-marquee]');
const mqBtn = mq && mq.querySelector('[data-marquee-toggle]');
if (mqBtn) {
  mqBtn.addEventListener('click', () => {
    const paused = mqBtn.getAttribute('aria-pressed') !== 'true';
    mqBtn.setAttribute('aria-pressed', String(paused));
    mq.classList.toggle('is-paused', paused);
  });
}
