# Accessibility audit: 5 showcase sites (WCAG 2.2 AA)

Auditor: independent accessibility auditor. Date: 2026-11-03.
Scope: `showcase/sites/ember-table`, `lumiere-spa`, `apex-forge`, `northline-studio`, `nova-labs`. Single-page sites, served from `python -m http.server 8812`. No site files were edited.

## Method

- Browser: Microsoft Edge (Chromium) via Playwright, at 1440x900 and 390x844. Extra viewports 720x450 (200% zoom on a 1440 screen) and 320x256 (400% / reflow).
- Automated: axe-core (tags wcag2a, wcag2aa, wcag21a/aa, wcag22aa, best-practice) at both widths, in normal and `prefers-reduced-motion: reduce` modes, after scrolling the whole page.
- Contrast: my own pixel-based check. Text is made transparent, the page is screenshotted, and the background pixels behind every text node are compared with the real text colour (opacity chain included). This covers text over gradients, canvas, 3D and glass. Every text node was measured at scroll steps down the whole page, plus a hover pass over every link and button.
- Keyboard: Tab walkthrough of every stop (up to 90) at both widths. Checked: order, focus ring present (before/after pixel diff), element not covered, skip link, mobile menu (open by Enter and Space, focus trap, Escape, focus return, link activation), accordion (Enter, Space).
- Also checked: accessibility tree (headings, landmarks, names), reduced-motion behaviour (idle motion diff, infinite animations, translucent text), 200%/400% zoom and reflow, WCAG 1.4.12 text spacing, target sizes, console errors.
- NOT done: no real screen reader (NVDA/JAWS/VoiceOver) session and no voice-control software. Screen-reader remarks below come from the accessibility tree that Chromium exposes, so they are inferred, not heard. No Safari/Firefox.

Console: zero console errors or page errors on all five sites at both widths. No horizontal scroll at 1440, 720, 390 or 320 on any site (1.4.10 Reflow passes on all five).

## Verdicts

| Site | WCAG 2.2 AA | Blocking items (Level A/AA) |
|---|---|---|
| ember-table | FAIL | F1, F2, E1, E2, E3, E4 |
| lumiere-spa | FAIL | F1, F2, L1, L2 |
| apex-forge | FAIL | F1, F2, A1, A2, A3 |
| northline-studio | FAIL | F1, F2, N1, N2 |
| nova-labs | FAIL (closest to passing) | F2 only |

"FAIL" follows the rule that one failed A/AA criterion means the page does not conform. Nova Labs has exactly one shared issue (F2, auto-moving content with no pause control); axe, contrast, keyboard and menu tests were otherwise clean. It is also the only site whose in-page links move keyboard focus correctly.

What works well across all five (keep these):
- Exactly one `h1`, logical h2/h3 order, banner / navigation / main / contentinfo landmarks, `lang="en"`, descriptive titles.
- Visible 2px+ focus rings with good contrast on almost every control; skip link appears on focus on all five.
- Mobile menus: correct `aria-expanded`/`aria-controls`, Escape closes and returns focus to the toggle, Tab is trapped inside, closed menus are `hidden` / `inert` / `visibility:hidden` so they are not tabbable. Toggle is 44-48px.
- `prefers-reduced-motion` is honoured well: with it on, idle hero movement drops to 0.0% and no translucent or hidden content is left (except F4 and L2 below).
- Decorative SVG/canvas is `aria-hidden`; meaningful SVG has `role="img"` plus a real description (northline plan and project drawings, apex placeholders).
- Placeholder text is real text, so it is readable and scalable.

---

## Findings shared by several sites

### F1. In-page links and the skip link never move keyboard focus (Serious)
WCAG 2.4.1 Bypass Blocks (A), 2.4.3 Focus Order (A).
Sites: ember-table, lumiere-spa, apex-forge, northline-studio. Nova Labs is correct.
Where: the `a[href^="#"]` click handlers call `preventDefault()` and scroll with Lenis but never focus the target.
- `ember-table/main.js` lines 76-87
- `lumiere-spa/main.js` lines 53-63
- `apex-forge/main.js` lines 50-58
- `northline-studio/main.js` lines 151-165 (`initAnchors`)

Evidence (Edge, Tab, Enter on "Skip to content", then Tab):
- ember, lumiere, apex, northline: next Tab lands on the brand link again (the nav). The skip link bypasses nothing. Same for every nav and footer anchor: after "Rituals" is activated, the next Tab continues in the nav, not in the section.
- Mobile menu link activated: focus falls to `<body>` (ember, lumiere, apex), or back to the toggle (northline). Keyboard and screen-reader users restart from the top of the page.
- nova-labs: next Tab lands on the first control in `main` (`main.js` line 69 sets `tabindex="-1"` and focuses the target).
- Only affects motion-enabled mode: with reduced motion the native anchor is used, which is fine.

Fix (copy Nova's pattern, at the end of each click handler, after the scroll call):
```js
if (target !== document.body) {
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}
```
For `#top`, focus `#main` or the `h1` instead of `document.body`. Add to each `style.css`:
`[tabindex="-1"]:focus { outline: none; }` so sections do not show a ring. Also add `tabindex="-1"` to `<main id="main">` in the HTML of the four sites.
Verify: Tab, Enter on the skip link, Tab again: focus must land on the first control inside `main`.

### F2. Auto-moving content with no pause, stop or hide control (Moderate; Level A failure on a strict reading)
WCAG 2.2.2 Pause, Stop, Hide (A).
Sites: all five. Everything stops under `prefers-reduced-motion`, but there is no in-page control, and the OS setting is not a guaranteed mechanism.
Evidence (no input, 1440x900, 1.5 s apart, screenshot difference): ember 24% (steam canvas), nova 7.4% (particles plus CSS blobs), apex 5.6-7.1% (rotating 3D dumbbell), northline 3.7-3.9% (rotating massing model), lumiere 2-4% (floating orbs). Plus infinite CSS or GSAP loops: ember marquee (`.marquee__track`, 46 s loop), ember `flicker`, `halo`, `cue`; lumiere `.marquee__track` (`marq`), `bob`, `drift`; nova `.marquee__track`, `.blob` drift, `bars`, `pulse-path`; apex `drip`.
Fix: add one visible, keyboard-focusable "Pause animation" toggle (button with `aria-pressed`) near the top of each page. It adds a `motion-off` class to `<html>` that is already honoured by the reduced-motion code path. Concretely: set `animation-play-state: paused` on the marquees and CSS loops, call `loop.pause()` on the GSAP marquee, and set `running = false` in the Three.js loops. A cheaper alternative: stop each marquee and canvas loop after 5 s.
Verify: press the toggle, then take two screenshots 1.5 s apart; difference must be 0%.

### F3. Menu toggle changes both its label and `aria-expanded` (Minor)
WCAG 4.1.2 Name, Role, Value (A), best practice.
Sites: all five (`aria-label` swaps "Open menu" / "Close menu" while `aria-expanded` also flips). Screen readers announce "Close menu, button, expanded", which is confusing.
Fix: keep one constant label (`aria-label="Menu"`) and let `aria-expanded` carry the state. Remove the `setAttribute('aria-label', ...)` lines.

---

## ember-table

### E1. Steam hero washes out the text on short or small viewports (Serious)
WCAG 1.4.3 Contrast Minimum (AA), 1.4.4 Resize Text (AA, in effect).
Where: `.hero__canvas` / Three.js steam, `main.js` lines 324-366 (`small`, `scale`, `layer({...alpha: 0.095})`).
At 720x450 (a 1440 screen at 200% zoom, or a landscape phone) the additive steam blooms into a near-white green/peach blob behind the text. Measured: eyebrow "FINE DINING · OPEN-FIRE KITCHEN" orange on peach = about 1.1:1; lead paragraph = about 1.3:1 (needs 4.5:1). Screenshot: `scratchpad/a11y_ember_hero_std720.png`. At 390 wide the eyebrow and lead dip to about 3.0-3.4:1 in the brightest 5% of pixels. In reduced-motion mode the frozen frame (`t = 9`) has the same bloom.
Fix:
1. Scale particle size by the hero area instead of `innerWidth < 700`: `const scale = Math.min(1, Math.min(hero.clientWidth, hero.clientHeight) / 800);` and drop `alpha` to about 0.06 when `hero.clientHeight < 600`.
2. Add a scrim behind the text so contrast holds whatever the canvas does, in `style.css`:
   `.hero__inner { position: relative; } .hero__inner::before { content: ""; position: absolute; inset: -2rem -3rem; z-index: -1; background: radial-gradient(closest-side, rgba(18,16,14,.78), rgba(18,16,14,0)); }`
Verify: at 720x450 and 390x844 the hero text keeps at least 4.5:1 against a screenshot taken without the text.

### E2. Marquee dish names drawn as 1px outlines (Moderate)
WCAG 1.4.3 (AA), 1.4.11 Non-text Contrast (AA).
Where: `style.css` line 306, `.marquee__list li:nth-child(even) { color: transparent; -webkit-text-stroke: 1px var(--line-strong); }`.
"Coal-roasted scallop", "Wood-fired heirloom roots", "Honey custard, sea salt" are real content (the first list is not `aria-hidden`), but are drawn only as a 1px stroke at 28% alpha: about 2.3:1 against `#1a1613`. Axe cannot see this (transparent fill).
Fix: `-webkit-text-stroke: 1.5px rgba(244,232,214,.75);` (about 8:1), or fill the text with `var(--muted)` (`#b8a996`, 8:1).

### E3. Scroll-revealed story paragraph is unreadable until scrolled (Moderate)
WCAG 1.4.3 (AA).
Where: `style.css` line 318 `html.js .story__big .sw { opacity: 0.28; }` and `main.js` lines 172-178.
Unrevealed words sit at cream-on-charcoal 2.25:1. Axe reports 45 nodes (`.swo:nth-child(n) > .sw`) in both widths. Anyone pausing mid-reveal, using zoom, or reading ahead sees low-contrast text.
Fix: start at `opacity: 0.55` (about 4.9:1), animate to 1.
Verify: axe `color-contrast` clean with the page scrolled to the top.

### E4. Brand link label does not contain its visible text (Moderate)
WCAG 2.5.3 Label in Name (A).
Where: `index.html` line 29: `aria-label="Ember and Table, home"`; visible text is "Ember & Table". A voice-control user saying "click Ember and Table" or "Ember & Table" may fail. Axe: `label-content-name-mismatch`.
Fix: `aria-label="Ember & Table, home"`.

### E5. Marquee scrolls horizontally but cannot be reached by keyboard in reduced-motion mode (Minor)
WCAG 2.1.1 Keyboard (A).
Where: `style.css` line 485 (`.marquee { overflow-x: auto; }` in the reduced-motion block). Axe `scrollable-region-focusable` on `#dishes` (both widths, reduced motion).
Fix: add `tabindex="0"` to `<section class="marquee" id="dishes">` (it already has an `aria-label`), or wrap the list (`.marquee__list { flex-wrap: wrap; }`) in the reduced-motion block so nothing needs scrolling.

### E6. Minor items
- Focusing a control inside the pinned menu track (Tab to the last "Reserve a table", 1440 wide) natively scrolls `.menu__viewport` (`scrollLeft` 1269) on top of the GSAP transform, so the cards shift out of the left gutter and the progress bar does not move. Still usable and visible. Fix: in `main.js` add `viewport.addEventListener('focusin', ...)` that resets `viewport.scrollLeft = 0` and sets page scroll from the focused card's index.
- Nav link "Visit" is 28px wide and "Menu" 39-43px wide (height 44). Passes WCAG 2.5.8 (24px) but misses the brief's 44px target. Add `padding-inline: .5rem`.
- Eyebrow (12.5px, `--ember-hi`) over the brightest steam at 390 wide measures about 3.0:1 in the brightest 5% of its box; the E1 scrim fixes this too.

---

## lumiere-spa

### L1. Hero text sits on the drifting orbs (Moderate)
WCAG 1.4.3 (AA).
Where: `.orbs` canvas (`z-index: -1`) behind `.scrollcue`, `.eyebrow`, `em` (gold) in the hero.
Measured: "SCROLL" cue (`#5A594E`, 12.5px) on the green/gold orb = 2.7:1 at 1440 (3.0 at 390). At 390 the eyebrow "SALON & SPA — SAMPLE BRAND" (`#7A5A1E`) overlapping the gold orb = 2.4:1 (median 3.5), and the first letters of "quietly" over the sage orb about 2.0:1. Screenshot: `scratchpad/a11y_lum_hero_390.png`.
Fix: for text that can overlap an orb use `var(--ink)` (`#26261F`, at least 8:1 on all orb colours): `.scrollcue, .hero .eyebrow { color: var(--ink); }` and `.hero .display em { color: #5E4210; }`. Alternatively keep orbs out of the text column: constrain `--x` of the fallback `<i>` elements and the canvas positions to the right 40% at widths under 900px.
Verify: no hero text pixel pair under 4.5:1 (3:1 for the large heading) with the orbs at their nearest position.

### L2. Collapsed accordion panels stay in the accessibility tree (Moderate)
WCAG 1.3.1 Info and Relationships (A), 4.1.2 (A).
Where: `style.css` lines 205-209: `.acc__panel` collapses with `grid-template-rows: 0fr` and children `opacity: 0`, but `visibility` stays `visible`.
Chromium accessibility tree lists `region "II Skin & face"` with its paragraph and list for a button that says `aria-expanded="false"`. A screen reader user hears closed content in browse mode. Keyboard use is fine (no focusable children, Enter/Space toggle correctly: tested).
Fix:
```css
.acc__item:not(.is-open) .acc__panel { visibility: hidden; transition: grid-template-rows .7s var(--ease), visibility 0s .7s; }
.acc__item.is-open .acc__panel { visibility: visible; transition: grid-template-rows .7s var(--ease), visibility 0s; }
```
(or toggle the `hidden` / `inert` attribute in `main.js` lines 72-92.) Verify: `aria_snapshot` of `#acc` shows only the open item's region.

### L3. Minor items
- The "04 — Words" section has no heading (`<p class="label">` only); sections 01-03 do. Add an `h2` (visually hidden is fine).
- The `h2.statement` in the philosophy section is a full sentence of 20+ words. Consider a `p` with a short `h2` ("Our philosophy").
- Footer focus ring is gold `#B8975A` on dark green; measured about 4:1 by calculation, passes 3:1 (kept for the record).

(Axe: zero violations on lumiere-spa. The above are what automated tools and `incomplete` checks cannot see.)

---

## apex-forge

### A1. Solid buttons have no visible keyboard focus indicator (Serious)
WCAG 2.4.7 Focus Visible (AA); also 1.4.11 Non-text Contrast (AA).
Where: `style.css` line 68, `.btn { clip-path: polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%); }`. The global ring (`:focus-visible { outline: 3px solid var(--fire-hot); outline-offset: 3px }`, line 60) is drawn outside the box, so the clip-path cuts it off.
Evidence: before/after screenshot of the focused element differs by 1-2 pixels on these four: nav "Book a free trial" (`.btn--sm`), hero "Book a free trial", tier "Choose Hero", CTA "Claim your free trial" (`.btn--dark`). Also the "Book a free trial" button inside the open mobile menu. The ghost buttons (`clip-path: none`) are fine. Screenshot: `scratchpad/a11y_apex_focus_btn.png` (no ring at all).
Fix:
```css
.btn:focus-visible { clip-path: none; outline: 3px solid var(--fire-hot); outline-offset: 3px; border-radius: 2px; }
.cta .btn:focus-visible { outline-color: var(--ink); }
```
Verify: Tab to each `.btn`; a 3px ring is visible all the way round (about 4000+ differing pixels, not 2).

### A2. Large "us." in the CTA headline is cream on orange, 2.8:1 (Moderate)
WCAG 1.4.3 (AA, large text needs 3:1).
Where: `style.css` line 199, `.cta h2 span { color: var(--paper); }`, on the `--gradient-fire` band (measured 2.77-2.85:1 at 1440 and 390).
Fix: `.cta h2 span { color: var(--ink); -webkit-text-stroke: 0; text-decoration: underline; text-decoration-thickness: .06em; text-underline-offset: .08em; }` so the accent word is distinguished by an underline rather than by a colour that fails. If the white look is wanted, use `#fff` with `text-shadow: 0 2px 0 rgba(13,17,23,.35)` and re-measure, but plain ink is safe (about 6-8:1).

### A3. Logo links' `aria-label` does not contain the visible text (Moderate)
WCAG 2.5.3 Label in Name (A).
Where: `index.html` line 19 (`aria-label="Apex Forge, home"`) and line 266 (`aria-label="Apex Forge, back to top"`). Visible text is "ApexForge" (`Apex<b>Forge</b>`, no space). Axe: `label-content-name-mismatch`, 2 nodes, both widths.
Fix: remove both `aria-label`s (the link text already names the link), or use `aria-label="ApexForge, home"` and `"ApexForge, back to top"`.

### A4. Minor items
- Outlined phase numbers `.phase__num` (stroke `#98a2b3` 2px on white, inactive state) measure 2.57:1 (axe, 390 wide). They are `aria-hidden` and duplicate the visible heading order, so this is decorative and low risk; raise the stroke to `#6b778a` (4.3:1) to be safe (`style.css` line 160).
- `.footer__word` (outline wordmark, `aria-hidden`) 1.34:1: decorative, exempt; no action needed.
- CTA link `href="mailto:[Your email address]"` opens an invalid mail window on click. Placeholder links should not be live: replace with `href="#join"` until real details are supplied.

---

## northline-studio

### N1. Scroll-scrubbed statement starts at 14% opacity (Moderate)
WCAG 1.4.3 (AA).
Where: `main.js` lines 190-200 (`gsap.set(sw, { opacity: 0.14 })` on `#statement`). Words not yet reached measure 1.34:1 (ink on paper). Axe reports 34 nodes (`.word__in`) at both widths. Anyone who stops scrolling mid-sentence, uses a magnifier, or has the sentence mostly off-screen cannot read the unrevealed part.
Fix: start at `opacity: 0.6` (about 5:1: ink `#121212` at 60% on `#f3f1ec`), animate to 1.
Verify: axe `color-contrast` returns no violations with the page at scroll 0.

### N2. Brand link label does not match visible text (Moderate)
WCAG 2.5.3 Label in Name (A).
Where: `index.html` line 19: `aria-label="Northline Studio, back to top"`; visible text is "Northline" + "Studio" in adjacent spans without a space (reads as "NorthlineStudio"). Axe `label-content-name-mismatch`.
Fix: add a space in the markup (`Northline <span class="brand__sub">Studio</span>`; keep it `display:block` in CSS if it should stay stacked), then set `aria-label="Northline Studio, back to top"` or drop the label.

### N3. Hero model rotation is drag-only (Minor)
WCAG 2.5.7 Dragging Movements (AA), 2.1.1 Keyboard (A).
Where: `scene.js` lines 108-122 (pointer events only) and the visible hint "Drag to rotate" in `.hero__cap-hint`. Nothing essential is lost (the model also auto-rotates and rotates with scroll, and `touch-action: pan-y` is set, so page scrolling is not trapped), but the promised function has no keyboard or click alternative.
Fix: make the canvas `tabindex="0" role="img"` with `aria-label="3D massing model. Arrow keys rotate."` and add `keydown` for ArrowLeft/ArrowRight that adds `±0.2` to `targetYaw`; or change the hint to "Auto-rotating model" and remove the drag affordance.

### N4. Minor items
- Footer links are 36px high (`.footer__col a`); passes WCAG 2.5.8 but misses the 44px brief target. Add `padding-block: 10px`.
- Plan SVG labels `.lbl` (12px, `#4b4943`) pass at their final state (7.6:1); only transient scrub states dip.

---

## nova-labs

No Level A/AA failures found except the shared F2 (auto-moving content, no pause control).

Checked and passing: axe 0 violations (both widths, both motion modes); every measured text node at or above 4.5:1 / 3:1 over the particle canvas, glass cards, gradient mesh, gradient text and glowing CTA (the single low reading, a hero button at opacity .5, was a mid-fade-in frame and settles to full opacity); skip link works and moves focus; in-page links focus the target; mobile menu focus management (toggle then Tab through links, Escape returns focus, closed menu `visibility:hidden`); 44-48px targets; focus ring cyan `#22d3ee`, 9-17:1 against its surroundings; 320px reflow; text spacing; reduced motion leaves zero idle motion.

Minor (optional):
- N-1: F3 above (toggle label plus `aria-expanded`).
- N-2: after a nav link, focus lands on a `section` with `tabindex="-1"`; no ring is visible, which is the desired result. Add `[tabindex="-1"]:focus { outline: none; }` explicitly so it stays that way.

---

## Priority order for the fixes

1. A1 (apex focus ring clipped), E1 (ember steam text wash-out), F1 (focus on in-page links and skip link, four sites). These are Serious.
2. A2, E2, E3, L1, N1 (contrast), E4, A3, N2 (label in name), L2 (accordion exposure), F2 (pause control, all sites).
3. Minor items (E5, E6, L3, A4, N3, N4, F3).

Re-audit after fixes: re-run axe plus the pixel-contrast scan at 1440, 720x450 and 390, and one NVDA (Windows) and one VoiceOver (iOS) pass over the menu, accordion and skip link, which could not be done here.

Evidence files (scratchpad): `a11y_axe.json`, `a11y_kbd_*.json`, `a11y_contrast_*_std.json`, screenshots `a11y_ember_hero_std720.png`, `a11y_apex_cta_1440.png`, `a11y_apex_focus_btn.png`, `a11y_lum_hero_390.png`.
