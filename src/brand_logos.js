import { auth, db, handleFirestoreError, OperationType } from './firebase.js';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';

const LOCAL_LOGOS_KEY = 'clover_toast_brand_logos_v1';

/**
 * Normalizes a brand name into a consistent lookup slug.
 * e.g., "Jack Daniel's Tennessee Whiskey" -> "jackdaniels"
 * @param {string} name
 * @returns {string}
 */
export function normalizeBrandKey(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Loads cached brand logos from browser localStorage for instant zero-latency preview.
 * @returns {Array<Object>}
 */
export function getLocalBrandLogos() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_LOGOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to parse local brand logos cache:', err);
    return [];
  }
}

/**
 * Saves brand logos to browser localStorage.
 * @param {Array<Object>} logos
 */
export function saveLocalBrandLogos(logos) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_LOGOS_KEY, JSON.stringify(logos || []));
  } catch (err) {
    console.warn('Failed to save brand logos to local storage:', err);
  }
}

/**
 * Client-side file processor that scales, crops, and compresses image uploads
 * to ensure crisp print resolution while respecting Firestore document size limits.
 * @param {File} file
 * @param {number} maxDim
 * @returns {Promise<{ dataUrl: string, width: number, height: number }>}
 */
export async function processLogoImageFile(file, maxDim = 400) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image asset'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));

        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer PNG for logos with transparency, fallback to JPEG if large
        let dataUrl = canvas.toDataURL('image/png');
        if (dataUrl.length > 280000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        }

        resolve({ dataUrl, width, height });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Lists all hosted brand logos from Firestore for the currently logged-in user.
 * Merges with local cache for offline reliability.
 * @returns {Promise<Array<Object>>}
 */
export async function listBrandLogosFromCloud() {
  const local = getLocalBrandLogos();
  if (!auth.currentUser) return local;

  const userId = auth.currentUser.uid;
  const path = `users/${userId}/brandLogos`;
  try {
    const q = query(collection(db, 'users', userId, 'brandLogos'), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    const cloudLogos = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    if (cloudLogos.length > 0) {
      saveLocalBrandLogos(cloudLogos);
      return cloudLogos;
    }
    return local;
  } catch (err) {
    console.warn('Could not list brand logos from cloud, falling back to local storage:', err);
    return local;
  }
}

/**
 * Saves or updates a brand logo in Firestore and local storage.
 * @param {Object} logoData { id?, brandName, brandKey?, imageDataUrl, width, height }
 * @returns {Promise<Object>}
 */
export async function saveBrandLogo(logoData) {
  const brandName = (logoData.brandName || '').trim();
  if (!brandName) throw new Error('Brand name is required');
  const brandKey = normalizeBrandKey(brandName);
  if (!brandKey) throw new Error('Invalid brand name');

  const id = logoData.id || `logo_${brandKey}_${Date.now().toString(36)}`;
  const record = {
    id,
    brandName,
    brandKey,
    imageDataUrl: logoData.imageDataUrl,
    width: Number(logoData.width) || 200,
    height: Number(logoData.height) || 200,
    updatedAt: new Date().toISOString()
  };

  // 1. Save to local storage first
  const current = getLocalBrandLogos();
  const existingIdx = current.findIndex((l) => l.brandKey === brandKey || l.id === id);
  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...record };
  } else {
    current.unshift(record);
  }
  saveLocalBrandLogos(current);

  // 2. Sync to Firestore if authenticated
  if (auth.currentUser) {
    const userId = auth.currentUser.uid;
    const path = `users/${userId}/brandLogos/${id}`;
    try {
      const payload = {
        id,
        userId,
        brandName,
        brandKey,
        imageDataUrl: logoData.imageDataUrl,
        width: Number(logoData.width) || 200,
        height: Number(logoData.height) || 200,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'users', userId, 'brandLogos', id), payload, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  return record;
}

/**
 * Deletes a brand logo from Firestore and local storage.
 * @param {string} logoId
 */
export async function deleteBrandLogo(logoId) {
  if (!logoId) return;

  // Local remove
  const current = getLocalBrandLogos();
  const filtered = current.filter((l) => l.id !== logoId);
  saveLocalBrandLogos(filtered);

  // Cloud remove
  if (auth.currentUser) {
    const userId = auth.currentUser.uid;
    const path = `users/${userId}/brandLogos/${logoId}`;
    try {
      await deleteDoc(doc(db, 'users', userId, 'brandLogos', logoId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
}

/**
 * Finds the matching logo for an inventory item based on its brand or product name.
 * @param {Object} item { brand?, name? }
 * @param {Map<string, Object>|Array<Object>} logos
 * @returns {Object|null}
 */
export function findLogoForProduct(item, logos) {
  if (!item) return null;
  const logosList = Array.isArray(logos) ? logos : Array.from((logos || new Map()).values());
  if (!logosList.length) return null;

  // Match 1: Explicit brand field
  if (item.brand) {
    const targetKey = normalizeBrandKey(item.brand);
    const match = logosList.find((l) => l.brandKey === targetKey);
    if (match) return match;
  }

  // Match 2: Check if brandKey or brandName is contained in item name
  const normalizedName = normalizeBrandKey(item.name || '');
  for (const logo of logosList) {
    if (logo.brandKey && normalizedName.includes(logo.brandKey)) {
      return logo;
    }
  }

  return null;
}
