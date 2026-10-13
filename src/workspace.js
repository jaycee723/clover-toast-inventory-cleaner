// Google Workspace APIs Integration Module

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
];

// Helper to make authorized Google API calls
async function googleFetch(url, accessToken, options = {}) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let errMessage = `Google API error (${res.status} ${res.statusText})`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        errMessage = `${errJson.error.message} (${res.status})`;
      }
    } catch {}
    throw new Error(errMessage);
  }
  return res;
}

// ---------------- Google Sheets ----------------
export async function exportToGoogleSheets(accessToken, title, rows) {
  // 1. Create spreadsheet
  const createRes = await googleFetch('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: title || `Inventory Review - ${new Date().toLocaleDateString()}` },
    }),
  });
  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;

  // 2. Append rows
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  return {
    id: spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    title: sheetData.properties.title,
  };
}

export async function importFromGoogleSheets(accessToken, spreadsheetId, range = 'A1:Z5000') {
  const res = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    accessToken
  );
  const data = await res.json();
  return data.values || [];
}

// ---------------- Google Drive & File Upload ----------------
export async function saveFileToGoogleDrive(accessToken, filename, content, mimeType = 'text/csv') {
  const metadata = {
    name: filename,
    mimeType,
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const res = await googleFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    accessToken,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  return await res.json();
}

export async function downloadDriveFileContent(accessToken, fileId) {
  const res = await googleFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, accessToken);
  return await res.text();
}

// ---------------- Google Docs ----------------
export async function createInventoryAuditDoc(accessToken, docTitle, summary, problemRows = []) {
  // 1. Create blank doc
  const res = await googleFetch('https://docs.googleapis.com/v1/documents', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: docTitle || `Clover-Toast Inventory Audit - ${new Date().toLocaleDateString()}`,
    }),
  });
  const doc = await res.json();
  const documentId = doc.documentId;

  // 2. Build text summary
  let text = `INVENTORY IDENTITY AUDIT REPORT\n`;
  text += `Generated: ${new Date().toLocaleString()}\n\n`;
  text += `Summary:\n`;
  text += `• Total Items: ${summary.total || 0}\n`;
  text += `• Fully Approved: ${summary.approved || 0}\n`;
  text += `• Needs Review: ${summary.needsReview || 0}\n`;
  text += `• Duplicate Barcodes: ${summary.duplicates || 0}\n`;
  text += `• Reference Contradictions: ${summary.contradictions || 0}\n`;
  text += `• Invalid or Missing Barcodes: ${summary.invalidBarcodes || 0}\n\n`;

  if (problemRows.length > 0) {
    text += `ITEMS REQUIRING ATTENTION (${problemRows.length} sample rows):\n`;
    for (const r of problemRows.slice(0, 50)) {
      text += `----------------------------------------\n`;
      text += `Item: ${r.current_name || r.original_name}\n`;
      text += `Barcode: ${r.barcode?.original || '(none)'} [Status: ${r.barcode?.status || 'unknown'}]\n`;
      text += `Proposed Name: ${r.proposed_name || '(none)'}\n`;
      text += `Category: ${r.category || '(none)'} → ${r.proposed_category || '(none)'}\n`;
      if (r.reference?.contradictions?.length) {
        text += `Reference Contradictions: ${r.reference.contradictions.join(', ')}\n`;
      }
    }
  }

  // 3. Insert text into document
  await googleFetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text,
          },
        },
      ],
    }),
  });

  return {
    id: documentId,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
    title: doc.title,
  };
}

// ---------------- Google Tasks ----------------
export async function exportReviewIssuesToTasks(accessToken, issueRows, listTitle = 'Inventory Issues to Audit') {
  // 1. Create a task list
  const listRes = await googleFetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `${listTitle} (${new Date().toLocaleDateString()})` }),
  });
  const listData = await listRes.json();
  const listId = listData.id;

  // 2. Create tasks for each issue item (up to 30)
  const items = issueRows.slice(0, 30);
  let created = 0;
  for (const r of items) {
    const title = `Audit: ${r.current_name || r.original_name}`;
    const notes = `Barcode: ${r.barcode?.original || 'None'}\nIssue: ${r.barcode?.reason || ''} ${r.reference?.contradictions?.join(', ') || ''}\nCategory: ${r.category || ''}`;
    await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        notes,
      }),
    });
    created++;
  }

  return {
    listId,
    listTitle: listData.title,
    count: created,
    url: 'https://tasks.google.com/',
  };
}

// ---------------- Gmail ----------------
export async function sendInventoryReportEmail(accessToken, recipient, subject, summaryText) {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const emailLines = [
    `To: ${recipient}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    summaryText,
  ];
  const email = emailLines.join('\r\n');
  const base64EncodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64EncodedEmail }),
  });

  return await res.json();
}

// ---------------- Google Forms ----------------
export async function createBarcodeAuditForm(accessToken, formTitle, problemItems = []) {
  // 1. Create form
  const createRes = await googleFetch('https://forms.googleapis.com/v1/forms', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      info: {
        title: formTitle || `Barcode Verification Form - ${new Date().toLocaleDateString()}`,
        documentTitle: `Barcode Verification Form - ${new Date().toLocaleDateString()}`,
      },
    }),
  });
  const formData = await createRes.json();
  const formId = formData.formId;

  // 2. Add question items for sample problematic items (up to 15)
  const itemsToAdd = problemItems.slice(0, 15);
  if (itemsToAdd.length > 0) {
    const requests = itemsToAdd.map((item, idx) => ({
      createItem: {
        item: {
          title: `Item #${idx + 1}: ${item.current_name || item.original_name} (Current: ${item.barcode?.original || 'None'})`,
          description: `Current Category: ${item.category || 'N/A'}. Scan or enter the physical barcode from the shelf unit.`,
          questionItem: {
            question: {
              required: false,
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index: idx },
      },
    }));

    await googleFetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });
  }

  return {
    formId,
    responderUri: formData.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`,
    editUri: `https://docs.google.com/forms/d/${formId}/edit`,
  };
}

// ---------------- Google Picker Widget ----------------
let pickerLoadedPromise = null;

export function loadGooglePickerApi() {
  if (pickerLoadedPromise) return pickerLoadedPromise;
  pickerLoadedPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (window.google?.picker) return resolve();

    const checkGapi = () => {
      if (window.gapi) {
        window.gapi.load('picker', { callback: resolve });
      } else {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => window.gapi.load('picker', { callback: resolve });
        script.onerror = reject;
        document.head.append(script);
      }
    };
    checkGapi();
  });
  return pickerLoadedPromise;
}

export async function showGooglePicker(accessToken, onPicked) {
  await loadGooglePickerApi();
  if (typeof window === 'undefined' || !window.google?.picker) {
    throw new Error('Google Picker is only available in a browser environment');
  }

  const pickerOrigin =
    window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
      ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
      : window.location.origin;

  const docsView = new window.google.picker.DocsView()
    .setIncludeFolders(true);

  const picker = new window.google.picker.PickerBuilder()
    .addView(docsView)
    .addView(window.google.picker.ViewId.SPREADSHEETS)
    .setOAuthToken(accessToken)
    .setCallback((data) => {
      if (data.action === window.google.picker.Action.PICKED && data.docs?.length) {
        onPicked(data.docs[0]);
      }
    })
    .setOrigin(pickerOrigin)
    .build();

  picker.setVisible(true);
}
