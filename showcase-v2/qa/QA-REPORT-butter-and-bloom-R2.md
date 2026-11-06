# QA report, round 2: butter-and-bloom (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05. Headless Chrome only (`channel='chrome'`, `--headless=new`). Server `serve.py 8852`, stopped afterwards. I did not change any site files.
Scripts and raw JSON are in `C:\Users\kaush\AppData\Local\Temp\claude\53e3aa7b70d7a652\768b905f-d1cb-4392-b7ce-97c1fa6f393a\scratchpad\qa-butter2\` (a_header, b_flows, c_crawl, d_misc, e_perf, f_nojs).
Screenshots are in `qa/screens-butter-and-bloom-r2/` (26 jpg).
Where a time matters I fixed the clock with `page.clock`: Tue 2026-11-10 10:00 (open), Sun 11:00, Sun 13:50, Sun 15:00, Mon 10:00 and Sat 18:00.

## Verdict: PASS (2 medium fixes to make before the client demo)

Both round-1 FAIL triggers are fixed: the header icons and the unqualified claims. The other round-1 issues are fixed, or reduced to Low. `core_smoke` passes 42 of 42 checks. Nothing in this round meets a FAIL trigger. Two content and layout faults are left (issues 1 and 2). Each is a few minutes of work.

## Open issues

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | Medium | **A count contradicts the photo, and the two pages disagree.** The home pre-order card says "Morning pastry basket · **8 pieces**". The photo shows about 12 pieces (3 almond rings, 4 or more nut swirls, 4 chocolate-striped pastries and a croissant). site.js dropped the count, so the menu page has no count while home still says 8 (round-1 issue 4 is only partly fixed) | `index.html` line 137 `pcard__meta`; Read of `images/pastry-basket-800.webp` | Change it to "To share · for the table or office", or "about 12 pieces [to confirm]" |
| 2 | Medium | **Menu grid holes at 1024 px and wider.** "Coffee & tea" has one photo card (Latte & croissant) alone in a 3-column row, leaving two thirds of the row empty above the 3 full-width text rows. This is the "ugly hole" the brief asks to avoid. "Cakes & tarts" (5 items) also leaves one empty cell. At 768 px (2 columns), Cakes (5) and Loaves (3) each leave one empty cell | `13-menu-loaded-full-1440.jpg`; d_misc.json `grid_1440/1024/768` | Make the single photo card in a category span the full row as a horizontal card, or list it after the text rows. Optionally let the last orphan card span 2 columns |
| 3 | Low | "Croissants to share" ("by the box", 4 or 6) uses a photo of about 7 croissants on a wire rack, not a box. The name and alt contain no number, so this is not a false statement, but the photo matches neither option | Read of `images/croissants-rack-800.webp` | Acceptable. Optional: add the line "Photo is illustrative" |
| 4 | Low | 320 px phone bar: "View order (3) · $88.00" still wraps, now to 2 lines (round 1: 3 lines). It is readable and the target is 128x47 | `09-mbar-320-three-items.jpg` | Optional: a shorter label under 22em |
| 5 | Info | The home LCP median is slower than in round 1: 2.84 s (2.62 / 2.84 / 3.54) against 2.18 s. It is still within the 3 s target, but one run was over | e_perf.json | Watch it. The hero is already preloaded at 82 KB |
| 6 | Info | On an open day the pre-order path needs 1 extra tap on "Schedule for later", because ASAP is the default. The steps on the page say so | b_flows.json `preorder.Sun11/Tue10` | None |

## Round-1 issues: re-verified

| R1 # | Status | Evidence |
|---|---|---|
| 1 Checkout Bag icon squashed / header wrap | **FIXED** | I measured 24 cases (home, menu, checkout at 1440, 1200, 1024, 900, 768, 390, 360, 320). Every control is fully inside the viewport (worst right edge: 307 at 320). Bag and nav-toggle SVGs are 22.0x22.0 px everywhere. Every control is 44 px tall on one line. Headers are 72 px / 60 px. Below 26em the back link shortens to "Menu", accessible name "Menu". axe `link-name`, `button-name` and `target-size` on the header: 0 violations in all 24 cases. Screens 16, 17, 18 |
| 2 Unqualified claims | **FIXED** | A grep for fresh, to order, batch, daily, hand, local, organic, artisan, baked, oven, best, since, award, squeeze and slow finds only neutral copy. The h2 is now "Pastry, bread and slow mornings" (mood, not a process claim). "slow coffee" is also mood. "Best pre-ordered" is advice. Every sourcing slot is marked `[supplier/mill/roaster: client to supply]`. Gluten-free is shown as "Gluten-free [to confirm]" |
| 3 Cookies count | **FIXED** | It now reads "Chocolate chip cookies with a glass of cold milk", which matches the photo |
| 4 Counts in names | **PARTLY FIXED** | Macarons is now "gift box" and Baker's box has no count. The basket "8 pieces" is still on home (open issue 1) |
| 5 Half the menu without photos | **FIXED** | 18 items, 15 with photos. Only flat white, cappuccino and pot of tea are text rows. All 15 photos load (slow-scroll check: loaded = withImg in every category) |
| 6 1024 header wraps | **FIXED** | At 1024 and 900, "Our story" and "Hours & location" are hidden between 56em and 75em, and everything sits on one line (`16-header-home-1024.jpg`) |
| 7 "Pre-order for tomorrow" untrue on Sunday | **FIXED** | The copy now says "Pre-order for your next open day" on home and menu, and the seal says "PRE-ORDER · ORDER AHEAD · PICK UP". Results by clock: Sun 11:00 (open) offers Today + **Tuesday** slots. Sun 13:50 offers Tuesday only, with ASAP disabled. Sun 15:00 and Mon 10:00 (closed) switch automatically to Later, with Tuesday ("Tomorrow" on Monday) 7:30 first. Sat 18:00 offers Tomorrow (Sunday) 8:30. Tue 10:00 offers Today, Tomorrow and Thursday. Every confirmation shows the chosen slot. The copy is true in every scenario (`07-checkout-monday-closed.jpg`) |
| 8 Hero card vs photo | **FIXED** | The card reads "Croissant & jam $5.50" and adds `croissant-jam`. The photo shows a croissant and a pot of jam (`01-phone-home-landing.jpg`) |
| 9 srcset widths | **FIXED** | I decoded 77 srcset and preload candidates. All declared widths equal the real widths (the portrait 1600 files are declared 1333w / 1500w) |
| 10 Story photo soft | **IMPROVED** | 1440: the 800 file is shown at 453 px. 390 at DPR 2: the 1600 file is shown at 298 px, object-position 42% 40%. The hands are in focus and the bowl is soft by design (`12-story-1440.jpg`, `12-story-390.jpg`). Acceptable |
| 11 Phone bar 320 | Improved, now 2 lines (open issue 4) | |
| 12 JS-off note | **FIXED** | Home, menu and checkout each have a noscript note. On checkout the form is `display:none` (noscript style). The footer appears through the 3 s fail-safe (`10-nojs-*.jpg`) |
| 13 Booking validation (core) | **FIXED** | Name "A", phone "12" and email "bad@" give 3 errors at once: "Name looks too short…", "…at least 7 digits", "…like name@example.com" |
| 14 Credits | **FIXED** | photos/CREDITS.md exists. I matched all 17 site images to library files by md5, and the 16 photographers in the footer (all 3 pages) are exactly the credits of those 17 files. The unused 04 (Adrianna CA) is correctly left out |

## Regression

- **core_smoke** (`--site butter-and-bloom --port 8852`): **42/42 PASS**. That covers 8 taps for the order path, 3 interactions for booking, axe 0 violations, storage blocked and focus trap.
- **Order path at 390x844** (touch, DPR 2, Tue 10:00): Order bar, Add, Add, View order, Checkout, name, phone, Place order = **8 taps**. Bar "View order (2) · $9.75"; 4.25 + 5.50 = 9.75 ✓. "Ready in about 15 minutes (around 10:15 AM)". Confirmation #5783, "Today, 10:15 AM". Screens 01–04.
- **Totals with options** (my own calculation): Croissants to share with the 6 option = 16 + 8 = **$24.00** ✓. Latte with oat = $9.10 ✓. Cookies with oat = $6.10 ✓. Sourdough ×2 = $18.00 ✓. Flat white = $4.25. Macarons removed. Subtotal **$61.45** ✓. Delivery: 61.45 + 3.50 + 15% tip 9.22 = **$74.17** ✓ (button and summary agree). An empty submit lists 4 errors. Card demo confirms "Card (demo, no payment taken)". A $3.95 delivery order is blocked by the $15 minimum message. Screens 05, 06.
- **Booking**: Book (phone bar), name, phone, submit = 4 taps → WS-78S36X, "2 guests on Tuesday, November 10 at 11:30 AM". Times 11:30–3:00. Monday shows "No tables on this day". Screen 08.
- **Console and page errors**: 0 on all 3 pages at 1440, 1200, 1024, 768, 390 and 360, and in every flow run. **Horizontal scroll**: none (no element sticks out apart from the decorative, scrolling catbar and ticker).
- **Crawl**: 64 unique links and image URLs (all srcset candidates and anchors) → 0 broken. 0 failed requests. 0 images whose real ratio differs from the width/height attributes. 0 empty alts.
- **Footer** "Sample design by Website Studio. Menu and prices are samples. Photos are stock." is present on all 3 pages at every viewport.
- **Performance** (390x844 DPR 2, 4x CPU, 1.6 Mbps / 150 ms, cache off, 3 runs):

| Page | Bytes | Images | Req | FCP med | LCP med (runs) | CLS med | LCP element |
|---|---|---|---|---|---|---|---|
| Home | 573–593 KB | 362–383 KB | 20–21 | 2.50 s | **2.84 s** (2.62 / 2.84 / 3.54) | 0.0115 | croissant-jam-800.webp |
| Menu | 482 KB | 285 KB | 15 | 1.66 s | **~1.55 s** (1.43 / 1.66; 1 run recorded no LCP) | 0 | text |

- **Keyboard** (1440): the first Tab is the skip link. 9 Tabs to the hero Order button. Focus ring is 3px solid rgb(39,71,184) (screen 14). Enter goes to the menu. 11 Tabs to a filter chip, and Enter filters ("Showing 16 of 18"). 7 Tabs to Add. Shift+Tab ×8 to the Bag. 3 Tabs to "+" (qty 2), 3 to Checkout, 7 to name, 7 to Place order. Enter focuses the confirmation heading. PASS.
- **Reduced motion**: with `reduce`, `getAnimations()` is empty and no reveal element is hidden. Without it, bb-settle, bb-spin, bb-float and bb-ticker run. PASS.

## Brand distinctness and design

Home first screens at 1440 and 390 (screens 15-*): butter-and-bloom is a light cream ground with an arch-masked photo, a rotating seal, Cormorant italics and rounded pill buttons. jasmine-lane is a deep jade full-bleed with framed rectangular photos, square buttons and a vermilion seal. hoshi-counter is black with huge staggered serif type, a red disc and a single sushi photo. **Clearly distinct.** The shared skeleton shows only in the status pill → eyebrow → headline → 2 CTAs → "skip the app fees" line, which is acceptable.

**Design: 8 / 10** (up from 7.5). It looks premium and appetising, the menu is now fully photographic and consistent, and the header is clean at every width.
What a client would still criticise:
- the lonely latte card in Coffee & tea and the orphan cell in Cakes (issue 2);
- "8 pieces" on a basket that clearly holds more (issue 1);
- many yellow `[placeholder]` chips in the hero and story, which are noisy though expected;
- the butter-yellow is mostly in the backgrounds, while maroon dominates the accents;
- small grey body text on the menu cards at 1440.
