# QA report: 5 restaurant 3D sites (round 2, after the code-review fix round)

Tester: EvidenceQA (studio-qa-tester role), 2026-11-04. Independent; no site files edited.
Acceptance criteria: `showcase/BRIEF.md`, `showcase/BRIEF-3D.md`; fix list: `showcase/qa/CODE-REVIEW-3D.md`.

## Method
- Server: `python -m http.server 8831` from `showcase/`, one site at a time.
- Browser: Playwright 1.48 driving installed Chrome 156, **headless only**, flags `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`. Renderer obtained: see each site (real GPU, not SwiftShader).
- Harness: `q3_site.py` in the session scratchpad. It injects counters before page scripts: total rAF callbacks, frames that issued WebGL draw calls ("scene fps"), first WebGL draw time, long tasks, `scrollHeight` every 100 ms for 12 s.
- Viewports: 1440x900, 1024x768, 390x844 (dsf 2, touch), 720x450, 390x667 (dsf 2, touch). Real mouse-wheel scroll from top to footer, a screenshot at every station; at 1440 and 390x844 also a scene-only screenshot (HTML hidden) to measure how much the 3D changes between stations.
- FPS: separate headless run with `--disable-gpu-vsync --disable-frame-rate-limit` (uncapped), 3 windows of 3 s per station, median and spread. **Other agents share this GPU at the same time, so fps numbers are noisy and can be low because of contention.**
- WebGL off: `getContext('webgl*')` returns null (injected). Reduced motion: Playwright `reduced_motion='reduce'`. Context loss: `WEBGL_lose_context` on the page's own context, 1.2 s lost, then restore, 3.5 s later compare scene brightness with the frame before loss.
- Headless note: "context lost" console lines that appear only during the forced loss test are expected, not defects.
- Screenshots: `showcase/qa/screens-3d-r2/<slug>/`. Raw numbers: `q3_<slug>.json` in the scratchpad.
- bfcache: Playwright turns Chrome's back/forward cache off, so a real Back restore cannot happen headless. Instead `pagehide`/`pageshow` events with `persisted:true` are dispatched, then the page is scrolled to prove the scene still renders ("bfsynth").
- Verdict rule: FAIL if any high defect, or any med defect against an explicit acceptance criterion (brief or the manager's test list, e.g. "rAF ~0 while paused"). Low items alone do not fail a site.

## 1. sakura-omakase: FAIL (1 high)

Renderer: ANGLE (AMD Radeon 780M, Direct3D11), headless Chrome 156. Screens: `screens-3d-r2/sakura-omakase/` (the hub shots `hub_1440.png`, `hub_390.png` are also stored here).

### Results
| Check | Result | Evidence |
|---|---|---|
| Console / failed requests | 0 errors, 0 failed, 0 external requests at all 5 viewports, WebGL-off, reduced motion. 1 warning on desktop tier (see S-2) | `q3_sakura-omakase.json` main.console |
| Horizontal scroll | none at 1440, 1024, 390x844, 720x450, 390x667 (scrollWidth = clientWidth at every station) | json views.*.hs |
| Skip link | first Tab lands on "Skip to content"; Enter moves focus to `#main` | PASS |
| Nav links (1440, keyboard) | counter, omakase, tools, reserve: focus lands on the section. Brand `#top` focuses `#arrival` (intended) | PASS |
| Mobile menu (390x844) | toggle 48x48, constant label "Menu", aria-expanded true/false, Tab cycles inside menu + brand/pause/toggle, Escape closes and returns focus to toggle; each menu link closes the menu and focuses its section | PASS, `390x844_menu_open.png` |
| Wheel scroll, all stations | 6 stations x 5 viewports captured; scene-only frames change 84-99% of pixels between stations at 1440 and 82-99% at 390 | `1440x900_0*`, `390x844_0*_bg.png` |
| Text over scene | all copy sits on dark panels; readable everywhere | screenshots |
| WebGL off | `no-3d` class, designed flat-art posters (torii, moon, trees), page usable, height constant 4227 px during load | `nogl_1440_*`, `nogl_390_*` |
| Reduced motion | pause button hidden (display none), still frames per station change correctly, 0 scene frames when idle, no low-opacity text | `reduce_1440_*` |
| Pause motion | aria-pressed true, `html.motion-off`, constant label. Clicked at first WebGL draw, 3 fresh loads: **0 scene frames/s and 0 page rAF callbacks/s while paused** (browser ticks 136-145/s). Scene-only frames 1.5 s apart identical in 4 of 6 comparisons; the 2 others had 0 draw calls in the window (residual camera settle after scroll) | json pause, `paused_a.png` = `paused_b.png` |
| Context loss/restore (3 stations) | during loss the designed poster shows (`gl-lost`); after restore brightness equals pre-loss (arrival 31.3 -> 31.4, counter 40.2 -> 39.9, omakase 97.1 -> 97.8 mean luma); bottle and lacquer reflections back | `ctx_2_omakase_restored_bg.png` |
| **Claimed fix S1 env map after restore** | VERIFIED | above |
| **Claimed fix S2 tier on Firefox/Safari-like profile** | VERIFIED: with `deviceMemory` undefined + 8 cores: pixel ratio 1.5 and 160 draws/frame (composer on), same as Chromium mem 8; mem 4 gives tier 1 (PR 1, 145 draws) as designed | json tier |
| **Claimed fix posters redrawn** | VERIFIED: posters are designed flat illustrations, not plain gradients | `ctx_1_counter_lost.png`, `nogl_1440_00_arrival.png` |
| **Claimed fix paused rAF 0** | VERIFIED (0.0/s in all 6 windows) | json pause |
| Debug hooks | no `window.__*` (only `__THREE__` from three.js), no query switches in code | json main.globals |
| Content rules | only placeholders: [Price], [Reservation link], [Street address], [Opening hours], [Your phone number], [Testimonial from a guest]; "Illustrative sample menu"; footer "Sample design by Website Studio..." present; no dead links | PASS |
| bfcache | NOT TESTED: Playwright disables Chrome's back/forward cache (`persisted:false`, page reloads and works) | json bfcache |
| Time to first scene | first WebGL draw 0.6-1.2 s (environment bake); scene visible (`is-3d`) at **6.3-7.1 s** on 1440/1024, 3.1-4.3 s on phone sizes | json main/views |

### FPS (1440x900, uncapped, 3x3 s per station, median / spread; GPU shared with other agents)
arrival 150 / 6, counter 169 / 5, omakase 167 / 17, tools 150 / 10, reserve 165 / 16.

### Defects
1. **S-1 high. Main thread blocked 4.4-5.5 s while the scene starts (desktop tier).** Long tasks measured with PerformanceObserver: 1440 run 1: 4235 ms; run 2: 4416 ms; run 3: 5523 ms; 1024x768: 5307 ms; phones 2.9-3.9 s. The long task ends exactly when `is-3d` is added, so it is the scene build / first render (shader programs compiled synchronously, ~200 meshes with MeshPhysicalMaterial). During that time the page cannot scroll, the menu does not open and the pause button does not respond. Repro: load `/sites/sakura-omakase/` at 1440x900, observe `longtask` entries. Forno uses `compileAsync` + `checkShaderErrors=false` for this; Sakura does not. (Shared GPU may inflate the number, but it was 4-5.5 s in all 4 desktop loads.)
2. **S-2 low. Console warning on desktop tier:** `THREE.WebGLProgram: ... warning X4713: Sample Bias value is limited to the range [-16.00, 15.99], using -16 instead of -100` (FXAA shader on D3D11). Not an error, but the brief asks for a clean console. Repro: 1440 load, console.
3. **S-3 low. Station rail overlaps content at 1440.** The right-hand dot rail sits on top of the tools panel text ("...eaten by" at x~1313) and over the sushi board at the omakase station. `1440x900_03_tools.png`, `1440x900_02_omakase.png`.
4. **S-4 low (visual). Short landscape (720x450):** the hero and section panels cover almost the whole scene; the 3D is only a thin strip. `720x450_00_arrival.png`.

### Visual notes
Strong, coherent art direction: low-poly cherry trees, vermilion torii, moon, glowing striped lanterns, long lacquer counter with red stools, glossy-toy nigiri on a wooden board, knife/board/grater for tools, moonlit reserve scene. Typography (serif + italic gold) is high-class. Clearly different from the other four and from round 1. The 3D is convincing as a stylised toy world; the counter station is the wow moment. Phone layout keeps the scene visible above the panels except on the menu station (expected).

## 2. forno-rosso: FAIL (1 med)

Renderer: ANGLE (AMD Radeon 780M, Direct3D11). Screens: `screens-3d-r2/forno-rosso/`.

### Results
| Check | Result | Evidence |
|---|---|---|
| Console / failed requests | 0 errors, 0 warnings, 0 failed, 0 external, all modes incl. context loss | json |
| Horizontal scroll | none at all 5 viewports, every station | json views |
| Skip link | Tab -> "Skip to content", Enter -> focus `#main` | PASS |
| Nav links (1440 keyboard) | dough, toppings, oven, menu, reserve all focus their section with its top at 0 | PASS |
| Mobile menu (390x844) | 48x48 toggle, `aria-label="Menu"`, aria-expanded toggles, Tab trapped in menu, Escape closes + focus back on toggle, each link closes and focuses target | PASS, `390x844_menu_open.png` |
| Wheel scroll, all stations | captured at 5 viewports; scene-only frames change 81-100% between stations (1440) and 80-99% (390) | `1440x900_0*`, `390x844_0*` |
| Text over scene | cream cards and dark cards with solid backing; readable | screenshots |
| WebGL off | flat posters (dough ball, tomatoes, oven arch with flame, embers), height constant 5333 px | `nogl_1440_*`, `nogl_390_*` |
| Reduced motion | pause hidden, still frames per station, 0 scene fps idle, all text visible | `reduce_1440_*` |
| Pause motion | aria-pressed true + `motion-off`, constant label; 3 fresh loads clicked at first draw: 0 scene frames/s, scene-only frames identical 1.5 s apart (6/6). **Page rAF callbacks while paused: 286-296 per second** (see F-1) | json pause |
| Context loss/restore | poster during loss (`gl` removed), after restore same brightness (172.9 -> 172.9, 155.7 -> 155.6, 89.0 -> 85.5) | `ctx_2_oven_lost.png`, `ctx_2_oven_restored.png` |
| **Claimed fix: first frame ~1.7-2.4 s** | VERIFIED: first WebGL draw 2.32 s (1440), 1.84 s (1024), 1.50 s (390x844), 1.18 s (720x450), 1.14 s (390x667) | json |
| **Claimed fix: no main-thread block > ~0.4 s** | MOSTLY: max long task 398 ms (1440), 377 (720x450), 350 (390x667), but **445 ms (1024)** and **483 ms (390x844)** | json (F-2) |
| **Claimed fix: cheese golden** | PARTLY: golden-brown melted cheese with basil from the menu station on; at the oven station the pieces are still pale cream lumps | `1440x900_02_oven.png`, `1440x900_03_menu.png` |
| **Claimed fix: cards visible** | VERIFIED: every card visible at every viewport and in WebGL-off / reduced motion; no low-opacity text | screenshots |
| **Claimed fix: restore after shader-compile change** | VERIFIED: restore returns bright, no console errors | json ctx |
| bfcache (simulated) | scene keeps rendering after pagehide/pageshow persisted (39k draws on the next scroll, frame changed 99.9%) | json bfsynth |
| Debug hooks | none (`?debug`, `?tier=`, `?nolenis`, `window.__forno` gone) | json globals, grep |
| Content rules | placeholders only ([Price], [Reservation link], [Street address], [Opening hours], [Your phone number]); "Illustrative sample menu"; "Fresh from the oven" reworded to "Straight from the oven"; footer line present | PASS |

### FPS (1440x900, uncapped, median / spread, shared GPU)
dough 117 / 13, toppings 101 / 4, oven 85 / 13, menu 99 / 6, reserve 87 / 10. All above 60, lowest of the five so far at the oven.

### Defects
1. **F-1 med. Two rAF loops keep running while "Pause motion" is on.** Scene frames stop (0/s) but the page still runs 286-296 rAF callbacks per second (GSAP ticker driving Lenis, plus a second loop) in all 6 paused windows. Sakura gets 0 by sleeping `gsap.ticker` and stopping Lenis. Repro: 1440, click Pause, count rAF callbacks for 2 s. `main.js:15-19`.
2. **F-2 low. Long task 445 ms at 1024x768 and 483 ms at 390x844** (one load each, shared CPU/GPU), just over the ~0.4 s target. Repro: load at those sizes, PerformanceObserver longtask.
3. **F-3 low (visual). Short landscape 720x450:** hero and toppings cards cover most of the scene. `720x450_00_dough.png`.
4. **F-4 low (visual).** Mozzarella pieces read as white marshmallow blobs at the toppings and oven stations; the baked pizza later looks right. `1440x900_01_toppings.png`.

### Visual notes
Warm clay art direction is consistent: terracotta tiles, marble counter, wooden peel, glowing brick oven. Big friendly serif display type with italic accents, cream and chocolate cards. The exploded toppings view and the push into the oven are a clear wow moment. Very different from Sakura (bright, daytime, tactile). Phone layout is clean: card at the bottom, scene above; menu station fills the screen with the list (expected).

## 3. saffron-court: FAIL (1 high, 3 med)

Renderer: ANGLE (AMD Radeon 780M, Direct3D11). Screens: `screens-3d-r2/saffron-court/`.

### Results
| Check | Result | Evidence |
|---|---|---|
| Console / failed requests | 0 errors, 0 warnings, 0 failed, 0 external in all modes | json |
| Horizontal scroll | none at all 5 viewports | json views |
| Skip link | Tab -> skip link, Enter -> `#main` focused | PASS |
| Nav links (1440 keyboard) | spice, tandoor, menu, reserve focus their sections; brand `#top` scrolls to top and leaves focus on the brand link (by design) | PASS |
| Mobile menu (390x844) | 48x48 toggle `aria-label="Menu"`, aria-expanded, Tab trapped, Escape closes + focus back to toggle, links close + focus target | PASS, `390x844_menu_open.png` |
| Wheel scroll, all 7 stations | scene-only frames change 73-91% between stations (1440), 54-74% (390) | `1440x900_0*`, `390x844_0*` |
| Text over scene | arched dark panels; readable | screenshots |
| WebGL off | flat posters (moon, arch, thali disc), height constant 9091 px (same as with WebGL: no layout shift) | `nogl_1440_*` |
| Reduced motion | pause hidden, still frames per station (hall and tandoor share one still), idle 0 scene fps, all text visible | `reduce_1440_*` |
| Pause motion | aria-pressed true + `motion-off`, constant label; 3 loads clicked at first draw: 0 scene frames/s, scene-only frames identical 1.5 s apart 6/6. **Page rAF callbacks while paused 287-294 per second** (S-2) | json pause |
| Context loss/restore | posters during loss (`is3d` removed), after restore brightness equal (35.4 -> 35.3, 36.3 -> 36.8, 59.0 -> 59.5); brass bowls and trim reflective again | `ctx_1_spice_lost.png`, `ctx_1_spice_restored.png` |
| **Claimed fix: gate walls** | VERIFIED: gate now stands in a wall with domes, teal lattice columns and string lights | `1440x900_00_gate.png` |
| **Claimed fix: header scrim** | VERIFIED: header has a dark backing at scroll 0; links and pause button readable over the gate | `1440x900_00_gate.png` |
| **Claimed fix: restore bright** | VERIFIED | above |
| bfcache (simulated) | scene renders after pagehide/pageshow persisted (49k draws on next scroll, 92% of pixels changed) | json bfsynth |
| Debug hooks | `window.__saffron`, `__saffronError`, `?q=`, `?scene=off`, test methods: all gone | json globals, grep |
| Content rules | placeholders only (incl. [Testimonial from a guest]); "Illustrative sample menu"; footer line present; no dead links | PASS |
| Time to first scene | first draw 0.8-1.1 s; scene ready (`is3d`) 4.4 s (1440), 5.2 s (1024), 3.5-3.8 s phones | json |

### FPS (1440x900, median / spread, 3 separate runs because of heavy GPU contention)
| station | run 1 uncapped | run 2 uncapped | run 3 default flags |
|---|---|---|---|
| gate | 88 / 9 | 102 / 12 | 43 / 14 |
| spice | 90 / 2 | 99 / 3 | 39 / 8 |
| hall | 85 / 2 | 90 / 15 | 43 / 3 |
| tandoor | 97 / 4 | 61 / 44 | 83 / 10 |
| menu (thali) | **51 / 4** | **46 / 3** | 99 / 6 |
| reserve | **54 / 5** | **42 / 10** | 88 / 8 |
Contention clearly moves whole runs; menu and reserve were the slowest stations, under 60, in 2 of 3 runs. Treat as a risk, not a proven defect (S-4).

### Defects
1. **S-1 high. Main thread blocked 3.7-4.2 s while the scene starts.** Long task 3658 ms (1440), 4150 ms (1024), 2.8-3.0 s on 390x844, 720x450, 390x667; it ends when `is3d` is added. Page cannot scroll or open the menu meanwhile. Repro: load at 1440, PerformanceObserver longtask. Same class as Sakura S-1 (synchronous program compile on first render).
2. **S-2 med. rAF keeps running while paused:** 287-294 callbacks/s in all 6 paused windows (GSAP ticker + Lenis), although the scene itself stops. Requirement: ~0. Repro: click Pause, count rAF for 2 s.
3. **S-3 med (visual, phones). Panels cover nearly the whole scene on phones.** At 390x667 the gate, spice, hall and tandoor panels fill ~75-80% of the screen and the 3D is a thin strip at the top; at 390x844 about 60%. The 3D journey is the selling point and is mostly hidden on a phone. `390x667_01_spice.png`, `390x844_00_gate.png`. 720x450 has the same problem (`720x450_00_gate.png`).
4. **S-4 low (perf risk).** Thali menu and reserve stations measured 42-54 fps uncapped in 2 of 3 runs while other stations ran 85-100 (shared GPU, see table).
6. **S-6 med. On the demo server the 3D scene is silently lost on about 2 of 5 loads.** Found later during repeat loads (`q3_flaky.py saffron-court 5`): loads 4 and 5 ended without `is3d` (posters only) because `python -m http.server` refused connections during the burst of addon module requests (`ERR_CONNECTION_REFUSED` on `three-addons/shaders/CopyShader.js`, `postprocessing/ShaderPass.js`, `MaskPass.js`, `OutputShader.js`). `start-demo.bat` uses this same server, so the client could see a poster-only site. Fallback itself is clean (no layout shift, no errors besides the failed requests). Sakura, Forno and Maison loaded 5/5 under the same conditions. Fix idea: retry the dynamic import / addon imports once after a short delay, or load addons sequentially as Maison does.
5. **S-5 low (visual).** At 1440 the arched hero panel is flush with the left edge of the window (its left border is cut at x=0) while the brand sits at x~105, so the panel looks misaligned. `1440x900_00_gate.png`.

### Visual notes
The richest scene of the five: domed gate with lanterns and diyas, a spinning floor mandala under orbiting brass spice bowls, a glowing arch tunnel for the market hall, a tandoor with sparks and skewers, a thali on a teal disc. Maroon, saffron and teal palette is distinctive and ornate without clutter. Typography (serif with italic saffron accents) is elegant but some body text in panels is small at 1440. The hall arches are the wow moment. Clearly different from the other four.

## 4. maison-claire: FAIL (1 high, 2 med)

Renderer: ANGLE (AMD Radeon 780M, Direct3D11). Screens: `screens-3d-r2/maison-claire/`.

### Results
| Check | Result | Evidence |
|---|---|---|
| Console / failed requests | 0 errors, 0 warnings, 0 failed, **0 external requests** (all 6 woff2 fonts from `assets/`) in all modes | json main.external |
| Horizontal scroll | none at all 5 viewports | json views |
| Skip link | Tab -> skip link, Enter -> `#main` | PASS |
| Nav links (1440 keyboard) | table, cloche, wine, menu, reserve focus their section (top at -1..0) | PASS |
| Mobile menu (390x844) | toggle 106x44 with visible text "Menu", aria-expanded, full-screen menu, Tab trapped, Escape closes + focus back to toggle, links close + focus target | PASS, `390x844_menu_open.png` |
| Wheel scroll, all stations | scene-only frames change 81-97% between stations (1440), 49-86% (390) | `1440x900_0*`, `390x844_0*` |
| Text over scene | all copy on solid dark panels or the ivory menu card; readable | screenshots |
| WebGL off | flat SVG posters (table from above, cloche), page usable; height 5070-5072 px during load (font swap only); a second traced load with scrolling also stayed at 5072 | `nogl_1440_*` |
| Reduced motion | pause hidden, stills per station, 0 scene fps idle, text visible | `reduce_1440_*` |
| Pause motion (clicked after load, harness) | aria-pressed true + `motion-off`; at a later station frames identical 3/3 | json pause |
| Pause motion (clicked AT first frame) | **scene keeps rendering and changing for 2.5-3.5 s after the click** (intro camera), then stops: 3 of 3 runs (M-2) | `q3_pausecheck.py` output below |
| rAF while paused | **228-433 callbacks/s** (Lenis + GSAP ticker; the scene loop itself stops) (M-3) | same |
| Context loss/restore | posters during loss (`is-3d` removed, `gl-able` kept so no layout change), after restore brightness equal (55.3 -> 54.7, 88.8 -> 89.4, 95.6 -> 97.1); silver and gold reflections back | `ctx_1_cloche_lost.png`, `ctx_1_cloche_restored.png` |
| **Claimed fix: hero panel contrast** | VERIFIED: hero now on a solid dark panel at 1440, 1024 and phones | `1440x900_00_table.png`, `1024x768_00_table.png` |
| **Claimed fix: page height identical before/after scene** | VERIFIED: `scrollHeight` 7892 px from the first sample (`gl-able` set by the head probe) through `is-3d` at 9.9 s | `q3_heights.py` trace |
| **Claimed fix: bfcache Back** | Real Back NOT TESTABLE headless (Playwright disables bfcache). Simulated `pagehide`/`pageshow` with `persisted:true`: scene keeps rendering (27k draws on next scroll, 98% of pixels changed). Code now ignores persisted pagehide and wakes on persisted pageshow | json bfsynth, `scene.js:757-758` |
| **Claimed fix: one loop per frame** | VERIFIED: the scene's `frame` callback ran exactly 1.00 times per browser frame before, during 5x and 12x CPU throttling (long enough to trip the adaptive guard) and after | `q3_loopcheck.py` |
| **Claimed fix: fonts local** | VERIFIED: no external request; `assets/CREDITS.txt`, `OFL-Cormorant-Garamond.txt`, `OFL-Jost.txt` present | json, `assets/` |
| Debug hooks | `window.__mc` and `?q=` gone | json globals |
| Content rules | placeholders only ([Price], [Wine list to be confirmed by the restaurant], contacts); "Illustrative sample"; footer line present | PASS (see M-5) |
| Time to first scene | first draw 0.6 s (1440), scene ready (`is-3d`) 4.6 s (1440), 4.0 s (1024), **7.6 s (390x844)**, 3.2-3.7 s (720x450, 390x667) | json |

Pause-at-first-frame trace (run 0): t=0.9 s draws 5535; 1.9 s 10287 CHANGED; 2.7 s 11691 CHANGED; 3.5 s onward 11691 same (no more draws), rAF +233..280 per 0.8 s.

### FPS (1440x900, uncapped, median / spread, shared GPU: very noisy here)
table 201 / 128, cloche 150 / 2, wine 126 / 79, menu 180 / 31, reserve 116 / 68. All windows above 82 fps.

### Defects
1. **M-1 high. Main thread blocked 2.9-6.3 s while the scene starts.** Long tasks: 4252 ms (1440), 3561 ms (1024), **6258 ms (390x844)**, 2856 ms (720x450), 3366 ms (390x667). The page cannot scroll or open the menu during that time. The warm-up "draw everything once" compiles all programs synchronously. Repro: load at 390x844 (dsf 2), PerformanceObserver longtask.
2. **M-2 med. Pause pressed right after the first frame does not stop the scene for 2.5-3.5 s.** The intro camera move keeps rendering (`frame()` re-queues while `intro > 0` even when paused); screenshots change twice after the click. Repro: `q3_pausecheck.py maison-claire`.
3. **M-3 med. rAF keeps running while paused** (Lenis loop `main.js:33-34` + GSAP ticker), 228-433 callbacks/s. Requirement: ~0.
4. **M-4 low (visual). Short landscape 720x450:** hero panel spans the full width and hides the table. `720x450_00_table.png`.
5. **M-5 low (content).** "Le poisson: Fish of the day" implies a daily offer (same class as Forno's "Dessert of the day" in the code review). `index.html` tasting menu III.

### Visual notes
The most refined of the five: candle-lit round table from above, gold charger plate, cloche lifting to reveal a plated dish with steam, a wine pour with a meniscus, ivory menu card. Cormorant + Jost, lots of air, wine-red buttons. High-class and calm, clearly different from the others. Cloche reveal is the wow moment. On phones the scene is visible above the panels; the cloche reads as a dark ball at 390 when backlit.

## 5. blue-pearl: FAIL (1 high, 2 med)

Renderer: ANGLE (AMD Radeon 780M, Direct3D11). Screens: `screens-3d-r2/blue-pearl/`.

### Results
| Check | Result | Evidence |
|---|---|---|
| Console / failed requests | 0 errors, 0 warnings in the harness runs; but see B-2 (refused module requests on repeat loads) | json, `q3_flaky.py` |
| Horizontal scroll | none at all 5 viewports | json views |
| Skip link | Tab -> skip link, Enter -> `#main` | PASS |
| Nav links (1440 keyboard) | dive, catch, menu, reserve focus their section (top at 84 px, below the floating nav); brand `#top` focuses `#main` | PASS |
| Mobile menu (390x844) | 44x44 toggle with sr text "Menu", aria-expanded, full-screen menu, Tab trapped, Escape closes + focus back to toggle, links close + focus target | PASS, `390x844_menu_open.png` |
| Wheel scroll, all stations | scene-only frames change 83-100% between stations (1440), 59-100% (390) | `1440x900_0*`, `390x844_0*` |
| Text over scene | dark glass panels; readable | screenshots |
| WebGL off | flat posters (light shafts, oyster with pearl, coral), `no-3d`, height constant 5934 px | `nogl_1440_*` |
| Reduced motion | pause hidden, stills per station, 0 scene fps idle, text visible | `reduce_1440_*` |
| Pause motion | aria-pressed true + `motion-off`; harness 3/3 identical at load and later. **Clicked at the very first frame (3 runs): 0 further draws and identical frames for 12-15 s from the first sample** | `q3_blue_pause.log` |
| rAF while paused | **384-470 callbacks/s** (3 loops: Lenis/GSAP ticker etc.; scene stopped) (B-3) | same |
| Context loss/restore (surface, dive, catch, reserve) | poster during loss (`scene-on` removed); after restore brightness equal (169.8 -> 170.4, 95.1 -> 97.2, 96.5 -> 96.4, reserve 88.3 -> 87.2); pearl glow and nacre back | `ctx_4_reserve_lost.png`, `ctx_4_reserve_restored.png` |
| **Claimed fix: fps far above 50-60 at dive/catch** | VERIFIED with noise: dive median 154 (spread 55), catch 83 (spread 5) | fps table |
| **Claimed fix: caustics look right** | VERIFIED: soft light web on the seabed, rocks and shells, no banding or tiling seams visible | `1440x900_02_catch_bg.png` |
| **Claimed fix: Reserve panel on 390x667 leaves oyster and pearl visible** | VERIFIED: open shell and pearl sit fully above the panel | `390x667_04_reserve.png` |
| **Claimed fix: pause stable after first load** | VERIFIED (see Pause row) | `q3_blue_pause.log` |
| bfcache (simulated) | renders after pagehide/pageshow persisted (14.5k draws, 100% pixels changed) | json bfsynth |
| Debug hooks | `?debug`, `?cam=`, `?off=`, `?q=`, `?noadapt`, `?webgl=off`, `window.__bp`: gone | json globals, grep |
| Content rules | placeholders only ([Price], [Today's catch list], [Allergen and dietary information], contacts, [Testimonial from a guest]); "illustrative sample menu"; freshness wording from the review is gone; footer line present | PASS (see B-5) |
| Time to first scene | first draw **3.2 s** (1440), 1.8 s (1024), 0.9-1.6 s phones; scene ready (`scene-on`) **9.5 s** (1440), 6.1 s (1024), 2.9-4.2 s phones | json |

### FPS (1440x900, uncapped, median / spread, shared GPU)
surface 102 / 60, dive 154 / 55, catch 83 / 5, menu 89 / 80, reserve 83 / 21. Every window >= 76 fps.

### Defects
1. **B-1 high. Main thread blocked up to 6.5 s while the scene starts.** Long tasks: 1015 ms + **6504 ms** (1440), 5153 ms (1024), 2.1-2.7 s (phones). At 1440 the scene appears only after 9.5 s and the page is frozen for most of that time. Repro: load at 1440, PerformanceObserver longtask.
2. **B-2 med. On the demo server the 3D scene is silently lost on about 1 in 3 loads.** 16 repeat loads (`q3_flaky.py blue-pearl`): 6 ended with `no-3d` because `python -m http.server` refused connections during the module burst (`ERR_CONNECTION_REFUSED` on `three-addons/shaders/LuminosityHighPassShader.js`, `FXAAShader.js`, `postprocessing/MaskPass.js`, `sites/blue-pearl/world.js`). The catch in `main.js:211-213` drops straight to the poster with no retry. Same root cause as Saffron S-6; Sakura, Forno and Maison loaded 5/5.
3. **B-3 med. rAF keeps running while paused:** 384-470 callbacks/s (the highest of the five). Requirement ~0.
4. **B-4 low (visual).** The dive station is sparse: a flat teal gradient with one small fish school and bubbles (scene-only frame has luma SD 11, the lowest of any station on any site). `1440x900_01_dive_bg.png`.
5. **B-5 low (content).** "Blue Pearl is built around that feeling: cold glass, long tables..." states details of an interior that does not exist; reword as a design intention or mark as sample.
6. **B-6 low (visual).** 720x450: the hero panel covers most of the surface scene. `720x450_00_surface.png`.

### Visual notes
Calm, glassy and clearly underwater: surface light bands, shafts, fish school, caustic seabed with kelp, coral and shells, and a big glowing oyster with a pearl for the reserve station (the wow moment). Teal glass panels with coral buttons are clean and premium. Fish and shells are simple low-poly shapes, acceptable within the stylised direction. Distinct from the other four (only cool-toned site) and from round 1.

## Hub (`showcase/index.html`, section "Round two · Restaurants in 3D")
- All 10 card links return 200 (5 round-1 + 5 restaurant sites); 0 console errors, 0 failed requests; no horizontal scroll at 390. Screens: `screens-3d-r2/sakura-omakase/hub_1440.png`, `hub_390.png`. PASS.
- Low: the page `<h1>` still reads "Five directions. One quality bar." although the hub now shows ten sites.

## Cross-site summary

| Site | Verdict | High | Med | Low | Main-thread block at load (1440) | Scene visible (1440) | Paused rAF/s |
|---|---|---|---|---|---|---|---|
| sakura-omakase | FAIL | 1 | 0 | 3 | 4.2-5.5 s | 6.3-7.1 s | **0** |
| forno-rosso | FAIL | 0 | 1 | 3 | 0.40 s (0.45-0.48 s at 1024 / 390) | 2.3 s | 286-296 |
| saffron-court | FAIL | 1 | 3 | 2 | 3.7 s (4.2 s at 1024) | 4.4 s | 287-294 |
| maison-claire | FAIL | 1 | 2 | 2 | 4.3 s (6.3 s at 390x844) | 4.6 s | 228-433 |
| blue-pearl | FAIL | 1 | 2 | 3 | 6.5 s | 9.5 s | 384-470 |

What is fixed (verified): every context restore is bright again (Sakura, Saffron, Blue Pearl env maps rebuilt); all debug globals and query switches are gone; Sakura tier on non-Chromium profile; Forno startup freeze (F1) and wording; Saffron gate walls and header scrim; Maison hero panel, stable page height, persisted pagehide handling, one render loop, local fonts with licences; Blue Pearl caustics, reserve framing on 390x667, pause at first frame, dive/catch fps. Zero console errors and zero horizontal scroll on all five at all five viewports; skip link, nav focus, mobile menu, WebGL-off posters and reduced motion pass everywhere.

Top open problems:
1. **Startup freeze on 4 of 5 sites (high).** Sakura, Saffron, Maison and Blue Pearl block the main thread for 3.7-6.5 s at 1440 (up to 6.3 s on a 390 phone profile) while shader programs compile on the first render. Forno, which uses `renderer.compileAsync` with `checkShaderErrors=false`, stays at ~0.4 s. Shared GPU can inflate numbers, but Forno measured under the same conditions shows the difference is real.
2. **3D silently lost on the demo server (med).** Saffron (2/5 loads) and Blue Pearl (6/16 loads) fall back to posters because `python -m http.server` refuses connections during their burst of addon module requests. The client demo uses this server (`start-demo.bat`).
3. **rAF not idle while paused (med) on 4 of 5.** Only Sakura sleeps the GSAP ticker and stops Lenis; the others keep 230-470 callbacks/s running.
4. **Maison: Pause pressed at first frame lets the intro run 2.5-3.5 s more (med).**
5. **Phones: Saffron panels hide ~75-80% of the scene at 390x667 (med visual);** all sites hide most of the scene at 720x450 (low).

Visual verdict: the five are clearly different from each other and from round 1 (night lacquer, bright clay, ornate maroon, quiet ivory, cool underwater). Maison and Saffron look the most high-class; Sakura is the most complete toy-world; Forno is friendly and bright but its mozzarella reads as marshmallows; Blue Pearl's dive station is sparse. No crude or broken 3D seen in any screenshot; text is readable over the scene everywhere.

Not tested: real bfcache Back navigation (disabled by Playwright; simulated instead), real Firefox/Safari engines (profile emulated in Chrome), touch-scroll gestures (wheel used at phone sizes), screen readers.

---
QA: EvidenceQA (studio-qa-tester), 2026-11-04. Screens: `showcase/qa/screens-3d-r2/`.
