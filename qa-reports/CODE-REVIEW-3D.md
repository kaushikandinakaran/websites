# Code review: 5 restaurant 3D sites (round 2)

Reviewer: studio code reviewer (read-only, static review; no server run, no site files edited).
Scope: `sites/sakura-omakase`, `sites/forno-rosso`, `sites/saffron-court`, `sites/blue-pearl`, `sites/maison-claire` (html, css, js incl. scene, world, food, petals, art, textures modules), checked against `showcase/BRIEF.md` and `showcase/BRIEF-3D.md`.
Severity: **high** = can freeze or break the page, or breaks a BRIEF rule outright. **med** = visible defect, rule risk, or real perf / a11y cost. **low** = polish or hardening.
Items marked *(verify)* come from reading the code or the three.js r160 source in `vendor/` and should be confirmed with one quick browser check.
Verdict rule (same as round 1): CHANGES NEEDED if any med or high finding exists, otherwise PASS.
Contrast ratios below were computed with the WCAG relative-luminance formula against the worst case (translucent panel over a pure-white canvas pixel), so they are conservative.

## Verdicts

| Site | Verdict | High | Med | Low |
|---|---|---|---|---|
| sakura-omakase | CHANGES NEEDED | 0 | 2 | 7 |
| forno-rosso | CHANGES NEEDED | 1 | 4 | 8 |
| saffron-court | CHANGES NEEDED | 0 | 2 | 6 |
| blue-pearl | CHANGES NEEDED | 0 | 2 | 6 |
| maison-claire | CHANGES NEEDED | 1 | 5 | 8 |

## What passed on all five sites (checked, no finding)

- No external or CDN requests, no Google Fonts, no `@import`: grep for `http(s)://` across html/css/js/svg returns only the `www.w3.org` SVG namespace. Maison's six woff2 files are local (`assets/`).
- No `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write`, `eval`, `new Function`, and no `target="_blank"` anywhere. The security checks (5) are clean.
- Footer line "Sample design by Website Studio" is present on every site.
- Landmarks (`header`, `nav`, `main`, `footer`), exactly one `<h1>`, canvas `aria-hidden="true"`, skip link to `#main`, `main` and every section `tabindex="-1"`, anchor handlers that scroll then `.focus({preventScroll:true})`.
- No JS selector references a missing element (checked each `$()`/`$$()` against the HTML).
- Prices, phone, address, hours, testimonial and booking link are all `[placeholders]`. No invented numbers, awards, named people, "since", or addresses.
- Reduced-motion path exists on every site (no Lenis, no scrub, still frames per station, all content visible, pause button hidden).
- Inline favicon data URI on every page (no 404). Own payload is far under 1.5 MB on all five (Maison is largest at about 280 KB including fonts).
- Lenis and ScrollTrigger are wired in the right order everywhere (`lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add`, `lagSmoothing(0)`), and `ScrollTrigger.refresh()` is called after the scene is ready and on load.
- Focus ring colours: gold-2 / orange / teal / white / gold on the dark panels all exceed 3:1 where the ring sits on the page background. Two-tone rings (dark halo plus light ring) are used on Sakura and Forno.

### Text contrast, worst case (translucent panel over a white canvas pixel)

| Site | Pair | Ratio |
|---|---|---|
| sakura | cream on scrim 80% / muted / gold / gold-2 | 9.9 / 7.1 / 6.1 / 8.1 |
| sakura | button text on vermilion (hover) | 4.99 (6.06) |
| forno | eyebrow terra-600 / em terra-500 on flour card | 5.43 / 4.80 |
| forno | white on terra-500 button | 5.06 |
| forno | night card: flour / lead / fire-300 / fire-200 | 14.0 / 11.1 / 7.4 / 9.8 |
| saffron | cream-2 / brass-2 / brass on arched panel | 8.8 / 8.6 / 5.6 |
| saffron | button text on saffron gradient | 8.2 to 12.8 |
| blue-pearl | pearl-dim / foam / coral-text on glass 88% | 8.7 / 9.4 / 6.6 |
| blue-pearl | coral-text on menu panel 82% | 5.38 |
| blue-pearl | coral button text (hover) | 6.49 (7.59) |
| maison | text / gold / muted on panel 86% | 10.6 / 6.7 / 7.0 |
| maison | menu card: body / secondary / wine / gold-deep on ivory | 15.0 / 8.1 / 8.8 / 5.4 |
| maison | ivory on wine button (hover) | 8.76 (6.99) |

Failures and near-misses are listed in the findings (Maison hero text, Saffron unscrimmed nav, Blue Pearl skip-link ring).

---

## 1. sakura-omakase: CHANGES NEEDED

Good: lazy `import()` with a `fail()` path, one `schedule()` guard so the loop can never double, `stop()` cancels the id, visibility and IntersectionObserver gating, debounced resize that also calls `composer.setPixelRatio`, `inert` on main and footer while the menu is open, constant pause label with `aria-pressed`, composer loaded on demand only for the desktop tier, instanced lanterns / bottles / trees / stools, one-draw GPU petals.

**S1. med. Environment map is lost after a WebGL context restore.** `world.js:48-65` bakes the lacquer reflections with `PMREMGenerator.fromScene()` into a GPU render target, and `scene.js:85` assigns it to `scene.environment`. After `webglcontextlost` / `webglcontextrestored` (`scene.js:200-201`) three.js re-creates the target empty and nothing re-renders it, so lacquer, gold and the clearcoat food lose all reflections and go dark. The restore handler only calls `resize()` and `schedule()`. Fix: keep the `PMREMGenerator`, and in `webglcontextrestored` rebuild with `scene.environment = makeEnvironment(renderer)` (dispose the old `rt.texture` first), then `schedule()`. Also toggle a class on lost/restored so the page shows a poster during loss (the other sites do).

**S2. med. Quality-tier detection sends every Safari and Firefox desktop to the low-mid tier.** `scene.js:50` `mem = navigator.deviceMemory || 4`, then `scene.js:52` `if (cores <= 4 || mem <= 4) return tier 1`. `deviceMemory` is undefined outside Chromium, so the fallback `4` always trips the check: no bloom, no composer, pixel ratio 1 on those browsers regardless of hardware. Fix: default to `8` (as Forno, Saffron, Blue Pearl and Maison already do): `navigator.deviceMemory || 8`.

**S3. low. Debug hooks ship.** `main.js:181` exposes `window.__sakura` when the URL contains `q=`; `scene.js:46-47` lets `?q=0|1|2` override the tier and lock it (disables adaptive quality); `scene.js:211-215` controller exposes `snap`, `info`, `state`. Fix: delete `main.js:181` and the `?q=` branch in `detectTier()` before delivery, or gate behind a build flag.

**S4. low. After the composer is dropped there is no anti-aliasing.** `scene.js:61` sets `antialias: tier > 0 && tier < 2`, which is false for tier 2 (it relies on the 4x MSAA render target). If `enableComposer()` fails (`scene.js:129` catch) or `degrade()` disposes the composer (`scene.js:189`), tier 2 renders straight to an aliased canvas. Fix: add an FXAA `ShaderPass` after `OutputPass` for tier 2 (the approach Maison uses) instead of MSAA on the render target, and create the renderer with `antialias: tier < 2`; then losing the composer degrades to a plain canvas render with native MSAA only if you also recreate the context, so the simplest robust option is to keep `antialias: true` on the canvas for every tier and drop the `samples: 4` target (the canvas MSAA is unused while the composer is active, but costs little on desktop).

**S5. low. `degrade()` leaks the bloom pass.** `scene.js:189` `composer.dispose()` disposes the two render targets and the copy pass only, not `UnrealBloomPass` (five mip targets plus materials). Fix: `bloom.dispose()` before nulling `composer`.

**S6. low. Per-frame allocations in the camera sampler.** `scene.js:40-42` creates eight arrow functions per frame (`(k) => k.pos[j]` and friends) and `scene.js:26-31` calls them repeatedly. Not visible in a 60 fps trace but easy GC pressure. Fix: precompute per-key arrays `posX[]`, `posY[]` and so on, and index them in `hermite()`.

**S7. low. Layout shift when the scene fails late.** With WebGL present, the page lays out at 150vh per station. If the dynamic import or `initScene` fails afterwards, `fail()` (`main.js:174`) adds `no-3d`, and `style.css:219-220` collapses every station to `min-height: 0`, jumping the scroll position. Fix: use the Forno approach (`gl-able` class set in the head probe and used for the tall layout), and remove it in `fail()` together with a `scrollTo` re-anchor, or keep station heights identical in both modes.

**S8. low. Draw calls and materials.** `food.js:140-205` builds about 200 un-merged meshes (sets A to G, hero board, tools) with `MeshPhysicalMaterial` clearcoat, and `world.js:82-90` uses clearcoat physical for the counter and roof on every tier including phones. Fix for phones: swap `lacquer`/`shu` to `MeshStandardMaterial` when `tier === 0`, and merge each static set-piece with `mergeGeometries` per material.

**S9. low (nit). Probe context is never released.** `index.html:16-17` creates a WebGL context just to test support and drops it without `WEBGL_lose_context`. Forno and Saffron release it. Add `var x=gl&&gl.getExtension('WEBGL_lose_context'); if(x)x.loseContext();`. Also: `style.css:146` `.station.is-short` is dead CSS.

---

## 2. forno-rosso: CHANGES NEEDED

Good: three-line probe with `loseContext`, `gl-able` / `gl` classes so posters swap without layout shift, poster layer for no-WebGL and for the load gap, `gl-lost` / `gl-restored` events toggling posters, correct MSAA only on the high tier, one-rAF `start()` guard plus `stop()` on a settled pause, cards that never depend on 3D, mood keys for a clear story, no PMREM (so context restore is safe: every texture is CPU-backed), `[tabindex=-1]:focus` outline removal.

**F1. high. Several seconds of main-thread freeze while procedural textures are generated, started immediately at page load.** `textures.js:106-154` `wall()` fills a 1536x1024 canvas pixel by pixel with `fbm(...)` (4 octaves, each `vnoise` allocating two closures, `textures.js:20-28`); `textures.js:174-192` `marble()` does the same at 1024x1024 with 5 octaves; `textures.js:195-213` `wood()` 512x256, `textures.js:58-72` `clayBump()` 256x256. That is about 4.4 million `fbm` evaluations (roughly 15+ million `vnoise` calls) inside `buildWorld()`, which `initScene()` runs synchronously (`scene.js:79`), and `main.js:172` calls `bootScene()` at module evaluation, i.e. before `load` and before the user can scroll or open the menu. Expect a multi-second freeze on a laptop and far worse on phones (the textures are the same size on the `low` tier). It also blocks the 4 s reveal timer. Two of those wall generations are wasted: `world.js:142` `const facTex = track(TX.wall())` is never used (`facMat` at `world.js:143` has no `map`). Fix, in order of payoff:
 1. Delete `world.js:142` (halves the cost of `wall()`).
 2. Generate `wall()` at 768x512 and `marble()` at 512x512 (sampled at 1.5x repeat they look the same) and 256x128 `wood()`; on `tier === 'low'` use half of that again.
 3. Rewrite `vnoise`/`fbm` without per-call closures (inline `m` and `g`, or precompute a 256x256 tileable noise `Float32Array` once and bilinear-sample it).
 4. Start `bootScene()` after `load` plus `requestIdleCallback` (as Saffron and Maison do), and build textures in chunks (`await new Promise(r => setTimeout(r))` between textures) so the page stays interactive while the poster is showing.

**F2. med. Pause button breaks WCAG 2.5.3 (Label in Name) when pressed, and contradicts the constant-label rule.** `index.html:44` has `aria-label="Pause motion"` and the visible text span is `aria-hidden="true"` (`index.html:47`); `main.js:77` rewrites the visible text to "Play motion" when pressed. The accessible name stays "Pause motion" while the visible label reads "Play motion". BRIEF-3D asks for a constant label with `aria-pressed` carrying state. Fix: delete `main.js:77`, drop `aria-label`, remove `aria-hidden` from the span so the button's name is its visible text "Pause motion".

**F3. med. In still mode (reduced motion) every scroll event renders a full composer frame.** `scene.js:160` `wake()` renders synchronously when `still`, and `scene.js:184` `setJ()` always calls `wake()`, even when `J` has not changed. `main.js:136`, `main.js:140` and `main.js:141-142` all call `feed()` per scroll tick (ScrollTrigger `onUpdate`, a raw `scroll` listener, and a ResizeObserver), and `feed()` calls `ctl.setJ(sceneJ)` every time. In reduce mode `sceneJ` is one of five constants, so a long scroll through one station repeats the identical render (bloom plus 2048 shadow map on high) dozens of times per second. Fix: in `setJ`, `if (still && J === target) return;` and `if (target === J) return` generally; in `main.js` remove the duplicate `scroll` listener at `:140` when `hasGsap` (and the `else` at `:137-139` is then the only raw listener).

**F4. med. The 4 s "show everything" safety is disabled as soon as main.js starts.** `index.html:20` only reveals if `js-ready` is absent, and `main.js:3` adds `js-ready` on the first line. Any exception later in the file (for example a null `$()` at `main.js:91`, `main.js:166`, or a Lenis error) leaves every `.card` at `opacity:0` for good (`style.css:119-120`). Blue Pearl does this correctly (adds `js-ready` after the setup). Fix: move `root.classList.add('js-ready')` to the end of `main.js` setup (after the IntersectionObserver block at `main.js:90`), or wrap the body in `try/finally` that adds `reveal-all` on error.

**F5. med. Layout jump if the scene fails after the page has laid out.** `.gl-able` makes stations 250vh / 270vh / 280vh / 230vh (`style.css:98-103`). `main.js:148-153` `fallback()` removes `gl-able`, collapsing the whole page to 100vh stations under the reader's scroll position. Fires on import failure, `initScene` returning null, or any exception in `bootScene`. Fix: on failure keep the tall layout (just show posters via a separate `no-gl` class), or capture `scrollY / scrollHeight` before removing `gl-able` and restore the proportional position after.

**F6. low. Debug hooks ship.** `main.js:13` `?nolenis`, `main.js:158` `?tier=` override (any string is accepted, so `?tier=foo` gives bloom without shadows), `main.js:166` `window.__forno` under `?debug`. Remove before delivery.

**F7. low. No anti-aliasing on low and mid tiers.** `scene.js:68` `antialias: tier !== 'low' && !useBloom` is false for all three tiers; only `high` gets MSAA (render target `samples: 4`, `scene.js:91`). Phones (`low`, no composer) and `mid` (`samples: 0`) render with hard edges. Fix: `antialias: !composer` for low, and add an FXAA pass (as Maison does) or `samples: 4` for mid.

**F8. low. Per-frame allocations.** `scene.js:108` `s.p.clone()`; `world.js:40-41` creates a closure and spreads a new object every frame in `moodAt`; `world.js:575` `new THREE.Color('#8a2a1c')` plus a string parse every frame; `world.js:623` computes an unused `tmpV`. Fix: reuse a scratch `Vector3`, return the shared `moodTmp` with fields added once, hoist the `Color`.

**F9. low. Renders behind the footer.** `scene.js:141-153` loops continuously while not paused and has no IntersectionObserver, so the full composer runs while the opaque footer covers the canvas (and BRIEF-3D asks to pause off-screen). Fix: observe `#journey` and `stop()` when it leaves the viewport.

**F10. low. Duplicate scroll plumbing.** `main.js:136` (ScrollTrigger) and `main.js:140` (raw listener) both feed; see F3. `main.js:141-142` also run `measure()` and `feed()` on every ResizeObserver tick and resize without debouncing (`getBoundingClientRect` for five stations each time).

**F11. low. Menu open does not inert the page.** `main.js:32-38` sets `overflow:hidden` and traps Tab (`main.js:40-49`, brand and pause button are outside the cycle), but main and footer stay in the accessibility tree behind the open menu. Fix: `main.inert = footer.inert = open && mobileMq.matches` as Sakura does.

**F12. low. Programmatic focus draws a box-shadow.** `style.css:38` removes the outline on `[tabindex="-1"]:focus`, but `style.css:41` `:focus-visible` also sets `box-shadow: 0 0 0 2px var(--night)` and `border-radius: inherit`. After a keyboard-activated anchor click the target `section` or `main` matches `:focus-visible` and gets a 2 px dark shadow around the whole section (visible as a line at the section edges). Fix: `[tabindex="-1"]:focus, [tabindex="-1"]:focus-visible { outline: none; box-shadow: none; }`.

**F13. low. Wording that reads as a freshness claim.** `index.html:179` heading "Fresh from the oven." and `index.html:189` "fresh herbs"; BRIEF lists "fresh daily" as a banned commercial claim and "Dessert of the day" (`:197`) implies a daily offer. Reword to "Straight from the oven." / "herbs" / "Dessert".

Note (verified, no finding): `EffectComposer` in this vendor build keeps `_pixelRatio = renderer.getPixelRatio()`, so Forno's `composer.setSize(W, H)` at `scene.js:97` correctly produces a pixel-ratio-scaled target. Context restore is safe because no GPU-generated textures are used.

---

## 3. saffron-court: CHANGES NEEDED

Good: best layout discipline of the five (stations never change size, posters are absolutely positioned and just `display:none` once `is3d`, so no layout shift in any mode), scratch vectors everywhere (no per-frame allocations found in `updateWorld`, `updateCamera`, `samplePath`), a single `loop()` that always re-queues exactly one id, `kick()` for on-demand still frames, sky/point-sprite shaders with `uMaxPx` clamps, density scaling of every particle system, adaptive pixel-ratio then bloom shedding, procedural art drawn as vector canvases (no per-pixel loops, fast startup), scene built after `load` so it never competes with first paint, brand `aria-label` contains its visible text, constant pause label (`main.js` never changes the text), reveals are transform-only so text is never transparent, `#booking` is a real `tabindex=-1` target instead of a dead `href="#"`.

**C1. med. Debug globals and test hooks ship unconditionally.** `main.js:179` `window.__saffron = ctl` (every visitor), `main.js:184` `window.__saffronError`, `main.js:159,165` `?q=` quality lock (disables the adaptive guard) and `?scene=off`. `scene.js:783-786` adds `info`, `stats()`, `loseContextForTest()`, `restoreContextForTest()` to the controller, and `scene.js:94` keeps a `WEBGL_lose_context` handle just for them. Anyone can kill the page's WebGL context from the console. Fix: remove `main.js:179,184`, the test methods and `loseExt`, and the `?q=` / `?scene=` branches (or wrap in `if (location.hostname === 'localhost')`).

**C2. med. Environment map is lost after a context restore.** `scene.js:105-119` creates the brass reflection map with `PMREMGenerator.fromScene()` once; `scene.js:763-768` `webglcontextrestored` only calls `resize()` and restarts the loop. After a restore the PMREM target is empty, so every `MeshStandardMaterial` with `metalness: 1` (brass bowls, gate trim, tandoor rings, skewers, thali tray) renders almost black. Fix: wrap the env build in a function (as Maison does at `maison-claire/scene.js:129-146,706-709`), call it again on restore, set `scene.environment`, and dispose the old target.

**C3. low. Composer is first built at pixel-ratio squared.** `scene.js:608` calls `buildComposer(w * pr, h * pr)`; in this r160 `EffectComposer`, `_width` becomes the target width (`w*pr`) and `addPass()` sizes each pass at `_width * _pixelRatio` (`pr` is already set on the renderer at `scene.js:603`), so the bloom passes allocate at about `pr^2` until the first window resize calls `composer.setSize` (`scene.js:608` else-branch). At pr 1.5 that is 2.25x per axis for the bloom mip chain on every retina desktop. *(verify)* Fix: `buildComposer(w, h)` then immediately `composer.setPixelRatio(pr); composer.setSize(w, h);`.

**C4. low. Adaptive path leaks and idle loop.** `scene.js:734` `composer.passes.splice(1, 1)` removes the bloom pass without `bloom.dispose()`. `scene.js:741-746` `loop` keeps requesting frames forever even when `paused` and nothing changes (cheap, but it is a permanent 60 Hz wake-up; Maison stops its loop when settled).

**C5. low. Unscrimmed header over the canvas at the top of the page.** `style.css:84-88` the nav has no background until `scrollY > 24` (`main.js:29`), so brand, links and the pause button sit directly on the canvas in the hero; the pause button has only a 60% dark fill (`style.css:102`). Worst case (bright saffron glow behind): `cream-2` on the bare canvas is 1.4:1, pause button label 3.4:1 over a white pixel, 5.4:1 over orange. The gate scene is mostly dark sky at that spot, so this probably passes in practice *(verify at 1440x900 and 390x844 by sampling the canvas behind the nav)*. Fix: give `.nav` a permanent 55-60% dark gradient like Maison's `.nav::before`.

**C6. low. Scroll handler interleaves a write between layout reads.** `main.js:115` writes `railFill.style.transform` and then `main.js:117,121` call `getBoundingClientRect` for the menu and each step, forcing a style recalculation on every scroll tick. Fix: do all reads first (stations, menu, steps), then write.

**C7. low. Lights on phones.** `scene.js:134-139` always creates one hemisphere, one directional and five point lights; the mobile / low path only scales particle counts (`density`), so phones still run five-point-light `MeshStandardMaterial` fragments on every wall plane. Fix: skip `gateLight`, `orbitLight` and `thaliLight` when `density < 1`, and bake wall emissive instead.

**C8. low. No inert and no focus return into the menu.** `main.js:33-50` traps Tab but main and footer remain reachable by screen-reader navigation while the mobile menu is open; add `inert` on `#main` and `.footer`.

---

## 4. blue-pearl: CHANGES NEEDED

Good: `js-ready` is added after setup so the 4 s fallback truly covers a crashed script; `inert` on main, footer and rail while the menu is open; focus trap in true visual order using `getClientRects()` (not `offsetParent`); posters cross-fade per station and double as the loading and no-WebGL state with no layout dependency; `preserveDrawingBuffer` only in still mode; one rAF chain with `running` guard; zero per-frame allocations (scratch colours and vectors, `getPoint(t, target)`); instanced bubbles, shells, kelp, fish; shared uniform objects; `onLost` / `onRestored` toggle `scene-on` so posters return during context loss; `disposeTree` also calls `InstancedMesh.dispose()`.

**B1. med. Environment map is lost after a context restore.** `scene.js:65-68` bakes `RoomEnvironment` through PMREM once. `scene.js:245` `restored()` only resizes and syncs. After a restore the nacre (iridescent `MeshPhysicalMaterial`), the pearl (`envMapIntensity: 1.6`) and all glossy shells lose their reflections, which is the hero moment of the page. Fix: wrap lines 65-68 in a function, rebuild in `restored()`, assign `scene.environment`, dispose the old texture. Also dispose the `RoomEnvironment` instance (`scene.js:66` creates it inline and never disposes it).

**B2. med. Shader cost: procedural caustics on every lit surface, on every tier.** `world.js:48-61` `causticLines()` has four `sin` calls, two nested `sin`s, two `abs` and a power chain, and `caustic()` calls it twice per fragment (about 16 transcendental ops). `withCaustics()` (`world.js:63-110`) injects that into the seabed (a full-screen surface for the last three stations, `world.js:421`), oysters, scallops, spirals, coral, rocks, kelp, the hero oyster, and, with `strength 0`, still the fish (the code runs and multiplies by zero, `world.js:739`). Phones (`tier 'low'`) get the identical fragment shader. In addition `makeShafts` (`world.js:212-229`) draws up to ten very large additive double-sided planes (60 to 84 units tall) that overdraw most of the screen on high. Together with 4x MSAA HalfFloat, bloom, 460 bubbles, 620 snow points and clearcoat+iridescence on the hero, this is the heaviest fragment budget of the five. Fix: (a) bake caustics into one tileable 256x256 `CanvasTexture` / `DataTexture` and sample it with two scrolling lookups; (b) skip the caustic injection when `tier === 'low'` and use one `causticLines` call on `mid`; (c) for `strength: 0` materials (fish) do not call `withCaustics` at all; (d) cap shafts at 3 on low (already) and 3 on mid, and give them `depthTest: true` against a lower alpha to cut overdraw.

**B3. low. Camera lags the scroll through three stacked smoothers.** `main.js:156` ScrollTrigger `scrub: 0.7`, then `scene.js:211` damping `1 - exp(-dt * 6)`, on top of Lenis `lerp: 0.09`. The camera trails the scrollbar by roughly one second, which feels sluggish when jumping with the nav. BRIEF-3D asks for damping; one smoother is enough. Fix: `scrub: true` and keep the scene damping, or keep the scrub and lerp `cur.s` faster.

**B4. low. Debug and profiling hooks ship.** `scene.js:93-96` `?off=shafts,garden,...,bloom,msaa` (plus a no-op `if (off.includes('msaa')) {}` at `:96`), `scene.js:147-149` `?cam=x,y,z,lx,ly,lz` free camera, `main.js:118-119` `?q=`, `main.js:180` `?webgl=off`, `main.js:184` `?noadapt`, `main.js:196` `window.__bp` and `main.js:198` `console.warn`, both under `?debug`. Remove before delivery (`?cam=` and `?off=` are the ones a client could stumble on).

**B5. low. Anti-aliasing and composer lifetime.** `scene.js:49` `antialias: isLow` and `scene.js:103` `samples: isMid ? 0 : 4`: the `mid` tier has no AA at all. When adaptive quality sets `bloomOn = false` (`scene.js:220`) the page switches to a direct canvas render with `antialias:false` (aliased, and the look changes), while the 4x MSAA HalfFloat composer targets and bloom mips stay allocated. Fix: add an FXAA pass (as Maison) on mid, and on `bloomOn = false` dispose `composer`/`bloom` and set `composer = null`.

**B6. low. Skip-link focus ring is below 3:1 over the bright surface scene.** `style.css:47` ring is white, `style.css:50-55` the skip link has no halo. At the top of the page the canvas behind it is `#2fa9b0` fog (2.8:1) and the dome up to `#62d4cf` (1.8:1). Nav links and buttons are fine (dark pill, or the dark `box-shadow` at `style.css:48`). Fix: add `box-shadow: 0 0 0 3px var(--abyss)` to `.skip:focus-visible`.

**B7. low. Wording that implies freshness or sourcing.** `index.html:199` "Varieties changing with the day", `index.html:192` "From the seabed to your table", `index.html:179` "Shells opened to order". BRIEF forbids commercial claims such as "fresh daily"; the page already says real details come from the restaurant. Reword to neutral descriptions ("A selection of varieties", "Seafood from the sea").

**B8. low (nits).** `main.js:179` probe context never released (`WEBGL_lose_context`). `main.js:180,188,199` add a `no-3d` class that has no CSS rule. The `rebuildTimer` in `main.js:171-175` rebuilds the whole GSAP timeline on every resize tick including mobile URL-bar show/hide; also `buildScroll()` runs up to four times at startup (`:192`, `:194`, `:195`, plus resize), each time killing and recreating the ScrollTrigger (correctly, but wastefully).

---

## 5. maison-claire: CHANGES NEEDED

Good: this is the most carefully engineered scene of the five. Everything below was read line by line.
- The on-demand render loop restarts correctly after scroll (`setState`), resize, pointer, `setPaused(false)`, tab visibility, IntersectionObserver and context restore (`resize()` calls `wake()`); in reduced motion `frame()` draws once and never re-queues, and every `setState` draws exactly one new still. It stops itself when paused and settled.
- Context restore rebuilds the PMREM environment and re-applies it to every tracked material (`scene.js:706-713`); nothing else in the batch does this.
- The FXAA patch is correct: the vendor `FXAAShader.js:93-94` contains exactly two `-100.0` literals, and the regex `/-100\.0/g` replaces both. The ShaderPass clones the uniforms, and `resolution` is set from `W*pr`, `H*pr` (`scene.js:541`). AA after tone mapping is the right order.
- The warm-up frame is safe: it forces `cloche, dish, bottleRoot, wineBody, meniscus, stream, steam` visible, draws twice, and `updateScene()` immediately restores all six (cloche, dish, bottleRoot, `setWine` for wineBody and meniscus, stream, steam). The canvas is at `opacity:0` until `is-3d`, so the all-visible frame is never seen.
- No per-frame allocations (scratch `_away`, `_pour`, `_p`, `camPos`), tier split (phone / coarse / low-CPU get no composer, no shadows, `antialias:true`, pixel ratio 1), addons loaded sequentially and only for the high tier, shaders and textures are small (no per-pixel loops), brand link name equals its visible text, `scrollcue` aria-label starts with its visible text, menu card text is 5.4:1 or better, local OFL fonts preloaded with `crossorigin`.

**M1. high. The render loop doubles (and can multiply without limit) after the first `degrade()`.** `scene.js:662-686` `frame()` sets `raf = 0` at the top. If the adaptive block runs `degrade()` (`scene.js:681-683`), it calls `resize()` (`scene.js:691`), which ends in `wake()` (`scene.js:544`). `wake()` checks `if (raf || !canRun()) return;`, but `raf` is 0 at that moment, so it queues a frame. A few lines later `frame()` ends with `raf = requestAnimationFrame(frame)` (`scene.js:685`) with no guard, overwriting the id. From then on two `frame` callbacks run on every vsync, and `stop()` can cancel only the latest id. Because `frames` and `slow` are shared, the doubled loop makes the machine slower, `slow > 55` triggers again after 90 frames, and `degrade()` keeps firing (once `pr` has reached 1 it only disables shadows and re-runs `resize()`), adding another loop each time. This happens exactly on the slow GPUs the guard exists for, and compounds until the tab stalls (loops only die when `canRun()` goes false, e.g. hidden tab). Fix: guard the re-queue: `if (!reduce && (!paused || !settled() || intro > 0) && !raf) raf = requestAnimationFrame(frame);`. Also make `degrade()` idempotent: return early when `pr <= 1 && !bloom && !renderer.shadowMap.enabled`, and reset `guard = false` after the final stage.

**M2. med. Layout shift when the 3D scene arrives, and again when it is lost.** `style.css:165-173` makes every station 150vh to 190vh and `.station__stick` sticky only when `html.is-3d` is present, but `is-3d` is added after fonts, `load`, +60 ms, the module burst and the first compile (`main.js:231`), long after first paint. The page jumps from ~100svh stations to ~190svh stations under the reader (the code compensates only for a URL hash, `main.js:240`). `onLost` (`main.js:226`) removes the class again, collapsing the page mid-scroll; `onRestored` re-expands it. Fix: add a `gl-able` class in a head probe (Forno pattern, release the probe with `loseContext`) and apply the tall layout to `.gl-able` from first paint; keep the same layout during context loss and only toggle posters with a separate `.gl-lost` class. If WebGL fails after the probe passes, re-measure and restore the scroll proportion.

**M3. med. Hero text relies on a scrim that fades out under the text at tablet and laptop widths.** `style.css:158` is a left-to-right gradient: 0.90 at 0%, 0.72 at 34%, 0 at 62%; the hero has no panel, only text-shadow (`style.css:154-157`). `.hero` is up to 640 px wide (`style.css:153`). Computed ratios for `#f1eadb` text: 12.7:1 at alpha 0.90 and 6.6:1 at 0.72 on a white pixel, but 3.0:1 at 0.50, 1.7:1 at 0.31, and about 1.1 to 1.2:1 at 0 on a white or ivory pixel (2.3:1 at alpha 0.31 on the `#e9dcc2` cloth). The gold kicker is already 4.2:1 at the 0.72 plateau (below 4.5). At 1440 the lede ends at about 49% (alpha about 0.34); at 1024x768 the 640 px column ends at 67% and the lede at about 61%, which is exactly where the table (`sx: 0.26`, centre at about 76%, edge near 51%) enters the frame, with alpha at or near 0. So lede and kicker can sit on bright ivory cloth. *(verify with a canvas pixel sample at 1024x768 and 1366x768; hero on a laptop is the first thing the client sees.)* Fix: give the hero the same panel treatment as the other stations (`rgba(18,17,16,.86)` plus blur), or extend the gradient (`.9` to 55%, `0` at 85%) and raise the kicker to `--gold-2`.

**M4. med. `pagehide` disposes the scene even when the page is going into the back/forward cache.** `scene.js:739` `window.addEventListener('pagehide', dispose, { once: true })`. `dispose()` (`scene.js:727-738`) stops the loop, disconnects the IntersectionObserver, removes the visibility, resize and context listeners, and calls `renderer.dispose()`. When the user navigates away and presses Back, Chrome / Safari restore the page from bfcache with `is-3d` still set, `ctl` still referenced by `main.js`, and a scene that never wakes: the last frame stays frozen and scrolling no longer moves the camera. Fix: `window.addEventListener('pagehide', (e) => { if (!e.persisted) dispose(); });` and, for the persisted case, `pageshow` with `e.persisted` should call `wake()`.

**M5. med. Global debug handle ships, plus a quality override.** `scene.js:741` `window.__mc = { renderer, scene, camera, cur, tgt, tier }` is set for every visitor ("handy for QA, harmless" per the comment). Also `scene.js:99-106` `?q=high|low` overrides the tier and disables the adaptive guard. Remove both before delivery.

**M6. med. No licence or credit file for the fonts.** `assets/` contains six woff2 files (Cormorant Garamond 400/500 normal and italic, Jost 400/500) and five SVG posters but no `CREDITS.txt` / licence text, unlike `ember-table/assets/CREDITS.txt`. BRIEF asks for a note for anything saved locally; both families are distributed under the SIL Open Font License 1.1 (as far as I know; the repo does not record where the files came from: `showcase/package.json` has no `@fontsource` dependency), and the OFL requires the copyright notice and licence text to accompany redistributed font files. Fix: add `assets/CREDITS.txt` naming each family, its version and download source, and include the OFL text (`assets/OFL.txt`); also state that the posters are original SVG.

**M7. low. The module-import retry cannot loop and cannot hide content, but it has gaps.** Reading `main.js:207-241`:
 - Loop: the flag `mc-retry` is written before `location.reload()` and removed only after a successful import; a second failure falls through to `throw err`, so at most one reload per tab session. If `sessionStorage` throws, `again` is false and there is no reload. After a failed second attempt the flag stays set, so later loads in that tab never retry (acceptable).
 - Content: the HTML, posters and reveals are independent of the scene, and the reload happens after `load`, so content is never blocked. What the visitor does see is a visible reload, the hero `gsap.from` replaying (hero items are at `opacity:0` for the first 0.2 s), and loss of any state: an open mobile menu, the scroll position (Lenis), and the "Pause motion" choice (`main.js:156-164`, WCAG 2.2.2 preference silently reset).
 - Gap: only `import('./scene.js')` is retried. The flaky step the comment describes (a burst of module requests) includes the eight sequential addon imports inside `loadAddons()` (`scene.js:7-17`), which run later inside `initScene()` (`main.js:224`); a failure there goes straight to the empty `catch` at `main.js:241` with no retry. Fix: retry inside `loadAddons()` (try once more after a short delay) instead of reloading the page, and keep the reload as the last resort only before first user interaction.

**M8. low. FXAA bias.** The patch removes the console warning for `-100`, but `-16.0` is still at or beyond `MAX_TEXTURE_LOD_BIAS` on some ANGLE / D3D11 drivers (about 15.99), where the driver clamps again. The composer render targets have no mipmaps, so the bias does nothing. Fix: replace both `texture2D(t, p, -100.0)` calls with plain `texture2D(t, p)`: `FXAAShader.fragmentShader.replace(/,\s*-100\.0\)/g, ')')`. *(verify no warning on an NVIDIA/D3D11 machine)*

**M9. low. Context restore leaks.** `scene.js:708-710` assigns a new `envTex` and calls `makeComposer()` without disposing the previous `envTex`, `composer`, `bloom`, or `fxaa` (their GPU objects are gone, but the JS-side `WebGLRenderTarget`/material objects and three's registries stay alive).

**M10. low. `degrade()` repeats forever on a 60 Hz screen that is merely slow.** `scene.js:681-684` keeps counting; once `pr <= 1` and shadows are off, every further 90 slow frames re-runs `resize()` and sets `bloom.strength = 0.3`. Stop the guard after the last stage.

**M11. low. Pointer parallax keeps moving while motion is paused.** `scene.js:673` copies `pointer` into `pointerCur` instantly when paused (instead of freezing it), and `settled()` (`scene.js:657-661`) treats pointer movement as work, so the loop still re-renders on mouse move. Fine for scroll-driven camera, but for WCAG 2.2.2 stop pointer-driven drift too (`if (paused) { /* leave pointerCur as is */ }`).

**M12. low. Magnetic buttons write inline transforms and every button has a permanent compositor layer.** `main.js:188-198` sets `style.transform` on pointermove (not removed when motion is paused mid-hover), and `style.css:127` `will-change: transform` on `.btn` promotes every button for the page's lifetime. Fix: remove `will-change`, and add `pointerleave` plus a `motion-off` check that clears the transform.

**M13. low. Menu open does not inert main and footer** (`main.js:41-58`; Tab trap only). Add `inert` as in Sakura and Blue Pearl. Also the WebGL probe at `main.js:201-206` never releases its context.

**M14. low. Nits.** `scene.js:654` `ctlPaused` is unused. The `scrollToTarget` at `main.js:240` handles a hash on load only after the scene is ready, so a deep link jumps once on first paint and again after `is-3d` (see M2).

---

## Cross-site notes

- **Context restore.** Maison rebuilds its environment; Sakura (S1), Saffron (C2) and Blue Pearl (B1) do not, so after a restore their metals and glass go dark. Forno has no PMREM and is safe. The same three-line fix applies to all.
- **Debug hooks.** Gated behind a query flag: Sakura (`?q=`), Forno (`?debug`, `?tier=`, `?nolenis`), Blue Pearl (`?debug`, `?cam=`, `?off=`, `?q=`, `?noadapt`, `?webgl=off`). Unconditional: Saffron `window.__saffron` plus test methods, Maison `window.__mc`. Strip all of them before the client sees the pages; the unconditional ones first.
- **Quality tiers.** Defaults for missing `deviceMemory` are right (8) on Forno, Saffron, Blue Pearl and Maison, wrong on Sakura (S2). Pixel ratio caps follow the brief (desktop 1.5, phone 1.0) everywhere. Shadow maps are only on high tiers (Forno 2048 directional, Maison 2048 spot). Bloom is desktop-only everywhere.
- **Anti-aliasing is the common weak spot:** Forno low/mid (F7), Blue Pearl mid and after adaptive shedding (B5), Sakura tier 2 after the composer is dropped (S4). Maison's FXAA-after-OutputPass approach is the model to copy.
- **Per-frame allocations:** none worth fixing in Saffron, Blue Pearl, Maison. Minor in Sakura (S6) and Forno (F8).
- **Startup cost:** Only Forno (F1) generates large per-pixel textures. Sakura's wood/stone/shoji canvases are small and drawn with 2D strokes; Saffron, Blue Pearl and Maison have no heavy startup work.
- **rAF loop safety:** Sakura, Forno, Saffron and Blue Pearl all re-queue through a guarded path, so they cannot double. Maison (M1) is the only unguarded re-queue and must be fixed first. Forno and Saffron keep rendering (or idling) when the canvas is covered by the footer; Sakura, Blue Pearl and Maison pause on IntersectionObserver.
- **Layout shift on scene arrival or failure:** none on Saffron and Blue Pearl; Sakura and Forno shift only on failure (S7, F5); Maison shifts on success (M2).
