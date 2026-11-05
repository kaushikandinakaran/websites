# Accessibility audit: 5 restaurant 3D sites, WCAG 2.2 AA (after the CODE-REVIEW-3D fix round)

Auditor: independent accessibility auditor. Date: 2026-11-04. No site files were edited. Server on port 8832 only, one site at a time.
Sites: `sites/sakura-omakase`, `sites/forno-rosso`, `sites/saffron-court`, `sites/maison-claire`, `sites/blue-pearl` (files dated 2026-11-03 23:46 to 2026-11-04 00:25, i.e. after the fix round).

Method (scripts `a3_*.py` in the session scratchpad; Edge headless via Playwright, every browser closed after each run; axe-core 4.x loaded from the scratchpad only):
- axe-core (WCAG 2.0/2.1/2.2 A+AA + best-practice) at 1440x900 and 390x844, normal, reduced-motion and WebGL-off, plus 720x450 and 320x256, after a full scroll pass.
- Keyboard: full Tab walkthrough at 1440 and 390; focus indicator measured against the REAL pixels behind it (focused vs blurred screenshot, every side of the control must show a change of >= 3:1 along >= 90% of its length); skip link, every nav anchor and a mobile-menu anchor (where focus lands, next Tab); mobile menu (open, Tab cycle, Shift+Tab, Escape, focus return, `inert`).
- Pause motion: name vs visible text (2.5.3), `aria-pressed`, Enter/Space, idle screenshot difference and WebGL draw calls / rAF callbacks per 1.5 s at 9 scroll positions (running, paused, reduced motion), pointer-driven motion while paused.
- Text contrast: every text node hidden, page screenshotted, text colour (with opacity chain) composited on the real pixels behind it; 5th-percentile ratio reported. Settled pass (2 frames per stop, 36% viewport steps), mid-transition pass (55% steps, 380 ms), 1440, 390, 720x450, 320x256, reduced motion, WebGL-off poster. Text hidden under the sticky header is excluded by hit-testing (it is judged on the header scrim only).
- Flash / vestibular: burst capture (about 8 to 15 fps, tile luminance over 3 s) at 6 positions plus a fast scroll sweep; counts luminance swings >= 10% per second (WCAG 2.3.1 general flash threshold is > 3 per second with a large area).
- Reflow and zoom: 720x450 (1440 at 200%) and 320x256 (1280 at 400%): horizontal overflow and text never fully visible at any scroll position.

Not done: no NVDA, JAWS, VoiceOver or voice-control session (screen-reader remarks come from the Chromium accessibility tree). Headless Edge renders WebGL with a shared or software GPU, so frame rates are low; scenes were given time to settle before sampling. Flash measurement at a low capture rate can miss very fast flicker; source code was read to confirm flame and light behaviour. This is not a claim of full conformance.

## 1. sakura-omakase: FAIL (only X1 below, the open mobile menu at 320x256; everything in this section passed)

No failure found in this section (see X1). Console: no errors (one ANGLE shader-compiler warning about texture bias from the GPU driver, not from site code).

Checked and clean:
- axe: 0 violations in all 8 configurations (1440/390 normal, reduced motion, WebGL-off; 720x450; 320x256). Only `color-contrast` "incomplete" (text over canvas), which the pixel scan covers.
- Structure: one `h1` ("Sakura Omakase"), `h2` per station, `h3` menu groups; banner, `nav[aria-label=Primary]`, main, contentinfo; stage `div.stage[aria-hidden=true]` holds the canvas, which is not in the accessibility tree; decorative rail `ol[aria-hidden]`; no unnamed links or buttons.
- Skip link (claim re-run): first Tab stop, visible on focus, Enter puts focus on `main#main` (no scroll jump, page already at top), next Tab goes to the first control inside main ("Reserve a seat" hero CTA). Nav anchors `#counter`, `#omakase`, `#tools`, `#reserve` at 1440: focus lands on the target `section`, the panel is scrolled into view, next Tab continues from there (to "Request a seat", the next control in DOM order, since the middle stations have no controls).
- Mobile menu at 390 (claim re-run): Enter opens, `aria-expanded=true`, `main` and `footer` get `inert`; Tab cycles links, "Reserve a seat", brand, Pause, Menu and back (no escape into the inert page); Shift+Tab cycles back; Escape closes, `aria-expanded=false`, focus returns to the Menu button; a menu link closes the menu and moves focus to the target section (`#omakase`).
- Focus ring: 15 stops at 1440, 12 at 390; every stop shows a >= 3:1 change on all four sides against the real pixels (3px `#ffd27a` outline plus a 7px near-black halo, so it holds on any canvas colour). None obscured by the sticky header.
- Pause motion: button in the header, 44px tall (44x44 icon-only at 390, text kept as visually hidden), accessible name "Pause motion" = visible text, constant; `aria-pressed` false/true; Enter pauses and Space resumes. Paused: screenshot difference 0.0% and 0 WebGL draw calls and 0 rAF callbacks per 1.5 s at all 9 scroll positions; 0 running infinite CSS animations; mouse movement causes no change. Running: 8,000 to 52,000 draws per 1.5 s. Hidden under reduced motion.
- Reduced motion: 0 draw calls when idle at every position, screenshot difference 0.0%, camera jumps to still frames, all content visible.
- Contrast: settled pass at 1440, 390, 720x450, 320x256, reduced motion and WebGL-off posters: no text below its threshold. Panels (`rgba(11,6,8,.8)`) keep the hero at 15.7:1 and above. Mid-transition pass: one hit only (see S2).
- Reflow: no horizontal scroll at 720 and 320; every text element is fully visible at some scroll position at 720x450 and 320x256 (normal and reduced motion).
- Flash / vestibular: re-measured with real repaints at 5 positions: largest tile luminance change 4.6%; fast scroll sweep peaks at 13% change in one tile, 1 swing per second (threshold is more than 3). Lantern flicker in code is +-6.5% light intensity at about 0.5 and 1.2 Hz (`world.js` line 420), far from flash territory. Idle camera sway is tiny (0.01 units) and stops when paused and under reduced motion.

Findings:
- S1 (Minor, not WCAG). Under reduced motion `ScrollTrigger.min.js` still runs its internal `_rafBugFix` rAF loop (about 145 callbacks per second, 0 draws). Nothing moves on screen, so no user impact; it only costs battery. `main.js` comment says GSAP is not started under reduced motion; the script tag still loads it. Fix (optional): load `gsap.min.js` / `ScrollTrigger.min.js` with a dynamic `import`/script injection only when `!reduce`.
- S2 (Minor, transient). The aria-hidden "Scroll" cue (`.station--hero span`, 11px, `#d6c8b4`) measures 1.37:1 while it fades out during the first scroll step. It is decorative, aria-hidden, and leaving; not counted as a failure. Optional: fade it with `opacity` to 0 faster or keep it on the panel.
- Not reproduced: a reduced-motion "top" sample at 1440 read 1.0:1 for the hero; a targeted re-probe at scroll 0 (fresh and after returning from the bottom) measured 15.7:1. Measurement artifact, not reported.

## 2. forno-rosso: FAIL (1.4.10 Reflow F1 and X1, 1.4.3 Contrast at 200% zoom F2)

Console: no errors, no 404s.

Checked and clean:
- axe: 0 violations in all 8 configurations.
- Structure: one `h1`, `h2` per station, landmarks present, canvas `aria-hidden`, no unnamed links or buttons.
- Skip link: first Tab stop, visible, Enter focuses `main#main`, next Tab "Reserve a table" inside main. Nav anchors `#dough`, `#toppings`, `#oven`, `#menu`, `#reserve` (1440) and the mobile-menu link `#toppings` (390): focus lands on the target section, the menu closes (`aria-expanded=false`), next Tab continues inside the section.
- Mobile menu: Enter opens; `main` and `footer` now get `inert` (code-review F11 fixed); Escape closes and returns focus to Menu; Shift+Tab cycles.
- Pause motion: name "Pause motion" = visible text, constant; `aria-pressed` toggles; Enter/Space work; 44px. Paused: 0.0% screenshot difference and 0 WebGL draw calls at all 9 positions, mouse movement changes nothing. Reduced motion: 0 draws, still frames, button hidden.
- Claim "`nothing hiding.` fixed to a darker colour" (now `--terra-600 #b3401f` on the 94% flour card): re-sampled on the real pixels: 5.07:1 at 1440, 5.02:1 at 390, 5.01:1 at 390 reduced motion, 5.21:1 at 1440 reduced motion, 5.15 to 5.22:1 WebGL-off (it is 54px+ display text, 3:1 needed). PASS. Mid-transition only, while the card fades in, it dips to 3.66:1 (5th percentile), above 3:1.
- Claim "cards at 390 and under reduced motion": all card text passes at rest at 390, 390 reduced motion and 1440 reduced motion (leads 7.1 to 12.7:1, night-card text 11 to 16:1, day-card eyebrows 5.0:1), except the zoomed case in F2. During the 0.7 s card fade-in the eyebrows and badges dip to 3.4 to 4.4:1 (opacity 0.66 to 0.84); transient reveal, not counted.
- Flash: re-measured with real repaints at the oven (largest luminance change 5.6% of a screen tile, no swing >= 10%); fast scroll sweep 2 swings per second. Code: fire light `0.88 + 0.12*sin*sin + 0.05*sin(23t)` (`world.js` line 525), embers twinkle per particle; no flash risk. Fire flicker and embers stop when paused and under reduced motion.
- Reflow at 720x450: every text element reachable, no horizontal scroll.

Findings:
- F1 (Serious, WCAG 1.4.10 Reflow, AA). At 320x256 (1280 at 400% zoom) the sticky station cards are taller than the viewport and are pinned with their bottom edge in view, so their top is cut off and can never be scrolled to. Never visible at any scroll position: hero eyebrow "Neapolitan pizzeria · Sample design", `h1` "Forno Rosso" (only 2 of 5 probe points ever visible), hero lead "Soft dough, a roaring wood fire…", and the menu items "Seasonal starter [Price]", "Green salad [Price]", "Dessert [Price]". Evidence: scratchpad `a3_f320_a.png` (hero, scroll 0 to 512: the card always starts at "scratch."). Reduced motion at 320x256 is fine (sticky is turned off there). Cause: `style.css` line 111 `.station__sticky { position: sticky; top: 0; height: 100vh; display: flex; align-items: center }` and line 211 (`align-items: flex-end` under 760px). Fix: use the reduced-motion layout on short screens, e.g. `@media (max-height: 520px) { .station__sticky { position: relative; height: auto; min-height: 100svh; align-items: flex-start; } }`, or give the card `max-height: calc(100svh - var(--nav-h) - 24px); overflow-y: auto` with `tabindex="0"` and a label (less good). Verify: at 320x256 Tab and scroll through; every heading, lead and menu row is fully on screen at some point.
- F2 (Moderate, WCAG 1.4.3 Contrast Minimum, AA). At 720x450 (1440 at 200% zoom) the hero card is pinned directly under the floating nav pill, and the nav's drop shadow darkens the card under the eyebrow: "Neapolitan pizzeria · Sample design" (`#dough p.eyebrow`, 11.2px, `#b3401f`) measures 3.54:1 median, 3.07:1 at the 5th percentile, for the whole hero station. Evidence: `a3_probe_forno-rosso_p_eyebrow.png` (720 crop). Fix: darken the day-card eyebrow to `--terra-700 #8f2f14` (about 7.3:1 on flour, above 5:1 under the shadow), or reduce the nav shadow / add top padding so the card clears it. The same eyebrow passes at 1440 and 390 (5.0 to 5.3:1).
- F3 (Minor, 1.4.11 / 2.4.7 robustness). On the solid terra buttons (nav "Reserve", hero "Reserve a table", 1440 and 390) the focus indicator is carried by the 2px `--night` inner ring; the 3px `#ff6a1f` outline itself is only about 2.5:1 on the flour background, and along the bottom edge the night ring lands on the button's own `--terra-700` ledge shadow (about 1.7:1), so the bottom side shows no >= 3:1 change. The ring is still clearly visible on three sides, so I do not count it as a failure. Fix: `.btn--primary:focus-visible { box-shadow: 0 0 0 2px var(--night); }` (drop the ledge while focused) and use `outline-color: var(--ink)` for controls on day cards and the light nav.
- F4 (Minor). The mobile-menu focus trap (`main.js` lines 40 to 49) cycles only the menu links and the Menu button; the brand link and Pause button in the same header are skipped while the menu is open. Not a trap (Escape and the toggle work), but Pause cannot be reached without closing the menu. Fix: build the cycle from `#nav` `a[href], button` like Sakura.
- F5 (Minor, not WCAG). Paused and reduced-motion modes still run `ScrollTrigger.min.js` `_rafBugFix` (about 145 rAF callbacks per second, 0 draws); nothing moves. Same as Sakura S1.

## 3. saffron-court: FAIL (only X1 below, the open mobile menu at 320x256; everything in this section passed)

No failure found in this section (see X1). Note on method: the first contrast and pause runs on this site were invalid (the plain `http.server` refused some module requests under load, so the scene did not load); the server was replaced with a threaded one with a large backlog and pause, reflow, flash and contrast were re-run; every re-run had a clean console except SC1.

Checked and clean:
- axe: 0 violations in all 8 configurations.
- Structure: one `h1`, landmarks, canvas `aria-hidden`, no unnamed controls; brand link name "Saffron Court, back to top" contains its visible text.
- Skip link: first stop, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#spice`, `#tandoor`, `#menu`, `#reserve` (1440) and mobile `#tandoor` (390): focus on the target section, menu closed, next Tab continues.
- Mobile menu: opens, `main` and `footer` `inert` (code-review C8 fixed), Tab cycle links / "Reserve a table" / Pause / Menu, Shift+Tab, Escape returns focus to Menu.
- Focus ring: all 16 stops (1440) and 12 (390) show a >= 3:1 teal ring (`#5fe0d3`, 3px) on every side. The footer links at 1440 read "bottom side missing" only because the browser scrolled each link to the very bottom edge of the viewport, so the ring below was off-screen; not a site defect.
- Claim "header gradient and pause button": the permanent `.nav::before` gradient (`rgba(14,3,9,.82)` to `.6`) now backs the header at the top of the page. Measured over the live canvas: brand name 12.1 to 16.6:1 at every width and mode, nav links pass at every step, "Pause motion" label 17.2:1 settled and 14.1:1 at the brightest mid-transition frame. PASS. Pause button: name = visible text "Pause motion", constant, `aria-pressed` toggles, Enter/Space, 44px (44x44 icon-only at 390).
- Pause effect: paused = 0.0% screenshot difference and 0 draw calls at all 9 positions (running: 10,600 to 32,000 draws per 1.5 s, 7 to 32% of pixels moving); 0 infinite CSS animations; pointer causes no change. Reduced motion: 0 draws idle, still frames.
- Contrast: no text below threshold in any settled, mid-transition, reduced-motion or WebGL-off pass at 1440, 390, 720x450 and 320x256. (One 320x256 sample of "Reserve a table" read 1.82 at the 5th percentile with a 10:1 median, the dark label on the saffron button with part of the box over the bright button edge; it passes.)
- Reflow: nothing lost at 720x450 or 320x256 (normal and reduced motion), no horizontal scroll.
- Flash: largest screen-tile luminance change 7.6% (re-measured with real repaints at the gate, orbit, tandoor and thali stations); fast sweep 1 swing per second. Tandoor light varies +-32% (`scene.js` line 667) at about 0.7 to 2 Hz, but it lights a small part of the frame; under the flash threshold. The spice orbit and string lights are large continuous motion; the Pause button and reduced motion stop them.

Findings:
- SC1 (Moderate, functional, not a WCAG criterion). The adaptive-quality code throws on slow machines: `scene.js` line 748 `else if (composer && st.slow > 3) { composer.passes.splice(1, 1); bloom.dispose(); bloom = null; … }` runs again after bloom is already gone, removes a second pass (the output pass) and then calls `null.dispose()`. Seen in this audit as `PAGEERR Cannot read properties of null (reading 'dispose')` (1440, mid-transition run). The exception is inside `renderFrame`, so `loop()` never re-queues: the scene freezes until the next scroll wakes it, and the colour pipeline is left without its output pass. Fix: `else if (composer && bloom && st.slow > 3) { composer.removePass(bloom); bloom.dispose(); bloom = null; st.slow = 0; }`.
- SC2 (Minor). The mobile-menu focus cycle (`main.js` line 46) skips the brand link; harmless, but inconsistent with the visible header. Optional fix: include `.brand`.
- SC3 (Minor, not WCAG). Paused and reduced-motion modes still run about 130 to 280 rAF callbacks per second with 0 draws (ScrollTrigger internal loop, as on Sakura and Forno). No visible effect.

## 4. maison-claire: FAIL (1.4.3 MC1 in reduced motion, 1.4.10 X1)

Console: no errors.

Checked and clean:
- axe: 0 violations in all 8 configurations.
- Structure: one `h1` "Maison Claire", landmarks, footer `nav[aria-label=Footer]`, canvas `aria-hidden`; brand link "MC" monogram is `aria-hidden`, so the name is "Maison Claire"; scroll cue link name "Scroll to the reveal" starts with its visible text "Scroll".
- Skip link: first stop, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#cloche`, `#wine`, `#menu`, `#reserve` and mobile `#wine`: focus on the target section, menu closes, next Tab continues.
- Mobile menu: opens, `main` and `footer` `inert` (code-review M13 fixed), Tab cycles brand / links / Pause / Menu, Shift+Tab, Escape returns focus to Menu.
- Focus ring: 17 stops at 1440, 13 at 390, all four sides >= 3:1 (2px champagne `#e6cf9f` outline, 3px offset, on dark panels and the dark header).
- Pause motion: name "Pause motion" (shown in capitals via CSS; the name matches case-insensitively, fine for 2.5.3), constant, `aria-pressed` toggles, Enter/Space, 44px. Paused: 0.0% difference and 0 draw calls at all 9 positions; pointer movement no longer moves the scene (code-review M11 fixed: `scene.js` line 680). Reduced motion: 0 draws idle.
- Claim "hero panel text >= 8:1": re-sampled on the real pixels: kicker "French bistro & fine dining" 8.9 to 10.0:1, "Sample design" 9.0 to 9.9:1, `h1` 14.4 to 15.8:1, lede 13.1 to 15.8:1, across 1440, 390, 720x450, 320x256, reduced motion, WebGL-off and mid-transition; also at 1024x768 and 1366x768 (the laptop case from code-review M3): no failures. PASS (lowest 8.89:1).
- Claim "sweep minimum 5.37:1": the lowest settled value on the whole page at 1440, 390, 1024x768 and in WebGL-off is exactly 5.37:1 (`p.kicker--ink` "Tasting menu", `#7a5c24` on the ivory menu card). PASS.
- Reflow: nothing lost at 720x450 or 320x256, no horizontal scroll.
- Flash / vestibular: largest tile luminance change 3.7% (real repaints, 5 positions); candle flame is a small shader element. Camera descent and orbit are scroll-driven and smooth; idle drift stops when paused and under reduced motion.

Findings:
- MC1 (Moderate, WCAG 1.4.3 Contrast Minimum, AA). Under `prefers-reduced-motion`, the hero's "Scroll" cue link (`.scrollcue__text`, 11px, `#f1eadb`, no backing) stays on screen after the scene has switched to the bright ivory still frame of the next station: 1.22:1 at 1440x900 (scroll 648) and 1.16:1 at 1366x768 (scroll 552). It is fine at the top (16.3:1) and in normal motion. Evidence: `a3_probe_maison-claire__scrollcue__text.png`. Fix: give the cue its own backing, e.g. `.scrollcue { padding: 0 14px; background: rgba(18,17,16,.82); border-radius: 999px; }`, or hide it once the hero leaves: `html.rm .scrollcue { display: none; }` is also acceptable since the page scrolls normally in that mode.
- MC2 (Minor, transient). During reveal fades the menu card (opacity 0.58) and the reserve panel (0.24 to 0.36) pass through low ratios (1.8 to 4.2:1). They settle at 5.37:1 and above within the 0.7 s reveal; not counted.

## 5. blue-pearl: FAIL (only X1 below, the open mobile menu at 320x256)

Console: no errors in normal and reduced motion. In my WebGL-off run `THREE.WebGLRenderer: Error creating WebGL context` is logged; that comes from my test shim (it blocks WebGL on `<canvas>` but not on the `OffscreenCanvas` in the site's worker probe, `main.js` line 231), so a real no-WebGL browser should not hit it. Not counted.

Checked and clean:
- axe: 0 violations in all 8 configurations.
- Structure: one `h1`, landmarks, canvas `aria-hidden`, decorative rail `ol#rail` (it also gets `inert` while the menu is open), no unnamed controls.
- Skip link (code-review B6 fixed): first stop; the ring is now a 3px `#031c24` outline with a 6px white halo, >= 3:1 on all sides over the bright surface scene (1440 and 390). Enter focuses `main#main`, next Tab "Reserve a table". Anchors `#dive`, `#catch`, `#menu`, `#reserve` and mobile `#catch`: focus on the target section, which is scrolled to 84px below the top so it clears the header; next Tab continues.
- Mobile menu: opens, `main`, `footer` and the rail get `inert`, Tab cycles links / CTA / brand / Pause / Menu, Shift+Tab, Escape returns focus to Menu.
- Focus ring: 16 stops (1440) and 12 (390) all >= 3:1 on every side (white 3px outline plus a dark `box-shadow` on buttons).
- Pause motion: name = visible text, constant, `aria-pressed` toggles, Enter/Space, 44px. Paused: 0.0% difference, 0 draw calls AND 0 rAF callbacks at all 9 positions (the only site whose idle rAF stops completely). Reduced motion: same, 0 draws, 0 rAF. Running: 8 to 34% of pixels moving (bubbles, fish, caustics, light shafts).
- Claim "390 text >= 5.44:1": lowest settled text at 390 is `[Price]` 7.0:1 and the coral "Reserve a table" button 6.49:1 (dark `#04222a` on coral). The only lower readings are the hero CTA while it slides under the floating header pill (5.1:1 median), and the visually hidden "Menu" label, both measurement cases, not failures. PASS.
- Claim "overlay": the open mobile menu (`rgba(2,20,27,.97)`) measured over the live scene at 390 (scroll 0, 1800, 3600) and 320: links 10.9 to 14.5:1, brand 17:1, coral CTA 6.49:1. PASS.
- Contrast elsewhere: no settled text below threshold at 1440, 390, 720x450, 320x256, reduced motion, WebGL-off posters or mid-transition (1440 lowest: coral CTA 6.49:1, `[Price]` 6.7:1).
- Reflow (page): nothing lost at 720x450 or 320x256, no horizontal scroll.
- Flash / vestibular: largest tile luminance change 5.1% (light shafts and caustics are slow); no flash risk. The dive is a large scroll-linked camera move, but it is smoothed, driven only by the user's scroll, and replaced by still frames under reduced motion.

## X1. All five sites: the open mobile menu is cut off at 320x256 (Moderate, WCAG 1.4.10 Reflow, AA)

Found after the per-site runs, with a separate check (`a3_menu320.py`): open the menu with the keyboard at 320x256 (1280 at 400% zoom), list each item's position, Tab through, try to scroll the menu.
The page behind is locked (`html { overflow: hidden }` while open), and the menu panel neither fits nor scrolls (`overflow-y: visible`; mouse wheel moves nothing). Tab still moves focus to the off-screen items, so the focus ring disappears below the window edge.

| Site | Items below the 256px window (cannot be reached) | Menu panel |
|---|---|---|
| sakura-omakase | "Reserve a seat" (276 to 328); "Chef's tools" is cut at 252 | `#navMenu.nav__menu`, height 312 |
| forno-rosso | "Menu" (260 to 308), "Reserve" (320 to 368) | height 290 |
| saffron-court | "Reserve" cut (252 to 304), "Reserve a table" (328 to 372); the wheel scrolls the page behind instead (scrollY 0 to 270) | height 348 |
| maison-claire | "The reveal" (top -7 to 52) sits behind the 12 to 56px header (only a 12px sliver shows); "Reserve" cut at the bottom (204 to 263) | full-height panel, content centred so it overflows at both ends |
| blue-pearl | "Menu" (228 to 288), "Reserve" (288 to 348), "Reserve a table" (380 to 436) | `position: fixed; inset: 0`, `style.css` line 239 |

At 720x450 and 390x667 every menu item fits on all five sites (checked). Mitigation: every menu destination is also linked in the footer, and the page itself reflows correctly, so this is Moderate, not Serious; but with the menu open a zoom user tabs onto controls they cannot see.
Fix (each site's mobile-menu media query): make the panel a scroll container that fits the viewport, e.g.
`#navMenu { max-height: calc(100dvh - var(--nav-h)); overflow-y: auto; overscroll-behavior: contain; }` (for full-screen panels such as Blue Pearl and Maison: `overflow-y: auto` on the panel and `justify-content: flex-start` so nothing overflows above the top). Then focused items scroll into view automatically.
Verify: at 320x256, open the menu, Tab to the last item: it is fully visible with its ring; the wheel scrolls the menu, not the page.

## Summary

| Site | WCAG 2.2 AA | Failures | Top other items |
|---|---|---|---|
| sakura-omakase | FAIL | X1 (menu at 320x256) | Minor only: ScrollTrigger rAF under reduced motion, transient "Scroll" cue |
| forno-rosso | FAIL | F1 sticky cards cut off at 320x256 (hero `h1`, lead, three menu rows unreachable); F2 hero eyebrow 3.5:1 at 720x450 under the nav shadow; X1 | F3 primary-button ring weak on the bottom edge; F4 menu trap skips Pause |
| saffron-court | FAIL | X1 | SC1 adaptive-quality code throws `null.dispose()` and freezes the scene on slow machines |
| maison-claire | FAIL | MC1 "Scroll" cue 1.2:1 in reduced motion; X1 | transient reveal fades |
| blue-pearl | FAIL | X1 | none |

Builder claims re-tested: Maison hero >= 8:1 (verified, lowest 8.89:1) and sweep minimum 5.37:1 (verified exactly); Blue Pearl 390 text >= 5.44:1 (verified, lowest settled 6.49:1) and the menu overlay (verified, 10.9:1 and above); Forno `nothing hiding.` (verified, 5.0 to 5.2:1, needs 3:1) and cards at 390 and reduced motion (verified at rest; the 720x450 eyebrow F2 is new); Saffron header gradient and pause button (verified, 12:1 and above); Sakura skip link and focus trap (verified, including `inert`).
Everything else that passed on all five: axe clean in 40 runs; one `h1`; landmarks; canvas hidden from AT; skip link and every anchor move focus to the target; Escape and focus return on every menu; focus rings >= 3:1 on the real pixels (Forno primary buttons excepted, F3); Pause button name = visible text with `aria-pressed`, really stops idle motion (0 draw calls) on all five; reduced motion renders still frames with 0 idle draws; no flash risk (largest idle luminance change 7.6% of a screen tile).

After the fixes, re-run: `a3_menu320.py <site> 320 256` (X1), `a3_reflow.py forno-rosso` (F1), `a3_probe.py forno-rosso 720 450 - 810 "p.eyebrow" Neapolitan` (F2), `a3_contrast.py maison-claire 1440-rm,1366x768-rm` (MC1).
Not tested: NVDA, JAWS, VoiceOver, voice control, Windows high-contrast / forced-colours mode, real phones. Evidence and scripts: session scratchpad, `r3/*.log`, `a3_*.json`, `a3_f320_a.png`, `a3_probe_*.png`, `a3_menu_*.png`.
