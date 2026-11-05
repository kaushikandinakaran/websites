# Accessibility audit (final, part B): 5 realistic 3D restaurant sites, WCAG 2.2 AA

Auditor: independent accessibility auditor. Date: 2026-11-04. No site files were edited. Server `python showcase/serve.py 8874` (port 8874 only), one site at a time.
Sites: `sites/himal-chulo`, `sites/ember-and-oak`, `sites/flour-and-fig`, `sites/olive-and-sea`, `sites/jade-teahouse` (files dated 2026-11-04 00:56 to 08:25).

Method (scripts `ar_*.py` in the session scratchpad; Edge headless via Playwright with ANGLE D3D11, every browser closed after each run; axe-core 4.x loaded from the scratchpad only; same method as `A11Y-REPORT-3D.md`):
- axe-core (WCAG 2.0/2.1/2.2 A+AA + best-practice) at 1440x900 and 390x844 (normal, reduced motion, WebGL off), 720x450, 320x256 and 320x568, after a full scroll pass.
- Keyboard: full Tab walkthrough at 1440 and 390 with motion paused; focus indicator measured against the real pixels (focused vs blurred screenshot; each side needs a >= 3:1 change along >= 90% of its length). Skip link and every nav anchor (where focus lands, next Tab).
- Mobile menu at 320x256, 390x667, 320x568: fit or scroll inside itself, wheel, focus ring inside the window, Tab and Shift+Tab loop, Escape and focus return, `inert` on the page.
- Pinned panels: at 320x256, 320x568, 390x667 (and reduced motion) every heading, paragraph, row and button must be fully visible below the header at some scroll position (WCAG 1.4.10). Page reflow at 720x450, 320x256, 320x568.
- Pause motion: name vs visible text (2.5.3), `aria-pressed`, Enter/Space, screenshot difference, WebGL draw calls and rAF callbacks per 1.5 s at 9 scroll positions (running, paused, reduced motion), pointer movement while paused.
- Text contrast: every text node hidden, page screenshotted, text colour composited on the real pixels behind it, 5th percentile reported; settled (36% viewport steps) and mid-transition (55% steps, 380 ms) passes; 1440, 390, 720x450, 320x256, reduced motion, WebGL-off poster.
- Flash / vestibular: repaint-forcing screenshots at several stations (tile luminance swings per second, WCAG 2.3.1), plus reading the flicker code.

Not done: no NVDA, JAWS, VoiceOver or voice-control session (screen-reader remarks come from the Chromium accessibility tree); no Windows forced-colours run; no real phones. Headless Edge shares the GPU with another agent, so frame rates are low; scenes were given time to settle before sampling. Low capture rate can miss very fast flicker, so flicker code was also read.

## 1. himal-chulo: PASS (no WCAG 2.2 AA failure found in the tested scope; 2 minor items)

Console: no errors in any run.

Checked and clean:
- axe: 0 violations in all 9 configurations (1440/390 normal, reduced motion, WebGL off; 720x450; 320x256; 320x568). Only `color-contrast` "incomplete" (text over canvas), covered by the pixel scan. No horizontal scroll at any size.
- Structure: one `h1` ("Himal Chulo"), `h2` per station, `h3` dishes, footer `h2`s; banner, `nav[aria-label=Primary]`, main, `nav[aria-label=Footer]`, contentinfo; canvas inside `div.stage[aria-hidden=true]`, not in the accessibility tree; loader `aria-hidden`; no unnamed links or buttons.
- Skip link: first Tab stop, visible (dark ring on a 7px `#ffd58a` halo, >= 3:1 all sides), Enter focuses `main#main`, next Tab "Reserve a table" in the hero. Anchors `#arrival`, `#kitchen`, `#table`, `#tea`, `#menu`, `#reserve` (1440) and mobile-menu `#table` (390): focus lands on the target `section`, menu closes (`aria-expanded=false`), next Tab continues in DOM order.
- Focus ring: 18 stops at 1440, 14 at 390, every side >= 3:1 against the real pixels (3px `#ffd58a` outline + 6px `rgba(10,6,4,.95)` halo; `.btn:focus-visible` re-asserts the halo, so primary/ghost buttons keep it). One 390 reading (footer brand) lacked the bottom side only because the browser scrolled it flush to the window's bottom edge; not a site defect.
- Mobile menu (320x256, 390x667, 320x568): opens with Enter, `main` and `footer` get `inert`; Tab loop covers brand, 5 links, Pause, Menu and back; Shift+Tab loops back; Escape closes, `aria-expanded=false`, focus returns to Menu, `inert` cleared. At 320x256 the panel is a 196px scroll container (`overflow-y:auto`, `data-lenis-prevent`): the wheel scrolls the menu (scrollTop 0 -> 101) and not the page; Tab scrolls "Menu" and "Reserve" into view.
- Pinned panels / reflow: no sticky panels on this site. At 320x256, 320x568, 390x667, 720x450 and 320x256 reduced motion every heading, paragraph, dish row, detail row and button is fully visible below the header at some scroll position (0 unreachable of 40 to 61 elements).
- Pause motion: in the header, 44px tall (44x44 icon-only under 960px with text kept visually hidden); accessible name "Pause motion" = visible text, constant; `aria-pressed` false/true; Enter pauses, Space resumes. Paused: 0.0% screenshot difference, 0 draw calls and 0 rAF callbacks per 1.5 s at all 9 scroll positions, 0 running infinite CSS animations, mouse movement changes nothing. Running: 8,600 to 38,900 draws per 1.5 s. Hidden under reduced motion.
- Reduced motion: 0 draws and 0 rAF callbacks idle at all 9 positions, 0.0% difference; content complete.
- Contrast (pixel-based, every text node): settled 1440 and 390, mid-transition 1440 and 390, 390 reduced motion, WebGL-off posters at 1440 and 390, 720x450, 320x256: no text below its threshold. Lowest settled readings: "Hours" `dt` 7.46:1 (1440), `[Price]` 8.38:1 (390), "Address" 7.43:1 (320x256). Panels (`rgba(20,13,10,.9)`) hold over the dark scene everywhere. One 720x450 sample of the hero "Reserve a table" read p5 1.1 with a 9.87:1 median while the button slid under the header edge; measurement case, not a failure.
- Flash / vestibular: repaint captures at 5 positions (1440 and 390): largest screen-tile luminance change 7.9%, 0 swings >= 10% per second. Code: hearth light `2.2*(1+0.15 sin 8.1t+0.1 sin 17.3t)` (+-25% at 1.3 to 2.8 Hz) and lantern flicker +-17% on small local lights (`scene.js` lines 1190 to 1196); far below the flash threshold, frozen when paused and under reduced motion. Camera moves are scroll-driven and damped.

Findings:
- HC1 (Minor, 2.4.7 robustness). Mobile menu at 320x256: when Tab reaches "Menu" the browser scrolls the panel only until the link box is inside it (link at 207 to 255 in a 256px window), so the bottom of the 3px ring + halo is clipped by the scroll container. Three sides stay visible, so not a failure. Fix: `.nav__menu { scroll-padding-block: 12px; }` and `.nav__links a { scroll-margin-block: 10px; }` (`style.css` mobile block near line 246).
- HC2 (Minor, not WCAG). Hero and reserve both have "Reserve a table" links; the reserve one points at `#reserve` (itself). Fine as a placeholder; replace with the real booking link before delivery (`index.html` line 128).

## 2. ember-and-oak: PASS on everything tested (contrast and flash: see section 6)

Reduced test set on this site because of the time box: axe in 4 configurations, ring walk at 390 only. Console: no errors.

Checked and clean:
- axe: 0 violations at 1440 normal, 390 reduced motion, 390 WebGL off, 320x256. Only `color-contrast` "incomplete". No horizontal scroll.
- Structure: one `h1` "Ember & Oak", `h2` per station, landmarks, canvas `aria-hidden`, poster `img alt=""` inside `aria-hidden` wrappers, no unnamed controls.
- Skip link: first stop, visible, Enter focuses `main#main`, next Tab "Reserve a table". Anchors `#fire`, `#board`, `#cellar`, `#menu`, `#reserve` and mobile `#cellar`: focus on the target section (scrolled to its top), menu closed, next Tab continues.
- Focus ring at 390: 13 stops, every side >= 3:1 on the real pixels (2px `#ffc58f` outline + 6px dark halo, re-asserted on `.btn`).
- Mobile menu (full-screen, `overflow-y:auto`, `align-items: safe center`, `data-lenis-prevent`): at 320x256 the column scrolls inside itself (wheel: menu scrollTop 0 -> 34, page stays at 0); at 390x667 and 320x568 everything fits. `main` and `footer` `inert`; Tab loop brand / 4 links / Pause / Menu; Shift+Tab; Escape returns focus to Menu, `inert` cleared.
- Pinned panels: sticky at 390x667 (panels 242 to 415px in a 601px frame; menu card 1017px is not pinned and scrolls normally); unpinned at 320x568 and 320x256 by `@media (max-height:560px), (max-width:400px) and (max-height:600px)`. 0 unreachable elements of 37 at 320x256, 320x568, 390x667 and 320x256 reduced motion. The code-review concern (reserve panel at 320x568) is resolved: that size is unpinned and the 505px reserve panel scrolls fully into view.
- Pause motion: name "Pause motion" (shown in capitals via CSS; Chromium exposes "PAUSE MOTION", matches case-insensitively, fine for 2.5.3), constant; `aria-pressed` toggles; Enter/Space; 44px (44x44 icon-only on phones). Paused: 0.0% screenshot difference at the hero (running: 17.8% of pixels change per 0.9 s, fire and embers), 0 infinite CSS animations, pointer movement changes nothing.

Findings:
- EO1 (Minor, 2.4.7 robustness). Mobile menu at 320x256: "Reserve" scrolls to 212 to 256 (flush with the window bottom; the menu's bottom padding is not reachable as scroll space), so the ring's bottom edge is cut; after the loop wraps, "The cut" sits at 68 to 112, just under the 66px header that is stacked above the menu (`.nav__inner` `z-index:2`), so the top of its halo is hidden. Three sides always visible. Fix: `.nav__links a { scroll-margin-block: 76px 16px; }` (or `scroll-padding-block: var(--nav-h) 16px` on `.nav__menu`, `style.css` line 104).

## 3. flour-and-fig: PASS on everything tested (contrast, flash and intro-pause: see section 6)

Reduced test set (axe in 4 configurations, ring walk at 390). Console: no errors.

Checked and clean:
- axe: 0 violations at 1440, 390 reduced motion, 390 WebGL off, 320x256. No horizontal scroll.
- Structure: one `h1`, landmarks, canvas `aria-hidden`, no unnamed controls.
- Skip link: first stop, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#morning`, `#pastry`, `#cake`, `#pour`, `#menu`, `#reserve` and mobile `#cake`: focus on the target section, menu closed, next Tab continues.
- Focus ring at 390: 15 stops, every side >= 3:1 on the real pixels (3px `#3d1934` outline between flour halos).
- Code-review finding 1 (header blur trapping the fixed menu) is FIXED: the blur is on `.nav::before`; the menu opens as a real panel (196px at 320x256, 607px at 390x667, 508px at 320x568). At 320x256 it scrolls inside itself (wheel: menu scrollTop 0 -> 132, page stays at 0; `data-lenis-prevent` present). `main` and `footer` `inert`; Tab loop brand / 5 links / Pause / Menu; Shift+Tab; Escape returns focus to Menu, `inert` cleared.
- Code-review finding 2 (pinned panels at 320x256) is FIXED: 0 unreachable of 45 elements at 320x256 (unpinned) and 320x256 reduced motion; 0 of 46 at 320x568 (pinned, panels 223 to 426px in a 508px frame). At 390x667 one sample flagged the hero kicker as never fully visible; a targeted re-probe at scroll 0, 60 and 150 shows it fully visible at 314 to 365px (header bottom 60) and the screenshot `ar/ff_k_0.png` confirms it: measurement artifact (first sample taken during the reveal), not reported.
- Pause motion: name = visible text "Pause motion", constant, `aria-pressed` toggles, Enter/Space, 44px (44x44 on phones). Paused after load: 0.0% difference (running 11.7%), pointer movement changes nothing, 0 infinite CSS animations.

Findings:
- FF1 (Minor, 2.4.7 robustness). Same as HC1: at 320x256 Tab scrolls "Menu" to 200 to 256, flush with the window bottom, so the ring's bottom edge is clipped. Fix: `.nav__menu { scroll-padding-block: 12px; }` (`style.css` line 184).

## 4. olive-and-sea: PASS on everything tested (contrast, flash and intro-pause: see section 6)

Reduced test set (axe in 4 configurations, ring walk at 390). Console: no errors.

Checked and clean:
- axe: 0 violations at 1440, 390 reduced motion, 390 WebGL off, 320x256. No horizontal scroll.
- Structure: one `h1`, landmarks, canvas `aria-hidden` (not in the accessibility tree), no unnamed controls.
- Skip link: first stop, focuses `main#main`, next Tab "Reserve a table". Anchors `#arrival`, `#terrace`, `#kitchen`, `#dusk`, `#menu`, `#reserve` and mobile `#kitchen`: focus on the target section, menu closed, next Tab continues.
- Focus ring at 390: 13 stops, every side >= 3:1 on the real pixels (3px outline with a 2px `!important` halo; dark ring on light surfaces, gold in dark panels).
- Mobile menu: at 320x256 a 188px scroll container (`overflow-y:auto`, `data-lenis-prevent`, code-review finding 4 FIXED): wheel scrolls the menu (scrollTop 0 -> 180) and not the page; fits at 390x667 and 320x568. `main` and `footer` `inert`; Tab loop brand / 5 links / Pause / Menu; Shift+Tab; Escape returns focus to Menu.
- Pinned panels: sticky with `height:auto` on short screens, so tall panels grow their frame. 0 unreachable of 37 to 39 elements at 320x256, 320x568, 390x667 and 320x256 reduced motion (at 390x667 the 596px menu card just fits the 599px area under the header).
- Pause motion: name = visible text, constant, `aria-pressed` toggles, Enter/Space, 44px (44x44 on phones). Paused after load: 0.0% difference (running 10.0%), pointer changes nothing, 0 infinite CSS animations. String-light warm-up flicker and candle flicker are switched off while paused or under reduced motion (`scene.js` line 322 passes `flicker: !paused && !reduce`).

Findings:
- OS1 (Minor, 2.4.7 robustness). Same pattern as HC1: at 320x256 Tab scrolls "Dusk" and "Reserve" to 200 to 256, flush with the window bottom, so the ring's bottom edge is clipped (top, left and right stay visible). Fix: `.nav__menu { scroll-padding-block: 12px; }` (`style.css` line 93).

