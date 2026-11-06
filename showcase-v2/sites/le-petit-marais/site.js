/* Le Petit Marais: site content. Everything here is invented SAMPLE content for an invented business:
   names, dishes, prices, hours and the menu du jour are samples. Photos are stock (not the client's food).
   Shape documented in ../../shared/README.md. Classic script: sets window.SITE only. */
(function () {
  // img(name, w800, h800, alt, sizes): uses images/<name>-400.webp and -800.webp
  function img(name, w, h, alt, sizes) {
    return {
      src: 'images/' + name + '-800.webp',
      srcset: 'images/' + name + '-400.webp 400w, images/' + name + '-800.webp 800w',
      sizes: sizes || '(min-width: 72em) 22rem, (min-width: 40em) 45vw, 92vw',
      alt: alt, width: w, height: h
    };
  }

  window.SITE = {
    slug: 'le-petit-marais',
    name: 'Le Petit Marais',
    tagline: 'Bistro classics, at our table or yours.',
    cuisine: 'French bistro',
    locale: 'en-US',
    currency: 'USD',
    contact: {
      address: '[address]',
      phone: '[phone]',
      phoneTel: '+15555550100',        // fictional 555-01xx number until the client supplies one
      email: '[email]',
      directionsUrl: ''
    },
    hoursAreSample: true,
    hours: [
      { day: 'mon', closed: true },
      { day: 'tue', open: '12:00', close: '14:30' }, { day: 'tue', open: '18:00', close: '22:00' },
      { day: 'wed', open: '12:00', close: '14:30' }, { day: 'wed', open: '18:00', close: '22:00' },
      { day: 'thu', open: '12:00', close: '14:30' }, { day: 'thu', open: '18:00', close: '22:00' },
      { day: 'fri', open: '12:00', close: '14:30' }, { day: 'fri', open: '18:00', close: '23:00' },
      { day: 'sat', open: '12:00', close: '23:00' },
      { day: 'sun', open: '12:00', close: '16:00' }
    ],
    timing: { pickupMinutes: 25, deliveryMinutes: 45, slotStepMinutes: 15 },
    order: { delivery: true, deliveryFee: 4, deliveryMinimum: 25, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0 },
    reservation: { stepMinutes: 30, lastSeatingMinutes: 60, leadMinutes: 60, maxParty: 8, defaultParty: 2, daysAhead: 60 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: {
      vegetarian: { label: 'Vegetarian' },
      vegan: { label: 'Vegan' }
    },
    ui: { cartTitle: 'Your order', popularLabel: 'Signature', addLabel: 'Add', addedLabel: 'Added' },
    menu: [
      { id: 'jour', name: 'Menu du jour', description: 'Sample prix-fixe: three courses, one price. Choose each course in your order.', items: [
        { id: 'menu-du-jour', name: 'Menu du jour, three courses',
          description: 'One entrée, one plat and one dessert from the choices below. Pick them in your order after you tap Add.',
          price: 42, tags: [],
          img: img('saucing', 800, 533, 'A cook spooning sauce over plated dishes in a dim kitchen'),
          options: [
            { name: 'Entrée', choices: ['Soupe à l\'oignon gratinée', 'Velouté du jour', { label: 'Escargots au beurre persillé', price: 4 }] },
            { name: 'Plat', choices: ['Poulet à l\'orange','Daube de bœuf', 'Moules marinières, frites'] },
            { name: 'Dessert', choices: ['Crème brûlée', 'Tarte aux prunes', 'Tarte amandine'] }
          ] }
      ] },
      { id: 'entrees', name: 'Entrées', description: 'To begin, or to share.', items: [
        { id: 'soupe-oignon', name: 'Soupe à l\'oignon gratinée', description: 'Onion broth under a lid of toasted bread and melted, browned cheese.', price: 12, tags: [], popular: true,
          img: img('onion-soup', 800, 601, 'Onion soup with a browned cheese crust, a spoon lifting the first bite, seen from above') },
        { id: 'escargots', name: 'Escargots au beurre persillé', description: 'Snails baked in garlic and parsley butter, with sliced baguette for the butter.', price: 15, tags: [], popular: true,
          img: img('escargots', 800, 1067, 'Baked snails in parsley butter beside a wooden tray of sliced baguette and a glass of white wine') },
        { id: 'veloute', name: 'Velouté du jour', description: 'Smooth soup of the day with a crisp topping, herb oil and toasted croutons.', price: 11, tags: [],
          img: img('veloute', 800, 600, 'A smooth beige soup with a crisp golden topping and green herb oil, croutons on the side') },
        { id: 'chevre-chaud', name: 'Salade de chèvre chaud', description: 'Warm goat\'s cheese on toast, bitter leaves, walnuts and a honey dressing.', price: 13, tags: ['vegetarian'] }
      ] },
      { id: 'plats', name: 'Plats', description: 'The bistro mains.', items: [
        { id: 'steak-frites', name: 'Steak frites, sauce béarnaise', description: 'Sliced grilled steak on béarnaise, with a generous heap of golden fries.', price: 29, tags: [],
          img: img('steak-frites', 800, 1200, 'Sliced steak on a pool of béarnaise sauce with a heap of fries, held out on a plate'),
          options: [{ name: 'Cooking', choices: ['Medium rare', 'Rare', 'Medium', 'Well done'] }] },
        { id: 'poulet-orange', name: 'Poulet à l\'orange', description: 'Glazed chicken leg on buttery mashed potato, orange sauce and herb oil.', price: 24, tags: [], popular: true,
          img: img('poulet-orange', 800, 600, 'A glazed chicken leg on mashed potato with orange sauce and green herb oil in a speckled bowl') },
        { id: 'moules', name: 'Moules marinières, frites', description: 'Mussels steamed with white wine, garlic and parsley, with a side of fries.', price: 24, tags: [],
          img: img('moules', 800, 533, 'A bowl of steamed mussels with chopped parsley, fries on the side') },
        { id: 'daube', name: 'Daube de bœuf', description: 'Beef braised in red wine with tomato, small onions and mushrooms. Photo is illustrative.', price: 27, tags: [],
          img: img('daube', 800, 1200, 'A dark meat braise with tomato and small round vegetables on a dark plate, a glass and a fork beside it') }
      ] },
      { id: 'desserts', name: 'Desserts', description: 'To finish.', items: [
        { id: 'creme-brulee', name: 'Crème brûlée', description: 'Vanilla custard under a crackling, torched sugar crust.', price: 10, tags: ['vegetarian'], popular: true,
          img: img('creme-brulee', 800, 1422, 'A cook torching the sugar crust of a crème brûlée in a speckled dish') },
        { id: 'tarte-prunes', name: 'Tarte aux prunes', description: 'Sliced plums baked on buttery pastry. By the slice.', price: 9, tags: ['vegetarian'],
          img: img('tarte-prunes', 800, 533, 'A tart of sliced dark fruit in its tin, with fresh plums, nuts and dried apricots around it, seen from above') },
        { id: 'tarte-amandine', name: 'Tarte amandine', description: 'Almond tart with baked fruit, finished with flaked almonds.', price: 10, tags: ['vegetarian'],
          img: img('tarte-amandine', 800, 584, 'A small almond tart topped with baked fruit slices and flaked almonds on a white plate') },
        { id: 'mousse', name: 'Mousse au chocolat', description: 'Dark chocolate mousse, light and deep at once.', price: 9, tags: ['vegetarian'] }
      ] }
    ]
  };
})();
