// Minimal local XLSX reader (no uploads). Reads cell text exactly as stored, so barcode strings are never coerced to numbers.
async function inflate(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a valid XLSX (zip) file');
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const files = new Map(), dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Corrupt zip directory');
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    files.set(name, { method, csize, off });
    p += 46 + nlen + elen + clen;
  }
  return async (name) => {
    const f = files.get(name); if (!f) return null;
    const lh = f.off, start = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true);
    const data = u8.subarray(start, start + f.csize);
    const raw = f.method === 0 ? data : await inflate(data);
    return dec.decode(raw);
  };
}
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
const textOf = (xml) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unesc(m[1])).join('');
function colIndex(ref) { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
export async function parseXlsx(buf) {
  const read = await unzip(buf);
  const wb = await read('xl/workbook.xml'); if (!wb) throw new Error('Missing workbook.xml');
  const rels = (await read('xl/_rels/workbook.xml.rels')) || '';
  const relMap = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [/Id="([^"]+)"/.exec(m[0])?.[1], /Target="([^"]+)"/.exec(m[0])?.[1]]));
  const sst = (await read('xl/sharedStrings.xml')) || '';
  const shared = [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const sheets = {};
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = unesc(/name="([^"]*)"/.exec(m[0])[1]);
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1];
    let target = relMap.get(rid) || ''; target = target.replace(/^\//, '');
    const xml = await read(target.startsWith('xl/') ? target : 'xl/' + target); if (!xml) continue;
    const rows = [];
    for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1], body = cm[2] || '';
        const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1]; const t = /t="([^"]+)"/.exec(attrs)?.[1];
        let v = '';
        if (t === 'inlineStr') v = textOf(body);
        else { const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]; if (raw !== undefined) v = t === 's' ? (shared[Number(raw)] ?? '') : unesc(raw); }
        if (ref) row[colIndex(ref)] = v;
      }
      rows.push(Array.from(row, (x) => x ?? ''));
    }
    sheets[name] = rows;
  }
  return sheets;
}
export function inventoryFromSheets(sheets) {
  const items = sheets.Items; if (!items?.length) throw new Error('Workbook has no "Items" sheet');
  const h = items[0].map((x) => String(x).trim().toLowerCase());
  const col = (...n) => h.findIndex((x) => n.includes(x));
  const ni = col('name'), bi = col('product code', 'upc', 'barcode'), ci = col('categories', 'category'), pi = col('price'), co = col('cost'), ki = col('clover id');
  if (ni < 0) throw new Error('Items sheet needs a Name column');
  const records = items.slice(1).filter((r) => String(r[ni] ?? '').trim()).map((r) => ({ name: r[ni], barcode: bi < 0 ? '' : r[bi] ?? '', category: ci < 0 ? '' : r[ci] ?? '', price: pi < 0 ? '' : r[pi] ?? '', cost: co < 0 ? '' : r[co] ?? '', source_id: ki < 0 ? '' : r[ki] ?? '' }));
  const cat = sheets.Categories; let canonical = [];
  if (cat?.length) { const ch = cat[0].map((x) => String(x).trim().toLowerCase()); const idx = ch.indexOf('category name'); if (idx >= 0) canonical = [...new Set(cat.slice(1).map((r) => String(r[idx] ?? '').trim()).filter(Boolean))]; }
  return { records, canonical };
}
export async function parseInventoryFile(file) {
  if (/\.xlsx$/i.test(file.name)) return inventoryFromSheets(await parseXlsx(await file.arrayBuffer()));
  const { parseCsv } = await import('./csv.js');
  const rows = parseCsv(await file.text()); if (!rows.length) throw new Error('Empty CSV');
  const h = rows[0].map((x) => x.trim().toLowerCase()); const col = (...n) => h.findIndex((x) => n.includes(x));
  const ni = col('name', 'item name'), bi = col('product code', 'upc', 'barcode'), ci = col('categories', 'category'), pi = col('price'), co = col('cost');
  if (ni < 0) throw new Error('CSV needs a Name column');
  return { records: rows.slice(1).map((r) => ({ name: r[ni] ?? '', barcode: bi < 0 ? '' : r[bi] ?? '', category: ci < 0 ? '' : r[ci] ?? '', price: pi < 0 ? '' : r[pi] ?? '', cost: co < 0 ? '' : r[co] ?? '' })), canonical: [] };
}
