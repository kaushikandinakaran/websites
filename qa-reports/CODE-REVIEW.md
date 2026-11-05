# Code review: 5 showcase sites + showcase/index.html

Reviewer: studio code reviewer (read-only, static review; no server run, no site files edited).
Scope: `sites/ember-table`, `sites/lumiere-spa`, `sites/apex-forge`, `sites/northline-studio`, `sites/nova-labs` (html, css, js) and `showcase/index.html`, checked against `showcase/BRIEF.md`.
Severity: **high** = ships broken or breaks a BRIEF rule, **med** = visible defect, rule risk or real perf/a11y cost, **low** = polish. Items marked *(verify)* are derived from reading the library source or the code path and should be confirmed with one quick browser check.
Verdict rule: CHANGES NEEDED if any med or high finding exists, otherwise PASS.

## Verdicts

| Site | Verdict | High | Med | Low |
|---|---|---|---|---|
| ember-table | CHANGES NEEDED | 0 | 5 | 3 |
| lumiere-spa | PASS (low fixes recommended) | 0 | 0 | 6 |
| apex-forge | CHANGES NEEDED | 0 | 4 | 6 |
| northline-studio | CHANGES NEEDED | 0 | 2 | 6 |
| nova-labs | CHANGES NEEDED | 0 | 1 | 7 |
| showcase/index.html | PASS (low fixes recommended) | 0 | 0 | 3 |

No high-severity findings. All five sites are structurally sound, and each one has a working no-WebGL fallback, reduced-motion handling, a mobile menu with Escape and a focus wrap, one `<h1>`, and the "Sample design by Website Studio" footer line.

## Checked and clean (all sites)

- No external or CDN resources, no Google Fonts, no hotlinked images. A grep for `http(s)://`, `@import`, `googleapis`, `<img`, `url(` found only `w3.org/2000/svg` namespaces and SVG gradient `url(#...)` references. Fonts are system stacks only.
- No `target="_blank"` anywhere, so no `rel` issue.
- No `innerHTML` with dynamic data. The only use is `lumiere-spa/main.js:68`, which duplicates its own static marquee markup.
- All IDs, classes and `data-*` hooks that the JS selects exist in the HTML, in all five sites. I traced each selector.
- "Sample design by Website Studio" is in the footer of all five sites, plus the mobile menu in ember-table and lumiere-spa. It is also in the footer of `showcase/index.html`.
- Exactly one `<h1>` per page. Heading order is sane. Landmarks are present (header, nav, main, footer).
- Content rules: prices, phones, addresses, hours, emails, reviews, coach and client names are all `[bracketed placeholders]`, with the exceptions listed under apex-forge (F-A4) and northline-studio (F-N7).
- Three.js render loops pause off-screen and when the tab is hidden. The exception is the tab-switch bug described in F-E1 and F-A3. Pixel ratio is capped in every site. Context loss is handled in every site (restore handling is partial in nova-labs and in lumiere-spa under reduced motion).
- Contrast, computed from the CSS tokens (WCAG ratio):
  - **ember-table:** body cream on bg 15.7, muted on bg 8.3, muted on surface 7.4, eyebrow ember-hi on bg 9.5, button text on ember 6.8, gold note on surface 10.3.
  - **lumiere-spa:** ink on sand 13.4, muted on sand 6.2, muted on sand-2 5.6, gold-text on sand 5.6, gold-text on sand-2 5.1, button paper on sage-deep 8.1, sand on sage-ink 10.1. The one miss is F-L3.
  - **apex-forge:** paper on ink 17.3, slate-300 on ink 9.0, slate-300 on slate-900 8.5, button ink on fire 6.1, ink on the crimson end 4.5, eyebrow on method paper 5.4, phase text with .78 opacity 5.2. The miss is F-A1.
  - **northline-studio:** ink-2 on paper 8.0, ink-2 on paper-2 7.3, accent on paper 6.1, accent on paper-2 5.6, paper on ink 16.6, cfcac0 on ink 11.5. No misses.
  - **nova-labs:** text on bg 17.6, muted on bg 9.6, faint on bg 6.4, cyan-2 on bg 13.9, button text on violet end 7.3, on cyan end 13.7. No misses.

---

## ember-table: CHANGES NEEDED

**F-E1 (med) Tab switching multiplies the render loop.** `main.js:389-405`. `update()` sets `running=false` when the tab hides. The `requestAnimationFrame` callback queued before the hide is still pending (browsers hold it while hidden). When the tab shows again, `update()` starts a second chain, and the old callback fires too. Both see `running===true`, so two chains run. Every hide/show adds one more chain, and each one calls `renderer.render()`. It does not speed up the animation (`dt` is shared), but GPU cost grows with each tab switch.
Fix:
```js
let rafId = 0;
function tick(now){ if(!running) return; /* ...existing body... */ rafId = requestAnimationFrame(tick); }
function update(){
  const should = visible && !document.hidden && !reduced;
  if (should && !running){ running = true; last = performance.now(); rafId = requestAnimationFrame(tick); }
  else if (!should && running){ running = false; cancelAnimationFrame(rafId); }
}
```
The same bug exists in apex-forge (F-A3). lumiere-spa, northline-studio and nova-labs already cancel or guard correctly.

**F-E2 (med, verify) ScrollTrigger creation order: later triggers fire early.** `main.js:163-170` (section heads, CTA, `[data-reveal]` batch) and `main.js:194-195` (footer word) are created before the pin at `main.js:211-231`. GSAP measures triggers in creation order, and ScrollTrigger only sorts if `refreshPriority` is used (`ScrollTrigger.js:491`, `_sort`). So the start positions for everything below the pinned menu (evenings heads, tilt cards, quote, CTA, footer word) are measured without the pin spacer. Those `once:true` reveals fire about one pin-length (~1500px) too early, and the footer-word scrub is already finished when the footer arrives. Content is not lost, it just appears already revealed with no entrance animation.
Fix: move the whole `mm.add(...)` pinned-menu block above the generic reveal and footer-word code (keep the story and marquee code above it). Alternatively add `refreshPriority: -1` to the triggers that sit after the menu.

**F-E3 (med) CSS transition fights the GSAP-scrubbed plate rotation.** `style.css:381` (`.plate { transition: transform 1.2s ... }`) and `style.css:384` (`.course:hover .plate { transform: rotate(40deg) }`) versus `main.js:225-226` (GSAP scrubs `rotation` on `.plate`). The outer `<svg>` is treated as an HTML element by GSAP and gets an inline CSS `transform`. The 1.2s transition then trails the scrub by more than a second and re-eases on every frame. The hover rule is also overridden by the inline transform while pinned.
Fix: `.menu.is-pinned .plate { transition: none; }` and `.menu.is-pinned .course:hover .plate { transform: none; }` (the inline GSAP transform already rotates the plate).

**F-E4 (med) Mid-pin focus can desync the horizontal menu.** `index.html:154` (`tabindex="0"` on the viewport) and `index.html:194` (a link inside the last, off-screen course card) versus `style.css:359` and `main.js:211-231`. While pinned, the viewport is `overflow:hidden` and moved by a transform. Tabbing to the "Reserve a table" link in the last card makes the browser scroll that hidden container (`scrollLeft`), which shifts the track a second time on top of the transform. The card also stays unreachable visually, and the focus ring is not visible.
Fix: while pinned, keep `viewport.scrollLeft = 0` and map focus to scroll position:
```js
track.addEventListener('focusin', (e) => {
  if (!menu.classList.contains('is-pinned')) return;
  viewport.scrollLeft = 0;                       // undo the browser's own scroll
  const st = ScrollTrigger.getAll().find((s) => s.trigger === menu && s.pin);
  const card = e.target.closest('.course');
  if (!st || !card) return;
  const p = card.offsetLeft / Math.max(1, track.scrollWidth - viewport.clientWidth);
  const y = st.start + Math.min(1, p) * (st.end - st.start);
  lenis ? lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y);
});
```
Also drop `tabindex="0"` from `.menu__viewport` while pinned (set it from JS only in the non-pinned branch), because a non-scrollable focus stop is confusing.

**F-E5 (med, perf) The steam hero has a heavy fill-rate load.** `main.js:311` (DPR 1.25), `main.js:357-361` (400 additive point sprites, 120-240 css px base size, growing by `1+life*1.8`; 220 on phones). Average sprite is roughly 340 css px, about 425 device px, so about 57M blended pixels per frame at 1440 wide. That is borderline for an integrated GPU at 60fps. The steam is soft, so lower resolution looks the same.
Fix: `renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 0.75))` (and `uPx` = that value), and/or reduce the count to about 240 desktop and 140 mobile. Measure with the performance panel at 1440x900 before and after.

**F-E6 (low) Skip link does not move focus.** `main.js:76-87` calls `preventDefault()` and `lenis.scrollTo(...)` for every `#` link, including `<a class="skip" href="#main">` (`index.html:24`). The page scrolls but keyboard focus stays on the skip link, so the next Tab goes back to the nav. The same happens in lumiere-spa, apex-forge and northline-studio (nova-labs handles it correctly at `main.js:69`).
Fix: add `tabindex="-1"` to `<main id="main">` and, in the click handler, `target.focus({ preventScroll: true })` when `target.id === 'main'`.

**F-E7 (low) Alternating marquee words are low contrast.** `style.css:306`. Even items are `color: transparent` with a 1px stroke at rgba(cream, .28), about 2.3:1 against `--bg-2`. They are decorative dish names and the duplicate list is `aria-hidden`, but the first list is real text. Raise the stroke alpha to about .6 (about 4.5:1) or make those words solid `--muted`.

**F-E8 (low) The WebGL probe context is never released.** `main.js:288-289` creates a throwaway WebGL context and leaves it. Northline does it properly (`scene.js:22-23`, `WEBGL_lose_context`). Add `probe.getExtension('WEBGL_lose_context')?.loseContext();` after the check.

---

## lumiere-spa: PASS (low fixes recommended)

**F-L1 (low) CSS transform transition double-smooths GSAP.** `style.css:228` (`.step { transition: transform .5s ... }`) versus `main.js:144` (`gsap.from('.step', {y:70})`) and `main.js:151-160` (`quickTo` rotation on `.tilt` = `.step`). GSAP writes the inline transform each frame, and the CSS transition then eases every change, so the reveal and tilt lag by about half a second. Fix: `transition: box-shadow .5s var(--ease);` (drop `transform` from the list).

**F-L2 (low) Closed accordion panels are still exposed to assistive tech.** `style.css:205-209` collapses with `grid-template-rows:0fr` and `overflow:hidden`, but the text stays in the accessibility tree, and each panel is a `role="region"` (`index.html:130,142,154,166`). That adds four landmarks that read hidden text. Fix: `.acc__item:not(.is-open) .acc__clip { visibility: hidden; transition: visibility 0s .7s; }` and `.acc__item.is-open .acc__clip { visibility: visible; transition: none; }`. Optionally remove `role="region"`, which is not needed for four short panels.

**F-L3 (low) Gold number on dark green fails 4.5:1.** `style.css:126` (`.menu nav a span`, `.75rem`, `--gold #B8975A` on `--sage-ink #2F3D31` = 4.15:1). Fix: `color: #D2B77C;` (about 6.6:1).

**F-L4 (low) Skip link and in-page links do not move focus.** `main.js:53-64`, same as F-E6. Fix: give `<main>` `tabindex="-1"` and focus it for `#main`.

**F-L5 (low) After a WebGL context restore, the canvas can stay blank under reduced motion.** `main.js:282` calls `start()`, which returns early when `reduce` is true, and nothing redraws. Fix: `canvas.addEventListener('webglcontextrestored', () => { orbsBox.classList.add('is-live'); draw(0); start(); });`.

**F-L6 (low) `aria-label` on a `<blockquote>`.** `main.js:100` sets `aria-label` on every `[data-split]`, and `index.html:216` is a `<blockquote data-split>`. ARIA does not allow naming on `blockquote`, so it is ignored or flagged by checkers. Fix: only set `aria-label` when `el` is a heading, or wrap the quote text in a `<p data-split>`.

---

## apex-forge: CHANGES NEEDED

**F-A1 (med) The white word in the CTA headline fails contrast.** `style.css:199` (`.cta h2 span { color: var(--paper) }`) sits on the fire gradient `#ff8a3d -> #ff5a1f -> #e63946` (`style.css:15,195`). Paper on `#ff8a3d` is 2.15:1 and on `#ff5a1f` is 2.86:1. Both are below 3:1, which is the floor even for large text. The word "us." in `index.html:252` is effectively hard to read. Fix: `.cta h2 span { color: var(--ink); background: var(--paper); padding: 0 .12em; }` (ink on paper is 17:1), or simply `color: var(--ink)` with an underline.

**F-A2 (med) Static `import * as THREE` blocks and breaks the whole site script.** `main.js:1`. `main.js` is one module, and it imports the 670KB three.js statically. Until three loads and parses, nothing runs: no mobile menu, no GSAP, no Lenis. If three fails to load, `main.js` never executes, so the menu and every animation are dead even though the page does not need WebGL. The `js` class is also only added at `main.js:4`, so the hero text paints visible, then the CSS hides it (`style.css:219`), then it animates: a visible flash on load.
Fix: remove the static import, load three inside `initScene` with `const THREE = await import('three');` (catch and return on failure, as nova-labs and lumiere-spa do), and add the early `js` class inline in the `<head>` (`<script>document.documentElement.classList.add('js')</script>` guarded by the reduced-motion check, as ember-table does at `index.html:10-16`).

**F-A3 (med) Same tab-switch render-loop leak as F-E1.** `main.js:214-234`. `stop()` only clears `running`, and `start()` queues a new frame while the old queued one survives a tab hide. Fix: keep `let raf = 0;` and use `raf = requestAnimationFrame(frame)` in both places, and `cancelAnimationFrame(raf)` in `stop()`.

**F-A4 (med) Invented commercial claims (content rule).** BRIEF: no invented prices, statistics, awards or offers. These read as facts about the business: `index.html:209` "Most popular" (a popularity claim), `index.html:252` "Your first session is on us", `index.html:254` "No pressure, no contract", `index.html:199` "Simple plans, no hidden extras", plus the nav and hero CTA "Book a free trial" (`index.html:29,40,59`). A free trial and a no-contract policy are decisions for the gym. Fix: make them placeholders or neutral wording, for example flag `[Featured plan]`, headline "Come and try a session. [Trial offer, if any]", body "Walk in, meet a coach, try a session. [Contract terms]", and CTA label "Book a visit".

**F-A5 (low) The raised "Hero" tier loses its offset after reveal.** `style.css:180` (`.tier--hero { transform: translateY(-14px) }`) is overridden by `style.css:218` (`.js [data-reveal]` sets `translateY(40px)`), and `main.js:72` animates to `y:0`, which leaves an inline `transform: translate(0,0)` that wins over the stylesheet. The -14px lift is lost on desktop. Fix: add `clearProps: 'transform'` in the `gsap.to` at `main.js:72`.

**F-A6 (low) `mailto:[Your email address]` is an invalid link.** `index.html:255`. Clicking it opens a mail client with a broken address. Fix: `href="#join"` with the visible text "[Booking or email link]", or `href="mailto:hello@example.com"` clearly marked sample.

**F-A7 (low) No WebGL probe, so no-WebGL browsers log a console error.** `main.js:130-133` calls `new THREE.WebGLRenderer` directly. When there is no GPU, three logs `THREE.WebGLRenderer: Error creating WebGL context` before throwing (caught). The BRIEF wants zero console errors. Fix: probe like the other sites:
```js
const probe = document.createElement('canvas');
const gl = probe.getContext('webgl2') || probe.getContext('webgl');
if (!gl) return;
gl.getExtension('WEBGL_lose_context')?.loseContext();
```

**F-A8 (low, verify) `overwrite: true` may break the card tilt.** `main.js:72` (`gsap.to(els, {..., overwrite:true})` on `.card[data-tilt]`) kills all tweens of those targets, including the paused `quickTo` tweens from `main.js:105-106` (`gsap-core.js:3309-3314`, `killTweensOf` returns paused tweens). `quickTo` is designed to re-initialise, so it probably recovers, but remove the risk: delete `overwrite: true` (nothing else tweens those elements before they reveal). Check by hovering a card after it reveals.

**F-A9 (low) Skip link and in-page links do not move focus.** `main.js:50-60`. Same as F-E6.

**F-A10 (low, perf) DPR 2 and forced high-performance GPU.** `main.js:132,135`. With `antialias`, PBR and ACES at DPR 2 on a roughly 70vh square this is fine on most laptops, but `powerPreference:'high-performance'` wakes the discrete GPU and drains battery. Fix: `powerPreference:'default'` and `Math.min(devicePixelRatio, 1.5)`.

---

## northline-studio: CHANGES NEEDED

**F-N1 (med, verify) CTA title reveal is created before the pin.** `main.js:203-210` creates the word-reveal triggers for all `.h2[data-split], .cta__title[data-split]` before `initPlan()` at `main.js:220`. The CTA title (`index.html:308`) sits below the pinned plan, so its trigger is measured without the pin spacer and fires about 3.2 viewport heights early. Its words are already revealed when the user arrives (no entrance animation). Same root cause as F-E2. Fix: call `initPlan()` before the heading loop, or split the heading loop so that the CTA title is created after the pin.

**F-N2 (med, verify) The pinned plan can overflow on short viewports.** `style.css:224-225` (`.js-motion .process__pin { height: calc(100svh - var(--nav-h)); padding-block: 24px }`) and `style.css:338-348` (mobile: plan up to `42svh`, title, 4 steps). On a 390x844 phone this fits (about 650 of 690px). On a 390x667 phone or a landscape or 1024x600 viewport, the content is taller than the fixed pin height. Overflow stays visible and overlaps the top of the Projects section while pinned. There is no height-based guard like apex-forge has (`min-height: 620px`).
Fix: only pin when there is room, for example wrap the pin in `gsap.matchMedia().add('(min-height: 640px)', initPlan)` and give `.process__pin` `min-height` (not `height`) so content can grow. Check at 390x667 and 1024x600.

**F-N3 (low) Footer links are under 44px.** `style.css:300-301` (`min-height: 36px` on footer `li` and `a`). BRIEF requires touch targets of at least 44px. Fix: `min-height: 44px`.

**F-N4 (low) Skip link and in-page links do not move focus.** `main.js:149-165`. Same as F-E6.

**F-N5 (low) Drag rotation does not finish its easing under reduced motion.** `scene.js:110-119,137,150`. With no render loop, `dragYaw` only advances 8% of the gap per pointer event, so the model lags behind the pointer and stops short of the target. Fix: when `reduce`, set `dragYaw = targetYaw` before `draw()` in the pointer handler.

**F-N6 (low) Current project not exposed to assistive tech.** `main.js:140` toggles `.is-active` on `#plist a`. Fix: also `a.toggleAttribute('aria-current', n === i)` or set `aria-current="true"`.

**F-N7 (low) Invented project names.** `index.html:217-221,226-298`: "Ridge House", "Harbour Offices", "Courtyard Housing", "Gallery Annex", "Terrace Pavilion". They are clearly marked "(sample projects)" (`index.html:215`), and location and year are placeholders, so this complies with "invented brand is fine (mark as sample)". Keep that label visible. No other invented facts found.

**F-N8 (low) Hero text flashes before GSAP hides it.** `main.js:178-188` hides the hero words and fades only after the script runs, with no CSS pre-hide. The classic script sits at the end of `<body>`, so a flash is possible on slow loads. Fix: `.js-motion .hero__title { visibility:hidden }` set by an inline head script, as ember-table does, and un-hide it in the timeline.

---

## nova-labs: CHANGES NEEDED

**F-V1 (med, perf) Infinite custom-property animation on the CTA panel.** `style.css:3` (`@property --angle`, `inherits:true`), `style.css:291` (`animation: spin 7s linear infinite` on `.cta__panel`), `style.css:294-301`. Animating a registered custom property runs on the main thread, and with `inherits:true` it restyles the whole panel subtree each frame. It also repaints a masked conic-gradient ring and a 48px-blurred conic `.cta__glow` on every frame while the CTA is on screen.
Fix: animate a composited property instead, for example put the conic gradient on a pseudo-element and `transform: rotate()` it inside an `overflow:hidden; border-radius` wrapper. At minimum set `inherits: false`, declare `--angle` on `.cta__panel::before` and `.cta__glow` only, and pause when off-screen (`animation-play-state: paused` toggled by an IntersectionObserver).

**F-V2 (low) The work-card hover lift is dead after the reveal.** `main.js:153-155` (`gsap.from(wrap.children, {y:48, ...})` on `.work__card`) leaves an inline `transform: translate(0,0)` that beats `style.css:265` (`.work__card:hover { transform: translateY(-6px) }`). The CSS transition at `style.css:264` also delays the reveal tween. Fix: add `clearProps: 'transform'` to the `from()` call at `main.js:154` and remove `transform` from the `.work__card` transition during the reveal.

**F-V3 (low) Context restore is not handled.** `hero3d.js:182-185` stops and hides the canvas on `webglcontextlost` but there is no `webglcontextrestored` handler, so the (restorable, `preventDefault`-ed) context never comes back and the CSS fallback stays. Fix: `canvas.addEventListener('webglcontextrestored', () => { container.classList.add('is-3d'); update(); draw(clock.elapsedTime); });`.

**F-V4 (low) Animation time jumps after pausing.** `hero3d.js:174` calls `clock.start()` on every `start()`, which resets `elapsedTime` to 0, so the scene snaps back to its initial rotation each time the hero re-enters the viewport. Fix: use `clock.running ? 0 : clock.start()` guard, or track an accumulated `t += dt` with `performance.now()` instead.

**F-V5 (low) `backdrop-filter` flattens the 3D card tilt.** `style.css:195-197` (`.card` has `backdrop-filter` plus `transform-style: preserve-3d`) and `style.css:205` (`translateZ(36px)` on the icon). `backdrop-filter` forces the used `transform-style` to `flat`, so the icon pop-out depth never shows. The tilt itself still works. Fix: drop `preserve-3d` and the `translateZ`, or move the blur onto a `::before` layer that does not share the transformed element.

**F-V6 (low) Programmatic focus shows a large outline.** `main.js:69` focuses the `<main>`/section after an anchor click. For keyboard activation `:focus-visible` matches, so the whole section gets a cyan outline. Fix: `[tabindex="-1"]:focus-visible { outline: none; }`, or only focus headings.

**F-V7 (low) Duplicate footer links.** `index.html:270-273` points four items to the same `#capabilities`. Either link to distinct anchors or collapse them.

**F-V8 (low, perf) Nav blur sits over the WebGL canvas.** `style.css:96` (`.nav.is-scrolled { backdrop-filter: blur(18px) }`) re-blurs the live hero canvas every frame while it overlaps. Acceptable on a normal laptop, but consider a solid `rgba(7,6,15,.9)` background without blur on the first viewport height.

---

## showcase/index.html: PASS (low fixes recommended)

**F-I1 (low) Lumière thumbnail label is under 3:1.** `index.html:51` (`#2b3326` text) over the card overlay (`index.html:26`, `rgba(0,0,0,.45)` at the bottom) on `#a9b79b` gives about 2.9:1, below the 3:1 floor for large text. Fix: remove the inline colour so the label is white (about 4.5:1 on the darkened area), or strengthen the overlay.

**F-I2 (low) Card titles are not headings.** `index.html:47-64`. Each card is a single `<a>` whose title is a `<span>`, so screen-reader heading navigation skips the five sites. Fix: render the title as `<h2>` inside the thumb (the link stays the card).

**F-I3 (low) Smooth scroll is not gated for reduced motion.** `index.html:13` sets `scroll-behavior:smooth` and `index.html:35` only turns off transitions. Fix: add `html{scroll-behavior:auto}` inside the reduced-motion media query.

No external resources, no invented facts, a footer line present, a single `<h1>`, `main`/`header`/`footer` landmarks present, links work as relative folder URLs.

---

## Suggested fix order (highest value first)

1. apex-forge F-A1 (contrast of the CTA word), F-A4 (invented offers), F-A2 (static three import coupling)
2. ember-table F-E1 and apex-forge F-A3 (render-loop leak, same two-line fix)
3. ember-table F-E2 and northline-studio F-N1 (ScrollTrigger creation order, verify with a scroll test)
4. ember-table F-E5 and nova-labs F-V1 (the two real performance risks)
5. ember-table F-E3/F-E4 and northline-studio F-N2 (pinned-section behaviour at awkward sizes and keyboard use)
6. The shared skip-link focus fix (F-E6 and its repeats) and the remaining low items.
