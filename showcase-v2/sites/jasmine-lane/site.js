/* Jasmine Lane: site content. Classic script: sets window.SITE only.
   Everything here is invented SAMPLE content for an invented tea house: names, dishes,
   descriptions, prices, pairings and hours are samples. Photos are stock (see footer credits).
   Shape documented in ../../shared/README.md. Extra field used only by jasmine.js: `pairings`. */
(function () {
  // Photo helper: every photo exists in images/ as <name>-400.webp and <name>-800.webp.
  // w/h are the 800px file's real pixel size (keeps the aspect ratio, no layout shift).
  var CARD_SIZES = '(min-width: 48em) 15rem, 7.5rem';
  function photo(name, w, h, alt, big) {
    var top = big || 800;
    return {
      src: 'images/' + name + '-' + top + '.webp',
      srcset: 'images/' + name + '-400.webp 400w, images/' + name + '-' + top + '.webp ' + top + 'w',
      sizes: CARD_SIZES, alt: alt, width: w, height: h
    };
  }

  window.SITE = {
    slug: 'jasmine-lane',
    name: 'Jasmine Lane',
    tagline: 'Slow tea, steaming baskets, a quieter kind of lunch.',
    cuisine: 'Tea house and dim sum',
    locale: 'en-US',
    currency: 'USD',
    contact: {
      address: '[address]',
      phone: '[phone]',
      phoneTel: '+15555550134',        // fictional 555-01xx number until the client supplies one
      email: '[email]',
      directionsUrl: ''
    },
    hoursAreSample: true,
    hours: [
      { day: 'mon', closed: true },
      { day: 'tue', open: '10:00', close: '21:00' },
      { day: 'wed', open: '10:00', close: '21:00' },
      { day: 'thu', open: '10:00', close: '21:00' },
      { day: 'fri', open: '10:00', close: '22:00' },
      { day: 'sat', open: '09:30', close: '22:00' },
      { day: 'sun', open: '09:30', close: '20:30' }
    ],
    timing: { pickupMinutes: 20, deliveryMinutes: 40, slotStepMinutes: 15 },
    order: { delivery: true, deliveryFee: 3.5, deliveryMinimum: 18, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0, maxQty: 20 },
    reservation: { stepMinutes: 30, lastSeatingMinutes: 60, leadMinutes: 60, maxParty: 8, defaultParty: 2, daysAhead: 60 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: {
      vegetarian: { label: 'Vegetarian' },
      vegan: { label: 'Vegan' },
      spicy: { label: 'Spicy' }
    },
    ui: { cartTitle: 'Your order', popularLabel: 'House favourite', addLabel: 'Add', addedLabel: 'Added' },
    schema: true,
    menu: [
      { id: 'steamed', name: 'Steamed baskets', description: 'Dumplings and buns, served in bamboo steamers.', items: [
        { id: 'har-gow', name: 'Crystal prawn har gow', description: 'Four translucent dumplings, prawn and bamboo shoot.', price: 9.5, tags: [], popular: true,
          img: photo('chopsticks-dim-sum', 800, 533, 'Chopsticks lifting a translucent prawn dumpling from a small plate of dumplings') },
        { id: 'siu-mai', name: 'Pork and prawn siu mai', description: 'Open-topped pork and prawn dumplings, each on a slice of carrot.', price: 8.5, tags: [],
          img: photo('shumai-steamer', 800, 533, 'Three yellow-wrapped siu mai topped with prawn in a bamboo steamer') },
        { id: 'xiao-long-bao', name: 'Pork soup dumplings', description: 'Xiao long bao with a spoonful of broth inside. Black vinegar and ginger on the side.', price: 11, tags: [], popular: true,
          img: photo('steamed-dumplings-bamboo', 800, 533, 'Six pleated soup dumplings in a bamboo steamer'),
          options: [{ name: 'Basket', choices: ['Six pieces', { label: 'Ten pieces', price: 6 }] }] },
        { id: 'tea-house-basket', name: 'Tea house basket for two', description: 'A chef’s selection: bean curd rolls, black bean spare ribs, har gow, soup dumplings and a char siu bao.', price: 34, tags: [],
          img: photo('dim-sum-assortment-top', 800, 1067, 'Five bamboo steamers from above: a bun, bean curd rolls, spare ribs with red chilli, prawn dumplings and soup dumplings in red spoons') },
        { id: 'jade-dumplings', name: 'Jade spinach and mushroom dumplings', description: 'Spinach-green wrappers, shiitake, wood ear and water chestnut.', price: 8.5, tags: ['vegan'] }
      ] },
      { id: 'baked-fried', name: 'Crisp and fried', description: 'Golden and crisp, for the middle of the table.', items: [
        { id: 'spring-rolls', name: 'Vegetable spring rolls', description: 'Cabbage, carrot and glass noodle, with sweet chilli dip.', price: 7, tags: ['vegetarian'],
          img: photo('spring-rolls', 800, 533, 'A platter piled with golden fried spring rolls') },
        { id: 'chicken-bao', name: 'Crispy chicken gua bao', description: 'Two folded buns, fried chicken, chilli mayo, sweet soy and micro herbs.', price: 10, tags: ['spicy'], popular: true,
          img: photo('bao-buns', 800, 533, 'Folded bao buns with crispy chicken, chilli sauce and herbs in a bamboo steamer') },
        { id: 'turnip-cake', name: 'Pan-fried turnip cake', description: 'Daikon cake with dried shrimp, seared on both sides.', price: 7.5, tags: [] }
      ] },
      { id: 'rice-noodles', name: 'Rice and noodles', description: 'Fuller plates for a longer lunch.', items: [
        { id: 'cheung-fun', name: 'Prawn rice noodle rolls', description: 'Steamed rice sheets rolled around prawn, with sweet soy.', price: 9, tags: [] },
        { id: 'lo-mai-gai', name: 'Lotus leaf sticky rice', description: 'Glutinous rice with chicken, mushroom and Chinese sausage, wrapped in a lotus leaf.', price: 9.5, tags: [] },
        { id: 'egg-fried-rice', name: 'Jasmine egg fried rice', description: 'Wok-fried jasmine rice with egg and spring onion.', price: 11, tags: ['vegetarian'] }
      ] },
      { id: 'tea', name: 'Tea by the pot', description: 'Loose-leaf tea by the pot. Hot-water refills: [policy to confirm].', items: [
        { id: 'jasmine-green', name: 'Jasmine green tea', description: 'Green tea scented with jasmine blossom. Gentle and floral.', price: 7, tags: ['vegan'],
          img: photo('gaiwan-green-tea', 800, 1200, 'Loose tea leaves in a dark glazed gaiwan on a wooden tea tray'),
          options: [{ name: 'Pot', choices: ['For one', { label: 'For two', price: 4 }] }] },
        { id: 'aged-oolong', name: 'Roasted oolong', description: 'A roasted oolong: amber in the cup, toasty and rounded.', price: 8, tags: ['vegan'],
          img: photo('teapot-lantern', 800, 640, 'Amber tea in a celadon cup beside a clay teapot, lit by a small oil lamp'),
          options: [{ name: 'Pot', choices: ['For one', { label: 'For two', price: 4 }] }] },
        { id: 'tea-flight', name: 'Tea tasting set', description: 'A small tasting set poured at the table. Ask which teas are on today.', price: 12, tags: ['vegan'],
          img: photo('tea-tasting-tray', 800, 534, 'A row of small white tea cups on a bamboo tea tray with a dark gaiwan and glass pitcher') },
        { id: 'pu-erh', name: 'Ripe pu-erh', description: 'Earthy, dark and smooth. Good with fried dishes.', price: 7.5, tags: ['vegan'],
          options: [{ name: 'Pot', choices: ['For one', { label: 'For two', price: 4 }] }] },
        { id: 'chrysanthemum', name: 'Chrysanthemum and goji', description: 'Whole flowers and berries, caffeine free.', price: 6, tags: ['vegan'] }
      ] },
      { id: 'sweets', name: 'Sweets', description: 'To finish, with the last cup.', items: [
        { id: 'egg-tarts', name: 'Custard egg tarts', description: 'Three flaky pastry tarts filled with egg custard.', price: 7, tags: ['vegetarian'], popular: true,
          img: photo('egg-tarts', 800, 1200, 'Three custard egg tarts with caramelised tops beside fresh eggs') },
        { id: 'sponge-cake', name: 'Steamed sponge cake', description: 'Soft steamed sponge cake, cut into wedges, in dark and light.', price: 6.5, tags: ['vegetarian'],
          img: { src: 'images/sponge-cake-720.webp', srcset: 'images/sponge-cake-400.webp 400w, images/sponge-cake-720.webp 720w', sizes: CARD_SIZES,
                 alt: 'Wedges of black sesame and yellow steamed sponge cake in a bamboo steamer', width: 720, height: 720 } },
        { id: 'mango-pudding', name: 'Mango pudding', description: 'Chilled mango pudding with evaporated milk.', price: 7, tags: ['vegetarian'] }
      ] }
    ],
    // Home "tea and dim sum" strip (sample suggestions, not claims). Ids must exist in the menu.
    pairings: [
      { tea: 'jasmine-green', dish: 'har-gow', note: 'A floral, gentle cup for the most delicate basket.' },
      { tea: 'aged-oolong', dish: 'siu-mai', note: 'Toasty roast notes with a richer, meatier bite.' },
      { tea: 'tea-flight', dish: 'chicken-bao', note: 'Taste a few teas side by side with something crisp.' },
      { tea: 'jasmine-green', dish: 'egg-tarts', note: 'Something light and floral with warm custard to finish.' }
    ]
  };
})();
