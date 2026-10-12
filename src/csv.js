export function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (quoted) throw new Error('Unclosed quote in CSV');
  if (cell !== '' || row.length) { row.push(cell); if (row.some((x) => x !== '')) rows.push(row); }
  return rows;
}
export function sanitizeCell(v) {
  const s = String(v ?? '');
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
export function toCsv(rows, { sanitize = true } = {}) {
  return rows.map((r) => r.map((v) => '"' + (sanitize ? sanitizeCell(v) : String(v ?? '')).replace(/"/g, '""') + '"').join(',')).join('\r\n');
}
