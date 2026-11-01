import React, { useState, useEffect, useRef } from 'react';
import { toCsv, parseCsv } from './csv.js';
import { parseInventoryFile } from './xlsx.js';
import { parseReferenceCsv, buildReferenceIndex, referenceTemplateCsv } from './reference.js';
import {
  buildRows,
  setDecision,
  issues,
  approvedRows,
  acceptCleanBarcodes,
  summarize,
  exportHeader,
  exportRows,
  applyOffSuggestions,
  saveSession,
  loadSession,
  isApproved,
  computeRowCertainty,
  updateRowValue,
  revertRowEdit,
  revertAllEdits,
  autoApproveHighCertainty
} from './review.js';
import {
  exportToastRows,
  summarizeToastReadiness,
  validateToastRow,
  getBarcodeIdentity,
  computeToastPreviewSummary,
  formatToastPrice,
} from './toast.js';
import {
  signInWithGoogle,
  signOutUser,
  onAuthChange,
  saveCloudSession,
  listCloudSessions,
  loadCloudSession,
  deleteCloudSession,
  getAccessToken,
} from './firebase.js';
import {
  scanInventoryForSpellingSuggestions,
  SPELLCHECK_PRESETS,
  parseAliasText,
} from './spellcheck.js';
import {
  exportToGoogleSheets,
  importFromGoogleSheets,
  saveFileToGoogleDrive,
  downloadDriveFileContent,
  createInventoryAuditDoc,
  exportReviewIssuesToTasks,
  sendInventoryReportEmail,
  createBarcodeAuditForm,
  showGooglePicker,
} from './workspace.js';
import {
  findPaddingAnomalies,
  autoPadBarcodes13
} from './barcode.js';
import {
  prepareDatasetForAi,
  computeDiffPreview,
  applyAiChanges,
  revertAiChanges
} from './ai_assistant.js';
import { SAMPLE_777_INVENTORY } from './sample_data.ts';

function downloadFile(name: string, content: string, type: string = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function autoApproveSafeProposals(rows: any[]) {
  let approvedNames = 0;
  let approvedCats = 0;
  for (const r of rows) {
    if (r.reference.status !== 'contradiction' && r.reference.status !== 'conflicting-references') {
      if (r.proposed_name && r.decisions.name === 'pending') {
        r.decisions.name = 'accept';
        approvedNames++;
      }
      if (r.proposed_category && r.decisions.category === 'pending' && (!r.category_conflicts || !r.category_conflicts.length)) {
        r.decisions.category = 'accept';
        approvedCats++;
      }
    }
  }
  return { approvedNames, approvedCats };
}

export function App() {
  // Navigation & Wizard State
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [showCopilot, setShowCopilot] = useState<boolean>(true);

  // Core Data
  const [records, setRecords] = useState<any[]>([]);
  const [canonical, setCanonical] = useState<any[]>([]);
  const [refs, setRefs] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [aliases, setAliases] = useState<any[]>([]);
  const [paddingSnapshot, setPaddingSnapshot] = useState<any[] | null>(null);

  // Status & Notifications
  const [statusText, setStatusText] = useState<string>('');
  const [fileStatusSub, setFileStatusSub] = useState<string>('No file loaded yet');
  const [loadedFileName, setLoadedFileName] = useState<string>('');

  // Step 2 Scorecard State
  const [scorecard, setScorecard] = useState<{
    brandsTitleCased: number;
    packsNormalized: number;
    barcodesPadded: number;
    totalToastReady: number;
  } | null>(null);

  // Step 3 Interactive Review State
  const [step3Filter, setStep3Filter] = useState<'flagged' | 'all' | 'modified' | 'approved'>('flagged');
  const [step3Search, setStep3Search] = useState<string>('');

  // Toast Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<{
    format: string;
    filename: string;
    table: string[][];
    headers: string[];
    rows: string[][];
  } | null>(null);
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // AI Copilot Chat & Diff State
  const [aiChatMessages, setAiChatMessages] = useState<Array<{ role: 'user' | 'assistant' | 'announcement'; text: string }>>([
    {
      role: 'assistant',
      text: "👋 Hello! I'm your Gemini AI Inventory Copilot. I'll guide you step-by-step through preparing your Clover inventory for Toast POS.\n\nDrop your Clover file in Step 1 to begin, or click 'Load Sample' to test immediately!"
    }
  ]);
  const [aiChatInput, setAiChatInput] = useState<string>('');
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [currentAiChanges, setCurrentAiChanges] = useState<any[]>([]);
  const [aiDiffSummary, setAiDiffSummary] = useState<string>('');
  const [lastAiUndoSnapshot, setLastAiUndoSnapshot] = useState<any | null>(null);
  const [aiUndoBanner, setAiUndoBanner] = useState<string>('');

  // Auth & Cloud State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cloudStatus, setCloudStatus] = useState<string>('');
  const [cloudSessions, setCloudSessions] = useState<any[]>([]);
  const [selectedCloudSession, setSelectedCloudSession] = useState<string>('');
  const [wsStatus, setWsStatus] = useState<string>('');

  // Refs for auto-scroll and file inputs
  const chatStreamRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to Firebase Auth
  useEffect(() => {
    const unsub = onAuthChange((user: any) => {
      setCurrentUser(user);
      if (user) {
        refreshCloudSessions();
      } else {
        setCloudSessions([]);
      }
    });
    return () => unsub?.();
  }, []);

  // Keyboard shortcut Alt + A to toggle AI assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setShowCopilot((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll AI chat
  useEffect(() => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
    }
  }, [aiChatMessages]);

  const postAnnouncement = (text: string) => {
    setAiChatMessages((prev) => [...prev, { role: 'announcement', text }]);
  };

  const refreshCloudSessions = async () => {
    try {
      setCloudStatus('Loading cloud sessions…');
      const sessions = await listCloudSessions();
      setCloudSessions(sessions || []);
      setCloudStatus(`${(sessions || []).length} cloud session(s) available.`);
    } catch (err: any) {
      setCloudStatus(`Cloud error: ${err.message || String(err)}`);
    }
  };

  // Rebuild rows from records, refs, aliases
  const rebuildCatalog = (newRecords: any[], newAliases: any[], newRefs: any[] = refs, preserveDecisions: boolean = true) => {
    const oldDecisions = preserveDecisions && rows.length > 0 ? saveSession(rows) : null;
    const index = buildReferenceIndex(newRefs);
    const newRows = buildRows(newRecords, { index, canonical, aliases: newAliases });
    if (oldDecisions) {
      loadSession(newRows, oldDecisions);
    }
    applyOffSuggestions(newRows);
    setRows(newRows);
    return newRows;
  };

  // 1. File Handling
  const handleFileUpload = async (file: File) => {
    try {
      setStatusText('Reading…');
      const parsed = await parseInventoryFile(file);
      setRecords(parsed.records);
      setCanonical(parsed.canonical || []);
      setLoadedFileName(file.name);
      setFileStatusSub(`${parsed.records.length} items loaded from ${file.name}`);

      rebuildCatalog(parsed.records, aliases, refs, false);
      postAnnouncement(`Loaded ${parsed.records.length} items from "${file.name}". Click "Continue to Smart Clean" to proceed to Step 2!`);
      setStatusText('');
    } catch (err: any) {
      setStatusText(`Error reading file: ${err.message || String(err)}`);
    }
  };

  const loadSampleData = () => {
    const sample = JSON.parse(JSON.stringify(SAMPLE_777_INVENTORY));
    setRecords(sample);
    setCanonical([]);
    setLoadedFileName('Sample 777 Liquor Store Catalog');
    setFileStatusSub(`${sample.length} sample items loaded`);

    rebuildCatalog(sample, aliases, refs, false);
    postAnnouncement(`Loaded ${sample.length} sample items from 777 Liquor Store catalog. Click "Continue to Smart Clean" to begin Step 2!`);
  };

  // Barcode Auto-padding
  const paddingAnomalies = findPaddingAnomalies(records);

  const handleAutoPad13 = () => {
    if (!records.length) return;
    setPaddingSnapshot(records.map((r) => r.barcode));
    const padRes = autoPadBarcodes13(records, rows);
    setRecords([...records]);
    rebuildCatalog(records, aliases, refs, true);
    setStatusText(`Standardized ${padRes.paddedCount} barcode(s) to 13 digits! ${padRes.validEan13Count} are verified valid EAN-13 barcodes.`);
  };

  const handleUndoPad13 = () => {
    if (!paddingSnapshot) return;
    records.forEach((rec, idx) => {
      if (paddingSnapshot[idx] !== undefined) {
        rec.barcode = paddingSnapshot[idx];
      }
    });
    setPaddingSnapshot(null);
    setRecords([...records]);
    rebuildCatalog(records, aliases, refs, true);
    setStatusText('Reverted barcode padding changes to previous values.');
  };

  // 2. Step 2: 1-Click Smart Clean
  const handleRunSmartClean = () => {
    if (!records.length) {
      setStatusText('Please load an inventory file in Step 1 first.');
      return;
    }

    const unitsRules = SPELLCHECK_PRESETS.units?.rules || [];
    const liquorRules = SPELLCHECK_PRESETS.liquor?.rules || [];
    const combined = [...unitsRules, ...liquorRules];

    const updatedAliases = [...aliases];
    for (const r of combined) {
      if (!updatedAliases.some((a) => a.from.toUpperCase() === r.from.toUpperCase())) {
        updatedAliases.push({ ...r, approved: true });
      }
    }
    setAliases(updatedAliases);

    // Auto-pad barcodes to 13 digits
    const padRes = autoPadBarcodes13(records, rows);
    setRecords([...records]);

    // Build rows with updated aliases
    const updatedRows = rebuildCatalog(records, updatedAliases, refs, false);

    // Accept clean barcodes
    acceptCleanBarcodes(updatedRows);

    // Auto-approve safe proposals
    const { approvedNames } = autoApproveSafeProposals(updatedRows);

    setRows([...updatedRows]);

    const readyToast = updatedRows.filter(isApproved).length;
    setScorecard({
      brandsTitleCased: approvedNames,
      packsNormalized: combined.length,
      barcodesPadded: padRes.paddedCount,
      totalToastReady: readyToast
    });

    postAnnouncement(`🚀 Smart Clean Complete! Standardized packaging rules, auto-padded ${padRes.paddedCount} barcodes to 13 digits, and validated ${readyToast} items ready for Toast POS!`);
  };

  // 3. Step 3: Interactive Row Editing & Approvals
  const handleUpdateRow = (id: string, field: string, val: string) => {
    updateRowValue(rows, id, field, val);
    setRows([...rows]);
  };

  const handleAcceptRow = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (row) {
      row.decisions.name = 'accept';
      row.decisions.category = 'accept';
      row.decisions.barcode = 'accept';
      setRows([...rows]);
      postAnnouncement(`Accepted edits for "${row.current_name}". Barcode mapped for Toast import.`);
    }
  };

  const handleRevertRow = (id: string) => {
    const row = revertRowEdit(rows, id);
    if (row) {
      setRows([...rows]);
      postAnnouncement(`Reverted "${row.current_name}" back to original Clover imported values.`);
    }
  };

  const handleApproveHighCertainty = () => {
    const count = autoApproveHighCertainty(rows);
    setRows([...rows]);
    postAnnouncement(`⚡ Auto-approved ${count} high-certainty items! Remaining items with ambiguous logic remain flagged for your review.`);
  };

  const handleApproveAllStep3 = () => {
    for (const r of rows) {
      r.decisions.name = 'accept';
      r.decisions.category = 'accept';
      r.decisions.barcode = 'accept';
    }
    setRows([...rows]);
    postAnnouncement(`✓ Approved all ${rows.length} catalog items for Toast POS import.`);
  };

  const handleRevertAllStep3 = () => {
    const count = revertAllEdits(rows);
    setRows([...rows]);
    postAnnouncement(`↩️ Reset all ${count} catalog items back to their original Clover imported state.`);
  };

  // Step 3 Filtered Rows
  const evaluatedRows = rows.map((r) => ({ row: r, cert: computeRowCertainty(r) }));
  const filteredStep3Rows = evaluatedRows.filter(({ row, cert }) => {
    if (step3Filter === 'flagged' && !cert.flagged) return false;
    if (step3Filter === 'approved' && !isApproved(row)) return false;
    if (step3Filter === 'modified' && !row.manuallyEdited && !row.proposed_name && !row.proposed_category) return false;

    if (!step3Search.trim()) return true;
    const q = step3Search.trim().toLowerCase();
    const n = (row.current_name || '').toLowerCase();
    const orig = (row.original_name || '').toLowerCase();
    const bc = (row.barcode?.original || '').toLowerCase();
    const cat = (row.category || '').toLowerCase();
    return n.includes(q) || orig.includes(q) || bc.includes(q) || cat.includes(q);
  });
  const totalFlaggedCount = evaluatedRows.filter(({ cert }) => cert.flagged).length;

  // 4. Step 4: Toast Export and Previews
  const openToastPreview = (format: 'retail' | 'onboarding' | 'menu') => {
    if (!rows.length) {
      setStatusText('No inventory loaded. Load files in Step 1 first.');
      return;
    }

    const toastTable = exportToastRows(rows, {
      format,
      onlyApproved: false,
      strictBarcodes: true
    });

    const itemCount = toastTable.length - 1;
    if (itemCount <= 0) {
      setStatusText('No items have valid barcodes ready for Toast import.');
      return;
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = format === 'onboarding'
      ? `toast_onboarding_template_${dateStr}.csv`
      : format === 'retail'
      ? `toast_retail_import_${dateStr}.csv`
      : `toast_menu_import_${dateStr}.csv`;

    setPreviewData({
      format,
      filename,
      table: toastTable,
      headers: toastTable[0],
      rows: toastTable.slice(1)
    });
    setPreviewSearch('');
    setPreviewModalOpen(true);
  };

  const handleDownloadCsv = (format: 'retail' | 'onboarding') => {
    const toastTable = exportToastRows(rows, { format, onlyApproved: false, strictBarcodes: true });
    if (toastTable.length <= 1) {
      setStatusText('No items have valid barcodes ready for Toast import.');
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = format === 'retail' ? `toast_retail_import_${dateStr}.csv` : `toast_onboarding_template_${dateStr}.csv`;
    const csv = toCsv(toastTable);
    downloadFile(filename, csv);
    postAnnouncement(`⬇️ Downloaded ${filename} (${toastTable.length - 1} items) ready for Toast POS!`);
  };

  // Preview filtering and summary
  const previewRowsFiltered = previewData?.rows.filter((r) => {
    if (!previewSearch.trim()) return true;
    const q = previewSearch.trim().toLowerCase();
    return r.some((c) => String(c || '').toLowerCase().includes(q));
  }) || [];

  const previewSummary = previewData
    ? computeToastPreviewSummary(previewData.headers, previewRowsFiltered)
    : { totalCount: 0, avgPrice: '0.00' };

  const handleCopyPreviewCsv = async () => {
    if (!previewData?.table) return;
    const csv = toCsv(previewData.table);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(csv);
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  // Gemini AI Assistant Chat & Format Execution
  const handleSendAiPrompt = async (promptToSend?: string) => {
    const prompt = (promptToSend || aiChatInput).trim();
    if (!prompt) return;

    setAiChatMessages((prev) => [...prev, { role: 'user', text: prompt }]);
    setAiChatInput('');
    setIsAiThinking(true);

    const isFormattingIntent = /\b(title\s*case|clean|pack|volume|abbreviation|bottle|size|uppercase|standardize|fix)\b/i.test(prompt);

    try {
      if (isFormattingIntent && records.length > 0) {
        const payload = {
          prompt,
          items: prepareDatasetForAi(records, rows, 150)
        };
        const res = await fetch('/api/ai/format', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to process AI request');

        setAiChatMessages((prev) => [...prev, { role: 'assistant', text: data.message || 'I have analyzed your items.' }]);

        if (data.changes && data.changes.length > 0) {
          setCurrentAiChanges(data.changes);
          setAiDiffSummary(data.summary || `Proposed adjustments for ${data.changes.length} items.`);
        } else {
          setCurrentAiChanges([]);
        }
      } else {
        const readyCount = rows.filter(isApproved).length;
        const context = {
          step: currentStep,
          totalItems: records.length,
          readyItems: readyCount
        };
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: prompt, context })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to reach Gemini assistant');

        setAiChatMessages((prev) => [...prev, { role: 'assistant', text: data.reply || 'I am ready to help you optimize your Toast import.' }]);
      }
    } catch (err: any) {
      setAiChatMessages((prev) => [...prev, { role: 'assistant', text: `⚠️ ${err.message || 'Unable to communicate with Gemini.'}` }]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleApproveAiDiff = () => {
    if (!currentAiChanges.length) return;
    const result = applyAiChanges(records, rows, currentAiChanges);
    setLastAiUndoSnapshot(result.undoSnapshot);
    setCurrentAiChanges([]);
    setAiUndoBanner(`Applied ${result.appliedCount} AI adjustment(s) to inventory.`);
    setAiChatMessages((prev) => [...prev, { role: 'assistant', text: `✅ Approved and applied ${result.appliedCount} adjustment(s) to your dataset.` }]);
    setRecords([...records]);
    rebuildCatalog(records, aliases, refs, true);
  };

  const handleDiscardAiDiff = () => {
    setCurrentAiChanges([]);
    setAiChatMessages((prev) => [...prev, { role: 'assistant', text: 'Proposals discarded without modifying dataset.' }]);
  };

  const handleUndoAiChanges = () => {
    if (!lastAiUndoSnapshot) return;
    const count = revertAiChanges(records, rows, lastAiUndoSnapshot);
    setLastAiUndoSnapshot(null);
    setAiUndoBanner('');
    setAiChatMessages((prev) => [...prev, { role: 'assistant', text: `↩️ Successfully rolled back ${count} AI adjustment(s).` }]);
    setRecords([...records]);
    rebuildCatalog(records, aliases, refs, true);
  };

  // Google Workspace Handlers
  const handleExportToastSheets = async () => {
    try {
      const token = getAccessToken();
      if (!token) throw new Error('Please sign in with Google in the Auth bar above to use Google Workspace features.');
      if (!rows.length) throw new Error('No inventory loaded.');
      setWsStatus('Exporting Toast Retail Catalog to Google Sheets…');
      const toastTable = exportToastRows(rows, { format: 'retail', onlyApproved: false, strictBarcodes: true });
      const dateStr = new Date().toLocaleDateString();
      const title = `Toast Retail Catalog (RETAIL) - ${dateStr}`;
      const res = await exportToGoogleSheets(token, title, toastTable);
      setWsStatus(`Toast Sheet created: ${res.title} (${res.url})`);
    } catch (e: any) {
      setWsStatus(`Workspace error: ${e.message}`);
    }
  };

  const handleSaveToastDrive = async () => {
    try {
      const token = getAccessToken();
      if (!token) throw new Error('Please sign in with Google in the Auth bar above.');
      if (!rows.length) throw new Error('No inventory loaded.');
      setWsStatus('Saving Toast import file to Google Drive…');
      const toastTable = exportToastRows(rows, { format: 'retail', onlyApproved: false, strictBarcodes: true });
      const csvData = toCsv(toastTable);
      const filename = `toast_retail_import_${new Date().toISOString().slice(0, 10)}.csv`;
      const res = await saveFileToGoogleDrive(token, filename, csvData, 'text/csv');
      setWsStatus(`Saved to Drive: ${res.name}`);
    } catch (e: any) {
      setWsStatus(`Workspace error: ${e.message}`);
    }
  };

  const handleCreateDoc = async () => {
    try {
      const token = getAccessToken();
      if (!token) throw new Error('Please sign in with Google in the Auth bar above.');
      if (!rows.length) throw new Error('No inventory loaded.');
      setWsStatus('Generating Google Doc audit report…');
      const s = summarize(rows);
      const problemRows = rows.filter((r) => issues(r).length > 0);
      const res = await createInventoryAuditDoc(token, `Inventory Audit - ${new Date().toLocaleDateString()}`, s, problemRows);
      setWsStatus(`Audit Doc created: ${res.title} (${res.url})`);
    } catch (e: any) {
      setWsStatus(`Workspace error: ${e.message}`);
    }
  };

  const handleExportTasks = async () => {
    try {
      const token = getAccessToken();
      if (!token) throw new Error('Please sign in with Google in the Auth bar above.');
      if (!rows.length) throw new Error('No inventory loaded.');
      const issueRows = rows.filter((r) => issues(r).length > 0);
      if (!issueRows.length) throw new Error('No inventory issues detected! All items are clean.');
      const taskCount = Math.min(issueRows.length, 30);
      setWsStatus(`Creating ${taskCount} shelf audit tasks in Google Tasks…`);
      const res = await exportReviewIssuesToTasks(token, issueRows, 'Inventory Audit');
      setWsStatus(`Created ${res.count} tasks in list "${res.listTitle}"!`);
    } catch (e: any) {
      setWsStatus(`Workspace error: ${e.message}`);
    }
  };

  const diffPreviewItems = currentAiChanges.length > 0 ? computeDiffPreview(rows, currentAiChanges) : [];

  return (
    <main>
      {/* Top App Header */}
      <header className="app-header">
        <div className="app-title-group">
          <h1>
            <span>🍀 Clover → 🍞 Toast</span>
            <span className="app-title-badge">Retail Import Studio</span>
          </h1>
          <p className="note" style={{ margin: 0 }}>
            Transform messy Clover POS spreadsheets into 100% compliant Toast import files using <strong>barcode as the product identity</strong>.
          </p>
        </div>
        <div className="auth-bar">
          <button
            type="button"
            className="btn-ai-assistant"
            onClick={() => setShowCopilot((prev) => !prev)}
          >
            <span>✨ Gemini Copilot</span>
            <span className="ai-badge">Flash 3.8</span>
          </button>
          <span className="status-pill">
            {currentUser ? `Signed in: ${currentUser.email || currentUser.displayName || currentUser.uid}` : 'Not signed in'}
          </span>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={async () => {
              if (currentUser) {
                await signOutUser();
              } else {
                await signInWithGoogle();
              }
            }}
          >
            {currentUser ? 'Sign out' : 'Sign in with Google'}
          </button>
        </div>
      </header>

      {/* 4-Step Guided Wizard Stepper */}
      <nav className="wizard-stepper" aria-label="Toast Import Steps">
        <div
          className={`stepper-step ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}
          onClick={() => setCurrentStep(1)}
          style={{ cursor: 'pointer' }}
        >
          <div className="step-num">1</div>
          <div className="step-label">1. Upload Clover File</div>
        </div>
        <div className={`stepper-line ${currentStep > 1 ? 'completed' : ''}`}></div>
        <div
          className={`stepper-step ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}
          onClick={() => { if (records.length > 0) setCurrentStep(2); }}
          style={{ cursor: records.length > 0 ? 'pointer' : 'not-allowed' }}
        >
          <div className="step-num">2</div>
          <div className="step-label">2. Smart Autopilot Clean</div>
        </div>
        <div className={`stepper-line ${currentStep > 2 ? 'completed' : ''}`}></div>
        <div
          className={`stepper-step ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}
          onClick={() => { if (records.length > 0) setCurrentStep(3); }}
          style={{ cursor: records.length > 0 ? 'pointer' : 'not-allowed' }}
        >
          <div className="step-num">3</div>
          <div className="step-label">3. Confident Review &amp; Tuning</div>
        </div>
        <div className={`stepper-line ${currentStep > 3 ? 'completed' : ''}`}></div>
        <div
          className={`stepper-step ${currentStep === 4 ? 'active' : ''}`}
          onClick={() => { if (records.length > 0) setCurrentStep(4); }}
          style={{ cursor: records.length > 0 ? 'pointer' : 'not-allowed' }}
        >
          <div className="step-num">4</div>
          <div className="step-label">4. Export &amp; Consultant Handoff</div>
        </div>
      </nav>

      {/* Workspace 2-Column Grid */}
      <div className="workspace-layout">
        {/* Left Column: Active Step Stage */}
        <div className="wizard-content-panel">

          {/* STEP 1: Upload Clover File */}
          {currentStep === 1 && (
            <section className="wizard-pane">
              <div className="wizard-pane-header">
                <h2 className="wizard-pane-title">
                  <span>📥 Step 1: Upload Clover Inventory File</span>
                </h2>
                <p className="wizard-pane-desc">
                  Select or drag and drop your exported inventory spreadsheet from Clover POS (supports <code>.xlsx</code> and <code>.csv</code>).
                </p>
              </div>

              <div
                className="dropzone"
                style={{ marginBottom: 16 }}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('dragover');
                  if (e.dataTransfer.files?.[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="dropzone-icon">📁</span>
                <div className="dropzone-title">Drop your Clover inventory file here, or click to browse</div>
                <div className="dropzone-sub">Supports <strong>.xlsx</strong> and <strong>.csv</strong> files exported from Clover POS</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>

              <div className="flex-wrap" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div className="flex-wrap" style={{ alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Read &amp; Load File
                  </button>
                  <button
                    type="button"
                    className="btn-outline btn-sm"
                    onClick={loadSampleData}
                  >
                    ⚡ Load Sample 777 Liquor Store Catalog
                  </button>
                </div>
                <div className="small text-muted">{fileStatusSub}</div>
              </div>

              {/* 13-Digit Barcode Auto-Padding Banner */}
              {paddingAnomalies.length > 0 && (
                <div className="barcode-pad-banner" style={{ display: 'flex', marginBottom: 14 }}>
                  <div className="barcode-pad-info">
                    <span className="barcode-pad-badge">Padding Check</span>
                    <span>
                      Found <strong>{paddingAnomalies.length}</strong> barcode{paddingAnomalies.length === 1 ? '' : 's'} with missing leading zeros (under 13 digits, e.g. stripped by Excel).
                    </span>
                  </div>
                  <div className="flex-wrap" style={{ alignItems: 'center', gap: 8 }}>
                    <button type="button" className="btn-pad-action" onClick={handleAutoPad13}>
                      <span>🔢 Auto-pad all barcodes to 13 digits ({paddingAnomalies.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {paddingSnapshot && paddingAnomalies.length === 0 && (
                <div className="barcode-pad-banner" style={{ display: 'flex', marginBottom: 14 }}>
                  <div className="barcode-pad-info">
                    <span className="barcode-pad-badge">Padding Check</span>
                    <span>All eligible barcodes standardized to <strong>13 digits</strong> (EAN-13 standard).</span>
                  </div>
                  <button type="button" className="btn-secondary btn-sm" onClick={handleUndoPad13}>
                    <span>↩️ Undo Padding</span>
                  </button>
                </div>
              )}

              {/* Step 1 Success Card */}
              {records.length > 0 && (
                <div className="toast-panel" style={{ display: 'block', marginTop: 14, borderColor: '#16a34a', background: '#0f291e' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#86efac', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>✓ Catalog Ready for Cleaning</span>
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 4 }}>
                        Loaded {records.length} items from "{loadedFileName}". Ready for autopilot cleaning.
                      </div>
                    </div>
                    <button type="button" className="btn-toast" onClick={() => setCurrentStep(2)}>
                      <span>Continue to Smart Clean ➔</span>
                    </button>
                  </div>
                </div>
              )}
              {statusText && <p className="note" style={{ marginTop: 10, marginBottom: 0, color: '#fca5a5' }}>{statusText}</p>}
            </section>
          )}

          {/* STEP 2: Smart Autopilot Clean */}
          {currentStep === 2 && (
            <section className="wizard-pane">
              <div className="wizard-pane-header">
                <h2 className="wizard-pane-title">
                  <span>⚡ Step 2: Auto-Clean &amp; Standardize Entire Catalog</span>
                </h2>
                <p className="wizard-pane-desc">
                  Single-click autopilot normalizes brand casing, standardizes packaging (e.g. <code>12PK</code> → <code>12-Pack</code>, <code>750ML</code> → <code>750 mL</code>), and auto-pads barcodes missing leading zeros to standard 13-digit EANs.
                </p>
              </div>

              <div style={{ background: '#1e1b4b', border: '1px solid #4338ca', borderRadius: 10, padding: 20, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: 17, color: '#ffffff' }}>Run Full Autopilot Normalization</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#c7d2fe' }}>
                      Executes industry packaging rules, Title Case brand normalization, and barcode check digit verification across all loaded items.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-auto-process"
                    style={{ padding: '12px 24px', fontSize: 15 }}
                    onClick={handleRunSmartClean}
                  >
                    <span>🚀 1-Click Smart Clean</span>
                  </button>
                </div>
              </div>

              {scorecard && (
                <div>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: 15, color: '#cbd5e1' }}>Autopilot Results Scorecard</h3>
                  <div className="clean-scorecard-grid">
                    <div className="clean-scorecard-item">
                      <span className="clean-scorecard-label">Brands Title-Cased</span>
                      <span className="clean-scorecard-value" style={{ color: '#60a5fa' }}>{scorecard.brandsTitleCased}</span>
                    </div>
                    <div className="clean-scorecard-item">
                      <span className="clean-scorecard-label">Pack Sizes &amp; Volumes</span>
                      <span className="clean-scorecard-value" style={{ color: '#a78bfa' }}>{scorecard.packsNormalized}</span>
                    </div>
                    <div className="clean-scorecard-item">
                      <span className="clean-scorecard-label">13-Digit Barcodes Padded</span>
                      <span className="clean-scorecard-value" style={{ color: '#f59e0b' }}>{scorecard.barcodesPadded}</span>
                    </div>
                    <div className="clean-scorecard-item" style={{ borderColor: '#16a34a' }}>
                      <span className="clean-scorecard-label">100% Toast Ready Items</span>
                      <span className="clean-scorecard-value" style={{ color: '#4ade80' }}>{scorecard.totalToastReady}</span>
                    </div>
                  </div>

                  <div className="flex-wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                    <button type="button" className="btn-secondary" onClick={() => setCurrentStep(1)}>
                      ⬅ Back to Upload
                    </button>
                    <div className="flex-wrap" style={{ gap: 10 }}>
                      <button type="button" className="btn-outline" onClick={() => setCurrentStep(4)}>
                        Skip directly to Toast Export ➔
                      </button>
                      <button type="button" className="btn-toast" onClick={() => setCurrentStep(3)}>
                        Continue to Review &amp; Fine-Tune ➔
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* STEP 3: Confident Review & Fine-Tuning */}
          {currentStep === 3 && (
            <section className="wizard-pane">
              <div className="wizard-pane-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 className="wizard-pane-title">
                      <span>📋 Step 3: Review &amp; Fine-Tune Edits</span>
                    </h2>
                    <p className="wizard-pane-desc">
                      High-certainty edits are verified. Items with ambiguous abbreviations or logic warnings are flagged for your review with 1-click edit, accept, or revert.
                    </p>
                  </div>
                  <span className="status-pill" style={{ fontSize: 12 }}>
                    Showing {filteredStep3Rows.length} of {rows.length} items ({totalFlaggedCount} flagged for review)
                  </span>
                </div>
              </div>

              {/* Step 3 Bulk Actions Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                <div className="flex-wrap" style={{ gap: 8 }}>
                  <button type="button" className="btn-toast btn-sm" onClick={handleApproveHighCertainty}>
                    <span>⚡ Auto-Approve High Certainty</span>
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={handleApproveAllStep3}>
                    <span>✓ Approve All</span>
                  </button>
                  <button type="button" className="btn-outline btn-sm" onClick={handleRevertAllStep3}>
                    <span>↩️ Remove All Edits (Reset)</span>
                  </button>
                </div>

                <div className="flex-wrap" style={{ gap: 10, alignItems: 'center' }}>
                  <label className="small text-muted" style={{ margin: 0 }}>Filter:
                    <select
                      value={step3Filter}
                      onChange={(e) => setStep3Filter(e.target.value as any)}
                      style={{ padding: '4px 8px', fontSize: 12, background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: 4, marginLeft: 6 }}
                    >
                      <option value="flagged">⚠️ Flagged for Review (Uncertain Logic)</option>
                      <option value="all">All Items</option>
                      <option value="modified">Modified Items Only</option>
                      <option value="approved">Approved Items Only</option>
                    </select>
                  </label>
                  <input
                    type="search"
                    placeholder="Search name or barcode…"
                    value={step3Search}
                    onChange={(e) => setStep3Search(e.target.value)}
                    style={{ padding: '4px 10px', fontSize: 12, background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: 4, width: 180 }}
                  />
                </div>
              </div>

              {/* Interactive Review Table Container */}
              <div className="review-table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                      <th style={{ padding: '10px 12px', width: 160 }}>Certainty &amp; Status</th>
                      <th style={{ padding: '10px 12px', minWidth: 240 }}>Item Name (Current / Proposed)</th>
                      <th style={{ padding: '10px 12px', width: 160 }}>Category</th>
                      <th style={{ padding: '10px 12px', width: 150 }}>Barcode (SKU)</th>
                      <th style={{ padding: '10px 12px', width: 90 }}>Price</th>
                      <th style={{ padding: '10px 12px', width: 140, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStep3Rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                          {step3Filter === 'flagged' ? (
                            <>🎉 <strong>No items need review!</strong> All catalog items passed certainty checks. Click "Proceed to Final Toast Export" below.</>
                          ) : (
                            'No items match your filter criteria.'
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredStep3Rows.map(({ row, cert }) => (
                        <tr
                          key={row.id}
                          style={{
                            borderBottom: '1px solid #334155',
                            background: cert.flagged ? '#2a1a1a' : 'transparent'
                          }}
                        >
                          {/* Certainty & Status */}
                          <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                            <span className={cert.flagged ? 'certainty-badge-review' : 'certainty-badge-high'}>
                              {cert.flagged ? '⚠️ Review Needed' : '✓ High Certainty'}
                            </span>
                            {cert.flagged && cert.reasons?.length > 0 && (
                              <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 4 }}>
                                {cert.reasons.join('; ')}
                              </div>
                            )}
                            {isApproved(row) && (
                              <span className="status-pill" style={{ fontSize: 10, padding: '2px 6px', marginTop: 4, display: 'inline-block' }}>
                                Toast Approved
                              </span>
                            )}
                          </td>

                          {/* Item Name */}
                          <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                            {row.original_name && row.original_name !== row.current_name && (
                              <div className="small text-muted">Orig: {row.original_name}</div>
                            )}
                            <input
                              type="text"
                              className="row-edit-input"
                              value={row.current_name || ''}
                              onChange={(e) => handleUpdateRow(row.id, 'current_name', e.target.value)}
                              title="Edit item name"
                            />
                            {row.proposed_name && row.proposed_name !== row.current_name && (
                              <div className="small ok" style={{ marginTop: 2 }}>
                                Auto proposal: {row.proposed_name}
                              </div>
                            )}
                          </td>

                          {/* Category */}
                          <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                            <input
                              type="text"
                              className="row-edit-input"
                              value={row.category || ''}
                              onChange={(e) => handleUpdateRow(row.id, 'category', e.target.value)}
                              title="Edit category"
                            />
                          </td>

                          {/* Barcode (SKU) */}
                          <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                            <input
                              type="text"
                              className="row-edit-input"
                              value={row.barcode?.original || ''}
                              onChange={(e) => handleUpdateRow(row.id, 'barcode', e.target.value)}
                              title="Edit barcode"
                            />
                            {row.barcode?.type && (
                              <div className="small text-muted" style={{ marginTop: 2 }}>
                                Type: {row.barcode.type}
                              </div>
                            )}
                          </td>

                          {/* Price */}
                          <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                            <span className="toast-preview-price">
                              ${formatToastPrice(row.price) || '0.00'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '10px 12px', verticalAlign: 'top', textAlign: 'right' }}>
                            <div className="flex-wrap" style={{ justifyContent: 'flex-end', gap: 6 }}>
                              <button
                                type="button"
                                className="btn-toast btn-sm"
                                onClick={() => handleAcceptRow(row.id)}
                              >
                                ✓ Accept
                              </button>
                              <button
                                type="button"
                                className="btn-outline btn-sm"
                                onClick={() => handleRevertRow(row.id)}
                              >
                                ↩️ Revert
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
                <button type="button" className="btn-secondary" onClick={() => setCurrentStep(2)}>
                  ⬅ Back to Smart Clean
                </button>
                <div className="flex-wrap" style={{ gap: 10 }}>
                  <button type="button" className="btn-toast" onClick={() => setCurrentStep(4)}>
                    Proceed to Final Toast Export ➔
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STEP 4: Export & Toast Consultant Handoff */}
          {currentStep === 4 && (
            <section className="wizard-pane">
              <div className="wizard-pane-header">
                <h2 className="wizard-pane-title">
                  <span>🍞 Step 4: Export Cleaned Catalog for Toast POS</span>
                </h2>
                <p className="wizard-pane-desc">
                  Download your validated catalog formatted for Toast POS, with barcode mapped as SKU and Barcode product identity.
                </p>
              </div>

              {/* Dual Export Cards */}
              <div className="export-cards-grid">
                {/* Card 1: Direct Toast Retail CSV */}
                <div className="export-card featured">
                  <div>
                    <h3 className="export-card-title">
                      <span>🍞 Toast Retail Web Import</span>
                      <span className="app-title-badge">Direct Upload</span>
                    </h3>
                    <p className="export-card-desc">
                      Standard Toast POS Retail Catalog format. Ready for direct self-service upload inside Toast Web under <strong>Menus &gt; Retail Items &gt; Bulk Import</strong>.
                    </p>
                  </div>
                  <div className="flex-wrap" style={{ gap: 8 }}>
                    <button type="button" className="btn-outline btn-sm" onClick={() => openToastPreview('retail')}>
                      👁️ Preview CSV
                    </button>
                    <button type="button" className="btn-toast" onClick={() => handleDownloadCsv('retail')}>
                      ⬇️ Download Toast Retail CSV
                    </button>
                  </div>
                </div>

                {/* Card 2: Toast Onboarding Consultant Template */}
                <div className="export-card">
                  <div>
                    <h3 className="export-card-title">
                      <span>📋 Toast Onboarding Template</span>
                      <span className="status-pill" style={{ fontSize: 10, padding: '2px 8px' }}>Consultant Format</span>
                    </h3>
                    <p className="export-card-desc">
                      Formatted specifically for handoff to your assigned <strong>Toast Onboarding Consultant</strong> matching the official <code>777_-_Retail_Template</code> specification.
                    </p>
                  </div>
                  <div className="flex-wrap" style={{ gap: 8 }}>
                    <button type="button" className="btn-outline btn-sm" onClick={() => openToastPreview('onboarding')}>
                      👁️ Preview Template
                    </button>
                    <button type="button" className="btn-toast" style={{ background: '#2563eb' }} onClick={() => handleDownloadCsv('onboarding')}>
                      ⬇️ Download Consultant Template
                    </button>
                  </div>
                </div>
              </div>

              {/* Embedded Toast Consultant Guidance Card */}
              <div className="toast-consultant-card">
                <div className="consultant-card-header">
                  <span>📋 Toast Retail Onboarding Guide &amp; Handoff Instructions</span>
                </div>
                <p className="note" style={{ margin: '0 0 10px 0', color: '#93c5fd' }}>
                  Reference from the official Toast Retail Template: This template is used to gather your retail catalog before it is imported by the Toast Onboarding team into your Toast Web account.
                </p>
                <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: 13, marginBottom: 6 }}>
                  What comes next? (3-Step Consultant Handoff):
                </div>
                <ol className="consultant-steps-list">
                  <li>Download your completed template file above (or save to Google Drive / Sheets).</li>
                  <li>In Google Sheets or Drive, update the link sharing permissions to: <strong style={{ color: '#86efac' }}>"Anyone with the link can edit"</strong>.</li>
                  <li>Email the link directly to your assigned <strong>Toast Onboarding Consultant</strong>.</li>
                  <li>Once imported by the Toast team, you can continue making menu and item edits anytime at <strong style={{ color: '#f97316' }}>Toasttab.com</strong>!</li>
                </ol>
              </div>

              <div className="flex-wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                <button type="button" className="btn-secondary" onClick={() => setCurrentStep(3)}>
                  ⬅ Back to Review
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    setCurrentStep(1);
                  }}
                >
                  🔄 Upload Another File
                </button>
              </div>

              {/* Collapsible Advanced Integrations */}
              <div style={{ marginTop: 24 }}>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#94a3b8', fontSize: 13 }}>
                    <span>⚙️ Advanced Integrations (Google Workspace, Cloud Sync, Diagnostic Audits)</span>
                  </summary>
                  <div style={{ marginTop: 14, background: '#0b0f19', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#cbd5e1', fontSize: 14 }}>Google Workspace Direct Sync</h4>
                    <div className="flex-wrap" style={{ gap: 8, marginBottom: 12 }}>
                      <button type="button" className="btn-toast btn-sm" onClick={handleExportToastSheets}>Export to Google Sheets</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={handleSaveToastDrive}>Save to Google Drive</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={handleCreateDoc}>Generate Audit Doc</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={handleExportTasks}>Create Audit Tasks</button>
                    </div>
                    {wsStatus && <p className="note" style={{ margin: 0, color: '#818cf8' }}>{wsStatus}</p>}
                  </div>
                </details>
              </div>
            </section>
          )}

        </div>

        {/* Right Column: Gemini AI Copilot Companion */}
        {showCopilot && (
          <aside className="ai-companion-card" aria-label="Gemini AI Inventory Copilot">
            <div className="ai-companion-header">
              <div className="ai-companion-title">
                <span>✨ Gemini AI Copilot</span>
                <span className="ai-badge" style={{ background: '#4338ca' }}>Flash 3.8</span>
              </div>
              <div className="status-pill" style={{ fontSize: 11, padding: '2px 8px' }}>
                <span>Active</span>
              </div>
            </div>

            {/* Live Chat Stream with Automated Announcements */}
            <div ref={chatStreamRef} className="ai-chat-stream">
              {aiChatMessages.map((msg, idx) => (
                msg.role === 'announcement' ? (
                  <div key={idx} className="ai-announcement">
                    <strong>📢 Progress Update:</strong> {msg.text}
                  </div>
                ) : (
                  <div key={idx} className={`ai-msg ${msg.role === 'user' ? 'ai-msg-user' : 'ai-msg-assistant'}`}>
                    <div style={{ fontWeight: 700, marginBottom: 4, color: msg.role === 'user' ? '#93c5fd' : '#a5b4fc' }}>
                      {msg.role === 'user' ? '👤 You' : '🤖 Gemini Copilot'}
                    </div>
                    <div>{msg.text}</div>
                  </div>
                )
              ))}
            </div>

            {/* Diff Comparison Section */}
            {currentAiChanges.length > 0 && (
              <div className="ai-diff-card" style={{ display: 'block', margin: 10, padding: 12, background: '#0f172a', border: '1px solid #4338ca', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ color: '#c7d2fe', fontSize: 13 }}>Proposed AI Dataset Adjustments</strong>
                  <span className="status-pill" style={{ fontSize: 11 }}>{currentAiChanges.length} items</span>
                </div>
                {aiDiffSummary && <div className="small text-muted" style={{ marginBottom: 8 }}>{aiDiffSummary}</div>}
                <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #334155', borderRadius: 6, marginBottom: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#1e293b', color: '#94a3b8' }}>
                        <th style={{ padding: '6px 8px' }}>Item</th>
                        <th style={{ padding: '6px 8px' }}>Field</th>
                        <th style={{ padding: '6px 8px' }}>Proposed Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffPreviewItems.map((diff, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '6px 8px' }}><strong>{diff.itemName}</strong></td>
                          <td style={{ padding: '6px 8px' }}>{diff.field}</td>
                          <td style={{ padding: '6px 8px', color: '#86efac' }}>{diff.proposedValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex-wrap" style={{ gap: 8 }}>
                  <button type="button" className="btn-toast btn-sm" onClick={handleApproveAiDiff}>
                    ✓ Approve &amp; Apply
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={handleDiscardAiDiff}>
                    ✕ Discard
                  </button>
                </div>
              </div>
            )}

            {/* AI Undo Banner */}
            {aiUndoBanner && (
              <div style={{ margin: '8px 10px', padding: '8px 12px', background: '#0f291e', border: '1px solid #16a34a', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#86efac' }}>{aiUndoBanner}</span>
                <button type="button" className="btn-secondary btn-sm" onClick={handleUndoAiChanges}>
                  ↩️ Undo Changes
                </button>
              </div>
            )}

            {/* Copilot Footer & Interactive Input */}
            <div className="ai-companion-footer">
              <div className="ai-quick-chips">
                <button
                  type="button"
                  className="ai-chip-pill"
                  onClick={() => handleSendAiPrompt('Title-case all brand names across the catalog')}
                >
                  Title Case Brands
                </button>
                <button
                  type="button"
                  className="ai-chip-pill"
                  onClick={() => handleSendAiPrompt('Standardize bottle sizes (e.g. 750ml, 1.75L) in item names')}
                >
                  Normalize Volumes
                </button>
                <button
                  type="button"
                  className="ai-chip-pill"
                  onClick={() => handleSendAiPrompt("Convert '6PK' and '12PK' to clean '6-Pack' and '12-Pack'")}
                >
                  Standardize Packs
                </button>
                <button
                  type="button"
                  className="ai-chip-pill"
                  onClick={() => handleSendAiPrompt("What should I do next to prepare my Toast import?")}
                >
                  What's Next?
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  className="ai-textarea"
                  rows={2}
                  placeholder="Ask Gemini to format, title-case, or guide you..."
                  value={aiChatInput}
                  onChange={(e) => setAiChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendAiPrompt();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-ai-send"
                  disabled={isAiThinking}
                  onClick={() => handleSendAiPrompt()}
                >
                  <span>{isAiThinking ? '...' : 'Send'}</span>
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Toast CSV Preview Modal */}
      {previewModalOpen && previewData && (
        <div className="modal-overlay" style={{ display: 'flex' }} role="dialog" aria-modal="true">
          <div className="modal-box modal-box-large">
            <div className="modal-header-row">
              <div>
                <h2 className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>🍞 Toast POS Import Preview</span>
                  <span className="app-title-badge">
                    {previewData.format === 'onboarding' ? 'Consultant Template' : 'Retail Catalog'}
                  </span>
                </h2>
                <p className="small text-muted" style={{ margin: '4px 0 0 0' }}>
                  Filename: <strong style={{ color: '#fdba74' }}>{previewData.filename}</strong> • Ready rows: <strong className="ok">{previewData.rows.length}</strong>
                </p>
              </div>
              <button
                type="button"
                className="ai-drawer-close"
                onClick={() => setPreviewModalOpen(false)}
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>

            <div className="toast-preview-toolbar">
              <input
                type="search"
                placeholder="Filter preview rows (item name, barcode, SKU, category)…"
                className="toast-preview-search"
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
              />
              <div className="status-pill" style={{ fontSize: 11 }}>
                <span>Identity: <strong>Barcode mapped as SKU &amp; Barcode</strong></span>
              </div>
            </div>

            <div className="toast-preview-scroll">
              <table className="toast-preview-table">
                <thead>
                  <tr>
                    {previewData.headers.map((col, idx) => (
                      <th key={idx}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRowsFiltered.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {row.map((cellVal, colIdx) => {
                        const headerName = previewData.headers[colIdx] || '';
                        if (headerName === 'SKU' || headerName === 'Barcode') {
                          return (
                            <td key={colIdx}>
                              <span className="toast-preview-code">{cellVal || '(empty)'}</span>
                            </td>
                          );
                        }
                        if (headerName === 'Price' || headerName === 'Cost') {
                          return (
                            <td key={colIdx}>
                              <span className="toast-preview-price">{cellVal ? `$${cellVal}` : ''}</span>
                            </td>
                          );
                        }
                        return <td key={colIdx}>{cellVal}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="toast-preview-summary-row">
                    {previewData.headers.map((h, colIdx) => {
                      const nameColIdx = previewData.headers.findIndex((c) => String(c).trim().toLowerCase() === 'name');
                      const priceColIdx = previewData.headers.findIndex((c) => String(c).trim().toLowerCase() === 'price');
                      if (colIdx === nameColIdx || (nameColIdx === -1 && colIdx === 0)) {
                        return <td key={colIdx}><strong>Total Items: {previewSummary.totalCount}</strong></td>;
                      }
                      if (colIdx === 0 && nameColIdx > 0) {
                        return <td key={colIdx}><strong>Summary</strong></td>;
                      }
                      if (colIdx === priceColIdx) {
                        return <td key={colIdx}><strong>Avg Price: <span className="toast-preview-price">${previewSummary.avgPrice}</span></strong></td>;
                      }
                      return <td key={colIdx}></td>;
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="modal-actions" style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <span className="small text-muted">
                {previewSearch
                  ? `Showing ${previewRowsFiltered.length} of ${previewData.rows.length} items (Avg Price: $${previewSummary.avgPrice})`
                  : `Showing all ${previewData.rows.length} items • Avg Price: $${previewSummary.avgPrice}`}
              </span>
              <div className="flex-wrap" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={handleCopyPreviewCsv}
                >
                  <span>{copySuccess ? '✓ Copied!' : '📋 Copy CSV'}</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setPreviewModalOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-toast"
                  onClick={() => {
                    const csv = toCsv(previewData.table);
                    downloadFile(previewData.filename, csv);
                    setPreviewModalOpen(false);
                    postAnnouncement(`Downloaded ${previewData.filename} (${previewData.rows.length} items).`);
                  }}
                >
                  <span>⬇️ Confirm &amp; Download File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
