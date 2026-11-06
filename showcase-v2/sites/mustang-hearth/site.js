/* Mustang Hearth: site content. Everything here is invented SAMPLE content for an invented business:
   dish names, descriptions, prices and hours are samples. Photos are stock (see the footer credits line).
   Shape documented in ../../shared/README.md. Classic script: sets window.SITE only. */
(function () {
  // On the menu page cards are compact rows, so a smaller image is enough there.
  var onMenu = /menu\.html$/.test(location.pathname);
  var SIZES = onMenu ? '(min-width: 60em) 12rem, 8rem' : '(min-width: 60em) 22vw, (min-width: 40em) 45vw, 92vw';

  // Photo helper: every file exists as images/<name>-400.webp and -800.webp.
  function photo(name, alt, h) {
    return {
      src: 'images/' + name + '-800.webp',
      srcset: 'images/' + name + '-400.webp 400w, images/' + name + '-800.webp 800w',
      sizes: SIZES, alt: alt, width: 800, height: h || 533
    };
  }

  window.SITE = {
    slug: 'mustang-hearth',
    name: 'Mustang Hearth',
    tagline: 'Hand-folded momos. Fire from the tandoor.',
    cuisine: 'Indo-Nepali',
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
      { day: 'tue', open: '11:30', close: '14:30' }, { day: 'tue', open: '17:00', close: '22:00' },
      { day: 'wed', open: '11:30', close: '14:30' }, { day: 'wed', open: '17:00', close: '22:00' },
      { day: 'thu', open: '11:30', close: '14:30' }, { day: 'thu', open: '17:00', close: '22:00' },
      { day: 'fri', open: '11:30', close: '14:30' }, { day: 'fri', open: '17:00', close: '23:00' },
      { day: 'sat', open: '12:00', close: '23:00' },
      { day: 'sun', open: '12:00', close: '21:30' }
    ],
    timing: { pickupMinutes: 20, deliveryMinutes: 45, slotStepMinutes: 15 },
    order: { delivery: true, deliveryFee: 3.5, deliveryMinimum: 18, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0, maxQty: 20 },
    reservation: { stepMinutes: 30, lastSeatingMinutes: 60, leadMinutes: 60, maxParty: 8, defaultParty: 2, daysAhead: 60 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: {
      vegetarian: { label: 'Vegetarian' },
      vegan: { label: 'Vegan' },
      spicy: { label: 'Spicy' },
      'gluten-free': { label: 'Gluten-free [to confirm]' }
    },
    ui: { cartTitle: 'Your order', popularLabel: 'House favourite', addLabel: 'Add', addedLabel: 'Added' },
    schema: true,
    menu: [
      { id: 'momos', name: 'Momos', description: 'Pleated by hand and steamed to order. Choose chicken or vegetable in your order.', items: [
        { id: 'steam-momo', name: 'Steamed momo', description: 'Pleated dumplings straight from the steamer, soft and juicy.', price: 13, tags: [],
          img: photo('steaming-dumplings', 'Steam rising from pleated dumplings on a white plate', 531),
          options: [{ name: 'Filling', choices: ['Chicken', 'Vegetable', { label: 'Paneer and spinach', price: 1 }] }] },
        { id: 'jhol-momo', name: 'Jhol momo', description: 'Chicken momos in a warm, creamy sesame jhol, with two chutneys on the side.', price: 14.5, tags: [], popular: true,
          img: photo('jhol-momo', 'Pleated dumplings in a pale, creamy broth in a glass bowl, with two small bowls of chutney', 527),
          options: [{ name: 'Filling', choices: ['Chicken', 'Vegetable'] }] },
        { id: 'house-momo', name: 'House momo plate', description: 'Plump momos with a fiery tomato achar and a cooling herb yoghurt.', price: 13.5, tags: [],
          img: photo('momos-dark-hero', 'Five round dumplings on a dark plate with a bowl of red chilli sauce and a bowl of yoghurt dip'),
          options: [{ name: 'Filling', choices: ['Chicken', 'Vegetable'] }] },
        { id: 'chilli-soy-momo', name: 'Chilli-soy momo', description: 'Steamed momos finished with a dark chilli-soy glaze, fresh herbs and pea shoots.', price: 14, tags: ['spicy'],
          img: photo('momos-on-slate', 'Five dumplings with dots of dark glaze and herbs on a black slate plate, chopsticks alongside'),
          options: [{ name: 'Filling', choices: ['Chicken', 'Vegetable'] }] }
      ] },
      { id: 'fire', name: 'From the fire', description: 'Marinated, then roasted in the clay oven or grilled over open flame.', items: [
        { id: 'tandoori-chicken', name: 'Tandoori chicken', description: 'Bone-in chicken in yoghurt, chilli and garam masala, with mint chutney and lemon.', price: 18, tags: ['spicy'], popular: true,
          img: photo('tandoori-chicken', 'Charred tandoori chicken pieces on a white platter with lemon wedges and a pot of green chutney'),
          options: [{ name: 'Size', choices: ['Half', { label: 'Whole', price: 10 }] }] },
        { id: 'chicken-sekuwa', name: 'Chicken sekuwa', description: 'Nepali-spiced chicken, grilled over open flame. Served with beaten-rice crisps and pickle.', price: 12, tags: ['spicy'],
          img: photo('chicken-over-flame', 'Spiced chicken pieces grilling over an open flame') }
      ] },
      { id: 'thalis', name: 'Thali and curries', description: 'A thali is a whole meal on one brass tray. Pick your curry and bread in your order.', items: [
        { id: 'thali', name: 'Mustang thali', description: 'Your choice of curry with dal, stuffed kulcha, onion, lime and green chilli on one brass tray.', price: 21, tags: [], popular: true,
          img: photo('thali-gold-platter', 'A brass thali tray with two bowls of curry, a stuffed flatbread, sliced onion, lime and a green chilli', 600),
          options: [
            { name: 'Curry', choices: ['Vegetable', { label: 'Chicken', price: 2 }, { label: 'Lamb', price: 5 }] },
            { name: 'Bread', choices: ['Stuffed kulcha', 'Tandoori roti', { label: 'Garlic naan', price: 1 }] }
          ] },
        { id: 'lamb-curry', name: 'Lamb curry, Nepali style', description: 'Bone-in lamb, slow-cooked in a dark gravy of browned onion, ginger and whole spice.', price: 24, tags: ['spicy'], popular: true,
          img: photo('lamb-curry', 'A bone-in lamb shank in dark red curry in a hammered metal pot, topped with coriander'),
          options: [{ name: 'Heat', choices: ['Medium', 'Mild', 'Hot'] }] },
        { id: 'dal-makhani', name: 'Dal makhani', description: 'Black lentils simmered low and slow in a tomato-butter gravy, finished with cream.', price: 15, tags: ['vegetarian'],
          img: photo('dal-makhani', 'A copper pan of orange-red dal with a swirl of cream and a knob of butter', 534) },
        { id: 'dum-aloo', name: 'Dum aloo', description: 'Potatoes cooked slowly in a mild, creamy tomato gravy with fresh herbs.', price: 15, tags: ['vegetarian'],
          img: photo('dum-aloo', 'Whole potatoes in a creamy orange gravy with herbs, in a two-handled metal bowl') },
        { id: 'chicken-biryani', name: 'Chicken biryani', description: 'Saffron rice layered with roasted chicken, with raita and salan on the side.', price: 20, tags: ['spicy'],
          img: photo('chicken-biryani', 'A bowl of yellow saffron rice topped with roasted chicken pieces, with small bowls of sauce around it', 600) }
      ] },
      { id: 'breads', name: 'Breads, rice and sides', description: 'Breads baked to order on the tandoor wall, plus rice and the house achar on the side.', items: [
        { id: 'tandoor-naan', name: 'Tandoor naan', description: 'Soft, blistered and brushed with butter.', price: 4, tags: ['vegetarian'],
          img: photo('naan-in-tandoor', 'Naan breads baking on the inside wall of a clay tandoor oven, with flames below'),
          options: [{ name: 'Style', choices: ['Butter', { label: 'Garlic and coriander', price: 0.5 }, 'Plain'] }] },
        { id: 'bread-basket', name: 'Bread basket', description: 'Naan, tandoori roti and a flaky lachha paratha, to share.', price: 9, tags: ['vegetarian'],
          img: photo('breads-naan-paratha', 'Three flatbreads on a dark background: a naan, a tandoori roti and a layered paratha') },
        { id: 'jeera-rice', name: 'Jeera rice', description: 'Basmati rice with toasted cumin and ghee.', price: 5, tags: ['vegetarian'] },
        { id: 'achar', name: 'Tomato-sesame achar', description: 'The house chutney, a little pot on the side.', price: 2, tags: ['vegan', 'spicy'] }
      ] },
      { id: 'drinks', name: 'Chai and sweets', items: [
        { id: 'masala-chai', name: 'Masala chai', description: 'Black tea brewed with milk, cardamom, ginger and cinnamon.', price: 4.5, tags: ['vegetarian'],
          img: photo('brass-kettle-chai', 'A brass kettle and two glasses of a warm, milky drink on a rustic wooden table') },
        { id: 'mango-lassi', name: 'Mango lassi', description: 'Mango, yoghurt and a pinch of cardamom, blended cold.', price: 5.5, tags: ['vegetarian'] },
        { id: 'gulab-jamun', name: 'Gulab jamun', description: 'Warm milk dumplings in rose and cardamom syrup.', price: 6, tags: ['vegetarian'] }
      ] }
    ]
  };
})();
