# QA report, photo round (part A): himal-chulo-photo, ember-and-oak-photo, flour-and-fig-photo

Tester: independent QA (EvidenceQA), 2026-11-04. Headless Chrome only (`channel='chrome'`, `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`), server `python showcase/serve.py 8891`, one site at a time. GPU shared with other agents: fps are medians of 3 windows with spread.
Harness: scratchpad `qp_site.py` (adapted from the previous round's `qf_site.py`, plus texture-residency tracking by hooking `texImage2D/texStorage2D/deleteTexture`, CDP byte counting, between-station dissolve captures and a back-and-forth memory run). Screenshots: `showcase/qa/screens-photo/<slug>/`.

## 1. himal-chulo-photo — FAIL (one high defect: 0.6-1.8 s main-thread freezes on the first scroll)

Renderer: ANGLE D3D11 on the dev GPU. Stations: arrival, kitchen, table, tea, menu, reserve, footer.

### Measured
| Check | Result |
|---|---|
| Console / page errors (1440, 1024, 390x844, 390x667, 720x450, 320x256, nogl, reduce, ctx, pause, 10 cold) | 0 everywhere, 0 failed requests, 0 external requests |
| 3D on (`is-3d`) | yes at every viewport; 10/10 cold loads |
| Horizontal scroll | none at any viewport (scrollWidth = clientWidth) |
| Skip link | first Tab = "Skip to content", Enter moves focus to `#main` |
| Nav anchors (1440 keyboard) | 6/6 move focus to the target section |
| Phone menu 390x844 | opens, focus trap cycles, Escape closes and returns focus to toggle; 5/5 links close menu and focus target |
| Phone menu 390x667 / 320x256 | last link reached by Tab and visible; at 320x256 `#navMenu` scrolls inside itself (296/195 px), page does not move |
| fps per station 1440, vsync on (median, spread of 3x3 s) | arrival 128.7 (27), kitchen 133.0 (16), table 131.0 (5), tea 133.7 (20), menu 132.0 (9), reserve 145.3 (1) |
| fps uncapped (median) | 519 / 511 / 270 / 237 / 184 / 358 — far above 60 |
| Pause (3 loads, paused right after first draw) | aria-pressed=true, scene draws 0/s, page rAF 0/s, canvas identical 1.5 s apart (meanDiff 0) at load and after scrolling while paused; resume: aria-pressed=false, 146 fps, wheel scroll moves, anchor `#reserve` focuses target |
| Reduced motion | button hidden, 0 rAF/s idle, still frame per station (stations differ), no hidden text |
| WebGL off | posters, page height constant 9115 px, 0 draws, 0 errors (1440 and 390) |
| Context loss/restore at 3 stations | `is-3d` removed then restored; brightness after restore = before (mean 143.2/143.2, 117.2/117.2, 82.9/83.1); props and lighting back; 0 new errors |
| Startup, first measured load | first WebGL draw 1810 ms, 3D-on 1817 ms, longest task 412 ms |
| Startup, 10 cold loads | 3D-on 3.2-4.3 s (median ~3.7 s), longest task 672-1308 ms (every run > 400 ms) |
| First scroll after load (2 runs each) | after 2.5 s wait: long tasks up to 747 / 1005 ms; after 12 s wait: 1774, 1098, 1089 ms / 1656, 1370, 1052 ms (several per pass). Later passes: max frame gap 49-125 ms |
| Bytes desktop 1440 | 5.17 MB at 3D-on, 12.0 MB 4 s later, 19.84 MB after full scroll (budget ~20 MB: at the limit) |
| Bytes phone 390 (DPR 3, touch) | 2.47 MB at 3D-on, 7.39 MB total (budget ~8 MB: OK); 4k panoramas |
| GPU memory | 2 panoramas resident all the time (2 x ~179 MB, 8k with mips), ~478 MB textures total; no growth over 4 back-and-forth passes; JS heap 17-23 MB stable |
| Content | placeholders only ([Price], [Reservation link], [Your phone number], [Street address], [Opening hours], [Testimonial from a guest], [Allergen and dietary information]); no prices, awards, dates or ratings; "Illustrative sample" and "Illustrative dishes in a sample photograph" labels; footer "Sample design by Website Studio..."; footer says photographs show sample places, not the restaurant |
| Credits | both panoramas and all 6 props requested appear in `assets/CREDITS.txt` |
| Debug globals | none (only GSAP/Lenis/three library globals) |

### Defects
1. **HIGH — main-thread freezes of 0.6-1.8 s on the first scroll through the page.** Reproduced 4/4 runs; worse after waiting 12 s (1774 ms). Brief: "no main-thread task over about 400 ms". Looks like lazy shader compile / texture upload when the room and table groups first become visible. Later passes are smooth, so it is first-visit work that should be done in the loading state or in chunks. Evidence: `qp_himal-chulo-photo.json` → `hitch`, `mem` round 0 (gaps 834, 897, 1062 ms).
2. **MEDIUM — startup long tasks and time to 3D over budget on cold loads.** Longest task 672-1308 ms in 10/10 cold loads (budget 400 ms); 3D-on 3.2-4.3 s (target ~3 s). GPU was shared with other agents, so time is inflated, but long tasks are main-thread work.
3. **MEDIUM (realism) — prayer flags pop instead of dissolving.** At mid-dissolve the flags stay fully opaque over the restaurant's ceiling and brick wall, then vanish in one frame (`transit_01_30_bg.png`, `transit_01_45_bg.png` → `transit_01_60_bg.png`). The panorama cross-fade itself is a plain 50/50 double exposure (mountains seen through the curtain) for a long scroll distance.
4. **LOW (realism) — the CG food and table break the photo.** The rice is a grainy cone with sprinkled grains, the momos look like white meringues, the lid hangs tilted in the air above the steamer, the table is glossy red-brown and does not match the matte grey wood of the real benches behind it (`1440x900_02_table.png`, `ctx_2_table_restored_bg.png`). The table's wood texture smears at macro distance at the reserve station (`1440x900_05_reserve.png`, bottom right).
5. **LOW (realism) — no contact shadows on the phone.** At 390x844 the limes sit straight on the table without the plate and look like they float (`390x844_02_table.png`). In the top-down menu view the table casts almost no shadow on the tiles (`1440x900_04_menu_bg.png`).
6. **LOW — the real venue shows through.** A green emergency-exit sign is visible in the room photograph at the kitchen station (`transit_01_60_bg.png`, top left). It is not named, but it reads as a specific real building.
7. **LOW — longest startup task 412 ms in the warm run** (just over 400).

### Panorama artefacts
No seam visible at any station or in the 20 between-station frames. The top-down menu view looks at the nadir: the tiles stay sharp, and the tripod patch is hidden under a real-looking rug. No stretched pole pixels seen. The footer frame is softened on purpose (background blur), which reads as depth of field.

### Realism verdict: 6/10
The kitchen station is the photograph itself and would pass as real (9/10). The dusk arrival is a real landscape. The flags are well shaded but too clean and saturated (7/10). Every station with props reads as "a good CG render in front of a real photo": the food and the glossy table give it away, and the flags pop during the dissolve (5/10). Clearly better than the procedural round (`qa/screens-final/himal-chulo/1440x900_02_table.png`: a CG room with flat red walls, maybe 3/10). The real room behind the props now does most of the work.

## 2. ember-and-oak-photo — FAIL (medium defect against an explicit requirement: 3 panoramas on the GPU at once; plus a floating bottle)

Stations: fire, board, cellar, menu, reserve, footer. Panoramas: fireplace (8k), castle_zavelstein_cellar (6k re-sample), warm_reception_dinner (8k); phones get 4k/3k.

### Measured
| Check | Result |
|---|---|
| Console / page errors (all viewports, nogl, reduce, ctx, pause, 10 cold) | 0, no failed or external requests |
| 3D on | `is-3d` at every viewport; 10/10 cold loads |
| Horizontal scroll | none |
| Skip link / nav anchors | skip → `#main`; 5/5 anchors move focus to the target |
| Phone menu | 390x844 trap + Escape returns focus, 4/4 links focus target; 390x667 last link visible; 320x256 `#navMenu` scrolls (290/256), last link visible after Tab and after wheel |
| fps 1440 vsync on (median, spread) | fire 144.7 (6), board 116.7 (5), cellar 103.3 (7), menu 145.0 (1), reserve 145.0 (25) |
| fps uncapped (median) | 338 / 304 / 192 / 988 / 305 |
| Pause (3 loads) | aria-pressed=true, 0 draws/s, 0 rAF/s; frames identical later (meanDiff 0). At load 0.48 % of pixels change in 1.5 s with 0 draws, which is the CSS fade of the canvas, not rendering. Resume: 146 fps, wheel scroll works, `#reserve` focused |
| Reduced motion | button hidden, 0 rAF/s, still frames that differ per station |
| WebGL off | posters, height constant 4919 px (a shorter normal-flow layout), 0 errors |
| Context loss/restore (fire, board, cellar) | restored, brightness 22.5→22.2, 44.3→43.0, 39.8→39.8; 0 errors |
| Startup | first load: first draw 2081 ms, 3D-on 2097 ms, longest task 258 ms. 10 cold loads: 3D-on 1.44-3.03 s (median ~1.8 s), longest task 302-672 ms (3/10 over 400 ms: 416, 627, 672) |
| First scroll | long tasks max 223 ms (2.5 s wait), 207 ms (12 s wait); worst frame gap 466 ms on the first back-and-forth pass, then 21-56 ms |
| Bytes | desktop 5.67 MB at 3D-on, 19.15 MB after full scroll (OK); phone 2.5 MB at 3D-on, 6.5 MB total (OK) |
| GPU memory | after one full pass down and back up, 3 panoramas stay resident: 179 + 179 + 101 MB (~557 MB textures in all). It stays like that over 4 more passes, with no further growth. JS heap 14-16 MB |
| Content | placeholders only ([Price], [Wine list to be confirmed by the restaurant], phone, address, hours, testimonial, allergens); "Illustrative sample" menu; note "stock 360° photographs and scanned props, not this restaurant and not its food"; footer present and says not photographs of this restaurant |
| Credits | 3 panoramas + cutting board, onion, barrel, bottles, wood_table_worn all listed |
| Debug globals | none |

### Defects
1. **MEDIUM (explicit brief rule) — three panoramas resident on the GPU at once** after scrolling down and back up (sizes 179/179/101 MB). The brief says "keep at most TWO panoramas in GPU memory at once and dispose the old one after the dissolve". Measured by hooking `createTexture/texImage2D/deleteTexture`. Evidence: `qp_ember-and-oak-photo.json` → `mem`, `transit` (`peakBig` 4 incl. one 22 MB render target).
2. **MEDIUM (realism) — a wine bottle floats in mid-air** beside the barrel at the reserve station. It stands outside the barrel top with nothing under it (`1440x900_04_reserve.png`, `1440x900_04_reserve_bg.png`, right-hand black-label bottle).
3. **MEDIUM (realism) — the "steakhouse" fire room is plainly someone's living room.** The fireplace photograph shows a sofa with a fur throw, an iron bed or chair frame, an old CRT television on a cabinet (`transit_01_60_bg.png`) and a pair of shoes under the CG table (`1440x900_01_board_bg.png`). Nobody would take it for a restaurant.
4. **MEDIUM (realism) — the fire is a blown-out glowing blob.** The fire in the hero is a flat yellow-white rectangle with a halo, with no flames or logs (`1440x900_00_fire.png`). It looks emissive and CG; the shader's "flicker" on the fire pixels does not help.
5. **LOW (realism) — the CG table is a plain box.** It is a flat slab with uniform wood, no wear on the edges, no contact or ambient-occlusion shadow on the floor, and too large for the room. At 390x844 it fills the screen as a flat brown plane (`390x844_01_board.png`). The cellar bottle's shadow starts below its base, so it reads as hovering slightly (`transit_23_45_bg.png`).
6. **LOW — cold-start long tasks over 400 ms in 3/10 loads** (416, 627, 672 ms), and a 466 ms frame gap on the first pass.
7. **LOW — sharpness mismatch at the reserve station**: the photograph is visibly soft (smeared door planks) while the barrel is crisp.

### Dissolves and panorama artefacts
No dissolve was caught mid-blend at the 30/45/60/75 % sample points between stations. The swaps are short and land between samples; no ghosting or popping was seen in 16 frames. No seam, no stretched poles, and the camera does not pitch to the poles.

### Realism verdict: 5/10
The menu station (the reception dining room) and the cellar wall are real photographs and pass (8/10). The cellar barrels are the best props in the three sites (7/10). The hero and "the cut" break it: a domestic living room with a TV and sofa, a featureless glowing fire, a box table and an empty board (3-4/10), plus a floating bottle at reserve. Better than the procedural round (`qa/screens-final/ember-and-oak/1440x900_01_board.png`: a CG steak in a black void), but the opening two stations are the weakest of the three sites.

## 3. flour-and-fig-photo — FAIL, narrowly (medium: no contact shadows under props on phones; startup long tasks over budget). The most realistic of the three.

Stations: morning, pastry, cake, pour, menu, reserve, footer. Panoramas: studio_country_hall (8k desktop / 4k phone, re-encoded q70), bush_restaurant (4k everywhere).

### Measured
| Check | Result |
|---|---|
| Console / page errors (all viewports, nogl, reduce, ctx, pause, 10 cold) | 0, no failed or external requests |
| 3D on | `is-3d` at every viewport; 10/10 cold loads |
| Horizontal scroll | none |
| Skip link / nav anchors | skip → `#main`; 6/6 anchors focus the target |
| Phone menu | 390x844 trap, Escape returns focus, 5/5 links; 390x667 last link visible; 320x256 `#navMenu` scrolls (328/196), last link visible |
| fps 1440 vsync on (median, spread) | morning 142.3 (45), pastry 143.3 (1), cake 123.0 (26), pour 106.0 (32), menu 143.0 (22), reserve 75.7 (5) |
| fps uncapped (median) | 133 / 150 / 189 / 179 / 323 / 184 (all well over 60; reserve is the heaviest station) |
| Pause (3 loads) | aria-pressed=true, 0 draws/s and 0 rAF/s at load and later; frames identical later (meanDiff 0). Right after load, 2.5-4.6 % of pixels change in 1.5 s with 0 draws (a CSS fade-in, not rendering). Resume restores scroll and anchors (`#reserve` focused) |
| Reduced motion | button hidden, 0 rAF/s, still frames that differ per station |
| WebGL off | posters, height constant 5467 px, 0 errors |
| Context loss/restore (morning, pastry, cake) | brightness 135.4→135.4, 131.1→130.7, 120.4→120.4; 0 errors. The remaining pixel diff comes from slow idle camera drift |
| Startup | first load: first draw 1994 ms, 3D-on 2004 ms, longest task 444 ms (at 229 ms). 10 cold loads: 3D-on 1.79-3.71 s (median ~1.84 s), longest task 379-739 ms (5/10 over 400: 407, 434, 449, 640, 739). The 1024x768 load took 4.28 s with a 913 ms task |
| First scroll | long tasks max 183 ms; mem passes max gap 174 ms then 7-14 ms (best of the three) |
| Bytes | desktop 6.3 MB at 3D-on, 19.65 MB total (at the limit); phone 2.89 MB at 3D-on, 8.44 MB total (about 5 % over ~8 MB) |
| GPU memory | 2 panoramas (179 MB + 45 MB) + a 22 MB target; constant ~349 MB over 4 passes; JS heap 14-20 MB |
| Content | placeholders only ([Your cake list], [Coffee and tea list to be confirmed], [Price], phone, address, hours, testimonial, allergens); "Illustrative pastry/cake" notes; footer "Sample design by Website Studio ... The photographed rooms are stand-ins, not the café" |
| Credits | both panoramas and all 8 models requested appear in CREDITS.txt |
| Debug globals | none |

### Defects
1. **MEDIUM (explicit recipe line: "a ShadowMaterial shadow-catcher under every prop") — props have no contact shadows on phones.** At 390x844 the croissant hovers over the board (`390x844_01_pastry.png`, `390x844_01_pastry_bg.png`). At the reserve station the table, cake, teapot and cup cast no shadow, and the table's legs do not visibly meet the floor (`390x844_05_reserve_bg.png`). Desktop has the shadows. (himal-chulo-photo has the same phone issue, defect 5.)
2. **MEDIUM (budget) — startup main-thread tasks over 400 ms** in 5/10 cold loads (up to 739 ms) and 913 ms at 1024x768, on a shared GPU. Borderline; retest on a quiet GPU.
3. **LOW (realism) — the CG oak table meets the photo's own white table.** At the pastry station the cake plate and tea set straddle the CG table and the photograph's painted table (`ctx_1_pastry_before_bg.png`), which reads as a composite. The ceramic cake plate is a flat, featureless procedural disc (`1440x900_02_cake.png`). The two lemons look wedged against the cake's rim.
4. **LOW (realism) — the pour is staged.** A teapot floats and pours with no hand; the stream is a thin uniform CG line and the tea surface is a flat dark disc (`1440x900_03_pour.png`).
5. **LOW — the panoramas are soft at 1440 and pixelated on phones.** bush_restaurant is served at 4k everywhere and re-encoded at q70, so the menu frame is visibly soft. On phones (DPR 2-3) the brick wall at reserve looks blocky (`1440x900_04_menu_bg.png`, `390x844_05_reserve_bg.png`).
6. **LOW — phone total 8.44 MB** vs about 8 MB.

### Dissolves and panorama artefacts
The single hall-to-room dissolve (stations 4→5) is short and was not caught mid-blend at the 30/45/60/75 % samples; no popping of props between frames. No seam, no pole stretch, no pitch to the poles.

### Realism verdict: 7/10
The desktop morning, pastry and reserve frames are the closest of the three to photographs. The scanned croissant, carrot cake, tea set, basket and board hold up at macro distance; the light and colour match the bright café photo; the grain and vignette are subtle. What gives it away: the slightly too red and glossy CG table, the flat procedural plate, the floating pour, and on phones the missing shadows (5/10 on phone). Clearly better than the procedural round (`qa/screens-final/flour-and-fig/1440x900_01_pastry.png`: a scanned croissant in a flat CG room).

## Summary
| Site | Verdict | Realism | Main reasons |
|---|---|---|---|
| himal-chulo-photo | FAIL | 6/10 | 0.6-1.8 s main-thread freezes on the first scroll (high); prayer flags pop during the dissolve; CG food and glossy table |
| ember-and-oak-photo | FAIL | 5/10 | 3 panoramas on the GPU at once (brief: max 2); a floating bottle; the fire room is a domestic living room with a CRT TV; the fire is a glowing blob |
| flour-and-fig-photo | FAIL (narrow) | 7/10 | no contact shadows on phones; startup long tasks over 400 ms; otherwise the most photographic |

All three pass the functional gates: 0 errors, 3D on in 10/10 cold loads, no horizontal scroll, skip link and anchors, phone menu at 320x256, WebGL-off posters with stable height, reduced motion, pause with 0 rAF, context restore, bytes, no debug globals, content rules, credits. Frame rates are 75-145 fps with vsync and 130-990 fps uncapped. Not tested: real phone GPUs (the phone profiles are emulated on the desktop GPU), contrast measurement (not in scope this round), Safari and Firefox.
