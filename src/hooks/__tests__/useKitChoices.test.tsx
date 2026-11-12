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
vi.mock('../../core/repositories/matchKitSetRpc', () => ({ sendMatchKitSet: (...args: unknown[]) => sendMock(...args) }));
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {} }));
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
});
