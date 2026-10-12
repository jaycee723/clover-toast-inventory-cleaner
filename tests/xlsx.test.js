import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { parseXlsx, inventoryFromSheets } from '../src/xlsx.js';
import { analyzeBarcode } from '../src/barcode.js';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function makeZip(files) {
  const parts = [], central = []; let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content), comp = zlib.deflateRawSync(data), nm = Buffer.from(name), crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
    parts.push(lh, nm, comp);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, nm); offset += 30 + nm.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...parts, cd, end]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength);
}
const wb = `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Items" sheetId="1" r:id="rId1"/><sheet name="Categories" sheetId="2" r:id="rId2"/></sheets></workbook>`;
const rels = `<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x" Target="worksheets/sheet2.xml"/></Relationships>`;
const sst = `<sst><si><t>Name</t></si><si><t>Product Code</t></si><si><t>Categories</t></si><si><t>Price</t></si><si><t>M&amp;M's Peanut</t></si><si><t>8.2184090503e+10</t></si><si><t>Category Name</t></si><si><t>BEER</t></si><si><t>DRINKS</t></si><si><t>Clover ID</t></si></sst>`;
const sheet1 = `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row><row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2" t="s"><v>5</v></c><c r="D2"><v>2.99</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Inline Name</t></is></c><c r="B3"><v>012000161155</v></c><c r="C3" t="inlineStr"><is><t>BEER</t></is></c></row></sheetData></worksheet>`;
const sheet2 = `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>6</v></c></row><row r="2"><c r="A2" t="s"><v>7</v></c></row><row r="3"><c r="A3" t="s"><v>8</v></c></row></sheetData></worksheet>`;
const zip = () => makeZip({ 'xl/workbook.xml': wb, 'xl/_rels/workbook.xml.rels': rels, 'xl/sharedStrings.xml': sst, 'xl/worksheets/sheet1.xml': sheet1, 'xl/worksheets/sheet2.xml': sheet2 });

test('reads sheets, shared strings, inline strings and XML entities', async () => {
  const sheets = await parseXlsx(zip());
  assert.deepEqual(Object.keys(sheets), ['Items', 'Categories']);
  const { records, canonical } = inventoryFromSheets(sheets);
  assert.equal(records.length, 2);
  assert.equal(records[0].name, "M&M's Peanut");
  assert.equal(records[1].name, 'Inline Name');
  assert.equal(records[1].category, 'BEER');
  assert.deepEqual(canonical, ['BEER', 'DRINKS']);
});
test('barcode text is kept exactly as stored, including scientific notation strings', async () => {
  const { records } = inventoryFromSheets(await parseXlsx(zip()));
  assert.equal(records[0].barcode, '8.2184090503e+10');
  assert.equal(analyzeBarcode(records[0].barcode).status, 'presumed-leading-zeros');
  assert.equal(records[0].price, '2.99');
});
test('rejects files that are not xlsx', async () => {
  await assert.rejects(() => parseXlsx(new TextEncoder().encode('not a zip file at all, just text').buffer), /Not a valid XLSX/);
});
test('workbook without an Items sheet gives a clear error', () => {
  assert.throws(() => inventoryFromSheets({ Other: [] }), /no "Items" sheet/);
});
