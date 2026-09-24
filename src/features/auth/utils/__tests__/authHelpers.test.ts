/**
 * authHelpers — checkOAuthOnlyUser (R6)
 *
 * Vor R6 fragte diese Funktion direkt `.from('profiles').select('auth_provider').eq('email', …)`
 * ab. Die Migration 20260924_001_restrict_profiles.sql entzieht anon/authenticated das
 * SELECT-Recht auf die Spalte "email" (F3 — E-Mail-Adressen waren live für jeden lesbar), die
 * Abfrage läuft deshalb jetzt über die SECURITY-DEFINER-RPC "auth_provider_for_email". Rückgabe-
 * form, Fehlerpfade und Logik müssen exakt gleich bleiben (task-R6-brief.md) — diese Tests
 * belegen das gegen die NEUE (RPC-basierte) Implementierung.
 *
 * @see ../authHelpers.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: rpcMock },
  isSupabaseConfigured: true,
}));

import { checkOAuthOnlyUser } from '../authHelpers';

describe('checkOAuthOnlyUser (RPC auth_provider_for_email)', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('normalisiert die E-Mail-Adresse (lowercase/trim) beim RPC-Aufruf', async () => {
    rpcMock.mockResolvedValue({ data: 'email', error: null });

    await checkOAuthOnlyUser('  User@Example.COM  ');

    expect(rpcMock).toHaveBeenCalledWith('auth_provider_for_email', { p_email: 'user@example.com' });
  });

  it('meldet isOAuthOnly=true für den Provider google', async () => {
    rpcMock.mockResolvedValue({ data: 'google', error: null });

    const result = await checkOAuthOnlyUser('user@example.com');

    expect(result).toEqual({ isOAuthOnly: true, provider: 'google' });
  });

  it('meldet isOAuthOnly=false für den Provider email', async () => {
    rpcMock.mockResolvedValue({ data: 'email', error: null });

    const result = await checkOAuthOnlyUser('user@example.com');

    expect(result).toEqual({ isOAuthOnly: false, provider: 'email' });
  });

  it('meldet isOAuthOnly=false, wenn die RPC NULL liefert (kein Konto zu dieser Adresse)', async () => {
    // R6 Fixrunde 1 (L3): Seit 20260924_001 liefert die RPC serverseitig
    // "coalesce(auth_provider, 'email')" statt der rohen Spalte. NULL bedeutet dadurch
    // eindeutig "keine Zeile zu dieser Adresse" — ein Profil MIT NULL-auth_provider (z.B. sehr
    // alte/manuell veränderte Zeilen) würde vor dem Fix hier fälschlich als "nicht existent"
    // erscheinen, jetzt liefert die RPC dafür 'email'. Aus Sicht dieses Mocks (er simuliert die
    // bereits normalisierte Rückgabe der RPC) ändert sich am erwarteten Verhalten nichts.
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await checkOAuthOnlyUser('unbekannt@example.com');

    expect(result).toEqual({ isOAuthOnly: false, provider: 'unknown', error: 'User not found' });
  });

  it('nutzt bei einem RPC-Fehler weiterhin den bisherigen Fehlerpfad (error.message durchreichen)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'irgendein Fehler', code: 'XXXXX' } });

    const result = await checkOAuthOnlyUser('user@example.com');

    expect(result.isOAuthOnly).toBe(false);
    expect(result.provider).toBe('unknown');
    expect(result.error).toBe('irgendein Fehler');
  });

  it('erkennt einen Netzwerkfehler am Meldungstext ("fetch")', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });

    const result = await checkOAuthOnlyUser('user@example.com');

    expect(result.error).toBe('Network error during check');
  });

  it('fängt eine geworfene Exception ab und meldet einen Netzwerkfehler bei "Load failed"', async () => {
    rpcMock.mockRejectedValue(new Error('Load failed'));

    const result = await checkOAuthOnlyUser('user@example.com');

    expect(result).toEqual({ isOAuthOnly: false, provider: 'unknown', error: 'Network error during check' });
  });
});
