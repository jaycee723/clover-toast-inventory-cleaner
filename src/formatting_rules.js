/**
 * Rule-based heuristic formatter for retail & liquor catalog standardization.
 * Acts as an intelligent fallback or local processing engine.
 */
export function generateRuleBasedFormatting(prompt, items) {
  const p = String(prompt || '').toLowerCase();
  const changes = [];

  for (const item of items) {
    const origName = String(item.name || item.current_name || '').trim();
    let newName = origName;
    const reasons = [];

    // Title case check
    if (p.includes('title') || p.includes('case') || p.includes('brand') || origName === origName.toUpperCase()) {
      const tc = origName.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\b(Ml|Ltr|Oz|Fl|Pt|Qt)\b/g, (u) => u.toLowerCase())
        .replace(/\bUpc\b/i, 'UPC')
        .replace(/\bPk\b/i, 'Pack');
      if (tc !== origName && tc.length > 2) {
        newName = tc;
        reasons.push('Title-cased name and brand');
      }
    }

    // Volume / Size standardization
    if (p.includes('bottle') || p.includes('volume') || p.includes('size') || p.includes('ml') || p.includes('liter')) {
      const volNormalized = newName
        .replace(/(\d+)\s*([mM][lL])\b/g, '$1ml')
        .replace(/(\d+(?:\.\d+)?)\s*([lL]|[lL][tT][rR])\b/g, '$1L')
        .replace(/(\d+)\s*([oO][zZ])\b/g, '$1oz');
      if (volNormalized !== newName) {
        newName = volNormalized;
        reasons.push('Standardized bottle volume notation');
      }
    }

    // Pack standardization
    if (p.includes('pack') || p.includes('pk') || p.includes('can') || p.includes('beer')) {
      const packNormalized = newName
        .replace(/(\d+)\s*(?:[pP][kK]|[pP][aA][cC][kK])\b/g, '$1-Pack')
        .replace(/(\d+)\s*(?:[bB][tT][lL]|[bB][oO][tT][tT][lL][eE][sS]?)\b/gi, '$1-Bottle');
      if (packNormalized !== newName) {
        newName = packNormalized;
        reasons.push('Standardized multi-pack specification');
      }
    }

    // Suffix ordering: move volume or pack to end if requested
    if (p.includes('end') && (p.includes('volume') || p.includes('size'))) {
      const volMatch = newName.match(/\b(\d+(?:\.\d+)?(?:ml|L|oz))\b/i);
      if (volMatch && !newName.trim().endsWith(volMatch[1])) {
        const cleaned = newName.replace(volMatch[0], '').replace(/\s+/g, ' ').trim();
        newName = `${cleaned} ${volMatch[1]}`;
        reasons.push('Moved volume suffix to end of product title');
      }
    }

    if (newName !== origName && reasons.length > 0) {
      changes.push({
        id: item.id,
        field: 'name',
        originalValue: origName,
        proposedValue: newName,
        reason: reasons.join('; ')
      });
    }

    // Category suggestions if requested
    if (p.includes('categor') || p.includes('organize') || p.includes('department')) {
      const lower = origName.toLowerCase();
      let proposedCat = '';
      if (lower.includes('vodka') || lower.includes('whiskey') || lower.includes('bourbon') || lower.includes('rum') || lower.includes('gin') || lower.includes('tequila')) {
        proposedCat = 'Spirits';
      } else if (lower.includes('beer') || lower.includes('ipa') || lower.includes('lager') || lower.includes('ale') || lower.includes('stout') || lower.includes('cider')) {
        proposedCat = 'Beer';
      } else if (lower.includes('wine') || lower.includes('chardonnay') || lower.includes('cabernet') || lower.includes('pinot') || lower.includes('merlot')) {
        proposedCat = 'Wine';
      }
      if (proposedCat && proposedCat !== item.category) {
        changes.push({
          id: item.id,
          field: 'category',
          originalValue: item.category || 'Uncategorized',
          proposedValue: proposedCat,
          reason: `Auto-categorized by retail keyword to ${proposedCat}`
        });
      }
    }
  }

  return {
    message: `Analyzed items for "${prompt}". Generated ${changes.length} proposed formatting adjustment(s).`,
    summary: `Identified ${changes.length} adjustment(s) across catalog items.`,
    changes
  };
}
