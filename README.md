# Clover to Toast Inventory Review

Frontend-only conservative identity-resolution review app for Clover→Toast cleanup. Work is PR-only and does not claim deployment, external verification, or Toast-ready output.

## Safety and scope
- Browser-first: inventory/reference files stay local by default.
- No invoice PDF extraction in this PR. A future adapter can map extracted invoice rows into the provided reference CSV schema.
- Existing category memberships are preserved; contradictions are flagged for review.
- Valid barcode checksums are structural only, not product identity verification.
- Open Food Facts is optional, last-priority, and suggestion-only.

## Formats
- Inventory import: `.csv` and `.xlsx`.
- XLSX parser dependency: pinned `exceljs@4.4.0` (ExcelJS, npm package `exceljs`, source: https://github.com/exceljs/exceljs).
- CSV parsing preserves raw field strings; barcode parsing preserves original text plus canonical GTIN lookup key where available.
- For workbooks, `Categories` tab values are read as canonical category names; existing item category values are kept unchanged.

## Reference CSV schema
Headers:
`barcode,brand,product_name,variant,size,unit,pack_count,category,source_type,source_url,approved`

`source_type` precedence:
1. `manual_approved`
2. `manufacturer_official`
3. `supplier_exact`
4. `clover_context`
5. `open_food_facts` (last)

## Barcode behavior
- Supports UPC-A, EAN-13, EAN-8, UPC-E (as candidate for 8-digit ambiguity), and GTIN-14.
- 8-digit codes are treated conservatively with candidate exposure; no silent conversion between EAN-8 and UPC-E.
- No check-digit recompute/append; invalid or internal codes stay review items.
- Scientific notation parsing is exact string math (no floating point).

## UI
- Paginated, filterable review table with summary counts.
- Original/current/proposed fields retained separately.
- Separate accept/reject controls for name, barcode, and category.
- OFF lookup cancellation and status handling (`pending`, `not-found`, `unavailable`, `error`, `found`).
- CSV exports: review, approved-only subset, and audit export.
- Export sanitizes formula-leading cells for review/approved files.

## Development
```bash
npm install
npm test
```

## CI gate
GitHub Actions now runs tests before Pages deployment in the Pages workflow.
