# Accessibility re-audit (round 2): 5 showcase sites, WCAG 2.2 AA

Auditor: independent accessibility auditor. Date: 2026-11-03. No site files were edited. Server on port 8812 only, now stopped.
Method: same as round 1 (`A11Y-REPORT.md`). Edge via Playwright; axe-core in normal and reduced-motion modes at 1440 and 390; pixel-based contrast of every text node at scroll steps plus a hover pass (1440, 390 and 720x450); full Tab walkthrough with a before/after focus-ring pixel diff; skip link, in-page link and mobile-menu focus tests; pause-button tests at 1440, 390 and 320; accessibility tree; reflow and text spacing at 720x450, 320x256, 1440 and 390; target sizes.
Not done: no NVDA/JAWS/VoiceOver or voice-control session (screen-reader remarks come from the accessibility tree).
Console: no errors on any site. No horizontal scroll at 1440, 720, 390 or 320 on any site.

## Correction to my round-1 report

In round 1 I dismissed a "LOWCR" reading on the Lumière footer focus ring as a measurement artifact, assuming the footer was dark. It is not: `.footer` is `var(--sand)` (`#F5F0E6`), and the ring there is gold. The reading was correct. It is finding R2-L1 below, and it existed in round 1.

## Verdicts

| Site | WCAG 2.2 AA | Why |
|---|---|---|
| ember-table | PASS (within what was tested) | No A/AA failure found. Minor items only (R2-E1, R2-X1). |
| lumiere-spa | FAIL | R2-L1: footer focus ring is 2.43:1 against its background (1.4.11, AA). One-line fix. |
| apex-forge | PASS (within what was tested) | No A/AA failure found. Minor item R2-X1 only. |
| northline-studio | FAIL | R2-N1: unrevealed statement words are 2.56:1 (1.4.3, AA). |
| nova-labs | FAIL | R2-V1: when motion is paused the button's visible text says "Play motion" but its accessible name stays "Pause motion" (2.5.3, A). Trivial fix. |

"PASS" means no failure of an applicable A/AA criterion was found by the tests above. It is not a claim of full conformance: assistive-technology testing was not done.

## Round-1 findings: verified fixed

| ID | Finding | Result | Evidence |
|---|---|---|---|
| F1 | Skip link and in-page anchors do not move focus (4 sites) | FIXED on all 5 | Tab, Enter on the skip link: focus lands on `main#main` (`tabindex="-1"`, no ring drawn); next Tab goes to the first control inside `main`; Shift+Tab goes back to the header. Nav link (1440) and mobile-menu link (390): focus lands on the target section (`#story`, `#rituals`, `#method`, `#services`, `#approach`, footers), menu closes (`aria-expanded="false"`), next Tab continues inside that section. No focus lost to `<body>`. No trap: Tab and Shift+Tab leave the sections normally. |
| F2 | No pause control for auto-moving content | FIXED on all 5 (see "Pause motion button" below) | Button with `aria-pressed` on every site; Enter pauses, Space resumes; idle screenshot difference 0.0% when paused; marquee transforms stay constant for 3 s; CSS infinite animations drop to 0. |
| A1 | Apex solid `.btn` focus ring clipped by `clip-path` | FIXED | Ring pixel-diff on the four formerly invisible buttons is now 2000 to 4400 px (was 1 to 2). Nav CTA, hero CTA, "Choose Hero", CTA dark button all show a ring. |
| A2 | Apex "us." 2.8:1 on the orange band | FIXED | No contrast failure on the CTA at 1440, 390 or 720x450. |
| A3, E4, N2 | Label in Name on brand links | FIXED on all 5 | Axe `label-content-name-mismatch` is gone. Ember label is now "Ember & Table, home"; Apex logo has no `aria-label`; Northline name reads "Northline Studio…". |
| E1 | Ember steam washes out hero text at small viewports | FIXED | At 720x450 the hero is dark behind the eyebrow and lead (no contrast failure at scroll 0; was about 1.1 to 1.3:1). 1440 and 390 clean. Screenshot: `scratchpad/a11y_ember_hero_std720.png`. |
| E2 | Ember marquee outline text 2.3:1 | FIXED | `style.css` line 337: stroke `1.5px rgba(244,232,214,.78)`, about 8:1. |
| E3 | Ember story words at 2.25:1 | FIXED | `html.js .story__big .sw { opacity: .58 }` (about 5.4:1). Axe `color-contrast` clean at scroll 0. |
| E5 | Ember reduced-motion marquee not keyboard-scrollable | FIXED | Axe `scrollable-region-focusable` gone. |
| E6 | Ember pinned track shifted when a card button is focused | FIXED | Tab to the last "Reserve a table": viewport `scrollLeft` stays 0, progress bar goes to 1.0, button is on screen. |
| L1 | Lumière hero text over orbs | FIXED | No contrast failures in the hero at 1440, 390 or 720x450. |
| L2 | Collapsed accordion panels exposed to AT | FIXED | Accessibility tree lists only the open item's content; the three closed items show a button and nothing else. Enter/Space still toggle. |
| L3 | Lumière "Words" section had no heading; long statement `h2` | FIXED | `h2.sr-only` "Our philosophy" and "What our clients say". |
| N3 | Northline drag-only rotation | FIXED for keyboard | Canvas is focusable with a 2px ring; ArrowRight rotates the model (19% pixel change after 6 presses, even while paused); page does not scroll. See R2-N3 for the ARIA role. |
| N4 + touch targets | Short targets | FIXED | Every link and button in the page is at least 44x44 at 1440 and 390 (ember nav, northline footer links now fixed). |
| A4 | Apex phase numerals, `mailto:[...]` link | FIXED | Axe clean on phase numerals; the placeholder `mailto:` is gone. (Apex `.footer__word` outline wordmark still shows 1.34:1 in reduced-motion at 390; it is `aria-hidden` and decorative, exempt.) |
| F3 | Toggle label changes together with `aria-expanded` | Fixed on northline and nova (constant "Menu"); NOT fixed on ember, apex, lumiere (see R2-X1) | `main.js` ember line 48, apex line 24, lumiere line 24. |

Menus (retested at 390): Enter and Space open; focus enters the menu (ember, lumiere, northline) or stays on the toggle with the menu next in Tab order (apex, nova); Tab is cycled inside menu plus toggle; Shift+Tab cycles back; Escape closes and returns focus to the toggle; closed menus are not tabbable. All pass.

## Pause motion button (F2) in detail

| Site | Position | Name | Tab stop | Ring | 390 / 320 header overlap | Pause effect | Resume (Space) |
|---|---|---|---|---|---|---|---|
| ember-table | header, before toggle | "Pause motion" (visible text; icon-only 44px at <=390) | 7 (desktop), 3 (mobile) | yes, 440 to 800 px diff | none (44x44, no overlap, brand wraps to two lines at 320 but stays readable) | idle diff 0.0%, marquee fixed, 0 infinite animations, steam stopped | yes, `aria-pressed` false |
| lumiere-spa | header, before toggle | "Pause motion" | 7 / 3 | yes | none | 0.0%, 0 animations, marquee fixed | yes; preference also survives reload |
| apex-forge | header, before toggle | "Pause motion" | 8 / 3 | yes (3px) | none (logo mark shrinks to a sliver at 320; cosmetic) | 0.0%, `motion-paused` | yes |
| northline-studio | hero figure caption, beside "Drag or arrow keys to rotate" | "Pause motion" | 11 / 7 | yes | none | 0.0%; model stops (arrow keys still rotate it) | yes |
| nova-labs | header, before nav links | "Pause motion" | 3 / 3 | yes | none | 0.0%, blobs, bars, marquee, particles stop | yes, but see R2-V1 |

Notes: focus stays on the button after activation on all five. All buttons are 44px high. At 320 wide no horizontal scroll and no header item overlaps (checked by bounding boxes and by screenshot, `scratchpad/a11y2_hdr.png`). In reduced-motion mode four sites hide the pause button because everything is already still; Lumière keeps it; both are fine.

## Remaining findings

### R2-L1. Lumière footer focus ring is gold on sand, 2.43:1 (Moderate, blocks AA)
WCAG 1.4.11 Non-text Contrast (AA), 2.4.7 Focus Visible (AA).
Where: `lumiere-spa/style.css` line 43: `.cta :focus-visible, .menu :focus-visible, .footer :focus-visible { outline-color: var(--gold); }`. `.cta` and `.menu` are dark green (gold is fine: 4.15:1), but `.footer { background: var(--sand) }` (line 271) is light. Gold `#B8975A` on `#F5F0E6` = 2.43:1. Affected stops: footer brand link, Philosophy, Rituals, The visit, Book a visit (1440 and 390). The ring is visible but too faint.
Fix (exact): `.cta :focus-visible, .menu :focus-visible { outline-color: var(--gold); }` (drop `.footer`), so the footer uses the default `var(--sage-deep)` ring.
Verify: Tab through the footer; ring colour `#3F5040` on sand is about 8:1.

### R2-N1. Northline statement words start at opacity 0.4, which is 2.56:1 (Moderate, blocks AA)
WCAG 1.4.3 Contrast Minimum (AA).
Where: `northline-studio/main.js` line 223: `gsap.set(sw, { opacity: 0.4 })` on `#statement .word__in`; ends at full ink.
Is it a failure? Yes, by my reading. Axe reports 34 nodes (`.w.word:nth-child(n) > .word__in`, `#999895` on `#f3f1ec`) at both widths with the page at scroll 0, and my pixel scan measures 2.56:1 at 390 and 720x450. The unrevealed words are real content that is visible on screen, and nothing forces the reader past them: someone who stops scrolling, uses a magnifier, zoom, or reads ahead sees low-contrast text. Round 1 was 1.34:1; 0.4 is better but still under the threshold. The statement is 27 to 52px light-weight text (counts as large text, 3:1 needed). The reduced-motion state is fine (full ink).
Minimum safe starting opacity (ink `#121212` on paper `#f3f1ec`):
- For the 3:1 large-text threshold: opacity 0.46 gives 3.04:1. 0.45 gives 2.95:1 (fails). So the strict minimum is 0.46.
- For 4.5:1 (normal text, and any case where this text could be treated as non-large, e.g. weight 300 on small viewports): opacity 0.60 gives 4.71:1.
- Recommended: 0.6. At 0.5 you get only 3.43:1 and thin strokes at weight 300 read lower than the ratio implies.
Fix: `gsap.set(sw, { opacity: 0.6 });` (the colour change is still visible as the sentence lights up). Ember's equivalent (`opacity: .58`, cream on dark, 5.4:1) already passes.
Verify: axe `color-contrast` returns no violations on northline at scroll 0 and 390 wide.

### R2-V1. Nova pause button: visible text changes, accessible name does not (Moderate, blocks A)
WCAG 2.5.3 Label in Name (A); also 4.1.2 (double state).
Where: `nova-labs/index.html` lines 27 to 31: `<button id="motionBtn" aria-pressed="false" aria-label="Pause motion">` containing `<span class="motion-btn__text" aria-hidden="true">Pause motion</span>`. After pressing (desktop width), `aria-pressed="true"`, `aria-label` is still "Pause motion", but the visible text becomes "Play motion". A voice user saying "click Play motion" fails; a screen reader says "Pause motion, toggle button, pressed" while the screen says "Play motion".
Fix (pick one): keep the visible text "Pause motion" at all times and let `aria-pressed` carry the state (what the other four sites do); remove the text swap in `main.js`. Or swap text and `aria-label` together and remove `aria-pressed`.
Verify: press the button; label, visible text and pressed state agree.

### R2-N3. Northline model canvas has the wrong role for a keyboard widget (Minor)
WCAG 4.1.2 Name, Role, Value (A) (best practice).
Where: `northline-studio/index.html` line 79: `<canvas id="scene" tabindex="0" role="img" aria-label="Interactive 3D massing model… arrow keys rotate it.">`. A focusable `img` is not announced as interactive. Rotation works with arrows and the ring is visible, so use is possible; there is still no single-pointer non-drag alternative (WCAG 2.5.7), but rotating a decorative model is not essential.
Fix: keep the label and add `aria-roledescription="rotatable 3D model"`; or use `role="group"` instead of `role="img"`.

### R2-E1. Ember hero content fades while scrolling away (Minor)
WCAG 1.4.3 (judgement call, not counted as a failure).
Where: `ember-table/main.js` hero scroll fade (`gsap.to('.hero__inner', { autoAlpha: 0.15, … scrub })`). When the hero is half scrolled, the still-visible buttons measure about 1.7:1 ("Reserve a table" at opacity .49) and "See the menu" 4.4:1. Content is leaving the screen, it is not unread content the user is trying to reach, and the buttons remain reachable and are reachable at full opacity at the top of the page, so I did not count it as a failure.
Fix (optional): end the fade at `autoAlpha: 0.6` or fade only `.hero__lead` and the heading.

### R2-X1. Menu toggle swaps its label and `aria-expanded` together (Minor, ember, apex, lumiere)
WCAG 4.1.2 (best practice). Screen readers say "Close menu, button, expanded".
Where: `ember-table/main.js` line 48, `apex-forge/main.js` line 24, `lumiere-spa/main.js` line 24.
Fix: delete the `setAttribute('aria-label', …)` line and set a constant `aria-label="Menu"` in the HTML (as northline and nova now do).

### R2-X2. Minor notes
- Ember, nova: the "Pause motion" choice is not remembered after reload (Lumière keeps it). Users who need it must press it on every visit. Optional: save in `localStorage` (wrapped in try/catch).
- Northline: the pause button sits in the hero caption near the bottom of the first screen (y 774 to 793 at 390 and 1440), unlike the other four (header). It works and is reachable; consider moving it into the header for consistency.
- Scroll-driven plan SVG labels on northline (Bedroom, Kitchen) pass at their final state; they dip while the scrubbed plan is mid-draw. Same as round 1; transient.

## What I checked and found clean (no action)

- Axe, both widths, both motion modes: zero violations on ember, lumiere, apex (except the decorative `aria-hidden` outline wordmark in reduced-motion at 390), nova. Northline: only the R2-N1 statement words.
- Pixel contrast scan: every other text node passes at 1440, 390 and 720x450 on all five (including hero text over the steam, orbs, particles and gradients). Hover states pass.
- Keyboard: every stop in 90-stop walkthroughs shows a visible ring (no ring-less stops, none covered by the sticky header). Apex solid buttons now show 3px rings; skip link visible on focus on all five.
- Reflow: no horizontal scroll at 320 or 720 on any site; text spacing (1.4.12) shows no clipped body text (only decorative overflow: marquees, outline wordmarks).
- Heading and landmark structure unchanged and good: one `h1`, banner, nav, main, contentinfo.
- A focusable `tabindex="-1"` section or `main` never traps focus; Tab and Shift+Tab move on normally, and no outline is drawn on them.
- The false alarms seen during testing (Nova nav links at 1.5:1 in one run, hero button mid-fade) did not reproduce when re-tested alone and are not reported.

## Priority

1. R2-L1 (one CSS line), R2-V1 (remove a text swap), R2-N1 (change 0.4 to 0.6). After those three, all five sites meet A/AA on everything I could test.
2. R2-N3, R2-X1, R2-E1, R2-X2 (minor).
3. A real screen-reader pass (NVDA + Chrome, VoiceOver + Safari/iOS) over the menu, accordion, pause button and skip link, which I could not do.

Evidence (scratchpad): `a11y_axe.json`, `a11y2_pause_all.json`, `a11y2_contrast_*_std.json`, `a11y2_zoom.txt`, `a11y_kbd_*.json`, `a11y2_hdr.png`, `a11y2_montage320.png`.
