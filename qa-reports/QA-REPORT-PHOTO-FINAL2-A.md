# QA report, photo round FINAL-2 (targeted fix round, part A): himal-chulo-photo, ember-and-oak-photo, flour-and-fig-photo

Tester: independent QA (EvidenceQA), 2026-11-04. Headless Chrome only (`channel='chrome'`, `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`), server `python showcase/serve.py 8898`, one site at a time, every browser closed after each test. Two other fixers (olive, jade) may share the GPU: timings are noisy; medians reported.
Harness: scratchpad `qa3_site.py` (= `qa2_site.py` on port 8898 plus `freeze` = long tasks from navigation and frame gaps while wheel-scrolling down and up for 30 s starting 2.5 s after 3D-on, and `reveal` = text opacity sampled every frame while sections scroll in). Screenshots: `showcase/qa/screens-photo-final2/<slug>/`. Predecessor: `qa/QA-REPORT-PHOTO-FINAL-A.md`.

## 1. himal-chulo-photo — PASS (the HIGH freeze is FIXED; on a quiet GPU startup matches the builder: median 348 ms, 2/10 loads at 430-441 ms)

Evidence: scratchpad `qa3_himal-chulo-photo.json`, `qa3_himal.log`; screenshots `screens-photo-final2/himal-chulo-photo/`. Other agents' Chrome processes were running (49 chrome.exe); fps at the vsync cap fell to 41-88 vs 103-128 last round, so GPU contention is certain during the first run. A second cold + fps run at the end of the session, when fps sat at the 145 cap (quiet GPU), is reported as "quiet" (`qa3_himal-chulo-photo.json`; first run kept in `qa3_himal-chulo-photo.run1.json`).

### Claims
| Claim (builder) | Measured | Verdict |
|---|---|---|
| HIGH freeze after 3D-on gone; longest task 184-371 ms (was 1.5-2.6 s) | `freeze` x4 (longtask observer from navigation, wheel down+up for 30 s from 2.5 s after 3D-on): longest task **after 3D-on 196 / 105 / 296 / 218 ms**; worst frame gap during the 30 s 213 / 105 / 196 / 230 ms. No task over 400 ms after 3D-on in any run | **CONFIRMED** |
| Startup longest task median 318 ms, 2/10 over 400 | 10 cold loads: 1615, 577, 955, 803, 897, 441, 490, 335, 256, 481 ms (median **534**, **8/10 over 400**); the 4 freeze loads: 560, 493, 290, 227 ms; main run 730; 390x844 1394. All before 3D-on (poster showing) Quiet re-run, 10 cold loads: 240, 353, 360, 360, **441**, 341, 344, 183, 344, **430** (median **348**, **2/10 over 400**) | **CONFIRMED on a quiet GPU** (median 348 vs claimed 318, same 2/10); under contention it balloons to 534 median / 1615 max |
| 3D-on 4.3-5.1 s | freeze loads 2.7 / 3.7 / 5.0 / 5.6 s; cold loop 6.1-14.2 s (median 8.2 s); bytes runs 3.1 s (desktop) / 3.3 s (phone) quiet re-run: 1.9-2.1 s (median 2.0 s) | **CONFIRMED, better than claimed on a quiet GPU** (2.0 s); acceptable: the poster shows at once and the page is usable, and 2-5 s for the 3D to arrive is fine for a showcase. Under contention 6-14 s, which is not, but that is the machine, not the site |
| Table, rice, momo, teapot better | `1440x900_02_table_bg.png`, `04_menu_bg.png`: table now has planks and a bevelled edge; momos have pleated tops in the steamer; rice is a lower mound with loose grains. Still: rice reads as white powder/flour, momos as glossy white meringues, the table is a dark box next to the weathered real bench | **CONFIRMED (partly better)** |
| Teapot rests on the table | `1440x900_02_table_bg.png` and `04_menu_bg.png`: pot sits on the table with a contact shadow. (At the tea station the pot is lifted to pour, handless, by design) | **CONFIRMED** |

### Basics
| Check | Result |
|---|---|
| Console / page errors | 0 in every run (main, 4 viewports, menus, nogl x2, reduce, pause x3, ctx, ctx2 x3, bytes x2, fps, freeze x4, cold x10); 0 failed requests |
| 3D on | every viewport; 10/10 cold + 4/4 freeze loads |
| Horizontal scroll | none (scrollWidth = clientWidth at 1440, 1024, 390x844, 390x667, 720x450, every station) |
| Skip / anchors | first Tab "Skip to content", Enter focuses `#main`; 6/6 nav anchors focus their section |
| Phone menu | 320x256: `#navMenu` scrolls inside itself (288/195), last link "Reserve" reached by Tab, 191-239 of 256, below the header (`320x256_menu_last.png`), page does not move; Escape returns focus to toggle. 390x667: menu fits, last link 284-332 |
| WebGL off | posters, height constant 9115 px, 0 draws, 0 errors (1440, 390) |
| Reduced motion | button hidden, idle 0 rAF/s; station frames differ |
| Pause x3 (paused at first draw) | 0 draws/s, 0 rAF/s, canvas identical at load and at a later station (meanDiff 0) 3/3; resume 56-123 fps |
| Context loss/restore | arrival, kitchen restored in the 3.5 s window (brightness 143.3→143.4, 116.9→117.0); table not yet in 3.5 s; timed re-test at table (`qa3_ctx2t.py`): restores in 3.7 / 2.7 / 2.4 s, 0 errors. Works, slow |
| Panoramas resident | desktop 179 + 101 MB + 22 MB shadow; phone 2 x 45 MB |
| Phone pixel ratio | 1.0 |
| Bytes (cache off) | page-session CDP count: desktop 1.52 MB at 3D-on, 10.24 MB after full scroll; phone 1.52 / 4.97 MB. **The panoramas are fetched by the decode worker and are not in that count** (no pano JPEG in the request list); adding the files actually requested: desktop + 3.66 (8k lookout) + 3.76 (6k room) = **~17.7 MB** (budget ~20, OK); phone + 0.96 + 1.74 = **~7.7 MB** (budget ~8, OK but tight). The predecessor's byte figures had the same blind spot |
| fps 1440 vsync, median of 3 (spread) | quiet: arrival 144.7, kitchen 145.0, table 145.0, tea 145.0, menu 145.0, reserve 144.7 (spread ≤ 2.3): at the cap everywhere. Contended first run: 41-88 |
| Content | placeholders only; no flagged claims; footer; one h1; no debug globals |

### Realism per station
| Station | Score | Where it breaks |
|---|---|---|
| arrival | 8 | real landscape; flags uniform CG but well shaded |
| kitchen | 9 | the photograph |
| table | 6 | better table and momos; rice still powder, dark box table beside a weathered real bench; phone: lower half empty rug, limes lie on the table without the carved plate |
| tea | 6 | pot pours with no hand; stream thin and even |
| menu | 6.5 | top-down food reads CG but tidier |
| reserve / footer | 7 | unchanged |

**Site realism: 6.5-7/10 (was 6.5).** Slightly better (table planks, momo pleats, pot grounded); not a step change.

### Remaining defects
1. **LOW** — startup longest task 430-441 ms in 2/10 quiet cold loads (median 348); under GPU contention 8/10 over 400 and up to 1615 ms.
2. **LOW** — phone bytes ~7.7 MB once worker-fetched panoramas are counted: close to the ~8 MB budget.
3. **LOW** — context restore 2.4-3.7 s at the table station.
4. **LOW (realism)** — powder rice, meringue momos, box table; handless pour; phone table frame half empty.

## 2. ember-and-oak-photo — PASS (no high defect; startup median now under 400 ms with 4/10 loads at 429-535 ms, borderline; the bar retouch removed the TVs and the fridge glow but left a purple spill, a tent card and obviously painted grey fridge blocks)

Evidence: scratchpad `qa3_ember-and-oak-photo.json`, `qa3_ember.log`; screenshots `screens-photo-final2/ember-and-oak-photo/` (stations `1440x900_*`, `390x844_*`, mid-dissolve `transit_*` and `t390_transit_*`, nav-jump frames `navjump_1440/`, `navjump_390/` with contact sheets `navjump_*_sheet.png`, crops `crop_board_right.png`, `crop_board_bottle.png`). fps sat at the 145 cap during this run, so the GPU was quieter than for himal.

### Claims
| Claim (builder) | Measured | Verdict |
|---|---|---|
| Retouched `warm_bar`: no TV screens | none in any station, transit, or nav-jump frame at 1440 or 390 (hero windows show a dark garden and string lights; the hatch in `transit_01_45_bg.png` shows a white fridge door, no screen) | **CONFIRMED** |
| no fridge glow | the glowing fridges are gone, but they were painted into flat grey slabs that still show ghost doors and racks behind the board (`1440x900_01_board_bg.png`, `transit_01_75_bg.png`, `390x844_01_board_bg.png`); plus a grey smudge at the right end of the counter | **CONFIRMED (glow), but the retouch itself is visible** |
| no QR card | a small white tent card still stands on the back counter, right (`crop_board_right.png`, x≈1360 y≈160 at 1440); too small to read a QR, but the card is there | **REJECTED (card remains)** |
| no purple spill | magenta/purple wash on the back counter top and pink on the right of the bar counter at 1440 (`crop_board_right.png`, `transit_01_75_bg.png`; visible in all four board frames of `navjump_1440_sheet.png`); not in frame at 390 | **REJECTED** |
| Startup longest task median 246, max 329, 0/10 over 400 | 10 cold loads: 535, 530, 262, 187, 297, 195, 429, 325, 366, 476 (median **346**, max **535**, **4/10 over 400**); main 464; 390x667 445 | **REJECTED** (big improvement over 291-1898, but not the claimed numbers) |
| Worst frame gap going back up 50-96 ms | `mem` 5 passes, up legs: **673, 320, 513, 139, 97 ms** (down legs 278, 549, 290, 243, 71) | **REJECTED** (only the 5th pass fits) |
| Context restore 0.9-2.5 s | `qa3_ctx2.py` at the hero: 1.72 / 0.94 / 0.94 s; harness ctx at fire, board, cellar all back within 3.5 s (brightness 84.3→84.6, 94.1→95.1, 36.2→36.2) | **CONFIRMED** |
| At most two panoramas resident | transit samples: 1 or 2 x 101 MB; mem passes: always 2 x 101 MB + 22 MB shadow; phone 25 + 45 MB | **CONFIRMED** |
| Bottle glass dark green | cellar bottle: near-black green, fine. Board bottle: **amber/brown translucent glass** (mean RGB of the glass ≈ 90/56/24, `crop_board_bottle.png`) with a bright white rim line; cellar bottle base has a glowing white ring (`1440x900_02_cellar_bg.png`) | **REJECTED for the board bottle** |
| Onions not under the text panel | 1440: onions at x≈130-290, panel starts at x≈830 (`1440x900_01_board.png`); 390: onions cut by the left edge, not under the panel | **CONFIRMED** |

### Basics
| Check | Result |
|---|---|
| Console / page errors | 0 everywhere (cold x10, main, transit x2, mem, 4 viewports, menus, nogl x2, reduce, pause x3, ctx, ctx2, bytes, fps, navjump x2, jump); 0 failed requests |
| 3D on | all viewports; 10/10 cold (3D-on 1.6-2.9 s, median 2.0 s) |
| Horizontal scroll | none |
| Skip / anchors | skip → `#main`; 5/5 anchors focus target (section top at -1..0) |
| Phone menu | 320x256 `#navMenu` scrolls (290/256), last link Tab-reachable at 200-244, page does not move, Escape returns focus; 390x667 fits |
| WebGL off | posters, height constant 4919 px, 0 draws, 0 errors (1440, 390) |
| Reduced motion | button hidden, 0 rAF/s idle |
| Pause x3 | 0 draws/s, 0 rAF/s; later frames identical (meanDiff 0); at load 0.11-0.26 meanDiff from the CSS canvas fade with 0 draws; resume 70-75 fps |
| Bytes | page-session count: desktop 1.53 MB at 3D-on, 7.34 MB total; phone 1.50 / 4.07 MB. The panoramas come through the worker and are not counted; adding them: desktop + bar 6k 3.18 + cellar 6k 3.65 + dinner 6k 1.82 = **~16.0 MB** (budget ~20, OK); phone + bar 4k 1.21 + cellar 3k 0.84 + dinner 6k 1.82 (no phone variant) = **~7.9 MB** (budget ~8: at the limit) |
| fps 1440 vsync (median, spread) | fire 145.0 (0.7), board 144.3 (1.0), cellar 139.3 (9.7), menu 145.3 (0.7), reserve 144.3 (11.3) |
| Content / globals | placeholders only; footer; one h1; no debug globals |

### Realism
| Station | Score | Where it breaks |
|---|---|---|
| fire | 8.5 | clean now: real hearth, no TV |
| board | 6 | painted grey fridge slabs with ghost racks, purple spill, grey smudge, amber bottle with a white rim; board still empty |
| cellar | 8 | real wall; bottle base glows white |
| menu | 9 | photograph |
| reserve / footer | 8 | as before |

**Site realism: 7.5/10 (was 7.5).** Hero better (no TV), board about the same (glow traded for a visible paint-out). Not better overall.

### Remaining defects
1. **MEDIUM-borderline** — startup tasks 429-535 ms in 4/10 cold loads (median 346).
2. **LOW (realism, explicit check)** — purple spill and tent card still in the board backdrop; painted fridge slabs read as retouching.
3. **LOW** — returning to the top: frame gaps 320-673 ms in 3 of 5 passes.
4. **LOW (realism)** — board bottle amber instead of dark green, with a white rim; white glowing ring at the cellar bottle base.

## 3. flour-and-fig-photo — FAIL (MEDIUM against the explicit ~20 MB desktop budget: ~22.9 MB with the two 8k panoramas; startup tasks still borderline, median 398 ms with 5/10 loads at 406-463 ms)

Evidence: scratchpad `qa3_flour-and-fig-photo.json`, `qa3_flour.log`, `qa3_revcon.py`; screenshots `screens-photo-final2/flour-and-fig-photo/` (stations, `reveal_<station>_<n>.png` frames taken during each reveal plus `_boxes.json`, `crop_390_legs.png`). GPU quiet in this run (fps at the 145 cap).

### Claims
| Claim (builder) | Measured | Verdict |
|---|---|---|
| Startup NOT fixed, median about 514 ms | 10 cold loads: 406, 463, 407, 311, 406, 389, 336, 374, 436, 387 (median **398**, max 463, **5/10 over 400**); main 366; 1024x768 623; 390x844 443; 720x450 419 | **CONFIRMED not fixed** (a bit better than the builder's own figure: overruns are small, 406-463, except 623 at 1024) |
| Text reveal has no opacity animation | `reveal` phase sampled cumulative opacity (element x all ancestors) of each section's text every frame while it scrolled in: 450-573 frames per station (pastry, cake, pour, menu, reserve); **the only value seen was 1.0**. Code: `main.js:172` `gsap.from(items, {y: 22, ...})`, no opacity. No CSS opacity transition on text (only canvas, loader, poster) | **CONFIRMED** |
| No text frame below 4.5:1 while revealing | Opacity stays 1 and the text sits on the `.panel` background (`rgba(251,247,240,.9)` + blur) during the 22 px slide, so contrast during the reveal equals the settled contrast; mid-slide frames such as `reveal_reserve_3.png` show dark text on the opaque panel. My pixel sampler (`qa3_revcon.py`) was not reliable on these boxes (it reports ~1:1 even on settled frames, because the `[data-rv]` boxes include whitespace and the panel edge), so no pixel-level number is claimed | **CONFIRMED by computed style; pixel contrast NOT measured** |
| Phone shadow rings and cross-hatch gone (390x844, 390x667) | `390x844_01_pastry_bg.png`, `390x667_01_pastry.png`, `390x844_05_reserve_bg.png`, `390x667_05_reserve.png`: no rings behind the cake, no cross-hatch on the table top | **CONFIRMED** |
| Table-leg shadow spots visible | `crop_390_legs.png`: only a faint soft darkening beside the legs where they meet the floor; no distinct contact spot. 1440 reserve looks the same | **PARTIAL (barely visible)** |
| No white table behind the board at pastry | `1440x900_01_pastry_bg.png`: plate and cup now stand on a brown CG table top; no white photo table visible | **CONFIRMED** |
| Pour and meniscus | `1440x900_03_pour_bg.png`: the tea surface now has concentric ripples where the stream lands and where it meets the cup wall (better). The stream is a thin, even, **silvery-white rod** that does not match the dark tea; the pot is still handless and its spout reads as a loop | **PARTIAL** |
| 8k dining photo sharper | `1440x900_04_menu_bg.png`: wicker weave, napkins and place settings are crisp; the halos around the chair backs are gone | **CONFIRMED** |
| Desktop total 22.86 MB (over 20) | page-session CDP count 13.51 MB + worker-fetched panoramas `studio_country_hall_8k.jpg` 4.49 + `bush_restaurant_8k.jpg` 4.87 = **~22.9 MB** | **CONFIRMED (over budget)** |
| 74 fps median at 1440 | vsync-capped, quiet GPU: 145.0 / 144.7 / 144.7 / 145.0 / 144.7 / 144.7 at the six stations (spread ≤ 0.7) | **REJECTED (it is better: at the cap)**; the builder's 74 was probably measured under contention |

**Is the 8k menu photo worth it?** The sharpness gain is real and visible, and it costs no frame rate here (two 8k textures resident at 179 MB each, still 145 fps). The cost is bytes: 4.87 MB vs 2.46 MB for the 6k, which together with the 8k morning hall puts desktop at ~22.9 MB. Keep the 8k menu photo, but get back under 20 MB somewhere else (for example the morning hall at 6k, or lighter prop textures: the carrot cake maps alone are 2.25 MB).

### Basics
| Check | Result |
|---|---|
| Console / page errors | 0 everywhere (cold x10, reveal, main, 4 viewports, menus, nogl x2, nogl2, reduce, pause x3, ctx, bytes, fps) |
| 3D on | all viewports; 10/10 cold (3D-on 2.5-3.5 s, median 2.6 s) |
| Horizontal scroll | none |
| Skip / anchors | skip → `#main`; 6/6 anchors focus target |
| Phone menu | 320x256 `#navMenu` scrolls (328/196), last link "Visit" Tab-reachable at 188-244, page does not move, Escape returns focus; 390x667 fits (last link 440-496) |
| WebGL off | `fell-back`, posters, height constant 9855 px, 0 draws, 0 errors (1440, 390) |
| WebGL2 forced off (`--disable-webgl2`) | `fell-back`, WebGL2 unavailable, posters, height constant 9855 px, 0 draws, **0 console messages**, 0 failed requests |
| Reduced motion | button hidden, 0 rAF/s idle |
| Pause x3 | 0 draws/s, 0 rAF/s; later frames identical (meanDiff 0); at load meanDiff 1.0-3.4 with 0 draws (CSS fade-in of the canvas); resume 145 fps |
| Context loss/restore | morning, pastry, cake back within 3.5 s (brightness 131.0→131.1, 135.1→134.5, 110.1→110.4) |
| Panoramas resident | desktop 2 x 179 MB (two 8k) + 22 MB shadow; phone 45 + 25 MB |
| Bytes | desktop ~22.9 MB (see above, **over ~20**); phone 5.63 MB counted + worker panoramas (country hall 4k 1.30 + bush 3k/4k 0.57-0.99) = **~7.5-7.9 MB** (budget ~8, OK but tight) |
| fps | 145 at every station (above) |
| Content / globals | placeholders only; footer; one h1; no debug globals |

### Realism
| Station | Score | Where it breaks |
|---|---|---|
| morning | 8 | real café room |
| pastry | 7.5 | seam gone; the croissant hovers slightly over the board edge on phones |
| cake | 8 | convincing |
| pour | 5.5 | ripples help; the silver rod of a stream and the handless pot do not |
| menu | 8.5 | now sharp |
| reserve | 8 (phone 7) | moiré gone; leg contact still faint |
| footer | 8 | as reserve |

**Site realism: 8/10 (was 7.5).** Better: the pastry seam, the phone moiré and the soft menu photo are fixed. The pour is still the weak frame.

### Remaining defects
1. **MEDIUM (explicit budget)** — desktop ~22.9 MB against ~20 MB.
2. **MEDIUM-borderline** — startup tasks 406-463 ms in 5/10 cold loads (median 398), 623 ms at 1024x768.
3. **LOW (realism)** — silver, even pour stream; handless pot.
4. **LOW** — table-leg contact shadows barely visible.
5. **LOW (QA gap)** — pixel contrast during the reveal not measured (computed opacity shows it does not change).

## Summary
| Site | Verdict | Realism (was) | Better? | Top remaining defect |
|---|---|---|---|---|
| himal-chulo-photo | **PASS** | 6.5-7 (6.5) | slightly | the HIGH freeze is fixed (longest task after 3D-on 105-296 ms, 4/4 runs). Left: powder rice, meringue momos, box table, handless pour; startup 2/10 at 430-441 ms on a quiet GPU |
| ember-and-oak-photo | **PASS** | 7.5 (7.5) | hero yes, board no | purple spill and a tent card still in the bar backdrop, and the fridges painted into visible grey slabs; up-leg frame gaps 320-673 ms (claimed 50-96); startup 4/10 at 429-535 ms (claimed 0/10); board bottle amber, not green |
| flour-and-fig-photo | **FAIL** (budget) | 8 (7.5) | yes | desktop ~22.9 MB over the ~20 MB budget (the two 8k panoramas); startup median 398 with 5/10 over 400 |

Measurement notes: (1) GPU contention was heavy in the first himal run (fps 41-88, 3D-on 6-14 s) and absent later (145 fps everywhere), so himal's startup and fps were re-measured on the quiet GPU. (2) Byte counts from the page CDP session miss the panoramas, which the decode worker fetches; every budget figure above adds the panorama files from disk (the predecessor's byte numbers under-counted in the same way). (3) Not tested: real phone GPUs, Safari/Firefox, pixel contrast during reveals.
