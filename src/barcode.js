'use strict';

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

export function parseNumericStringExactly(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, reason: 'missing' };
  if (/^\d+$/.test(raw)) return { ok: true, digits: raw, reason: 'digit-string' };
  const sci = raw.match(/^([+]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!sci) return { ok: false, reason: 'non-numeric' };
  const [, , whole, frac = '', expText] = sci;
  const exp = Number(expText);
  if (!Number.isInteger(exp) || exp < 0) return { ok: false, reason: 'negative-or-fractional-exponent' };
  const combined = `${whole}${frac}`.replace(/^0+(?=\d)/, '') || '0';
  const shift = exp - frac.length;
  if (shift < 0) {
    const cut = combined.length + shift;
    if (cut <= 0) return { ok: false, reason: 'fractional-result' };
    const tail = combined.slice(cut);
    if (/[^0]/.test(tail)) return { ok: false, reason: 'fractional-result' };
    return { ok: true, digits: combined.slice(0, cut), reason: 'scientific-notation-exact' };
  }
  return { ok: true, digits: combined + '0'.repeat(shift), reason: 'scientific-notation-exact' };
}

export function hasValidGtinChecksum(digits) {
  if (!/^\d+$/.test(digits) || digits.length < 2) return false;
  let sum = 0;
  const body = digits.slice(0, -1);
  for (let i = 0; i < body.length; i += 1) {
    const fromRight = body.length - 1 - i;
    const n = Number(body[fromRight]);
    sum += n * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits.at(-1));
}

export function expandUpceToUpca(upce) {
  if (!/^\d{8}$/.test(upce)) return null;
  const ns = upce[0];
  const d1 = upce[1];
  const d2 = upce[2];
  const d3 = upce[3];
  const d4 = upce[4];
  const d5 = upce[5];
  const check = upce[7];
  let body;
  if (d5 <= '2') body = `${ns}${d1}${d2}${d5}0000${d3}${d4}`;
  else if (d5 === '3') body = `${ns}${d1}${d2}${d3}00000${d4}`;
  else if (d5 === '4') body = `${ns}${d1}${d2}${d3}${d4}00000`;
  else body = `${ns}${d1}${d2}${d3}${d4}${d5}0000`;
  const upca = `${body}${check}`;
  return /^\d{12}$/.test(upca) ? upca : null;
}

export function canonicalGtin14(digits) {
  if (!/^\d+$/.test(digits) || !GTIN_LENGTHS.has(digits.length)) return null;
  return digits.padStart(14, '0');
}

export function analyzeBarcode(rawValue) {
  const original = String(rawValue ?? '');
  const parsed = parseNumericStringExactly(original);
  if (!parsed.ok) {
    return {
      original,
      parsedDigits: null,
      canonicalLookupKey: null,
      reason: parsed.reason,
      confidence: 'none',
      validChecksum: false,
      candidates: [],
      review: true
    };
  }
  const digits = parsed.digits;
  const candidates = [];
  if (digits.length === 8) {
    candidates.push({ type: 'EAN-8', digits, validChecksum: hasValidGtinChecksum(digits) });
    const upca = expandUpceToUpca(digits);
    candidates.push({
      type: 'UPC-E',
      digits,
      expandedUpca: upca,
      validChecksum: Boolean(upca && hasValidGtinChecksum(upca))
    });
  } else if (digits.length === 12) candidates.push({ type: 'UPC-A', digits, validChecksum: hasValidGtinChecksum(digits) });
  else if (digits.length === 13) candidates.push({ type: 'EAN-13', digits, validChecksum: hasValidGtinChecksum(digits) });
  else if (digits.length === 14) candidates.push({ type: 'GTIN-14', digits, validChecksum: hasValidGtinChecksum(digits) });

  const hasStructural = GTIN_LENGTHS.has(digits.length);
  const validChecksum = candidates.some((c) => c.validChecksum);
  const ambiguous = digits.length === 8 && candidates.filter((c) => c.validChecksum).length > 1;
  return {
    original,
    parsedDigits: digits,
    canonicalLookupKey: hasStructural ? canonicalGtin14(digits) : null,
    reason: ambiguous ? 'ambiguous-eight-digit' : parsed.reason,
    confidence: ambiguous ? 'low' : (validChecksum ? 'medium' : 'low'),
    validChecksum,
    candidates,
    review: !hasStructural || !validChecksum || ambiguous
  };
}

export function equivalentGtin(a, b) {
  const aa = analyzeBarcode(a).canonicalLookupKey;
  const bb = analyzeBarcode(b).canonicalLookupKey;
  return Boolean(aa && bb && aa === bb);
}
