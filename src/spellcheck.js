// Intelligent Spellcheck, Domain Lexicon, and Word Naturalization Engine

// 1. Domain-specific dictionary of canonical brands, varietals, and retail words
export const CANONICAL_DICTIONARY = [
  // Spirits & Liquors
  'Whiskey', 'Bourbon', 'Vodka', 'Tequila', 'Rum', 'Gin', 'Cognac', 'Scotch', 'Brandy',
  'Liqueur', 'Mezcal', 'Triple Sec', 'Vermouth', 'Schnapps', 'Aperol', 'Campari', 'Absinthe',

  // Wine Varietals & Styles
  'Cabernet Sauvignon', 'Chardonnay', 'Sauvignon Blanc', 'Pinot Noir', 'Pinot Grigio',
  'Merlot', 'Zinfandel', 'Syrah', 'Shiraz', 'Malbec', 'Prosecco', 'Champagne', 'Moscato',
  'Riesling', 'Rosé', 'Chianti', 'Bordeaux', 'Rioja', 'Sangiovese', 'Port',

  // Beers, Ciders & RTD
  'IPA', 'Lager', 'Pilsner', 'Ale', 'Stout', 'Porter', 'Hard Seltzer', 'Cider', 'Wheat Beer',
  'Amber Ale', 'Golden Ale', 'Bock', 'Hazy IPA', 'Double IPA', 'Pale Ale',

  // Prominent Brands
  'Budweiser', 'Bud Light', 'Coors Light', 'Miller Lite', 'Corona Extra', 'Modelo Especial',
  'Heineken', 'Guinness', 'Stella Artois', 'Michelob Ultra', 'Blue Moon', 'Samuel Adams',
  'Jack Daniel\'s', 'Jim Beam', 'Maker\'s Mark', 'Johnnie Walker', 'Hennessy', 'Jameson',
  'Crown Royal', 'Smirnoff', 'Tito\'s', 'Absolut', 'Grey Goose', 'Patrón', 'Don Julio',
  'Casamigos', 'Captain Morgan', 'Bacardi', 'Fireball', 'Baileys', 'Jägermeister',
  'White Claw', 'Truly', 'High Noon', 'Twisted Tea', 'Mike\'s Hard', 'Angry Orchard',
  'Red Bull', 'Monster Energy', 'Celsius', 'Gatorade', 'Coca-Cola', 'Pepsi', 'Sprite',
  'Dr Pepper', 'Mountain Dew', 'Snapple', 'Arizona',
  'Doritos', 'Lay\'s', 'Cheetos', 'Tostitos', 'Pringles',
  'Marlboro', 'Newport', 'Camel', 'American Spirit', 'Geek Bar', 'Elf Bar', 'Lost Mary',
  'Zyn', 'Kanva', 'Voodoo Ranger', 'Sierra Nevada',

  // Flavors & Ingredients
  'Strawberry', 'Watermelon', 'Blueberry', 'Raspberry', 'Blackberry', 'Pineapple',
  'Grapefruit', 'Orange', 'Lemon', 'Lime', 'Mango', 'Peach', 'Apple', 'Cherry',
  'Vanilla', 'Chocolate', 'Caramel', 'Coconut', 'Cranberry', 'Pomegranate', 'Mint',
  'Spearmint', 'Wintergreen', 'Original', 'Ginger', 'Honey', 'Coffee', 'Cinnamon'
];

// 2. High-confidence POS shorthand & standard retail abbreviations with reasoning
export const POS_ABBREVIATIONS = [
  { from: 'CHARD', to: 'Chardonnay', reason: 'Common wine shorthand for Chardonnay', category: 'wine' },
  { from: 'CAB SAUV', to: 'Cabernet Sauvignon', reason: 'Standard contraction for Cabernet Sauvignon', category: 'wine' },
  { from: 'CAB', to: 'Cabernet', reason: 'Abbreviation for Cabernet', category: 'wine' },
  { from: 'SAUV BLANC', to: 'Sauvignon Blanc', reason: 'Standard contraction for Sauvignon Blanc', category: 'wine' },
  { from: 'SAUV', to: 'Sauvignon', reason: 'Abbreviation for Sauvignon', category: 'wine' },
  { from: 'PINOT GRIG', to: 'Pinot Grigio', reason: 'Abbreviation for Pinot Grigio', category: 'wine' },
  { from: 'PINOT NOIR', to: 'Pinot Noir', reason: 'Standardization for Pinot Noir', category: 'wine' },
  { from: 'PROSEC', to: 'Prosecco', reason: 'Abbreviation for Prosecco sparkling wine', category: 'wine' },
  { from: 'MOSCAT', to: 'Moscato', reason: 'Abbreviation for Moscato sweet wine', category: 'wine' },
  { from: 'WHISKY', to: 'Whiskey', reason: 'Standardize to standard US retail spelling (Whiskey)', category: 'spirits' },
  { from: 'BOURB', to: 'Bourbon', reason: 'Abbreviation for Bourbon whiskey', category: 'spirits' },
  { from: 'VODK', to: 'Vodka', reason: 'Truncated POS entry for Vodka', category: 'spirits' },
  { from: 'TEQ', to: 'Tequila', reason: 'POS abbreviation for Tequila', category: 'spirits' },
  { from: 'SELTZ', to: 'Seltzer', reason: 'Shorthand for Seltzer / Hard Seltzer', category: 'beer' },
  { from: 'SPKL', to: 'Sparkling', reason: 'Shorthand for Sparkling beverage', category: 'beverage' },
  { from: 'STRWB', to: 'Strawberry', reason: 'Flavor contraction for Strawberry', category: 'flavor' },
  { from: 'STRAWB', to: 'Strawberry', reason: 'Flavor contraction for Strawberry', category: 'flavor' },
  { from: 'WTRMLN', to: 'Watermelon', reason: 'Flavor contraction for Watermelon', category: 'flavor' },
  { from: 'WATERMLN', to: 'Watermelon', reason: 'Flavor contraction for Watermelon', category: 'flavor' },
  { from: 'BLBRY', to: 'Blueberry', reason: 'Flavor contraction for Blueberry', category: 'flavor' },
  { from: 'RSPBRY', to: 'Raspberry', reason: 'Flavor contraction for Raspberry', category: 'flavor' },
  { from: 'CHOC', to: 'Chocolate', reason: 'Flavor contraction for Chocolate', category: 'flavor' },
  { from: 'VAN', to: 'Vanilla', reason: 'Flavor contraction for Vanilla', category: 'flavor' },
  { from: 'CARAM', to: 'Caramel', reason: 'Flavor contraction for Caramel', category: 'flavor' },
  { from: 'COCO', to: 'Coconut', reason: 'Flavor contraction for Coconut', category: 'flavor' },
  { from: 'ORNG', to: 'Orange', reason: 'Flavor contraction for Orange', category: 'flavor' },
  { from: 'LMN', to: 'Lemon', reason: 'Flavor contraction for Lemon', category: 'flavor' },
  { from: 'GRAPEFRT', to: 'Grapefruit', reason: 'Flavor contraction for Grapefruit', category: 'flavor' },
  { from: 'PINEAPL', to: 'Pineapple', reason: 'Flavor contraction for Pineapple', category: 'flavor' },
  { from: 'PCH', to: 'Peach', reason: 'Flavor contraction for Peach', category: 'flavor' },
  { from: 'PNUT', to: 'Peanut', reason: 'Ingredient contraction for Peanut', category: 'flavor' },
  { from: 'ORIG', to: 'Original', reason: 'POS abbreviation for Original product variant', category: 'general' },
  { from: 'PREM', to: 'Premium', reason: 'POS abbreviation for Premium', category: 'general' },
  { from: 'BTL', to: 'Bottle', reason: 'Packaging shorthand for Bottle', category: 'packaging' },
  { from: 'BTLS', to: 'Bottles', reason: 'Packaging shorthand for Bottles', category: 'packaging' },
  { from: 'HEIN', to: 'Heineken', reason: 'Common POS shorthand for Heineken', category: 'brand' },
  { from: 'HEINIKEN', to: 'Heineken', reason: 'Common misspelling of Heineken (missing e)', category: 'brand' },
  { from: 'BUDWEISSER', to: 'Budweiser', reason: 'Typo in Budweiser (double s)', category: 'brand' },
  { from: 'CORONNA', to: 'Corona', reason: 'Typo in Corona (double n)', category: 'brand' },
  { from: 'GUINESS', to: 'Guinness', reason: 'Typo in Guinness (missing second n)', category: 'brand' },
  { from: 'MALBORO', to: 'Marlboro', reason: 'Frequent misspelling of Marlboro (missing r)', category: 'brand' },
  { from: 'MARLB', to: 'Marlboro', reason: 'POS shorthand for Marlboro', category: 'brand' },
  { from: 'NWPRT', to: 'Newport', reason: 'POS shorthand for Newport cigarettes', category: 'brand' },
  { from: 'AMER SPIRIT', to: 'American Spirit', reason: 'Contraction for American Spirit', category: 'brand' },
  { from: 'KANVA', to: 'Kanva', reason: 'Approved brand spelling for Kanva', category: 'brand' }
];

// 3. Damerau-Levenshtein distance calculation (handles insertions, deletions, substitutions, transpositions)
export function damerauLevenshteinDistance(a, b) {
  const al = a.length;
  const bl = b.length;
  if (!al) return bl;
  if (!bl) return al;

  const matrix = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) matrix[i][0] = i;
  for (let j = 0; j <= bl; j++) matrix[0][j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,       // deletion
        matrix[i][j - 1] + 1,       // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
      // transposition
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1].toLowerCase() === b[j - 2].toLowerCase() &&
        a[i - 2].toLowerCase() === b[j - 1].toLowerCase()
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }
  return matrix[al][bl];
}

export function similarityRatio(a, b) {
  const dist = damerauLevenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

// Explain why two words are likely candidates
export function explainEditDifference(source, target) {
  const s = source.toLowerCase();
  const t = target.toLowerCase();
  const dist = damerauLevenshteinDistance(s, t);

  if (dist === 0) return 'Exact match (casing normalization)';
  if (dist === 1) {
    if (s.length === t.length) return `Single letter substitution vs "${target}"`;
    if (s.length < t.length) return `Missing letter vs "${target}"`;
    return `Extra letter vs "${target}"`;
  }
  if (dist === 2) {
    // Check transposition
    for (let i = 0; i < s.length - 1; i++) {
      const swapped = s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
      if (swapped === t) return `Swapped adjacent letters in "${target}"`;
    }
    return `Minor typo (edit distance 2 from "${target}")`;
  }
  return `Fuzzy phonetic resemblance to "${target}"`;
}

// 4. Tokenizer that extracts candidate words and multi-word phrases from inventory names
export function extractInventoryTokens(records = []) {
  const tokenCounts = new Map();
  const tokenExamples = new Map();

  for (const rec of records) {
    const raw = String(rec.name || rec.original_name || '').trim();
    if (!raw) continue;

    // Clean out sizing units first so we don't treat units as words
    const stripped = raw
      .replace(/\b\d+(?:\.\d+)?\s*(?:fl\.?\s?oz|oz|ml|ltr|liter|litre|l|pk|pck|pack|ct|count)\b/gi, ' ')
      .replace(/[^A-Za-z0-9'\s&-]/g, ' ');

    const words = stripped
      .split(/\s+/)
      .map((w) => w.trim().replace(/^[-']+|[-']+$/g, ''))
      .filter((w) => w.length >= 3 && !/^\d+$/.test(w));

    // Unigrams
    for (const w of words) {
      const key = w.toUpperCase();
      tokenCounts.set(key, (tokenCounts.get(key) || 0) + 1);
      if (!tokenExamples.has(key)) tokenExamples.set(key, []);
      const ex = tokenExamples.get(key);
      if (ex.length < 3 && !ex.includes(raw)) ex.push(raw);
    }

    // Bigrams for common two-word phrases like 'CAB SAUV', 'SAUV BLANC'
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i].toUpperCase()} ${words[i + 1].toUpperCase()}`;
      tokenCounts.set(bigram, (tokenCounts.get(bigram) || 0) + 1);
      if (!tokenExamples.has(bigram)) tokenExamples.set(bigram, []);
      const ex = tokenExamples.get(bigram);
      if (ex.length < 3 && !ex.includes(raw)) ex.push(raw);
    }
  }

  return { tokenCounts, tokenExamples };
}

// 5. Scan inventory records and generate intelligent, reasoned spelling candidates
export function scanInventoryForSpellingSuggestions(records = [], existingAliases = []) {
  if (!records || !records.length) return [];

  const existingFromSet = new Set(existingAliases.map((a) => a.from.toUpperCase().trim()));
  const { tokenCounts, tokenExamples } = extractInventoryTokens(records);
  const suggestions = [];
  const seenFrom = new Set();

  // A. Check against POS abbreviations database (Highest precision)
  for (const posRule of POS_ABBREVIATIONS) {
    const key = posRule.from.toUpperCase();
    if (existingFromSet.has(key) || seenFrom.has(key)) continue;

    const count = tokenCounts.get(key) || 0;
    if (count > 0) {
      seenFrom.add(key);
      suggestions.push({
        from: posRule.from,
        to: posRule.to,
        reason: posRule.reason,
        confidence: 'high',
        category: posRule.category || 'abbreviation',
        frequency: count,
        examples: tokenExamples.get(key) || [],
        approved: false,
      });
    }
  }

  // B. Fuzzy match remaining unique tokens against canonical brand & product vocabulary
  for (const [token, count] of tokenCounts.entries()) {
    if (seenFrom.has(token) || existingFromSet.has(token)) continue;
    // Don't fuzzy-check short acronyms or numbers
    if (token.length < 5 || token.includes(' ')) continue;

    let bestMatch = null;
    let bestDist = Infinity;
    let bestRatio = 0;

    for (const canonical of CANONICAL_DICTIONARY) {
      const canUpper = canonical.toUpperCase();
      // If exact casing difference only, skip unless known acronym
      if (canUpper === token) continue;

      // Only compare words of comparable length
      if (Math.abs(canonical.length - token.length) > 2) continue;

      const dist = damerauLevenshteinDistance(token, canonical);
      // Require distance <= 2 and length >= 5
      if (dist > 0 && dist <= 2) {
        const ratio = similarityRatio(token, canonical);
        if (ratio >= 0.75 && dist < bestDist) {
          bestDist = dist;
          bestRatio = ratio;
          bestMatch = canonical;
        }
      }
    }

    if (bestMatch && bestDist <= 2) {
      seenFrom.add(token);
      const reason = explainEditDifference(token, bestMatch);
      const confidence = bestDist === 1 && token.length >= 6 ? 'high' : 'medium';

      suggestions.push({
        from: token,
        to: bestMatch,
        reason: `${reason}`,
        confidence,
        category: 'fuzzy_correction',
        frequency: count,
        examples: tokenExamples.get(token) || [],
        approved: false,
      });
    }
  }

  // Sort by confidence (high first), then frequency (most common first)
  return suggestions.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1;
    return b.frequency - a.frequency;
  });
}

// 6. Curated rule presets for one-click adoption
export const SPELLCHECK_PRESETS = {
  beverage: {
    name: 'Beverage & Varietals',
    rules: [
      { from: 'CHARD', to: 'Chardonnay', reason: 'Wine varietal shorthand' },
      { from: 'CAB SAUV', to: 'Cabernet Sauvignon', reason: 'Wine varietal contraction' },
      { from: 'SAUV BLANC', to: 'Sauvignon Blanc', reason: 'Wine varietal contraction' },
      { from: 'PINOT GRIG', to: 'Pinot Grigio', reason: 'Wine varietal contraction' },
      { from: 'WHISKY', to: 'Whiskey', reason: 'US retail spelling standard' },
      { from: 'BOURB', to: 'Bourbon', reason: 'Spirit abbreviation' },
      { from: 'TEQ', to: 'Tequila', reason: 'Spirit abbreviation' },
      { from: 'VODK', to: 'Vodka', reason: 'Spirit abbreviation' },
      { from: 'SELTZ', to: 'Seltzer', reason: 'Beverage style contraction' },
      { from: 'SPKL', to: 'Sparkling', reason: 'Beverage descriptor contraction' },
    ],
  },
  flavors: {
    name: 'Flavors & Mixers',
    rules: [
      { from: 'CHOC', to: 'Chocolate', reason: 'Flavor contraction' },
      { from: 'VAN', to: 'Vanilla', reason: 'Flavor contraction' },
      { from: 'STRWB', to: 'Strawberry', reason: 'Flavor contraction' },
      { from: 'WTRMLN', to: 'Watermelon', reason: 'Flavor contraction' },
      { from: 'BLBRY', to: 'Blueberry', reason: 'Flavor contraction' },
      { from: 'CARAM', to: 'Caramel', reason: 'Flavor contraction' },
      { from: 'COCO', to: 'Coconut', reason: 'Flavor contraction' },
      { from: 'ORNG', to: 'Orange', reason: 'Flavor contraction' },
      { from: 'LMN', to: 'Lemon', reason: 'Flavor contraction' },
      { from: 'GRAPEFRT', to: 'Grapefruit', reason: 'Flavor contraction' },
      { from: 'PINEAPL', to: 'Pineapple', reason: 'Flavor contraction' },
    ],
  },
  brands: {
    name: 'Top Brand Spellings',
    rules: [
      { from: 'HEINIKEN', to: 'Heineken', reason: 'Common typo correction' },
      { from: 'HEIN', to: 'Heineken', reason: 'POS brand shorthand' },
      { from: 'BUDWEISSER', to: 'Budweiser', reason: 'Common typo correction' },
      { from: 'CORONNA', to: 'Corona', reason: 'Common typo correction' },
      { from: 'GUINESS', to: 'Guinness', reason: 'Common typo correction' },
      { from: 'MALBORO', to: 'Marlboro', reason: 'Common typo correction' },
      { from: 'MARLB', to: 'Marlboro', reason: 'POS brand shorthand' },
      { from: 'NWPRT', to: 'Newport', reason: 'POS brand shorthand' },
      { from: 'AMER SPIRIT', to: 'American Spirit', reason: 'Brand contraction' },
      { from: 'KANVA', to: 'Kanva', reason: 'Brand case standardization' },
    ],
  },
};

// 7. Parse raw rule text (FROM=>To # Reason)
export function parseAliasText(text = '') {
  return String(text)
    .split('\n')
    .map((l) => {
      const hashIdx = l.indexOf('#');
      const comment = hashIdx >= 0 ? l.slice(hashIdx + 1).trim() : '';
      const clean = hashIdx >= 0 ? l.slice(0, hashIdx) : l;
      const parts = clean.split('=>');
      if (parts.length !== 2 || !parts[0].trim()) return null;
      return {
        from: parts[0].trim(),
        to: parts[1].trim(),
        reason: comment || 'Manual user rule',
        approved: true,
      };
    })
    .filter(Boolean);
}
