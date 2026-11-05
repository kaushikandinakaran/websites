# QA report, photo round FINAL re-check (B): olive-and-sea-photo and jade-teahouse-photo

Tester: independent QA agent (EvidenceQA), 2026-11-04. Playwright headless Chrome (`channel='chrome'`, `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`), served by `python showcase/serve.py 8896`. One site at a time. Screenshots: `showcase/qa/screens-photo-final/<slug>/`. Scripts `qb2_*.py` in the session scratchpad. The GPU is shared with another QA agent: fps and timings are medians of 3 and noisy.

Predecessor: `qa/QA-REPORT-PHOTO-B.md` (olive 6/10 desktop, 4/10 phone; jade 5.5/10 desktop, 4/10 phone) and `qa/CODE-REVIEW-PHOTO.md`.

(Sections are written as each site finishes.)

## 1. olive-and-sea-photo: FAIL (1 high, plus medium defects against explicit rules)

GPU: AMD Radeon 780M (D3D11 ANGLE), shared with another QA agent during every run. Scripts: `qb2_basic.py`, `qb2_focus.py`, `qb2_modes.py`, `qb2_race.py`, `qb2_race2.py`, `qb2_jump.py`, `qb2_duskosc.py`, `qb2_cold.py`, `qb2_perf.py`. Screens: `qa/screens-photo-final/olive-and-sea-photo/` (`st<i>-<id>-<vp>.png` for all 6 stations at 5 viewports, `race/`, `jump/`, `dissolve-*`, `ctx-*`, `rm-*`, `nogl-*`, `menu-open-*`).

### Predecessor defects
| # | Defect (QA-B / code review) | Status | Evidence |
|---|---|---|---|
| CR1 high | Black sky after a drop or context loss during a first load | **FIXED for the black sky; new related high defect (new 1)** | `qb2_race.py`: 6 scroll races (dwell 50-2000 ms past dusk, 3 reps each) and 5 context loss/restore runs during the third photo's load (delays 0.05/0.2/0.5/1.0/1.5 s): dark-pixel share 0.000 in every check at stations 2,3,4,5,3; never a black sky. But `race/ctx50-st2.png` shows the kitchen station rendering the Venice photo (no deck, no table) |
| QA2 / CR2 med | Re-decode stall on every pass through dusk | **PARTIAL** | Inside the dusk hold (12 small back-and-forth passes, `qb2_duskosc`): 0 long tasks in all 12, worst frame 21-83 ms in 10 of 12 (two passes 425/215 ms with no long task: GPU contention likely). Full passes station 1 <-> 4 (12 passes): longest task per pass 122, 390, 57, 142, 157, 258, 160, 75, 84, 384, 218, 0 ms (median ~150; was 188-327); worst frame per pass 112-528 ms (median ~340), 1-10 frames over 50 ms per pass. The swap still costs visible hitches on every full pass. JS heap flat 12-15 MB, GPU adapter memory 4.1-5.0 GB, no trend |
| QA1 med | Dusk camera shows the Venice dome and campanile | **PARTIAL (still visible in 4 situations)** | Resting dusk frame clean at all 5 viewports (`st3-dusk-*.png`). Still visible: (a) dusk-to-menu dissolve `dissolve-3to4-045.png` (campanile + Salute dome, upper right); (b) the menu station after a nav jump until the third photo arrives: `jump/r0-1440x900-1200.png`, `r1-1440x900-1200.png` (campanile, dome, the promenade with people), gone by 3 s; (c) dusk poster for loading / context loss / WebGL off: `assets/poster-water.jpg`, `nogl-1440x900-st3.png`; (d) reduced motion at the menu before the third photo loads: `rm-1440x900-st4.png` |
| QA7 low | Power socket and beer bottles | **PARTIAL** | Socket painted out of the 6k/4k photos (`st0-arrival-1440x900.png` clean) but still on `assets/poster-deck.jpg` (loading state of every visit, WebGL off). Beer bottles and glass still in the photo, fully visible mid kitchen-to-dusk dissolve: `dissolve-2to3-045.png` |
| QA3 med | Kitchen CG table reads as CG | **MOSTLY FIXED** | `st2-kitchen-1440x900.png`: table now weathered grey like the deck furniture, matte lemons with contact shading. Remaining: slat gaps flat bright grey, edges crisper than the photo |
| QA4 med | Phone props | **NOT FIXED** | `st2-kitchen-390x844.png`: table fills the frame, lemons cut off at the right edge (two partial lemons, the station's subject is lost), soft upscaled texture. `st3-dusk-390x844.png`: no shadow under the table on the quay, flat front-lit grey jug |
| QA5 low | Startup task over 400 ms | **PARTIAL** | 10 cold loads (fresh browser each): longest task median 368 ms, max 464; over 400 in 2/10 (423, 464), at 300-560 ms before the first draw. 3D on median 2127 ms, range 1578-4665; 10/10 3D, 0 errors |
| QA6 low | Bytes | **FIXED** | Desktop 14.0 MB total (51 requests), 12.6 MB after 15 s idle. Phone (390x844, dsf 3) 7.93 MB, inside 8 MB |
| QA8 low | Double-exposure dissolves | NOT FIXED | `dissolve-2to3-045.png` ghost chairs and table; `dissolve-3to4-045.png` ghost jug and vase |
| QA9 low | Dusk props front-lit | NOT FIXED | `st3-dusk-1440x900.png`: sun low behind, jug and vase lit grey on the camera side |

### Basics (this run)
| Check | Result |
|---|---|
| Console / page errors | 0 at 1440, 1024, 390x844, 390x667, 720x450 and in every other run |
| 3D | `is-3d` at all five |
| Horizontal scroll | none at any viewport or station |
| Skip link, nav anchors | first Tab = "Skip to content", Enter -> `main`; all 5 anchors focus their section (top -1..0 px); "Back to the top" -> `arrival` |
| Phone menu | 390x667 / 390x844 / 320x256: opens, `main` inert; at 320x256 scrollHeight 368 > 188, scrolls inside itself (24 -> 180, page fixed); every tabbed item on screen and hit-testable (none under the header); Reserve reachable; Escape -> toggle; menu link focuses `#menu` |
| WebGL off | posters, no errors, height stable 5815 -> 5815 (1440), 5917 -> 5917 (390). Posters show the socket and Venice landmarks |
| Reduced motion | idle rAF 0.0/s at every station at 1440 and 390, button hidden |
| Pause right after load, 3 runs | `aria-pressed=true`; rAF 0.0-0.5/s while paused (a single wake frame when a photo arrives), frames identical (diff 0); resume restores scroll and `#dusk` anchor (-1 px) |
| Context loss / restore (late, stations 0 and 2) | `gl-lost`, then restored frame identical (diff 0) |
| fps at 1440 (median of 3) | 143.4, 140.4, 143.9, 142.9, 138.6, 84.3 (reserve; spread 22, contention likely) |
| Content | placeholders only, "Illustrative" labels, footer line present; 3 panoramas and 5 models requested, all in `assets/CREDITS.txt`; no `window.__*`, no `console.*`. `env-*-pmrem256.hdr` ship unused (not requested) |

### Remaining defects
1. **High (context restore).** A context loss in the first seconds (while the idle prop loader runs) breaks the journey for the rest of the visit. `qb2_race2.py`: lose context 300 or 1500 ms after `is-3d`, restore, scroll: the menu station shows the Venice photo with campanile, dome and promenade even after 9 s (`race/early300-st4-2.png`); back at the top the hero shows Venice instead of the deck (`race/early300-st0-4.png`, `race/early1500-st0-4.png`); the kitchen has no table. At 4000 ms it recovers (`race/early4000-st0-4.png`). Cause (`scene.js:476-495`): the prop loader returns on `if (lost) return;` and never resumes, so `propsStarted` stays false and `updatePair()` (`:279`) never reloads a dropped photo.
2. **Medium (content rule).** Venice landmarks still reach the screen: dusk-to-menu dissolve, menu after a nav jump (1-3 s), reduced motion, dusk poster (loading, context loss, WebGL off).
3. **Medium (realism, phones).** Kitchen framing on phones loses the lemons; no shadows on the phone tier.
4. **Medium (performance, partial).** Full passes across dusk still hitch (worst frames 112-528 ms; longest tasks up to 390 ms).
5. **Low.** Beer bottles visible mid-dissolve; socket still on `poster-deck.jpg`.
6. **Low.** Startup task over 400 ms in 2 of 10 cold loads; one cold load 4.7 s to 3D.
7. **Low.** Double-exposure dissolves; front-lit dusk props.

### Realism per station (desktop / phone)
| Station | Score | Where the illusion breaks |
|---|---|---|
| 1 Arrival | 8 / 8 | Untouched photo; sky clipped white; reads as a beach bar more than a taverna |
| 2 Terrace | 8.5 / 8 | Untouched photo |
| 3 Kitchen | 7 / 5 | Table now matches; slat gaps flat, edges crisp. Phone: lemons cropped, soft |
| 4 Dusk | 6 / 5 | Front-lit grey jug and vase against a low sun; saturated table; weak contact shadow |
| 5 Menu | 9 / 9 | Untouched photo (once loaded) |
| 6 Reserve | 9 / 9 | Untouched photo |
| Transitions | 4 | Double exposures; beer bottles and Venice appear mid-dissolve |

**Site realism: 7/10 desktop (was 6), 5.5/10 phone (was 4).** Clearly better at rest (kitchen table, clean dusk frame). Not clearly better in motion: transitions still show the beer bottles and Venice, and a new restore bug can leave the wrong photograph on screen.

## 2. jade-teahouse-photo: FAIL (narrow: one medium miss against the explicit 400 ms task budget)

Same GPU, method and contention as section 1. Scripts: `qb2_basic.py`, `qb2_perf.py fps,bytes`, `qb2_cold.py`, `qb2_modes.py ... 1 '#menu'`, `qb2_focus.py`, `qb2_perf.py dissolve,memory 1,3`. Screens: `qa/screens-photo-final/jade-teahouse-photo/`. The extra early-context-loss test run on olive was not run on jade (time box); jade's restore path (`scene.js:581-596`) also covers worlds whose upload the loss interrupted.

### Predecessor defects
| # | Defect | Status | Evidence |
|---|---|---|---|
| 1 med | Longest startup task 849/528/392 ms (builder: ~320) | **NOT FIXED** | 10 cold loads (fresh browser each): longest task 321, 629, 500, 490, 677, 526, 466, 585, 382, 417 ms: median 495, max 677, over 400 ms in 8/10, at 95-1250 ms after navigation (before the first draw). Second-longest tasks also reach 383-462 ms. Olive, same session, same GPU: median 368, so contention does not explain the gap. 3D on median 3167 ms, range 1705-5081 ms (over the ~3 s target in 5/10; contention likely contributes). 10/10 3D, 0 errors |
| 2 med | fps at Menu 60.9 and Reserve 55.1 (builder: ~144) | **FIXED (not 144)** | Medians of 3 at 1440: arrival 132.0, tea 76.8, steamer 64.0 (p95 35 ms), menu 99.4, reserve 99.1. All above 60; the steamer station is the new low point |
| 3 med | Floating teapot mid-pour | **PARTIAL** | `st1-tea-1440x900.png`: the pot now rests on the table behind the cup; a thin stream enters the cup with no visible source from the spout; on the phone (`st1-tea-390x844.png`) the pot base seems slightly lifted off the table. No longer a self-pouring pot in mid-air |
| 4 med | Steamer reads as a plastic tin at FOV 13 | **MOSTLY FIXED** | `st2-dimsum-1440x900.png` (FOV 34, Chinese tea table on the photographed tiles, bench behind): the basket reads as bamboo, the lifted lid sits beside it with a woven top, thin steam filaments lit from behind, a cup beside it. Photo behind is sharp. Remaining: the weave is a too-regular zig-zag, dumplings are smooth pale lumps, the basket rim is very clean |
| 5 low | Dining room reads as a Western brick bistro | NOT FIXED (art direction) | `st3-menu-1440x900.png`: wicker chairs, brick arches, lamp starbursts |
| 6 low | Garden shadow on the hedge | **FIXED** | `st4-reserve-1440x900.png`: no hard shadow across the hedge; table shadow stays on the cobbles |
| 7 low | Old SVG posters | **FIXED** | Posters are now photo crops (`nogl-1440x900-st1.png`). The old `poster-*.svg` files still sit in `assets/` unused |
| 8 low | Exit sign; moon-gate road | **FIXED** | No exit sign in any menu frame; moon gate shows hedge (`dissolve-3to4-055.png`), no road. Carved couplets (hero) and garden information boards (reserve) remain: generic, not identifying |
| 9 low | Double-exposure dissolves | NOT FIXED | `dissolve-1to2-055.png`: tea set and garden table ghost over the dining room; `dissolve-3to4-055.png`: brick and lamps ghost over the garden |
| 10 low | GPU memory: 8k + 6k + CPU copies | **FIXED** | Both photos now 6k (`warm_restaurant_night_6k.jpg` requested, the 8k file is not requested but still ships in `assets/pano/`); decoded bitmaps closed after upload (`scene.js:642`), restore re-decodes from cache. Context loss/restore at station 0 and the tea table: restored frame identical (diff 0 and 0.19). Station 1 <-> 3 x6 round trips: no long tasks at all, worst frame 28-62 ms in 9 of 12 passes (159/362/83 ms once each), JS heap 12-14 MB flat, GPU adapter memory 3.8-4.9 GB, no trend |
| 11 low | No shadows on phones | NOT FIXED | `st1-tea-390x844.png`, `st2-dimsum-390x844.png`: contact shading only |

### Basics (this run)
| Check | Result |
|---|---|
| Console / page errors | 0 at 1440, 1024, 390x844, 390x667, 720x450 and in every run |
| 3D | `is-3d` at all five |
| Horizontal scroll | none at any viewport or station |
| Skip link, nav anchors | first Tab = "Skip to content" (visible), Enter -> `main`; all 4 anchors focus their section (by design 35 % into the pinned range); "Back to the entrance" -> `arrival` |
| Phone menu | 390x667 / 390x844 / 320x256: opens, `main` inert; at 320x256 scrollHeight 278 > 256, scrolls inside itself (10 -> 22, page fixed); every tabbed item on screen and hit-testable; Reserve reachable; Escape -> toggle; menu link focuses `#menu` |
| WebGL off | photo posters, no errors, height stable 4922 -> 4922 (1440), 5084 -> 5084 (390) |
| Reduced motion | idle rAF 0.0/s at every station (1440, 390), frames identical, button hidden |
| Pause right after load, 3 runs | `aria-pressed=true`; rAF 0.0-0.5/s while paused, frames identical (diff 0); resume restores scroll and the `#menu` anchor |
| Bytes | desktop 13.4 MB (33 requests), first idle 13.2 MB; phone 7.67 MB: within budgets |
| Content | placeholders only, "Illustrative sample" menu and "Illustrative dish in a sample photograph"; footer line present; both panoramas and both models requested are credited; no `window.__*`, no `console.*` |

### Remaining defects
1. **Medium (explicit budget: no task over about 400 ms).** Startup longest task median 495 ms, max 677, over 400 in 8 of 10 cold loads. Not the builder's ~320 ms.
2. **Low.** Steamer station 64 fps (p95 35 ms) on the shared GPU: close to the 60 fps target.
3. **Low (realism).** Pour stream has no visible source; pot base slightly lifted on phones. Steamer weave too regular, dumplings plain.
4. **Low.** Double-exposure dissolves; Western bistro dining room; no phone shadows.
5. **Low.** Unused weight in the folder: `assets/pano/warm_restaurant_night_8k.jpg` (5.2 MB) and five `poster-*.svg`.

### Realism per station (desktop / phone)
| Station | Score | Where the illusion breaks |
|---|---|---|
| 1 Arrival (pavilion) | 9 / 8.5 | Untouched photo |
| 2 The pour | 7 / 6 | Pot on the table, stream without a source; table and porcelain sit well with a believable shadow on the cobbles |
| 3 The steamer | 6.5 / 6 | Reads as bamboo and steam now; weave too regular, dumplings plain, edges cleaner than the photo |
| 4 Menu (dining room) | 8 / 8 | Untouched photo, but a brick bistro rather than a tea house |
| 5 Reserve | 7.5 / 7 | Table small and well grounded; information boards visible |
| Transitions | 5 | Double exposures |

**Site realism: 7/10 desktop (was 5.5), 6/10 phone (was 4).** Clearly better than before: the signature steamer moment now reads as a real basket on a real table, the pot no longer floats, the shadow and the retouches are fixed, and Menu/Reserve frame rates roughly doubled. The startup long task is the one explicit miss.
