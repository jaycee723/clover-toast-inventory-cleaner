'use strict';

export function normalizeNameConservatively(name) {
  return String(name ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([,()\/-])\s*/g, '$1')
    .replace(/(\d)\s*(mL|ML|ml)\b/g, '$1 mL')
    .replace(/(\d)\s*(oz|OZ)\b/g, '$1 oz')
    .replace(/(\d)\s*(pk|PK|pack|Pack)\b/g, '$1 Pack')
    .trim();
}

export function applyApprovedAliases(name, aliases = []) {
  const current = String(name ?? '');
  for (const alias of aliases) {
    if (alias.from === current) {
      return {
        changed: true,
        value: alias.to,
        provenance: alias.provenance || 'approved-alias'
      };
    }
  }
  return { changed: false, value: current, provenance: null };
}
