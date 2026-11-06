# QA report: le-petit-marais (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05. Headless Chrome only (`channel='chrome'`, `--headless=new`). Server `serve.py 8851`, stopped afterwards. No site files changed.
Scripts: `C:\Users\kaush\AppData\Local\Temp\claude\53e3aa7b70d7a652\768b905f-d1cb-4392-b7ce-97c1fa6f393a\scratchpad\qa-marais\` (a_flows, b_layout, c_perf, d_misc, plus *_out.json and shots/).
Screenshots: `qa/screens-le-petit-marais/` (37 jpg).
Clock: a fixed clock (`page.clock`) of Tue 2026-11-10 13:00 (open) where stated. The real clock was Thu 2026-11-05 22:47 (closed).

## Verdict: PASS (with medium fixes recommended)

None of the FAIL triggers is hit. The order path works (8 taps). Every total is correct, checked by hand. No photo contradicts its label. No invented facts. 0 console errors and 0 page errors in every run. No phone layout defect: the header controls are inside the viewport at 390, 360 and 320, and the icons are not squashed. The mandatory footer line is on all 3 pages.
The main weak points are a hero that is too close to butter-and-bloom, a doubtful Daube photo and alt text, and 3 cards with a "[photo to come]" placeholder (one sits alone on its own row).

## Issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | Medium (brand) | The home hero uses the butter-and-bloom skeleton and palette. Both have a cream background, a left serif headline whose 2nd and 3rd lines are italic maroon, a filled maroon "Order online + italic sub-label" button next to an outlined "Book a table" button, an open-status pill, the "Order direct… [Wording]" line, and a framed photo on the right with a dish/price/Add card overlapping its lower-left corner. The squint test is borderline (square brass frame and burgundy block versus a pink arch). The hero dish is a steak, the same food as the cinder-and-salt hero (that site looks dark, so this matters less) | `L-index-1440x900.jpg` vs `qa/screens-butter-and-bloom/L-index-1440x900.jpg` | Give the bistro its own hero: for example a full-width ink/burgundy band with a centred engraved "carte" headline, or the prix-fixe card as the hero object. Drop the overlapping ticket card or move it under the photo. Consider a non-steak hero dish (onion soup, moules or escargots) |
| 2 | Medium (photo truth) | Daube de bœuf (photo 12): the meat cannot be identified and there is no visible sign of red wine. The photo-library INDEX describes "mushrooms and small onions", but the menu description says "olives, tomato and new potatoes" and the alt says "olives, tomatoes and small potatoes". The pale balls could be potatoes or pearl onions, and the dark round pieces could be olives, mushrooms or aubergine. Not a clear mislabel, but the specific ingredients claimed for the photo are guesses | `images/daube-800.webp`, `m1440-cat-plats.jpg` | Alt: "A dark meat braise with tomato and small round vegetables on a metal plate, a cocktail glass and a fork beside it". Keep the dish description as the product spec, but drop the photo-specific "olives", or add "Photo is illustrative". Better: use a photo where beef in a red-wine sauce is recognisable |
| 3 | Medium (looks unfinished) | 3 of 14 dishes have no photo: Salade de chèvre chaud, Ratatouille and Mousse au chocolat. They show a beige "[PHOTO TO COME]" ring card. At 1440 the Ratatouille placeholder is the lone 5th card on its own row of the Plats grid. At 1024, Entrées and Desserts each end with a lone placeholder card | `F-menu-1440.jpg`, `m1440-cat-plats.jpg`; grid1440/grid1024 in d_misc_out.json | Add truthful stock photos (goat's cheese salad, ratatouille and chocolate mousse are easy to find), or make text-only cards compact list rows. For the lone card, use `grid-template-columns: repeat(auto-fit, minmax(16rem,1fr))` or centre the last row |
| 4 | Low (a11y, shared core) | The order-summary toggle adds "+"/"−" through CSS `::after` (base.css 259–260), and screen readers read it as part of the summary name. Same defect class as jasmine-lane's 茶 | d_misc_out.json `pseudo.checkout.html` | Core builder: draw it with a background SVG or a border, or add `speak: never` alt text (`content: "+" / ""`) |
| 5 | Low | JS off: checkout shows a working-looking form with "Place order · $0.00" and has no `<noscript>`. Home has no noscript either (menu has one) | `21-nojs-checkout.jpg`; `nojs_checkout.html.noscript = 0` | Copy the menu's noscript line ("Ordering needs JavaScript. Please call [phone]") into checkout.html above the form, and into index.html near Signature dishes |
| 6 | Low (typography) | Corbel's default old-style figures make prices in UPPERCASE letter-spaced labels read as letters: "CHECKOUT · $36.oo", "VIEW ORDER (2) · $36.oo", "PLACE ORDER · $0.oo" | `03-phone-cart-drawer.jpg`, `02-phone-menu-two-added.jpg` | `.btn, .mbar, .totals, .cart-line__price { font-variant-numeric: lining-nums tabular-nums; }` |
| 7 | Low | The 320 px phone bar label "VIEW ORDER (3) · $81.00" wraps to 3 lines inside a 121 px button | `20-menu-320-mbar-3items.jpg` | Shorter label under about 22em (e.g. "Order · $81.00"), or hide "View" |
| 8 | Low | The hours table at 390 breaks the ranges in the middle: "6:00 PM – / 10:00 PM", and on the highlighted Tuesday "6:00 PM / – 10:00 PM" starts a line with a dash | `17-phone-hours.jpg` | Put each range on its own line (`white-space: nowrap` per range, or a line break between ranges) |
| 9 | Low (copy) | Hero lede: "book a table **for this evening**". That is not true on Sunday (closes 16:00), Monday (closed) or after 21:00 | index.html line 66 | "book a table for lunch or dinner" |
| 10 | Low (copy/photo) | Tarte aux prunes alt says "almonds"; one of the two bowls looks like peanuts. Escargots alt says "basket" where the bread is on a wooden tray. Poulet à l'orange: the Pexels title says chicken, but the leg looks like confit duck (the INDEX itself says "duck leg"). The name is acceptable, but a chef client may notice | images tarte-prunes, escargots, poulet-orange | Alts: "…with fresh plums, apples, nuts and dried apricots…"; "…beside a wooden tray of sliced baguette…". Optional: "Glazed poultry leg" in the alt |
| 11 | Low (placeholders) | 22 bracketed notes on home, including two "[Wording: client to confirm]" lead-ins in the italic story lede, the hero "[Short promise…]", reviews/press slots and a large monospace "[map]" box. Acceptable for a sample, but the story section reads as unfinished | `16-phone-story.jpg`, `F-index-1440.jpg` | Write one neutral sample sentence for the story and keep a single "[Story: client to supply]" tag |
| 12 | Info | Menu "View order · $0.00" CTA is shown with an empty cart. The Menu du jour product card uses the kitchen-saucing photo (truthful alt, but no dish shown) | `F-menu-1440.jpg` | Hide the CTA when the cart is empty (core `[data-empty]`). Optional: a photo of a set course |
| 13 | Info | Fonts are system stacks (Bell MT / Corbel are Windows fonts). On macOS, iOS and Android the look changes. Bell MT also renders a visibly wide gap after "of" ("The story of  the house", "glass of  dry white") | style.css lines 23–24 | Bundle one OFL serif (Libre Baskerville) and one sans as local woff2 |

## 1. core_smoke
`python qa/core_smoke.py --site le-petit-marais --port 8851`: **42/42 PASS**. Covered: 0 errors at 4 viewports, no horizontal scroll, same-origin only, 8-tap order path, 3-interaction booking, keyboard, focus trap, live validation, back-to-top 0 overlaps, slot time line, axe 0 violations, storage blocked, card data not stored, delivery fee, reduced motion, empty checkout.

## 2. Conversion path (390x844, touch, DPR 2)
| Path | Result |
|---|---|
| Home → Order (phone bar) → Add Soupe à l'oignon → Add Poulet à l'orange → View order → Checkout → name → phone → Place order | **8 taps**. Bar "VIEW ORDER (2) · $36.00". Drawer subtotal $36.00 (12 + 24). Pickup preselected, ASAP "Ready in about 25 minutes (around 1:25 PM)". Confirmation **#5490**, "Today, 1:25 PM (about 25 minutes)", Pickup at [address], Pay at pickup, total $36.00. Badge 0 afterwards. Screens 01–05 |
| Real clock (closed) | "Schedule for later" auto-selected, line "Ready for pickup: Tomorrow, 12:30 PM" |
| Menu du jour | One cart line with 3 labelled selects. Entrée: Soupe à l'oignon / Velouté du jour / Escargots (+$4.00). Plat: Poulet à l'orange / Daube de bœuf / Moules. Dessert: Crème brûlée / Tarte aux prunes / Tarte amandine. Default $42.00. Escargots → **$46.00**. Qty 2 → **$92.00 ($46.00 each)**. A second Menu du jour with default choices makes a separate line ($42.00). Adding steak frites gives $163.00 (92+42+29 ✓). Remove steak → $134.00 ✓. Qty 2→1 → $88.00 ✓. Screen 06 |
| Reload | badge 2 after reload; checkout summary $88.00 |
| Delivery + tip + schedule | Delivery: $92.00 (88 + 4 fee ✓), "Arrives in about 45 minutes". Tip 15% = $13.20 → **$105.20** ✓. Schedule for later: 42 slots; picked "Today, 7:00 PM" → line "Delivery: Today, 7:00 PM". Empty submit → 4 errors (street, postcode, name, phone). Confirmation #8616 shows each course choice per line, fee, tip and total $105.20 (screens 07–08) |
| Delivery minimum | Velouté only ($11): "Delivery needs a subtotal of at least $25.00 (sample rule). Add more or choose pickup." |
| Empty cart | Checkout shows "Your order is empty", form hidden (screen 09) |
| Book a table | Phone-bar Book → after the scroll the h2 is at 163 px and the Name field at 645 px, inside the viewport (screen 13; screen 10 was taken mid-scroll). Empty submit → "Enter your name / Enter your phone", summary focused (11). Defaults Tue: 6:00–9:00 PM, 2 guests. Valid → "WS-AUE4VV … 2 guests on Tuesday, November 10 at 6:00 PM" (12). Monday → "No tables on this day". Sunday 12:00–3:00 PM |

## 3. Menu and photos (all 16 images opened with Read)
| Dish / use | What the photo shows | Name/description/alt |
|---|---|---|
| Soupe à l'oignon (08) | Browned, bubbled cheese crust in a white crock, spoon lifting it | True |
| Escargots (09) | 7 snails in a white escargot dish with green butter, sliced baguette on a wooden tray, glass of white wine, pepper mills | True ("basket" is a tray; minor) |
| Velouté du jour (13) | Smooth beige soup, crisp fried topping (mushroom/shallot-like), green oil drops, croutons in a small bowl | True and neutral; "[Soup and topping: client to confirm]" is right |
| Steak frites (07) | Sliced medium-rare steak on yellow béarnaise, heap of fries, plate held out | True |
| Poulet à l'orange (10) | Glazed poultry leg on mash, orange sauce with zest, green herb oil, speckled bowl | Acceptable (credit page: chicken; may be duck) |
| Moules (11) | Bowl of open mussels with parsley, fries at the edge | True |
| Daube de bœuf (12) | Dark braise with unidentifiable meat, tomato, small pale potato/onion-like balls, dark round pieces, coupe glass, water glass, fork | Doubtful: issue 2 |
| Crème brûlée (14) | Torch caramelising the sugar crust in a speckled dish | True |
| Tarte aux prunes (15) | Tart of sliced dark plums in a tin; whole plums, apples, nuts and dried apricots around it | Name true (plums, not tatin). Alt minor: issue 10 |
| Tarte amandine (16) | Small tart with fanned pear/apple slices and flaked almonds on a white plate | True; "[Fruit: client to confirm]" is right |
| Menu du jour card / prix-fixe (06) | Cook spooning sauce from a bowl over plated dishes, dark | Alt true (no specific dish shown) |
| Wine (01), candles (03), terrace (04) | Rim-lit red wine on black; candle-lit table, two hands; B&W wicker bistro chairs outside a café window | True; terrace captioned "Stock photograph" |

- Prices are numbers: 14 items, $9–$42. File sizes match the declared width/height for every image, and the hero preload `1334w` equals the real 1334 px width.
- Search, filters and jump bar: smoke PASS ("Showing all 14 dishes." / Vegetarian "Showing 5 of 14"). Scroll-spy works, and the catbar scrolls sideways on phones.
- Crawl: 50 unique URLs (links, every srcset candidate, CSS and JS) on 3 pages → **0 broken**. The `#cat-*` anchors are created by JS (they exist at run time). 0 failed requests.

## 4. Content rules
- Footer "Sample design by Website Studio. Menu and prices are samples. Photos are stock." plus the photo credits line on **all 3 pages**.
- Credits: 13 names, which match exactly the 13 library photos used (01, 03, 04, 06–16) in photos/CREDITS.md. 02 and 05 are not used and not credited (correct).
- Hours table = SITE.hours: Mon Closed; Tue–Thu 12:00–2:30 PM, 6:00–10:00 PM; Fri until 11:00 PM; Sat 12:00–11:00 PM; Sun 12:00–4:00 PM. Labelled "(sample hours, to confirm)".
- No reviews, ratings, stars, awards, years, counts, appellations or sourcing claims. The keyword scan found only "crackling, torched sugar crust" (descriptive). The wine section has no bottles, vintages, regions or prices: style suggestions only ("a structured, peppery red"), plus "[Wine list and prices: client to supply]". "wine is poured at the table [to confirm]" is marked. Phone 555-01xx is fictional. Dietary tags: vegetarian/vegan only, and they fit the dishes.
- Placeholders are marked; there are a lot of them on home (issue 11).

## 5. Layout (1440, 1024, 768, 390x844, 360x640, 320)
- Horizontal scroll: none (scrollWidth = clientWidth everywhere). Console and page errors: 0 across all runs.
- Header: on one line at 1440 and 1024 (4 nav links + Order online + bag, 72 px). 768 uses the hamburger with Order online (one line). Checkout header box at 390: back link 246–290, bag 298–373; at 360: 222–266 / 274–343; at 320: 188–232 / 240–310. All within the viewport, and the bag svg stays 22 px. Brand word hidden mark below 24em.
- Accessible names: the brand link is "LE PETIT MARAIS". The arrow-only back link at 320/360/390 is "Menu (back to the carte)". Bag "Your order 3 items". axe at 390/360/320 on home, menu and checkout: **0 violations**.
- Phone hero shows the steak and fries in the top 40% at 390 and 360 (`01`, `L-index-360x640`). Brass double-line frames are consistent. The arched wine photo crops well (glass centred, black fills the arch, `15`). Back-to-top never covers content (smoke) and floats in the gutter at 1440.
- Drawer: 416 px panel on desktop, full width on phones.

## 6. Performance (390x844 DPR 2, 4x CPU, 1.6 Mbps / 150 ms, cache off, 3 runs, uncompressed server)
| Page | First-view bytes | Images | Requests | FCP | LCP median (runs) | CLS | LCP element |
|---|---|---|---|---|---|---|---|
| Home | **350 KB** | 205 KB | 12 | 1.50 s | **1.86 s** (1.70 / 2.43 / 1.86) | **0** (0/0/0) | hero steak-frites-800.webp (47 KB) |
| Menu | **375 KB** | 242 KB | 10 | 1.24 s | **1.24 s** (1.24 / 1.19 / 1.24) | **0** | text (menu lede) |
| Checkout (2 items) | **136 KB** | 0 | 5 | 1.08 s | **1.08 s** | **0** | demo note text |
Well within budget (home < 1.5 MB, hero < 200 KB, LCP < 3 s).

## 7. Keyboard, motion, JS off, storage
- Keyboard (1440): first Tab is the skip link. 10 Tabs to the hero Order button; focus ring 3 px solid rgb(24,73,198), offset 3 px (`19`). Enter → menu. 15 Tabs to Menu du jour Add, 1 to Soupe Add (count 2). 13 Tabs to the cart opener; focus lands in the drawer. 5 Tabs to the Entrée select, End → Escargots, subtotal $58.00 ✓. 8 Tabs to Checkout. 6 to Name, then type name and phone. 7 to Place order ($58.00). Enter → confirmation heading focused (#4956). PASS.
- Reduced motion: 0 animations, no `.motion` class, no hidden reveal photos, scroll-behavior auto. Without reduce, the reveals start only below the fold and never hide text.
- JS off: menu has a noscript call line. Content appears through the 3 s fail-safe. Checkout shows a dead $0.00 form (issue 5).
- Storage blocked: Add works in memory (badge 2), 0 errors.

## Design quality: 7.5 / 10
Strengths: a convincing classic bistro. Cream paper, burgundy and brass double-rule frames, letter-spaced small caps, and engraved ornament rules under each heading. The prix-fixe "carte" card with brass glass icons and pairing lines is the best section and feels like a real menu card. The arched wine photo is good, as is the black-and-white terrace, and the photography is moody and appetising and fits together. The checkout is calm and very clear.
What a client would criticise: the hero looks like the bakery site's (issue 1). Three "[photo to come]" cards, one sitting alone. Prices read as "$36.oo" in buttons. The story section is mostly placeholders. Windows-only fonts. The Menu du jour product card shows a cook, not food.
Brand distinctness: clearly different from cinder-and-salt (dark, ember orange, full-bleed) and from the dark mustang-hearth. **Too close to butter-and-bloom** in the hero layout and the cream + maroon palette. Below the hero (prix-fixe band, brass frames, wine arch, ink reservation band) it is distinct.
