import { parseCsv } from './csv.js';
import { analyzeBarcode } from './barcode.js';
export const REFERENCE_HEADERS = ['barcode', 'brand', 'product_name', 'variant', 'size', 'unit', 'pack_count', 'category', 'source_type', 'source_url', 'approved'];
export const PRECEDENCE = ['manual_approved', 'manufacturer_official', 'supplier_exact', 'clover_context', 'open_food_facts'];
export const referenceTemplateCsv = () => REFERENCE_HEADERS.join(',') + '\n';
export function parseReferenceCsv(text) {
  const rows = parseCsv(text); if (!rows.length) return [];
  const h = rows.shift().map((x) => x.trim().toLowerCase());
  for (const need of ['barcode', 'source_type']) if (!h.includes(need)) throw new Error(`Reference CSV missing column: ${need}`);
  return rows.map((r) => {
    const o = Object.fromEntries(h.map((k, i) => [k, (r[i] ?? '').trim()]));
    if (!PRECEDENCE.includes(o.source_type)) throw new Error(`Unknown source_type: ${o.source_type}`);
    o.approved = /^(true|yes|1|y)$/i.test(o.approved || '');
    o.key = analyzeBarcode(o.barcode).canonicalKey;
    return o;
  });
}
export function buildReferenceIndex(refs) {
  const idx = new Map();
  for (const r of refs) { if (!r.key) continue; if (!idx.has(r.key)) idx.set(r.key, []); idx.get(r.key).push(r); }
  return idx;
}
export const referenceName = (r) => [r.brand, r.product_name, r.variant, r.size && r.unit ? `${r.size} ${r.unit}` : '', r.pack_count ? `${r.pack_count} Pack` : ''].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
