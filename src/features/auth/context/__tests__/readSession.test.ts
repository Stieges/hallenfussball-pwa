/**
 * C-SITZUNG-STILL, Fixrunde 2 (Hinweis): `hasStoredAuthToken` erkennt nur den Schlüssel des eigenen Projekts.
 * Ein alter oder fremder `sb-…-auth-token` (etwa eines anderen Projekts auf localhost) zählt nicht, sonst würde
 * ein INITIAL_SESSION ohne Sitzung fälschlich als „Netzfehler, angemeldet bleiben“ gelten (@AN-019).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => {
  class MapStorage {
    private data = new Map<string, string>();
    getItem(key: string): string | null { return this.data.get(key) ?? null; }
    setItem(key: string, value: string): void { this.data.set(key, String(value)); }
    removeItem(key: string): void { this.data.delete(key); }
    key(index: number): string | null { return Array.from(this.data.keys())[index] ?? null; }
    get length(): number { return this.data.size; }
    clear(): void { this.data.clear(); }
  }
  return { local: new MapStorage(), session: new MapStorage() };
});

vi.mock('../../../../core/utils/safeStorage', () => ({
  safeLocalStorage: store.local,
  safeSessionStorage: store.session,
}));

vi.mock('../../services/profileCacheService', () => ({
  clearProfileCache: vi.fn(async () => undefined),
}));

import { createClient } from '@supabase/supabase-js';
import { hasStoredAuthToken } from '../readSession';

const client = createClient('http://localhost:54321', 'anon-key', {
  auth: { storage: store.local, autoRefreshToken: false, persistSession: false },
  global: { fetch: async () => new Response(null, { status: 204 }) },
});

describe('hasStoredAuthToken – nur der eigene Projekt-Schlüssel', () => {
  beforeEach(() => {
    store.local.clear();
  });

  it('eigener Schlüssel (sb-localhost-auth-token) zählt', () => {
    store.local.setItem('sb-localhost-auth-token', '{}');
    expect(hasStoredAuthToken(client)).toBe(true);
  });

  it('Gegenbeispiel: Schlüssel eines anderen Projekts zählt nicht', () => {
    store.local.setItem('sb-otherproject-auth-token', '{}');
    expect(hasStoredAuthToken(client)).toBe(false);
  });

  it('Gegenbeispiel: kein Schlüssel', () => {
    expect(hasStoredAuthToken(client)).toBe(false);
  });
});
