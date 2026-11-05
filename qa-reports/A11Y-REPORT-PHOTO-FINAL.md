# Final accessibility re-check: 5 photo restaurant sites, WCAG 2.2 AA

Auditor: independent accessibility auditor. Date: 2026-11-04. No site files were edited. Server `python showcase/serve.py 8897` only, one site at a time.
Why: the first audit (`A11Y-REPORT-PHOTO.md`) ran partly while the scenes were being rebuilt (new photos, grades, tables, fire animation, posters). This re-check repeats the method on the current files, with the focus on text contrast over the new scenes and on flashing.

Method (scripts `ap2_*.py`, `ap2_run.sh` in the session scratchpad, logs in `scratchpad/ap2/<site>_*.log`; Edge headless via Playwright, every browser closed after each run; axe-core 4.x from the scratchpad only; scene runs wait for `html.is-3d` and a settle time before sampling):
- Contrast over the real pixels: text hidden, screenshot, text colour composited on the pixels behind each glyph box, 5th percentile vs 4.5:1 / 3:1. Every text node at 1440x900 and 390x844: fine pass (scroll steps of 22% of the viewport, 1.4 s settle: every station and the in-between dissolve positions), mid-transition pass (70% steps, 0.38 s: captured while the camera and the photo dissolves are still moving), reduced motion 390, WebGL-off posters 1440 and 390.
- axe-core (WCAG 2.0/2.1/2.2 A+AA + best-practice) at 1440 and 390 (normal, reduced motion, WebGL off), 720x450, 320x256, 320x568, after a scroll pass.
- Keyboard walkthrough at 1440 and 390 with the focus ring measured on the real pixels (each side >= 3:1 along >= 90%); skip link; nav anchors (focus target, next Tab).
- Mobile menu at 320x256, 390x667, 320x568 (fit or scroll, focused item clear of the header and window edge, loop, Escape and focus return, `inert`).
- Pinned panels and reflow at 320x256, 320x568, 390x667, 720x450 (every heading, paragraph, menu row, button reachable).
- Pause motion (name = visible text, `aria-pressed`, draws and rAF), reduced motion.
- Flash: repaint capture at 5 scroll positions (1440, 390): luminance swings per second for the whole frame and 4x4 tiles (about 341x256 at 1024x768); extra high-rate capture of the ember-and-oak fire; code read of the fire, dissolves and zooms.

Not done: no NVDA, JAWS, VoiceOver or voice-control session (accessibility-tree only); no Windows forced colours; no real phones. Headless Edge shares the GPU with other agents, so frame rates are low; fast flicker is also checked in the source.

## 1. himal-chulo-photo: PASS (no WCAG 2.2 AA failure found in the tested scope)

Full battery (contrast 1440/390 fine and mid-transition, 390 reduced motion, WebGL-off 1440/390; axe in 9 configurations; keyboard, ring, menu, panels, reflow, pause, flash). Console: no errors (one `CONTEXT_LOST_WEBGL` warning at teardown of the 1440 run, no visible effect).

Checked and clean:
- Contrast over the new 6k restaurant photo, new table and lights, every text node: 1440 fine (48 steps) lowest 8.33:1 (`h1` "Chulo"), 390 fine (46 steps) 8.23:1; mid-transition 1440 8.33:1; reduced motion 390 8.23:1; WebGL-off 1440 7.53:1 ("Hours" `dt`), 390 8.86:1. Nothing below 4.5:1 in any settled or dissolving state. One mid-transition sample at 390 (`[Testimonial from a guest]` placeholder, scroll 6490) reads 3.66:1 at the 5th percentile but 11.73:1 median: its box is at y 819-840 of an 844px window while the smooth scroll was still moving between the text-on and text-off screenshots, so part of the glyph box was compared with the wrong pixels; the same text is above 8.6:1 in every settled pass. Measurement case, not counted.
- axe: 0 violations in 9 configurations (1440/390 normal, reduced motion, WebGL off; 720x450; 320x256; 320x568); only `color-contrast` incomplete (text over the canvas, covered by the pixel scan). No horizontal scroll.
- Structure: one `h1`, `h2` per station, `h3` dishes; header, `nav[Primary]`, main, footer, `nav[Footer]`; canvas `aria-hidden`, not in the accessibility tree; no unnamed controls.
- Skip link: first stop, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#arrival`, `#kitchen`, `#table`, `#tea`, `#menu`, `#reserve` and mobile `#table`: focus on the section, menu closes, next Tab continues.
- Focus ring: 18 stops (1440), 14 (390), all sides >= 3:1 on the real pixels (one 1440 side 97% of its length, above the 90% rule). One 390 reading (footer brand, bottom side 0) is the browser scrolling the last-but-five stop flush to the window bottom, same as in the first audit; not a site defect.
- Mobile menu: 320x256 is a 196px scroll container under the header (`overflow-y:auto`, `data-lenis-prevent`), wheel scrolls the menu (0 -> 101), page stays. Tab now brings "Menu" to 195-243 and "Reserve" to 183-231 in the 256px window (>= 13px clear): **HC-P1 from the first audit is fixed**. 390x667 and 320x568 fit. Loop brand, 5 links, Pause, Menu; Shift+Tab loops; `main` and `footer` `inert`; Escape closes, focus back on Menu, `inert` cleared.
- Panels / reflow: 0 of 40 panel elements unreachable at 320x256, 320x568, 390x667; 0 of 61 page elements unreachable at 720x450, 320x256 (normal and reduced motion), 320x568; no horizontal overflow.
- Pause motion: name "Pause motion" = visible text, constant; `aria-pressed` false/true/false; 44px (44x44 at 390). Paused: 0.0% difference, 0 draws, 0 rAF, 0 infinite animations at 7 of 9 positions; at 75% and 88% the camera finished gliding to the just-scrolled position (1014 and 308 draws, then 0): scroll-following, not idle motion. Reduced motion: 0 draws, 0 rAF at all 9 positions.
- Flash / vestibular: largest tile luminance change 1.6% (1440) and 2.9% (390), 0 swings >= 0.1 per second at 5 positions, including the room dissolve. Camera moves damped and scroll-driven; Pause and reduced motion stop them.

Findings: none.

## 2. ember-and-oak-photo: PASS (no WCAG 2.2 AA failure found in the tested scope)

Battery: contrast 1440/390 fine and mid-transition, WebGL-off 1440/390; axe in 7 configurations (1440/390 normal, reduced motion, WebGL off; 320x256); keyboard, ring, menu, panels, reflow, pause, flash, plus a high-rate fire probe. Console: no errors.

Checked and clean:
- Contrast over the new `warm_bar` photo (CG table gone, new fire), the cellar and dinner panoramas and every dissolve: 1440 fine (46 steps) lowest real text 5.68:1 (`span.kicker__no` "02" at scroll 3168, box at y 68 touching the header edge; median 8.09), 390 fine (49 steps) 6.02:1 (kicker "05"); mid-transition 1440 6.65:1 (`p.note` "Sample scene: stock…"), 390 7.27:1; WebGL-off posters 1440 and 390 8.01:1. One sample, `a.btn--primary` "Reserve a table" at scroll 7920 (fine) and 8190 (mid), reads 1.01:1 at the 5th percentile but 8.11:1 median, the same value as its solid button everywhere else: its box (y 73-86) sits on the bottom edge of the fixed header while it scrolls under it. Measurement case (also seen in the first audit), not counted.
- axe: 0 violations in 7 configurations; only `color-contrast` incomplete. No horizontal scroll.
- Structure: one `h1`, `h2` per station, `h3` menu groups; landmarks; canvas `aria-hidden`; no unnamed controls.
- Skip link: first stop, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#fire`, `#board`, `#cellar`, `#menu`, `#reserve` and mobile `#cellar`: focus on the target section, menu closes, next Tab continues.
- Focus ring: 17 stops (1440) and 13 (390), all four sides >= 3:1 on the real pixels, no gaps.
- Mobile menu: full-height panel; 320x256 scrolls inside itself (wheel 0 -> 34, page stays); Tab keeps every item clear of the 66px header and >= 12px inside the window ("Reserve" 200-244, Shift+Tab "Menu" 152-196); 390x667 and 320x568 fit. Loop brand, 4 links, Pause, Menu; `inert` on main and footer; Escape returns focus to Menu, `inert` cleared.
- Panels / reflow: 0 of 37 panel elements unreachable at 320x256 (normal and reduced motion), 320x568, 390x667 (sticky 667px stations, panels 242-415px; menu panel 1017px scrolls normally); 0 of 53 page elements unreachable at 720x450, 320x256 (normal and reduced motion), 320x568.
- Pause motion: name = visible text "Pause motion" (CSS capitals), constant; `aria-pressed` toggles; 44px (44x44 at 390). Paused: 0.0% difference, 0 infinite animations, 0 draws at 7 of 9 positions and 19/37 draws (1 rAF) at 38%/50% while the camera reached the newly scrolled position. Fire flicker and grain freeze (`clock` only advances when not paused, `scene.js` line 547). Reduced motion: 0 draws, 0 rAF at all 9 positions; `flick = reduce ? 1 : …` (line 499).
- Flash (2.3.1), new fire animation: code: global flicker `1 + 0.05 sin(6.1t) + 0.035 sin(13.7t) + 0.02 sin(23.3t)` (max +-10.5%, 1.0 to 3.7 Hz) on the light and the hearth area; the flame warp (`scene.js` lines 81-93) moves the photo's own flame pixels a few thousandths of the texture and breathes their brightness 0.82-1.16 with smooth value noise, only inside the fire bed (about 11 x 6 degrees of the panorama). Measured with scene time slowed 5x (rAF timestamps scaled) so the capture reached 12-16 scene fps at 1440 and 50-66 at 390, 4 scene-seconds at `#fire`, `#board` (closer to the flames) and mid-`#board`: whole-frame luminance change 0.4-0.8%, worst 341x256 window change 0.8-4.9%, 0 window or whole-frame flashes; no pixel area flashes 3 or more times per second (highest single-pixel rate 1.04 per second); 0 of every 341x256 window. The normal-speed probe agrees (0 swings, largest tile change 3.2% at the fire at 390). Well under the general flash threshold.

Findings: none.

## 3. flour-and-fig-photo: PASS (no WCAG 2.2 AA failure found in the tested scope; 1 minor item)

Battery as for ember-and-oak-photo (no fire probe). Console: no errors.

Checked and clean:
- Contrast over the new grade, darker table and re-made panoramas (6k dining room), every text node: 1440 fine (51 steps) lowest 5.07:1 ("Telephone" `dt`), 390 fine (52 steps) 5.06:1 ("Hours" `dt`); WebGL-off posters 5.61:1 (1440), 5.20:1 (390). Every settled state passes. The eyebrow kickers now read 6.27:1 (390) and 6.40:1 (1440), up from 4.90:1: **FF-P1 from the first audit is resolved**. `span.sr-only` "to the pastry" (1px visually hidden text) prints as a failure; measurement case.
- axe: 0 violations in 7 configurations; only `color-contrast` incomplete. No horizontal scroll.
- Structure, skip link and anchors (`#morning`, `#pastry`, `#cake`, `#pour`, `#menu`, `#reserve`, mobile `#cake`): as in the first audit, all correct; canvas `aria-hidden`; no unnamed controls.
- Focus ring: 19 stops (1440) and 15 (390), all four sides >= 3:1 on the real pixels, no gaps.
- Mobile menu: 320x256 is a 196px scroll container under the header; wheel scrolls the menu (0 -> 132), page stays; Tab brings "Menu" to 160-216 and "Visit" to 188-244 (12px clear); 390x667 and 320x568 fit. Loop brand, 5 links, Pause, Menu; `inert`; Escape returns focus to Menu.
- Panels / reflow: 0 unreachable at 320x256 (normal and reduced motion), 320x568; 0 of 67 at 720x450. At 390x667 the checker again flags the hero kicker because its box overlaps the box of the italic "&" in the `h1` by 2px; glyphs do not touch (same as first audit). Not a defect.
- Pause motion: name = visible text, `aria-pressed` toggles, 44px. Running: 4 to 36% of pixels change per 1.5 s (grain, steam, camera drift). Paused: 0.0% difference, 0 draws, 0 rAF, 0 infinite animations at all 9 positions; pointer no effect. Reduced motion: 0 draws, 0 rAF at all 9 positions.
- Flash: largest tile luminance change 2.2% (1440) and 0.3% (390, 23-26 fps), 0 swings.

Findings:
- FF-F1 (Minor, advisory, not a WCAG failure). During the scroll-in reveal (GSAP `opacity: 0` -> 1 over 0.9 s with a 0.09 s stagger, `main.js` line 171), text passes through partial opacity, and in those frames it is below 4.5:1 over the light photographs: mid-transition samples `h3.menu-h` "Pastry" 3.05:1 and `span.price` "[Price]" 3.38:1 at 390 (opacity 0.71, scroll 5310), `p.note` "Illustrative cake. [Your cake list]" 3.56:1 at 1440 (opacity 0.73, scroll 3150). The same nodes are 5.33-6.66:1 once settled, and the fade is a short entry transition, so it is not counted as a 1.4.3 failure. Optional fix in `main.js` line 171: animate only `y` for text-only elements (`.menu-h`, `.price`, `.note`), or shorten their fade to <= 0.4 s, so low-contrast frames are not readable states.
## 4. olive-and-sea-photo: PASS (no WCAG 2.2 AA failure found in the tested scope)

Battery as for flour-and-fig-photo. Console: no errors.

Checked and clean:
- Contrast over the new dusk camera, retouched deck, relit props and softer grade, including the bright deck and sea: 1440 fine (58 steps) lowest 5.14:1 (`span.price` "[Price]", box at y 64 at the header edge; median 6.25), next 5.68:1 (`p.kicker` "From the kitchen"); 390 fine (60 steps) 5.58:1 (same kicker); mid-transition 1440 5.88:1, 390 5.58:1; WebGL-off posters (`assets/poster-*.jpg`) 1440 6.04:1, 390 5.73:1. The dusk paragraph "A table at the water's edge…" reads 1.40:1 at the 5th percentile (median 8.02) in one WebGL-off 1440 sample at scroll 3150 because its box (y 64-86) meets the bottom of the fixed header as it scrolls under it; measurement case, same as the first audit.
- axe: 0 violations in 7 configurations; only `color-contrast` incomplete. No horizontal scroll.
- Structure, skip link (focuses `main#main`, next Tab "Reserve a table") and anchors `#arrival`, `#terrace`, `#kitchen`, `#dusk`, `#menu`, `#reserve`, mobile `#kitchen`: all correct; canvas `aria-hidden`; no unnamed controls.
- Focus ring: 17 stops (1440) and 13 (390), all four sides >= 3:1 on the real pixels (sky and water included), no gaps.
- Mobile menu: 320x256 is a 188px scroll container under the 68px header; wheel scrolls the menu (0 -> 180), page stays; Tab keeps every item >= 12px inside the window ("Dusk" 188-244, "Sample menu" and "Reserve" 168-224; Shift+Tab "Kitchen" 148-204); 390x667 and 320x568 fit. Loop brand, 5 links, Pause, Menu; `inert`; Escape returns focus to Menu.
- Panels / reflow: 0 of 37-39 panel elements unreachable at 320x256 (normal and reduced motion; sticky stations shrink to 302-423px), 320x568, 390x667 (menu panel 596 of 599px); 0 of 52-55 page elements unreachable at 720x450, 320x256 (normal and reduced motion), 320x568.
- Pause motion: name = visible text, `aria-pressed` false -> true, 44px. Paused and reduced motion: 0.0% difference, 0 draws, 0 rAF at all 9 positions; pointer no effect.
- Flash: largest tile luminance change 0.2% (1440) and 0.3% (390, 22-25 fps), 0 swings; the day-to-dusk change is a scroll-driven cross-dissolve.

Findings: none.

## 5. jade-teahouse-photo: PASS (no WCAG 2.2 AA failure found in the tested scope)

Battery as for flour-and-fig-photo. This site had no completed section in the first audit, so this is its first full result. Console: no errors.

Checked and clean:
- Contrast over the retouched photos, the wider steamer on its real table and the plain render-target stations: 1440 fine (44 steps) and 390 fine (46 steps) lowest real text 5.31:1 (`span.kicker__no` "04", `em` "warm lights.", `span.dish__price` "[Price]": constant 5.31 at every position, so these sit on the solid light panel, not on the photo); mid-transition 1440 and 390 5.31:1; WebGL-off with the new photo posters 1440 5.13:1 (`span.brand__name` in the header over the arrival poster, median 6.27), 390 5.28:1. Low readings for `span.dish__name` (1.02:1 p5, 7.86 median) and `span.dish__price` (2.74:1 p5, 5.31 median) at scroll 5544/5670 (1440), 3150 (WebGL off) and 2954 (390 WebGL off) all have boxes at y 63-89, on the bottom edge of the fixed header while they scroll under it; measurement case, not counted.
- axe: 0 violations in 7 configurations; only `color-contrast` incomplete. No horizontal scroll.
- Structure: title "Jade Teahouse | Tea house and dim sum, photo edition (sample design)"; one `h1`, `h2` per station ("Tea, poured with patience." etc.), `h3` "From the steamer" and "Tea and small plates" under the menu `h2`, footer `h2`s; header, `nav[Primary]`, main, footer, `nav[Footer]`; canvas `aria-hidden`, not in the accessibility tree; no unnamed controls.
- Skip link: first stop, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#arrival`, `#tea`, `#dimsum`, `#menu`, `#reserve` and mobile `#dimsum`: focus on the target section, menu closes, next Tab continues.
- Focus ring: 17 stops (1440) and 13 (390), all four sides >= 3:1 on the real pixels, no gaps.
- Mobile menu: full-height panel; 320x256 scrolls inside itself (wheel 0 -> 22, page stays); Tab keeps every item below the header and >= 12px inside the window ("Reserve" 200-244; Shift+Tab "Menu" 156-200, "Dim sum" 112-156); 390x667 and 320x568 fit. Loop brand, 4 links, Pause, Menu; `inert` on main and footer; Escape returns focus to Menu, `aria-expanded=false`, `inert` cleared.
- Panels / reflow: 0 of 37 panel elements unreachable at 320x256 (normal and reduced motion), 320x568, 390x667 (sticky 568/667px stations); 0 of 52-53 page elements unreachable at 720x450, 320x256 (normal and reduced motion).
- Pause motion: name "Pause motion" = visible text, `aria-pressed` false -> true, 44px (44x44 at 390). Running: 2 to 40% of pixels change per 1.5 s (steam, lid, camera). Paused and reduced motion: 0.0% difference, 0 draws, 0 rAF, 0 infinite animations at all 9 positions; pointer no effect.
- Flash: largest tile luminance change 0.4% (1440) and 0.3% (390, 25 fps), 0 swings. The lid "settle" (`scene.js` line 482) is a damped 0.05 position wobble, not a light change.

Findings: none.

## Summary

| Site | Verdict | Findings |
|---|---|---|
| himal-chulo-photo | PASS | none (HC-P1 menu-ring clipping from the first audit is fixed) |
| ember-and-oak-photo | PASS | none; new fire animation measured: 0 flashes, no 341x256 area flashing |
| flour-and-fig-photo | PASS | FF-F1 Minor advisory (reveal fade passes through < 4.5:1 frames on light panels); FF-P1 kicker margin resolved (4.90 -> 6.27:1) |
| olive-and-sea-photo | PASS | none |
| jade-teahouse-photo | PASS | none |

Lowest settled text contrast over the new scenes: himal 8.23:1, ember 5.68:1, flour 5.06:1, olive 5.14:1, jade 5.31:1. Every low reading printed by the scanner was traced to a measurement case (glyph box on the fixed-header edge, moving smooth scroll, visually hidden `sr-only` text) or to a mid-fade entry animation.

Not tested: screen readers (NVDA, JAWS, VoiceOver, TalkBack), voice control, Windows forced colours / high contrast, real phones, browser zoom by keyboard (reflow was tested by viewport size), 720x450 and 320x568 axe on ember/flour/olive/jade (run on himal), reduced-motion contrast on ember/flour/olive/jade (reduced motion snaps to the same station stills sampled in the fine pass). Flash capture at normal speed is a few to 25 fps; the ember fire was additionally sampled at 12-66 scene fps with slowed time and its code read.
