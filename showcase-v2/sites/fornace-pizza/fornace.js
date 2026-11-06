/* Fornace site extras (ES module, no network, no globals).
   1. [data-fz] text from SITE (pickup/delivery minutes, fee, minimum) so copy always matches the order settings.
   2. "Start my pizza" ([data-fz-open-cart]): after core adds the item, open the cart so options can be chosen.
   Motion lives in style.css under prefers-reduced-motion: no-preference. */
const S = window.SITE || {};
const doc = document;

let fmt;
try { fmt = new Intl.NumberFormat(S.locale || 'en-US', { style: 'currency', currency: S.currency || 'USD' }); }
catch { fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); }
const timing = Object.assign({ pickupMinutes: 20, deliveryMinutes: 45 }, S.timing);
const order = Object.assign({ deliveryFee: 0, deliveryMinimum: 0 }, S.order);
const values = {
  pickup: String(timing.pickupMinutes),
  delivery: String(timing.deliveryMinutes),
  fee: fmt.format(Number(order.deliveryFee) || 0),
  min: fmt.format(Number(order.deliveryMinimum) || 0),
};
for (const el of doc.querySelectorAll('[data-fz]')) {
  const v = values[el.dataset.fz];
  if (v != null && el.textContent !== v) el.textContent = v;
}

doc.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-fz-open-cart]');
  if (!btn) return;
  // core's delegated add handler ran first (registered earlier); now open the drawer via a visible opener
  setTimeout(() => {
    const opener = Array.from(doc.querySelectorAll('.site-header [data-cart-open], [data-mbar-cart]'))
      .find((el) => !el.hidden && el.offsetParent !== null);
    if (opener) opener.click();
  }, 120);
});
