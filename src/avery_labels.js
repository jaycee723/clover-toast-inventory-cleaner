/**
 * Avery Label Sheet Templates, Barcode Rendering, and Label Generator
 * Supports printing price tags and shelf labels for retail items.
 */

/**
 * @typedef {Object} AveryTemplate
 * @property {string} id
 * @property {string} code
 * @property {string} name
 * @property {number} labelsPerSheet
 * @property {number} columns
 * @property {number} rows
 * @property {number} labelWidthIn
 * @property {number} labelHeightIn
 * @property {number} topMarginIn
 * @property {number} leftMarginIn
 * @property {number} colGapIn
 * @property {number} rowGapIn
 * @property {number} sheetWidthIn
 * @property {number} sheetHeightIn
 * @property {string} description
 * @property {string} recommendedUse
 */

export const AVERY_TEMPLATES = [
  {
    id: '5160',
    code: 'Avery 5160 / 8160',
    name: 'Standard Shelf Tags (30 per sheet)',
    labelsPerSheet: 30,
    columns: 3,
    rows: 10,
    labelWidthIn: 2.625,
    labelHeightIn: 1.0,
    topMarginIn: 0.5,
    leftMarginIn: 0.1875,
    colGapIn: 0.125,
    rowGapIn: 0.0,
    sheetWidthIn: 8.5,
    sheetHeightIn: 11.0,
    description: '1" x 2-5/8" — Most popular retail shelf tag & bottle label size in the US.',
    recommendedUse: 'Standard shelf tags, bottle labels, retail price stickers'
  },
  {
    id: '5163',
    code: 'Avery 5163 / 8163',
    name: 'Large Shelf & Bin Tags (10 per sheet)',
    labelsPerSheet: 10,
    columns: 2,
    rows: 5,
    labelWidthIn: 4.0,
    labelHeightIn: 2.0,
    topMarginIn: 0.5,
    leftMarginIn: 0.156,
    colGapIn: 0.188,
    rowGapIn: 0.0,
    sheetWidthIn: 8.5,
    sheetHeightIn: 11.0,
    description: '2" x 4" — Large format with big bold pricing and prominent barcodes.',
    recommendedUse: 'Large shelf tags, case display cards, bin tags'
  },
  {
    id: '5161',
    code: 'Avery 5161 / 8161',
    name: 'Shelf Talkers (20 per sheet)',
    labelsPerSheet: 20,
    columns: 2,
    rows: 10,
    labelWidthIn: 4.0,
    labelHeightIn: 1.0,
    topMarginIn: 0.5,
    leftMarginIn: 0.156,
    colGapIn: 0.188,
    rowGapIn: 0.0,
    sheetWidthIn: 8.5,
    sheetHeightIn: 11.0,
    description: '1" x 4" — Wide shelf strip tags with room for long names and descriptions.',
    recommendedUse: 'Shelf edge strips, wide price tags'
  },
  {
    id: '5167',
    code: 'Avery 5167 / 8167',
    name: 'Mini Price Stickers (80 per sheet)',
    labelsPerSheet: 80,
    columns: 4,
    rows: 20,
    labelWidthIn: 1.75,
    labelHeightIn: 0.5,
    topMarginIn: 0.5,
    leftMarginIn: 0.28,
    colGapIn: 0.3,
    rowGapIn: 0.0,
    sheetWidthIn: 8.5,
    sheetHeightIn: 11.0,
    description: '1/2" x 1-3/4" — Compact price stickers for small items, bottle caps, and nip bottles.',
    recommendedUse: 'Bottle caps, 50ml nips, lip balm, small merchandise'
  },
  {
    id: '94220',
    code: 'Avery 94220 / 94200',
    name: 'Square Labels (24 per sheet)',
    labelsPerSheet: 24,
    columns: 4,
    rows: 6,
    labelWidthIn: 1.5,
    labelHeightIn: 1.5,
    topMarginIn: 0.75,
    leftMarginIn: 0.75,
    colGapIn: 0.5,
    rowGapIn: 0.2,
    sheetWidthIn: 8.5,
    sheetHeightIn: 11.0,
    description: '1.5" x 1.5" — Square tags for jars, bottle necks, and gift tags.',
    recommendedUse: 'Square bottle neck tags, jars, specialty items'
  }
];

/**
 * Extracts retail brand name from an inventory item title.
 * @param {string} name
 * @returns {string}
 */
export function extractBrandFromItem(name) {
  if (!name) return 'Store Catalog';
  const clean = String(name).trim();
  const knownBrands = [
    "Jack Daniel's", "Jim Beam", "Maker's Mark", "Johnnie Walker", "Grey Goose",
    "Ketel One", "Don Julio", "Casamigos", "Tito's", "Corona Extra", "Corona Light", "Corona",
    "Modelo Especial", "Modelo", "Heineken", "Stella Artois", "Bud Light", "Budweiser",
    "Coors Light", "Miller Lite", "Michelob Ultra", "Blue Moon", "White Claw", "High Noon",
    "Twisted Tea", "Red Bull", "Monster", "Coca-Cola", "Coke", "Dr Pepper", "Mountain Dew",
    "Pepsi", "Sour Patch", "Skittles", "Snickers", "Haribo", "American Spirit", "Marlboro",
    "Camel", "Newport", "Geek Bar", "Elf Bar", "Lost Mary", "Puff Bar", "Kanva",
    "Barefoot", "Yellow Tail", "Kendall Jackson", "Woodbridge", "Sutter Home",
    "Hennessy", "Patron", "Jameson", "Captain Morgan", "Bacardi", "Smirnoff",
    "Absolut", "Baileys", "Jagermeister", "Crown Royal", "Fireball", "Guinness"
  ];
  const upper = clean.toUpperCase();
  for (const b of knownBrands) {
    if (upper.includes(b.toUpperCase())) {
      return b;
    }
  }
  const firstWord = clean.split(/\s+/)[0];
  if (firstWord && firstWord.length > 2 && !/^\d+/.test(firstWord)) {
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
  }
  return 'Store Catalog';
}

/**
 * Extracts size or pack packaging suffix from an item title.
 * @param {string} name
 * @returns {string}
 */
export function extractSizeFromItem(name) {
  if (!name) return '';
  const match = String(name).match(/(?:1\.75\s*L|1\s*L|750\s*m[lL]|375\s*m[lL]|200\s*m[lL]|50\s*m[lL]|12\s*oz|16\s*oz|24\s*oz|25\s*oz|19\.2\s*oz|11\s*oz|6\s*[- ]?[pP]ack|12\s*[- ]?[pP]ack|24\s*[- ]?[pP]ack|30\s*[- ]?[pP]ack)/i);
  return match ? match[0].trim() : '';
}

/**
 * @typedef {Object} PriceTagItem
 * @property {string} id
 * @property {string} name
 * @property {string|number} price
 * @property {string} barcode
 * @property {string} category
 * @property {string} [brand]
 * @property {string} [size]
 */


/**
 * Generates an authentic Code128 pattern table for high-contrast, scannable SVG barcode rendering.
 * Code128 is supported natively by all retail POS laser/2D imagers (Toast, Zebra, Clover, Honeywell).
 */
const CODE128_PATTERNS = {
  0: [2, 1, 2, 2, 2, 2], 1: [2, 2, 2, 1, 2, 2], 2: [2, 2, 2, 2, 2, 1],
  3: [1, 2, 1, 2, 2, 3], 4: [1, 2, 1, 3, 2, 2], 5: [1, 3, 1, 2, 2, 2],
  6: [1, 2, 2, 2, 1, 3], 7: [1, 2, 2, 3, 1, 2], 8: [1, 3, 2, 2, 1, 2],
  9: [2, 2, 1, 2, 1, 3], 10: [2, 2, 1, 3, 1, 2], 11: [2, 3, 1, 2, 1, 2],
  12: [1, 1, 2, 2, 3, 2], 13: [1, 2, 2, 1, 3, 2], 14: [1, 2, 2, 2, 3, 1],
  15: [1, 1, 3, 2, 2, 2], 16: [1, 2, 3, 1, 2, 2], 17: [1, 2, 3, 2, 2, 1],
  18: [2, 2, 3, 2, 1, 1], 19: [2, 2, 1, 1, 3, 2], 20: [2, 2, 1, 2, 3, 1],
  21: [2, 1, 3, 2, 1, 2], 22: [2, 2, 3, 1, 1, 2], 23: [3, 1, 2, 1, 3, 1],
  24: [3, 1, 1, 2, 2, 2], 25: [3, 2, 1, 1, 2, 2], 26: [3, 2, 1, 2, 2, 1],
  27: [3, 1, 2, 2, 1, 2], 28: [3, 2, 2, 1, 1, 2], 29: [3, 2, 2, 2, 1, 1],
  30: [2, 1, 2, 1, 2, 3], 31: [2, 1, 2, 3, 2, 1], 32: [2, 3, 2, 1, 2, 1],
  33: [1, 1, 1, 3, 2, 3], 34: [1, 3, 1, 1, 2, 3], 35: [1, 3, 1, 3, 2, 1],
  36: [1, 1, 2, 3, 1, 3], 37: [1, 3, 2, 1, 1, 3], 38: [1, 3, 2, 3, 1, 1],
  39: [2, 1, 1, 3, 1, 3], 40: [2, 3, 1, 1, 1, 3], 41: [2, 3, 1, 3, 1, 1],
  42: [1, 1, 2, 1, 3, 3], 43: [1, 1, 2, 3, 3, 1], 44: [1, 3, 2, 1, 3, 1],
  45: [1, 1, 3, 1, 2, 3], 46: [1, 1, 3, 3, 2, 1], 47: [1, 3, 3, 1, 2, 1],
  48: [3, 1, 3, 1, 2, 1], 49: [2, 1, 1, 3, 3, 1], 50: [2, 3, 1, 1, 3, 1],
  51: [2, 1, 3, 1, 1, 3], 52: [2, 1, 3, 3, 1, 1], 53: [2, 1, 3, 1, 3, 1],
  54: [3, 1, 1, 1, 2, 3], 55: [3, 1, 1, 3, 2, 1], 56: [3, 3, 1, 1, 2, 1],
  57: [3, 1, 2, 1, 1, 3], 58: [3, 1, 2, 3, 1, 1], 59: [3, 3, 2, 1, 1, 1],
  60: [3, 1, 4, 1, 1, 1], 61: [2, 2, 1, 4, 1, 1], 62: [4, 3, 1, 1, 1, 1],
  63: [1, 1, 1, 2, 2, 4], 64: [1, 1, 1, 4, 2, 2], 65: [1, 2, 1, 1, 2, 4],
  66: [1, 2, 1, 4, 2, 1], 67: [1, 4, 1, 1, 2, 2], 68: [1, 4, 1, 2, 2, 1],
  69: [1, 1, 2, 2, 1, 4], 70: [1, 1, 2, 4, 1, 2], 71: [1, 2, 2, 1, 1, 4],
  72: [1, 2, 2, 4, 1, 1], 73: [1, 4, 2, 1, 1, 2], 74: [1, 4, 2, 2, 1, 1],
  75: [2, 4, 1, 2, 1, 1], 76: [2, 2, 1, 1, 1, 4], 77: [4, 1, 3, 1, 1, 1],
  78: [2, 4, 1, 1, 1, 2], 79: [1, 3, 4, 1, 1, 1], 80: [1, 1, 1, 2, 4, 2],
  81: [1, 2, 1, 1, 4, 2], 82: [1, 2, 1, 2, 4, 1], 83: [1, 1, 4, 2, 1, 2],
  84: [1, 2, 4, 1, 1, 2], 85: [1, 2, 4, 2, 1, 1], 86: [4, 1, 1, 2, 1, 2],
  87: [4, 2, 1, 1, 1, 2], 88: [4, 2, 1, 2, 1, 1], 89: [2, 1, 2, 1, 4, 1],
  90: [2, 1, 4, 1, 2, 1], 91: [4, 1, 2, 1, 2, 1], 92: [1, 1, 1, 1, 4, 3],
  93: [1, 1, 1, 3, 4, 1], 94: [1, 3, 1, 1, 4, 1], 95: [1, 1, 4, 1, 1, 3],
  96: [1, 1, 4, 3, 1, 1], 97: [4, 1, 1, 1, 1, 3], 98: [4, 1, 1, 3, 1, 1],
  99: [1, 1, 3, 1, 4, 1], 100: [1, 1, 4, 1, 3, 1], 101: [3, 1, 1, 1, 4, 1],
  102: [4, 1, 1, 1, 3, 1], 103: [2, 1, 1, 4, 1, 2], // Start A
  104: [2, 1, 1, 2, 1, 4], // Start B
  105: [2, 1, 1, 2, 3, 2], // Start C
  106: [2, 3, 3, 1, 1, 1, 2] // Stop
};

/**
 * Encodes ASCII string into Code 128 (Subset B) bar widths.
 * @param {string} text
 * @returns {number[]}
 */
export function encodeCode128B(text) {
  const safeText = String(text || '').replace(/[^\x20-\x7E]/g, '');
  if (!safeText) return [];

  const startCode = 104; // Start B
  const values = [startCode];

  for (let i = 0; i < safeText.length; i++) {
    values.push(safeText.charCodeAt(i) - 32);
  }

  // Checksum calculation
  let sum = startCode;
  for (let i = 1; i < values.length; i++) {
    sum += values[i] * i;
  }
  const checkDigit = sum % 103;
  values.push(checkDigit);

  // Convert to bar widths
  const widths = [];
  for (const v of values) {
    const pattern = CODE128_PATTERNS[v];
    if (pattern) widths.push(...pattern);
  }
  widths.push(...CODE128_PATTERNS[106]); // Stop pattern
  return widths;
}

/**
 * Generates an inline SVG barcode string for crisp vector printing at any DPI.
 * @param {string} barcodeDigits
 * @param {number} [heightPx=32]
 * @returns {string}
 */
export function generateBarcodeSvg(barcodeDigits, heightPx = 32) {
  const clean = String(barcodeDigits || '').trim();
  if (!clean) return '';

  const widths = encodeCode128B(clean);
  if (!widths.length) return '';

  let totalUnits = 0;
  for (const w of widths) totalUnits += w;

  const barHeight = heightPx;
  let currentX = 0;
  let isBar = true;
  const rects = [];

  for (const w of widths) {
    if (isBar) {
      rects.push(`<rect x="${currentX}" y="0" width="${w}" height="${barHeight}" fill="#000000" />`);
    }
    currentX += w;
    isBar = !isBar;
  }

  return `<svg viewBox="0 0 ${totalUnits} ${barHeight}" preserveAspectRatio="none" style="width: 100%; height: ${heightPx}px; display: block;">${rects.join('')}</svg>`;
}

/**
 * Formats retail price for display on price tags.
 * @param {any} priceVal
 * @returns {string}
 */
export function formatTagPrice(priceVal) {
  if (priceVal === null || priceVal === undefined || priceVal === '') return '$0.00';
  const clean = String(priceVal).replace(/[^0-9.]/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return '$0.00';
  return `$${num.toFixed(2)}`;
}

/**
 * Distributes price tag items into sheet pages based on template dimensions.
 * Supports startPosition offset (1-based index) to allow reuse of partially printed sheets.
 * @param {PriceTagItem[]} items
 * @param {AveryTemplate} template
 * @param {number} [startPosition=1]
 * @param {number} [copiesPerItem=1]
 */
export function paginateAveryLabels(items, template, startPosition = 1, copiesPerItem = 1) {
  const expandedList = [];
  const safeCopies = Math.max(1, Math.min(copiesPerItem || 1, 50));

  for (const item of (items || [])) {
    for (let c = 0; c < safeCopies; c++) {
      expandedList.push(item);
    }
  }

  const perSheet = template.labelsPerSheet;
  const pages = [];

  // Handle start position offset on first page (1-based)
  const offset = Math.max(0, Math.min((startPosition || 1) - 1, perSheet - 1));
  let currentSheet = [];

  for (let i = 0; i < offset; i++) {
    currentSheet.push(null); // Blank slot for partially used sheet
  }

  for (const item of expandedList) {
    if (currentSheet.length >= perSheet) {
      pages.push(currentSheet);
      currentSheet = [];
    }
    currentSheet.push(item);
  }

  if (currentSheet.length > 0) {
    while (currentSheet.length < perSheet) {
      currentSheet.push(null);
    }
    pages.push(currentSheet);
  }

  return {
    pages,
    totalLabels: expandedList.length,
    totalPages: pages.length
  };
}

/**
 * Generates an Avery Design & Print Online compatible CSV.
 * Directly importable into https://www.avery.com/print
 * @param {PriceTagItem[]} items
 * @param {string} [storeName='777 Liquor Store']
 * @returns {string}
 */
export function exportAveryCsv(items, storeName = '777 Liquor Store') {
  const headers = ['Product Name', 'Price', 'Formatted Price', 'Barcode UPC', 'Category', 'Store Name'];
  const rows = (items || []).map((item) => [
    `"${String(item.name || '').replace(/"/g, '""')}"`,
    `"${formatTagPrice(item.price).replace('$', '')}"`,
    `"${formatTagPrice(item.price)}"`,
    `"${String(item.barcode || '').replace(/"/g, '""')}"`,
    `"${String(item.category || '').replace(/"/g, '""')}"`,
    `"${String(storeName || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}
