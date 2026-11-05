# QA report, photo round FINAL re-check (part A): himal-chulo-photo, ember-and-oak-photo, flour-and-fig-photo

Tester: independent QA (EvidenceQA), 2026-11-04. Headless Chrome only (`channel='chrome'`, `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`), server `python showcase/serve.py 8895`, one site at a time, every browser closed after each test. The GPU is shared with another QA agent: fps and timings are noisy; medians of 3 are reported.
Harness: scratchpad `qa2_site.py` (the predecessor's `qp_site.py` plus `hitch2` = long tasks over the first 60 wheel steps after an 8 s wait, 4 runs; `nogl2` = `--disable-webgl2`; `phonemem` = 390x844 DPR 3 texture residency and canvas pixel ratio). Screenshots: `showcase/qa/screens-photo-final/<slug>/`. Predecessor: `qa/QA-REPORT-PHOTO-A.md`.

## 1. himal-chulo-photo — FAIL (high: a 1.2-3.0 s main-thread freeze still happens a few seconds after 3D appears; it hits any visitor who scrolls in the first ~10 s)

Stations: arrival, kitchen, table, tea, menu, reserve, footer. Renderer ANGLE D3D11. Evidence: scratchpad `qa2_himal-chulo-photo.json`, `qa2_himal.log`, `qa2_lt_himal.log` (GL-call attribution), `qa2_anchor_himal.log`; screenshots `screens-photo-final/himal-chulo-photo/`.

### Predecessor defects
| # | Defect (QA-REPORT-PHOTO-A) | Status | Evidence |
|---|---|---|---|
| 1 | HIGH first-scroll freeze 0.6-1.8 s | **PARTIAL** | After an 8 s wait (4 runs) the first 60 wheel steps have longest tasks 117 / 83 / 83 / 105 ms and max frame gap 111-139 ms: fixed for that case. But the freeze moved, not vanished: in the same 4 runs the longest task *before* the scroll was **2693 / 2999 / 2761 / 2485 ms**, at 8.8-12.9 s after navigation, i.e. after `is-3d`. `qa2_lt.py` attributes it to phase-B shader linking: 4 consecutive `getProgramParameter` (LINK_STATUS) calls of 263-792 ms each in one task (3 runs: 1632, 2761, 1199 ms tasks). The memory run, which starts scrolling 2.5 s after 3D-on, caught a **2780 ms frame gap** on its first pass. So a visitor who scrolls in the first ~10 s still freezes for up to 3 s. |
| 2 | MEDIUM startup long tasks 672-1308 ms, 3D-on 3.2-4.3 s | **NOT FIXED** | 10 cold loads: 3D-on 3.35-7.96 s (median ~6.5 s; another agent shares the GPU, so time is inflated), longest task up to ready+0.8 s = 250-1127 ms (6/10 over 400). Main run: 3D-on 9.3 s, longest task 1186 ms. One cause found: one 8192x292 strip `texSubImage2D` of the dusk photo (row 584) took 1121 / 203 / 153 ms in 3 runs (behind the poster, but still a main-thread task over 400 ms). |
| 3 | MEDIUM flags pop instead of dissolving | **FIXED** | `transit_01_45_bg.png`: strings and garland are faint ghosts over the ceiling at mid-dissolve, gone by 60 %; no single-frame pop. Code: `scene.js:836` opacity follows the mix. The dissolve itself is still a long 50/50 double exposure (mountains through the curtain). |
| 4 | LOW CG food and glossy table | **PARTIAL** | Lid now sits on the steamer and the table is darker and matte. Still CG: the rice is a grey, sand-like cone with sprinkled grains, the momos read as white meringues, the table is a uniform dark-brown box with crisp edges next to the photo's weathered grey-brown bench (`1440x900_02_table_bg.png`, `1440x900_04_menu_bg.png`). |
| 5 | LOW no contact shadows on phone | **FIXED** | `390x844_02_table_bg.png`: limes have small soft contact shadows on the table; the table casts a soft dark blob on the rug. |
| 6 | LOW exit sign visible | **FIXED** | Not visible in `1440x900_01_kitchen_bg.png` or `transit_01_60_bg.png`; CREDITS says it was cloned out. |
| 7 | LOW warm-run longest task 412 ms | **NOT FIXED** | see 1 and 2. |

### Basics
| Check | Result |
|---|---|
| Console / page errors | 0 in every run (1440, 1024x768, 390x844, 390x667, 720x450, 320x256, nogl, reduce, pause x3, ctx, transit, mem, bytes, fps, 10 cold); 0 failed requests; only external URL is the decode worker's `blob:` |
| 3D on | yes at every viewport; 10/10 cold loads |
| Horizontal scroll | none at any viewport or station |
| Skip link / anchors | first Tab = "Skip to content", Enter focuses `#main`; 6/6 nav anchors focus their section; after each anchor the section heading sits below the header and inside the viewport at 1440, 390x844, 390x667 |
| Phone menu | 390x844: trap cycles, Escape closes and returns focus, 5/5 links close and focus target. 320x256: `#navMenu` scrolls inside itself (296/195 px), last link "Reserve" reached by Tab and fully visible below the header (`320x256_menu_last.png`), page does not move |
| WebGL off | posters, height constant 9115 px, 0 draws, 0 errors (1440 and 390) |
| Reduced motion | button hidden, idle 0 rAF/s and 0 draws/s, still frames differ per station |
| Pause (3 loads, paused at first draw) | 0 draws/s, 0 rAF/s, canvas identical 1.5 s apart at load and at a later station (meanDiff 0) in 3/3; resume: 87-120 fps, wheel scroll moves, `#reserve` anchor focuses target |
| Context loss/restore (arrival, kitchen, table) | `is-3d` back; brightness 143.3→143.4, 116.9→117.0, 72.0→72.1; 0 errors |
| Panoramas resident | desktop: 2 (179 MB dusk 8k + 101 MB room 6k) + 22 MB shadow map, constant over 5 down/up passes; phone 390 DPR 3: 2 x 45 MB (4k) at every station |
| Phone pixel ratio | canvas 1.0 at 390x844 DPR 2 and DPR 3 |
| Bytes (cache off) | desktop 1.51 MB at 3D-on, 10.24 MB after full scroll (budget ~20); phone 1.51 / 4.96 MB (budget ~8) |
| fps 1440 vsync (median of 3, spread) | arrival 128.3 (8), kitchen 118.7 (35), table 103.0 (40), tea 115.7 (38), menu 126.7 (25), reserve 113.7 (38). Large spreads = GPU contention likely |
| Later frame gaps | mem passes 2-5: max 42-452 ms (several 300-450 ms gaps in passes 4-5, contention likely) |
| Content | placeholders only ([Price], [Allergen and dietary information], [Reservation link], [Your phone number], [Street address], [Opening hours], [Testimonial from a guest]); no flagged claims; footer line present; one h1; no dead links |
| Credits | 2 panoramas + 6 models, matches what is requested; procedural items listed |
| Debug globals | none (GSAP/Lenis/three only) |

### Realism per station (1440 / phone)
| Station | Score | Where the illusion breaks |
|---|---|---|
| arrival | 8 | Real dusk landscape. Flags are clean, evenly saturated and identical in size; they read as added CG but are shaded well. |
| kitchen | 9 | The photograph itself; passes as a real room. |
| table | 5 | Grey sand-cone rice, meringue momos, a box table that does not match the weathered bench beside it; on the phone the lower half of the frame is empty rug. |
| tea | 6 | Real-looking tea set, but the pot hovers with no hand and the stream is a solid rod of constant width. |
| menu (top-down) | 6 | Rug and tiles are photographic; the food reads as CG from above. |
| reserve | 7 | Real fireplace room; the brass diya lantern is convincing; the CG table's front edge is a flat red-brown slab. |
| footer | 7 | as reserve |

**Site realism: 6.5/10** (was 6). Better than before: flags fade, the exit sign is gone, the lid sits down, phone shadows exist. The food and the table still give it away at the three prop stations.

### Remaining defects
1. **HIGH** — 1.2-3.0 s main-thread freeze from phase-B shader linking a few seconds after 3D appears (4/4 runs; 2.78 s frame gap when scrolling 2.5 s after 3D-on). Brief: no task over about 400 ms. The first-scroll freeze is only gone if the visitor waits ~10 s.
2. **MEDIUM** — startup longest task 250-1127 ms (6/10 cold loads over 400 ms), including a 1121 ms strip upload; 3D-on 3.4-8.0 s on a shared GPU.
3. **LOW (realism)** — rice, momos and the box table still look CG (stations table, menu).
4. **LOW (realism)** — handless pour with a constant-width stream (tea).

## 2. ember-and-oak-photo — FAIL (medium against an explicit budget rule: startup main-thread tasks up to 1.9 s; plus TV screens still visible in the new bar photo)

Stations: fire, board, cellar, menu, reserve, footer. Panoramas now: `warm_bar` (painted copy, 8k/4k) for fire + board, cellar (6k/3k), reception dinner (6k). Evidence: scratchpad `qa2_ember-and-oak-photo.json`, `qa2_ember.log`, `qa2_lt_ember.log`, `qa2_anchor_ember.log`, `qa2_pano.py` output (task `bsrwjxfhq`), `qa2_ctx2.py`, `qa2_jump.py`; screenshots `screens-photo-final/ember-and-oak-photo/`.

### Predecessor defects
| # | Defect | Status | Evidence |
|---|---|---|---|
| 1 | MEDIUM 3 panoramas resident | **FIXED** | `qa2_pano.py` (texStorage2D/texImage2D/deleteTexture hooks, 5 x bottom-and-back): after every one of the 10 legs exactly 2 panorama textures are live (6144x3072 + 6144x3072, or 6144x3072 + 8192x4096; the third live texture is a 2048² non-panorama). Harness `mem` (5 passes) and `transit` samples: always 2 panoramas (101+101 or 101+179 MB) + 22 MB shadow map; the old one is deleted ~1.9 s after the new one is stored. Phone: 1 x 45 MB at the fire station. Cost: returning to the top re-uploads the 8k photo (frame gaps 529 / 987 ms on the up legs in passes 2 and 5; JS heap swings 89→271 MB while strips are in flight). |
| 2 | MEDIUM floating bottle at reserve | **FIXED** | `1440x900_04_reserve_bg.png`: both bottles stand on the barrel top with contact shadows. |
| 3 | MEDIUM living-room fire photo | **PARTIAL** | Replaced by `warm_bar` (brick walls, benches, a real hearth): reads as a pub/restaurant now. But **TV screens are still visible through the interior windows**: purple/green screen in the left window of the hero (`jump_fresh_top_bg.png`, x≈500 y≈280) and two screens through the bar hatch while panning to the board (`transit_01_45_bg.png`, top left and top right). The board backdrop is bright drinks fridges with colourful packaging and a white card with a QR code on the counter (`1440x900_01_board_bg.png`, right), plus a purple light spill on the counter: convenience-store clutter. |
| 4 | MEDIUM fire is a glowing blob | **FIXED** | The hero fire is now the photograph's own fire behind a mesh screen, with logs and flames visible (`jump_fresh_top_bg.png`, `390x844_00_fire_bg.png`); the shader only breathes the photo's fire pixels; no cartoon flames. |
| 5 | LOW CG box table | **FIXED** | No CG table: board, onion and bottle stand on the photographed bar counter (`1440x900_01_board_bg.png`, `390x844_01_board_bg.png`). Cellar bottle shadow now starts at its base (`1440x900_02_cellar_bg.png`). |
| 6 | LOW cold-start long tasks | **NOT FIXED (worse on a shared GPU)** | 10 cold loads: longest task 291-1898 ms (7/10 over 400 ms: 481, 867, 1027, 1144, 565, 519, 1898); 3D-on 2.9-10.9 s (predecessor median 1.8 s; heavy GPU contention likely). Startup longest task before the 8 s mark in the 4 hitch runs: 643-1031 ms. `qa2_lt` attributes the 235-325 ms tasks to one 8192-wide strip upload; the larger ones are not single GL calls (likely decode/compile on a busy GPU). |
| 7 | LOW sharpness mismatch at reserve | **FIXED** | 6k reception photo: door planks and stonework are crisp next to the barrel. |

### Basics
| Check | Result |
|---|---|
| Console / page errors | 0 everywhere (all viewports, nogl, reduce, pause x3, ctx, ctx2 x3, transit, mem, bytes, fps, 10 cold, jump, pano); 0 failed requests; only `blob:` worker URL |
| 3D on | every viewport, 10/10 cold loads |
| Horizontal scroll | none |
| Skip / anchors | skip → `#main`; 5/5 anchors focus target; heading below the header and in view at 1440, 390x844, 390x667 |
| Phone menu | 390x844 trap + Escape returns focus, 4/4 links; 320x256 `#navMenu` scrolls (290/256), last link reached by Tab and visible, page does not move |
| First scroll after 8 s (4 runs) | longest task 65-194 ms, but frame gaps 292-587 ms with no long task (GPU-side stalls, contention possible) |
| WebGL off | posters, height constant 4919 px, 0 errors (1440, 390) |
| Reduced motion | button hidden, 0 rAF/s idle |
| Pause (3 loads) | 0 draws/s, 0 rAF/s; later frames identical (meanDiff 0); right after load 0.04-0.28 meanDiff from the CSS fade of the canvas, 0 draws; resume 87-140 fps, wheel and `#reserve` anchor work |
| Context loss/restore | restores in 3.2 / 3.25 / 3.8 s (3 rounds at the fire station, `ctx2_restored_*.png`); the harness's 3.5 s window caught 2/3 stations still restoring (re-fetch and re-upload of the 8k photo). Slow but works; 0 errors |
| Phone pixel ratio | canvas 1.0 at DPR 2 and 3 |
| Bytes (cache off) | desktop 1.50 MB at 3D-on, 7.34 MB total; phone 1.62 / 4.07 MB |
| fps 1440 vsync (median, spread) | fire 142.7 (1), board 116.7 (33), cellar 85.3 (9), menu 111.3 (8), reserve 92.3 (19) |
| Content / credits / globals | placeholders only (incl. [Wine list to be confirmed by the restaurant]); footer present; credits list warm_bar (with the paint-outs declared), cellar, dinner and 4 models; no debug globals |
| Anchor-jump state | `1440x900_00_fire_bg.png` (main run, after keyboard anchors then scroll to top) caught a bar/dinner double exposure; a clean re-test (`jump_back_top_0.5s/2s/4s/8s_bg.png`) shows the correct hero at 0.5 s. Not reproducible: not counted as a defect |

### Realism per station
| Station | Score | Where the illusion breaks |
|---|---|---|
| fire | 8 | A real hearth room with a real fire; a TV glows through the left window. |
| board | 6 | Real bar counter and real scans, but the back is bright drinks fridges, a QR card and a purple spill; the board is empty. |
| cellar | 8 | Real stone wall and window; barrels and bottle sit correctly. |
| menu | 9 | The reception dining room photograph. |
| reserve | 8 | Real room, barrel and bottles grounded. |
| footer | 8 | as reserve |

**Site realism: 7.5/10** (was 5). Clearly better: the living room, the glowing blob, the box table and the floating bottle are all gone.

### Remaining defects
1. **MEDIUM** — startup main-thread tasks over 400 ms in 7/10 cold loads (up to 1898 ms) against "no main-thread task over about 400 ms" (GPU shared; retest on a quiet GPU before ruling).
2. **LOW (realism, explicit check)** — TV screens still visible through the bar's interior windows (hero and the pan to the board); drinks fridges and a QR card behind the board.
3. **LOW** — returning to the top re-uploads the 8k photo: 0.5-1.0 s frame gaps and a ~3.5 s context restore; JS heap peaks ~270 MB during the strip upload.
4. **LOW** — first-scroll frame gaps of 292-587 ms without a long task (likely GPU contention).

## 3. flour-and-fig-photo — PASS (no high defect; remaining items are low, plus one borderline medium on startup tasks that needs a quiet-GPU retest)

Stations: morning, pastry, cake, pour, menu, reserve, footer. Reduced phase set for time (no keyboard-menu trap, resume or 5-pass memory run; the 3 pauses each test resume). Evidence: scratchpad `qa2_flour-and-fig-photo.json`, `qa2_flour.log`, `qa2_lt_flour.log`, `qa2_anchor_flour.log`; screenshots `screens-photo-final/flour-and-fig-photo/`.

### Predecessor defects
| # | Defect | Status | Evidence |
|---|---|---|---|
| 1 | MEDIUM no contact shadows on phones | **PARTIAL (props fixed)** | 390x844: the croissant casts a soft shadow on the board and the board, cake plate and cup have shadows on the table (`390x844_01_pastry_bg.png`, `390x844_05_reserve_bg.png`). Still missing: no contact darkening where the table legs meet the floor at reserve, and the phone shadow map shows **moiré/acne**: concentric rings on the table behind the cake (`390x844_01_pastry_bg.png`, right) and a fine cross-hatch on the reserve table top. |
| 2 | MEDIUM startup long tasks | **PARTIAL** | First scroll after 8 s: longest task 0 / 0 / 0 / 58 ms, frame gaps ≤ 97 ms (best of the three). Startup: `qa2_lt` shows a 428-447 ms task at ~230 ms in 3/3 runs (before any GL call: script/module evaluation), strip uploads 79-209 ms. 10 cold loads: longest 220-815 ms (6/10 over 400); 390x844 load 1013 ms. 3D-on 3.4-12.8 s in the cold loop vs 2.6 s (desktop) and 1.4 s (phone) in the bytes runs: GPU contention from the other agent is very likely. |
| 3 | LOW CG table meets the photo's white table; flat cake plate; lemons | **PARTIAL** | Cake plate is now a plain glazed white plate (plausible). Lemons gone. At pastry the brown board/table still sits in front of the photo's white painted table, and the plate and cup visibly stand on the white photo table behind it (`1440x900_01_pastry_bg.png`): the composite seam remains. |
| 4 | LOW staged pour | **NOT FIXED** | The handless pot remains and the stream is now a wavy ribbon with jagged edges; the tea surface is a flat disc (`1440x900_03_pour_bg.png`). Still the most CG frame of the site. |
| 5 | LOW soft / pixelated panoramas | **PARTIAL** | Desktop menu (bush_restaurant 6k) is still soft with halos around the chair backs (`1440x900_04_menu_bg.png`); phone reserve brick wall is acceptable at 3k (`390x844_05_reserve_bg.png`). |
| 6 | LOW phone 8.44 MB | **FIXED** | phone 2.89 MB at 3D-on, 5.62 MB total; desktop 2.00 / 13.50 MB. |
| — | WebGL2 forced off (`--disable-webgl2`) | **PASS** | class `fell-back`, posters (`nogl2_1440_top.png`), height constant 9855 px, 0 draws, **0 console messages**, 0 failed requests. |

### Basics
| Check | Result |
|---|---|
| Console / page errors | 0 in every run (1440, 1024x768, 390x844, 390x667, 720x450, 320x256, nogl, nogl2, reduce, pause x3, ctx, transit, bytes, fps, 10 cold, lt, anchors) |
| 3D on | every viewport; 10/10 cold loads |
| Horizontal scroll | none |
| Skip / anchors | skip → `#main`; 6/6 anchors focus target; heading below the header and in view at 1440, 390x844, 390x667 |
| Phone menu 320x256 | `#navMenu` scrolls (328/196), last link "Visit" reached by Tab and fully visible (188-244 of 256), page does not move; 390x667 last link visible |
| WebGL off | posters, height constant 5467 px, 0 errors (1440, 390) |
| Reduced motion | button hidden, 0 rAF/s idle |
| Pause (3 loads) | 0 draws/s, 0 rAF/s; later frames identical (meanDiff 0); at load meanDiff 1.05 with 0 draws (CSS fade-in of the canvas); resume 140-146 fps |
| Context loss/restore | `is-3d` back at morning, pastry, cake; brightness 132.6→132.7, 139.1→138.6, 115.7→115.3 (remaining diff = idle camera drift); 0 errors |
| Panoramas resident | desktop 2 (179 + 101 MB) + 22 MB shadow map at every transit sample; phone 2 (45 + 25 MB) at every station |
| Phone pixel ratio | canvas 1.0 at DPR 2 and 3 |
| fps 1440 vsync (median, spread) | 145.0 / 143.7 / 144.7 / 145.0 / 145.0 / 143.3: at the display cap everywhere (reserve fixed: was 75.7) |
| Content / credits / globals | placeholders only ([Your cake list], [Coffee and tea list to be confirmed], [Price], ...); footer present; credits list both panoramas, 6 models and the procedural items, and note the unused 8k/4k bush files in the folder; no debug globals |

### Realism per station
| Station | Score | Where the illusion breaks |
|---|---|---|
| morning | 8 | Real café room; scans on the table read as photographed; the table is a little too dark and saturated for the bright room. |
| pastry | 7 | Excellent croissant and tea set; the brown board in front of the white photo table is a visible composite. |
| cake | 8 | Scanned cake on a plain plate; convincing. |
| pour | 5 | Handless pot and a wavy CG ribbon of tea. |
| menu | 7 | Real terrace photograph, but soft. |
| reserve | 8 (phone 6) | Desktop convincing; phone: moiré on the table, no floor contact under the legs. |
| footer | 8 | as reserve |

**Site realism: 7.5/10** (was 7). Better: smooth frame rate, phone budget met, phone props shadowed, plate fixed. Not dramatically better: the pour and the pastry seam remain.

### Remaining defects
1. **MEDIUM (borderline, retest on a quiet GPU)** — startup longest task 220-815 ms in cold loads (6/10 over 400 ms), a consistent ~440 ms script-evaluation task at ~230 ms.
2. **LOW (realism)** — handless pour with a jagged ribbon stream.
3. **LOW (realism)** — pastry composite seam with the photo's white table.
4. **LOW (phone)** — shadow moiré/acne rings on the table; no contact shadow where the table legs meet the floor.
5. **LOW** — bush_restaurant menu frame soft at 1440.

## Summary
| Site | Verdict | Realism (was) | Clearly better? | Top remaining defect |
|---|---|---|---|---|
| himal-chulo-photo | **FAIL** | 6.5 (6) | Somewhat: flags fade, exit sign gone, phone shadows | HIGH: 1.2-3.0 s shader-link freeze a few seconds after 3D appears (scrolling 2.5 s after 3D-on hit a 2.78 s gap); food and table still CG |
| ember-and-oak-photo | **FAIL** (medium, budget) | 7.5 (5) | Yes, the most improved: real fire, real bar counter, no floating bottle, max 2 panoramas | MEDIUM: cold-start tasks up to 1.9 s (shared GPU); TV screens still visible through the bar windows |
| flour-and-fig-photo | **PASS** | 7.5 (7) | Modestly | MEDIUM borderline startup tasks; LOW: pour, pastry seam, phone shadow moiré |

All three pass the functional gates again: 0 console/page errors, 3D on in 10/10 cold loads, no horizontal scroll, skip link and anchors (headings clear of the header), phone menu at 320x256, posters with stable height when WebGL (or WebGL2) is off, reduced motion 0 rAF, pause 0 rAF with identical frames, context restore, phone pixel ratio 1.0, at most two panoramas resident, bytes within budget, content rules, credits, no debug globals.
Caveats: another QA agent shared the GPU throughout; 3D-on times in the cold loops (3-13 s) are far slower than in the bytes runs (1.4-2.8 s), so timings are inflated and fps spreads are wide. Long-task attributions come from wrapping GL calls (`qa2_lt.py`). Not tested: real phone GPUs, Safari/Firefox, contrast.
