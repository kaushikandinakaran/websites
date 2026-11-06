# QA report: olio-terrace (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05, Thursday 22:26 local. The sample restaurant was **"Closed now · opens tomorrow at 12:00 PM"** for the whole test, so checkout always preselected "Schedule for later". The ASAP path was not seen.
Method: headless Chrome only (`channel='chrome'`, `--headless=new`), `serve.py 8847` (stopped afterwards). I did not modify the site.
Scripts and raw results are in the scratchpad folder `qa-olio/`: `flows.py/json`, `layout.py/json`, `perf.py/json`, `misc.py/json`, `cls.py`, `cmp.py`.
Screenshots: `qa/screens-olio-terrace/` (40 jpg files).

## Verdict: FAIL (one blocking defect; it is a small fix)

Things that work: order and booking paths, every total, all 15 photos truthful, content rules, 0 console errors, the mandatory footer lines, and the back-to-top button.
It fails one brief trigger: **a visible layout defect on phone**. On `checkout.html`, the header **cart button is cut off the right edge** at 390 and 360. At 320 it is gone completely (issue 1). This is the same defect class the coordinator reported on mustang-hearth. The horizontal-scroll check misses it because the header clips its own overflow.

## Summary table

| Area | Result | Evidence |
|---|---|---|
| `qa/core_smoke.py --site olio-terrace --port 8847` | **40/40 PASS** | `qa/core_smoke_olio-terrace.json` |
| Order path 390x844 touch: Order → Add octopus → Add hummus → View order → Checkout → name → phone → Place order | **PASS, 8 taps** | p01–p05 |
| Mezze strip + live tally | Works, and totals are right. The "mezze" label is loose (issue 5) | p06, p07 |
| Totals (my own arithmetic, 12 cases) | **PASS, all match** | §2 |
| Delivery, minimum, tip, scheduled time line follows slot | PASS | p09, p10, p12 |
| Empty cart, qty +/−, option price, remove, reload persistence | PASS | p08, p11 |
| Book a table: validation + confirmation | PASS (Book tap + 3 interactions; empty submit flags name and phone; short name, short phone and bad email each get their own message) | p13, p14 |
| Photos: all 15 opened and compared with name, description and alt | **PASS, 0 mislabelled, counts correct** | §3 |
| Every item has a photo (BRIEF §7) | 10 of 14 dishes have one; 4 are text-only (issue 3) | L-menu-1440 |
| Filters, search, jump bar | PASS | smoke |
| Broken links / images (3 pages, 33 image URLs, all links and `#` anchors) | **0 broken** | layout.json |
| Content rules, footer lines on every page | PASS (copy promises "the oven", which has no dishes: issue 4) | §4 |
| Console / page errors (5 viewports, every flow) | **0** | all json |
| Horizontal scroll (3 pages x 6 widths incl. 320) | 0 px | layout.json |
| Header controls inside the viewport (390/360/320) | **FAIL on checkout at 390, 360 and 320; home and menu FAIL at 320** | H1–H4 |
| Header on one line at 1024 / 768 | PASS | L-index-1024, L-index-768 |
| Back-to-top | PASS: shown only in the reserved strip at the page end on phones; never covers content | smoke, s-i390c |
| Performance (throttled phone) | home 679 KB, LCP 2.58 s; menu 441 KB, LCP 1.98 s; checkout 136 KB, LCP 1.07 s | §6 |
| CLS | home **0.102 on the phone in 6/6 longer runs** (issue 2); menu 0.009; checkout 0 | cls.py |
| Keyboard order + booking (1440) | PASS (96 key presses to confirmation; 3 px white ring + 6 px navy halo) | k01, k02 |
| Reduced motion | PASS: every animation off (including the scroll-driven `olio-zoom view()`), scroll-behavior auto | misc.json |
| JS disabled | menu has a noscript note; **home and checkout have none**: checkout shows a dead $0.00 form | nojs-*.jpg |
| Storage blocked | PASS: cart and tally work in memory, 0 errors; empty on checkout (known core limit) | misc.json |

## 1. Conversion path (390x844, touch, DPR 2)

| # | Tap | Result |
|---|---|---|
| 1 | Sticky bar **Order** | menu.html |
| 2 | Add **Charred octopus** ($24) | |
| 3 | Add **Hummus & warm pita** ($9) | sticky bar "View order (2) · $33.00" |
| 4 | **View order** | drawer: Subtotal $33.00, "Checkout · $33.00" |
| 5 | **Checkout** | Pickup preselected; closed, so "Schedule for later" was chosen automatically; "Ready for pickup: Tomorrow, 12:30 PM" |
| 6–7 | Name, phone | |
| 8 | **Place order · $33.00** | "Thank you, your order is in", #1358, Tomorrow 12:30 PM, Pickup at [address], Pay at pickup, $33.00; badge back to 0 |

Mezze strip (home): Add hummus → tally "1 mezze · 1 dishes · $9.00". Then taverna salad → 2, $22.00. Calamari → 3, $36.00 (`data-ready`). Octopus from the signature strip → still 3 mezze, 4 dishes, $60.00. Hummus again → 4 mezze, $69.00. Platter from the hero postcard → **5 mezze**, 6 dishes, $95.00, with the plate dots capped at 4. In the drawer, hummus −1 → 4 mezze, $86.00. Every figure is correct.

## 2. Totals: expected (my own arithmetic) vs shown

| Case | Expected | Shown |
|---|---|---|
| Octopus + hummus | 24 + 9 = 33.00 | $33.00 (bar, drawer, button, confirmation) |
| Tally sequence above | 9 / 22 / 36 / 60 / 69 / 95 / 86 | identical |
| Souvlaki + Greek coffee + red mullet | 19 + 3.5 + 27 = 49.50 | $49.50 |
| Souvlaki "Both, half portions (+$2)" | 21.00 | $21.00 |
| … x2 | 42 + 3.5 + 27 = 72.50 | $72.50 ("$42.00 ($21.00 each)") |
| Remove mullet | 45.50 | $45.50 |
| Coffee −1 (removes it) | 42.00 | $42.00; reload → 2 items, $42.00; home badge 2 |
| Delivery | 42 + 4 = 46.00 | $46.00 |
| Delivery + 15% tip | 46 + 6.30 = 52.30 | $52.30 (summary rows + confirmation "Delivery to [test street 1], 00000") |
| Olives only, delivery | 7 < $20 minimum | "Delivery needs a subtotal of at least $20.00 (sample rule)…" |
| All 14 items once | 79 + 70 + 10 + 17.5 = 176.50 | $176.50, count 14 |

The price on every card equals `site.js` and is a number.

## 3. Menu and photos (each image opened and looked at)

- Mezze platter: hummus with tomato, baba ghanoush with pomegranate, labneh with dill, chopped aubergine-tomato salad, 2 vine leaves on tabbouleh with lemon. Matches the description ✔
- Hummus in a blue ramekin, paprika oil, 1 black olive, parsley, pita ✔ (the big sprig beside it looks like watercress; harmless)
- Olives: green pitted olives, 2 bread slices with paprika ✔. The copy says "in herbs and oil" and "grilled/toasted bread", but no herbs show and the bread is barely toasted (Low; issue 8)
- Dolmades: black pan, lemon wedge, mint, red and yellow cherry tomatoes (plus redcurrants) ✔
- Calamari: breaded rings and strips, lemon, leaves, white dip ✔
- Taverna salad: lettuce, red cabbage, tomato, cucumber, feta slab with oregano, 1 olive ✔
- Octopus: tentacle pieces on a ridged white plate, green herb oil, pepper ✔. Library photo 09 (octopus on grill) is not used.
- Red mullet: **5** fish on a round grill with lemon slices and parsley flecks. The alt says "Five" ✔
- Chicken souvlaki: **3** skewers, a **lime** wedge, parsley. The copy says "citrus" and the alt says "lime wedge" ✔ (the builder's note is verified)
- Baklava: **4** squares with pistachio. The copy says "Four pieces" ✔
- Scenes: bay-view terrace, white Santorini-style bench, table under whitewashed trees, harbour tables with blue gingham, oil poured on salad. All alts are true ✔
- **Counts stated in copy and alt (3 skewers, 4 pieces, 5 fish, 2 slices) all match the photos.**
- Menu size: **14 items, not 15**, and 10 dish photos, not 11. Text-only: lemon potatoes, extra pita, mint lemonade, Greek coffee.
- Filters: Vegetarian 7, Vegan 3 (correct tags). No gluten-free claim. Search and empty state OK. The jump bar's scroll-spy works.

## 4. Content rules

- "Sample design by Website Studio. Menu and prices are samples. Photos are stock." appears on index, menu and checkout ✔
- Placeholders are marked: [address] [phone] [email] [map] [Your story: client to supply…] [Producer: client to supply] [to confirm] [Guest reviews…] [Press mentions…, only if real] [Seating options…] [wording: client to edit] [Suggestion: client to edit] ✔
- No reviews, ratings, awards, years, counts or sourcing claims. "Charcoal" is marked [to confirm] ✔
- The footer hours (grouped from `SITE.hours`) equal the hours table and `site.js` ✔. The hero says "Pickup about 20 min / Delivery about 45 min" = `SITE.timing` 20/45 ✔ (hard-coded in the HTML, not read from SITE)
- Credits: `photos/CREDITS.md` now exists and lists all 16 olio files with photographer, URL and licence. The footer still says "Photographer names [to confirm]" (Low; issue 9).
- Copy promises "the oven" three times (home "From the charcoal, the sea and the oven", menu hero "the charcoal grill and the oven", menu meta "oven dishes"), but there is no oven category or dish (issue 4).

## 5. Layout

Screenshots I looked at: L-index/menu/checkout at 1440, 1024, 390, 360 (plus 768 for home), the drawer at 1440/390/360, and about 60 viewport slices at 390 and 360.
- 1440 / 1024 / 768: clean. Cream background, Aegean-blue wave section, arch-shaped photos, a serif display face with an italic terracotta accent, and a Greek-key footer border. The header fits on one line at 1024 and at 768 (where it switches to the toggle) ✔. In the desktop menu, the Sides row leaves 1 empty column (minor).
- 390 / 360: no horizontal scroll. The signature swipe row stays inside its scroller, the arches crop well, and the sticky bar has 44 px targets. **Defects:**
  - **Checkout header:** with "Back to menu" plus the cart pill, the cart button's right edge is at 417 px on a 390 px screen (27 px cut off: half the pill and the badge). At 360 only a sliver shows. At 320 both the cart (right 415) and "Back to menu" (right 332) are off-screen. Checkout has no sticky bar, so on a phone **there is no visible way to open the cart and edit the order** except "Edit order" inside the collapsed summary (H1, H2, H3).
  - Home/menu at 320: the hamburger is cut off (right 337 px) (H4). 320 is not a quality-bar viewport; Low.
  - The phone hero shows a terrace and sea, **not food**. The only food in the first screen is the 64 px postcard thumbnail (p01). Every compared site shows food in its phone hero (cmp-6-sites-390).
  - Mezze strip rows truncate the descriptions with "…" after 2 lines (acceptable; the full text is on the menu).

## 6. Performance (390x844, DPR 3, 4x CPU, 1.6 Mbps / 750 kbps / 150 ms, cache off, 3 runs)

| Page | First-view bytes | LCP median (runs) | CLS | LCP element |
|---|---|---|---|---|
| Home | **679 KB** | **2584 ms** (2584/2384/3124) | 0 / 0 / **0.102**. A 3.5 s window gives **0.1023 in 6 of 6 runs** | hero `01-taverna-bay-view-1200.webp` (137 KB) |
| Menu | 441 KB | 1984 ms (1984/1988/1332) | 0.009 | menu hero lede text |
| Checkout (2 items) | 136 KB | 1072 ms (1368/1072/1020) | 0 | demo note text |

- All pages are within budget (home < 1.5 MB, hero 137 KB < 200 KB).
- Waste: the lazy story photo `04-waterfront-tables-1200.webp` (133 KB) loads in the first view on DPR 3.
- **CLS cause (home, phone):** at about 2.8–3.1 s, core fills the hero open-status chip. "Opening hours" (1 line) becomes "Closed now · opens tomorrow at 12:00 PM (sample hours)" (2 lines). The title, lede and CTAs move down 19.6 px and the infobar shrinks from 81 to 61 px. This chip sits above the first JS hook, so the core CLS guard does not cover it.

## 7. Keyboard, reduced motion, JS off, storage blocked

- Keyboard (1440): Tab 1 = skip link. Tab to the mezze-strip Add hummus (21 Tabs), then Add dolmades, then "View your order" in the tally. The drawer opens with focus inside. Checkout → name, phone → Place order → #9480, $19.00 (9 + 10 ✔). Focus moves to the confirmation heading. 96 presses in all (long, but it works). Booking: hero "Book a table" + Enter focuses the section; 7 Tabs reach Name; submit → confirmation heading focused.
- Reduced motion: hero settle, postcard rise, ticker and the scroll-driven `olio-zoom view()` are all off; `document.getAnimations()` = 0.
- JS off: the footer appears at about 3.3 s (fail-safe). Menu shows a noscript call-to-order. Home shows an empty signature strip and "Loading the mezze list…" with no noscript note. Checkout shows a dead $0.00 form (same as cinder issue 9).
- Storage blocked: Add 3 on home → badge, tally "3 mezze · 3 dishes · $32.00", 0 errors. On checkout: "Your order is empty" (documented limit).

## Issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | **High (FAIL trigger)** | checkout.html header: the cart button is cut off at 390 (right edge 417 px) and 360, and fully off-screen at 320 along with "Back to menu". There is no sticky bar on checkout, so the phone user cannot see the cart control. The horizontal-scroll test passes because the header clips | H1, H2, H3; layout.json `checkout@390/360/320` | style.css, below about 30em: hide `.cart-btn__text` on checkout (icon + badge only, keep the `vh` count label), shorten "Back to menu" to an arrow + "Menu", or allow `.site-header__actions` to shrink (`min-width:0; gap` smaller). Re-test 390/360/320 by comparing every header control's `getBoundingClientRect().right` with `clientWidth` |
| 2 | Medium | Home CLS 0.102 on a throttled phone (6/6 runs). The hero open-status chip grows from 1 to 2 lines when core fills it | cls.py output, perf.json | `.hero__chip .open-status { min-height: 2lh }` (or a fixed `min-height` for 2 lines) on phones. Do the same for `.infobar .open-status`, or set the placeholder text to a 2-line-length string |
| 3 | Medium (spec gap / demo richness) | 14 dishes (not 15), 10 with photos. BRIEF §7 asks for every item with a photo. The menu is thin for a taverna demo: 3 grill plates, no lamb, no fish other than mullet, no wine or ouzo, no dessert other than baklava | L-menu-1440, flows.json `site_items` | Add 4–6 dishes with honest stock photos (the unused library photo 09 octopus-on-grill could carry a "whole grilled octopus" sharing plate; lamb chops, moussaka, grilled prawns, loukoumades, a house white [to confirm]). Show sides and drinks as a compact price list rather than empty photo cards |
| 4 | Medium (copy truth) | "the oven" is promised (home signature heading, menu hero, menu meta "oven dishes") but no oven dish or category exists | index.html sig heading, menu.html lines 7 and 54 | Remove "the oven", or add a real oven dish (e.g. moussaka or a baked feta [to confirm]) |
| 5 | Low–Medium (misleading tally) | The tally counts every item in the "Mezze & salad" category as "mezze": the taverna salad, the calamari, and the "Mezze platter for two" as **one** mezze, even though it holds 5. After salad + calamari + hummus it says "3 mezze" and sets ready. The steps also say "two or three mezze, **or a salad**", which shows the builder treats the salad as an alternative, not a mezze. Arithmetic is right; the wording is loose | p06, p07, flows.json `tally` | Label it "3 small plates", or exclude `taverna-salad` from the count and show it as "+ 1 salad". Count the platter as "platter (serves 2)". Also fix step 2, which repeats "or a salad" from step 1 |
| 6 | Medium (design) | The phone hero shows no food: a terrace and sea scene. The only dish visible is the 64 px postcard thumbnail. Every other compared site leads with food on the phone | p01, cmp-6-sites-390 | On phones, use the mezze tray (or octopus) as the arch photo and move the bay view to the story or visit section, or make the postcard image larger (about 40% of the width) |
| 7 | Low | JS off: home has no noscript note (empty signature strip, "Loading the mezze list…"); checkout shows a dead $0.00 form | nojs-index-390, nojs-checkout-390 | Add `<noscript>` call-to-order notes to index.html (signature and mezze) and checkout.html |
| 8 | Low (copy) | Olives: "in herbs and oil" and "grilled/toasted bread". The photo shows plain pitted olives and lightly browned bread | 16-olives-and-bread | "Green olives and bread with a dusting of paprika", or keep it as kitchen copy marked [to confirm] |
| 9 | Low | The footer credit says "Photographer names [to confirm]", but `photos/CREDITS.md` now has every name | footer, CREDITS.md lines 60–75 | Link or point to CREDITS.md and drop "[to confirm]" |
| 10 | Low | Home/menu at 320 px: the hamburger is cut off (right edge 337) | H4 | Same header shrink rule as issue 1 |
| 11 | Low (perf) | The 133 KB story photo (`04-…-1200`) loads in the phone's first view; home is 679 KB | perf.json | Cap story `sizes` at about 92vw with a max of 800w on phones, or add `fetchpriority="low"` |
| 12 | Info | Hero pickup and delivery times are hard-coded in HTML; they match `SITE.timing` now but will drift if it changes | index.html `.hero__facts` | Fill from SITE in olio.js (`[data-site]` or `data-timing`) |
| 13 | Info | The tip choice (15%) carried over from the previous order into the next checkout session | p12 ($12.05 = 7 + 4 + 1.05) | Core: reset the tip after a placed order (optional) |

## Design rating: 7/10

Why it is good: bright, airy and clearly Mediterranean. Cream and whitewash, Aegean-blue wave bands, terracotta CTAs, olive accents, arch-masked photos and a Greek-key footer line. An elegant serif with an italic accent, honest and appetising food photos, and the "Build a mezze table" strip with a live tally is a good selling idea. It reads as its own brand next to cinder-and-salt (dark ember), butter-and-bloom (pink bakery), mustang-hearth (saffron/lantern), jasmine-lane (jade) and hoshi-counter (black/vermilion). The page skeleton is shared (hero image, status chip, headline, 2 CTAs, sticky bar), but the palette, shapes and typography differ enough to pass a squint test.

What a client would criticise:
1. "Where's the cart button on my phone at checkout?" (issue 1)
2. "My first screen on a phone is a view, not my food." (issue 6)
3. "Only three mains and no wine? And where are the oven dishes you mention?" (issues 3, 4)
4. "It says 3 mezze but one of those is a salad." (issue 5)
5. "The coffee, lemonade and sides have no pictures."

## Not tested

- The "open now" ASAP path: the restaurant was closed throughout (it is exercised by the smoke script's fixed-clock check on the template only).
- Real phones, Safari and Firefox; real screen readers (only axe via the smoke test, which found 0 violations).
- Contrast beyond the smoke test's axe pass.
