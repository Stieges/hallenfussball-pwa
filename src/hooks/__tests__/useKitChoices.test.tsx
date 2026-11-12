/**
 * Anbindung der Leibchen-Wahl an React (Leibchen 2b, Punkt 3): Toms Cockpit zeigt die Wahl sofort über der Turnierkopie (@SL-226), wartende Einträge
 * gehen raus (@SL-216), Server-Zeilen und fremde Änderungen werden erkannt (@SL-228), ein lokaler Anpfiff nimmt wartende Einträge mit (@SL-202).
 * Testwerte aus dem Gherkin (docs/anforderungen/2026-10-02_spiel-leiten.md), nicht aus dem Code.
 */
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { AuthContext } from '../../features/auth/context/AuthContext';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tournament } from '../../types/tournament';
import { teamSlot } from '../../core/models/matchSlot';

const sendMock = vi.fn();
/** Frischer Stand vom Server: im Test steuerbar (`frischMock`), Vorgabe „noch nicht angepfiffen“. */
const frischMock = vi.fn(async (ids: readonly string[]) => new Map(ids.map((id) => [id, { kickedOff: false }])));
vi.mock('../../core/repositories/matchKitSetRpc', () => ({ sendMatchKitSet: (...args: unknown[]) => sendMock(...args), loadMatchKickoffStates: (_client: unknown, ids: readonly string[]) => frischMock(ids) }));
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {} }));
const engineLog = vi.hoisted(() => ({ log: [] as unknown[] }));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => ({ engine: { view: () => (engineLog.log.length === 0 ? null : { log: engineLog.log, confirmedCount: 0 }) } }),
}));
vi.mock('../useEngineMatches', () => ({ buildValidMatches: () => [{ matchId: 'spiel-2', externalId: 'spiel-2' }] }));
vi.mock('../../core/device/deviceId', () => ({ getDeviceId: () => 'gerät-test' }));

import { useKitChoiceOverlay, useKitChoices } from '../useKitChoices';
import { kitChoiceQueueFor } from '../../features/match-engine/kitChoiceRegistry';

const WAGING = '00000000-0000-4000-8000-0000000000a1';
const PETTING = '00000000-0000-4000-8000-0000000000a2';
const GELB = '#FFCC00';
const BLAU = '#1565C0';

function turnier(match: Record<string, unknown> = {}): Tournament {
  return {
    id: 'turnier-1',
    teams: [{ id: WAGING, name: 'TSV Waging 1', colors: { primary: BLAU } }, { id: PETTING, name: 'TSV Petting', colors: { primary: BLAU } }],
    matches: [{ id: 'spiel-2', round: 1, field: 1, slotA: teamSlot(WAGING), slotB: teamSlot(PETTING), matchStatus: 'scheduled', ...match }],
  } as unknown as Tournament;
}

const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthContext.Provider, { value: { user: { id: 'konto-test-1', globalRole: 'user' } } as never }, children);

describe('useKitChoices / useKitChoiceOverlay', () => {
  beforeEach(() => {
    localStorage.clear();
    sendMock.mockReset();
    frischMock.mockClear();
    const queue = kitChoiceQueueFor('konto-test-1');
    for (const entry of [...queue.entries()]) { queue.discardStarted(new Set([entry.matchId])); }
  });

  it('@SL-226 „Bestätigen“ ohne Netz: Toms Cockpit zeigt die Weste sofort, der Eintrag wartet („wird gesendet“)', async () => {
    sendMock.mockResolvedValue({ kind: 'offline' });
    const t = turnier();
    const { result } = renderHook(() => ({ api: useKitChoices(), shown: useKitChoiceOverlay(t) }), { wrapper });
    expect(result.current.shown?.matches[0].kit).toBeUndefined();
    await act(async () => { result.current.api.choose({ matchId: 'spiel-2', decision: 'bib', bibSide: 'a', bibColor: GELB }, t); });
    expect(result.current.shown?.matches[0]).toMatchObject({ kitDecision: 'bib', kit: { a: GELB, bibSide: 'a' } });
    expect(result.current.api.entries[0]).toMatchObject({ status: 'pending', teams: { a: WAGING, b: PETTING }, deviceId: 'gerät-test' });
    expect(sendMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ matchId: 'spiel-2', decision: 'bib', bibSide: 'a', bibColor: GELB }));
  });

  it('@SL-228 der Server hat die Wahl eines anderen Geräts: der Eintrag verschwindet, die Meldung steht da', async () => {
    sendMock.mockResolvedValue({ kind: 'saved', phase: 'before', decision: 'bib' });
    const t = turnier();
    const { result, rerender } = renderHook(({ turnierStand }) => ({ api: useKitChoices(), shown: useKitChoiceOverlay(turnierStand) }), { initialProps: { turnierStand: t }, wrapper });
    await act(async () => { result.current.api.choose({ matchId: 'spiel-2', decision: 'bib', bibSide: 'a', bibColor: GELB }, t); });
    expect(result.current.api.entries[0].status).toBe('sent');
    const fremd = turnier({ kitDecision: 'bib', kit: { b: '#FF9800', bibSide: 'b' } });
    await act(async () => { rerender({ turnierStand: fremd }); });
    expect(result.current.api.entries).toHaveLength(0);
    expect(result.current.api.notices[0]).toMatchObject({ kind: 'changedElsewhere', matchId: 'spiel-2' });
    expect(result.current.shown?.matches[0].kit).toEqual({ b: '#FF9800', bibSide: 'b' });
  });

  it('@SL-229 weist der Server ab, nimmt das Cockpit die Weste zurück und sagt es', async () => {
    sendMock.mockResolvedValue({ kind: 'rejected', code: 'MATCH_FINISHED' });
    const t = turnier();
    const { result } = renderHook(() => ({ api: useKitChoices(), shown: useKitChoiceOverlay(t) }), { wrapper });
    await act(async () => { result.current.api.choose({ matchId: 'spiel-2', decision: 'bib', bibSide: 'a', bibColor: GELB }, t); });
    expect(result.current.shown?.matches[0].kit).toBeUndefined();
    expect(result.current.api.notices[0]).toMatchObject({ kind: 'rejected', code: 'MATCH_FINISHED' });
  });

  it('Gegenbeispiel: ein Spiel, das es nicht gibt, merkt nichts vor und sendet nichts', async () => {
    const t = turnier();
    const { result } = renderHook(() => useKitChoices(), { wrapper });
    await act(async () => { result.current.choose({ matchId: 'gibt-es-nicht', decision: 'none' }, t); });
    expect(result.current.entries).toHaveLength(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  const ANPFIFF = { type: 'MATCH_START', payload: { kit: { a: BLAU, b: BLAU } } };

  it('@SL-214 nach „Anpfiff rückgängig“ (MATCH_START bleibt im Log, Spiel wieder angesetzt) bleibt eine danach bestätigte Wahl und geht raus', async () => {
    engineLog.log = [ANPFIFF];
    sendMock.mockResolvedValue({ kind: 'saved', phase: 'before', decision: 'bib' });
    const t = turnier({ matchStatus: 'scheduled' });
    const { result } = renderHook(() => ({ api: useKitChoices(), shown: useKitChoiceOverlay(t) }), { wrapper });
    await act(async () => { result.current.api.choose({ matchId: 'spiel-2', decision: 'bib', bibSide: 'a', bibColor: GELB }, t); });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(result.current.api.entries[0]).toMatchObject({ status: 'sent' });
    engineLog.log = [];
  });

  it('@SL-202 hat dieses Gerät das Spiel gerade angepfiffen (läuft, MATCH_START im Log), entfällt die wartende Wahl still: der Anpfiff trägt sie', async () => {
    engineLog.log = [ANPFIFF];
    sendMock.mockResolvedValue({ kind: 'offline' });
    const vorher = turnier({ matchStatus: 'scheduled' });
    const { result, rerender } = renderHook(({ t }) => ({ api: useKitChoices(), shown: useKitChoiceOverlay(t) }), { initialProps: { t: vorher }, wrapper });
    await act(async () => { result.current.api.choose({ matchId: 'spiel-2', decision: 'bib', bibSide: 'a', bibColor: GELB }, vorher); });
    expect(result.current.api.entries).toHaveLength(1);
    await act(async () => { rerender({ t: turnier({ matchStatus: 'running' }) }); });
    expect(result.current.api.entries).toHaveLength(0);
    expect(result.current.api.notices).toHaveLength(0);
    engineLog.log = [];
  });

  it('@SL-229 Zeile 1 hat ein anderes Gerät angepfiffen (kein MATCH_START hier), wird die wartende Wahl verworfen und gemeldet', async () => {
    engineLog.log = [];
    sendMock.mockResolvedValue({ kind: 'offline' });
    const vorher = turnier({ matchStatus: 'scheduled' });
    const { result, rerender } = renderHook(({ t }) => ({ api: useKitChoices(), shown: useKitChoiceOverlay(t) }), { initialProps: { t: vorher }, wrapper });
    await act(async () => { result.current.api.choose({ matchId: 'spiel-2', decision: 'bib', bibSide: 'a', bibColor: GELB }, vorher); });
    await act(async () => { rerender({ t: turnier({ matchStatus: 'running', kit: { a: BLAU, b: BLAU } }) }); });
    expect(result.current.api.entries).toHaveLength(0);
    expect(result.current.api.notices[0]).toMatchObject({ kind: 'tooLate' });
  });

  it('@SL-229 Zeile 1 Handy der Leitung offline, bestätigt, ein anderes Gerät pfeift an, das Netz kommt zurück: die alte Turnierkopie zeigt es noch nicht – es wird NICHT gesendet, „zu spät“', async () => {
    engineLog.log = [];
    sendMock.mockResolvedValue({ kind: 'offline' });
    const alt = turnier({ matchStatus: 'scheduled' });
    const { result } = renderHook(() => ({ api: useKitChoices(), shown: useKitChoiceOverlay(alt) }), { wrapper });
    await act(async () => { result.current.api.choose({ matchId: 'spiel-2', decision: 'bib', bibSide: 'a', bibColor: GELB }, alt); });
    expect(result.current.api.entries[0]).toMatchObject({ status: 'pending' });
    sendMock.mockReset();
    sendMock.mockResolvedValue({ kind: 'saved', phase: 'live', decision: 'bib' });
    frischMock.mockResolvedValue(new Map([['spiel-2', { kickedOff: true }]])); // der Server weiß es, die Kopie noch nicht
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(sendMock).not.toHaveBeenCalled();
    expect(result.current.api.entries).toHaveLength(0);
    expect(result.current.api.notices[0]).toMatchObject({ kind: 'tooLate' });
    frischMock.mockImplementation(async (ids) => new Map(ids.map((id) => [id, { kickedOff: false }])));
  });
});
