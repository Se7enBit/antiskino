import type { Session } from '@supabase/supabase-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import type { Language } from '@/i18n/languages';
import { getSupabase, hasSupabaseEnv } from '@/lib/supabase';

import { unregisterPush } from './push';

export type AuthStatus = 'loading' | 'unconfigured' | 'signedOut' | 'signedIn';

export type AuthState = { status: AuthStatus; session: Session | null };

const AuthContext = createContext<AuthState | null>(null);

/**
 * Tracks the Supabase session. Starts as `loading` (also in static HTML) and
 * settles once the stored session has been read.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    status: hasSupabaseEnv() ? 'loading' : 'unconfigured',
    session: null,
  }));

  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    const auth = getSupabase().auth;
    // Fires INITIAL_SESSION right away, then on every sign-in, refresh and sign-out.
    const { data } = auth.onAuthStateChange((_event, session) => {
      setState({ status: session ? 'signedIn' : 'signedOut', session });
    });
    // Native apps refresh tokens only while in the foreground.
    const appState =
      Platform.OS === 'web'
        ? undefined
        : AppState.addEventListener('change', (next) => {
            if (next === 'active') void auth.startAutoRefresh();
            else void auth.stopAutoRefresh();
          });
    return () => {
      data.subscription.unsubscribe();
      appState?.remove();
    };
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useAuth must be used inside <AuthProvider>');
  return state;
}

/** Emails a one-time sign-in code. New users are created with their UI language. */
export function useRequestCode() {
  return useMutation({
    mutationFn: async ({ email, language }: { email: string; language: Language }) => {
      const { error } = await getSupabase().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, data: { locale: language } },
      });
      if (error) throw error;
    },
  });
}

/** Signs in with the emailed code; AuthProvider picks up the new session. */
export function useVerifyCode() {
  return useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const { error } = await getSupabase().auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) throw error;
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // This device stops getting the user's pushes; sign-out goes ahead regardless.
      await unregisterPush().catch(() => undefined);
      const { error } = await getSupabase().auth.signOut();
      if (error) throw error;
    },
    onSettled: () => queryClient.clear(),
  });
}
