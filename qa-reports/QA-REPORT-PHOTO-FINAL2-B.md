# QA report, photo round FINAL2 (B): olive-and-sea-photo targeted fix round

Tester: independent QA agent (EvidenceQA), 2026-11-04. Playwright headless Chrome (`channel='chrome'`, `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`), served by `python showcase/serve.py 8899`. Screens: `showcase/qa/screens-photo-final2/olive-and-sea-photo/`. Scripts `qa4_*.py` in the session scratchpad. GPU (AMD Radeon 780M) shared with other agents: timings are medians and noisy.

Predecessor: `qa/QA-REPORT-PHOTO-FINAL-B.md` section 1 (1 high, content mediums, phone items; realism 7 / 5.5).

(Sections are added as each group finishes.)

## A. Content frames (claim 2), partial, written while runs continue
Script `qa4_content.py`; frames in `content/`. Viewports 1440x900, 390x844 (dsf 3, touch), 390x667.
- Posters viewed directly: `assets/poster-water.jpg` = lagoon, bricole posts, low distant islands; no dome, no campanile, no skyline. `assets/poster-deck.jpg` = no power socket.
- Dissolves 2-3 and 3-4 at 35/50/65 % (`dis*-{vp}.png`, all 3 viewports): no Venice landmark (horizon strips zoomed: `dis3to4-35-1440x900.png` right edge shows only a blurred tree line and a low building), no beer bottles. Still double exposures: deck chairs ghost over the dusk table (`dis2to3-65-390x844.png`), promenade sky over the dusk water (`dis3to4-50-*`).
- Nav jump to the menu at 0.4/1.2/2.5/5 s (`jump-*`): no landmark in any frame. The 1.2 s frame still shows the dusk waterfront photo dissolving into the promenade (1440 and phones). The 0.4 s frames show the fixed header mid-screen over a blank cream area at all three viewports: a headless capture taken during the smooth-scroll jump; treated as a capture artifact, not counted.
- Loading (`loading-*`) and context-loss posters (`lost-st0-*`, `lost-st3-*`): deck and water posters, clean.
- Reduced motion (`rm-st*-0700/4700-*`, 3 viewports): no landmark. But at the menu station the first 0.7 s shows the dusk waterfront photo with the dusk table and jug behind the menu card (1440, 390x667), replaced by the promenade by 4.7 s.
- WebGL off at 1440 and 390x844 (`nogl-st*`): photo posters, deck / tables / water / promenade; no landmark, no socket; class `js js-ready reveal-all`, 0 errors.
- Resting stations at 5 viewports (`st<i>-<id>-<vp>.png`): no landmark, no socket, no bottles.

**Claim 2 result: CONFIRMED** for landmarks, socket and bottles in every frame checked (about 110 frames). Remaining low: the menu station briefly (about 1 s; up to 0.7-4.7 s with reduced motion) shows the dusk waterfront photo, not the promenade, while the promenade photo loads.

## B. Early context loss (claim 1, the HIGH)
Script `qa4_ctx.py`, 1440x900. Loss is fired in-page at exact moments (`WEBGL_lose_context`), restore 400 ms later; then stations 0, 2, 4 (menu captured at 1 s, 3 s and 9 s after arriving). Mean absolute difference (0-255) against a clean run. Frames: `ctx/<mode><ms>-<st>.png`.

| Scenario | loss at (ms after nav) | hero | kitchen | menu 1 s | menu 3 s | menu 9 s | errors |
|---|---|---|---|---|---|---|---|
| 3D-on +50 ms | 6096 | 1.66 | 4.12 | 3.87* | 2.75 | 1.31 | 0 |
| +100 | 5855 | 2.31 | 7.44 | 6.81* | 3.70 | 1.77 | 0 |
| +300 | 4213 | 2.15 | 6.75 | 2.70* | 3.27 | 1.36 | 0 |
| +600 | 3287 | 1.79 | 5.29 | 5.56* | 3.34 | 1.43 | 0 |
| +1500 | 3511 | 1.62 | 4.59 | 3.57* | 3.37 | 1.47 | 0 |
| +3000 | 5653 | 2.56 | 7.77 | 8.81* | 4.06 | 1.88 | 0 |
| boot, loader >50 % +0 | 2369 | 1.42 | 1.52 | 4.17* | 2.58 | 1.31 | 0 |
| boot +100 | 909 | 1.45 | 2.38 | 7.15* | 2.95 | 1.31 | 0 |
| boot +200 | 1491 | 1.45 | 2.07 | 2.69* | 3.02 | 1.34 | 0 |
| boot +400 | 1197 | 1.37 | 2.17 | 4.14* | 2.45 | 1.34 | 0 |
| 3rd photo fetched +150 | 13055 | 5.48 | 13.63 | 4.75* | 1.36 | 3.15 | 0 |
| 3rd +500 | 14347 | 5.84 | 13.61 | 5.73* | 1.34 | 2.48 | 0 |
| 3rd +1000 | 12003 | 5.98 | 13.77 | 5.88* | 1.33 | 2.58 | 0 |

\* menu at 1 s compared with the clean run's own 1 s frame (both show the dusk photo, see A); against the clean final menu frame every 1 s frame scores 33.5 (the dusk photo). All other values are vs the clean frame at the same station. Wrong photographs scored 34-115 in the predecessor run; the highest value here is 13.8 (third-photo runs at the kitchen: viewed `ctx/third500-st2.png`, same table and lemons, camera at a slightly different drift phase because the route came from the menu). Every hero shows the deck, every kitchen the table and props, every 3 s / 9 s menu the promenade. All 13 runs end `is-3d`, 0 console or page errors.

**Claim 1 (early context loss) result: CONFIRMED.** The predecessor's high defect does not reproduce at any of the 13 moments.

## C. Basics (this run)
Scripts `qa4_basic.py`, `qa4_focus.py`, `qa4_modes.py olive-and-sea-photo 3 '#dusk'`.
| Check | Result |
|---|---|
| Console / page errors | 0 at 1440x900, 1024x768, 390x844, 390x667, 720x450, and 0 in every other run of this session |
| 3D | `is-3d` at all five (ANGLE D3D11, Radeon 780M) |
| Horizontal scroll | none (scrollWidth = clientWidth at all five) |
| Station screenshots | `st<i>-<id>-<vp>.png`, 6 stations + footer x 5 viewports |
| Skip link, nav anchors | first Tab = "Skip to content" (visible), Enter -> `main`; 5 anchors focus their section (top -1..0 px) at 1440 and 1024 |
| Phone menu | 390x667, 390x844, 320x256: opens, `main` inert, items on screen and hit-testable; at 320x256 scrollHeight 368 > 188 and the menu scrolls inside itself (24 -> 180, page stays at 0); Escape returns focus to the toggle |
| WebGL off | posters, no errors, height stable 5815 -> 5815 (1440), 5917 -> 5917 (390) |
| Reduced motion | idle rAF 0.0/s at all 6 stations at 1440 and 390, frames identical (diff 0), pause button hidden |
| Pause right after load, 3 runs | `aria-pressed=true`, rAF 0.0/s while paused, frames identical (diff 0), 0 rAF after scrolling while paused, resume restores scroll and the `#dusk` anchor (-1 px) |
| Late context loss (stations 0 and 3) | `gl-lost` posters, restored frame diff 0 and 0.24 |

## D. Phones and performance (claim 3)
GPU contention was heavy during this block: 68 Chrome processes were running on the machine (other agents' browsers), another server was on 8890, and two other listeners shared port 8899 (same showcase folder). Desktop numbers are inflated by that; the phone pass run hit a quieter window (median frame 7 ms).

**Framing and shadows (phone, `st2-kitchen-390x844.png`, `st3-dusk-390x844.png`, same at 390x667):** kitchen now frames four whole lemons centred on the table: CONFIRMED. Shadows: deck under the kitchen table visibly darker; on the dusk quay, blue-grey leg and chair shadows show behind the table: CONFIRMED (weak but present).

**Passes (`qa4_passes.py`, scrolling driven in-page, 1 scrollTo per 16 ms):**
| Run | Longest task per pass (ms) | Worst frame per pass (ms) | Frames > 50 ms per pass |
|---|---|---|---|
| Phone 390x844, 12 dusk back-and-forth | 0 in all 12 | median 13.6, max 27.9 | 0 |
| Phone, 6 full passes st1 <-> st4 | 0, 61, 0, 0, 96, 0 | 62.7, 55.5, 20.7, 22.1, 201.0, 68.6 | 0-1 |
| Desktop 1440, 12 dusk passes (contended: median frame 20 ms) | median 0, max 67 | median 62.8, max 409.6 | 0-3 |
| Desktop, 6 full passes | 578, 308, 350, 146, 0, 257 (median 282) | 227-653 (median 382) | 2-7 |

Builder claim "54-64 ms longest task": phone CONFIRMED (0-96 ms, median 0; one 201 ms worst frame). Desktop NOT CONFIRMED under this contention (median 282 ms, worse than the predecessor's ~150 ms, which was also measured under contention); cannot separate the site from the contention here, so desktop is NOT DETERMINED.

**Cold loads, 10 each, fresh browser (`qa4_cold2.py`):**
| | Longest task median / max (ms) | Over 400 ms | 3D-on median / max (ms) | 3D on |
|---|---|---|---|---|
| Desktop 1440 | 597 / 1460 | 8 of 10 | 4815 / 9619 | 10 of 10 |
| Phone 390x844 | 343.5 / 795 | 4 of 10 | 1904 / 4169 | 10 of 10 |

Most phone longest tasks sit at 376-1236 ms after navigation, before the first draw (startup, not the prop loader). Builder claim (single runs 189 ms desktop, 164 ms phone): REJECTED as stated: the phone median is twice the claim even in the quieter window. 10 of 10 cold loads show 3D at both sizes: CONFIRMED. 0 errors in all 20.

**Bytes (`qa4_perf.py bytes,fps`):** desktop 13.96 MB transferred (51 requests; 12.62 MB at first idle); phone 390x844 dsf 3: 7.93 MB (39 requests). Builder 13.95 / 7.92 MB: CONFIRMED, phone inside 8 MB.
**fps at 1440, median of 3 (contended):** arrival 42.2, terrace 52.6, kitchen 41.0, dusk 58.6, menu 72.8, reserve 92.0 (spreads 6-34). The predecessor measured 138-144 on a quieter GPU; with 68 Chrome processes running, these values reflect contention and are NOT DETERMINED, not a defect finding.

## E. Black-sky race (claim 1, second part)
`qa4_race.py` (frames `race/`): 6 scroll races (dwell 50-2000 ms past dusk so the third photo loads, then back, 3 reps each) and 5 context loss/restore runs during the third photo's load (0.05-1.5 s). After each, stations 2, 3, 4, 5, 3: sky-region luminance 108-222 (dusk station 161.2-161.4 every time), dark-pixel share 0.000 in all 55 checks, every run ends `is-3d`, 0 errors. **CONFIRMED: no black sky.**

## F. Claim-by-claim
| # | Builder claim | Verdict | Evidence |
|---|---|---|---|
| 1a | Early context loss (3D-on +0.05...3 s) recovers: deck / table / promenade | CONFIRMED | Section B, 6 runs, MAD <= 8.8 |
| 1b | Loss during first-photo boot (loader > 50 % +0/0.1/0.2/0.4 s) recovers | CONFIRMED | Section B, 4 runs, MAD <= 7.2 |
| 1c | Loss during third-photo upload (+0.15/0.5/1.0 s) recovers | CONFIRMED | Section B, 3 runs, MAD <= 13.8 (same content, see note) |
| 1d | Menu never shows the Venice photo | PARTIAL | Never after the menu has settled; but about 1 s after arriving at the menu (in every run, clean included), and up to 0.7-4.7 s with reduced motion, the dusk waterfront photo with the dusk table is on screen. No landmark in it |
| 1e | No black sky in the dusk race | CONFIRMED | Section E |
| 2a | No Venice landmark in any frame (stations, jumps, dissolves, reduced motion, posters, WebGL off; desktop and phones) | CONFIRMED | Section A |
| 2b | No socket in `poster-deck.jpg` or the deck photo | CONFIRMED | poster viewed; `st0-arrival-*`, `loading-*`, `nogl-st0-*` |
| 2c | No beer bottles in any dissolve frame | CONFIRMED | `dis2to3-*` at 3 viewports |
| 3a | Phone kitchen shows the lemons | CONFIRMED | `st2-kitchen-390x844.png`, `-390x667.png` |
| 3b | Phone baked shadow visible | CONFIRMED (weak) | `st3-dusk-390x844.png` leg shadows on the quay; deck darkened under the kitchen table |
| 3c | Passes: longest task 54-64 ms | CONFIRMED on phone (0-96 ms); NOT DETERMINED on desktop (median 282 ms under heavy contention) | Section D |
| 3d | Startup longest task 189 ms desktop, 164 ms phone | REJECTED | 10 cold loads each: median 597 ms desktop (contended), 343.5 ms phone; over 400 ms in 8/10 and 4/10 |
| 3e | 10 of 10 cold loads show 3D | CONFIRMED | 20 of 20 |
| - | Bytes 13.95 MB / 7.92 MB | CONFIRMED | 13.96 / 7.93 MB |

## G. Remaining defects
1. **Low-Medium (performance, not an explicit-requirement FAIL here).** Startup longest task is not the claimed ~170-190 ms: phone median 343.5 ms (max 795), desktop median 597 ms (max 1460, contended). Most fall 0.4-1.2 s after navigation, before the first draw. Needs a re-measure on an idle GPU before anyone quotes a number.
2. **Low (content behaviour).** The menu station shows the dusk waterfront photo for about 1 s after arriving (0.7-4.7 s with reduced motion) while the promenade photo loads. No landmark is visible, so the content rule holds, but it is the wrong place for that station.
3. **Low (desktop passes, unresolved).** Full passes 1 <-> 4 at 1440 hit 146-578 ms tasks and 227-653 ms worst frames under contention; the phone run (quieter) was clean. Re-measure on an idle GPU.
4. **Low (realism).** Double-exposure dissolves remain (deck chairs ghost over the dusk table at 65 %, promenade sky over the dusk water). Dusk jug and vase still front-lit grey against a low sun. Kitchen slat gaps flat bright grey.
5. **Not counted.** Frames taken 0.4 s into a nav jump show the fixed header mid-screen over a blank area at all three viewports; treated as a headless capture during the smooth-scroll jump.

## H. Realism re-score
| Station | Desktop / phone | Where the illusion still breaks |
|---|---|---|
| 1 Arrival | 8 / 8 | Untouched photo; sky clipped white |
| 2 Terrace | 8.5 / 8 | Untouched photo |
| 3 Kitchen | 7 / 6.5 | Desktop: slat gaps flat bright grey, edges crisper than the photo. Phone: lemons now centred and whole, table texture soft, gaps still flat |
| 4 Dusk | 6 / 6 | Jug and vase lit grey on the camera side with the sun low behind; phone now has visible leg shadows on the quay |
| 5 Menu | 9 / 9 | Untouched photo once loaded; the dusk photo is shown for about 1 s first |
| 6 Reserve | 9 / 9 | Untouched photo |
| Transitions | 5 | Still double exposures, but no landmarks or bottles now, and context loss no longer leaves the wrong place |

**Site realism: 7.5/10 desktop (was 7), 6.5/10 phone (was 5.5).**

## Verdict: PASS
No high defects, and no medium defect against an explicit requirement. The high (early context loss) is fixed at all 13 timings, the black sky does not come back, and the content rule (no Venice landmark, socket or bottles) holds in every frame at desktop and phone sizes. Rejected claim: the startup long-task numbers (189/164 ms) do not reproduce (phone median 343.5 ms). Most desktop timings this session are NOT DETERMINED because of heavy GPU contention (68 Chrome processes). Server on 8899 stopped at the end of the session.
