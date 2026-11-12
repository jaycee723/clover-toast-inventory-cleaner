# 🍀 Clover to Toast Retail Import Studio & Avery Price Tag Studio

A high-performance full-stack web application designed for retail and liquor store operators to seamlessly clean and standardize Clover POS spreadsheets into 100% compliant Toast POS catalogs, maintain a permanent Master Inventory database with pre-merge reconciliation, and generate customizable Avery shelf price tags with embedded brand logos.

---

## 🌟 Key Features

### 1. ⚡ 4-Step Clover → Toast Migration Wizard
* **Step 1: Upload Clover File**:
  * Drag-and-drop support for `.xlsx` and `.csv` files exported from Clover POS.
  * Built-in 777 Liquor Store demo catalog for instant one-click testing.
  * Automatic barcode check-digit verification and 11-to-12 digit UPC-A zero padding.
* **Step 2: Smart Autopilot Clean**:
  * One-click normalization for packaging (e.g., `12PK` → `12-Pack`, `750ML` → `750 mL`, `1.75L` → `1.75 L`, `11oz` / `12oz`).
  * Intelligent Title Case brand casing and POS abbreviation expansion (e.g., `WHISKEY`, `VODKA`, `TEQ`).
  * Real-time validation scorecard and Toast retail readiness meter.
* **Step 3: Confident Review & Fine-Tuning**:
  * Row-level certainty scoring (`computeRowCertainty`) highlighting items needing operator verification.
  * Inline editing for item names, categories, and barcodes.
  * Smart Categorization that learns department rules from existing catalog mappings into clean Toast departments (`LIQUOR/SPIRITS`, `BEER`, `WINE`, `RTD`, `DRINKS`, `CANDY/SNACKS`, `TOBACCO PRODUCTS`, `VAPES`, `Smoke Shop`).
  * Real-time Gemini 3.8 Flash Online Search Scan with Google Search grounding.
* **Step 4: Export & Consultant Handoff**:
  * **Toast Retail CSV**: Ready for direct self-service upload in Toast Web under *Menus > Retail Items > Bulk Import*.
  * **Toast Onboarding Consultant Template**: Formatted specifically for handoff to assigned Toast Onboarding Consultants matching the official `777_-_Retail_Template` specification.
  * **Avery Design & Print CSV**: Export ready for Avery.com cloud tools.
  * **Permanent Master Inventory Commit**: Reconcile and save cleaned items to the persistent database.

---

### 2. 📦 Permanent Master Inventory Database
* **Persistent Catalog**: Houses store inventory records across sessions with dual Firestore persistence (`users/{userId}/masterItems/{itemId}`) and instant offline local storage mirroring.
* **Top Navigation Switcher**: Seamlessly switch between the **`⚡ Import & Clean Wizard`** and the **`📦 Master Inventory Catalog`**.
* **Full CRUD Management**: View, search, filter by department or brand, sort by price (low/high), title, or updated date, and edit individual items at any time.
* **Direct Label Printing**: Select any subset of inventory items or the full catalog and open them directly in the Avery Label Studio.

---

### 3. 🔍 Pre-Merge Reconciliation & Edit Diff Preview
* **Barcode Identity Reconciliation**: Computes granular diffs between incoming cleaned spreadsheets and current master inventory records.
* **Automatic Status Classification**:
  * **New**: Products not yet present in the master catalog.
  * **Update**: Existing products with changes in price, title, category, or bottle size.
  * **Exact Match**: Items matching both barcode and attributes.
* **Pre-Merge Item Editing**: Inspect and edit individual incoming attributes row-by-row before merging with the database.
* **Three Explicit Merge Strategies**:
  1. **Import All Items**: Inserts brand-new items and updates existing items with new import data.
  2. **Import New Items Only**: Adds only brand-new items, strictly preserving existing master records.
  3. **Cancel Import**: Safely aborts the import without modifying the master inventory.

---

### 4. 🏷️ Avery Label Sheet & Price Tag Studio
* **Industry-Standard Avery Templates**:
  * **Avery 5160 / 8160**: 1" × 2-5/8" (30 tags per sheet, 3 columns × 10 rows)
  * **Avery 5163 / 8163**: 2" × 4" (10 tags per sheet, 2 columns × 5 rows)
  * **Avery 5161 / 8161**: 1" × 4" (20 tags per sheet, 2 columns × 10 rows)
  * **Avery 5167 / 8167**: 1/2" × 1-3/4" (80 tags per sheet, 4 columns × 20 rows)
  * **Avery 94220**: 1" × 2-1/8" (30 tags per sheet, 3 columns × 10 rows)
* **Sheet Re-use & Quantities**: Custom start position offset to reuse partially printed label sheets, plus per-item copy multipliers.
* **Crisp Vector Barcodes**: In-browser Code 128 barcode generation with high-contrast human-readable check characters.
* **Direct PDF Generation**: Download or preview authentic Avery 8.5" × 11" Letter PDFs generated with millimeter-precise positioning.
* **Complete Theme Builder**:
  * Custom color pickers for Tag Background, Border, Store Name, Product Title, and Price.
  * Granular font size controls, margins, and padding sliders.
  * Border styling (Solid, Dashed, Dotted, Rounded).
* **Hosted Brand Logo Storage & Placement**:
  * Upload brand logos directly from the browser (auto-scaled to $\le 400\text{px}$).
  * Stored in Firestore (`users/{userId}/brandLogos`) with local IndexedDB/localStorage fallback.
  * Automatic brand lookup matching product names (e.g., "Jack Daniel's", "Corona", "High Noon").
  * Customizable logo placement per tag: **Top-Right**, **Top-Left**, **Center**, or **Inline Beside Price**.

---

### 5. 🔒 Strict Pricing Protection Rule
* Store pricing is authoritative and 100% protected.
* All AI assistants, formatting heuristics, and online search scanners are hard-constrained to fix **Item Name, Category, and Barcode/UPC ONLY**. Pricing is strictly untouched.

---

### 6. 🛡️ Security & Hardening
* **Rate Limiting**: Built-in `express-rate-limit` protecting API routes (`/api/` at 300 requests / 15m) and AI formatting routes (`/api/ai/` at 60 requests / min).
* **Cryptographic Randomness**: Secure ID generation using Web Crypto APIs (`crypto.randomUUID()` and `crypto.getRandomValues()`).
* **Linear Regular Expressions**: All catalog regex patterns are linear and immune to polynomial regular expression (ReDoS) backtracking on uncontrolled inputs.
* **Firestore Security Rules**: Strict owner-based RBAC enforcing read/write permissions for authenticated users on sessions, master items, and brand logos.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS |
| **Backend** | Express 5, Node.js (`server.ts` dev middleware & production server) |
| **AI Engine** | Google Gemini 3.8 Flash (`@google/genai`) with Google Search Grounding |
| **Database & Auth** | Firebase Firestore & Firebase Authentication (Google Sign-In) |
| **PDF & Labels** | jsPDF, SVG/Canvas Vector Barcode Engine |
| **Security** | Express Rate Limit, Web Crypto API, Firestore Security Rules |

---

## 🚀 Getting Started

### Prerequisites
* Node.js $\ge 20$
* npm $\ge 10$

### Installation
```bash
# Install dependencies
npm install

# Start local full-stack development server (port 3000)
npm run dev
```

### Environment Configuration
Create a `.env` file based on `.env.example`:
```env
# Optional Gemini API Key for AI Search Grounding & Copilot
GEMINI_API_KEY=your_api_key_here
PORT=3000
```

---

## 🧪 Testing & Verification

The project includes an extensive test suite with 93 automated unit and integration tests covering parser logic, barcode validation, Avery PDF layout calculations, master inventory reconciliation, and security boundaries:

```bash
# Run complete test suite
npm test

# Run TypeScript compilation check
npm run lint

# Build production bundle
npm run build
```

---

## 📄 License
Private store operations application. All rights reserved.
