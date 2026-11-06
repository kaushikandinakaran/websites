# Shared core (READ-ONLY for site builders)

`core.js` (ES module, no dependencies, no network) + `base.css` (reset, tokens, structural CSS). Start every site by copying `sites/_template/` and changing **site.js** (content) and **style.css** (look). If `shared/` needs a fix, report it to the manager; do not edit it.

Each page loads, in this order:
```html
<link rel="stylesheet" href="../../shared/base.css">
<link rel="stylesheet" href="style.css">
<script src="site.js"></script>
<script type="module" src="../../shared/core.js"></script>
```
Serve over http (`python serve.py 8810`): ES modules do not run from `file://`.

## Hooks you must keep
The full, authoritative list is the comment block at the top of `core.js`. Summary:

| Area | Hooks |
|---|---|
| Page | `body[data-page=home/menu/checkout]`, `.skip-link[href="#main"]`, `main#main[tabindex=-1]` |
| Header | `[data-header]` (core sets `[data-scrolled]`), `nav#site-nav[data-nav]`, `[data-nav-toggle]` (aria-controls="site-nav") |
| Cart | `[data-cart-open]` (any opener), `[data-cart-count]`, `[data-cart-count-label]`, `[data-cart-total]`, `[data-add="<itemId>"]`. The drawer `#cart-drawer` and the live region `[data-live]` are **injected by core** (style their classes: `drawer__*`, `cart-line*`, `qty*`, `totals*`) |
| Phone bar | `[data-mobile-bar]` with `[data-mbar-order]` (link, empty cart) + `[data-mbar-cart][data-cart-open]` with `[data-mbar-cart-label]` (cart has items), Book link, `[data-tel]` Call link; `[data-to-top]` |
| Content | `[data-site="path"]` (e.g. `contact.address`), `[data-tel]`, `[data-directions]`, `[data-delivery-apps]`, `[data-year]` |
| Hours | `[data-open-status]` (core sets `data-state=open/closing/closed/unknown`), `[data-hours]` |
| Menu | `[data-signature][data-limit]`, `[data-menu]`, `[data-menu-nav]`, `[data-menu-search]`, `[data-menu-filters]` (role=group + aria-label), `[data-menu-status]` (role=status), `[data-menu-empty]` + `[data-menu-clear]` |
| Booking | `form#reserve-form[data-reserve][novalidate]`, ids `r-date r-time r-party r-name r-phone r-email r-notes`, `[data-error-summary]`, `[data-reserve-confirm]` with `[data-reserve-confirm-heading] [data-reserve-ref] [data-reserve-summary] [data-reserve-again]` |
| Checkout | `[data-checkout-empty]`, `[data-checkout-root]`, `form#checkout-form[data-checkout]`, radios `mode` (ids `mode-pickup`, `mode-delivery`), `when` (`when-asap`, `when-later`), `pay` (`pay-later`, `pay-card`); `[data-delivery-fields]` (c-address1, c-address2, c-postcode, c-instructions), `[data-pickup-info]`, `[data-ready-estimate]`, c-name, c-phone, c-email, `[data-slot-wrap]` > `#c-slot[data-slot-select]`, `[data-tip-options]`, `[data-card-fields]` (c-ccname, c-ccnumber, c-ccexp, c-cccsc), `[data-pay-later-label]`, `[data-wallet]`, `[data-place-order]` > `[data-place-total]`, `details[data-summary-details]` > `[data-summary-total]` + `[data-order-summary]`, `[data-edit-order]`, `[data-confirmation]` with `[data-conf-heading] [data-conf-number] [data-conf-time] [data-conf-mode] [data-conf-name] [data-conf-pay] [data-conf-summary]` |

Event for animation: `document.addEventListener('site:cart', e => e.detail)` gives `{count, subtotal, total, mode, action:{type, id}}`, with `type` one of add, inc, dec, remove, opts, mode, tip, clear, sync.

## SITE config (site.js)
```js
window.SITE = {
  slug: 'mustang-hearth',            // REQUIRED and unique: the cart is stored under wsv2:cart:<slug>
  name: 'Mustang Hearth', tagline: '...', cuisine: 'Indo-Nepali',
  locale: 'en-US', currency: 'USD',
  contact: { address: '[address]', phone: '[phone]', phoneTel: '+15555550100', email: '[email]', directionsUrl: '' },
  hoursAreSample: true,
  hours: [ { day: 'mon', closed: true }, { day: 'tue', open: '11:30', close: '14:30' }, { day: 'tue', open: '17:00', close: '22:00' },
           { day: 'sat', open: '17:00', close: '01:00' } ],  // several ranges per day OK; close <= open = past midnight
  timing: { pickupMinutes: 20, deliveryMinutes: 45, slotStepMinutes: 15 },
  order: { delivery: true, deliveryFee: 3.5, deliveryMinimum: 15, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0, maxQty: 20 },
  reservation: { stepMinutes: 30, lastSeatingMinutes: 60, leadMinutes: 60, maxParty: 8, defaultParty: 2, daysAhead: 60 },
  deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],   // shown as plain text, never links
  tags: { vegetarian: { label: 'Vegetarian' }, vegan: { label: 'Vegan' }, spicy: { label: 'Spicy' },
          'gluten-free': { label: 'Gluten-free [to confirm]' } },  // filter chips appear only for tags used by dishes
  ui: { cartTitle: 'Your order', popularLabel: 'Signature', addLabel: 'Add', addedLabel: 'Added' },
  schema: true,                      // false = no JSON-LD
  menu: [ { id: 'momo', name: 'Momo', description: 'optional', items: [
    { id: 'jhol-momo', name: 'Jhol momo', description: '...', price: 12.5, tags: ['spicy'], popular: true,
      img: { src: 'images/jhol-momo-800.jpg', srcset: 'images/jhol-momo-480.jpg 480w, images/jhol-momo-800.jpg 800w',
             sizes: '(min-width: 60em) 30vw, 92vw', alt: 'Dumplings in a red broth', width: 800, height: 600 },
      options: [ { name: 'Filling', choices: ['Chicken', { label: 'Paneer', price: 1 }] } ] } ] } ]
};
```
Item ids must be unique across the whole menu. Prices are numbers. `popular: true` items fill the home strip. Options default to the first choice; guests change them in the cart.

## Restyling safely: checklist
1. Change `slug` first. Then override tokens in `:root` of `style.css` (`--bg --surface --surface-2 --text --muted --accent --accent-contrast --line --radius --font-display --font-body`, spacing/type scales).
2. Keep every hook above, the skip link, the sticky phone bar, the open-now line, menu filters, booking form and checkout page. Reorder and redesign sections freely.
3. Do not set `display`/`position` on `.drawer*`, `.mbar`, `.site-header`, `.site-nav` (phone panel), `.to-top`, or anything core toggles with `[hidden]`. Colours, borders, fonts and shadows are fine.
4. If you change `--header-h` / `--header-h-small`, keep both: the body padding and the anchor offset use them.
5. Text over photos must still reach 4.5:1 (add a scrim). Keep focus visible: if your header/footer is dark, set a light `outline-color` there (see template `.infobar`, `.site-footer`).
6. Targets 44x44 on phones. Motion only inside `@media (prefers-reduced-motion: no-preference)`.
7. Fonts: at most 2 families, local `woff2` with `font-display: swap`. No CDN, no network requests.
8. Footer on every page: "Sample design by Website Studio. Menu and prices are samples." Placeholders stay marked `[like this]`.
9. Rerun `qa/core_smoke.py --site <slug>` (must stay all PASS).

## Known limits
- With storage blocked, the cart works in memory on the current page only; it is lost when going to another page.
- Open/closed uses the viewer's local clock, not the restaurant's time zone.
- Menu, cart and checkout need JavaScript (a `<noscript>` call-to-order note is shown). JSON-LD is injected by JS.
- One option set per item is picked in the cart, not in a dialog before adding.
- No real payment, no network: wallet buttons and card fields are demo only; card fields are format-checked and wiped, never stored.
- If the restaurant is closed now, checkout switches to "Schedule for later" automatically and ASAP is disabled.

## Change log
**2026-11-05: layout-shift (CLS) guard.** core.js fills the menu, signature strip, hours and checkout after first paint, which made the page jump (template menu CLS 0.386 at 1440 / 0.700 at 390; checkout 0.132 / 0.257). Now:
- `base.css`: until core adds `html.js-ready`, each JS-filled hook (`[data-signature] [data-hours] [data-menu-filters] [data-menu-status] [data-menu-nav] [data-menu] [data-checkout-empty] [data-checkout-root]`) **and everything after it in the document** is laid out but `visibility:hidden`, so the fill cannot visibly move anything. The header, sticky phone bar, back-to-top and all content above the first hook paint immediately. Fail-safe: a CSS animation shows everything after 3 s if JS never runs (also covers JS-off).
- `core.js`: each boot step is guarded (errors rethrown asynchronously), and `js-ready` is added in the same frame as the render.
- Result (template, 4x CPU, 1.6 Mbps, 150 ms): menu 0 / 0.0095, checkout 0 / 0, home 0.003 / 0.002.
- **Site-side change needed: none.** Optional cleanup: per-site workarounds such as `[data-menu]:empty { min-height }` can be removed. Do not use `visibility: visible` or GSAP `autoAlpha` on content after a hook before `js-ready` (it would re-expose the shift). If you run entrance animations, start them after `html.js-ready` (e.g. on the `DOMContentLoaded` that follows, or check `document.documentElement.classList.contains('js-ready')`).

**2026-11-05: back-to-top and checkout time line (QA-REPORT-cinder-and-salt issues 1 and 4).**
- `[data-to-top]` is now an icon-only 44x44 round button (its text stays the accessible name; arrow drawn in CSS with `currentColor`). Below 80em it appears only when the page is scrolled to the very end, centred in a reserved 60px strip under the footer and above the sticky bar (`--totop-strip`, added to body bottom padding), so it can never cover content. From 80em it floats bottom-right in the side gutter after scrolling 1.2 screens. Sites may restyle colours, border and radius only; do not change its size, position or `font-size`.
- Checkout: changing `#c-slot` now updates `[data-ready-estimate]` immediately (the ASAP/schedule switch already did).
- Site-side change needed: none.

**2026-11-05: form validation (QA-REPORT-butter-and-bloom issue 13), booking and checkout.**
- Every field is checked in one pass, and all errors are listed together in the summary.
- After the first failed submit, the inline messages and the error summary now update live as the guest types (no focus moves). Before this, the summary kept the stale messages from the empty submit ("Enter your name", no email line) until the next submit.
- A value shorter than `minlength` now says "Name looks too short. Enter at least 2 characters." instead of a required-style message.
- Site-side change needed: none.

**2026-11-05: accessible names (QA of le-petit-marais).**
- `base.css`: CSS-generated symbols now use empty alt text (`content: "+" / ""`, with a plain fallback line), so screen readers no longer read them: the order-summary `+`/`−` toggle, the `✓` on pressed filter chips and the `!` before field errors. The back-to-top arrow already had no text.
- `core.js`: header-style cart buttons (`[data-cart-open]` containing `[data-cart-count]`, not the phone-bar button) get `aria-label="<word>, N items"`, where the word is the button's own `.cart-btn__text` (default "Cart"). The name survives even if a site hides the word at narrow widths.
- Builder rule: to hide `.cart-btn__text` on small screens, prefer visually hidden (the `.vh` pattern) over `display:none`; both now keep the name. Site-side change needed: none.

**2026-11-05: next order starts clean (QA of jasmine-lane).** After an order is placed, core now resets the tip to `order.defaultTip`, together with the cart lines and their kitchen notes, which were already cleared. The time choice is never stored; the form resets to ASAP. Pickup/delivery is kept as the guest's preference. Site-side change needed: none.
