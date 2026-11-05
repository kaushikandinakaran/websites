# QA report: photo final 2, part C (jade-teahouse-photo targeted fix round)

Tester: EvidenceQA (studio-qa-tester role), 2026-11-04. Server: `python showcase/serve.py 8890`. Playwright headless Chrome (`--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`).
Screens: `showcase/qa/screens-photo-final2/jade-teahouse-photo/`. Scripts: scratchpad `qa5_*.py`.
GPU shared with two other QA agents during this session; busy-ness noted per timing test (count of other headless chrome.exe processes).

## Verdict: PASS

The one medium defect from the last round (startup tasks over the about-400 ms budget) is closed: 0 of 20 cold loads over 400 ms in round B, quiet 1440 median 152.5 ms. No high defects; no medium defect against an explicit requirement. Remaining items are low and about realism.

### Claim-by-claim

| # | Builder claim | My measurement | Result |
|---|---|---|---|
| 1a | Startup 1440 longest-task median 161-184 ms, 0/10 over 400 | quiet: 152.5 ms, 0/10 (max 194); shared: 222 ms, 1/10 (420 at GPU 97%) | CONFIRMED |
| 1b | 390 median 243 ms | 239 ms (shared), 243 ms (partly shared); 1/10 then 0/10 over 400 | CONFIRMED |
| 1c | Heavy sharing: 390 median 599, 9/10 over 400 | not reproduced; my worst window 239 ms, 1/10 | NOT REPRODUCED (pessimistic; no defect) |
| 1d | Worker probe robust; never hangs; no console errors | 3 flags + 8 injected failures: posters or 3D every time, 0 errors, height never changes | CONFIRMED |
| 1e | `--disable-3d-apis` keeps gl layout (8342) with photo posters, 0 errors | 8342 / 8292, 5/5 posters, 0 errors (the worker says "warm"; the page's own getContext fails quietly) | CONFIRMED |
| 2 | Steamer fps 132.4 / 104.6 (moderate sharing) | 143.9 (display cap) moderate sharing; 87.6 at GPU 100% | CONFIRMED |
| 3a | Tea pour has a visible source (tapered stream, bead at lip) | visible at 2x zoom, pot tipped over the cup | CONFIRMED |
| 3b | Pot rests on the table | yes, with matching shadow | CONFIRMED |
| 3c | Dissolves no longer double-expose props | only one prop set at 25/40/55/70%; but the outgoing photo shows through the incoming table at about 55% | CONFIRMED (low remainder) |
| 3d | Steamer weave varies, stains, browned dumplings | visible at 2x zoom | CONFIRMED |
| 3e | Phone has real 512 shadow maps | two 512x512 shadow textures allocated at 390x844 | CONFIRMED |
| 4 | Early context loss: every station right, mean diff 1.5-13 | 1.7-8.9 (noise 1.3-2.2); paused case 6.7-20 (animation phase); right photo and props everywhere, 0 errors | CONFIRMED |
| 5 | Bytes 13.41 MB desktop, about 7.7 MB phone | 13.42 MB / 7.67 MB | CONFIRMED |

### Remaining defects (all low)

1. **Low, realism**: during the photo cross-fades (tea to steamer, menu to reserve) the outgoing photograph is laid over the incoming CG table, so the table looks see-through at about 55% (`real/dissolve-1to2-55-1440x900.png`, `real/dissolve-3to4-55-1440x900.png`).
2. **Low, realism**: steam is straight parallel strands; the tea stream is a hairline; the CG tables are sharper than the photos around them; on phone the table wood looks flat (no normal maps) and fills the screen.
3. **Low, motion**: one stray rAF while assets are still loading: reduced motion at 1440 and 390 (1 in the first 2 s idle window, then 0 at every station), and pause in 1 of 3 runs (2 rAF in the first second, 1 in the next 2 s). Frames stay identical. Not seen after loading finishes.
4. **Info**: a probe worker that errors or answers false keeps posters even where the page could run WebGL2 (conservative, acceptable). Without Worker/OffscreenCanvas the page uses the shorter non-gl poster layout (4922 px), fixed from first paint.

Realism re-score: desktop 7.5/10 (was 7), phone 6.5/10 (was 6).

## 1. Basics at five viewports (qa5_basic.py)

| Viewport | 3D on | Console/page errors | Horizontal scroll | Page height | Renderer |
|---|---|---|---|---|---|
| 1440x900 | yes | 0 | no (sw 1440 = cw) | 8342 | ANGLE AMD Radeon 780M D3D11 |
| 1024x768 | yes | 0 | no | 7216 | same |
| 390x844 (DPR 3, touch) | yes | 0 | no | 8292 | same |
| 390x667 | yes | 0 | no | 6734 | same |
| 720x450 | yes | 0 | no | 3332 | same |

Every station screenshotted at every viewport: `st{0-4}-*-{vp}.png`, `st9-footer-{vp}.png`. Each station differs from the previous (mean diff 36-153), so no station is stuck on the wrong picture.
Observation (not new, low): at the middle of the Menu station at 1440x900 the menu card has scrolled up so its kicker and heading sit under the nav (card top -185 px, `st3-menu-1440x900.png`); the heading is fully visible earlier in the pinned range (`ctx/on3d1500-st3.png`). Design choice for a tall card, not a defect against a requirement.

## 2. Worker probe robustness (qa5_probe.py, qa5_probe2.py)

Waited 9-14 s after load each case. "posters" = 5 of 5 poster elements visible.

| Case | 1440 result | 390 result | Height stable | Errors |
|---|---|---|---|---|
| `--disable-3d-apis` | posters, gl-able layout, stage opacity 0 | same | yes: 8342 / 8292 from first read to 9 s | 0 |
| `--disable-webgl2` | posters, gl-able layout | same | yes 8342 / 8292 | 0 |
| `--disable-webgl --disable-webgl2` | posters | same | yes | 0 |
| `Worker` undefined | posters, non-gl layout (no gl-able) | same | yes 4922 / 5084 (fixed from first paint) | 0 |
| `OffscreenCanvas` undefined | posters, non-gl layout | same | yes 4922 / 5084 | 0 |
| probe Worker constructor throws | 3D on at 6.4 s (4 s fallback then real context) | 3D on at 4.9 s | yes | 0 |

Note: with `--disable-3d-apis` the worker answers `data-gl="warm"` (the OffscreenCanvas in the worker still gets a context in this Chrome build), so the posters are kept by the page-side `getContext` failing silently, not by the probe. Outcome is still right (posters, 0 errors, same height).
Test artefact found and corrected: my first delayed/silent/failing injections replaced `window.Worker` for the whole page, which also replaced the scene's panorama-decoder worker, so 3D never came on. That is not a site defect; re-run with only the first (probe) worker faked: see below.

Re-run, only the head probe worker faked (1440x900, 14 s wait; GPU shared, so times are slow):

| Probe behaviour | Result | data-gl | 3D-on (ms) | Height | Errors |
|---|---|---|---|---|---|
| answer delayed 1.5 s | 3D on | warm | 5908 | 8342 | 0 |
| answer delayed 6 s (past the page's 4 s wait) | 3D on | warm (late) | 6767 | 8342 | 0 |
| never answers | 3D on (4 s fallback) | none | 7414 | 8342 | 0 |
| worker fires `error` | posters kept | no | - | 8342 | 0 |
| worker answers false | posters kept | no | - | 8342 | 0 |
| constructor throws | 3D on (4 s fallback) | none | 9304 | 8342 | 0 |

Verdict: probe is robust (CONFIRMED).

## 3. Early context loss, first time tested on jade (qa5_ctx.py, qa5_ctx2.py)

Lose with WEBGL_lose_context, restore 600 ms later, then wait 9 s, scroll to the middle of every station, wait 5 s, screenshot (`ctx/{mode}{delay}-st{i}.png`). Mean absolute pixel difference (0-255) against a clean load. Noise floor (a second clean load against the first): 1.3-2.2.

| Scenario | st0 arrival | st1 tea | st2 steamer | st3 menu | st4 reserve | Errors | Class after |
|---|---|---|---|---|---|---|---|
| +0.05 s after 3D on | 1.69 | 2.14 | 1.74 | 3.66 | 1.83 | 0 | is-3d |
| +0.3 s | 1.69 | 4.91 | 2.66 | 2.20 | 1.80 | 0 | is-3d |
| +1.5 s | 1.85 | 3.27 | 2.39 | 4.73 | 2.41 | 0 | is-3d |
| during 2nd photo upload (lose 0 ms after its 6144 px texStorage2D) | 2.00 | 8.44 | 4.17 | 3.94 | 2.25 | 0 | is-3d |
| same, +60 ms | 2.60 | 7.30 | 3.40 | 1.98 | 1.99 | 0 | is-3d |
| same, +250 ms | 2.47 | 8.91 | 5.73 | 4.44 | 1.80 | 0 | is-3d |
| while paused (lose, wait 3 s, resume) | 8.72 | 20.04 | 6.73 | 6.94 | 11.36 | 0 | is-3d |

I viewed the highest-difference frames (`second250-st1/st2`, `paused0-st1`, `on3d1500-st3`, `on3d300-st1`): every station shows the right photograph (garden for 0/1/4, dining room for 2/3) and its props. The higher numbers are animation phase (tea stream on or off, steam), and in the paused run the pour sequence restarted after resume. No wrong photo, no missing prop, no black frame. Builder's "1.5-13" range: CONFIRMED (mine 1.7-8.9 outside pause, 6.7-20 for the paused case, explained by animation phase).

## 4. Modes, navigation, bytes, content (qa5_modes.py, qa5_focus.py, qa5_skip.py, qa5_perf.py bytes)

- **WebGL off** (`--disable-webgl --disable-webgl2 --disable-3d-apis`): 5 of 5 posters shown, height 8342 (1440) and 8292 (390) at 0.5 s and 4.5 s (stable, equal to the gl layout), 0 errors. `nogl-*.png`. PASS.
- **Reduced motion**: motion button hidden, 3D on, frames identical over 1.5 s (diff 0), 0 rAF per second at every station. Over the first 2 s idle window 1 stray rAF was counted (0.5/s) at both 1440 and 390 while assets were still loading (`is-loaded` not yet set). Low.
- **Pause right after load, 3 times**: aria-pressed true; run 1 counted 2 rAF in the first second and 1 in the next 2 s (assets still loading); runs 2 and 3: 0 and 0. Frames identical (diff 0) in all 3; scroll while paused moves the page (900 px) with 0 rAF; resume gives 226-317 rAF/s; nav anchor works after resume. PASS with the same low note (one stray loading-time rAF in 1 of 3 runs).
- **Context restore (paused) at arrival and steamer**: back to is-3d, 0 errors, diff to before 0 and 2.3 (steamer: steam phase). PASS.
- **Skip link**: first Tab focuses "Skip to content"; it slides in (visible at top 12 px within 100 ms at 1024, 1440, 720); Enter moves focus to `#main`. PASS.
- **Nav anchors** (1440 and 1024): The pour, Dim sum, Menu, Reserve each move focus to their section; footer "Back to the entrance" returns to 0 and focuses `#arrival`. PASS.
- **Mobile menu** 390x667, 320x256, 390x844: opens, aria-expanded true, main inert, Tab order stays in the menu, Escape closes and returns focus to the toggle, menu link focuses `#menu`. At 320x256 the menu scrolls (scrollHeight 278 > 256, wheel moves scrollTop 10 to 22, page does not scroll) and the last link is reachable and clickable. PASS.
- **Bytes** (page plus visiting every station): 1440x900 **13,418,604 B (13.42 MB)**, 34 requests; 390x844 **7,673,518 B (7.67 MB)**, 30 requests (4k panoramas, no normal/ARM maps). Builder 13.41 MB / about 7.7 MB: CONFIRMED.
- **Phone shadow maps**: texture allocation hook on the stage context: phone (390x844) allocates two 512x512 RGBA8 render textures (sun and key shadow maps), desktop allocates 1024x1024 ones. CONFIRMED (code: `scene.js:273, 332`, `shadowMap.enabled = true` for all tiers).
- **Content rules**: every price is `[Price]`; phone, address, hours, reservation link and testimonial are bracketed placeholders; the tea list note and "Illustrative dish in a sample photograph" note are present; no real venue named (credits say the photographed places are sample scenery and are not named); footer: "Sample design by Website Studio. Photographs and 3D assets: Poly Haven (CC0); the places shown are sample scenery, not this restaurant."; `assets/CREDITS.txt` lists both panoramas, authors and derived files. PASS.

## 6. Timing (run last; qa5_timing.py)

Each cold load = a fresh headless Chrome process, PerformanceObserver `longtask` (buffered) from navigation, 8 s after 3D on. "Busy" = other agents' headless Chrome browsers running and total GPU 3D-engine utilisation sampled just before each load.

**Round A** (other headless browsers 3 then 2; GPU 3D 11-103%, mostly 55-100%: heavily shared):

| | Longest-task median | Over 400 ms | Max | 3D-on median | 3D on | Errors |
|---|---|---|---|---|---|---|
| 1440x900 | 222 ms | 1 of 10 (420, GPU 97%) | 420 | 3031 ms | 10/10 | 0 |
| 390x844 | 239 ms | 1 of 10 (480, GPU 99%) | 480 | 2397 ms | 10/10 | 0 |

The longest task is now the scene setup task at about 0.7-2 s; the second-longest is under 210 ms. Previous QA: median 495 ms, 8 of 10 over 400.

FPS (1440x900, rAF rate, 3 x 2 s per station; display cap is 144 Hz): steamer 143.9 / 143.9 / 143.9 (median 143.9), Menu 143.9, Reserve 143.9, Arrival 143.9, tea 111 (94.6-143.9, GPU 95%). Other browsers: 2 then 1 during the run. Steamer was 64 in the previous QA: CONFIRMED and better than the builder's 132.4 (it is at the display cap).

**Round B** (repeat; 1440 run mostly QUIET: 0-1 other browsers, GPU 11-30% in 8 of 10 loads; 390 run became shared again from load 4: 2 other browsers, GPU 30-96%):

| | Longest-task median | Over 400 ms | Max | 3D-on median | 3D on | Errors |
|---|---|---|---|---|---|---|
| 1440x900 | 152.5 ms | 0 of 10 | 194 | 1837 ms | 10/10 | 0 |
| 390x844 | 243 ms | 0 of 10 | 353 | 2123 ms | 10/10 | 0 |

FPS round B (2 other browsers, GPU 53-100%): steamer 94.4 / 82.9 / 87.6 (median 87.6 at GPU 100%), Menu 143.9, Reserve 133.0, Arrival 129.5, tea 108.5.

Startup verdict: across 40 cold loads, 2 were over 400 ms (420 and 480), both with the GPU at 97-99% from other agents; 0 of 20 in round B. Quiet 1440 median 152.5 ms (builder 161-184: CONFIRMED), 390 median 239-243 ms (builder 243: CONFIRMED). The "about 400 ms" budget is now met; the previous medium defect is closed. I did not reproduce the builder's heavy-sharing figure (390 median 599, 9 of 10 over 400): my worst window gave 239 ms and 1 of 10, so the builder's number is pessimistic, not optimistic.

## 5. Realism (qa5_real.py, qa5_zoom.py; `real/` folder)

Evidence: `real/st{0-4}-{1440x900,390x844}-{a,b}.png`, dissolves `real/dissolve-{0to1,1to2,3to4}-{25,40,55,70}-{vp}.png`, 2x zooms `real/zoom-st1-*.png`, `real/zoom-st2-*.png`.

- **Tea pour**: CONFIRMED. At 2x zoom (`zoom-st1-0.png`) the pot is tipped toward the cup, the spout tip sits over the cup rim and a thin tapered amber stream with a small bead at the lip falls into the cup; at the end of the range (`zoom-st1-u95.png`) the pot is upright, the stream gone, the cup filled. The source is now visible. Remaining: the stream is very thin (2-3 px at 1440) and reads as a line rather than liquid; the pot tips only slightly for a pour that strong.
- **Pot rests on the table**: CONFIRMED. Pot base sits on the table top beside the cup saucer with a matching soft shadow; no float visible.
- **Dissolves no longer double-expose props**: CONFIRMED for props (at 25/40/55/70% only one prop set is ever visible: the tea table fades out before the steamer table appears, and the reverse at 3 to 4). Remaining break: during the 1 to 2 and 3 to 4 photo cross-fades, the outgoing photograph is laid over the incoming props: at 55% garden pebbles are visible across the steamer table top (`dissolve-1to2-55-1440x900.png`) and dining-room bricks and lamp flares are visible across the garden tea table (`dissolve-3to4-55-1440x900.png`), so the table reads as see-through for about half a second of scroll.
- **Steamer**: weave varies in tone (not uniform herringbone), the paper liner has holes/stains, dumplings have pleated tops with slight browning (`zoom-st2-0.png`). CONFIRMED. Remaining: steam is drawn as straight, near-parallel vertical strands (reads CG); dumplings still look a little waxy and few (4) for a full basket.
- **Phone shadows**: CONFIRMED (512 maps, cast shadows visible under pot and cups in `st1-tea-390x844.png`).

Re-score: **desktop 7.5/10** (was 7), **phone 6.5/10** (was 6). Where the illusion still breaks: (1) the photo cross-fades show the other photograph through the CG table (see-through table at mid-dissolve); (2) the CG tables are sharper and cleaner than the soft photographs around them (no matching grain/softness), so they read as inserted; (3) steam strands are straight and parallel; (4) the tea stream is a hairline; (5) phone: the table fills most of the screen at low texture detail (no normal maps), so the wood looks flat and smeared next to the photo.
 Never hangs, never logs errors, height never changes. Design note (info): a worker that errors or answers false keeps the posters even where the page itself could run WebGL2 (conservative, acceptable).

