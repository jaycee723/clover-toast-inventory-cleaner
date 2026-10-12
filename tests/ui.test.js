import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal DOM stand-in. This exercises app.js wiring with the real engine; it is NOT a real browser.
class El {
  constructor(tag) { this.tagName = tag; this.children = []; this.textContent = ''; this.className = ''; this.value = ''; this.disabled = false; this.checked = false; this.files = []; this.attrs = {}; this.listeners = {}; this.onclick = null; this.onchange = null; }
  append(...n) { this.children.push(...n); }
  replaceChildren(...n) { this.children = [...n]; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  click() {}
}
const els = {};
globalThis.document = { getElementById: (id) => (els[id] ||= new El('x')), createElement: (t) => new El(t) };
let lastBlob = null;
globalThis.URL.createObjectURL = (b) => { lastBlob = b; return 'blob:test'; };
globalThis.URL.revokeObjectURL = () => {};
els.aliases = Object.assign(new El('textarea'), { value: 'KANVA=>Kanva' });
els.filter = Object.assign(new El('select'), { value: 'all' });
const fire = (el, type, value) => { if (value !== undefined) el.value = value; for (const f of el.listeners[type] || []) f(); };
const file = (name, text) => ({ name, text: async () => text, arrayBuffer: async () => new TextEncoder().encode(text).buffer });
const bodyRows = () => els.rows.children;
const el = (id) => document.getElementById(id);

const CSV = 'Name,Product Code,Categories,Price,Cost\nBUD LIGHT 12PK,036000291452,,10,8\nGeek Bar X,012000161156,,5,3\nCheetos Puffs,,VAPES,3,2\n';

await import('../app.js');

test('loading without a file reports an error instead of crashing', async () => {
  await els.load.onclick();
  assert.match(els.status.textContent, /Choose a Clover/);
});
test('loads a CSV, renders rows and a summary', async () => {
  els.file.files = [file('inv.csv', CSV)];
  await els.load.onclick();
  assert.match(els.status.textContent, /^3 items/);
  assert.equal(bodyRows().length, 3);
  assert.equal(bodyRows()[0].children.length, 8);
  assert.equal(bodyRows()[0].children[0].textContent, 'BUD LIGHT 12PK');
  assert.match(bodyRows()[0].children[1].textContent, /→ Bud Light 12 Pack/);
  assert.match(bodyRows()[2].children[4].textContent, /category conflict: snack-vs-vape/);
});
test('only the clean barcode is bulk-accepted; invalid and missing stay for review', async () => {
  await els.acceptClean.onclick();
  assert.match(els.status.textContent, /^1 clean barcodes accepted/);
  assert.equal(bodyRows()[0].children[6].children[0].value, 'accept');
  assert.equal(bodyRows()[1].children[6].children[0].value, 'pending');
});
test('approved export waits for every proposal, then contains only decided rows', async () => {
  await els.dlApproved.onclick();
  assert.ok(!(await lastBlob.text()).includes('Bud Light 12 Pack'), 'name proposal is still undecided');
  fire(bodyRows()[0].children[5].children[0], 'change', 'accept');
  await els.dlApproved.onclick();
  const text = await lastBlob.text();
  assert.ok(text.includes('Bud Light 12 Pack'));
  assert.ok(!text.includes('Geek Bar'));
});
test('decisions survive loading a reference file', async () => {
  const REF = 'barcode,brand,product_name,variant,size,unit,pack_count,category,source_type,source_url,approved\n036000291452,Bud,Light,,,,,,supplier_exact,invoice.pdf,false\n';
  el('refFile').files = [file('ref.csv', REF)];
  await els.loadRef.onclick();
  assert.match(els.status.textContent, /1 reference rows loaded/);
  assert.equal(bodyRows()[0].children[6].children[0].value, 'accept');
  assert.match(bodyRows()[0].children[4].textContent, /^matched/);
});
test('filters and paging do not drop decisions', () => {
  els.filter.value = 'barcode'; els.filter.onchange();
  assert.ok(bodyRows().length >= 1);
  els.filter.value = 'all'; els.filter.onchange();
  assert.equal(bodyRows()[0].children[6].children[0].value, 'accept');
});
test('Open Food Facts lookup refuses to run without the opt-in box', async () => {
  el('offOn').checked = false;
  await els.offRun.onclick();
  assert.match(els.offProgress.textContent, /Tick the box/);
});
