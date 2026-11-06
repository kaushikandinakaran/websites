# QA report: jasmine-lane (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05 (Thursday, about 22:30 local). The sample tea house closes at 9 PM on Thursdays, so during testing it showed "Closed now · opens tomorrow at 10:00 AM". Because of that, checkout pre-selected "Schedule for later" and greyed out ASAP. That is correct core behaviour.
Method: headless Chrome only (`channel='chrome'`, `--headless=new`), `serve.py 8844` (stopped afterwards). I did not change any site files.
Scripts (scratchpad `qa-jasmine/`): `flows.py`, `layout.py`, `story.py`, `misc.py`, `cls.py`. Raw results: `flows.json`, `layout.json`, `misc.json`. Extra screenshots, viewport slices and the 768/1024 full pages are in `qa-jasmine/shots/`.
Screenshots: `qa/screens-jasmine-lane/` (39 jpg files).

## Verdict: FAIL (one trigger; the fix is small)

What works: the order path (8 taps), every total I computed, all 11 photos (none mislabelled), 0 console errors, the mandatory footer lines on every page, no horizontal scroll, the phone hero shows the food, Back to top never covers content, reduced motion, and the keyboard path.
Why it fails: **a visible layout defect on phone**. On `checkout.html` at 390 and 360 the header **Order (cart) button is cut off at the right edge**. At 390 only "Ord" shows and the item count is off-screen (issue 1). This is the same class of defect as mustang-hearth's.

## Summary table

| Area | Result | Evidence |
|---|---|---|
| `qa/core_smoke.py --site jasmine-lane --port 8844` | **40/40 PASS** | `qa/core_smoke_jasmine-lane.json` |
| Order path 390x844 touch | **PASS, 8 taps** | p01–p05 |
| Totals (my own arithmetic) | **PASS, 10/10 cases** | §2 |
| Pairing buttons (8) | PASS: right items and prices | p06, §2 |
| Delivery, minimum, tip, scheduled slot (time line follows the slot) | PASS | p09–p11 |
| Empty cart, qty +/−, options, remove, reload persistence | PASS | p08, p12 |
| Book a table: validation + confirmation | PASS (Book tap + 3 interactions) | p13, p14 |
| Photo truthfulness (11 dish photos + hero + 2 story photos) | **PASS, 0 mislabelled**; 2 copy counts disagree with the photos | §3, issue 4 |
| Every item has a photo (BRIEF §7) | 11/14; 3 text items use a drawn steamer-lid disc | issue 7 |
| Filters, search, jump bar, scroll-spy | PASS | smoke |
| Broken links / images (3 pages) | **0 broken** (28 link targets incl. anchors; 24 images, all with width/height and alt) | layout.json |
| Content rules / footer lines | PASS on all 3 pages; a few soft claims (issue 6) | §4 |
| Footer hours vs `SITE.hours` | **match** (rendered from SITE.hours by jasmine.js) | layout.json |
| Chinese decorative characters | All HTML ones are `aria-hidden` and correctly used; **2 CSS-generated 茶 are read by screen readers** | issue 2 |
| Console / page errors (6 viewports, all flows) | **0** | all json |
| Horizontal scroll (3 pages x 6 viewports incl. 320) | **0 px** | layout.json |
| Header controls inside the viewport (home/menu/checkout at 390/360/320) | **FAIL on checkout 390/360/320**; hamburger 3 px over at 320 on home/menu | issue 1 |
| Header wrapping at 1024 / 768 | none (nowrap, less-used link dropped, hamburger below 56em) | header-1024.jpg, header-768.jpg |
| Back to top | never overlaps (smoke + my end-of-page scan) | end-menu-390.jpg |
| Performance (throttled phone, 3 runs) | home 388 KB, LCP 2.14 s; menu 228 KB, 1.28 s; checkout 130 KB, 1.29 s | §6 |
| Keyboard order path (1440) | PASS, 54 key presses, 3 px blue focus ring | kbd-confirmation-1440.jpg |
| Reduced motion | PASS: every site animation `none` | misc.json |
| JS disabled | menu has a noscript note; **home and checkout have none** (checkout shows a dead $0.00 form) | nojs-*.jpg, issue 8 |
| Storage blocked | cart works in memory, 0 errors; empty on checkout (documented core limit) | misc.json |

## 1. Conversion path (390x844, touch, DPR 2)

| # | Tap | Result |
|---|---|---|
| 1 | Sticky bar **Order** | menu.html |
| 2 | Add **Crystal prawn har gow** ($9.50) | bar "View order (1) · $9.50" |
| 3 | Add **Pork soup dumplings** ($11.00) | bar "View order (2) · $20.50" |
| 4 | **View order** | drawer, Subtotal $20.50, "Checkout · $20.50" |
| 5 | **Checkout** | Pickup preselected; ASAP disabled (closed), "Ready for pickup: Tomorrow, 10:30 AM"; summary $20.50 |
| 6–7 | Name, phone | typed |
| 8 | **Place order · $20.50** | "Thank you, your order is in", **#2270**, "Tomorrow, 10:30 AM", Pickup at [address], Pay at pickup; badge 0; heading focused |

What could confuse a guest:
- (a) On checkout the header cart button is cut off (issue 1).
- (b) The sticky-bar label "View order (2) · $20.50" wraps onto 2 lines (cramped but readable, p02).
- (c) The hero "Pork soup dumplings · Add" card is hidden on phones, so a phone guest's first Add is one scroll further down. That is a design choice, not a defect.
- (d) A pairing Add shows "Added" for only a moment. After adding all 8, only the last two still read "Added". Expected, but slightly odd in a list of pairs.

## 2. Totals: expected (my own arithmetic) vs shown

| Case | Expected | Shown |
|---|---|---|
| Har gow + soup dumplings | 9.50 + 11.00 = 20.50 | $20.50 (bar, drawer, button, summary, confirmation) |
| First pairing (silver needle + har gow) | 7.00 + 9.50 = 16.50 | $16.50 |
| All 8 pairing buttons | 7 + 9.5 + 8 + 8.5 + 7.5 + 10 + 6 + 7 = 63.50 | $63.50, count 8 |
| Pairing button visible price vs `site.js` | 8/8 equal | ok |
| Soup dumplings "Ten pieces (+$6)" x2 + oolong | 34.00 + 8.00 = 42.00 | $42.00 ("$34.00 ($17.00 each)") |
| Oolong "For two (+$4)" | 34 + 12 = 46.00 | $46.00 |
| Remove oolong, then −1 | 34.00 → 17.00 | $17.00; after reload still 1 item $17.00; home badge 1 |
| Delivery, subtotal 17 | 17 + 3.50 fee = 20.50, below $18 minimum | $20.50 + "Delivery needs a subtotal of at least $18.00 (sample rule)…" |
| + spring rolls, delivery, 15 % tip | 24 + 3.50 + 3.60 = 31.10 | $31.10 (button and confirmation) |
| All 14 items once | 142.50 | $142.50, count 14 |

Scheduled slot: choosing "Tomorrow, 11:00 AM" then "11:30 AM" changed the line to "Delivery: Tomorrow, 11:00 AM" / "…11:30 AM". The confirmation said "Tomorrow, 11:30 AM". The shared fix works here.

## 3. Menu and photos (every image opened and looked at)

| Dish | Photo shows | Verdict |
|---|---|---|
| Crystal prawn har gow ("Four translucent dumplings") | chopsticks lifting a translucent prawn dumpling, 3 more on the plate = 4 | ✔ |
| Pork and prawn siu mai ("**Four** open-topped… finished with a dot of carrot") | **3** yellow siu mai topped with prawn and a black dot; the carrot is a slice *under* each one. The alt correctly says "Three" | **copy mismatch** (issue 4) |
| Pork soup dumplings ("Six pieces" basket) | 6 pleated xiao long bao in bamboo | ✔ |
| Tea house basket for two | 5 yellow-rimmed steamers: bun, bean curd rolls, spare ribs with red chilli, har gow, XLB in red spoons. Exactly the 5 named items | ✔ truthful. The yellow plastic-look rims and grey table read as a casual canteen, a little off the calm jade/ivory brand; acceptable |
| Vegetable spring rolls | platter of fried spring rolls | ✔ |
| Crispy chicken gua bao ("Two folded buns") | 2 folded bao, fried chicken, chilli mayo, sauce, micro herbs, in a steamer | ✔ |
| Jasmine silver needle | loose pale leaves in a dark gaiwan on a tea tray | ✔ (illustrative; the alt claims nothing it cannot show) |
| Roasted oolong | amber tea in a celadon cup, clay teapot, oil lamp | ✔ |
| Tasting flight of **three** teas, "from light to dark" | **6** identical pale cups on a tray with a gaiwan | **copy mismatch** (issue 4); the alt is truthful |
| Custard egg tarts ("Three") | 3 flaky, Portuguese/Macau-style tarts with caramelised tops | ✔ |
| Steamed sponge cake | the builder's square crop of library photo 01: 3 black-sesame and 3 yellow wedges in a bamboo steamer. The crop is clean (only a sliver of a wicker basket at the top edge) | ✔ |
| Hero | XLB on a white spoon above a steamer | ✔ |
| Story | hands pouring from a cast-iron kettle into a white teapot; blue-and-white tea set on red lacquer with petals | ✔ |

- Text-only items: jade dumplings, ripe pu-erh, chrysanthemum. They show a drawn steamer-lid disc, which does not pretend to be food.
- Filters: Vegetarian / Vegan / Spicy. Vegetarian → 3 of 14. No gluten-free or halal claims.
- Search: empty state + status; clear restores. Jump bar and scroll-spy: PASS (smoke).
- **Menu size (14 items / 4 categories):** honest, but thin for a client demo. "Baked and fried" and "Sweets" have only 2 dishes each, and there is no rice or noodle dish at all. The menu page meta description even promises "rice and noodles" (issue 5).
  - I would add, each only with a true photo: char siu bao, cheung fun (rice rolls), lo mai gai (sticky rice in lotus leaf), turnip cake, a noodle or fried-rice plate, mango pudding, and one cold drink.
  - That gives 20 to 22 dishes in 5 to 6 sections. Library photo 02 (siu mai with a jade dessert behind) and photo 10 are still unused.

## 4. Content rules

- "Sample design by Website Studio. Menu and prices are samples. Photos are stock." is on index, menu and checkout.
- Placeholders are marked: [address], [phone], [email], [map], [Short promise: client to edit], [Wording: client to edit], [Your story…], [Guest reviews: client to supply], [Press or awards: client to supply, only if real], [Tea sourcing note: client to confirm], [Policy: client to confirm], "(sample hours)", "Hours (sample)", "(sample business)".
- Claim scan (since/years/award/rated/stars/organic/halal/gluten/hand-made/daily/fresh/authentic/family/best…) found no hard invented facts. Soft claims are in issue 6.
- Photo credits: "photographers [to confirm] (files jasmine-lane-01, 03 … 16)". The file list matches what is used (the sponge cake is a crop of 01). `photos/CREDITS.md` does not exist; noted, not failed.
- Chinese characters: 茶 (tea), 茶 · 點心 (tea · dim sum, traditional script), 一 二 三 四 五 (section numerals) and 請慢用 ("please enjoy your meal slowly", a real phrase servers use) are all correct and all `aria-hidden` in HTML. Two CSS `::before` 茶 are exposed (issue 2).
- Footer hours on home ("Mon Closed · Tue–Thu 10:00 AM – 9:00 PM · Fri 10–10 · Sat 9:30–10 · Sun 9:30–8:30") equal `SITE.hours` and the hours table.
- Menu and checkout footers show only the open-now line, not the weekly hours (minor, issue 12).

## 5. Layout (looked at: home/menu/checkout at 1440, 1024, 768, 390, 360; drawer at 1440/1024/768/390/360; 18 phone viewport slices)

- **1440:** calm and premium. Cream and jade with ink sections and vermilion seals; an arched hero photo with a floating dish card; round "steamer" photo frames; a dark "One pot, one basket" pairings band with a huge faint 茶; vertical Chinese text; an editorial hours table; a clean two-column checkout.
- **1024:**
  - The header fits on one line ("Our story" dropped).
  - **House favourites uses a 3-column grid with 4 dishes**, so the egg tarts sit alone on a second row (L-home-1024.jpg, issue 9). The menu grid has the same orphan rows at 1024 (5 + 2 + 5 + 2 items).
- **768:** hamburger header, no wrap; layout fine.
- **390 / 360:**
  - The hero is a 16:9 arch with the soup dumpling clearly visible above the headline (firstview-home-390/360). The food sells on the first screen.
  - No horizontal scroll; targets are 44 px or more.
  - **Defect: the checkout header cart button is clipped** (issue 1).
  - Small vermilion dot overlapping the hero arch: decorative, fine.
- **320 (extra):** home and menu hamburger extends 3 px past the edge (right 323 px); checkout cart clipped by 66 px.
- Drawer: fine at all widths. The "Remove" link is indented a few px relative to the item name (core markup; cosmetic).
- Full-page screenshots show some blank round frames and story photos. That is only an artifact of lazy loading plus scroll-driven animation during full-page capture. Real scrolling (vp-story-1440.jpg, vp-pairings-1440.jpg) shows every image loaded at opacity 1.

## 6. Performance (390x844, DPR 3, 4x CPU, 1.6 Mbps down / 750 kbps up / 150 ms RTT, cache off, 3 runs)

| Page | First-view bytes | LCP runs (ms) | LCP median | CLS (max of 3) | LCP element |
|---|---|---|---|---|---|
| Home | 388 KB | 2340 / 2144 / 1852 | **2144 ms** | **0.062** | hero `soup-dumpling-spoon-1600.webp` (67 KB) |
| Menu | 228 KB | 1280 / 1736 / 1212 | **1280 ms** | 0 | intro text |
| Checkout (2 items) | 130 KB | 1288 / 1292 / 1436 | **1292 ms** | 0 | demo note |
| Checkout (empty) | not measured | 1752 / 1732 / 1636 | 1732 ms | 0 | empty-state text |

- All are well inside budget (home under 1.5 MB, hero under 200 KB).
- **The builder's "checkout LCP 2.56 s" did not reproduce.** I measured 1.29 s with a cart and 1.73 s empty.
- Home CLS 0.062 in 3 of 4 runs: at about 3.6–4 s the hero open-now chip fills from "Opening hours" (1 line) to "Closed now · opens tomorrow… (sample hours)" (2 lines). That pushes the lede, the "order direct" line and the infobar down 20 px (cls.py sources: `lede`, `hero__direct`, `infobar`). It is under 0.1, but the jump is visible in the first screen (issue 10).

## 7. Keyboard, reduced motion, JS off, storage blocked

- **Keyboard (1440):** first Tab = skip link. Then Tab to the hero "Add pork soup dumplings" → Enter → Tab to the har gow Add → Enter → Shift+Tab to the header "Order 2 items" → Enter → Tab to "Checkout · $20.50" → Enter → name, phone → "Place order · $20.50" → confirmation #4246. 54 key presses. Focus ring: 3 px solid blue.
- **Reduced motion:** hero lift/rise, the floating dot, the scroll-driven pairing and story reveals and the story zoom are all `none`. Without the setting they run as `jl-lift`, `jl-rise`, `jl-float`, `jl-in` and `jl-zoom`.
- **JS off:**
  - Menu shows "The menu and ordering need JavaScript. Please call [phone]".
  - **Home has no noscript note.** Its House favourites and pairing strip stay empty, apart from the pairing fallback link.
  - **Checkout shows a $0.00 form with no explanation.**
  - On all 3 pages the footer is hidden for about 3 s (shared fail-safe), then appears.
- **Storage blocked:** add 2 on home → "View order (2) · $16.50", 0 errors. Checkout shows "Your order is empty" (documented limit).

## Issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | **High (FAIL trigger)** | `checkout.html` header: the cart button runs past the right edge. At 390 its box is 330–449 px (only "Ord" visible, the count badge off-screen); at 360 it is 312–387; at 320 it is 311–386. Horizontal-scroll checks miss it because the header clips its overflow | header-checkout-390.jpg, header-checkout-360.jpg, header-checkout-320.jpg, L-checkout-390.jpg | In `style.css`, below 48em on `body[data-page=checkout]`: hide `.cart-btn__text`, and/or turn "Back to menu" into an icon-only 44 px link or drop it. Phones already have the sticky bar; the summary has "Edit order". Alternatively let `.site-header__actions` shrink (`min-width:0`) and reduce `.brand` font size at ≤ 24em. Re-check at 320 |
| 2 | Medium (a11y, explicit requirement) | CSS-generated 茶 is exposed to screen readers. The checkout heading's accessible name is **"茶 Checkout"** (`.checkout-title::before`), and the pairings section reads a stray "茶" (`.pairings::before`) | misc.json `ax_checkout`, `ax_home` | Use `content: "茶" / "";` (alt-text syntax) in both rules, or move the character into an `aria-hidden` span |
| 3 | Low | At 320 the hamburger on home and menu extends 3 px past the viewport (right edge 323) | header-home-320.jpg | Reduce header gap/padding at ≤ 22.5em, or hide `.header-order`/brand text earlier |
| 4 | Medium (copy vs photo) | Counts that the photos do not show. Siu mai says "**Four** … finished with a dot of carrot": the photo has **three**, and the carrot is underneath (the alt correctly says three). Tasting flight says "three small brews … light to dark": the photo has **six identical pale cups** | shumai-steamer-800, tea-tasting-tray-800 | Siu mai: "Open-topped pork and prawn dumplings on a slice of carrot" (no number), or "Three…". Flight: drop "three" and "light to dark" from the photo-bearing copy ("A small tasting set poured at the table"), or keep the dish text-only |
| 5 | Medium (demo richness) | 14 dishes in 4 sections; 2 sections have only 2 dishes; no rice or noodles, yet the menu meta description says "Steamed baskets, baked and fried dim sum, **rice and noodles**…" | menu.html line 7, L-menu-1440 | Fix the meta description now. Add 6–8 truthful-photo dishes (char siu bao, cheung fun, lo mai gai, turnip cake, a noodle plate, mango pudding, a cold drink) |
| 6 | Low (content rules) | Soft unverified claims. "Four baskets **guests reach for first**" (an invented popularity claim). "Dumplings and buns, **steamed to order**" (a process claim). "Loose-leaf tea, refilled with hot water while you stay" is stated as fact on the menu, while home marks the same policy "[Policy: client to confirm]" | index.html line 97, site.js category descriptions | "Four baskets to start with"; "steamed in bamboo"; add "[to confirm]" to the refill line or remove it |
| 7 | Low (spec gap) | 3 of 14 items have no photo (BRIEF §7 "every menu item with a real photo"). The lid disc is tasteful but looks unfinished in the 1440 grid, and two pairings show a lid instead of tea | L-menu-1440, pairings | Source true photos (green dumplings, dark pu-erh liquor, chrysanthemum tea) or pair only photographed teas on the home strip |
| 8 | Low | No `<noscript>` on home or checkout; checkout shows a dead $0.00 form | nojs-checkout-390.jpg | Copy the menu's noscript sentence into index.html (near House favourites) and checkout.html |
| 9 | Low–Medium (desktop layout) | At 1024 the home House favourites grid is 3 columns for 4 dishes, leaving one orphan on a second row. The menu grid shows the same ragged rows | L-home-1024.jpg | Use 2 or 4 columns between 48–75em for `[data-signature]` (`repeat(4, 1fr)` from 60em, 2 below) |
| 10 | Low (CLS) | Home CLS 0.062: the hero open-now chip grows from 1 to 2 lines when filled, about 3.6 s in on a throttled phone, pushing the lede and infobar 20 px | cls.py output | Give `.hero .open-chip` a 2-line `min-height` on phones (e.g. `min-height: 3.6rem`), or put sample-length placeholder text in the HTML |
| 11 | Low (brand) | Fonts are system stacks (Constantia/Candara/KaiTi). Android and iOS will render a different display face and different CJK glyphs. The shared README asks for local woff2 | style.css lines 30–32 | Bundle one OFL serif (e.g. Cormorant / Libre Caslon) and one sans as woff2 with `font-display: swap`; keep the CJK glyphs as SVG or subset |
| 12 | Low | Weekly hours appear only in the home footer; the menu and checkout footers show just the open-now line | L-menu-1440 | Add `[data-hours-compact]` to the menu footer and load jasmine.js there |
| 13 | Info | "Jasmine silver needle" is illustrated by pale twisted leaves in a gaiwan, not silver-needle buds. The alt is truthful; a client tea expert might notice | gaiwan-green-tea-800 | Optional: neutral name for the photo-bearing tea, or a buds photo |

## Design rating: 7/10

What is good:
- A calm, coherent tea-house identity: ivory and jade with ink-black bands and vermilion seal accents.
- Correct, restrained Chinese typography (vertical 茶 · 點心, the 一–五 section numerals, 請慢用).
- Round "steamer" photo frames.
- A genuinely useful, distinctive "One pot, one basket" pairing strip that adds both items in one tap each.
- A phone hero that shows the dumpling.
- A clean, trustworthy checkout and fast pages.

Why not higher:
- **Too close to butter-and-bloom at desktop.** Both use a cream background, an arched hero photo on the right with a floating "dish · price · Add" card, a large serif headline, two CTAs and an open-now pill. In the squint test against `qa/screens-mustang-hearth/compare-mustang-cinder-butter.jpg`, Jasmine Lane reads as butter-and-bloom recoloured jade. It is clearly distinct from cinder-and-salt and mustang-hearth (both dark and full-bleed). The pairings band, the seals and the steamer circles differentiate it lower down the page, but the first screen is where clients compare.
- The menu is small, with 2-item sections.
- The menu photos are small round thumbnails on phone (about 90 px), so the food sells less than it could.
- The yellow-rimmed canteen steamers in the "basket for two" are off-brand.
- System fonts.

What a client would criticise first:
1. "My cart button is cut off on the checkout page."
2. "Where are the rice rolls, noodles, buns? Only two sweets?"
3. "It looks a lot like the bakery design." (if shown side by side)
4. "The siu mai says four, the photo shows three."
5. "Why do three teas have no picture?"

## Not tested

- Real phones, Safari and Firefox. Real screen readers: the accessible names were read from Chrome's accessibility tree, plus the axe pass in the smoke test.
- An "open now" state: the restaurant was closed throughout, so ASAP pickup with a same-day time was only covered by the smoke test's logic, not by my path.
- Contrast was not re-measured beyond the smoke test's axe result (0 violations).
- The optional 3D tea set does not exist (the builder skipped it; allowed).
