# Accessibility audit: 5 restaurant sites on real 360° photographs, WCAG 2.2 AA

Auditor: independent accessibility auditor. Date: 2026-11-04. No site files were edited. Server `python showcase/serve.py 8893` only, one site at a time.
Sites: `sites/himal-chulo-photo`, `sites/ember-and-oak-photo`, `sites/flour-and-fig-photo`, `sites/olive-and-sea-photo`, `sites/jade-teahouse-photo` (never audited before).

Method (scripts `ap_*.py` and `ap_site.sh` in the session scratchpad, logs in `scratchpad/ap/<site>_*.log`; Edge headless via Playwright, `--use-angle=d3d11`, every browser closed after each run; axe-core 4.x loaded from the scratchpad only; every scene run waits for `html.is-3d` before sampling):
- axe-core (WCAG 2.0/2.1/2.2 A+AA + best-practice) at 1440x900 and 390x844 (normal, reduced motion, WebGL off), 720x450, 320x256 and 320x568, after a full scroll pass.
- Keyboard: Tab walkthrough at 1440 and 390 with the focus indicator measured against the real pixels (focused vs blurred screenshot, motion paused; each side needs a >= 3:1 change along >= 90% of its length); skip link; every nav anchor and a mobile-menu anchor (where focus lands, next Tab).
- Mobile menu at 320x256, 390x667, 320x568: fit or scroll inside itself, focused item inside the window, Tab and Shift+Tab loop, Escape and focus return, `inert` background, wheel.
- Pinned panels and reflow (1.4.10): every heading, paragraph, menu row, link and button must be fully visible below the header at some scroll position (320x256, 320x568, 390x667, 720x450; also reduced motion at 320x256); horizontal overflow.
- Pause motion: name vs visible text (2.5.3), `aria-pressed`, Enter/Space, screenshot difference, WebGL draw calls and rAF callbacks per 1.5 s at 9 scroll positions (running, paused, reduced motion), running infinite CSS animations (film grain, scroll cue).
- Text contrast over the rendered photograph: text hidden, page screenshotted, text colour composited on the real pixels behind each glyph box; 5th-percentile ratio vs 4.5:1 / 3:1. Fine pass at 1440 and 390 (scroll steps of 22% of the viewport, 1.4 s settle, so every station AND the panorama cross-dissolves in between are sampled), plus reduced motion, WebGL-off posters, 720x450, 320x256.
- Flash / vestibular: repaint-burst capture (4 s at 5 scroll positions, 1440 and 390), screen-tile luminance swings; source read for flicker, dissolves and camera moves under reduced motion.

Not done: no NVDA, JAWS, VoiceOver or voice-control session (screen-reader remarks come from the Chromium accessibility tree); no Windows forced-colours run; no real phones. Headless Edge shares the GPU with other agents, so frame rates are low; the flash capture rate (a few fps) can miss very fast flicker, so flame and light code was also read. This is not a claim of full conformance.

## 1. himal-chulo-photo: PASS (no WCAG 2.2 AA failure found in the tested scope; 1 minor item)

Full battery (all configurations listed in the method). Console: no errors, no failed requests in any run.

Checked and clean:
- axe: 0 violations in all 9 configurations (1440/390 normal, reduced motion, WebGL off; 720x450; 320x256; 320x568). Only `color-contrast` "incomplete" (text over the canvas), covered by the pixel scan. No horizontal scroll at any size.
- Structure: title "Himal Chulo | Indo-Nepali kitchen, photo edition (sample design)"; one `h1`, `h2` per station, `h3` dishes, footer `h2`s; header, `nav[aria-label=Primary]`, main, footer, `nav[aria-label=Footer]`; canvas inside `div.stage[aria-hidden=true]`, not in the accessibility tree; no unnamed links or buttons.
- Skip link: first Tab stop, visible, Enter focuses `main#main`, next Tab "Reserve a table". Anchors `#arrival`, `#kitchen`, `#table`, `#tea`, `#menu`, `#reserve` (1440) and mobile `#table` (390): focus lands on the target section, menu closes, next Tab continues in DOM order.
- Focus ring: 18 stops at 1440, 14 at 390, all four sides >= 3:1 against the real photo pixels (3px `#ffd58a` outline + 6px `rgba(10,6,4,.95)` halo; skip link inverted). One 390 reading (footer brand, bottom side) is the browser scrolling it flush to the window edge, not a site defect.
- Mobile menu: 320x256: 196px scroll container (`overflow-y:auto`, `data-lenis-prevent`), wheel scrolls the menu (scrollTop 0 -> 101) and not the page; 390x667 and 320x568: all items fit. Loop: brand, 5 links, Pause, Menu, back; Shift+Tab loops; `main` and `footer` `inert`; Escape closes, `aria-expanded=false`, focus back on Menu, `inert` cleared. No item under the header.
- Pinned panels / reflow: no sticky panels. 0 of 40 panel elements unreachable at 320x256, 320x568, 390x667, 320x256 reduced motion; 0 of 61 page elements unreachable at 720x450, 320x256 (normal and reduced motion) and 320x568; no horizontal overflow.
- Pause motion: name "Pause motion" = visible text, constant; `aria-pressed` false/true/false; Enter pauses, Space resumes; 44px tall (44x44 icon-only at 390). Paused: 0.0% screenshot difference, 0 draw calls, 0 rAF callbacks and 0 running infinite CSS animations at all 9 positions (the film-grain `.stage::after` and the scroll cue stop: 2 infinite animations running -> 0); mouse movement changes nothing; resume restores motion (1.27% idle difference). Running: 2,000 to 31,000 draws per 1.5 s.
- Reduced motion: 0 draws, 0 rAF, 0 running animations at all 9 positions, 0.0% difference; grain static (`html.rm .stage::after { animation: none }`); camera snaps to station stills (`Math.round(u)`, `scene.js` line 1041), the handheld drift is off (`!paused && !reduce`, line 752), the dissolve follows the snapped position so there is no animated cross-fade.
- Contrast over the photographs (every text node, real pixels): fine pass at 1440 (48 steps) and 390 (46 steps) covering every station and the dusk-to-room cross-dissolve: no text below its threshold; lowest 8.65:1 ("Illustrative dishes…" note, 1440) and 8.11:1 ("Address" `dt`, 390). Reduced motion 1440/390: lowest 7.43:1. WebGL-off poster 1440/390: lowest 7.53:1. 720x450: 8.36:1. 320x256: 7.30:1 (`[Price]`). The 90% panels (`--panel: rgba(20,13,10,.9)`) hold over the brightest photo regions.
- Flash / vestibular: largest screen-tile luminance change 2.6% (1440) and 7.0% (390), 0 swings >= 10% per second at 5 positions. Fire-light flicker (`scene.js` line 816-817) is +-20% on a small practical light at 8 to 37 Hz sines, only on props; film grain is a mean-preserving overlay at opacity .32. No flash risk. Camera moves are scroll-driven and damped; reduced motion and Pause remove the drift.

Findings:
- HC-P1 (Minor, 2.4.7 robustness; carried over from HC1 in `A11Y-REPORT-FINAL-B.md`, still present). Mobile menu at 320x256: when Tab reaches "Menu" the panel scrolls it only to 207-255 in a 256px window, so the bottom of the ring and halo is clipped (top, left, right visible). The added `.nav__menu { scroll-padding-top: calc(var(--nav-h) + 12px); scroll-padding-bottom: 12px }` (`style.css` line 313) does not help: the menu panel already starts below the header (top 60), so the 76px top padding eats most of the 196px snapport. Fix: `.nav__menu { scroll-padding-block: 12px; }` (drop the nav-height term) and `padding-bottom: 16px` inside the scroll container so there is scroll room after the last link. Verify with `ap_menu.py himal-chulo-photo`: every focused item at least 12px inside 0..256.

## 2. ember-and-oak-photo: PASS (no WCAG 2.2 AA failure found in the tested scope)

Lean battery (to fit the time box): axe at 1440 and 390 normal, 1440 reduced motion, 390 WebGL off, 320x256, 320x568; contrast fine pass 1440 and 390, 390 reduced motion, WebGL-off 1440 and 390 (not run: 720x450 and 320x256 contrast, 1440 reduced-motion contrast). Everything else as in the method. Console: no errors in any run.

Checked and clean:
- axe: 0 violations in all 6 configurations; only `color-contrast` incomplete. No horizontal scroll.
- Structure: title "Ember & Oak | Wood-fire steakhouse and grill, photo tour (sample design)"; one `h1`, `h2` per station, `h3` menu groups, footer `h2`s; header, `nav[Primary]`, main, footer, `nav[Footer]`; canvas `aria-hidden`, not in the accessibility tree; no unnamed controls.
- Skip link: first stop, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#fire`, `#board`, `#cellar`, `#menu`, `#reserve` and mobile `#cellar`: focus on the target section (top at 0/-1), menu closes, next Tab continues.
- Focus ring: 17 stops (1440) and 13 (390), all four sides >= 3:1 on the real pixels.
- Mobile menu: full-height panel; at 320x256 it scrolls inside itself (`overflow-y:auto`, wheel scrollTop 0 -> 34, page stays at 0); every focused item stays inside the window with room for the ring ("Reserve" 200-244 of 256; Shift+Tab "Menu" 152-196, "The cellar" 104-148, never under the 66px header); 390x667 and 320x568 fit. Loop brand, 4 links, Pause, Menu; `inert` on main and footer; Escape returns focus to Menu, `inert` cleared.
- Pinned panels / reflow: 0 of 37 panel elements unreachable at 320x256, 320x568, 390x667 (sticky stations at 390x667 are 667px tall with panels of 242-415px; menu panel 1017px scrolls normally) and 320x256 reduced motion; 0 of 53 page elements unreachable at 720x450, 320x256 (normal and reduced motion), 320x568.
- Pause motion: name = visible text "Pause motion" (rendered in capitals by CSS; matches case-insensitively), constant; `aria-pressed` toggles; Enter/Space; 44px (44x44 at 390). Paused: 0.0% difference, 0 draws, 0 rAF, 0 infinite animations at 8 of 9 positions; at 50% the camera was still settling onto the newly scrolled position (180 draws, 5 rAF in 1.5 s, 0.04% difference, then stops): scroll-following, not idle motion. Pointer causes no change. Shader film grain (`uTime = clock`) and fire flicker freeze because `clock` only advances when not paused.
- Reduced motion: 0 draws, 0 rAF at all 9 positions; flicker forced to 1 (`flick = reduce ? 1 : …`, `scene.js` line 403); weights snap (`draw(dt, reduce)`), so no animated cross-dissolve; pointer parallax not bound (line 337).
- Contrast over the photographs: fine pass 1440 (46 steps) and 390 (49 steps) through the fire, cut, cellar and dinner panoramas and their dissolves: lowest real text 6.32:1 (`span.kicker__no` "02", 1440) and 6.02:1 ("05", 390). Reduced motion 390: 7.57:1. WebGL-off posters: 8.01:1. One sample is a measurement case: `a.btn--primary` "Reserve a table" at scroll 7920 (1440) reads 1.01:1 at the 5th percentile but 8.11:1 median, identical to its solid-button value elsewhere; the low pixels are the edge of the glyph box at the bottom of the window. Not counted.
- Flash / vestibular: largest tile luminance change 7.7% (1440) and 7.8% (390) at the fire, 0 swings >= 10% per second. Code: fire flicker `1 + 0.05 sin(6.1t) + 0.035 sin(13.7t) + 0.02 sin(23.3t)` (max +-10.5%) on the stove window and light, warped flame pixels limited to the stove glass (`scene.js` lines 69-80). Under the general flash threshold; frozen by Pause and reduced motion.

Findings: none at WCAG level. (Ember fixed the menu-ring clipping seen as EO1 in round 3.)

## 3. flour-and-fig-photo: PASS (no WCAG 2.2 AA failure found in the tested scope; 1 minor item)

Lean battery (as for ember-and-oak-photo). Console: no errors in any run.

Checked and clean:
- axe: 0 violations in all 6 configurations; only `color-contrast` incomplete. No horizontal scroll.
- Structure: one `h1` ("Flour & Fig"), `h2` per station, `h3` menu groups; landmarks as on the other sites; canvas `aria-hidden`; no unnamed controls.
- Skip link: first stop, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#morning`, `#pastry`, `#cake`, `#pour`, `#menu`, `#reserve` and mobile `#cake`: focus on the target section, menu closes, next Tab continues.
- Focus ring: 19 stops (1440) and 15 (390), all four sides >= 3:1 on the real pixels, including over the bright window photographs.
- Mobile menu: 320x256 is a 196px scroll container below the header; wheel scrolls the menu (scrollTop 0 -> 132), page stays put; Tab brings "Menu" to 160-216 and "Visit" to 188-244 (12px clear of the bottom, ring intact; the round-3 FF1 clipping is fixed); 390x667 and 320x568 fit. Loop brand, 5 links, Pause, Menu; `inert`; Escape returns focus to Menu.
- Pinned panels / reflow: 0 unreachable at 320x256, 320x568 (sticky 508px stations, panels 223-426px), 320x256 reduced motion; 0 of 67 page elements unreachable at 720x450, 320x256 (normal and reduced motion), 320x568. At 390x667 the checker flagged the hero kicker "Artisan bakery & café · Sample design" as partly covered: re-probed, its bottom 2px box overlaps the box of the italic "&" in the `h1` below (kicker 314-365, "&" 363-431); the glyphs do not touch and the kicker is fully readable (`scratchpad/ap/ff_hero0_crop.png`). Not a defect.
- Pause motion: name = visible text "Pause motion", constant, `aria-pressed` toggles, Enter/Space, 44px. Running: 3 to 26% of pixels change per 1.5 s (the full-frame shader grain plus steam and camera drift). Paused: 0.0% difference, 0 draws, 0 rAF, 0 infinite animations at all 9 positions; pointer no effect. Grain time is held (`gradeU.uTime.value = paused || reduce ? 0 : …`, `scene.js` line 489).
- Reduced motion: 0 draws, 0 rAF at all 9 positions; intro skipped (`intro = reduce ? 0 : 1`, line 324); scroll cue animation off.
- Contrast over the photographs (light cream panels over bright window panoramas): fine pass 1440 (51 steps) and 390 (52 steps), every station and dissolve: lowest real text 5.02:1 ("Telephone" `dt`, 1440) and 4.90:1 (the `p.kicker` eyebrows, 390, constant 4.90 at every position, so they sit on the solid panel, not on the photo). Reduced motion 390: 4.97:1. WebGL-off posters: 5.61:1 (1440), 5.20:1 (390). Only "failure" printed is `span.sr-only` "to the pastry" (visually hidden 1px text), a measurement case.
- Flash / vestibular: largest tile luminance change 0.7%, 0 swings. Grain is +-4.5% per-pixel noise with constant mean; steam is soft and slow.

Findings:
- FF-P1 (Minor, robustness of 1.4.3). The eyebrow kickers (`p.kicker`, 11.2px caps, `style.css`) pass at 4.90:1 on the 390 panels and 4.97:1 in reduced motion: only 0.4 above the line. Any later lightening of the panel or a more transparent phone panel would fail. Fix (optional): darken the kicker colour one step (for example toward `--fig-700`) to reach >= 6:1.

## 4. olive-and-sea-photo: PASS (no WCAG 2.2 AA failure found in the tested scope)

Lean battery (as for ember-and-oak-photo), plus an extra flash probe at 50% and 55% of the page. Console: no errors in any run.

Checked and clean:
- axe: 0 violations in all 6 configurations; only `color-contrast` incomplete. No horizontal scroll.
- Structure: one `h1`, `h2` per station (`#dusk-title` etc.), `h3` menu groups; landmarks; canvas `aria-hidden`; posters decorative; no unnamed controls.
- Skip link: first stop, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#arrival`, `#terrace`, `#kitchen`, `#dusk`, `#menu`, `#reserve` and mobile `#kitchen`: focus on the target section, menu closes, next Tab continues.
- Focus ring: 17 stops (1440) and 13 (390), all four sides >= 3:1 on the real pixels (bright sky and water included).
- Mobile menu: 320x256: 188px scroll container under the 68px header, wheel scrolls the menu (0 -> 180), page stays; Tab keeps every item 12px or more inside the window ("Dusk" 188-244, "Sample menu" and "Reserve" 168-224; Shift+Tab "Kitchen" 148-204), round-3 OS1 fixed; 390x667 and 320x568 fit. Loop brand, 5 links, Pause, Menu; `inert`; Escape returns focus to Menu.
- Pinned panels / reflow: at 320x256 the sticky stations shrink (`station__stick` 302-423px) and 0 of 37 panel elements are unreachable; 0 at 320x568, 390x667 (menu panel 596 of 599px available) and 320x256 reduced motion; 0 of 53-55 page elements unreachable at 720x450, 320x256 (normal and reduced motion), 320x568.
- Pause motion: name = visible text, constant, `aria-pressed` toggles, Enter/Space, 44px. Paused: 0.0% difference, 0 draws, 0 rAF at all 9 positions; pointer no effect; grain time held (`fu.uTime.value = paused || reduce ? 0.37 : clock`, `scene.js` line 298). Running at 50% the camera glide after a scroll changes 72% of the pixels over 1.5 s (a slow pan, not a flash: see below).
- Reduced motion: 0 draws, 0 rAF at all 9 positions; camera jumps to station stills (`STILL_T[Math.round(t0)]`, line 201), drift removed (line 257), intro skipped.
- Contrast over the photographs (light 90% panels with blur, dark dusk panel): fine pass 1440 (58 steps) and 390 (60 steps), every station and the day-to-dusk dissolve: lowest 5.14:1 (`[Price]`, 1440) and 5.58:1 (kicker "From the kitchen", 390). Reduced motion 390: 5.66:1. WebGL-off posters (the real photo stills `assets/poster-*.jpg`): 6.04:1 (1440), 5.73:1 (390). The dusk paragraph "A table at the water's edge…" (`#dusk p`, `rgb(201,193,179)` on the dark panel) is 7.31:1 to 9.15:1 everywhere; one WebGL-off 1440 sample at scroll 3150 reads 1.40:1 at the 5th percentile (median 8.02) because its box (top at y=64) touches the bottom edge of the fixed header as it scrolls under it. Measurement case, not counted.
- Flash / vestibular: largest tile luminance change 0.3% (positions 5, 40, 50, 55, 75%); 0 swings. The dusk transition is a scroll-driven cross-dissolve, not a timed flash.

Findings: none at WCAG level.

## 5. jade-teahouse-photo: PASS (no WCAG 2.2 AA failure found in the tested scope)

Lean battery (as for ember-and-oak-photo), plus a paused-settle probe. Console: no errors in any run.

Checked and clean:
- axe: 0 violations in all 6 configurations; only `color-contrast` incomplete. No horizontal scroll.
- Structure: one `h1`, `h2` per station, `h3` menu groups; landmarks; canvas `aria-hidden`; no unnamed controls.
- Skip link: first stop, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#arrival`, `#tea`, `#dimsum`, `#menu`, `#reserve` and mobile `#dimsum`: focus on the target section, menu closes, next Tab continues.
- Focus ring: 17 stops (1440) and 13 (390), all four sides >= 3:1 on the real pixels (lantern-lit and garden photographs).
- Mobile menu: full-height panel; at 320x256 it scrolls inside itself (wheel 0 -> 22, page stays); Tab keeps every item inside with room for the ring ("Reserve" 200-244; Shift+Tab "Menu" 156-200, "Dim sum" 112-156, never under the header); 390x667 and 320x568 fit. Loop brand, 4 links, Pause, Menu; `inert`; Escape returns focus to Menu.
- Pinned panels / reflow: 0 of 37 panel elements unreachable at 320x256, 320x568 (sticky 568px stations), 390x667 and 320x256 reduced motion; 0 of 53 page elements unreachable at 720x450, 320x256 (normal and reduced motion), 320x568.
- Pause motion: name = visible text, constant, `aria-pressed` toggles, Enter/Space, 44px. Paused: 0.0% difference, 0 draws, 0 rAF at 6 of 9 positions; at 75-100% the battery saw draws in the first seconds after the scroll jump. Re-probe (`ap_jpause.py`, paused, sampled every second for 8 s): the scene follows the new scroll position for 1 s (up to 2 s at the bottom) and then draws 0 frames with 0.0% pixel change. Scroll-following, not idle motion. Handheld sway gated by `!paused && !reduce` (`scene.js` line 409); pointer parallax off when paused (mouse test 0.0%).
- Reduced motion: 0 draws and 0 rAF at 8 of 9 positions (one initial still frame at the top: 6 draws, 1 rAF); `stillFrame()` path (line 569); intro skipped; pointer listener not bound (line 370).
- Contrast over the photographs: fine pass 1440 (44 steps) and 390 (46 steps), every station and dissolve: lowest real text 5.31:1 (`span.kicker__no` "04" and `[Price]`, both constant at 5.31, so on the solid panel) and 5.40:1 (primary button). Reduced motion 390: 5.31:1. WebGL-off: 5.13:1 (brand name over the poster at 1440), 5.28:1 (390). Four WARN samples (menu dish names 1.02:1 and `[Price]` 2.74:1 at the 5th percentile, medians 5.3 to 14.8) all have their text box at y = 63 to 68, i.e. touching the bottom edge of the fixed header while they scroll under it. Measurement cases, not counted.
- Flash / vestibular: largest tile luminance change 0.7%, 0 swings; lantern light is static, steam slow.

Findings: none at WCAG level.

## Summary

| Site | WCAG 2.2 AA (tested scope) | Failures | Minor items |
|---|---|---|---|
| himal-chulo-photo | PASS | none | HC-P1 menu ring bottom clipped at 320x256 ("Menu" 207-255 of 256; carried over from round 3) |
| ember-and-oak-photo | PASS | none | none |
| flour-and-fig-photo | PASS | none | FF-P1 kicker eyebrows only 4.90:1 at 390 (thin margin) |
| olive-and-sea-photo | PASS | none | none |
| jade-teahouse-photo | PASS | none | none |

Main risk, contrast over bright photographs: no text node failed at any station or mid-dissolve on any site. Lowest real readings: himal 7.30:1, ember 6.02:1, flour 4.90:1, olive 5.14:1, jade 5.13:1 (WebGL-off). The panels (90% dark on himal/ember/jade, 90% light with blur on flour/olive) fully isolate the text from windows, skies and lamps; values that stay constant across all scroll positions show the text never sees the photograph.
All five: axe clean (33 runs); one `h1`, landmarks, canvas hidden from AT; skip link and every anchor move focus; mobile menu scrolls at 320x256, loop includes header controls, Escape returns focus, background `inert`; no sticky panel overflows at 320x256, 320x568 or 390x667; Pause button name = visible text with `aria-pressed`, really stops idle motion (0 draws, 0 rAF, grain and scroll-cue animations stopped); reduced motion gives still frames with snapped dissolves and no drift; no flash risk (largest idle tile luminance change 7.8%, at ember's fire).

Not tested: NVDA, JAWS, VoiceOver, voice control, Windows forced colours, real phones. For ember, flour, olive and jade (time box): no contrast pass at 720x450, 320x256 or 1440 reduced motion, and axe ran 6 of the 9 configurations (skipped 390 reduced motion, 1440 WebGL off, 720x450); himal ran everything. Context loss and restore were not tested in this audit. Re-run: `scratchpad/ap_site.sh <site>` (full) or `ap_site2.sh` (lean); logs in `scratchpad/ap/`.
