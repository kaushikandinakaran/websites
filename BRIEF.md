# Showcase brief — 5 sample websites for the Wednesday client presentation

Goal: 5 DIFFERENT, aesthetic, high-class, clear-UI websites. Static HTML/CSS/JS. Each must look like it came from a different studio.

## Folder rules
- Your site lives ONLY in `showcase/sites/<slug>/` (index.html, style.css, main.js, assets/). Do not edit other sites, `vendor/`, or anything outside `showcase/`. Do not touch `studio/`.
- Libraries are local (no CDN, must work offline), loaded from `../../vendor/`:
  - `gsap.min.js`, `ScrollTrigger.min.js` (classic scripts, globals `gsap`, `ScrollTrigger`)
  - `lenis.min.js` + `lenis.css` (global `Lenis`)
  - `three.module.min.js` (ES module; use an importmap: `"three": "../../vendor/three.module.min.js"`)
  - `model-viewer.min.js` (`<script type="module">`)
- Pages are served by `python -m http.server 8800` from `showcase/` (see `start-demo.bat`), so ES modules work. Your site URL: `http://localhost:8800/sites/<slug>/`.
- Images: no hotlinking, no stock downloads you can't license. Use CSS gradients, inline SVG, Three.js shapes, CSS 3D, or generated canvas art. Free CC0 images only if you save them locally with a note in `assets/CREDITS.txt`.

## Quality bar (this is what the client sees)
- Aesthetic, high-class, uncluttered. One clear idea per section. Generous spacing, strong type hierarchy, max 2 font families (system fonts or fonts saved locally in assets/; no Google Fonts links).
- Real design system per site: colour tokens as CSS variables, spacing scale, consistent radius and shadows.
- Required sections: navbar (sticky, with a mobile menu), hero, 3-4 content sections, a CTA band, footer. Take structure ideas from the inspiration list below (navbar.gallery, footer.design, cta.gallery, Scrolltide, Refero, Bootswatch "Superhero" mood for the gym site, 3dicons style for 3D icons) — look at them for ideas, never copy their code or assets.
- Motion: smooth scroll with Lenis, GSAP ScrollTrigger reveals, at least one signature animation (pinned section, parallax, text split reveal, marquee, etc.). Respect `prefers-reduced-motion` (turn motion off cleanly).
- 3D: at least one 3D moment per site (Three.js scene, CSS 3D tilt cards, or 3D-style icons). Must have a fallback (static gradient/shape) if WebGL fails. Pause rendering when off-screen. Keep it light: 60fps on a normal laptop.
- Responsive: perfect at 1440, 1024, 390 px wide. No horizontal scroll. Touch targets ≥ 44px.
- Accessibility: semantic landmarks, alt text, visible focus, contrast ≥ 4.5:1 for body text, working keyboard menu, one `<h1>`.
- Performance: no console errors, no 404s, total first-load under ~3 MB excluding vendor libs.

## Content rules (project rule: never invent facts)
- Invented brand name is fine (mark as sample). NO fake reviews, testimonials, awards, prices, statistics, addresses, phone numbers, or "as seen in".
- Anything factual that is missing becomes a visible placeholder like `[Your phone number]`, `[Testimonial from a client]`, `[Price]`. Generic marketing copy (headlines, descriptions of services) is fine.
- Footer shows a small "Sample design by Website Studio" line.

## The 5 sites
| slug | Business | Mood / design direction | Signature moves |
|---|---|---|---|
| `ember-table` | Fine-dining restaurant | Dark, warm, candle-lit. Serif display + clean sans. Deep charcoal, ember orange, cream. | Pinned horizontal-scroll menu, slow image-free "steam" particle hero (Three.js), marquee of dishes |
| `lumiere-spa` | Luxury salon & spa | Airy light, editorial. Soft sand, sage, gold hairlines. Large elegant serif. Lots of white space. | Text-mask reveals, parallax shapes, floating 3D-style soft orbs, service accordion |
| `apex-forge` | Gym / fitness (superhero energy) | Bold, high contrast, dark with electric accent (Bootswatch Superhero mood: dark slate + orange/red). Heavy condensed type, diagonal cuts. | Giant scrolling type, counter-free (no fake stats), 3D rotating dumbbell/kettlebell hero (Three.js), 3D-style icon cards |
| `northline-studio` | Architecture / real-estate studio | Editorial grid, monochrome with one muted accent. Big whitespace, thin lines, tiny caps labels. | 3D rotating building massing model (Three.js boxes), scroll-driven image-free plan reveal, sticky project list |
| `nova-labs` | Tech / consulting company | Dark glass, gradient mesh, neon violet-cyan. Modern sans. Cards with blur and borders. | Three.js particle/wireframe hero reacting to mouse, bento-grid features, glowing CTA gallery-style band |

## Done means
1. Opens clean at the URL above with zero console errors at 1440 and 390 widths.
2. All required sections present; reduced-motion and no-WebGL fallbacks work.
3. You report: files created, how to view, what the signature moves are, anything unfinished. You do NOT mark your own work as tested — the QA agent checks it.
