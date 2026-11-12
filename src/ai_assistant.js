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

  // Strictly filter out any price changes; formatting rules only touch name, category, and barcode
  const allowed = changes.filter((ch) => ch && (ch.field === 'name' || ch.field === 'category' || ch.field === 'barcode') && ch.field !== 'price');

  return allowed.map((ch, idx) => {
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

    // STRICT POLICY: Formatting rules must NEVER touch pricing. Only fix name, category, and barcode.
    if (field !== 'name' && field !== 'category' && field !== 'barcode') {
      continue;
    }

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

/**
 * Applies an individual AI correction to a single item in the dataset.
 * Returns an undo token specifically for this item.
 */
export function applySingleAiChange(records = [], rows = [], change) {
  if (!change || !change.id) return { success: false, undoRecord: null };
  const rowIndex = rows.findIndex((r) => r.id === change.id);
  if (rowIndex === -1) return { success: false, undoRecord: null };

  const row = rows[rowIndex];
  const rec = records[rowIndex];
  const field = change.field || 'name';
  const proposed = change.proposedValue;

  // STRICT POLICY: Formatting rules must NEVER touch pricing. Only fix name, category, and barcode.
  if (field !== 'name' && field !== 'category' && field !== 'barcode') {
    return { success: false, undoRecord: null, error: 'Formatting rules strictly protect pricing and only fix Item Name, Category, and UPC.' };
  }

  let undoRecord = {
    id: row.id,
    index: rowIndex,
    field,
    previousDecision: row.decisions[field] || 'pending'
  };

  if (field === 'name') {
    undoRecord.previousCurrent = row.current_name;
    undoRecord.previousProposed = row.proposed_name;
    undoRecord.previousRec = rec?.name;
    if (rec) rec.name = proposed;
    row.current_name = proposed;
    row.proposed_name = proposed;
    row.name_source = 'Gemini Online Search';
    row.decisions.name = 'accept';
  } else if (field === 'category') {
    undoRecord.previousCurrent = row.category;
    undoRecord.previousProposed = row.proposed_category;
    undoRecord.previousRec = rec?.category;
    if (rec) rec.category = proposed;
    row.category = proposed;
    row.proposed_category = proposed;
    row.decisions.category = 'accept';
  } else if (field === 'barcode') {
    undoRecord.previousRec = rec?.barcode;
    undoRecord.previousBarcode = row.barcode;
    if (rec) rec.barcode = proposed;
    row.barcode = analyzeBarcode(proposed);
    row.decisions.barcode = 'accept';
  }

  row.manuallyEdited = true;
  row.geminiCorrected = true;

  return { success: true, undoRecord };
}

/**
 * Reverts an individual AI correction for a specific item.
 */
export function revertSingleAiChange(records = [], rows = [], undoRecord) {
  if (!undoRecord || !undoRecord.id) return false;
  const rowIndex = rows.findIndex((r) => r.id === undoRecord.id);
  if (rowIndex === -1) return false;

  const row = rows[rowIndex];
  const rec = records[rowIndex];
  const field = undoRecord.field;

  if (field === 'name') {
    if (rec) rec.name = undoRecord.previousRec;
    row.current_name = undoRecord.previousCurrent;
    row.proposed_name = undoRecord.previousProposed;
    row.decisions.name = undoRecord.previousDecision || 'pending';
  } else if (field === 'category') {
    if (rec) rec.category = undoRecord.previousRec;
    row.category = undoRecord.previousCurrent;
    row.proposed_category = undoRecord.previousProposed;
    row.decisions.category = undoRecord.previousDecision || 'pending';
  } else if (field === 'barcode') {
    if (rec) rec.barcode = undoRecord.previousRec;
    row.barcode = undoRecord.previousBarcode;
    row.decisions.barcode = undoRecord.previousDecision || 'pending';
  } else if (field === 'price') {
    if (rec) rec.price = undoRecord.previousRec;
    row.price = undoRecord.previousPrice;
  }

  row.geminiCorrected = false;
  return true;
}
