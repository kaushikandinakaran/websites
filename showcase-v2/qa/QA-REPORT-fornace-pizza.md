# QA report: fornace-pizza (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05 (Thursday, about 22:50 local). The sample restaurant showed **"Closed now · opens tomorrow at 12:00 PM"** the whole time, so checkout always defaulted to "Schedule for later" (ASAP was disabled) and booking defaulted to tomorrow.
Method: headless Chrome only (`channel='chrome'`, `--headless=new`), `serve.py 8849` (stopped afterwards). I did not modify any site files.
Scripts and raw results are in the scratchpad folder `qa-fornace/`: `flows.py`/`flows.json`, `layout.py`/`layout.json`, `extra.py`/`extra.json`, `perf.py`/`perf.json`, `texts.json`, plus extra slices in `shots/`.
Screenshots: `qa/screens-fornace-pizza/` (40 jpg). In the full-page `L-*` captures, some lazy images lower down look blank. That is a capture artefact: the crawl got HTTP 200 for every image, and the scrolled slices `M-*` show them rendered.

## Verdict: FAIL (one visible phone layout defect; everything else works)

What works: order path in 8 taps, booking with Book + 3 interactions, all totals correct (including build-your-own options), 0 console errors, 0 broken links or images, content rules and the three footer lines on every page, header controls inside the viewport at 320–1440, and smoke 42/42.
Why it fails: **the spinning text ring in the hero runs through the page text.** At 390x844 its letters cross the H1 "FIRED FAST." At 768 they cross the eyebrow line. That is a visible layout defect on a phone (issue 1).

## Summary table

| Area | Result | Evidence |
|---|---|---|
| `qa/core_smoke.py --site fornace-pizza --port 8849` | **42/42 PASS** | `qa/core_smoke_fornace-pizza.json` |
| Order path 390x844, touch | **PASS, 8 taps** | p01–p06 |
| Totals (my own arithmetic, 12 cases) | **PASS, 0 mismatches** | §2 |
| Build your own (Base/Cheese/2 toppings, option prices, "Start my pizza") | PASS (copy issue 4, name issue 5) | p07–p10 |
| Delivery fee $2.50, $15 minimum, tip, scheduled slot line | PASS | p11–p13 |
| Empty cart, qty +/−, remove, reload persistence | PASS | p14, p15 |
| Booking: validation, live summary, confirmation | PASS (Book + 3 interactions) | p16–p18 |
| Photos (17 site images, each opened) | **0 mislabelled**; 3 weak crops (issue 3) | §3, M-classiche-390 |
| Prices on cards vs `site.js` | 18/18 match | flows.json `cards` |
| Filters / search / jump bar | PASS | §3 |
| Broken links / images | **0** (40 URLs, 27 anchors) | layout.json |
| Content rules, placeholders, 3 footer lines on every page, credits | PASS | §4 |
| Hours text vs `SITE.hours` | match (the hours table is built from data; no hours are written into the HTML) | layout.json `hours_rendered` |
| Console/page errors (all flows, 5 viewports) | **0** | flows/layout/extra.json |
| Horizontal scroll (3 pages x 5 viewports) | 0 px | layout.json |
| Header controls inside viewport at 390/360/320 (badge 2 and 12) | **PASS** on all 3 pages (checkout Cart right edge 373/343/304) | h-checkout-header-320 |
| Header on one line at 1024/768 | PASS (72 px; full nav at 1024, hamburger + Order + Cart at 768) | V-index-1024, V-index-768 |
| Phone hero shows food | PASS (the disc photo is first; 234 px visible at 390) | p01 |
| Spinning ring / sticker vs text | **FAIL** at 390 and 768; the sticker also hides ring letters at every width | hero-390, V-index-768 |
| Back-to-top | PASS (smoke, 4 widths) | smoke |
| Performance (throttled phone, 3-run medians) | home 382 KB / LCP 2.32 s; menu 427 KB / 1.47 s; checkout 129 KB / 1.33 s; CLS ≤ 0.004 | §6 |
| Keyboard order path | PASS (69 key presses, visible 3 px focus ring) | kbd-confirmation-1440 |
| Reduced motion | PASS (ring, sticker and ticker all `none`; 0 running animations) | extra.json `rm` |
| JS off | home/menu OK (menu has a noscript note); **checkout shows a dead $0.00 form** | nojs-checkout-390 (issue 6) |
| Storage blocked | cart and Start my pizza work in memory, 0 errors; checkout is empty (documented core limit) | extra.json |

## 1. Conversion path (390x844, touch, DPR 2)

| # | Tap | Result |
|---|---|---|
| 1 | Sticky bar **Order** | menu.html |
| 2 | Add **Margherita** ($13) | "Added" |
| 3 | Add **'Nduja e burrata** ($18) | bar "View order (2) · $31.00" |
| 4 | **View order** | drawer: Subtotal $31.00, "Checkout · $31.00" |
| 5 | **Checkout** | Pickup preselected; closed, so "Schedule for later"; line "Ready for pickup: Tomorrow, 12:15 PM"; summary $31.00 |
| 6–7 | Name, phone | typed |
| 8 | **Place order · $31.00** | "Thank you, your order is in", #9898, Tomorrow 12:15 PM, Pickup at [address], Pay at pickup, $31.00; badge back to 0 |

- **Build your own:** tapping "Start my pizza" adds the item and opens the drawer, with focus on the panel (also by keyboard). Each topping shows its price in the select: Buffalo mozzarella (+$2.00), 'nduja (+$2.50), crudo (+$3.00), mushrooms (+$1.50), olives (+$1.00), rocket (+$1.00), aubergine (+$1.50), burrata (+$3.50). These prices match the home band and `site.js`. The checkout summary lists every choice ("Base: Rossa (tomato), Cheese: Buffalo mozzarella, Topping 1: Burrata, Topping 2: Prosciutto crudo"). Tapping Start again after customising adds a separate $11 line, which is correct.
- **Delivery:** fee $2.50 added. Marinara only ($10) and then Marinara + espresso ($13) are both blocked: "Delivery needs a subtotal of at least $15.00 (sample rule)…" (p11). With arancini added ($22) the order goes through.
- **Scheduled time:** picking "Tomorrow, 1:30 PM" and then "3:45 PM" updates the line to "Delivery: Tomorrow, 1:30 PM" and then "…3:45 PM". The confirmation says 3:45 PM, "Delivery to 1 Test Street, 10001", "Pay on delivery" (p12, p13).
- **Qty, remove, reload:** +1, −1 and remove are all correct. After a reload the badge shows 1, and home shows "View order (1) · $13.00". Removing the last line shows "Nothing here yet." Checkout with an empty cart shows the empty state and hides the form (p14).
- **Booking:** an empty submit lists "Enter your name / Enter your phone" (aria-invalid on both). Typing "A" changes the summary live to "Name looks too short…". The confirmation is WS-J76VEN, "2 guests on Friday, November 6 at 12:00 PM", and the heading gets focus.

## 2. Totals: expected (my arithmetic) vs shown

| Case | Expected | Shown |
|---|---|---|
| Margherita + 'Nduja | 13 + 18 = $31.00 | $31.00 (bar, drawer, button, summary, confirmation) |
| Build: default | $11.00 | $11.00 |
| Build: buffalo + burrata + crudo | 11 + 2 + 3.5 + 3 = $19.50 | $19.50 |
| Same build x2 | $39.00 | "$39.00 ($19.50 each)"; checkout $39.00 |
| Build x2 with 'nduja twice | (11 + 2 + 2.5 + 2.5) x2 = $36.00 | $36.00 |
| Build x2 + new default build | 39 + 11 = $50.00 | $50.00 |
| Marinara, delivery | 10 + 2.5 = $12.50, under the minimum | $12.50 + minimum error |
| + espresso, delivery | 13 + 2.5 = $15.50, still under the minimum | $15.50 + minimum error |
| + arancini, delivery | 22 + 2.5 = $24.50 | $24.50 |
| + 15% tip | 22 x 0.15 = 3.30 → $27.80 | $27.80 (rows $22 / $2.50 / Tip (15%) $3.30 / $27.80) |
| Margherita + crudo, +1, −1, remove crudo | 32 → 45 → 32 → 13 | 32 → 45 → 32 → 13 |
| All 18 items once | sum of `site.js` = $234.00 | $234.00, badge 18 |

## 3. Menu and photos (every image opened)

| Dish / use | Photo | Verdict |
|---|---|---|
| Hero (07, Strgar) | margherita cut into 4 pieces, top view | True; the alt "cut into four" matches |
| Margherita (01) | close-up: tomato, mozzarella, basil, charred rim | True |
| Marinara (crop of 08) | tomato and oregano, no cheese; cherry tomatoes on a board in the corner | **Clean, honest crop** |
| Margherita bufala (12) | charred margherita-style pizza on a board | True; the alt sensibly does not claim "buffalo" |
| Capricciosa (crop of 02) | ham, mushrooms, artichokes, olives, basil; **about 25% of the frame (bottom right) is another pizza** (prosciutto, rocket) | Honest dish, **not a clean crop**; on phone (7.5 rem row card) the neighbour is a thin edge only |
| Parmigiana (crop of 02) | fried aubergine, basil; **about 30% (bottom left) is a second pizza with prosciutto and rocket, plus a third pizza's rim at the bottom**. That is more than the "corner" the builder described | Honest dish, **weak crop** (issue 3) |
| Ortolana (06) | a vegetable pizza (olives, peppers) seen side-on on the floor of a flaming oven | Alt is honest ("baking on the stone floor of a flaming oven"). **On phone the row-card crop shows mostly flames and a thin strip of pizza** (M-classiche-390) (issue 3) |
| Burrata e basilico (09) | tomato, white pieces (they look like torn mozzarella/burrata), grated cheese, basil | Acceptable |
| 'Nduja e burrata (11) | rocket, roasted peppers, olives, whole burrata with a red crumbly spread | The 'nduja reading is plausible (it looks like 'nduja or a chilli paste). The alt avoids naming it. **Acceptable** |
| Crudo e burrata (crop of 02) | prosciutto, cherry tomatoes, rocket, whole burrata; edges of 3 other pizzas | Clean enough; the dish dominates |
| Mortadella e pistacchio (crop of 10) | white base, mortadella, pistachio pesto, crushed pistachios, burrata; edge of a plate | **Clean, true** |
| Build your own (05) | floured hands pressing dough | True as an illustration (also used in the story) |
| Two margheritas (13) | two margheritas held by two people | True; the count of 2 matches. The copy says "boxed together", but the photo shows plates (trivial) |
| Arancini (16) | **two** cone arancini on rocket | Count matches |
| Burrata e pomodoro (14) | whole burrata, sliced tomatoes, herbs, pesto, balsamic | True |
| Tiramisu (15) | one square, cocoa, mint, pale blue plate | True |
| Story "Fire" (03) | pizza in a wood-fired oven with logs | True; a stock caption, with the process placeholder next to it |

- Counts: only "Two crisp…" (arancini, 2 shown) and "Two margheritas" (2 shown). **No count conflicts.**
- Tags: Vegetarian (8), Vegan (4: marinara and 3 drinks), Spicy (1). No gluten-free, halal or organic claims. "About 12 inches [to confirm]" is marked.
- Search: "burrata" finds 5, "spicy"/"nduja" find 1, "zzzz" shows the empty state. Five category links, all working anchors. Scroll-spy passes in the smoke test.
- Credits: the footer names 11 photographers. My file-by-file mapping (hero 07 Strgar, 01 Idrissi, 08/02/10/16 Mason, 12 Guerrero, 06 Romy, 09 Larracas, 11 Nadin Sh, 05 Sevindik, 13 Strgar, 14 Boltneva, 15 Fernandez, 03 Barget) gives exactly these names. Photo 04 (Anna Shvets) is unused and correctly left out.

## 4. Content rules

- "Sample design by Website Studio. Menu and prices are samples. Photos are stock." appears on index, menu and checkout, plus "(sample business)".
- Placeholders are marked: [address] [phone] [email] [map], [Wording: client to edit], [How the dough is made and baked: client to confirm], [Your story: client to supply], [Guest reviews: client to supply], [Press or awards, if any: client to supply], [to confirm], "(sample hours, to confirm)", "Times are sample estimates", "(sample rule)".
- Text scan (since, award, rated, star, best, famous, review, organic, halal, gluten, certif, VPN, authentic, fresh, daily, hand, wood, year, San Marzano, DOP, tradition, always, only): **no invented facts**. No "VPN/AVPN" and no "wood-fired" claim in the text. The only process wording ("soft in the middle, blistered at the edge", "Tomato base, blistered crust") describes the product style, and the dough/bake placeholder sits right after it.
- "Build your pizza **in three taps**" is not accurate (issue 4).

## 5. Layout

- **Hero ring (issue 1).** `.hero__ring` is a 132% SVG circle around the disc that spins every 38 s. Its lower arc sits on the following text:
  - 390x844: ring box bottom at 417 px, H1 top at 368 px. In hero-390 the ring letters ("…ORDER · DIN…") are drawn **over "FIRED FAST."**
  - 768x1024: ring bottom at 625 px, eyebrow at about 560 px. The letters "IN" are drawn over "NEAPOLITAN PIZZA · PICKUP, DELIVERY, DINE IN" (V-index-768).
  - 360x640 and 320x568: the ring just touches the H1 (hero-360/320 slices).
  - 1024 and 1440: clear (the ring sits beside the copy).

  Because it rotates, different letters cross the text over time. The green "Pickup in ~15 min" sticker also always covers 2–4 ring letters ("ORDER ONLINE" is cut), so the ring never reads in full. The ring is `aria-hidden`, so this is visual only, but it is the first thing a phone visitor sees.
- 1440: confident, poster-like layout. Huge condensed caps headline with a tomato-red italic second line, a round pizza disc with a red half-moon, a red "speed" band (Pickup ~15 / Delivery ~35 / fee and minimum), a black dish ticker, 4 favourites, a basil-green build band with priced option pills and a CSS pizza, the story, hours, and a booking form with a red offset shadow.
- 1024/768: header on one line. No horizontal scroll anywhere.
- Phone: food first. The Order and Book CTAs are visible above the sticky bar at 390x844 and 360x640. At 320x568 the CTAs fall under the bar (the bar has Order and Book anyway).
- Menu at 390: the first dish card starts below the fold. The first screen is the red header block, search, chips and the category bar (p02) (issue 8).
- Checkout at 390/360: clean. The header shows "menu" (lower-case short label) plus Cart, inside the viewport.

## 6. Performance (4x CPU, 1.6 Mbps down / 750 kbps up / 150 ms, cache off, 3 runs)

| Page | Profile | First-view bytes (median) | LCP median (runs) | CLS median | LCP element |
|---|---|---|---|---|---|
| Home | phone 390 DPR3 | **382 KB** | **2320 ms** (1756/2320/2424) | 0.0036 | SVG ring `<text>` (hero-800 webp 92 KB loads alongside) |
| Menu | phone | 427 KB | 1468 ms | 0 | `p.small` (dishes are below the fold) |
| Checkout (2 items) | phone | 129 KB | 1332 ms | 0 | `p.lede` |
| Home | desktop 1440 | 343 KB | 2224 ms | 0 | ring text |
| Menu | desktop 1440 | 367 KB | **2864 ms** (2828/2864/3756) | 0.0023 | `IMG.dish__img` bufala-400 |

- The builder's figures (home 3.1 s, desktop menu 5.2 s) **did not reproduce**. I measured home 2.3 s and desktop menu 2.9 s. Both meet the brief's ~3 s target, but the desktop menu has a 3.8 s outlier. Budgets: home 382 KB (well under 1.5 MB), hero 92 KB served (160 KB max for the 1200w file).
- What drives the time: core.js (63 KB uncompressed; serve.py sends no gzip) plus 4–6 dish images of 25–90 KB each in the first view. On the phone home, burrata-basilico-800 (90 KB) and margherita-800 (67 KB) download in the first view next to the hero. On the desktop menu the LCP is a card image, which competes with about 8 other card images.
- Fonts: none loaded. The fonts are system stacks (Bahnschrift → DIN Condensed → Roboto Condensed → Arial Narrow), so the condensed look depends on the device (issue 9).

## 7. Keyboard, reduced motion, JS off, storage blocked

- Keyboard order (1440): Tab to the hero "Order online" → Enter → Tab to Add Margherita → Enter → Add Marinara → Enter → Shift+Tab to Cart → Enter → Tab to Checkout → Enter → name, phone → Place order. **69 key presses.** The confirmation heading gets focus, and the focus ring is a solid 3 px everywhere. "Start my pizza" by Enter opens the drawer with focus inside it.
- Reduced motion: ring, sticker bob and ticker are all `animation: none`, with 0 running animations. With motion allowed, the ticker pauses only on mouse hover (issue 7).
- JS off: home and menu are fine (the menu has "The menu and ordering need JavaScript. Please call [phone]"). **Checkout has no noscript note** and shows a full form with "Place order · $0.00" (nojs-checkout-390) (issue 6).
- Storage blocked: Start my pizza and Add work in memory (badge 1, then 2, "$23.00"), with 0 errors. Checkout says "Your order is empty", which is the documented core limit.

## Issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | **High (FAIL trigger)** | Hero spinning text ring overlaps the page text: over the H1 "FIRED FAST." at 390x844, and over the eyebrow at 768. It just touches the H1 at 360/320. The sticker also permanently hides 2–4 ring letters | hero-390.jpg, V-index-768.jpg, layout.json `hero` (ring box bottom 417 > H1 top 368 at 390) | style.css below 56em: increase `.hero__media` `margin-bottom` by the ring overhang (about 16% of the media width, e.g. `margin-bottom: calc(min(60vw,16rem) * .18)`), or shrink the ring to `inset:-10%` / 120% on phones. At 48–56em (768) add the same bottom margin. Move the sticker outside the ring band (e.g. `left:-22%; bottom:-14%`) or shorten the ring text so the covered part is a gap. Re-check 320–1024 with motion on |
| 2 | Medium (a11y) | Every dish Add button is announced as **"+ Add Margherita to order"** (and "✓ Added…" after adding), because `.dish__add::before { content:"+" }` is CSS-generated text that goes into the accessible name. This is the "CSS decorative characters read by screen readers" class | flows.json `menu_ax_buttons_sample` (CDP AX tree) | Use `content: "+" / ""` (alt-text syntax, Chrome/Safari) or draw the plus with a background/mask SVG instead of text |
| 3 | Medium | Weak photo crops (honest, not mislabelled): **Parmigiana** shows about 30% of a second (prosciutto) pizza plus a third rim. **Capricciosa** shows about 25% of a neighbouring pizza on desktop cards. **Ortolana** on the phone row card shows mostly flames and only a thin strip of pizza, so the toppings are unreadable | parmigiana-800/capricciosa-800 (viewed), M-classiche-390.jpg, M-classiche-1440.jpg | Re-crop parmigiana and capricciosa tighter from 02 (the dish centred, rotate if needed). For ortolana set `object-position` toward the pizza (about 50% 55%) and a taller crop, or use a top-view vegetable pizza photo. Keep the alts |
| 4 | Low–Medium (copy) | "Build your pizza **in three taps**" is not true. It takes Start + 4 selects (Base, Cheese, Topping 1, Topping 2), at least 5 taps, or 9 on a phone where each select is open + choose | p07, p09 | "Build your pizza in three steps" (matches the 1-2-3 cards) |
| 5 | Low (a11y) | "Start my pizza": the visible text is `aria-hidden`, and the accessible name "Add Build your own pizza to order and choose base, cheese and toppings" does not contain it (WCAG 2.5.3 label in name; voice users saying "click Start my pizza" fail) | flows.json `home_ax` | Make the name start with the visible words: visible span not hidden + `vh` " — adds Build your own pizza and opens your basket" |
| 6 | Low | JS off: checkout shows a working-looking form with "Place order · $0.00" and no note (the same class as on the other sites) | nojs-checkout-390.jpg | Add `<noscript><p class="demo-note">Ordering needs JavaScript. Please call [phone].</p></noscript>` under the H1 in checkout.html |
| 7 | Low (a11y) | The ticker (infinite marquee) and the spinning ring run more than 5 s with no pause control. Hover-pause does not help touch or keyboard users (WCAG 2.2.2). Reduced motion is honoured | style.css lines 335–341 | Add a small pause toggle, or stop the ticker and ring after one or two cycles (`animation-iteration-count`), or pause on `:focus-within` too |
| 8 | Low | Menu at 390: no dish is visible in the first screen (the red title block plus search, chips and catbar fill it) | p02 | Compact `.menu-hero` on phones (smaller H1, hide the "Sample menu…" line or move it below the dishes) |
| 9 | Low | System font stacks: Bahnschrift exists on Windows only. Mac and Android fall back to DIN Condensed / Roboto Condensed / Arial Narrow, so the brand look varies by device | style.css line 29 | Bundle one condensed display face (e.g. Barlow Condensed or Oswald, OFL) as local woff2 with `font-display: swap` |
| 10 | Info | Builder's performance numbers (home 3.1 s, desktop menu 5.2 s) were not reproduced (2.3 s / 2.9 s). The desktop menu still has a 3.8 s outlier from 8 card images in the first view | perf.json | `fetchpriority="low"` (core option) or `sizes` tuned to the 4-column card width (about 18rem) so desktop pulls the 400w files |
| 11 | Info | "Two margheritas… boxed together": the photo shows them on trays. The checkout header label is a lower-case "menu" on phones | for-two-800, p05 | "Two classic margheritas, packed together"; capitalise "Menu" |

## Design rating: 7.5/10

Why it is good: a genuinely distinct, playful pizzeria brand. Heavy condensed caps, tomato red / basil green / flour white, a round pizza disc with a ring badge and sticker, a red speed band that sells "~15 min", a black dish ticker, a green build band with priced pills and a CSS pizza, and offset-shadow panels. It puts ordering first with no clutter. The photography is bright and appetising, and the checkout is calm and clear.

Why not higher:
- On a phone the hero, the first thing a visitor sees, has ring letters running through the headline.
- Three menu photos are visibly cropped from group shots (or an oven shot), so the menu looks less "shot for us".
- The font depends on the device.
- The desktop story section's "Fire" image loads late. The layout is otherwise solid.

Compared with the other sites: distinct. The nearest motif is butter-and-bloom's small circular "pre-order" text badge, but Fornace uses a different scale, palette and type, and its hero is round and poster-like where the bakery uses an arched photo. It passes the squint test against hoshi, jasmine, butter-and-bloom, cinder and mustang.

What a client would criticise first:
1. "The spinning text is running over my headline on my phone."
2. "Why is there half of another pizza in the parmigiana photo, and why can't I see the ortolana?"
3. "It says three taps; it isn't."
4. "The headline font looks different on my iPhone."

## Not tested

- Real phones, Safari and Firefox, real screen readers. Accessible names were checked via the CDP AX tree, and axe through the smoke test (0 violations; axe does not flag the "+" prefix).
- The "open now" state. The restaurant was closed throughout, so ASAP pickup was not exercised on this site (the smoke test covers the core logic).
- Contrast was not re-measured beyond the smoke axe pass.
