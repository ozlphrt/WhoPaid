import { createClient, type SupabaseClient, type User as SupabaseUser } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
  return url && anonKey ? { url, anonKey } : null;
}

export const isSupabaseConfigured = (): boolean => getSupabaseConfig() !== null;

const config = getSupabaseConfig();
const supabaseGlobal = globalThis as typeof globalThis & {
  __whopaidSupabaseClient?: SupabaseClient;
};

export const supabase = config
  ? (supabaseGlobal.__whopaidSupabaseClient ?? createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'whopaid_supabase_auth'
      }
    }))
  : null;

// Vite replaces this module during development. Reuse the existing client so
// only one auth listener owns the persisted session storage key.
if (import.meta.env.DEV && supabase) {
  supabaseGlobal.__whopaidSupabaseClient = supabase;
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function oauthRedirectUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

export async function loginAnonymously(): Promise<SupabaseUser | null> {
  const { data, error } = await requireClient().auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

async function loginWithOAuth(provider: 'google' | 'apple' | 'azure' | 'facebook'): Promise<null> {
  const options: {
    redirectTo: string;
    scopes?: string;
    queryParams?: Record<string, string>;
  } = {
    redirectTo: oauthRedirectUrl()
  };

  if (provider === 'google') {
    options.scopes = 'openid email profile';
    options.queryParams = { prompt: 'select_account' };
  } else if (provider === 'azure') {
    options.queryParams = { prompt: 'select_account' };
  }
  const { error } = await requireClient().auth.signInWithOAuth({ provider, options });
  if (error) throw error;
  return null;
}

export const loginWithGoogle = () => loginWithOAuth('google');
export const loginApple = () => loginWithOAuth('apple');
export const loginMicrosoft = () => loginWithOAuth('azure');
export const loginFacebook = () => loginWithOAuth('facebook');

export async function loginEmail(email: string, password: string): Promise<SupabaseUser> {
  const { data, error } = await requireClient().auth.signInWithPassword({
    email: email.trim(),
    password
  });
  if (error) throw error;
  if (!data.user) throw new Error('Sign in did not return a user.');
  return data.user;
}

export async function signupEmail(email: string, password: string, displayName?: string): Promise<SupabaseUser> {
  const { data, error } = await requireClient().auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: displayName?.trim() ? { full_name: displayName.trim() } : undefined,
      emailRedirectTo: oauthRedirectUrl()
    }
  });
  if (error) throw error;
  if (!data.user) throw new Error('Account creation did not return a user.');
  if (!data.session) throw new Error('Account created. Check your email to confirm it, then sign in.');
  return data.user;
}

export async function logoutSupabase(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

async function addGoogleAvatarFromProvider(
  user: SupabaseUser | null,
  providerToken?: string | null
): Promise<SupabaseUser | null> {
  if (!user || !providerToken) return user;

  const metadata = user.user_metadata ?? {};
  if (metadata.avatar_url || metadata.picture) return user;

  const isGoogleUser = user.app_metadata?.provider === 'google'
    || user.identities?.some(identity => identity.provider === 'google');
  if (!isGoogleUser) return user;

  try {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    if (!response.ok) return user;

    const profile = await response.json() as { picture?: unknown };
    if (typeof profile.picture !== 'string' || !profile.picture) return user;

    // AppContext persists this value in the user's RLS-protected profile row.
    // The short-lived Google provider token remains in memory and is never saved.
    return {
      ...user,
      user_metadata: {
        ...metadata,
        avatar_url: profile.picture,
        picture: profile.picture
      }
    };
  } catch (error) {
    console.warn('[Supabase Auth] Could not load Google profile photo:', error);
    return user;
  }
}

export function subscribeToAuthChanges(callback: (user: SupabaseUser | null) => void | Promise<void>): () => void {
  if (!supabase) {
    callback(null);
    return () => undefined;
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    // Supabase recommends keeping the auth callback synchronous. Deferring our
    // profile queries avoids locking the auth client during session changes.
    globalThis.setTimeout(() => {
      void addGoogleAvatarFromProvider(session?.user ?? null, session?.provider_token)
        .then(callback);
    }, 0);
  });
  return () => data.subscription.unsubscribe();
}

export type { SupabaseUser };
