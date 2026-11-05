# Showcase QA report (EvidenceQA)

Date: 2026-11-03. Tester: independent QA agent. Acceptance criteria: `showcase/BRIEF.md`.
Served `showcase/` with `python -m http.server 8811` (stopped when done). Browser: Microsoft Edge (Chromium 156, headless, SwiftShader WebGL) driven by Playwright 1.48 (Python).
No site files were edited.

## Verdicts

| Site | Verdict | Blocking issue |
|---|---|---|
| Hub `showcase/index.html` | PASS | none (1 low) |
| `ember-table` | PASS | none (lows only) |
| `lumiere-spa` | PASS | none (lows only) |
| `apex-forge` | PASS | none (lows only) |
| `northline-studio` | PASS | none (lows only) |
| `nova-labs` | FAIL (minor, 1-line CSS fix) | D1: descenders of the hero and section headings are clipped (visible cut-off letters) |

All five sites are clearly different from each other, look professional, and meet the structural brief. Nova Labs is failed only because a visible glyph clip sits in the hero headline of a client-facing demo, which is below the "high-class" bar. After D1 is fixed it should pass.

## What was tested (scope)

Per site, at 1440x900, 1024x768 and 390x844:
- Console errors / warnings, page errors, failed requests, HTTP >= 400 (listeners attached from first request).
- Horizontal overflow (scrollWidth vs viewport, plus an element-level scan for anything past the viewport edge that is not clipped by an ancestor), at top and after a full wheel-scroll.
- Full scroll-through using real mouse-wheel input (so Lenis and ScrollTrigger run as for a user); viewport screenshots at top, middle, bottom, plus a step-by-step walk (`walk-1440-NN.png`) for the five sites.
- Every header nav link clicked at 1440 (target lands under the sticky header).
- Mobile menu at 390: open (aria-expanded true), link list in view, Tab moves focus inside, Escape closes and returns focus to the toggle, link click closes menu and scrolls, toggle-close, body scroll lock, resize to desktop while open.
- 3D canvas: element screenshot analysed for non-blank pixels (mean, std-dev, distinct colours) at all three widths.
- WebGL disabled (init script makes `getContext('webgl*')` return null): top screenshot plus full scroll, at 1440 and 390.
- `prefers-reduced-motion: reduce`: top and mid screenshots, section-by-section visibility scan, running CSS animations count, at 1440 and 390.
- Automated contrast scan of solid-background text, touch-target sizes at 390, h1 count, landmarks, img alt, keyboard focus ring, placeholder / invented-fact scan of the HTML, "Sample design by Website Studio" footer line, off-screen render pausing (source check), pixel-ratio cap (source check).
- Hub: all five card links open (HTTP 200, no console errors), hub layout at three widths.

Not tested (coverage gaps): real GPU performance and 60fps (headless SwiftShader only), real touch devices / iOS Safari / Firefox, screen readers, OS font fallback on Mac/Android/Linux (see L-notes), real offline mode, `ScrollTrigger` behaviour after live window resize.

Harness note: my first parallel run produced `ERR_CONNECTION_REFUSED` for some local files. Cause: `python -m http.server` has a tiny listen backlog and I ran 4 browsers at once. I discarded those results, re-ran, then re-ran every site x {1440, 1440 reduced-motion, 390} one at a time. Those isolated runs show zero console errors, page errors or failed requests on all five sites. The refusals are NOT site defects.

## Cross-site results (all measured)

| Check | ember | lumiere | apex | northline | nova |
|---|---|---|---|---|---|
| Console errors at 1440 / 1024 / 390 (isolated runs) | 0 | 0 | 0 | 0 | 0 |
| 404s / failed requests | 0 | 0 | 0 | 0 | 0 |
| Horizontal scroll 1440/1024/390 | none | none | none | none | none |
| Exactly one h1, header/nav/main/footer landmarks | yes | yes | yes | yes | yes |
| Imgs without alt | 0 | 0 | 0 | 0 | 0 |
| Sticky/fixed nav stays at top after scroll | yes | yes | yes | yes | yes |
| Desktop nav links (all) land correctly | yes | yes | yes | yes | yes* |
| Mobile menu open / Esc / link-click / toggle-close / focus return | pass | pass | pass | pass | pass |
| 3D canvas non-blank (std-dev of pixels, 1440) | 41.6 | 29.9 | 23.5 | 27.1 | 40.8 |
| WebGL off: page works, fallback visible, no overflow | pass | pass | pass (console error, see L4) | pass | pass |
| Reduced motion: content visible, 0 running animations | pass | pass | pass | pass | pass |
| Touch targets >= 44px at 390 (nav, buttons) | yes (1 link 43px) | yes | yes | nav yes, footer links 36px | yes |
| Footer "Sample design by Website Studio" | yes | yes | yes | yes | yes |
| Invented facts (prices, stats, reviews, phones) | none, all placeholders | none | none | none | none |
| Off-screen render pause (source) | yes | yes | yes | yes | yes |
| Solid-background text contrast < 4.5 (3 for large) | none found | none | none | none | none |

*Nova: `#contact` is the footer, which cannot reach the top of the viewport at page end (lands at 451px). Same for Ember `#visit` (254px). Correct behaviour, noted only so nobody reads it as a bug.

Contrast scan caveat: text on gradients, gradient-clipped text and outline text cannot be measured by the script (flagged as ratio 1.0, all false positives on inspection: dark text on bright gradient buttons, outline numerals). I judged those by eye in the screenshots and they read clearly.

## Defects

Severity: high = blocks the Wednesday demo; med = visible flaw in client view; low = polish / edge case.

### Nova Labs

**D1 (med) Descenders clipped in split-reveal headings.**
- What: the `g` in "working" (hero H1 "calm, working software.") has its tail cut off flat. Same cause affects every word-masked heading (`.w` wrapper, `overflow:hidden`, `padding-bottom:.14em` is too small for the Segoe UI descender at weight 600 and line-height 1.02/1.04). Also visible on the hero at 1024 and 390, and very likely on the CTA headline "Let's map it together." (g and p) and any section title with g, p, y, q.
- Where: `sites/nova-labs/style.css` line ~164 (`.w { ... padding-bottom: .14em; margin-bottom: -.14em; }`).
- Repro: open `/sites/nova-labs/` at 1440, look at the hero H1 second gradient line. Evidence: `qa/screens/nova-labs/zoom-h1-descenders-1440.png` (2x zoom), also `nova-labs/1440-top.png`, `1024-top.png`, `390-top.png`.
- Fix hint: increase the bottom padding to about .25em (keep the negative margin equal), or use `clip-path: inset(0 0 -.3em 0)` instead of `overflow:hidden`.

**D2 (low, unverified) One transient blank frame while smooth-scrolling near the testimonial / CTA boundary.**
- What: once, with wheel scrolling at about scrollY 3950, a screenshot showed an empty dark viewport with the sticky header painted at y~670 although the DOM reported header top = 0. It did not reproduce at settled scroll positions, with `scrollTo`, or in later runs (header top 0 every time). Most likely a headless/SwiftShader compositor artifact during a Lenis tween with `backdrop-filter`, but I could not prove that.
- Evidence: `qa/screens/nova-labs/evidence-transient-blank-frame-1440.png`.
- Action: human spot-check on a real GPU machine by scrolling slowly past the quote card into the CTA.

**D3 (low) Closed mobile menu links are present at opacity 0** (not focusable, verified by Tab order, so no a11y problem). Nothing to do; recorded because the automated visibility scan flags them.

### Ember & Table

**D4 (low) Footer contact column spacing is uneven.** "[Your phone number]" and "[Your email]" sit about 52px apart and in a brighter colour than the address/hours lines above them (see `ember-table/1440-bottom.png`). Looks like two different list styles. Cosmetic.

**D5 (low) One touch target is 43px tall.** Footer link "Menu" at 390 is 43x44 (width 43). Brief says >= 44px. Trivial.

### Lumière Spa

**D6 (low) Burger button is shown at desktop widths next to the full inline nav** (1440 and 1024: links + "Book a visit" + a round burger). Redundant control; the brief only asks for a mobile menu. Works correctly when used. See `lumiere-spa/1440-top.png`.

**D7 (low) Hero orbs look different at different widths.** At 1440 they are soft and matte; at 1024 they show bright white specular hot spots and look glossier / more plastic (`lumiere-spa/1024-top.png`). The brief asks for "soft orbs". Likely time/cursor dependent lighting, but worth a look.

**D8 (low) "A visit, in three quiet movements" cards: card 01 and 02 have a large empty lower half** (staggered heights with short copy; `lumiere-spa/walk-1440-03.png`). Intentional stagger, but the emptiness looks unfinished.

### Apex Forge

**D9 (low) Console error when WebGL is unavailable.** `THREE.WebGLRenderer: Error creating WebGL context.` is logged as `console.error` (1440 and 390, WebGL-off test). The page still renders correctly with a clean CSS dumbbell fallback (`apex-forge/1440-nogl-top.png`), so users are fine, but the brief says no console errors. Wrap renderer creation in try/catch or check support before constructing it.

**D10 (low) 3D dumbbell plates are very dark / nearly black** with thin orange rims; the model reads a bit flat against the dark hero (`apex-forge/1440-top.png`). The WebGL-off CSS fallback actually looks more vivid than the 3D model. Consider brighter key light or lighter plate colour.

**D11 (low, not tested) Font stack relies on `Impact`.** On Android / many Linux systems Impact is missing, falls back to Arial Narrow Bold or generic sans-serif, which changes the whole look and can change wrapping of the giant type. Not tested here (Windows only).

### Northline Studio

**D12 (low) Footer text links at 390 are 36px tall** ("Practice", "Services", "Process", "Projects"), below the 44px target.

**D13 (low) Plan drawing labels are tiny at 390** ("[Width]", "Kitchen", "Living", etc. render at roughly 6-8px, `northline-studio/390-mid.png`). The drawing reads fine, but the labels are not legible on a phone.

**D14 (low) Page is long on small screens:** the pinned "Process" and "Projects" sections make the page 12,029px tall at 1440 (and 9,539px at 390). Scroll-driven, works, but a lot of dead scroll for a client viewing on a phone.

### Hub

**D15 (low) `favicon.ico` 404 on the hub page** (console shows one "Failed to load resource 404" at the hub only; the five sites have inline SVG favicons). Add a `<link rel="icon">` to `showcase/index.html`.

**D16 (low) Card titles on the two light cards (Lumière Spa, Northline Studio) sit on a pale gradient with a grey-ish fade** and have noticeably weaker contrast than the other three titles (`hub/1440-full.png`). Hub also names the restaurant "Ember Table" while the site says "Ember & Table".

**D17 (low) None of the five sites has a "back to hub" link.** Not required by the brief; only matters if the presenter wants to hop back without the browser Back button.

## Visual quality notes (honest, from screenshots)

Overall: this is a strong set. Each site has a real design system and a distinct personality; none feels like a template of another. No text overflow, no overlapping, nothing stuck invisible after scrolling, no obviously ugly spot at any of the three widths.

- **Ember & Table (Excellent).** Warm, candle-lit, genuinely restaurant-like. The steam/smoke WebGL hero is atmospheric; serif display plus clean sans is elegant. The pinned horizontal menu with its progress bar is smooth and legible; sample-menu card clearly marked as illustrative. Placeholders (`[Price]`, `[Testimonial from a guest]`) are visible and tidy. Fallback (no WebGL) is a calm dark gradient, slightly flat but still dignified.
- **Lumière (Excellent).** Airy, editorial, lots of whitespace, sage CTA band is a good contrast moment. Orbs in the hero are a nice soft-3D touch. Accordion with the arch illustration is refined. The "visit" cards and footer are clean. Only polish nits (D6-D8).
- **Apex Forge (Excellent for the brief).** Superhero energy comes through: condensed all-caps type, diagonal cuts, orange on slate, and the light "Method" section as a hard tonal break. The giant scrolling type and outline numerals are strong. Hero 3D dumbbell works but is the weakest element visually (D10). Pricing tiers with the highlighted middle tier read very clearly.
- **Northline Studio (Excellent).** The most "designed" of the five. Editorial grid, hairlines, small caps labels, a single muted terracotta accent. Isometric massing model is crisp, and the scroll-drawn floor plan (walls, rooms, openings) is the best signature move in the set. Sticky project list works cleanly. The big whitespace plus dark contact band is classy. Pinned plan labels get small on mobile (D13).
- **Nova Labs (Good to Excellent, one flaw).** Dark glass, violet-cyan neon, wireframe-planet particle hero reacting to the mouse, bento cards, timeline with a glowing rail, glowing CTA frame. Looks like a modern tech studio. The clipped descenders (D1) are the one visible blemish; mobile footer is a plain list and less polished than the rest.
- **Distinctiveness:** serif-dark (Ember) vs serif-light (Lumière) share a similar Palatino-style display face on Windows, but colour, layout, motion and tone are different enough that no one would confuse them. The other three are far apart in type and layout. Nova and Northline both use the Windows system sans (Segoe UI) for body; differences hold because of layout and colour.
- **Hub:** clean, readable dark page with five equal cards; fine at all widths. Five cards in a 3-column grid leaves one empty slot on the second row at 1440; cosmetic.
- **Placeholders / invented facts:** every factual gap is a visible bracketed placeholder; no fake stats, awards, prices, phone numbers or testimonials found. Lumière's `%` values in the HTML are decorative CSS bar heights, not claims.
- **Size:** each site's own code is 46-62KB (html+css+js), no images; performance budget is comfortably met apart from vendor libraries (not measured).

## Evidence

All under `showcase/qa/screens/<slug>/` (slugs: `ember-table`, `lumiere-spa`, `apex-forge`, `northline-studio`, `nova-labs`, `hub`):
- `{1440,1024,390}-{top,mid,bottom}.png`: baseline captures.
- `walk-1440-NN.png`: step-by-step scroll captures per site at 1440.
- `390-menu-open.png`, `390-menu-closed.png`, `resize-menu-open-to-1440.png`, `1440-focus.png`: menu and focus ring.
- `{1440,390}-nogl-{top,mid,bottom}.png`: WebGL disabled.
- `{1440,390}-rm-{top,mid}.png`: reduced motion.
- `nova-labs/zoom-h1-descenders-1440.png`, `nova-labs/evidence-transient-blank-frame-1440.png`.
- `hub/{1440,1024,390}-{top,full}.png`.

Scripts (scratchpad, not part of the repo): `qa_run.py`, `qa_hub.py`, `qa_sections.py`, `qa_recheck.py`, `qa_contrast.py`, `qa_nova_*.py` in `C:\Users\kaush\AppData\Local\Temp\claude\53e3aa7b70d7a652\768b905f-d1cb-4392-b7ce-97c1fa6f393a\scratchpad`.

## Required next steps

1. Fix D1 (Nova descender clip), then re-test Nova hero + CTA + section titles at 1440 and 390. Re-test required: yes (Nova only).
2. Optional polish before Wednesday, in priority order: D9 (Apex no-WebGL console error), D15 (hub favicon), D10 (Apex dumbbell lighting), D6/D7 (Lumière burger and orb lighting), D13 (Northline plan labels on mobile).
3. Human spot-check on a real GPU laptop and a real phone for frame rate and D2.

QA Agent: EvidenceQA. Server on port 8811 stopped.
