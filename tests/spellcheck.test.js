import test from 'node:test';
import assert from 'node:assert/strict';
import {
  damerauLevenshteinDistance,
  similarityRatio,
  explainEditDifference,
  scanInventoryForSpellingSuggestions,
  SPELLCHECK_PRESETS,
  POS_ABBREVIATIONS
} from '../src/spellcheck.js';

test('damerauLevenshteinDistance accurately computes edit and transposition distance', () => {
  assert.equal(damerauLevenshteinDistance('Heineken', 'Heiniken'), 1);
  assert.equal(damerauLevenshteinDistance('Budweiser', 'Budweisser'), 1);
  assert.equal(damerauLevenshteinDistance('Marlboro', 'Malboro'), 1);
  // Transposition of adjacent letters
  assert.equal(damerauLevenshteinDistance('tequila', 'tqeuila'), 1);
  assert.equal(damerauLevenshteinDistance('same', 'same'), 0);
});

test('explainEditDifference gives clear reasons for typos', () => {
  assert.match(explainEditDifference('Heiniken', 'Heineken'), /Single letter substitution/);
  assert.match(explainEditDifference('Malboro', 'Marlboro'), /Missing letter/);
  assert.match(explainEditDifference('Budweisser', 'Budweiser'), /Extra letter/);
  assert.match(explainEditDifference('Heineken', 'Heineken'), /Exact match/);
});

test('scanInventoryForSpellingSuggestions detects POS abbreviations with reasoning and examples', () => {
  const records = [
    { name: 'KENDALL JACKSON CHARD 750ML' },
    { name: 'CHARDONNAY CHARD 1.5L' },
    { name: 'J LOHR CAB SAUV 750ML' },
    { name: 'HEINIKEN 6PK BTL' },
    { name: 'JACK DANIELS WHISKY 1L' },
    { name: 'NORMAL PRODUCT BEER' }
  ];

  const suggestions = scanInventoryForSpellingSuggestions(records, []);
  assert.ok(suggestions.length >= 3, 'Should produce at least 3 suggestions');

  const chard = suggestions.find((s) => s.from === 'CHARD');
  assert.ok(chard, 'Should detect CHARD');
  assert.equal(chard.to, 'Chardonnay');
  assert.equal(chard.confidence, 'high');
  assert.match(chard.reason, /wine shorthand/i);
  assert.equal(chard.frequency, 2);

  const cab = suggestions.find((s) => s.from === 'CAB SAUV');
  assert.ok(cab, 'Should detect CAB SAUV');
  assert.equal(cab.to, 'Cabernet Sauvignon');

  const heineken = suggestions.find((s) => s.from === 'HEINIKEN');
  assert.ok(heineken, 'Should detect HEINIKEN typo');
  assert.equal(heineken.to, 'Heineken');

  const whisky = suggestions.find((s) => s.from === 'WHISKY');
  assert.ok(whisky, 'Should detect WHISKY spelling');
  assert.equal(whisky.to, 'Whiskey');
});

test('scanInventoryForSpellingSuggestions excludes already approved aliases', () => {
  const records = [{ name: 'KENDALL JACKSON CHARD 750ML' }];
  const existing = [{ from: 'CHARD', to: 'Chardonnay', approved: true }];
  const suggestions = scanInventoryForSpellingSuggestions(records, existing);
  assert.ok(!suggestions.some((s) => s.from === 'CHARD'), 'Must exclude already approved aliases');
});

test('SPELLCHECK_PRESETS contains categorized industry rules', () => {
  assert.ok(SPELLCHECK_PRESETS.beverage.rules.length > 5);
  assert.ok(SPELLCHECK_PRESETS.flavors.rules.length > 5);
  assert.ok(SPELLCHECK_PRESETS.brands.rules.length > 5);
});
