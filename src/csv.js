'use strict';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ''));
}

function sanitizeCell(value) {
  const text = String(value ?? '');
  return /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
}

function escapeCell(value, { sanitize = false } = {}) {
  const text = sanitize ? sanitizeCell(value) : String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows, options = {}) {
  return rows.map((row) => row.map((value) => escapeCell(value, options)).join(',')).join('\r\n');
}

export function normalizeHeader(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim().toLowerCase();
}
