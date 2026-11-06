# QA report, round 2: cinder-and-salt (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05, 22:05–22:40 local. The restaurant was "Closing soon" at first and "Closed now" after 22:30, so this round also covered the closed state, which round 1 could not test.
Method: headless Chrome only (`channel='chrome'`, `--headless=new`), `serve.py 8845` (stopped afterwards). I did not change any site files.
Scripts and raw results (scratchpad `qa-cinder2/`): `layout.py`, `flows.py`, `totop2.py`, `perf.py` → `layout.json`, `flows.json`, `perf.json`.
Screenshots: `qa/screens-cinder-and-salt-r2/` (25 jpg).

## Verdict: PASS

Every round-1 blocker and medium issue owned by the site or the core is fixed, and I checked each one with evidence. One medium item is still open: `photos/CREDITS.md` does not exist. The photo-library owner must fix it, not the site builder, so it does not fail the site. What remains is low-severity polish.

## Round-1 issues, re-checked

| R1 # | Issue | Now | Evidence |
|---|---|---|---|
| 1 | Back-to-top pill covered text and the Add button on phones | **Fixed.** At 390 and 360 it appears only at the very end of the page, centred in its own strip between the footer and the sticky bar (totop-menu-end-390, totop-home-end-390). I scrolled every 50 px on home at 1440 and 1280. The 44 px circle overlaps only two things: the room photo band (`FIGURE.room__media > IMG`) and the darkened, decorative booking background image (`IMG`, alt=""). It overlaps **0 text nodes and 0 controls** (totop-1440-y2850, totop-1440-y4750). A small dark circle on the edge of a dark photo looks fine. Smoke check "back-to-top never overlaps content" PASS at 390, 360, 1024 and 1440 | flows.json `totop`, totop2.py output |
| 2 | 15 of 28 dishes had no photo; holes in the grid | **Fixed.** The menu now has 18 items and 14 photos. The 4 text-only items are chips, creamed spinach and the 2 sauces. At 1440, 1200 and 1024 the asparagus photo card fills the first column and spans two rows, with a 2x2 block of text cards beside it, so the grid has **no holes** (L-menu-1440, L-menu-1024). At 768 one creamed-spinach card sits alone in a row (minor) | layout.json `grid@*` |
| 2a | Photo truthfulness | I looked at all 14 dish photos again. Each one matches its dish name, description and alt text. **Fillet** (07): a gloved cook slicing round, lean, evenly pink medallions with a thin crust. That is how a sliced beef fillet (tenderloin) looks, and the alt text describes only what is visible. **Accept, no relabel needed.** Hanger (10): loose-grained pink slices with salt and rosemary ✔. Sliced steak, green sauce (09) ✔. The other 11 are unchanged and correct | images/*.webp |
| 2b | Totals | All 18 items once, worked out by me from `site.js`: 21+16+42+48+52+34+96+128+36+44+32+36+11+9+9+4+4+13 = **$635.00**. The site shows **$635.00, count 18**. The brief's expected **$722 is wrong** for the current prices. 18/18 card prices match `site.js` | flows.json `all total`, `site sum` |
| 3 | Footer hours disagreed with the hours table | **Fixed.** The home footer is now rendered from `SITE.hours` (cinder.js). It reads Mon Closed / Tue, Wed 5–10 pm / Thu 5–10:30 pm / Fri 12–2:30 pm, 5–11:30 pm / Sat 12–11:30 pm / Sun 12–9 pm, which matches `SITE.hours` and the hours table exactly. The menu and checkout footers have no hours list, only the live open-status line, which core computes from `SITE.hours`, so neither can contradict it | footer-home-1440, layout.json `footer *` |
| 4 | Checkout time line went stale | **Fixed (core).** Pickup: 12:45 PM → "Ready for pickup: Tomorrow, 12:45 PM"; 1:45 PM → 1:45 PM; Saturday 6:45 PM → Saturday 6:45 PM. Delivery: 1:15 PM → "Delivery: Tomorrow, 1:15 PM" | flows.json `slot`, p06 |
| 5 | Phone hero showed no food | **Fixed.** `object-position: 74% 52%` on phones. At 390x844 and 360x640 the bone-in steak over flame fills the top half and is clearly visible above the headline | hero-390x844, hero-360x640 |
| 6 | `photos/CREDITS.md` missing | **Still open** (photo-library owner, not the site). The footer still points to it | `ls photos/` |
| 7 | Header wrapped at 1024 | **Fixed.** On one line at 1200 (5 links), at 1100, 1024 and 900 ("The cuts" and "The fire" are hidden), and at 768 (hamburger). The header is 72 px tall at every width | header-1200/1024/900/768 |
| 8 | Fonts are system stacks | **Still open** (low). `--font-display` still starts with "Bodoni 72", "Bodoni MT"; there is no local woff2 | style.css l.25–26 |
| 9 | JS off: checkout showed a dead form | **Fixed.** checkout.html has a `<noscript>` "Ordering needs JavaScript. Please call [phone]" panel | checkout.html l.37 |
| 10 | Menu hero loaded the 1600 px image | **Fixed in part.** It now uses the 400/800 srcset with `fetchpriority="low"`, but this decorative image is still the menu's LCP element (45 KB) | perf.json |
| 11 | "From the fire" badge | **Fixed.** The badge is now "Signature" (bone marrow, ribeye, tomahawk, lamb cutlets). The category is renamed "From the grill" | flows.json `badges`, `cats` |
| 12 | Price format | **Fixed.** The cuts table shows "$42.00", the same as everywhere else | L-index-1440 |
| 13 | Story gap at 390 | **Fixed.** At 390 the two photos sit side by side with no empty block | story-390 |
| 14 | Last ASAP equals closing time | Info only, unchanged (core rule) | — |

## Full regression

| Area | Result | Evidence |
|---|---|---|
| `qa/core_smoke.py --site cinder-and-salt --port 8845` | **40/40 PASS** (includes axe 0 violations, back-to-top at all 4 widths, time-line update, storage blocked, focus trap) | qa/core_smoke_cinder-and-salt.json |
| Order path 390x844, touch | **PASS, 8 taps**: Order → Add Ribeye → Add Lamb cutlets → View order → Checkout → name → phone → Place order. Sticky bar shows "VIEW ORDER (2) · $84.00"; drawer, button and confirmation all show $84.00; order #7907, "Tomorrow, 12:30 PM" (restaurant closed, so the time is scheduled automatically) | p02–p05 |
| Booking 390 | **PASS**: Book tap + name + phone + submit → "Table request received", ref WS-YKKB2F | p07 |
| Keyboard 1440 | **PASS**: first Tab = skip link; header Order online → 2 Adds → cart → Checkout → name, phone → Place order → confirmation #5530. 68 key presses; focus ring solid 3 px #ffb27a | kbd-confirmation-1440 |
| Console / page errors | **0** across all my runs (3 pages x 4 viewports, plus every flow) and in the smoke test | flows.json, layout.json `errors: []` |
| Horizontal scroll | **0 px** on 3 pages x 1440/1024/390/360 | layout.json |
| Broken images / missing alt | **0 / 0** | layout.json |
| Footer lines | "Sample design by Website Studio. Menu and prices are samples." and "Photos are stock" on index, menu and checkout | flows.json `scan` |
| Invented facts | A scan for since/years/award/rated/stars/Michelin/organic/halal/wagyu/dry-aged/grass-fed/prime/local/best/famous/fresh/certified/heritage/sustainable found **nothing** on any page. The "Signature" badge is a neutral label, not a claim. "Beef-fat chips… cooked three times" is invented sample dish copy, which the banner already labels as samples; acceptable. Placeholders are still marked: [Guest reviews/Press/Beef supplier: client to supply], [Wording: client to confirm], weights [to confirm] | — |
| Performance, phone (390x844 DPR 3, 4x CPU, 1.6 Mbps/750 kbps/150 ms, cache off, 3 runs) | **Home: 486 KB first view, LCP median 2340 ms** (2340/2152/4856), CLS 0, load median 4.2 s, LCP = hero 1600 webp (82 KB). **Menu: 611 KB, LCP median 1872 ms** (2424/1872/1772), CLS 0. Both are within budget: under 1.5 MB, hero under 200 KB. Menu bytes rose from 468 KB because it has more photos | perf.json |
| Closed state | "Closed now · opens tomorrow at 12:00 PM (sample hours)" on all pages; checkout switches to scheduled times | totop-menu-end-390, checkout-360 |
| 360 checkout header | The brand and "Back to menu" now each fit on one line | checkout-360 |

## Open issues (none block the release)

| # | Severity | Issue | Evidence | Fix |
|---|---|---|---|---|
| A | Medium (content rule, library owner) | `photos/CREDITS.md` still does not exist, so the footer's credits pointer leads nowhere | `ls photos/` | Library owner: write CREDITS.md (photographer, source, licence per file) |
| B | Low | The same photo (07, cook slicing fillet) is both the **Fillet** dish photo and the home story photo. A client may notice the repeat | index.html l.133, site.js l.71 | Use another story image (e.g. 04 or 05 crop), or keep it if the repeat is acceptable |
| C | Low (copy) | The category "From the grill" holds "Braised beef shin" (slow-cooked, not grilled). The category line admits it ("Lamb, a slow braise…") | L-menu-1440 | Rename it "Mains", "From the kitchen", or "Fire and braise" |
| D | Low (visual) | In the home footer at 1440 the Friday hours wrap, and the second part "to 11:30 pm" drops under the day column | footer-home-1440 | Make each `li` a 2-column grid (`grid-template-columns: 6.5rem 1fr`) or use `white-space: nowrap` on the ranges |
| E | Low | System fonts (R1 #8) are unchanged | style.css | Bundle a local woff2 Didone and a sans |
| F | Low | The sticky-bar cart label "VIEW ORDER (2) · $84.00" still wraps onto 2 lines at 390 | p02 | Shorten it to "Order (2) · $84" or reduce letter-spacing in `.mbar__btn` |
| G | Low | The decorative menu hero is still the menu's LCP element | perf.json | A CSS gradient, or accept it (LCP is 1.9 s) |
| H | Info | At 768 the creamed-spinach card sits alone in a row of the sides grid | layout.json `grid@768` | Optional |

## Design rating: 8/10 (up from 7)

Why it is better: the phone hero now sells the steak. The menu looks complete, with 14 strong, consistent dark photographs, and the sides block is laid out with intent. The header is clean at every laptop width. The cuts table is consistent, the story section on a phone is tidy, and the back-to-top button is unobtrusive.
Why not 9: the brand look still depends on the device's fonts, the uppercase letter-spaced eyebrows repeat a lot, and there are small wrap details (footer Friday line, sticky-bar label).

What a client would still criticise:
1. "Why is the fillet picture also my story picture?"
2. "Braised shin isn't from the grill."
3. "The Friday hours line in the footer looks broken."
4. "The font looks different on my Android phone."

## Not tested
Real devices, Safari and Firefox, real screen readers (axe through the smoke test only), and the "open, not closing soon" clock state (I tested closing-soon and closed).
