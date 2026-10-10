'use strict';

import { toCsv } from './src/csv.js';
import { analyzeBarcode } from './src/barcode.js';
import { normalizeNameConservatively, applyApprovedAliases } from './src/normalization.js';
import { parseReferenceCsv, referenceTemplateCsv } from './src/reference.js';
import { parseInventoryFile } from './src/xlsx.js';
import { chooseReference, detectDuplicates } from './src/matching.js';
import { evaluateCategoryConflicts, suggestMissingCategories } from './src/categories.js';
import { lookupOpenFoodFacts } from './src/off.js';

const $ = (id) => document.getElementById(id);
const state = {
  records: [],
  references: [],
  canonicalCategories: [],
  page: 1,
  pageSize: 25,
  filter: 'all',
  offOptIn: false,
  offCache: new Map(),
  offAbortController: null,
  aliases: [
    { from: 'KANVA', to: 'Kanva', provenance: 'approved-brand-alias' }
  ]
};

function getReviewRow(record) {
  const barcodeResult = analyzeBarcode(record.barcode);
  const alias = applyApprovedAliases(record.current_name, state.aliases);
  const reference = chooseReference({ ...record, barcode: record.barcode }, state.references);
  const categorySuggestion = suggestMissingCategories(record.category, reference.refCategory || '', state.canonicalCategories);
  const categoryConflicts = evaluateCategoryConflicts(record.current_name, record.category, categorySuggestion.suggestion);
  const flags = [];
  if (!record.barcode) flags.push('missing-barcode');
  if (barcodeResult.review) flags.push('barcode-review');
  if (reference.status === 'contradiction') flags.push(`contradiction:${reference.contradictions.join('|')}`);
  if (categoryConflicts.conflicts.length) flags.push(`category-conflict:${categoryConflicts.conflicts.map((c) => c.id).join('|')}`);
  return {
    ...record,
    barcodeResult,
    reference,
    alias,
    categorySuggestion,
    categoryConflicts,
    proposed_name: alias.changed ? alias.value : reference.proposedName,
    proposed_category: categorySuggestion.suggestion,
    name_decision: record.name_decision || 'pending',
    barcode_decision: record.barcode_decision || 'pending',
    category_decision: record.category_decision || 'pending',
    flags
  };
}

function summarize(rows) {
  return {
    total: rows.length,
    pending: rows.filter((r) => [r.name_decision, r.barcode_decision, r.category_decision].includes('pending')).length,
    contradictions: rows.filter((r) => r.reference.status === 'contradiction').length,
    unresolved: rows.filter((r) => r.reference.status === 'unresolved' || r.reference.status === 'review').length
  };
}

function getFilteredRows() {
  const reviewed = state.records.map(getReviewRow);
  if (state.filter === 'all') return reviewed;
  return reviewed.filter((row) => row.flags.join(';').includes(state.filter) || row.reference.status === state.filter);
}

function render() {
  const rows = getFilteredRows();
  const duplicateMap = detectDuplicates(rows);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = rows.slice(start, start + state.pageSize);
  const body = $('rows');
  body.replaceChildren();

  for (const row of pageRows) {
    const tr = document.createElement('tr');
    const columns = [
      row.original_name,
      row.current_name,
      row.proposed_name,
      row.barcode,
      row.barcodeResult.canonicalLookupKey || '',
      row.category,
      row.proposed_category,
      row.reference.provenance,
      row.flags.join('; '),
      duplicateMap.get(row.barcodeResult.canonicalLookupKey || `name:${String(row.current_name || '').toLowerCase()}`) > 1 ? 'duplicate-key' : ''
    ];
    for (const text of columns) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    }
    for (const key of ['name_decision', 'barcode_decision', 'category_decision']) {
      const td = document.createElement('td');
      const select = document.createElement('select');
      select.setAttribute('aria-label', key);
      ['pending', 'accept', 'reject'].forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        if (row[key] === value) option.selected = true;
        select.append(option);
      });
      select.addEventListener('change', () => {
        row[key] = select.value;
      });
      td.append(select);
      tr.append(td);
    }
    body.append(tr);
  }

  const summary = summarize(rows);
  $('status').textContent = `${summary.total} rows | ${summary.pending} pending decisions | ${summary.contradictions} contradictions | ${summary.unresolved} unresolved.`;
  $('progress').textContent = `Page ${state.page} of ${Math.max(1, Math.ceil(rows.length / state.pageSize))}`;
  $('prev').disabled = state.page <= 1;
  $('next').disabled = state.page >= Math.ceil(rows.length / state.pageSize);
  $('saveReview').disabled = rows.length === 0;
  $('saveApproved').disabled = rows.length === 0;
  $('saveAudit').disabled = rows.length === 0;
}

function buildExportRows(mode) {
  const rows = getFilteredRows();
  const header = [
    'original_name', 'current_name', 'proposed_name',
    'original_barcode', 'canonical_lookup_key', 'barcode_reason', 'barcode_confidence',
    'current_category', 'proposed_category',
    'name_decision', 'barcode_decision', 'category_decision',
    'reference_source', 'reference_status', 'contradictions', 'candidate_names',
    'price', 'cost'
  ];
  const mapped = rows
    .filter((row) => (mode === 'approved'
      ? row.name_decision === 'accept' || row.barcode_decision === 'accept' || row.category_decision === 'accept'
      : true))
    .map((row) => [
      row.original_name,
      row.current_name,
      row.proposed_name,
      row.barcode,
      row.barcodeResult.canonicalLookupKey || '',
      row.barcodeResult.reason,
      row.barcodeResult.confidence,
      row.category,
      row.proposed_category,
      row.name_decision,
      row.barcode_decision,
      row.category_decision,
      row.reference.provenance,
      row.reference.status,
      row.reference.contradictions?.join('|') || '',
      row.reference.candidateNames?.join('|') || '',
      row.price,
      row.cost
    ]);
  return [header, ...mapped];
}

function downloadCsv(filename, rows, sanitize = true) {
  const data = toCsv(rows, { sanitize });
  const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

async function runOffLookup() {
  if (!state.offOptIn) return;
  if (state.offAbortController) state.offAbortController.abort();
  state.offAbortController = new AbortController();
  const unresolved = state.records.filter((record) => chooseReference(record, state.references).status !== 'approved');
  for (const row of unresolved) {
    const barcodeResult = analyzeBarcode(row.barcode);
    if (!barcodeResult.canonicalLookupKey) continue;
    const result = await lookupOpenFoodFacts({
      barcode: barcodeResult.parsedDigits,
      cache: state.offCache,
      signal: state.offAbortController.signal
    });
    row.off_status = result.status;
  }
}

$('load').onclick = async () => {
  try {
    const file = $('file').files[0];
    if (!file) throw new Error('Choose an inventory CSV/XLSX file.');
    const parsed = await parseInventoryFile(file);
    state.records = parsed.records;
    state.canonicalCategories = parsed.categoriesTab || [];
    state.page = 1;
    render();
    await runOffLookup();
    render();
  } catch (error) {
    $('status').textContent = error.message;
  }
};

$('loadReference').onclick = async () => {
  try {
    const file = $('referenceFile').files[0];
    if (!file) throw new Error('Choose a reference CSV file.');
    state.references = parseReferenceCsv(await file.text());
    $('referenceStatus').textContent = `${state.references.length} reference rows loaded.`;
    render();
  } catch (error) {
    $('referenceStatus').textContent = error.message;
  }
};

$('downloadTemplate').onclick = () => downloadCsv('reference_template.csv', [['barcode', 'brand', 'product_name', 'variant', 'size', 'unit', 'pack_count', 'category', 'source_type', 'source_url', 'approved']], false);

$('saveReview').onclick = () => downloadCsv('inventory_review.csv', buildExportRows('review'));
$('saveApproved').onclick = () => downloadCsv('inventory_approved.csv', buildExportRows('approved'));
$('saveAudit').onclick = () => downloadCsv('inventory_audit.csv', buildExportRows('audit'), false);

$('filter').onchange = () => {
  state.filter = $('filter').value;
  state.page = 1;
  render();
};

$('offOptIn').onchange = async () => {
  state.offOptIn = $('offOptIn').checked;
  if (!state.offOptIn && state.offAbortController) state.offAbortController.abort();
  await runOffLookup();
  render();
};

$('cancelLookup').onclick = () => {
  if (state.offAbortController) state.offAbortController.abort();
  $('referenceStatus').textContent = 'Open Food Facts lookup cancelled.';
};

$('prev').onclick = () => {
  state.page = Math.max(1, state.page - 1);
  render();
};

$('next').onclick = () => {
  state.page += 1;
  render();
};

$('status').textContent = 'Load inventory CSV/XLSX and optional references. No server upload is performed by default.';
