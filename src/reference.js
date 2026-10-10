'use strict';

import { parseCsv, normalizeHeader } from './csv.js';

export const REFERENCE_FIELDS = [
  'barcode',
  'brand',
  'product_name',
  'variant',
  'size',
  'unit',
  'pack_count',
  'category',
  'source_type',
  'source_url',
  'approved'
];

export function parseReferenceCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows.shift().map(normalizeHeader);
  return rows.map((row) => {
    const entry = {};
    for (let i = 0; i < header.length; i += 1) {
      const key = header[i];
      entry[key] = row[i] ?? '';
    }
    return entry;
  }).filter((entry) => entry.barcode || entry.product_name);
}

export function referenceTemplateCsv() {
  return `${REFERENCE_FIELDS.join(',')}\r\n`;
}
