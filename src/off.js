// Open Food Facts: crowd-sourced, NOT manufacturer-verified. Suggestions only.
const FIELDS = 'code,product_name,product_name_en,brands,quantity,categories_tags';
export const offUrl = (key) => `https://world.openfoodfacts.org/api/v2/product/${key}.json?fields=${FIELDS}`;
export async function lookupOff(key, { fetchImpl = globalThis.fetch, cache = new Map(), signal } = {}) {
  if (cache.has(key)) return cache.get(key);
  let res;
  try {
    const r = await fetchImpl(offUrl(key.length === 14 && key[0] === '0' ? key.slice(1) : key), { signal });
    if (r.status === 404) res = { status: 'not-found' };
    else if (!r.ok) res = { status: 'error', detail: `HTTP ${r.status}` };
    else {
      const j = await r.json();
      const p = j.product;
      res = j.status === 1 && p && (p.product_name || p.product_name_en || p.brands) ? { status: 'found', product: p } : { status: 'not-found' };
    }
  } catch (e) {
    res = e?.name === 'AbortError' ? { status: 'cancelled' } : { status: 'unavailable', detail: String(e?.message || e) };
  }
  if (res.status === 'found' || res.status === 'not-found') cache.set(key, res);
  return res;
}
export function offSuggestionName(p) {
  const brand = (p.brands || '').split(',')[0].trim();
  let nm = (p.product_name_en || p.product_name || '').trim();
  if (brand && !nm.toLowerCase().includes(brand.toLowerCase())) nm = `${brand} ${nm}`.trim();
  const q = (p.quantity || '').trim();
  if (q && !nm.toLowerCase().replace(/\s/g, '').includes(q.toLowerCase().replace(/\s/g, ''))) nm = `${nm} ${q}`;
  return nm.replace(/\s+/g, ' ').trim();
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export async function runOffQueue(rows, { fetchImpl, cache, signal, delayMs = 4300, sleep = delay, onProgress } = {}) {
  const queue = rows.filter((r) => r.reference.status === 'unresolved' && r.barcode.canonicalKey && r.barcode.structurallyValid && !r.off);
  let n = 0;
  for (const row of queue) {
    if (signal?.aborted) { row.off = { status: 'cancelled' }; break; }
    const res = await lookupOff(row.barcode.canonicalKey, { fetchImpl, cache, signal });
    row.off = res;
    if (res.status === 'found') {
      row.off_suggestion = offSuggestionName(res.product);
      const A = new Set((row.current_name.toLowerCase().match(/[a-z]{3,}/g) || []));
      row.off_agrees = (row.off_suggestion.toLowerCase().match(/[a-z]{3,}/g) || []).some((t) => A.has(t));
    }
    if (res.status === 'cancelled') break;
    onProgress?.(++n, queue.length);
    await sleep(delayMs);
  }
  return queue.length;
}
