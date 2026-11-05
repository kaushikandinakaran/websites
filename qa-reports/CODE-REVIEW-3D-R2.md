# Code re-review: 5 restaurant 3D sites (round 2, re-check of fixes)

Reviewer: studio code reviewer (independent, read-only static review; no server or browser run, no site files edited).
Input: `showcase/BRIEF.md`, `showcase/BRIEF-3D.md`, original findings `showcase/qa/CODE-REVIEW-3D.md`.
Method: every original finding re-checked against the current code with file:line evidence; then the new code paths (render loops, context loss, pause/resume, async boot, menus) read for regressions.
Severity: **high** = can freeze/break the page or breaks a BRIEF rule outright; **med** = visible defect, rule risk, real perf/a11y cost; **low** = polish/hardening.
Verdict rule: CHANGES NEEDED if any med or high finding is open, otherwise PASS.

Sections are appended site by site as each review finishes (summary table at the end).

---

## 1. sakura-omakase

### Original findings

| # | Sev | Status | Evidence |
|---|---|---|---|
| S1 env map lost on context restore | med | FIXED | `scene.js:91-92` keeps `envRT`; `scene.js:221-228` rebuilds with `makeEnvironment(renderer)`, re-assigns `scene.environment`, removes `gl-lost` before `resize()` (so the host is measured at full size, no 2x2 canvas), then `schedule()`. `world.js:48-65` builds a fresh temp scene each call, so a rebuild is safe. Poster shown during loss: `scene.js:219` + `style.css:58,212-217`. |
| S2 deviceMemory default demotes Safari/Firefox | med | FIXED | `scene.js:53` `navigator.deviceMemory \|\| 8`. |
| S3 debug hooks | low | FIXED | No `window.__*`, `location`, `URLSearchParams` or `console.*` in any sakura file; `detectTier()` (`scene.js:49-57`) has no `?q=` branch; controller (`scene.js:238-248`) exposes only `setU/setPaused/highlight/dispose`. |
| S4 no AA after composer drop | low | FIXED | `scene.js:64` `antialias: true` for every tier; FXAA pass added after OutputPass (`scene.js:83-84`) with resolution updated in `resize()` (`scene.js:129`). See new finding N1 about its sample bias. |
| S5 degrade leaks bloom | low | FIXED | `scene.js:197-203` `disposeComposer()` disposes bloom, fxaa and composer. |
| S6 per-frame closures in sampler | low | FIXED | `scene.js:23-32` flattens channels once into `VAL`/`TAN`; `sampleKeys` (`:38-47`) writes into a shared `Float64Array`. |
| S7 layout jump on late failure | low | FIXED | `main.js:191` `fail()` adds `fell-back` (posters only, `style.css:58,212`), the tall-layout collapse is tied to `no-3d` only (`style.css:218-221`), which is set solely by the head probe. |
| S8 draw calls / clearcoat on phones | low | FIXED | `world.js:82-87` and `food.js:11-16` swap to `MeshStandardMaterial` on tier 0; `food.js:18-41` `mergeStatic()` bakes each set-piece to one mesh per material and disposes the temp clones. |
| S9 probe context not released; dead CSS | low | FIXED | `index.html:19` `loseContext()`; `.station.is-short` no longer in `style.css`. |

### Render loop and pause/resume (checked, OK)

- One rAF only: `frame()` clears `raf` first (`scene.js:181`); `degrade()` → `resize()` → `schedule()` can queue the next frame, and the trailing `schedule()` (`:194`) is guarded by `if (raf || ...) return` (`:177`). No double loop. Adaptive guard ends at tier 0 (`:190` `tier > 0`).
- Pause tears down Lenis, sleeps the GSAP ticker and `ScrollTrigger.disable(false)` (`main.js:169-171`). In ScrollTrigger 3.12.5 the static `disable(false)` calls each trigger's `disable(false)` (no revert) and removes its listeners; resume calls `ScrollTrigger.enable()` and then `t.enable()` per trigger (`main.js:173`), whose default `refresh` fires the `onRefresh` → `measure(); onScroll()` (`main.js:154`), so anchors are re-measured. While paused, `measure()` still runs from the window resize listener and ResizeObserver (`main.js:158-159`).
- The camera is driven only by the plain `scroll` listener (`main.js:156`); the ScrollTrigger has no `onUpdate`, so there is no double drive after resume, and `setU` early-returns on an unchanged target (`scene.js:239`). Nav highlight lives in `onScroll` and keeps working paused or not. Anchor clicks fall back to `window.scrollTo` with `behavior:'auto'` while paused (`main.js:94`).

### New findings

**N1. low (verify on Windows). The new FXAA pass uses the stock `-100.0` texture bias.** `scene.js:83` `new ShaderPass(FXAAShader)` with the unpatched vendor shader (`vendor/three-addons/shaders/FXAAShader.js:93-94`). The team's own notes in `blue-pearl/scene.js:12` and `maison-claire/scene.js:535` say Direct3D/ANGLE clamps this and logs a console warning, and the demo machine is Windows. Fix (Maison's version, which also removes the pointless bias on mip-less targets):
`fxaa = new ShaderPass({ ...FXAAShader, fragmentShader: FXAAShader.fragmentShader.replace(/,\s*-100\.0\)/g, ')') });`

**N2. low. Resuming motion while the mobile menu is open starts a Lenis that is not stopped.** The pause button sits inside the menu's focus cycle (`main.js:65` collects every `button` in `#nav`). Sequence: open menu (`setMenu(true)` calls `lenis.stop()`), press pause (`stopLenis()` destroys it), press again (`startLenis()` creates a new running instance, `main.js:29-40`). Wheel/touch over the open menu now scrolls the page behind it (Lenis drives `window.scrollTo`, which ignores `overflow:hidden`). Fix: at the end of `startLenis()` add `if (menu.classList.contains('is-open')) lenis.stop();`.

Copy check: no invented facts; prices, address, hours, phone, testimonial and booking are placeholders (`index.html:240-256,321-331`). No external requests. Brand link has no `aria-label` (name = visible text). Motion button keeps a constant label (`index.html:84-88`, `main.js:166`). Focus ring `#ffd27a` on its own `rgba(8,4,6,.92)` halo (`style.css:41`) is about 13:1. No `will-change` in the stylesheet.

**Verdict: PASS** (no open med/high; N1 and N2 recommended before the demo).

---

## 2. forno-rosso

### Original findings

| # | Sev | Status | Evidence |
|---|---|---|---|
| F1 main-thread freeze from texture generation | high | FIXED | Unused `facTex` gone from `world.js`; `textures.js:111` wall 768x512, `:179` marble 512, `:200` wood 256x128, all halved again on low via `setQuality` (`:40-41`); `vnoise` (`:20-28`) uses a precomputed 256x256 lattice, no closures; `makeTextures` (`:270-280`) yields with `setTimeout(0)` between textures; scene boot waits for `load` + `requestIdleCallback` (`main.js:173-178`) and handles `load` already fired (`document.readyState === 'complete'`). Roughly 0.75 M `fbm` calls in total now, split over 10 tasks (was ~4.4 M in one task). |
| F2 pause button label in name | med | FIXED | `index.html:44-48` no `aria-label`, visible span not `aria-hidden`; `main.js:73-78` changes only `aria-pressed`. Text is visually hidden (still in the name) under 860 px (`style.css:191`). |
| F3 still mode renders per scroll event | med | FIXED | `scene.js:224` `if (J === target) return`; `scene.js:164-170` still frames coalesced to one per rAF (`stillQueued`); duplicate raw `scroll` listener only when GSAP is absent (`main.js:140-144`). |
| F4 4 s safety disabled at first line | med | FIXED | `main.js:181` adds `js-ready` as the last statement; `index.html:20` adds `reveal-all` at 4 s otherwise; `style.css:120` `.reveal-all .card` shows every card. A throw anywhere above line 181 leaves content visible within 4 s. |
| F5 layout jump on late failure | med | FIXED | `main.js:152-156` `fallback()` removes only `gl` (posters back), keeps `gl-able` (tall layout, `style.css:98-103`). |
| F6 debug hooks | low | FIXED | No `location`, `URLSearchParams`, `window.__`, `console.*`, `?tier`, `?nolenis` in any forno file. |
| F7 no AA on low/mid | low | FIXED | `scene.js:68` `antialias: !useBloom` (low gets canvas MSAA), `scene.js:93` `samples: high ? 4 : 2` (mid gets 2x MSAA). |
| F8 per-frame allocations | low | FIXED (one nit left) | `scene.js:108-113` scratch `camPos`; `world.js:30-43` `moodAt` fills a shared `moodTmp`; `world.js:508` hoisted `sauceSideEnd`; unused `tmpV` removed. `pizzaPose()` (`world.js:45-49`) still returns a new object per frame (harmless). |
| F9 renders behind footer | low | FIXED | `scene.js:188-196` IntersectionObserver on `#journey` stops/wakes the loop. |
| F10 duplicate scroll plumbing / undebounced resize | low | FIXED | Single ScrollTrigger `onUpdate` feed; `main.js:134-139` coalesces ResizeObserver/resize into one `measure()` per frame. |
| F11 menu does not inert page | low | FIXED | `main.js:34-35` `inert` on `#main` and `.footer` only while open on the mobile breakpoint; cleared on Escape (`:42`), breakpoint change (`:50`), and link click (`:58-59`), all through `setMenu(false)`. |
| F12 programmatic focus box-shadow | low | FIXED | `style.css:38` `[tabindex="-1"]:focus, [tabindex="-1"]:focus-visible { outline:none; box-shadow:none }` (specificity 0,2,0 beats `:focus-visible` 0,1,0). |
| F13 freshness wording | low | FIXED | Heading now "Straight from the oven.", "herbs", "Dessert" (`index.html` menu section). |

### Risky new code (checked)

- Render loop: `frame()` re-queues first (`scene.js:146`), `start()` is guarded by `if (raf || ...)` (`:159`), `wake()` only calls `start()`, so no path queues two loops. Pause stops the loop once settled and clean (`:154`); scroll (`setJ` → `wake`) and resume (`setPaused(false)` → `wake`) restart it. IntersectionObserver's first callback can arrive before `ready`; `start()` refuses until `ready`, then `:220` starts it.
- Async boot: `makeTextures` runs before any listener is attached and before `ctl` exists, so a resize, pause or scroll during the yields only touches `main.js` state; `main.js:164` applies the current pause state once `ctl` exists; `doResize` during `compileAsync` updates `W/H` and is picked up by the first `render()` (`:219`).
- Context loss after boot: CPU-backed textures only (no PMREM), restore just clears `lost` and wakes; `gl-lost`/`gl-restored` toggle the poster class in `main.js:165-166`.

### New findings

**N1. med. Focus ring falls below 3:1 on the primary buttons and the skip link: the dark halo is overridden by the cascade.** `style.css:41` gives every `:focus-visible` a 2 px `--night` halo under the `--fire-500` ring, but `.btn--primary` (`style.css:87`) and `.skip` (`style.css:44`) set their own `box-shadow` later with equal specificity (0,1,0), so on those elements the halo is gone. The bare ring `#ff6a1f` then sits on the flour nav pill / day card (`#fff8ee`): 2.7:1, and next to the terracotta button `#c4421f`: 1.8:1; the skip link's ring over the `#f2d2ad` hero: 2.0:1. Affected: nav "Reserve" (`index.html:61`) and hero "Reserve a table" (`index.html:96`, inside `.card--day`); the skip link. (Night cards are fine: `.card--night :focus-visible` at 0,2,0 restores a black halo.) BRIEF-3D requires >= 3:1 on every control. Fix (after line 93):
`.btn--primary:focus-visible { box-shadow: 0 0 0 2px var(--night), 0 4px 0 var(--terra-700); }`
`.skip:focus-visible { box-shadow: 0 0 0 2px var(--night); }`

**N2. low. The bloom precompile builds program variants that are never used.** `scene.js:204-206` correctly compiles the scene against `composer.readBuffer`, but `scene.js:206` resets the target to `null` before the bloom block (`:208-214`), so `compileAsync(ppScene)` compiles the bloom `ShaderMaterial`s with screen settings (ACES tone mapping + sRGB output, part of the program cache key in r160). In the composer they render into render targets (no tone mapping, linear), so the real programs still compile synchronously on the first `composer.render()`, which is the hitch this block was meant to avoid. Fix: `renderer.setRenderTarget(bloom.renderTargetsHorizontal[0]);` before `await renderer.compileAsync(ppScene, camera);` and `renderer.setRenderTarget(null);` after it.

**N3. low. A context loss during boot hangs the scene and later throws.** The `webglcontextlost` listener is attached at `scene.js:176`, after `makeTextures` has yielded ten times. If the context is lost during `compileAsync` (`:205`), three r160 polls `program.isReady()` every 10 ms forever (`getProgramParameter` returns `null` while lost), and after a restore `properties` is rebuilt so `currentProgram` is `undefined` and the poll throws `TypeError` (uncaught, console error) from its `setTimeout`. The page stays usable (posters remain because `gl` is never added) but the console is no longer clean. Fix: race each `compileAsync` against a timeout and skip when lost, e.g. `await Promise.race([renderer.compileAsync(...), new Promise((r) => setTimeout(r, 4000))]);` and `if (renderer.getContext().isContextLost()) return null;` right before the precompile.

Copy check: no invented facts; menu is flagged as an illustrative sample with `[Price]` everywhere; address, hours, phone and booking are placeholders. "Tell us when you are coming and we will keep the oven hot" (`index.html` reserve card) is generic, not a factual claim. No external requests. No `will-change` in `style.css`.

**Verdict: CHANGES NEEDED** (N1 med: two-line CSS fix). Everything from round 1 is fixed.

---

## 3. saffron-court

### Original findings

| # | Sev | Status | Evidence |
|---|---|---|---|
| C1 debug globals and test hooks | med | FIXED | No `window.__saffron*`, `?q=`, `?scene=`, `loseContextForTest`, `stats()` or `loseExt` left (grep of all saffron files for `location`, `URLSearchParams`, `window.__`, `console.`, `ForTest` is empty). Controller (`scene.js:789-806`) exposes only scene methods. |
| C2 env map lost on restore | med | FIXED | `scene.js:104-121` `buildEnv()` (disposes the previous target when alive, disposes the temp scene); `scene.js:780-784` restore sets `envRT = null` (dead target forgotten, not disposed), rebuilds, `resize()`, then restarts or kicks. |
| C3 composer built at pr^2 | low | FIXED | `scene.js:605` target created at `w x h`; `scene.js:622` then `composer.setPixelRatio(pr); composer.setSize(w, h)`, so every pass ends at `w*pr` (r160 `EffectComposer` keeps `_width = rt.width`). |
| C4 bloom not disposed; idle 60 Hz loop | low | FIXED, but see N1 | `scene.js:748` `bloom.dispose()` after the splice; `scene.js:755-761` the loop sleeps when paused and settled. The new sleep/wake logic introduced N1. |
| C5 unscrimmed header | low | FIXED | `style.css:88` permanent `.nav::before` gradient (`.82` to `.6` at 62%, fading over 28 px below the nav), `z-index:-1` inside the nav's own stacking context (sticky + `z-index:100`), `pointer-events:none`, so it never blocks clicks on the hero. Worst case `--cream-2` link text over a white pixel at the link baseline (alpha ~0.69): 5.0:1. |
| C6 interleaved layout read/write | low | FIXED | `main.js:109-131` reads all rects first, then computes, then writes. |
| C7 five point lights on phones | low | FIXED | `scene.js:139,140,528` gate, orbit and thali lights are only added when `density >= 1`; hemisphere raised to compensate (`:136`). |
| C8 no inert while menu open | low | FIXED | `main.js:37` `inert` on `#main` and `.footer`; every exit (Escape `:44`, breakpoint change `:52`, link click `:63`) goes through `setMenu(false)`. |

### New findings

**N1. high. The adaptive-quality path queues a second (and third) render loop.** `loop()` clears `st.raf` first (`scene.js:756`), then `renderFrame()` may run the adaptive block, which calls `resize()` (`scene.js:747`); `resize()` ends in `wake()` (`scene.js:625`), and `wake()` sees `st.raf === 0` and queues a frame (`scene.js:762`). Back in `loop()`, line 760 re-queues **without a guard** and overwrites `st.raf`. From then on two `loop` chains run every vsync (the pixel ratio steps 1.5 → 1.25 → 1.0, so up to three chains), doubling or tripling GPU work on exactly the slow machines that triggered the step-down; `stop()` cancels only the latest id (the others die on their next tick only because `running` is false). This is the same defect as Maison M1 in round 1, introduced here by the new sleep/wake logic, and it breaks BRIEF-3D "never queue two loops". Fix: guard the re-queue: `if ((drew || (!st.paused && !st.still)) && !st.raf) st.raf = requestAnimationFrame(loop);` (and optionally call `resize()` from the adaptive block via `setTimeout(resize)` so it never runs inside a frame).

**N2. low. The IntersectionObserver can never pause the loop.** `scene.js:776-777` observes the fixed full-screen canvas, which always intersects the viewport, so the render continues while the opaque footer covers it (BRIEF-3D: pause when the canvas is off-screen). Fix: observe `document.getElementById('main')` (or the last station) instead of `canvas`.

Copy check: no invented facts; menu flagged as illustrative with `[Price]`; reserve details and testimonial are placeholders (`index.html:256-267`); footer has the sample line. Brand `aria-label="Saffron Court, back to top"` contains its visible text (`index.html:25`). No external requests; no `will-change`. Focus ring `#5fe0d3` on the nav gradient / dark panels is well above 3:1.

**Verdict: CHANGES NEEDED** (N1 high: one-line guard).

---

## 4. maison-claire

### Original findings

| # | Sev | Status | Evidence |
|---|---|---|---|
| M1 render loop doubles after `degrade()` | high | FIXED | `scene.js:669-694`: `frame()` clears `raf`, `degrade()` → `resize()` → `wake()` may queue the successor, and the trailing re-queue is now guarded `if (!raf && ...)` (`:693`). `wake()` (`:702-706`) is guarded too. No path can hold two ids. |
| M2 layout shift on scene arrival / loss | med | FIXED | Inline head probe (`index.html:10`) adds `gl-able` (and `rm` under reduced motion) before first paint and releases the probe context; the tall layout is keyed on `html.gl-able` (`style.css:164-171`), not `is-3d`; the poster rides sticky inside the pinned frame until the scene fades in (`style.css:173`). `onLost`/`onRestored` (`main.js:223-224`) only toggle `is-3d` (posters), layout untouched. |
| M3 hero text over a fading scrim | med | FIXED | `style.css:153` the hero is now a solid panel `rgba(18,17,16,.88)` + blur (`.92` on phones, `:223`). Worst case over a white pixel: text `#f1eadb` ~12:1, kicker `--gold` ~7.2:1. |
| M4 `pagehide` disposes into bfcache | med | FIXED | `scene.js:757` `pagehide` detaches only when `!e.persisted`; `scene.js:758` `pageshow` with `persisted` refreshes `tabVisible` and calls `wake()`. |
| M5 `window.__mc` and `?q=` | med | FIXED | No `window.__`, `location`, `URLSearchParams` or `console.` in any maison file; tier is computed only from the device (`scene.js:108-113`). |
| M6 font licence / credits | med | FIXED | `assets/CREDITS.txt` names both families, versions/source, files and the OFL; `assets/OFL-Cormorant-Garamond.txt` and `assets/OFL-Jost.txt` present; posters declared original. |
| M7 import retry gaps | low | FIXED (note) | The full-page reload is gone; `main.js:207-213` retries `scene.js` once, and `scene.js:9-15` retries each addon once with `?r=1`. No duplicate `three`: every module imports the bare `three` specifier, which maps to one URL, and the addons' relative imports resolve without the query, so a successful retry joins the existing instances. Note: browsers cache a failed module fetch for the document, so the retry recovers only when the requested file itself failed, not when one of its dependencies did (harmless: the error then reaches the poster fallback). |
| M8 FXAA bias | low | FIXED | `scene.js:537` removes the bias argument (`replace(/,\s*-100\.0\)/g, ')')`). |
| M9 restore leaks | low | FIXED (by design) | `scene.js:715-725` rebuilds env (reusing the one `pmrem`), re-points every tracked material, drops and rebuilds the composer; old objects are forgotten rather than disposed, which is correct after three has rebuilt its registries on restore (a `dispose()` would hit stale handles). |
| M10 `degrade()` repeats forever | low | FIXED | `scene.js:695-701` returns and sets `guard = false` once the last stage is reached; `:699` also ends the guard. |
| M11 pointer drift while paused | low | FIXED | `scene.js:564` ignores pointer moves while paused; `:680` freezes `pointerCur`; `settled()` treats paused as settled (`:667`). |
| M12 magnetic transforms, permanent `will-change` | low | FIXED | No `will-change` in `style.css`; `main.js:195` skips when motion is off, `:200` clears on `pointerleave`, `:164` clears every button when pausing. |
| M13 menu does not inert; probe not released | low | FIXED | `main.js:47` `inert` on `#main` and `.footer`; Escape (`:54`), breakpoint change (`:62`) and link click (`:151`) all go through `setMenu(false)`. Probe released in `index.html:10`. |
| M14 nits | low | FIXED | `ctlPaused` gone; no second hash jump (layout is fixed from first paint, no `scrollToTarget` on load). |

### Risky new code (checked, OK)

- Context loss: `onLost` (`scene.js:714`) stops the loop and removes `is-3d`; `onRestored` rebuilds env + composer, calls `opts.onRestored()` (adds `is-3d`, `onScroll` → `setState` → `wake`), then `resize()` measures `window.innerWidth/Height` (not the canvas), so there is no 0-size or 2x2 canvas risk. Listeners are removed in `detach()`.
- Reduced motion: `frame()` never re-queues (`:693` `!reduce`); each `setState` draws one still. The head probe's `rm` class and `main.js`'s `reduce` use the same media query.

### New findings

**N1. low. "Fish of the day" reads as a daily-offer claim.** `index.html` tasting menu, course III: "Fish of the day with a light sauce." Round 1 asked Forno to drop "Dessert of the day" for the same reason (F13). Fix: "A fish course with a light sauce."

Copy check: otherwise no invented facts; wine list, prices, address, hours and phone are placeholders; "Sample design by Website Studio" in the footer. Brand link has no `aria-label`; `scrollcue` `aria-label="Scroll to the reveal"` starts with its visible text "Scroll". `CREDITS.txt` mentions the jsDelivr download source as text only; the page makes no external requests. Focus ring `--focus #e6cf9f` on dark surfaces and `#1d1a17` on the ivory menu card (`style.css:177`) are both far above 3:1.

**Verdict: PASS.**

---

## 5. blue-pearl

### Original findings

| # | Sev | Status | Evidence |
|---|---|---|---|
| B1 env map lost on restore; RoomEnvironment not disposed | med | FIXED | `scene.js:69-79` `buildEnvironment()` disposes the live target, bakes, then `room.dispose()` (exists in the vendor r160 `RoomEnvironment.js:115`) and `pmrem.dispose()`; `scene.js:256-261` restore forgets `envRT` and the composer, rebuilds env, `resize()` rebuilds the composer, `sync()` restarts, `onRestored` re-adds `scene-on`. |
| B2 procedural caustics on every surface and tier | med | FIXED | `world.js:54-72` one 256x256 baked `DataTexture`; `world.js:36-43` `causMode` 0 on low (no texture, no injection), 1 lookup on mid, 2 on high (`world.js:108-116`); materials with `strength: 0` (fish, `world.js:764`) get mode 0 (`world.js:76`), so no caustic code; shafts capped 2/3/4 (`scene.js:94`). The texture is seamless: every term is periodic in u and v with period 1 (`3u` shifts `sin(pi*px)` by a sign, which `abs` removes); 256 is a power of two, so `RepeatWrapping` + mipmaps are valid on WebGL1; RGBA/UnsignedByte is universally supported. |
| B3 three stacked smoothers | low | FIXED | `main.js:157` `scrub: true`; the scene's own damping (`scene.js:222`) is the only extra smoother on top of Lenis. No double smoothing: the timeline `onUpdate` only sets `target.s` (`scene.js:271`), the rAF loop eases `cur.s`. |
| B4 debug/profiling hooks | low | FIXED | No `location`, `URLSearchParams`, `window.__`, `console.` in any blue-pearl file; `?cam=`, `?off=`, `?q=`, `?webgl=off`, `?noadapt` gone. (`info()` remains on the controller object, see N3.) |
| B5 AA gaps; composer kept after bloom off | low | FIXED | `scene.js:53` `antialias: true` on every tier; FXAA after OutputPass for mid and high (`scene.js:118`); `scene.js:121-126` `dropComposer()` disposes every pass and the composer when adaptive quality switches bloom off (`:231`). |
| B6 skip-link ring under 3:1 | low | FIXED | `style.css:57` abyss outline at offset 0 plus a 6 px white `box-shadow`: the two bands contrast ~17:1 with each other, so one of them always clears 3:1 against the scene. |
| B7 freshness/sourcing wording | low | FIXED | "A selection of varieties..." (`index.html:199`); the other two phrases are gone. `[Today's catch list]` is a visible placeholder. |
| B8 nits (probe, `no-3d` CSS, rebuilds) | low | FIXED | Probe released (`main.js:190`); `style.css:309` `.no-3d .scene, .no-3d .veil {display:none}`; `buildScroll()` rebuilds only when the anchor key changes (`main.js:146-151`), and the resize handler ignores same-width changes under 120 px (`main.js:172-180`). |

### Risky new code (checked, OK)

- Height-only resize ignore (`main.js:176`): an orientation change always changes `innerWidth`, so it rebuilds; the renderer itself still resizes on every resize (`scene.js:148-150`). Only a desktop height change under 120 px keeps the old anchors (station centres off by at most ~60 px), which is acceptable. `lastH` is declared at `main.js:181` after the closure but before any timer can fire, so there is no TDZ error.
- Loop: `tick` re-queues first (`scene.js:218`), `start()` is guarded by `running` (`:235`), and nothing inside `tick` (including `resize()` from the adaptive block) calls `start()`, so no double loop.
- `js-ready` is added after the reveal setup (`main.js:77`); the 4 s fallback (`index.html:15`) covers a crash before it.

### New findings

**N1. low (verify on Windows). FXAA bias -16 may still warn on ANGLE/D3D11.** `scene.js:12-13` swaps `-100.0` for `-16.0`; D3D11's maximum LOD bias is 15.99, so the driver can still clamp, and the bias is meaningless on the composer's mip-less targets anyway. Fix (Maison's version): `FXAAShader.fragmentShader.replace(/,\s*-100\.0\)/g, ')')`.

**N2. low. The IntersectionObserver never pauses the loop, and a paused page still wakes 60 times a second.** `scene.js:253-254` observes the fixed full-screen `.scene` canvas (`style.css:64`), which always intersects, so the composer keeps rendering under the footer. Separately, with motion paused and nothing moving, `tick` returns early (`scene.js:224`) but has already re-queued itself (`:218`). Fix: observe `#main` (or the last station) instead of the canvas; and in `tick`, when `motionOff && !moving && !dirty`, call `stop()` and let `setStation`/`jump`/`setMotionOff`/`forceRender` call `start()` (they currently only set `dirty`).

**N3. low (nit). Leftovers.** `scene.js:275` `info()` profiling method is still on the controller (not global, harmless); the caustic `DataTexture` (`U.causTex`) is not disposed in `destroy()` because `disposeTree` only frees `m.map`.

Copy check: no invented facts; menu flagged illustrative with `[Price]` and `[Allergen and dietary information]`; reserve block and testimonial are placeholders; footer sample line present. "Alcohol-free pairing" is a dish name, not a commercial "free" claim. No external requests; no `will-change`. Brand link and toggle have no `aria-label` mismatch.

**Verdict: PASS.**

---

## Summary

| Site | Verdict | Round-1 findings fixed | New high | New med | New low |
|---|---|---|---|---|---|
| sakura-omakase | PASS | 9 / 9 | 0 | 0 | 2 |
| forno-rosso | CHANGES NEEDED | 13 / 13 | 0 | 1 | 2 |
| saffron-court | CHANGES NEEDED | 8 / 8 | 1 | 0 | 1 |
| maison-claire | PASS | 14 / 14 | 0 | 0 | 1 |
| blue-pearl | PASS | 8 / 8 | 0 | 0 | 3 |

All 52 round-1 findings are fixed in the code. Must fix before the demo:
1. **saffron-court N1 (high):** guard the re-queue in `loop()` (`scene.js:760`): `&& !st.raf`. Without it the adaptive step-down starts a second and third render loop on slow machines.
2. **forno-rosso N1 (med):** restore the dark focus halo on `.btn--primary` and `.skip` (`style.css`); the hero and nav "Reserve" buttons' focus ring is ~2.7:1 / 1.8:1 today.

Recommended (low, quick): use the bias-free FXAA patch on Sakura and Blue Pearl; stop Lenis re-starting under an open menu on Sakura; reword Maison's "Fish of the day"; observe `#main` instead of the fixed canvas for off-screen pausing on Saffron and Blue Pearl.
