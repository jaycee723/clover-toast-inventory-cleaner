import { analyzeBarcode } from './barcode.js';

/**
 * Extracts a lightweight dataset for the Gemini AI formatting assistant.
 */
export function prepareDatasetForAi(records = [], rows = [], maxItems = 150) {
  const list = [];
  const count = Math.min(records.length, maxItems);
  for (let i = 0; i < count; i++) {
    const rec = records[i] || {};
    const row = rows[i] || {};
    list.push({
      id: row.id || `r${i + 1}`,
      name: row.current_name || rec.name || '',
      barcode: row.barcode?.digits || row.barcode?.original || rec.barcode || '',
      category: row.category || rec.category || '',
      price: row.price ?? rec.price ?? ''
    });
  }
  return list;
}

/**
 * Computes a diff preview for display in the interactive side drawer / modal.
 */
export function computeDiffPreview(rows = [], changes = []) {
  if (!Array.isArray(changes)) return [];
  const rowMap = new Map(rows.map((r) => [r.id, r]));

  return changes.map((ch, idx) => {
    const row = rowMap.get(ch.id);
    const itemName = row ? (row.current_name || row.original_name) : `Item ${ch.id}`;
    return {
      index: idx + 1,
      id: ch.id,
      itemName,
      field: ch.field || 'name',
      originalValue: String(ch.originalValue ?? ''),
      proposedValue: String(ch.proposedValue ?? ''),
      reason: ch.reason || 'Formatting adjustment'
    };
  });
}

/**
 * Applies approved AI changes directly to the active dataset (both records and rows).
 * Creates a complete snapshot for single-click Undo capability.
 */
export function applyAiChanges(records = [], rows = [], changes = []) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return { appliedCount: 0, undoSnapshot: null, affectedIds: [] };
  }

  const undoSnapshot = {
    timestamp: Date.now(),
    changes: []
  };

  const rowMap = new Map(rows.map((r, i) => [r.id, { row: r, index: i }]));
  const affectedSet = new Set();

  for (const ch of changes) {
    const entry = rowMap.get(ch.id);
    if (!entry) continue;
    const { row, index } = entry;
    const rec = records[index];
    const field = ch.field;
    const proposed = ch.proposedValue;

    if (field === 'name') {
      undoSnapshot.changes.push({
        id: row.id,
        index,
        field: 'name',
        previousCurrent: row.current_name,
        previousProposed: row.proposed_name,
        previousRec: rec?.name,
        previousDecision: row.decisions.name
      });
      if (rec) rec.name = proposed;
      row.current_name = proposed;
      row.proposed_name = proposed;
      row.name_source = 'Gemini AI Assistant';
      row.decisions.name = 'accept';
      affectedSet.add(row.id);
    } else if (field === 'category') {
      undoSnapshot.changes.push({
        id: row.id,
        index,
        field: 'category',
        previousCurrent: row.category,
        previousProposed: row.proposed_category,
        previousRec: rec?.category,
        previousDecision: row.decisions.category
      });
      if (rec) rec.category = proposed;
      row.category = proposed;
      row.proposed_category = proposed;
      row.decisions.category = 'accept';
      affectedSet.add(row.id);
    } else if (field === 'barcode') {
      undoSnapshot.changes.push({
        id: row.id,
        index,
        field: 'barcode',
        previousRec: rec?.barcode,
        previousBarcode: row.barcode,
        previousDecision: row.decisions.barcode
      });
      if (rec) rec.barcode = proposed;
      row.barcode = analyzeBarcode(proposed);
      row.decisions.barcode = 'accept';
      affectedSet.add(row.id);
    } else if (field === 'price') {
      undoSnapshot.changes.push({
        id: row.id,
        index,
        field: 'price',
        previousRec: rec?.price,
        previousPrice: row.price
      });
      if (rec) rec.price = proposed;
      row.price = proposed;
      affectedSet.add(row.id);
    }
  }

  return {
    appliedCount: affectedSet.size,
    affectedIds: Array.from(affectedSet),
    undoSnapshot
  };
}

/**
 * Restores dataset to previous state prior to AI application.
 */
export function revertAiChanges(records = [], rows = [], undoSnapshot) {
  if (!undoSnapshot || !Array.isArray(undoSnapshot.changes)) return 0;
  const rowMap = new Map(rows.map((r, i) => [r.id, { row: r, index: i }]));
  let reverted = 0;

  for (const item of undoSnapshot.changes) {
    const entry = rowMap.get(item.id);
    if (!entry) continue;
    const { row, index } = entry;
    const rec = records[index];

    if (item.field === 'name') {
      if (rec) rec.name = item.previousRec;
      row.current_name = item.previousCurrent;
      row.proposed_name = item.previousProposed;
      row.decisions.name = item.previousDecision || 'pending';
      reverted++;
    } else if (item.field === 'category') {
      if (rec) rec.category = item.previousRec;
      row.category = item.previousCurrent;
      row.proposed_category = item.previousProposed;
      row.decisions.category = item.previousDecision || 'pending';
      reverted++;
    } else if (item.field === 'barcode') {
      if (rec) rec.barcode = item.previousRec;
      row.barcode = item.previousBarcode;
      row.decisions.barcode = item.previousDecision || 'pending';
      reverted++;
    } else if (item.field === 'price') {
      if (rec) rec.price = item.previousRec;
      row.price = item.previousPrice;
      reverted++;
    }
  }

  return reverted;
}
