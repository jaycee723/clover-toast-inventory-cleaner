import { auth, db, handleFirestoreError, OperationType } from './firebase.js';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

const LOCAL_MASTER_KEY = 'clover_toast_master_inventory_v1';

/**
 * Sanitizes barcode to ensure a valid Firestore document ID.
 * @param {string} barcode
 * @returns {string}
 */
export function sanitizeDocId(barcode) {
  if (!barcode) {
    let rand = Date.now().toString(36);
    if (typeof crypto !== 'undefined') {
      if (typeof crypto.randomUUID === 'function') {
        rand = crypto.randomUUID().slice(0, 8);
      } else if (typeof crypto.getRandomValues === 'function') {
        const b = new Uint8Array(4);
        crypto.getRandomValues(b);
        rand = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      }
    }
    return `item_${Date.now().toString(36)}_${rand}`;
  }
  return String(barcode).replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
}

/**
 * Reads local cached master inventory from browser localStorage.
 * @returns {Array<Object>}
 */
export function getLocalMasterItems() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_MASTER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to parse local master inventory:', err);
    return [];
  }
}

/**
 * Saves master inventory items to browser localStorage.
 * @param {Array<Object>} items
 */
export function saveLocalMasterItems(items) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_MASTER_KEY, JSON.stringify(items || []));
  } catch (err) {
    console.warn('Failed to save master items to local storage:', err);
  }
}

/**
 * Clears local master inventory cache.
 */
export function clearLocalMasterItems() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(LOCAL_MASTER_KEY);
  } catch (err) {
    console.warn('Failed to clear local master items:', err);
  }
}

/**
 * Fetches all master inventory items from Firestore for the active user.
 * Syncs automatically with local storage.
 * @returns {Promise<Array<Object>>}
 */
export async function fetchMasterItemsFromCloud() {
  const local = getLocalMasterItems();
  if (!auth.currentUser) return local;

  const userId = auth.currentUser.uid;
  const path = `users/${userId}/masterItems`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'masterItems'));
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    if (items.length > 0) {
      saveLocalMasterItems(items);
      return items;
    }
    return local;
  } catch (err) {
    console.warn('Could not fetch master items from cloud, using local cache:', err);
    return local;
  }
}

/**
 * Saves or updates a single item in the master inventory.
 * @param {Object} item
 * @returns {Promise<Object>}
 */
export async function saveMasterItem(item) {
  const barcode = (item.barcode || '').trim();
  const name = (item.name || '').trim();
  const category = (item.category || 'General').trim();
  const price = item.price !== undefined && item.price !== null ? String(item.price) : '0.00';
  const id = item.id || sanitizeDocId(barcode);

  const cleanItem = {
    id,
    barcode,
    name,
    category,
    price,
    size: (item.size || '').trim().slice(0, 64),
    brand: (item.brand || '').trim().slice(0, 128),
    sku: (item.sku || '').trim().slice(0, 64),
    notes: (item.notes || '').trim().slice(0, 512),
    source: item.source || 'manual',
    updatedAt: new Date().toISOString()
  };

  // 1. Update local storage
  const current = getLocalMasterItems();
  const existingIdx = current.findIndex((i) => i.id === id || (barcode && i.barcode === barcode));
  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...cleanItem };
  } else {
    current.unshift(cleanItem);
  }
  saveLocalMasterItems(current);

  // 2. Sync to Firestore if authenticated
  if (auth.currentUser) {
    const userId = auth.currentUser.uid;
    const path = `users/${userId}/masterItems/${id}`;
    try {
      const payload = {
        id,
        userId,
        barcode,
        name,
        category,
        price,
        size: cleanItem.size,
        brand: cleanItem.brand,
        sku: cleanItem.sku,
        notes: cleanItem.notes,
        source: cleanItem.source,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'users', userId, 'masterItems', id), payload, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  return cleanItem;
}

/**
 * Deletes an item from master inventory.
 * @param {string} itemId
 */
export async function deleteMasterItem(itemId) {
  if (!itemId) return;

  // Local remove
  const current = getLocalMasterItems();
  const filtered = current.filter((i) => i.id !== itemId);
  saveLocalMasterItems(filtered);

  // Cloud remove
  if (auth.currentUser) {
    const userId = auth.currentUser.uid;
    const path = `users/${userId}/masterItems/${itemId}`;
    try {
      await deleteDoc(doc(db, 'users', userId, 'masterItems', itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
}

/**
 * Pre-Merge Reconciliation: Compares incoming cleaned inventory records against master items.
 * Classifies each item as:
 * - 'new': Barcode does not exist in master catalog
 * - 'update': Barcode exists, but name, category, or size differ
 * - 'match': Barcode exists and fields are identical
 *
 * @param {Array<Object>} incomingRows - Cleaned inventory rows
 * @param {Array<Object>} masterItems - Current master database items
 * @returns {{ diffs: Array<Object>, stats: Object }}
 */
export function reconcileImportWithMaster(incomingRows, masterItems) {
  const masterByBarcode = new Map();
  for (const item of masterItems || []) {
    if (item.barcode) {
      masterByBarcode.set(String(item.barcode).trim(), item);
    }
  }

  let newCount = 0;
  let updateCount = 0;
  let matchCount = 0;

  const diffs = (incomingRows || []).map((row, idx) => {
    // Extract fields from row (handling both raw records and review Row objects)
    const barcode = String(
      row.decisions?.barcode || (typeof row.barcode === 'object' ? row.barcode?.value : row.barcode) || ''
    ).trim();
    const name = String(
      row.decisions?.name || (typeof row.name === 'object' ? row.name?.value : row.name) || ''
    ).trim();
    const category = String(
      row.decisions?.category || (typeof row.category === 'object' ? row.category?.value : row.category) || 'General'
    ).trim();
    const price = String(
      row.decisions?.price || (typeof row.price === 'object' ? row.price?.value : row.price) || '0.00'
    ).trim();
    const size = String(
      row.size || row.unit || ''
    ).trim();
    const brand = String(
      row.brand || ''
    ).trim();
    const sku = String(
      row.sku || ''
    ).trim();

    const existing = barcode ? masterByBarcode.get(barcode) : null;
    let status = 'new';
    const fieldDiffs = {};

    if (!existing) {
      status = 'new';
      newCount++;
    } else {
      let hasChanges = false;
      if (existing.name !== name) {
        fieldDiffs.name = { old: existing.name, new: name };
        hasChanges = true;
      }
      if (existing.category !== category) {
        fieldDiffs.category = { old: existing.category, new: category };
        hasChanges = true;
      }
      if (size && existing.size !== size) {
        fieldDiffs.size = { old: existing.size, new: size };
        hasChanges = true;
      }
      if (existing.price !== price) {
        fieldDiffs.price = { old: existing.price, new: price };
        hasChanges = true;
      }

      if (hasChanges) {
        status = 'update';
        updateCount++;
      } else {
        status = 'match';
        matchCount++;
      }
    }

    return {
      id: sanitizeDocId(barcode || `row_${idx}`),
      index: idx,
      status, // 'new' | 'update' | 'match'
      selected: status !== 'match', // Default select new & update items
      incoming: {
        id: sanitizeDocId(barcode || `row_${idx}`),
        barcode,
        name,
        category,
        price,
        size,
        brand,
        sku,
        source: 'import'
      },
      existing,
      fieldDiffs
    };
  });

  return {
    diffs,
    stats: {
      total: diffs.length,
      newCount,
      updateCount,
      matchCount
    }
  };
}

/**
 * Merges reconciled import diffs into the master inventory.
 * Supports:
 * - mode === 'all': Inserts new items and updates matching existing items.
 * - mode === 'new_only': Inserts only items that are classified as 'new'.
 *
 * @param {Array<Object>} diffs - Reconciled diff records
 * @param {Array<Object>} currentMasterItems - Current master inventory
 * @param {'all' | 'new_only'} mode - Merge strategy
 * @returns {Promise<Array<Object>>} - Updated master items list
 */
export async function executeMerge(diffs, currentMasterItems, mode = 'all') {
  const masterMap = new Map();
  for (const item of currentMasterItems || []) {
    const key = item.barcode ? String(item.barcode).trim() : item.id;
    masterMap.set(key, { ...item });
  }

  const itemsToCommit = [];

  for (const diff of diffs || []) {
    if (!diff.selected) continue; // Skipped by user

    if (mode === 'new_only' && diff.status !== 'new') {
      continue; // Skip existing items in 'new_only' mode
    }

    const item = {
      ...diff.incoming,
      updatedAt: new Date().toISOString()
    };

    // If existing item has notes or custom brand that wasn't in import, preserve it
    if (diff.existing) {
      if (!item.notes && diff.existing.notes) item.notes = diff.existing.notes;
      if (!item.brand && diff.existing.brand) item.brand = diff.existing.brand;
    }

    const key = item.barcode ? String(item.barcode).trim() : item.id;
    masterMap.set(key, item);
    itemsToCommit.push(item);
  }

  const updatedList = Array.from(masterMap.values());
  saveLocalMasterItems(updatedList);

  // Batch sync to Firestore if authenticated (in chunks of 450)
  if (auth.currentUser && itemsToCommit.length > 0) {
    const userId = auth.currentUser.uid;
    const chunkSize = 400;
    for (let i = 0; i < itemsToCommit.length; i += chunkSize) {
      const chunk = itemsToCommit.slice(i, i + chunkSize);
      try {
        const batch = writeBatch(db);
        for (const itm of chunk) {
          const docRef = doc(db, 'users', userId, 'masterItems', itm.id);
          batch.set(docRef, {
            ...itm,
            userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        await batch.commit();
      } catch (err) {
        console.warn('Batch write to Firestore partial error:', err);
      }
    }
  }

  return updatedList;
}
