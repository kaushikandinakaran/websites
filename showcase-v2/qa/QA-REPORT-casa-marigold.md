# QA report: casa-marigold (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05. Headless Chrome only (`channel='chrome'`, `--headless=new`), server `serve.py 8853` (stopped afterwards). No site files modified.
Scripts: `C:\Users\kaush\AppData\Local\Temp\claude\53e3aa7b70d7a652\768b905f-d1cb-4392-b7ce-97c1fa6f393a\scratchpad\qa-casa\` (a_order, b_layout, c_misc, d_perf, e_extra, f_font, g_cls + *_out.json).
Screenshots: `qa/screens-casa-marigold/` (34 jpg).
Fixed clock where stated: Tue 2026-11-10 13:00 (open). Real clock: Thu 2026-11-05 22:50 (closed).

## Verdict: FAIL (fixable in about an hour)

The order path, totals, booking, links, keyboard path, axe and performance pass. It fails on two agreed triggers:
1. **Visible layout defects on phone:** the header Cart icon is squashed (6 px wide at 320 on home and menu, 11 px on checkout at 360, 20 px at 390). The same defect class as butter-and-bloom. Also the taco-night "Added" button runs past its tile and gets clipped at 390, and the 320 phone-bar label overflows its button.
2. **Photo labels not supported by the photo:** "Picadillo quesadillas … spiced minced beef" (alt: "spiced minced meat"). The photo shows a shredded, pulled filling, not mince. "Chicken mole negro": no chicken is visible, only sauce, rice and beans. "Cochinita pibil" and "Chicken salsa verde" name a meat the photo cannot confirm.

## Issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | High (FAIL) | Header Cart icon squashed. The svg is 6 px wide at 320 (home, menu), 11 px on checkout at 360, 20 px on checkout at 390 (should be 22). At 320 it shows as a dot next to the badge | `21-header-320-cart-icon-squashed.jpg`, `L-index-320.jpg`, `L-checkout-360.jpg`; b_out.json `svg` | `.cart-btn svg{flex:0 0 auto;width:22px;height:22px}`. On checkout under ~24em, also drop the "← Menu" text to the arrow only, or hide the brand name at 360 too |
| 2 | High (FAIL) | Picadillo quesadillas: the name, description ("spiced minced beef") and alt ("spiced minced meat") do not match the photo, which shows a shredded/pulled filling with herbs, red pepper and pomegranate seeds on the side | Read of `13-quesadillas-salsa-800.webp` | Name "Quesadillas [filling: to confirm]". Description "Grilled flour tortillas with a spiced filling, salsa roja and crema". Alt "Folded grilled tortillas with a shredded spiced filling and herbs, red salsa and a white dip" |
| 3 | High (FAIL) | "Chicken mole negro": the photo shows mole sauce, crumbled cheese, red rice and black beans. Nothing under the sauce is visible. The alt is truthful; the name and description are not supported | `12-mole-rice-plate-800.webp` | "Mole negro plate [protein: to confirm]": "Dark mole sauce with crumbled cheese, red rice and black beans" |
| 4 | Medium | "Cochinita pibil tacos" (achiote pulled pork) and "Chicken salsa verde tacos" (pulled chicken): the photos show dark pulled meat and pale pulled meat. The kind of meat cannot be seen. Alt 08 says "pulled-pork taco". Same for "Crispy chicken" (01) and "battered fish" (07): fried pieces, species not visible | `08-…`, `09-…`, `01-…`, `07-…` | Keep the dishes but add `[to confirm]`, or use neutral names ("Pulled meat tacos [filling: to confirm]"). Alts: "pulled meat", "fried pieces". Tiles on home use the same names |
| 5 | Medium | Taco-night tile: after a tap, the label becomes "+ Added" and the button grows past the tile edge (+15 px at 390), so it is clipped by `overflow:hidden`. The white "is-added" ring also stays forever, even after the item is removed | `tile-added-390.jpg`, `08-phone-tray-three.jpg`; b_out.json `tiles_added_390` | Give `.tile__add` a fixed `min-width` that fits "Added" (about 6.2rem) or `min-width:0` with flex-shrink on the price. Remove `is-added` after the animation (setTimeout). Show a ✓ instead of "+" while added |
| 6 | Medium | Screen readers hear the CSS characters: accessible names are "+ Add Crispy chicken tacos to order" and, after adding, "✓ Add …" (dish cards and tiles) | c_out.json `ax_names_index`, `ax_names_menu` | `content: "+" / "";` and `content: "\2713" / "";` (alt-text syntax), or put the sign in an `aria-hidden` span |
| 7 | Medium | Home CLS 0.104 on a phone (2 of 3 runs, and 3/3 at DPR 3). Cause: the hero chip's open-status text fills after JS and wraps to 2 lines ("Closed now · opens tomorrow at 11:30 AM (sample hours)"). That pushes the title, lede, CTAs and the infobar down 20.7 px at 2.5–3.5 s. Above the 0.1 "good" limit | g_cls output (layout-shift sources: H1.hero__title, P.hero__lede, DIV.hero__ctas, SECTION.infobar) | Reserve two lines on phones: `.hero__chip{min-height:3.6em}` below 48em, or put "(sample hours)" on its own line from the start |
| 8 | Medium | The display font is a locally installed Rockwell and the body font is Segoe UI (no woff2 shipped). On iPhone/Android/most Macs the headings fall back to Georgia and the slab personality is lost. The brief says "local woff2 with font-display: swap" | e_extra `hero_fonts` = Rockwell Extra Bold (installed system font); `23-phone-home-without-rockwell-simulated.jpg` | Ship an OFL slab as woff2 (e.g. Roboto Slab or Zilla Slab 700/800, about 25–40 KB) like the other sites |
| 9 | Low | JS off: checkout shows a working-looking form with "Place order · $0.00", and home tiles show Add buttons that do nothing. Neither page has a `<noscript>` note (menu has one) | `16-nojs-checkout.jpg`; c_out.json `nojs` | Copy the menu's noscript "call to order" line into home and checkout. On checkout, hide `[data-checkout-root]` in `<noscript><style>` |
| 10 | Low | 320 phone bar: "View order (2) · $24.00" wraps to 3 lines and overflows the 45 px button (label 50 px; text touches the top edge) | `22-mbar-320-overflow.jpg`, `L-index-320.jpg`; e_extra `mbar320` | Shorter label under 22em ("Order · $24.00") or a smaller font |
| 11 | Low | Broken anchor: home "Order sharing plates" links to `menu.html#share`, but the category id is `cat-share`, so it lands at the top of the menu | e_extra `share_el:false`, `scrollY:0` | `href="menu.html#cat-share"` |
| 12 | Low | Hero alt "Hands holding up soft tacos with crispy chicken…": one hand holds two tacos, and the filling is not identifiable. "Elote: Grilled street corn": the corn in the photo shows no grill marks | `02-…`, `11-…` | "A hand holding up two soft tacos with pickled onion and crema over a table of tacos and limes". "Street corn rolled in…" |
| 13 | Low | "What everyone orders" (home h2) suggests popularity data that does not exist | index.html line 86 | "Our favourites" / "Los favoritos" |
| 14 | Low | Hero layout is the same skeleton as butter-and-bloom (copy left; arch-masked photo right with offset frame; status pill; 2 CTAs; wording mark). Colour block and slab type make it a different brand, but the arch is now on 2 sites | `L-index-1440.jpg` vs `qa/screens-butter-and-bloom/L-index-1440x900.jpg` | Optional: square or tilted tile frame, or a full-width colour-block hero with a photo strip, so the arch stays butter-and-bloom's |
| 15 | Info | Lime margarita: "21+ with ID [alcohol licence: to confirm]" on the menu and "21+" on the tile. OK as a sample. Interior photo 04 (llama art, poncho) reads more Andean than Mexican; the alt is truthful | — | Client to confirm licence; consider another interior |

## 1. core_smoke
`qa/core_smoke.py --site casa-marigold --port 8853`: **42/42 PASS** (0 console errors at 4 viewports, no h-scroll, same-origin only, 8-tap order, 3-interaction booking, keyboard, focus trap, axe 0, back-to-top no overlap, live validation, slot time line, storage blocked, card data not stored, delivery fee, empty checkout).

## 2. Conversion path (390x844, touch, DPR 2)
| Path | Result |
|---|---|
| Home → Order (bar) → Add → Add → View order → Checkout → name → phone → Place order | **8 taps**. Bar "View order (2) · $27.00". Drawer subtotal $27.00 (13 + 14 = 27). Pickup preselected, ASAP "Ready in about 20 minutes (around 1:20 PM)". Confirmation #2758, "Today, 1:20 PM". Badge 0 after. Screens 01–06 |
| Taco-night tiles: fish + elote + margarita → tray "View order & check out" → Checkout | Tray: 3 items, $33.00 (15 + 7 + 11). 2 tiles + tray + checkout + name + phone + place = **7 taps** for 2 items. Screens 07–08 |
| Delivery + schedule + 15% tip + card demo | "Arrives in about 40 minutes"; "Pay on delivery" label switches. 60 slots. Picking "Today, 2:30 PM" then "3:30 PM" updates the line each time ("Delivery: Today, 3:30 PM"). Total **$41.45** (33 + 3.50 + 4.95 tip on subtotal = 41.45, computed independently). Empty submit → 4 errors, summary focused. Confirmation "Card (demo, no payment taken)". Screens 09–11 |
| Qty / remove | Mole ×3 = $63.00 ($21 each); subtotal $75.50 (63 + 8 + 4.5). Remove churros → $67.50. Screen 12 |
| Reload persistence | Badge 4 and $67.50 survive reload; checkout shows $67.50 |
| Empty cart | Checkout empty state, form hidden (screen 13). Drawer "Nothing here yet" |
| Real clock (closed) | Status "Closed now · opens tomorrow at 11:30 AM (sample hours)". Checkout auto-selects "Schedule", "Ready for pickup: Tomorrow, 12:00 PM" |
| Book a table | Bar Book scrolls to #reserve (top 72 px after the smooth scroll). Date/time/party prefilled. Empty submit → "Enter your name / Enter your phone", summary focused (screen 14). Valid → WS-6PSR4W "2 guests on Tuesday, November 10 at 2:30 PM" (screen 15). Monday "No tables on this day"; Friday 11:30 AM–10:30 PM |
| Errors | 0 console/page errors on all paths |

## 3. Menu
- All 16 photos viewed with the Read tool. Matching: 03 platter (2 tacos, quesadilla wedges, guacamole, 2 corn cobs, chips, dip: "Two spiced beef tacos" count correct, "beef" not confirmable), 05/06 guacamole hands, 07 three tacos (count correct), 10 molcajete guacamole with chips, 11 elote, 14 ceviche (kumquat, avocado, red onion, pepper strips: true), 15 churros in a paper cone with chocolate, 16 margarita with salted rim and black straw, 04 interior. Doubtful or unsupported: issues 2, 3, 4, 12.
- Prices: 16 items, all numbers ($4.50–$34.00). Tile prices come from SITE.menu (match). Totals verified above.
- Search/filters/jump bar: smoke PASS ("Showing all 16 dishes." / chip "3 of 16", scroll-spy).
- Crawl: 55 unique URLs (3 pages, every srcset candidate, preload set, CSS/JS) → **0 broken**; 0 failed requests. Anchor issue 11. Images have explicit dimensions; 4 items text-only by design (styled cards, not empty frames).

## 4. Content rules
- Footer "Sample design by Website Studio. Menu and prices are samples. Photos are stock, not the restaurant's food." on **all 3 pages**.
- No reviews, ratings, awards, years or counts. Marked slots: `[Guest review 1/2: client to supply]`, `[Press or award: client to supply, only if real]`, `[Your story…]`, `[Kitchen detail…: client to confirm]`, `[Wording: client to confirm]` on "skip the app fees", `[address] [phone] [email] [map]`, delivery apps plain text. Gluten-free tagged "[to confirm]". Phone 555-0142 fictional.
- Footer hours (generated from SITE.hours) = Mon Closed, Tue–Thu 11:30 AM–10:00 PM, Fri 11:30 AM–11:30 PM, Sat 11:00 AM–11:30 PM, Sun 11:00 AM–9:00 PM. **Matches site.js** and the hours table; marked "(sample)".
- Credits: 13 photographers in the footer = the 13 distinct names in photos/CREDITS.md rows 140–155 (16 photos).
- Claims: issues 2–4, 12, 13. No "fresh", "homemade", "authentic" or "since" claims found.

## 5. Layout (1440, 1024, 768, 390x844, 360x640, 320x640)
- Horizontal scroll: none on any page or viewport (also with the drawer open). Console errors: 0.
- Header: one line at 1440 and 1024 (nav links 44 px tall, single line; "Cart" text hidden at 1024). At 768 the hamburger menu. No control cut off at 390/360/320 (all right edges ≤ viewport). At 320 on checkout the brand name is visually hidden; the link keeps the name "Casa Marigold, home" and axe `link-name` passes (axe 0 violations at 320/360/390 on all 3 pages). Defect: issue 1.
- Phone hero shows food (tacos fill the arch, 253 px tall at 390): `01-phone-home-landing.jpg`.
- Arch with offset teal frame and the scalloped edges (hero bottom, taco-night top, menu band) render cleanly at every width; the 1024 arch frame comes within 4 px of the right edge (tight but not cut).
- Taco tray on desktop: tray 330 px tall beside 589 px of tiles (1440), sticky, so the gap under it disappears while scrolling. At 1024: 776 vs 330. Not a defect. At 768 and below the tray sits under the tiles, full width.
- Back-to-top: smoke check PASS (no overlap at 4 widths). The skip link stays off-screen while scrolled (top −91 px); it only appears in stitched full-page captures.
- Tile grid: "Rice & beans" sits alone on a row at 390 (cosmetic).

## 6. Performance (390x844, 4x CPU, 1.6 Mbps / 150 ms, cache off, 3 runs)
| Page | First-view bytes | Images | Req | FCP | LCP median (runs) | CLS (runs) | LCP element |
|---|---|---|---|---|---|---|---|
| Home (DPR 2) | **360 KB** | 214 KB | 11 | 2.08 s | **2.20 s** (2.15 / 2.59 / 2.20) | 0 / **0.104 / 0.104** | hero `02-…-800.webp` (54 KB) |
| Home (DPR 3) | — | — | — | — | 2.16 s (2.72 / 2.16 / 2.12) | 0.104 ×3 | hero `02-…-1600.webp` |
| Menu | 455 KB | 322 KB | 12 | 1.88 s | **1.88 s** (1.88 / 2.00 / 1.87) | 0 | h1 "El menú" |
| Checkout (2 items) | 136 KB | 0 | 6 | 1.09 s | **1.09 s** (1.17 / 1.01 / 1.09) | 0 | demo note |

- All within budget (home < 1.5 MB, hero < 200 KB, LCP < 3 s).
- I could **not reproduce** the builder's checkout LCP of 4.7 s or home 3.26 s. Checkout LCP equals FCP (1.0–1.2 s). Hiding until `js-ready` does not delay it: the LCP element (demo note) sits above the first JS-filled hook, so it paints at once. The local Rockwell lookup is installed on this machine, and `local()` misses resolve instantly. The builder's numbers were probably taken during another agent's server load or with a cold disk. Real risk is CLS (issue 7), not LCP.

## 7. Keyboard, reduced motion, JS off, storage
- Keyboard (1440, home): skip link first, then brand, nav. 19 Tabs to the first taco tile; Enter adds; Tab+Enter adds a second (tray 2). 9 Tabs to "View order & check out" (focus ring 3 px white outline + black halo on terracotta, visible). Enter opens the drawer; 12 Tabs to Checkout. 6 Tabs to Name, fill, Place order → confirmation #7975, heading focused. PASS.
- Reduced motion: no `cm-motion` class, 0 running animations, `.reveal` transform none, scroll-behavior auto. With motion: reveal translateY(26px) then in. PASS.
- JS disabled: footer hidden at 0.5 s and visible at 4 s (CSS fail-safe). Tile prices show static fallbacks. Issue 9.
- Storage blocked: tiles add (count 2, tray $11.50 = 7 + 4.50), 0 errors.

## Design: 7.5 / 10
Strengths: a loud, confident, colour-blocked brand. Marigold hero, teal infobar with a scalloped edge, terracotta taco-night band with big colour tiles, marigold/teal/terracotta favourite cards, ink footer with a tri-colour rule. Heavy slab headlines give it a poster/cantina feel. Photos are appetising and consistent. The taco-night builder is a clear, fun conversion device with a live tray.
What a client would criticise: on most phones the slab face is lost (issue 8), so it looks far plainer than in our demo. The tile "Added" glitch and the dot-sized cart icon on small phones. Several dish names the photos cannot back up. Many yellow placeholder chips. The hero arch echoes butter-and-bloom. The interior photo looks Andean. The 4 text-only cards and the sea of colour blocks get busy lower down.
Brand distinctness: compared with butter-and-bloom, fornace-pizza and others at 1440, it **is** a distinct brand by colour, type and section rhythm (squint test passes). The shared parts are the arch hero (butter-and-bloom) and the "3-step builder" band (fornace has the same "three taps" idea, but styled differently).
