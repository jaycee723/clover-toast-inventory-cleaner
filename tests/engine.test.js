import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv } from '../src/csv.js';
import { analyzeBarcode, expandScientific } from '../src/barcode.js';
import { normalizeName, applyApprovedAliases } from '../src/normalization.js';
import { evaluateCategory } from '../src/categories.js';
import { parseReferenceCsv, buildReferenceIndex } from '../src/reference.js';
import { buildRows, setDecision, approvedRows, acceptCleanBarcodes, exportRows, saveSession, loadSession, applyOffSuggestions } from '../src/review.js';
import { runOffQueue, lookupOff } from '../src/off.js';

const CANON = ['BEER', 'DRINKS', 'VAPES', 'CANDY/SNACKS', 'Smoke Shop', 'TOBACCO PRODUCTS', 'RTD (READY TO DRINK)', 'LIQUOR/SPIRITS', 'NO BARCODE'];

test('CSV round trip keeps leading zeros, quotes, multiline', () => {
  const rows = [['name', 'code'], ['He said "hi"\nline2', '012000161155']];
  assert.deepEqual(parseCsv(toCsv(rows, { sanitize: false })), rows);
});
test('CSV export neutralizes formula injection but keeps plain numbers', () => {
  const out = toCsv([['=HYPERLINK("x")', '-5', '+cmd']]);
  assert.ok(out.includes('"\'=HYPERLINK'));
  assert.ok(out.includes('"-5"'));
  assert.ok(out.includes('"\'+cmd"'));
});
test('scientific notation is exact, no floating point', () => {
  assert.equal(expandScientific('8.2184090503e+10'), '82184090503');
  assert.equal(expandScientific('8.55553008108e+11'), '855553008108');
  assert.equal(expandScientific('1.5e0'), null);
});
test('UPC-A, EAN-13 equivalence by canonical key', () => {
  const a = analyzeBarcode('012000161155'), b = analyzeBarcode('0012000161155');
  assert.equal(a.canonicalKey, b.canonicalKey);
  assert.equal(a.type, 'UPC-A');
});
test('invalid check digit is never repaired', () => {
  const r = analyzeBarcode('012000161156');
  assert.equal(r.status, 'invalid'); assert.equal(r.canonicalKey, null); assert.equal(r.digits, '012000161156');
});
test('lost leading zero from spreadsheet is a review item, not silent', () => {
  const r = analyzeBarcode('8.2184090503e+10');
  assert.equal(r.status, 'presumed-leading-zeros'); assert.equal(r.review, true);
  assert.equal(r.canonicalKey, analyzeBarcode('082184090503').canonicalKey);
});
test('eight-digit ambiguity exposes both candidates', () => {
  let found = null;
  for (let n = 0; n < 200000 && !found; n++) { const d = String(n).padStart(7, '0'); for (let c = 0; c < 10; c++) { const r = analyzeBarcode(d + c); if (r.status === 'ambiguous') { found = r; break; } } }
  assert.ok(found, 'expected at least one ambiguous 8-digit code'); assert.equal(found.canonicalKey, null); assert.equal(found.candidates.length, 2);
});
test('GTIN-14 case code is not assumed to be a retail unit', () => {
  const body = '1' + '0012000161155'.slice(0, 12);
  let d14; for (let c = 0; c < 10; c++) { const t = body + c; if (analyzeBarcode(t).structurallyValid) d14 = t; }
  const r = analyzeBarcode(d14); assert.equal(r.status, 'case-code'); assert.equal(r.review, true);
});
test('names: protect brands, no fuzzy correction, units normalized', () => {
  assert.equal(normalizeName('BANDANA'), 'Bandana');
  assert.equal(normalizeName('MILKY WAY'), 'Milky Way');
  assert.equal(normalizeName("JACK DANIEL'S TENNESSEE WHISKEY 750ML"), "Jack Daniel's Tennessee Whiskey 750 mL");
  assert.equal(normalizeName('Kanva Botanicals'), 'Kanva Botanicals');
  const a = applyApprovedAliases('KANVA Botanical', [{ from: 'KANVA', to: 'Kanva', approved: true }]);
  assert.equal(a.value, 'Kanva Botanical');
  assert.equal(applyApprovedAliases('KANVA', [{ from: 'KANVA', to: 'Kanva', approved: false }]).changed, false);
});
test('category exceptions', () => {
  assert.equal(evaluateCategory('Cheetos Puffs', '', CANON).suggestion, 'CANDY/SNACKS');
  assert.equal(evaluateCategory('Monster Trail Mix', '', CANON).suggestion, 'CANDY/SNACKS');
  assert.equal(evaluateCategory('Largo Pipe Tobacco Mint', '', CANON).suggestion, 'TOBACCO PRODUCTS');
  assert.equal(evaluateCategory('Twisted Tea Original 24 oz', '', CANON).suggestion, 'RTD (READY TO DRINK)');
  assert.equal(evaluateCategory('Smirnoff Ice Smash', '', CANON).suggestion, 'RTD (READY TO DRINK)');
  assert.deepEqual(evaluateCategory('Cheetos Puffs', 'VAPES', CANON).conflicts, ['snack-vs-vape']);
  assert.deepEqual(evaluateCategory('Monster Trail Mix', 'DRINKS', CANON).conflicts, ['food-vs-drinks']);
});
test('existing category memberships are never replaced', () => {
  const c = evaluateCategory('Budweiser 12 Pack', 'BEER, DEALS/SPECIALS', CANON);
  assert.equal(c.suggestion, null); assert.deepEqual(c.existing, ['BEER', 'DEALS/SPECIALS']);
});
test('suggestions only come from the canonical list', () => {
  assert.equal(evaluateCategory('Glenfiddich 12 whiskey', '', ['BEER']).suggestion, null);
});

const REF = (extra = '') => parseReferenceCsv(`barcode,brand,product_name,variant,size,unit,pack_count,category,source_type,source_url,approved\n` + extra);
test('reference precedence: manual approved beats supplier', () => {
  const refs = REF('012000161155,Modelo,Especial,,24,oz,,BEER,supplier_exact,,false\n012000161155,Modelo,Especial Lager,,24,oz,,BEER,manual_approved,,true\n');
  const rows = buildRows([{ name: 'MODELO ESPECIAL 24OZ', barcode: '012000161155', category: '' }], { index: buildReferenceIndex(refs), canonical: CANON });
  assert.equal(rows[0].reference.status, 'matched'); assert.match(rows[0].reference.provenance, /^manual_approved/); assert.equal(rows[0].proposed_name, 'Modelo Especial Lager 24 oz');
});
test('mismatched UPC (American Spirit carrying a Modelo barcode) is a contradiction, not a rename', () => {
  const refs = REF('012000161155,Modelo,Especial,,24,oz,,BEER,supplier_exact,,false\n');
  const rows = buildRows([{ name: 'AMERICAN SPIRIT BLUE', barcode: '012000161155', category: 'TOBACCO PRODUCTS' }], { index: buildReferenceIndex(refs), canonical: CANON });
  assert.equal(rows[0].reference.status, 'contradiction');
  assert.equal(rows[0].proposed_name, 'American Spirit Blue');
  assert.ok(rows[0].reference.candidateNames.includes('Modelo Especial 24 oz'));
});
test('size and pack conflicts are flagged (case vs unit)', () => {
  const refs = REF('012000161155,Coors,Light,,24,oz,12,BEER,supplier_exact,,false\n');
  const rows = buildRows([{ name: 'Coors Light 25 oz 6 Pack', barcode: '012000161155', category: 'BEER' }], { index: buildReferenceIndex(refs), canonical: CANON });
  assert.ok(rows[0].reference.contradictions.includes('size-mismatch')); assert.ok(rows[0].reference.contradictions.includes('pack-mismatch'));
});
test('name-only similarity never creates a barcode match', () => {
  const refs = REF('012000161155,Modelo,Especial,,24,oz,,BEER,supplier_exact,,false\n');
  const rows = buildRows([{ name: 'Modelo Especial 24 oz', barcode: '', category: 'BEER' }], { index: buildReferenceIndex(refs), canonical: CANON });
  assert.equal(rows[0].reference.status, 'unresolved');
});
test('duplicates are detected across the whole dataset', () => {
  const recs = [{ name: 'A', barcode: '012000161155' }, { name: 'B', barcode: '0012000161155' }, { name: 'C', barcode: '036000291452' }];
  const rows = buildRows(recs, { canonical: CANON });
  assert.deepEqual(rows.map((r) => r.duplicate), [true, true, false]);
});
test('decisions persist by id and approved export is strict', () => {
  const rows = buildRows([{ name: 'BUD LIGHT 12PK', barcode: '036000291452', category: '' }, { name: 'Geek Bar X', barcode: '012000161156', category: '' }], { canonical: CANON });
  assert.equal(approvedRows(rows).length, 0);
  setDecision(rows, 'r1', 'barcode', 'accept');
  assert.equal(approvedRows(rows).length, 0, 'name and category proposals still pending');
  setDecision(rows, 'r1', 'name', 'accept'); setDecision(rows, 'r1', 'category', 'accept');
  assert.equal(approvedRows(rows).length, 1);
  const out = exportRows(approvedRows(rows));
  assert.equal(out[0][2], 'Bud Light 12 Pack'); assert.equal(out[0][14], 'BEER');
  assert.equal(acceptCleanBarcodes(rows), 0);
  const saved = saveSession(rows); const fresh = buildRows([{ name: 'BUD LIGHT 12PK', barcode: '036000291452', category: '' }, { name: 'Geek Bar X', barcode: '012000161156', category: '' }], { canonical: CANON });
  loadSession(fresh, saved); assert.equal(approvedRows(fresh).length, 1);
});
test('rejected proposals keep the original value', () => {
  const rows = buildRows([{ name: 'BUD LIGHT 12PK', barcode: '036000291452', category: '' }], { canonical: CANON });
  setDecision(rows, 'r1', 'barcode', 'accept'); setDecision(rows, 'r1', 'name', 'reject'); setDecision(rows, 'r1', 'category', 'reject');
  const [r] = exportRows(approvedRows(rows)); assert.equal(r[2], 'BUD LIGHT 12PK'); assert.equal(r[14], '');
});
test('contradictions cannot be approved until the name is decided', () => {
  const refs = REF('012000161155,Modelo,Especial,,24,oz,,BEER,supplier_exact,,false\n');
  const rows = buildRows([{ name: 'AMERICAN SPIRIT BLUE', barcode: '012000161155', category: 'TOBACCO PRODUCTS' }], { index: buildReferenceIndex(refs), canonical: CANON });
  setDecision(rows, 'r1', 'barcode', 'accept'); assert.equal(approvedRows(rows).length, 0);
});

const okFetch = (map) => async (url) => { const code = /product\/(\d+)\.json/.exec(url)[1]; const hit = map[code]; return hit === 'err' ? { ok: false, status: 500 } : hit ? { ok: true, status: 200, json: async () => ({ status: 1, product: hit }) } : { ok: false, status: 404 }; };
test('Open Food Facts runs last, only for unresolved rows, and stays a suggestion', async () => {
  const refs = REF('036000291452,Bud Light,,,,,,BEER,supplier_exact,,false\n');
  const rows = buildRows([{ name: 'Bud Light', barcode: '036000291452', category: 'BEER' }, { name: 'Pringles Original', barcode: '038000138416', category: '' }, { name: 'Mystery', barcode: '012000161155', category: '' }], { index: buildReferenceIndex(refs), canonical: CANON });
  const calls = [];
  const f = async (u, o) => { calls.push(u); return okFetch({ '0038000138416': { product_name: 'Original Potato Crisps', brands: 'Pringles', quantity: '5.5 oz' } })(u, o); };
  await runOffQueue(rows, { fetchImpl: f, sleep: async () => {}, cache: new Map() });
  assert.equal(calls.length, 2, 'resolved row must not be looked up'); assert.ok(calls.every((c) => !c.includes('036000291452')));
  assert.equal(rows[1].off.status, 'found'); assert.equal(rows[2].off.status, 'not-found');
  assert.equal(rows[1].decisions.name, 'pending'); assert.equal(rows[1].current_name, 'Pringles Original');
  applyOffSuggestions(rows); assert.equal(rows[1].proposed_name, 'Pringles Original Potato Crisps 5.5 oz'); assert.match(rows[1].name_source, /unverified/);
});
test('OFF outcomes are distinguished: unavailable, error, cancelled', async () => {
  assert.equal((await lookupOff('0012000161155', { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } })).status, 'unavailable');
  assert.equal((await lookupOff('0012000161155', { fetchImpl: okFetch({ '0012000161155': 'err' }) })).status, 'error');
  const ac = new AbortController(); ac.abort();
  assert.equal((await lookupOff('0012000161155', { fetchImpl: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; }, signal: ac.signal })).status, 'cancelled');
});
test('OFF disagreement is not auto-applied', async () => {
  const rows = buildRows([{ name: 'American Spirit Blue', barcode: '038000138416', category: '' }], { canonical: CANON });
  await runOffQueue(rows, { fetchImpl: okFetch({ '0038000138416': { product_name: 'Original Potato Crisps', brands: 'Pringles' } }), sleep: async () => {}, cache: new Map() });
  applyOffSuggestions(rows); assert.equal(rows[0].proposed_name, ''); assert.equal(rows[0].current_name, 'American Spirit Blue'); assert.equal(rows[0].off_agrees, false);
});
