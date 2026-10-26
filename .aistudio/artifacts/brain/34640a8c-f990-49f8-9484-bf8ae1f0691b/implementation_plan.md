# Foolproof Toast Import Flow with Gemini AI Companion & Confident Edit Controls

Radically simplify the Clover-to-Toast inventory preparation into a clean, guided 4-step wizard with an integrated Gemini AI assistant, confidence-tiered edit flagging, granular item-by-item edit/revert controls, and dual export formats matching the official Toast Onboarding Retail Template.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Key Enhancements Based on Your Feedback**:
> - **Certainty-Based Edit Flagging in Step 3**: Edits are scored by confidence. Safe standardizations (brand casing, mathematical 13-digit zero-padding) are marked high certainty, while ambiguous abbreviations or fuzzy modifications are distinctly flagged as **"⚠️ Needs Review (Uncertain Logic)"** with clear reasons.
> - **Granular Edit & Revert Controls**:
>   - **Individual Row Edits**: Edit item name, category, or barcode directly inline.
>   - **Individual Remove / Revert**: Single-click "↩️ Revert to Original" button on any row to discard an unwanted edit.
>   - **1-Click Auto-Fix & Approve All**: Quickly approve all high-certainty items at once, or approve all with one click.
>   - **Global Reset**: Option to remove all applied edits and return to raw Clover data at any time.
> - **Interactive Gemini AI Chat Companion**: Live conversational assistant that answers questions, makes milestone progress announcements, and fine-tunes batch edits with interactive diff previews.
> - **Dual Toast Export Formats**: Direct **Toast Retail Catalog CSV** and official **Toast Onboarding Consultant Template** matching `777_-_Retail_Template` with step-by-step sharing instructions.

---

## 1. Overview & Core Concept

- **The Problem**: Bulk automated cleanups can make incorrect guesses on unusual retail abbreviations or obscure barcodes. Users need transparency into *why* an edit was made and the ability to accept, reject, or fine-tune individual edits before export.
- **The Solution**: A clean 4-step wizard with built-in confidence checks:
  1. **Upload Clover Inventory**: Drop `.xlsx` or `.csv` files; instant item count and health check.
  2. **Smart Clean Autopilot**: Instant pass applying brand casing, pack-size normalization, and 13-digit barcode padding.
  3. **Confident Review & Edit Tuning**:
     - Automatically flags edits where certainty isn't high.
     - 1-click buttons to approve high-certainty edits, edit fields inline, or remove edits individually.
  4. **Export & Toast Consultant Handoff**: Full preview with summary metrics, direct Toast CSV, and Toast Onboarding Template with consultant sharing guide.

---

## 2. Streamlined User Experience & Step 3 Architecture

### Wizard Navigation & Step 3 Edit Control Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Toast Import Wizard Header (Step 1 ─▶ Step 2 ─▶ Step 3 ─▶ Step 4)          │
├─────────────────────────────────────────────────────────────────────────────┤
│ STEP 3: REVIEW & FINE-TUNE EDITS                                            │
│                                                                             │
│ [⚡ Auto-Approve High-Certainty (810)]  [Approve All]  [↩️ Remove All Edits] │
│                                                                             │
│ ⚠️ Flagged for Review (4 items with uncertain logic):                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Item #14: KANVA CHARD 750                                               │ │
│ │ Proposed: Kanva Chardonnay 750ml  [⚠️ Review: Abbreviation ambiguous]   │ │
│ │ • Name:     [ Kanva Chardonnay 750ml                    ] (editable)    │ │
│ │ • Category: [ Wine                                    ▼ ] (editable)    │ │
│ │ • Barcode:  [ 0123456789012                             ] (editable)    │ │
│ │ Actions:    [ ✓ Accept Edit ]  [ ✕ Revert to Original ]                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Item #89: JOSE CUERVO GOLD                                              │ │
│ │ Proposed: Jose Cuervo Especial Gold Tequila 750ml                       │ │
│ │ [✓ High Certainty: Verified Brand & Catalog Match]                      │ │
│ │ Actions:    [ ✓ Accepted ]     [ ✕ Revert to Original ]                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ➔ Primary Action: [ Continue to Final Toast Export ➔ ]                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Edit Certainty & Flagging Rules
- **High Certainty (Green)**:
  - Exact brand title-casing (e.g. `TITO'S` → `Tito's`, `CORONA` → `Corona`).
  - Standardized pack formats (e.g. `12PK` → `12-Pack`, `6PK` → `6-Pack`).
  - Mathematical 13-digit EAN zero-padding where the check digit is mathematically verified.
- **Needs Review / Flagged (Amber Alert)**:
  - Ambiguous abbreviations with multiple plausible meanings (e.g. `CHARD` = Chardonnay vs Charcuterie; `SM` = Small vs Smirnoff).
  - Fuzzy string match distance > 2 characters.
  - Category assignments where multiple departments could match.
  - Items with missing prices or duplicate barcodes across different products.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Individual Row Revert & Edit vs. All-or-Nothing**
  - *Chosen Approach*: Every modified row displays an inline editable field and an instant "✕ Revert to Original" button.
  - *Why*: Gives users complete control to keep good automated edits while easily removing questionable ones.
- **Decision 2: Automated Certainty Scoring**
  - *Chosen Approach*: Categorize proposed changes into High Certainty vs. Needs Review, allowing one-click bulk approval of safe items while isolating items requiring human eyes.
  - *Why*: Saves operators from auditing 800+ obvious fixes just to find the 3 ambiguous items.
- **Decision 3: Global Reset / Revert**
  - *Chosen Approach*: Provide a clean "↩️ Remove All Edits" option in the toolbar.
  - *Why*: Allows users to start fresh without re-uploading the file if they experiment with custom rules or AI instructions.

---

## 4. Technical Architecture & Implementation Steps

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Central State Engine                             │
│   currentStep: 1 | 2 | 3 | 4                                                │
│   records: Original Clover rows (immutable backup for clean reverts)        │
│   rows: Working item state with decisions { name, category, barcode }       │
│   editMetadata: { [rowId]: { modified: bool, certainty: 'high'|'review',    │
│                              reasons: string[], original: obj } }           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
     ┌─────────────────────────────────┼─────────────────────────────────┐
     ▼                                 ▼                                 ▼
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│      src/toast.js      │  │   app.js (Wizard & AI) │  │   index.html & CSS     │
│ • buildToastOnboarding │  │ • computeCertainty()   │  │ • Step 3 Edit Toolbar  │
│ • buildToastRetailRow  │  │ • revertRowEdit(id)    │  │ • Inline Edit Inputs   │
│ • computeToastSummary  │  │ • revertAllEdits()     │  │ • Certainty Badges     │
│ • exportToastRows      │  │ • inlineEditHandler()  │  │ • Revert Buttons (✕)   │
└────────────────────────┘  └────────────────────────┘  └────────────────────────┘
```

### Specific Implementation Stages:

1. **Certainty Scoring & Edit Tracking (`src/review.js` & `src/spellcheck.js`)**:
   - Tag proposals with certainty flags (`high` vs `review-recommended`) based on match confidence, abbreviation ambiguity, and barcode verification.
   - Maintain original snapshot references on every row to support instant individual or bulk revert.

2. **Step 3 UI & Inline Edit Handlers (`app.js` & `index.html`)**:
   - Build the Step 3 review toolbar with:
     - `⚡ Auto-Approve High-Certainty Edits`
     - `Approve All`
     - `↩️ Remove All Edits`
     - Filter toggle: `Show Flagged Only` vs `Show All`
   - Render inline editable inputs for Name, Category, and Barcode.
   - Provide row-level `[ ✓ Accept ]` and `[ ✕ Revert to Original ]` action buttons.

3. **Gemini AI Chat Companion & Announcements (`server.js` & `app.js`)**:
   - Real-time conversational announcements in the chat stream:
     - Announce flagged items count: `"⚠️ Found 4 items with ambiguous abbreviations that need your quick review in Step 3."`
   - Support conversational fine-tuning ("Undo changes to item #14" or "Keep original names for beer").

4. **Toast Retail & Onboarding Consultant Formats (`src/toast.js`)**:
   - `TOAST_RETAIL_HEADERS` for direct Toast Web CSV.
   - `TOAST_ONBOARDING_HEADERS` matching `777_-_Retail_Template` with embedded consultant sharing guidance.
   - Preview modal with sticky total count and average price summary footer.

5. **Testing & Verification**:
   - Update tests in `tests/review.test.js`, `tests/spellcheck.test.js`, and `tests/toast_preview.test.js` to verify individual row revert, bulk revert, certainty calculation, and export integrity.
   - Run `npm test`, `lint_applet`, and verify dev server build.
