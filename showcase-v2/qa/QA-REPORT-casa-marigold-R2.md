# QA report round 2: casa-marigold (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-06. Headless Chrome only (`channel='chrome'`, `--headless=new`), server `serve.py 8859` (stopped afterwards). No site files modified.
Scripts and raw output: `C:\Users\kaush\AppData\Local\Temp\claude\53e3aa7b70d7a652\768b905f-d1cb-4392-b7ce-97c1fa6f393a\scratchpad\qa-casa2\` (a_order, b_layout, c_misc, d_perf, g_cls, h_r2, i_mbar_sweep + *_out.json / *_log.txt).
Screenshots: `qa/screens-casa-marigold-r2/` (24 jpg). Fixed clock where stated: Tue 2026-11-10 13:00 (open).

## Verdict: FAIL (one new visible defect; about 10 minutes to fix)

All 15 round-1 issues are fixed and verified. But the 320 phone-bar fix brought in a new defect: **the sticky phone bar's "Call" button is cut off at the right edge on 353–399 px phones once the cart has anything in it**, for example 360 px (common Android) and 375 px (iPhone SE/mini). This is a visible layout defect on a primary action, so it is a FAIL trigger, the same class as round-1 issue 1.

## New issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| N1 | **High (FAIL)** | Phone bar overflows when the cart has items. `.mbar__btn--primary{white-space:nowrap}` (style.css line 384) applies at every width, but Book and Call only go icon-only below 22em (352 px). From 353 px up, "View order (1) · $13.00" cannot shrink, so Call runs past the viewport and is clipped (no page scroll, because the bar is fixed). Right edge of Call minus viewport, 1 item: 353 → +26 px, **360 → +19 px**, 375 → +4 px, 384 → −5 (fits). 10 items ("View order (10) · $249.00"): 360 +38, 375 +23, 390 +8, 393 +5, 400 −2. Empty cart ("Order") fits at every width. 320–352 fits. | `L-index-360.jpg` (only "Ca" of Call visible), `mbar-360-1item.jpg`, `mbar-375-1item.jpg`, `tile-added-390.jpg` (11 items at 390, Call border cut); i_out.json, h_out.json `mbar` | Raise the icon-only breakpoint to about 25em (400 px), or drop `nowrap` above 22em and let the label shrink (`min-width:0` on the primary button, a shorter label such as "Order (1) · $13.00"). Re-measure 353–430 with 1 and 10+ items |
| N2 | Low | Mole description: "…red rice and black beans [protein: to confirm]". The tag comes after "beans", so it reads as if the beans are the doubtful protein | site.js line 87 | "Dark mole sauce [protein: to confirm] with sesame and crumbled cheese, red rice and black beans" |
| N3 | Info | Menu Add button after adding shows "✓ Added", but its accessible name stays "Add Crispy tacos to order" (visible word "Added" is not in the name, WCAG 2.5.3). This is core.js behaviour shared by all sites, not this site's change | h_out.json `add_pseudo`, `ax_menu_after` | Manager: core could set `aria-pressed` or update the hidden name to "Added …" for 1.4 s |
| N4 | Info | At 320–360 the hero's teal block and terracotta circle are cut by the viewport edge. Intended bleed, and it looks fine | `L-index-320.jpg` | none |

## Round-1 issues: re-test

| R1 # | Result | Evidence |
|---|---|---|
| 1 Header cart icon squashed | **FIXED.** I measured home, menu and checkout at 1440, 1200, 1024, 900, 768, 390, 360 and 320 with 1 item in the cart. Every header svg (cart, hamburger) is **22×22**. The brand mark is 34 (desktop) or 28 (phone). No control is past the viewport. All header children share one top (one line). Header height is 72, or 60 below 48em. Cart accessible name is **"Cart, 1 item"** on all 24 combinations ("Cart, 2 items" with 2). At 320 on checkout the brand text is visually hidden, and the link keeps the name "Casa Marigold, home" | b_out.json; `L-index-320.jpg`, `L-checkout-320.jpg`, `L-checkout-360.jpg`, `L-index-900.jpg` |
| 2–4, 12 Dish names vs photos | **FIXED.** I looked again at all 15 photos with the Read tool. Crispy tacos (01: fried pieces, pink onion, crema, greens, yellow sauce; "[chicken: to confirm]"). Red pulled-meat tacos (08: dark pulled meat, pink onion, dipped in white crema). Salsa verde tacos (09: one corn taco, pale pulled meat, radish, red onion, cilantro, lime, green-brown salsa; "a corn tortilla taco" is correct). Battered tacos with slaw (07: **three** tacos, golden pieces, slaw, herb leaf, green sauce; count correct; "[fish or shrimp: to confirm]"). Quesadillas (13: shredded spiced filling, herbs, salsa roja, white dip). Mole negro plate (12: sauce, crumbled cheese, a sesame-like crumb, red rice, black beans). Fiesta platter (03: 2 tacos, quesadilla wedges with guacamole, 2 cobs, chips, dip; "Two tacos" correct). Guacamole (10), elote (11, no "grilled" now), ceviche (14), churros (15), margarita (16), hands 05/06: alts match. Hero alt "A hand holding up two soft tacos with pickled onion and crema over a wooden table of tacos and limes" matches 02. No counts that the photos do not show. `[to confirm]` is used only for unverifiable fillings, seafood type, gluten-free and the alcohol licence | photos; site.js |
| 5 Tile "Added" overflow / stuck | **FIXED.** At 390, 360, 1024 and 1440 the Add button is 17 px inside the tile right edge in both states ("✓ Added" is 98 px wide). The label is back to "Add" and `is-added` is removed by 1.25 s (timer 1.4 s). It also resets at once on a drawer "−" and on "Remove". 0 errors | h_out.json `tile_*`; `tile-added-elote-390.jpg`, `tile-added-390.jpg` |
| 6 CSS symbols in names | **FIXED.** AX tree: tiles "Add Battered tacos with slaw to order", dish cards "Add Crispy tacos to order" before and after adding. No "+" or "✓" in any name. The ✓ uses `content:"✓" / ""`. Smoke check for symbols PASS | h_out.json `ax_*` |
| 7 Home CLS | **FIXED.** Throttled phone (4x CPU, 1.6 Mbps/150 ms, cache off), observed 8 s, 3 runs each. 390@DPR2: 0 / 0 / 0. 390@DPR3: 0 / 0.022 / 0. 360@DPR3: 0 ×3. 320@DPR2: 0 ×3. The worst single shift is 0.022 (open-status fill at about 2.6 s). Far below 0.1. d_perf home CLS 0 ×3 | g_log.txt, d_log.txt |
| 8 Font | **FIXED.** `fonts/zilla-slab-latin-700-normal.woff2` (26 KB) loads on all 3 pages (preloaded, no 404, 0 failed requests). `@font-face` uses `font-display: swap`. `document.fonts` shows "Zilla Slab 700 loaded". The platform font for h1, tile prices, h2 and tray number is **ZillaSlab-Bold (custom)**, not Rockwell. Only weight 700 is used (49 text nodes, no synthetic bold). `fonts/OFL-Zilla-Slab.txt` is present (SIL OFL 1.1, Mozilla 2017). Headings look right at every width | h_out.json `font_*`, `platform_*` |
| 9 JS off | **FIXED.** Home, menu and checkout each have a `<noscript>` "call [phone] to order" note. On checkout the form is hidden (visibility hidden, height 0), so there is no dead "Place order · $0.00". The footer shows after the 3 s fail-safe | c_out.json `nojs`; `16-nojs-checkout.jpg` |
| 10 320 phone bar | **FIXED at 320–352** (one line, all buttons inside, even "View order (11) · $102.00"). **Regressed at 353–399**: see N1 | `mbar-320-11x108.50.jpg` |
| 11 #share anchor | **FIXED.** The link is `menu.html#cat-share`. It lands with "To share" 119 px from the top (under the sticky header and category bar) | `catshare-390.jpg` |
| 13 "What everyone orders" | **FIXED.** Now "Our favourites" / "Los favoritos" | index.html line 88 |
| 14 Arch hero | **FIXED.** New hero: tilted cream-framed photo card, teal offset block, terracotta sun circle, faint concentric rings, on a marigold block. No arch. Next to the other 8 heroes (olio-terrace R2 comparison sheet, green-table) it is distinct. Olio and butter-and-bloom use arches. Mustang-hearth is the nearest in colour (saffron block), but it has a full-height photo column, while casa has a tilted card and slab type | `L-index-1440.jpg`; `qa/screens-olio-terrace-r2/cmp-home-1440-8-sites.jpg` |
| 15 Margarita / interior | **OK.** Menu: "21+ with ID [alcohol licence: to confirm]". Tile: "Margarita 21+". The interior photo (04) was removed from the site, the images folder and the credits |

## Content rules
- Footer line "Sample design by Website Studio. Menu, prices and wording are samples. Photos are stock." is on **all 3 pages** (checked in the rendered footers).
- Credits: 12 names in the footer = the photographers of the 15 photos used (CREDITS.md rows 140–142 and 144–155). Ricky Esquivel (04, removed) is correctly left out. "Kaboompics" is shown for the kaboompics.com row.
- Brackets only for missing facts: [address] [phone] [email] [map], delivery apps, review/press slots, fillings, seafood type, gluten-free, licence. Wording such as "skip the app fees" is no longer bracketed and is covered by "wording are samples". No reviews, ratings, awards, years, counts, "authentic/fresh/homemade/since". "Favourite" badges are the client's own picks, not popularity data. Tags: vegan/vegetarian only on obviously meat-free items. Gluten-free is tagged "[to confirm]".
- Hours: footer (from SITE.hours) = hours table = site.js, marked "(sample)".

## Regression
- `qa/core_smoke.py --site casa-marigold --port 8859`: **45/45 PASS**.
- **Order path at 390x844** (touch, DPR 2, open clock): Order (bar) → Add → Add → View order → Checkout → name → phone → Place order = **8 taps**. Bar "View order (2) · $27.00". Drawer $27.00 (13 + 14). Pickup and ASAP preselected, "Ready in about 20 minutes (around 1:20 PM)". Confirmation #9921 "Today, 1:20 PM". Badge 0 after (`06-phone-confirmation.jpg`).
- **Taco night:** 3 tiles + tray "View order & check out" + Checkout. Tray shows 3 items, $33.00 (15 + 7 + 11). Delivery + schedule + 15% tip + card: "Arrives in about 40 minutes". Slots update the line ("Delivery: Today, 2:30 PM" → "3:30 PM"). Empty submit lists 4 errors. Total **$41.45** (33 + 3.50 + 4.95 = 41.45, computed independently). Confirmation "Card (demo, no payment taken)" (`08`, `11`).
- **Quantity/remove:** Mole ×3 = $63 (21 each), subtotal $75.50 (63 + 8 + 4.5). Remove churros → $67.50. Persists over reload (badge 4). Checkout "Place order · $67.50". Empty cart shows the empty state with the form hidden.
- **Booking:** Bar Book → #reserve at 72 px. Date, time and party are prefilled. Empty submit → 2 errors, summary focused. Valid → WS-2T2M8P "2 guests on Tuesday, November 10 at 2:30 PM" (`15`). Monday "No tables on this day". Friday 11:30 AM–10:30 PM.
- **Real clock (Fri 00:07):** "Closed now · opens today at 11:30 AM (sample hours)". Checkout auto-selects Schedule, "Ready for pickup: Today, 12:00 PM". Correct.
- **Console/page errors:** 0 on every path. No horizontal scroll at the 8 widths (also with the drawer open).
- **Crawl:** 53 URLs (3 pages, every srcset candidate, preload, CSS, JS, font). 0 broken. All anchors resolve. Same-origin only.
- **axe:** 0 violations at 320, 360 and 390 on all 3 pages.
- **Keyboard (1440):** skip link first; 19 Tabs to the first tile; Enter adds; 2 in the tray; 9 Tabs to "View order & check out" (3 px white outline + dark halo, visible); 12 Tabs in the drawer to Checkout; 6 to Name; confirmation #4086 focused. PASS.
- **Reduced motion:** no `cm-motion`, 0 animations, scroll-behavior auto, reveal transform none. With motion: translateY(26px) then in. PASS.
- **Storage blocked:** tiles add (2 items, $11.50), 0 errors.

## Performance (390x844, DPR 2, 4x CPU, 1.6 Mbps / 150 ms, cache off, median of 3)
| Page | First-view bytes | Images | Req | FCP | LCP median (runs) | CLS | LCP element |
|---|---|---|---|---|---|---|---|
| Home | **388 KB** | 214 KB | 12 | 2.14 s | **2.42 s** (2.41 / 2.42 / 2.42) | 0 / 0 / 0 | hero `02-…-800.webp` (54 KB) |
| Menu | 484 KB | 322 KB | 13 | 1.70 s | **1.79 s** (1.79 / 1.70 / 1.82) | 0 ×3 | menu-band note |
| Checkout (2 items) | 165 KB | 0 | 7 | 1.25 s | **1.25 s** (1.16 / 1.26 / 1.25) | 0 ×3 | demo note |

All within budget (home < 1.5 MB, hero < 200 KB, LCP < 3 s). The woff2 adds about 26 KB and about 0.2 s to home LCP compared with round 1 (2.20 s), which is acceptable.

## Design: 8 / 10 (up from 7.5)
Better than round 1. The bundled Zilla Slab now gives every phone the poster/cantina type. The tilted card hero with the teal block and terracotta sun is distinctive and appetising, and it no longer borrows butter-and-bloom's arch. Colour-blocked sections, big tiles and the dark tray make the taco-night builder fun and clear.
What a client would still criticise: the cut-off Call button on their own phone (N1). Many yellow `[to confirm]` notes in dish text: honest, but the client must fill them before launch. The 4 text-only menu cards (yellow boxes) look like missing photos. The lower half (reviews placeholders, map placeholder) is busy with dashed boxes. The tray's "11" in the slab face looks loosely spaced.

## Required to pass
Fix N1 and re-measure the phone bar at 353, 360, 375, 384, 390, 393 and 400 with 1 item and 10+ items. N2 is optional.
