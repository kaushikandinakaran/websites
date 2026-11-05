# QA report, photo round (B): olive-and-sea-photo and jade-teahouse-photo

Tester: independent QA agent (EvidenceQA), 2026-11-04. Playwright headless Chrome (`channel='chrome'`, `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`), served by `python showcase/serve.py 8892`. One site at a time. Screenshots: `showcase/qa/screens-photo/<slug>/`. GPU shared with other agents: fps numbers are medians of 3 with spread.

## 1. olive-and-sea-photo: PASS (with 4 medium defects to fix)

Test GPU (headless ANGLE): AMD Radeon 780M (D3D11). Scripts: `qb_basic.py`, `qb_focus.py`, `qb_modes.py`, `qb_perf.py`, `qb_rafleak.py` (scratchpad). Screens: `qa/screens-photo/olive-and-sea-photo/` (`st<i>-<id>-<vp>.png` for every station at 5 viewports, `dissolve-*`, `ctx-*`, `rm-*`, `nogl-*`, `menu-open-*`). Previous round for comparison: `qa/screens-photo/olive-and-sea/` (1440 only).

### Measured results
| Check | Result |
|---|---|
| Console / page errors, 1440, 1024, 390x844, 390x667, 720x450 | 0 site errors at all five (the only error logged came from my own init script and was fixed; reruns clean) |
| html class | `is-3d` at all five, never `fell-back` / `no-3d` |
| Horizontal scroll | none at any viewport or station |
| Skip link | first Tab = "Skip to content" (slides in, 0.2 s transition), Enter -> focus `main` |
| Nav anchors (1440, 1024) | all 5 move focus to the target section; section top lands at -1..0 px; "Back to the top" -> `arrival` |
| Mobile menu 390x667, 390x844, 320x256 | opens (`aria-expanded=true`, `main` inert); at 320x256 the menu scrolls inside itself (scrollTop 12 -> 180 by wheel, page stays at 0); last link (Reserve) fully on screen and hit-testable; Tab wraps inside the menu; Escape closes, focus back on toggle, inert and overflow cleared; menu link focuses `#menu` and closes the menu |
| Stations change | mean pixel diff between consecutive station screenshots 40-113 (of 255), 52-91 % of pixels changed: every station clearly differs |
| Panel cover on phones (share of viewport) | 390x844: 33 / 31 / 26 / 25 / 57 (menu, scrolling card) / 41 %; 390x667: 41 / 39 / 33 / 31 / 68 (menu) / 52 %. Story stations leave the top 55-70 % of the screen to the scene |
| WebGL off | photo posters shown, no errors, page height stable over time (5815 -> 5815 at 1440; 5917 -> 5917 at 390) |
| Reduced motion | `rm is-3d`, pause button hidden, idle rAF 0.0/s at every station (1440 and 390), frames 1.5 s apart identical (diff 0) |
| Pause right after first load, 3 runs | `aria-pressed=true`; rAF in first second 2 / 2 / 3, then 0.0/s; frames 1.5 s apart identical (diff 0); scrolling while paused moves the camera then returns to 0 rAF; resume: `aria-pressed=false`, wheel scroll works (900 -> 1500), `#dusk` anchor focuses, lands at -1 px. After 3 pause/resume cycles still exactly 3 rAF loops (GSAP, ScrollTrigger, scene): no leak |
| Context loss / restore (station 0, and station 2 with props) | `gl-lost` added, photo poster shown, removed on restore; restored frame identical to the pre-loss frame (mean diff 0; luminance 217.7 vs 217.7 and 85.4 vs 85.4): panorama, props, shadows and light come back at the same brightness; 0 new console errors |
| Startup, 3 cold loads (1440) | first WebGL draw 2167 / 2235 / 2295 ms; 3D on 2221 / 2286 / 2330 ms; longest main-thread task 376 / 439 / 458 ms (at 300-544 ms, before the first draw); later tasks 200-338 ms at 3-5 s (second photo upload) |
| 10 cold loads in a row | 10/10 show 3D (3D on 1566-2699 ms), 0 errors |
| Bytes, desktop 1440 | 15.2 MB after 15 s idle, 16.5 MB after scrolling the whole page (50 requests): within 20 MB. First station before first frame about 6.4 MB (pano 3.69 + env256 1.89 + three.js 0.67) |
| Bytes, phone 390x844 (dsf 3, touch) | 7.9 MB total (38 requests; 4k panos 1.72 + 0.92 + 0.63 MB, env128 files): within 8 MB, at the limit |
| fps per station at 1440 (median of 3, spread) | 126.7 (22), 126.1 (20), 87.8 (22; props + shadows), 106.0 (3), 125.8 (1), 120.2 (19): target 60+ met everywhere |
| Memory / hitch: station 1 <-> 4 six round trips | JS heap flat 20-21 MB; system GPU adapter memory 3.4-4.4 GB, no upward trend (noisy, shared GPU); but EVERY crossing hitches: 3-4 frames over 50 ms, worst frame 188-327 ms per pass |
| Content | only `[placeholders]`; "Illustrative" and "Sample menu for illustration only" labels; no claims; footer "Sample design by Website Studio. Scenery: illustrative 360° stock photographs of other places, not the restaurant." Every panorama and prop requested on the network (3 panos, 5 models) is in `assets/CREDITS.txt`. No `window.__*` globals, no console.log, no debug switches |

### Defects
1. **Medium (content rule).** Station 4 "Dinner at dusk" (`st3-dusk-1440x900.png`) frames a world-famous skyline, the Santa Maria della Salute dome and the San Giorgio Maggiore campanile: Venice. Not named, but instantly recognisable, so the page implies the taverna is in Venice. BRIEF-PHOTO: "do not name or describe the real venue and do not imply it is the client's restaurant". Fix: turn the camera off the skyline or crop it out.
2. **Medium (performance).** Every pass across the dusk station, in either direction, swaps the resident panorama pair and re-decodes and uploads a 6k photo on the main thread: 3-4 frames over 50 ms and a 188-327 ms freeze on each of 12 passes (`qb_perf_olive-and-sea-photo_memory.json`). Memory does not grow, so the two-resident design holds; the cost is a visible stall mid-scroll. Fix: strip-upload (as jade-teahouse-photo does) or pre-upload before the swap point.
3. **Medium (realism, desktop).** Station 3 "From the kitchen" (`st2-kitchen-1440x900.png`): the CG folding table gives the composite away. Warm saturated brown against a cool blue-grey photo; salmon-pink light in the slat gaps; razor-sharp edges against the soft photo; glossy, over-saturated lemons with no contact shadows; jug and vase tops cut off under the nav. This is the one station about the props, and it reads as CG.
4. **Medium (realism, phones).** The phone tier renders at pixel ratio 1.0 with no MSAA and no shadow maps (`st2-kitchen-390x844.png`, `st3-dusk-390x844.png`): stair-stepped edges on the jug, lemons and chair slats; flat lemons (the "lite" material drops normal maps); the table floats on the quay with only a blob shadow; the 4k photo is visibly soft.
5. **Low.** Longest startup task 439 and 458 ms in 2 of 3 cold loads (budget about 400 ms), about 300-550 ms after navigation, before the scene draws.
6. **Low.** First station about 6.4 MB before its first frame (budget about 6 MB). Phone total 7.9 MB, right at the 8 MB limit.
7. **Low (art direction).** Real-venue clutter in the hero and kitchen frames: two beer bottles and a glass on the photo's table, and a white power socket on the post in the middle of the hero (`st0-arrival-1440x900.png`). The hero sky is clipped white. The deck reads as a beach bar, not a Mediterranean taverna.
8. **Low (dissolve).** Cross-dissolves are straight double exposures (`dissolve-2to3-045.png`, `-055.png`). For about 0.4 of a station width the jug, vases and lemons are semi-transparent ghosts over the other photo, and the next photo's table set fades in as a ghost. No popping and no brightness jump (mean luminance moves smoothly 130 -> 159 -> 143).
9. **Low (lighting).** In the dusk scene the sun is low behind the table, yet the table top and the jug's camera side are lit as if from the front. The vases read flat grey, not warm-backlit; the table reads slightly small for the quay.

Panorama artefacts: no equirectangular seam visible at any station or dissolve frame. No pole region in frame (steepest pitch -28° at station 3). The projected deck floor holds straight board lines. Background blur at station 3 is deliberate depth of field and reads as photographic.

### Realism verdict: 6/10 desktop, 4/10 phone
- The wide stations (hero deck, terrace table, sky-on-fire menu and reserve) are untouched photographs and pass as real places: 9/10. Here this round is clearly better than the procedural round (`qa/screens-photo/olive-and-sea/st1-terrace-1440x900.png`: tidy but obviously rendered archviz).
- The two prop stations break the illusion. Kitchen: colour, sharpness and white-balance mismatch on the CG table (5/10). Dusk: front-lit props in a backlit scene and grey vases (6/10 desktop, 4/10 phone).
- Brand fit got worse: the old round looked Mediterranean (whitewash, blue chairs, terracotta). The new deck looks like a beach bar with beer bottles, and the dusk shot is recognisably Venice.

## 2. jade-teahouse-photo: FAIL (narrow: two medium misses against explicit budgets, plus realism defects)

Same GPU, scripts and method as section 1 (`qb_modes.py jade-teahouse-photo 1 '#menu'`, `qb_perf.py ... dissolve 1,3`, `memory 1,3`, `qb_crop.py`). Screens: `qa/screens-photo/jade-teahouse-photo/`. Previous round for comparison: `qa/screens-photo/jade-teahouse/` (1440 only).

### Measured results
| Check | Result |
|---|---|
| Console / page errors at 1440, 1024, 390x844, 390x667, 720x450 | 0 at all five (and 0 in every other run) |
| html class | `is-3d` at all five (`is-loading` stays on the root but only shows the loader until `is-loaded` fades it) |
| Horizontal scroll | none at any viewport or station |
| Skip link | first Tab = "Skip to content", visible, Enter -> focus `main` |
| Nav anchors (1440, 1024) | all 4 move focus to the target section (they land 35 % into the pinned range by design: section top at -146..-315 px, panel visible); "Back to the entrance" -> `arrival` |
| Mobile menu 390x667, 390x844, 320x256 | opens, `main` inert; at 320x256 menu scrollHeight 278 > 256 and it scrolls inside itself (10 -> 22) with the page fixed; last link (Reserve) on screen and hit-testable; Tab wraps; Escape closes, focus back on toggle, inert and overflow cleared; menu link focuses `#menu` |
| Stations change | mean pixel diff between consecutive stations 34-138, 53-95 % of pixels changed |
| Panel cover on phones | 390x844: 31 / 31 / 31 / 60 (menu card) / 41 %; 390x667: 40 / 39 / 39 / 80 (menu card) / 52 % |
| WebGL off | posters shown (SVG drawings), no errors, page height stable (4922 -> 4922 at 1440; 5084 -> 5084 at 390) |
| Reduced motion | `rm is-3d`, pause button hidden, idle rAF 0.0/s at every station, frames identical |
| Pause right after first load, 3 runs | `aria-pressed=true`; rAF first second 1 / 0 / 1, then 0.0/s; frames 1.5 s apart identical; scrolling while paused moves the camera then stops; resume: `aria-pressed=false`, scroll works (900 -> 1500), `#menu` anchor focuses |
| Context loss / restore (station 0, and station 1 tea table) | poster shown while lost, `is-3d` back on restore; restored frame identical to before (mean diff 0 and 0.002; luminance 71.91 vs 71.91, 135.18 vs 135.18): panorama, table, porcelain and lighting back at the same brightness; 0 new errors |
| Startup, 3 cold loads (1440) | first WebGL draw 2193 / 1420 / 1443 ms; 3D on 2202 / 1428 / 1448 ms; **longest main-thread task 849 / 392 / 528 ms**, at 192-336 ms after navigation (before the first draw); the strip-uploaded panorama itself never shows as a long task (max later task 168 ms) |
| 10 cold loads in a row | 10/10 show 3D (3D on 688-1423 ms), 0 errors |
| Bytes, desktop 1440 | 15.0 MB total (33 requests; 8k dining room 5.20 MB, 6k garden 3.95 MB): within 20 MB. First station before first frame about 5.2 MB: within 6 MB |
| Bytes, phone 390x844 | 7.3 MB total (29 requests; 4k panoramas 1.81 + 1.50 MB; normal and ARM maps skipped): within 8 MB |
| fps per station at 1440 (median of 3, spread) | 143.9 (5.5), 87.3 (31), 108.2 (48), **60.9 (5.8)**, **55.1 (8.2)**; p95 frame time at stations 4-5: 35-49 ms |
| Memory / hitch: station 1 <-> 3 (garden <-> dining room) six round trips | both photos stay resident, so no re-decode: JS heap 12-14 MB flat, GPU adapter memory 2.8-3.5 GB with no trend; worst frame 118 ms once, then 28-77 ms; no long tasks |
| Content | `[placeholders]` only, "Illustrative sample" menu and "Illustrative dish in a sample photograph" note, no claims, footer "Sample design by Website Studio. ... the places shown are sample scenery, not this restaurant." Both panoramas and both models requested on the network are in `assets/CREDITS.txt`. No `window.__*`, no console.log |

### Defects
1. **Medium (explicit budget: no main-thread task over about 400 ms).** Longest startup task 849 ms and 528 ms in 2 of 3 cold loads (392 in the third), 190-340 ms after navigation, before the scene draws. Olive shows the same early task, but smaller (376-458 ms), so it is probably the shared module or vendor parse and compile rather than this site's panorama, which is uploaded in strips and never blocks. Needs a profile to pin down.
2. **Medium (explicit target: 60+ fps).** At 1440: 55.1 fps at Reserve (garden, tea table, 2048 PCF soft shadows, MSAA 4) and 60.9 at Menu (8k panorama), p95 frames 35-49 ms. Spreads are small (5.8 and 8.2), so this is not just GPU sharing. Olive holds 88-127 fps on the same GPU in the same session.
3. **Medium (realism).** The pour (`st1-tea-1440x900.png`, `st1-tea-390x844.png`): mid-hold, the porcelain teapot floats in the air by itself, tilted, with its spout dipped into the cup rim and no hand. Nothing breaks the "real place" illusion faster than a self-pouring pot. At rest (`st1-tea-start-1440x900.png`) the same table and tea set look credible.
4. **Medium (realism).** The steamer (`st2-dimsum-1440x900.png`, `st2-dimsum-390x844.png`): at FOV 13 the 8k photo is magnified into soft mush; the procedural steamer reads as a brown plastic tin with a zig-zag lid; the single visible dumpling is a white blob; the puffy steam sprites are the most "animated" thing on the page. This is a step back from the previous round's close-up steamer (`qa/screens-photo/jade-teahouse/st2-dimsum-1440x900.png`), which was clearly CG but appetising.
5. **Low (art direction).** The dining-room photograph (stations 3-4, `st3-menu-1440x900.png`) is a Western brick bistro: wicker chairs, a green emergency-exit sign, lamp starbursts. It does not read as a tea house, and the tea set is European porcelain (acknowledged in CREDITS).
6. **Low (shadow).** At Reserve (`crop-st4-ground.png`) the table's sun shadow is cast as if on flat ground straight across the photographed hedge, with a hard straight edge. The hedge is vertical foliage, so the shadow sits wrong.
7. **Low.** The WebGL-off posters are the old round's flat vector drawings (`nogl-1440x900-st1.png`), stylistically at odds with a "real photographs" site. They work as fallbacks.
8. **Low (real place).** Identifiable details: carved Chinese couplets on the pavilion (hero) and garden information boards (Reserve). During the 4 -> 5 dissolve a public road with a lamp post shows through the moon gate (`dissolve-3to4-055.png`). Nothing famous, and the footer disclaims it.
9. **Low (dissolve).** Straight double exposure (`dissolve-1to2-055.png`): the tea set and table ghost over the dining room for about a third of the transition. The push-in during the dissolve works, and there is no popping or brightness jump (luminance 109 -> 103 -> 88 smoothly).
10. **Low (GPU memory risk).** Desktop keeps an 8k panorama (about 180 MB with mips) and a 6k one (about 100 MB) resident together. It also keeps both decoded ImageBitmaps on the CPU for context restore (about 200 MB more). No growth or hitching measured here, but this is heavy for 8 GB laptops.
11. **Low (phones).** No shadow maps on the phone tier: the floating teapot casts nothing, and the props sit on soft, upscaled 4k photo floors.

Panorama artefacts: no seam visible at the garden stations, even though Reserve looks across u = 1.0 (the code's dual-derivative mip fix works). No pole stretching in frame: the steepest pitch is +15° up at the dining-room ceiling, and the lamps and beams there are clean. Blur: magnified-photo softness at the steamer station (defect 4), and the ground-projected cobbles at the tea table are softer than the table.

### Realism verdict: 5.5/10 desktop, 4/10 phone
- Garden hero (`st0-arrival-1440x900.png`) and the dining-room menu view are untouched photographs: 9/10 and 8/10 as photographs.
- Tea table at rest: 6.5/10. Plausible scale, perspective and shadow, slightly too crisp against a soft floor. Mid-pour: 4/10 (floating pot).
- Steamer: 3/10. Reserve: 6.5/10 (shadow on the hedge).
- Against the previous procedural round, the wide stations are clearly better (real place vs dark CG room), but the dim sum moment, the site's signature, got worse, and the dining room no longer looks like a tea house. Overall better, not clearly better.

