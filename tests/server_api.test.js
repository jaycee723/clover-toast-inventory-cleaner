import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRuleBasedFormatting } from '../src/formatting_rules.js';

test('generateRuleBasedFormatting title-cases brands and standardizes volumes', () => {
  const items = [
    { id: 'r1', name: 'TITOS HANDMADE VODKA 750 ML', category: '', price: '24.99' },
    { id: 'r2', name: 'CORONA EXTRA 12PK', category: '', price: '16.99' },
    { id: 'r3', name: 'KENDALL JACKSON CHARDONNAY 1.75 L', category: '', price: '29.99' }
  ];

  const res = generateRuleBasedFormatting('Title case brand names and standardize bottle volume and pack sizes', items);
  assert.ok(res.changes.length >= 3);
  
  const titos = res.changes.find((c) => c.id === 'r1' && c.field === 'name');
  assert.ok(titos);
  assert.match(titos.proposedValue, /Tito's Handmade Vodka 750ml|Titos Handmade Vodka 750ml/i);
  
  const corona = res.changes.find((c) => c.id === 'r2' && c.field === 'name');
  assert.ok(corona);
  assert.match(corona.proposedValue, /12-Pack/);

  const kj = res.changes.find((c) => c.id === 'r3' && c.field === 'name');
  assert.ok(kj);
  assert.match(kj.proposedValue, /1.75\s*L/);
});

test('generateRuleBasedFormatting respects capitalization rules (11oz, 1 L)', () => {
  const items = [
    { id: 'oz1', name: 'BUD LIGHT 11 OZ CAN', category: '' },
    { id: 'l1', name: 'SMIRNOFF VODKA 1L', category: '' }
  ];

  const res = generateRuleBasedFormatting('Standardize bottle volume and oz sizes', items);
  const bud = res.changes.find((c) => c.id === 'oz1');
  assert.ok(bud);
  assert.match(bud.proposedValue, /11oz/);

  const smirnoff = res.changes.find((c) => c.id === 'l1');
  assert.ok(smirnoff);
  assert.match(smirnoff.proposedValue, /1 L/);
});

test('generateRuleBasedFormatting auto-categorizes liquor, beer, wine', () => {
  const items = [
    { id: 'r1', name: 'Grey Goose Vodka 750ml', category: '' },
    { id: 'r2', name: 'Sierra Nevada IPA 6-Pack', category: '' },
    { id: 'r3', name: 'Robert Mondavi Cabernet', category: '' }
  ];

  const res = generateRuleBasedFormatting('Categorize all items into Beer, Wine, Spirits', items);
  const catChanges = res.changes.filter((c) => c.field === 'category');
  assert.equal(catChanges.length, 3);
  assert.equal(catChanges.find((c) => c.id === 'r1').proposedValue, 'Spirits');
  assert.equal(catChanges.find((c) => c.id === 'r2').proposedValue, 'Beer');
  assert.equal(catChanges.find((c) => c.id === 'r3').proposedValue, 'Wine');
});
