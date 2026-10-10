import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupOpenFoodFacts } from '../src/off.js';

test('returns unavailable when fetch missing', async () => {
  const result = await lookupOpenFoodFacts({ barcode: '036000291452', fetchImpl: null });
  assert.equal(result.status, 'unavailable');
});

test('uses cache and reports not-found', async () => {
  const cache = new Map();
  const fetchImpl = async () => ({ ok: true, json: async () => ({ product: null }) });
  const result = await lookupOpenFoodFacts({ barcode: '036000291452', fetchImpl, cache });
  assert.equal(result.status, 'not-found');
  assert.equal(cache.get('036000291452').status, 'not-found');
});
