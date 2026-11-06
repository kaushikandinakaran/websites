# QA report: butter-and-bloom (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05. Headless Chrome only (`channel='chrome'`, `--headless=new`), server `serve.py 8842` (stopped afterwards). No site files modified.
Scripts: `C:\Users\kaush\AppData\Local\Temp\claude\53e3aa7b70d7a652\768b905f-d1cb-4392-b7ce-97c1fa6f393a\scratchpad\qa-butter\` (a_order, b_flows, c_crawl, d_layout, e_scroll, f_perf, g_misc, h_header, i_mbar, j_cmp + *_out.json).
Screenshots: `qa/screens-butter-and-bloom/` (40 jpg).
Fixed clock used where stated (`page.clock`): Tue 2026-11-10 10:00 (open). Real clock = Thu 2026-11-05 evening (closed).

## Verdict: FAIL (narrow, fixable in under an hour)

The order path, totals, menu photos, links, performance and accessibility basics all pass. It fails on two of the agreed FAIL triggers:
1. **Visible layout defect on phone:** on checkout.html the header Bag icon is squashed: 16.5 px wide at 390, 10.7 px at 360 and about 2 px at 320 (it should be 22 px). Screenshots `L-checkout-360x640.jpg`, `20-header-checkout-320.jpg`.
2. **Unqualified claims / invented operational facts:** "Small batches, slow mornings" (h2), "Fresh orange juice: Squeezed to order.", Sandwiches: "Made to order.", Baker's box: "picked by the bakers on the day", story: "butter on the bench and flowers on the tables". These are the same kind of claim as "baked fresh daily".

## Issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | High (FAIL) | Checkout header: Bag icon shrinks to a sliver on phones. The brand wraps to 2 lines and "Back to menu" wraps too | `L-checkout-360x640.jpg`, `20-header-checkout-320.jpg`; svg width 16.5 / 10.7 / ~2 px at 390 / 360 / 320 | In style.css: `.cart-btn svg{flex:0 0 auto;width:22px;height:22px}`. Under ~26em, hide "Back to menu" or shorten it to an icon or "Menu", and stop the brand wrapping (`white-space:nowrap` plus a smaller size) |
| 2 | High (FAIL) | Unqualified claims presented as fact: "Small batches", "Squeezed to order", "Made to order", "picked by the bakers on the day", "butter on the bench..." | site.js lines 59, 98, 110; index.html story h2 and lede | Rephrase neutrally (e.g. "Pastry, bread and slow mornings") or mark with `[to confirm]`. Descriptions: "Orange juice", "Sandwiches", "Four assorted pastries, baker's choice" |
| 3 | Medium | A count in the description contradicts the photo: Cookies & milk says "Two chocolate chip cookies" but the photo shows a stack of about 5 plus a jar of cookies | `images/cookies-milk-*.webp`, site.js line 86 | "Chocolate chip cookies with a glass of cold milk", or a photo with two cookies |
| 4 | Medium | Counts in names that the photo does not show: "Macarons, box of 6" (photo shows 4), "Baker's choice, box of 4" (photo is a close-up of about 5 pastries), "Morning pastry basket, 8 pieces" (basket holds 12+). The alts themselves are truthful | Read of each image; `menu_items` in c_out.json | Keep the counts as the product spec but add "Photo is illustrative", or pick photos that match the counts |
| 5 | Medium | 14 of 28 menu items have no photo (almond croissant, pain au chocolat, baguette, seeded rye, avocado toast, ham & gruyère croissant, quiche, 3 sandwiches, 4 drinks). BRIEF: "Hero and every menu item with a real photo" | `menu_items` (img null); `s-menu-390-03/08` (scratch) | Add photos from the library, or accept text-only cards as a deliberate design decision (they look tidy, not broken) |
| 6 | Medium | 1024 px header on home: every nav label wraps to 2 lines ("Pre-/order", "Hours &/location"), the brand and the "Order online" button wrap | `L-index-1024x768.jpg` | Hide the header "Order online" button or 1–2 nav items between 56em and 72em, or shrink the gap and font. The menu page at 1024 is fine (it has no Order button) |
| 7 | Low | "Pre-order for tomorrow" promise is untrue on Sundays: Monday is closed, so the slot list has no "Tomorrow" entries (next is "Tuesday"). Copy: "Pick a time tomorrow", seal "PRE-ORDER · FOR TOMORROW" | a_out.json `preorder_2026-11-15T11:00` (14 slots, 0 Tomorrow) | "Pre-order for tomorrow or the next open day"; checkout tip: "pick a time on your pickup day" |
| 8 | Low | Hero card says "Butter croissant $4.25" on a photo of a croissant with jam (that dish is "Croissant & raspberry jam $5.50") | `01-phone-home-landing.jpg` | Make the card the croissant-and-jam item, or use the butter-croissant photo |
| 9 | Low | srcset declares `-1600.webp 1600w` for portrait files that are really 1333 w (berry-tartlet, eclairs, croissant-jam in menu) or 1500 w (strawberry-cakes) | measured file sizes; site.js `photo()` | Pass the real width to `photo()` for the 1600 variant |
| 10 | Low | Story image (hands-dough) looks very soft when cropped into the big arch (shallow depth of field plus a cover crop) | `s-index-1440-03.jpg`, `s-index-390-04.jpg` (scratch) | Use a sharper photo or less zoom (`object-position`) |
| 11 | Low | 320 px phone bar: "View order (3) · $88.00" wraps to 3 lines, cramped | `21-mbar-320-three-items.jpg` | Shorter label under 22em ("Bag · $88.00") |
| 12 | Low | JS off: home and checkout have no `<noscript>` note. Checkout shows a working-looking form with $0.00 | `19-nojs-checkout.jpg` | Add the same noscript call-to-order line the menu has |
| 13 | Low (shared core, report to core builder) | Booking validation: with name "A", phone "12" and email "bad@", the summary lists only name and phone (email is flagged only once the others pass). Name "A" says "Enter your name." though one was entered | b_out.json `book_errors_bad`, g_out.json `book_bad_email` | Core: validate all fields in one pass; message "Enter at least 2 characters" |
| 14 | Info | photos/CREDITS.md does not exist yet. The footer credit points to it with `[to confirm]` | `ls photos` | Not failed (as instructed). Fill it in before the demo |

## 1. core_smoke
`python qa/core_smoke.py --site butter-and-bloom --port 8842`: **38/38 PASS** (0 console errors at 4 viewports, no horizontal scroll, same-origin only, 8-tap order path, 3-interaction booking, keyboard, focus trap, axe 0 violations, storage blocked, card data not stored, delivery fee and minimum).

## 2. Conversion path (390x844, touch, DPR 2)
| Path | Result |
|---|---|
| Home → Order (phone bar) → Add croissant → Add cinnamon bun → View order → Checkout → name → phone → Place order | **8 taps**. Bar label "View order (2) · $9.20". Drawer subtotal $9.20 (expected 4.25 + 4.95 = 9.20). Pickup preselected. ASAP "Ready in about 15 minutes (around 10:15 AM)". Confirmation `#8936`, "Today, 10:15 AM (about 15 minutes)". Badge 0 afterwards. Screens 01–06 |
| Same with the real clock (closed) | 8 taps. "Schedule for later" auto-selected, ASAP disabled. Confirmation "Tomorrow, 7:30 AM" |
| Pre-order strip (Tue 10:00) | Seal tap scrolls to #preorder (top 75 px). Add whole fruit tart → checkout defaults to ASAP, so the user must tap "Schedule for later" (+1) and pick from 36 slots (Today 10:30 … Thursday 10:00, including Tomorrow 7:30 onward). Picked "Tomorrow, 8:30 AM" → confirmation "Tomorrow, 8:30 AM". **Truly schedules a pickup for tomorrow.** Screens 07–08. The in-form tip "Pre-ordering for tomorrow? Choose Schedule for later" is clear |
| Pre-order Tue 21:00 / Sat 18:00 | Later auto-selected, first slot Tomorrow 7:30 / Tomorrow 8:30. Works |
| Pre-order Sun 11:00 | No "Tomorrow" slots (Monday closed). Issue 7 |
| Qty / options / remove | +2 on sourdough → $27.00 ($9.00 each). Oat milk on latte → $9.10. Subtotal $50.10 (expected 27 + 9.10 + 14 = 50.10). Remove macarons → $36.10, 2 lines. Screen 09 |
| Delivery + tip + card demo | Fee: $36.10 + 3.50 = $39.60. 10% tip $3.61 → **$43.21** (expected 43.21). Empty submit → 4 errors (street, postcode, name, phone), summary focused. Card demo confirms "Card (demo, no payment taken)". "Pay on delivery" label switches. Screens 10–11 |
| Empty cart | Checkout shows "Your order is empty", form hidden (screen 12). Drawer: "Nothing here yet. Browse the menu" |
| Reload persistence | 3 items → reload → badge 3 |
| Book a table | Book tap scrolls to the form. Empty submit → "Enter your name / Enter your phone", summary focused (screen 14). Date prefilled, times 11:30 AM–3:00 PM on Tue (lead 60 min, last seating 45 min before 16:00). Party 1–6. Valid → "WS-W2JJ4J … 2 guests on Tuesday, November 10 at 11:30 AM" (screen 15). Monday → "No tables on this day" |

Confusing points: on the open-hours path the pre-order needs 2 extra taps (Schedule + time), which is acceptable. The bag line items have no thumbnails, also fine.

## 3. Menu
- All 14 menu photos plus hero, story (2), pre-order cards and reserve image viewed one by one with the Read tool. **Every photo shows the named dish and every alt is truthful.** Butter croissant: 2 croissants on a scalloped plate. Croissant & jam: croissant, jam pot, 2 forks. Cinnamon buns: 5 on a plate. Baker's box: walnut, chocolate-drizzled and sugared pastries. Basket: almond rings, nut swirls, chocolate-striped pastries. Sourdough: round loaf plus sliced loaf on linen. Berry tartlet: cream, strawberries, redcurrants, blackberries, blueberries. Strawberry cakes: 2 on a stone plate, gold fork. Éclairs: 2 on a wooden tray, held. Macarons: green, pink, white, cocoa. Fruit tart: top view, strawberries, melon, pineapple-yellow, kiwi. Muffins: 5 on a rack plus a bowl of blueberries. Cookies & milk: a stack of cookies and milk. Latte: leaf art, brown cup, croissant on a board. Café interior: plants, white chairs (brick and white walls). Counts issue: #3, #4.
- Prices are all numbers (28 items, $3.75–$42.00). Totals verified independently (above).
- Search / filters / jump bar: smoke PASS ("Showing all 28 dishes." / chip "Showing 19 of 28"; empty state and clear; scroll-spy aria-current). The catbar scrolls sideways on phones (intended).
- Crawl: 64 unique links and image URLs (3 pages, every srcset candidate) → **0 broken**. 0 failed requests. 0 `#` placeholder links. Anchors #preorder #story #visit #reserve #map #cat-* exist. Image ratios match width/height attributes (0 mismatches).

## 4. Content rules
- Footer "Sample design by Website Studio. Menu and prices are samples. Photos are stock." on **all 3 pages** (verified by DOM).
- No reviews, ratings, awards, years or customer counts. Slots are marked: `[Guest reviews: client to supply]`, `[Press or awards: client to supply, only if real]`, `[Your story…]`, supplier/mill/roaster, `[neighbourhood]`, `[address] [phone] [email]`, `[map]`, `[cut-off time: client to confirm]`. "Order direct… skip the app fees" is marked `[Wording: client to edit]`. Hours are flagged "(sample hours)" / "Hours (sample)". Gluten-free is shown as "Gluten-free [to confirm]". Phone number is a fictional 555-01xx.
- Failures: issue 2 (unqualified claims), issues 3–4 (counts).
- Credits line: names Cormorant Garamond and Jost (OFL, licence files present in fonts/). Photo credits point to photos/CREDITS.md, which does not exist yet (issue 14, not failed).

## 5. Layout (1440, 1024, 390x844, 360x640, plus 320 for the header)
- Horizontal scroll: none (scrollWidth = clientWidth on all pages and viewports). Elements outside the viewport are only the decorative hero blobs (clipped) and the sideways-scrolling catbar.
- Console and page errors: 0 in all my runs (layout, flows, crawl, keyboard, reduced motion, storage blocked).
- Header controls at 390/360/320 on home, menu, checkout: **no control is cut off** (all right edges within the viewport; tap targets ≥ 44 px). But the checkout Bag icon is squashed (issue 1).
- Viewed: L-index/menu/checkout/drawer at all 4 viewports, plus scroll-series screenshots of home and menu at 390 and 1440. Text over images: none (the hero card sits on a white panel). No overlap or empty boxes. Defects found: issues 1, 6, 10, 11.
- CLS trade-off (`html.js-ready`): throttled phone, js-ready at 2.36 s (home), 2.15 s (menu), 1.56 s (checkout) against FCP 1.52 / 1.33 / 1.34 s. So everything from "Today's favourites" down is invisible for about 0.8 s. On home this is below the fold at 390 and 360, so nobody notices. On menu the list area is blank for about 0.8 s below the search tools. CLS medians are 0 / 0. **Acceptable trade-off.** JS off: content appears at about 3.3 s through the CSS fail-safe (footer hidden at 0.5 s, visible at 3.7 s).

## 6. Performance (390x844 DPR 2, 4x CPU, 1.6 Mbps / 150 ms, cache off, 3 runs)
| Page | First-view bytes | Images | Requests | FCP | LCP (median) | CLS | LCP element |
|---|---|---|---|---|---|---|---|
| Home | **592 KB** (all 3 runs) | 383 KB | 21 | 1.96 s | **2.18 s** (2.14 / 2.18 / 2.36) | **0** (0 / 0 / 0.0115) | hero `croissant-jam-800.webp` (82 KB) |
| Menu | **430 KB** | 234 KB | 14 | 1.50 s | **1.54 s** (1.58 / 1.50; run 2 recorded no LCP entry) | **0** | text (span) |

Within budget (home < 1.5 MB, hero < 200 KB, LCP < 3 s). serve.py sends uncompressed files, so real gzip hosting will be smaller.

## 7. Keyboard, reduced motion, JS off, storage, fonts
- Keyboard (1440): first Tab = skip link. 9 Tabs to the hero Order button; focus ring 3 px solid rgb(39,71,184), visible (`16-keyboard-focus-ring.jpg`). Enter → menu. 20 Tabs to the first Add, 1 more to the second. Count 2. 27 Tabs to the cart opener (long, because it passes all 28 Add buttons and footer; the header Bag is reachable by Shift+Tab sooner). 10 Tabs in the drawer to Checkout. 7 to name. 7 to Place order. Enter → confirmation heading focused (#3784). PASS.
- Reduced motion: ticker, seal spin, hero float and settle all `animation: none`; `getAnimations()` empty; no `[data-reveal]` hidden. Without reduce: bb-settle, bb-spin, bb-float, bb-ticker run. PASS.
- JS disabled: menu shows the noscript "call to order" line. Header, hero and phone bar render at once; the rest appears after the 3 s fail-safe. Open-status text stays "Opening hours". Issue 12.
- Storage blocked (localStorage/sessionStorage throw): add works (badge 2), 0 errors. Going to checkout shows the empty state (documented limit: in-memory per page).
- Fonts: 4 local woff2 (Cormorant Garamond 500 normal + italic, Jost 400 + 500) all HTTP 200, `document.fonts` status loaded, 2 families. No 404.

## Design quality: 7.5 / 10
Strengths: a convincing premium bakery-café look. Warm cream and butter-yellow grounds, dusty-rose maroon accent, sage chips. Elegant Cormorant italics with clean Jost. Arch-masked hero with a rotating "pre-order for tomorrow" seal and a floating add-to-bag card. Rounded pastry grid with consistent, appetising, well-lit photos. Pastel pre-order band. Calm, generous spacing. It reads as "patisserie", not "template".
What a client would criticise: half the menu (breads, savoury, sandwiches, drinks) has no photos, so the lower menu feels unfinished. Lots of yellow placeholder chips in the hero and story (expected for a sample, but noisy). Cramped 1024 header. Blurry story image. Pre-order cards with a half-round photo bulge on a square-cornered card look slightly odd at 1440. Body copy is a little small and grey in places. Maroon is the dominant accent, so "butter yellow" is less present than the concept promised.
Brand distinctness vs cinder-and-salt and mustang-hearth (1440 home screenshots): **clearly a different brand.** Light cream versus their near-black, arch and rounded shapes versus their full-bleed and split dark heroes, and a different type pairing. Shared skeleton cues remain (status pill → eyebrow with `[NEIGHBOURHOOD]` → big serif headline → two CTAs → dish ticker, also in mustang-hearth), but the squint test passes for butter-and-bloom. (Side note for the manager: cinder-and-salt and mustang-hearth look closer to each other, both dark with an orange accent.)
