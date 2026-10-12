# Clover to Toast inventory review

Browser-only tool for cleaning a Clover inventory export before a Toast Retail import. Files never leave your computer.

## What it does
- Reads a Clover `.xlsx` or `.csv` (the Categories sheet becomes the canonical category list; existing category memberships are never changed).
- Analyzes every barcode: UPC-A, EAN-13, EAN-8, UPC-E, GTIN-14. Scientific notation is expanded exactly (string math). Check digits are **never** repaired or appended. 8-digit codes valid as both EAN-8 and UPC-E are shown as ambiguous; single-interpretation 8-digit codes are flagged for a scan check.
- Matches barcodes against an optional **reference CSV** (`manual_approved` > `manufacturer_official` > `supplier_exact` > `clover_context` > `open_food_facts`). Brand, variant, size and pack count are compared; contradictions become review items (for example a barcode that belongs to a different product). Name-only similarity never assigns a barcode.
- Formats names conservatively (whitespace, units, pack counts). Spelling changes happen **only** through aliases you approve.
- Suggests categories only for items with none, and only from your canonical list, with exception rules (snack "Puffs" are not vapes, trail mix is not a drink, pipe tobacco is tobacco, hard tea / Smirnoff Ice are ready-to-drink).
- Optional Open Food Facts lookup, last resort, for unresolved barcodes only. Results are crowd-sourced suggestions, never labeled manufacturer-verified.
- Name, barcode and category decisions are tracked separately per row and persist across filtering and paging. The "Approved" CSV contains only rows whose barcode is explicitly accepted and whose proposals are all decided.

## Not implemented yet
- Invoice PDF parsing (detached barcode lists such as Odom's cannot be paired by position). Convert invoices to the reference CSV format for now.
- Browser tests (Playwright). Unit tests cover the engine only; the UI has not been browser-tested.
- Validation against Toast's current import template. Do not treat the output as Toast-ready.
- Open Food Facts may block browser (CORS) calls; the tool reports `unavailable` instead of guessing. The API limit is about 15 reads per minute per IP.
- Render backend and Clover production OAuth.

## Development
```
npm test
```
No dependencies. Node 20+.
