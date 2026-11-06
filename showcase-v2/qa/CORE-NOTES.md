# Core + template verification (core builder, 2026-11-05)

Scope: `shared/core.js`, `shared/base.css`, `sites/_template/`. Headless Chrome 156 only (`channel='chrome'`, `headless=True`, plus `--headless=new` because Playwright 1.48 passes the removed `--headless=old`). Server `serve.py 8820`. Placeholder SVG gradients stand in for photos (photos/ was empty).

Rerun: `../studio/.venv/Scripts/python.exe qa/core_smoke.py [--site <slug>]` → **39/39 PASS** (`qa/core_smoke_template.json`, `qa/core_smoke_last_run.txt`).

## Results
| Check | Result |
|---|---|
| Console + page errors, home/menu/checkout (checkout with items) at 1440x900, 1024x768, 390x844, 360x640 | 0 |
| Horizontal scroll (same pages and viewports) | none |
| Requests not same-origin | 0 (offline-capable: no fonts, CDNs, maps or analytics) |
| Order path 390x844, touch taps: home → Order → Add → Add → View order → Checkout → name → phone → Place order | **8 taps** to confirmation (order number `#NNNN`, ready time); pickup preselected; drawer button and place-order label both show the total; cart cleared afterwards |
| Booking path 390x844: Book tap, then name, phone, submit | **3 interactions** + confirmation with `WS-XXXXXX` reference; date, first free time and party of 2 prefilled; confirmation heading focused |
| Keyboard-only (1440): skip link first and focuses main; filter chip (aria-pressed); 2 Adds; open drawer; + keeps focus on the stepper; Esc; Checkout; fill; submit | all PASS |
| Drawer focus trap: 40 Tab + 20 Shift+Tab | focus never leaves the panel; header/main/footer `inert`; Esc closes, focus back on the opener, inert cleared |
| Validation | error summary focused, lists links; `aria-invalid` + `aria-describedby` → `<id>-error`; summary link focuses the field; empty booking flags exactly name + phone |
| Mobile nav (390) | aria-expanded, main inert, scroll lock while open; Esc closes and returns focus; link click closes and focuses the section |
| Sticky bar | body padding-bottom 64px = bar height; hidden (`visibility:hidden`) while a field has focus on phones, back on blur |
| Targets at 390 (bar, Add, steppers, close, chips, cart, nav, category links, Remove) | all ≥ 44x44 |
| Menu | search with no match shows empty message + status "No dishes match…"; clear restores "Showing all 10 dishes."; Vegetarian chip → "Showing 3 of 10 dishes."; scroll-spy marks the visible category `aria-current="true"` (including the last one at page bottom) |
| JSON-LD | valid JSON, `Restaurant` + `Menu`, 3 sections / 10 items, description starts "SAMPLE DESIGN" |
| Open now (fixed clock) | Mon 12:00 "Closed now · opens tomorrow at 11:30 AM"; Tue 21:00 "Closing soon · until 9:30 PM"; Sat 23:50 and Sun 00:10 (overnight) "until 12:30 AM"; Sun 09:00 "opens today at 10:00 AM"; Wed 14:00 "Open now"; all show "(sample hours)"; today's row highlighted |
| Storage blocked (localStorage getter throws) | cart works in memory on the page, 0 errors |
| Cross-tab sync | second tab badge updates to 2 via `storage` event |
| Card data | after a card-demo order: card number not in localStorage, sessionStorage or cookies; card inputs empty |
| Delivery | fee added ($14.50 → $18.00); sample $15 minimum blocks with a summary error; Apple Pay demo places "Apple Pay (demo, no payment taken)" |
| Checkout with empty cart | empty state shown, form hidden |
| Reduced motion | `scroll-behavior: auto`, drawer transition 0.00001 s |
| axe-core 4.x (WCAG 2.0–2.2 A/AA + best practice, incl. color-contrast and names) at 1440 and 390: home, menu, checkout, menu+drawer open, home+mobile nav open | 0 violations (with the nav open, `landmark-one-main`/`page-has-heading-one` are off because main is inert by design) |
| Globals | only `window.SITE` added; no `console.*` in core.js |

## Contrast (template tokens, computed)
text/bg 16.20, muted/bg 6.63, muted/surface-2 5.93, white/accent 7.52, error/error-bg 5.88, infobar text 16.20, infobar note 11.55, footer legal 12.85, footer note 10.36, focus ring/bg 6.32, input border/white 3.77 (≥3:1 UI).

## Sizes
| File | Bytes | gzip -9 |
|---|---|---|
| shared/core.js | 60,242 | 19,345 |
| shared/base.css | 22,712 | 5,580 |

First view at 390 (4x CPU, ~1.6 Mbps, 150 ms RTT, serve.py sends uncompressed, placeholder images): home 103 KB, LCP 1176 ms; menu 101 KB, LCP 1524 ms; checkout 101 KB, LCP 1064 ms. Real photos will add to this; budget per BRIEF is 1.5 MB home / 200 KB hero.

## Not tested / open
- Real screen readers (NVDA/VoiceOver) not run; names/roles checked via axe and DOM.
- The order-path tap count depends on the real clock: when the template restaurant is closed, checkout preselects "Schedule for later" (still 8 taps); when open, ASAP is used.
- No photos yet: image `srcset`, LCP with a real hero and CLS from real images untested.
- Firefox/Safari not run (Chrome only). `:has()` is used for the phone-bar body padding and chip states (Chrome 105+, Safari 15.4+, Firefox 121+).

## Follow-up 2026-11-05: layout shift (CLS) fix in shared/
Cause: core.js (deferred module) fills `[data-menu]`, chips, status, category bar, the checkout (empty/root switch, estimate, tips, summary) and the home hours/signature after the first paint, so the footer and following blocks jumped.
Fix: base.css keeps every JS-filled hook and everything after it `visibility:hidden` until `html.js-ready` (3 s CSS fail-safe); core.js guards each boot step and adds `js-ready` right after rendering. No hook, id or field name changed; no site edits.

CLS, 4x CPU, 1.6 Mbps, 150 ms RTT, cache off, 2.5 s after load (`checkout+cart` = two items in the cart):

| Page | Template before (1440 / 390) | Template after | cinder-and-salt after | butter-and-bloom after |
|---|---|---|---|---|
| home | 0.0026 / 0.0020 | 0.0026 / 0.0020 | 0 / 0.0106 | 0.0027 / 0.0116 |
| menu | **0.386 / 0.6998** | 0 / 0.0095 | 0 / 0 | 0.0002 / 0.0138 |
| checkout (empty cart) | **0.1319 / 0.2565** | 0 / 0 | 0 / 0 | 0 / 0 |
| checkout + cart | not measured separately (script bug) | 0 / 0 | 0 / 0 | 0 / 0 |

Remaining small shifts: the open-now line re-wrapping when its text is filled (the home and menu header), and the butter-and-bloom web-font swap. All under 0.05.
Fail-safe verified: with core.js blocked, and with JavaScript off, the footer goes from hidden to visible at 3.3 s on home, menu and checkout; the phone bar is visible the whole time.
Smoke after the fix: `_template` 39/39, `cinder-and-salt` 38/38, `butter-and-bloom` 38/38 (the fixed-clock open-now check only runs on the template). Sizes: base.css 23,733 bytes, core.js 60,637 bytes.

## Follow-up 2026-11-05 (2): back-to-top overlap + stale checkout time line
- Back to top: icon-only 44px button; below 80em only shown at the very end of the page inside a reserved 60px strip (body padding) above the sticky bar; from 80em floats in the gutter. New smoke check scrolls home and menu (2 items in cart) in steps at 390x844, 360x640, 1024x768 and 1440x900 and tests the button box against every visible link, button, field, label, text and list element (images excluded: covering a full-bleed photo in the 1440 gutter is fine): 0 overlaps on all four sites; it is shown at the page end at every width.
- Checkout: `c-slot` change now calls the sync. New smoke check: picking 2 different slots updates the line to the chosen label each time ("Ready for pickup: Tomorrow, 1:30 PM"), and switching back to ASAP shows "about N minutes".
- Smoke: `_template` 41/41, `cinder-and-salt` 40/40, `butter-and-bloom` 40/40, `mustang-hearth` 40/40 (ports 8850-8853). One earlier cinder run showed `pageerror: Unexpected token ')'` while `cinder.js` was being edited by another agent (file time 22:14, during the run); a fresh load had no exception and the rerun passed.

## Follow-up 2026-11-05 (3): validation summary and messages
Cause: the booking and checkout forms already validated every field in one pass. But after an empty submit, the summary was not refreshed while the guest typed. It kept showing "Enter your name / Enter your phone" with no email line until the next submit. Fix: live re-render of inline errors and the summary after the first failed submit; new too-short message. New smoke checks (booking and checkout, both "submit once with A / 12 / bad@" and "empty submit, then type"): summary has 3 items including email, no "Enter your name", inline "Name looks too short…".
Results: `_template` 43/43, `cinder-and-salt` 42/42. `butter-and-bloom`: 41/42, the one failure is site-side: axe `link-name` on its new checkout "Back to menu" link at 390 (edited 22:32 during the run). At that width the long text is `display:none` and the short "Menu" is `aria-hidden`, so the link has no name.
