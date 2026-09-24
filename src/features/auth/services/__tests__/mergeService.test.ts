/**
 * mergeService — checkEmailExists (R6)
 *
 * Vor R6 fragte diese Funktion direkt `.from('profiles').select('id').eq('email', …)` ab.
 * 20260924_001_restrict_profiles.sql entzieht anon/authenticated das SELECT-Recht auf die
 * Spalte "email" (F3), die Abfrage läuft deshalb jetzt über dieselbe SECURITY-DEFINER-RPC wie
 * authHelpers.ts#checkOAuthOnlyUser (auth_provider_for_email), ausgewertet mit `!== null`
 * (task-R6-brief.md). Der MERGE_ACCOUNTS-Feature-Flag-Guard bleibt unverändert.
 *
 * @see ../mergeService.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpcMock, isFeatureEnabledMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  isFeatureEnabledMock: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: rpcMock },
  isSupabaseConfigured: true,
}));

vi.mock('../../../../config', () => ({
  isFeatureEnabled: isFeatureEnabledMock,
}));

import { checkEmailExists } from '../mergeService';

describe('checkEmailExists (RPC auth_provider_for_email)', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    isFeatureEnabledMock.mockReset();
    isFeatureEnabledMock.mockReturnValue(true);
  });

  it('liefert false, ohne die RPC aufzurufen, wenn MERGE_ACCOUNTS deaktiviert ist', async () => {
    isFeatureEnabledMock.mockReturnValue(false);

    const result = await checkEmailExists('user@example.com');

    expect(result).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('normalisiert die E-Mail-Adresse (lowercase/trim) beim RPC-Aufruf', async () => {
    rpcMock.mockResolvedValue({ data: 'email', error: null });

    await checkEmailExists('  User@Example.COM  ');

    expect(rpcMock).toHaveBeenCalledWith('auth_provider_for_email', { p_email: 'user@example.com' });
  });

  it('liefert true, wenn die RPC einen auth_provider zurückgibt (Konto existiert)', async () => {
    rpcMock.mockResolvedValue({ data: 'email', error: null });

    await expect(checkEmailExists('user@example.com')).resolves.toBe(true);
  });

  it('liefert true auch für einen OAuth-Provider (nur Existenz zählt, nicht der Provider)', async () => {
    rpcMock.mockResolvedValue({ data: 'google', error: null });

    await expect(checkEmailExists('user@example.com')).resolves.toBe(true);
  });

  it('liefert false, wenn die RPC NULL zurückgibt (kein Konto zu dieser Adresse)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(checkEmailExists('unbekannt@example.com')).resolves.toBe(false);
  });

  it('liefert false bei einem RPC-Fehler', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(checkEmailExists('user@example.com')).resolves.toBe(false);
  });

  it('liefert false, wenn die RPC eine Exception wirft', async () => {
    rpcMock.mockRejectedValue(new Error('Load failed'));

    await expect(checkEmailExists('user@example.com')).resolves.toBe(false);
  });
});
