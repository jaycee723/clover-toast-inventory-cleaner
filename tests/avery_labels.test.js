import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AVERY_TEMPLATES,
  encodeCode128B,
  generateBarcodeSvg,
  formatTagPrice,
  paginateAveryLabels,
  exportAveryCsv
} from '../src/avery_labels.js';

test('AVERY_TEMPLATES includes key retail sizes (5160, 5163, 5161, 5167, 94220)', () => {
  assert.ok(AVERY_TEMPLATES.length >= 5);
  const t5160 = AVERY_TEMPLATES.find((t) => t.id === '5160');
  assert.ok(t5160);
  assert.equal(t5160.labelsPerSheet, 30);
  assert.equal(t5160.columns, 3);
  assert.equal(t5160.rows, 10);

  const t5163 = AVERY_TEMPLATES.find((t) => t.id === '5163');
  assert.ok(t5163);
  assert.equal(t5163.labelsPerSheet, 10);

  const t5167 = AVERY_TEMPLATES.find((t) => t.id === '5167');
  assert.ok(t5167);
  assert.equal(t5167.labelsPerSheet, 80);
});

test('encodeCode128B and generateBarcodeSvg generate valid vector barcode patterns', () => {
  const code = '061994700002';
  const widths = encodeCode128B(code);
  assert.ok(widths.length > 20);

  const svg = generateBarcodeSvg(code, 35);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('<rect'));
  assert.ok(svg.includes('fill="#000000"'));
});

test('formatTagPrice formats numbers and strings with dollar sign and two decimals', () => {
  assert.equal(formatTagPrice('24.99'), '$24.99');
  assert.equal(formatTagPrice('16'), '$16.00');
  assert.equal(formatTagPrice(9.5), '$9.50');
  assert.equal(formatTagPrice(''), '$0.00');
  assert.equal(formatTagPrice(null), '$0.00');
});

test('paginateAveryLabels distributes items onto sheets and respects start position offset', () => {
  const template = AVERY_TEMPLATES.find((t) => t.id === '5160'); // 30 per sheet
  const items = [
    { id: '1', name: 'Item 1', price: '10.00', barcode: '111', category: 'BEER' },
    { id: '2', name: 'Item 2', price: '20.00', barcode: '222', category: 'WINE' },
    { id: '3', name: 'Item 3', price: '30.00', barcode: '333', category: 'SPIRITS' }
  ];

  // Standard starting at position 1 (first label on sheet)
  const pagination1 = paginateAveryLabels(items, template, 1, 1);
  assert.equal(pagination1.totalPages, 1);
  assert.equal(pagination1.totalLabels, 3);
  assert.equal(pagination1.pages[0][0].name, 'Item 1');
  assert.equal(pagination1.pages[0][1].name, 'Item 2');
  assert.equal(pagination1.pages[0][2].name, 'Item 3');
  assert.equal(pagination1.pages[0][3], null); // remaining slots empty

  // Starting at label #5 (reuse partially printed sheet, 4 blanks first)
  const paginationOffset = paginateAveryLabels(items, template, 5, 1);
  assert.equal(paginationOffset.pages[0][0], null);
  assert.equal(paginationOffset.pages[0][1], null);
  assert.equal(paginationOffset.pages[0][2], null);
  assert.equal(paginationOffset.pages[0][3], null);
  assert.equal(paginationOffset.pages[0][4].name, 'Item 1');
});

test('exportAveryCsv produces header and valid CSV rows for Avery Design & Print Online', () => {
  const items = [
    { id: '1', name: "Tito's Handmade Vodka 750 mL", price: '24.99', barcode: '061994700002', category: 'LIQUOR/SPIRITS' }
  ];

  const csv = exportAveryCsv(items, '777 Liquor Store');
  assert.ok(csv.includes('Product Name,Price,Formatted Price,Barcode UPC,Category,Store Name'));
  assert.ok(csv.includes("Tito's Handmade Vodka 750 mL"));
  assert.ok(csv.includes('24.99'));
  assert.ok(csv.includes('061994700002'));
  assert.ok(csv.includes('777 Liquor Store'));
});
