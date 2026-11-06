# Website Studio: restaurant sites, Version 2

Ten sample restaurant websites built to turn visitors into orders and bookings. Each is a different brand (look, colours, type, layout). All share the same selling path:

- one-tap **Order** and **Book a table** buttons, and a sticky **Order / Book / Call** bar on phones
- a real HTML menu with photos, search and filter chips (no PDF menus)
- open-now status, hours, address and directions near the top
- a cart with a visible total, then a short checkout (pickup or delivery, no account, demo payment)
- a reservation form with a confirmation

Everything is a **sample design**. Business names, menus, prices, hours and wording are invented; address and phone are marked placeholders. Photos are stock photographs (see Credits). Nothing takes real payment or sends real orders.

It is plain HTML, CSS and JavaScript. No build step, no framework, no CDN: every page works offline once served.

## The ten sites

| Folder | Sample business | Look |
|---|---|---|
| `cinder-and-salt` | Wood-fire steakhouse | Near-black, ember orange, bone white; a cuts table that orders itself |
| `mustang-hearth` | Indo-Nepali kitchen | Saffron panel with a block-print pattern, charcoal, cream; momo bar and thali strip |
| `butter-and-bloom` | Bakery and café | Cream, butter and rose; arched hero, pre-order strip |
| `olio-terrace` | Mediterranean taverna | Whitewash and Aegean blue; "build a mezze table" |
| `jasmine-lane` | Tea house and dim sum | Ink and jade, framed panels; tea-and-dim-sum pairings |
| `hoshi-counter` | Sushi and omakase counter | Near-black, huge type, vermilion disc; book a seat or order takeaway |
| `fornace-pizza` | Neapolitan pizzeria | Condensed poster type, tomato and basil; "build your pizza" |
| `le-petit-marais` | French bistro | Burgundy and brass; menu du jour card, à emporter |
| `casa-marigold` | Modern Mexican | Marigold, teal, terracotta; taco-night builder |
| `green-table` | Brunch and bowls café | Sage, oat and citrus; build-your-bowl, club card example |

## How to run it

The pages load JavaScript modules, so they must be served over HTTP. Double-clicking `index.html` will not work.

**What you need to install**

| Need | Why | Required? |
|---|---|---|
| Python 3.9 or newer | runs the local server (`serve.py`, standard library only, nothing to `pip install`) | Yes |
| A modern browser (Chrome, Edge or Firefox) | viewing the sites | Yes |
| Playwright for Python and Chrome (`pip install playwright`) | only to rerun the automated checks in `qa/` | No |
| Node.js and `npm` | not needed; the libraries are already copied into `vendor/` and the current sites use no JS library | No |

**Start**

Windows: double-click `start-demo.bat`.

Any system:

```bash
python serve.py 8810
```

Then open **http://localhost:8810/** and pick a site. `serve.py` listens on `127.0.0.1` only, so it is reachable from this computer and no other. To judge the phone layout, use the browser's phone-size view (in Chrome, press F12 and choose the device toolbar).

**Try this on any site:** tap Order, add two dishes, open the cart, check out as pickup, "pay" with the demo form, see the confirmation. Then tap Book a table and submit the form.

## How it is built

```
index.html          hub page with the ten sites
serve.py            local demo server (Python standard library only)
start-demo.bat      Windows shortcut
shared/             the shared core: core.js (cart, menu, hours, booking, checkout) and base.css; see shared/README.md
sites/<name>/       one folder per restaurant: index.html, menu.html, checkout.html, site.js (the content), style.css (the look), images/
sites/_template/    the neutral working reference the ten sites were made from
photos/             curated stock photos (3 sizes each), INDEX.md and CREDITS.md
vendor/             older JS libraries copied from Version 1; not used by the current sites
qa/                 QA, accessibility and core test reports, plus the rerunnable test script core_smoke.py
BRIEF-V2.md         the research and brief the builders worked from
```

The look of each site is its own `style.css` on top of shared design tokens. The behaviour is shared, so a fix in `shared/` reaches all ten. A new restaurant is made by copying `sites/_template/`, editing `site.js` (name, hours, menu, prices) and replacing the photos and styling. `shared/README.md` lists every data hook a site must keep.

## What the research said (and where it shows up)

Sources were mostly restaurant-software vendors, so their percentages are directional, not proof. The consistent advice:

- Order and Reserve reachable from every screen, thumb-sized, sticky on phones.
- Mobile load in about 3 seconds or less.
- Real HTML menu, never a PDF; photos, prices, tags.
- Hours, address, phone and directions near the top.
- Few steps to pay: total shown early, no forced account, pickup or delivery choice.
- Direct ordering first, delivery apps second.
- Food photography sells.

## Quality checks done

Each site was built, then tested by a separate QA agent (order path counted in taps on a 390x844 phone, totals recomputed independently, every dish photo viewed and checked against its name and alt text, broken links, console errors, header and bottom-bar positions at 320 to 1440 px, mobile speed under throttling, keyboard-only use, reduced motion, JavaScript off). Failed sites went back for fixes and were retested. Reports: `qa/QA-REPORT-*.md`. The shared checks: `python qa/core_smoke.py --site <folder> --port 8810` (needs Playwright; launch Chrome with the new headless mode).

## Known limits

- **Stock photos are not the client's food.** Some dishes have no honest matching photo and show a text card instead; menus were kept to what the photos can truthfully show (about 13 to 19 items per site).
- **Menus, prices, hours, and wording are samples.** Visible `[bracketed]` marks stand for missing facts (address, phone, reviews, press, sourcing and similar). Do not publish them.
- **Fonts:** most sites use system fonts, so headings look different on Mac, iPhone and Android than on Windows. Casa Marigold bundles Zilla Slab and Butter & Bloom bundles two fonts, so those two look the same everywhere.
- **Open or closed** is worked out from the visitor's own clock, not the restaurant's time zone, and the demo hours are sample hours, so at some times of day a site shows "Closed" and checkout offers "Schedule for later".
- **Demo checkout only.** No payment is taken and no order is sent. Card fields are never stored.
- **Not tested** on real screen readers, Safari or Firefox; the checks ran in Chrome with automated accessibility tooling.
- Some pages need JavaScript; with it off they show a "please call" note.

## Credits and licences

- Photos: stock photographs from Pexels under the Pexels License (free for commercial use, no attribution required). Every photographer is listed in `photos/CREDITS.md` and in each site's footer.
- Fonts bundled in two sites carry their open licence files (SIL OFL) next to the font files.
- Site designs, copy and code: by Website Studio. They are samples for presentation, not production sites.
