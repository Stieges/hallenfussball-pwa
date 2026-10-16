// @vitest-environment jsdom
/**
 * useRemoteSessionCheck (C-ABMELDE-HINWEIS-WETTLAUF) – der Hinweis „von einem anderen Gerät abgemeldet“
 * erscheint nur, wenn dieses Gerät sich nicht selbst abgemeldet hat (@AN-023, @AN-024).
 * Echter supabase-js-Client mit Fake-fetch (wie remoteSignOut.test.ts), Hook im jsdom.
 *
 * Warum `jsdom` für eine `.ts`-Datei: Der Client braucht eine funktionierende localStorage-Ablage.
 * Der localStorage-Mock in `setup.dom.ts` besteht nur aus `vi.fn()`-Stubs und speichert nichts. Die
 * Umgebung wird deshalb per Docblock gesetzt, nicht über die Liste `DOM_ONLY_TS_TESTS`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { safeLocalStorage, safeSessionStorage } from '../../../../core/utils/safeStorage';
import { supabase } from '../../../../lib/supabase';
import { hasSignedOutElsewhere, markOwnSignOut, useRemoteSessionCheck } from '../remoteSignOut';

const net = vi.hoisted(() => ({
  calls: [] as Array<{ url: string; method: string }>,
  respond: null as null | ((url: string, init?: RequestInit) => Promise<Response>),
}));

vi.mock('../../../../lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const { safeLocalStorage } = await import('../../../../core/utils/safeStorage');
  const fakeFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    net.calls.push({ url, method: init?.method ?? 'GET' });
    return net.respond ? net.respond(url, init) : Promise.resolve(new Response(null, { status: 204 }));
  };
  const client = createClient('http://localhost:54321', 'anon-key', {
    auth: { storage: safeLocalStorage, autoRefreshToken: false, persistSession: true },
    global: { fetch: fakeFetch },
  });
  return { supabase: client, isSupabaseConfigured: true };
});

const TOKEN_KEY = 'sb-localhost-auth-token';

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sessionFixture(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'user-a', role: 'authenticated', exp })}.signature`;
  return JSON.stringify({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'refresh-a',
    user: { id: 'user-a', aud: 'authenticated', email: 'a@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  });
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
  });
}

function requireClient() {
  if (!supabase) {throw new Error('Test-Client fehlt');}
  return supabase;
}

describe('useRemoteSessionCheck (C-ABMELDE-HINWEIS-WETTLAUF) – Hinweis nur bei fremdem Abmelden', () => {
  // Ohne setup.dom.ts gibt es kein automatisches cleanup: Hooks werden hier in afterEach ausgehängt,
  // auch wenn ein Test fehlschlägt, damit keine Listener übrig bleiben.
  const mounted: Array<() => void> = [];
  afterEach(() => {
    for (const unmount of mounted.splice(0)) {unmount();}
  });

  beforeEach(() => {
    net.calls.length = 0;
    safeLocalStorage.clear();
    safeSessionStorage.clear();
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture());
    net.respond = null;
  });

  /** Server hält die Antwort auf `GET /user` zurück, bis der Test sie freigibt. */
  function holdUserResponse(): { release: (status: number, body: unknown) => void } {
    let releaseFn: ((response: Response) => void) | null = null;
    net.respond = (url) => {
      if (url.includes('/auth/v1/user')) {
        return new Promise<Response>((resolve) => {
          releaseFn = resolve;
        });
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    };
    return {
      release: (status, body) => {
        releaseFn?.(jsonResponse(body, status));
      },
    };
  }

  it('@AN-023 @AN-024 Wettlauf: Prüfung läuft, Gerät meldet sich selbst ab, verspätete Ablehnung → kein Hinweis „anderes Gerät“', async () => {
    const held = holdUserResponse();
    const signOutLocal = vi.fn(() => Promise.resolve());
    const { unmount } = renderHook(() => useRemoteSessionCheck(requireClient(), true, signOutLocal));
    mounted.push(unmount);
    await waitFor(() => expect(net.calls.some((c) => c.url.includes('/auth/v1/user'))).toBe(true));

    // Eigenes Abmelden, während die Prüfung noch auf den Server wartet.
    markOwnSignOut();
    held.release(403, { code: 'session_not_found', message: 'gone' });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(hasSignedOutElsewhere()).toBe(false);
  });

  it('@AN-024 Gegenbeispiel: Abmeldung von einem anderen Gerät (kein eigenes Abmelden) → lokal abgemeldet und Hinweis', async () => {
    const held = holdUserResponse();
    const signOutLocal = vi.fn(() => Promise.resolve());
    const { unmount } = renderHook(() => useRemoteSessionCheck(requireClient(), true, signOutLocal));
    mounted.push(unmount);
    await waitFor(() => expect(net.calls.some((c) => c.url.includes('/auth/v1/user'))).toBe(true));

    held.release(403, { code: 'session_not_found', message: 'gone' });

    await waitFor(() => expect(hasSignedOutElsewhere()).toBe(true));
    expect(signOutLocal).toHaveBeenCalledTimes(1);
  });
});
