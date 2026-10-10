'use strict';

import { parseCsv, normalizeHeader } from './csv.js';

let excelJsPromise;

async function getExcelJs() {
  if (!excelJsPromise) {
    excelJsPromise = import('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/+esm');
  }
  return excelJsPromise;
}

export async function parseInventoryFile(file) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.csv')) {
    const rows = parseCsv(await file.text());
    return parseRows(rows);
  }
  if (!name.endsWith('.xlsx')) throw new Error('Only .csv and .xlsx are supported.');
  const excel = await getExcelJs();
  const workbook = new excel.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const categoriesSheet = workbook.getWorksheet('Categories');
  const categories = categoriesSheet
    ? categoriesSheet.getColumn(1).values.slice(1).map((value) => String(value ?? '').trim()).filter(Boolean)
    : [];
  const items = workbook.getWorksheet('Items') || workbook.worksheets[0];
  const rows = [];
  items.eachRow((row) => {
    rows.push(row.values.slice(1).map((value) => (value == null ? '' : String(value))));
  });
  const parsed = parseRows(rows);
  return { ...parsed, categoriesTab: categories };
}

export function parseRows(rows) {
  if (!rows.length) throw new Error('Empty file');
  const header = rows.shift().map(normalizeHeader);
  const find = (...names) => header.findIndex((h) => names.includes(h));
  const indexes = {
    name: find('name', 'item name', 'product_name'),
    barcode: find('product code', 'barcode', 'upc'),
    category: find('categories', 'category'),
    brand: find('brand'),
    variant: find('variant', 'flavor'),
    size: find('size'),
    unit: find('unit'),
    pack_count: find('pack_count', 'pack count'),
    price: find('price'),
    cost: find('cost')
  };
  if (indexes.name < 0) throw new Error('Name column is required.');
  const records = rows.map((row) => ({
    original_name: row[indexes.name] ?? '',
    current_name: row[indexes.name] ?? '',
    barcode: indexes.barcode < 0 ? '' : String(row[indexes.barcode] ?? ''),
    category: indexes.category < 0 ? '' : String(row[indexes.category] ?? ''),
    brand: indexes.brand < 0 ? '' : String(row[indexes.brand] ?? ''),
    variant: indexes.variant < 0 ? '' : String(row[indexes.variant] ?? ''),
    size: indexes.size < 0 ? '' : String(row[indexes.size] ?? ''),
    unit: indexes.unit < 0 ? '' : String(row[indexes.unit] ?? ''),
    pack_count: indexes.pack_count < 0 ? '' : String(row[indexes.pack_count] ?? ''),
    price: indexes.price < 0 ? '' : String(row[indexes.price] ?? ''),
    cost: indexes.cost < 0 ? '' : String(row[indexes.cost] ?? '')
  }));
  return { records, categoriesTab: [] };
}
