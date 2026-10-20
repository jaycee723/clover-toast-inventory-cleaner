import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareDatasetForAi,
  computeDiffPreview,
  applyAiChanges,
  revertAiChanges
} from '../src/ai_assistant.js';
import { analyzeBarcode } from '../src/barcode.js';

test('prepareDatasetForAi creates formatted records with clean id and values', () => {
  const records = [
    { name: 'TITOS VODKA 750 ML', barcode: '088320000001', category: 'Liquor', price: 24.99 },
    { name: 'HEINEKEN 6PK', barcode: '072890000114', category: 'Beer', price: 11.99 }
  ];
  const rows = [
    { id: 'r1', current_name: 'TITOS VODKA 750 ML', barcode: analyzeBarcode('088320000001'), category: 'Liquor', price: 24.99 },
    { id: 'r2', current_name: 'HEINEKEN 6PK', barcode: analyzeBarcode('072890000114'), category: 'Beer', price: 11.99 }
  ];

  const prepared = prepareDatasetForAi(records, rows);
  assert.equal(prepared.length, 2);
  assert.equal(prepared[0].id, 'r1');
  assert.equal(prepared[0].name, 'TITOS VODKA 750 ML');
  assert.equal(prepared[1].id, 'r2');
  assert.equal(prepared[1].name, 'HEINEKEN 6PK');
});

test('computeDiffPreview generates informative before/after diff items', () => {
  const rows = [
    { id: 'r1', current_name: 'TITOS VODKA 750 ML', original_name: 'TITOS VODKA 750 ML' }
  ];
  const changes = [
    {
      id: 'r1',
      field: 'name',
      originalValue: 'TITOS VODKA 750 ML',
      proposedValue: "Tito's Handmade Vodka 750ml",
      reason: 'Standardized brand title casing and volume suffix'
    }
  ];

  const diff = computeDiffPreview(rows, changes);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].id, 'r1');
  assert.equal(diff[0].field, 'name');
  assert.equal(diff[0].originalValue, 'TITOS VODKA 750 ML');
  assert.equal(diff[0].proposedValue, "Tito's Handmade Vodka 750ml");
  assert.equal(diff[0].reason, 'Standardized brand title casing and volume suffix');
});

test('applyAiChanges and revertAiChanges successfully mutates and rolls back dataset', () => {
  const records = [
    { name: 'TITOS VODKA 750 ML', barcode: '088320000001', category: 'Liquor', price: 24.99 }
  ];
  const rows = [
    {
      id: 'r1',
      current_name: 'TITOS VODKA 750 ML',
      proposed_name: '',
      barcode: analyzeBarcode('088320000001'),
      category: 'Liquor',
      proposed_category: '',
      price: 24.99,
      decisions: { name: 'pending', barcode: 'pending', category: 'pending' }
    }
  ];

  const changes = [
    {
      id: 'r1',
      field: 'name',
      originalValue: 'TITOS VODKA 750 ML',
      proposedValue: "Tito's Handmade Vodka 750ml",
      reason: 'Brand title casing and size suffix'
    },
    {
      id: 'r1',
      field: 'category',
      originalValue: 'Liquor',
      proposedValue: 'Spirits / Vodka',
      reason: 'Standardized department hierarchy'
    }
  ];

  // Apply changes
  const result = applyAiChanges(records, rows, changes);
  assert.equal(result.appliedCount, 1);
  assert.equal(rows[0].current_name, "Tito's Handmade Vodka 750ml");
  assert.equal(rows[0].category, 'Spirits / Vodka');
  assert.equal(rows[0].decisions.name, 'accept');
  assert.equal(rows[0].decisions.category, 'accept');
  assert.equal(records[0].name, "Tito's Handmade Vodka 750ml");
  assert.equal(records[0].category, 'Spirits / Vodka');

  // Revert changes with undo snapshot
  const revertedCount = revertAiChanges(records, rows, result.undoSnapshot);
  assert.equal(revertedCount, 2);
  assert.equal(rows[0].current_name, 'TITOS VODKA 750 ML');
  assert.equal(rows[0].category, 'Liquor');
  assert.equal(rows[0].decisions.name, 'pending');
  assert.equal(rows[0].decisions.category, 'pending');
  assert.equal(records[0].name, 'TITOS VODKA 750 ML');
  assert.equal(records[0].category, 'Liquor');
});
