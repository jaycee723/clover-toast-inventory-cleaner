import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBarcodeIdentity,
  formatToastPrice,
  validateToastRow,
  buildToastRetailRow,
  buildToastMenuRow,
  exportToastRows,
  summarizeToastReadiness,
  TOAST_RETAIL_HEADERS,
  TOAST_MENU_HEADERS
} from '../src/toast.js';
import { buildRows, setDecision } from '../src/review.js';
import { toCsv } from '../src/csv.js';

const CANON = ['BEER', 'LIQUOR/SPIRITS', 'SNACKS'];

test('getBarcodeIdentity extracts clean barcode and pads missing leading zeros for UPC-A', () => {
  const rows = buildRows([
    { name: 'Bud Light', barcode: '036000291452' },
    { name: 'Modelo 24oz', barcode: '8.2184090503e+10' } // presumed leading zeros
  ], { canonical: CANON });

  assert.equal(getBarcodeIdentity(rows[0]), '036000291452');
  assert.equal(getBarcodeIdentity(rows[1]), '082184090503');
});

test('formatToastPrice handles various inputs', () => {
  assert.equal(formatToastPrice('19.99'), '19.99');
  assert.equal(formatToastPrice('$19.99'), '19.99');
  assert.equal(formatToastPrice('25'), '25.00');
  assert.equal(formatToastPrice(12.5), '12.50');
  assert.equal(formatToastPrice(''), '');
  assert.equal(formatToastPrice(null), '');
  assert.equal(formatToastPrice(-5), '');
});

test('validateToastRow requires barcode as product identity', () => {
  const rows = buildRows([
    { name: 'With Barcode', barcode: '036000291452', price: '10.99', category: 'BEER' },
    { name: 'No Barcode', barcode: '', price: '5.00', category: 'SNACKS' },
    { name: 'Bad Check Digit', barcode: '012000161156', price: '4.00' }
  ], { canonical: CANON });

  const v1 = validateToastRow(rows[0]);
  assert.equal(v1.valid, true);
  assert.equal(v1.barcode, '036000291452');

  const v2 = validateToastRow(rows[1]);
  assert.equal(v2.valid, false);
  assert.ok(v2.errors.some((e) => e.includes('Missing barcode')));

  const v3 = validateToastRow(rows[2]);
  assert.equal(v3.valid, false);
  assert.ok(v3.errors.some((e) => e.includes('Invalid barcode structure')));
});

test('buildToastRetailRow uses barcode as SKU and Barcode product identity', () => {
  const rows = buildRows([
    { name: 'BUD LIGHT 12PK', barcode: '036000291452', price: '15.99', cost: '11.50', category: 'BEER' }
  ], { canonical: CANON });

  setDecision(rows, 'r1', 'barcode', 'accept');
  setDecision(rows, 'r1', 'name', 'accept');
  setDecision(rows, 'r1', 'category', 'accept');

  const retailRow = buildToastRetailRow(rows[0]);
  assert.equal(retailRow.length, TOAST_RETAIL_HEADERS.length);
  assert.equal(retailRow[0], 'Bud Light 12 Pack'); // Name
  assert.equal(retailRow[1], 'BEER');              // Category
  assert.equal(retailRow[2], '15.99');             // Price
  assert.equal(retailRow[3], '11.50');             // Cost
  assert.equal(retailRow[4], '036000291452');      // SKU
  assert.equal(retailRow[5], '036000291452');      // Barcode
  assert.equal(retailRow[6], 'Bud Light 12 Pack'); // POS Name
  assert.equal(retailRow[8], 'EA');                // Unit of measure
});

test('buildToastMenuRow produces valid Toast menu bulk import format', () => {
  const rows = buildRows([
    { name: 'BUD LIGHT 12PK', barcode: '036000291452', price: '15.99', category: 'BEER' }
  ], { canonical: CANON });

  setDecision(rows, 'r1', 'barcode', 'accept');
  setDecision(rows, 'r1', 'name', 'accept');
  setDecision(rows, 'r1', 'category', 'accept');

  const menuRow = buildToastMenuRow(rows[0]);
  assert.equal(menuRow.length, TOAST_MENU_HEADERS.length);
  assert.equal(menuRow[0], 'CREATE');
  assert.equal(menuRow[1], 'MENU_ITEM');
  assert.equal(menuRow[2], 'Bud Light 12 Pack');
  assert.equal(menuRow[5], '15.99');
  assert.equal(menuRow[6], 'BEER');
  assert.equal(menuRow[7], '036000291452'); // SKU
  assert.equal(menuRow[8], '036000291452'); // Barcode
  assert.equal(menuRow[9], 'BASE');
});

test('exportToastRows filters by approved and generates clean CSV', () => {
  const rows = buildRows([
    { name: 'Item 1', barcode: '036000291452', price: '10' },
    { name: 'Item 2', barcode: '012000161155', price: '12' },
    { name: 'Item 3 without barcode', barcode: '', price: '5' }
  ], { canonical: CANON });

  // Only approve item 1
  setDecision(rows, 'r1', 'barcode', 'accept');
  setDecision(rows, 'r1', 'name', 'accept');
  setDecision(rows, 'r1', 'category', 'accept');

  const exportTable = exportToastRows(rows, { format: 'retail', onlyApproved: true });
  assert.equal(exportTable.length, 2); // Header + 1 row
  assert.equal(exportTable[0], TOAST_RETAIL_HEADERS);
  assert.equal(exportTable[1][4], '036000291452');

  const csv = toCsv(exportTable);
  assert.ok(csv.includes('"036000291452"'));
  assert.ok(!csv.includes('Item 2'));
  assert.ok(!csv.includes('Item 3'));
});

test('summarizeToastReadiness provides accurate counts', () => {
  const rows = buildRows([
    { name: 'Item 1', barcode: '036000291452', price: '10' },
    { name: 'Item 2', barcode: '012000161156', price: '12' }, // invalid check digit
    { name: 'Item 3', barcode: '', price: '5' } // missing barcode
  ], { canonical: CANON });

  setDecision(rows, 'r1', 'barcode', 'accept');

  const summary = summarizeToastReadiness(rows);
  assert.equal(summary.total, 3);
  assert.equal(summary.missingBarcode, 1);
  assert.equal(summary.invalidBarcode, 1);
  assert.equal(summary.readyApproved, 1);
});
