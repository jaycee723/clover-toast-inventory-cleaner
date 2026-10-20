# Barcode 13-Digit Auto-Padding & Gemini AI Dataset Formatting Assistant

Automates the detection and bulk correction of barcode padding anomalies (e.g., spreadsheet-stripped leading zeros to 13-digit EAN-13 standards) and adds a cloud-powered Gemini 3.8 Flash AI chat assistant in a slide-out drawer that allows natural language batch formatting, custom tweaks, and instant diff verification across the inventory dataset.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design and architectural choices have been confirmed and incorporated based on your feedback:

- **Gemini Assistant Presentation**: Slide-out interactive side drawer (collapsible, non-intrusive) with quick-prompt chips, conversational message history, and clear status indicators.
- **AI Modification Confirmation**: Diff comparison preview drawer/modal showing exact Before → After values, affected row counts, and a single "Approve & Apply to Dataset" button with full undo support.
- **Barcode 13-Digit Padding Scope**: Identifies all numeric barcodes with fewer than 13 digits (including 10, 11, and 12-digit barcodes stripped by spreadsheet programs) and provides a prominent `"Auto-pad all barcodes to 13 digits"` bulk action button while verifying checksum validity.
- **Free Cloud Gemini API**: Uses Google's free-tier `gemini-3.8-flash` on the server backend (`/api/ai/format`), ensuring zero API key exposure and no client configuration required.

---

## 1. Overview & Core Concept

### What It Does
1. **Barcode Padding Inspector & Bulk Fix**:
   - Detects barcodes where spreadsheet applications (Excel, Google Sheets) stripped leading zeros (such as 10-, 11-, or 12-digit numbers that should be standard 13-digit EAN-13 or 12-digit UPC-A).
   - Provides a dedicated counter banner and a 1-click button: **"Auto-pad all barcodes to 13 digits"**, immediately standardizing product identities across the entire loaded dataset with check-digit re-validation.
2. **Gemini AI Formatting Assistant**:
   - A slide-out side drawer with a conversational assistant tailored for inventory managers and retail store operators.
   - Users can type requests like *"Make all liquor brand names Title Case"*, *"Convert 'pk' and 'pack' abbreviations to standard 'Pack'"*, or *"Move bottle volumes (e.g., 750ml, 1.75L) to the end of the name"*.
   - The assistant processes the dataset, generates structured field-level changes, and presents an interactive diff preview table showing affected items before committing changes.

### Target Audience & Persona
- Retail inventory managers, liquor store operators, and POS administrators migrating or cleaning Clover inventory for Toast POS imports who need automated formatting without manual CSV editing.

### Key Value
- Eliminates manual barcode editing in spreadsheets that risk stripping leading zeros.
- Combines rule-based speed with the flexibility of generative AI for custom naming and categorization conventions.

---

## 2. User Experience & Visual Design

### Key User Flows

#### Flow A: 13-Digit Barcode Auto-Padding
```
[Upload Clover File]
        │
        ▼
[Barcode Analyzer flags N barcodes with missing padding]
        │
        ▼
[Prominent Alert Strip: "N barcodes have missing leading zeros (under 13 digits)"]
        │
        ▼
[Click "Auto-pad all barcodes to 13 digits"]
        │
        ▼
[All eligible barcodes padded to 13 digits with '0' + re-verified]
        │
        ▼
[Success toast & Toast Import readiness counters updated immediately]
```

#### Flow B: Gemini AI Dataset Formatting via Chat
```
[Click "AI Assistant" Button in Header / Workspace Toolbar]
        │
        ▼
[Slide-out Side Drawer opens with quick prompt suggestions]
        │
        ▼
[User inputs custom prompt: "Standardize beer 6-packs and format volume units"]
        │
        ▼
[Server executes Gemini 3.8 Flash with structured schema output]
        │
        ▼
[Diff Preview Card appears: "42 items proposed for update" with Before / After table]
        │
        ▼
[Click "Approve & Apply Changes" -> Dataset updated, Undo toast appears]
```

### Visual Identity & Theme
- **Theme Foundation**: Clean SaaS industrial aesthetic following `@frontend-design` and `references/3_saas_dashboard.md`.
- **Color Palette (60-30-10 Rule)**:
  - 60% Canvas: Slate dark `#0f172a` / `#1e293b` with neutral contrast.
  - 30% Structural: Surface panels `#1e293b` with 1px hairline borders (`rgba(255,255,255,0.08)`).
  - 10% Accents: Amber/Orange (`#f97316`) for barcode & Toast import actions; Electric Indigo/Cyan (`#6366f1` / `#38bdf8`) for the Gemini AI assistant.
- **Typography**: Clean contemporary sans (`Plus Jakarta Sans`) paired with tabular monospace (`JetBrains Mono` / `tabular-nums`) for barcode digits, SKU numbers, and prices.
- **Top Bar Contract**:
  - Left: App Wordmark `Clover → Toast Cleaner`.
  - Center: Clean single-line links (`Inventory Review`, `Spelling Rules`, `Toast Export`).
  - Right: Quick Action `✨ AI Assistant` button and `1-Click Auto Process`.

---

## 3. Key Product Decisions & Trade-Offs

### 1. Barcode Padding Algorithm
- **Chosen Approach**: Standardize padding to 13 digits (`digits.padStart(13, '0')`) while checking validity for both EAN-13 and UPC-A (12-digit with leading zero). Barcodes between 8 and 12 digits are safely padded and re-analyzed with `checkDigitOk`.
- **Why**: Retail scanners and Toast POS barcode databases natively resolve 12-digit UPCs as 13-digit EANs prefixed by `0`. This guarantees consistent product identity without losing check-digit integrity.
- **Alternative Considered**: Padding blindly without validation (rejected because it would turn invalid scans into fake barcodes).

### 2. Server-Side Gemini API Proxy vs Client-Side Direct Calls
- **Chosen Approach**: Express backend route (`/api/ai/format`) using the official `@google/genai` TypeScript/ESM SDK with model `gemini-3.8-flash`.
- **Why**: Strictly adheres to security constraints (API keys are never exposed in browser bundles, no key entry UI in frontend) and allows the server to inject structured system prompts and response schemas.

### 3. AI Modification Confirmation Strategy
- **Chosen Approach**: Structured JSON schema output from Gemini returning `[ { rowId, field, originalValue, proposedValue, reason } ]`. The frontend renders a clear diff table before any state mutation occurs.
- **Why**: Prevents accidental data corruption, gives inventory managers complete trust and transparency, and enables one-click rollback.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Browser Client (app.js)                         │
│                                                                        │
│  ┌───────────────────────┐  ┌──────────────────────────────────────┐  │
│  │   Hero & Dropzone     │  │      Barcode Padding Banner          │  │
│  │ 1-Click Auto Process  │  │ "Auto-pad all barcodes to 13 digits" │  │
│  └───────────┬───────────┘  └──────────────────┬───────────────────┘  │
│              │                                 │                      │
│              ▼                                 ▼                      │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │            Inventory State Store (S.rows, S.records)            │  │
│  └───────────▲─────────────────────────────────┬───────────────────┘  │
│              │                                 │                      │
│              │ Diff Approval                   │ Row Context          │
│              │                                 ▼                      │
│  ┌───────────┴───────────┐         ┌───────────────────────────────┐  │
│  │    Diff Preview Modal │         │      AI Assistant Drawer      │  │
│  │   [Approve / Reject]  │         │   Chat input & Quick Chips    │  │
│  └───────────────────────┘         └───────────────┬───────────────┘  │
└────────────────────────────────────────────────────┼───────────────────┘
                                                     │ POST /api/ai/format
                                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Node / Express Server                           │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ POST /api/ai/format                                              │  │
│  │ • Validates payload & filters item samples                       │  │
│  │ • Initializes GoogleGenAI(process.env.GEMINI_API_KEY)            │  │
│  │ • System prompt: Inventory Standardization Expert                │  │
│  │ • Model: gemini-3.8-flash with JSON responseSchema               │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │
                                      ▼
                   ┌────────────────────────────────────┐
                   │     Google Cloud Gemini 3.8 API    │
                   │        (gemini-3.8-flash)          │
                   └────────────────────────────────────┘
```

### Component & State Mapping

1. **`src/barcode.js` & `app.js` Barcode Padding**:
   - `findPaddingAnomalies(rows)`: Identifies items with numeric barcodes of length 8–12.
   - `autoPadBarcodes13(rows)`: Pads eligible barcodes to 13 digits with leading zeros, re-executes `analyzeBarcode`, updates `row.barcode`, and refreshes Toast readiness metrics.
   - UI Element `#btnAutoPad13`: Prominent button in the barcode review section and hero banner with live count indicator.

2. **`server.js` Backend Route**:
   - Install `@google/genai` dependency.
   - Route `POST /api/ai/format`: Receives user instruction and inventory sample/records, issues `ai.models.generateContent` with `gemini-3.8-flash` using structured JSON output schema, and returns proposed changes.

3. **`index.html` & `style.css` UI Elements**:
   - Slide-out AI Assistant Drawer (`#aiDrawer`) with conversational message thread, quick prompt chips (e.g., "Clean bottle sizes", "Standardize brand casing", "Clean up alcohol ABV"), and prompt textarea.
   - Floating/Header AI button with keyboard shortcut (`Alt + A`).
   - Diff Preview Container (`#aiDiffModal` / `#aiDiffContainer`) with high-density before/after comparison table and "Approve & Apply" action.

4. **Safety & Verification**:
   - Unit tests in `tests/barcode.test.js` verifying 13-digit padding and check digit preservation.
   - Tests in `tests/ai_format.test.js` testing diff parsing and state updates.
   - All tests passing with `npm test`, clean `npm run lint`, and verified build compilation.
