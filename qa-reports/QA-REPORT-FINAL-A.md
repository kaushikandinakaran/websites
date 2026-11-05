# QA report FINAL-A: 5 restaurant 3D sites (after fix round 2)

Tester: EvidenceQA (studio-qa-tester role), 2026-11-04. Independent; no site files edited.
Acceptance: `showcase/BRIEF.md`, `showcase/BRIEF-3D.md`; defect list: `showcase/qa/QA-REPORT-3D.md`.

## Method
- Server: `python showcase/serve.py 8871`; one site at a time.
- Playwright 1.48 (studio venv) + installed Chrome, headless only, `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`. Every browser closed after each test.
- Harness: `qf_site.py` in the session scratchpad (derived from the predecessor's `q3_site.py`): injected counters for rAF callbacks, frames with WebGL draws, first draw, longtasks (PerformanceObserver), html class, scrollHeight trace.
- Viewports: 1440x900, 1024x768, 390x844 (dsf 2, touch), 390x667 (dsf 2, touch), 720x450 (panel coverage), 320x256 (menu).
- GPU is shared with an accessibility auditor running at the same time: fps and startup numbers are noisy; fps measured as 3 windows, median / spread.
- Screens: `showcase/qa/screens-final/<slug>/`. Raw data: `qf_<slug>.json` in the scratchpad.
- Verdict rule: FAIL only for a high defect or a med defect against an explicit requirement.

## 1. sakura-omakase: PASS

Renderer ANGLE (AMD Radeon 780M, D3D11). Screens `screens-final/sakura-omakase/`.

| Check | Result |
|---|---|
| Console / page errors / failed requests | 0 at 1440, 1024, 390x844, 390x667, 720x450, WebGL-off, reduced motion, pause, context loss, 10 cold loads. The S-2 FXAA warning is gone. |
| 3D on (`is-3d`) | yes at every viewport; 10/10 cold loads |
| Horizontal scroll | none at any station, any viewport |
| Skip link / nav | Tab -> "Skip to content", Enter focuses `#main`; counter, omakase, tools, reserve focus their section (`#top` brand focuses `#arrival`, intended) |
| Mobile menu 390x844 | 48x48 toggle, label "Menu", aria-expanded, Tab cycles inside, Escape closes + focus to toggle, every link closes + focuses target |
| Menu 390x667 / 320x256 | 390x667: all 4 links fit. 320x256: `#navMenu` scrolls inside itself (312 px content in 191 px), last link "Reserve a seat" reached by Tab and fully visible (155-207 of 256). Escape returns focus. `320x256_menu_last.png` |
| Wheel scroll, scene changes | 6 stations; scene-only frames change 84/94/91/98 % (1440) and 83/96/84/99 % (390x844) between stations |
| Text readable | all copy on dark panels at every viewport |
| WebGL off | `no-3d`, flat posters, height constant 4227 px |
| Reduced motion | pause button hidden, still frames per station change, 0 scene frames and **0 rAF/s** idle, no low-opacity text |
| Pause (clicked at first WebGL draw, 3 fresh loads) | aria-pressed true, `motion-off`, constant label; **0 scene fps, 0 rAF callbacks/s** at load and at a later station (3/3); scene frames 1.5 s apart: 0 % / 1.1 % / 0 % pixels changed (at load, residual settle), identical later |
| Resume | rAF back, wheel scroll smooth (39 -> 999 px over 10 notches), `#reserve` anchor focuses target |
| Context loss/restore (3 stations) | designed poster during loss (`gl-lost`), brightness after restore 31.4->31.4, 40.0->40.1, 98.3->97.0; 0 console errors |
| Debug globals | none (only library globals and `__THREE__`) |
| Content | placeholders only ([Price], [Reservation link], [Street address], [Opening hours], [Your phone number], [Testimonial from a guest]); "Illustrative sample menu"; footer "Sample design by Website Studio..." |

Startup (1440, PerformanceObserver longtask): first harness load: longest task 309 ms, first draw 0.55 s, scene on 1.55 s. 10 cold loads in a row (GPU shared with the a11y auditor): **10/10 show 3D**, longest task median 413 ms (range 293-689; 5 of 10 above 400 ms, all early at 0.24-0.9 s), first draw 1.2-2.3 s, scene on median 4.0 s (3.2-6.4 s). Other viewports: 309 ms (1024), 315 (390x844), 517 (390x667), 382 (720x450).

FPS 1440 uncapped, 3 windows, median / spread (heavy contention this run; previous round measured 150-169): arrival 106/27, counter 94/12, omakase 88/54, tools 56/60, reserve 50/16.

### Predecessor defects
- S-1 high (4.4-5.5 s main-thread block): **FIXED** (longest task 0.29-0.69 s; residual see 1).
- S-2 low (FXAA console warning): **FIXED** (0 warnings).
- S-3 low (rail overlaps text at 1440): **FIXED**: rail is now a small pill at the bottom right (`1440x900_03_tools.png`, `1440x900_02_omakase.png`), no overlap.
- S-4 low (720x450 panels cover scene): **FIXED / improved**: hero panel compact, scene visible (`720x450_00_arrival.png`).

### Remaining defects
1. Low. Longest startup task still 400-690 ms in 5 of 10 cold loads under GPU/CPU contention (target ~400 ms). Not a freeze any more.
2. Low (visual). At 1440, mid-station, tall panels slide under the fixed header so the heading top is clipped behind it ("Chef's choice..." in `1440x900_02_omakase.png`, "Quiet tools" in `_03_tools.png`). Transient while scrolling.
3. Low (perf, unproven). Reserve/tools measured 50-56 fps median in this run; contention likely (same GPU shared).

Visual: high-class night lacquer look; torii + moon arrival, lantern-lit counter, glossy nigiri board, tools board; convincing stylised toy world. Phones keep the 3D visible above panels on arrival/counter.

## 2. forno-rosso: PASS

Renderer ANGLE (AMD Radeon 780M, D3D11). Screens `screens-final/forno-rosso/`.

| Check | Result |
|---|---|
| Console / page errors / failed requests | 0 everywhere (5 viewports + 320x256, WebGL-off, reduced motion, pause, context loss, 10 cold loads) |
| 3D on (`gl`) | yes at every viewport; 10/10 cold loads |
| Horizontal scroll | none at any station, any viewport incl. 320x256 |
| Skip link / nav | skip -> `#main`; dough, toppings, oven, menu, reserve focus their section with top at 0 |
| Mobile menu 390x844 | 48x48 toggle `aria-label="Menu"`, aria-expanded, Tab cycles, Escape -> focus toggle, links close + focus target |
| Menu 390x667 / 320x256 | 390x667 all 5 links fit; 320x256 `#navMenu` scrolls inside (290 px in 168 px), last link "Reserve" reached by Tab and visible (188-236 of 256); Escape returns focus |
| Wheel scroll, scene changes | scene-only frames change 83/100/98/83 % between stations (1440) |
| WebGL off | flat posters, height constant 11003 px |
| Reduced motion | pause hidden, stills change per station (81-100 %), 0 scene fps and 0 rAF/s idle, no low-opacity text |
| Pause at first draw (3 loads) | aria-pressed true, `motion-off`; **0 scene fps and 0 rAF callbacks/s** at load and later (3/3); frames identical 1.5 s apart 6/6 |
| Resume | rAF back; wheel smooth (51 -> 999 px); `#reserve` anchor focuses target |
| Context loss/restore | poster during loss (`gl` removed), brightness 172.6->172.6, 154.2->153.9, 84.3->85.9; 0 console errors |
| Debug globals | none |
| Content | placeholders only; "Illustrative sample menu"; footer present; no "of the day" wording |

Startup 1440: first load longest task 282 ms, first draw 2.7 s, scene on 2.8 s. 10 cold loads: **10/10 3D**, longest task median 204 ms (183-506; 1 of 10 over 400), scene on median 3.1 s (2.0-3.8 s). Other viewports: 257 ms (1024), 338 (390x844), 218 (390x667), 359 (720x450).

FPS 1440 uncapped, median / spread (shared GPU, all sites slower this session): dough 60/3, toppings 43/8, oven 39/9, menu 65/28, reserve 48/11. Previous round 85-117.

### Predecessor defects
- F-1 med (rAF 286-296/s while paused): **FIXED** (0.0/s in all 6 paused windows plus the resume test).
- F-2 low (long task 445-483 ms at 1024 / 390x844): **FIXED** (257 / 338 ms; one cold 1440 load 506 ms).
- F-3 low (720x450 cards cover scene): **improved**; see screens `720x450_0*`.
- F-4 low (mozzarella reads as marshmallow): **PARTIAL**: pieces now flatter torn shapes, but still pale white blobs at toppings and on the pizza at the oven station (`1440x900_01_toppings.png`, `390x667_02_oven.png`).
- 320x256 unpin: **VERIFIED**. `qf_headings.py`: at 320x256 (dsf 2, touch) each of the 5 main headings (h1 + 4 h2) was wheel-scrolled to just under the header: all opacity 1, `elementFromPoint` hits the heading itself (not covered), full heading inside the viewport (one sits 5 px under the header edge because of wheel step size). Screens `320x256_h0..h4.png`; 0 console errors, no horizontal scroll at any station.

### Remaining defects
1. Low (visual). Mozzarella still pale cream blobs until the menu station (F-4 partial).
2. Low (perf risk). Uncapped fps 39-65 this session (toppings/oven lowest); GPU contention likely, but forno was the slowest site last round too.

Visual: bright, warm clay world, friendly serif display type, cream and chocolate cards; the toppings explode / oven push is the wow moment. Clean on phones (card at bottom, scene above).

## 3. saffron-court: PASS

Renderer ANGLE (AMD Radeon 780M, D3D11). Screens `screens-final/saffron-court/`.

| Check | Result |
|---|---|
| Console / page errors / failed requests | 0 everywhere (5 viewports, WebGL-off, reduced motion, pause, context loss, slow-frame test, 10 cold loads) |
| 3D on (`is3d`) | yes at every viewport; **10/10 cold loads** on serve.py |
| Horizontal scroll | none |
| Skip link / nav | skip -> `#main`; spice, tandoor, menu, reserve focus their section |
| Mobile menu 390x844 | 48x48 toggle `aria-label="Menu"`, aria-expanded, Tab cycles, Escape -> toggle, links close + focus target |
| Menu 390x667 / 320x256 | 390x667 fits; 320x256 `#navMenu` scrolls inside (348 px in 183 px), last link "Reserve a table" by Tab visible (163-207 of 256); Escape returns focus |
| Wheel scroll, scene changes | 7 stations; scene-only change 81/86/90/89/73 % (1440), 54-76 % (390x844) |
| Phones | panels now take the lower ~35-45 % of the screen at 390x667; gate, spice orbit, hall arches, tandoor and mandala clearly visible above them (`390x667_0*.png`) |
| WebGL off | posters, height constant 9091 px |
| Reduced motion | pause hidden, stills change, 0 scene fps / 0 rAF/s idle |
| Pause at first draw (3 loads) | aria-pressed true, `motion-off`; **0 scene fps, 0 rAF/s** at load and later (3/3); scene frames 0 % changed |
| Resume | rAF back, wheel smooth, `#reserve` anchor focuses target |
| Context loss/restore | posters during loss, brightness 35.2->35.4, 37.7->37.0, 63.2->63.4; 0 console errors |
| **SC1 forced slow frames** | Run A: 2 rounds of 20 s at ~6.5 fps. Run B: 3 rounds of 32 s at ~20 fps (busy-wait injected in rAF; ~20 adaptive-guard trips, draws/frame fell 97 -> 84 in round 1 = bloom removed). **0 page errors, 0 console errors**; after every round the loop ran 38-104 fps and the scene changed on scroll (32-86 % pixels). **FIXED** |
| Debug globals | none |
| Content | placeholders only incl. [Testimonial from a guest]; footer present |

Startup 1440: first load longest task 251 ms, first draw 1.27 s, scene on 1.88 s. 10 cold loads: 10/10 3D; longest task median 194 ms, but **2 loads 969 ms and 1232 ms** (at ~0.7 s, before first draw); scene on median 2.9 s (2.4-3.9 s). Other viewports: 560 ms (1024), 504 (390x844), **937 (390x667)**, 238 (720x450).

FPS 1440 uncapped, median / spread (shared GPU): gate 49/9, spice 44/10, hall 46/4, tandoor 46/3, menu 43/4, reserve 44/3.

### Predecessor defects
- S-1 high (3.7-4.2 s block): **FIXED as a freeze** (median 194 ms), residual spikes see 1.
- S-2 med (rAF while paused): **FIXED** (0/s).
- S-3 med (phone panels cover the scene): **FIXED** (`390x667_01_spice.png`, `390x667_03_tandoor.png`).
- S-4 low (thali/reserve fps): not reproducible as station-specific: all stations 43-49 fps this session (uniform contention).
- S-5 low (hero panel flush left at 1440): **FIXED** (`1440x900_00_gate.png`).
- S-6 med (3D lost on demo server): **FIXED** with serve.py (10/10 + every other load in this session).

### Remaining defects
1. Low-med. Occasional ~1 s startup task: 969 and 1232 ms in 2 of 10 cold 1440 loads, 937 ms at 390x667, 504-560 ms at 390x844/1024 (target ~400 ms). Early in load (0.7 s), under GPU/CPU contention; re-measure on a quiet machine.
2. Low (perf risk). Uncapped fps 43-49 on every station this session (below 60 under contention).

Visual: richest scene of the five: domed gate with string lights, floor mandala and brass bowls, glowing arch tunnel, tandoor with sparks, thali on a teal disc. Ornate but clean, distinctive maroon/saffron/teal; looks high-class.

## 4. maison-claire: PASS

Renderer ANGLE (AMD Radeon 780M, D3D11). Screens `screens-final/maison-claire/`.

| Check | Result |
|---|---|
| Console / page errors / failed requests | 0 everywhere (5 viewports, WebGL-off, reduced motion, pause, context loss, 10 cold loads); 0 external requests |
| 3D on (`is-3d`) | yes at every viewport; 10/10 cold loads |
| Horizontal scroll | none |
| Skip link / nav | skip -> `#main`; table, cloche, wine, menu, reserve focus their section |
| Mobile menu 390x844 | toggle 106x44 with visible "Menu", aria-expanded, Tab cycles, Escape -> toggle, links close + focus target |
| Menu 390x667 / 320x256 | 390x667 fits; 320x256 `#navMenu` scrolls inside (377 px in 256 px), last link "Reserve" by Tab visible (170-228); Escape returns focus |
| Wheel scroll, scene changes | 92/98/95/82 % between stations (1440) |
| Phones / 720x450 | 390x667: table, cloche, wine pour visible above the panels; 720x450 hero panel now leaves the table visible (`720x450_00_table.png`) |
| WebGL off | posters, height 5070-5072 px (font swap only) |
| Reduced motion | pause hidden, stills change (86-98 %), 0 scene fps / 0 rAF idle |
| Pause at first draw | harness (3 loads): 0 scene fps, **0 rAF/s**, frames identical (also with HTML). `qf_pausefirst.py` (3 loads, click at first WebGL draw, 12 samples over 9 s): **draws and rAF counters frozen from the first sample, screenshot hash identical** in all 3 runs; the scene still finishes loading (`is-3d` added while paused) and shows a correct frozen frame (`pause_firstframe_6s.png`); resume works (`pause_firstframe_resumed.png`) |
| Resume | rAF back (90 fps), wheel smooth (35 -> 1000 px), `#reserve` anchor focuses target |
| Context loss/restore | posters during loss, brightness 54.9->50.3, 86.0->91.2, 96.3->94.8 (candle flicker); 0 console errors |
| Debug globals | none |
| Content | placeholders only ([Wine list to be confirmed by the restaurant], [Price], contacts); "Le poisson: A fish course with a light sauce" (no "of the day"); footer present |

Startup 1440: first load longest task 264 ms, first draw 2.7 s, scene on 5.0 s (shared GPU). 10 cold loads: 10/10 3D, longest task median 385 ms (128-502; 4 of 10 over 400 ms), first draw 0.7-1.7 s, scene on median 2.9 s (1.7-3.4 s). Other viewports: 460 ms (1024), 207 (390x844, was 6258), 234 (390x667), 181 (720x450).

FPS 1440 uncapped (GPU quieter now): table 222/107, cloche 176/27, wine 166/5, menu 154/18, reserve 180/6.

### Predecessor defects
- M-1 high (2.9-6.3 s block): **FIXED** (max 502 ms in 14 loads).
- M-2 med (pause at first frame lets intro run 2.5-3.5 s): **FIXED** (0 draws after click, 3/3).
- M-3 med (rAF 228-433/s paused): **FIXED** (0/s).
- M-4 low (720x450 hero hides table): **FIXED**.
- M-5 low ("Fish of the day"): **FIXED**.

### Remaining defects
1. Low. Longest startup task 412-502 ms in 4 of 10 cold loads and 460 ms at 1024 (target ~400 ms).
2. Low (perf). Scene on 5.0 s on the first (warm-up) 1440 load; 1.7-3.4 s on the cold series.

Visual: the most refined: candle-lit table from above, gold charger, cloche reveal with steam, wine pour, ivory menu card. Calm and high-class; the cloche reveal is the wow moment.

## 5. blue-pearl: FAIL (1 med against an explicit requirement, 1 med visual)

Renderer ANGLE (AMD Radeon 780M, D3D11). Screens `screens-final/blue-pearl/`.

| Check | Result |
|---|---|
| Console / page errors / failed requests (WebGL on) | 0 at 5 viewports, reduced motion, pause, context loss, 16 cold loads (only request outside the site: the local `blob:` probe worker) |
| **WebGL off** | posters, `no-3d`, height constant 5934 px, BUT console errors: with injected null contexts 1 error (`THREE.WebGLRenderer: Error creating WebGL context.`); with real Chrome `--disable-webgl --disable-webgl2 --disable-3d-apis` **7 console errors** (`THREE.WebGLRenderer: A WebGL context could not be created. Reason: disabled by enterprise policy or commandline switch` x6 + `Error creating WebGL context`). The other four sites: 0 errors under the same real switch. See B-7 |
| 3D on (`scene-on`) | yes at every viewport; **16/16 cold loads** |
| Horizontal scroll | none |
| Skip link / nav | skip -> `#main`; dive, catch, menu, reserve focus their section (top 84 px under the floating nav) |
| Mobile menu 390x844 | 44x44 toggle, sr text "Menu", aria-expanded, Tab cycles, Escape -> toggle, links close + focus target |
| Menu 390x667 / 320x256 | 390x667 fits; 320x256 `#navMenu` scrolls inside (484 px in 256 px); last link "Reserve a table" reached by Tab (190-246) and by wheel inside the menu (152-208); Escape returns focus |
| Wheel scroll, scene changes | 99.7/99.8/89/83 % between stations (1440) |
| Reduced motion | pause hidden, stills change (82-100 %), 0 scene fps / 0 rAF idle |
| Pause at first draw (3 loads) | aria-pressed true, `motion-off`; **0 scene fps, 0 rAF/s** at load and later; frames identical (with and without HTML) |
| Resume | rAF back (84 fps), wheel smooth (45 -> 999 px), `#reserve` anchor focuses target |
| Context loss/restore | poster during loss, brightness 168.2->172.0, 95.9->99.3, 96.4->95.8; 0 console errors |
| Debug globals | none |
| Content | placeholders only ([Today's catch list], [Price], [Allergen and dietary information], contacts, [Testimonial from a guest]); "Alcohol-free pairing" is a dish name, not a claim; footer present |

Startup 1440: first load longest task **95 ms**, first draw 0.89 s, scene on 1.46 s. **16 cold loads: 16/16 3D**, longest task median 203 ms (max 329), first draw 0.8-2.5 s, scene on median 2.6 s (1.4-4.0 s). Other viewports: 94 ms (1024), 150 (390x844), 184 (390x667), 162 (720x450).

FPS 1440 uncapped, median / spread: surface 86/31, dive 72/28, catch 148/94, menu 170/8, reserve 128/55.

### Predecessor defects
- B-1 high (6.5 s block): **FIXED** (max 329 ms in 17 loads).
- B-2 med (3D lost on ~1 in 3 loads): **FIXED** (16/16 cold loads, plus every other load this session).
- B-3 med (rAF 384-470/s paused): **FIXED** (0/s).
- B-4 low (dive sparse): **NOT FIXED**: scene-only luma SD 13.4 (was 11); still a flat teal gradient with one fish school and bubbles (`1440x900_01_dive_bg.png`).
- B-5 low (invented interior): **FIXED** (now "This sample design is built around that feeling: calm, cool colours and a menu...").
- B-6 low (720x450 hero covers surface): **improved**: panel on the left ~40 %, surface light visible (`720x450_00_surface.png`).

### Remaining defects
1. **B-7 med (explicit brief rule: "no console errors if WebGL is missing"; Done 1: zero console errors in WebGL-off mode).** With WebGL disabled the page falls back correctly but logs 1-7 console errors. Likely cause: `main.js:249` calls `m.prepare(...)` as soon as `scene.js` loads, before and regardless of the probe result at line 250, so `THREE.WebGLRenderer` is constructed even when WebGL is unavailable. Repro: `qf_realnogl.py blue-pearl` (Chrome `--disable-webgl --disable-webgl2 --disable-3d-apis`), read console.
2. **Med (visual, phones; same class as Saffron S-3 last round).** At the catch station the three cards stack and cover almost the whole screen at 390x844 and 390x667, so the seabed / caustics (the 3D point of that station) is hidden; at the dive station the two panels leave only a ~150 px strip with the fish (`390x844_02_catch.png`, `390x667_02_catch.png`, `390x667_01_dive.png`).
3. Low (visual). Dive station still sparse (B-4).

Visual: calm, glassy, clearly underwater; caustic seabed, kelp, coral, and the glowing oyster with pearl at reserve (wow moment). Teal glass panels with coral buttons look premium on desktop. Phone layout is panel-heavy in the middle stations.

## Cross-site summary

| Site | Verdict | Open high | Open med | Longest task 1440 (cold, median / max) | 3D on cold loads | Paused rAF/s |
|---|---|---|---|---|---|---|
| sakura-omakase | PASS | 0 | 0 | 413 / 689 ms | 10/10 | 0 |
| forno-rosso | PASS | 0 | 0 | 204 / 506 ms | 10/10 | 0 |
| saffron-court | PASS | 0 | 0 (1 low-med: rare ~1 s startup task) | 194 / 1232 ms | 10/10 | 0 |
| maison-claire | PASS | 0 | 0 | 385 / 502 ms | 10/10 | 0 |
| blue-pearl | FAIL | 0 | 2 (B-7 WebGL-off console errors; phone panels at catch/dive) | 203 / 329 ms | 16/16 | 0 |

All predecessor high and med defects are fixed on all five sites: startup freezes (now 0.1-0.7 s typical), paused rAF 0 everywhere, Maison pause at first frame, Saffron phone panels, 3D reliability on serve.py (56/56 cold loads), Saffron SC1 slow-frame crash. Zero console errors with WebGL on, zero horizontal scroll, skip link / nav / menus / Escape / 320x256 menus pass on all five.

Noise note: the GPU was shared with the accessibility auditor for sakura, forno and saffron (fps 39-110, cold startup slower); by maison and blue-pearl it was quieter (fps 72-222). Saffron's two ~1 s startup tasks should be re-measured on a quiet GPU.

Not tested: real bfcache Back (Playwright disables it), Firefox/Safari engines, touch gestures (wheel used at phone sizes), screen readers.

---
QA: EvidenceQA (studio-qa-tester), 2026-11-04. Screens: `showcase/qa/screens-final/`. Scripts: `qf_site.py`, `qf_sum.py`, `qf_headings.py`, `qf_pausefirst.py`, `qf_pauseshot.py`, `qf_realnogl.py` in the session scratchpad.
