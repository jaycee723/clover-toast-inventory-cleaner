import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRows,
  computeRowCertainty,
  updateRowValue,
  revertRowEdit,
  revertAllEdits,
  autoApproveHighCertainty,
  isApproved
} from '../src/review.js';
import { SAMPLE_777_INVENTORY } from '../app.js';

test('computeRowCertainty distinguishes high-certainty rows from rows with review flags', () => {
  const rows = buildRows([
    { name: "Tito's Vodka 750ml", barcode: '067454500005', price: '24.99', category: 'Spirits' },
    { name: 'Unknown Item', barcode: '', price: '9.99', category: 'General' },
    { name: 'Bad Check Digit Item', barcode: '067454500009', price: '12.00', category: 'Wine' }
  ]);

  const cert1 = computeRowCertainty(rows[0]);
  assert.equal(cert1.certainty, 'high');
  assert.equal(cert1.flagged, false);

  const cert2 = computeRowCertainty(rows[1]);
  assert.equal(cert2.certainty, 'review');
  assert.equal(cert2.flagged, true);
  assert.ok(cert2.reasons.some((r) => r.toLowerCase().includes('barcode')));

  const cert3 = computeRowCertainty(rows[2]);
  assert.equal(cert3.certainty, 'review');
  assert.equal(cert3.flagged, true);
});

test('updateRowValue modifies fields, updates barcode analysis, and marks row as edited', () => {
  const rows = buildRows([
    { name: 'Old Name', barcode: '067454500005', price: '10.00', category: 'Beer' }
  ]);

  updateRowValue(rows, 'r1', 'name', 'Updated Name 6-Pack');
  assert.equal(rows[0].current_name, 'Updated Name 6-Pack');
  assert.equal(rows[0].manuallyEdited, true);
  assert.equal(rows[0].decisions.name, 'accept');

  updateRowValue(rows, 'r1', 'category', 'Craft Beer');
  assert.equal(rows[0].category, 'Craft Beer');
  assert.equal(rows[0].decisions.category, 'accept');

  updateRowValue(rows, 'r1', 'barcode', '080660956152');
  assert.equal(rows[0].barcode.original, '080660956152');
  assert.equal(rows[0].barcode.structurallyValid, true);
});

test('revertRowEdit restores a row back to original imported Clover values', () => {
  const rows = buildRows([
    { name: 'Original Clover Name', barcode: '067454500005', price: '15.00', category: 'Wine' }
  ]);

  updateRowValue(rows, 'r1', 'name', 'Edited Custom Name');
  assert.equal(rows[0].current_name, 'Edited Custom Name');

  revertRowEdit(rows, 'r1');
  assert.equal(rows[0].current_name, 'Original Clover Name');
  assert.equal(rows[0].manuallyEdited, false);
  assert.equal(rows[0].decisions.name, 'pending');
});

test('revertAllEdits resets all modified rows back to original values', () => {
  const rows = buildRows([
    { name: 'Item One', barcode: '067454500005', price: '10.00' },
    { name: 'Item Two', barcode: '080660956153', price: '20.00' }
  ]);

  updateRowValue(rows, 'r1', 'name', 'Item One Edited');
  updateRowValue(rows, 'r2', 'name', 'Item Two Edited');

  const count = revertAllEdits(rows);
  assert.equal(count, 2);
  assert.equal(rows[0].current_name, 'Item One');
  assert.equal(rows[1].current_name, 'Item Two');
});

test('autoApproveHighCertainty only approves clean items and leaves flagged items pending', () => {
  const rows = buildRows([
    { name: "Clean Tito's", barcode: '067454500005', price: '24.99' },
    { name: 'Missing Barcode', barcode: '', price: '9.99' }
  ]);

  const approvedCount = autoApproveHighCertainty(rows);
  assert.equal(approvedCount, 1);
  assert.equal(rows[0].decisions.barcode, 'accept');
  assert.equal(rows[1].decisions.barcode, 'pending');
});

test('SAMPLE_777_INVENTORY contains verified catalog items for 777 Liquor Store testing', () => {
  assert.ok(Array.isArray(SAMPLE_777_INVENTORY));
  assert.ok(SAMPLE_777_INVENTORY.length >= 10);
  const titos = SAMPLE_777_INVENTORY.find((item) => item.name.includes('TITOS'));
  assert.ok(titos);
  assert.equal(titos.barcode, '067454500005');
});
