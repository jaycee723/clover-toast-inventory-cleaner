# Clover to Toast Inventory Review
Initial browser-only CSV review UI. Uploads stay in your browser. Existing categories and barcode strings are retained. No private inventory, invoices, credentials, or costs are committed.

## Current capabilities
CSV import/export, size/pack formatting, editable names/barcodes/categories, GTIN checksum and duplicate flags. No automatic identity verification or invented barcode digits. The output is a REVIEW CSV, not a validated Toast import.

## Deployment
GitHub Settings > Pages > Source: GitHub Actions. The workflow publishes only index.html, style.css, and app.js.

## Pending
XLSX/PDF parsing, supplier barcode references, manufacturer verification, protected-brand spell checking, Open Food Facts fallback, backend authentication, durable jobs and Toast template validation. Do not consider these implemented.