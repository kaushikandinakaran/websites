# QA report, round 2: jasmine-lane (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05, about 23:00 local. The sample tea house was closed (Thursday, closes 21:00), so checkout pre-selected "Schedule for later". That is correct core behaviour.
Method: headless Chrome only (`channel='chrome'`, `--headless=new`), `serve.py 8854` (stopped afterwards). I did not change any site files.
Scripts and raw JSON: scratchpad `qa-jasmine2/` (`layout.py`, `names.py`, `flows.py`, `perf.py`, `misc.py`, `story.py`; `layout.json`, `flows.json`, `perf.json`, `misc.json`).
Screenshots: `qa/screens-jasmine-lane-r2/` (29 jpg files).

## Verdict: PASS (with one Medium issue to fix before a client demo)

Every round-1 defect is fixed, and I have evidence for each one: header clipping, CSS Chinese characters in the accessibility tree, copy counts, soft claims, the meta description, noscript notes, ragged home grid, and hero CLS. The full regression is clean: smoke 42/42, 0 console errors, 0 horizontal scroll, 0 broken links or images, CLS 0, order path 8 taps, all totals correct.
The remaining weakness is presentation, not a defect. On desktop, **8 of the 19 menu items are drawn steamer lids**. The whole "Rice and noodles" section is three big empty lids that fill the 1024 screen (issue 1).

## Round-1 issues: re-check

| R1 # | Issue | R2 result | Evidence |
|---|---|---|---|
| 1 | Checkout cart button clipped | **FIXED.** On all 3 pages at 1440, 1200, 1024, 900, 768, 390, 360 and 320, every header control is inside the viewport (e.g. checkout at 320: back 184.8–228.8, cart 235.2–304), with no wrapped text and the nav on one row. Below 48em the "Order" word and "Back to menu" text are visually hidden. Accessible names (Chrome AX tree): cart = **"Order 2 items"**, back link = **"Back to menu"** (aria-label), toggle = "Site navigation" | header-checkout-320/360/390.jpg, header-checkout-768.jpg, header-index-320/900.jpg, layout.json |
| 2 | CSS 茶 read by screen readers | **FIXED.** Both rules now use `content: "茶" / ""`. Full AX tree of home, menu and checkout: **0 nodes with CJK text**. The checkout h1 name is "Checkout". All 13 HTML Chinese strings are `aria-hidden` and correct: 茶, 茶 · 點心, 點心, 一–五, 請慢用, 點心 · 茶 | layout.json `ax` |
| 3 | 320 hamburger 3 px over | **FIXED** (right edge 304 at 320) | header-index-320.jpg |
| 4 | Siu mai "four", flight "three, light to dark" | **FIXED.** Siu mai: "Open-topped pork and prawn dumplings, each on a slice of carrot" (no count; carrot visible under them). Flight renamed "Tea tasting set: a small tasting set poured at the table. Ask which teas are on today." | photos §3 |
| 5 | Thin menu; meta promised rice and noodles | **FIXED in content.** 19 items in 5 sections; a "Rice and noodles" section now exists (rice noodle rolls, lotus leaf sticky rice, egg fried rice). The meta description says "rice and noodle plates" | flows.json `menu_struct` |
| 6 | Soft claims ("guests reach for first", "steamed to order", refills as fact) | **FIXED.** "Four baskets to start with"; "served in bamboo steamers"; refills read "[policy to confirm]" on both home and menu. Claim scan (fresh, daily, hand, made, to order, refill, charcoal, baked, authentic, tradition, organic, halal, gluten, local, sourced, best, award, since, years, guests, always): no unqualified claims | grep |
| 7 | Items without photos | **WORSE in count: 8 of 19** (was 3 of 14). See issue 1 | menu-rice-1024.jpg |
| 8 | No noscript on home or checkout | **FIXED.** Home: "The menu and ordering need JavaScript. Please call [phone] to order." (the signature and pairs blocks are hidden). Checkout: form `display:none` plus "Checkout needs JavaScript…". The footer is visible after the 3 s fail-safe | nojs-index-signature-390.jpg, nojs-checkout-390.jpg |
| 9 | Home 3-column grid with 4 dishes | **FIXED on home** (4 across from 60em). The menu grid is still ragged (issue 2) | menu-full-1440.jpg |
| 10 | Home CLS 0.062 | **FIXED: CLS 0 / 0 / 0** (12 s full-length runs) | §Performance |
| 11 | System fonts | Not changed (issue 6) | style.css 30–32 |
| 12 | Hours only in home footer | **FIXED**: `[data-hours-compact]` and jasmine.js are on menu too; checkout has the compact contact and open-status line | menu-full-1440.jpg |
| 13 | Silver needle photo | **FIXED** by renaming to "Jasmine green tea" (pale twisted leaves in a gaiwan: illustrative, alt truthful) | gaiwan-green-tea-800 |
| Hero | Too close to butter-and-bloom | **FIXED**, see §Hero | compare-hero-1440.jpg, compare-hero-390.jpg |

## Regression summary

| Area | Result | Evidence |
|---|---|---|
| `qa/core_smoke.py --site jasmine-lane --port 8854` | **42/42 PASS** (axe 0 violations) | qa/core_smoke_jasmine-lane.json |
| Order path 390x844 touch | **8 taps**: Order → add har gow → add soup dumplings ("View order (2) · $20.50") → View order → Checkout → name → phone → Place order · $20.50 → **#2917**, "Tomorrow, 10:30 AM", Pickup at [address]; badge 0 | p00–p05 |
| Totals (my arithmetic) | **All match** (table below) | flows.json |
| Delivery, minimum, tip, scheduled slot | PASS: fee +$3.50; under $18 → "Delivery needs a subtotal of at least $18.00 (sample rule)…"; slot 11:30 → "Delivery: Tomorrow, 11:30 AM" → confirmation "Tomorrow, 11:30 AM" | p07–p09 |
| Booking | PASS: Book tap, empty submit → "Enter your name. / Enter your phone.", then name + phone → WS-HPXF2W "2 guests on Friday, November 6 at 10:00 AM" | p10, p11 |
| Console / page errors | **0** (8 header widths x 3 pages, all flows, keyboard, JS-off, reduced motion) | all json |
| Horizontal scroll | **0 px** (3 pages x 1440/1200/1024/900/768/390/360/320) | layout.json, misc.json |
| Links / images crawl | 16 unique link targets incl. anchors: **0 bad**. Images: home 16, menu 11, checkout 0; all load, all have width/height and alt | misc.json |
| Footer lines | "Sample design by Website Studio", "Menu and prices are samples", "Photos are stock", Photo credits: **all present on all 3 pages** | misc.json |
| Photo credits vs photos/CREDITS.md | The 13 names in the footer = the photographers of the 14 files used (01 via the sponge-cake crop, 03, 04, 05, 06, 07, 08, 09, 11, 12, 13, 14, 15, 16). Spelling matches CREDITS.md (incl. "TBD Tuyên", "Yuen Tou Zan") | §3 |
| Keyboard (1440) | PASS, 47 key presses: skip link first → main → hero Add → signature Add → Shift+Tab to cart → Checkout → name, phone → Place order → confirmation heading focused (#1146). Focus ring 3 px solid blue | kbd-confirm-1440.jpg |
| Reduced motion | PASS: 0 CSS animations and 0 running animations. Without the setting: jl-lift, jl-rise, jl-in, jl-zoom | misc.json |

### Totals

| Case | Expected | Shown |
|---|---|---|
| Har gow + soup dumplings | 9.50 + 11.00 = 20.50 | $20.50 (bar, drawer, button, confirmation) |
| All 19 items once | 71.50 + 24.50 + 29.50 + 40.50 + 20.50 = 186.50 | **$186.50**, count 19 |
| All 8 pairing buttons | (7 + 9.5) + (8 + 8.5) + (12 + 10) + (7 + 7) = 69.00 | **$69.00**, count 8 (jasmine green merged to qty 2 = $14.00) |
| Soup dumplings "Ten pieces" x2 + jasmine "For two" + pu-erh "For two" | 34.00 + 11.00 + 11.50 = 56.50 | $56.50 |
| + delivery | 60.00 | $60.00 |
| + 15 % tip | 56.50 x 0.15 = 8.475 → 8.48; 68.48 | $68.48 (confirmation itemises fee $3.50, tip $8.48) |
| Spring rolls only, delivery (tip 15 % carried over) | 7 + 3.50 + 1.05 = 11.55, below the minimum | $11.55 + minimum message |

## 3. Photos vs copy (I opened every image with the Read tool)

| Dish / slot | Photo shows | Verdict |
|---|---|---|
| Crystal prawn har gow ("Four translucent dumplings") | 1 in chopsticks + 3 on the plate = 4 | ✔ |
| Pork and prawn siu mai (no count) | 3 yellow siu mai with prawn tops, carrot slices under them | ✔ |
| Pork soup dumplings | 6 pleated XLB in bamboo | ✔ |
| Tea house basket for two (5 named items) | bun, bean curd rolls, spare ribs with chilli, har gow, XLB in red spoons | ✔ |
| Vegetable spring rolls | platter of fried spring rolls (no dip visible, fine) | ✔ |
| Crispy chicken gua bao ("Two folded buns") | 2 folded bao, fried chicken, chilli mayo, dark sauce, micro herbs | ✔ |
| Jasmine green tea | pale loose leaves in a dark gaiwan (illustrative) | ✔ |
| Roasted oolong | amber tea in a celadon cup, clay pot, oil lamp | ✔ |
| Tea tasting set (no count) | 6 small cups, gaiwan, glass pitcher | ✔ |
| Custard egg tarts ("Three") | 3 tarts | ✔ |
| Steamed sponge cake "Ma lai go… black sesame and golden custard" | 3 black-sesame and 3 plain yellow wedges | ✔ for the image; the wording is a little off (issue 5) |
| Hero | XLB on a spoon (with orange roe tops) over a steamer | ✔ (see issue 4) |
| Hero side panel / story x2 | dark teapot and lamp; hands pouring from a cast-iron kettle; blue-and-white set on red lacquer | ✔ |

## Performance (390x844, DPR 3, 4x CPU, 1.6 Mbps / 750 kbps / 150 ms, cache off, 3 runs, each 12 s after load)

| Page | First-view bytes | LCP runs (ms) | LCP median | CLS runs | LCP element |
|---|---|---|---|---|---|
| Home | 392 KB | 2012 / 1760 / 1724 | **1760** | **0 / 0 / 0** | hero soup-dumpling-spoon-1600.webp (67 KB) |
| Menu | 217 KB | 1156 / 1244 / 1296 | **1244** | 0 / 0 / 0 | intro text |
| Checkout (2 items) | 133 KB | 1148 / 1028 / 996 | **1028** | 0 / 0 / 0 | demo note |

All are inside budget (under 1.5 MB, hero under 200 KB). Home LCP improved from 2144 to 1760 ms.

## Hero (first screen) vs butter-and-bloom, hoshi-counter, olio-terrace

- **Clearly distinct now.** Jasmine Lane opens on a deep ink-jade band, not cream. There is no arch, no floating dish card and no status pill.
- The photography sits in two rectangular "hanging-scroll" frames with an inset hairline: a tall soup-dumpling spoon and a smaller dark teapot panel, plus a vermilion 點心 seal.
- The order card is replaced by a menu "chit" with a dotted price leader and a vermilion Add button. A vertical 茶 · 點心 rule sits beside the headline.
- Butter-and-bloom and olio-terrace are both cream with an arch and a floating card. Hoshi is near-black with a full-bleed sushi cut-out and a red disc, so it differs in hue, photo treatment and layout. Squint test passes at 1440 and 390 (compare-hero-1440.jpg, compare-hero-390.jpg).
- **Second panel (dark teapot):** fine and on-brand. It is very dark at 14vw, so it reads as mood rather than content, which is right for a secondary panel. Its alt is truthful. It is hidden below 56em, so phones see only the dumpling photo, which is the right choice.
- **Phone:** the photo is on top with the dumpling clearly visible, then the headline and two CTAs above the fold (p00-home-390.jpg).

## Menu presentation (judgement requested)

- **Phone (390):** acceptable. The photo-less items show a small 90 px lid disc in a list row, the same rhythm as the photo rows, and do not look broken (menu-rice-390.jpg).
- **Desktop (1024/1440): not acceptable for a client demo as is.**
  - The grid is 4 columns of large 220 px round frames. 8 of 19 cards are identical empty bamboo lids.
  - At 1024 the "Rice and noodles" section fills the screen with three blank lids (menu-rice-1024.jpg).
  - At 1440, sections of 5 leave an orphan (basket for two, chrysanthemum) and sections of 3 leave an empty column (menu-full-1440.jpg).
  - A client will read this as "unfinished" or "where is the food?". It also misses BRIEF §7 "every menu item with a real photo".
- **Recommendation (either of these):**
  - (a) Source truthful photos for the 8 items: cheung fun, lo mai gai, egg fried rice, turnip cake, jade dumplings, mango pudding, pu-erh liquor, chrysanthemum tea. All are common on Pexels.
  - (b) Give photo-less items a compact text card on desktop instead of the full-size disc: name, line, price and Add in a 2-column list with a hairline, as the phone layout already does. Then show "Rice and noodles" as a text menu block beside a single photographed dish.
  - Also use 3 columns on the menu from 60em, so 3-item sections fill a row.

## Issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | **Medium** (demo impression, BRIEF §7 gap) | 8/19 items are empty lid discs. On desktop the whole "Rice and noodles" section is blank lids; at 1024 it fills the viewport | menu-rice-1024.jpg, menu-rice-1440.jpg, menu-full-1440.jpg | Truthful photos for the 8, or a compact text-card style for photo-less items on ≥48em (see above) |
| 2 | Low | Menu grid at ≥60em is 4 columns for sections of 5/3/3/5/3: orphans and empty columns in every section | menu-full-1440.jpg | `repeat(3, …)` for `[data-menu]` grids, or balance section sizes |
| 3 | Low (copy accuracy) | "Baked and fried" holds nothing baked (spring rolls, pan-fried turnip cake, gua bao); the meta says "baked and fried dim sum" | site.js line 66, menu.html line 7 | Rename "Fried and pan-fried" (and update the meta), or move a baked item (egg tarts, char siu sou) into it |
| 4 | Low | The hero chit says "**Today's** basket", which implies a daily-changing special that does not exist. The hero photo's XLB has orange roe tops while the chit names "Pork soup dumplings" | p00-home-390.jpg | "Start with" / "A first basket"; optional: use the plain XLB photo (steamed-dumplings-bamboo) near the chit, or keep the roe photo unlabelled |
| 5 | Low (copy) | "Steamed sponge cake: Ma lai go in two flavours: black sesame and golden custard". Ma lai go is usually the brown-sugar sponge, and "custard" flavour is not provable from the plain yellow wedges | site.js line 95 | "Steamed sponge cake in two flavours: black sesame and plain [to confirm]" |
| 6 | Low (carried) | System font stacks (Constantia/Candara/KaiTi): Android and iOS render other faces | style.css lines 30–32 | Bundle one OFL serif and one sans as woff2 with `font-display: swap` |
| 7 | Info (core, not site) | The tip choice persists into the next cart: after a 15 % order, a new spring-roll cart opened with 15 % pre-selected ($11.55) | flows.json `min_place` | Manager: consider resetting the tip to `defaultTip` after a placed order |
| 8 | Info | Home shows the open status twice in the first screen at 1440 (hero line and the infobar under it) | hero-jasmine-lane-1440.jpg | Optional: drop one on desktop |

## Design rating: 8/10 for the home page, 7.5/10 overall

What is good:
- The new ink-jade hero with scroll frames, seal and chit is distinctive and calm, and no longer reads as the bakery.
- The pairing band is useful and elegant.
- Chinese typography is restrained and correct.
- Checkout is clean, and all pages are fast with CLS 0.

What a client would still criticise:
1. "Half my menu has no pictures, and the rice section is just empty circles" (desktop).
2. "Why are there gaps in the menu rows?"
3. "Nothing in 'Baked and fried' is baked."
4. "Is 'Today's basket' something I have to change every day?"
5. The fonts look different on their own phone.

## Not tested

- Real phones, Safari and Firefox. Real screen readers: names were read from Chrome's AX tree.
- "Open now" state: the restaurant was closed during testing, so ASAP was covered only by the smoke test logic.
- Contrast beyond the smoke test's axe pass (0 violations).
- Optional 3D tea set: not built (allowed).
