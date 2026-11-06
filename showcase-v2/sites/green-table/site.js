/* Green Table: site content. Everything here is invented SAMPLE content for an invented business:
   names, dishes, descriptions, prices and hours are samples for a client presentation.
   Photos are stock (photos/CREDITS.md); each photo is used only for the dish it shows.
   Shape documented in ../../shared/README.md. Classic script: sets window.SITE only. */
(function () {
  // h400/h800 = pixel heights of the 400w and 800w files (widths are 400 and 800).
  function photo(file, h800, alt, sizes) {
    return {
      src: 'images/' + file + '-800.webp',
      srcset: 'images/' + file + '-400.webp 400w, images/' + file + '-800.webp 800w',
      sizes: sizes || '(min-width: 75em) 22rem, (min-width: 40em) 45vw, 40vw',
      alt: alt, width: 800, height: h800
    };
  }

  window.SITE = {
    slug: 'green-table',
    name: 'Green Table',
    tagline: 'Bright bowls, slow brunch, ready when you are.',
    cuisine: 'Brunch and bowls',
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
      { day: 'mon', open: '07:30', close: '15:30' },
      { day: 'tue', open: '07:30', close: '15:30' },
      { day: 'wed', open: '07:30', close: '15:30' },
      { day: 'thu', open: '07:30', close: '15:30' },
      { day: 'fri', open: '07:30', close: '15:30' },
      { day: 'sat', open: '08:30', close: '16:00' },
      { day: 'sun', open: '08:30', close: '16:00' }
    ],
    timing: { pickupMinutes: 15, deliveryMinutes: 35, slotStepMinutes: 15 },
    order: { delivery: true, deliveryFee: 3, deliveryMinimum: 15, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0, maxQty: 20 },
    reservation: { stepMinutes: 30, lastSeatingMinutes: 60, leadMinutes: 60, maxParty: 8, defaultParty: 2, daysAhead: 60 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: {
      vegetarian: { label: 'Vegetarian' },
      vegan: { label: 'Vegan [to confirm]' }
    },
    ui: { cartTitle: 'Your order', popularLabel: 'Signature', addLabel: 'Add', addedLabel: 'Added' },
    schema: true,
    menu: [
      { id: 'bowls', name: 'Bowls', description: 'Lunch bowls for here or to take away. Swap the dressing in your cart.', items: [
        { id: 'sunny-squash-bowl', name: 'Sunny squash bowl', description: 'Roast squash, quinoa, spinach, avocado, crispy chickpeas, soft white cheese, cherry tomato and lemon.', price: 15, tags: ['vegetarian'],
          img: photo('green-table-01-salad-bowl-top', 600, 'Top view of a bowl of roast squash, quinoa, spinach, avocado, chickpeas, soft white cheese, cherry tomato and a lemon slice') },
        { id: 'golden-tofu-bowl', name: 'Golden tofu bowl', description: 'Turmeric tofu, steamed rice, avocado, cucumber, broccoli, carrot, cherry tomato, chickpeas, creamy dressing, black sesame.', price: 15.5, tags: ['vegan'],
          img: photo('green-table-12-tofu-avocado-bowl', 1067, 'Bowl of rice with golden tofu under a creamy dressing, avocado, cucumber, broccoli, grated carrot and cherry tomatoes') },
        { id: 'beet-tofu-bowl', name: 'Roast tofu and beet bowl', description: 'Roast tofu, beetroot, cherry tomato, roast greens, broccoli, leaves, toasted seeds and a creamy drizzle.', price: 15, tags: ['vegetarian'],
          img: photo('green-table-02-bowls-with-salads', 533, 'White bowl of roast tofu cubes, beetroot, cherry tomatoes, roast greens and leaves with a creamy drizzle') },
        { id: 'roast-plate', name: 'Turmeric roast plate', description: 'Turmeric cauliflower, roast carrots and tomatoes, mushrooms, avocado mash, lemon and a sesame dip.', price: 16, tags: ['vegan'],
          img: photo('green-table-13-roasted-veg-plate', 679, 'Top view of roasted turmeric cauliflower, carrots and tomatoes with avocado mash, lemon and a small bowl of sesame dip') },
        { id: 'own-bowl', name: 'Build your own bowl', description: 'Pick a base, a protein and a dressing in your cart after adding.', price: 13, tags: ['vegetarian'],
          options: [
            { name: 'Base', choices: ['Herbed quinoa', 'Steamed rice', 'Leafy greens'] },
            { name: 'Protein', choices: ['Crispy chickpeas', { label: 'Golden tofu', price: 1.5 }, { label: 'Two poached eggs', price: 2 }] },
            { name: 'Dressing', choices: ['Lemon tahini', 'Green herb', 'Sesame miso'] }
          ] }
      ] },
      { id: 'eggs', name: 'Eggs and toast', description: 'Brunch plates, served all day while we are open.', items: [
        { id: 'avocado-toast', name: 'Avocado toast, poached egg', description: 'Sourdough, sliced avocado, a poached egg and fresh dill.', price: 13.5, tags: ['vegetarian'], popular: true,
          img: photo('green-table-06-avocado-toast', 533, 'Avocado toast topped with a poached egg and dill on a blue-grey plate, avocado halves beside it', '(min-width: 64em) 36rem, (min-width: 40em) 60vw, 40vw') },
        { id: 'eggs-benedict', name: 'Eggs benedict', description: 'Poached eggs and ham on toasted muffin, hollandaise, roast potatoes and dressed greens.', price: 16, tags: [], popular: true,
          img: photo('green-table-09-eggs-benedict', 533, 'Eggs benedict on ham with hollandaise, roast potato cubes and greens on a terracotta plate') },
        { id: 'baked-eggs', name: 'Baked eggs in tomato', description: 'Eggs baked in spiced tomato sauce under melted cheese and basil, with warm flatbread.', price: 14.5, tags: ['vegetarian'], popular: true,
          img: photo('green-table-10-shakshuka-white-tiles', 533, 'Pan of eggs baked in tomato sauce with melted cheese and basil leaves, flatbread beside it, top view') },
        { id: 'sourdough-side', name: 'Sourdough and butter', description: 'Toasted sourdough with salted butter. A side for any plate.', price: 4.5, tags: ['vegetarian'] }
      ] },
      { id: 'sweet', name: 'Sweet spoons', description: 'Fruit, oats and something for the sweet tooth.', items: [
        { id: 'berry-pancakes', name: 'Berry pancake stack', description: 'Pancakes with raspberries, blueberries and a dusting of sugar.', price: 13, tags: ['vegetarian'], popular: true,
          img: photo('green-table-08-blueberry-pancakes', 533, 'Stack of pancakes topped with raspberries and dusted with sugar, blueberries around it on a dark plate') },
        { id: 'acai-bowl', name: 'Açaí bowl', description: 'Açaí blend in a coconut shell with goji berries, chia, coconut, granola and mint.', price: 12.5, tags: ['vegan'], popular: true,
          img: photo('green-table-07-acai-bowl-wooden-scoop', 533, 'Açaí bowl in a coconut shell topped with goji berries, chia seeds, coconut, granola and mint, with a wooden spoon') },
        { id: 'granola-berries', name: 'Granola, yogurt and berries', description: 'Granola over yogurt with raspberries and blueberries.', price: 10.5, tags: ['vegetarian'],
          img: photo('green-table-11-granola-berries', 533, 'White bowl of granola and yogurt topped with raspberries and blueberries') },
        { id: 'tropical-granola', name: 'Tropical granola bowl', description: 'Granola and yogurt with mango, kiwi and dragon fruit.', price: 11.5, tags: ['vegetarian'],
          img: photo('green-table-14-fruit-grain-bowl', 533, 'Bowl of granola and yogurt topped with mango, kiwi and pink dragon fruit on a dark wooden table') }
      ] },
      { id: 'drinks', name: 'Drinks', description: 'To go with anything.', items: [
        { id: 'matcha-latte', name: 'Matcha latte', description: 'Whisked matcha with steamed milk. Ask for an oat milk swap.', price: 5.5, tags: ['vegetarian'], popular: true,
          img: photo('green-table-15-matcha-latte', 1200, 'Matcha latte with latte art in a pale grey ceramic cup and saucer') ,
          options: [{ name: 'Milk', choices: ['Whole milk', { label: 'Oat milk', price: 0.5 }] }] },
        { id: 'flat-white', name: 'Flat white', description: 'Double shot with steamed milk.', price: 4.5, tags: ['vegetarian'],
          options: [{ name: 'Milk', choices: ['Whole milk', { label: 'Oat milk', price: 0.5 }] }] },
        { id: 'orange-juice', name: 'Orange juice', description: 'A tall glass, served cold.', price: 5, tags: ['vegan'] }
      ] }
    ]
  };
})();
