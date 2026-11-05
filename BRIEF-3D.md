# Showcase brief, round 2 — 5 restaurant 3D websites

Read `BRIEF.md` first: all its rules still apply (folder rules, local libs only, no invented facts, "Sample design by Website Studio" footer, responsive, accessible). This file ADDS the 3D rules and the lessons from round 1. Sites live in `showcase/sites/<slug>/`.

## What "3D website" means here
Not a page with one 3D hero. The WHOLE page is a 3D scene: one fixed full-screen `<canvas>` behind the content, and scrolling flies a camera through the scene (GSAP ScrollTrigger scrubbing a camera path and object animations; Lenis for smooth scroll). HTML sections (headings, menu, reservation CTA) sit over the canvas and fade in as the camera reaches each "station". Each site has 4-6 stations and a clear story from top to bottom.

## Tools you have (all local, in `showcase/vendor/`)
- `three.module.min.js` (r160) via importmap `"three": "../../vendor/three.module.min.js"`
- Addons in `vendor/three-addons/` (importmap `"three/addons/": "../../vendor/three-addons/"`): `postprocessing/` (EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass...), `shaders/`, `environments/RoomEnvironment.js`, `geometries/` (TextGeometry, RoundedBox...), `loaders/FontLoader.js` + `fonts/*.typeface.json` (helvetiker, optimer, gentilis for 3D text), `loaders/GLTFLoader.js`, `utils/BufferGeometryUtils.js`.
- `gsap.min.js`, `ScrollTrigger.min.js`, `lenis.min.js`, `lenis.css`.
- There are NO downloaded 3D models. Build everything procedurally (LatheGeometry for plates, bowls, glasses, cloches; TorusGeometry, CapsuleGeometry, ExtrudeGeometry, instanced meshes, shader materials, particles). Make it look designed: lighting, materials (MeshPhysicalMaterial with clearcoat, transmission is expensive: use sparingly), fog, bloom on lights, depth of field via blur layers or fog, soft shadows.
- Honesty rule: food will be stylised, not photoreal. Make the stylisation deliberate (a consistent art direction: low-poly, glossy toy, paper-craft, clay, etc.), not a failed attempt at realism.

## 3D engineering rules
- Lazy `import()` the scene module so the page (menu, text, HTML content) works if Three fails. Add the `js` class in an inline `<head>` script; text must never flash or stay invisible if JS fails (noscript rule, 4 s fallback).
- Probe WebGL first (create a canvas, `getContext('webgl2')||getContext('webgl')`) without logging; no console errors if WebGL is missing. Fallback: a designed CSS/SVG poster background per station (gradient + simple SVG shapes) and normal scrolling content. Test it.
- Quality tiers: detect phones / low-end (`navigator.hardwareConcurrency`, `deviceMemory`, small screens): lower pixel ratio (cap 1.5 desktop, 1.0 mobile), fewer particles, no bloom, no shadows on mobile. Keep draw calls low (instancing).
- Render loop: store the rAF id and `cancelAnimationFrame` in stop(); never queue two loops. Pause when the tab is hidden or the canvas is off-screen. Handle `webglcontextlost` (preventDefault) and `webglcontextrestored`. Handle resize with debounced renderer and composer sizing. Dispose geometries and materials you remove.
- Create ScrollTrigger timelines in page order (pin first), call `ScrollTrigger.refresh()` after fonts and scene setup. One master timeline scrubbing the camera is fine, but sections' HTML reveal must not depend on 3D having loaded.
- Camera moves must be smooth: lerp toward the scroll target each frame (damping) instead of snapping.
- Performance target: 60 fps on a normal laptop; under ~1.5 MB of own JS, CSS and assets (excluding vendor).

## Accessibility and polish (round 1 failed these, get them right the first time)
- Skip link that really moves focus: `main` and every section `tabindex="-1"` (`:focus{outline:none}`), anchor handler scrolls with Lenis and then `.focus({preventScroll:true})` on the target; mobile-menu links close the menu then focus the target. Copy the pattern from `sites/nova-labs/main.js`.
- A visible "Pause motion" toggle button in the header (`aria-pressed`, constant label, >= 44px, icon-only on small screens with the text kept for screen readers, hidden under `prefers-reduced-motion`). When on: add `html.motion-off`, stop the render loop on its current frame (or stop idle motion), pause CSS animations, marquees and particles. Scroll-driven camera movement may stay. Copy the pattern from `sites/nova-labs` or `sites/lumiere-spa`.
- `prefers-reduced-motion`: no Lenis, no scrub, camera jumps between stations or the scene renders still frames per section; all content visible.
- Contrast >= 4.5:1 for all text over the canvas: put text on a soft scrim / panel / blurred backing, and sample or compute real contrast against the brightest scene pixels behind it. No text that starts at very low opacity.
- Focus ring visible >= 3:1 on every control, also over the canvas and on clip-path buttons. Touch targets >= 44px. Brand link `aria-label` must contain its visible text (or have none). One `<h1>`. Menu toggle keeps a constant label; `aria-expanded` carries the state. The canvas is `aria-hidden="true"` and decorative; the HTML carries the full content and meaning.
- Footer links 44px tall. No `mailto:[placeholder]` or `href="#"` dead links: use `href="#reserve"` style anchors with a visible placeholder next to them.
- No console errors, no 404s (inline favicon data URI), no horizontal scroll at 1440, 1024 and 390. Test 720x450 and 390x667 too (short screens): nothing overflows, nothing pinned that doesn't fit.

## Content rules (unchanged, strict)
Invented brand name is fine and marked as sample. NO fake reviews, awards, prices, statistics, addresses, phone numbers, opening hours, chef names, "since 19xx", "as seen in", or commercial claims ("best in town", "free", "no contract"). Dishes may be generic category names (e.g. "Seasonal nigiri", "Margherita-style pizza") flagged as an illustrative sample menu. All prices are `[Price]`, contact details `[Your phone number]`, `[Street address]`, `[Opening hours]`, `[Reservation link]`, testimonials `[Testimonial from a guest]`.

## The 5 sites
| slug | Restaurant | Art direction | 3D story (scroll journey) |
|---|---|---|---|
| `sakura-omakase` | Japanese sushi counter | Night, lacquer black, vermilion, warm lantern gold. Glossy toy / lacquer look. Serif + clean sans. | Camera glides along a 3D sushi counter at night: lanterns, a long wooden counter, nigiri on plates built from lathe/capsule geometry, drifting sakura petals (instanced). Stations: arrival, the counter, the omakase menu, the chef's tools, reserve. |
| `forno-rosso` | Neapolitan pizzeria | Terracotta, flour white, fire orange. Handmade clay look. Big friendly display type. | Scroll-driven pizza assembly: dough disc, sauce swirl, mozzarella pieces, basil leaves drop and settle (exploded view that re-assembles), then the camera pulls into a glowing wood-fired oven with ember particles. Stations: dough, toppings, oven, menu, reserve. |
| `saffron-court` | Indian spice house | Deep maroon, saffron, brass gold, teal accent. Ornate but clean (jali / arch patterns as flat shapes). | A courtyard of floating brass bowls of spices (instanced colourful mound geometry) orbiting; camera spirals through arches of a market hall with string lights and glowing diyas; steam rising. Stations: gate, spice orbit, tandoor glow, thali menu, reserve. |
| `maison-claire` | French bistro / fine dining | Ivory, charcoal, champagne gold, one wine-red. Elegant serif, lots of air. Quiet, candle-lit, minimal. | A single laid table seen from above then descending: plate, folded napkin, cutlery, wine glass (lathe), candle with flame shader; a silver cloche that lifts on scroll to reveal a dish; camera orbits the table. Stations: table, cloche reveal, wine, tasting menu, reserve. |
| `blue-pearl` | Seafood / oyster bar | Deep teal to turquoise, pearl white, coral accent. Underwater, glassy, calm. | Underwater scene: light shafts and caustics (animated shader), rising bubbles (instanced), schools of simple fish shapes, shells and oysters on the seabed (lathe/torus shells) with a glowing pearl; camera dives from surface to seabed. Stations: surface, the dive, the catch, menu, reserve. |

Each site needs: sticky nav with mobile menu, the 3D stations with content panels, menu section, a reservation CTA band (placeholder booking), footer. At least one clearly memorable "wow" scroll moment per site. The five sites must look clearly different from each other and from the first five.

## Done means
1. Opens clean at `http://localhost:8800/sites/<slug>/` with zero console errors at 1440, 1024, 390 (and WebGL-off, reduced-motion, motion-paused modes).
2. All rules above met. Report: files created, how to view, the stations, the wow moment, WebGL-off fallback tested, perf notes, anything unfinished. You do not mark your own work as tested; QA, code review and accessibility checks follow.
