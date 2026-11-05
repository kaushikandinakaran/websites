# Showcase QA report, round 2 (EvidenceQA)

Date: 2026-11-03. Acceptance criteria: `showcase/BRIEF.md` plus the round-2 change list. Round-1 report: `showcase/qa/QA-REPORT.md`.
Server: `python -m http.server 8811` (only that port, stopped at the end). Browser: Microsoft Edge (Chromium 156, headless, SwiftShader WebGL) via Playwright 1.48. One browser process at a time, so there were no connection-refused artifacts this round. No site files were edited.
Screenshots: `showcase/qa/screens-r2/<slug>/` (plus `hub/`).

## Verdicts

| Site | Verdict | Remaining defects |
|---|---|---|
| Hub `showcase/index.html` | PASS | none |
| `ember-table` | PASS | 3 low |
| `lumiere-spa` | PASS | 2 low |
| `apex-forge` | PASS | 2 low |
| `northline-studio` | PASS | 3 low |
| `nova-labs` | PASS | 2 low |

No high or medium defects remain. Round-1's only FAIL (Nova descenders) is fixed.

## What was re-tested (every site, from scratch)

At 1440x900, 1024x768, 390x844: console errors / page errors / failed requests / HTTP >= 400 from first request; horizontal overflow at top and after a full wheel scroll; every header nav link at 1440; mobile menu (open, Tab, Escape, focus return, link click, toggle close, resize while open); real wheel scroll to the bottom; 3D canvas non-blank (pixel std-dev); WebGL disabled (1440 and 390); `prefers-reduced-motion: reduce` (1440 and 390, section-by-section visibility scan); touch targets at 390; keyboard focus rings across the first 14 tab stops; invented-fact / forbidden-claim text scan; screenshots (top, mid, bottom, plus menu, focus, no-WebGL, reduced-motion shots).
Plus the round-2 specifics listed below. Hub: all 5 links return 200 with no console errors at 1440, layout at 3 widths, no failed requests.

Not tested (gaps): real-GPU frame rate, Safari / Firefox / real touch devices, screen readers, OS font fallbacks (Mac/Android/Linux).

## Cross-site results (measured)

| Check | ember | lumiere | apex | northline | nova |
|---|---|---|---|---|---|
| Console errors / 404s / failed requests (1440, 1024, 390) | 0 | 0 | 0 | 0 | 0 |
| WebGL-off console errors | 0 | 0 | 0 (was 1) | 0 | 0 |
| Reduced-motion console errors | 0 | 0 | 0 | 0 | 0 |
| Horizontal scroll at 1440 / 1024 / 390 | none | none | none | none | none |
| One h1, landmarks, img alt | yes | yes | yes | yes | yes |
| Desktop nav links all land under the header | yes | yes | yes | yes | yes |
| Mobile menu open / Esc / link click / toggle / focus return | pass | pass | pass | pass | pass |
| 3D canvas non-blank (pixel std-dev, 1440) | 34.7 | 31.5 | 53.4 | 25.4 | 40.9 |
| WebGL off: page works, fallback visible | pass | pass | pass | pass (nice SVG model fallback) | pass |
| Reduced motion: 0 running animations, content visible | pass | pass | pass | pass | pass |
| Touch targets < 44px at 390 | none (was 1) | none | none | none (was 4) | none |
| Forbidden-claim scan (most popular, free trial, no contract, awards, prices, stats, phones) | none | none | none | none | none |
| Footer "Sample design by Website Studio" | yes | yes | yes | yes | yes |

Notes on the scans: the automated "invisible text" scan flags only expected things (word-split text mid-reveal, closed accordion panels in Lumière, Northline plan labels before the scroll-drawn plan reaches them, Nova's closed mobile menu links). All of these are reached and visible when scrolled to. `#visit` (Ember) and `#contact` (Nova) cannot reach the top of the viewport because they are the page footer, which is correct. The word "est." hit in Apex is "honest" / "strongest", not a claim.

## Round-2 change list: verification

1. **Nova Labs: clipped descenders.** FIXED. 2x zoom shots `nova-labs/zoom-h1-1440.png`, `zoom-h1-390.png`, `zoom-cta-1440.png`, `zoom-title0-1440.png`: the "g" in "working", the "p" and "g" in "Let's map it together." and the "p" in "problem" are complete at both widths. `.w` bottom padding is now 22.8px at the 76px hero size (about .3em, was .14em) and 12px at 390.
2. **Apex Forge: invented claims gone.** FIXED. Text scan finds no "Most popular", "free trial", "no contract", "no hidden extras" or "first session is on". The featured tier is now `[Featured plan]`, prices are `[Price]`, the CTA says "Book a visit" and reads "[Trial offer, if any] [Contract terms]". Evidence: `apex-forge/membership-1440.png`, `join-1440.png`.
3. **Apex Forge: dumbbell.** Honest view: clearly more premium than round 1. It is now brushed chrome with orange bands, steel threaded bar and environment reflections (`apex-forge/1440-top.png`, `390-top.png`); it reads as real equipment, not the near-black plates of round 1. It is still a stylised model (boxy / hex plates, pinkish reflections), not photoreal. At some rotation angles one plate face is slightly over-exposed peach/white (`1024-top.png`). I would call it good, not luxury-grade. Canvas pixel std-dev rose from 23.5 to 53.4 (more detail).
4. **Apex Forge: button focus rings.** FIXED. All 14 tab stops, including "See programs", "Choose Recruit/Hero/Legend", show a 3px orange outline with 3px offset (`apex-forge/focus-5.png` shows the ring on a nav link; computed styles for buttons recorded).
5. **"Pause motion" on all five (aria-pressed).** PASS on all five at 1440 and 390. For each: control run (motion on) gave two different screenshots 1.5s apart; after pressing, `aria-pressed="true"` and two viewport screenshots 1.5s apart are byte-identical at the top of the page AND again after scrolling to 30% of the page; 0 running CSS animations; pressing again sets `aria-pressed="false"` and the screenshots differ again (motion resumes). At 390 the button is an icon-only 44x44 target in the header (Ember, Lumière, Apex, Nova) or in the hero caption area (Northline, 139x44). Nova's accessible name switches to "Play motion" when pressed. Evidence: `<slug>/pause-1440-A.png` / `-B.png`, `pause-390-A.png` / `-B.png`.
6. **Skip link and menu links move focus.** PASS on all five. First Tab shows the skip link; Enter moves focus to `<main>` at 1440 and 390 (next Tab goes to the first hero button). Desktop nav link clicks move focus into the target section (e.g. `SECTION#menu`); mobile menu link clicks close the menu, scroll to the target and focus the target section; keyboard Enter on a menu link does the same. Only `#top` focuses `<main>` or the logo (acceptable). Evidence: `<slug>/skip-1440-focused.png`, `skip-390-focused.png`.
7. **Northline: pinned plan on 390x667.** PASS. No horizontal overflow (scrollWidth 390) at 6 scroll positions through the process section; the plan svg stays within 16..374px. At this short height the pin is switched off: the plan shows fully drawn above the heading and the four steps follow as a normal list, nothing clipped (`northline-studio/390x667-process-0.png`..`-5.png`). At 390x844 the pinned version still works.
8. **Northline: arrow keys.** PASS. With auto-rotation paused (model verified static for 1.2s), three ArrowRight presses change the canvas (`arrow-0.png` vs `arrow-right.png`), eight ArrowLeft presses change it again (`arrow-left.png`). The canvas has a visible 2px brown focus ring.
9. **Ember Table: hero readable at 720x450.** PASS. Eyebrow, H1 (3 lines, 189..374px) and the first paragraph are readable on the dark scrim; no horizontal overflow, no console errors (`ember-table/720x450-top.png`, also `844x390-top.png`, `1024x600-top.png`). The two hero buttons start at y=521, so they are below the fold at 450px tall (see R2-3).
10. **Hub: favicon and titles.** FIXED. The hub now has an inline-SVG icon: zero 404s at all three widths. The "Lumière Spa" and "Northline Studio" card titles are now dark text on a light gradient fade and clearly readable (`hub/1440-full.png`).
11. **Regressions check.** None found. No new console errors, no stuck-invisible content (after scrolling every section), no overflow, animations play (control screenshots differ when motion is on), reduced motion still shows all content. Layout looked intact at all widths. Items worth a note are R2-1 to R2-9 below (all low).

## Round-1 defects: status

| R1 | Issue | Status |
|---|---|---|
| D1 | Nova descenders clipped | FIXED (zoom-verified) |
| D2 | Nova transient blank frame during smooth scroll | NOT REPRODUCED this round (header top 0 everywhere, no blank frames in walk). Still unproven either way; leave as a human spot-check on a real GPU |
| D3 | Nova closed menu links at opacity 0 | Unchanged, harmless (not focusable) |
| D4 | Ember footer contact column spacing uneven | NOT FIXED (phone/email still ~52px apart and brighter than the address lines, `ember-table/1440-bottom.png`), low |
| D5 | Ember footer "Menu" link 43px | FIXED (no sub-44px targets at 390) |
| D6 | Lumière burger shown at desktop | FIXED (desktop nav now shows links, Pause motion and Book a visit; burger only on mobile, `lumiere-spa/1440-top.png`) |
| D7 | Lumière orbs matte at 1440, glossy at 1024 | FIXED for consistency (same glossy-glow look at all widths). They are now more glossy than "soft" at every width (see R2-4) |
| D8 | Lumière visit cards with empty lower half | Not re-inspected in detail; unchanged layout |
| D9 | Apex console error with WebGL off | FIXED (0 console errors at 1440 and 390 with WebGL off) |
| D10 | Apex dumbbell dark / flat | FIXED (chrome with orange bands, see item 3) |
| D11 | Apex Impact font fallback | Not testable here (Windows only), still open as a risk |
| D12 | Northline footer links 36px | FIXED (no sub-44px targets at 390) |
| D13 | Northline plan labels tiny at 390 | IMPROVED: labels now about 11-12px in the 390x667 shots and readable; not measured exactly |
| D14 | Northline page very long | Unchanged (12,061px tall at 1440), low |
| D15 | Hub favicon 404 | FIXED |
| D16 | Hub light-card titles low contrast | FIXED |
| D17 | No back-to-hub link | Unchanged, optional, not required by the brief |

## Remaining defects (all low, none blocking)

R2-1 (low, Ember Table). The steam hero is much fainter than in round 1: at 1440 `ember-table/1440-top.png` is a dark scrim with only dim smoky blobs and a few embers (canvas std-dev dropped from 41.6 to 34.7). Text is clearly more readable (the goal), but the "steam" signature looks weaker and the hero is less atmospheric. Consider letting a bit more glow through on the right half.

R2-2 (low, Ember Table). Footer contact column spacing and colour inconsistency (R1 D4, still open).

R2-3 (low, Ember Table). At 720x450 the two hero CTA buttons are below the fold (y=521 in a 450px viewport) while the H1 fills the screen. Readable, but the primary action needs a scroll on very short landscape windows.

R2-4 (low, Lumière Spa). On 390 the top-right orb sits directly behind the pause and menu buttons (`lumiere-spa/390-top.png`), which are translucent outlined circles, so the controls are less clean. The orbs are also glossier / more "plastic" than the "soft airy" brief wording, with bright specular blobs at every width.

R2-5 (low, Northline Studio). The mobile menu toggle's accessible name stays "Menu" when open (round 1 changed to "Close menu"). `aria-expanded` still flips correctly, so it is usable. Same on Nova (R2-7).

R2-6 (low, Northline Studio). At very short viewports (390x667) the scroll-drawn plan is replaced by a static, fully drawn plan, which is a good fallback but means the signature move is not seen on small phones. Also the page is still about 12,000px tall at 1440 (R1 D14).

R2-7 (low, Nova Labs). Mobile toggle accessible name is "Menu" when open (see R2-5). The new "Pause motion" pill sits in the middle of the header between the logo and the nav links (`nova-labs/1440-top.png`) and looks a bit floating / off-grid compared with the rest of the nav.

R2-8 (low, Apex Forge). One plate face of the dumbbell is over-exposed at some rotation angles (1024-top). The Impact-based display font may fall back on Android / Linux (not tested).

R2-9 (low, all). `.sr-only` text and decorative blocks are reported by the overflow scan as clipped; these are intentional visually-hidden elements, listed so nobody re-reports them.

## Visual quality (honest)

Still a strong, clearly differentiated set: warm restaurant (Ember), airy editorial spa (Lumière), bold superhero gym (Apex), monochrome architectural grid with terracotta accent (Northline), neon glass tech (Nova). The round-2 changes made everything better or neutral: text contrast and hero legibility are up (Ember, Lumière, Apex), the Apex 3D hero is now credible, and the hub looks tidy. The pause button is integrated cleanly everywhere. The only visual trade-off I saw is that the Ember steam is now subtle (R2-1).

## Required next steps

None blocking. Optional polish: R2-1, R2-2, R2-4, R2-7. A human spot-check on a real GPU laptop and a phone is still recommended for frame rate and the unproven R1 D2.

QA Agent: EvidenceQA. Port 8811 server stopped.
