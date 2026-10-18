/**
 * UR (brief-UR.md § 6, § 8 Fälle 6/7): `useEventAuthors` und `useResultEntryEvents` -- wer hat welchen Eintrag gemacht.
 * Echter `LocalMatchStore` + `MatchEngine` + `OutboxSender` (scheduleEngineHarness), Server-Lesefunktion gemockt mit
 * ihrer Antwort. Werte aus @FU-080 („Ergebnis eingetragen von Olli“, Spiel 9, 3:1) und @FU-065 (Trainer sieht keine
 * Konto-Angabe); Zwilling Z1 (eigener wartender Eintrag → eigener Name) und Z2 (Anzeige nur mit writeMatchData).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const auth = vi.hoisted(() => ({ isAuthenticated: true, name: 'Olli', role: 'owner' }));
vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: auth.isAuthenticated, user: auth.isAuthenticated ? { id: 'olli', name: auth.name } : null }),
}));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: auth.role, isLoading: false }),
}));
const authors = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../../../core/repositories/eventAuthorNamesRpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../core/repositories/eventAuthorNamesRpc')>()),
  readEventAuthorNames: authors.read,
}));

import { MatchEngineContext } from '../matchEngineContextInstance';
import { MatchCommands, type EngineEventWithSeq } from '../../../core/match/client';
import { FC_NORD, NOW, SPIEL_9, SV_SUED, makeScheduleEngine, settle, type ScheduleEngine } from '../../../test/scheduleEngineHarness';
import { useEventAuthors, resetEventAuthorsCache } from '../useEventAuthors';
import { useResultEntryEvents } from '../useResultEntryEvents';

const CTX = { matchId: SPIEL_9, teamAId: SV_SUED, teamBId: FC_NORD };
const resultEntry = (id: string, scores: Record<string, number>): EngineEventWithSeq =>
  ({ id, type: 'RESULT_ENTRY', actor: 'leitung', at: NOW - 60_000, section: null, clockMs: null, teamId: null, payload: { scores }, seq: 1 });

function wrapperFor(h: ScheduleEngine) {
  return ({ children }: { children: ReactNode }) => <MatchEngineContext.Provider value={h.value}>{children}</MatchEngineContext.Provider>;
}

/** Spiel 9 mit Ollis bestätigtem Direkteintrag 3:1 (vom Server nachgeladen). */
async function spiel9MitBestaetigtemEintrag(h: ScheduleEngine): Promise<void> {
  h.fetchConfirmed.mockResolvedValueOnce({ events: [resultEntry('e1', { [SV_SUED]: 3, [FC_NORD]: 1 })], newWatermark: 1 });
  await h.engine.ensureMatch(SPIEL_9, CTX, 'T');
  await h.engine.catchUp(SPIEL_9);
}

describe('UR useEventAuthors -- Name des Urhebers je Eintrag', () => {
  let h: ScheduleEngine;

  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    auth.isAuthenticated = true;
    auth.name = 'Olli';
    auth.role = 'owner';
    authors.read.mockReset();
    authors.read.mockResolvedValue(new Map());
    resetEventAuthorsCache();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
  });

  it('@FU-080 Olli (Turnierleitung): bestätigter Direkteintrag e1 → „Olli“ aus der Lesefunktion', async () => {
    h = await makeScheduleEngine();
    await spiel9MitBestaetigtemEintrag(h);
    authors.read.mockResolvedValue(new Map([['e1', { name: 'Olli', role: 'owner' }]]));
    const { result } = renderHook(() => useEventAuthors('T', SPIEL_9), { wrapper: wrapperFor(h) });

    await waitFor(() => { expect(result.current.nameOf('e1')).toBe('Olli'); });
    expect(authors.read.mock.calls[0][1]).toBe(SPIEL_9);
  });

  it('@FU-065 Gegenbeispiel: Trainer → kein Name und KEIN Aufruf der Lesefunktion', async () => {
    auth.role = 'trainer';
    h = await makeScheduleEngine();
    await spiel9MitBestaetigtemEintrag(h);
    authors.read.mockResolvedValue(new Map([['e1', { name: 'Olli', role: 'owner' }]]));
    const { result } = renderHook(() => useEventAuthors('T', SPIEL_9), { wrapper: wrapperFor(h) });
    await act(async () => { await settle(); });

    expect(result.current.nameOf('e1')).toBeNull();
    expect(authors.read).not.toHaveBeenCalled();
  });

  it('@FU-065 Helfer (collaborator, writeMatchData) sieht den Namen', async () => {
    auth.role = 'collaborator';
    h = await makeScheduleEngine();
    await spiel9MitBestaetigtemEintrag(h);
    authors.read.mockResolvedValue(new Map([['e1', { name: 'Olli', role: 'owner' }]]));
    const { result } = renderHook(() => useEventAuthors('T', SPIEL_9), { wrapper: wrapperFor(h) });

    await waitFor(() => { expect(result.current.nameOf('e1')).toBe('Olli'); });
  });

  it('L4 Gegenbeispiel: Gast (kein Konto) → kein Name, kein Aufruf', async () => {
    auth.isAuthenticated = false;
    h = await makeScheduleEngine('guest');
    await h.engine.ensureMatch(SPIEL_9, CTX, 'T');
    const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
    const id = await commands.enterResult(SPIEL_9, CTX, 'leitung', { [SV_SUED]: 3, [FC_NORD]: 1 }, undefined, false);
    const { result } = renderHook(() => useEventAuthors('T', SPIEL_9), { wrapper: wrapperFor(h) });
    await act(async () => { await settle(); });

    expect(result.current.nameOf(id ?? '')).toBeNull();
    expect(authors.read).not.toHaveBeenCalled();
  });

  it('Z1 @FU-080: Olli trägt 3:1 ohne Netz ein → sofort „Olli“ am wartenden Eintrag (eigener Name, ohne Server)', async () => {
    h = await makeScheduleEngine(undefined, { offline: true });
    await h.engine.ensureMatch(SPIEL_9, CTX, 'T');
    authors.read.mockRejectedValue(new TypeError('Failed to fetch'));
    const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
    const id = await commands.enterResult(SPIEL_9, CTX, 'leitung', { [SV_SUED]: 3, [FC_NORD]: 1 }, undefined, false);
    await settle();
    const { result } = renderHook(() => useEventAuthors('T', SPIEL_9), { wrapper: wrapperFor(h) });

    await waitFor(() => { expect(result.current.nameOf(id ?? '')).toBe('Olli'); });
  });

  it('Z1 Gegenbeispiel: fremder bestätigter Eintrag ohne Netz (Lesefunktion scheitert) → kein Name', async () => {
    h = await makeScheduleEngine();
    await spiel9MitBestaetigtemEintrag(h);
    authors.read.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useEventAuthors('T', SPIEL_9), { wrapper: wrapperFor(h) });
    await act(async () => { await settle(); });

    expect(result.current.nameOf('e1')).toBeNull();
  });

  it('Z1: Mitglied ohne label aus eigenen Daten → Profilname (Maria, „maria.k“)', async () => {
    auth.role = 'co-admin';
    auth.name = 'maria.k';
    h = await makeScheduleEngine(undefined, { offline: true });
    await h.engine.ensureMatch(SPIEL_9, CTX, 'T');
    const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
    const id = await commands.enterResult(SPIEL_9, CTX, 'leitung', { [SV_SUED]: 3, [FC_NORD]: 1 }, undefined, false);
    const { result } = renderHook(() => useEventAuthors('T', SPIEL_9), { wrapper: wrapperFor(h) });

    await waitFor(() => { expect(result.current.nameOf(id ?? '')).toBe('maria.k'); });
  });

  it('neu laden, wenn bestätigte Einträge dazukommen (Wasserzeichen steigt)', async () => {
    h = await makeScheduleEngine();
    await spiel9MitBestaetigtemEintrag(h);
    const { result } = renderHook(() => useEventAuthors('T', SPIEL_9), { wrapper: wrapperFor(h) });
    await waitFor(() => { expect(authors.read).toHaveBeenCalledTimes(1); });

    authors.read.mockResolvedValue(new Map([['e2', { name: 'Maria', role: 'co-admin' }]]));
    h.fetchConfirmed.mockResolvedValueOnce({
      events: [{ ...resultEntry('e2', { [SV_SUED]: 2, [FC_NORD]: 2 }), type: 'CORRECTION', payload: { scores: { [SV_SUED]: 2, [FC_NORD]: 2 }, reason: 'input_error', basedOn: 'e1' }, seq: 2 }],
      newWatermark: 2,
    });
    await act(async () => { await h.engine.catchUp(SPIEL_9); await settle(); });

    await waitFor(() => { expect(result.current.nameOf('e2')).toBe('Maria'); });
    expect(authors.read).toHaveBeenCalledTimes(2);
  });
});

describe('UR useResultEntryEvents -- Direkteinträge eines Spiels für das Protokoll', () => {
  let h: ScheduleEngine;
  beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); });
  afterEach(() => { h.engine.stop(); vi.unstubAllGlobals(); });

  it('@FU-080 Spiel 9 mit Ollis Direkteintrag → ein RESULT_ENTRY, Turnier „T“ aus der Spielkopie', async () => {
    h = await makeScheduleEngine();
    await spiel9MitBestaetigtemEintrag(h);
    const { result } = renderHook(() => useResultEntryEvents(SPIEL_9), { wrapper: wrapperFor(h) });

    await waitFor(() => { expect(result.current).toEqual({ tournamentId: 'T', ids: ['e1'] }); });
  });

  it('Gegenbeispiel: ohne Engine-Kontext oder ohne Spiel → keine Einträge', () => {
    h = { engine: { stop: () => undefined } } as unknown as ScheduleEngine;
    const { result } = renderHook(() => useResultEntryEvents(undefined));
    expect(result.current).toEqual({ tournamentId: null, ids: [] });
  });
});
