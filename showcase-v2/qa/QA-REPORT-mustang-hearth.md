# QA report: mustang-hearth (Showcase V2)

Tester: independent QA (EvidenceQA), 2026-11-05, ~22:08 local (a Thursday, so the restaurant shows "Closed now" and checkout defaults to "Schedule for later").
Setup: headless Chrome (`channel='chrome'`, `--headless=new`), `serve.py 8843` (stopped afterwards). Scripts are in the scratchpad (`qa-mustang/layout.py, flows.py, perf.py, extra.py, focus.py, cmp.py`). Screenshots are in `qa/screens-mustang-hearth/` (39 jpg). No site files were changed. Running `core_smoke.py` rewrote `qa/core_smoke_mustang-hearth.json` with this run's results.

## Verdict: **FAIL**
One FAIL trigger: **a visible layout defect on phone**. On the checkout page at 390 and 360 px, the header Cart button runs past the right edge of the screen and is cut off (I1).
Everything else is close to release quality: the order path works, every total is correct, there are 0 console errors and no invented facts, and the footer lines are on all pages. One more round with the copy and alt-text fixes below (I2 to I5) should give a PASS.

## Issues (severity, evidence, fix)
| # | Sev | Issue | Evidence | Fix |
|---|---|---|---|---|
| I1 | **High (FAIL trigger)** | Checkout header at phone widths: "Back to menu" plus the Cart button do not fit. The Cart button is clipped at the right edge: 390 px → cart-btn spans x 328..441; 360 px → 322..398. You cannot see the cart count. There is no page scroll because the overflow is clipped. | checkout-390.jpg, checkout-360.jpg; layout.py overflow probe | Below ~40em, hide `.cart-btn__text` on checkout and/or shrink "Back to menu" to an icon or a short "Menu" link. Alternatively let `.site-header__actions` shrink (`min-width:0`, `gap` smaller). Re-check at 360. |
| I2 | Medium | Momo counts in copy and alt text do not match the photos. The House momo plate says "Six plump momos" and the hero/house alt says "Six pleated momos / Six round dumplings", but the photo shows **5**. Steamed momo says "**Eight** pleated dumplings", but the photo shows **5** and no achar. | images momos-dark-hero, steaming-dumplings (inspected); menu-card-steam-momo-1440.jpg | Remove the numbers from descriptions ("Plump momos with…"). Correct the alt text to "Five…". This is the "photo shows what the caption says" rule. |
| I3 | Medium | **Jhol momo photo (jhol-momo):** the broth is pale cream. The description says "sesame and **tomato** broth" (jhol is usually orange-red). The alt text is honest ("pale broth"). | jhol-momo-800.webp inspected | The photo can stay. Change the wording to "Chicken momos in a warm, creamy sesame jhol, with two chutneys on the side." Pale sesame jhol is a real style, so the photo is then truthful. |
| I4 | Medium | **Dal makhani photo (dal-makhani):** a smooth orange-red gravy in a copper pan with a cream swirl and butter. No lentils are visible, and it reads closer to a makhani tomato gravy or soup than classic dark dal makhani. Not a burger-vs-taco mismatch: restaurant dal makhani is often photographed this colour. But a client who knows the cuisine may object. | dal-makhani-800.webp; menu-card-dal-makhani-1440.jpg (the thumbnail also crops the pan in half) | Best: swap to a darker, visibly lentil dal photo. Minimum: make the description explain the colour truthfully: "Black lentils simmered low and slow in a tomato-butter gravy, finished with cream." Keep the alt as is. Fix the crop (`object-position: 25% 60%`). |
| I5 | Medium | 16 of 30 dishes show a "[photo] / PHOTO TO COME" placeholder (kothey, C-momo, all small plates except sekuwa, paneer tikka, seekh, chicken/lamb thali, dal bhat, rices, 4 of 5 drinks/sweets). BRIEF rule 7 says "every menu item with a real photo". The placeholders are marked honestly, so this is a spec gap, not a lie. | menu-placeholder-cards-390.jpg; flows.json menu_cards | Source photos for at least the momos (kothey, C-momo) and the thalis (chicken/lamb), or accept this as a known gap in the demo. |
| I6 | Medium | 3D diya payload is **2.90 MB** (model-viewer.min.js 935 KB uncompressed, .bin 456 KB, 3 textures 1.5 MB as 1k JPG). It loads only at ≥56em and near the viewport, so it never blocks first view. But it is not "lightweight", and it also loads at 1024 px. | extra.json diya1440 | Use 512 px WebP textures or a Draco/meshopt GLB, aiming for under ~0.8 MB with model-viewer. Or load it on a click ("View in 3D"). |
| I7 | Low-Med | At 1024×768 the header nav wraps to two lines ("Our / story", "Hours & / location", "Book a / table", and "ORDER / ONLINE" stacked). It looks crowded and unfinished on a laptop or tablet. | home-1024.jpg | Below ~70em drop "Momos" and "Our story" from the bar, or switch to the hamburger, or add `white-space:nowrap` with a smaller gap. |
| I8 | Low | Hero h1 wraps to 4 lines at 1440 (and 1024): "Hand-folded / momos. / Fire from / the tandoor.". The copy column is about 430 px with a wide empty gutter before the photo. The "Fire from / the tandoor." break is awkward. My judgement: acceptable as an editorial stack, but it pushes the CTAs down and wastes the split. | home-1440.jpg | Widen the h1 max-width to ~13ch with `text-wrap: balance`, so it reads as 2 lines: "Hand-folded momos." / "Fire from the tandoor." |
| I9 | Low | Home "All momos" button links to `menu.html#momos`, but the anchor id is `cat-momos`. It lands at the top of the menu (momos are first, so the harm is small). | flows.json links.missing_anchors | Change to `menu.html#cat-momos`. |
| I10 | Low | Copy consistency. The thali strip says bread is "Kulcha, tandoori roti or garlic naan", but chicken/lamb thalis offer roti/plain naan/garlic naan (kulcha only on veg). The strip says "a sweet comes with it", but the veg thali description has no sweet. The thali photo shows no rice. The hero says "book a table… tonight" while the restaurant shows Closed. | thali-390.jpg, site.js | Align the wording: "Choose your bread in your order", and add "small sweet" to the veg thali or drop it from the strip. |
| I11 | Low | Dietary tag `vegan` on "Dal bhat set" is not obvious (dal is commonly tempered with ghee). | site.js | Use "Vegan [to confirm]" or tag it vegetarian. |
| I12 | Low | Naan alt says "glowing coals below", but the photo shows brick pieces and blue gas flame. | naan-in-tandoor-800.webp | Change to "…with flames below". |
| I13 | Low | Menu thumbnails crop the food: steamed momo and dal makhani show mostly dark background. | menu-card-steam-momo-1440.jpg, menu-card-dal-makhani-1440.jpg | Set per-image `object-position`. |
| I14 | Info | photos/CREDITS.md does not exist yet. The footer credits line on home and menu points to it with "[credits line to be confirmed]". Checkout has no credits line. Not failed, as instructed. | `ls photos/CREDITS.md` | Add the credits file and add the credits line to the checkout footer. |

## 1. Core smoke
`qa/core_smoke.py --site mustang-hearth --port 8843` → **38/38 PASS**. Included: 0 errors at 4 viewports, offline-capable, 8-tap order path, 3-interaction booking, keyboard path, focus trap, validation, sticky bar, 44 px targets, menu search/chips/scroll-spy, JSON-LD (6 sections, 30 items), storage blocked, cross-tab sync, card data not stored, delivery fee and minimum, reduced motion, empty checkout, and axe 0 violations.

## 2. Conversion path (390×844, touch)
- **Path A** (home → bar Order → 2 Adds on menu → View order → Checkout → name → phone → Place order): **8 taps**. Bar label "View order (2) · $27.50". Place button "PLACE ORDER · $27.50". Expected 13.00 + 14.50 = **27.50 ✓**. Confirmation #4286, "Ready: Tomorrow, 12:00 PM" (closed now, so it was scheduled automatically), pickup, name, "Pay at pickup". Cart cleared. Screens: pathA-3-drawer-390, pathA-4-confirmation-390.
- **Path B** (Add on the home momo bar + Add on the thali strip, no menu visit): both Adds work. Bar "View order (2) · $40.50" (14.50 + 26.00 ✓). Home → confirmation takes **7 taps**.
- Quantity: + + → Jhol ×3 = $43.50, subtotal $69.50 ✓. − → ×2 $29.00, subtotal $55.00 ✓. Bread option Garlic naan (+$1) → lamb thali $27.00, subtotal $56.00 ✓ (pathB-3). Remove works (smoke).
- Reload persistence: badge 3 after reload ✓.
- Delivery: $56.00 → $59.50 (+3.50 fee ✓). Tip 10% → $65.10 (5.60 = 10% of subtotal ✓). Estimate "Delivery: Tomorrow, 12:15 PM". Schedule-for-later gives 60 slots in 15-minute steps. An empty submit lists 4 errors (street, postcode, name, phone) (pathB-4). Confirmation shows the fee, tip and total $65.10 ✓ (pathB-5). The checkout shows the empty state afterwards ✓.
- Delivery minimum (one naan, $4): blocked with "Delivery needs a subtotal of at least $18.00 (sample rule). Add more or choose pickup." ✓ (delivery-minimum-390).
- Booking: Book tap → empty submit → "Enter your name / Enter your phone" ✓. Bad input → "Name must be at least 2 characters / Enter a phone number with at least 7 digits" ✓. Valid → ref WS-WDT935, "2 guests on Friday, November 6 at 11:30 AM" ✓ (booking-errors-390, booking-confirm-390).
- Confusion points: the home "Add" buttons give little visible feedback beyond the bar label changing (fine). Pickup copy says "about 20 minutes" while the estimate says "Tomorrow" when closed (acceptable, core behaviour).

## 3. Menu
- All 14 photos inspected with my own eyes (800 px files), plus hero, story, craft and diya. Truthful: chilli-soy (5 dumplings, dark glaze, herbs, slate ✓), sekuwa (chicken over flame ✓), tandoori chicken (lemon and green chutney ✓), veg thali (brass tray, 2 bowls, stuffed bread, onion, lime, chilli ✓), lamb curry (bone-in, hammered pot ✓), dum aloo ✓, biryani ✓, naan in tandoor ✓ (alt nit I12), bread basket ✓, masala chai ✓, hands folding dumplings ✓, table spread ✓, brass diya ✓. Flagged: I2 (counts), I3 (jhol wording), I4 (dal makhani wording or photo swap).
- Prices are all numbers. Hand-built strip prices come from SITE (`data-price-of`) and match.
- Search "momo" → 6 of 30. "zzz" → empty state plus status, Clear restores. Chips: Vegetarian 13, Vegan 3, Spicy 8, Gluten-free [to confirm] 2 (filtered sets checked against the tags). The jump bar lands the category 129 px from the top (below the sticky bars) ✓.
- Crawl: 53 URLs (pages and every src/srcset image) → **0 broken**. 1 missing anchor (I9). No broken images at any viewport.

## 4. Content rules
- No reviews, ratings, awards, years, counts or "since". The trust area shows `[Guest reviews: client to supply]` and `[Press or awards: client to supply, if any]`. Placeholders are marked: [address] [phone] [email] [map], "[Promise line: client to edit]", "[Wording: client to edit]" next to "skip the app fees", and the story placeholder. Sample hours are flagged.
- "Sample design by Website Studio. Menu and prices are samples. Photos are stock." appears on **home, menu and checkout** ✓. Credits line: home and menu only (I14).
- Process copy ("marinated overnight", "pleated by hand") is sample menu copy for an invented business. Acceptable under the sample label.

## 5. Layout (1440, 1024, 390×844, 360×640)
- Horizontal scroll: none on any page or viewport (document scrollWidth = viewport). The signature swipe row at 390 and 360 stays inside its container (client = scroll = 355 px at 390; wheel-scrolling the page sideways at 360 moves 0 px) → **the builder's fix is verified**.
- Console and page errors: **0** across all pages and viewports and all flows (only deliberate failure-injection tests produced errors).
- Defects: I1 (checkout header clipped on phones, FAIL), I7 (1024 nav wraps), I8 (4-line h1), I13 (thumbnail crops). Drawer at all widths: clean (drawer-*.jpg).
- Keyboard focus: a visible 3 px gold outline (#ffd27a) on the dark header. Skip link first.

## 6. Performance (390×844 DPR 2, 4× CPU, 1.6 Mbps / 150 ms, cache off, 3 runs, medians)
| Page | First-view bytes | LCP | FCP | CLS | LCP element |
|---|---|---|---|---|---|
| home | 353 KB (13 req) | **1.88 s** (1.84 / 1.88 / 2.16) | 1.88 s | 0.0014 | hero momos 800w webp (18 KB) |
| menu | 206 KB (13 req) | **2.54 s** (1.80 / 2.54 / 3.04) | 2.54 s | 0 | menu band (text/grain bg) |
| checkout | 133 KB | 1.63 s | 1.63 s | 0 | checkout band |
Desktop home (1440, same throttling): LCP 2.82 s (1600w hero), CLS 0.0075. Within budget (1.5 MB home, hero < 200 KB).
- **`js-ready` trade-off:** on the menu, FCP = LCP, about 1.8 to 3.0 s, and everything from the chips down is invisible until core.js runs. On this 1.6 Mbps profile core.js is 61 KB uncompressed, so the menu body appears at about 2.5 s instead of jumping. The header and search show first. My judgement: worth it (CLS went from about 0.7 to 0). A cheaper alternative later would be to serve gzip, since serve.py sends core.js uncompressed (19 KB gzip). JS-off fail-safe verified: the footer goes from hidden to visible after about 3.3 s.

## 7. 3D diya, keyboard, reduced motion, JS off, storage blocked
- 1440: no model requests on load. Requests start only when #reserve scrolls near. The 3D model renders (`is-3d`, model-viewer present). The diya box stays 462×347 before and after (no size change), and there were **0 layout shifts** during loading. The form stays usable while it loads. 0 errors. Bytes: 2.90 MB (I6). Screens: reserve-1440, diya-3d-1440.
- 390 and 800 px: no model requests ✓. 1024: loads (≥56em) ✓ by design. Reduced motion at 1440: no model, ticker animation `none`, 0 hidden `.reveal`, `scroll-behavior:auto` ✓.
- Fallback: with model-viewer.js blocked → poster stays, no element added (only the injected network error). With the .gltf returning 404 → model-viewer removed, poster stays (diya-fallback-gltf404-1440). Never blocks.
- Note: the poster is a table diya, while the model is a hanging diya lantern. Both are honest in their alt text.
- Keyboard-only from home: Tab ×21 reaches the 2 home Adds, then Shift+Tab to Cart, Enter, Tab to Checkout, then name/phone, Place order → confirmation focused ✓. 0 errors.
- JS disabled: hero and phone bar show at once. The footer is hidden until the 3.3 s fail-safe. The menu shows the noscript "please call [phone] to order" (nojs-home-390, nojs-menu-390). OK.
- Storage blocked: home Adds work in memory (badge 2, $35.50), 0 errors ✓.

## Design assessment
- **Rating 7/10.** It feels warm and lantern-lit: charcoal with saffron and cream, a good serif and condensed sans pairing, a ticker, a dark momo bento and a thali tray strip. The food photography is strong where it exists. Phone layout is tidy, with a clear sticky Order / Book / Call bar.
- What a client would criticise: about half the menu says "PHOTO TO COME". The hero copy column is narrow with a 4-line heading and a large empty gutter. The 1024 header wraps. The thali "builder" is really three Add buttons. Monospace placeholder notes look raw in the hero. The checkout header is broken on phones.
- **Versus cinder-and-salt / butter-and-bloom** (compare-mustang-cinder-butter.jpg): clearly distinct from Butter & Bloom (light, rounded, rose). **Mustang and Cinder & Salt look like siblings at a squint:** both have a near-black hero, an orange or saffron pill CTA, a white serif display, caps button labels and a dark header. Mustang differs through the split hero, the italic gold accents and the cream bento/thali sections further down, but the first screen is too close. Suggestion: make the Mustang hero cream or saffron (a light section with a dark photo panel), or give it a distinct textile or pattern band, so the two first screens don't look alike.
