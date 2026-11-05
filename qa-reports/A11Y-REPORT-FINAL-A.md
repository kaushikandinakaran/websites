# Accessibility audit FINAL-A: 5 restaurant 3D sites, WCAG 2.2 AA (after the second fix round)

Auditor: independent accessibility auditor (final pass). Date: 2026-11-04. No site files were edited. Server: `python showcase/serve.py 8873`, one site at a time.
Predecessor: `qa/A11Y-REPORT-3D.md` (findings X1, F1, F2, F3, F4, MC1, SC1 to verify).

Method (scripts `af_*.py` in the session scratchpad; Playwright headless Edge, every browser closed after each run; axe-core 4.x loaded from the scratchpad only), same as the predecessor:
- axe-core (WCAG 2.0/2.1/2.2 A+AA + best-practice) at 1440x900 and 390x844 (normal, reduced motion, WebGL off), 720x450 and 320x256, after a full scroll pass.
- Keyboard: Tab walkthrough at 1440 and 390 with the focus indicator measured against the real pixels (focused vs blurred screenshot, motion paused; each side needs a >= 3:1 change along >= 90% of its length); skip link and nav anchors (where focus lands, next Tab).
- Mobile menu at 320x256 and 390x667: item positions, Tab cycle with ring-in-window check, Shift+Tab, wheel scrolls the menu (not the page), Escape returns focus, `inert` on the page behind.
- Pause motion: name vs visible text, `aria-pressed`, screenshot difference, WebGL draw calls and rAF callbacks per 1.5 s at 9 scroll positions.
- Text contrast: text hidden, screenshot, text colour (with opacity chain) composited on the real pixels; 5th percentile vs threshold. Settled and mid-transition passes.
- Reflow 720x450 and 320x256; flash / vestibular burst capture (WCAG 2.3.1).

## 1. sakura-omakase: PASS (WCAG 2.2 AA, within the tested scope; one Minor item)

Predecessor findings:
- X1 (menu cut off at 320x256): FIXED. `#navMenu` now `max-height: calc(100dvh - var(--nav-h)); overflow-y: auto; overscroll-behavior: contain` (`style.css` line 121). 320x256: panel 64..256, scrollHeight 312 / clientHeight 191; Tab to "Reserve a seat" scrolls the menu (scrollTop 121) and the item lands at 155..207, fully in view; the mouse wheel over the menu scrolls the menu (0 to 121) and the page stays at scrollY 400. 390x667: everything fits. Focus cycle (both sizes): The counter, Omakase, Chef's tools, Reserve a seat, brand, Pause motion, Menu, and around again; Shift+Tab reverses; nothing in `main`/`footer` is reached (`inert` on both); Escape closes, focus back on Menu, `aria-expanded=false`, `inert` removed.
- S1 (ScrollTrigger rAF under reduced motion, Minor): FIXED. Paused and reduced motion: 0 draw calls AND 0 rAF callbacks per 1.5 s at all 9 positions.

Checked and clean:
- axe: 0 violations in all 8 configurations (1440/390 normal, reduced motion, WebGL off; 720x450; 320x256); console clean, no 404s; no horizontal scroll.
- Keyboard: 15 Tab stops at 1440, 12 at 390, every side of every ring >= 3:1 on the real pixels (3px `#ffd27a` outline + 7px dark halo). Skip link first, visible, focuses `main#main`, next Tab "Reserve a seat". Anchors `#counter`, `#omakase`, `#tools`, `#reserve` and the mobile `#omakase` link: focus on the target section, menu closed, next Tab continues in DOM order.
- Pause motion: name "Pause motion" = visible text (44x44 icon-only at 390 with the text kept for AT), `aria-pressed` false/true, Enter pauses, Space resumes. Paused: 0.0% screenshot change, 0 infinite CSS animations, pointer moves nothing. Running: 9,500 to 26,000 draws per 1.5 s.
- Reduced motion: still frames, 0 idle draws, 0 rAF.
- Reflow: 720x450, 320x256, 320x256 reduced motion: every text element fully visible at some scroll position, no horizontal overflow.
- Contrast (settled): no text below its threshold at 1440, 390, 720x450, 320x256, 1440 reduced motion, 1440 WebGL-off poster, 390 mid-transition. 1440 mid-transition: one hit only, the aria-hidden decorative "Scroll" cue (`.station--hero span`, 11px) at 1.38:1 (5th pct) while it fades out on the first scroll step: same as the predecessor's S2, decorative and leaving, not counted.
- Flash / vestibular: burst capture at 5 positions: largest tile luminance change 0.55% idle; fast scroll sweep 12.8% in one tile, 1 swing per second (threshold: more than 3). Note: the shared GPU gave only 2 to 10 capture fps, so very fast flicker could be missed; the lantern flicker code was unchanged in kind (small +-6.5% intensity) per the predecessor's source check.

New findings:
- SA1 (Minor, WCAG 2.4.7 robustness; not a failure). At 320x256 with the menu open, "Chef's tools" (200..252) sits inside the visible part of the scroll container, so the browser does not scroll it, and the bottom side of its focus ring (3px outline, 3px offset, so it ends at 258) is clipped by the window edge (measured: top/left/right 100%, bottom 0%; `af_menuring_sakura-omakase_320_2.png`). Three sides stay clearly visible and the item is not hidden, so 2.4.7 and 2.4.11 pass. Fix: `.nav__menu { scroll-padding-block: 10px; padding-bottom: 10px; }` inside the mobile media query (`style.css` ~line 121), as Forno already does.

## 2. forno-rosso: PASS (WCAG 2.2 AA, within the tested scope)

Predecessor findings:
- F1 (Serious, 1.4.10, sticky cards cut off at 320x256): FIXED. New `@media (max-height: 520px)` unpins the cards (`style.css` lines 258-262). Reflow scan at 320x256 (normal and reduced motion) and 720x450: 0 elements never fully visible, 0 taller than the viewport, no horizontal overflow. The hero eyebrow, `h1` "Forno Rosso", hero lead and the three menu rows reported last time are now all fully on screen at some scroll position.
- F2 (Moderate, 1.4.3, hero eyebrow 3.07:1 at 720x450): FIXED. Eyebrow now `--terra-700` (`rgb(143,47,20)`, `style.css` line 128) and the hero is no longer pinned under the nav at 720x450. Probe on real pixels at 720x450, scroll 0: 6.29:1 median, 5.84:1 5th percentile. Full 720x450 settled scan: no text below threshold.
- F3 (Minor, primary-button ring bottom edge): FIXED. Nav "Reserve" and hero "Reserve a table" now show a 3px `#3a1d12` outline plus a 2px dark ring with the ledge dropped; all four sides >= 3:1 at 1440 and 390 (minside 1.0).
- F4 (Minor, menu trap skipped brand and Pause): FIXED. Cycle at 320x256 and 390x667: Dough, Toppings, Oven, Menu, Reserve, brand "Forno Rosso", Pause motion, Menu button, and around; Shift+Tab reverses.
- X1 (menu cut off at 320x256): FIXED. Panel `max-height: calc(100dvh - var(--nav-h) - 30px); overflow-y: auto; overscroll-behavior: contain; scroll-padding-block: 10px` (`style.css` line 202). 320x256: scrollHeight 290 / clientHeight 168; Tab scrolls the menu (scrollTop 6, 106, 116) and every item lands fully in view with all four ring sides visible (measured on pixels); wheel scrolls the menu (0 to 122), page stays at scrollY 400; Escape returns focus to Menu, `aria-expanded=false`, `inert` (main, footer) removed. 390x667: all items fit.
- F5 (ScrollTrigger rAF when paused / reduced motion, Minor): FIXED. 0 draws and 0 rAF callbacks per 1.5 s at all 9 positions, paused and reduced motion (`main.js` `sleepGsap` disables ScrollTrigger).

Checked and clean:
- axe: 0 violations in all 8 configurations; console clean, no 404s; no horizontal scroll.
- Keyboard: 16 stops at 1440, 12 at 390, every ring >= 3:1 on all four sides. Skip link first, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#dough`, `#toppings`, `#oven`, `#menu`, `#reserve` and the mobile `#toppings`: focus on the target section (top 0), menu closed, next Tab continues inside it.
- Pause motion: name = visible text "Pause motion", `aria-pressed` toggles, Enter/Space, 44px (44x44 at 390). Paused: 0.0% change, 0 infinite animations, pointer moves nothing.
- Contrast (settled) at 1440, 720x450, 320x256 and 1440 reduced motion: no real failures. The few low 5th-percentile readings (menu rows, `[Price]`, `[Street address]`, p5 1.0 to 1.6 with medians 8 to 16:1) are rows partly scrolled under the sticky light nav pill; a probe crop (`af_probe_forno-rosso__dishesb.png`) shows the text cut by the nav edge, so the box mixes in the nav background: measurement case, not a defect. Nav links settled at the oven/menu boundary: 12.8:1 and above; current "Menu" pill 14.6:1.
- Mid-transition (1440 and 390, 380 ms after a jump): low values only while cards fade in (opacity 0.47 to 0.83, e.g. Toppings card 2.0 to 2.8:1, eyebrow number badge 3.9:1, "Book a table" 4.0:1) and while the nav's current-item pill swaps colour (one frame, "Menu" 1.0:1). All settle to passing values within the reveal; transient, not counted (same rule as the predecessor).
- Flash: idle tile change at most 0.4%, fast scroll sweep 26.7% in one tile but 1 swing per second (threshold: more than 3). Low capture rate caveat as for Sakura.

New findings: none.

## 3. saffron-court: PASS (WCAG 2.2 AA, within the tested scope; two Minor items)

Predecessor findings:
- X1 (menu cut off at 320x256): FIXED. `#navMenu` `max-height: calc(100dvh - var(--nav-h)); overflow-y: auto; overscroll-behavior: contain` (`style.css` lines 133-134). 320x256: scrollHeight 348 / clientHeight 183; Tab scrolls the menu (scrollTop 49, then 165) so "Reserve a table" lands at 163..207; wheel scrolls the menu (0 to 165), page stays at scrollY 400 (last time the wheel scrolled the page behind). Escape returns focus to Menu, `aria-expanded=false`, `inert` removed. 390x667: all items fit.
- SC1 (adaptive quality throws `null.dispose()`): FIXED in code (`scene.js` line 899 now `else if (composer && bloom && st.slow > 3) { composer.removePass(bloom); bloom.dispose(); bloom = null; st.slow = 0; }`), and no page error in any run of this audit (axe 8 configs, UI, ring, pause, reflow, contrast).
- SC2 (menu cycle skipped the brand, Minor): FIXED. Cycle: Spice orbit, Tandoor, Thali menu, Reserve, Reserve a table, brand "Saffron Court, back to top", Pause motion, Menu, and around; Shift+Tab reverses; nothing inside `main`/`footer`.
- SC3 (ScrollTrigger rAF when paused / reduced motion, Minor): FIXED. 0 draws and 0 rAF per 1.5 s at all 9 positions, paused and reduced motion.

Checked and clean:
- axe: 0 violations in all 8 configurations; console clean, no 404s; no horizontal scroll.
- Keyboard: 16 stops (1440), 12 (390). Skip link first, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#spice`, `#tandoor`, `#menu`, `#reserve` and the mobile `#tandoor`: focus on the target section, menu closed, next Tab continues in it. All rings >= 3:1 (3px `#5fe0d3`) except the footer case SC4 below.
- Pause motion: name = visible text "Pause motion", constant, `aria-pressed` toggles, Enter/Space, 44px (44x44 at 390). Paused: 0.0% change, 0 infinite animations, pointer moves nothing (running: 13 to 29% of pixels moving).
- Reduced motion: still frames, 0 idle draws, 0 rAF.
- Reflow: 720x450, 320x256 and 320x256 reduced motion: nothing lost, no horizontal overflow.
- Contrast: settled 1440 (91 text items, 30 stops), settled 390, 1440 reduced motion, and 720x450 mid-transition: no text below its threshold anywhere.
- Flash: not re-captured this round (time); the predecessor measured 7.6% max tile change and the tandoor light code is unchanged in kind (small area, about 0.7 to 2 Hz). Idle motion stops when paused and under reduced motion (measured above).

New findings:
- SC4 (Minor, 2.4.7 robustness; not a failure). When Tab reaches the footer links ("The gate", "Spice orbit", "Tandoor", "Thali menu", "Reserve"), the browser scrolls each one flush with the bottom of the window (rect bottom = 900 at 1440, 844 at 390), so the bottom side of the 3px ring (3px offset) lies outside the window; three sides remain clearly visible. Fix: `html { scroll-padding-bottom: 16px; }` (and `scroll-padding-top: var(--nav-h)` is a good companion), so focused elements stop clear of the edges.
- SC5 (Minor, same as Sakura SA1). Open menu at 320x256: "Thali menu" (200..252) and "Reserve" (203..255) are focused without the menu scrolling, so the bottom side of their ring is clipped at the window edge (measured bottom 0%, other sides 100%). Fix: `#navMenu { scroll-padding-block: 10px; padding-bottom: 10px; }` in the mobile media query.


## 4. maison-claire: PASS (WCAG 2.2 AA, within the tested scope; one Moderate and one Minor item)

Predecessor findings:
- MC1 (Moderate, 1.4.3, reduced-motion "Scroll" cue 1.2:1): FIXED. Under `prefers-reduced-motion` the cue now has its own pill `rgba(14,13,12,.86)` (`style.css` line 272). Probe on the real pixels: 1440x900 reduced motion scroll 0: 16.2:1; scroll 648 (where it was 1.22:1): 11.94:1 (5th pct), 12.1:1 median; 1366x768 reduced motion scroll 552 (was 1.16:1): 11.28:1 (5th pct). Full 1366x768 reduced-motion sweep: no text below threshold.
- X1 (menu cut off at 320x256): FIXED for reachability, with a residual (MC3 below). The full-screen panel now scrolls (`overflow-y: auto; overscroll-behavior: contain; align-items: safe center`, `style.css` line 108): at 320x256 scrollHeight 377 / clientHeight 256; on opening, "The reveal" sits at 80..138 under the header, fully visible (last time only a 12px sliver); Tab scrolls the panel so "Reserve" lands at 170..228; wheel scrolls the panel (0 to 121), page stays put; Escape returns focus to Menu, `inert` removed. Cycle: brand, The reveal, The wine, Tasting menu, Reserve, Pause motion, Menu; Shift+Tab reverses. 390x667: all items fit.
- MC2 (transient reveal fades, Minor): unchanged and still transient (720x450 mid-transition: menu card at opacity 0.54 to 0.87 reads 2.2 to 4.1:1 for 380 ms, settles at passing values). Not counted.

Checked and clean:
- axe: 0 violations in all 8 configurations; console clean, no 404s; no horizontal scroll.
- Keyboard: 17 stops at 1440, 13 at 390, every ring >= 3:1 on all four sides (2px `#e6cf9f`, 3px offset). Skip link first, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#table`, `#cloche`, `#wine`, `#menu`, `#reserve` and the mobile `#wine`: focus on the target section, menu closed, next Tab continues.
- Pause motion: name "Pause motion" (shown in capitals by CSS; matches case-insensitively, fine for 2.5.3), constant, `aria-pressed` toggles, Enter/Space, 44px (44x44 at 390). Paused: 0.0% change, 0 draws, 0 rAF, 0 infinite animations, pointer moves nothing. Reduced motion: still frames, 0 draws, 0 rAF.
- Reflow: 720x450, 320x256, 320x256 reduced motion: nothing lost, no horizontal overflow.
- Contrast (settled) at 1440, 390, 1440 reduced motion and 1366x768 reduced motion: no real failures. One reduced-motion reading ("A fish course with a light sauce.", p5 1.79, median 8.05) is the line half under the dark sticky header (crop `af_probe_maison-claire__coursep.png`): measurement case, not a defect.
- Flash: not re-captured this round (time); predecessor measured 3.7% max tile change; the candle flame is a small shader element; idle motion stops when paused / reduced motion (measured).

New findings:
- MC3 (Moderate, usability under zoom; WCAG 2.4.11 and 1.4.10 still pass). At 320x256 with the menu open, when focus wraps from the brand (or Shift+Tab goes up) to "The reveal", the panel scrolls it to its own top edge (scrollTop 80), which is under the transparent fixed header: the item (0..58) is drawn behind the brand link, the Pause button and the Menu button, so the text and the header controls overlap and are hard to read (`af_mc_reveal_320.png`; hit test: the brand covers the item from y 14 to 54). The ring's top sliver and the item's top 12px stay visible, so the focused item is not entirely hidden (2.4.11 passes). Fix: in the mobile media query, `.nav__menu { scroll-padding-top: calc(var(--nav-h) + 12px); scroll-padding-bottom: 12px; }` (`style.css` line 108); or give the header an opaque backing while the menu is open.
- MC4 (Minor, same as Sakura SA1). Open menu at 320x256: "Tasting menu" (198..256) is focused without the panel scrolling, so the bottom side of its ring is clipped at the window edge; the Pause button's bottom ring is 78% visible over the menu text. The `scroll-padding` fix above also cures this.

## 5. blue-pearl: PASS (WCAG 2.2 AA, within the tested scope; one Moderate and one Minor item)

Predecessor findings:
- X1 (menu cut off at 320x256: "Menu", "Reserve", "Reserve a table" unreachable): FIXED for reachability, with a residual (BP1 below). The full-screen panel now scrolls (`overflow-y: auto; overscroll-behavior: contain`, `style.css` line 242): 320x256 scrollHeight 484 / clientHeight 256; Tab scrolls the panel (scrollTop 32, then 190) so "Reserve" (98..158) and "Reserve a table" (190..246) land fully in view; wheel scrolls the panel (0 to 228), page stays at scrollY 400; `inert` on `main`, `footer` and the rail; Escape returns focus to Menu, `aria-expanded=false`, `inert` removed. Cycle: The dive, The catch, Menu, Reserve, Reserve a table, brand, Pause motion, Menu button; Shift+Tab reverses. 390x667: all items fit.

Checked and clean:
- axe: 0 violations in all 8 configurations; console clean in all modes (no WebGL error this time in the WebGL-off run), no 404s; no horizontal scroll.
- Keyboard: 16 stops at 1440, 12 at 390, every ring >= 3:1 on all four sides. Skip link first, visible, focuses `main#main`, next Tab "Reserve a table". Anchors `#dive`, `#catch`, `#menu`, `#reserve` and the mobile `#catch`: focus on the target section, which is placed 84px from the top so it clears the header; next Tab continues.
- Pause motion: name = visible text "Pause motion", constant, `aria-pressed` toggles, Enter/Space, 44px (44x44 at 390). Paused: 0.0% change, 0 draws, 0 rAF, 0 infinite animations, pointer moves nothing (running: 7 to 28% of pixels moving). Reduced motion: still frames, 0 draws, 0 rAF.
- Reflow: 720x450, 320x256, 320x256 reduced motion: nothing lost, no horizontal overflow.
- Contrast: settled 1440, 390, 1440 reduced motion and 720x450 mid-transition: no real failures. The only low readings are the visually hidden "Menu" label of the toggle (1x1 clipped text, measurement case) and the hero "Reserve a table" while it passes under the floating header pill (median 5.11:1), both seen and explained by the predecessor as measurement cases.
- Flash: not re-captured this round (time); predecessor measured 5.1% max tile change (slow shafts and caustics); idle motion stops when paused / reduced motion (measured).

New findings:
- BP1 (Moderate, usability under zoom; WCAG 2.4.11 and 1.4.10 still pass). Same mechanism as Maison MC3: at 320x256, Shift+Tab from "Menu" up to "The catch" scrolls the full-screen panel so the item sits at 0..60, under the transparent fixed header (12..72): the item text is drawn behind the brand "Blue Pearl", the Pause and Menu buttons, overlapping and hard to read (`af_bp_shift_320.png`; hit test: header covers the item from y 14 to 58). The item's top strip and ring top stay visible, so it is not entirely hidden. Fix: `.nav__menu { scroll-padding-top: calc(var(--nav-h) + 16px); scroll-padding-bottom: 16px; }` in the mobile media query (`style.css` lines 239-243), or an opaque header bar while the menu is open.
- BP2 (Minor, same as Sakura SA1). Open menu at 320x256: Tab to "Menu" (196..256) does not scroll the panel enough, so the bottom side of its ring is clipped at the window edge; the brand ring in the open state shows 80% of its top and bottom edges over the menu text. The `scroll-padding` fix in BP1 cures the first part.

## Summary

| Site | WCAG 2.2 AA (tested scope) | Predecessor findings | New findings |
|---|---|---|---|
| sakura-omakase | PASS | X1 FIXED, S1 FIXED (S2 transient cue unchanged, decorative) | SA1 Minor: menu item ring bottom clipped at 320x256 |
| forno-rosso | PASS | F1 FIXED, F2 FIXED (5.84:1), F3 FIXED, F4 FIXED, F5 FIXED, X1 FIXED | none |
| saffron-court | PASS | X1 FIXED, SC1 FIXED (code + no page error), SC2 FIXED, SC3 FIXED | SC4 Minor footer rings flush with window bottom; SC5 Minor menu ring clipped at 320x256 |
| maison-claire | PASS | MC1 FIXED (11.3 to 11.9:1), X1 FIXED (reachable, scrolls) with residual MC3; MC2 transient | MC3 Moderate: menu item scrolled under the transparent header at 320x256; MC4 Minor |
| blue-pearl | PASS | X1 FIXED (reachable, scrolls) with residual BP1 | BP1 Moderate: same as MC3; BP2 Minor |

All seven required predecessor findings (X1, F1, F2, F3, F4, MC1, SC1) are fixed. No WCAG 2.2 A/AA failure was found in the tested scope. One small CSS change fixes every new item on all five sites: give the mobile menu panel `scroll-padding-top: calc(var(--nav-h) + 12px); scroll-padding-bottom: 12px` (and `html { scroll-padding-bottom: 16px }` for Saffron's footer).

Mid-transition low readings (cards and reveal panels at opacity 0.47 to 0.87 for about 0.4 s, nav current-pill colour swap) are transient and settle to passing values; not counted, same rule as the predecessor.

Not tested / limits: no NVDA, JAWS, VoiceOver, TalkBack or voice-control session (screen-reader remarks come from the Chromium accessibility tree only); no Windows high-contrast / forced-colours mode; no real phones. Flash was re-captured only on Sakura and Forno (1440); for Saffron, Maison and Blue Pearl it relies on the predecessor's measurements plus this round's proof that idle motion stops when paused / reduced motion. WebGL-off contrast re-run only on Sakura (axe ran WebGL-off on all five); 390 reduced-motion contrast only on Sakura. Headless Edge on a GPU shared with another agent gave 2 to 10 capture fps, so very fast flicker could be missed. This is not a claim of full conformance.

Evidence: session scratchpad `rf/<site>.*.log`, `af_*.json`, `af_menuring_*.png`, `af_mc_reveal_320.png`, `af_bp_shift_320.png`, `af_probe_*.png`. Re-run: `sh af_run.sh <site>` (port 8873), `af_menu.py`, `af_menuring.py`, `af_mc_reveal.py`, `af_bp_shift.py`.
