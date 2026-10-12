import { PRECEDENCE, referenceName } from './reference.js';
import { parseSizing, normalizeName } from './normalization.js';
const toks = (s) => new Set((String(s).toLowerCase().match(/[a-z]{3,}/g) || []));
const overlap = (a, b) => { const A = toks(a), B = toks(b); for (const t of A) if (B.has(t)) return true; return false; };
const toMl = (size, unit) => (size == null ? null : unit === 'mL' ? size : unit === 'L' ? size * 1000 : /oz/i.test(unit) ? size * 29.5735 : null);

export function compareToReference(name, ref, existingCategories = []) {
  const out = [];
  const s = parseSizing(name);
  if (!overlap(name, [ref.brand, ref.product_name, ref.variant].join(' '))) out.push('name-unrelated');
  if (ref.brand && !overlap(name, ref.brand)) out.push('brand-mismatch');
  if (ref.variant && !overlap(name, ref.variant)) out.push('variant-mismatch');
  const refMl = toMl(Number(ref.size) || null, ref.unit);
  if (s.ml != null && refMl != null && Math.abs(s.ml - refMl) / refMl > 0.03) out.push('size-mismatch');
  if (s.pack != null && ref.pack_count && s.pack !== Number(ref.pack_count)) out.push('pack-mismatch');
  if (ref.category && existingCategories.length && !existingCategories.some((c) => c.toLowerCase() === ref.category.toLowerCase())) out.push('category-differs');
  return out;
}
// Barcode first. Name-only similarity never creates or repairs a barcode identity.
export function chooseReference(record, index) {
  const key = record.barcode?.canonicalKey;
  if (!key || !index.has(key)) return { status: 'unresolved', provenance: '', contradictions: [], candidateNames: [] };
  const cands = [...index.get(key)].sort((a, b) => PRECEDENCE.indexOf(a.source_type) - PRECEDENCE.indexOf(b.source_type));
  const top = cands.filter((c) => c.source_type === cands[0].source_type);
  const names = [...new Set(top.map(referenceName))];
  if (names.length > 1) return { status: 'conflicting-references', provenance: cands[0].source_type, contradictions: ['references-disagree'], candidateNames: names };
  const ref = top[0];
  const contradictions = compareToReference(record.current_name, ref, record.existingCategories || []);
  const hard = contradictions.filter((c) => c !== 'category-differs');
  return {
    status: hard.length ? 'contradiction' : 'matched',
    approvedIdentity: ref.approved && (ref.source_type === 'manual_approved' || ref.source_type === 'manufacturer_official'),
    provenance: `${ref.source_type}${ref.source_url ? ' ' + ref.source_url : ''}`,
    ref, contradictions, candidateNames: names,
    proposedName: hard.length ? '' : normalizeName(referenceName(ref))
  };
}
export function detectDuplicates(rows) {
  const counts = new Map();
  for (const r of rows) { const k = r.barcode?.canonicalKey; if (k) counts.set(k, (counts.get(k) || 0) + 1); }
  return counts;
}
