/* The Kailash Room: invented SAMPLE business. Names, dishes, prices and hours are samples.
   Shape documented in ../../shared/README.md. Classic script: sets window.SITE only. */
(function () {
  function img(name, w, h, alt) {
    var h4 = Math.round(h * 400 / w);
    return {
      src: 'images/' + name + '-800.webp',
      srcset: 'images/' + name + '-400.webp 400w, images/' + name + '-800.webp 800w',
      sizes: '(min-width: 60em) 24vw, (min-width: 40em) 45vw, 92vw',
      alt: alt, width: 800, height: h, _h4: h4
    };
  }

  window.SITE = {
    slug: 'kailash-room',
    name: 'The Kailash Room',
    tagline: 'An evening of Himalayan spice and the tandoor.',
    cuisine: 'Indo-Nepali fine dining',
    locale: 'en-US',
    currency: 'USD',
    contact: {
      address: '[address]',
      phone: '[phone]',
      phoneTel: '+15555550142',
      email: '[email]',
      directionsUrl: ''
    },
    hoursAreSample: true,
    hours: [
      { day: 'mon', closed: true },
      { day: 'tue', open: '17:30', close: '22:00' },
      { day: 'wed', open: '17:30', close: '22:00' },
      { day: 'thu', open: '17:30', close: '22:00' },
      { day: 'fri', open: '17:30', close: '23:00' },
      { day: 'sat', open: '17:00', close: '23:00' },
      { day: 'sun', open: '17:00', close: '21:30' }
    ],
    timing: { pickupMinutes: 30, deliveryMinutes: 50, slotStepMinutes: 15 },
    order: { delivery: true, deliveryFee: 6, deliveryMinimum: 40, tips: [0, 15, 18, 20], defaultTip: 0, taxRate: 0, maxQty: 12 },
    reservation: { stepMinutes: 15, lastSeatingMinutes: 90, leadMinutes: 120, maxParty: 8, defaultParty: 2, daysAhead: 60 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: {
      vegetarian: { label: 'Vegetarian' },
      vegan: { label: 'Vegan' },
      spicy: { label: 'Spicy' },
      'gluten-free': { label: 'Gluten-free [to confirm]' }
    },
    ui: { cartTitle: 'Your order', popularLabel: 'House signature', addLabel: 'Add', addedLabel: 'Added' },
    menu: [
      { id: 'first', name: 'First plates', description: 'Small plates to open the evening.', items: [
        { id: 'samosa', name: 'Samosa, tamarind and mint', description: 'Crisp pastries filled with spiced potato and peas, with tamarind and mint chutneys.', price: 11, tags: ['vegetarian'],
          img: img('samosas-dark', 800, 533, 'Golden samosas on a round wooden plate with onion rings and green chillies') },
        { id: 'momo', name: 'Momo, timur achar', description: 'Steamed dumplings with a roasted tomato and timur achar. Chicken or vegetable.', price: 17, tags: ['spicy'], popular: true,
          img: img('fried-dumplings-black-bowl', 800, 1120, 'Momo dumplings in a black bowl with a smear of sauce'),
          options: [{ name: 'Filling', choices: ['Chicken', 'Vegetable'] }] },
        { id: 'paneer-tikka', name: 'Timur paneer tikka', description: 'Paneer and peppers marinated in yoghurt and spice, finished in the tandoor, with a timur pepper glaze.', price: 19, tags: ['vegetarian'], popular: true,
          img: img('paneer-tikka-skewers', 800, 533, 'Grilled paneer cubes and yellow pepper on skewers with a red sauce') },
        { id: 'choila', name: 'Chicken choila', description: 'Grilled chicken tossed with mustard oil, garlic, ginger, chilli and timur. Served cool, Newari style.', price: 18, tags: ['spicy'] }
      ] },
      { id: 'tandoor', name: 'From the tandoor', description: 'Cooked in the clay oven.', items: [
        { id: 'tandoori-chicken', name: 'Tandoori chicken tikka', description: 'Boneless chicken pieces in a yoghurt and Kashmiri chilli marinade, served sizzling with onion and lemon.', price: 29, tags: ['spicy'], popular: true,
          img: img('tandoori-chicken-sizzler', 800, 617, 'Red-marinated tandoori chicken pieces on a cast-iron sizzler with onion, lettuce and lemon') },
        { id: 'lamb-chops', name: 'Tandoori lamb chops', description: 'Lamb chops marinated with ginger, garlic and garam masala, with a mint chutney.', price: 42, tags: [] },
        { id: 'garlic-naan', name: 'Coriander naan', description: 'Leavened bread from the tandoor, brushed with butter and coriander.', price: 7, tags: ['vegetarian'],
          img: img('naan-and-curry', 800, 533, 'Coriander-topped naan beside a small pot of red curry, rice and salad on a dark blue surface') }
      ] },
      { id: 'mains', name: 'Mains', description: 'Served with steamed basmati rice unless noted.', items: [
        { id: 'butter-chicken', name: 'Butter chicken', description: 'Tandoor-roasted chicken in a silky tomato, butter and fenugreek sauce.', price: 31, tags: [], popular: true,
          img: img('four-curries-dark-wood', 800, 572, 'Four curries in bowls seen from above on dark wood, including a creamy orange chicken curry') },
        { id: 'kukhura', name: 'Kukhura ko masu', description: 'Nepali-style chicken curry on the bone with tomato, ginger, cumin and a little timur.', price: 30, tags: ['spicy'],
          img: img('chicken-curry-with-rice', 800, 1000, 'Chicken curry with a drumstick in a copper bowl beside a bowl of basmati rice, lime and mint') },
        { id: 'khasi', name: 'Khasi ko masu', description: 'Slow-cooked goat curry on the bone with onion, whole spices and chilli.', price: 38, tags: ['spicy'],
          img: img('mutton-curry-copper-bowl', 800, 600, 'Dark meat curry on the bone in a hammered copper bowl with dried chillies') },
        { id: 'biryani', name: 'Chicken dum biryani', description: 'Basmati rice layered with spiced chicken and mint, sealed and slow-cooked.', price: 33, tags: [],
          img: img('chicken-biryani-dark', 800, 1200, 'Two black plates of spiced rice with chicken and mint, seen from above') },
        { id: 'jimbu-dal', name: 'Jimbu dal', description: 'Yellow lentils tempered in ghee with jimbu, cumin and garlic.', price: 21, tags: ['vegetarian'] },
        { id: 'saffron-rice', name: 'Saffron basmati', description: 'Steamed basmati rice with saffron and ghee.', price: 7, tags: ['vegetarian'] }
      ] },
      { id: 'sweets', name: 'Sweets and chai', description: 'To close the evening.', items: [
        { id: 'gulab-jamun', name: 'Gulab jamun', description: 'Warm milk dumplings in cardamom and rose syrup.', price: 12, tags: ['vegetarian'],
          img: img('gulab-jamun', 800, 1198, 'Gulab jamun in a white bowl on a dark surface') },
        { id: 'masala-chai', name: 'Masala chai', description: 'Black tea simmered with milk, cardamom, cinnamon and ginger.', price: 7, tags: ['vegetarian'], popular: true,
          img: img('spiced-milk-tea', 800, 1200, 'Milky tea in a ceramic cup topped with cinnamon sticks, star anise and rose petals') },
        { id: 'mango-lassi', name: 'Mango lassi', description: 'Yoghurt blended with mango and a pinch of cardamom.', price: 9, tags: ['vegetarian'],
          img: img('mango-lassi', 800, 600, 'Two glasses of mango drink topped with mango pieces beside cinnamon sticks and a whole mango') }
      ] }
    ]
  };
  // drop helper-only fields
  window.SITE.menu.forEach(function (c) { c.items.forEach(function (i) { if (i.img) delete i.img._h4; }); });
})();
