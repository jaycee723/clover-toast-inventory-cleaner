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

test('formatting rules never touch pricing and only fix name, category, and UPC', () => {
  const items = [
    { id: 'p1', name: 'TITOS VODKA 750ML', barcode: '8832000001', category: 'General', price: '24.99' },
    { id: 'p2', name: 'CORONA EXTRA 12PK', barcode: '080660956152', category: 'General', price: '16.99' }
  ];

  // User specifically prompts about prices and UPC
  const res = generateRuleBasedFormatting('Format pricing to 2 decimal places and pad UPC barcodes', items);
  
  // Verify NO price changes are ever produced
  const priceChanges = res.changes.filter((c) => c.field === 'price');
  assert.equal(priceChanges.length, 0);

  // Verify all changes are ONLY name, category, or barcode
  for (const ch of res.changes) {
    assert.ok(ch.field === 'name' || ch.field === 'category' || ch.field === 'barcode');
    assert.notEqual(ch.field, 'price');
  }

  // Barcode padding for 10/11 digit UPC
  const upcChange = res.changes.find((c) => c.id === 'p1' && c.field === 'barcode');
  assert.ok(upcChange);
  assert.match(upcChange.reason, /UPC|barcode/i);
});
