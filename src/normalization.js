const ACRONYMS = new Set([
  'IPA', 'RTD', 'USA', 'XL', 'VS', 'VSOP', 'XO', 'BBQ', 'TV', 'USB', 'LED',
  'PBR', 'CBD', 'THC', 'THCA', 'HI', 'NY', 'UK', 'IV', 'II', 'III', 'ABV',
  'DIPA', 'NEIPA', 'BTL', 'POS', 'UPC', 'OG', 'VAP', 'NA'
]);

const SMALL = new Set(['of', 'and', 'the', 'with', 'in', 'for', 'a', 'an', 'to', 'by']);

// Special brand and name capitalization patterns
const SPECIAL_BRANDS = new Map([
  ['JACK DANIELS', "Jack Daniel's"],
  ["JACK DANIEL'S", "Jack Daniel's"],
  ['JIM BEAM', 'Jim Beam'],
  ['MAKERS MARK', "Maker's Mark"],
  ["MAKER'S MARK", "Maker's Mark"],
  ['JOHNNIE WALKER', 'Johnnie Walker'],
  ['GREY GOOSE', 'Grey Goose'],
  ['KETEL ONE', 'Ketel One'],
  ['DON JULIO', 'Don Julio'],
  ['CASAMIGOS', 'Casamigos'],
  ['STELLA ARTOIS', 'Stella Artois'],
  ['MICHELOB ULTRA', 'Michelob Ultra'],
  ['BLUE MOON', 'Blue Moon'],
  ['WHITE CLAW', 'White Claw'],
  ['HIGH NOON', 'High Noon'],
  ['TWISTED TEA', 'Twisted Tea'],
  ['RED BULL', 'Red Bull'],
  ['DR PEPPER', 'Dr Pepper'],
  ['MOUNTAIN DEW', 'Mountain Dew'],
  ['COCA-COLA', 'Coca-Cola'],
  ['COKE', 'Coke'],
  ['SOUR PATCH', 'Sour Patch'],
  ['AMERICAN SPIRIT', 'American Spirit'],
  ['GEEK BAR', 'Geek Bar'],
  ['ELF BAR', 'Elf Bar'],
  ['LOST MARY', 'Lost Mary'],
  ['PUFF BAR', 'Puff Bar'],
  ['KANVA BOTANICALS', 'Kanva Botanicals']
]);

export function normalizeUnits(s) {
  return s
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:fl\.?\s?oz\.?)\b/gi, '$1 fl oz')
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:oz\.?|ounces?)(?![a-z])/gi, '$1 oz')
    .replace(/\b(\d+(?:\.\d+)?)\s*ml\b/gi, '$1 mL')
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:ltr|liter|litre|l)\b/gi, '$1 L')
    .replace(/\b(\d+)\s*(?:pk|pck|pack)\b/gi, '$1 Pack')
    .replace(/\b(\d+)\s*(?:ct|count)\b/gi, '$1 Count');
}

function titleToken(w, first) {
  if (/\d/.test(w)) return w;
  if (ACRONYMS.has(w.toUpperCase())) return w.toUpperCase();
  const lw = w.toLowerCase();
  if (!first && SMALL.has(lw)) return lw;
  // Handle Scottish/Irish names (McX, MacX) and apostrophes
  if (/^mc[a-z]{3,}$/i.test(w)) {
    return 'Mc' + w.charAt(2).toUpperCase() + w.slice(3).toLowerCase();
  }
  return lw.split("'").map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join("'");
}

export function normalizeName(raw) {
  let s = String(raw ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D"]/g, '')
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-.,\s]+|[-.,\s]+$/g, '');

  const upperKey = s.toUpperCase();
  if (SPECIAL_BRANDS.has(upperKey)) {
    return SPECIAL_BRANDS.get(upperKey);
  }

  const letters = s
    .replace(/\d+(?:\.\d+)?\s*(?:fl\.?\s?oz|oz|ml|ltr|liter|litre|l|pk|pck|pack|ct|count)\b/gi, '')
    .replace(/[^A-Za-z]/g, '');
  const single = letters && (letters === letters.toUpperCase() || letters === letters.toLowerCase());
  s = normalizeUnits(s);
  if (single) {
    s = s.split(' ').map((w, i) => (/^(mL|L|oz|fl|Pack|Count)$/.test(w) ? w : titleToken(w, i === 0))).join(' ');
  }
  return s;
}

// User-approved aliases applied with punctuation and boundary awareness
export function applyApprovedAliases(name, aliases = []) {
  let out = name;
  const used = [];
  for (const a of aliases) {
    if (!a.approved || !a.from || !a.to) continue;
    const escaped = a.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match whole token bounded by start, whitespace, or punctuation
    const re = new RegExp(`(^|[\\s,;()/\\[\\]-])${escaped}(?=[\\s,;()/\\[\\]-]|$|')`, 'gi');
    if (re.test(out)) {
      out = out.replace(re, (match, p1) => `${p1}${a.to}`);
      used.push(a);
    }
  }
  return { value: out, changed: out !== name, used };
}

export function parseSizing(name) {
  const t = normalizeUnits(String(name));
  const size = /(\d+(?:\.\d+)?)\s(mL|L|fl oz|oz)\b/.exec(t);
  const pack = /(\d+)\s(Pack|Count)\b/.exec(t);
  let ml = null;
  if (size) {
    const v = Number(size[1]);
    ml = size[2] === 'mL' ? v : size[2] === 'L' ? v * 1000 : size[2] === 'fl oz' || size[2] === 'oz' ? v * 29.5735 : null;
  }
  return {
    size: size ? Number(size[1]) : null,
    unit: size ? size[2] : null,
    ml,
    pack: pack ? Number(pack[1]) : null
  };
}
