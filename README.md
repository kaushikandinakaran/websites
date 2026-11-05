# Website Studio: client presentation showcase

Twenty sample websites made for a client presentation. They show what Website Studio can produce: different looks, industries and styles, from clean editorial pages to whole-page 3D scenes you scroll through.

Everything here is a **sample design**. Business names, copy and menus are invented. Anything that would need real client content (prices, reviews, awards, addresses) is a visible `[placeholder]`, never a made-up fact.

It is plain HTML, CSS and JavaScript. There is no build step and no framework. All libraries are included in `vendor/`, so it works offline.

## What is in it

A hub page (`index.html`) links to all 20 sites, which live in `sites/<name>/`.

### Round 1: five aesthetic sites (editorial layouts, light motion, small 3D touches)

| Folder | Sample business |
|---|---|
| `ember-table` | Candle-lit fine dining, pinned horizontal menu |
| `lumiere-spa` | Luxury salon and spa |
| `apex-forge` | Strength and conditioning gym |
| `northline-studio` | Architecture and real-estate studio |
| `nova-labs` | Technology consulting, dark glass interface |

### Round 2: five restaurant sites in 3D (the whole page is one scroll-driven 3D scene)

| Folder | Sample business |
|---|---|
| `sakura-omakase` | Japanese sushi counter, night scene |
| `forno-rosso` | Neapolitan pizzeria |
| `saffron-court` | Indian spice house, courtyard |
| `maison-claire` | French bistro, laid table |
| `blue-pearl` | Seafood and oyster bar, underwater dive |

### Round 3: five "realistic" 3D restaurants (modelled scenes, real scanned props)

`himal-chulo` (Indo-Nepali kitchen), `ember-and-oak` (wood-fire steakhouse), `flour-and-fig` (bakery and café), `olive-and-sea` (Mediterranean taverna), `jade-teahouse` (tea house and dim sum).

These were built first. Round 4 replaced them with something more convincing, but they are kept for comparison.

### Round 4: five restaurants built on real 360° photographs (the most realistic)

`himal-chulo-photo`, `ember-and-oak-photo`, `flour-and-fig-photo`, `olive-and-sea-photo`, `jade-teahouse-photo`.

The scenery is real photography. Real scanned props sit in the scene. The lighting comes from the photograph itself. The scroll flies the camera between the photographed rooms.

## How to run it

The 3D pages load modules and models, so they **must be served over HTTP**. Double-clicking `index.html` will not work.

### 1. What you need to install

| Need | Why | Required? |
|---|---|---|
| **Python 3.9 or newer** | runs the local demo server (`serve.py`, standard library only, nothing to `pip install`) | **Yes** |
| **A modern browser** (Chrome, Edge or Firefox) with **WebGL 2** and hardware acceleration on | the 3D scenes | **Yes** |
| A dedicated or integrated GPU | smooth 3D. Without WebGL the sites show a still poster instead | Recommended |
| Node.js 18+ and `npm` | only if you want to re-download the libraries listed in `package.json` | No. Copies are already in `vendor/` |
| Python `Pillow` (`pip install pillow`) | only to run `tools/fetch_polyhaven.py` to fetch new photo assets | No |
| Playwright (`pip install playwright`) | only if you want to run automated browser checks | No |

### 2. Start

Windows: double-click `start-demo.bat`.

Any system:

```bash
python serve.py 8800
```

Then open **http://localhost:8800/**. Pick a site from the hub.

Why `serve.py` instead of `python -m http.server`? A 3D page requests many files at once, and the stock server refuses some of them, which makes the page fall back to the poster. `serve.py` has a larger queue and sends the right file types for `.glb`, `.hdr` and similar. It listens on `127.0.0.1` only.

### 3. Tips for presenting

- Open each 3D page about 10 seconds before you present it, so the large photographs and models finish loading.
- On a laptop with two GPUs, set your browser to the high-performance GPU (Windows: Settings → System → Display → Graphics).
- The photo sites are large (roughly 15 to 25 MB on desktop). Use a fast local connection, or present from `localhost`.
- Phones get lighter photos and a lower quality tier automatically.

## Libraries (all included in `vendor/`, no CDN)

| Library | Version | Used for |
|---|---|---|
| [three.js](https://threejs.org) + add-ons | r160 | 3D rendering, post-processing, loaders |
| [GSAP](https://gsap.com) + ScrollTrigger | 3.12.5 | scroll-driven animation |
| [Lenis](https://lenis.darkroom.engineering) | 1.1.13 | smooth scrolling |
| [model-viewer](https://modelviewer.dev) | 3.5.0 | 3D model viewer on some pages |

To re-download them: `npm install` (uses `package.json`).

## Structure

```
index.html          hub page that links to every site
serve.py            local demo server (Python standard library only)
start-demo.bat      Windows shortcut: starts the server and opens the browser
sites/<name>/       one folder per site: index.html, style.css, main.js, scene.js (+ world.js, assets/)
vendor/             JS libraries, kept local so the sites work offline
assets/polyhaven/   shared 3D models, textures and panoramas (CC0, from Poly Haven)
tools/              fetch_polyhaven.py: downloads Poly Haven assets and writes the credits log
BRIEF*.md           the design and build briefs given to the builders for each round
qa-reports/         QA, code-review and accessibility reports for each round
```

## Quality checks done

Each round was built, then checked by separate QA, code-review and accessibility passes (WCAG 2.2 AA targets: keyboard use, focus rings, contrast, reduced-motion, screen-reader names). Reports are in `qa-reports/`.

Known limits, stated honestly:

- The photo round is the most realistic, rated between 6.5 and 8 out of 10 by our own review. Scenery is real photography. **Food, drinks and table props are still modelled and read as CG up close.** Truly real food needs the client's own photos.
- **Flour & Fig (photo)** is about 22.9 MB on desktop, above the 20 MB target we set.
- **Ember & Oak (photo)** has a small purple light spill and a tent card at the board station.
- A few cold loads on a shared GPU spend 400 to 535 ms on startup work. This has not yet been measured on an idle GPU.

## Credits and licences

- Photographs, 3D models, textures and HDRIs come from [Poly Haven](https://polyhaven.com) under **CC0**. Per-asset credits are logged in `assets/polyhaven/CREDITS.md` and in each site's `assets/CREDITS.txt`.
- Libraries keep their own licences (three.js: MIT, Lenis: MIT, model-viewer: Apache-2.0, GSAP: standard no-charge licence).
- Site designs, copy and code: by Website Studio. They are samples for presentation, not production sites.
