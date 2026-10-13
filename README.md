# Clover to Toast inventory review

Browser-only tool for cleaning a Clover inventory export before a Toast Retail import. Files never leave your computer.

## What it does
- **1-Click Auto Process & Toast Export**: Single-click unified workflow that parses Clover files, naturalizes packaging abbreviations (e.g. `12PK` → `12 Pack`, `750ML` → `750 mL`), validates barcodes, accepts clean items, and immediately downloads a production-ready Toast POS Import File.
- **Toast POS Import Ready**: Generates verified Toast Retail Item Catalog (`Name, Category, Price, Cost, SKU, Barcode, POS Name, Description, Unit of Measure, Brand`) and Toast Menu Bulk Import CSVs using **Barcode as the unique product identity** (populated in both SKU and Barcode columns with preserved leading zeros).
- **Barcode Validation & Exact Math**: Analyzes UPC-A, EAN-13, EAN-8, UPC-E, GTIN-14. Scientific notation is expanded with string math. Check digits are verified without altering raw data.
- **Smart Spellcheck & Abbreviation Engine**: Damerau-Levenshtein distance, token frequency scoring, POS contraction detection, and categorized industry presets.
- **Reference Catalog Cross-Checking**: Matches barcodes against optional reference catalogs with conflict detection.
- **Firebase Firestore & Google Workspace**: Session cloud synchronization and 1-click exports to Google Sheets, Google Drive, Google Docs, Tasks, and Gmail.
- Open Food Facts may block browser (CORS) calls; the tool reports `unavailable` instead of guessing. The API limit is about 15 reads per minute per IP.
- Render backend and Clover production OAuth.

## Development
```
npm test
```
No dependencies. Node 20+.
