/* Butter & Bloom: site content. Everything here is invented SAMPLE content for an invented business:
   the name, menu, descriptions, prices and hours are samples. Photos are stock (see the footer credits).
   Shape documented in ../../shared/README.md. Classic script: sets window.SITE only. */
(function () {
  // Responsive photo helper. w/h are the 800px file's real pixel size (prevents layout shift).
  // big = real width of the "-1600" file (portrait files are 1333 or 1500 px wide).
  function photo(name, alt, w, h, big, sizes) {
    return {
      src: 'images/' + name + '-800.webp',
      srcset: 'images/' + name + '-400.webp 400w, images/' + name + '-800.webp 800w, images/' + name + '-1600.webp ' + (big || 1600) + 'w',
      sizes: sizes || '(min-width: 64em) 22rem, (min-width: 40em) 45vw, 92vw',
      alt: alt, width: w, height: h
    };
  }
  var L = [800, 533], P = [800, 1200];

  window.SITE = {
    slug: 'butter-and-bloom',
    name: 'Butter & Bloom',
    tagline: 'Pastry worth waking up for.',
    cuisine: 'Bakery & café',
    locale: 'en-US',
    currency: 'USD',
    contact: {
      address: '[address]',
      phone: '[phone]',
      phoneTel: '+15555550142',          // fictional 555-01xx number until the client supplies one
      email: '[email]',
      directionsUrl: ''
    },
    hoursAreSample: true,
    hours: [
      { day: 'mon', closed: true },
      { day: 'tue', open: '07:00', close: '16:00' },
      { day: 'wed', open: '07:00', close: '16:00' },
      { day: 'thu', open: '07:00', close: '16:00' },
      { day: 'fri', open: '07:00', close: '17:00' },
      { day: 'sat', open: '07:30', close: '17:00' },
      { day: 'sun', open: '08:00', close: '14:00' }
    ],
    // 30-minute pickup slots so today's and the next open day's times both fit in the list (pre-order strip)
    timing: { pickupMinutes: 15, deliveryMinutes: 40, slotStepMinutes: 30 },
    order: { delivery: true, deliveryFee: 3.5, deliveryMinimum: 15, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0, maxQty: 20 },
    reservation: { stepMinutes: 30, lastSeatingMinutes: 45, leadMinutes: 60, maxParty: 6, defaultParty: 2, daysAhead: 45 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: {
      vegetarian: { label: 'Vegetarian' },
      vegan: { label: 'Vegan' },
      'gluten-free': { label: 'Gluten-free [to confirm]' }
    },
    ui: { cartTitle: 'Your bakery bag', popularLabel: 'Favourite', addLabel: 'Add', addedLabel: 'Added' },
    menu: [
      { id: 'viennoiserie', name: 'Viennoiserie', description: 'Croissants and other flaky, buttery pastries.', items: [
        { id: 'butter-croissant', name: 'Butter croissant', description: 'The plain croissant: crisp outside, soft and layered inside.', price: 4.25, tags: ['vegetarian'], popular: true,
          img: photo('butter-croissant', 'Two glossy golden croissants on a scalloped white plate', L[0], L[1]) },
        { id: 'croissant-jam', name: 'Croissant & raspberry jam', description: 'A butter croissant with a little pot of raspberry jam.', price: 5.5, tags: ['vegetarian'],
          img: photo('croissant-jam', 'A croissant on a white plate beside a small glass pot of red berry jam and two forks', P[0], P[1], 1333) },
        { id: 'croissants-share', name: 'Croissants to share', description: 'Butter croissants by the box, for the table or the office. Photo is illustrative.', price: 16, tags: ['vegetarian'],
          img: photo('croissants-rack', 'Golden croissants on a wire rack', 800, 534),
          options: [{ name: 'Box', choices: ['4 croissants', { label: '6 croissants', price: 8 }] }] },
        { id: 'cinnamon-bun', name: 'Cinnamon bun', description: 'Soft enriched dough swirled with cinnamon sugar.', price: 4.95, tags: ['vegetarian'], popular: true,
          img: photo('cinnamon-buns', 'Cinnamon swirl buns on a white plate on a wooden table', L[0], L[1]) },
        { id: 'bakers-box', name: "Baker's choice box", description: "Assorted pastries, baker's choice. The mix changes.", price: 17, tags: ['vegetarian'],
          img: photo('bakers-box', 'Close-up of assorted flaky pastries: one with walnuts, one drizzled with chocolate, one dusted with sugar', L[0], L[1]) },
        { id: 'pastry-basket', name: 'Morning pastry basket', description: 'Croissants, almond rings, nut swirls and chocolate pastries to share.', price: 32, tags: ['vegetarian'],
          img: photo('pastry-basket', 'A woven basket filled with croissants, almond-topped rings, nut-crusted swirls and chocolate-striped pastries', L[0], L[1]) }
      ] },
      { id: 'cakes', name: 'Cakes & tarts', description: 'Individual cakes, plus a whole tart to pre-order.', items: [
        { id: 'berry-tartlet', name: 'Summer berry tartlet', description: 'Short pastry, vanilla cream, strawberries, currants and blueberries.', price: 7.25, tags: ['vegetarian'], popular: true,
          img: photo('berry-tartlet', 'A small tart topped with cream, halved strawberries, redcurrants, blackberries and blueberries on a grey plate', P[0], P[1], 1333) },
        { id: 'strawberry-cake', name: 'Strawberry cream cake', description: 'Light sponge, whipped cream and a crown of sliced strawberries.', price: 7.5, tags: ['vegetarian'],
          img: photo('strawberry-cakes', 'Two small cream cakes covered in sliced strawberries on a stone plate with a gold fork', 800, 1067, 1500) },
        { id: 'eclair', name: 'Vanilla éclair', description: 'Choux pastry filled with vanilla cream, dusted with icing sugar.', price: 5.75, tags: ['vegetarian'],
          img: photo('eclairs', 'Hands holding a wooden tray with two éclairs dusted with icing sugar', P[0], P[1], 1333) },
        { id: 'macarons', name: 'Macarons, gift box', description: 'Almond meringue shells with ganache, in a mix of colours and flavours.', price: 14, tags: ['vegetarian', 'gluten-free'], popular: true,
          img: photo('macarons', 'Four macarons: green, pink, white with a dark filling, and a cocoa-coloured one', L[0], L[1]) },
        { id: 'fruit-tart', name: 'Rainbow fruit tart, whole', description: 'Serves about 8. Strawberries, melon, pineapple, kiwi and blueberries. Best pre-ordered.', price: 42, tags: ['vegetarian'],
          img: photo('fruit-tart', 'Top view of a tart covered in rows of strawberries, melon, pineapple and kiwi, with berries on a board', 800, 450) }
      ] },
      { id: 'bakes', name: 'Loaves & bakes', description: 'A loaf for home, or a sweet bake with your coffee.', items: [
        { id: 'sourdough', name: 'Country sourdough', description: 'Open crumb, deep crust. A whole round loaf.', price: 9, tags: ['vegan'], popular: true,
          img: photo('sourdough', 'A round sourdough loaf and a cut loaf with thick slices on a linen cloth', 800, 532),
          options: [{ name: 'Loaf', choices: ['Whole', 'Sliced'] }] },
        { id: 'blueberry-muffin', name: 'Blueberry muffin', description: 'Tall, tender and full of blueberries.', price: 3.95, tags: ['vegetarian'],
          img: photo('blueberry-muffins', 'Top view of blueberry muffins on a cooling rack next to a bowl of blueberries', 800, 532) },
        { id: 'cookies-milk', name: 'Cookies & milk', description: 'Chocolate chip cookies with a glass of cold milk.', price: 5.5, tags: ['vegetarian'],
          img: photo('cookies-milk', 'A stack of chocolate chip cookies and a glass of milk on a white plate', 800, 450),
          options: [{ name: 'Milk', choices: ['Whole milk', { label: 'Oat milk', price: 0.6 }] }] }
      ] },
      { id: 'drinks', name: 'Coffee & tea', description: 'Oat milk available.', items: [
        { id: 'latte-croissant', name: 'Latte & croissant', description: 'A morning pairing: a latte and a butter croissant.', price: 8.5, tags: ['vegetarian'], popular: true,
          img: photo('latte-croissant', 'A latte with leaf latte art in a brown cup beside a croissant on a wooden board', L[0], L[1]),
          options: [{ name: 'Milk', choices: ['Whole milk', { label: 'Oat milk', price: 0.6 }] }] },
        { id: 'flat-white', name: 'Flat white', description: 'Double shot, silky milk.', price: 4.25, tags: ['vegetarian'],
          options: [{ name: 'Milk', choices: ['Whole milk', { label: 'Oat milk', price: 0.6 }] }] },
        { id: 'cappuccino', name: 'Cappuccino', description: 'Espresso, steamed milk and a deep foam.', price: 4.25, tags: ['vegetarian'],
          options: [{ name: 'Milk', choices: ['Whole milk', { label: 'Oat milk', price: 0.6 }] }] },
        { id: 'pot-of-tea', name: 'Pot of loose-leaf tea', description: 'For one or to share.', price: 4, tags: ['vegan'],
          options: [{ name: 'Tea', choices: ['English breakfast', 'Earl Grey', 'Chamomile'] }] }
      ] }
    ]
  };
})();
