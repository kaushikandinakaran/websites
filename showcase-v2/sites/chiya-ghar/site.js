/* Chiya Ghar: SAMPLE content for an invented tea house. Names, dishes, prices and hours are samples.
   Shape documented in ../../shared/README.md. Classic script: sets window.SITE (SITE.feast configures the feast picker). */
(function () {
  function img(n, slug, alt, w, h) {
    var b = 'images/chiya-ghar-' + n + '-' + slug + '-';
    return { src: b + '800.webp', srcset: b + '400.webp 400w, ' + b + '800.webp 800w',
      sizes: '(min-width: 60em) 22rem, (min-width: 40em) 45vw, 92vw', alt: alt, width: 800, height: h };
  }
  var CHAI = img('01', 'masala-chai-glass-marble', 'A glass of milky masala chai beside fresh ginger root on white marble', 800, 533);
  var MILK = img('02', 'milk-chai-cup-cinnamon', 'A cup of pale milk tea seen from above, with cinnamon sticks and star anise', 800, 1200);
  var SAMOSA = img('03', 'samosas-white-plate', 'Four golden samosas on a white plate with coriander and a sauce drizzle', 800, 533);
  var JALEBI = img('04', 'jalebi-almonds', 'A heap of bright orange jalebi spirals topped with sliced almonds', 800, 533);
  var PANI = img('05', 'pani-puri', 'Crisp pani puri shells filled with chickpeas, on paper', 800, 533);
  var DAHI = img('06', 'dahi-puri-chaat', 'A plate of puris topped with sev, pomegranate, chickpeas, herbs and chutneys', 800, 562);
  var JAMUN = img('07', 'gulab-jamun', 'A pyramid of round gulab jamun on a white plate', 800, 550);
  var PAKORA = img('08', 'onion-pakora', 'Crisp onion pakoras on a plate with a small bowl of dip', 800, 533);
  var LASSI = img('09', 'mango-lassi', 'Two glasses of mango lassi with diced mango on a wooden board', 800, 600);
  var PARATHA = img('10', 'aloo-paratha', 'Three stuffed parathas with butter, served with yogurt, pickle and chutney', 800, 533);
  var MITHAI = img('11', 'mithai-assortment', 'A box of assorted Indian sweets in rows: barfi, coconut rolls and ladoo', 800, 534);

  window.SITE = {
    slug: 'chiya-ghar',
    name: 'Chiya Ghar',
    tagline: 'Chiya all day. Feasts when you need them.',
    cuisine: 'Indo-Nepali tea house',
    locale: 'en-US',
    currency: 'USD',
    contact: { address: '[address]', phone: '[phone]', phoneTel: '+15555550153', email: '[email]', directionsUrl: '' },
    hoursAreSample: true,
    hours: [
      { day: 'mon', open: '07:00', close: '18:00' },
      { day: 'tue', closed: true },
      { day: 'wed', open: '07:00', close: '18:00' },
      { day: 'thu', open: '07:00', close: '18:00' },
      { day: 'fri', open: '07:00', close: '19:00' },
      { day: 'sat', open: '08:00', close: '19:00' },
      { day: 'sun', open: '08:00', close: '17:00' }
    ],
    timing: { pickupMinutes: 15, deliveryMinutes: 40, slotStepMinutes: 15 },
    order: { delivery: true, deliveryFee: 3.5, deliveryMinimum: 12, tips: [0, 10, 15, 20], defaultTip: 0, taxRate: 0, maxQty: 30 },
    reservation: { stepMinutes: 30, lastSeatingMinutes: 45, leadMinutes: 60, maxParty: 10, defaultParty: 2, daysAhead: 60 },
    deliveryApps: ['[Delivery app 1]', '[Delivery app 2]'],
    tags: { vegetarian: { label: 'Vegetarian' }, vegan: { label: 'Vegan [to confirm]' }, spicy: { label: 'Spicy' } },
    ui: { cartTitle: 'Your order', popularLabel: 'Sample favourite', addLabel: 'Add', addedLabel: 'Added' },
    schema: true,
    menu: [
      { id: 'chiya', name: 'Chiya & drinks', description: 'Brewed all day.', items: [
        { id: 'masala-chiya', name: 'Masala chiya', description: 'Black tea simmered with milk, ginger, cardamom and sugar. Ask for less sweet.', price: 3.5, tags: ['vegetarian'], popular: true, img: CHAI,
          options: [{ name: 'Size', choices: ['Glass', { label: 'Large cup', price: 1 }] }] },
        { id: 'dudh-chiya', name: 'Dudh chiya (milk tea)', description: 'Mild milk tea, lightly spiced with cinnamon. Gentle and creamy.', price: 3.25, tags: ['vegetarian'], img: MILK },
        { id: 'kalo-chiya', name: 'Kalo chiya (black tea)', description: 'Black tea with lemon and a little sugar, no milk.', price: 2.75, tags: ['vegan'] },
        { id: 'mango-lassi', name: 'Mango lassi', description: 'Yogurt blended with mango pulp, chilled.', price: 5.5, tags: ['vegetarian'], img: LASSI }
      ] },
      { id: 'breakfast', name: 'Morning plates', description: 'Served until 11:30 (sample).', items: [
        { id: 'aloo-paratha', name: 'Aloo paratha', description: 'Griddled flatbread stuffed with spiced potato, with butter, yogurt and pickle.', price: 9.5, tags: ['vegetarian'], popular: true, img: PARATHA },
        { id: 'sel-roti', name: 'Sel roti with aloo achar', description: 'Ring-shaped sweet rice bread, fried, served with a tangy potato and sesame pickle.', price: 7.5, tags: ['vegetarian'] },
        { id: 'chana-puri', name: 'Chana & puri', description: 'Spiced chickpea curry with two puffed fried breads.', price: 9, tags: ['vegetarian'] }
      ] },
      { id: 'snacks', name: 'Chaat & snacks', description: 'For the afternoon chiya break.', items: [
        { id: 'samosa', name: 'Samosa (2)', description: 'Crisp pastry filled with spiced potato and peas, with tamarind and mint chutneys.', price: 5, tags: ['vegetarian'], popular: true, img: SAMOSA },
        { id: 'onion-pakora', name: 'Onion pakora', description: 'Onion fritters in a spiced chickpea-flour batter, with a dip.', price: 6, tags: ['vegetarian'], img: PAKORA },
        { id: 'pani-puri', name: 'Pani puri (8)', description: 'Hollow crisp puris with potato and chickpeas, served with tangy spiced water to pour in.', price: 7.5, tags: ['vegetarian', 'spicy'], popular: true, img: PANI },
        { id: 'dahi-puri', name: 'Sev puri chaat', description: 'Puris topped with chickpeas, sev, pomegranate, herbs and sweet and green chutneys.', price: 8, tags: ['vegetarian'], img: DAHI }
      ] },
      { id: 'sweets', name: 'Sweets', description: 'With the last cup of the day.', items: [
        { id: 'jalebi', name: 'Jalebi', description: 'Spirals of fried batter soaked in sugar syrup, finished with almonds.', price: 5.5, tags: ['vegetarian'], popular: true, img: JALEBI },
        { id: 'gulab-jamun', name: 'Gulab jamun (3)', description: 'Soft milk-dough dumplings, fried and soaked in cardamom syrup.', price: 5, tags: ['vegetarian'], img: JAMUN },
        { id: 'mithai-box', name: 'Mithai box (12 pieces)', description: 'Assorted sweets such as barfi, coconut rolls and ladoo. Selection varies.', price: 18, tags: ['vegetarian'], img: MITHAI }
      ] },
      { id: 'trays', name: 'Party trays', description: 'Each tray serves about 10. Orders need notice: the client sets the lead time.', items: [
        { id: 'tray-chiya', name: 'Chiya urn (serves 10)', description: 'Masala chiya in a hot urn with cups, sugar on the side.', price: 32, tags: ['vegetarian'] },
        { id: 'tray-samosa', name: 'Samosa tray (20 pieces)', description: 'Potato and pea samosas with tamarind and mint chutneys.', price: 45, tags: ['vegetarian'] },
        { id: 'tray-pakora', name: 'Pakora tray (serves 10)', description: 'Onion pakora with dips.', price: 38, tags: ['vegetarian'] },
        { id: 'tray-chaat', name: 'Chaat station (serves 10)', description: 'Puris, potato, chickpeas, yogurt, sev and chutneys, packed to assemble.', price: 55, tags: ['vegetarian'] },
        { id: 'tray-sweets', name: 'Mithai tray (30 pieces)', description: 'Assorted sweets such as barfi, coconut rolls and ladoo. Selection varies.', price: 42, tags: ['vegetarian'], img: MITHAI }
      ] }
    ]
  };

  /* Feast picker config (read by feast.js; core ignores it). One tray of each kind per 10 guests, rounded up. */
  window.SITE.feast = {
    perTray: 10,
    presets: [10, 20, 30],
    min: 5, max: 150,
    trays: [
      { id: 'tray-chiya', label: 'Chiya urn', on: true },
      { id: 'tray-samosa', label: 'Samosa tray', on: true },
      { id: 'tray-pakora', label: 'Pakora tray', on: true },
      { id: 'tray-chaat', label: 'Chaat station', on: false },
      { id: 'tray-sweets', label: 'Mithai tray', on: true }
    ]
  };
})();
