const collapse = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
export const NON_PRODUCT = new Set(['no barcode', 'bottle/can tax', 'deals/specials', 'allocated bottles']);
// Ordered. Exceptions come first so e.g. Cheetos Puffs never reach the vape rule.
const RULES = [
  { id: 'snack-puffs', test: /\b(cheetos|doritos|fritos|lays|pringles|takis)\b/i, to: 'CANDY/SNACKS' },
  { id: 'trail-mix', test: /\btrail mix\b/i, to: 'CANDY/SNACKS' },
  { id: 'rtd-tea-ice', test: /\b(hard tea|twisted tea|smirnoff ice|hard seltzer|white claw|truly)\b/i, to: 'RTD (READY TO DRINK)' },
  { id: 'pipe-tobacco', test: /\bpipe tobacco\b/i, to: 'TOBACCO PRODUCTS' },
  { id: 'vape', test: /\b(geek ?bar|lost mary|elf bar|vape|disposable|e-?liquid|cartridge)\b/i, to: 'VAPES' },
  { id: 'hemp', test: /\b(thca|delta ?[89]|cbd)\b/i, to: 'HEMP/THCA' },
  { id: 'kava', test: /\b(kratom|kava)\b/i, to: 'KAVA/KRATOM' },
  { id: 'pouch', test: /\b(zyn|nicotine pouch\w*)\b/i, to: 'NICOTINE POUCHES' },
  { id: 'smoke-acc', test: /\b(grinder|rolling papers?|torch|lighter|hookah|bong|bubbler)\b/i, to: 'Smoke Shop' },
  { id: 'tobacco', test: /\b(cigar|cigarette|marlboro|newport|american spirit|copenhagen)\b/i, to: 'TOBACCO PRODUCTS' },
  { id: 'spirits', test: /\b(whiske?y|bourbon|vodka|tequila|rum|gin|cognac|brandy|liqueur|scotch)\b/i, to: 'LIQUOR/SPIRITS' },
  { id: 'wine', test: /\b(wine|cabernet|merlot|chardonnay|pinot|prosecco|champagne)\b/i, to: 'WINE' },
  { id: 'beer', test: /\b(beer|lager|ipa|stout|pilsner|budweiser|bud light|coors|heineken|modelo|corona)\b/i, to: 'BEER' },
  { id: 'ice-cream', test: /\bice cream\b/i, to: 'ICE CREAM' },
  { id: 'snacks', test: /\b(chips|candy|chocolate|cookies?|jerky|crackers|popcorn)\b/i, to: 'CANDY/SNACKS' },
  { id: 'drinks', test: /\b(soda|cola|juice|water|energy drink|red bull|monster|gatorade|tea|coffee)\b/i, to: 'DRINKS' }
];
const FORBIDDEN = [
  { id: 'snack-vs-vape', name: /\b(cheetos|doritos|fritos|lays|pringles)\b/i, category: /vape/i },
  { id: 'food-vs-drinks', name: /\b(trail mix|jerky)\b/i, category: /^drinks$/i },
  { id: 'pipe-tobacco-vs-paraphernalia', name: /\bpipe tobacco\b/i, category: /smoke shop/i },
  { id: 'rtd-vs-tea-or-spirits', name: /\b(hard tea|twisted tea|smirnoff ice)\b/i, category: /^(drinks|liquor\/spirits)$/i }
];
export function findCanonical(list, wanted) {
  const w = collapse(wanted);
  return list.find((c) => collapse(c) === w) || null;
}
export function splitCategories(value) {
  return String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}
export function evaluateCategory(name, existingValue, canonical) {
  const existing = splitCategories(existingValue);
  const conflicts = [];
  for (const f of FORBIDDEN) if (f.name.test(name) && existing.some((c) => f.category.test(collapse(c)))) conflicts.push(f.id);
  const hasProductCategory = existing.some((c) => !NON_PRODUCT.has(collapse(c)));
  let suggestion = null, rule = null;
  if (!hasProductCategory) {
    for (const r of RULES) {
      if (r.test.test(name)) { suggestion = findCanonical(canonical, r.to); rule = r.id; break; }
    }
  }
  return { existing, conflicts, suggestion, rule };
}
