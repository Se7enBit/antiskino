import crypto from 'crypto';

import { inlineScriptHashes, originOf, policyFor, withPolicy } from '../csp';

const hydrate = 'globalThis.__EXPO_ROUTER_HYDRATE__=true;';
const hashOf = (body: string) =>
  `'sha256-${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}'`;
const page = `<html lang="el"><head><meta charSet="utf-8"/><script type="application/ld+json">{"a":1}</script></head><body><script src="/antiskino/_expo/a.js" defer=""></script><script id="_R_">${hydrate}</script></body></html>`;

describe('csp post-export step', () => {
  it('hashes the inline scripts that run, not data blocks or external files', () => {
    expect(inlineScriptHashes(page)).toEqual([hashOf(hydrate)]);
  });

  it('allows the Supabase project (HTTPS and WebSocket), Sentry and the map', () => {
    const policy = policyFor(page, {
      supabaseUrl: 'https://abc.supabase.co',
      sentryDsn: 'https://key@o1.ingest.de.sentry.io/2',
    });
    expect(policy).toContain(`script-src 'self' ${hashOf(hydrate)};`);
    expect(policy).toContain(
      "connect-src 'self' https://tiles.openfreemap.org https://abc.supabase.co wss://abc.supabase.co https://o1.ingest.de.sentry.io;",
    );
    expect(policy).toContain("img-src 'self' data: blob: https://abc.supabase.co;");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain('unsafe-eval');
  });

  it('leaves out what is not configured', () => {
    const policy = policyFor('<html><head></head></html>', {});
    expect(policy).toContain("script-src 'self';");
    expect(policy).toContain("connect-src 'self' https://tiles.openfreemap.org;");
    expect(originOf('not a url')).toBeNull();
  });

  it('puts the policy first in <head>, once', () => {
    const once = withPolicy(page, {});
    expect(once).toMatch(/^<html lang="el"><head><meta http-equiv="Content-Security-Policy" /);
    expect(withPolicy(once, {})).toBe(once);
  });
});
