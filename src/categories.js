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

export const GENERIC_CATEGORIES = new Set([
  '',
  'general retail',
  'general',
  'retail',
  'uncategorized',
  'none',
  'misc',
  'miscellaneous',
  'other',
  'default',
  'items',
  'inventory',
  'store',
  'merchandise',
  'n/a',
  'na',
  'unknown',
  'various'
]);

export function isGenericCategory(cat) {
  const c = collapse(cat);
  if (!c) return true;
  if (GENERIC_CATEGORIES.has(c)) return true;
  if (NON_PRODUCT.has(c)) return true;
  return false;
}

/**
 * Streamlines and simplifies fragmented or noisy categories into clean, standardized Toast retail departments.
 */
export function streamlineCategory(category) {
  const c = collapse(category);
  if (!c || isGenericCategory(c)) return null;

  if (c.includes('vodka') || c.includes('whiskey') || c.includes('bourbon') || c.includes('rum') || c.includes('tequila') || c.includes('gin') || c.includes('scotch') || c.includes('brandy') || c.includes('cognac') || c.includes('spirits') || c.includes('liquor')) {
    return 'LIQUOR/SPIRITS';
  }
  if (c.includes('beer') || c.includes('ipa') || c.includes('lager') || c.includes('ale') || c.includes('stout') || c.includes('pilsner') || c.includes('cider') || c.includes('malt')) {
    return 'BEER';
  }
  if (c.includes('wine') || c.includes('chardonnay') || c.includes('cabernet') || c.includes('pinot') || c.includes('merlot') || c.includes('prosecco') || c.includes('champagne') || c.includes('rosé') || c.includes('rose') || c.includes('sauvignon') || c.includes('zinfandel')) {
    return 'WINE';
  }
  if (c.includes('rtd') || c.includes('ready to drink') || c.includes('hard tea') || c.includes('hard seltzer') || c.includes('cocktails') || c.includes('seltzer')) {
    return 'RTD (READY TO DRINK)';
  }
  if (c.includes('candy') || c.includes('snack') || c.includes('chip') || c.includes('chocolate') || c.includes('cookie') || c.includes('gum') || c.includes('jerky') || c.includes('cracker') || c.includes('nuts')) {
    return 'CANDY/SNACKS';
  }
  if (c.includes('drink') || c.includes('beverage') || c.includes('soda') || c.includes('juice') || c.includes('water') || c.includes('energy') || c.includes('tea') || c.includes('coffee') || c.includes('mixer')) {
    return 'DRINKS';
  }
  if (c.includes('tobacco') || c.includes('cigarette') || c.includes('cigar') || c.includes('chew') || c.includes('snuff')) {
    return 'TOBACCO PRODUCTS';
  }
  if (c.includes('vape') || c.includes('e-cig') || c.includes('disposable') || c.includes('pod') || c.includes('e-liquid')) {
    return 'VAPES';
  }
  if (c.includes('smoke') || c.includes('lighter') || c.includes('paper') || c.includes('pipe') || c.includes('paraphernalia')) {
    return 'Smoke Shop';
  }
  if (c.includes('thca') || c.includes('cbd') || c.includes('hemp') || c.includes('delta')) {
    return 'HEMP/THCA';
  }
  if (c.includes('kratom') || c.includes('kava')) {
    return 'KAVA/KRATOM';
  }
  return category;
}

const STOP_WORDS = new Set([
  'and', '&', 'of', 'the', 'with', 'in', 'for', 'a', 'an', 'to', 'by', 'at', 'on',
  'pack', 'pk', 'pck', 'count', 'ct', 'case', 'cs', 'btl', 'bottle', 'bottles', 'can', 'cans',
  'ml', 'l', 'oz', 'fl', 'gal', 'pt', 'qt', 'liter', 'litre'
]);

function extractCategoryTokens(name) {
  if (!name) return [];
  const cleaned = String(name)
    .replace(/\b\d+(\.\d+)?\s*(ml|l|fl\s*oz|oz|pack|pk|ct)\b/gi, '')
    .replace(/[^\w\s]/g, ' ');
  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * Smart Categorize uses existing category-item mappings in the inventory dataset
 * to learn and suggest specific categories for items currently missing a category
 * or assigned to a generic one (e.g. 'General Retail', 'Uncategorized').
 * Falls back to canonical rules if no catalog match is found.
 */
export function smartCategorizeInventory(rows, { canonical = [], autoApply = false } = {}) {
  // Step 1: Learn mappings from all items with valid, non-generic specific categories
  const tokenCategoryWeights = new Map();
  const phraseCategoryWeights = new Map();
  const brandCategoryWeights = new Map();

  for (const r of rows) {
    const rawCat = r.category || (r.existingCategories && r.existingCategories[0]) || '';
    if (isGenericCategory(rawCat)) continue;

    const primaryCat = splitCategories(rawCat)[0] || rawCat;

    // Index brand
    if (r.brand && String(r.brand).trim()) {
      const b = collapse(r.brand);
      if (!brandCategoryWeights.has(b)) brandCategoryWeights.set(b, new Map());
      const m = brandCategoryWeights.get(b);
      m.set(primaryCat, (m.get(primaryCat) || 0) + 5);
    }

    // Index tokens & 2-word phrases
    const itemName = r.current_name || r.original_name || '';
    const tokens = extractCategoryTokens(itemName);
    for (const t of tokens) {
      if (!tokenCategoryWeights.has(t)) tokenCategoryWeights.set(t, new Map());
      const m = tokenCategoryWeights.get(t);
      m.set(primaryCat, (m.get(primaryCat) || 0) + 1);
    }

    for (let i = 0; i < tokens.length - 1; i++) {
      const phrase = `${tokens[i]} ${tokens[i + 1]}`;
      if (!phraseCategoryWeights.has(phrase)) phraseCategoryWeights.set(phrase, new Map());
      const m = phraseCategoryWeights.get(phrase);
      m.set(primaryCat, (m.get(primaryCat) || 0) + 4);
    }
  }

  const suggestions = [];

  // Step 2: Suggest categories for rows with missing or generic category
  for (const r of rows) {
    const rawCat = r.category || '';
    if (!isGenericCategory(rawCat)) continue;

    const itemName = r.current_name || r.original_name || '';
    const scores = new Map();

    // Check brand
    if (r.brand && String(r.brand).trim()) {
      const b = collapse(r.brand);
      const bMap = brandCategoryWeights.get(b);
      if (bMap) {
        for (const [cat, weight] of bMap.entries()) {
          scores.set(cat, (scores.get(cat) || 0) + weight * 2);
        }
      }
    }

    // Check phrases and tokens from item name
    const tokens = extractCategoryTokens(itemName);
    for (let i = 0; i < tokens.length - 1; i++) {
      const phrase = `${tokens[i]} ${tokens[i + 1]}`;
      const pMap = phraseCategoryWeights.get(phrase);
      if (pMap) {
        for (const [cat, weight] of pMap.entries()) {
          scores.set(cat, (scores.get(cat) || 0) + weight);
        }
      }
    }

    for (const t of tokens) {
      const tMap = tokenCategoryWeights.get(t);
      if (tMap) {
        for (const [cat, weight] of tMap.entries()) {
          scores.set(cat, (scores.get(cat) || 0) + weight);
        }
      }
    }

    let bestCategory = null;
    let highestScore = 0;
    for (const [cat, score] of scores.entries()) {
      if (score > highestScore) {
        highestScore = score;
        bestCategory = cat;
      }
    }

    let source = '';
    if (bestCategory && highestScore >= 2) {
      source = 'catalog_mapping';
    } else {
      // Fallback to domain RULES
      for (const rule of RULES) {
        if (rule.test.test(itemName)) {
          const canon = findCanonical(canonical, rule.to);
          bestCategory = canon || rule.to;
          source = `rule (${rule.id})`;
          break;
        }
      }
    }

    if (bestCategory) {
      r.proposed_category = bestCategory;
      r.category_source = source;
      if (r.category_conflicts) {
        r.category_conflicts = r.category_conflicts.filter((c) => !/general|uncategorized/i.test(c));
      }

      if (autoApply) {
        if (!r._originalSnapshot) {
          r._originalSnapshot = {
            current_name: r.current_name,
            category: r.category,
            barcodeOriginal: r.barcode?.original,
            price: r.price
          };
        }
        r.category = bestCategory;
        if (r.decisions) {
          r.decisions.category = 'accept';
        }
        r.manuallyEdited = true;
      }

      suggestions.push({
        id: r.id,
        name: itemName,
        oldCategory: rawCat || '(missing)',
        newCategory: bestCategory,
        source,
        score: highestScore
      });
    }
  }

  return {
    totalRows: rows.length,
    improvedCount: suggestions.length,
    suggestions
  };
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

