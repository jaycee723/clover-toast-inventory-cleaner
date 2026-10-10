import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBarcode, equivalentGtin, parseNumericStringExactly, hasValidGtinChecksum } from '../src/barcode.js';

test('scientific notation parsing is exact without float math', () => {
  assert.deepEqual(parseNumericStringExactly('1.2345E+7'), { ok: true, digits: '12345000', reason: 'scientific-notation-exact' });
  assert.equal(parseNumericStringExactly('1.2345E+2').ok, false);
});

test('gtin equivalence compares zero-padded forms', () => {
  assert.equal(equivalentGtin('012345678905', '0012345678905'), true);
});

test('invalid checksum remains review item', () => {
  const result = analyzeBarcode('012345678901');
  assert.equal(result.validChecksum, false);
  assert.equal(result.review, true);
});

test('eight-digit ambiguity exposes EAN-8 and UPC-E candidates', () => {
  const result = analyzeBarcode('04210005');
  assert.ok(result.candidates.find((c) => c.type === 'EAN-8'));
  assert.ok(result.candidates.find((c) => c.type === 'UPC-E'));
});

test('known valid UPC-A checksum passes', () => {
  assert.equal(hasValidGtinChecksum('036000291452'), true);
});
