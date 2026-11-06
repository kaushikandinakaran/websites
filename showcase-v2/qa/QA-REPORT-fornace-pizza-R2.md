# QA report, round 2: fornace-pizza (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05/06 (run crossed midnight; the sample restaurant was "Closed now", so checkout used "Schedule for later" and booking defaulted to Friday 12:00 PM).
Method: headless Chrome only (`channel='chrome'`, `--headless=new`), `serve.py 8858` (stopped afterwards). No site files modified.
Scripts and raw JSON: scratchpad `qa-fornace2/` (`layout.py`/`ring.json`, `checks.py`/`checks.json`, `flows.py`/`flows.json`, `perf.py`/`perf.json`, `compare.py`).
Screenshots: `qa/screens-fornace-pizza-r2/` (23 jpg).

## Verdict: FAIL (narrow: one visible menu-grid defect at 1024; every round-1 issue is fixed)

All round-1 issues are fixed with evidence, the smoke test is 45/45, the order path is 8 taps, and all totals are correct. It fails on one item the round-2 brief names: **the menu grid has orphan cards and holes at 1024 in every category** (and two half-empty rows at 1440). This is a one-rule CSS fix.

## Round-1 issues: re-check

| # (R1) | Issue | Result | Evidence |
|---|---|---|---|
| 1 | Hero ring over text | **FIXED.** Annulus (ring letters, any rotation) vs every text rect at 8 sizes: **0 overlaps**. Smallest gaps: H1 line 1 16.8 px (320), 17.5 (360), 18.2 (390); eyebrow 42 px (768); header 20.8 px (320); lede ≥ 60 px at 1024. Sticker sits inside the ring's inner radius at every width (clearance 0.9–11.7 px, measured including its 4 px flour ring), so no ring letter is covered | ring.json; hero-1440/1200/1024/900/768/390/360/320.jpg |
| 2 | CSS "+"/"✓" in names | **FIXED.** AX tree: "Add Margherita to order" (no "+"), after adding the name has no "✓"; chips "Vegetarian" pressed=true without "✓". `::before` content is `"✓" / ""` | checks.json `menu_add_names`, `plus_or_check_in_names: []` |
| 3 | Weak crops (parmigiana, capricciosa, ortolana) | **FIXED / improved.** Parmigiana and capricciosa removed. Ortolana re-cropped: the pizza (olives, peppers, onion-like pieces) is now the middle band and fills the phone row card. Menu = **16 items, 13 photos, 3 drinks** (text tickets) | ortolana-800 viewed; menu-ortolana-390.jpg; checks.json `items` |
| 4 | "Three taps" copy | **FIXED.** Now "Build your pizza in three steps" (matches the 1-2-3 cards) | index.html |
| 5 | Start my pizza label-in-name | **FIXED.** Name = "Start my pizza (adds Build your own pizza to your order, then choose base, cheese and toppings)": starts with the visible label (WCAG 2.5.3) | checks.json `home_start_name` |
| 6 | JS-off dead checkout form | **FIXED.** Checkout: form and Place order hidden, note "Online ordering needs JavaScript. Please call [phone] to order." Home and menu have their notes | nojs-checkout-390.jpg; checks.json `nojs` |
| 7 | Endless ticker/ring | **FIXED as requested.** `getAnimations()`: ring 30 s x2 (60 s), sticker 4 s x3 (12 s), ticker 40 s x2 (80 s), all `finished` at the end. The ticker ends on its first half, so it stops showing full names, not a gap. Reduced motion: 0 animations | checks.json `anim` |
| 8 | Phone menu first screen | **FIXED at 390x844:** Margherita card fully visible (530–718 px, sticky bar at 780) with its photo | menu-first-390.jpg |
| 9 | Device fonts | Not changed (system stack). Still Low | style.css line 29 |
| 11 | "boxed together", lower-case "menu" | **FIXED** ("packed together"; checkout header "Menu") | site.js, checkout.html |

## Other required checks

| Check | Result | Evidence |
|---|---|---|
| `qa/core_smoke.py --site fornace-pizza --port 8858` | **45/45 PASS** (axe 0 violations) | qa/core_smoke_fornace-pizza.json |
| Every dish photo (13 + hero + 2 story) opened with Read | 0 mislabelled. Counts that the copy states: arancini "Two" = 2 shown; "Two margheritas" = 2; hero "cut into four" = 4 pieces. No other counts | images/*-800.webp |
| Names/descriptions/alt | Truthful. Alts describe what is visible ('nduja alt says "red spicy spread", bufala alt avoids "buffalo"); "about 12 inches [to confirm]" marked | site.js |
| Totals (my arithmetic) | Order path 13+18 = $31.00 ✓; all 16 once = $203.00 ✓ (badge 16); build default $11.00 ✓; buffalo+burrata+crudo 11+2+3.5+3 = $19.50 ✓; x2 = $39.00 "($19.50 each)" ✓; delivery marinara 10+2.50 = $12.50 + minimum error ✓; marinara+arancini 19+2.50+15% tip 2.85 = **$24.35** ✓; keyboard 13+10+13 = $36.00 ✓ | flows.json |
| Build options | Each topping shows its price (+$1.00 to +$3.50), matching the home band | flows.json `build_opts` |
| Order path 390x844 touch | **8 taps**: Order → Add Margherita → Add 'Nduja → View order ($31.00) → Checkout → Name → Phone → Place order. Confirmation #2364, "Today, 12:15 PM", Pickup at [address], Pay at pickup, focus on heading, badge 0 | p1–p4 |
| Delivery / scheduled | 60 slots; chosen "Today, 2:00 PM" → estimate line and confirmation both say 2:00 PM, "Delivery to 1 Test Street, 10001", "Pay on delivery" | p5-delivery-confirm-390.jpg |
| Booking | Book (sticky bar) + name + phone + submit = Book + 3. Empty submit lists 2 errors. Ref WS-WHPAZU, "2 guests on Friday, November 6 at 12:00 PM, under the name Ana Test.", focus on heading | p6-booking-confirm-390.jpg |
| Keyboard path 1440 | Skip link first; hero Order → Add x2 → Shift+Tab to Cart → qty + → Checkout → name/phone → Place order: **73 key presses**, focus ring solid 3 px #1546c8 | kbd-confirmation-1440.jpg |
| Console/page errors | **0** (all flows, 9 viewport sizes) | checks/flows/ring.json |
| Horizontal scroll | **0 px** on 3 pages x 6 widths (1440–320) | checks.json `pages` |
| Crawl | 38 URLs all 200, 27 anchors all resolve, 0 broken images | checks.json |
| Footer line | "Sample design by Website Studio. Menu, prices and wording are samples. Photos are stock." on all 3 pages at all widths | checks.json `pages` |
| Credits | 11 names; my file mapping (07/13 Strgar, 01 Idrissi, 08/02/10/16 Mason, 12 Guerrero, 06 Romy, 09 Larracas, 11 Nadin Sh, 05 Sevindik, 14 Boltneva, 15 Fernandez, 03 Barget) matches photos/CREDITS.md and the footer exactly | |
| Wording-tag rule | No "[Wording: client to edit]" tags left. Brackets only on missing facts: [address] [phone] [email] [map], [Delivery app 1/2], [to confirm], [Your story…], [Guest reviews…], [Press or awards…], [How the dough is made and baked: client to confirm] | checks.json `brackets` |
| Invented facts / process claims | None found. No reviews, awards, years, AVPN, "wood-fired" or "San Marzano" claims in text; the oven photo alt describes the photo, and the process placeholder sits next to it | |
| Header controls 390/360/320 | All inside the viewport on all 3 pages with badge 2 and 12 (max right edge 373/343/304); all ≥ 44 px | header-checkout-320-badge12.jpg |
| Performance (phone 390 DPR3, 4x CPU, 1.6 Mbps/150 ms, cache off, median of 3) | Home **383 KB, LCP 2.09 s**, CLS 0; Menu 151 KB, 1.34 s, CLS 0; Checkout (2 items) 130 KB, 1.01 s, CLS 0 | perf.json |
| Distinct first screen | Yes. The only condensed heavy-caps poster hero with a round pizza disc and text ring, red/green/flour palette. Nearest neighbour green-table (bold sans) is clearly different in type, colour and layout | compare-first-screens-1440.jpg |

## Issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | **Medium (FAIL trigger: named R2 criterion)** | Menu grid holes. At **1024** the grid is 3 columns, but categories have 4 or 2 items, so Classic pizzas (Ortolana), Burrata & specials (Mortadella) and Dessert & drinks (Espresso) each leave **one card alone on a second row with 2 empty cells**, and Build & share / Fried & starters leave 1 empty cell. At **1440** (4 columns) Build & share and Fried & starters fill only half their row. 768 (2 columns) is clean | menu-grid-1024.jpg, menu-grid-1440.jpg; checks.json `grid` (`empty_cells`) | style.css: between 56em and 80em force `[data-menu] .dish-grid { grid-template-columns: repeat(2, 1fr) }` (or 4 columns with `minmax(12.5rem,1fr)`, which fits 4 at 1024). For the 2-item categories at 1440, either 2 columns `max-width: 50%`, or make those cards span 2 columns as wide horizontal cards (`.dish-grid:has(> li:nth-child(2):last-child)`) |
| 2 | Low (a11y) | Ring (60 s) and ticker (80 s) still move for more than 5 s with no pause control. WCAG 2.2.2 asks for a stop within 5 s or a pause. Both are decorative, now finite, and reduced motion is honoured | checks.json `anim` | Shorten to under 5 s total, or add pause on `:focus-within`/a small toggle. Accept as is if the team accepts finite motion |
| 3 | Low | 360x640 menu: only the top 46 px of the first dish card show above the sticky bar | checks.json `menu_first_screen_360` | Hide the open-status pill or the "Showing all 16 dishes" line below 40em height, or tighten `.menu-hero` at `max-height: 700px` |
| 4 | Low | Ortolana photo is still a side view with about half the frame out-of-focus oven floor; at 1440/1024 the card shows a thin strip of pizza | menu-grid-1440.jpg | Swap for a top-view vegetable pizza if one is in the library, or `object-position: 50% 45%` with a taller 4:3 crop |
| 5 | Low | Fonts are a system stack (Bahnschrift on Windows only), so the condensed look differs on Mac/Android (unchanged from R1) | style.css line 29 | Bundle one OFL condensed face (Barlow Condensed/Oswald) as local woff2 |
| 6 | Info | At 320x568 the hero CTAs sit under the sticky bar (the bar has Order and Book). At 320 the ring's right letters run over the red half-moon (dark on red, decorative, `aria-hidden`) | hero-320.jpg | Optional |

## Design rating: 8/10

Up from 7.5. The hero is now clean at every width: a confident poster headline, a round pizza disc with a readable text ring and the "Pickup in ~15 min" sticker, and the red speed band. The phone menu opens on a dish. The build band, the ticker and the offset-shadow panels give it a playful, distinct pizzeria brand that sells speed.

What a client would still criticise:
1. "On the iPad/laptop menu, why is one pizza sitting alone on its own row?" (issue 1)
2. "The ortolana photo is mostly blurry oven."
3. "The headline font looks different on my iPhone."

## Not tested

Real devices, Safari/Firefox, real screen readers (names checked via the CDP AX tree and axe), the "open now" state (closed throughout), and contrast beyond the smoke axe pass.
