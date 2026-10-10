'use strict';

import { analyzeBarcode, equivalentGtin } from './barcode.js';
import { normalizeNameConservatively } from './normalization.js';

const SOURCE_PRIORITY = [
  'manual_approved',
  'manufacturer_official',
  'supplier_exact',
  'clover_context',
  'open_food_facts'
];

function sourceRank(sourceType) {
  const idx = SOURCE_PRIORITY.indexOf(sourceType);
  return idx < 0 ? SOURCE_PRIORITY.length : idx;
}

function normalizeUnit(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizedPackCount(value) {
  if (value === '' || value == null) return '';
  const n = Number(String(value));
  return Number.isFinite(n) ? String(n) : String(value).trim();
}

function incompatibleCategory(itemCategory, refCategory) {
  const left = String(itemCategory ?? '').toLowerCase();
  const right = String(refCategory ?? '').toLowerCase();
  return (left.includes('vape') && right.includes('snack')) || (left.includes('drink') && right.includes('trail mix'));
}

function compareIdentity(item, ref) {
  const mismatches = [];
  if (ref.brand && item.brand && ref.brand !== item.brand) mismatches.push('brand');
  if (ref.variant && item.variant && ref.variant !== item.variant) mismatches.push('variant');
  if (normalizeUnit(ref.unit) && normalizeUnit(item.unit) && normalizeUnit(ref.unit) !== normalizeUnit(item.unit)) mismatches.push('unit');
  if (normalizedPackCount(ref.pack_count) && normalizedPackCount(item.pack_count) && normalizedPackCount(ref.pack_count) !== normalizedPackCount(item.pack_count)) mismatches.push('pack_count');
  if (incompatibleCategory(item.category, ref.category)) mismatches.push('category');
  return mismatches;
}

export function chooseReference(item, references) {
  const barcode = analyzeBarcode(item.barcode);
  const keyed = references
    .map((ref) => ({ ref, rank: sourceRank(ref.source_type || '') }))
    .sort((a, b) => a.rank - b.rank);

  const candidates = [];
  for (const entry of keyed) {
    if (!entry.ref.barcode) continue;
    if (!equivalentGtin(item.barcode, entry.ref.barcode)) continue;
    const mismatches = compareIdentity(item, entry.ref);
    candidates.push({
      ref: entry.ref,
      mismatches,
      approvedIdentity: mismatches.length === 0 && entry.ref.approved === 'true',
      plausible: mismatches.length <= 2
    });
  }

  if (!candidates.length) {
    return {
      status: barcode.review ? 'review' : 'unresolved',
      provenance: 'none',
      proposedName: normalizeNameConservatively(item.name || ''),
      contradictions: [],
      candidateNames: []
    };
  }

  const best = candidates[0];
  return {
    status: best.approvedIdentity ? 'approved' : (best.mismatches.length ? 'contradiction' : 'suggestion'),
    provenance: best.ref.source_type,
    proposedName: best.ref.product_name || normalizeNameConservatively(item.name || ''),
    contradictions: best.mismatches,
    candidateNames: candidates.map((c) => c.ref.product_name).filter(Boolean),
    approvedIdentity: best.approvedIdentity
  };
}

export function detectDuplicates(records) {
  const counts = new Map();
  for (const record of records) {
    const key = analyzeBarcode(record.barcode).canonicalLookupKey || `name:${String(record.name || '').toLowerCase()}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}
