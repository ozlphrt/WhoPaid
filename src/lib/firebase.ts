import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { 
  getAuth, 
  Auth, 
  signInAnonymously, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  linkWithPopup,
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const FIREBASE_CONFIG_KEY = 'whopaid_firebase_config';

/**
 * Returns Firebase config from environment variables (Vite) if present,
 * or from localStorage if configured by user in Profile modal.
 */
export function getFirebaseConfig(): FirebaseConfig | null {
  // Check Vite environment variables first
  const envConfig: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
  };

  if (envConfig.apiKey && envConfig.projectId) {
    return envConfig;
  }

  // Fallback to localStorage stored config
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

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
  // Re-evaluate Firebase initialization
  initFirebase();
}

export const isFirebaseConfigured = (): boolean => {
  const config = getFirebaseConfig();
  return Boolean(config && config.apiKey && config.projectId);
};

// Singleton Firebase instances
let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let firebaseAuth: Auth | null = null;
let firebaseStorage: FirebaseStorage | null = null;

export function initFirebase(): {
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
} {
  const config = getFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    firebaseApp = null;
    firestoreDb = null;
    firebaseAuth = null;
    firebaseStorage = null;
    return { app: null, db: null, auth: null, storage: null };
  }

  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp(config);
    } else {
      firebaseApp = getApp();
    }

    try {
      firestoreDb = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch {
      firestoreDb = getFirestore(firebaseApp);
    }

    firebaseAuth = getAuth(firebaseApp);
    firebaseStorage = getStorage(firebaseApp);

    return {
      app: firebaseApp,
      db: firestoreDb,
      auth: firebaseAuth,
      storage: firebaseStorage
    };
  } catch (err) {
    console.error('[Firebase] Failed to initialize:', err);
    return { app: null, db: null, auth: null, storage: null };
  }
}

// Auto-initialize on import if configured
initFirebase();

export function getFirebaseInstances() {
  if (!firebaseApp && isFirebaseConfigured()) {
    initFirebase();
  }
  return {
    app: firebaseApp,
    db: firestoreDb,
    auth: firebaseAuth,
    storage: firebaseStorage
  };
}

/* =========================================================================
   Authentication Helpers
========================================================================= */

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export async function loginAnonymously(): Promise<FirebaseUser | null> {
  const { auth } = getFirebaseInstances();
  if (!auth) return null;
  try {
    const res = await signInAnonymously(auth);
    return res.user;
  } catch (err) {
    console.error('[Firebase Auth] Anonymous sign-in failed:', err);
    throw err;
  }
}

export async function loginWithGoogle(): Promise<FirebaseUser | null> {
  const { auth } = getFirebaseInstances();
  if (!auth) throw new Error('Firebase Auth is not configured.');

  try {
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      try {
        const res = await linkWithPopup(auth.currentUser, googleProvider);
        return res.user;
      } catch (linkErr: any) {
        if (linkErr.code === 'auth/credential-already-in-use') {
          const res = await signInWithPopup(auth, googleProvider);
          return res.user;
        }
        throw linkErr;
      }
    }
    const res = await signInWithPopup(auth, googleProvider);
    return res.user;
  } catch (err: any) {
    console.error('[Firebase Auth] Google Sign-In Error:', err);
    throw err;
  }
}

export async function logoutFirebase(): Promise<void> {
  const { auth } = getFirebaseInstances();
  if (auth) {
    await signOut(auth);
  }
}

export function subscribeToAuthChanges(callback: (user: FirebaseUser | null) => void): () => void {
  const { auth } = getFirebaseInstances();
  if (!auth) {
    callback(null);
    return () => {};
  }

  // Check if returning from a mobile redirect
  getRedirectResult(auth)
    .then((res) => {
      if (res?.user) {
        callback(res.user);
      }
    })
    .catch((err) => {
      console.warn('[Firebase Auth] Redirect result error:', err);
    });

  return onAuthStateChanged(auth, callback);
}
