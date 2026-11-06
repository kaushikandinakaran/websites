# QA report: hoshi-counter (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05 (Thursday, about 22:30 local). The sample restaurant was **"Closed now · opens tomorrow at 12:00 PM"** the whole time, so checkout always defaulted to "Schedule for later" (ASAP disabled) and booking defaulted to tomorrow.
Method: headless Chrome only (`channel='chrome'`, `--headless=new`), `serve.py 8846` (stopped afterwards). Site files were not modified.
Scripts and raw results (scratchpad `qa-hoshi/`): `flows.py`/`flows.json`, `layout.py`/`layout.json`, `extra.py`/`extra.json`, `perf.py`/`perf.json`, plus about 70 extra slices in `qa-hoshi/shots/`.
Screenshots: `qa/screens-hoshi-counter/` (38 jpg). Note: in the full-page `L-*` captures, images and `.reveal` blocks lower down look black or empty. That comes from lazy loading and the scroll reveal in a no-scroll capture. Scrolled slices show all of them render (0 `.reveal.is-pending` left after scrolling, opacity 1).

## Verdict: FAIL (one phone layout defect; everything else is small)

Things that work: order path in 8 taps, booking in Book + 3 interactions, every total, all 14 photos truthful, content rules, footer lines, 0 console errors, 0 broken links/images, smoke 40/40.
It fails on one brief trigger: **a visible layout defect on phone**. On `checkout.html` the header **Bag (cart) button is cut off the right edge at 360 px and 320 px** (issue 1). This is the same defect class found on mustang-hearth.

## Summary table

| Area | Result | Evidence |
|---|---|---|
| `qa/core_smoke.py --site hoshi-counter --port 8846` | **40/40 PASS** | `qa/core_smoke_hoshi-counter.json` |
| Order path 390x844 touch | **PASS, 8 taps** | p01–p06 |
| Totals (my own arithmetic, 7 cases) | **PASS, 0 mismatches** | §2 |
| Delivery, minimum, tip, scheduled slot line | PASS | p10–p12 |
| Empty cart, qty +/−, remove, reload persistence | PASS | p07–p09 |
| Booking: Book tap, validation, confirmation | **PASS** (Book + 3 interactions) | p13–p15 |
| Counter-card "Book a seat" note prefill | **Partly works** (issue 3) | p16, p17 |
| Photos (14 dish photos + 2 story photos, each opened) | **PASS, 0 mislabelled**; 2 weak matches (issue 7) | §3 |
| Every item has a photo | 14/18 (4 text rows) | issue 8 |
| Prices on cards vs `site.js` | 18/18 match | flows.json |
| Filters, search, jump bar, scroll-spy | PASS (smoke + slices) | p02, L-menu-390 |
| Broken links/images (37 URLs, all anchors) | **0** | layout.json `crawl` |
| Content rules / 3 footer lines on every page | PASS | §4 |
| Footer hours vs `SITE.hours` | **match** (built from data) | layout.json |
| Japanese characters | correct, all `aria-hidden` | §4 |
| Console/page errors (all flows, 5 viewports) | **0** | flows/layout/extra.json |
| Horizontal scroll (3 pages x 5 viewports) | 0 px | layout.json |
| Header controls inside viewport (390/360/320) | **FAIL on checkout at 360 and 320** | h-checkout-header-360/320 |
| Header on one line at 1024/768 | PASS (no wrapping), but Book is hidden at 1024 (issue 4) | V-index-1024 |
| Phone hero shows food | **PASS** (photo is first, full width) | p01 |
| Back-to-top overlap | PASS (smoke, 4 widths) | smoke |
| Performance (throttled phone) | home 187 KB / LCP 2.62 s; menu 318 KB / LCP 3.70 s; checkout 131 KB / LCP 1.15 s | §6 |
| Keyboard order / booking | PASS (73 / 29 key presses) | kbd-*.jpg |
| Reduced motion | PASS (no animations, no reveal) | extra.json |
| JS off | home/menu OK; checkout shows a dead form with no note | nojs-checkout-390, issue 9 |
| Storage blocked | cart works in memory, 0 errors; empty on checkout (documented core limit); booking works | extra.json |

## 1. Conversion path (390x844, touch, DPR 2)

| # | Tap | Result |
|---|---|---|
| 1 | Sticky bar **Order** | menu.html |
| 2 | Add **Hoshi nigiri box** ($48) | "Added"; bar becomes "View order (2)…" after the next add |
| 3 | Add **Five-piece nigiri tasting** ($26) | bar "View order (2) · $74.00" |
| 4 | **View order** | drawer: Subtotal $74.00, "Checkout · $74.00" |
| 5 | **Checkout** | Pickup preselected; closed now, so "Schedule for later" with "Tomorrow, 12:30 PM"; line "Ready for pickup: Tomorrow, 12:30 PM"; summary $74.00 |
| 6–7 | Name, phone | typed |
| 8 | **Place order · $74.00** | "Thank you, your order is in", #1331, Tomorrow 12:30 PM, Pickup at [address], Pay at pickup, $74.00; badge back to 0 |

- Delivery: fee $4 added; edamame only ($6) is blocked with "Delivery needs a subtotal of at least $30.00 (sample rule)…" (p10).
- Scheduled time: picking "Tomorrow, 1:45 PM" and then "Tomorrow, 7:00 PM" updates the line to "Delivery: Tomorrow, 1:45 PM" and then "…7:00 PM". The confirmation says 7:00 PM (p11, p12). Slots skip the 2–5:30 PM gap correctly.
- Qty/remove/reload: +1, remove, −1 all correct; after a reload the badge stays 1, and home shows "View order (1) · $48.00". Removing the last line shows "Nothing here yet" (p08). Checkout with an empty cart shows the empty state (p09).
- Confusing points: (a) on the menu at 390 the first dish card sits below the fold. The first screen is title, open line, the dine-in banner, search, the Vegan chip and the category bar (p02). (b) The "View order · $0.00" button at the bottom of the menu shows even when the cart is empty.

## 2. Totals: expected (my arithmetic) vs shown

| Case | Expected | Shown |
|---|---|---|
| Hoshi box + five-piece | 48 + 26 = $74.00 | $74.00 (bar, drawer, button, summary, confirmation) |
| Hoshi box + sashimi boat | 48 + 62 = $110.00 | $110.00 |
| Hoshi x2 + boat | 96 + 62 = $158.00 | $158.00 |
| Remove boat | $96.00 | $96.00 |
| Hoshi −1 | $48.00 | $48.00 (also after a reload) |
| Edamame, delivery | 6 + 4 = $10.00, under the $30 minimum | $10.00 + minimum error |
| Salmon set + akami, delivery, 15% tip | 33 + 4 + 4.95 = $41.95 | $41.95 (rows: $33 / $4 / Tip (15%) $4.95 / $41.95) |
| Without tip, delivered | $37.00 | $37.00 on the confirmation |
| All 18 items once | sum of `site.js` = $309.00 | $309.00, badge 18 |

## 3. Menu and photos (every photo opened)

| Dish / use | Photo | Verdict |
|---|---|---|
| Hero **and** "Salmon and tuna trio" | 02: salmon, tuna, salmon nigiri, grated wasabi, black mirror | **True.** Reusing it is honest: the photo shows exactly the trio. It is repetitive, but not mislabelled |
| Hoshi nigiri box (12 pcs) | 08: 12 assorted nigiri on slate | True; count matches |
| Five-piece tasting | 01: 5 nigiri (tuna, salmon, white fish, prawn, silver/dark-skinned fish) | True; count matches |
| Sashimi boat for two | 11: tuna, salmon, lemon, sea grapes, cress on ice in a boat | True |
| Salmon sashimi set ("two fans") | 03: two salmon fans, cucumber | True (the shreds look more like carrot/daikon mix; fine) |
| Yellowtail and scallop | 12: yellowtail slices, scallop, lemon, lime | True; the alt says "on ice", but no ice is visible (trivial) |
| Akami (2 pcs) | 09: two lean tuna nigiri | True |
| Sake (2 pcs) | 10: two salmon nigiri, white dressing, spring onion | True photo; **name ambiguous** (issue 6) |
| Tuna with micro cress | 07: two tuna nigiri, cress, leaf, wood | True |
| Aburi roll | 13: credit title "california maki"; the left plate (the part the phone crop shows) looks like seared nigiri on rice blocks, the right plate is a topped roll | **Weak match** (issue 7) |
| Salmon and cream cheese roll | 14: one salmon roll piece, cream cheese, cucumber, chopsticks | True; the alt correctly says "a piece" |
| Chef's dressed roll | 06: gloved chef finishing a sauced, herb-topped roll | True as alt; as a menu photo it shows hands, not the boxed product (issue 7) |
| Prawn and vegetable tempura | 15: prawn, shiso, vegetables on paper | True |
| Matcha, whisked to order | 16: **dry** matcha powder in a bowl beside a whisk | Alt is honest; the card sells a hot drink with a powder photo (issue 7) |
| Story / counter | 04 long counter, 2 chefs (one wears a face mask); 05 gloved hands slicing a salmon roll | True; both captioned "Stock photo" with placeholders |

- **Counts in text vs photos** (coordinator check): "Twelve pieces" (08 shows 12), "Five-piece" (01 shows 5), "Two fans" (03), "Three pieces" (02), the nigiri "two pieces per order" (09/10/07 each show 2). All consistent. "Rolls: cut into six or eight pieces" is a category note, and no photo claims a count. **No count conflicts.**
- Filters: one chip, Vegan (4 items: edamame, matcha, hojicha, yuzu soda). No gluten-free/halal claims. Search "zzzz" shows the empty state; Clear restores "Showing all 18 dishes."
- Richness: 18 items, 6 categories, 14 photos. That is enough for a demo, but thin for a sushi bar: no hand rolls (even though the counter menus mention them), no vegetarian roll or nigiri, no desserts, no sake/beer for takeaway. On desktop "Nigiri sets" has 2 cards in a 4-column grid and Sashimi 3, so the rows look half empty (L-menu-1440). The 4 photo-less items render as tidy price-list rows, with no holes.

## 4. Content rules

- "Sample design by Website Studio. Menu and prices are samples. Photos are stock." is on index, menu and checkout (layout.json `footer_lines`).
- Omakase **$145 per guest (sample)** and Nigiri counter **$85 per guest (sample)**, plus "Prices are samples".
- Placeholders are marked: [address] [phone] [email] [map], [Short promise / Wording: client to edit/confirm], [Sourcing: client to confirm], [to confirm], [Guest reviews / Press mentions: client to supply], [Photo of the counter / chef: client to supply], [Times: client to confirm], [Allergen wording: client to confirm], [sample], "(sample hours)".
- Text scan (since/years/award/rated/stars/Michelin/organic/halal/gluten/wild/sustainab/Tsukiji/Toyosu/imported/best/famous/reviews/counts): hits only "at the moment they are best" (marked [Wording: client to confirm]), the party picker "2 guests…", and the review placeholder. **No invented facts.** "Bought for the day" carries [Sourcing: client to confirm].
- Credits: `photos/CREDITS.md` exists and lists all 16 hoshi files (Pexels, photographer names). The footer still says "[photographer credits to confirm]" (issue 10).
- Footer hours (built from `SITE.hours` by hoshi.js): Mon Closed; Tue–Thu 12–2, 5:30–10; Fri–Sat 12–2, 5:30–11; Sun 5–9:30. **Matches** `site.js` and the hours table.
- Japanese: 星 (hoshi = star), 寿司 カウンター (sushi counter), 一 二 三 (one two three) are correct, and all 8 text nodes sit inside `aria-hidden="true"`.

## 5. Layout

- **Header controls (coordinator check)**, bounding box vs viewport, with 1 item in the cart:

| Page | 390 | 360 | 320 |
|---|---|---|---|
| index | OK (Bag right 318, toggle 373) | OK | OK |
| menu | OK | OK | OK |
| **checkout** | Bag right edge 386 of 390 (4 px from edge) | **Bag right 385 > 360: cut off** | **Bag right 383 > 320: cut off** |

  scrollWidth stays at the viewport width, so the horizontal-scroll check misses this. Cause: the letter-spaced brand "H O S H I" (`letter-spacing:.34em`, about 163 px) plus "Back to menu" plus the Bag button do not fit, and nothing shrinks or wraps.
- 1440: clean editorial layout, cream paper, a black-framed hero photo with a vermilion seal, a dark omakase section with large italic numerals, booking panel with an offset shadow, takeaway cards, dark philosophy section, hours table.
- 1024: one line, nothing wraps, but the header shows only "Order takeaway" and hides **"Book a seat"** (V-index-1024). 768 shows both (V-index-768).
- 390/360: photo first, then the status, the headline and two CTAs (Book = vermilion primary, Order = outline). No overlap; targets 44 px or more; back-to-top OK.
- Sticky bar (phone): **Order** is vermilion and the widest (153 px), **Book** is cream (102 px), Call is an outline. On the dark bar Book reads clearly, but Order is visually the primary. That is inverted for a booking-first site (issue 5). With items in the cart, the Order slot becomes "View order (2) · $74.00", in 2 lines.
- Drawer 390: clean; the "Remove" link is indented about 8 px (core markup, cosmetic).

## 6. Performance (390x844, DPR 3, 4x CPU, 1.6 Mbps / 750 kbps / 150 ms, cache off, 3 runs)

| Page | First-view bytes (median) | LCP median (runs) | CLS median | Load median | LCP element |
|---|---|---|---|---|---|
| Home | **187 KB** | **2624 ms** (2608/2624/3320) | 0 | 5096 ms | hero `02-…-1600.webp` (48 KB) |
| Menu | **318 KB** | **3704 ms** (3804/3704/2056) | 0.014 | 7336 ms | text `p.menu-hero__lede` |
| Checkout (2 items) | **131 KB** | **1152 ms** | 0 | 1730 ms | `p.demo-note` |

- Well within budget (home far under 1.5 MB; hero 48 KB). core.js (62 KB uncompressed) is the largest file on every page.
- Menu: the LCP is a text paragraph, but it lands late (median 3.7 s, above the ~3 s target) while 4–6 dish images (11/08/12/01 at 800w, 25–57 KB each) download in the first view. The variance is high (2.1–3.8 s).
- No web fonts are loaded. The fonts are system stacks (Bodoni 72/Didot → Georgia; Yu Gothic/Hiragino → Segoe UI), so the look differs by device (issue 11).

## 7. Keyboard, reduced motion, JS off, storage blocked

- Keyboard order at 1440: Tab x8 to the header "Order takeaway" → Enter → 18 Tabs to the first Add → Enter, Add → Shift+Tab x11 to the Bag → Enter → 12 Tabs to Checkout (through the wasabi selects and the notes) → name, phone → Place order. **73 key presses**; the confirmation heading gets focus; focus ring is a solid 3 px.
- Keyboard booking: 14 Tabs to the Omakase "Book a seat" → Enter (notes prefilled "Omakase. ") → 7 Tabs to Name → name, phone → submit: **29 key presses**; the confirmation heading gets focus.
- Reduced motion: 0 running animations, the reveal is skipped. With motion allowed: hero zoom-settle, seal stamp, reveal on scroll.
- JS off: home and menu work, with a noscript call note on the menu. **Checkout shows a full $0.00 form with no explanation**, blank for about 3 s (nojs-checkout-390).
- Storage blocked: 2 adds give count 2 / $56.00, 0 errors. Checkout says "Your order is empty" (documented core limit). Booking still confirms.

## 8. Dine-in vs takeaway clarity

Mostly clear. The hero eyebrow says "Omakase counter ◆ Takeaway sushi sets". The CTAs are "Book a seat" vs "Order takeaway". The menu has a black banner "Omakase and the nigiri counter are dine-in only. [Book a seat]". The cart is titled "Your takeaway", and the counter cards say "dine-in only". Weak points:
- The names overlap: "**Nigiri counter**" (dine-in, $85) vs the takeaway "**Nigiri sets**" and "**Nigiri**" sections.
- The booking form has **no sitting choice**. The Omakase/Nigiri-counter choice survives only as free text in optional Notes, and the confirmation does not repeat it (issue 3).

## Issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | **High (FAIL trigger)** | checkout.html header: the Bag (cart) button is cut off the right edge at 360 (right 385) and 320 (right 383). At 390 it has only 4 px of margin. No horizontal scroll, so the existing checks miss it | h-checkout-header-360.jpg, h-checkout-header-320.jpg, flows.json `header_controls` | style.css, phones: reduce `.brand__word` letter-spacing (e.g. `.18em`) below 30em, and/or hide `.cart-btn__text` and turn "Back to menu" into an icon or arrow with `aria-label`, and/or let `.site-header__actions` shrink (`min-width:0; gap:.4rem`). Re-test at 320–390 with a cart badge |
| 2 | Medium | Booking defaults to **12:00 PM tomorrow** (the lunch window) while the copy says "Choose a **night** and a time". site.js calls lunch a "takeaway window", and the 2-hour omakase booked at 12:30 would run past the 2:00 PM close | p13, slice-home-390-booking-copy.jpg, flows.json `book_defaults` | Either make reservations evening-only (needs a core option such as `reservation.hours`, or a site-side default to the first evening slot), or change the copy to "Choose a day and a time" and state lunch seatings for the nigiri counter only |
| 3 | Medium | Counter-card "Book a seat" prefills Notes only when Notes is empty. Tapping Omakase and then Nigiri counter leaves "Omakase. ". The prefilled text sits off-screen, there is no visible "You chose: Omakase", and the confirmation does not mention the sitting | flows.json `book_set_notes` = ["Omakase. ","Omakase. "], p17 | hoshi.js: replace a previous prefill (keep track of the last inserted value) and show a small "Sitting: Omakase (change)" line above the form. Better: add a sitting radio (Omakase / Nigiri counter) and mention it in the confirmation summary (core change → manager) |
| 4 | Medium | At 1024 the header hides "Book a seat" (the site's main goal) but keeps "Order takeaway" | V-index-1024.jpg | Keep `.header-book` from about 60em up; shorten the nav ("Visit") or drop "Philosophy" at 60–75em instead |
| 5 | Low–Medium | Phone sticky bar: Order is the vermilion primary and the widest, Book is secondary cream. That is inverted for a booking-first concept | p01, layout.json `mbar@390` | On home, style `.mbar__btn--book` as the vermilion primary and Order as cream, or make the two equal width |
| 6 | Low | "Sake" (salmon nigiri) is easy to read as the drink; a search for "sake" returns the salmon nigiri | menu card | Rename to **"Salmon (sake)"** or "Sake · salmon", and keep the description "Salmon with a dab of creamy dressing…" |
| 7 | Low | Weak photo matches (not false): Aburi roll photo 13 (the phone crop shows seared nigiri pieces); Chef's dressed roll photo 06 shows the chef's hands, not the product; Matcha card shows dry powder | p (slice-menu-390-rolls), images 13/06/16 | Photo 13: `object-position: right` or rename "Aburi selection"; 06: keep (honest), or use a tighter crop of the roll; matcha: describe "Ceremonial matcha, whisked to order" with the alt as is, or find a whisked-tea photo |
| 8 | Low (spec gap) | 4 of 18 items have no photo (edamame, miso, hojicha, yuzu soda); BRIEF §7 wants every item with a photo. Menu is thin (no hand roll, no vegetarian sushi, no dessert) | flows.json | Add truthful stock photos or keep the tidy list rows; add a cucumber/avocado roll and a hand roll to the takeaway menu |
| 9 | Low | JS off: checkout shows a working-looking $0.00 form with no noscript note | nojs-checkout-390.jpg | Add `<noscript><p>Ordering needs JavaScript. Please call [phone].</p></noscript>` to checkout.html |
| 10 | Low | Footer says "[photographer credits to confirm]", but `photos/CREDITS.md` has every name | footer, CREDITS.md lines 92–107 | Link to or list the Pexels photographer names |
| 11 | Low | System font stacks: the Bodoni/Yu Gothic look depends on the device | style.css lines 36–37 | Bundle one display serif (Bodoni Moda, OFL) and one sans as local woff2 |
| 12 | Low | Menu LCP median 3.7 s (text) on a throttled phone; 4–6 dish images in the first view compete | perf.json | Push the first dish row above the fold on phones (compact the intro/banner), `fetchpriority="low"` on below-fold card images |
| 13 | Low (design) | Brand too close to jasmine-lane: same cream paper, red square seal with a CJK glyph, vertical CJK beside a framed hero photo, left serif headline with an italic coloured word, two CTAs and a status pill (also the butter-and-bloom skeleton). BRIEF asked for black paper, vermilion seals, "huge type" | V-index-1024 vs cmp-jasmine-lane-1440.jpg | Make the Hoshi hero black (the dark sections already exist), with the headline far larger (full-width, 10–14vw) over the black mirror photo; drop the vertical CJK strip or move the seal so it differs from Jasmine's |
| 14 | Info | Menu "View order · $0.00" CTA shows with an empty cart; the two "Added" buttons show different colours (green vs vermilion) right after adding | p03, slice-menu-390-07 | Hide the CTA when the cart is empty; one "Added" style |

## Design rating: 7/10

Why it is good: restrained Japanese minimalism on warm paper, with black sections. A strong vermilion seal motif, a confident Didone headline with an italic vermilion accent, oversized italic numerals on the counter cards, and consistent dark food photography that looks premium. The order and booking paths are short and calm, and the copy is careful and honest.

Why not higher:
- At a glance it is close to jasmine-lane (and the shared cream skeleton), so it fails the squint test against that sibling. The brief's "black, huge type" is not the first impression.
- The menu is small, and desktop rows are half empty.
- The checkout header breaks on small phones.
- Fonts depend on the device.

What a client would criticise first:
1. "The cart button is cut off on my phone at checkout."
2. "It looks like the dim sum site with a different logo."
3. "Booking defaults to lunch, but my omakase is a dinner thing."
4. "When someone books the omakase, how do I know which menu they want?"
5. "Where are the hand rolls and a veggie option?"

## Not tested

- Real phones, Safari, Firefox; real screen readers (axe via smoke only: 0 violations).
- The "open now" clock state: the restaurant was closed throughout, so ASAP pickup was not exercised on this site (the smoke script covers the core logic on the template).
- Contrast was not re-measured beyond the smoke axe pass.
