import { toCsv } from './src/csv.js';
import { parseInventoryFile } from './src/xlsx.js';
import { parseReferenceCsv, buildReferenceIndex, referenceTemplateCsv } from './src/reference.js';
import { buildRows, setDecision, issues, approvedRows, acceptCleanBarcodes, summarize, exportHeader, exportRows, applyOffSuggestions, saveSession, loadSession, isApproved } from './src/review.js';
import { runOffQueue } from './src/off.js';
import {
  exportToastRows,
  summarizeToastReadiness,
  validateToastRow,
  getBarcodeIdentity,
  TOAST_RETAIL_HEADERS,
  TOAST_MENU_HEADERS
} from './src/toast.js';
import {
  signInWithGoogle,
  signOutUser,
  onAuthChange,
  saveCloudSession,
  listCloudSessions,
  loadCloudSession,
  deleteCloudSession,
  getAccessToken,
} from './src/firebase.js';
import {
  scanInventoryForSpellingSuggestions,
  SPELLCHECK_PRESETS,
  parseAliasText,
} from './src/spellcheck.js';
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
} from './src/workspace.js';
import { parseCsv } from './src/csv.js';
import {
  isPaddingAnomaly,
  padTo13,
  findPaddingAnomalies,
  autoPadBarcodes13
} from './src/barcode.js';
import {
  prepareDatasetForAi,
  computeDiffPreview,
  applyAiChanges,
  revertAiChanges
} from './src/ai_assistant.js';

const $ = (id) => (typeof document !== 'undefined' && document.getElementById ? document.getElementById(id) : null);
const bindClick = (id, fn) => {
  const el = $(id);
  if (el) el.onclick = fn;
};
const bindChange = (id, fn) => {
  const el = $(id);
  if (el) el.onchange = fn;
};
const setText = (id, txt) => {
  const el = $(id);
  if (el) el.textContent = txt;
};
const setDisplay = (idOrEl, val) => {
  const el = typeof idOrEl === 'string' ? $(idOrEl) : idOrEl;
  if (el && el.style) el.style.display = val;
};
const S = {
  records: [],
  canonical: [],
  refs: [],
  rows: [],
  aliases: [],
  page: 1,
  size: 25,
  filter: 'all',
  offCache: new Map(),
  abort: null,
  paddingSnapshot: null,
  currentAiChanges: [],
  lastAiUndoSnapshot: null
};

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);

function parseAliases() {
  return parseAliasText($('aliases')?.value || '');
}

function syncAliasesToTextarea() {
  const el = $('aliases');
  if (!el) return;
  el.value = S.aliases
    .filter((a) => a.approved)
    .map((a) => `${a.from}=>${a.to}${a.reason ? ' # ' + a.reason : ''}`)
    .join('\n');
}

let currentSuggestions = [];

function renderActiveRules() {
  const list = $('activeRulesList');
  if (!list) return;
  list.replaceChildren();
  const countEl = $('ruleCount');
  const activeCount = S.aliases.filter((a) => a.approved).length;
  if (countEl) countEl.textContent = activeCount;

  if (!S.aliases.length) {
    const empty = document.createElement('div');
    empty.className = 'text-muted';
    if (empty.style) empty.style.padding = '8px';
    empty.textContent = 'No spelling rules added yet. Add one above, choose a preset, or scan inventory.';
    list.append(empty);
    return;
  }

  S.aliases.forEach((rule, idx) => {
    const item = document.createElement('div');
    item.className = 'spell-item';

    const info = document.createElement('div');
    const title = document.createElement('div');
    title.innerHTML = `<strong>${escapeHtml(rule.from)}</strong> → <span class="ok">${escapeHtml(rule.to)}</span>`;
    info.append(title);
    if (rule.reason) {
      const desc = document.createElement('div');
      desc.className = 'small';
      desc.textContent = rule.reason;
      info.append(desc);
    }

    const actions = document.createElement('div');
    actions.className = 'flex-wrap';

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = !!rule.approved;
    toggle.title = rule.approved ? 'Rule active (click to disable)' : 'Rule disabled (click to enable)';
    toggle.onchange = () => {
      rule.approved = toggle.checked;
      syncAliasesToTextarea();
      rebuild();
      renderActiveRules();
    };

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn-del';
    del.textContent = '✕';
    del.title = 'Remove rule';
    del.onclick = () => {
      S.aliases.splice(idx, 1);
      syncAliasesToTextarea();
      rebuild();
      renderActiveRules();
    };

    actions.append(toggle, del);
    item.append(info, actions);
    list.append(item);
  });
}

function renderSuggestions() {
  const container = $('spellSuggestionsContainer');
  const list = $('suggestionsList');
  const header = $('suggestionsHeader');
  if (!container || !list) return;

  if (!currentSuggestions.length) {
    if (container.style) container.style.display = 'none';
    return;
  }

  if (container.style) container.style.display = 'block';
  if (header) {
    header.textContent = `Detected ${currentSuggestions.length} spelling & abbreviation opportunity${currentSuggestions.length === 1 ? '' : 'ies'}`;
  }

  list.replaceChildren();
  currentSuggestions.forEach((sugg, idx) => {
    const item = document.createElement('div');
    item.className = 'spell-item';

    const info = document.createElement('div');
    const badgeCls = sugg.confidence === 'high' ? 'badge-high' : 'badge-med';
    const badgeText = sugg.confidence === 'high' ? 'High confidence' : 'Medium confidence';

    const row = document.createElement('div');
    row.innerHTML = `<span class="${badgeCls}">${badgeText}</span> <strong>${escapeHtml(sugg.from)}</strong> → <span class="ok">${escapeHtml(sugg.to)}</span>`;

    const sub = document.createElement('div');
    sub.className = 'small';
    const exText = sugg.examples?.length ? ` (e.g. "${sugg.examples[0]}")` : '';
    sub.textContent = `${sugg.reason} • Found in ${sugg.frequency} item${sugg.frequency === 1 ? '' : 's'}${exText}`;

    info.append(row, sub);

    const approveBtn = document.createElement('button');
    approveBtn.type = 'button';
    approveBtn.className = 'btn-sm';
    approveBtn.textContent = '+ Approve';
    approveBtn.onclick = () => {
      addApprovedRule(sugg.from, sugg.to, sugg.reason);
      currentSuggestions.splice(idx, 1);
      renderSuggestions();
    };

    item.append(info, approveBtn);
    list.append(item);
  });
}

function addApprovedRule(from, to, reason = 'User approved spelling') {
  if (!from || !to) return;
  const fromClean = from.trim();
  const toClean = to.trim();
  const existing = S.aliases.find((a) => a.from.toUpperCase() === fromClean.toUpperCase());
  if (existing) {
    existing.to = toClean;
    existing.reason = reason;
    existing.approved = true;
  } else {
    S.aliases.push({ from: fromClean, to: toClean, reason, approved: true });
  }
  syncAliasesToTextarea();
  renderActiveRules();
  rebuild();
  const st = $('aliasStatus');
  if (st) st.textContent = `Rule "${fromClean} → ${toClean}" active and applied.`;
}
function rebuild(keepDecisions = true) {
  const old = keepDecisions ? saveSession(S.rows) : null;
  S.rows = buildRows(S.records, { index: buildReferenceIndex(S.refs), canonical: S.canonical, aliases: S.aliases });
  if (old) loadSession(S.rows, old);
  applyOffSuggestions(S.rows);
  render();
}
function filtered() {
  const f = S.filter;
  const q = ($('tableSearch')?.value || '').trim().toLowerCase();
  return S.rows.filter((r) => {
    const matchesFilter = f === 'all' || (f === 'issues' && issues(r).length) || (f === 'contradiction' && ['contradiction', 'conflicting-references'].includes(r.reference.status)) || (f === 'duplicate' && r.duplicate) || (f === 'barcode' && r.barcode.review) || (f === 'pending' && !isApproved(r)) || (f === 'approved' && isApproved(r));
    if (!matchesFilter) return false;
    if (!q) return true;
    const name = (r.current_name || '').toLowerCase();
    const orig = (r.original_name || '').toLowerCase();
    const prop = (r.proposed_name || '').toLowerCase();
    const bc = (r.barcode?.original || '').toLowerCase();
    const digits = (r.barcode?.digits || '').toLowerCase();
    return name.includes(q) || orig.includes(q) || prop.includes(q) || bc.includes(q) || digits.includes(q);
  });
}

export function autoApproveSafeProposals(rows) {
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
function cell(tr, text, cls) { const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; tr.append(td); return td; }
function decision(tr, row, field, enabled) {
  const td = document.createElement('td'); const sel = document.createElement('select'); sel.setAttribute('aria-label', `${field} decision for ${row.id}`);
  for (const v of ['pending', 'accept', 'reject']) { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.append(o); }
  sel.value = row.decisions[field]; sel.disabled = !enabled;
  sel.addEventListener('change', () => { setDecision(S.rows, row.id, field, sel.value); updateSummary(); });
  td.append(sel); tr.append(td);
}
function updateToastStats() {
  if (!S.rows.length) {
    if ($('toastReadyCount')) $('toastReadyCount').textContent = '0';
    if ($('toastPendingCount')) $('toastPendingCount').textContent = '0';
    if ($('toastMissingBarcodeCount')) $('toastMissingBarcodeCount').textContent = '0';
    if ($('toastDuplicateBarcodeCount')) $('toastDuplicateBarcodeCount').textContent = '0';
    if ($('toastOverallBadge')) {
      $('toastOverallBadge').className = 'toast-badge-warn';
      $('toastOverallBadge').textContent = '0 ready for Toast';
    }
    return;
  }
  const t = summarizeToastReadiness(S.rows);
  if ($('toastReadyCount')) $('toastReadyCount').textContent = String(t.readyApproved);
  if ($('toastPendingCount')) $('toastPendingCount').textContent = String(t.pendingDecisions);
  if ($('toastMissingBarcodeCount')) $('toastMissingBarcodeCount').textContent = String(t.missingBarcode);
  if ($('toastDuplicateBarcodeCount')) $('toastDuplicateBarcodeCount').textContent = String(t.duplicateBarcode);
  if ($('toastOverallBadge')) {
    if (t.readyApproved > 0 && t.readyApproved === t.total) {
      $('toastOverallBadge').className = 'toast-badge-ready';
      $('toastOverallBadge').textContent = `All ${t.readyApproved} items ready for Toast!`;
    } else if (t.readyApproved > 0) {
      $('toastOverallBadge').className = 'toast-badge-ready';
      $('toastOverallBadge').textContent = `${t.readyApproved} of ${t.total} ready for Toast`;
    } else {
      $('toastOverallBadge').className = 'toast-badge-bad';
      $('toastOverallBadge').textContent = `0 of ${t.total} ready (requires barcode & approval)`;
    }
  }
}

function updateBarcodePaddingUI() {
  const banner = $('barcodePaddingBanner');
  if (!banner) return;
  if (!S.records || !S.records.length) {
    setDisplay(banner, 'none');
    return;
  }
  const anomalies = findPaddingAnomalies(S.records);
  const statusEl = $('barcodePadStatusText');
  const undoBtn = $('btnUndoPad13');
  const padBtn = $('btnAutoPad13');
  const reviewPadBtn = $('btnAutoPadReview');

  if (anomalies.length > 0) {
    setDisplay(banner, 'flex');
    if (statusEl) {
      statusEl.innerHTML = `Found <strong>${anomalies.length}</strong> barcode${anomalies.length === 1 ? '' : 's'} with missing leading zeros (under 13 digits, e.g. stripped by Excel).`;
    }
    if (padBtn) {
      setDisplay(padBtn, 'inline-flex');
      padBtn.innerHTML = `<span>🔢 Auto-pad all barcodes to 13 digits (${anomalies.length})</span>`;
    }
    if (reviewPadBtn) {
      reviewPadBtn.textContent = `🔢 Auto-pad all barcodes to 13 digits (${anomalies.length})`;
      reviewPadBtn.disabled = false;
    }
    setDisplay(undoBtn, S.paddingSnapshot ? 'inline-flex' : 'none');
  } else if (S.paddingSnapshot) {
    setDisplay(banner, 'flex');
    if (statusEl) {
      statusEl.innerHTML = `<span>All eligible barcodes standardized to <strong>13 digits</strong> (EAN-13 standard).</span>`;
    }
    setDisplay(padBtn, 'none');
    if (reviewPadBtn) {
      reviewPadBtn.textContent = `All barcodes 13 digits`;
      reviewPadBtn.disabled = true;
    }
    setDisplay(undoBtn, 'inline-flex');
  } else {
    setDisplay(banner, 'none');
    if (reviewPadBtn) {
      reviewPadBtn.textContent = `All barcodes 13 digits`;
      reviewPadBtn.disabled = true;
    }
    setDisplay(undoBtn, 'none');
  }
}

function updateSummary() {
  if (!S.rows.length) return;
  const s = summarize(S.rows);
  setText('status', `${s.total} items | ${s.approved} fully approved | ${s.needsReview} need review | ${s.contradictions} reference contradictions | ${s.duplicates} duplicate barcodes | ${s.invalidBarcodes} missing/invalid barcodes`);
  updateToastStats();
  updateBarcodePaddingUI();
  setText('tabReviewCount', String(s.total));
  setText('tabRuleCount', `${S.aliases.filter((a) => a.approved).length} rules`);
  const t = summarizeToastReadiness(S.rows);
  setText('tabToastCount', t.readyApproved > 0 ? `${t.readyApproved} ready` : 'Ready');
  if ($('toastOverallBadge')) {
    $('toastOverallBadge').className = t.readyApproved > 0 ? 'toast-badge-ready' : 'toast-badge-warn';
    $('toastOverallBadge').textContent = `${t.readyApproved} ready for Toast`;
  }
}
function render() {
  const rows = filtered(); const pages = Math.max(1, Math.ceil(rows.length / S.size)); S.page = Math.min(S.page, pages);
  const body = $('rows');
  if (body) {
    body.replaceChildren();
    for (const r of rows.slice((S.page - 1) * S.size, S.page * S.size)) {
      const tr = document.createElement('tr');
      cell(tr, r.original_name);
      cell(tr, r.proposed_name ? `${r.current_name} → ${r.proposed_name}` : r.current_name).append(Object.assign(document.createElement('div'), { className: 'small', textContent: r.name_source }));
      cell(tr, `${r.barcode.original || '(none)'}${r.barcode.canonicalKey ? ' [' + r.barcode.type + ']' : ''}`, r.barcode.review ? 'bad' : 'ok').append(Object.assign(document.createElement('div'), { className: 'small', textContent: r.barcode.reason }));
      cell(tr, r.proposed_category ? `${r.category || '(none)'} → ${r.proposed_category}` : r.category || '(none)');
      const iss = issues(r);
      cell(tr, `${r.reference.status}${r.reference.candidateNames?.length ? ' (' + r.reference.candidateNames.join(' | ') + ')' : ''}${iss.length ? ' — ' + iss.join('; ') : ''}`, iss.length ? 'bad' : '');
      decision(tr, r, 'name', !!r.proposed_name); decision(tr, r, 'barcode', true); decision(tr, r, 'category', !!r.proposed_category);
      body.append(tr);
    }
  }
  setText('page', ` Page ${S.page} of ${pages} (${rows.length} rows) `);
  const prevBtn = $('prev'); if (prevBtn) prevBtn.disabled = S.page <= 1;
  const nextBtn = $('next'); if (nextBtn) nextBtn.disabled = S.page >= pages;
  updateSummary();
}
function download(name, text, type = 'text/csv;charset=utf-8') { const a = document.createElement('a'); const u = URL.createObjectURL(new Blob([text], { type })); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
const fail = (el, e) => { const elem = $(el); if (elem) elem.textContent = e.message || String(e); };

bindClick('load', async () => {
  try {
    const f = $('file')?.files?.[0];
    if (!f) throw new Error('Choose a Clover .xlsx or .csv file');
    setText('status', 'Reading…');
    const p = await parseInventoryFile(f);
    S.records = p.records;
    S.canonical = p.canonical;
    S.page = 1;
    rebuild(false);
    // Intelligent scan for inventory spelling and abbreviation improvements
    currentSuggestions = scanInventoryForSpellingSuggestions(S.records, S.aliases);
    renderSuggestions();
    if (currentSuggestions.length > 0 && $('aliasStatus')) {
      $('aliasStatus').textContent = `Loaded ${S.records.length} items. Found ${currentSuggestions.length} spelling/abbreviation opportunity(ies) in Step 2.`;
    }
  } catch (e) {
    fail('status', e);
  }
});

bindClick('loadRef', async () => {
  try {
    const f = $('refFile')?.files?.[0];
    if (!f) throw new Error('Choose a reference CSV');
    S.refs = parseReferenceCsv(await f.text());
    rebuild();
    const st = $('status');
    if (st) st.textContent += ` | ${S.refs.length} reference rows loaded`;
  } catch (e) {
    fail('status', e);
  }
});

const onDownloadTemplate = () => download('reference_template.csv', referenceTemplateCsv());
bindClick('tpl', onDownloadTemplate);
bindClick('refTemplate', onDownloadTemplate);

const onApplyAliases = () => {
  S.aliases = parseAliases();
  syncAliasesToTextarea();
  renderActiveRules();
  rebuild();
  const activeCount = S.aliases.filter((a) => a.approved).length;
  if ($('aliasStatus')) $('aliasStatus').textContent = `${activeCount} approved spelling rule(s) applied to inventory.`;
};
bindClick('applyAliases', onApplyAliases);
bindClick('syncFromTextarea', onApplyAliases);

// Spellcheck & Word Naturalization Controls
const onScanSpellings = () => {
  if (!S.records || !S.records.length) {
    setText('aliasStatus', 'Load an inventory file in Step 1 first to scan for typos and abbreviations.');
    return;
  }
  currentSuggestions = scanInventoryForSpellingSuggestions(S.records, S.aliases);
  renderSuggestions();
  if (!currentSuggestions.length) {
    setText('aliasStatus', 'No additional typos or known abbreviations detected in loaded items.');
  } else {
    setText('aliasStatus', `Scan complete: ${currentSuggestions.length} opportunity(ies) identified with reasoning.`);
  }
};
bindClick('scanSpellings', onScanSpellings);
bindClick('scanSpellingBtn', onScanSpellings);

const onApproveHighConfidence = () => {
  const high = currentSuggestions.filter((s) => s.confidence === 'high');
  if (!high.length) {
    setText('aliasStatus', 'No high-confidence suggestions remaining.');
    return;
  }
  for (const h of high) {
    const existing = S.aliases.find((a) => a.from.toUpperCase() === h.from.toUpperCase());
    if (existing) {
      existing.to = h.to;
      existing.reason = h.reason;
      existing.approved = true;
    } else {
      S.aliases.push({ from: h.from, to: h.to, reason: h.reason, approved: true });
    }
  }
  currentSuggestions = currentSuggestions.filter((s) => s.confidence !== 'high');
  syncAliasesToTextarea();
  renderActiveRules();
  renderSuggestions();
  rebuild();
  setText('aliasStatus', `Approved and applied ${high.length} high-confidence spelling rule(s)!`);
};
bindClick('approveAllHigh', onApproveHighConfidence);
bindClick('approveAllSuggestionsBtn', onApproveHighConfidence);

const onDismissSuggestions = () => {
  currentSuggestions = [];
  renderSuggestions();
};
bindClick('dismissSuggestions', onDismissSuggestions);
bindClick('dismissSuggestionsBtn', onDismissSuggestions);

function loadPreset(presetKey) {
  const preset = SPELLCHECK_PRESETS[presetKey];
  if (!preset) return;
  let addedCount = 0;
  for (const r of preset.rules) {
    if (!S.aliases.some((a) => a.from.toUpperCase() === r.from.toUpperCase())) {
      S.aliases.push({ from: r.from, to: r.to, reason: r.reason, approved: true });
      addedCount++;
    }
  }
  syncAliasesToTextarea();
  renderActiveRules();
  rebuild();
  setText('aliasStatus', `Added ${addedCount} rules from ${preset.name} preset.`);
}

bindClick('presetBev', () => loadPreset('beverage'));
bindClick('presetFlavors', () => loadPreset('flavors'));
bindClick('presetBrands', () => loadPreset('brands'));

bindClick('clearAliases', () => {
  S.aliases = [];
  syncAliasesToTextarea();
  renderActiveRules();
  rebuild();
  setText('aliasStatus', 'All spelling rules cleared.');
});

bindClick('addAliasRule', () => {
  const fromVal = ($('newAliasFrom')?.value || '').trim();
  const toVal = ($('newAliasTo')?.value || '').trim();
  if (!fromVal || !toVal) {
    setText('aliasStatus', 'Enter both "From" and "To" to create a rule.');
    return;
  }
  addApprovedRule(fromVal, toVal, 'Custom user rule');
  if ($('newAliasFrom')) $('newAliasFrom').value = '';
  if ($('newAliasTo')) $('newAliasTo').value = '';
});

bindChange('filter', () => {
  const fil = $('filter');
  if (fil) S.filter = fil.value;
  S.page = 1;
  render();
});
bindClick('prev', () => { S.page--; render(); });
bindClick('next', () => { S.page++; render(); });

bindClick('acceptClean', () => {
  const n = acceptCleanBarcodes(S.rows);
  render();
  setText('status', `${n} clean barcodes accepted. Items with review flags were left for you.`);
});

bindClick('offRun', async () => {
  if (!$('offOn')?.checked) { setText('offProgress', 'Tick the box to allow lookups.'); return; }
  S.abort = new AbortController();
  await runOffQueue(S.rows, { cache: S.offCache, signal: S.abort.signal, onProgress: (n, t) => { setText('offProgress', `${n}/${t} looked up`); } });
  applyOffSuggestions(S.rows);
  render();
  const st = {};
  for (const r of S.rows) if (r.off) st[r.off.status] = (st[r.off.status] || 0) + 1;
  setText('offProgress', 'Finished: ' + JSON.stringify(st) + (st.unavailable ? ' (browser may block cross-origin requests; see README)' : ''));
});

bindClick('offCancel', () => {
  S.abort?.abort();
  setText('offProgress', 'Cancelled');
});
const dlToastBtn = $('dlToast');
if (dlToastBtn) {
  dlToastBtn.onclick = () => {
    try {
      if (!S.rows.length) throw new Error('No inventory loaded. Load files in Step 1 first.');
      const format = $('toastFormat')?.value || 'retail';
      const scope = $('toastScope')?.value || 'approved';
      const onlyApproved = scope === 'approved';

      const toastTable = exportToastRows(S.rows, {
        format,
        onlyApproved,
        strictBarcodes: true
      });

      const itemCount = toastTable.length - 1;
      if (itemCount <= 0) {
        const why = onlyApproved
          ? 'No items are both fully approved and possess a valid barcode identity. Review and approve items in Section 4 first.'
          : 'No items possess a valid barcode identity. Toast requires barcode as the product identity.';
        throw new Error(why);
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = format === 'retail'
        ? `toast_retail_import_${dateStr}.csv`
        : `toast_menu_import_${dateStr}.csv`;

      download(filename, toCsv(toastTable));

      const statusEl = $('toastStatus');
      if (statusEl) {
        statusEl.textContent = `Generated ${filename} with ${itemCount} items ready for Toast import (Barcode used as SKU & Barcode product identity).`;
      }
    } catch (e) {
      fail('toastStatus', e);
    }
  };
}

const btnValidateToast = $('btnValidateToast');
if (btnValidateToast) {
  btnValidateToast.onclick = () => {
    const out = $('toastValidationOutput');
    if (!out) return;
    if (!S.rows.length) {
      out.style.display = 'block';
      out.textContent = 'Load an inventory file first to validate Toast import readiness.';
      return;
    }

    const t = summarizeToastReadiness(S.rows);
    const issuesList = [];
    const duplicates = S.rows.filter((r) => r.duplicate);
    if (duplicates.length) {
      issuesList.push(`• ${duplicates.length} item(s) have duplicate barcodes (Toast requires unique barcode/SKU identity).`);
    }
    const missingBarcodes = S.rows.filter((r) => !getBarcodeIdentity(r));
    if (missingBarcodes.length) {
      issuesList.push(`• ${missingBarcodes.length} item(s) have missing or non-numeric barcodes.`);
    }
    const invalidBarcodes = S.rows.filter((r) => r.barcode.status === 'invalid');
    if (invalidBarcodes.length) {
      issuesList.push(`• ${invalidBarcodes.length} item(s) have invalid barcode check digits.`);
    }
    const pending = S.rows.filter((r) => !isApproved(r));
    if (pending.length) {
      issuesList.push(`• ${pending.length} item(s) have undecided name/category/barcode proposals.`);
    }

    out.style.display = 'block';
    out.replaceChildren();

    const title = document.createElement('div');
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '6px';
    title.textContent = `Toast Import Validation: ${t.readyApproved} of ${t.total} items fully ready for import`;
    out.append(title);

    if (issuesList.length === 0) {
      const okMsg = document.createElement('div');
      okMsg.className = 'ok';
      okMsg.textContent = '✓ All items passed Toast import requirements! Every item has a verified barcode identity and decided name/category.';
      out.append(okMsg);
    } else {
      const listDiv = document.createElement('div');
      listDiv.style.lineHeight = '1.5';
      listDiv.textContent = 'Action items before Toast Web import:';
      const ul = document.createElement('ul');
      ul.style.margin = '4px 0 0 16px';
      ul.style.padding = '0';
      for (const item of issuesList) {
        const li = document.createElement('li');
        li.textContent = item;
        ul.append(li);
      }
      listDiv.append(ul);
      out.append(listDiv);

      const tip = document.createElement('div');
      tip.className = 'small text-muted';
      tip.style.marginTop = '6px';
      tip.textContent = 'Tip: You can click "Accept all clean barcodes" in Section 4 to quickly approve valid barcodes, or use "All items with valid barcode identity" in the export scope.';
      out.append(tip);
    }
  };
}

bindClick('dlReview', () => download('inventory_review.csv', toCsv([exportHeader, ...exportRows(S.rows)])));
bindClick('dlApproved', () => download('inventory_approved.csv', toCsv([exportHeader, ...exportRows(approvedRows(S.rows))])));
bindClick('dlSave', () => download('session-decisions.json', saveSession(S.rows), 'application/json'));
bindChange('sessFile', async () => {
  try {
    const f = $('sessFile')?.files?.[0];
    if (f) {
      loadSession(S.rows, await f.text());
      render();
    }
  } catch (e) {
    fail('status', e);
  }
});

// Firebase Cloud Sync
let currentUser = null;

async function refreshCloudList() {
  const sel = $('cloudSessionsList');
  if (!sel) return;
  sel.replaceChildren();
  if (!currentUser) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '(Sign in to view saved sessions)';
    sel.append(opt);
    return;
  }
  try {
    const statusEl = $('cloudStatus');
    if (statusEl) statusEl.textContent = 'Loading cloud sessions…';
    const sessions = await listCloudSessions();
    if (!sessions || sessions.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(No saved sessions in cloud)';
      sel.append(opt);
      if (statusEl) statusEl.textContent = 'No sessions found in your cloud account.';
      return;
    }
    for (const sess of sessions) {
      const opt = document.createElement('option');
      opt.value = sess.id;
      const count = sess.itemCount != null ? ` (${sess.approvedCount || 0}/${sess.itemCount} approved)` : '';
      opt.textContent = `${sess.name || 'Untitled'}${count}`;
      sel.append(opt);
    }
    if (statusEl) statusEl.textContent = `${sessions.length} cloud session(s) available.`;
  } catch (e) {
    fail('cloudStatus', e);
  }
}

onAuthChange((user) => {
  currentUser = user;
  const userStatus = $('userStatus');
  const authBtn = $('authBtn');
  if (user) {
    if (userStatus) userStatus.textContent = `Signed in: ${user.email || user.displayName || user.uid}`;
    if (authBtn) authBtn.textContent = 'Sign out';
  } else {
    if (userStatus) userStatus.textContent = 'Not signed in';
    if (authBtn) authBtn.textContent = 'Sign in with Google';
  }
  refreshCloudList();
});

const authBtn = $('authBtn');
if (authBtn) {
  authBtn.onclick = async () => {
    try {
      if (currentUser) {
        await signOutUser();
        const statusEl = $('cloudStatus');
        if (statusEl) statusEl.textContent = 'Signed out successfully.';
      } else {
        const statusEl = $('cloudStatus');
        if (statusEl) statusEl.textContent = 'Signing in…';
        await signInWithGoogle();
        if (statusEl) statusEl.textContent = 'Signed in successfully.';
      }
    } catch (e) {
      fail('cloudStatus', e);
    }
  };
}

const saveCloudBtn = $('saveCloud');
if (saveCloudBtn) {
  saveCloudBtn.onclick = async () => {
    try {
      if (!currentUser) throw new Error('Sign in with Google to save to cloud');
      if (!S.rows.length) throw new Error('No inventory loaded to save');
      const name = ($('cloudSessionName')?.value || '').trim() || `Inventory Review (${new Date().toLocaleTimeString()})`;
      const statusEl = $('cloudStatus');
      if (statusEl) statusEl.textContent = 'Saving to Firestore…';
      const s = summarize(S.rows);
      await saveCloudSession(name, saveSession(S.rows), s.total, s.approved);
      if (statusEl) statusEl.textContent = `Saved session "${name}" to Firestore!`;
      if ($('cloudSessionName')) $('cloudSessionName').value = '';
      await refreshCloudList();
    } catch (e) {
      fail('cloudStatus', e);
    }
  };
}

const loadCloudBtn = $('loadCloud');
if (loadCloudBtn) {
  loadCloudBtn.onclick = async () => {
    try {
      if (!currentUser) throw new Error('Sign in with Google first');
      const sessId = $('cloudSessionsList')?.value;
      if (!sessId) throw new Error('Select a cloud session to load');
      const statusEl = $('cloudStatus');
      if (statusEl) statusEl.textContent = 'Loading from Firestore…';
      const docData = await loadCloudSession(sessId);
      loadSession(S.rows, docData.decisionsJson);
      render();
      if (statusEl) statusEl.textContent = `Loaded "${docData.name}" from Firestore (${docData.approvedCount || 0} approved).`;
    } catch (e) {
      fail('cloudStatus', e);
    }
  };
}

function confirmAction({ title, message, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const existing = document.getElementById('confirmModalOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'confirmModalOverlay';
    overlay.className = 'modal-overlay';

    const box = document.createElement('div');
    box.className = 'modal-box';

    const titleEl = document.createElement('h3');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'modal-body';
    bodyEl.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
      overlay.remove();
      resolve(false);
    };

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = danger ? 'btn-danger' : '';
    okBtn.textContent = confirmText;
    okBtn.onclick = () => {
      overlay.remove();
      resolve(true);
    };

    actions.append(cancelBtn, okBtn);
    box.append(titleEl, bodyEl, actions);
    overlay.append(box);
    document.body.append(overlay);
  });
}

const deleteCloudBtn = $('deleteCloud');
if (deleteCloudBtn) {
  deleteCloudBtn.onclick = async () => {
    try {
      if (!currentUser) throw new Error('Sign in with Google first');
      const sessId = $('cloudSessionsList')?.value;
      if (!sessId) throw new Error('Select a cloud session to delete');
      const confirmed = await confirmAction({
        title: 'Delete Cloud Session',
        message: 'Are you sure you want to delete this saved session from Firestore? This action cannot be undone.',
        confirmText: 'Delete',
        danger: true,
      });
      if (!confirmed) return;
      const statusEl = $('cloudStatus');
      if (statusEl) statusEl.textContent = 'Deleting from Firestore…';
      await deleteCloudSession(sessId);
      if (statusEl) statusEl.textContent = 'Cloud session deleted.';
      await refreshCloudList();
    } catch (e) {
      fail('cloudStatus', e);
    }
  };
}

const refreshCloudBtn = $('refreshCloud');
if (refreshCloudBtn) {
  refreshCloudBtn.onclick = () => { refreshCloudList(); };
}

// ---------------- Google Workspace Handlers ----------------
function requireAuthToken() {
  const token = getAccessToken();
  if (!token) throw new Error('Please sign in with Google in the Cloud section above to use Google Workspace features.');
  return token;
}

const wsExportToastSheetsBtn = $('wsExportToastSheets');
if (wsExportToastSheetsBtn) {
  wsExportToastSheetsBtn.onclick = async () => {
    try {
      const token = requireAuthToken();
      if (!S.rows.length) throw new Error('No inventory loaded. Load files in Step 1 first.');
      const statusEl = $('wsStatus');
      if (statusEl) statusEl.textContent = 'Exporting Toast Retail Catalog to Google Sheets…';

      const format = $('toastFormat')?.value || 'retail';
      const scope = $('toastScope')?.value || 'approved';
      const toastTable = exportToastRows(S.rows, {
        format,
        onlyApproved: scope === 'approved',
        strictBarcodes: true
      });
      if (toastTable.length <= 1) throw new Error('No items ready for Toast export. Review and approve items first.');

      const dateStr = new Date().toLocaleDateString();
      const title = `Toast Retail Catalog (${format.toUpperCase()}) - ${dateStr}`;
      const res = await exportToGoogleSheets(token, title, toastTable);
      if (statusEl) {
        statusEl.innerHTML = `Toast Sheet created: <a href="${res.url}" target="_blank" rel="noopener" style="color:#818cf8;text-decoration:underline;">${escapeHtml(res.title)}</a>`;
      }
    } catch (e) {
      fail('wsStatus', e);
    }
  };
}

const wsExportSheetsBtn = $('wsExportSheets');
if (wsExportSheetsBtn) {
  wsExportSheetsBtn.onclick = async () => {
    try {
      const token = requireAuthToken();
      if (!S.rows.length) throw new Error('No inventory loaded. Load files in Step 1 first.');
      const statusEl = $('wsStatus');
      if (statusEl) statusEl.textContent = 'Creating Google Spreadsheet…';
      const allRows = [exportHeader, ...exportRows(S.rows)];
      const res = await exportToGoogleSheets(token, `Inventory Review - ${new Date().toLocaleDateString()}`, allRows);
      if (statusEl) {
        statusEl.innerHTML = `Google Sheet created: <a href="${res.url}" target="_blank" rel="noopener" style="color:#818cf8;text-decoration:underline;">${escapeHtml(res.title)}</a>`;
      }
    } catch (e) {
      fail('wsStatus', e);
    }
  };
}

const wsImportSheetsBtn = $('wsImportSheets');
if (wsImportSheetsBtn) {
  wsImportSheetsBtn.onclick = async () => {
    try {
      const token = requireAuthToken();
      const rawInput = ($('wsSheetId')?.value || '').trim();
      if (!rawInput) throw new Error('Enter a Google Sheet ID or URL');
      const match = rawInput.match(/\/d\/([a-zA-Z0-9-_]+)/);
      const sheetId = match ? match[1] : rawInput;

      const statusEl = $('wsStatus');
      if (statusEl) statusEl.textContent = 'Importing from Google Sheets…';
      const values = await importFromGoogleSheets(token, sheetId);
      if (!values.length) throw new Error('Spreadsheet returned no rows');

      const h = values[0].map((x) => String(x ?? '').trim().toLowerCase());
      const col = (...n) => h.findIndex((x) => n.includes(x));
      const ni = col('name', 'item name');
      const bi = col('product code', 'upc', 'barcode');
      const ci = col('categories', 'category');
      const pi = col('price');
      const co = col('cost');
      if (ni < 0) throw new Error('Sheet must have a "Name" or "Item Name" column');

      S.records = values.slice(1).map((r) => ({
        name: r[ni] ?? '',
        barcode: bi < 0 ? '' : r[bi] ?? '',
        category: ci < 0 ? '' : r[ci] ?? '',
        price: pi < 0 ? '' : r[pi] ?? '',
        cost: co < 0 ? '' : r[co] ?? ''
      }));
      S.canonical = [];
      S.page = 1;
      rebuild(false);
      currentSuggestions = scanInventoryForSpellingSuggestions(S.records, S.aliases);
      renderSuggestions();
      if (statusEl) statusEl.textContent = `Successfully imported ${S.records.length} items from Google Sheets!`;
    } catch (e) {
      fail('wsStatus', e);
    }
  };
}

const wsPickDriveBtn = $('wsPickDrive');
if (wsPickDriveBtn) {
  wsPickDriveBtn.onclick = async () => {
    try {
      const token = requireAuthToken();
      const statusEl = $('wsStatus');
      if (statusEl) statusEl.textContent = 'Opening Google Picker…';

      await showGooglePicker(token, async (doc) => {
        try {
          if (statusEl) statusEl.textContent = `Selected "${doc.name}". Loading content…`;
          if (doc.mimeType === 'application/vnd.google-apps.spreadsheet') {
            const values = await importFromGoogleSheets(token, doc.id);
            if (!values.length) throw new Error('Spreadsheet has no rows');
            const h = values[0].map((x) => String(x ?? '').trim().toLowerCase());
            const col = (...n) => h.findIndex((x) => n.includes(x));
            const ni = col('name', 'item name');
            const bi = col('product code', 'upc', 'barcode');
            const ci = col('categories', 'category');
            const pi = col('price');
            const co = col('cost');
            if (ni < 0) throw new Error('Selected spreadsheet must contain a "Name" column');
            S.records = values.slice(1).map((r) => ({
              name: r[ni] ?? '',
              barcode: bi < 0 ? '' : r[bi] ?? '',
              category: ci < 0 ? '' : r[ci] ?? '',
              price: pi < 0 ? '' : r[pi] ?? '',
              cost: co < 0 ? '' : r[co] ?? ''
            }));
          } else {
            const rawContent = await downloadDriveFileContent(token, doc.id);
            const rows = parseCsv(rawContent);
            if (!rows.length) throw new Error('CSV has no rows');
            const h = rows[0].map((x) => String(x ?? '').trim().toLowerCase());
            const col = (...n) => h.findIndex((x) => n.includes(x));
            const ni = col('name', 'item name');
            const bi = col('product code', 'upc', 'barcode');
            const ci = col('categories', 'category');
            const pi = col('price');
            const co = col('cost');
            if (ni < 0) throw new Error('Selected CSV file must contain a "Name" column');
            S.records = rows.slice(1).map((r) => ({
              name: r[ni] ?? '',
              barcode: bi < 0 ? '' : r[bi] ?? '',
              category: ci < 0 ? '' : r[ci] ?? '',
              price: pi < 0 ? '' : r[pi] ?? '',
              cost: co < 0 ? '' : r[co] ?? ''
            }));
          }
          S.canonical = [];
          S.page = 1;
          rebuild(false);
          currentSuggestions = scanInventoryForSpellingSuggestions(S.records, S.aliases);
          renderSuggestions();
          if (statusEl) statusEl.textContent = `Loaded ${S.records.length} items from Drive file "${doc.name}"!`;
        } catch (err) {
          fail('wsStatus', err);
        }
      });
    } catch (e) {
      fail('wsStatus', e);
    }
  };
}

const wsSaveToastDriveBtn = $('wsSaveToastDrive');
if (wsSaveToastDriveBtn) {
  wsSaveToastDriveBtn.onclick = async () => {
    try {
      const token = requireAuthToken();
      if (!S.rows.length) throw new Error('No inventory loaded to save');
      const statusEl = $('wsStatus');
      if (statusEl) statusEl.textContent = 'Saving Toast import file to Google Drive…';

      const format = $('toastFormat')?.value || 'retail';
      const scope = $('toastScope')?.value || 'approved';
      const toastTable = exportToastRows(S.rows, {
        format,
        onlyApproved: scope === 'approved',
        strictBarcodes: true
      });
      if (toastTable.length <= 1) throw new Error('No items ready for Toast export. Review and approve items first.');

      const csvData = toCsv(toastTable);
      const filename = `toast_${format}_import_${new Date().toISOString().slice(0, 10)}.csv`;
      const res = await saveFileToGoogleDrive(token, filename, csvData, 'text/csv');
      if (statusEl) {
        statusEl.innerHTML = `Toast file saved to Drive: <a href="${res.webViewLink || '#'}" target="_blank" rel="noopener" style="color:#818cf8;text-decoration:underline;">${escapeHtml(res.name)}</a>`;
      }
    } catch (e) {
      fail('wsStatus', e);
    }
  };
}

const wsSaveDriveBtn = $('wsSaveDrive');
if (wsSaveDriveBtn) {
  wsSaveDriveBtn.onclick = async () => {
    try {
      const token = requireAuthToken();
      if (!S.rows.length) throw new Error('No inventory loaded to save');
      const statusEl = $('wsStatus');
      if (statusEl) statusEl.textContent = 'Saving review CSV to Google Drive…';
      const csvData = toCsv([exportHeader, ...exportRows(S.rows)]);
      const filename = `inventory_review_${new Date().toISOString().slice(0, 10)}.csv`;
      const res = await saveFileToGoogleDrive(token, filename, csvData, 'text/csv');
      if (statusEl) {
        statusEl.innerHTML = `Saved to Drive: <a href="${res.webViewLink || '#'}" target="_blank" rel="noopener" style="color:#818cf8;text-decoration:underline;">${escapeHtml(res.name)}</a>`;
      }
    } catch (e) {
      fail('wsStatus', e);
    }
  };
}

const wsCreateDocBtn = $('wsCreateDoc');
if (wsCreateDocBtn) {
  wsCreateDocBtn.onclick = async () => {
    try {
      const token = requireAuthToken();
      if (!S.rows.length) throw new Error('No inventory loaded');
      const statusEl = $('wsStatus');
      if (statusEl) statusEl.textContent = 'Generating Google Doc audit report…';
      const s = summarize(S.rows);
      const problemRows = S.rows.filter((r) => issues(r).length > 0);
      const res = await createInventoryAuditDoc(token, `Inventory Audit - ${new Date().toLocaleDateString()}`, s, problemRows);
      if (statusEl) {
        statusEl.innerHTML = `Audit Doc created: <a href="${res.url}" target="_blank" rel="noopener" style="color:#818cf8;text-decoration:underline;">${escapeHtml(res.title)}</a>`;
      }
    } catch (e) {
      fail('wsStatus', e);
    }
  };
}

const wsExportTasksBtn = $('wsExportTasks');
if (wsExportTasksBtn) {
  wsExportTasksBtn.onclick = async () => {
    try {
      const token = requireAuthToken();
      if (!S.rows.length) throw new Error('No inventory loaded');
      const issueRows = S.rows.filter((r) => issues(r).length > 0);
      if (!issueRows.length) throw new Error('No inventory issues detected! All items are clean.');
      const taskCount = Math.min(issueRows.length, 30);
      const confirmed = await confirmAction({
        title: 'Create Google Tasks',
        message: `Create ${taskCount} shelf audit tasks in your Google Tasks account for flagged inventory items?`,
        confirmText: 'Create Tasks',
      });
      if (!confirmed) return;

      const statusEl = $('wsStatus');
      if (statusEl) statusEl.textContent = `Creating tasks for ${taskCount} items in Google Tasks…`;
      const res = await exportReviewIssuesToTasks(token, issueRows, 'Inventory Audit');
      if (statusEl) {
        statusEl.innerHTML = `Created ${res.count} tasks in list "${escapeHtml(res.listTitle)}"! <a href="${res.url}" target="_blank" rel="noopener" style="color:#818cf8;text-decoration:underline;">Open Google Tasks</a>`;
      }
    } catch (e) {
      fail('wsStatus', e);
    }
  };
}

const wsSendEmailBtn = $('wsSendEmail');
if (wsSendEmailBtn) {
  wsSendEmailBtn.onclick = async () => {
    try {
      const token = requireAuthToken();
      if (!S.rows.length) throw new Error('No inventory loaded');
      const recipient = ($('wsEmailRecipient')?.value || '').trim();
      if (!recipient || !recipient.includes('@')) throw new Error('Please enter a valid recipient email address');

      const s = summarize(S.rows);
      const subject = `Inventory Identity Review Summary (${new Date().toLocaleDateString()})`;
      const body = `Inventory Review Summary for Store POS\n` +
        `Date: ${new Date().toLocaleString()}\n\n` +
        `Total Items: ${s.total}\n` +
        `Fully Approved: ${s.approved}\n` +
        `Needs Review: ${s.needsReview}\n` +
        `Reference Contradictions: ${s.contradictions}\n` +
        `Duplicate Barcodes: ${s.duplicates}\n` +
        `Missing/Invalid Barcodes: ${s.invalidBarcodes}\n\n` +
        `Generated via Clover -> Toast Inventory Cleaner`;

      const confirmed = await confirmAction({
        title: 'Send Inventory Audit Email',
        message: `Send an inventory review report with summary stats to ${recipient} from your connected Gmail account?`,
        confirmText: 'Send Email',
      });
      if (!confirmed) return;

      const statusEl = $('wsStatus');
      if (statusEl) statusEl.textContent = `Sending report email to ${recipient}…`;
      await sendInventoryReportEmail(token, recipient, subject, body);
      if (statusEl) statusEl.textContent = `Report email successfully sent to ${recipient}!`;
    } catch (e) {
      fail('wsStatus', e);
    }
  };
}

const wsCreateFormBtn = $('wsCreateForm');
if (wsCreateFormBtn) {
  wsCreateFormBtn.onclick = async () => {
    try {
      const token = requireAuthToken();
      if (!S.rows.length) throw new Error('No inventory loaded');
      const problemRows = S.rows.filter((r) => r.barcode?.review || issues(r).length > 0);
      if (!problemRows.length) throw new Error('No items need physical verification.');
      const statusEl = $('wsStatus');
      if (statusEl) statusEl.textContent = 'Generating Google Form for physical barcode verification…';
      const res = await createBarcodeAuditForm(token, `Shelf Barcode Audit - ${new Date().toLocaleDateString()}`, problemRows);
      if (statusEl) {
        statusEl.innerHTML = `Google Form ready for staff: <a href="${res.responderUri}" target="_blank" rel="noopener" style="color:#818cf8;text-decoration:underline;">Open Form (Fill out)</a> | <a href="${res.editUri}" target="_blank" rel="noopener" style="color:#818cf8;text-decoration:underline;">Edit Form</a>`;
      }
    } catch (e) {
      fail('wsStatus', e);
    }
  };
}

// Initialize active rules on startup
S.aliases = parseAliases();
renderActiveRules();

// Preset and spellcheck action button aliases
const presetSelect = $('presetSelect');
if (presetSelect) {
  presetSelect.onchange = () => {
    if (presetSelect.value) {
      loadPreset(presetSelect.value);
      presetSelect.value = '';
    }
  };
}

const scanSpellingBtn = $('scanSpellingBtn');
if (scanSpellingBtn) {
  scanSpellingBtn.onclick = () => {
    if (!S.records || !S.records.length) {
      if ($('aliasStatus')) $('aliasStatus').textContent = 'Load an inventory file first to scan for typos and abbreviations.';
      return;
    }
    currentSuggestions = scanInventoryForSpellingSuggestions(S.records, S.aliases);
    renderSuggestions();
    if ($('aliasStatus')) {
      $('aliasStatus').textContent = currentSuggestions.length
        ? `Scan complete: detected ${currentSuggestions.length} spelling & abbreviation opportunity(ies).`
        : 'Scan complete: no unhandled abbreviations detected.';
    }
  };
}

const approveAllSuggestionsBtn = $('approveAllSuggestionsBtn');
if (approveAllSuggestionsBtn) {
  approveAllSuggestionsBtn.onclick = () => {
    const high = currentSuggestions.filter((s) => s.confidence === 'high');
    if (!high.length) {
      if ($('aliasStatus')) $('aliasStatus').textContent = 'No high-confidence suggestions remaining.';
      return;
    }
    for (const h of high) {
      const existing = S.aliases.find((a) => a.from.toUpperCase() === h.from.toUpperCase());
      if (existing) {
        existing.to = h.to;
        existing.reason = h.reason;
        existing.approved = true;
      } else {
        S.aliases.push({ from: h.from, to: h.to, reason: h.reason, approved: true });
      }
    }
    currentSuggestions = currentSuggestions.filter((s) => s.confidence !== 'high');
    syncAliasesToTextarea();
    renderActiveRules();
    renderSuggestions();
    rebuild();
    if ($('aliasStatus')) $('aliasStatus').textContent = `Approved and applied ${high.length} spelling rules!`;
  };
}

const dismissSuggestionsBtn = $('dismissSuggestionsBtn');
if (dismissSuggestionsBtn) {
  dismissSuggestionsBtn.onclick = () => {
    currentSuggestions = [];
    renderSuggestions();
  };
}

const refTemplateBtn = $('refTemplate');
if (refTemplateBtn) {
  refTemplateBtn.onclick = () => download('reference_template.csv', referenceTemplateCsv());
}

const acceptSafeBtn = $('acceptSafeProposals');
if (acceptSafeBtn) {
  acceptSafeBtn.onclick = () => {
    const { approvedNames, approvedCats } = autoApproveSafeProposals(S.rows);
    render();
    if ($('status')) $('status').textContent = `Auto-approved ${approvedNames} clean name formatting proposals and ${approvedCats} category assignments.`;
  };
}

const tableSearchInput = $('tableSearch');
if (tableSearchInput) {
  tableSearchInput.oninput = () => {
    S.page = 1;
    render();
  };
}

const fileInputEl = $('file');
if (fileInputEl) {
  fileInputEl.addEventListener('change', () => {
    if (fileInputEl.files?.length) {
      const f = fileInputEl.files[0];
      const statusEl = $('status');
      if (statusEl) statusEl.textContent = `Selected "${f.name}". Ready to auto-clean!`;
    }
  });
}

const autoApproveAllBtn = $('autoApproveAll');
if (autoApproveAllBtn) {
  autoApproveAllBtn.onclick = () => {
    const cleanAccepted = acceptCleanBarcodes(S.rows);
    const { approvedNames, approvedCats } = autoApproveSafeProposals(S.rows);
    render();
    if ($('status')) {
      $('status').textContent = `Auto-approved ${cleanAccepted} clean barcodes, ${approvedNames} item names, and ${approvedCats} categories.`;
    }
  };
}

bindChange('heroToastFormat', () => {
  if ($('toastFormat') && $('heroToastFormat')) $('toastFormat').value = $('heroToastFormat').value;
});
bindChange('toastFormat', () => {
  if ($('heroToastFormat') && $('toastFormat')) $('heroToastFormat').value = $('toastFormat').value;
});

const dropzoneEl = $('dropzone');
if (dropzoneEl) {
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.classList.add('dragover');
    }, false);
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropzoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.classList.remove('dragover');
    }, false);
  });
  dropzoneEl.addEventListener('drop', async (e) => {
    const dt = e.dataTransfer;
    const files = dt?.files;
    if (files && files.length) {
      const fileInput = $('file');
      if (fileInput) {
        fileInput.files = files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const autoBtn = $('btnOneClickAuto');
      if (autoBtn) autoBtn.click();
    }
  });
}

// 1-Click Auto Process: All-in-one automation button
const btnOneClickAuto = $('btnOneClickAuto');
if (btnOneClickAuto) {
  btnOneClickAuto.onclick = async () => {
    const logEl = $('autoProcessLog');
    const showLog = (html) => {
      if (logEl) {
        logEl.style.display = 'block';
        logEl.innerHTML = html;
      }
    };

    try {
      showLog('⏳ <em>Step 1/4: Reading Clover inventory…</em>');
      // 1. If file input has a file, read it first
      const fileInput = $('file');
      if (fileInput?.files?.length) {
        const p = await parseInventoryFile(fileInput.files[0]);
        S.records = p.records;
        S.canonical = p.canonical;
        S.page = 1;
      } else if (!S.records.length) {
        throw new Error('Please select a Clover .xlsx or .csv file first.');
      }

      showLog(`⏳ <em>Step 2/4: Applying standard retail packaging & abbreviation rules for ${S.records.length} items…</em>`);

      // 2. Automatically apply standard packaging rules and liquor presets if not already added
      const unitsPreset = SPELLCHECK_PRESETS.units?.rules || [];
      const liquorPreset = SPELLCHECK_PRESETS.liquor?.rules || [];
      const combinedDefaults = [...unitsPreset, ...liquorPreset];

      for (const rule of combinedDefaults) {
        if (!S.aliases.some((a) => a.from.toUpperCase() === rule.from.toUpperCase())) {
          S.aliases.push({ ...rule, approved: true });
        }
      }

      // Rebuild with active rules
      rebuild(false);

      // 3. Scan for high-confidence suggestions in inventory and approve them
      const suggestions = scanInventoryForSpellingSuggestions(S.records, S.aliases);
      let autoRulesCount = 0;
      for (const sugg of suggestions) {
        if (sugg.confidence === 'high' && !S.aliases.some((a) => a.from.toUpperCase() === sugg.from.toUpperCase())) {
          S.aliases.push({ from: sugg.from, to: sugg.to, reason: sugg.reason, approved: true });
          autoRulesCount++;
        }
      }
      if (autoRulesCount > 0) {
        syncAliasesToTextarea();
        renderActiveRules();
        rebuild(false);
      }

      showLog(`⏳ <em>Step 3/4: Validating barcodes & approving clean items…</em>`);

      // 4. Bulk accept clean barcodes
      const cleanAccepted = acceptCleanBarcodes(S.rows);

      // 5. Auto-approve safe proposals (names without contradictions, safe categories)
      const { approvedNames, approvedCats } = autoApproveSafeProposals(S.rows);

      render();

      showLog(`⏳ <em>Step 4/4: Generating Toast POS Retail import file…</em>`);

      // 6. Export Toast file
      const format = $('heroToastFormat')?.value || $('toastFormat')?.value || 'retail';
      let toastTable = exportToastRows(S.rows, {
        format,
        onlyApproved: true,
        strictBarcodes: true
      });

      // Fallback: If 0 items were approved (e.g. all had small warnings), fallback to all items with valid barcodes so user still gets an import file
      if (toastTable.length <= 1) {
        toastTable = exportToastRows(S.rows, {
          format,
          onlyApproved: false,
          strictBarcodes: true
        });
      }

      const itemCount = toastTable.length - 1;
      if (itemCount <= 0) {
        throw new Error('Processed inventory, but no items have valid barcodes ready for Toast import.');
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `toast_${format}_import_${dateStr}.csv`;
      const csvContent = toCsv(toastTable);
      download(filename, csvContent);

      showLog(`
        <div style="color:#86efac;font-weight:bold;margin-bottom:8px;font-size:15px;display:flex;align-items:center;gap:8px;">
          <span>✓ 1-Click Auto Process Complete!</span>
        </div>
        <div style="color:#cbd5e1;line-height:1.7;margin-bottom:12px;">
          • Processed <strong>${S.records.length}</strong> items from Clover.<br>
          • Auto-accepted <strong>${cleanAccepted}</strong> clean barcodes with verified check digits.<br>
          • Auto-approved <strong>${approvedNames}</strong> clean item names &amp; standardized abbreviations.<br>
          • Exported <strong>${itemCount}</strong> items with unique barcode identities (SKU &amp; Barcode) ready for Toast POS!
        </div>
        <div class="flex-wrap" style="gap:8px;">
          <button id="directDlBtn" type="button" class="btn-toast btn-sm">⬇️ Download "${escapeHtml(filename)}"</button>
          <button id="jumpToReviewBtn" type="button" class="btn-secondary btn-sm">📋 Inspect in Table</button>
        </div>
      `);

      const directBtn = $('directDlBtn');
      if (directBtn) directBtn.onclick = () => download(filename, csvContent);
      const jumpBtn = $('jumpToReviewBtn');
      if (jumpBtn) {
        jumpBtn.onclick = () => {
          const reviewTab = document.querySelector('.nav-tab[data-tab="tab-review"]');
          if (reviewTab) reviewTab.click();
        };
      }

      if ($('toastStatus')) {
        $('toastStatus').textContent = `Downloaded ${filename} (${itemCount} items). Barcode mapped as SKU & Barcode product identity.`;
      }
    } catch (err) {
      if (logEl) {
        logEl.style.display = 'block';
        logEl.innerHTML = `<span style="color:#fca5a5;font-weight:bold;">✕ Error:</span> ${escapeHtml(err.message || String(err))}`;
      }
      fail('status', err);
    }
  };
}

// Tab navigation initializer
function initTabs() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  const tabs = document.querySelectorAll('.nav-tab');
  if (!tabs || !tabs.length) return;
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      tabs.forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

initTabs();

// --- 13-Digit Barcode Auto-Padding Controls ---
function onAutoPad13() {
  if (!S.records || !S.records.length) {
    if ($('status')) $('status').textContent = 'Please load an inventory file first.';
    return;
  }

  // Preserve previous barcodes for single-click undo
  S.paddingSnapshot = S.records.map((r) => r.barcode);

  const res = autoPadBarcodes13(S.records, S.rows);
  rebuild(true);
  updateBarcodePaddingUI();

  if ($('status')) {
    $('status').textContent = `Standardized ${res.paddedCount} barcode(s) to 13 digits! ${res.validEan13Count} are verified valid EAN-13 barcodes.`;
  }
  if ($('toastStatus')) {
    $('toastStatus').textContent = `Auto-padded ${res.paddedCount} barcodes to 13 digits. Toast export ready count updated.`;
  }
}

function onUndoPad13() {
  if (!S.paddingSnapshot || !S.records) return;
  S.records.forEach((rec, idx) => {
    if (S.paddingSnapshot[idx] !== undefined) {
      rec.barcode = S.paddingSnapshot[idx];
    }
  });
  S.paddingSnapshot = null;
  rebuild(true);
  updateBarcodePaddingUI();
  if ($('status')) {
    $('status').textContent = 'Reverted barcode padding changes to previous values.';
  }
}

bindClick('btnAutoPad13', onAutoPad13);
bindClick('btnAutoPadReview', onAutoPad13);
bindClick('btnUndoPad13', onUndoPad13);

// --- Gemini AI Assistant Drawer & Formatting ---
function openAiDrawer() {
  const drawer = $('aiDrawer');
  const overlay = $('aiDrawerOverlay');
  if (drawer) drawer.classList.add('open');
  if (overlay) overlay.classList.add('open');
  const input = $('aiPromptInput');
  if (input) input.focus();
}

function closeAiDrawer() {
  const drawer = $('aiDrawer');
  const overlay = $('aiDrawerOverlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

bindClick('openAiDrawerBtn', openAiDrawer);
bindClick('closeAiDrawerBtn', closeAiDrawer);
bindClick('aiDrawerOverlay', closeAiDrawer);

// Keyboard shortcut Alt + A to toggle AI assistant
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      const drawer = $('aiDrawer');
      if (drawer && drawer.classList && typeof drawer.classList.contains === 'function' && drawer.classList.contains('open')) {
        closeAiDrawer();
      } else {
        openAiDrawer();
      }
    }
  });
}

// Quick Prompt Chips
if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
  const chips = document.querySelectorAll('.ai-chip-btn');
  if (chips && typeof chips.forEach === 'function') {
    chips.forEach((btn) => {
      if (btn && typeof btn.addEventListener === 'function') {
        btn.addEventListener('click', () => {
          const prompt = typeof btn.getAttribute === 'function' ? btn.getAttribute('data-prompt') : '';
          const input = $('aiPromptInput');
          if (input && prompt) {
            input.value = prompt;
            if (typeof input.focus === 'function') input.focus();
          }
        });
      }
    });
  }
}

function appendAiMessage(sender, text, isUser = false) {
  const list = $('aiMessagesList');
  if (!list) return;
  const msg = document.createElement('div');
  msg.className = `ai-msg ${isUser ? 'ai-msg-user' : 'ai-msg-assistant'}`;

  const hdr = document.createElement('div');
  hdr.className = 'ai-msg-sender';
  hdr.textContent = isUser ? '👤 You' : '🤖 Gemini Assistant';

  const body = document.createElement('div');
  body.textContent = text;

  msg.append(hdr, body);
  list.append(msg);
  list.scrollTop = list.scrollHeight;
}

function renderDiffSection(changes, summary) {
  const sec = $('aiDiffSection');
  const tbody = $('aiDiffTableBody');
  const countBadge = $('aiDiffCountBadge');
  const summaryEl = $('aiDiffSummary');
  if (!sec || !tbody) return;

  tbody.replaceChildren();

  if (!changes || !changes.length) {
    sec.style.display = 'none';
    return;
  }

  const diffItems = computeDiffPreview(S.rows, changes);
  diffItems.forEach((diff) => {
    const tr = document.createElement('tr');

    const tdItem = document.createElement('td');
    tdItem.innerHTML = `<strong>${escapeHtml(diff.itemName)}</strong><div class="small text-muted">${escapeHtml(diff.id)}</div>`;

    const tdField = document.createElement('td');
    tdField.textContent = diff.field;

    const tdOrig = document.createElement('td');
    const del = document.createElement('span');
    del.className = 'diff-del';
    del.textContent = diff.originalValue || '(empty)';
    tdOrig.append(del);

    const tdProp = document.createElement('td');
    const ins = document.createElement('span');
    ins.className = 'diff-ins';
    ins.textContent = diff.proposedValue || '(empty)';
    tdProp.append(ins);

    const tdReason = document.createElement('td');
    tdReason.className = 'diff-reason';
    tdReason.textContent = diff.reason;

    tr.append(tdItem, tdField, tdOrig, tdProp, tdReason);
    tbody.append(tr);
  });

  if (countBadge) countBadge.textContent = `${changes.length} item${changes.length === 1 ? '' : 's'}`;
  if (summaryEl && summary) summaryEl.textContent = summary;
  setDisplay(sec, 'flex');
  if (sec && typeof sec.scrollIntoView === 'function') sec.scrollIntoView({ behavior: 'smooth' });
}

async function onSendAiPrompt() {
  const input = $('aiPromptInput');
  const prompt = (input?.value || '').trim();
  if (!prompt) return;

  const btn = $('btnSendAiPrompt');
  const btnText = $('btnSendAiText');

  appendAiMessage('You', prompt, true);
  if (input) input.value = '';

  if (!S.records || !S.records.length) {
    appendAiMessage('Gemini Assistant', 'Please load an inventory CSV or Excel file in Step 1 first so I can analyze and format your catalog items.');
    return;
  }

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Thinking…';

  try {
    const payload = {
      prompt,
      items: prepareDatasetForAi(S.records, S.rows, 150)
    };

    const res = await fetch('/api/ai/format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Failed to process AI request');
    }

    appendAiMessage('Gemini Assistant', data.message || 'I have analyzed your items.');

    if (data.changes && data.changes.length > 0) {
      S.currentAiChanges = data.changes;
      renderDiffSection(data.changes, data.summary);
    } else {
      S.currentAiChanges = [];
      const sec = $('aiDiffSection');
      setDisplay(sec, 'none');
    }
  } catch (err) {
    console.error('AI assistant error:', err);
    appendAiMessage('Gemini Assistant', `Error: ${err.message || 'Unable to communicate with Gemini cloud service.'}`);
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Send';
  }
}

bindClick('btnSendAiPrompt', onSendAiPrompt);
const promptInput = $('aiPromptInput');
if (promptInput && typeof promptInput.addEventListener === 'function') {
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendAiPrompt();
    }
  });
}

function onApproveAiDiff() {
  if (!S.currentAiChanges || !S.currentAiChanges.length) return;
  const result = applyAiChanges(S.records, S.rows, S.currentAiChanges);
  S.lastAiUndoSnapshot = result.undoSnapshot;
  S.currentAiChanges = [];

  const sec = $('aiDiffSection');
  setDisplay(sec, 'none');

  const banner = $('aiUndoBanner');
  const undoText = $('aiUndoText');
  if (banner) {
    setDisplay(banner, 'flex');
    if (undoText) undoText.textContent = `Applied ${result.appliedCount} AI adjustment(s) to inventory.`;
  }

  appendAiMessage('Gemini Assistant', `✅ Approved and applied ${result.appliedCount} adjustment(s) to your dataset.`);
  rebuild(true);
}

function onDiscardAiDiff() {
  S.currentAiChanges = [];
  const sec = $('aiDiffSection');
  setDisplay(sec, 'none');
  appendAiMessage('Gemini Assistant', 'Proposals discarded without modifying dataset.');
}

function onUndoAiChanges() {
  if (!S.lastAiUndoSnapshot) return;
  const count = revertAiChanges(S.records, S.rows, S.lastAiUndoSnapshot);
  S.lastAiUndoSnapshot = null;
  const banner = $('aiUndoBanner');
  setDisplay(banner, 'none');

  appendAiMessage('Gemini Assistant', `↩️ Successfully rolled back ${count} AI adjustment(s).`);
  rebuild(true);
}

bindClick('btnApproveAiDiff', onApproveAiDiff);
bindClick('btnDiscardAiDiff', onDiscardAiDiff);
bindClick('btnUndoAiChanges', onUndoAiChanges);


