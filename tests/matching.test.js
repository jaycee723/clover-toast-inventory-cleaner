import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseReference } from '../src/matching.js';
import { evaluateCategoryConflicts, suggestMissingCategories } from '../src/categories.js';
import { normalizeNameConservatively } from '../src/normalization.js';

const refs = [
  { barcode: '036000291452', brand: 'American Spirit', product_name: 'American Spirit Blue', unit: 'pack', pack_count: '1', category: 'Tobacco', source_type: 'supplier_exact', approved: 'false' },
  { barcode: '036000291452', brand: 'American Spirit', product_name: 'American Spirit Blue', unit: 'pack', pack_count: '1', category: 'Tobacco', source_type: 'manual_approved', approved: 'true' },
  { barcode: '000000000001', brand: 'Modelo', product_name: 'Modelo Especial', unit: 'can', pack_count: '6', category: 'Beer', source_type: 'supplier_exact', approved: 'false' }
];

test('manual approved source has priority', () => {
  const row = chooseReference({ barcode: '036000291452', name: 'American Spirit Blue', brand: 'American Spirit', unit: 'pack', pack_count: '1', category: 'Tobacco' }, refs);
  assert.equal(row.provenance, 'manual_approved');
  assert.equal(row.status, 'approved');
});

test('mismatched UPC American Spirit vs Modelo is contradiction', () => {
  const row = chooseReference({ barcode: '000000000001', name: 'American Spirit Blue', brand: 'American Spirit', unit: 'pack', pack_count: '1', category: 'Tobacco' }, refs);
  assert.equal(row.status, 'contradiction');
  assert.ok(row.contradictions.length > 0);
});

test('brand strings are normalized conservatively without fuzzy correction', () => {
  assert.equal(normalizeNameConservatively('Bandana  12oz'), 'Bandana 12 oz');
  assert.equal(normalizeNameConservatively('KANVA 6pk'), 'KANVA 6 Pack');
  assert.equal(normalizeNameConservatively('Milky Way'), 'Milky Way');
});

test('category exception rules flag known conflicts', () => {
  assert.equal(evaluateCategoryConflicts('Cheetos Puffs', 'Snacks', 'Vapes').canSuggest, false);
  assert.equal(evaluateCategoryConflicts('Monster Trail Mix', 'Snacks', 'Drinks').canSuggest, false);
});

test('existing categories preserved and suggestions constrained to canonical list', () => {
  const result = suggestMissingCategories('Snacks; Chips', 'Drinks; Snacks', ['Snacks', 'Drinks', 'Beer']);
  assert.equal(result.preserved, 'Snacks; Chips');
  assert.equal(result.suggestion, 'Drinks');
});
