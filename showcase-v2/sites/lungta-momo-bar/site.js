/* Lungta Momo Bar: site content. Everything here is invented SAMPLE content for an invented business:
   the name, dishes, descriptions, prices and hours are samples for the client to replace.
   Shape documented in ../../shared/README.md. Classic script: sets window.SITE only. */
(function () {
  var P = 'images/lungta-momo-bar-';
  // photo helper: base name, alt (what the photo really shows), 800 px size
  function img(base, alt, w, h) {
    return {
      src: P + base + '-800.webp',
      srcset: P + base + '-400.webp 400w, ' + P + base + '-800.webp 800w',
      sizes: '(min-width: 64em) 22vw, (min-width: 40em) 45vw, 92vw',
      alt: alt, width: w, height: h
    };
  }
  // reused from the shared Indo-Nepali library (photos/mustang-hearth)
  function mh(base, alt, w, h) {
    return {
      src: 'images/mustang-hearth-' + base + '-800.webp',
      srcset: 'images/mustang-hearth-' + base + '-400.webp 400w, images/mustang-hearth-' + base + '-800.webp 800w',
      sizes: '(min-width: 64em) 22vw, (min-width: 40em) 45vw, 92vw',
      alt: alt, width: w, height: h
    };
  }
  var FILLING = { name: 'Filling', choices: ['Chicken', 'Pork', 'Mixed veg', { label: 'Paneer and spinach', price: 1 }] };

  window.SITE = {
    slug: 'lungta-momo-bar',
    name: 'Lungta Momo Bar',
    tagline: 'Build your momo box.',
    cuisine: 'Kathmandu street-style momo',
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
      { day: 'tue', open: '11:00', close: '22:00' },
      { day: 'wed', open: '11:00', close: '22:00' },
      { day: 'thu', open: '11:00', close: '22:00' },
      { day: 'fri', open: '11:00', close: '23:30' },
      { day: 'sat', open: '11:00', close: '23:30' },
      { day: 'sun', open: '12:00', close: '21:00' }
    ],
    timing: { pickupMinutes: 15, deliveryMinutes: 40, slotStepMinutes: 15 },
    order: { delivery: true, deliveryFee: 3.5, deliveryMinimum: 15, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0, maxQty: 20 },
    reservation: { stepMinutes: 30, lastSeatingMinutes: 60, leadMinutes: 60, maxParty: 8, defaultParty: 2, daysAhead: 60 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: {
      vegetarian: { label: 'Vegetarian' },
      vegan: { label: 'Vegan' },
      spicy: { label: 'Spicy' }
    },
    ui: { cartTitle: 'Your momo order', popularLabel: 'Favourite', addLabel: 'Add', addedLabel: 'Added' },
    schema: true,
    menu: [
      { id: 'momo', name: 'Momo', description: 'Pleated dumplings, made to order. Every plate comes with achar (a tomato-sesame dipping sauce).', items: [
        { id: 'momo-box', name: 'Build-your-own momo box', description: 'Pick the filling, the cooking style, the achar and the size. Price changes with your picks.', price: 11, popular: true,
          img: img('01-steamed-momos-white-plate', 'Six pleated steamed dumplings on a white plate with a small cup of orange-red dipping sauce', 800, 534),
          options: [
            FILLING,
            { name: 'Style', choices: ['Steamed', { label: 'Kothey (pan-fried)', price: 1 }, { label: 'Fried', price: 1 }, { label: 'Jhol (in sesame-tomato broth)', price: 2 }, { label: 'Chilli (wok-tossed)', price: 2 }] },
            { name: 'Achar', choices: ['Tomato-sesame', 'Timur chilli (hot)', 'Mild peanut-sesame'] },
            { name: 'Size', choices: ['8 pieces', { label: '12 pieces', price: 5 }, { label: '20 pieces (to share)', price: 12 }] }
          ] },
        { id: 'steamed-momo', name: 'Steamed momo', description: 'Eight steamed momo with tomato-sesame achar and a spoon of chilli chutney on the side.', price: 11, popular: true,
          img: img('04-steamed-momos-red-chilli-chutney', 'A plate of round steamed dumplings next to a bowl of dark red chilli chutney', 800, 1067),
          options: [FILLING] },
        { id: 'kothey-momo', name: 'Kothey momo', description: 'Pan-fried on one side until the bottoms are crisp, steamed on top. Eight pieces.', price: 12.5, popular: true,
          img: img('03-pan-fried-dumplings-crisp', 'Pan-fried dumplings in a ring on a white plate, crisp brown bottoms up, with spring onion and sesame', 800, 533),
          options: [FILLING] },
        { id: 'jhol-momo', name: 'Jhol momo', description: 'Steamed momo served in a warm, tangy sesame-tomato broth (jhol). Eight pieces.', price: 13, tags: ['spicy'],
          img: mh('09-jhol-momo', 'Dumplings in a savoury broth with chutneys and cutlery on a wooden table', 800, 527),
          options: [FILLING] },
        { id: 'chilli-momo', name: 'Chilli momo', description: 'Fried momo tossed in the wok with peppers, onion and a sticky chilli sauce. Eight pieces.', price: 13.5, tags: ['spicy'],
          options: [FILLING] },
        { id: 'half-moon-momo', name: 'Half-moon momo', description: 'Half-moon folded momo steamed in a bamboo basket, with a bowl of chilli sauce. Ten pieces.', price: 11.5, options: [{ name: 'Filling', choices: ['Chicken', 'Pork'] }],
          img: img('02-dumplings-bamboo-steamer-chilli-sauce', 'Half-moon steamed dumplings in a bamboo steamer with a bowl of red chilli sauce beside it', 800, 533) },
        { id: 'take-home-momo', name: 'Take-home momo pack', description: 'Twenty-five raw folded momo, frozen, with a tub of achar. Steam at home in about 12 minutes [cooking time: client to confirm].', price: 18,
          img: img('12-hands-making-dumplings', 'Hands folding dumplings at a table with a tray of raw dumplings, a bowl of filling and a bamboo steamer', 800, 533),
          options: [{ name: 'Filling', choices: ['Chicken', 'Pork', 'Mixed veg'] }] }
      ] },
      { id: 'noodles', name: 'Noodles and soup', items: [
        { id: 'thukpa', name: 'Thukpa', description: 'Himalayan noodle soup: noodles and vegetables in a hot, lightly spiced broth with garlic and ginger. Add chicken if you like.', price: 13,
          options: [{ name: 'Protein', choices: ['Vegetables only', { label: 'Chicken', price: 2 }, { label: 'Egg', price: 1 }] }] },
        { id: 'chowmein', name: 'Chowmein', description: 'Wok-fried noodles with cabbage, carrot, onion and egg.', price: 12, popular: true,
          img: img('06-stir-fried-noodles-wok', 'Stir-fried noodles with carrot, greens, onion and egg in a black wok', 800, 1023),
          options: [{ name: 'Protein', choices: ['Egg', { label: 'Chicken', price: 2 }, 'Vegetables only'] }] }
      ] },
      { id: 'grill', name: 'Sekuwa and grill', items: [
        { id: 'chicken-sekuwa', name: 'Chicken sekuwa', description: 'Spiced chicken skewers grilled over high heat, with lemon and a side of beaten rice (chiura).', price: 14, tags: ['spicy'],
          img: mh('17-chicken-over-flame', 'Marinated chicken pieces grilling over an open flame', 800, 533) },
        { id: 'chicken-choila', name: 'Chicken choila', description: 'Grilled chicken pulled and tossed with mustard oil, garlic, ginger and chilli. Served cold or room temperature.', price: 13, tags: ['spicy'] }
      ] },
      { id: 'chaat', name: 'Chatpate and chaat', items: [
        { id: 'pani-puri', name: 'Pani puri', description: 'Crisp hollow puri filled with spiced chickpeas, with a bowl of tangy mint-tamarind water to pour in. Eight pieces.', price: 8, tags: ['vegan', 'spicy'],
          img: img('08-pani-puri-green-pani', 'Puri filled with chickpeas on a floral plate next to a bowl of green spiced water', 800, 1200) },
        { id: 'chatpate', name: 'Chatpate', description: 'Kathmandu street snack: puffed rice tossed with potato, onion, tomato, peanuts, lime and chilli.', price: 7, tags: ['vegetarian', 'spicy'],
          img: img('09-bhel-puri-puffed-rice', 'A bowl of puffed rice mixed with sev, peanuts and coriander', 800, 1067) },
        { id: 'aloo-sadeko', name: 'Aloo sadeko', description: 'Boiled potato tossed with toasted sesame, mustard oil, chilli, lime and fenugreek.', price: 6.5, tags: ['vegan', 'spicy'] }
      ] },
      { id: 'drinks', name: 'Chiya and drinks', items: [
        { id: 'masala-chiya', name: 'Masala chiya', description: 'Milky tea brewed with ginger, cardamom and cloves.', price: 3.5, tags: ['vegetarian'], popular: true,
          img: img('10-masala-chai-glass-ginger', 'A glass of milky tea beside a piece of fresh ginger root', 800, 533) },
        { id: 'mango-lassi', name: 'Mango lassi', description: 'Mango blended with yoghurt and a little sugar.', price: 5.5, tags: ['vegetarian'],
          img: img('11-mango-lassi-glasses', 'Two glasses of mango lassi topped with mango pieces next to a whole mango', 800, 600) },
        { id: 'lemon-soda', name: 'Fresh lime soda', description: 'Lime, soda and a pinch of black salt. Sweet or salted.', price: 4, tags: ['vegan'],
          options: [{ name: 'Style', choices: ['Sweet', 'Salted', 'Half and half'] }] }
      ] }
    ]
  };
})();
