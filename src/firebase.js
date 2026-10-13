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

import { WORKSPACE_SCOPES } from './workspace.js';

let cachedAccessToken = null;

export function getAccessToken() {
  return cachedAccessToken;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  for (const s of WORKSPACE_SCOPES) {
    provider.addScope(s);
  }
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
      if (!snap.exists()) {
        await setDoc(userRef, {
          id: user.uid,
          email: user.email || '',
          createdAt: serverTimestamp(),
        });
      }
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

export async function saveCloudSession(name, sessionPayload, itemCount = 0, approvedCount = 0) {
  if (!auth.currentUser) throw new Error('Please sign in to save sessions to the cloud');
  const userId = auth.currentUser.uid;
  const safeName = (name || `Session ${new Date().toLocaleDateString()}`).trim().slice(0, 128);
  const sessionId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const sessionPath = `users/${userId}/sessions/${sessionId}`;

  const payload = {
    id: sessionId,
    userId,
    name: safeName,
    decisionsJson: typeof sessionPayload === 'string' ? sessionPayload : JSON.stringify(sessionPayload),
    itemCount: Number(itemCount) || 0,
    approvedCount: Number(approvedCount) || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', userId, 'sessions', sessionId), payload);
    return { id: sessionId, name: safeName };
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
