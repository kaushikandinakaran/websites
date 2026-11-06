# QA report, round 2: olio-terrace (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05/06, about 23:00 local. The sample restaurant was **"Closed now · opens tomorrow at 12:00 PM"** for the whole test, so checkout always preselected "Schedule for later" (ASAP path not seen; same as round 1).
Method: headless Chrome only (`channel='chrome'`, `--headless=new`), `serve.py 8856` (stopped afterwards). No site files were changed.
Scripts and raw results: scratchpad `qa-olio2/` (`header.py/json`, `sweep.py`, `flows.py/json`, `layout.py/json`, `perf2.py/json`, `misc.py/json`, `grid.py`, `extra.py`, `cmp.py`).
Screenshots: `qa/screens-olio-terrace-r2/` (27 jpg).

## Verdict: FAIL (one Medium layout defect at a required width; a small CSS fix)

All 13 round-1 issues are fixed or improved except one part of issue 1. Header controls now fit **inside the viewport at all 8 widths on all 3 pages** (the round-1 blocker is gone). But the requested "one line" check fails on **home at 900 px**: "Mezze table", "Our story", "Book a table" and "ORDER ONLINE" each wrap to 2 lines (issue R2-1). A width sweep (300–1290 px, 10 px steps) puts the problem at **900–949 px on home only**. Menu and checkout are clean at every width.
Everything else passes: smoke 44/44, the order path takes 8 taps, all totals match my own arithmetic, CLS is 0, and every photo is honest.

## Round-1 issues: re-test

| R1 # | Issue | R2 result | Evidence |
|---|---|---|---|
| 1 | Header controls clipped (checkout 390/360/320, hamburger at 320) | **Inside viewport: PASS** at 1440, 1200, 1024, 900, 768, 390, 360, 320 on home, menu and checkout. Rightmost control at 320: checkout cart right edge 304 of 320, home hamburger 304. Accessible names (CDP AX tree): `button "Cart, 1 item"` (the word "Cart" is visually hidden ≤30em and still in the name), checkout link `"BACK TO MENU"` (visible text "MENU", the "Back to" span is clipped, not `display:none`). axe: **0 violations on all 24 page×width runs**. **One line: FAIL on home at 900–949 px** (R2-1) | h-checkout-header-390/360/320, h-index-header-320, h-index-header-900-wraps; header.json |
| 2 | Home CLS 0.102 on throttled phone | **PASS.** Full-length runs (9 s after load, about 12 s total per run), 4x CPU, 1.6 Mbps/750 kbps/150 ms, cache off. 390x844 DPR 3: 0 / 0 / 0. DPR 2: 0 / 0.0043 / 0 (the 0.0043 is the sticky bar label swap at 2.56 s). 360x640 DPR 3: 0 / 0 / 0. The chip reserves 2 lines (`min-height:3.2em`) | perf2.json |
| 3 | Thin menu, 4 text-only items | **Improved, PASS.** 16 items: 11 with photos, 5 text-only (lamb chops, lemon potatoes, extra pita, mint lemonade, Greek coffee). Added whole octopus for two and lamb chops; the olives now have a photo. Grid at 1440 and 1024: grill has 5 items in 3 columns, so 1 empty column, and the short text-only lamb card sits beside the tall whole-octopus photo card (ragged). Sides: 2 of 3 columns. At 768 (2 columns): grill and sweets each leave 1 empty slot. Cosmetic (R2-4) | menu-grill-row-1440/1024/768, menu-sides-row-1440 |
| 3b | Photos honest | **PASS with one alt nit.** I opened all 11 dish photos again. Mezze tray, hummus (blue ramekin, paprika oil, olive, parsley, pita), olives (green pitted olives, 2 bread slices, paprika), dolmades, calamari (+ herby dip), taverna salad (feta + oregano, olive), charred octopus plated, red mullet (5 fish, lemon slices), souvlaki (3 skewers, lime), baklava (4 pieces): all match name, description and alt. **Photo 09 (whole octopus for two):** it shows **several** whole octopuses cooking on a wire rack over glowing charcoal, not one plated octopus. As a "grilled over charcoal" image it is honest, but the alt says "Whole octopus" (singular) and a guest gets one, cut and plated (R2-3) | images 06–16 viewed |
| 3c | Totals | **PASS.** Expected (mine) = shown: 24+9 = 33.00; 19+3.5+27 = 49.50; souvlaki "Both" 21.00, ×2 = 42.00 → 72.50; −mullet 45.50; −coffee 42.00; delivery +4 = 46.00; +15% tip (6.30) = 52.30; olives only on delivery = 7+4 = 11.00 with the "$20 minimum (sample rule)" error; **all 16 once: 79 + 143 + 10 + 17.5 = 249.50**, shown $249.50, badge 16. The tip no longer carries over (R1 #13 fixed) | flows.json, p09, p10, p12 |
| 4 | "oven" wording | **PASS.** 0 matches in source (html/js/css) or in the rendered body text, `<title>`, meta description and JSON-LD of all 3 pages. The menu meta now says "charcoal-grilled fish, octopus, chicken and lamb" | extra.py |
| 5 | Tally | **PASS.** The label is now "small plates" and there is no ready state. Sequence: hummus 1 → salad 2 → calamari 3 → octopus from the signature strip 3 (not counted) → hummus 4 → platter **9 (+5)**; in the drawer, hummus −1 → 8. Totals 9/22/36/60/69/95/86. Platter + hummus + salad = 7, $48.00; **after reload still 7, $48.00**. Storage blocked: works in memory (2 → 3), 0 errors. Wording nits: "7 small plates · 3 dishes in all" reads oddly (more plates than dishes); only 6 dots exist for 7+; step 2 still says "…from the charcoal, **or a salad**", repeating step 1 (R2-2) | tally-platter-hummus-salad-390, p06, p07 |
| 6 | Phone hero had no food | **PASS.** At 390x844 and 360x640 the first screen is the headline plus a full-width mezze-platter card (16:9 photo, name, $26.00, Add). The bay view moved below it. At 360x640 the CTAs fall below the fold, but the sticky Order/Book/Call bar is visible | hero-phone-390x844, hero-phone-360x640 |
| 7 | noscript / hero times / credits / wording / footer | **PASS.** noscript: home (signature strip) and checkout (form hidden, call note) now have one, and menu already had one. The home mezze builder still shows "Loading the mezze list…" forever with JS off (Low, R2-5). Hero times use `data-site="timing.*"` = 20/45. Footer credits on all 3 pages list all 17 photographers, matching `photos/CREDITS.md` rows 60–75; no "[to confirm]". Bracket tags appear only for missing facts ([address] [phone] [email] [map] [Your story…] [Producer…] [to confirm] on "Charcoal" [Guest reviews…] [Press…] [Photos…] [Seating options…] [Delivery app 1/2]); no `[wording…]` or `[Suggestion…]` tags remain. The footer line "Sample design by Website Studio. Menu, prices and wording are samples. Photos are stock." is on every page | extra.py, nojs-*.jpg |
| 8–13 | olives copy, credits, 320 hamburger, story photo perf, hard-coded times, tip carry-over | All fixed. Home first view is now 515 KB (was 679) | perf2.json |

## Regression

| Area | Result | Evidence |
|---|---|---|
| `qa/core_smoke.py --site olio-terrace --port 8856` | **44/44 PASS** (axe 0, 16 items, JSON-LD marked sample) | qa/core_smoke_olio-terrace.json |
| Order path 390x844 touch: Order → Add octopus → Add hummus → View order → Checkout → name → phone → Place order | **8 taps**. "View order (2) · $33.00", confirmation #3335, Tomorrow 12:30 PM, Pickup at [address], $33.00, badge back to 0 | p01, p04, p05 |
| Delivery / scheduled | Delivery $46.00; 60 slots; time line follows the slot (1:00 PM → 2:00 PM); confirmation "Delivery to [test street 1], 00000", Pay on delivery, total $52.30 | p09, p10 |
| Booking | Book tap + 3 interactions; empty submit flags name and phone; short name, short phone and bad email each get their own message; confirmation focused | p13, p14 |
| Console / page errors | 0 (every flow, 8 widths) | all json |
| Horizontal scroll | 0 px, 3 pages × 6 widths incl. 320 | layout.json |
| Broken links / images | 0 (3 pages, all links and anchors, 35 image URLs) | layout.json |
| Invented facts | None: no reviews, ratings, awards, years or counts. Unqualified process claims remain in sample dish copy: the hero lede says "charcoal-grilled", the grill category says "Cooked over charcoal…", the whole octopus is "cut at the table". The story "Charcoal" belief is marked [to confirm]. Covered by "wording are samples", but inconsistent (R2-6) | extra.py |
| Perf, throttled phone (390x844 DPR 3, 4x CPU, 1.6 Mbps, 150 ms, 3 runs, medians) | **Home 515 KB, LCP 2668 ms** (2668/3772/2284), CLS 0; DPR 2: LCP 2524 ms, CLS 0. **Menu 445 KB, LCP 2052 ms**, CLS 0. **Checkout 140 KB, LCP 1076 ms**, CLS 0. Home at 360x640: LCP 2744 ms. LCP element: the mezze-tray card image (89 KB). Within budget | perf2.json |
| Keyboard (1440) | Skip link first; 21 Tabs to Add hummus in the mezze strip; tally "View your order" → drawer → checkout → name/phone → Place order → #6834, $19.00 (9+10 ✔), focus on the confirmation heading. 96 presses (long but works). Booking: hero Book → 7 Tabs to Name → confirmation focused. Ring: 3 px white + 6 px navy halo | misc.json, k02 |
| Reduced motion | Animations off (settle, rise, ticker, scroll-driven zoom), `getAnimations()` = 0, scroll-behavior auto | misc.json |
| Distinct look | Yes. Next to 7 finished sites (cmp-home-1440/390-8-sites) it is the only bright whitewash + Aegean-blue + terracotta site with an arch photo. Its nearest neighbour is butter-and-bloom (cream, serif with italic accent, pill buttons), but the palette, the arch and the blue wave bands separate them | cmp-*.jpg |

## Issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| R2-1 | **Medium (fails the required "one line" check at 900)** | Home header at 900–949 px: nav links "Mezze table", "Our story", "Book a table" and the "ORDER ONLINE" button wrap to 2 lines (link height 49 px vs 44). Menu and checkout are fine (no Order button there) | h-index-header-900-wraps.jpg; sweep.py | `.site-nav a, .header-order { white-space: nowrap; }`, then hide `.header-order` below about 60em, or switch to the nav toggle up to 60em. Re-run sweep.py 768–1024 |
| R2-2 | Low (wording) | Tally reads "7 small plates · 3 dishes in all", with more plates than dishes. Only 6 dots exist. Step 2 still repeats "or a salad" | tally-platter-hummus-salad-390 | Say "3 items · about 7 small plates", or drop "dishes in all"; step 2: "Add something from the charcoal." |
| R2-3 | Low (photo/alt truth) | The "Whole octopus for two" photo shows several octopuses cooking on a rack; the alt says one | menu-grill-row-768 | Alt: "Several whole octopuses cooking on a wire rack over charcoal". Optionally add the caption "on the grill" |
| R2-4 | Low (layout polish) | Desktop grill row: 1 empty column, and the short text-only lamb card sits beside a tall photo card. Sides: 1 empty column of 3. At 768: grill and sweets end with a lone card | menu-grill-row-1440/1024, menu-sides-row-1440 | Show text-only items (lamb, sides, drinks) as a compact price list, or span the lamb card / make text cards fill the row |
| R2-5 | Low | JS off: the home mezze builder still says "Loading the mezze list…" forever (the noscript note sits only under the signature strip) | nojs-index-signature-390 | Change it to "See the mezze on the menu" static text, or add a noscript there |
| R2-6 | Low (claim consistency) | "Charcoal" is [to confirm] in the story, but stated flatly in the hero lede, the grill category and the whole-octopus copy ("cut at the table" is also a service claim) | extra.py | Add one "[to confirm]" to the grill category intro, or soften the claims |
| R2-7 | Info | Sticky bar label wraps "View order (2) · / $33.00" at 390/360, with the dot left at the line end | hero-phone-*.jpg | Optional: drop the "·" on phones |

## Design rating: 7.5/10 (was 7)

Better than round 1. The phone now opens on food, the menu is fuller, the arithmetic is honest and the header no longer breaks on phones. Bright Mediterranean identity: whitewash, Aegean-blue wave bands, terracotta CTAs, arch photo, Greek-key footer.
What a client would still criticise:
1. "On my laptop window the menu links break onto two lines." (R2-1)
2. "Lamb, sides and drinks still have no pictures, and the grill row looks unfinished with gaps."
3. "'7 small plates, 3 dishes': which is it?"
4. "That octopus photo shows a whole grill of octopus, not my plate for two."
5. The keyboard order path is long (96 key presses), and the desktop hero is a view, not food (fine for a seaside taverna, but a choice).

## Not tested
- The ASAP "open now" path (restaurant closed for the whole test).
- Real phones, Safari and Firefox, real screen readers (only the axe and CDP accessibility tree).
