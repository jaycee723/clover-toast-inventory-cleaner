import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRuleBasedFormatting } from '../src/formatting_rules.js';
import {
  sanitizeDocId,
  reconcileImportWithMaster,
  executeMerge
} from '../src/master_inventory.js';
import {
  normalizeBrandKey,
  findLogoForProduct
} from '../src/brand_logos.js';

test('Security & Regex: formatting_rules processes long inputs linearly without catastrophic backtracking', () => {
  const evilInput = 'A'.repeat(500) + ' 1.75 L ' + 'B'.repeat(500);
  const start = Date.now();
  const res = generateRuleBasedFormatting('standardize volume and title case', [
    { id: '1', name: evilInput, barcode: '123456789012' }
  ]);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 200, `Execution took ${elapsed}ms, should be linear under 200ms`);
  assert.ok(res.changes !== undefined);
});

test('Security: sanitizeDocId generates safe alphanumeric Firestore IDs and handles missing barcodes securely', () => {
  const id1 = sanitizeDocId('012345678905');
  assert.equal(id1, '012345678905');

  const idSpecial = sanitizeDocId('012/345:678#9');
  assert.equal(idSpecial, '012_345_678_9');

  const idBlank = sanitizeDocId('');
  assert.ok(idBlank.startsWith('item_'));
  assert.ok(idBlank.length > 10);
});

test('Master Inventory: reconcileImportWithMaster correctly classifies new, update, and match items', () => {
  const master = [
    { barcode: '111111111111', name: 'Original Vodka 750ml', price: '19.99', category: 'Spirits' },
    { barcode: '222222222222', name: 'Corona Extra 12-Pack', price: '18.99', category: 'Beer' }
  ];

  const incoming = [
    // Exact match
    { barcode: '111111111111', name: 'Original Vodka 750ml', price: '19.99', category: 'Spirits' },
    // Price update
    { barcode: '222222222222', name: 'Corona Extra 12-Pack', price: '21.99', category: 'Beer' },
    // Brand-new item
    { barcode: '333333333333', name: 'High Noon Peach 4-Pack', price: '11.99', category: 'RTD' }
  ];

  const { diffs, stats } = reconcileImportWithMaster(incoming, master);

  assert.equal(stats.total, 3);
  assert.equal(stats.matchCount, 1);
  assert.equal(stats.updateCount, 1);
  assert.equal(stats.newCount, 1);

  const matchItem = diffs.find((d) => d.incoming.barcode === '111111111111');
  assert.equal(matchItem.status, 'match');

  const updateItem = diffs.find((d) => d.incoming.barcode === '222222222222');
  assert.equal(updateItem.status, 'update');
  assert.ok(updateItem.fieldDiffs.price !== undefined);
  assert.equal(updateItem.fieldDiffs.price.old, '18.99');
  assert.equal(updateItem.fieldDiffs.price.new, '21.99');

  const newItem = diffs.find((d) => d.incoming.barcode === '333333333333');
  assert.equal(newItem.status, 'new');
});

test('Master Inventory: executeMerge in "all" mode updates existing and adds new items', async () => {
  const master = [
    { barcode: '111111111111', name: 'Original Vodka', price: '19.99' }
  ];

  const incoming = [
    { barcode: '111111111111', name: 'Original Vodka 750ml', price: '22.99' },
    { barcode: '333333333333', name: 'New Tequila', price: '34.99' }
  ];

  const { diffs } = reconcileImportWithMaster(incoming, master);
  const updatedList = await executeMerge(diffs, master, 'all');

  assert.equal(updatedList.length, 2);

  const updatedVodka = updatedList.find((i) => i.barcode === '111111111111');
  assert.equal(updatedVodka.name, 'Original Vodka 750ml');
  assert.equal(updatedVodka.price, '22.99');

  const newTequila = updatedList.find((i) => i.barcode === '333333333333');
  assert.equal(newTequila.name, 'New Tequila');
});

test('Master Inventory: executeMerge in "new_only" mode adds only brand-new items and preserves existing', async () => {
  const master = [
    { barcode: '111111111111', name: 'Original Vodka', price: '19.99' }
  ];

  const incoming = [
    // This item exists, should NOT be overwritten in new_only mode
    { barcode: '111111111111', name: 'Changed Vodka', price: '99.99' },
    // Brand new item
    { barcode: '444444444444', name: 'Brand New Rum', price: '15.99' }
  ];

  const { diffs } = reconcileImportWithMaster(incoming, master);
  const updatedList = await executeMerge(diffs, master, 'new_only');

  assert.equal(updatedList.length, 2);

  const existingVodka = updatedList.find((i) => i.barcode === '111111111111');
  assert.equal(existingVodka.name, 'Original Vodka');
  assert.equal(existingVodka.price, '19.99');

  const newRum = updatedList.find((i) => i.barcode === '444444444444');
  assert.equal(newRum.name, 'Brand New Rum');
});

test('Brand Logos: normalizeBrandKey and findLogoForProduct match products by brand or item name', () => {
  const logos = [
    { id: 'logo_1', brandName: 'Jack Daniel\'s', brandKey: 'jackdaniels', dataUrl: 'data:image/png;base64,...' },
    { id: 'logo_2', brandName: 'Corona', brandKey: 'corona', dataUrl: 'data:image/png;base64,...' }
  ];

  assert.equal(normalizeBrandKey("Jack Daniel's!"), 'jackdaniels');

  const matched1 = findLogoForProduct({ name: "Jack Daniel's Old No. 7 750ml", brand: '' }, logos);
  assert.ok(matched1);
  assert.equal(matched1.brandName, 'Jack Daniel\'s');

  const matched2 = findLogoForProduct({ name: "Corona Extra Beer 12-Pack", brand: 'Corona' }, logos);
  assert.ok(matched2);
  assert.equal(matched2.brandName, 'Corona');

  const unmatched = findLogoForProduct({ name: "Absolut Vodka 1 L", brand: 'Absolut' }, logos);
  assert.equal(unmatched, null);
});
