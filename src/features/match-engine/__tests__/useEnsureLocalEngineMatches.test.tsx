/**
 * A-08f3e3 (Plan A-08f3 v4 § 3): Spielplan-Einträge sind nach dem Neuladen sichtbar. Beim Laden des Turniers
 * lädt `useEngineOverlayForTournament` (über `useEnsureLocalEngineMatches`) die lokalen Kopien mit Einträgen:
 * Gast alle, Konto nur `pending`/`rejected`. Echter Store/Engine/Sender, „neu mounten“ = neue Engine auf derselben
 * IndexedDB. Szenarien: @FU-002 (offline nichts verloren), @FU-004, @FU-024 (Gast-Ergebnis), @FU-080.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { createElement, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { calculateStandings } from '../../../utils/calculations';
import { MatchCommands } from '../../../core/match/client';
import { MatchEngineContext } from '../matchEngineContextInstance';
import { useEngineOverlayForTournament } from '../../../hooks/useEngineOverlayForTournament';
import { FC_NORD, SPIEL_9, SV_SUED, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine } from '../../../test/scheduleEngineHarness';

const CTX_9 = { matchId: SPIEL_9, teamAId: SV_SUED, teamBId: FC_NORD };

async function eintragen(h: ScheduleEngine, a: number, b: number): Promise<void> {
  await h.engine.ensureMatch(SPIEL_9, CTX_9, 'T');
  const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
  await commands.enterResult(SPIEL_9, CTX_9, 'leitung', { [SV_SUED]: a, [FC_NORD]: b });
  await settle();
}

function mountOverlay(h: ScheduleEngine, tournament: Tournament) {
  const wrapper = ({ children }: { children: ReactNode }) => createElement(MatchEngineContext.Provider, { value: h.value }, children);
  return renderHook(() => useEngineOverlayForTournament(tournament), { wrapper });
}

const spiel9 = (t: Tournament | null) => t?.matches.find((m) => m.id === SPIEL_9);
const punkte = (t: Tournament | null, teamId: string) =>
  t ? calculateStandings(t.teams.filter((team) => team.group === 'A'), t.matches, t, 'A').find((s) => s.team.id === teamId)?.points : undefined;

describe('A-08f3e3 Sichtbar nach dem Neuladen', () => {
  const engines: ScheduleEngine[] = [];
  beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); });
  afterEach(() => {
    engines.splice(0).forEach((h) => h.engine.stop());
    vi.unstubAllGlobals();
  });
  const engine = async (accountId: string, offline = false) => { const h = await makeScheduleEngine(accountId, { offline }); engines.push(h); return h; };

  it('Gast trägt 2:0 ein, neu mounten → 2:0, Tabelle rechnet mit', async () => {
    await eintragen(await engine('guest'), 2, 0);

    const neu = await engine('guest');
    const tournament = scheduleTournament();
    const { result } = mountOverlay(neu, tournament);
    await act(async () => { await settle(); });

    expect(spiel9(result.current)).toMatchObject({ scoreA: 2, scoreB: 0, matchStatus: 'finished' });
    expect(punkte(result.current, SV_SUED)).toBe(3);
  });

  it('@FU-023 gespeichert ist 3:1, die Einträge ergeben 2:1 → der Spielplan zeigt nach dem Neuladen 2:1', async () => {
    await eintragen(await engine('guest'), 2, 1);

    const neu = await engine('guest');
    const gespeichert = scheduleTournament({ [SPIEL_9]: { scoreA: 3, scoreB: 1, matchStatus: 'finished' } });
    const { result } = mountOverlay(neu, gespeichert);
    await act(async () => { await settle(); });

    expect(spiel9(result.current)).toMatchObject({ scoreA: 2, scoreB: 1 });
  });

  it('Eigentümer offline 3:1, neu mounten → 3:1 (Eintrag wartet weiter)', async () => {
    const vorher = await engine('olli-e3', true); // kein Netz: Antwort kommt nie
    await eintragen(vorher, 3, 1);
    vorher.engine.stop();

    const neu = await engine('olli-e3', true);
    const { result } = mountOverlay(neu, scheduleTournament());
    await act(async () => { await settle(); });

    expect(spiel9(result.current)).toMatchObject({ scoreA: 3, scoreB: 1, matchStatus: 'finished' });
    expect((await neu.store.load('olli-e3', SPIEL_9))?.pending.map((event) => event.type)).toEqual(['RESULT_ENTRY']);
  });

  it('Plan e3 Punkt 1 (Konto: pending ODER rejected): Kopie mit nur abgelehnten Einträgen wird beim Laden geladen', async () => {
    const vorher = await engine('olli-abgelehnt');
    vorher.api.mockImplementation(async (_matchId, events) => ({
      results: events.map((event) => ({ id: event.id, status: 'rejected' as const, code: 'FORBIDDEN_ACTOR' })), state: null, serverTime: 1,
    }));
    await eintragen(vorher, 3, 1);
    const kopie = await vorher.store.load('olli-abgelehnt', SPIEL_9);
    expect([kopie?.pending.length, kopie?.rejected.length]).toEqual([0, 1]);
    vorher.engine.stop();

    const neu = await engine('olli-abgelehnt');
    const ensure = vi.spyOn(neu.engine, 'ensureMatch');
    mountOverlay(neu, scheduleTournament());
    await act(async () => { await settle(); });

    expect(ensure).toHaveBeenCalledWith(SPIEL_9, CTX_9, 'T');
  });

  it('I-2 @FU-004: Direkteintrag ohne Server-Ereignisse wird abgelehnt → Zeile wieder geplant ohne Ergebnis, Tabelle ohne das Ergebnis, ohne Neuladen', async () => {
    const h = await engine('olli-i2');
    let reject: () => void = () => undefined;
    h.api.mockImplementationOnce((_matchId, events) => new Promise((resolve) => {
      reject = () => resolve({ results: events.map((event) => ({ id: event.id, status: 'rejected' as const, code: 'FORBIDDEN_ACTOR' })), state: null, serverTime: 1 });
    }));
    const tournament = scheduleTournament();
    const { result } = mountOverlay(h, tournament);
    await act(async () => { await eintragen(h, 3, 1); });
    expect(spiel9(result.current)).toMatchObject({ scoreA: 3, scoreB: 1, matchStatus: 'finished' });
    expect(punkte(result.current, SV_SUED)).toBe(3);

    await act(async () => { reject(); await settle(); });

    expect(spiel9(result.current)).toMatchObject({ scoreA: undefined, scoreB: undefined, matchStatus: 'scheduled' });
    expect(punkte(result.current, SV_SUED)).toBe(0);
  });

  it('Gegenbeispiel: Konto ohne lokale Kopien → kein ensureMatch', async () => {
    const h = await engine('olli-leer');
    const ensure = vi.spyOn(h.engine, 'ensureMatch');
    mountOverlay(h, scheduleTournament());
    await act(async () => { await settle(); });

    expect(ensure).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Konto mit nur bestätigten Einträgen (nichts wartet) → kein ensureMatch, der Server liefert den Stand', async () => {
    await eintragen(await engine('olli-ok'), 3, 1);
    const neu = await engine('olli-ok');
    const ensure = vi.spyOn(neu.engine, 'ensureMatch');
    mountOverlay(neu, scheduleTournament());
    await act(async () => { await settle(); });

    expect(ensure).not.toHaveBeenCalled();
  });
});
