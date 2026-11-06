/* Site content for FORNACE (invented Neapolitan pizzeria, sample design by Website Studio).
   Everything here is invented SAMPLE content: names, dishes, prices, hours and times are samples.
   Photos are stock photographs (see the footer credits line). Shape: ../../shared/README.md. */
(function () {
  // img(name, alt, w, h, sizes): name-400.webp / name-800.webp in images/
  function img(name, alt, w, h, sizes) {
    return {
      src: 'images/' + name + '-800.webp',
      srcset: 'images/' + name + '-400.webp 400w, images/' + name + '-800.webp 800w',
      sizes: sizes || '(min-width: 72em) 22rem, (min-width: 40em) 45vw, 92vw',
      alt: alt, width: w, height: h
    };
  }
  var BUILD_TOPPINGS = ['None', { label: "Spicy 'nduja", price: 2.5 }, { label: 'Prosciutto crudo', price: 3 }, { label: 'Mushrooms', price: 1.5 },
    { label: 'Black olives', price: 1 }, { label: 'Rocket', price: 1 }, { label: 'Aubergine', price: 1.5 }, { label: 'Burrata', price: 3.5 }];

  window.SITE = {
    slug: 'fornace-pizza',
    name: 'Fornace',
    tagline: 'Fired fast. Eaten faster.',
    cuisine: 'Neapolitan pizza',
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
      { day: 'tue', open: '12:00', close: '15:00' }, { day: 'tue', open: '17:30', close: '22:30' },
      { day: 'wed', open: '12:00', close: '15:00' }, { day: 'wed', open: '17:30', close: '22:30' },
      { day: 'thu', open: '12:00', close: '15:00' }, { day: 'thu', open: '17:30', close: '22:30' },
      { day: 'fri', open: '12:00', close: '23:30' },
      { day: 'sat', open: '12:00', close: '23:30' },
      { day: 'sun', open: '12:00', close: '21:30' }
    ],
    timing: { pickupMinutes: 15, deliveryMinutes: 35, slotStepMinutes: 15 },
    order: { delivery: true, deliveryFee: 2.5, deliveryMinimum: 15, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0, maxQty: 20 },
    reservation: { stepMinutes: 30, lastSeatingMinutes: 60, leadMinutes: 60, maxParty: 8, defaultParty: 2, daysAhead: 60 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: {
      vegetarian: { label: 'Vegetarian' },
      vegan: { label: 'Vegan' },
      spicy: { label: 'Spicy' }
    },
    ui: { cartTitle: 'Your order', popularLabel: 'Fan favourite', addLabel: 'Add', addedLabel: 'Added' },
    menu: [
      { id: 'classiche', name: 'Classic pizzas', description: 'Tomato base, blistered crust. Each pizza is about 12 inches [to confirm].', items: [
        { id: 'margherita', name: 'Margherita', description: 'Tomato, fior di latte, basil, olive oil.', price: 13, tags: ['vegetarian'], popular: true,
          img: img('margherita', 'Close-up of a margherita pizza with tomato, melted mozzarella, basil leaves and a charred crust', 800, 533) },
        { id: 'marinara', name: 'Marinara', description: 'Tomato, garlic, oregano, olive oil. No cheese.', price: 10, tags: ['vegan'],
          img: img('marinara', 'Top view of a marinara pizza: tomato sauce sprinkled with dried oregano, no cheese', 800, 600) },
        { id: 'bufala', name: 'Margherita bufala', description: 'Tomato, buffalo mozzarella, basil, olive oil.', price: 16, tags: ['vegetarian'],
          img: img('bufala', 'A margherita-style pizza with mozzarella, basil and a deeply charred crust on a wooden board', 800, 450) },
        { id: 'ortolana', name: 'Ortolana', description: 'Tomato, fior di latte, peppers, olives, onion.', price: 15, tags: ['vegetarian'],
          img: img('ortolana', 'Side view of a vegetable pizza with olives and peppers baking on the stone floor of an oven', 800, 600) }
      ] },
      { id: 'speciali', name: 'Burrata & specials', description: 'Pizzas topped with burrata, cured meats and more.', items: [
        { id: 'burrata-basilico', name: 'Burrata e basilico', description: 'Tomato, pieces of burrata, grated hard cheese, basil.', price: 17, tags: ['vegetarian'], popular: true,
          img: img('burrata-basilico', 'Pizza topped with tomato, torn pieces of burrata, grated cheese and fresh basil leaves', 800, 1067) },
        { id: 'nduja-burrata', name: "'Nduja e burrata", description: "Tomato, mozzarella, roasted peppers, a whole burrata, spicy 'nduja and rocket.", price: 18, tags: ['spicy'], popular: true,
          img: img('nduja-burrata', 'Pizza with roasted peppers and rocket, a whole burrata in the centre topped with a red spicy spread', 800, 1067) },
        { id: 'crudo-burrata', name: 'Crudo e burrata', description: 'Tomato, prosciutto crudo, cherry tomatoes, rocket, a whole burrata.', price: 19, popular: true,
          img: img('crudo', 'Top view of a pizza with prosciutto, halved cherry tomatoes, rocket and a whole burrata in the centre', 800, 600) },
        { id: 'mortadella', name: 'Mortadella e pistacchio', description: 'White base, mortadella, pistachio pesto, crushed pistachios, burrata.', price: 19,
          img: img('mortadella', 'A white pizza with folded slices of mortadella, pistachio pesto, crushed pistachios and a burrata', 800, 600) }
      ] },
      { id: 'build', name: 'Build & share', description: 'Make it yours, or feed two.', items: [
        { id: 'build-your-own', name: 'Build your own pizza', description: 'Pick base, cheese and two toppings in your basket. Price shown is the plain base; toppings add their price.', price: 11,
          img: img('dough', 'Floured hands pressing out a round of pizza dough on a marble counter', 800, 450),
          options: [
            { name: 'Base', choices: ['Rossa (tomato)', 'Bianca (no tomato)'] },
            { name: 'Cheese', choices: ['Fior di latte', { label: 'Buffalo mozzarella', price: 2 }, 'No cheese'] },
            { name: 'Topping 1', choices: BUILD_TOPPINGS },
            { name: 'Topping 2', choices: BUILD_TOPPINGS }
          ] },
        { id: 'margherita-for-two', name: 'Two margheritas', description: 'Two classic margheritas, packed together. Easy dinner for two.', price: 24, tags: ['vegetarian'],
          img: img('for-two', 'Two people holding two margherita pizzas with mozzarella and basil on a grey table', 800, 1000) }
      ] },
      { id: 'fritti', name: 'Fried & starters', items: [
        { id: 'arancini', name: 'Arancini', description: 'Two crisp cone-shaped rice balls with a ragù filling, on rocket.', price: 9,
          img: img('arancini', 'Two golden, breadcrumbed cone-shaped arancini on a bed of rocket on a wooden board', 800, 1200) },
        { id: 'burrata-pomodoro', name: 'Burrata e pomodoro', description: 'A whole burrata on sliced tomatoes with herbs, pesto and balsamic.', price: 14, tags: ['vegetarian'],
          img: img('burrata-pomodoro', 'A whole burrata on a plate of sliced tomatoes with herbs, cherry tomatoes and drops of balsamic', 800, 1200) }
      ] },
      { id: 'dolci', name: 'Dessert & drinks', items: [
        { id: 'tiramisu', name: 'Tiramisu', description: 'Coffee-soaked biscuits, mascarpone cream, cocoa.', price: 8, tags: ['vegetarian'],
          img: img('tiramisu', 'A square of tiramisu dusted with cocoa and topped with mint on a pale blue plate', 800, 533) },
        { id: 'lemon-soda', name: 'Sparkling lemon soda', description: 'Chilled can.', price: 4, tags: ['vegan'] },
        { id: 'water', name: 'Mineral water', description: 'Still or sparkling, 500 ml bottle.', price: 3, tags: ['vegan'],
          options: [{ name: 'Type', choices: ['Sparkling', 'Still'] }] },
        { id: 'espresso', name: 'Espresso', description: 'A short black coffee to finish.', price: 3, tags: ['vegan'] }
      ] }
    ]
  };
})();
