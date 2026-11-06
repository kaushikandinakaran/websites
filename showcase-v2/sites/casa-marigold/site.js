/* Casa Marigold: site content. Everything here is invented SAMPLE content for an invented business:
   the name, dishes, descriptions, prices and hours are samples. Photos are stock (see photos/CREDITS.md).
   Shape documented in ../../shared/README.md. Classic script: sets window.SITE only. */
(function () {
  // Stock photo helper. Every photo is labelled only with what it actually shows.
  function photo(base, alt, w800, h800, sizes) {
    var h400 = Math.round(h800 / 2);
    return {
      src: 'images/' + base + '-800.webp',
      srcset: 'images/' + base + '-400.webp 400w, images/' + base + '-800.webp 800w',
      sizes: sizes || '(min-width: 60em) 18rem, (min-width: 40em) 45vw, 92vw',
      alt: alt, width: w800, height: h800
    };
  }

  window.SITE = {
    slug: 'casa-marigold',
    name: 'Casa Marigold',
    tagline: 'Bright Mexican food, ready when you are.',
    cuisine: 'Modern Mexican',
    locale: 'en-US',
    currency: 'USD',
    contact: {
      address: '[address]',
      phone: '[phone]',
      phoneTel: '+15555550142',        // fictional 555-01xx number until the client supplies one
      email: '[email]',
      directionsUrl: ''
    },
    hoursAreSample: true,
    hours: [
      { day: 'mon', closed: true },
      { day: 'tue', open: '11:30', close: '22:00' },
      { day: 'wed', open: '11:30', close: '22:00' },
      { day: 'thu', open: '11:30', close: '22:00' },
      { day: 'fri', open: '11:30', close: '23:30' },
      { day: 'sat', open: '11:00', close: '23:30' },
      { day: 'sun', open: '11:00', close: '21:00' }
    ],
    timing: { pickupMinutes: 20, deliveryMinutes: 40, slotStepMinutes: 15 },
    order: { delivery: true, deliveryFee: 3.5, deliveryMinimum: 15, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0, maxQty: 20 },
    reservation: { stepMinutes: 30, lastSeatingMinutes: 60, leadMinutes: 60, maxParty: 8, defaultParty: 2, daysAhead: 60 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: {
      vegetarian: { label: 'Vegetarian' },
      vegan: { label: 'Vegan' },
      spicy: { label: 'Spicy' },
      'gluten-free': { label: 'Gluten-free [to confirm]' }
    },
    ui: { cartTitle: 'Your order', popularLabel: 'Favourite', addLabel: 'Add', addedLabel: 'Added' },
    schema: true,
    menu: [
      { id: 'tacos', name: 'Tacos', description: 'Soft tacos. Pick flour or corn tortillas in your cart.', items: [
        { id: 'crispy-chicken-tacos', name: 'Crispy tacos', price: 13, popular: true,
          description: 'A crunchy fried filling [chicken: to confirm], pickled red onion, crema, greens and a mild yellow chilli sauce.',
          img: photo('01-hands-holding-tacos', 'Soft tacos with a fried filling, pink pickled onion and drizzled crema, held up over a table', 800, 533),
          options: [{ name: 'Tortilla', choices: ['Flour', 'Corn'] }] },
        { id: 'cochinita-tacos', name: 'Red pulled-meat tacos', price: 14, popular: true,
          description: 'Dark red pulled meat [meat: to confirm] with pickled red onion. Crema on the side for dipping.',
          img: photo('08-tacos-assorted', 'A taco with dark pulled meat and pickled red onion being dipped into a cup of white crema, more tacos behind', 800, 533),
          options: [{ name: 'Tortilla', choices: ['Corn', 'Flour'] }] },
        { id: 'verde-chicken-tacos', name: 'Salsa verde tacos', price: 12, tags: ['spicy'],
          description: 'Pale pulled meat [meat: to confirm] on corn tortillas with salsa verde, radish, red onion, cilantro and lime.',
          img: photo('09-two-tacos-paper-plates', 'A corn tortilla taco with pulled meat, radish, red onion, cilantro, green salsa and a lime wedge on paper', 800, 1200),
          options: [{ name: 'Tortilla', choices: ['Corn', 'Flour'] }] },
        { id: 'fish-tacos', name: 'Battered tacos with slaw', price: 15, popular: true,
          description: 'Golden battered pieces [fish or shrimp: to confirm], creamy slaw and an herb leaf, with a green sauce on the side.',
          img: photo('07-fish-tacos', 'Three soft tacos with golden battered pieces, creamy slaw and herb leaves on a wooden board, green sauce on the side', 800, 1200),
          options: [{ name: 'Tortilla', choices: ['Flour', 'Corn'] }] }
      ] },
      { id: 'share', name: 'To share', description: 'For the middle of the table.', items: [
        { id: 'fiesta-platter', name: 'Fiesta platter for two', price: 34, popular: true,
          description: 'Two tacos [filling: to confirm], quesadilla wedges with guacamole, corn on the cob, tortilla chips and a dip.',
          img: photo('03-tacos-red-background', 'Top view on a red table: tacos, quesadilla wedges with guacamole, corn on the cob and a bowl of tortilla chips on black plates', 800, 533) },
        { id: 'guacamole', name: 'Molcajete guacamole', price: 11, tags: ['vegan'],
          description: 'Avocado, tomato, lime and chilli in a stone bowl, topped with tortilla chips.',
          img: photo('10-guacamole-nachos', 'Guacamole in a stone bowl topped with tortilla chips and cherry tomatoes, avocado and peppers beside it', 800, 533) },
        { id: 'elote', name: 'Elote', price: 7, tags: ['vegetarian'],
          description: 'Street corn rolled in crumbled cheese and chilli powder, with lime.',
          img: photo('11-elote', 'Street corn on the cob covered in crumbled white cheese and chilli powder, with lime halves and dried chillies', 800, 530) },
        { id: 'ceviche', name: 'Citrus ceviche', price: 16, tags: ['gluten-free'],
          description: 'Seafood [type: to confirm] in a citrus milk with pineapple, avocado, red onion, red pepper and a kumquat slice.',
          img: photo('14-ceviche-citrus', 'Ceviche in a pale citrus broth with pineapple, avocado, red onion, thin red pepper strips and a kumquat slice', 800, 533) }
      ] },
      { id: 'plates', name: 'Plates', description: 'Bigger plates and sides.', items: [
        { id: 'mole-negro', name: 'Mole negro plate', price: 21,
          description: 'Dark mole sauce [protein under the sauce: to confirm] with sesame and crumbled cheese, red rice and black beans.',
          img: photo('12-mole-rice-plate', 'Dark mole sauce sprinkled with sesame and crumbled cheese, red rice and black beans on a painted clay plate', 800, 533) },
        { id: 'picadillo-quesadillas', name: 'Quesadillas', price: 15,
          description: 'Grilled flour tortillas with a shredded spiced filling [filling: to confirm] and herbs, with salsa roja and crema.',
          img: photo('13-quesadillas-salsa', 'Folded grilled tortillas with a shredded spiced filling and herbs, red salsa and a white dip', 800, 533) },
        { id: 'rice-beans', name: 'Red rice & black beans', price: 5.5, tags: ['vegan'],
          description: 'A side of tomato rice and black beans.' },
        { id: 'chips-salsa', name: 'Chips & salsa roja', price: 5, tags: ['vegan'],
          description: 'Tortilla chips with a bowl of roasted tomato salsa.' }
      ] },
      { id: 'sweet-sips', name: 'Sweets & drinks', description: 'Something sweet, something cold.', items: [
        { id: 'churros', name: 'Churros & chocolate', price: 8, tags: ['vegetarian'],
          description: 'Cinnamon-sugar churros in a paper cone with warm chocolate for dipping.',
          img: photo('15-churros-chocolate', 'Cinnamon-sugar churros in a paper cone next to a cup of chocolate dip on a black tray', 800, 531) },
        { id: 'margarita', name: 'Lime margarita', price: 11,
          description: 'Tequila, lime, salted rim. 21+ with ID [alcohol licence: to confirm].',
          img: photo('16-lime-margarita', 'A green lime margarita in a salt-rimmed glass with a black straw', 800, 449) },
        { id: 'jamaica', name: 'Agua de jamaica', price: 4.5, tags: ['vegan'],
          description: 'Chilled hibiscus agua fresca, lightly sweet.' },
        { id: 'horchata', name: 'Horchata', price: 4.5, tags: ['vegetarian'],
          description: 'Cold rice and cinnamon drink.' }
      ] }
    ]
  };
})();
