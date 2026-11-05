# QA report FINAL-B: 5 realistic 3D restaurant sites (round 3, after code-review fixes)

Tester: studio-qa-tester (EvidenceQA), independent. Date: 2026-11-04.
Method: Playwright headless Chrome (`channel='chrome'`, `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`), server `python showcase/serve.py 8872`, one site at a time, every browser closed after each test. Harness: scratchpad `qr_site.py` (raw JSON per site `qr_<slug>.json`). Screens: `showcase/qa/screens-final/<slug>/` (`<vw>x<vh>_<nn>_<station>.png`, `_bg.png` = same frame with HTML hidden, so the 3D alone is visible).
GPU is shared with an accessibility auditor running at the same time: fps is the median of three 2 s windows per station with the spread; startup numbers are three cold browser launches.
Acceptance criteria: `showcase/BRIEF.md`, `BRIEF-3D.md`, `BRIEF-3D-REAL.md`.

Severity: High = broken for users or explicit requirement badly missed; Medium = explicit requirement missed in part; Low = polish.
Notes for every site: `window.__THREE__` (set by three.js itself), `gsap`, `ScrollTrigger`, `Lenis` and GSAP's ease aliases are library globals, not debug hooks; no site file contains `window.__`, `console.log` or a `?debug`/`?q=` switch (grep). "cover" = % of the viewport under the header covered by content panels. fps here = rendered scene frames per second in headless Chrome (not vsync-capped, so values over 60 are possible).

---

## 1. himal-chulo (Indo-Nepali): PASS

### Measured
| Check | Result |
|---|---|
| Console / page errors, failed requests | 0 at 1440, 1024, 390x844, 720x450, 390x667; 0 in menu, fps, pause, context, no-WebGL, reduced-motion and 13 cold loads |
| 3D on | `is-3d`, never `fell-back`, at every viewport and in 10/10 cold loads |
| Horizontal scroll | 0 px at every station of every viewport |
| Skip link | first Tab = "Skip to content", Enter focuses `#main` (all 5 viewports) |
| Nav anchors | 5/5 focus their section at every viewport (via the menu below 960 px); target panel in view; menu closes, `inert` cleared |
| Mobile menu | opens with `inert` on main and footer + `overflow:hidden`; 390x844 / 390x667 / 720x450 fit (no scroll needed), last link "Reserve" reachable by Tab and hit-testable; 320x256: menu scrolls inside itself (scrollHeight 296 / client 195, wheel moved it 101 px, page stayed at 0), last link reachable; Escape closes, focus back on toggle, `inert` cleared; resize to 1200 while open clears it |
| 3D changes between stations (HTML hidden) | 99 / 91 / 78 / 76 / 90 % of pixels change station to station at 1440 (similar at all viewports) |
| Panel cover 1440 | 22 / 11 / 12 / 11 / 37 (menu) / 18 % |
| Panel cover 390x844 | 38 / 23 / 31 / 24 / 80 (menu) / 48 % |
| Panel cover 390x667 | 50 / 30 / 39 / 30 / 88 (menu) / 61 % |
| Panel cover 720x450 | 56 / 30 / 36 / 22 / 86 (menu) / 66 % |
| WebGL off | head probe leaves `gl-able` off, scene never imported, 0 draws, designed SVG/gradient posters at every station (mountains + flags, hearth, thali, tea pour, menu, lantern window); height 9115 px constant (1440) and 8255 px (390) |
| Reduced motion | pause button hidden; two frames 1.5 s apart identical; rAF 1.5/s in the first idle window, 0.0/s after scrolling; 0 low-opacity text |
| Pause (3 runs, pressed at first WebGL draw) | `aria-pressed="true"`, label constant "Pause motion", no aria-label; frames 1.5 s apart mean diff 0.00 at load and identical at the table station; rAF callbacks 0.0 / 0.5 / 0.0 per s at load, 0.0 later; resume: `aria-pressed="false"`, smooth (Lenis) wheel scroll resumes, scene moves, anchor `#table` focuses its section |
| Context loss + restore | arrival: mean luminance 65.1 before, 65.0 after; table: 64.9 / 63.8; `is-3d` removed while lost (poster shown) and restored; scene redraws on scroll; 0 new console lines |
| Startup, 3 cold launches (1440) | first WebGL draw 0.98 / 1.94 / 1.33 s; 3D on 2.34 / 4.21 / 2.68 s; longest task 289 / **713** / 291 ms |
| Startup, other viewports | longest task 1024: 275 ms; 390x844: 338 ms; **720x450: 850 ms**; **390x667: 781 ms** |
| 10 cold loads | 10/10 show 3D; 3D on 2.3 - 4.0 s (median about 2.8 s) |
| 3D bytes requested | desktop **12.05 MB** (28 files incl. 1.45 MB HDRI); phone 390 profile 4.68 MB (14 files, no HDRI, no normal/ARM maps); libs about 1 MB extra |
| fps at 1440 (median of 3, spread) | arrival 60.5 (8.5), kitchen 64.0 (4.5), table 61.5 (3.5), tea 55.5 (29.5), menu 48.5 (8.0), reserve 70.0 (6.5) |
| Content | only bracket placeholders ([Price], [Allergen and dietary information], [Reservation link], [Your phone number], [Street address], [Opening hours], [Testimonial from a guest]); menu flagged "05 Menu - Illustrative sample" + "Sample menu for illustration only"; table panel "Illustrative dishes. Your own food photography goes here."; no prices, hours, awards, "authentic/traditional/since" or cultural claims found; footer "Sample design by Website Studio. 3D assets: Poly Haven (CC0)."; 0 external requests |
| Credits | Poly Haven ids requested: brass_diya_lantern, brass_pot_01, brass_pot_02, tea_set_01, food_lime_01, warm_restaurant_night (HDRI), clay_plaster, wood_table_worn: all 8 listed in `assets/CREDITS.txt`, nothing listed that is unused |

### Defects
1. **Medium - startup long tasks over the 400 ms target on some loads.** 713 ms on one of three cold 1440 loads, 850 ms at 720x450, 781 ms at 390x667 (other loads 275-338 ms). GPU was shared, so this is partly contention, but the brief asks for no block over about 250 ms. Evidence: `qr_himal-chulo.json` cold3 / views.
2. **Low - 3D-on time over 3 s on 1 of 3 cold launches (4.2 s) and 3 of 10 cold loads (3.0-4.0 s).** Shared GPU; median is within target.
3. **Low - desktop 3D bytes at the budget edge: 12.05 MB** (budget about 12 MB). Phone is fine (4.68 MB).
4. **Low - fps below 60 at tea (55.5) and menu (48.5) at 1440** with a shared GPU; the other four stations are 60-70.
5. **Low - reserve panel covers 61 % (390x667) and 66 % (720x450)** of the view; the menu station covers 80-88 % on phones (a menu list; acceptable, but the lantern is mostly hidden). Other stations leave a clear 3D area. Evidence: `390x667_05_reserve.png`, `720x450_05_reserve.png`.
6. **Low (visual) - tea pour stream is a solid straight cylinder** that reads as a straw or stick, not liquid (`1440x900_03_tea.png`).
7. **Low (visual) - reserve backdrop: the snowy mountain layer has a hard horizontal cut-off** above the dark ridge, so the range reads as flat stacked cards (`1440x900_05_reserve.png`).

### Visual verdict (screens in `screens-final/himal-chulo/`)
Good, the most "photographic" of the batch in places. The brass (pots, thali, diya lantern) and the worn wood table are the realistic parts: correct metal reflections, warm practical light, soft shadows; the kitchen hearth with fire glow and steam and the lantern-in-window reserve shot look like a product still. The arrival courtyard (prayer-flag strings, marigold garland, lit doorway, carved lattice windows, dusk mountains) is atmospheric and grounded, not a fantasy orbit, so it is clearly different from Saffron Court. Weakest: the **backdrops and walls**: the clay-plaster walls are a large blobby texture and the mountain ridges are flat cut-out layers; then the **food**: the momos are clean procedural swirls (acceptable under steam), the rice mound and katori sauces are fine at distance, but the two limes beside the steamer look like random props. The tea set is Poly Haven's European floral porcelain, which weakens the Himalayan feel at the tea station. Indo-Nepali feel without claims: yes (brass, thali, momo steamer, prayer flags, marigolds, diya); the copy keeps to neutral food and atmosphere descriptions.


---

## 2. ember-and-oak (wood-fire steakhouse): FAIL (1 high visual defect on the phone tier, 1 medium)

### Measured
| Check | Result |
|---|---|
| Console / page errors, failed requests | 0 everywhere (5 viewports, menu, fps, pause, context, no-WebGL, reduced motion, 13 cold loads) |
| 3D on | `is-3d` at every viewport, never `fell-back`; 10/10 cold loads |
| Horizontal scroll | 0 px at every station of every viewport |
| Skip link | first Tab "Skip to content" -> focus `#main` at all 5 viewports |
| Nav anchors | 4/4 focus their section at every viewport (menu below 960 px), menu closed, `inert` cleared, panel in view |
| Mobile menu | full-screen sheet; `inert` on main + footer, page overflow hidden; last link "Reserve" reached by Tab and hit-testable at 390x844, 390x667, 720x450 and 320x256; at 320x256 the menu scrolls inside itself (290/256, wheel moved it 34 px, page stayed at 0); Escape closes, focus returns to toggle, `inert` cleared; resize past 960 while open clears it |
| 3D changes between stations (HTML hidden) | 1440: 76 / 75 / 68 / 58 % pixels changed; phones 96-98 % for the first moves |
| Panel cover 1440 / 1024 | 26 / 21 / 18 / 55 (menu) / 27 % ; 1024: 32 / 25 / 21 / 86 (menu) / 35 % |
| Panel cover 390x844 / 390x667 | 32 / 35 / 29 / 92 (menu) / 50 % ; 41 / 45 / 38 / 87 (menu) / 64 % |
| Panel cover 720x450 | **60 / 50 / 45 / 91 (menu) / 86 %** |
| WebGL off | `gl-able` never set, 0 draws, SVG posters (fire, board, cellar, table, reserve); height constant 4919 px (1440) and 5333 px (390) (layout decided by the head probe before first paint, so no shift) |
| Reduced motion | pause button hidden, 0 low-opacity text, scene draws 0-0.5/s, **but rAF callbacks 148-149 per s at idle** (source: `ScrollTrigger.min.js _rafBugFix`, about 130/s, probe `qr_rm.py`); one late scene redraw in the first 1.5 s window (20 % pixels changed), identical afterwards |
| Pause (3 runs, pressed at first draw) | `aria-pressed="true"`, constant label "Pause motion", no aria-label; rAF 0.0/s at load and later in all 3 runs; frames identical 1.5 s apart at the cellar; at load 2 of 3 runs show a small one-off change (mean diff 1.37, 6.6 % pixels) in the first 1.5 s with 0 draws, i.e. a CSS fade finishing, then identical; resume: Lenis wheel scroll works, scene moves (50 % pixels), anchor `#cellar` focuses |
| Context loss + restore | fire: luminance 27.4 before / 28.2 after; cellar: 17.8 / 17.2; poster while lost; `is-3d` back; redraws on scroll; 0 new console lines |
| Startup (3 cold launches, 1440) | first draw 0.79 / 0.79 / 0.74 s; 3D on 2.05 / 2.01 / 1.90 s; longest task 290 / 261 / 279 ms |
| Startup other viewports | longest task 1024: 260 ms; 390x844: **451 ms**; 720x450: 301 ms; 390x667: **612 ms** (3D on 4.0 s there) |
| 10 cold loads | 10/10 3D; 3D on 0.68 - 2.16 s |
| 3D bytes | desktop **12.70 MB** (33 files, 1.53 MB HDRI); phone 390 profile 4.04 MB (11 files) |
| fps 1440 (median, spread) | fire 86.0 (35.5), board 70.0 (5.0), cellar 80.0 (9.0), menu 81.5 (3.5), reserve 85.5 (12.5): all over 60 |
| Content | placeholders only ([Price], [Wine list to be confirmed by the restaurant], [Allergen and dietary information], [Reservation link], [Your phone number], [Street address], [Opening hours], [Testimonial from a guest]); menu "Illustrative sample" + "Sample menu for illustration only. Dishes, cuts, weights and prices are placeholders"; board panel "Illustrative 3D dish. Replace with photography of your own cuts."; no claims; footer "Sample design by Website Studio. 3D assets: Poly Haven (CC0)."; 0 external requests |
| Credits | requested ids: fireplace (HDRI), stone_fire_pit, wooden_cutting_board, wine_barrel_01, wine_bottles_01, yellow_onion, hanging_industrial_lamp, dark_brick_wall, wood_table_worn, slate_floor: all 10 in `assets/CREDITS.txt` |

### Defects
1. **High (visual, phones and 720x450) - the low tier renders a pale, untextured, near-white floor.** On the low tier the slate texture and the HDRI are skipped by design (CREDITS.txt), so the floor falls back to `color: 0xb4ada6` lit by a generated room light: half of every phone frame is a flat light-grey plane under a dark brick wall and the fire pit (`390x844_00_fire_bg.png`, `390x844_02_cellar.png`, `390x667_*`, `720x450_*`; HTML-hidden luminance 94-108 on phones vs 13-29 at 1440). The "low-key, charcoal" look of the brief is lost and the scene reads like an unlit test render on exactly the devices most visitors use. Fix is cheap (dark floor colour or a tiny tinted slate texture on low tier).
2. **Medium - reduced motion keeps a rAF loop alive: about 148 callbacks/s at idle**, from ScrollTrigger's `_rafBugFix` (BRIEF-3D-REAL: "pause = zero rAF callbacks (also destroy or disable the Lenis, GSAP ticker and ScrollTrigger background loops)"; brief task: reduced motion 0 idle rAF). Pause mode is fine (0/s), so only the reduced-motion start path misses `ScrollTrigger.disable()` / ticker sleep (himal-chulo does this at the top of main.js).
3. **Medium - 720x450 panels cover most of the 3D:** reserve 86 %, hero 60 %, board 50 % (phones: reserve 64 % at 390x667). Brief: "panels must not cover the whole scene ... short, compact panels".
4. **Low - startup long task 451 ms (390x844) and 612 ms (390x667)** over the 400 ms target on phone profiles; desktop is fine (261-290 ms).
5. **Low - desktop 3D bytes 12.70 MB**, slightly over the about-12 MB budget.
6. **Low (visual) - the sliced steak floats:** the slices hover above the board in a fan, look smooth and sausage-like, and the knife is a plain box handle (`1440x900_01_board.png`). This is the "flat cartoon dish in a realistic scene" the brief warns about.

### Visual verdict (screens in `screens-final/ember-and-oak/`)
Desktop: good. The fire pit (real Poly Haven stones, convincing flame cards, sparks), the dark brick wall, the oak barrels and the warm raking light make a moody, believable steakhouse hero; the cellar with barrels and bottles is the most realistic shot. Weakest: the **food** (floating smooth steak slices, cylinder logs in the fire) and on phones the **floor** (defect 1). Clearly different from the other four (only dark, low-key site) and from the first ten.
