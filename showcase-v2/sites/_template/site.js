/* Site content for the TEMPLATE restaurant. Copy this file and change the values.
   Everything here is invented SAMPLE content: names, dishes, prices and hours are samples.
   Shape documented in ../../shared/README.md. Classic script: sets window.SITE only. */
(function () {
  // Placeholder images (solid gradient SVG) until real photos are placed in images/.
  // Real dish: { src: 'images/dish-800.jpg', srcset: 'images/dish-480.jpg 480w, images/dish-800.jpg 800w',
  //              alt: 'Describe what the photo shows', width: 800, height: 600 }
  function ph(hue, what) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">'
      + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="hsl(' + hue + ' 38% 80%)"/><stop offset="1" stop-color="hsl(' + hue + ' 30% 58%)"/>'
      + '</linearGradient></defs><rect width="800" height="600" fill="url(#g)"/>'
      + '<circle cx="400" cy="300" r="150" fill="hsl(' + hue + ' 30% 90%)" opacity=".55"/></svg>';
    return { src: 'data:image/svg+xml,' + encodeURIComponent(svg), alt: 'Placeholder for a photo of ' + what + ' (photo to come)', width: 800, height: 600 };
  }

  window.SITE = {
    slug: '_template',                 // unique per site: the cart is stored under this key
    name: 'Sample Kitchen',
    tagline: 'Seasonal plates, cooked to order.',
    cuisine: 'Modern seasonal',
    locale: 'en-US',
    currency: 'USD',
    contact: {
      address: '[address]',
      phone: '[phone]',
      phoneTel: '+15555550100',        // fictional 555-01xx number used for the tel: link until the client supplies one
      email: '[email]',
      directionsUrl: ''                // empty: "Get directions" points at the map placeholder
    },
    hoursAreSample: true,
    hours: [                           // day: mon..sun; several entries per day allowed; close past midnight = overnight
      { day: 'mon', closed: true },
      { day: 'tue', open: '11:30', close: '21:30' },
      { day: 'wed', open: '11:30', close: '21:30' },
      { day: 'thu', open: '11:30', close: '21:30' },
      { day: 'fri', open: '11:30', close: '23:00' },
      { day: 'sat', open: '10:00', close: '00:30' },
      { day: 'sun', open: '10:00', close: '20:00' }
    ],
    timing: { pickupMinutes: 20, deliveryMinutes: 45, slotStepMinutes: 15 },
    order: { delivery: true, deliveryFee: 3.5, deliveryMinimum: 15, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0 },
    reservation: { stepMinutes: 30, lastSeatingMinutes: 60, leadMinutes: 60, maxParty: 8, defaultParty: 2, daysAhead: 60 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: {
      vegetarian: { label: 'Vegetarian' },
      vegan: { label: 'Vegan' },
      spicy: { label: 'Spicy' },
      'gluten-free': { label: 'Gluten-free [to confirm]' }
    },
    ui: { cartTitle: 'Your order', popularLabel: 'Signature', addLabel: 'Add', addedLabel: 'Added' },
    menu: [
      { id: 'small', name: 'Small plates', description: 'To start or to share.', items: [
        { id: 'bruschetta', name: 'Tomato bruschetta', description: 'Grilled bread, marinated tomatoes, basil, olive oil.', price: 8, tags: ['vegan'], img: ph(8, 'tomato bruschetta'), popular: true },
        { id: 'chickpeas', name: 'Crispy chickpeas', description: 'Roasted with smoked paprika and chilli.', price: 6.5, tags: ['vegan', 'spicy', 'gluten-free'], img: ph(28, 'crispy chickpeas') },
        { id: 'soup', name: 'Soup of the day', description: 'Ask what the kitchen made today. Served with bread.', price: 7, tags: ['vegetarian'], img: ph(45, 'a bowl of soup') }
      ] },
      { id: 'mains', name: 'Mains', description: 'Cooked to order.', items: [
        { id: 'chicken', name: 'Roast half chicken', description: 'Lemon, garlic and thyme, with roast potatoes.', price: 19, tags: ['gluten-free'], img: ph(35, 'roast chicken'), popular: true },
        { id: 'risotto', name: 'Mushroom risotto', description: 'Arborio rice, mixed mushrooms, parmesan.', price: 17, tags: ['vegetarian'], img: ph(55, 'mushroom risotto'), popular: true },
        { id: 'noodles', name: 'Chilli garlic noodles', description: 'Wok-tossed noodles, greens, chilli oil.', price: 15, tags: ['vegan', 'spicy'], img: ph(15, 'chilli noodles'),
          options: [{ name: 'Spice level', choices: ['Medium', 'Mild', 'Hot'] }] },
        { id: 'fish', name: 'Grilled fish of the day', description: 'With herb salsa and greens.', price: 22, tags: [], img: ph(195, 'grilled fish') },
        { id: 'burger', name: 'House burger', description: 'Beef patty, cheddar, pickles, brioche bun, fries.', price: 16, tags: [], img: ph(25, 'a burger with fries'), popular: true,
          options: [{ name: 'Side', choices: [{ label: 'Fries', price: 0 }, { label: 'Side salad', price: 0 }, { label: 'Sweet potato fries', price: 1.5 }] }] }
      ] },
      { id: 'desserts', name: 'Desserts', items: [
        { id: 'tart', name: 'Chocolate tart', description: 'Dark chocolate, crème fraîche.', price: 8, tags: ['vegetarian'], img: ph(20, 'chocolate tart') },
        { id: 'sorbet', name: 'Lemon sorbet', description: 'Two scoops.', price: 6, tags: ['vegan', 'gluten-free'], img: ph(55, 'lemon sorbet') }
      ] }
    ]
  };
})();
