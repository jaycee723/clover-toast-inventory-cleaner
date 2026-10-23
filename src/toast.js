import { finalValues, isApproved } from './review.js';

// Toast POS Import Formats and Specifications
// Uses Barcode as the primary product identity (SKU and Barcode fields).

export const TOAST_RETAIL_HEADERS = [
  'Name',
  'Category',
  'Price',
  'Cost',
  'SKU',
  'Barcode',
  'POS Name',
  'Description',
  'Unit of Measure',
  'Brand',
  'Supplier',
  'Supplier Item ID'
];

export const TOAST_MENU_HEADERS = [
  'Operation',
  'Entity Type',
  'Name',
  'POS Name',
  'Kitchen Name',
  'Price',
  'Sales Category',
  'SKU',
  'Barcode',
  'Pricing Strategy',
  'Description'
];

/**
 * Extracts the canonical barcode string to use as Toast product identity.
 * Preserves leading zeroes for UPC-A, expands UPC-E if necessary, and returns clean digits.
 */
export function getBarcodeIdentity(row) {
  if (!row || !row.barcode) return '';
  const b = row.barcode;

  // If candidate has expanded UPC-A (from UPC-E), prefer the 12-digit UPC-A for Toast register scanning
  if (b.candidates?.length) {
    const upce = b.candidates.find((c) => c.expandedUpcA);
    if (upce?.expandedUpcA) return upce.expandedUpcA;
  }

  if (b.digits) {
    // If UPC-A with leading zeros lost (9-11 digits), pad to 12
    if (b.type === 'UPC-A' || b.status === 'presumed-leading-zeros') {
      return b.digits.padStart(12, '0');
    }
    return b.digits;
  }

  if (b.original && /^\d+$/.test(b.original)) {
    return b.original;
  }

  return '';
}

/**
 * Normalizes price or cost into standard decimal format (e.g. 19.99).
 */
export function formatToastPrice(val) {
  if (val === null || val === undefined || val === '') return '';
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  if (!cleaned) return '';
  const num = Number(cleaned);
  if (Number.isNaN(num) || num < 0) return '';
  return num.toFixed(2);
}

/**
 * Validates whether a row is ready for Toast import using barcode as identity.
 */
export function validateToastRow(row) {
  const errors = [];
  const warnings = [];
  const barcode = getBarcodeIdentity(row);

  if (!barcode) {
    errors.push('Missing barcode (required as product identity)');
  } else if (!row.barcode.structurallyValid && row.barcode.status !== 'presumed-leading-zeros') {
    errors.push(`Invalid barcode structure: ${row.barcode.reason || 'check digit failed'}`);
  }

  if (row.duplicate) {
    errors.push('Duplicate barcode detected (Toast requires unique barcode/SKU identity)');
  }

  const f = finalValues(row);
  const name = (f.name || row.current_name || '').trim();
  if (!name) {
    errors.push('Missing product name');
  }

  const category = (f.category || row.category || '').trim();
  if (!category) {
    warnings.push('Missing category (Toast will assign to default/uncategorized)');
  }

  const price = formatToastPrice(row.price);
  if (!price) {
    warnings.push('Missing price (Toast will import with empty or 0.00 price)');
  }

  return {
    valid: errors.length === 0,
    approved: isApproved(row),
    errors,
    warnings,
    barcode,
    name,
    category: category || 'General Retail',
    price,
    cost: formatToastPrice(row.cost),
  };
}

/**
 * Constructs a row for Toast Retail Item Catalog CSV.
 */
export function buildToastRetailRow(row) {
  const f = finalValues(row);
  const barcode = getBarcodeIdentity(row);
  const name = (f.name || row.current_name || '').trim();
  const posName = name.length > 40 ? name.slice(0, 40).trim() : name;
  const category = (f.category || row.category || '').trim() || 'General Retail';
  const price = formatToastPrice(row.price);
  const cost = formatToastPrice(row.cost);
  const brand = row.reference?.brand || '';
  const desc = row.reference?.variant || (row.name_source ? `Identified via ${row.name_source}` : '');

  return [
    name,
    category,
    price,
    cost,
    barcode,   // SKU (Barcode as product identity)
    barcode,   // Barcode (scannable barcode)
    posName,
    desc,
    'EA',
    brand,
    '',
    ''
  ];
}

/**
 * Constructs a row for Toast Menu Bulk Import CSV.
 */
export function buildToastMenuRow(row) {
  const f = finalValues(row);
  const barcode = getBarcodeIdentity(row);
  const name = (f.name || row.current_name || '').trim();
  const posName = name.length > 40 ? name.slice(0, 40).trim() : name;
  const category = (f.category || row.category || '').trim() || 'General Retail';
  const price = formatToastPrice(row.price) || '0.00';
  const desc = row.reference?.variant || '';

  return [
    'CREATE',
    'MENU_ITEM',
    name,
    posName,
    posName,
    price,
    category,
    barcode,   // SKU (Barcode as product identity)
    barcode,   // Barcode (scannable barcode)
    'BASE',
    desc
  ];
}

/**
 * Exports rows into the chosen Toast format.
 */
export function exportToastRows(rows, { format = 'retail', onlyApproved = true, strictBarcodes = true } = {}) {
  let filtered = rows;

  if (onlyApproved) {
    filtered = filtered.filter(isApproved);
  }

  if (strictBarcodes) {
    filtered = filtered.filter((r) => {
      const v = validateToastRow(r);
      return v.valid;
    });
  }

  const isMenu = format === 'menu';
  const header = isMenu ? TOAST_MENU_HEADERS : TOAST_RETAIL_HEADERS;
  const builder = isMenu ? buildToastMenuRow : buildToastRetailRow;

  return [header, ...filtered.map(builder)];
}

/**
 * Summarizes inventory readiness specifically for Toast POS import.
 */
export function summarizeToastReadiness(rows) {
  let total = rows.length;
  let readyApproved = 0;
  let readyAllValid = 0;
  let missingBarcode = 0;
  let invalidBarcode = 0;
  let duplicateBarcode = 0;
  let pendingDecisions = 0;
  let missingPrice = 0;
  let missingCategory = 0;

  for (const r of rows) {
    const v = validateToastRow(r);
    const approved = v.approved;

    if (!v.barcode) {
      missingBarcode++;
    } else if (r.duplicate) {
      duplicateBarcode++;
    } else if (!v.valid) {
      invalidBarcode++;
    }

    if (!approved) {
      pendingDecisions++;
    }

    if (!v.price) missingPrice++;
    if (!v.category || v.category === 'General Retail') missingCategory++;

    if (v.valid) {
      readyAllValid++;
      if (approved) readyApproved++;
    }
  }

  return {
    total,
    readyApproved,
    readyAllValid,
    missingBarcode,
    invalidBarcode,
    duplicateBarcode,
    pendingDecisions,
    missingPrice,
    missingCategory
  };
}

/**
 * Computes summary stats (total item count, price count, total price, average price)
 * for the Toast CSV preview table footer.
 */
export function computeToastPreviewSummary(headers = [], rows = []) {
  const totalCount = rows.length;
  const priceColIdx = headers.findIndex((h) => String(h || '').trim().toLowerCase() === 'price');
  let totalPrice = 0;
  let priceCount = 0;

  if (priceColIdx !== -1) {
    for (const r of rows) {
      const raw = String(r[priceColIdx] ?? '').replace(/[^0-9.]/g, '');
      if (raw !== '') {
        const p = parseFloat(raw);
        if (!Number.isNaN(p)) {
          totalPrice += p;
          priceCount++;
        }
      }
    }
  }

  const avgPrice = priceCount > 0 ? (totalPrice / priceCount).toFixed(2) : '0.00';
  return {
    totalCount,
    priceCount,
    totalPrice: totalPrice.toFixed(2),
    avgPrice
  };
}

