# QA report: cinder-and-salt (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05 (Thursday, about 22:00 local; the sample restaurant was "Closing soon, until 10:30 PM" during testing).
Method: headless Chrome only (`channel='chrome'`, `--headless=new`), `serve.py 8841` (stopped afterwards). Site files were not modified.
Scripts (scratchpad): `qa-cinder/flows.py`, `layout.py`, `perf.py`, `hdr.py`, `nojs.py`. Raw results: `flows.json`, `layout.json`, `perf.json` in the same folder.
Screenshots: `qa/screens-cinder-and-salt/` (34 jpg files).

## Verdict: FAIL (close; the site's own fixes are small)

Things that work: the order path, every total, all photos and alt texts, the content rules, 0 console errors, the mandatory footer lines.
It fails on one brief trigger: **a visible layout defect on phone**. The floating "Back to top" pill covers content at 390 px, including the last dish's **Add** button (issue 1).
It also misses the spec "every menu item with a real photo" (15 of 28 dishes have no photo). The hours in the footer contradict the hours table (issue 3).
Two of the defects come from `shared/` (issues 1 and 4): the manager must fix those in core. The site builder cannot.

## Summary table

| Area | Result | Evidence |
|---|---|---|
| Shared smoke `qa/core_smoke.py --site cinder-and-salt --port 8841` | **38/38 PASS** | `qa/core_smoke_cinder-and-salt.json` |
| Order path 390x844 touch (home → Order → 2 Adds → View order → Checkout → name → phone → Place order) | **PASS, 8 taps** (target ≤ 8) | p01–p05 |
| Totals (computed by me separately) | **PASS** in all 9 cases | see §2 |
| Delivery, minimum, tip, scheduled time | PASS, but the estimate line goes stale (issue 4) | p06, p07 |
| Empty cart, qty +/−, option price, remove, reload persistence | PASS | p08, p09 |
| Book a table: validation + confirmation | PASS (Book tap + 3 interactions) | p10–p12 |
| Photo truthfulness (17 photos, each looked at) | **PASS, 0 mislabelled** | §3 |
| Every item has a photo (BRIEF §7) | **FAIL: 15/28 have no photo** | issue 2 |
| Filters, search, jump bar | PASS | §3 |
| Broken links / images (all 3 pages) | **0 broken** (38 image URLs, all links, all `#` anchors resolve) | layout.json |
| Content rules / footer lines on every page | PASS (credits not checkable: `photos/CREDITS.md` does not exist) | issue 6 |
| Console / page errors, 4 viewports, all flows | **0** | flows.json, layout.json |
| Horizontal scroll (3 pages x 4 viewports) | **0 px** everywhere | layout.json |
| CLS (full scroll) | max 0.0011 | layout.json |
| Phone layout | **defect: Back-to-top pill covers content** | p02, p11, slices |
| Performance (throttled phone) | home 534 KB, LCP 2.20 s median; menu 468 KB, LCP 1.66 s | §6 |
| Keyboard order path (1440) | PASS (72 key presses, focus ring 3 px visible) | kbd-confirmation-1440.jpg |
| Reduced motion | PASS: every animation `none` | layout.json |
| JS disabled | home/menu OK with noscript notes; checkout shows a dead $0.00 form | nojs-*.jpg, issue 9 |
| Storage blocked | PASS: cart works in memory, 0 errors; lost on page change (documented core limit) | nostorage-checkout-390.jpg |

## 1. Conversion path (390x844, touch, DPR 2)

| # | Tap | Result |
|---|---|---|
| 1 | Sticky bar **Order** | menu.html |
| 2 | Add **Ribeye** ($48) | button turns green "Added"; the sticky bar becomes "VIEW ORDER (1) · $48.00" |
| 3 | Add **Lamb cutlets** ($36) | sticky bar "VIEW ORDER (2) · $84.00" |
| 4 | **View order** | drawer: Subtotal $84.00, "Checkout · $84.00" |
| 5 | **Checkout** | checkout.html; Pickup and ASAP preselected; "Ready in about 25 minutes (around 10:25 PM)"; summary $84.00 |
| 6–7 | Name, phone | typed |
| 8 | **Place order · $84.00** | "Thank you, your order is in", **#3010**, "Today, 10:25 PM (about 25 minutes)", Pickup at [address], Pay at pickup, total $84.00; cart badge back to 0 |

Confusing points: (a) "Back to top" floats over the card text while you scroll (issue 1). (b) The sticky-bar label "VIEW ORDER (2) · $84.00" wraps onto 2 lines in a narrow button (p02); it is readable but cramped. (c) The drawer has no item thumbnails (core design; acceptable).

## 2. Totals: expected (my own arithmetic) vs shown

| Case | Expected | Shown |
|---|---|---|
| Ribeye + lamb cutlets | 48 + 36 = $84.00 | $84.00 (sticky bar, drawer, place-order button, summary, confirmation) |
| Oysters + tomahawk | 21 + 128 = $149.00 | $149.00 |
| Oysters x2 | 42 + 128 = $170.00 | $170.00 |
| Oysters "Dozen (+$19)" x2 | (21+19)x2 + 128 = $208.00 | $208.00 ("$80.00 ($40.00 each)") |
| Remove tomahawk | $80.00 | $80.00 |
| Oysters − 1 | $40.00 | $40.00; reload → still 1 item, $40.00; home shows the same |
| Bread, delivery | 7 + 5 fee = $12.00, below the $30 minimum | "$12.00" + error "Delivery needs a subtotal of at least $30.00 (sample rule). Add more or choose pickup." |
| Bread + striploin, delivery, 15% tip | 49 + 5 + 7.35 = $61.35 | $61.35 (summary rows, button, confirmation) |
| All 28 items once | sum of `site.js` prices = $743.00 | $743.00, count 28 |

Prices on all 28 cards are numbers and match `site.js` (0 mismatches).

## 3. Menu and photos

I opened all 17 photos the site uses and compared each one with its dish name, description and alt text:
- oysters on ice ✔, bone marrow ✔, striploin on grill ✔, ribeye on wood ✔, sliced hanger with salt and rosemary ✔, T-bone raw on the grill ✔ (alt says "raw"; the bone is not clearly visible but nothing is false), tomahawk ✔, lamb cutlets with green pepper and tomato ✔, rack of lamb with polenta and tomato ✔, braised shin on the bone with mash and okra ✔, sliced steak with herbs ✔, asparagus in a grill basket over coals ✔, chocolate caramel tart with spun sugar ✔.
- Decorative/story photos: hero bone-in steak over flame ✔, tongs over flames ✔, cook slicing pink beef ✔, brick booths ✔, table setting (alt="" as decorative) ✔.
- **No mislabelled photo.**
- **15 items have no photo:** tartare, beetroot, bread, fillet, half chicken, chips, spinach, cabbage, the 4 sauces, cheesecake, lemonade, espresso. They render as text cards with an ember left border (issue 2).
- Filters: only Vegetarian (6) and Vegan (4) chips appear. Each shows exactly the tagged items ("Showing 6 of 28 dishes."). No gluten-free claims.
- Search "lamb" → 2 lamb dishes. "zzzz" → empty state + "No dishes match your search or filters.". Clear restores all.
- Jump bar: all 6 links scroll their section into place below the sticky header and bar; scroll-spy highlights the right chip.

## 4. Content rules

- "Sample design by Website Studio. Menu and prices are samples. Photos are stock." is present on index, menu and checkout.
- Placeholders are marked: [address], [phone], [email], [neighbourhood], [Guest reviews: client to supply], [Press mentions: …], [Beef supplier and farm: …], [Wording: client to confirm/edit], [Room details: client to confirm], [map], weights "[to confirm]", "Sample hours: client to confirm", "(sample hours)".
- A text scan for since/years/award/rated/stars/Michelin/organic/halal/wagyu/dry-aged/grass-fed/prime/locally found **nothing** (only "2 guests…8 guests" in the party picker and the © year).
- "Order with us and skip the app fees. [Wording: client to edit]" follows BRIEF §6.
- Credits: the footer says "photographer names: see photos/CREDITS.md [to confirm]", but **`photos/CREDITS.md` does not exist** (neither does `photos/INDEX.md`). The credits cannot be verified (issue 6).

## 5. Layout (screenshots looked at: L-index/menu/checkout/drawer at 1440, 1024, 390, 360, plus 23 viewport slices at 390)

- 1440: strong. Full-bleed hero, signature strip, an editorial cuts table with oversized italic numerals, a dark story section and a brick-room band. Nothing overlaps.
- 1024: **the header is cramped**. Every nav label wraps onto 2 lines ("THE / CUTS", "HOURS & / LOCATION", "BOOK A / TABLE"), and so do the brand "Cinder & / Salt" and "ORDER / ONLINE" (header-1024.jpg). This also happens at 1100; it is fine at 1200.
- 390 / 360: the layout is clean, there is no horizontal scroll and the targets are big enough. Defects:
  - **"Back to top" pill covers content.** It sits over the Espresso **Add** button at the end of the menu (slice-menu-390-07), over card descriptions (p02, "On the bone, slo…"), over the story copy, the booking form "Party size" field (p11) and the copyright line.
  - **Hero on phone shows no recognisable food.** The 3:2 photo is cropped to the smoky top-left part; the steak is a brown blur behind the text (p01). The photo that should "sell" is lost on the main device.
  - Story section at 390: the chef photo is offset right with a large empty black block on its left (slice-home-390-06). It reads as a gap, not as an asymmetric design.
  - 360 checkout header: the brand wraps to "Cinder & / Salt" and "Back to / menu" wraps (L-checkout-360). Minor.
- Desktop menu grid: photo cards and short text-only cards sit in the same rows. Text cards end halfway down, leaving big empty holes (Beef tartare, Fillet, Half chicken, Sides; L-menu-1440).
- Drawer at 1440/360: fine. The "Remove" link is indented about 8 px compared with the item name (core markup plus site style); cosmetic.

## 6. Performance (390x844, DPR 3, 4x CPU, 1.6 Mbps down / 750 kbps up / 150 ms RTT, cache off, 3 runs)

| Page | First-view bytes (median) | LCP median (runs) | Load median | LCP element |
|---|---|---|---|---|
| Home | **534 KB** (534/534/534) | **2196 ms** (2196/2564/2056) | 2798 ms | hero `01-ribeye-over-flame-1600.webp` (82 KB) |
| Menu | **468 KB** (277/468/468) | **1660 ms** (1804/1560/1660) | 2261 ms | menu-hero background `06-tongs-over-flames-1600.webp` (109 KB) |

- Both pages are within budget: home is under 1.5 MB and the hero under 200 KB.
- All images are WebP: 9–110 KB each, 400/800/1600 widths, explicit width and height, `loading=lazy` below the fold.
- Waste: the menu's darkened, decorative `aria-hidden` background loads the 1600 px file (109 KB) and becomes the LCP. The home page also pulls the 1600 px story photo (109 KB) in the first view on a DPR-3 phone.
- No web fonts are loaded at all; the font stacks are system fonts (see issue 8).

## 7. Keyboard, reduced motion, JS off, storage blocked

- Keyboard at 1440: first Tab = skip link; then header "Order online" → Enter → Tab to Add → Enter, next Add → Enter → Shift+Tab back to the cart button → Enter → Tab to Checkout → Enter → name, phone → Place order → confirmation #7215. 72 key presses in total (long, because of the many Tabs; the path works). The focus ring is a solid 3 px orange.
- Reduced motion: `.hero__img`, `.ticker__track`, `.hero__title`, the scroll-driven room/cuts animations all `none`. Without the setting they are ember-zoom, ticker, rise, brighten-drift and slide-in.
- JS disabled: home and menu show noscript call-to-order notes and the hero is visible. **Checkout shows a full $0.00 form that cannot work and no explanation**: no noscript note, and for the first 3 s it is a blank page (nojs-checkout-390.jpg).
- Storage blocked (localStorage and sessionStorage throw): add 2 → count 2, $55.00, 0 errors. On checkout: "Your order is empty". This is the documented limit, but a guest with blocked storage cannot order at all.

## Issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | **High (FAIL trigger)**, shared core | The fixed "Back to top" pill (base.css `.to-top`, bottom-right above the sticky bar) covers phone content, including the last menu card's **Add** button and form fields | slice-menu-390-07 (scratch), p02, p11, p12 | Manager/core: on phones (`max-width: 47.99em`) hide `.to-top`, or make it a 44 px icon-only circle placed in the sticky bar. Alternatively add bottom padding to `main` equal to the pill height so the last content can scroll clear. Site only: shrink it to an icon via `style.css` (colour/size are allowed) |
| 2 | Medium (spec gap) | 15 of 28 dishes have no photo. BRIEF §7: "Hero and every menu item with a real photo". On desktop the mixed cards leave ragged holes in the grid | flows.json `items_without_photo`, L-menu-1440 | Add truthful stock photos for at least fillet, tartare, chips, half chicken, cheesecake, spinach, cabbage, bread (sauces/drinks could share one honest "sauces" photo). Otherwise give text-only items a compact list layout (sauces/drinks as a price list) so the grid has no holes |
| 3 | Medium (wrong info) | The footer hours on home say "Tue to Thu 5 pm to 10 pm", but `site.js` and the hours table say Thursday 5:00–10:30 PM | slice-home-390-12 vs slice-home-390-08 | Make the footer list "Tue, Wed 5 pm to 10 pm / Thu 5 pm to 10:30 pm", or render it from `data-hours` instead of hard-coding |
| 4 | Medium, shared core | Checkout "Schedule for later": changing the time in `#c-slot` does not update the estimate line. It kept saying "Ready for pickup: Today, 10:30 PM" after I chose "Tomorrow, 1:00 PM" (in an earlier run "Delivery: Tomorrow, 1:00 PM" while 1:30 PM was chosen). The confirmation uses the right time | layout.json `slot_estimate`, p07 | core.js form `change` handler: add `else if (n === 'c-slot') syncCheckoutUI();` |
| 5 | Medium (design) | Phone hero shows no recognisable food: the steak is cropped out and blurred behind the scrim and text | p01 | Set `object-position` for `.hero__img` on phones (e.g. `70% 60%`) or use a portrait crop / a separate phone image where the steak sits above the headline. Lighten the scrim over the photo area |
| 6 | Medium (content rule) | The footer points to `photos/CREDITS.md`, which does not exist, so the credits cannot be checked | `ls photos/` | Library owner: write `photos/CREDITS.md` with photographer, source and licence per file (cinder-and-salt 01–18). Builder: keep the footer link or list the names |
| 7 | Low–Medium | At 1024 px (a quality-bar viewport) every header nav label, the brand and "Order online" wrap onto 2 lines | header-1024.jpg, L-index-1024 | Switch to the hamburger nav below about 1200px, or drop "The fire" and shorten to "Hours", "Book" at 60–75em; add `white-space: nowrap` to nav links |
| 8 | Low (brand consistency) | Fonts are system stacks ("Bodoni 72"/Didot → Georgia/serif; Bahnschrift → system sans). The display face will differ on Android, iOS and Windows, so the brand look is not fixed. The shared README asks for local woff2 | style.css lines 25–26 | Bundle one display serif (e.g. Bodoni Moda / Libre Bodoni, OFL) and one sans as local woff2 with `font-display: swap` |
| 9 | Low, template/core | With JS off, checkout shows a working-looking $0.00 form and no noscript message; blank for the first 3 s | nojs-checkout-390.jpg | Add `<noscript><p>Ordering needs JavaScript. Please call [phone].</p></noscript>` to checkout.html (and the template) |
| 10 | Low | Menu hero background (decorative, darkened) loads the 1600 px image (109 KB) and becomes the menu LCP | perf.json | `srcset` limited to 400/800 with `sizes="100vw"` and `fetchpriority="low"`, or use a CSS gradient |
| 11 | Low (copy) | The "popular" badge reads "FROM THE FIRE", which is also a category name. Bone marrow ("To begin") is badged "From the fire", and so are the lamb cutlets inside the "From the fire" section | slice-menu-390-01, p02 | Change `ui.popularLabel` to "Signature" or "Chef's pick" |
| 12 | Low | Price format differs: the cuts table shows "$96", while the cards, cart and checkout show "$96.00" | slice-home-390-05 | Use 2 decimals in cinder.js `fmt` (or 0 decimals everywhere) |
| 13 | Low | Story section at 390: the chef photo is offset right, with an empty black block left of it | slice-home-390-06 | At phone width make the two story figures full width or a 2-up row |
| 14 | Info | The latest ASAP pickup offered is 10:30 PM, exactly the sample closing time | p04 | Optional core rule: last order = close − pickupMinutes |

## Design rating: 7/10

Why it is good: it reads as a premium steakhouse at desktop width. Near-black and ember orange with bone-white type; a large high-contrast Didone display face; a strong editorial cuts table with italic numerals; real, appetising, consistent dark food photography; a slow ticker; and scroll-lit photos with real restraint. The order path is fast and the checkout feels trustworthy.

Why not higher:
- On a phone, the first screen shows a brown blur instead of a steak.
- Half the menu is text-only, so the menu looks unfinished next to the photo cards.
- The header breaks at 1024.
- The fonts depend on the device, so on Android/Windows it looks more generic than on a Mac.
- Text-heavy uppercase tracking (letter-spaced eyebrows everywhere) gets repetitive.

What a client would criticise first:
1. "Where's the steak on my phone?"
2. "Why do my fillet, chips and desserts have no pictures?"
3. "The menu bar looks broken on my laptop."
4. "Thursday hours are wrong in the footer."
5. "That 'Back to top' button is covering the Add button."

## Not tested

- Real phones, Safari and Firefox. Real screen readers (axe via the smoke test only).
- An "open now, not closing soon" or fully "closed" clock state: the restaurant was closing soon throughout. The smoke script's fixed-clock open-now check was not part of this site run.
- Contrast was not re-measured beyond the smoke test's axe pass (0 violations).
