/* Site content for CINDER & SALT, a wood-fire steakhouse. Showcase V2 sample design by Website Studio.
   Everything here is invented SAMPLE content: business, dishes, weights, prices and hours are samples.
   Photos are stock photographs (see the credits line in the footer); each photo is used only for the dish it shows.
   Shape documented in ../../shared/README.md. Classic script: sets window.SITE only.
   Extra fields on steak items (cut, weight, serves) are read by cinder.js for the home "cuts" table; core ignores them. */
(function () {
  // Responsive photo helper. name = file stem in images/, w/h = intrinsic size of the -800 file.
  function photo(name, alt, w, h, sizes) {
    return {
      src: 'images/' + name + '-800.webp',
      srcset: 'images/' + name + '-400.webp 400w, images/' + name + '-800.webp 800w',
      sizes: sizes || '(min-width: 60em) 30vw, (min-width: 40em) 45vw, 92vw',
      alt: alt, width: w, height: h
    };
  }
  var doneness = [{ name: 'Doneness', choices: ['Medium rare', 'Rare', 'Medium', 'Medium well', 'Well done'] }];

  window.SITE = {
    slug: 'cinder-and-salt',
    name: 'Cinder & Salt',
    tagline: 'Live fire. Honest cuts.',
    cuisine: 'Wood-fire steakhouse',
    locale: 'en-US',
    currency: 'USD',
    contact: {
      address: '[address]',
      phone: '[phone]',
      phoneTel: '+15555550142',          // fictional 555-01xx number for the tel: link until the client supplies one
      email: '[email]',
      directionsUrl: ''                  // empty: "Get directions" points at the map placeholder
    },
    hoursAreSample: true,                // SAMPLE hours: client to confirm
    hours: [
      { day: 'mon', closed: true },
      { day: 'tue', open: '17:00', close: '22:00' },
      { day: 'wed', open: '17:00', close: '22:00' },
      { day: 'thu', open: '17:00', close: '22:30' },
      { day: 'fri', open: '12:00', close: '14:30' },
      { day: 'fri', open: '17:00', close: '23:30' },
      { day: 'sat', open: '12:00', close: '23:30' },
      { day: 'sun', open: '12:00', close: '21:00' }
    ],
    timing: { pickupMinutes: 25, deliveryMinutes: 50, slotStepMinutes: 15 },
    order: { delivery: true, deliveryFee: 5, deliveryMinimum: 30, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0, maxQty: 20 },
    reservation: { stepMinutes: 15, lastSeatingMinutes: 90, leadMinutes: 60, maxParty: 8, defaultParty: 2, daysAhead: 60 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: {
      vegetarian: { label: 'Vegetarian' },
      vegan: { label: 'Vegan' }
    },
    ui: { cartTitle: 'Your order', popularLabel: 'Signature', addLabel: 'Add', addedLabel: 'Added' },
    schema: true,
    menu: [
      { id: 'begin', name: 'To begin', description: 'Small plates while the embers settle.', items: [
        { id: 'oysters', name: 'Oysters on ice', description: 'On crushed ice, shallot vinegar, lemon.', price: 21,
          img: photo('14-oysters-on-ice', 'Opened oysters in their shells on crushed ice', 800, 533),
          options: [{ name: 'Size', choices: ['Half dozen', { label: 'Dozen', price: 19 }] }] },
        { id: 'bone-marrow', name: 'Roasted bone marrow', description: 'Split marrow bone from the oven, toasted bread, dressed leaves.', price: 16, popular: true,
          img: photo('12-roasted-bone-marrow', 'A split, roasted marrow bone on a wooden board with salad leaves and toasted bread', 800, 533) }
      ] },
      { id: 'cuts', name: 'Steaks and cuts', description: 'Cooked over the fire and sliced to order. Choose your doneness in the cart. Weights are approximate samples [to confirm].', items: [
        { id: 'striploin', name: 'Striploin', description: 'About 300 g. A firm, beefy cut with a ribbon of fat, grilled hard and fast.', price: 42,
          cut: 'Firm and beefy, with a ribbon of fat', weight: '300 g', serves: '1',
          img: photo('02-grilled-striploin', 'A thick striploin steak with dark grill marks resting on a grill', 800, 533), options: doneness },
        { id: 'ribeye', name: 'Ribeye', description: 'About 350 g. The richest single cut, crusted over the coals.', price: 48, popular: true,
          cut: 'Rich and juicy, deeply crusted', weight: '350 g', serves: '1',
          img: photo('08-ribeye-on-wood', 'A seared ribeye steak with a glossy brown crust on a dark wooden board', 800, 533), options: doneness },
        { id: 'fillet', name: 'Fillet', description: 'About 220 g. The leanest, most tender cut, sliced to order.', price: 52,
          cut: 'Lean and very tender', weight: '220 g', serves: '1',
          img: photo('07-chef-slicing-steak', 'A cook in black gloves slicing pink, medium-rare beef on a wooden board', 800, 1000), options: doneness },
        { id: 'hanger', name: 'Hanger steak', description: 'About 250 g. Sliced against the grain, flaked salt, rosemary.', price: 34,
          cut: 'Loose-grained, full of flavour', weight: '250 g', serves: '1',
          img: photo('10-sliced-steak-board', 'Pink slices of grilled steak on a wooden board with coarse salt and rosemary', 800, 1066), options: doneness },
        { id: 't-bone', name: 'T-bone for two', description: 'About 900 g. Fillet and strip on one bone, carved for the table.', price: 96,
          cut: 'Two cuts on one bone', weight: '900 g', serves: '2',
          img: photo('03-tbone-flames', 'A raw T-bone steak laid on the grill with flames rising behind it', 800, 533), options: doneness },
        { id: 'tomahawk', name: 'Tomahawk for two', description: 'About 1.1 kg. A long-bone rib steak, sliced to share.', price: 128, popular: true,
          cut: 'Long-bone rib, made to share', weight: '1.1 kg', serves: '2',
          img: photo('11-tomahawk-on-grill', 'A tomahawk steak with its long bone searing on a grill in drifting smoke', 800, 450), options: doneness }
      ] },
      { id: 'fire', name: 'From the kitchen', description: 'Lamb from the grill, a slow braise and sliced steak.', items: [
        { id: 'lamb-cutlets', name: 'Lamb cutlets', description: 'Grilled over the coals, charred green pepper, tomato, sea salt.', price: 36, popular: true,
          img: photo('16-lamb-chops-black-plate', 'Grilled lamb cutlets on a black plate with a charred green pepper, tomato and sea salt', 800, 534) },
        { id: 'lamb-rack', name: 'Rack of lamb', description: 'Red wine jus, crisp polenta, slow-roast tomato.', price: 44,
          img: photo('17-lamb-rack-gravy', 'A rack of lamb in dark gravy on a slate plate with polenta pieces and roast tomato', 800, 533) },
        { id: 'beef-shin', name: 'Braised beef shin', description: 'On the bone, over potato purée with charred okra.', price: 32,
          img: photo('13-beef-on-mash', 'Braised beef on the bone over mashed potato, ringed with charred okra in a dark dish', 800, 533)},
        { id: 'steak-verde', name: 'Sliced steak, green sauce', description: 'Grilled steak, sliced, with a sharp herb sauce and shallots.', price: 36,
          img: photo('09-sliced-steak-herbs', 'Slices of grilled steak topped with chopped herbs on a wooden board', 800, 533) }
      ] },
      { id: 'sides', name: 'Sides and sauces', description: 'For the table, and for the steak.', items: [
        { id: 'asparagus', name: 'Grilled asparagus', description: 'Charred over the coals, olive oil, lemon, sea salt.', price: 11, tags: ['vegan'],
          img: photo('15-asparagus-on-grill', 'Green asparagus spears grilling in a pan over glowing coals', 800, 534) },
        { id: 'chips', name: 'Beef-fat chips', description: 'Thick-cut and crisp.', price: 9 },
        { id: 'spinach', name: 'Creamed spinach', description: 'Garlic, cream, a little nutmeg.', price: 9, tags: ['vegetarian'] },
        { id: 'peppercorn', name: 'Green peppercorn sauce', description: 'Brandy, cream, cracked pepper.', price: 4 },
        { id: 'bearnaise', name: 'Béarnaise', description: 'Tarragon, shallot, warm butter.', price: 4, tags: ['vegetarian'] }
      ] },
      { id: 'finish', name: 'To finish', items: [
        { id: 'choc-tart', name: 'Dark chocolate and caramel tart', description: 'Bitter chocolate over a salted caramel layer, spun sugar.', price: 13, tags: ['vegetarian'],
          img: photo('18-chocolate-tart', 'A slice of dark chocolate tart with a caramel layer lifted from the tart, beside golden spun sugar', 800, 533) }
      ] }
    ]
  };
})();
