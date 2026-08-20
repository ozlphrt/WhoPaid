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
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider, 
  OAuthProvider,
  FacebookAuthProvider,
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

    // Firebase Auth uses durable local persistence by default in browsers.
    // Keeping the standard initializer also avoids OAuth compatibility issues
    // in installed PWAs and mobile browsers.
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

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  try {
    const res = await signInWithPopup(auth, provider);
    return res.user;
  } catch (err: any) {
    if (
      err.code === 'auth/popup-closed-by-user' ||
      err.code === 'auth/cancelled-popup-request'
    ) {
      return null;
    }
    // If popup is blocked by browser or running as a PWA, fallback to seamless redirect
    if (err.code === 'auth/popup-blocked' || isStandalone || isMobile) {
      try {
        await signInWithRedirect(auth, provider);
        return null;
      } catch (redirectErr) {
        console.error('[Firebase Auth] Redirect error:', redirectErr);
      }
    }
    console.error('[Firebase Auth] Google Sign-In Error:', err);
    throw err;
  }
}

export async function loginApple(): Promise<FirebaseUser | null> {
  const { auth } = getFirebaseInstances();
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  try {
    const res = await signInWithPopup(auth, provider);
    return res.user;
  } catch (err: any) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return null;
    console.error('[Firebase Auth] Apple Sign-In Error:', err);
    throw err;
  }
}

export async function loginMicrosoft(): Promise<FirebaseUser | null> {
  const { auth } = getFirebaseInstances();
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const provider = new OAuthProvider('microsoft.com');
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  try {
    const res = await signInWithPopup(auth, provider);
    return res.user;
  } catch (err: any) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return null;
    console.error('[Firebase Auth] Microsoft Sign-In Error:', err);
    throw err;
  }
}

export async function loginFacebook(): Promise<FirebaseUser | null> {
  const { auth } = getFirebaseInstances();
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const provider = new FacebookAuthProvider();
  try {
    const res = await signInWithPopup(auth, provider);
    return res.user;
  } catch (err: any) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return null;
    console.error('[Firebase Auth] Facebook Sign-In Error:', err);
    throw err;
  }
}

export async function loginEmail(email: string, pass: string): Promise<FirebaseUser> {
  const { auth } = getFirebaseInstances();
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const res = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return res.user;
}

export async function signupEmail(email: string, pass: string, displayName?: string): Promise<FirebaseUser> {
  const { auth } = getFirebaseInstances();
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const res = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (displayName && displayName.trim()) {
    await updateProfile(res.user, { displayName: displayName.trim() }).catch(console.warn);
  }
  return res.user;
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
