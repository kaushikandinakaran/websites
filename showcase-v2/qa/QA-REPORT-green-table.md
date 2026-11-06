# QA report: green-table (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05, Thursday 22:51 local. The sample café was **"Closed now · opens tomorrow at 7:30 AM"** for the whole test, so checkout always preselected "Schedule for later" and ASAP was disabled. The ASAP path was not seen.
Method: headless Chrome only (`channel='chrome'`, `--headless=new`), `serve.py 8855` (stopped afterwards; it also stopped once mid-test and was restarted). I did not modify the site.
Scripts and raw output are in the scratchpad folder `qa-green/`: `flows.py`, `layout.py/json`, `screens.py/json`, `perf.py`, `perf-dpr3.json`, `diag*.py`, `misc.py`, `rv*.py`, `slices.py`.
Screenshots: `qa/screens-green-table/` (40 jpg files).

## Verdict: PASS (no FAIL trigger found; 3 Medium issues worth fixing)

Things that work: the order path (8 taps), every total I computed, the build-your-own-bowl options, delivery, the time line following the slot, booking, all 15 photos truthful, 0 console or page errors, 0 broken links or images, the mandatory footer lines on every page, credits matching CREDITS.md, and **the checkout header fits at 390, 360 and 320** (the defect class found on olio-terrace and mustang-hearth is not present here).
Main weaknesses: the phone home LCP is about 3.3 s and the delay is CPU-bound, not bytes (issue 1). The phone first screen copies butter-and-bloom's layout (issue 2). An unqualified "Fresh, light, and made to order." heading (issue 3).

## Summary table

| Area | Result | Evidence |
|---|---|---|
| `qa/core_smoke.py --site green-table --port 8855` | **42/42 PASS** (incl. axe 0 violations, targets ≥ 44 px, back-to-top never overlaps) | `qa/core_smoke_green-table.json` |
| Order path 390x844 touch: Order → Add avocado toast → Add golden tofu bowl → View order → Checkout → name → phone → Place order | **PASS, 8 taps**. #8831, "Tomorrow, 7:45 AM", Pickup at [address], $29.00; focus on the confirmation heading; badge back to 0 | p01–p05 |
| Hero "Today's bowl" card + bowl-row cards | Add works from both. The ticket button flips to "Added" | p06, p14 |
| Build your own bowl (base/protein/dressing in the cart) | PASS: $13 → tofu $14.50 → eggs $15.00 → x2 $30.00 ("$15.00 each"). A second add with default options becomes its own line. Options are shown in the checkout summary and on the confirmation | p07, p09 |
| Totals (my own arithmetic, 14 cases) | **PASS, all match** | §2 |
| Delivery, $3 fee, $15 minimum, tip, time line follows slot | PASS | p08, p10 |
| Empty cart, qty +/−, remove, reload persistence | PASS | p11, flows |
| Book a table | PASS: Book tap + name + phone + submit; empty submit flags exactly name and phone; "looks too short" and the 7-digit phone message appear live; reference WS-GTWUZT | p12, p13 |
| Photos: all 15 opened and compared with name, description and alt | **PASS, 0 mislabelled**, no counts in copy | §3 |
| Menu | 16 items in 4 categories, 12 with photos; filters (Vegetarian 11/16), search, jump bar, scroll-spy work | smoke, menu-cards-390 |
| Broken links / images (3 pages, 50 URLs + all `#` anchors, images after scrolling) | **0 broken** (`#cat-*` anchors are created by JS and exist in the DOM) | layout.json, screens.json |
| Console / page errors (6 viewports, every flow) | **0** | all scripts |
| Horizontal scroll (3 pages x 6 widths incl. 320) | 0 px | layout.json |
| Header controls inside the viewport | **PASS** at every width, including checkout at 390/360/320 ("← menu" + icon cart) | H1-checkout-header-320, layout.json |
| Header on one line at 1024 / 768 | PASS: nav on one line at 1024; toggle at 768 with Order online + Cart + menu | L-index-1024, V-index-768 |
| Back-to-top | PASS (smoke check at 390/360/1024/1440) | smoke |
| Rotating bowl circle | Never covers text. The dashed ring ends above the open-status chip at 390/360/320 | V-index-390 (p01), V-index-768 |
| Bento grid at tablet widths | Fine at 1024 and 768. At 768 the large avocado card has a gap under its text (minor) | bento-768, bento-1024 |
| Performance, phone DPR 3, throttled | home **444 KB, LCP median 3.27 s**; menu 502 KB, 2.62 s; checkout 143 KB, 2.55 s | §6 |
| CLS (5 s window after load) | home 0.011 / 0.011 / 0; menu 0; checkout 0 / 0 / 0.038 | perf-dpr3.json |
| Keyboard order (1440) | PASS: skip link first; Add from the hero ticket and the own-bowl card; drawer; protein changed with the arrow key; checkout; confirmation focused; $29.50 correct; 91 key presses; 3 px blue ring + 6 px white halo | k01, k02 |
| Reduced motion | PASS: `gt-spin` off (`animation-name: none`), `getAnimations()` = 0, reveal skipped, scroll-behavior auto | misc |
| JS disabled | Footer appears through the fail-safe. Menu has a noscript note; **home and checkout have none**: checkout shows a dead $0.00 form | nojs-*.jpg |
| Storage blocked | PASS: 2 adds → "View order (2) · $28.00", 0 errors | misc |

## 1. Conversion path taps (390x844, touch, DPR 2)
1 Order (sticky bar) → 2 Add avocado toast ($13.50) → 3 Add golden tofu bowl ($15.50): bar "View order (2) · $29.00" → 4 View order: drawer subtotal $29.00, "Checkout · $29.00" → 5 Checkout: pickup preselected, schedule-later chosen automatically, "Ready for pickup: Tomorrow, 7:45 AM" → 6–7 name, phone → 8 "Place order · $29.00" → confirmation. **8 taps.**

## 2. Totals: expected (my own arithmetic) vs shown
| Case | Expected | Shown |
|---|---|---|
| Avocado toast + tofu bowl | 13.50 + 15.50 = 29.00 | $29.00 (bar, drawer, button, confirmation) |
| Hero squash ticket, own bowl, roast plate | 15 + 13 + 16 = 44.00 | $44.00 |
| Own bowl + tofu / + eggs / x2 | 14.50 / 15.00 / 30.00 | identical |
| Squash + 2 own (eggs) + roast | 15 + 30 + 16 = 61.00 | $61.00 |
| + 2nd own bowl, default options | 74.00 | $74.00 (separate line) |
| Remove squash; roast −1 | 59.00; 43.00 | $59.00; $43.00 |
| Reload | 43.00, badge 3 | $43.00, 3 |
| Delivery | 43 + 3 = 46.00 | $46.00 |
| Delivery + 15% tip | 46 + 6.45 = 52.45 | $52.45 (summary + confirmation) |
| Orange juice only, delivery | 5 < 15 minimum | "Delivery needs a subtotal of at least $15.00 (sample rule)…", order blocked |
| All 16 items once | 74.5 + 48.5 + 47.5 + 15 = 185.50 | $185.50 |
| + matcha oat milk (+0.50) | 186.00, matcha line 6.00 | identical |
| Keyboard: squash + own bowl with tofu | 15 + 14.50 = 29.50 | $29.50 |

Every card price equals `site.js` and is a number. Option prices in the cart read "Golden tofu (+$1.50)", "Two poached eggs (+$2.00)" and "Oat milk (+$0.50)".

## 3. Menu and photos (each image opened and looked at)
- 01 Sunny squash bowl (hero, card): squash, quinoa, spinach, avocado, chickpeas, white cheese, cherry tomato, lemon ✔ (sprouts and yellow pepper are also there; not mentioned, harmless)
- 12 Golden tofu bowl: rice, turmeric tofu under a creamy dressing, avocado, cucumber, broccoli, carrot, cherry tomato, chickpeas, black sesame, dill ✔. Tagged "Vegan [to confirm]", which is right because the dressing is unknown
- 02 Roast tofu and beet bowl: tofu cubes, beetroot, cherry tomato, roast sprouts/courgette, broccoli, leaves, seeds, white drizzle ✔ (also a white crumble, possibly cauliflower or feta; Low, it is not in the copy)
- 13 Turmeric roast plate: turmeric cauliflower, roast carrots, 2 roast tomato halves, mushrooms, avocado mash, lemon, sesame dip ✔
- 06 Avocado toast: one poached egg, dill, blue-grey plate, avocado halves ✔
- 09 Eggs benedict: 2 eggs on ham with hollandaise, potato cubes, greens, terracotta plate ✔ (no dietary tag, correct)
- 10 Baked eggs: 2 yolks, cheese, basil, flatbread, white tiles ✔
- 08 Pancakes: raspberries, blueberries, sugar dusting, dark plate ✔
- 07 Açaí: coconut shell, goji, chia, coconut, granola, mint, wooden spoon ✔
- 11 Granola: yogurt, raspberries, blueberries, white bowl ✔
- 14 Tropical granola: mango, kiwi, dragon fruit, granola, dark wood ✔
- 15 Matcha latte: latte art, pale grey cup and saucer ✔
- Scenes: 03 table for two with OJ and a red drink (the plates look like pasta dishes; the alt says "two plates of food", which is honest), 04 window table with plants, 05 avocado spread on seeded toast ✔
- Richness: 16 items, 4 text-only (own bowl, sourdough, flat white, orange juice). That is fine for a brunch café, but there is no savoury bowl with meat or fish, no smoothie, and only 3 drinks.
- The build-your-own-bowl card has no photo. The steps strip covers for it, but in the menu list it is the only bowl without one.

## 4. Content rules
- "Sample design by Website Studio. Menu and prices are samples. Photos are stock." is on index, menu and checkout ✔
- Credits: the footer names 14 photographers, which equals the 15 green-table rows in `photos/CREDITS.md` (Nicola Barts has 2) ✔
- Footer hours "Mon–Fri 7:30 AM – 3:30 PM, Sat–Sun 8:30 AM – 4:00 PM" = `SITE.hours` (green.js renders them from SITE) ✔. The hero times say "about 15 / 35 min · Sample times", filled from `SITE.timing` ✔
- Placeholders marked: [address] [phone] [email] [map] [Promise line…] [Wording: client to edit] [Club details…] [Reward rule…] [Plan price, days and terms…] [Guest reviews…] [Press or awards…] [Sourcing partners…] [to confirm with the kitchen] ✔
- No reviews, ratings, awards, years or customer counts ✔
- Stamp card: 6 circles, with 2 filled yellow and the last a leaf. It is marked "Stamp layout is a design preview only." and "[Reward rule: client to supply]". It does not state a reward count, so it is acceptable. But 2 filled stamps look like someone's progress (Low; issue 7)
- **Unqualified claims** (issue 3): the H2 "Fresh, light, and made to order." is not marked. Only the paragraph under it starts with "[Wording: client to confirm]". Also "Fresh orange juice / Pressed to order", "House granola", and "Today's bowl" (the same dish every day).

## 5. Layout (looked at)
1440, 1024, 768, 390, 360 and 320 for home, menu and checkout, plus the drawer at every width. The layout is clean. There is no horizontal scroll, and the header fits everywhere (checkout uses "← menu" and an icon-only cart below 26em). The phone hero leads with the bowl photo ✔. The drawer at 390 has full-width option selects and 44 px steppers.
- 768 home: the "Today's bowl" ticket floats mid-left, far from the bowl, with a large empty block above it (V-index-768). Low.
- Bowl-row cards off to the right stay at opacity 0 until swiped into view, then fade in over 0.7 s. That works, but it is extra motion on a horizontal swipe. Info.
- Checkout footer: `.footer__hours--inline > span + span::before { content: " · " }` is a CSS-added character that screen readers read out. Low.

## 6. Performance (390x844, DPR 3, 4x CPU, 1.6 Mbps / 750 kbps / 150 ms, cache off, 3 runs)
| Page | First-view bytes | LCP median (runs) | CLS | LCP element |
|---|---|---|---|---|
| Home | 444 KB | **3272 ms** (3272 / 3032 / 4436) | 0.011 / 0.011 / 0 | hero `01-salad-bowl-top-800.webp` (77 KB) |
| Menu | 502 KB | 2616 ms (4024 / 2616 / 2420) | 0 | menu intro text |
| Checkout (2 items) | 143 KB | 2552 ms (2552 / 1960 / 3760) | 0 / 0 / 0.038 | demo note text |

The builder's figure (home LCP 3.3 s on DPR 3) is **confirmed**. Later batches gave medians of 2.8–3.8 s, so it sits around the brief's ~3 s target or over it.
**Diagnosis:** this is not a byte problem. Every critical file (hero 77 KB, both CSS files, core.js and green.js) has arrived by **about 1.5 s**. Yet FCP is 1.6–3.6 s, DOMContentLoaded 3.5–8.7 s and LCP 2.9–5.6 s. Under the same throttling, **`_template` home gives LCP 1.21 s and DCL 1.62 s** (4 runs). The main thread is busy. My A/B tests by injected CSS (the site files were not changed): stopping the `gt-spin` rotation gave a median of 3.06 s against 3.79 s / 2.89 s for the two baseline batches. Removing the plate pseudo-elements and shadows gave 3.53 s. That is inconclusive at this noise level (other QA agents were loading the machine). The likely costs are painting the large rotating `scale(1.1) rotate()` image layer with its big blurred shadow, and the dashed ring, at DPR 3 from the first frame. The 3 lazy bowl-row images (212 KB at DPR 3) start only after about 5 s, so they do not compete.
Home CLS 0.011 comes from the hero open-status chip: "Opening hours" (1 line) is filled as "Closed now · opens tomorrow at 7:30 AM (sample hours)" (2 lines at 390). The H1, lede, CTAs and facts move. That is small, but it is the same class as olio-terrace issue 2.

## 7. Keyboard, reduced motion, JS off, storage blocked
See the table. JS off: home has no noscript note (the signature section is empty), and checkout shows the form with "Place order · $0.00" and no explanation.

## Issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | Medium (perf) | Phone home LCP median 3.27 s at DPR 3 (to 4.4 s in some runs), over the ~3 s target. All critical bytes are done by 1.5 s. The template reaches 1.2 s under the same conditions, so the time goes to main-thread rendering, not the network | perf-dpr3.json, diag outputs | Start `gt-spin` only after `html.js-ready` plus about 2 s (or after the `load` event), and on phones do not run it at all. Drop `decoding="async"` on the LCP image. Make the `.plate::after` shadow a static radial-gradient image rather than a large blurred box-shadow. Re-measure against `_template` |
| 2 | Medium (design) | The phone first screen has the same composition as butter-and-bloom: a photo in a rounded frame at the top, an overlapping white price ticket with "Add", the open-status pill, a big headline, 2 CTAs. Both use light cream backgrounds. Palette and type differ (sage/citrus grotesk vs rose/serif italic), so the squint test passes only narrowly | p01, `screens-butter-and-bloom-r2/15-compare-butter-and-bloom-390.jpg` | On phones, lead with something only green-table has: e.g. the three-step bowl builder as the hero (base/protein/dressing chips, price updating live), or a full-bleed sage band with the bowl cut off at the edge. Move the ticket under the headline |
| 3 | Medium (copy truth) | Unqualified claims: the H2 "Fresh, light, and made to order." (only the paragraph below is marked [Wording: client to confirm]), "Fresh orange juice: Pressed to order", "House granola", "Today's bowl" (a fixed dish shown every day as today's) | index.html story heading; site.js orange-juice, granola-berries; hero ticket | Put the [to confirm] marker into the heading (or rephrase: "Light plates and bowls"); "Orange juice [freshly pressed: to confirm]"; "Granola, yogurt and berries"; "Signature bowl" instead of "Today's bowl" |
| 4 | Low | JS off: checkout shows a dead "Place order · $0.00" form, and home has no noscript note (same class as cinder/olio) | nojs-checkout-390, nojs-index-390 | Add a `<noscript>` call-to-order note to checkout.html (and hide the form with a `noscript` style) and to index.html |
| 5 | Low | Home CLS 0.011 from the hero open-status chip growing from 1 to 2 lines | perf-dpr3.json shifts: H1, lede, hero__facts, hero__ctas | `.hero__chip { min-height: 2 lines }` on phones, or a 2-line placeholder string |
| 6 | Low (a11y) | CSS-added " · " between the checkout footer hours is read by screen readers | style.css line 377 | Use a border or margin separator, or `content: " · " / ""` (alt text form) |
| 7 | Low (content) | The stamp card shows 2 of 6 stamps filled, which reads like real progress, although it is marked as a preview | L-index-1440 club section | Show all circles empty, or all filled with a "Reward" label and no number |
| 8 | Low (design) | At 768 the "Today's bowl" ticket sits mid-left, detached from the bowl, with an empty block above it | V-index-768 | At 48–60em, keep the ticket overlapping the plate's lower-left edge (as on phones) |
| 9 | Low (richness) | 4 of 16 items have no photo (own bowl, sourdough, flat white, orange juice); no smoothie, nothing with meat or fish in the bowls, and only 3 drinks | menu-cards-390 | Give the own-bowl card the steps graphic or a bowl photo; add 2–3 drinks (cold brew, smoothie [to confirm]) and one savoury protein bowl if honest photos exist |
| 10 | Info | Checkout CLS 0.038 in 1 of 3 runs (form and step shifts at about 4.9 s and 5.7 s) | perf-dpr3.json | Watch it; it is under 0.1 |
| 11 | Info | Booking: after an empty submit, typing "bad@" into email does not add the email error to the summary until the field loses focus (core behaviour) | flows | Core: also validate on `input` for email after the first failed submit |

## Design rating: 7/10
Good: a fresh, clear brand. Sage, oat, charcoal and a citrus-yellow accent; a confident grotesk with a highlighted "Ready when you are."; a monospaced label voice; a real top-down bowl photo on a slow-turning plate. The 3-step build-your-bowl strip with an "own bowl" citrus card, a working bento of signature plates, and a dark-green Club band (stamp card + lunch plan slot) give it real conversion features no other site has. The food photography is honest and appetising.
What a client would criticise:
1. "On my phone it looks like the bakery site with green paint." (issue 2)
2. "It feels slow on my phone, the bowl appears late." (issue 1)
3. "We never said everything is made to order or freshly pressed." (issue 3)
4. "Why does the stamp card already have two stamps?" (issue 7)
5. "The build-your-own bowl and the drinks have no pictures."

## Not tested
- The ASAP/open path (the café was closed during the test).
- Real phones, Safari and Firefox; real screen readers (axe only).
- The performance numbers are noisy: other QA runs were loading the same machine. The template control run was taken in the same window.
