# Showcase Version 2 brief: 10 restaurant websites that sell

Version 1 (`../showcase/`) impressed. Version 2 must **impress and convert**: a hungry visitor on a phone should reach "Order" or "Book a table" in one tap and finish in a few more. The client demo shows 10 different restaurants, each with its own look, all built on the same proven selling skeleton.

**Decisions from the user (final):** no full-page 3D scene; small 3D items (one lightweight 3D object) are allowed on a few sites only; real food photographs from free-licence online sources; a working cart prototype (no real payment); aesthetic, luxurious, rich, easy to navigate.

Folder: `showcase-v2/`. Server: `python serve.py 8810` (http://localhost:8810/). Headless browsers only (Playwright, `channel='chrome'`, `headless=True`); a browser window must NEVER appear on the user's screen. The project python with Playwright is `../studio/.venv/Scripts/python.exe`.

## What the research says (use it)
Vendor sources, so numbers are directional, but they agree:
1. **Order / Reserve on every screen.** A persistent primary action: top bar button on desktop, **sticky bottom bar on phones** (Order, Book, Call), thumb-sized targets (min 44x44 px).
2. **Speed.** Mobile load under about 3 s. Use responsive `srcset`, `loading="lazy"`, `decoding="async"`, explicit `width`/`height`, fonts with `font-display: swap` and at most 2 families, no heavy JS on first paint. Budget: home page under about 1.5 MB transferred on first view on phone, hero image under 200 KB.
3. **Real HTML menu, never a PDF.** Photos, prices, tags (vegetarian, vegan, spicy, gluten-free), category jump bar, search/filter.
4. **Hours, address, phone, directions, open/closed status near the top** and again in the footer.
5. **Low-friction checkout.** Show the total early and always; no forced account; pickup or delivery choice; estimated time; Apple Pay / Google Pay buttons shown as styled placeholders (clearly "demo, no payment taken").
6. **Own the customer.** Direct ordering first, third-party delivery apps as a quiet secondary link, with a line like "Order direct and skip the app fees" ONLY as wording the client can edit (no invented percentages).
7. **Food photography sells.** Hero and every menu item with a real photo. Signature dishes strip with price and an "Add" button.
8. **Trust without lying.** No invented reviews, awards, ratings, press quotes or counts. Where a real restaurant would have them, show a clearly marked slot: `[Guest reviews: client to supply]`.
9. **Style trends to use well (pick what fits each site's concept, do not apply all):** dark moody or warm cream palettes with one gold/terracotta/sage accent; large serif display type paired with a clean sans; generous whitespace; editorial asymmetric grids and a bento grid of dishes; photography that brightens or slowly zooms on scroll; marquee/ticker of dishes or hours; image masks and oversized numerals; subtle grain; motion that is slow, purposeful, and honours `prefers-reduced-motion`.

## The 10 restaurants (invented names; each must look distinct, not a recoloured clone)
| slug | Concept | Mood / palette direction | Layout idea |
|---|---|---|---|
| `mustang-hearth` | Indo-Nepali kitchen: momos, thali, dal bhat, tandoor | Saffron, deep charcoal, cream; warm, lantern-lit | Split hero, momo-focused bento, thali builder strip |
| `cinder-and-salt` | Wood-fire steakhouse | Near-black, ember orange, bone white | Full-bleed dark hero, large dish cards, cuts table |
| `butter-and-bloom` | Bakery and café | Soft cream, butter yellow, dusty rose, sage | Airy, rounded, pastry grid, pre-order strip |
| `olio-terrace` | Mediterranean seaside taverna | Whitewash, Aegean blue, olive, terracotta | Bright editorial, sea-blue sections, mezze grid |
| `jasmine-lane` | Tea house and dim sum | Jade, ivory, ink black, a touch of vermilion | Calm, vertical rhythm, steamer-basket menu |
| `hoshi-counter` | Sushi / omakase counter | Black, warm paper, vermilion seal accents | Minimal, huge type, set-menu cards, seat-booking focus |
| `fornace-pizza` | Neapolitan pizzeria | Tomato red, basil green, flour white; playful | Bold type, pizza builder strip, fast-order focus |
| `le-petit-marais` | French bistro | Burgundy, brass gold, cream, ink | Classic editorial, prix-fixe card, wine-pairing touches |
| `casa-marigold` | Modern Mexican | Marigold, teal, terracotta, off-white; vibrant | Colour-blocked sections, taco builder, big tiles |
| `green-table` | Modern brunch and bowls café | Sage, oat, charcoal, a citrus accent; fresh | Bento menu, build-your-bowl strip, subscription/loyalty slot |

Small 3D item (allowed, optional, NEVER blocks the page): at most on `butter-and-bloom` (croissant), `jasmine-lane` (tea set) and `mustang-hearth` (brass diya). Use `<model-viewer>` from `vendor/model-viewer.min.js`, loaded lazily on idle or when scrolled near, with a static photo/poster fallback and `prefers-reduced-motion` honoured. Models: `../showcase/assets/polyhaven/models/<id>/` (copy the needed 1k files into `showcase-v2/assets/models/`). Not required.

## Architecture (shared core + per-site look)
```
showcase-v2/
  index.html                 hub: 10 cards (built by the manager at the end)
  serve.py, start-demo.bat, vendor/
  shared/                    READ-ONLY for site builders (the core builder owns it)
    base.css                 reset, accessible focus ring, skip link, sticky-bar and cart-drawer mechanics, forms, utilities (tokens via CSS variables)
    core.js                  ES module: cart, open-now status, menu rendering, reservation form, nav behaviours
  photos/<cuisine>/...       curated stock photos (+ photos/INDEX.md, photos/CREDITS.md)
  sites/_template/           working reference: index.html, menu.html, checkout.html, site.js, style.css
  sites/<slug>/              one folder per restaurant: copy of _template, restyled
```
Each site folder has: `index.html` (home), `menu.html` (full menu), `checkout.html` (cart review + pickup/delivery + demo payment + confirmation), `site.js` (the content: name, tagline, hours, address placeholders, menu data, delivery fee), `style.css` (the look), `images/` (the photos it uses, copied or resized from `photos/`).

**Contract for site builders.** Keep every `data-*` hook, form field name, element id and ARIA wiring of the template that `core.js` uses (they are listed at the top of `shared/core.js`). You MAY: rewrite `style.css` completely, restructure and restyle the HTML sections and their order, change fonts, imagery, motion, section designs, copy. You MAY NOT: edit `shared/`, remove the sticky mobile bar, the cart drawer, the open-now bar, the menu filters, the reservation form or checkout page, or add libraries from CDNs (vendor only, no network at run time except nothing). If `shared/` needs a fix, report it to the manager instead of editing.

## Content rules (AGENTS.md, apply strictly)
- **No invented facts.** Business names, dish names, descriptions and **sample prices are invented sample content for an invented business** and must be labelled: a visible, small banner or footer line on every page: "Sample design by Website Studio. Menu and prices are samples." Address, phone, hours: use plausible-looking placeholders marked `[address]`, `[phone]`, and sample hours in `site.js` flagged as sample. No reviews, ratings, awards, press, "since 19xx", "family-owned for 3 generations", counts of customers. No real restaurant names or logos. Allergen/dietary tags: only the obvious ones tied to the dish (e.g. a salad with no meat = vegetarian is fine); never claim "gluten-free"/"halal"/"organic" as fact unless tagged `[to confirm]`.
- **Photos** are stock photographs from the curated library with credits in `photos/CREDITS.md`. They are not the client's food, say so in the README/footer line "Photos are stock". Each photo is used only where it shows what the caption says (a picture of a burger must not label a taco).
- Footer line on every page: "Sample design by Website Studio".

## Quality bars (checked by separate QA, code-review and accessibility agents)
- 0 console errors and page errors at 1440, 1024, 390x844, 360x640 (headless Chrome); no horizontal scroll; no layout shift from images (explicit dimensions); all images have meaningful `alt` (empty for decorative); WCAG 2.2 AA contrast (4.5:1 body, 3:1 large and UI) measured, focus visible, keyboard path: skip link, nav, menu filter, add to cart, open cart, edit quantity, checkout, submit, all with the keyboard; screen-reader names on icon buttons; `prefers-reduced-motion` stops non-essential motion; target size 44x44 on phone.
- Conversion path test (the QA tester walks it at 390x844): land on home -> tap Order -> pick 2 items -> see cart total -> checkout -> choose pickup -> fill name/phone -> "pay" demo -> confirmation with order number and the estimated time. Count taps; fewer is better (target: 8 or fewer from landing). Also: Book a table path in 3 interactions or fewer plus a confirmation.
- Performance (headless, throttled 4x CPU, fast 3G-ish): home first view bytes and LCP; report numbers honestly.
- Each site must look like a different brand when the 10 home pages are placed side by side. Squint test: change the fonts/colour/layout, not just the hue.
- Cart persists across pages via `localStorage` (try/catch; works with storage blocked, falling back to memory).
