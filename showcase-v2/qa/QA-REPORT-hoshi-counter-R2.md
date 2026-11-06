# QA report round 2: hoshi-counter (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05 at about 23:00 to 2026-11-06 (Thursday night). The sample restaurant showed "Closed now · opens tomorrow at 12:00 PM" the whole time, so checkout defaulted to "Schedule for later" and booking defaulted to Friday.
Method: headless Chrome only (`channel='chrome'`, `--headless=new`), `serve.py 8857` (stopped afterwards). No site files were changed.
Scripts and raw JSON are in the scratchpad `qa-hoshi2/`: `layout.py/json`, `booking.py/json`, `radio.py`, `flows.py/json`, `perf.py/json`.
Screenshots: `qa/screens-hoshi-counter-r2/` (27 jpg).

## Verdict: PASS

All 14 round-1 issues are fixed or reduced to an acceptable level. No blocking defect found. `core_smoke` passed 45/45. There were 0 console errors and 0 horizontal scroll at 8 widths on 3 pages. The order path takes 8 taps and booking takes Book + 3 interactions. Every total matched my own sums, all 14 photos are truthful, and the content rules hold. The open items below are Low or Medium polish.

## Round-1 issues: re-test

| R1 # | Issue | R2 result | Evidence |
|---|---|---|---|
| 1 | Checkout Bag cut off at 360/320 | **Fixed.** All header controls are inside the viewport on home, menu and checkout at 1440, 1280, 1024, 900, 768, 390, 360 and 320 (1 item in cart). Everything sits on one line (44 px tall, top 8 or 14). Checkout at 320: brand 16–116, "Menu" 162–223, Bag 229–304. axe finds 0 violations in the header. Names: "Bag, 1 item", "Site navigation", "Back to menu" (≥768) / "Menu" (phones), "Call" (phone bar) | hdr-checkout-320/360, hdr-index-320, layout.json |
| 2 | Booking defaulted to lunch | **Fixed.** Default is Fri 6 Nov at 5:30 PM, with evening slots only. Omakase latest start = close − 2 h (Fri 9:00 PM, Tue 8:00 PM, Sun 7:30 PM). Nigiri latest = close − 90 min (Fri 9:30, Tue 8:30, Sun 8:00 PM). Sunday starts at 5:00 PM | booking.json `day_*` |
| 3 | Sitting only as a free-text prefill | **Fixed.** There is a Sitting radio group. "Selected: Omakase, about 2 hours" updates live (aria-live). The card buttons set the radio. The notes line is replaced, not stacked, and typed notes are kept ("Sitting: Omakase. Nut allergy, birthday"). The confirmation shows "Sitting: Nigiri sitting, about 1 hour." "Make another booking" resets to Omakase with evening slots. Arrow keys switch the radio, and the label shows a 3 px focus ring | b02, b04, b05, booking.json |
| 4 | Book hidden in header at 1024 | **Fixed.** Book a seat (vermilion) shows at 1024 and 900. "Order" is shortened | hdr-index-1024 |
| 5 | Phone bar inverted | **Fixed.** On home, **Book a seat** is the vermilion primary and the widest (181 px at 390). On the menu, **Order / View order** comes first and is vermilion (193 px), with Book as the outline button | hero-390, m-rolls-390, layout.json `mbar` |
| 6 | "Sake" ambiguous | **Fixed.** "Salmon nigiri", "Lean tuna nigiri". Searching "sake" now returns the empty state | flows.json `search_sake` |
| 7 | Weak photo matches | **Fixed / acceptable.** "Aburi plate" with object-position 62% 55% shows seared nigiri plus a roll, matching the name. The dressed salmon roll crop shows the product. The matcha card says "powder … whisked when you order", and the alt says "before the water is added", which is honest | m-rolls-390, m-sweets-390 |
| 8 | Missing photos / thin menu | **Improved.** 19 items: 14 with photos, 5 text-only (negitoro hand roll, avocado roll, edamame, miso, black sesame ice cream). A hand roll and a vegan roll were added | flows.json `menu_cards` |
| 9 | JS-off checkout dead form | **Fixed.** The form is hidden and the panel says "Checkout needs JavaScript. Please call [phone]…" | nojs-checkout-390 |
| 10 | Credits placeholder | **Fixed.** The footer lists 15 Pexels names on all 3 pages. They match `photos/CREDITS.md` lines 92–107 (Ivan S has 2 photos) | footer |
| 11 | System fonts | Not changed (still the Bodoni 72/Didot → Georgia stack). Low, carried forward |
| 12 | Menu LCP 3.7 s | **Fixed.** Median 1.52 s (below) |
| 13 | Too close to jasmine-lane | **Fixed for jasmine** (black hero, no seal or vertical CJK). New likeness to cinder-and-salt (issue N3) | cmp-*.jpg |
| 14 | "View order · $0.00" with an empty cart | **Not changed.** Still shown with an empty cart. Judged Low: it is honest and opens the drawer's "Nothing here yet", but a $0.00 call to action reads unfinished | flows.json `menu_cta_empty` |

## Regression

| Area | Result |
|---|---|
| `qa/core_smoke.py --site hoshi-counter --port 8857` | **45/45 PASS** (axe 0 violations, keyboard, focus trap, storage blocked, reduced motion, targets ≥ 44) |
| Order path 390x844 touch | **8 taps**: Order → Add Hoshi box → Add Five-piece → View order (2) · $74.00 → Checkout → name → phone → Place order · $74.00. Confirmation #1726, Tomorrow 12:30 PM, Pickup at [address] (p01–p05) |
| Totals (my own sums) | 48 + 26 = $74 ✓. Salmon box 24 + akami 9 + edamame 2×6 = $45, + $4 delivery = $49 ✓, + 15% tip 6.75 = **$55.75** ✓ (p06). All 19 items: 160 + 39 + 65 + 47 + 14 = **$325**, shown $325.00, badge 19 ✓ |
| Delivery / scheduled | Slot list runs Tomorrow 1:00 PM … Sat 11:00 PM (48 slots). Picking a slot updates "Delivery: Tomorrow, 7:45 PM", and the confirmation repeats it ✓ |
| Booking 390 touch, minimal | Book (bar) → name → phone → Request seats = Book + 3. Confirmation with sitting ✓ |
| Booking keyboard 1440 | 28 key presses from page load: 15 Tabs to "Book nigiri sitting", Enter (focus moves to #reserve), Tab×8 to Name, type, Tab, type, Enter. The confirmation heading gets focus ✓ |
| Validation | Empty or Monday submit lists date + name + phone together. A one-letter name gives "looks too short" ✓ |
| Console / page errors | 0 (all flows, 8 widths, 3 pages) |
| Horizontal scroll | 0 px at all 24 page/width combinations |
| Broken links / images | 0 broken. 34 srcset files all return 200. Note: the menu's `#cat-*` anchors exist only after JS (core builds them). They work live (m-*.jpg) |
| Reduced motion | 0 running animations, 0 `.reveal.is-pending`, all reveal blocks at opacity 1 / clip none |
| Motion allowed | hero settle + disc animations. 7 reveal blocks pending at load. After scrolling, all are `is-in`, opacity 1, clip-path none, visible. Nothing stays clipped, so contrast is unaffected |
| JS off | Home: noscript notes for booking and ordering; the open-status pill reads "Opening hours". Menu: the "needs JavaScript" note. Checkout: form hidden, call note (see N5 for home) |
| Content rules | Footer "Sample design by Website Studio. Menu, prices and wording are samples. Photos are stock." is on all 3 pages. Brackets appear only for missing facts: [address] [phone] [email] [map], [Guest reviews / Press mentions: client to supply], [Photo …: client to supply], [Sourcing: client to confirm], [to confirm]. No inline wording tags. No reviews, awards or counts. Prices are marked (sample) |
| Dine-in vs takeaway | Clear. Hero says "Omakase counter — Takeaway sushi". Section names: "Omakase" / "Nigiri sitting" (dine-in) vs "Takeaway boxes". The menu banner says "The omakase and nigiri sitting are dine-in only, booked separately". The cart is titled "Your takeaway" |

### Photos (every file opened again)
08 (12 pieces counted: salmon, white fish, negitoro gunkan, prawn, red clam, squid, tamago, glazed scallop, aburi salmon, 2 translucent white, tuna) = "Twelve pieces" ✓. 01 = 5 nigiri (tuna, salmon, white fish, prawn, silver/dark fish) ✓. 11 boat on ice with lemon, sea grapes, cress ✓. 03 two salmon fans, cucumber ✓. 09 two lean tuna ✓. 10 two salmon nigiri with dressing and spring onion ✓. 02 salmon-tuna-salmon with wasabi ✓. 07 two tuna nigiri, cress, leaf ✓. 13 seared nigiri plus a tobiko roll ✓. 14 salmon/cream cheese/cucumber roll piece ✓. 06 dressed roll with sauce, sesame, almond, cress ✓. 12 yellowtail, scallop, lemon, lime ✓. 15 prawn, shiso, vegetable tempura on paper ✓. 16 matcha powder plus whisk (alt is honest) ✓. Story photos 04/05 have "Stock photo" captions. **0 mislabelled, no count conflicts.** One small alt issue: see N7.

### Performance (390x844, DPR 3, 4x CPU, 1.6 Mbps / 750 kbps / 150 ms, cache off, median of 3)

| Page | First-view bytes | LCP median (runs) | CLS | Load | LCP element |
|---|---|---|---|---|---|
| Home | **207 KB** | **2604 ms** (2604/2812/2404) | 0 | 3480 ms | hero img (14-roll 800w) |
| Menu | **200 KB** | **1520 ms** (1500/1652/1520) | 0 | 2286 ms | `p.menu-hero__lede` |
| Checkout (2 items) | **140 KB** | **1556 ms** | 0 | 2129 ms | `p.demo-note` |

All within budget (home far under 1.5 MB, LCP under 3 s).

## Open issues (none blocking)

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| N1 | Medium (design) | The hero product is a **salmon and cream cheese roll**. That is the most casual, Western-style sushi there is, and it leads a $145 omakase counter whose story is "rice first, then fish". A client would notice | hero-1440, hero-390 | Use a nigiri photo (02 salmon-tuna on black mirror, or 09 lean tuna) for the hero panel |
| N2 | Low–Medium | Phone menu: the first dish card starts at y = 1076 on a 844 px screen. The first screen is title, status, intro, dine-in banner, search and the category bar (unchanged from R1) | p01-menu-390, flows.json | Compact the menu hero on phones (shorter lede, banner as one line) so one dish row shows above the fold |
| N3 | Low–Medium (design) | Squint test against **cinder-and-salt** at 1440: both have a near-black first screen, a left-aligned Didone headline made of two short sentences ("Sit close. Eat slowly." / "Live fire. Honest cuts."), a status pill + eyebrow, a vermilion/ember primary + outline CTA, and a 3-fact row. Hoshi differs by its split photo panel and disc. Distinct from jasmine-lane and olio-terrace | cmp-hoshi-counter-1440 vs cmp-cinder-and-salt-1440 | Make the type truly "huge" (R1 suggested 10–14vw; it is 122 px ≈ 8.5vw), e.g. HOSHI / a single word set across the width, or move the copy under or over the photo, and drop the 3-fact row on Hoshi |
| N4 | Low | After a card "Book …" tap at 390, the page lands on the section heading. The radio is half hidden and the "Selected: …" line is under the sticky bar, so the visitor gets no visible confirmation of the choice without scrolling | b02-card-nigiri-390 | For `[data-book-set]` links, scroll to `#reserve-form` (or `.sitting`) instead of `#reserve` |
| N5 | Low | JS off on home: the booking form is still fully visible (1146 px tall) under the noscript note. Checkout hides its form, home does not | nojs-index-390, flows.json `nojs_vis_index` | Add `<noscript><style>#reserve-form{display:none}</style></noscript>` like checkout |
| N6 | Low | Monday or a past day: the time list says "No tables on this day", and the error says "No tables on the chosen day (closed or fully past)". This is the core's wording; the site's own "No counter seats…" message only appears when the evening filter empties a day. Switching Nigiri at 9:30 PM → Omakase silently resets the time to 5:30 PM (earliest), not the nearest valid 9:00 PM | booking.json `day_mon_*`, `late_switch` | hoshi.js: when the observer sees core's empty option, rewrite it to "No counter seats on this day" with the matching error; pick the latest valid slot that is not after the previous choice |
| N7 | Low | Hero alt says "lifted between wooden chopsticks". In the photo the piece sits on the surface with chopsticks either side | 14-roll-chopsticks-dark-800 | "…with wooden chopsticks poised on either side" |
| N8 | Low | Menu "View order · $0.00" button with an empty cart (R1 #14). Searching "omakase" on the menu gives "No dishes match" with no pointer to booking | flows.json | Hide `.menu-cta` while the count is 0. Optionally add "Looking for the omakase? Book a seat" to the empty state |
| N9 | Low | 360x640: the hero CTAs sit below the fold (bottom 740), and the eyebrow wraps with the rule left dangling. The sticky bar's Book a seat covers the action | hero-360 | Shorten the photo panel below 380 px height, and hide `.rule` when the eyebrow wraps |
| N10 | Low | System font stack (R1 #11) and the unqualified line "Every seat faces the chef" (a venue fact; covered only by the footer "wording are samples") | style.css, index.html:92 | Bundle Bodoni Moda woff2. Keep or soften the line with the client |

## Design rating: 8/10

Up from 7. The black first screen with the tall, dark photo panel and the vermilion disc feels premium and calm. The Didone headline is large and confident, food shows at 390 and 360, and the booking panel with sitting cards is the best on the showcase so far. Paper-cream menu cards with dark photos are elegant.
Why not higher: the hero dish undersells an omakase (N1). The first screen follows the same formula as cinder-and-salt (N3). "Huge type" is large rather than huge. The phone menu still opens on a page of chrome before food (N2).

What a client would still criticise:
1. "Why is a cream-cheese roll the face of my omakase counter?"
2. "It looks like the steakhouse demo in black."
3. "On my phone the takeaway menu starts with no food in view."
4. "When I tap Book omakase, I can't see that it picked omakase."

## Not tested
- Real phones, Safari, Firefox, real screen readers (axe only).
- ASAP pickup while open (the sample shop was closed during testing; the core logic is covered by smoke on the template).
- Fonts on Apple devices (Bodoni 72 / Didot are only on macOS and iOS; tested with the Georgia fallback).
