/* Olio Terrace: site content. Everything here is invented SAMPLE content for an invented business:
   names, dishes, descriptions, prices and hours are samples. Photos are stock (see the footer credits).
   Shape documented in ../../shared/README.md. Classic script: sets window.SITE only. */
(function () {
  // Dish photo helper: every photo exists in images/ at 400w and 800w.
  // name = file stem, h4 = height of the 400w file, alt = what the photo really shows.
  function pic(name, h4, alt) {
    return {
      src: 'images/' + name + '-800.webp',
      srcset: 'images/' + name + '-400.webp 400w, images/' + name + '-800.webp 800w',
      sizes: '(min-width: 72em) 17rem, (min-width: 60em) 24vw, (min-width: 40em) 45vw, 92vw',
      alt: alt, width: 800, height: h4 * 2
    };
  }

  window.SITE = {
    slug: 'olio-terrace',
    name: 'Olio Terrace',
    tagline: 'Long tables, salt air, plates to share.',
    cuisine: 'Mediterranean seaside taverna',
    locale: 'en-US',
    currency: 'USD',
    contact: {
      address: '[address]',
      phone: '[phone]',
      phoneTel: '+15555550144',        // fictional 555-01xx number until the client supplies one
      email: '[email]',
      directionsUrl: ''
    },
    hoursAreSample: true,
    hours: [
      { day: 'mon', closed: true },
      { day: 'tue', open: '12:00', close: '15:00' }, { day: 'tue', open: '17:30', close: '22:00' },
      { day: 'wed', open: '12:00', close: '15:00' }, { day: 'wed', open: '17:30', close: '22:00' },
      { day: 'thu', open: '12:00', close: '22:00' },
      { day: 'fri', open: '12:00', close: '23:00' },
      { day: 'sat', open: '11:00', close: '23:30' },
      { day: 'sun', open: '11:00', close: '21:00' }
    ],
    timing: { pickupMinutes: 20, deliveryMinutes: 45, slotStepMinutes: 15 },
    order: { delivery: true, deliveryFee: 4, deliveryMinimum: 20, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0 },
    reservation: { stepMinutes: 30, lastSeatingMinutes: 75, leadMinutes: 60, maxParty: 10, defaultParty: 2, daysAhead: 60 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: {
      vegetarian: { label: 'Vegetarian' },
      vegan: { label: 'Vegan' },
      spicy: { label: 'Spicy' },
      'gluten-free': { label: 'Gluten-free [to confirm]' }
    },
    ui: { cartTitle: 'Your table', popularLabel: 'House favourite', addLabel: 'Add', addedLabel: 'Added' },
    menu: [
      { id: 'mezze', name: 'Mezze & salad', description: 'Small plates for the middle of the table. Two or three make a good start for two.', items: [
        { id: 'mezze-platter', name: 'Mezze platter for two', description: 'Hummus, smoky aubergine, labneh, spiced tomato and aubergine salad, and vine leaves over herb tabbouleh.', price: 26, tags: ['vegetarian'], plates: 5, // five dips and salads: counts as 5 small plates in the home tally
          img: pic('07-mezze-tray', 267, 'A round white platter of hummus, aubergine dip, labneh, a chopped aubergine salad and stuffed vine leaves on green tabbouleh') },
        { id: 'hummus', name: 'Hummus & warm pita', description: 'Whipped chickpeas, tahini, paprika oil, a black olive and parsley.', price: 9, tags: ['vegetarian'],
          img: pic('11-hummus-pita', 267, 'Hummus in a blue ramekin with paprika oil, an olive and parsley, beside triangles of pita') },
        { id: 'olives-bread', name: 'Green olives & bread', description: 'A bowl of green olives with slices of bread dusted with paprika.', price: 7, tags: ['vegetarian'],
          img: pic('16-olives-and-bread', 267, 'A small bowl of green olives on a plate next to two slices of toasted bread with red paprika') },
        { id: 'dolmades', name: 'Dolmades', description: 'Vine leaves rolled with rice and herbs, warm, with lemon and mint.', price: 10, tags: ['vegetarian'],
          img: pic('13-dolmades-pan', 267, 'Stuffed vine leaves in a black pan with a lemon wedge, mint leaves and cherry tomatoes') },
        { id: 'calamari', name: 'Crisp calamari', description: 'Golden fried squid rings, lemon and a herby yoghurt dip.', price: 14, popular: true,
          img: pic('12-fried-calamari', 267, 'Breaded fried calamari rings on a blue-rimmed plate with a lemon wedge, salad leaves and a white dip') },
        { id: 'taverna-salad', name: 'Taverna salad with feta', description: 'Lettuce, red cabbage, tomato and cucumber under a slab of feta with dried oregano, and an olive.', price: 13, tags: ['vegetarian'],
          img: pic('06-greek-salad', 265, 'A white plate of mixed salad with lettuce, red cabbage, tomato and cucumber, topped with a slab of feta and oregano') }
      ] },
      { id: 'grill', name: 'From the grill & the sea', description: 'Grilled and finished with lemon and olive oil.', items: [
        { id: 'octopus', name: 'Charred octopus', description: 'Grilled octopus tentacles on a pool of herb oil, cracked pepper.', price: 24, popular: true,
          img: pic('08-octopus-white-plate', 267, 'Charred octopus tentacles on a ridged white plate with bright green herb oil') },
        { id: 'red-mullet', name: 'Whole red mullet', description: 'Small whole red mullet grilled with lemon slices and parsley. Ask about bones.', price: 27, popular: true,
          img: pic('10-fish-with-lemon', 267, 'Five small whole red fish cooking on a round grill with slices of lemon') },
        { id: 'souvlaki', name: 'Chicken souvlaki', description: 'Three marinated chicken skewers with citrus and parsley.', price: 19,
          img: pic('14-chicken-skewers-board', 267, 'Three grilled chicken skewers on a wooden board with a lime wedge and a sprig of parsley'),
          options: [{ name: 'Side', choices: ['Lemon potatoes', 'Taverna salad', { label: 'Both, half portions', price: 2 }] }] },
        { id: 'whole-octopus', name: 'Grilled small octopus to share', description: 'Several small octopus grilled whole until the tentacles curl and crisp, with lemon and olive oil. For two or more.', price: 42,
          img: pic('09-octopus-on-grill', 267, 'Several small whole octopus with curled tentacles cooking together on a grill rack') },
        { id: 'lamb-chops', name: 'Lamb chops', description: 'Rosemary and garlic, grilled to order, with lemon.', price: 31,
          options: [{ name: 'Cooked', choices: ['Medium', 'Medium rare', 'Well done'] }] }
      ] },
      { id: 'sides', name: 'Sides', items: [
        { id: 'lemon-potatoes', name: 'Lemon potatoes', description: 'Roasted with lemon, oregano and oil.', price: 7, tags: ['vegan'] },
        { id: 'pita', name: 'Extra warm pita', description: 'Two rounds, brushed with oil.', price: 3, tags: ['vegetarian'] }
      ] },
      { id: 'sweet', name: 'Sweets & drinks', items: [
        { id: 'baklava', name: 'Pistachio baklava', description: 'Layers of filo, butter and syrup, under crushed pistachio. Four pieces.', price: 9, tags: ['vegetarian'], popular: true,
          img: pic('15-pistachio-baklava', 230, 'Four squares of baklava topped with bright green crushed pistachio on a white plate') },
        { id: 'lemonade', name: 'Mint lemonade', description: 'Fresh lemon, mint and a little sugar, over ice.', price: 5, tags: ['vegan'] },
        { id: 'greek-coffee', name: 'Greek coffee', description: 'Brewed in a small pot, served with a glass of water.', price: 3.5, tags: ['vegan'],
          options: [{ name: 'Sweetness', choices: ['Medium', 'No sugar', 'Sweet'] }] }
      ] }
    ]
  };
})();
