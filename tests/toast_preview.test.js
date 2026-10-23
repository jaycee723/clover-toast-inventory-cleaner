import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportToastRows,
  computeToastPreviewSummary,
  TOAST_RETAIL_HEADERS,
  TOAST_MENU_HEADERS
} from '../src/toast.js';
import { buildRows } from '../src/review.js';

test('exportToastRows produces header and item rows matching Toast Retail catalog specification', () => {
  const rows = buildRows([
    { name: "Tito's Handmade Vodka 750ml", barcode: '012000161155', price: '24.99', cost: '18.00', category: 'Spirits' },
    { name: 'Corona Extra 12-Pack', barcode: '036000291452', price: '16.99', cost: '12.50', category: 'Beer' }
  ]);

  rows[0].decisions.barcode = 'accept';
  rows[1].decisions.barcode = 'accept';

  const table = exportToastRows(rows, { format: 'retail', onlyApproved: false });
  assert.equal(table.length, 3); // 1 header + 2 items
  assert.deepEqual(table[0], TOAST_RETAIL_HEADERS);

  const row1 = table[1];
  assert.equal(row1[0], "Tito's Handmade Vodka 750ml"); // Name
  assert.equal(row1[1], 'Spirits');                     // Category
  assert.equal(row1[2], '24.99');                       // Price
  assert.equal(row1[3], '18.00');                       // Cost
  assert.equal(row1[4], '012000161155');                // SKU (Barcode as product identity)
  assert.equal(row1[5], '012000161155');                // Barcode
  assert.equal(row1[8], 'EA');                          // Unit of Measure
});

test('exportToastRows produces header and item rows matching Toast Menu bulk import specification', () => {
  const rows = buildRows([
    { name: 'Guinness Draught 4pk', barcode: '083820123456', price: '9.99', category: 'Beer' }
  ]);
  rows[0].decisions.barcode = 'accept';

  const table = exportToastRows(rows, { format: 'menu', onlyApproved: false });
  assert.equal(table.length, 2);
  assert.deepEqual(table[0], TOAST_MENU_HEADERS);

  const row1 = table[1];
  assert.equal(row1[0], 'CREATE');
  assert.equal(row1[1], 'MENU_ITEM');
  assert.equal(row1[2], 'Guinness Draught 4pk');
  assert.equal(row1[7], '083820123456'); // SKU
  assert.equal(row1[8], '083820123456'); // Barcode
});

test('search filtering matches item rows by name, barcode, or category', () => {
  const items = [
    ['Tito\'s Vodka', 'Spirits', '24.99', '18.00', '088320000001', '088320000001'],
    ['Corona Extra', 'Beer', '16.99', '12.50', '072890000114', '072890000114'],
    ['Kendall Chardonnay', 'Wine', '14.99', '10.00', '084250000055', '084250000055']
  ];

  const filterRows = (q) => items.filter((row) => row.some((cell) => cell.toLowerCase().includes(q.toLowerCase())));

  assert.equal(filterRows('vodka').length, 1);
  assert.equal(filterRows('beer').length, 1);
  assert.equal(filterRows('072890').length, 1);
  assert.equal(filterRows('').length, 3);
});

test('computeToastPreviewSummary calculates total item count and average price correctly for Retail rows', () => {
  const headers = ['Name', 'Category', 'Price', 'Cost', 'SKU', 'Barcode'];
  const rows = [
    ["Tito's Vodka", 'Spirits', '24.99', '18.00', '012000161155', '012000161155'],
    ['Corona Extra 12pk', 'Beer', '15.01', '10.50', '036000291452', '036000291452']
  ];

  const summary = computeToastPreviewSummary(headers, rows);
  assert.equal(summary.totalCount, 2);
  assert.equal(summary.priceCount, 2);
  assert.equal(summary.totalPrice, '40.00');
  assert.equal(summary.avgPrice, '20.00');
});

test('computeToastPreviewSummary handles dollar signs, commas, and zero prices in Menu rows', () => {
  const headers = ['Option', 'Type', 'Name', 'POS Name', 'Kitchen Name', 'Price', 'Category', 'SKU', 'Barcode'];
  const rows = [
    ['CREATE', 'MENU_ITEM', 'High-end Scotch', 'High-end Scotch', 'Scotch', '$1,200.50', 'Spirits', '011111111111', '011111111111'],
    ['CREATE', 'MENU_ITEM', 'Water Bottle', 'Water', 'Water', '$0.00', 'Beverage', '022222222222', '022222222222'],
    ['CREATE', 'MENU_ITEM', 'Craft IPA', 'Craft IPA', 'IPA', '$9.50', 'Beer', '033333333333', '033333333333']
  ];

  const summary = computeToastPreviewSummary(headers, rows);
  assert.equal(summary.totalCount, 3);
  assert.equal(summary.priceCount, 3);
  // 1200.50 + 0 + 9.50 = 1210.00 / 3 = 403.3333...
  assert.equal(summary.totalPrice, '1210.00');
  assert.equal(summary.avgPrice, '403.33');
});

test('computeToastPreviewSummary handles empty rows and missing price column gracefully', () => {
  const emptySummary = computeToastPreviewSummary(TOAST_RETAIL_HEADERS, []);
  assert.equal(emptySummary.totalCount, 0);
  assert.equal(emptySummary.priceCount, 0);
  assert.equal(emptySummary.totalPrice, '0.00');
  assert.equal(emptySummary.avgPrice, '0.00');

  const noPriceSummary = computeToastPreviewSummary(['Name', 'Category', 'SKU'], [['Item 1', 'Beer', '123']]);
  assert.equal(noPriceSummary.totalCount, 1);
  assert.equal(noPriceSummary.priceCount, 0);
  assert.equal(noPriceSummary.totalPrice, '0.00');
  assert.equal(noPriceSummary.avgPrice, '0.00');
});
