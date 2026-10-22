/**
 * useHelperAdminActions (A-18a, S7): Zulassen mit Prüfzahl (S-1), Ablehnen, Entziehen, Code erneuern – gegen die
 * RPC-Anbindung `helperAccessRpc` (gemockt). Der Server entscheidet; der Hook ändert nie selbst die Anzeige.
 * Szenarien: @HE-001 @HE-006 @HE-008 @HE-011 @HE-021 @HE-047 @HE-055 @HE-102 @HE-105 @HE-107 @LZ-044.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const rpc = vi.hoisted(() => ({
  ensure: vi.fn(),
  rotate: vi.fn(),
  decide: vi.fn(),
  change: vi.fn(),
}));
const online = vi.hoisted(() => ({ value: true }));
const sentry = vi.hoisted(() => vi.fn());

vi.mock('../../../../../core/repositories/helperAccessRpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../../core/repositories/helperAccessRpc')>()),
  callEnsureHelperCode: rpc.ensure,
  callRotateHelperCode: rpc.rotate,
  callDecideJoinRequest: rpc.decide,
  callChangeHelperAccess: rpc.change,
}));
vi.mock('../../../../../lib/supabase', () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock('../../../../../lib/sentry', () => ({ captureFeatureError: sentry }));
vi.mock('../../../../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: online.value, wasOffline: false }) }));

import { useHelperAdminActions } from '../useHelperAdminActions';

const CODE_OK = { ok: true, data: { result: 'OK', code: 'K7MQ4X9R2P', validUntil: '2026-11-28T23:00:00Z', openRequests: 2 } };

async function setup(enabled = true) {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(() => useHelperAdminActions('t1', enabled, onChanged));
  await waitFor(() => expect(hook.result.current.codeState).not.toBe('loading') );
  return { ...hook, onChanged };
}

describe('useHelperAdminActions', () => {
  beforeEach(() => {
    online.value = true;
    Object.values(rpc).forEach((m) => m.mockReset());
    sentry.mockReset();
    rpc.ensure.mockResolvedValue(CODE_OK);
  });

  describe('Code', () => {
    it('legt den Code beim Öffnen an bzw. holt ihn (ensure_helper_code)', async () => {
      const { result } = await setup();
      expect(rpc.ensure).toHaveBeenCalledTimes(1);
      expect(result.current.codeState).toBe('ready');
      expect(result.current.code?.code).toBe('K7MQ4X9R2P');
    });

    it('@LZ-044 Leitungs-Sicht: nach dem Abschluss gibt es keinen Code mehr (CLOSED)', async () => {
      rpc.ensure.mockResolvedValue({ ok: true, data: { result: 'CLOSED' } });
      const { result } = await setup();
      expect(result.current.codeState).toBe('closed');
      expect(result.current.code).toBeNull();
    });

    it('Gegenbeispiel (@HE-062): ohne Recht (42501) kein Code, Zustand noRight', async () => {
      rpc.ensure.mockResolvedValue({ ok: false, error: { kind: 'notAuthorized' } });
      const { result } = await setup();
      expect(result.current.codeState).toBe('noRight');
      expect(result.current.code).toBeNull();
    });

    it('Gegenbeispiel: deaktiviert (Helfer ohne Recht) ruft den Server nie an', async () => {
      const onChanged = vi.fn();
      renderHook(() => useHelperAdminActions('t1', false, onChanged));
      await new Promise((r) => setTimeout(r, 20));
      expect(rpc.ensure).not.toHaveBeenCalled();
    });

    it('@HE-008/@HE-102: Erneuern mit „ablehnen“ schickt decline, zeigt den neuen Code und lädt die Liste neu', async () => {
      const { result, onChanged } = await setup();
      rpc.rotate.mockResolvedValue({ ok: true, data: { result: 'OK', code: 'NEWCODE234', validUntil: '2026-11-28T23:00:00Z', openRequests: 0, declined: 2 } });
      let outcome = '';
      await act(async () => { outcome = await result.current.renewCode('decline'); });
      expect(rpc.rotate.mock.calls[0]?.slice(1)).toEqual(['t1', 'decline']);
      expect(outcome).toBe('done');
      expect(result.current.code?.code).toBe('NEWCODE234');
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('@HE-008: Erneuern mit „behalten“ schickt keep', async () => {
      const { result } = await setup();
      rpc.rotate.mockResolvedValue({ ok: true, data: { result: 'OK', code: 'NEWCODE234', validUntil: 'x', openRequests: 2, declined: 0 } });
      await act(async () => { await result.current.renewCode('keep'); });
      expect(rpc.rotate.mock.calls[0]?.[2]).toBe('keep');
    });
  });

  describe('Zulassen (S-1, @HE-105)', () => {
    it('schickt Anfrage, gewählte Prüfzahl und Feld an den Server und lädt danach die Liste neu', async () => {
      const { result, onChanged } = await setup();
      rpc.decide.mockResolvedValue({ ok: true, data: { result: 'OK', memberId: 'm1' } });
      let outcome = '';
      await act(async () => { outcome = await result.current.approve('r1', 47, 2); });
      expect(rpc.decide.mock.calls[0]?.slice(1)).toEqual(['r1', { accept: true, checkNumber: 47, field: 2 }]);
      expect(outcome).toBe('done');
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('@HE-040: „Ohne Feld“ geht als field: null an den Server', async () => {
      const { result } = await setup();
      rpc.decide.mockResolvedValue({ ok: true, data: { result: 'OK', memberId: 'm1' } });
      await act(async () => { await result.current.approve('r1', 47, null); });
      expect(rpc.decide.mock.calls[0]?.[2]).toEqual({ accept: true, checkNumber: 47, field: null });
    });

    it('Gegenbeispiel: falsche Zahl (CHECK_MISMATCH) – Ergebnis checkMismatch, die Liste wird NICHT neu geladen, keine Meldung', async () => {
      const { result, onChanged } = await setup();
      rpc.decide.mockResolvedValue({ ok: true, data: { result: 'CHECK_MISMATCH' } });
      let outcome = '';
      await act(async () => { outcome = await result.current.approve('r1', 82, 2); });
      expect(outcome).toBe('checkMismatch');
      expect(onChanged).not.toHaveBeenCalled();
      expect(result.current.notice).toBeNull();
    });

    it('@HE-006: schon entschieden – Hinweis mit dem Namen, Liste wird neu geladen', async () => {
      const { result, onChanged } = await setup();
      rpc.decide.mockResolvedValue({ ok: true, data: { result: 'ALREADY_DECIDED', status: 'accepted', decidedBy: 'Olli' } });
      let outcome = '';
      await act(async () => { outcome = await result.current.approve('r1', 47, 1); });
      expect(outcome).toBe('failed');
      expect(result.current.notice).toEqual({ kind: 'alreadyDecided', decidedBy: 'Olli' });
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('@HE-011: verfallene Anfrage – Hinweis „Anfrage verfallen“', async () => {
      const { result } = await setup();
      rpc.decide.mockResolvedValue({ ok: true, data: { result: 'EXPIRED' } });
      await act(async () => { await result.current.approve('r1', 47, 1); });
      expect(result.current.notice).toEqual({ kind: 'requestExpired' });
    });

    it('@HE-107: INVALID_FIELD (Programmierfehler) geht an Sentry, die Seite zeigt „nicht geklappt“, nichts wird neu geladen', async () => {
      const { result, onChanged } = await setup();
      rpc.decide.mockResolvedValue({ ok: false, error: { kind: 'invalidInput', reason: 'INVALID_FIELD' } });
      await act(async () => { await result.current.approve('r1', 47, 9); });
      expect(sentry).toHaveBeenCalledTimes(1);
      expect(result.current.notice).toEqual({ kind: 'failed' });
      expect(onChanged).not.toHaveBeenCalled();
    });
  });

  describe('Ablehnen', () => {
    it('schickt accept:false ohne Prüfzahl (Ablehnen braucht keine Zahl)', async () => {
      const { result, onChanged } = await setup();
      rpc.decide.mockResolvedValue({ ok: true, data: { result: 'OK', memberId: null } });
      await act(async () => { await result.current.decline('r1'); });
      expect(rpc.decide.mock.calls[0]?.slice(1)).toEqual(['r1', { accept: false }]);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('Entziehen und Nur zusehen (@HE-055)', () => {
    it('schickt revoke bzw. watch_only mit der Mitglieds-Nummer', async () => {
      const { result, onChanged } = await setup();
      rpc.change.mockResolvedValue({ ok: true, data: { result: 'OK' } });
      await act(async () => { await result.current.changeAccess('m1', 'revoke'); });
      await act(async () => { await result.current.changeAccess('m2', 'watch_only'); });
      expect(rpc.change.mock.calls.map((c) => c.slice(1))).toEqual([['m1', 'revoke'], ['m2', 'watch_only']]);
      // die Anzeige kommt vom Server: nach jeder gelungenen Änderung wird die Liste neu geladen
      expect(onChanged).toHaveBeenCalledTimes(2);
    });

    it('Gegenbeispiel (Entzug nur im Client): lehnt der Server ab, wird die Liste nicht neu geladen und die Aktion meldet failed', async () => {
      const { result, onChanged } = await setup();
      rpc.change.mockResolvedValue({ ok: false, error: { kind: 'notAuthorized' } });
      let outcome = '';
      await act(async () => { outcome = await result.current.changeAccess('m1', 'revoke'); });
      expect(outcome).toBe('failed');
      expect(onChanged).not.toHaveBeenCalled();
      expect(result.current.notice).toEqual({ kind: 'failed' });
    });
  });

  describe('Ohne Netz (@HE-047)', () => {
    it('Gegenbeispiel: ohne Netz geht kein Aufruf an den Server, nichts wird vorgemerkt, Hinweis „offline“', async () => {
      const { result, onChanged } = await setup();
      online.value = false;
      const { result: offline } = renderHook(() => useHelperAdminActions('t1', false, onChanged));
      await act(async () => {
        expect(await offline.current.approve('r1', 47, 1)).toBe('failed');
        expect(await offline.current.decline('r1')).toBe('failed');
        expect(await offline.current.changeAccess('m1', 'revoke')).toBe('failed');
        expect(await offline.current.changeAccess('m1', 'watch_only')).toBe('failed');
        expect(await offline.current.renewCode('keep')).toBe('failed');
      });
      expect(rpc.decide).not.toHaveBeenCalled();
      expect(rpc.change).not.toHaveBeenCalled();
      expect(rpc.rotate).not.toHaveBeenCalled();
      expect(onChanged).not.toHaveBeenCalled();
      expect(offline.current.notice).toEqual({ kind: 'offline' });
      expect(offline.current.isOnline).toBe(false);
      expect(result.current.code?.code).toBe('K7MQ4X9R2P');
    });

    it('ein Netzfehler beim Aufruf (Netz fällt mitten in der Aktion weg) meldet ebenfalls „offline“, ohne Sentry', async () => {
      const { result, onChanged } = await setup();
      rpc.decide.mockResolvedValue({ ok: false, error: { kind: 'network' } });
      await act(async () => { await result.current.approve('r1', 47, 1); });
      expect(result.current.notice).toEqual({ kind: 'offline' });
      expect(sentry).not.toHaveBeenCalled();
      expect(onChanged).not.toHaveBeenCalled();
    });
  });
});
