import { toCsv } from './src/csv.js';
import { parseInventoryFile } from './src/xlsx.js';
import { parseReferenceCsv, buildReferenceIndex, referenceTemplateCsv } from './src/reference.js';
import { buildRows, setDecision, issues, approvedRows, acceptCleanBarcodes, summarize, exportHeader, exportRows, applyOffSuggestions, saveSession, loadSession, isApproved } from './src/review.js';
import { runOffQueue } from './src/off.js';
import {
  signInWithGoogle,
  signOutUser,
  onAuthChange,
  saveCloudSession,
  listCloudSessions,
  loadCloudSession,
  deleteCloudSession,
} from './src/firebase.js';

const $ = (id) => document.getElementById(id);
const S = { records: [], canonical: [], refs: [], rows: [], aliases: [], page: 1, size: 25, filter: 'all', offCache: new Map(), abort: null };

function parseAliases() {
  return $('aliases').value.split('\n').map((l) => l.split('=>')).filter((p) => p.length === 2 && p[0].trim()).map(([f, t]) => ({ from: f.trim(), to: t.trim(), approved: true }));
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
  return S.rows.filter((r) => f === 'all' || (f === 'issues' && issues(r).length) || (f === 'contradiction' && ['contradiction', 'conflicting-references'].includes(r.reference.status)) || (f === 'duplicate' && r.duplicate) || (f === 'barcode' && r.barcode.review) || (f === 'pending' && !isApproved(r)) || (f === 'approved' && isApproved(r)));
}
function cell(tr, text, cls) { const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; tr.append(td); return td; }
function decision(tr, row, field, enabled) {
  const td = document.createElement('td'); const sel = document.createElement('select'); sel.setAttribute('aria-label', `${field} decision for ${row.id}`);
  for (const v of ['pending', 'accept', 'reject']) { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.append(o); }
  sel.value = row.decisions[field]; sel.disabled = !enabled;
  sel.addEventListener('change', () => { setDecision(S.rows, row.id, field, sel.value); updateSummary(); });
  td.append(sel); tr.append(td);
}
function updateSummary() {
  if (!S.rows.length) return;
  const s = summarize(S.rows);
  $('status').textContent = `${s.total} items | ${s.approved} fully approved | ${s.needsReview} need review | ${s.contradictions} reference contradictions | ${s.duplicates} duplicate barcodes | ${s.invalidBarcodes} missing/invalid barcodes`;
}
function render() {
  const rows = filtered(); const pages = Math.max(1, Math.ceil(rows.length / S.size)); S.page = Math.min(S.page, pages);
  const body = $('rows'); body.replaceChildren();
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
  $('page').textContent = ` Page ${S.page} of ${pages} (${rows.length} rows) `; $('prev').disabled = S.page <= 1; $('next').disabled = S.page >= pages;
  updateSummary();
}
function download(name, text, type = 'text/csv;charset=utf-8') { const a = document.createElement('a'); const u = URL.createObjectURL(new Blob([text], { type })); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
const fail = (el, e) => { $(el).textContent = e.message || String(e); };

$('load').onclick = async () => { try { const f = $('file').files[0]; if (!f) throw new Error('Choose a Clover .xlsx or .csv file'); $('status').textContent = 'Reading…'; const p = await parseInventoryFile(f); S.records = p.records; S.canonical = p.canonical; S.page = 1; rebuild(false); } catch (e) { fail('status', e); } };
$('loadRef').onclick = async () => { try { const f = $('refFile').files[0]; if (!f) throw new Error('Choose a reference CSV'); S.refs = parseReferenceCsv(await f.text()); rebuild(); $('status').textContent += ` | ${S.refs.length} reference rows loaded`; } catch (e) { fail('status', e); } };
$('tpl').onclick = () => download('reference_template.csv', referenceTemplateCsv());
$('applyAliases').onclick = () => { S.aliases = parseAliases(); rebuild(); };
$('filter').onchange = () => { S.filter = $('filter').value; S.page = 1; render(); };
$('prev').onclick = () => { S.page--; render(); }; $('next').onclick = () => { S.page++; render(); };
$('acceptClean').onclick = () => { const n = acceptCleanBarcodes(S.rows); render(); $('status').textContent = `${n} clean barcodes accepted. Items with review flags were left for you.`; };
$('offRun').onclick = async () => {
  if (!$('offOn').checked) { $('offProgress').textContent = 'Tick the box to allow lookups.'; return; }
  S.abort = new AbortController();
  await runOffQueue(S.rows, { cache: S.offCache, signal: S.abort.signal, onProgress: (n, t) => { $('offProgress').textContent = `${n}/${t} looked up`; } });
  applyOffSuggestions(S.rows); render();
  const st = {}; for (const r of S.rows) if (r.off) st[r.off.status] = (st[r.off.status] || 0) + 1;
  $('offProgress').textContent = 'Finished: ' + JSON.stringify(st) + (st.unavailable ? ' (browser may block cross-origin requests; see README)' : '');
};
$('offCancel').onclick = () => { S.abort?.abort(); $('offProgress').textContent = 'Cancelled'; };
$('dlReview').onclick = () => download('inventory_review.csv', toCsv([exportHeader, ...exportRows(S.rows)]));
$('dlApproved').onclick = () => download('inventory_approved.csv', toCsv([exportHeader, ...exportRows(approvedRows(S.rows))]));
$('dlSave').onclick = () => download('session-decisions.json', saveSession(S.rows), 'application/json');
$('sessFile').onchange = async () => { try { loadSession(S.rows, await $('sessFile').files[0].text()); render(); } catch (e) { fail('status', e); } };

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

const deleteCloudBtn = $('deleteCloud');
if (deleteCloudBtn) {
  deleteCloudBtn.onclick = async () => {
    try {
      if (!currentUser) throw new Error('Sign in with Google first');
      const sessId = $('cloudSessionsList')?.value;
      if (!sessId) throw new Error('Select a cloud session to delete');
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
