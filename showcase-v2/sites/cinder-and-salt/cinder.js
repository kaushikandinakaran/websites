/* Cinder & Salt: site-only enhancements (ES module, no dependencies, no network).
   1. Renders the home "cuts" table from window.SITE (single source of truth for names and prices).
      Its Add buttons use core's delegated [data-add] hook, so the cart, drawer and live region work unchanged.
   2. Renders the footer hours list from SITE.hours (so it can never disagree with the hours table).
   Motion is pure CSS (scroll-driven, inside prefers-reduced-motion: no-preference), so nothing here animates. */
const S = window.SITE || {};
const box = document.querySelector('[data-cuts]');
if (box && Array.isArray(S.menu)) {
  const cat = S.menu.find((c) => c.id === 'cuts');
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);
  let fmt;
  try { fmt = new Intl.NumberFormat(S.locale || 'en-US', { style: 'currency', currency: S.currency || 'USD' }); }
  catch { fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); }
  if (cat && cat.items && cat.items.length) {
    const rows = cat.items.map((it, i) => `
      <tr>
        <th scope="row" class="cuts__cut"><span class="cuts__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="cuts__name">${esc(it.name)}</span><span class="cuts__char">${esc(it.cut || '')}</span></th>
        <td class="cuts__w" data-label="Approx. weight">${esc(it.weight || '')}</td>
        <td class="cuts__s" data-label="Serves">${esc(it.serves || '1')}</td>
        <td class="cuts__p" data-label="Price">${esc(fmt.format(Number(it.price) || 0))}</td>
        <td class="cuts__a"><button type="button" class="btn btn--primary btn--sm cuts__add" data-add="${esc(it.id)}"><span class="dish__add-label" aria-hidden="true">Add</span><span class="vh">Add ${esc(it.name)} to order</span></button></td>
      </tr>`).join('');
    box.innerHTML = `<table class="cuts__table">
      <caption class="vh">Steak cuts with approximate weight, how many each serves, and price</caption>
      <thead><tr><th scope="col">Cut</th><th scope="col">Approx. weight</th><th scope="col">Serves</th><th scope="col">Price</th><th scope="col"><span class="vh">Order</span></th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }
}

/* footer hours from SITE.hours: groups days with identical ranges ("Tue, Wed  5 pm to 10 pm") */
const fh = document.querySelector('[data-footer-hours]');
if (fh && Array.isArray(S.hours) && S.hours.length) {
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const NAMES = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  const t = (hm) => {
    const [h, m] = hm.split(':').map(Number);
    const ap = h >= 12 && h < 24 ? 'pm' : 'am'; const h12 = h % 12 || 12;
    return h === 12 && !m ? '12 pm' : h === 0 && !m ? 'midnight' : `${h12}${m ? ':' + String(m).padStart(2, '0') : ''} ${ap}`;
  };
  const label = (d) => {
    const r = S.hours.filter((x) => x.day === d && !x.closed && x.open && x.close);
    const rng = (o, c) => { const a = t(o), b = t(c); const sa = a.split(' '), sb = b.split(' '); return sa[1] && sa[1] === sb[1] ? `${sa[0]}–${b}` : `${a}–${b}`; };
    return r.length ? r.map((x) => rng(x.open, x.close)).join(', ') : 'Closed';
  };
  const groups = [];
  for (const d of DAYS) {
    const l = label(d), g = groups[groups.length - 1];
    if (g && g.l === l) g.days.push(d); else groups.push({ l, days: [d] });
  }
  const span = (ds) => (ds.length > 2 ? `${NAMES[ds[0]]} to ${NAMES[ds[ds.length - 1]]}` : ds.map((d) => NAMES[d]).join(', '));
  const esc2 = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  fh.innerHTML = groups.map((g) => `<li><span>${esc2(span(g.days))}</span> ${esc2(g.l)}</li>`).join('');
}
