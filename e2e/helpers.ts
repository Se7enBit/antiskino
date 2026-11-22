/// <reference types="node" />

import { execFileSync } from 'node:child_process';

import { expect, type Page } from '@playwright/test';

// Shared by the end-to-end tests: they run against the local Supabase stack
// (CI job "End-to-end"), which sets these variables; the defaults are the
// local stack's own.
const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const API_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
// The local stack's service key, a fixed demo value (never a real project's).
const SERVICE_KEY = process.env.E2E_SERVICE_KEY ?? '';

/** One value from the local database (psql, as the postgres superuser). */
export function sql(query: string): string {
  return execFileSync(
    'psql',
    [DB_URL, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', query],
    {
      encoding: 'utf8',
    },
  ).trim();
}

type Session = { access_token?: string; expires_in?: number };

/**
 * Signs a seed user in for the page, without the email code: the auth admin API
 * makes the one-time code that the email would carry, it's exchanged for a
 * session, and the session is put where the app keeps it (localStorage) before
 * the page loads.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  expect(SERVICE_KEY, 'E2E_SERVICE_KEY: the local stack’s service key').not.toBe('');
  const link = (await (
    await fetch(`${API_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'magiclink', email }),
    })
  ).json()) as { email_otp?: string; properties?: { email_otp?: string } };
  const token = link.email_otp ?? link.properties?.email_otp;
  expect(token, `a sign-in code for ${email}`).toBeTruthy();
  const session = (await (
    await fetch(`${API_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'magiclink', email, token }),
    })
  ).json()) as Session;
  expect(session.access_token, `a session for ${email}`).toBeTruthy();
  const stored = JSON.stringify({
    ...session,
    expires_at: Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
  });
  // supabase-js's key: sb-<first part of the API host>-auth-token.
  const key = `sb-${new URL(API_URL).hostname.split('.')[0]}-auth-token`;
  await page.addInitScript(
    ([name, value]) => {
      window.localStorage.setItem(name, value);
    },
    [key, stored] as const,
  );
}

/** Fails the test on any Content-Security-Policy violation the page reports. */
export function watchCsp(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  return violations;
}
