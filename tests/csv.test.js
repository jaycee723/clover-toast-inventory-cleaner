import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv } from '../src/csv.js';

test('preserves leading zeros quotes and multiline values', () => {
  const source = 'barcode,name\n"00123","Line 1\nLine 2"\n"00045","""Quoted"" item"';
  const rows = parseCsv(source);
  assert.equal(rows[1][0], '00123');
  assert.equal(rows[1][1], 'Line 1\nLine 2');
  const rebuilt = toCsv(rows);
  assert.deepEqual(parseCsv(rebuilt), rows);
});

test('sanitizes formula-leading cells in review exports', () => {
  const csv = toCsv([['name'], ['=HYPERLINK("x")']], { sanitize: true });
  assert.match(csv, /'=HYPERLINK/);
});
