/**
 * useFreshEntryCommands (Aufgabe 3.4): die Nummer als Nachtrag (AMEND) und das Zurücknehmen (RETRACT) gegen die echte Engine
 * (fake-indexeddb), auch wenn kein neues Rendern die Engine-Ansicht schon übernommen hat. Szenarien: @SL-019, @SL-084, RF3.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import i18n from 'i18next';
import { alsUebersetzer } from '../../model/alsUebersetzer';
import { HARNESS_MATCH_ID as MATCH_ID, engineWrapper, laufendesEngineSpiel } from '../../__tests__/engineHarnessSupport';
import { useFreshEntryCommands } from '../useFreshEntryCommands';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();
vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

const t = alsUebersetzer(i18n.getFixedT('de', 'cockpit'));

describe('useFreshEntryCommands', () => {
  it('Nummer direkt nach dem Speichern des Tors, bevor ein neues Rendern die Engine-Ansicht übernommen hat → AMEND am Tor', async () => {
    const { value, commands, ctx } = await laufendesEngineSpiel();
    const { result } = renderHook(() => useFreshEntryCommands({ tournamentId: 'tour-1', matchId: MATCH_ID, teamAId: ctx.teamAId, teamBId: ctx.teamBId, melde: vi.fn(), t }), { wrapper: engineWrapper(value) });
    const torId = await commands.goal(MATCH_ID, ctx, 'leitung', ctx.teamAId, false); // kein rerender dazwischen
    await act(async () => { await result.current.nummer(torId!, 7); });
    expect(value.engine.view(MATCH_ID)?.result.state.details[torId!]?.playerNumber).toBe(7);
  });

  it('zuruecknehmen nimmt das Tor zurück (RETRACT), der Stand geht auf 0:0', async () => {
    const { value, commands, ctx } = await laufendesEngineSpiel();
    const { result } = renderHook(() => useFreshEntryCommands({ tournamentId: 'tour-1', matchId: MATCH_ID, teamAId: ctx.teamAId, teamBId: ctx.teamBId, melde: vi.fn(), t }), { wrapper: engineWrapper(value) });
    const torId = await commands.goal(MATCH_ID, ctx, 'leitung', ctx.teamAId, false);
    await act(async () => { await result.current.zuruecknehmen(torId!); });
    const log = value.engine.view(MATCH_ID)?.log ?? [];
    expect(log.some((e) => e.type === 'RETRACT' && e.targetId === torId)).toBe(true);
  });

  it('Gegenbeispiel: eine unbekannte Ereignis-ID meldet einen Fehler (Stufe 2), nichts wird still verschluckt', async () => {
    const { value, ctx } = await laufendesEngineSpiel();
    const melde = vi.fn();
    const { result } = renderHook(() => useFreshEntryCommands({ tournamentId: 'tour-1', matchId: MATCH_ID, teamAId: ctx.teamAId, teamBId: ctx.teamBId, melde, t }), { wrapper: engineWrapper(value) });
    await act(async () => { await result.current.nummer('gibt-es-nicht', 7); });
    expect(melde).toHaveBeenCalledWith(2, 'Diese Aktion ist gerade nicht möglich.');
  });

  it('Gegenbeispiel: ohne Engine-Kontext (Altspiel) tut nummer nichts und wirft nicht', async () => {
    const melde = vi.fn();
    const { result } = renderHook(() => useFreshEntryCommands({ tournamentId: 'tour-1', matchId: MATCH_ID, teamAId: 'a', teamBId: 'b', melde, t }));
    await act(async () => { await result.current.nummer('x', 7); });
    expect(melde).not.toHaveBeenCalled();
  });
});
