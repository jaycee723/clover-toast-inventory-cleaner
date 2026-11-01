# Clover to Toast Retail Import Studio (React + Vite)

A modern React application for standardizing and cleaning Clover POS inventory exports into 100% compliant Toast Retail import files and consultant templates.

## Architecture & Technology
- **Frontend**: React 19 SPA with TypeScript, built on Vite.
- **Backend API**: Express server (`server.ts`) with Gemini 3.8 Flash (`@google/genai`) for intelligent catalog formatting and interactive Copilot chat.
- **Styling**: Tailored dark-mode UI with high-contrast status badges, interactive 4-step wizard stepper, and preview modals.
- **Data Persistence**: Firebase Firestore session persistence and Google Authentication.

## Key Features
- **4-Step Guided Wizard**:
  1. **Upload Clover File**: Drag-and-drop `.xlsx` or `.csv` files, or test with the built-in 777 Liquor Store sample catalog. Includes 13-digit barcode auto-padding detection.
  2. **Smart Autopilot Clean**: 1-click normalization for packaging (e.g. `12PK` → `12-Pack`, `750ML` → `750 mL`), Title Case brand casing, and barcode check digit validation with an interactive results scorecard.
  3. **Confident Review & Tuning**: Row-level certainty assessment (`computeRowCertainty`), inline editing for names, categories, and barcodes, individual revert/accept actions, and bulk approval tools.
  4. **Export & Consultant Handoff**: Dual-export cards for direct Toast Web retail upload (`Menus > Retail Items > Bulk Import`) and the official Toast Onboarding Consultant template.
- **Gemini AI Copilot Companion**: Live chat assistant powered by Gemini 3.8 Flash with diff previews, batch approvals, undo rollback, and quick prompts.
- **Toast CSV Preview Modal**: Interactive table with search filtering and summary statistics (item count and average pricing).
- **Google Workspace & Cloud Sync**: 1-click export to Google Sheets, Google Drive, Google Docs audit reports, and Google Tasks.

## Development
```bash
# Start full-stack dev server (port 3000)
npm run dev

# Build for production
npm run build

# Run unit tests
npm test
```
