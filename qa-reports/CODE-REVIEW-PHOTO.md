# Code review: 5 restaurant sites on real 360° photographs (round 4, BRIEF-PHOTO)

Reviewer: studio code reviewer (independent, read-only static review; no server or browser run, no site files edited).
Date: 2026-11-04.
Input: `showcase/BRIEF-PHOTO.md`, `BRIEF-3D-REAL.md`, `BRIEF-3D.md`, `BRIEF.md`, `qa/CODE-REVIEW-REAL.md`, `qa/CODE-REVIEW-3D-R2.md`.
Sites: `sites/himal-chulo-photo`, `sites/ember-and-oak-photo`, `sites/flour-and-fig-photo`, `sites/olive-and-sea-photo`, `sites/jade-teahouse-photo`.
Severity: **high** = can freeze/break the page or breaks a BRIEF rule outright; **med** = visible defect, rule risk, real perf/a11y cost; **low** = polish/hardening.
Verdict rule: CHANGES NEEDED if any med or high finding is open, otherwise PASS.

Sections are appended site by site as each review finishes (summary at the end).

---

## 1. himal-chulo-photo — CHANGES NEEDED

Files: `index.html`, `style.css`, `main.js`, `scene.js`, `assets/CREDITS.txt` (panoramas, models and the 1k HDRs are shared from `showcase/assets/polyhaven/`; only the two baked env files live in `assets/`).

### Checked and OK
- **Render loop:** `frame()` clears `raf` first (`scene.js:838`), re-queue guarded `if (!raf && !reduce && (!paused || moving))` (`:853`), `wake()` guarded by `raf || !canRun() || !ready` (`:861`). `degrade()` reaches `guard = false` (`:858`). Paused and settled = zero callbacks; `clock`, flag wind, steam, fire flicker and handheld drift all freeze (`:845`, `:752`). Reduced motion: one frame per `wake()`, `uCur = uTgt` (`:841`).
- **Pause in `main.js`:** destroys Lenis, `gsap.ticker.sleep()`, `ScrollTrigger.disable(false)`; resume re-enables every trigger and rebuilds Lenis; `startLenis()` re-stops Lenis if the menu is open (`main.js:44`, `:179-190`). Under reduced motion ScrollTrigger is disabled and the ticker slept at start (`main.js:11-13`). Camera fed by a plain `scroll` listener.
- **Off-screen pause** observes `#main` (`main.js:209`, `scene.js:868-869`).
- **Context loss/restore:** `preventDefault` (`:872`); restore forgets the shadow map (`key.shadow.map = null`, not disposed), resets `shadowU`, resizes, then `onRestored` re-adds `is-3d` (`:873-882`). Panoramas are `ImageBitmap`s kept on the texture, env maps are RGBE `DataTexture`s, canvases are kept, so three re-uploads them on the next draw. No composer/render targets exist. No `gl-lost` class (poster swap is `is-3d` only, no layout change).
- **Panorama lifecycle:** decoded off the main thread with `ImageBitmapLoader` (`:178-192`; Safari falls back to `TextureLoader`); A is uploaded with `initTexture` while the loader is still shown (`:906`); exactly two panoramas, both stay resident (needed for scroll-back). Size cap: `8k` only when `tier === 2 && maxTextureSize >= 8192`, every other tier gets 4k (`:170`): no texture above 4096 on phones.
- **Seam / mip:** sphere UVs (no per-pixel `atan`), so no derivative seam; `RepeatWrapping` on S, `ClampToEdge` on T; bias through `texture2D(map, uv, uBlur)` (`:100-102`). The photo shader has no `tonemapping_fragment`, so the photo is graded once and never tone-mapped; props are ACES once. No post pass.
- **Env files:** valid RGBE (`#?RADIANCE`, `-Y 512 +X 384` = CubeUV layout for cube size 128), `CubeUVReflectionMapping`, one per panorama, A on the arrival flags, B on every room material (`:896-926`).
- **Film grain / vignette** are CSS (`style.css:62-74`); the grain animation stops under `html.motion-off` and `html.rm` (`:74`) and under the global reduced-motion rule.
- **No per-frame allocations** in `applyCamera`/`updateScene`/`draw` (scratch `_p,_q,...` `:775`). No `window.__*`, `console.*`, `location.search`, `innerHTML`, `target=_blank`, workers or external URLs in any file.
- **Bytes really requested** (computed from the glTF JSON after the code's map deletions): desktop tier 2 = panoramas 3.66 + 5.94 + env 0.89 + models 8.81 (table 0.49, diya 2.51, limes 0.45, plate 1.56, pot 1.52, tea set 2.28) = **19.3 MB** + ~0.8 MB vendor JS = about 20.1 MB (on budget). First station about 3.66 + 0.45 + vendor = 4.9 MB (< 6). Phone tier 0 = 0.96 + 1.48 + 0.89 + models 3.54 (no normal/ARM maps, no plate/pot) = **6.9 MB** + vendor = about 7.8 MB (< 8).
- **CREDITS:** both panoramas and all six models requested by the code are credited; nothing credited is unused; no large unused files in `assets/`.
- **Copy and rules:** footer "Sample design by Website Studio" and "The photographs show sample places, not the restaurant"; no venue named in meta/alt/credits. Menu flagged "Illustrative sample", all prices `[Price]`, contact/hours/testimonial placeholders, no `mailto:`/`href="#"`.
- **Accessibility:** one `h1`; header/nav/main/footer landmarks; `.stage` `aria-hidden`; skip link to `#main` (`tabindex=-1`), sections `tabindex=-1`, focus moved after the scroll (`main.js:100-113`); pause button constant text, `aria-pressed`, no `aria-label`, text visually hidden only under 960 px; menu `inert` cleared on Escape, link click and breakpoint change; menu has `max-height` + `overflow-y:auto` + `data-lenis-prevent` (320x256 OK); no sticky/pinned panels, so the forno-rosso short-screen failure cannot occur. Focus ring `#ffd58a` on `rgba(10,6,4,.95)` = about 14:1; skip link ring `#120d0a` on cream about 16:1 plus a `#ffd58a` outer halo.

### Findings

**1. med — Props are compiled for the wrong light set, so the first scroll into the room recompiles every prop shader (multi-second hitch on Windows/ANGLE).** `scene.js:432-435` puts `key` (shadow-casting spot), `fireL` and `diyaL` inside `roomG`, and `applyCamera()` toggles `roomG.visible = bReady && mix > 0.001` every frame (`:769`). `compileAsync` collects lights with `traverseVisible`, so `place()` → `compileFor(g)` (`:945`) compiles the table, diya, limes, plate, pot and tea set while the visitor is still at the arrival (u < 0.3, `roomG` hidden): their programs are built for {sun, hemisphere} only. The first frame with `roomG` visible changes the light-state hash and three recompiles all of them synchronously in the middle of the dissolve. The flag/garland materials (compiled in phase A without room lights, `:910`) recompile too, because both groups are visible during the dissolve. Fix: keep the light count constant. Move `key`, `key.target`, `fireL`, `diyaL` out of `roomG` into `scene` and fade them by intensity (`key.intensity = 5.5 * mix`, `fireL.intensity *= mix` in `updateScene`); a light at intensity 0 still counts, so every program is compiled once for the final light set. (Alternative: `roomG.visible = true` immediately before each `compileFor()` and restore it after.)

**2. med — The phase-B panorama upload is one long main-thread task while the page is live.** `scene.js:923` `renderer.initTexture(texB)` uploads the whole 8192x4096 restaurant photograph (128 MB RGBA plus mip chain) in one `texImage2D` + `generateMipmap`, while the visitor is already scrolling station 1. Typically 300-900 ms on the dev GPU; the brief caps tasks at about 400 ms and asks for strip-wise upload. Fix: allocate the target once (`const t = new THREE.DataTexture(null, w, h); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; renderer.initTexture(t);`), then copy the bitmap in strips, one per task: `for (let y = 0; y < h; y += 512) { const s = await createImageBitmap(bmp, 0, y, w, 512); renderer.copyTextureToTexture(new THREE.Vector2(0, y), new THREE.Texture(s), t); s.close(); await tick(0); }` (row origin depends on the flip used), then switch to mipmapped filtering and call `generateMipmap` in a last task. At minimum run the upload from `requestIdleCallback` when the visitor is not scrolling.

**3. low — The dusk "sun" also lights the restaurant props.** `sun` (DirectionalLight 2.2, warm) and `skyFill` are added to `scene` (`:411-415`) and never dimmed, so in the room the table, brass and tea set get a second hard key from the arrival's sun direction (`dirU(0.6, 4)`), which the restaurant photograph does not have. Fix: in `updateScene`, `sun.intensity = 2.2 * (1 - mix); skyFill.intensity = 0.12 * (1 - mix);` (keeps the light count constant, see finding 1).

**4. low — After a context restore the panorama re-upload and every shader compile run in the first frame.** `onRestored` (`:873-882`) calls `wake()` at once, so the first restored frame re-uploads the 8k photographs and compiles all programs in one task. Fix: in `onRestored`, `renderer.initTexture(panoMat.uniforms.mapA.value); await tick(0); renderer.initTexture(panoMat.uniforms.mapB.value); await tick(0); await compileFor(scene);` before `opts.onRestored()` and `wake()` (poster stays up meanwhile).

**5. low — No `scroll-padding` on the scrollable phone menu.** `style.css:261-269` makes `.nav__menu` scroll on short screens but, unlike `sakura-omakase`/`maison-claire`/`saffron-court`/`blue-pearl` (`.nav__menu { scroll-padding-top: ...; scroll-padding-bottom: 12px; }`), tabbing to the last links at 320x256 can leave the focus ring flush against the menu's bottom edge. Fix: add `scroll-padding-block: 12px;` to `.nav__menu` in the 960 px query, and `html { scroll-padding-top: calc(var(--nav-h) + 8px); }` so tabbing to panel/footer links never parks them under the sticky header.

**6. low (nit) — CSS `filter` on the full-screen WebGL canvas.** `style.css:60` `filter: saturate(0.86) contrast(1.03)` costs an extra full-screen compositor pass every frame. Fold it into the photo grade (`gradeA/gradeB` already carry saturation) and the props' exposure.

**Verdict: CHANGES NEEDED** (findings 1 and 2, med).

---

## 2. ember-and-oak-photo — CHANGES NEEDED

Files: `index.html`, `style.css`, `main.js`, `scene.js`, `assets/CREDITS.txt`, `assets/cellar_{3k,6k}.jpg`, `assets/m/*_512.jpg`, three `env-*-pmrem128.hdr`, five `poster-*.svg`.

### Checked and OK
- **Render loop:** `frame()` clears `raf` first (`scene.js:445`), re-queue guarded `if (!raf && !reduce && (!paused || !settled()))` (`:458`), `wake()` guarded (`:465`), `degrade()` ends with `guard = false` (`:462`). Pause copies `pointer` into `pointerCur` (`:643`) and stops the clock, so fire flicker, photo-flame warp and grain freeze. Pointer parallax ignores input while paused or under reduced motion (`:336`).
- **Pause/resume in `main.js`:** `finishReveals()`, Lenis destroyed, ticker slept, `ScrollTrigger.disable(false)`; resume re-enables every trigger and restarts Lenis, which re-stops itself if the menu is open (`main.js:36`, `:176-189`). Reduced motion: no Lenis, no tweens, ticker and ScrollTrigger slept on `load` (`:224-225`); still frames through `setStill` (`scene.js:635-642`).
- **Off-screen pause** observes `#journey` inside `main` (`scene.js:471-472`).
- **Context loss:** `preventDefault` (`:126`), loop stops, `is-3d` removed. Restore bumps `gen`, forgets (does not dispose) every panorama texture, puts `blackTex` in both slots, re-fetches the wanted photos, then re-adds `is-3d` (`:476-491`). Env `DataTexture`s re-upload by themselves; the shadow map is re-rendered (`shadowsDirty = true`). No composer.
- **Panorama lifecycle:** `fetch` → `createImageBitmap(blob, { imageOrientation: 'flipY' })` off the main thread (`:186-189`), upload in an idle callback, then `bmp.close()` and `t.image = {width,height}` so the CPU copy is freed (`:198-200`). Stale loads are dropped by `gen`/`lost` (`:190`, `:197`). Size cap: 8k (or `cellar_6k`) only when `tier > 0 && maxTextureSize >= 8192`; phones get 4k / `cellar_3k` (`:143`, `:175-179`): no texture above 4096 on phones.
- **Seam-safe lookups:** per-pixel `atan` with the `fract(uv.x + 0.5)` derivative swap and `textureGrad` (`:64-67`, `:82`); blur is a gradient scale, so it is a true mip bias. Ground projection intersects the room sphere and the floor plane from the travelled camera point (`:56-61`). Photo shader is `toneMapped: false` with no tone-mapping chunk; props are ACES once. The grade/vignette/grain is one full-screen multiply quad (`2·src·dst`) drawn in the same frame (`:98-106`, `:442`), so it stops with the loop and its grain is driven by the paused `clock`. No double tone mapping.
- **Shadows:** one directional key with `autoUpdate = false`, redrawn only when the key moves (`:424`, `:439`); `ShadowMaterial` catchers and blob contact shadows per photo, faded with their photo (`:268-286`, `:406-410`). Light count never changes (key + fire light always in the scene), so `compileAsync` programs stay valid.
- **Env files:** valid RGBE, 384x512 CubeUV, one per panorama, loaded with `CubeUVReflectionMapping`, assigned as `scene.environment` of the dominant photo (`:221-230`, `:411-412`).
- **No debug hooks, no external requests, no `innerHTML`, no `target=_blank`.**
- **Bytes really requested:** desktop (tier 1-2) = panoramas 3.47 + 3.65 (`cellar_6k`) + 3.22 + env 1.29 + models 5.08 (board 1.97, onion 0.60, bottles 1.76, barrel 0.75, after the skip rules) + table wood 1.50 = **16.2 MB** + vendor ≈ 17 MB. First station ≈ 3.47 + 0.42 + vendor ≈ 4.7 MB. Phone = 0.87 + 0.84 + 0.72 + 1.29 + models 1.81 + 0.04 = **5.6 MB** + vendor ≈ 6.4 MB.
- **CREDITS:** three panoramas, four models and `wood_table_worn` credited; all are requested; every file in `assets/` is used (`cellar_*` by tier, `m/*_512` on phones). No unused weight.
- **Copy:** footer "Sample design by Website Studio … not photographs of this restaurant"; station 2 note says "stock 360° photographs and scanned props, not this restaurant and not its food"; menu flagged, `[Price]` everywhere, placeholders for phone/address/hours/testimonial/wine list. No `mailto:`/`href="#"`.
- **Accessibility:** one `h1`, landmarks, canvas `aria-hidden`, skip link to `#main` (`tabindex=-1`), sections `tabindex=-1`, focus after the scroll (`main.js:139-151`); pause button constant label + `aria-pressed`, no `aria-label`; menu `inert` cleared on Escape/link/breakpoint, full-screen menu scrolls (`overflow-y:auto`, `data-lenis-prevent`, `max-height` media query). Sticky panels are unpinned at `max-height: 560px` and at `max-width:400px and max-height:600px` (`style.css:241-249`), and `measure()` follows the computed `position` (`main.js:80`), so 320x256 reflows. Focus ring `#ffc58f` on `rgba(8,6,5,.92)` ≈ 13:1.

### Findings

**1. med — "Only two panoramas resident" is not enforced: a third 8k photograph can stay on the GPU indefinitely.** `evict()` (`scene.js:211-216`) runs only when a load finishes (`:202`) and only drops a photo whose `weight < 0.001` at that instant. Pano 2 is preloaded as soon as the camera reaches key 4 (`needed` includes `KEYS[i+2].pano`, `:360`); on a normal or fast scroll the fireplace photo still has weight then (weights ease at `1 - exp(-5dt)`), so it survives, and nothing calls `evict()` again until another load. Result: fireplace + cellar + dining room all resident (3 × ~170 MB at 8k with mips; ~134 MB at 4k on phones, the low-memory case). Fix: call `evict()` from `updateWeights()` whenever `tex.size > 2` (it is a 3-entry loop), so the extra photo is dropped the frame its weight reaches 0: add `if (tex.size > 2) evict();` at the end of `updateWeights`.

**2. med — Every panorama upload is a single long main-thread task during scrolling, and the evict-and-refetch design repeats it on scroll-back.** `renderer.initTexture(t)` (`:198`) uploads the whole 8192x4096 bitmap plus `generateMipmap` in one task; for panos 1 and 2 this happens while the visitor is scrolling toward them, and after eviction a scroll back up re-fetches, re-decodes and re-uploads the fireplace photo. The brief asks for strip-wise upload and tasks under ~400 ms. Fix: as in himal finding 2 — allocate the texture once, `copyTextureToTexture` horizontal strips cut with `createImageBitmap(bmp, 0, y, w, 512)` one per task, generate mips in a last task; keep the 4k JPG as a quick stand-in while the 8k streams in.

**3. med — Phones render at up to 1.5x device pixel ratio.** `scene.js:139` `dprCap = tier === 0 ? 1.5 : ...`. BRIEF-3D caps phones at 1.0; here every phone pixel runs `atan`/`asin`, a sphere/plane intersection, two anisotropic `textureGrad`s during dissolves and the full-screen grain multiply, at 2.25x the pixel count. Fix: `const dprCap = tier === 0 ? 1.0 : tier === 1 ? 1.25 : 1.5;`.

**4. low — A load started before a context loss can delete the new load's `pending` entry and cause a duplicate 8k upload (GPU leak).** `onRestored` clears `pending` and starts new loads (`:480-485`); the old in-flight promise later returns `null` (gen mismatch) and its `finally { pending.delete(i); }` (`:205`) removes the *new* entry for the same index. `updateWeights` then calls `loadPano(i)` again (`:377`), a second copy is uploaded, and the first is overwritten in `tex` without `dispose()`. Fix: `finally { if (pending.get(i) === p) pending.delete(i); }`.

**5. low — Paused motion can keep the loop running while a photo is missing.** `wSettled()` (`:379`) compares `weight[i]` with the raw `target[i]`, but `updateWeights` drives weights to `target[i] / sum` (`:374`). When the next photo is still loading (or failed) mid-dissolve, `sum < 1`, the shown photo settles at 1 while `target` is e.g. 0.5, `settled()` stays false and paused mode keeps drawing every frame until the load completes (forever if it failed). Fix: store the normalised target (`target[i] /= sum` after computing `sum`) and compare against it in `wSettled()`.

**6. low — Per-frame allocations.** `updateScene()` builds `PANOS.map(...).filter(...).sort(...)` every frame (`:391`), `applyCamera()` creates one or two `Set`s per frame (`:360-361`), and `updateWeights` passes a closure to `needed.forEach` (`:377`). Fix: keep a reusable 3-slot `order` array sorted in place and a reusable `needed` set (`needed.clear(); needed.add(...)`).

**7. low (nit) — The shared CREDITS file names a real venue.** `assets/CREDITS.txt` lists "Castle Zavelstein Cellar" and the shipped file name `env-castle-zavelstein-cellar-pmrem128.hdr` repeats it. The disclaimer is there and the credit is the asset title, so this is acceptable, but the visible page must keep never naming it (it does not). Optional: refer to it by the Poly Haven id and URL only, and rename the env file `env-cellar-pmrem128.hdr` (update `envName()`).

**Verdict: CHANGES NEEDED** (findings 1-3, med).

---

## 3. flour-and-fig-photo — CHANGES NEEDED

Files: `index.html`, `style.css`, `main.js`, `scene.js`, `assets/CREDITS.txt`, `assets/pano/*.jpg`, two `env-*-pmrem.hdr`, six `poster-*.svg`.

### Checked and OK
- **Render loop:** `frame()` clears `raf` first (`scene.js:477`), re-queue guarded `if (!raf && !reduce && (!paused || !settled()))` (`:498`), `wake()` guarded (`:506`), `degrade()` ends with `guard = false` (`:503`). `settled()` includes the intro and the prop fades; `setPaused(true)` ends both (`:649`), so paused + idle = zero callbacks. Clock, steam, pour wobble, handheld drift and grain (`uTime = 0` when paused, `:489`) freeze.
- **Pause in `main.js`:** reveals finished and their ScrollTriggers killed, Lenis destroyed, `ScrollTrigger.disable(false)`, ticker slept (`main.js:183-202`); no other triggers exist, so `ScrollTrigger.enable()` on resume is enough; `startLenis()` re-stops Lenis if the menu is open (`:38`). Reduced motion: ScrollTrigger disabled at start (`:28`), no Lenis, no tweens, `setState({ still })` snaps (`scene.js:325-330`).
- **Off-screen pause** observes `#journey` (`scene.js:512-513`).
- **Context loss/restore:** `preventDefault`, poster back; restore relies on three re-uploading from kept sources: panoramas stay `ImageBitmap`s (never closed), env maps are RGBE data, canvases kept (`:517-522`). No composer or render targets; shadow maps are re-created by three. Loads in flight check `isContextLost()` before uploading/compiling (`:450`, `:453`).
- **Panorama lifecycle:** XHR blob → `createImageBitmap(..., { imageOrientation: 'flipY' })` off the main thread (`:81-101`); hall photo uploaded behind the loading line (`:527`); only two photographs exist and both stay (no third, nothing to evict). Size cap: 8k only for the hall and only when `!low && maxTextureSize >= 8192`; the dining room is 4k everywhere, phones get 4k (`:68`, `:83`): nothing above 4096 on phones.
- **Seam-safe lookup and mip bias:** per-pixel `atan` with the `fract(u + 0.5)` derivative swap, gradients scaled by `exp2(uBlur)` into `texture2DGradEXT` (`:142-154`). Photo is `toneMapped: false` and has no tone-mapping chunk; props ACES once. The grade (vignette, grain, tint) is a `2·src·dst` multiply quad (`:166-183`) drawn in the same render, so it stops with the loop.
- **Env files:** valid RGBE 384x512 CubeUV, one per photograph, `CubeUVReflectionMapping`, `scene.environment` switched with the dissolve together with the key light (`:357-360`); same CubeUV size, so no recompile.
- **Lights:** one key light, constant count; `ShadowMaterial` floor catcher plus radial contact shadows under every prop (`:242-254`, `:564-630`).
- **No debug hooks, external requests, `innerHTML` or `target=_blank`.**
- **Bytes really requested:** desktop (high/mid) = hall 8k 4.31 + room 4k 0.99 + env 0.94 + models 12.36 (croissant 2.10, cake 3.36, tea set 2.28, board 1.97, table 0.49 full PBR; basket 1.31, lemon 0.51, lychee 0.35 stripped) = **18.6 MB** + ~1.0 MB JS/CSS ≈ 19.6 MB. First station ≈ 4.31 + 0.47 + 0.49 + 1.0 ≈ 6.3 MB (target "about 6"). Phone = 1.19 + 0.99 + 0.94 + models 4.28 (stripped, no basket/lemon/lychee) = **7.4 MB** + 1.0 ≈ **8.4 MB** (see finding 4).
- **CREDITS:** both panoramas and all eight models are credited and requested. Unused file: see finding 3.
- **Copy:** footer "Sample design by Website Studio … The photographed rooms are stand-ins, not the café"; "Illustrative pastry/cake" notes; menu flagged, `[Price]`, contact/hours/testimonial placeholders; no `mailto:`/`href="#"`.
- **Accessibility:** one `h1`, landmarks, canvas `aria-hidden`, skip link to `#main` (`tabindex=-1`), sections `tabindex=-1`, focus moved after the scroll; pause button constant label + `aria-pressed`, no `aria-label`; menu `inert` cleared on all three exits; phone menu `overflow-y:auto` + `data-lenis-prevent`; sticky panels unpinned at `max-height: 560px` and `measure()` follows the computed position (`style.css:241-245`, `main.js:83`), so 320x256 reflows. Focus ring `#3d1934` between `#fbf7f0` halos ≈ 14:1; footer inverts it (`style.css:155`).

### Findings

**1. med — On a WebGL1-only device the photograph shader fails to compile and the page shows an empty beige scene instead of the posters.** The head probe accepts `getContext('webgl')` (`index.html:10`) and three r160 still creates a WebGL1 context there, but the sky shader uses `dFdx/dFdy` and `texture2DGradEXT` (`scene.js:142-151`) without `extensions: { derivatives: true, shaderTextureLOD: true }`; with `checkShaderErrors = false` the failure is silent, `is-3d` is added and the posters are hidden. Fix (as ember-and-oak-photo does): right after creating the renderer, `if (!renderer.capabilities.isWebGL2) { renderer.dispose(); return null; }` (the caller already falls back to the posters).

**2. low — The film grade is drawn before every transparent object, so steam, contact shadows and fading props escape the vignette and grain.** `grade` is an opaque mesh in the main scene with `renderOrder = 1000` (`:181-183`); three renders the whole opaque list before the transparent list, whatever the `renderOrder`, so the steam (`renderOrder 12`, transparent), all `contact()` shadows and every prop during its 0.7 s fade-in are drawn on top of the graded frame. Fix: `gradeMat.transparent = true;` (keeps it last in the transparent list), or render it in its own pass after `renderer.render(scene, camera)` as ember-and-oak-photo does.

**3. low — 4.47 MB of unused panorama ships in the site folder.** `assets/pano/bush_restaurant_8k.jpg` is never requested (`PANOS.room.big = false`, `:24`, `:83`; CREDITS says "bush_restaurant everywhere, use 4k"). Fix: delete it (ask the user first, project rule) or move it out of `sites/`.

**4. low — Phone total is slightly over budget (≈ 8.4 MB against about 8 MB).** Fix: load the dining-room photograph at 3k on `low` (as ember-and-oak-photo's `cellar_3k.jpg`, ~0.6 MB), or skip the carrot cake's 1.11 MB on phones and frame the plate.

**5. low — The dining-room panorama upload is one task while the visitor scrolls.** `renderer.initTexture(panoRoom)` (`:602`) uploads 4096x2048 plus mips in one call during the live page (typically 100-250 ms). Fix: strip upload as described in himal-chulo-photo finding 2, or at least run it from `requestIdleCallback` when the scroll is idle.

**6. low — Shadow map re-renders every frame.** `renderer.shadowMap.autoUpdate` stays `true` although only the teapot moves (and only in station 4). Fix: `renderer.shadowMap.autoUpdate = false;` and set `renderer.shadowMap.needsUpdate = true` when a prop is added, in `applyPour()` while `lift` changes, after `degrade()` and after a context restore. `degrade()`'s switch to `PCFShadowMap` (`:502`) also recompiles every shadow-receiving program on an already slow device; prefer lowering `key.shadow.radius`/map size instead.

**7. low — No `scroll-padding` on the scrollable phone menu.** Same as himal-chulo-photo finding 5: add `scroll-padding-block: 12px;` to `.nav__menu` (`style.css:184`).

**Verdict: CHANGES NEEDED** (finding 1, med).

---

## 4. olive-and-sea-photo — CHANGES NEEDED

Files: `index.html`, `style.css`, `main.js`, `scene.js`, `world.js`, `assets/CREDITS.txt`, three `pano-*-6k.jpg`, four `env-*-pmrem{128,256}.hdr`, four `poster-*.jpg`.

### Checked and OK
- **Render loop:** `frame()` clears `raf` first (`scene.js:347`), re-queue guarded (`:366`), `wake()` guarded (`:374`), `degrade()` ends with `guard = false` (`:371`). `settled()` covers camera, intro, pointer and the dissolve weights (`:342-344`); `setPaused(true)` freezes pointer and intro and draws one frame if no loop is queued (`:426`). Loads call `wake()` in `finally`, so a photo arriving while paused gets exactly one frame. Grain time is fixed at 0.37 when paused or reduced (`:298`).
- **Pause in `main.js`:** Lenis destroyed, ticker slept, `ScrollTrigger.disable(false)`; resume re-enables every trigger and restarts Lenis (re-stopped if the menu is open) (`main.js:38`, `:160-172`). Reduced motion: GSAP never started, ScrollTrigger disabled and ticker slept at load (`:9-10`); still frames via `setState({ still })`.
- **Off-screen pause** observes `#journey` (`main.js:212`, `scene.js:379-380`).
- **Context loss/restore:** `preventDefault` (`:307`), `gl-lost` shows the posters. Restore forgets textures (no dispose), nulls every sun's `shadow.map`, clears the compile set, makes fresh render targets (old ones forgotten), re-decodes the pair from the kept blobs, recompiles the final pass, then `onRestored` removes `gl-lost` and `resize()` runs again (`:308-323`). `gl-lost` only changes opacity/visibility, so the first `resize()` is not measuring a collapsed canvas.
- **Residency rule ("two photographs on the GPU, drop the third, re-decode from the kept file"):** each place keeps its JPEG `Blob` (`:161`); `updatePair()` keeps the pair around the journey and `dropPlace()` disposes the third texture (`:177-181`, `:204-209`); loads are serialised through one promise chain, one upload per task (`:152-176`). Decode is `createImageBitmap(..., { imageOrientation: 'flipY' })` off the main thread, the bitmap is closed after upload (`:143-168`). Size cap: 6k only when `!low && maxTextureSize >= 8192`; phones get 4k, and WebGL1 or `maxTextureSize < 4096` falls back to posters (`:77-79`).
- **Seam-safe lookup and ground projection:** `world.js:74-90` intersects the view ray with the floor plane and the projection sphere around the photo's camera, samples with `textureGrad` and wraps the u-derivative (`dx.x -= floor(dx.x + 0.5)`); blur is a gradient scale that grows with distance past the focus (a real depth falloff, not a global bias).
- **Final pass:** renderer `NoToneMapping`; the photo is written through the inverse of the film shoulder, the final pass applies the shoulder, per-place white balance, vignette, sRGB encode and grain exactly once (`scene.js:36-56`, `world.js:88`). It runs only inside `draw()`, so it stops with the loop.
- **Shadows:** VSM with `autoUpdate = false`, redrawn per place only when `shadowDirty` (`:281`); `ShadowMaterial` catchers and blob pools under the table, ceramics and fruit (`world.js:99-122`). Phones: no shadows, DPR 1.0, no MSAA.
- **Env files:** valid RGBE, 384x512 (128) on phones, 768x1024 (256) on desktop, one per lit place, `CubeUVReflectionMapping`, set as that place's `scene.environment` (`:162`); the third place has no props and correctly has no env.
- **No debug hooks, external requests, `innerHTML` or `target=_blank`.**
- **Bytes really requested:** desktop = panoramas 3.69 + 1.93 + 1.34 + env 1.89 + 1.60 + models 4.69 (table set 1.24, vase_04 0.60, lemon 1.85, lime 0.58, vase_01 0.42) + posters 0.32 = **15.5 MB** + ~1.0 MB JS ≈ 16.5 MB; first station ≈ 3.69 + 1.89 + 0.32 + 1.0 ≈ 6.9 MB (slightly over "about 6": the 256 env is 1.89 MB; the 128 file, 0.51 MB, would bring it to 5.5). Phone = 1.72 + 0.92 + 0.63 + 0.51 + 0.44 + models 2.35 (set, lemon lite, jug) + 0.32 = **6.9 MB** + 1.0 ≈ 7.9 MB.
- **CREDITS:** three panoramas and five models credited and requested; every file in `assets/` is used (6k desktop photos, 128/256 env by tier, posters in CSS).
- **Copy:** footer "Sample design by Website Studio … illustrative 360° stock photographs of other places, not the restaurant"; menu flagged, `[Price]`, placeholders. No `mailto:`/`href="#"`.
- **Accessibility:** one `h1`, landmarks, canvas `aria-hidden`, skip link to `#main`, sections `tabindex=-1`; pause button constant label + `aria-pressed`, no `aria-label`, icon-only under 560 px with text kept; menu modal only on phones (`setMenu` refuses on desktop), `inert` cleared on Escape/link/breakpoint; phone menu `max-height` + `overflow-y:auto` + `data-lenis-prevent`. Short screens (`max-height:560px`) keep `position: sticky` but with `height: auto` and the station `height: auto` (`style.css:217-219`), so a tall card is never clipped: it scrolls as one block (not the forno-rosso fixed-height pattern). Focus: ink ring + white halo on light panels, gold ring + dusk halo on dark panels/footer (≥ 9:1 ring vs halo).

### Findings

**1. high — A photograph dropped (or a context lost) while its first load is still compiling comes back as `ready` with no texture: that station shows a black sky for the rest of the visit.** In `ensurePlace()` (`scene.js:159-174`) the only `want`/`lost` checks are before the decode and right after it. After `initTexture`, `pl.tex` is set and `await compilePlace(pl)` runs (up to 5 s, first load of each place). If `updatePair()` calls `dropPlace(i)` during that await (`dropPlace` nulls `map`, disposes `tex`, sets `ready = false`), the load then continues to `pl.ready = true`. From then on `updatePair()` never reloads it (`!places[i].ready` is false), `weights()` gives it full weight and the pano shader samples a `null` map (black). The same happens if the context is lost during that await: `onRestored` nulls the texture, but `ensurePlace(i)` returns the still-pending `pl.loading` promise, which ends with `ready = true`. The trigger is realistic: place 2 first loads when the reader reaches t > 3.05 (the middle of the dusk station) and is dropped again when they scroll back below 2.95. Fix: re-check after every `await` and roll back: after `await yieldTask()` add `if (!pl.want || lost) { t.image.close?.(); return false; }`; after `await compilePlace(pl)` add `if (!pl.want || lost || pl.pano.material.uniforms.map.value !== t) { if (pl.tex === t) { pl.tex = null; pl.pano.material.uniforms.map.value = null; t.dispose(); } return false; }`; and in `onRestored`, `pl.loading = null` for every place before calling `ensurePlace` (so a new load starts instead of joining the dead one).

**2. med — The pair switch sits in the middle of a reading station, so scrolling inside "Dinner at dusk" re-decodes and re-uploads a 6k photograph again and again.** `updatePair()` switches `[0,1] → [1,2]` at t > 3.05 and back at t < 2.95 (`:206`), while station 3 holds the reader from t = 2.7 to 3.3 (`HOLD[3]`, `:29`). Every small scroll across t = 3 drops one 6k texture and re-queues the other: a fresh `createImageBitmap` plus a single-task 6144x3072 upload with mipmaps (75 MB + mips, a long main-thread task) while the reader is on that panel. Fix: widen the hysteresis to the edges of the hold, where neither dissolve is running (fades are 2.22-2.62 and 3.42-3.82): `const np = t < 2.66 ? [0, 1] : t > 3.36 ? [1, 2] : pair;`, and upload in strips (himal-chulo-photo finding 2) so a switch never blocks for long.

**3. low — Two full-resolution half-float 4x MSAA render targets are always allocated.** `makeTargets()` (`:99-104`) creates `rtA` and `rtB` at drawing-buffer size, `HalfFloatType`, `samples: 4` on desktop: about 48 bytes per pixel each (MSAA colour + depth + resolve). At 1440x900 and DPR 1.5 that is ~300 MB; on a 2560x1440 screen at DPR 1.5 ~ 1 GB, on top of two 6k photographs. `rtB` is only used during the two dissolves. Fix: create `rtB` lazily when `vis.length > 1` and drop it (forget, or `dispose()` outside a restore) when the dissolve ends, and use `samples: 2` (or 0 with the existing grain) for `rtB`.

**4. low — Per-frame allocations.** `frame()` makes `dw.slice()` and a `some` closure (`:357-359`), `weights()` a new `w` array and a `pair.filter(...).sort(...)` (`:213-218`), `draw()` a `[0,1,2].filter(...)` (`:286`), `updatePair()` a new pair array per frame (`:206`). Fix: reusable 3-slot arrays and plain loops.

**5. low — The desktop first station is ~6.9 MB.** The 1.89 MB `env-sundowner-deck-pmrem256.hdr` is on the critical path before the first frame (`:162`). Fix: load the 128 env first (0.51 MB) and swap in the 256 one in idle time, or keep 128 on desktop too (the props are small in frame).

**6. low (copy) — "the water just past the dunes" describes the photographed venue as the client's terrace.** `index.html:79` ("Wooden tables under a deep roof, sea air through the open sides and the water just past the dunes") is a specific description of the Poly Haven location presented as the restaurant; the brief says not to describe the real venue or imply it is the client's. Fix: keep it generic, e.g. "Tables in the shade, sea air and the light off the water. A terrace made for sharing plates and staying a while."

**7. low — No `scroll-padding` on the scrollable phone menu.** Add `scroll-padding-block: 12px;` to `.nav__menu` (`style.css:93`).

**Verdict: CHANGES NEEDED** (finding 1 high, finding 2 med).

---

## 5. jade-teahouse-photo — PASS (low findings only)

Files: `index.html`, `style.css`, `main.js`, `scene.js`, `world.js`, `assets/CREDITS.txt`, `assets/pano/*.jpg`, two `env-*-pmrem128.hdr`, five `poster-*.svg`.

### Checked and OK
- **Render loop:** `frame()` clears `raf` first (`scene.js:497`), re-queue guarded `if (!raf && (!paused || !settled() || intro > 0))` (`:512`), `wake()` guarded (`:525`), `degrade()` ends with `guard = false` (`:516`). Reduced motion never starts the loop: `wake()` queues one `stillFrame()` guarded by `stillQueued` (`:518-524`). `setPaused(true)` snaps the camera to its target and ends the intro (`:676-680`), so paused + idle = zero callbacks; steam, grain (`uTime = clock`) and drift freeze.
- **Pause in `main.js`:** Lenis destroyed, ticker slept, `ScrollTrigger.disable(false)`; resume re-enables every trigger and Lenis (re-stopped if the menu is open) (`main.js:36`, `:170-183`). Reveals use an `IntersectionObserver` and a clip-path wipe, never opacity (`style.css:163-165`), and do not depend on GSAP. Reduced motion: ScrollTrigger and ticker off on `load` (`main.js:241`).
- **Off-screen pause** observes `#journey` (`scene.js:531-532`).
- **Context loss/restore:** the boot listener is swapped for the real one once the scene exists (`:159-160`, `:551-553`); `preventDefault`; restore forgets both render targets (`rtA = rtB = null`, recreated by `resize()`), re-uploads the hand-uploaded panoramas from their kept `ImageBitmap`s in strips, then re-adds `is-3d` (`:536-550`). Env maps and model textures re-upload by themselves.
- **Panorama lifecycle (the reference implementation for the other four):** decode in a Web Worker (`fetch` + `createImageBitmap(..., { imageOrientation: 'flipY' })`, bitmap transferred, `:181-194`), then `uploadStriped()` allocates immutable `texStorage2D(SRGB8_ALPHA8)` storage and uploads ~2.4 Mpx strips behind the poster / ~0.6 Mpx strips while the page is live, one `texSubImage2D` per task, then one `generateMipmap` (`:557-586`). The worker is terminated when loading ends (`:657`). Two panoramas, both resident, no third. Size cap: 6k/8k only when `high && maxTextureSize >= 8192`; phones and low-power laptops get 4k (`:157`).
- **Seam-safe lookup and ground projection:** the view ray from the real camera is intersected with the room sphere and the floor disk at the photo's camera height, then sampled with `textureGrad` using the smaller of the `uv`/`fract(uv + 0.5)` gradients, scaled by `uBlur` (`:67-90`).
- **Final pass:** renderer `NoToneMapping`; per-world grade (exposure, warmth, saturation, contrast, lift), dissolve, optional 8-tap softening to match prop sharpness to the photo, shoulder, vignette, sRGB encode and grain, once (`:93-134`); runs only inside `draw()`.
- **Shadows:** sun (garden) and spot (dining room) with soft shadows on desktop, `ShadowMaterial` catchers plus contact shadows under the table, pot, cups and steamer (`:254-294`). Light count per world scene is constant and props compile against `wd.scene` into `rtA` (`:241-246`).
- **Env files:** valid RGBE 384x512 CubeUV, one per photograph, `CubeUVReflectionMapping`, set as each world's `scene.environment` (`:175-178`, `:599`).
- **No per-frame allocations** (pose objects, `draws` and scratch vectors are preallocated, `:339-404`). No `window.__*`, `console.*`, `location.search`; `location.href` is only used to absolutise the worker's fetch URL. No external requests, `innerHTML` or `target=_blank`.
- **Bytes really requested:** desktop = garden 6k 3.95 + dining room 8k 5.20 + env 0.94 + tea table 1.58 + tea set 2.28 = **14.0 MB** + ~1.0 MB JS ≈ 15 MB; first station ≈ 3.95 + 0.49 + 1.0 ≈ 5.4 MB. Phone = 1.81 + 1.50 + 0.94 + 0.53 + 1.47 (normal/ARM answered by 1x1 data URLs) = **6.3 MB** + 1.0 ≈ 7.3 MB.
- **CREDITS:** both panoramas and both models credited and requested; every file in `assets/` is used (6k/8k desktop, 4k phones). No unused weight.
- **Copy:** footer "Sample design by Website Studio … the places shown are sample scenery, not this restaurant"; menu flagged, `[Price]`, placeholders; the steamer note says "Illustrative dish in a sample photograph". No `mailto:`/`href="#"`.
- **Accessibility:** one `h1`, landmarks, canvas `aria-hidden`, skip link to `#main`, sections `tabindex=-1`, focus after the scroll; pause button constant label + `aria-pressed`, no `aria-label`; menu `inert` only when modal and cleared on every exit; full-screen phone menu scrolls (`overflow-y:auto`, `data-lenis-prevent`); sticky panels unpinned at `max-height: 560px` and for the reserve panel at `max-width:400px and max-height:600px`, with `measure()` following the computed position. Focus ring `#f3c27e` on `rgba(8,12,10,.92)` ≈ 12:1.

### Findings

**1. low — A context loss while the dining-room photograph is still uploading leaves stations 3-4 without their photograph until reload.** `bringUp(I)` returns `false` when `uploadStriped()` sees the loss (`:565`, `:600`), and `onRestored` only re-uploads worlds that were already `ready` (`:542`). `I.tex` is set but `I.ready` stays `false`, nothing retries, and `draw()` then has no world to render for t in 2-3 (`:477-478`), so the canvas keeps a stale frame. Fix: in `onRestored`, also include `[G, I].filter((wd) => wd.tex && !wd.ready)` and run `uploadPano(wd)` + `compile(wd.scene, wd)` for them before `opts.onRestored()`.

**2. low — Blob URLs are never revoked.** The worker's script URL (`:187`) and, on the no-worker path, the panorama's object URL (`:202`, which keeps the whole multi-MB JPEG blob alive for the page's lifetime) are never released. Fix: `const u = URL.createObjectURL(...); worker = new Worker(u); URL.revokeObjectURL(u);` and, after `await img.decode()`, `URL.revokeObjectURL(img.src)`.

**3. low — No explicit WebGL2 check.** `uploadStriped()` uses `texStorage2D`, `SRGB8_ALPHA8` and `UNPACK_ROW_LENGTH/SKIP_ROWS`, and the sky shader `textureGrad`, all WebGL2-only. On a WebGL1 context the `TypeError` from `texStorage2D` rejects `initScene` and `main.js` falls back to the posters, so the page is safe, but a renderer, a worker and listeners are left behind. Fix: after creating the renderer, `if (!renderer.capabilities.isWebGL2) { renderer.dispose(); return null; }`.

**4. low — Two full-size half-float 4x MSAA targets always allocated.** Same as olive-and-sea-photo finding 3 (`:297-313`): `rtB` is only needed during the two dissolves. Create it lazily, or with `samples: 0`.

**5. low — Shadow maps re-render every frame of each world.** `renderer.shadowMap.autoUpdate` stays `true`; only the teapot and the steamer lid move. Fix: `autoUpdate = false`, and `needsUpdate = true` while `u[1]`/`u[2]` change, when props are added and after a restore.

**6. low (nit) — `uploadStriped()` writes three.js internals** (`__webglTexture`, `__webglInit`, `__version`, `:582-583`). It works with r160, but because `__webglInit` is set by hand three never registers its dispose listener, so `tex.dispose()` would not free the GL texture (the site's own `dispose()` handles it with `gl.deleteTexture`). Leave a comment pinning this to r160.

**7. low — No `scroll-padding` on the scrollable phone menu.** Add `scroll-padding-block: 12px;` to `.nav__menu` (`style.css:110`).

**Verdict: PASS** (no med or high findings).

---

## Summary

| Site | Verdict | Blocking findings |
|---|---|---|
| himal-chulo-photo | CHANGES NEEDED | 1 med: room lights toggled by `roomG.visible`, props compiled for the wrong light set, full recompile at the first dissolve. 2 med: 8k restaurant photo uploaded in one long task while the page is live. |
| ember-and-oak-photo | CHANGES NEEDED | 1 med: `evict()` only runs on load completion, so three 8k photos can stay resident. 2 med: single-task 8k uploads during scroll, repeated after eviction. 3 med: phones at DPR 1.5. |
| flour-and-fig-photo | CHANGES NEEDED | 1 med: no WebGL2 guard, so WebGL1 devices get a silently failed photo shader instead of posters. |
| olive-and-sea-photo | CHANGES NEEDED | 1 high: dropping a place (or losing the context) during its first compile leaves it `ready` with a null texture, black sky for the rest of the visit. 2 med: pair switch at t = 2.95/3.05 sits inside the dusk station's hold, so a 6k photo is re-decoded and re-uploaded on every small scroll there. |
| jade-teahouse-photo | PASS | none (7 low). |

Cross-site notes:
- jade-teahouse-photo's worker decode + `uploadStriped()` (`scene.js:181-194`, `:557-586`) is the pattern the other four should copy for the strip-wise upload findings.
- Every site lacks `scroll-padding` on the scrollable phone menu (the A11Y round-3 fix appended to sakura/maison/saffron/blue-pearl); low, one line each.
- All five: footer line present, venues not named on the page, no debug hooks, no external requests, no `innerHTML`/`target=_blank`, all `.hdr` files valid RGBE CubeUV (384x512 or 768x1024), grade passes tone-map once and stop with the loop, CSS grain (himal) stops under motion-off and reduced motion, no texture above 4096 on phones.
- Unused shipped weight: only `flour-and-fig-photo/assets/pano/bush_restaurant_8k.jpg` (4.47 MB). Deleting it needs the user's OK (project rule).
- Byte totals (code-requested, incl. ~1.0 MB JS/CSS): desktop himal 20.1, ember 17.2, flour 19.6, olive 16.5, jade 15.0 MB; phone himal 7.8, ember 6.4, flour 8.4 (slightly over), olive 7.9, jade 7.3 MB.

