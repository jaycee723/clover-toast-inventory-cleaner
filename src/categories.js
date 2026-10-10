'use strict';

const DELIMS = /\s*[;,|]\s*/;

export function splitCategories(value) {
  return String(value ?? '').split(DELIMS).map((v) => v.trim()).filter(Boolean);
}

export function joinCategories(values) {
  return [...new Set(values.filter(Boolean))].join('; ');
}

const conflictRules = [
  { id: 'cheetos-vapes', when: (name, categories) => /cheetos\s+puffs/i.test(name) && categories.some((c) => /vape/i.test(c)), message: 'Cheetos Puffs should not be assigned vape categories.' },
  { id: 'monster-trail-mix-drink', when: (name, categories) => /monster\s+trail\s+mix/i.test(name) && categories.some((c) => /drink|beverage/i.test(c)), message: 'Monster Trail Mix appears to be food, not a drink.' },
  { id: 'pipe-tobacco-paraphernalia', when: (name, categories) => /pipe\s+tobacco/i.test(name) && categories.some((c) => /paraphernalia|accessories?/i.test(c)), message: 'Pipe tobacco should not be conflated with paraphernalia.' },
  { id: 'hard-tea-tea-vodka', when: (name, categories) => /(hard\s+tea|smirnoff\s+ice)/i.test(name) && categories.some((c) => /^tea$|vodka/i.test(c)), message: 'Hard tea / Smirnoff Ice should be reviewed before assigning tea or vodka categories.' }
];

export function evaluateCategoryConflicts(name, existingCategory, suggestedCategory) {
  const current = splitCategories(existingCategory);
  const suggested = splitCategories(suggestedCategory);
  const merged = [...current, ...suggested];
  const conflicts = conflictRules.filter((rule) => rule.when(name, merged));
  return {
    conflicts: conflicts.map((rule) => ({ id: rule.id, message: rule.message })),
    canSuggest: conflicts.length === 0
  };
}

export function suggestMissingCategories(existingCategory, suggestedCategory, canonicalList = []) {
  const current = splitCategories(existingCategory);
  if (!suggestedCategory) return { preserved: joinCategories(current), suggestion: '' };
  const allowed = new Set(canonicalList.map((v) => String(v).trim()).filter(Boolean));
  const target = splitCategories(suggestedCategory).filter((cat) => allowed.size === 0 || allowed.has(cat));
  const addable = target.filter((cat) => !current.includes(cat));
  return { preserved: joinCategories(current), suggestion: joinCategories(addable) };
}
