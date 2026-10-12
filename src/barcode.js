// Structural barcode analysis. A valid check digit proves structure only, never product identity.
export function expandScientific(s) {
  const m = /^\s*(\d+)(?:\.(\d+))?[eE]\+?(\d+)\s*$/.exec(s);
  if (!m) return null;
  const frac = m[2] || '', exp = Number(m[3]);
  if (frac.length > exp) return null;
  return (m[1] + frac + '0'.repeat(exp - frac.length)).replace(/^0+(?=\d)/, '');
}
export function checkDigitOk(d) {
  if (!/^\d+$/.test(d) || ![8, 12, 13, 14].includes(d.length)) return false;
  let sum = 0;
  [...d.slice(0, -1)].reverse().forEach((n, i) => { sum += Number(n) * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === Number(d.at(-1));
}
export function upceToUpca(e) {
  if (!/^[01]\d{7}$/.test(e)) return null;
  const ns = e[0], m = e.slice(1, 7), chk = e[7], last = m[5];
  let body;
  if ('012'.includes(last)) body = ns + m.slice(0, 2) + last + '0000' + m.slice(2, 5);
  else if (last === '3') body = ns + m.slice(0, 3) + '00000' + m.slice(3, 5);
  else if (last === '4') body = ns + m.slice(0, 4) + '00000' + m[4];
  else body = ns + m.slice(0, 5) + '0000' + last;
  return body + chk;
}
export const pad14 = (d) => d.padStart(14, '0');
const result = (o) => ({ canonicalKey: null, candidates: [], structurallyValid: false, review: true, confidence: 'none', type: 'unknown', ...o });

export function analyzeBarcode(raw) {
  const original = String(raw ?? '').trim();
  if (!original) return result({ original, status: 'missing', reason: 'No barcode' });
  let digits;
  if (/[eE]/.test(original)) {
    digits = expandScientific(original);
    if (!digits) return result({ original, status: 'invalid', reason: 'Unparseable scientific notation' });
  } else if (/^\d+$/.test(original)) digits = original;
  else if (/^\d+\.0+$/.test(original)) digits = original.split('.')[0];
  else return result({ original, status: 'invalid', reason: 'Non-numeric barcode' });

  const base = { original, digits };
  if (digits.length === 8) {
    const candidates = [];
    if (checkDigitOk(digits)) candidates.push({ type: 'EAN-8', key: pad14(digits) });
    const a = upceToUpca(digits);
    if (a && checkDigitOk(a)) candidates.push({ type: 'UPC-E', key: pad14(a), expandedUpcA: a });
    if (candidates.length === 0) return result({ ...base, status: 'invalid', reason: '8-digit code fails EAN-8 and UPC-E checks' });
    if (candidates.length === 1) return result({ ...base, status: 'valid', type: candidates[0].type, canonicalKey: candidates[0].key, candidates, structurallyValid: true, review: true, confidence: 'medium', reason: `8-digit code; only valid as ${candidates[0].type}. Confirm type by scanning` });
    return result({ ...base, status: 'ambiguous', candidates, reason: '8-digit code is valid as both EAN-8 and UPC-E; choose interpretation' });
  }
  if ([12, 13, 14].includes(digits.length)) {
    if (!checkDigitOk(digits)) return result({ ...base, status: 'invalid', reason: 'Check digit does not match; not repaired' });
    const isCase = digits.length === 14 && digits[0] !== '0';
    const type = digits.length === 12 ? 'UPC-A' : digits.length === 13 ? 'EAN-13' : (isCase ? 'GTIN-14 (case/trade unit)' : 'GTIN-14');
    return result({ ...base, status: isCase ? 'case-code' : 'valid', type, canonicalKey: pad14(digits), structurallyValid: true, review: isCase, confidence: isCase ? 'low' : 'high', reason: isCase ? 'GTIN-14 with packaging indicator: not assumed to be a retail unit' : 'Check digit valid (structure only)' });
  }
  if (digits.length >= 9 && digits.length <= 11) {
    const padded = digits.padStart(12, '0');
    if (checkDigitOk(padded)) return result({ ...base, status: 'presumed-leading-zeros', type: 'UPC-A', canonicalKey: pad14(padded), structurallyValid: true, review: true, confidence: 'medium', reason: 'Leading zeros presumed lost (spreadsheet); confirm against a reference or scan' });
  }
  return result({ ...base, status: 'invalid', reason: `Length ${digits.length} is not a retail GTIN; may be an internal code` });
}
