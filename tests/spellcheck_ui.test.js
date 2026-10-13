import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAliasText, scanInventoryForSpellingSuggestions, SPELLCHECK_PRESETS } from '../src/spellcheck.js';

test('Presets populate expected domain rules', () => {
  const bev = SPELLCHECK_PRESETS.beverage.rules;
  assert.ok(bev.some((r) => r.from === 'CHARD' && r.to === 'Chardonnay'));
  assert.ok(bev.some((r) => r.from === 'CAB SAUV' && r.to === 'Cabernet Sauvignon'));
  assert.ok(bev.some((r) => r.from === 'WHISKY' && r.to === 'Whiskey'));
});

test('Spelling scanner finds abbreviations in sample POS inventory names', () => {
  const records = [
    { name: 'KENDALL CHARD 750ML' },
    { name: 'J LOHR CAB SAUV 750ML' },
    { name: 'TITOS VODK 1L' },
    { name: 'CORONNA EXTRA 12PK' }
  ];
  const suggestions = scanInventoryForSpellingSuggestions(records, []);
  assert.ok(suggestions.length >= 3);
  const foundChard = suggestions.find((s) => s.from === 'CHARD');
  assert.equal(foundChard.to, 'Chardonnay');
  assert.equal(foundChard.confidence, 'high');
  assert.ok(foundChard.reason.length > 0);

  const foundCoronna = suggestions.find((s) => s.from === 'CORONNA');
  assert.equal(foundCoronna.to, 'Corona');
});
