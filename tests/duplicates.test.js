import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDuplicates } from '../src/matching.js';

test('indexes by canonical barcode key', () => {
  const map = detectDuplicates([
    { barcode: '036000291452', name: 'a' },
    { barcode: '0036000291452', name: 'b' },
    { barcode: '', name: 'c' },
    { barcode: '', name: 'c' }
  ]);
  assert.equal([...map.values()].some((n) => n > 1), true);
});
