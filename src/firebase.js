import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';

export const firebaseConfig = {
  projectId: "gen-lang-client-0818748893",
  appId: "1:631752805082:web:a11e38801d3a82c326f3e3",
  apiKey: "AIzaSyAQGoK6J2FVfv8OSqWc8L5OD5f0MqJtxyk",
  authDomain: "gen-lang-client-0818748893.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-clovertoastinven-34640a8c-f990-49f8-9484-bf8ae1f0691b",
  storageBucket: "gen-lang-client-0818748893.firebasestorage.app",
  messagingSenderId: "631752805082",
  measurementId: "",
  oAuthClientId: "631752805082-kucmu5mgth3ds4uj1khkjfnsglko9ajg.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

export function handleFirestoreError(error, operationType, path) {
  const user = auth?.currentUser;
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid || null,
      email: user?.email || null,
      emailVerified: user?.emailVerified ?? null,
      isAnonymous: user?.isAnonymous ?? null,
      tenantId: user?.tenantId ?? null,
      providerInfo: user?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: Test connection on initial boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
if (typeof window !== 'undefined') {
  testConnection();
}

let cachedAccessToken = null;

export function getAccessToken() {
  return cachedAccessToken;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  // Standard Google OAuth sign-in without unverified Workspace scopes so login succeeds reliably
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(cred);
  if (credential?.accessToken) {
    cachedAccessToken = credential.accessToken;
  }
  const user = cred.user;
  if (user) {
    const userRef = doc(db, 'users', user.uid);
    try {
      const snap = await getDoc(userRef);
      const userPayload = {
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        lastLoginAt: serverTimestamp(),
      };
      if (!snap.exists()) {
        userPayload.createdAt = serverTimestamp();
      }
      await setDoc(userRef, userPayload, { merge: true });
    } catch (err) {
      console.warn('User profile initial sync notice:', err);
    }
  }
  return { user, accessToken: cachedAccessToken };
}

export async function signOutUser() {
  await signOut(auth);
  cachedAccessToken = null;
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function saveCloudSession(nameOrOptions, sessionPayload, itemCount = 0, approvedCount = 0) {
  if (!auth.currentUser) throw new Error('Please sign in to save sessions to the cloud');
  const userId = auth.currentUser.uid;

  let name = '';
  let decisionsJson = '';
  let recordsJson = '';
  let fileName = '';
  let currentStep = 1;
  let items = 0;
  let approved = 0;
  let customId = null;

  if (typeof nameOrOptions === 'object' && nameOrOptions !== null) {
    name = nameOrOptions.name || '';
    decisionsJson = typeof nameOrOptions.decisionsJson === 'string'
      ? nameOrOptions.decisionsJson
      : JSON.stringify(nameOrOptions.decisionsJson || {});
    recordsJson = typeof nameOrOptions.recordsJson === 'string'
      ? nameOrOptions.recordsJson
      : (nameOrOptions.recordsJson ? JSON.stringify(nameOrOptions.recordsJson) : '');
    fileName = nameOrOptions.fileName || '';
    currentStep = Number(nameOrOptions.currentStep) || 1;
    items = Number(nameOrOptions.itemCount) || 0;
    approved = Number(nameOrOptions.approvedCount) || 0;
    customId = nameOrOptions.id || null;
  } else {
    name = nameOrOptions || '';
    decisionsJson = typeof sessionPayload === 'string'
      ? sessionPayload
      : JSON.stringify(sessionPayload || {});
    items = Number(itemCount) || 0;
    approved = Number(approvedCount) || 0;
  }

  function generateSecureId(prefix = 'sess') {
    if (typeof crypto !== 'undefined') {
      if (typeof crypto.randomUUID === 'function') {
        return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      }
      if (typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(6);
        crypto.getRandomValues(bytes);
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        return `${prefix}_${Date.now().toString(36)}_${hex}`;
      }
    }
    return `${prefix}_${Date.now().toString(36)}_${Date.now().toString(16).slice(-6)}`;
  }

  const safeName = (name || `Inventory ${new Date().toLocaleDateString()}`).trim().slice(0, 128);
  const sessionId = customId || generateSecureId('sess');
  const sessionPath = `users/${userId}/sessions/${sessionId}`;

  const payload = {
    id: sessionId,
    userId,
    name: safeName,
    decisionsJson,
    itemCount: items,
    approvedCount: approved,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (fileName) {
    payload.fileName = fileName.slice(0, 255);
  }
  // Max length enforced in firestore.rules is 750,000 characters
  if (recordsJson && recordsJson.length <= 750000) {
    payload.recordsJson = recordsJson;
  }
  if (currentStep) {
    payload.currentStep = currentStep;
  }

  try {
    await setDoc(doc(db, 'users', userId, 'sessions', sessionId), payload, { merge: true });
    return { id: sessionId, name: safeName, updatedAt: new Date() };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, sessionPath);
  }
}

export async function listCloudSessions() {
  if (!auth.currentUser) return [];
  const userId = auth.currentUser.uid;
  const sessionsPath = `users/${userId}/sessions`;
  try {
    const q = query(collection(db, 'users', userId, 'sessions'), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, sessionsPath);
  }
}

export async function loadCloudSession(sessionId) {
  if (!auth.currentUser) throw new Error('Please sign in to load sessions from the cloud');
  const userId = auth.currentUser.uid;
  const docPath = `users/${userId}/sessions/${sessionId}`;
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'sessions', sessionId));
    if (!snap.exists()) throw new Error('Session not found');
    return snap.data();
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, docPath);
  }
}

export async function deleteCloudSession(sessionId) {
  if (!auth.currentUser) throw new Error('Please sign in');
  const userId = auth.currentUser.uid;
  const docPath = `users/${userId}/sessions/${sessionId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'sessions', sessionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, docPath);
  }
}
