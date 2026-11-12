import { jsPDF } from 'jspdf';
import { findLogoForProduct } from './brand_logos.js';

/**
 * Avery Label Sheet Templates, Barcode Rendering, and Label Generator
 * Supports printing price tags and shelf labels for retail items.
 */

export const DEFAULT_AVERY_THEME = {
  priceFontSize: 13,
  titleFontSize: 8.2,
  storeFontSize: 6.5,
  sizeFontSize: 6,
  priceColor: '#000000',
  titleColor: '#000000',
  storeColor: '#64748b',
  tagBgColor: '#ffffff',
  borderColor: '#e2e8f0',
  borderStyle: 'hairline', // 'none' | 'hairline' | 'dashed' | 'solid-bold'
  borderRadius: 2,
  paddingInches: 0.06,
  logoPlacement: 'top-right', // 'top-right' | 'top-left' | 'center-top' | 'beside-price'
  logoScale: 'medium', // 'small' | 'medium' | 'large'
  showBrandLogos: true,
  showBarcode: true,
  showStoreName: true,
  showCategory: true,
  storeName: '777 Liquor Store'
};

export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return [0, 0, 0];
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

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
 * @property {sheetWidthIn} sheetWidthIn
 * @property {sheetHeightIn} sheetHeightIn
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

/**
 * Draws crisp, resolution-independent vector barcode rectangles into a jsPDF document.
 * Code128 standard supported natively by all retail POS laser/imager scanners.
 * @param {jsPDF} doc
 * @param {string} barcodeDigits
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 */
export function drawVectorBarcode(doc, barcodeDigits, x, y, width, height) {
  const clean = String(barcodeDigits || '').trim();
  if (!clean) return;

  const widths = encodeCode128B(clean);
  if (!widths || !widths.length) return;

  const totalUnits = widths.reduce((a, b) => a + b, 0);
  if (!totalUnits) return;

  const unitWidth = width / totalUnits;
  let currentX = x;

  doc.setFillColor(0, 0, 0);
  for (let i = 0; i < widths.length; i++) {
    const barW = widths[i] * unitWidth;
    if (i % 2 === 0) {
      doc.rect(currentX, y, barW, height, 'F');
    }
    currentX += barW;
  }
}

/**
 * Helper to embed an aspect-ratio-preserved brand logo into the PDF label slot.
 */
function embedPdfBrandLogo(doc, logo, slotX, slotY, slotW, slotH, placement = 'top-right', scale = 'medium') {
  if (!logo || !logo.imageDataUrl) return null;
  const maxDim = scale === 'small' ? 0.22 : scale === 'large' ? 0.48 : 0.34;
  const aspect = (logo.width && logo.height) ? (logo.width / logo.height) : 1;
  let imgW = maxDim;
  let imgH = maxDim;
  if (aspect >= 1) {
    imgH = maxDim / aspect;
  } else {
    imgW = maxDim * aspect;
  }

  let lx = slotX + slotW - imgW - 0.05;
  let ly = slotY + 0.04;

  if (placement === 'top-left') {
    lx = slotX + 0.05;
    ly = slotY + 0.04;
  } else if (placement === 'center-top') {
    lx = slotX + (slotW - imgW) / 2;
    ly = slotY + 0.04;
  } else if (placement === 'beside-price') {
    lx = slotX + slotW - imgW - 0.05;
    ly = slotY + slotH - imgH - 0.06;
  }

  try {
    doc.addImage(logo.imageDataUrl, 'PNG', lx, ly, imgW, imgH);
    return { lx, ly, imgW, imgH, placement };
  } catch (err) {
    console.warn('Could not embed brand logo into PDF:', err);
    return null;
  }
}

/**
 * Renders a single retail price tag / shelf label into an exact Avery slot on the PDF.
 * @param {jsPDF} doc
 * @param {PriceTagItem} item
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {AveryTemplate} template
 * @param {Object} options
 */
export function renderSingleAveryLabel(doc, item, x, y, width, height, template, options = {}) {
  const theme = { ...DEFAULT_AVERY_THEME, ...(options.theme || {}) };
  const storeName = options.storeName || theme.storeName || '777 Liquor Store';
  const showStoreName = options.showStoreName !== undefined ? options.showStoreName : theme.showStoreName;
  const showBarcode = options.showBarcode !== undefined ? options.showBarcode : theme.showBarcode;
  const showCategory = options.showCategory !== undefined ? options.showCategory : theme.showCategory;
  const brandLogos = options.brandLogos || [];

  // 1. Tag Background
  if (theme.tagBgColor && theme.tagBgColor.toLowerCase() !== '#ffffff') {
    doc.setFillColor(...hexToRgb(theme.tagBgColor));
    doc.rect(x, y, width, height, 'F');
  }

  // 2. Tag Border
  if (theme.borderStyle && theme.borderStyle !== 'none') {
    doc.setDrawColor(...hexToRgb(theme.borderColor));
    if (theme.borderStyle === 'dashed') {
      doc.setLineDashPattern([0.02, 0.02], 0);
      doc.setLineWidth(0.006);
    } else if (theme.borderStyle === 'solid-bold') {
      doc.setLineDashPattern([], 0);
      doc.setLineWidth(0.012);
    } else {
      doc.setLineDashPattern([], 0);
      doc.setLineWidth(0.005);
    }
    if (theme.borderRadius > 0) {
      doc.roundedRect(x, y, width, height, 0.03, 0.03, 'S');
    } else {
      doc.rect(x, y, width, height, 'S');
    }
    doc.setLineDashPattern([], 0);
  }

  // 3. Find matched brand logo
  const logo = theme.showBrandLogos ? findLogoForProduct(item, brandLogos) : null;
  let embeddedLogo = null;

  const padX = theme.paddingInches || 0.07;
  const padY = (theme.paddingInches ? theme.paddingInches * 0.8 : 0.05);
  const innerW = width - padX * 2;

  // Mini Price Sticker (0.5" x 1.75")
  if (template.id === '5167') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(theme.titleFontSize ? Math.min(theme.titleFontSize, 7) : 6.5);
    doc.setTextColor(...hexToRgb(theme.titleColor));
    const titleLines = doc.splitTextToSize(item.name || '', innerW);
    doc.text(titleLines[0] || '', x + padX, y + padY + 0.08);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(theme.priceFontSize ? Math.min(theme.priceFontSize, 10) : 8.5);
    doc.setTextColor(...hexToRgb(theme.priceColor));
    doc.text(formatTagPrice(item.price), x + padX, y + height - padY - 0.02);

    if (showBarcode && item.barcode) {
      const barcodeW = 0.95;
      const barcodeH = 0.14;
      const bx = x + width - padX - barcodeW;
      const by = y + padY + 0.12;
      drawVectorBarcode(doc, item.barcode, bx, by, barcodeW, barcodeH);

      doc.setFont('courier', 'normal');
      doc.setFontSize(4.5);
      doc.setTextColor(30, 41, 59);
      doc.text(item.barcode, bx + barcodeW / 2, by + barcodeH + 0.06, { align: 'center' });
    }
    return;
  }

  // Large Shelf & Bin Tag (2.0" x 4.0")
  if (template.id === '5163') {
    if (logo) {
      embeddedLogo = embedPdfBrandLogo(doc, logo, x, y, width, height, theme.logoPlacement, theme.logoScale || 'large');
    }

    if (showStoreName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(theme.storeFontSize ? theme.storeFontSize * 1.2 : 8.5);
      doc.setTextColor(...hexToRgb(theme.storeColor));
      doc.text(String(storeName || '777 LIQUOR STORE').toUpperCase(), x + padX, y + padY + 0.10);
    }
    if (showCategory && item.category) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(theme.sizeFontSize ? theme.sizeFontSize * 1.1 : 8);
      doc.setTextColor(...hexToRgb(theme.storeColor));
      const rightX = (embeddedLogo && theme.logoPlacement === 'top-right') ? x + width - padX - embeddedLogo.imgW - 0.08 : x + width - padX;
      doc.text(String(item.category).toUpperCase().slice(0, 22), rightX, y + padY + 0.10, { align: 'right' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(theme.titleFontSize ? theme.titleFontSize * 1.3 : 12);
    doc.setTextColor(...hexToRgb(theme.titleColor));
    const titleLines = doc.splitTextToSize(item.name || '', innerW).slice(0, 3);
    doc.text(titleLines, x + padX, y + padY + 0.32);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(theme.priceFontSize ? theme.priceFontSize * 1.5 : 22);
    doc.setTextColor(...hexToRgb(theme.priceColor));
    doc.text(formatTagPrice(item.price), x + padX, y + height - padY - 0.24);

    if (item.size) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(theme.sizeFontSize ? theme.sizeFontSize * 1.2 : 9);
      doc.setTextColor(71, 85, 105);
      doc.text(item.size, x + padX, y + height - padY - 0.06);
    }

    if (showBarcode && item.barcode) {
      const barcodeW = 1.90;
      const barcodeH = 0.38;
      const bx = x + width - padX - barcodeW;
      const by = y + height - padY - barcodeH - 0.12;
      drawVectorBarcode(doc, item.barcode, bx, by, barcodeW, barcodeH);

      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(item.barcode, bx + barcodeW / 2, by + barcodeH + 0.09, { align: 'center' });
    }
    return;
  }

  // Shelf Talker (1.0" x 4.0")
  if (template.id === '5161') {
    if (logo) {
      embeddedLogo = embedPdfBrandLogo(doc, logo, x, y, width, height, theme.logoPlacement, theme.logoScale);
    }

    const topY = y + padY + 0.07;
    if (showStoreName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(theme.storeFontSize || 7);
      doc.setTextColor(...hexToRgb(theme.storeColor));
      doc.text(String(storeName || '777 LIQUOR STORE').toUpperCase().slice(0, 26), x + padX, topY);
    }
    if (showCategory && item.category) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(theme.sizeFontSize || 6.5);
      doc.setTextColor(...hexToRgb(theme.storeColor));
      const rightX = (embeddedLogo && theme.logoPlacement === 'top-right') ? x + width - padX - embeddedLogo.imgW - 0.05 : x + width - padX;
      doc.text(String(item.category).toUpperCase().slice(0, 20), rightX, topY, { align: 'right' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(theme.titleFontSize || 8.5);
    doc.setTextColor(...hexToRgb(theme.titleColor));
    const titleLines = doc.splitTextToSize(item.name || '', innerW).slice(0, 2);
    doc.text(titleLines, x + padX, topY + 0.13);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(theme.priceFontSize || 14);
    doc.setTextColor(...hexToRgb(theme.priceColor));
    doc.text(formatTagPrice(item.price), x + padX, y + height - padY - 0.13);

    if (item.size) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(theme.sizeFontSize || 6.5);
      doc.setTextColor(71, 85, 105);
      doc.text(item.size, x + padX, y + height - padY - 0.02);
    }

    if (showBarcode && item.barcode) {
      const barcodeW = 1.70;
      const barcodeH = 0.22;
      const bx = x + width - padX - barcodeW;
      const by = y + height - padY - barcodeH - 0.08;
      drawVectorBarcode(doc, item.barcode, bx, by, barcodeW, barcodeH);

      doc.setFont('courier', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(15, 23, 42);
      doc.text(item.barcode, bx + barcodeW / 2, by + barcodeH + 0.07, { align: 'center' });
    }
    return;
  }

  // Square Tag (1.5" x 1.5")
  if (template.id === '94220') {
    if (logo) {
      embeddedLogo = embedPdfBrandLogo(doc, logo, x, y, width, height, theme.logoPlacement, 'small');
    }

    if (showStoreName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(theme.storeFontSize ? theme.storeFontSize * 0.9 : 6);
      doc.setTextColor(...hexToRgb(theme.storeColor));
      doc.text(String(storeName || '777 LIQUOR STORE').toUpperCase().slice(0, 18), x + width / 2, y + padY + 0.06, { align: 'center' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(theme.titleFontSize ? theme.titleFontSize * 0.9 : 7.5);
    doc.setTextColor(...hexToRgb(theme.titleColor));
    const titleLines = doc.splitTextToSize(item.name || '', innerW).slice(0, 2);
    doc.text(titleLines, x + width / 2, y + padY + 0.22, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(theme.priceFontSize || 13);
    doc.setTextColor(...hexToRgb(theme.priceColor));
    doc.text(formatTagPrice(item.price), x + width / 2, y + padY + 0.55, { align: 'center' });

    if (showBarcode && item.barcode) {
      const barcodeW = 1.20;
      const barcodeH = 0.26;
      const bx = x + (width - barcodeW) / 2;
      const by = y + height - padY - barcodeH - 0.08;
      drawVectorBarcode(doc, item.barcode, bx, by, barcodeW, barcodeH);

      doc.setFont('courier', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(15, 23, 42);
      doc.text(item.barcode, bx + barcodeW / 2, by + barcodeH + 0.07, { align: 'center' });
    }
    return;
  }

  // Standard Avery 5160 / 8160 (1.0" x 2.625")
  if (logo) {
    embeddedLogo = embedPdfBrandLogo(doc, logo, x, y, width, height, theme.logoPlacement, theme.logoScale);
  }

  const topY = y + padY + 0.07;

  if (showStoreName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(theme.storeFontSize || 6.5);
    doc.setTextColor(...hexToRgb(theme.storeColor));
    doc.text(String(storeName || '777 LIQUOR STORE').toUpperCase().slice(0, 20), x + padX, topY);
  }
  if (showCategory && item.category) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(theme.sizeFontSize || 6);
    doc.setTextColor(...hexToRgb(theme.storeColor));
    const rightX = (embeddedLogo && theme.logoPlacement === 'top-right') ? x + width - padX - embeddedLogo.imgW - 0.04 : x + width - padX;
    doc.text(String(item.category).toUpperCase().slice(0, 16), rightX, topY, { align: 'right' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(theme.titleFontSize || 8.2);
  doc.setTextColor(...hexToRgb(theme.titleColor));
  const availableTitleW = (embeddedLogo && theme.logoPlacement === 'top-right') ? innerW - embeddedLogo.imgW - 0.05 : innerW;
  const titleLines = doc.splitTextToSize(item.name || '', availableTitleW).slice(0, 2);
  doc.text(titleLines, x + padX, topY + 0.12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(theme.priceFontSize || 13);
  doc.setTextColor(...hexToRgb(theme.priceColor));
  doc.text(formatTagPrice(item.price), x + padX, y + height - padY - 0.14);

  if (item.size) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(theme.sizeFontSize || 6);
    doc.setTextColor(71, 85, 105);
    doc.text(item.size, x + padX, y + height - padY - 0.02);
  }

  if (showBarcode && item.barcode) {
    const barcodeW = 1.30;
    const barcodeH = 0.22;
    const bx = x + width - padX - barcodeW;
    const by = y + height - padY - barcodeH - 0.08;
    drawVectorBarcode(doc, item.barcode, bx, by, barcodeW, barcodeH);

    doc.setFont('courier', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(15, 23, 42);
    doc.text(item.barcode, bx + barcodeW / 2, by + barcodeH + 0.07, { align: 'center' });
  }
}

/**
 * Generates an authentic jsPDF Document instance adhering to exact Avery label sizing and placement.
 * @param {PriceTagItem[]} items
 * @param {AveryTemplate} template
 * @param {Object} [options]
 * @returns {jsPDF}
 */
export function generateAveryPdf(items, template, options = {}) {
  const {
    startPosition = 1,
    copiesPerItem = 1,
    storeName = '777 Liquor Store',
    showStoreName = true,
    showBarcode = true,
    showCategory = true,
    drawGuides = false,
    theme = DEFAULT_AVERY_THEME,
    brandLogos = []
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter'
  });

  const { pages } = paginateAveryLabels(items, template, startPosition, copiesPerItem);

  if (!pages.length) {
    return doc;
  }

  pages.forEach((pageItems, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage('letter', 'portrait');
    }

    pageItems.forEach((item, slotIndex) => {
      const col = slotIndex % template.columns;
      const row = Math.floor(slotIndex / template.columns);
      const x = template.leftMarginIn + col * (template.labelWidthIn + template.colGapIn);
      const y = template.topMarginIn + row * (template.labelHeightIn + template.rowGapIn);
      const width = template.labelWidthIn;
      const height = template.labelHeightIn;

      if (drawGuides) {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.005);
        doc.rect(x, y, width, height, 'S');
      }

      if (!item) {
        return;
      }

      renderSingleAveryLabel(doc, item, x, y, width, height, template, {
        storeName,
        showStoreName,
        showBarcode,
        showCategory,
        theme,
        brandLogos
      });
    });
  });

  return doc;
}

/**
 * Generates and downloads the PDF file adhering strictly to Avery label dimensions and placement.
 * @param {PriceTagItem[]} items
 * @param {AveryTemplate} template
 * @param {Object} [options]
 * @param {string} [filename]
 * @returns {string}
 */
export function saveAveryPdf(items, template, options = {}, filename) {
  const doc = generateAveryPdf(items, template, options);
  const finalName = filename || `avery_${template.id}_price_tags_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(finalName);
  return finalName;
}

/**
 * Generates an application/pdf Blob and object URL for in-app viewing or opening.
 * @param {PriceTagItem[]} items
 * @param {AveryTemplate} template
 * @param {Object} [options]
 * @returns {{ blob: Blob, url: string }}
 */
export function getAveryPdfBlobUrl(items, template, options = {}) {
  const doc = generateAveryPdf(items, template, options);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

