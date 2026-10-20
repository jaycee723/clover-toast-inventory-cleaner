import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPaddingAnomaly,
  padTo13,
  findPaddingAnomalies,
  autoPadBarcodes13,
  analyzeBarcode,
  checkDigitOk
} from '../src/barcode.js';

test('isPaddingAnomaly detects numeric codes under 13 digits', () => {
  // 11-digit stripped UPC-A / EAN-13
  assert.equal(isPaddingAnomaly('12000161155'), true);
  // 12-digit standard UPC-A to be converted to 13-digit EAN-13
  assert.equal(isPaddingAnomaly('012000161155'), true);
  // 10-digit code missing two zeros
  assert.equal(isPaddingAnomaly('2000161155'), true);
  // 8-digit code
  assert.equal(isPaddingAnomaly('12345670'), true);
  // Full 13 digits is NOT an anomaly
  assert.equal(isPaddingAnomaly('0012000161155'), false);
  // 14 digits is NOT an anomaly
  assert.equal(isPaddingAnomaly('10012000161155'), false);
  // Empty or non-numeric is not a padding anomaly
  assert.equal(isPaddingAnomaly(''), false);
  assert.equal(isPaddingAnomaly('ABC1234567'), false);
});

test('padTo13 pads numeric barcodes to exactly 13 digits with leading zeros', () => {
  // 11 digits padded with two leading zeroes
  assert.equal(padTo13('12000161155'), '0012000161155');
  // 12 digits padded with one leading zero
  assert.equal(padTo13('012000161155'), '0012000161155');
  // Already 13 digits remains untouched
  assert.equal(padTo13('0012000161155'), '0012000161155');
  // Scientific notation expanded and padded
  assert.equal(padTo13('8.2184090503e+10'), '0082184090503');
});

test('findPaddingAnomalies filters only items with padding issues', () => {
  const items = [
    { name: 'Item A', barcode: '12000161155' },    // 11 digits -> anomaly
    { name: 'Item B', barcode: '0012000161155' },  // 13 digits -> ok
    { name: 'Item C', barcode: '012000161155' },   // 12 digits -> anomaly
    { name: 'Item D', barcode: 'CUSTOM_SKU' }      // non-numeric -> ignored
  ];

  const anomalies = findPaddingAnomalies(items);
  assert.equal(anomalies.length, 2);
  assert.equal(anomalies[0].name, 'Item A');
  assert.equal(anomalies[1].name, 'Item C');
});

test('autoPadBarcodes13 updates records and re-validates checksum structure', () => {
  // A valid 12-digit UPC-A: 012000161155
  // When padded to 13 digits: 0012000161155 (valid EAN-13 check digit!)
  const records = [
    { name: 'Pepsi 12pk', barcode: '012000161155' },
    { name: 'Coca Cola 2L', barcode: '049000050103' },
    { name: 'Already EAN13', barcode: '0012000161155' }
  ];

  const res = autoPadBarcodes13(records);
  assert.equal(res.totalChecked, 3);
  assert.equal(res.paddedCount, 2);
  assert.equal(res.validEan13Count, 2);
  assert.equal(records[0].barcode, '0012000161155');
  assert.equal(records[1].barcode, '0049000050103');
  assert.equal(records[2].barcode, '0012000161155');

  // Verify structure is valid EAN-13
  const a = analyzeBarcode(records[0].barcode);
  assert.equal(a.structurallyValid, true);
  assert.equal(a.type, 'EAN-13');
});
