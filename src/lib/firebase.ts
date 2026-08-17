// Firebase Integration Layer for WhoPaid
// Supports optional Firebase Auth, Firestore real-time sync, and Firebase Storage for receipts.
// Automatically falls back to Dexie.js offline-first local mode when offline or if Firebase credentials are unconfigured.

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const FIREBASE_CONFIG_KEY = 'whopaid_firebase_config';

export function getStoredFirebaseConfig(): FirebaseConfig | null {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredFirebaseConfig(config: FirebaseConfig | null) {
  if (!config) {
    localStorage.removeItem(FIREBASE_CONFIG_KEY);
  } else {
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
  }
}

export const isFirebaseConfigured = (): boolean => {
  return getStoredFirebaseConfig() !== null;
};
