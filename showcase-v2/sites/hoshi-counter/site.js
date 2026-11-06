/* Site content for HOSHI, a sushi and omakase counter. Showcase V2 sample design by Website Studio.
   Everything here is invented SAMPLE content: business, dishes, prices and hours are samples.
   Photos are stock photographs (see the credits line in the footer); each photo is used only for the dish it shows.
   Items without an honestly matching photo have no img and render as text-only cards.
   Shape documented in ../../shared/README.md. Classic script: sets window.SITE only. */
(function () {
  // Responsive photo helper. name = file stem in images/, w/h = intrinsic size of the -800 file.
  function photo(name, alt, w, h, sizes) {
    return {
      src: 'images/' + name + '-800.webp',
      srcset: 'images/' + name + '-400.webp 400w, images/' + name + '-800.webp 800w',
      // phones show menu cards as rows with a 120px photo; on the home strip a phone at 2x gets the 400w file
      sizes: sizes || '(min-width: 60em) 280px, (min-width: 40em) 45vw, 120px',
      alt: alt, width: w, height: h
    };
  }
  var wasabi = [{ name: 'Wasabi', choices: ['In the nigiri', 'On the side', 'No wasabi'] }];

  window.SITE = {
    slug: 'hoshi-counter',
    name: 'Hoshi',
    tagline: 'Nigiri, one piece at a time.',
    cuisine: 'Sushi and omakase counter',
    locale: 'en-US',
    currency: 'USD',
    contact: {
      address: '[address]',
      phone: '[phone]',
      phoneTel: '+15555550166',          // fictional 555-01xx number for the tel: link until the client supplies one
      email: '[email]',
      directionsUrl: ''                  // empty: "Get directions" points at the map placeholder
    },
    hoursAreSample: true,
    hours: [                             // SAMPLE hours: lunch takeaway window and evening counter seatings
      { day: 'mon', closed: true },
      { day: 'tue', open: '12:00', close: '14:00' }, { day: 'tue', open: '17:30', close: '22:00' },
      { day: 'wed', open: '12:00', close: '14:00' }, { day: 'wed', open: '17:30', close: '22:00' },
      { day: 'thu', open: '12:00', close: '14:00' }, { day: 'thu', open: '17:30', close: '22:00' },
      { day: 'fri', open: '12:00', close: '14:00' }, { day: 'fri', open: '17:30', close: '23:00' },
      { day: 'sat', open: '12:00', close: '14:00' }, { day: 'sat', open: '17:30', close: '23:00' },
      { day: 'sun', open: '17:00', close: '21:30' }
    ],
    timing: { pickupMinutes: 25, deliveryMinutes: 50, slotStepMinutes: 15 },
    order: { delivery: true, deliveryFee: 4, deliveryMinimum: 30, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0 },
    reservation: { stepMinutes: 30, lastSeatingMinutes: 90, leadMinutes: 120, maxParty: 6, defaultParty: 2, daysAhead: 30 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: {
      vegetarian: { label: 'Vegetarian' },
      vegan: { label: 'Vegan' }
    },
    ui: { cartTitle: 'Your takeaway', popularLabel: 'Takeaway box', addLabel: 'Add', addedLabel: 'Added' },
    menu: [
      { id: 'boxes', name: 'Takeaway boxes', description: 'Boxed to order at the counter, ready for pickup or local delivery. The dine-in omakase and nigiri sitting are booked separately.', items: [
        { id: 'set-hoshi', name: 'Hoshi nigiri box', description: 'Twelve pieces of the chef\u2019s selection, with pickled ginger, wasabi and house soy.', price: 48, popular: true,
          img: photo('08-assorted-nigiri-slate', 'Assorted nigiri on a black slate: salmon, tuna, white fish, prawn, seared salmon, sweet omelette and more', 800, 533), options: wasabi },
        { id: 'set-five', name: 'Five-piece nigiri box', description: 'Tuna, salmon, white fish, prawn and a silver-skinned fish, in the order we would serve them.', price: 26, popular: true,
          img: photo('01-nigiri-platter-dark', 'Five pieces of nigiri in a row on a long white plate, with pickled ginger and wasabi, on dark wood', 800, 600), options: wasabi },
        { id: 'set-boat', name: 'Sashimi boat for two', description: 'Tuna, salmon and the day\u2019s other fish over ice, with lemon, sea grapes and cress.', price: 62, popular: true,
          img: photo('11-sashimi-on-ice', 'Sliced tuna, salmon and other raw fish on ice in a wooden boat, with lemon, sea grapes and cress', 800, 492) },
        { id: 'set-salmon', name: 'Salmon sashimi box', description: 'Two fans of salmon sashimi with cucumber and shredded vegetables.', price: 24, popular: true,
          img: photo('03-salmon-sashimi-black', 'Two fans of sliced salmon sashimi with cucumber on a black slate', 800, 800) }
      ] },
      { id: 'nigiri', name: 'Nigiri', description: 'Two pieces per order unless noted, brushed with house soy.', items: [
        { id: 'n-akami', name: 'Lean tuna nigiri', description: 'Akami: lean tuna, clean and deep in flavour.', price: 9,
          img: photo('09-tuna-nigiri-black-plate', 'Two pieces of lean tuna nigiri on a dark plate', 800, 1199) },
        { id: 'n-salmon', name: 'Salmon nigiri', description: 'Salmon with a dab of creamy dressing and sliced spring onion.', price: 8,
          img: photo('10-salmon-nigiri-closeup', 'Two pieces of salmon nigiri, each topped with a dab of white dressing and sliced spring onion', 800, 533) },
        { id: 'n-trio', name: 'Salmon and tuna trio', description: 'Three pieces: salmon, tuna, salmon, each with grated wasabi.', price: 12,
          img: photo('02-salmon-tuna-nigiri-black', 'Three nigiri, salmon, tuna and salmon, each topped with grated wasabi, on a black reflective surface', 800, 587) },
        { id: 'n-maguro', name: 'Tuna with micro cress', description: 'Tuna on a leaf, finished with a little cress.', price: 10,
          img: photo('07-nigiri-wooden-platter', 'Two pieces of tuna nigiri topped with micro cress, on a leaf on a wooden board', 800, 533) }
      ] },
      { id: 'rolls', name: 'Rolls and hand rolls', description: 'Rolls are cut into six or eight pieces. Hand rolls are best eaten within minutes.', items: [
        { id: 'r-aburi', name: 'Aburi plate', description: 'Flame-seared nigiri and a roll topped with orange tobiko and sweet soy glaze.', price: 18,
          img: photo('13-aburi-rolls-black-plate', 'Two black plates: flame-seared nigiri, and roll pieces topped with orange fish roe and a sweet soy glaze', 800, 600) },
        { id: 'r-salmon', name: 'Salmon and cream cheese roll', description: 'Salmon-wrapped roll with cream cheese and cucumber.', price: 13,
          img: photo('14-roll-chopsticks-dark', 'A piece of salmon-wrapped roll with cream cheese and cucumber, between wooden chopsticks on black', 800, 1200) },
        { id: 'r-dressed', name: 'Dressed salmon roll', description: 'Salmon roll with sweet soy, a creamy sauce, sesame, flaked almond and micro herbs.', price: 17,
          img: photo('06-dressed-roll', 'Salmon-topped roll pieces on a white plate with sweet soy, a creamy sauce, sesame, flaked almond and micro herbs', 800, 600) },
        { id: 'r-negitoro', name: 'Negitoro hand roll', description: 'Chopped fatty tuna and spring onion in crisp nori. One piece.', price: 9 },
        { id: 'r-avocado', name: 'Avocado and cucumber roll', description: 'Avocado, cucumber and sesame in nori.', price: 8, tags: ['vegan'] }
      ] },
      { id: 'sashimi', name: 'Sashimi and small plates', description: 'Sashimi is sliced to order, with no rice.', items: [
        { id: 'sa-hamachi', name: 'Yellowtail and scallop sashimi', description: 'Yellowtail and scallop with lemon and lime.', price: 22,
          img: photo('12-sashimi-platter-citrus', 'Close-up of pale yellowtail sashimi slices with scallop, lemon and lime', 800, 1200) },
        { id: 'sp-tempura', name: 'Prawn and vegetable tempura', description: 'Prawn, shiso leaf and seasonal vegetables in a light batter, with dipping sauce.', price: 14,
          img: photo('15-tempura-dark', 'Prawn, shiso leaf and vegetable tempura on white paper on a dark plate', 800, 533) },
        { id: 'sp-edamame', name: 'Edamame', description: 'Steamed soybeans with sea salt.', price: 6, tags: ['vegan'] },
        { id: 'sp-miso', name: 'Miso soup', description: 'White miso, tofu, wakame, spring onion.', price: 5 }
      ] },
      { id: 'sweets', name: 'Tea and sweets', items: [
        { id: 'd-matcha', name: 'Matcha', description: 'Stone-ground green tea powder, whisked with hot water when you order.', price: 7, tags: ['vegan'],
          img: photo('16-matcha-ceremony', 'Bright green matcha powder in a dark ceramic bowl beside a bamboo whisk, before the water is added', 800, 533) },
        { id: 'd-goma', name: 'Black sesame ice cream', description: 'One scoop.', price: 7, tags: ['vegetarian'] }
      ] }
    ]
  };
})();
