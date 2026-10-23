/**
 * A-08f3e4 Punkt 1 – Absetzen und Wieder einplanen über den Server (Brief A-08f3e4c1c2 § 3, Plan v4 § 3 „e4“).
 * Echter Weg: echter `LocalMatchStore` + `MatchEngine` + `OutboxSender` (Server-RPC gemockt), echte DE-Texte.
 * Werte aus dem Gherkin (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`):
 * @FU-089 (Olli hat Spiel 4 übersprungen), @FU-092 (Spiel um Platz 3, Heimteam steht nicht fest),
 * @FU-071 (übersprungen · Tom · wieder einplanen · „nur Turnierleitung“).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
const role = vi.hoisted(() => ({ actor: 'leitung' }));
vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => role.actor }));

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { MatchEngineContext } from '../../../match-engine/matchEngineContextInstance';
import type { EngineEventWithSeq } from '../../../../core/match/client';
import type { EngineEvent } from '../../../../core/match';
import { RULES } from '../../../../core/match/client/__tests__/fixtures';
import { FC_NORD, GAST, HEIM, NOW, SV_SUED, makeScheduleEngine, settle, type ScheduleEngine } from '../../../../test/scheduleEngineHarness';
import { createMockMatch, createMockTournament } from '../../../../test/factories';
import { resultOf, vs, slots, testUuid } from '../../../../test/matchSlotFixtures';
import { teamSlot } from '../../../../core/models/matchSlot';
import type { Tournament } from '../../../../types/tournament';
import { useMatchSkip } from '../useMatchSkip';

await initRealDeI18n();

const SPIEL_4 = 'spiel-4';
const PLATZ_3 = 'platz-3';

/** Live-Cup: Spiel 4 (FC Nord – SV Süd), Spiel um Platz 3 (Heim = Verlierer Halbfinale 1, noch offen). */
function liveCup(platz3HeimFest = false): Tournament {
  const teams = [
    { id: FC_NORD, name: 'FC Nord', group: 'A' }, { id: SV_SUED, name: 'SV Süd', group: 'A' },
    { id: HEIM, name: 'Heimteam', group: 'B' }, { id: GAST, name: 'Auswärtsteam', group: 'B' },
  ];
  const platz3Heim = platz3HeimFest ? teamSlot(HEIM) : resultOf(testUuid(311), 'loser');
  return createMockTournament({
    id: 'T', ownerId: 'olli', teams, numberOfTeams: 4,
    matches: [
      createMockMatch({ id: SPIEL_4, matchNumber: 4, group: 'A', phase: 'groupStage', ...vs(FC_NORD, SV_SUED), matchStatus: 'scheduled' }),
      createMockMatch({ id: PLATZ_3, matchNumber: 13, group: undefined, phase: 'thirdPlace', isFinal: true, finalType: 'thirdPlace', ...slots(platz3Heim, teamSlot(GAST)), matchStatus: 'scheduled' }),
    ],
  });
}

const seq = (event: EngineEvent, n: number): EngineEventWithSeq => ({ ...event, seq: n });
const anpfiff: EngineEvent = { id: 'start', type: 'MATCH_START', actor: 'helper', at: NOW - 120_000, section: 1, clockMs: 0, teamId: null, payload: { rules: RULES } };
const ergebnis: EngineEvent = { id: 'e1', type: 'RESULT_ENTRY', actor: 'leitung', at: NOW - 60_000, section: null, clockMs: null, teamId: null, payload: { scores: { [FC_NORD]: 2, [SV_SUED]: 1 } } };

function render(h: ScheduleEngine | null, tournament = liveCup()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MatchEngineContext.Provider value={h?.value ?? null}>{children}</MatchEngineContext.Provider>
  );
  const hook = renderHook(() => useMatchSkip(tournament), { wrapper });
  const run = async (action: () => Promise<string | null>): Promise<string | null> => {
    let text: string | null = null;
    await act(async () => { text = await action(); await settle(); });
    return text;
  };
  return {
    skip: (matchId: string, reason?: string) => run(() => hook.result.current.skip(matchId, reason)),
    unskip: (matchId: string) => run(() => hook.result.current.unskip(matchId)),
  };
}

const sentTypes = (h: ScheduleEngine): string[][] => h.api.mock.calls.map(([, events]) => events.map((event) => event.type));
const status = (h: ScheduleEngine, matchId: string) => h.engine.view(matchId)?.result.state.status;

describe('A-08f3e4 Absetzen und Wieder einplanen über den Server', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    role.actor = 'leitung';
    h.engine.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('@FU-089 Olli setzt Spiel 4 ab → SKIP über den Ausgang, Spiel 4 ist abgesetzt', async () => {
    const { skip } = render(h);

    const text = await skip(SPIEL_4, 'Team fehlt');

    expect(text).toBeNull();
    expect(sentTypes(h)).toEqual([['SKIP']]);
    expect(h.api.mock.calls[0][1][0].payload).toEqual({ reason: 'Team fehlt' });
    expect(status(h, SPIEL_4)).toBe('skipped');
  });

  it('@FU-092 Platz 3 ohne feststehendes Heimteam → „Absetzen erst, wenn beide Teams feststehen“, kein ensureMatch, kein Server-Aufruf', async () => {
    const ensure = vi.spyOn(h.engine, 'ensureMatch');
    const { skip } = render(h);

    const text = await skip(PLATZ_3);

    expect(text).toBe('Absetzen erst, wenn beide Teams feststehen');
    expect(ensure).not.toHaveBeenCalled();
    expect(h.api).not.toHaveBeenCalled();
    expect(h.engine.view(PLATZ_3) ?? null).toBeNull(); // keine Engine-Kopie angelegt
  });

  it('@FU-092 Gegenbeispiel: Platz 3 mit beiden Teams → SKIP', async () => {
    const { skip } = render(h, liveCup(true));

    expect(await skip(PLATZ_3)).toBeNull();
    expect(sentTypes(h)).toEqual([['SKIP']]);
    expect(status(h, PLATZ_3)).toBe('skipped');
  });

  it('@FU-071 übersprungen · Tom · wieder einplanen → „nur Turnierleitung“, Ausgang bleibt leer', async () => {
    await render(h).skip(SPIEL_4);
    role.actor = 'helper';
    const { unskip } = render(h);

    const text = await unskip(SPIEL_4);

    expect(text).toBe('nur Turnierleitung');
    expect(sentTypes(h)).toEqual([['SKIP']]);
    expect(status(h, SPIEL_4)).toBe('skipped');
  });

  it('@FU-071 Gegenbeispiel: Olli plant Spiel 4 wieder ein → UNSKIP, Spiel 4 wieder geplant', async () => {
    const { skip, unskip } = render(h);
    await skip(SPIEL_4);

    expect(await unskip(SPIEL_4)).toBeNull();
    expect(sentTypes(h)).toEqual([['SKIP'], ['UNSKIP']]);
    expect(status(h, SPIEL_4)).toBe('scheduled');
  });

  it('Gegenbeispiel 1: Absetzen eines beendeten Spiels (Server-Stand) → abgelehnt, Ausgang leer', async () => {
    h.fetchConfirmed.mockResolvedValueOnce({ events: [seq(ergebnis, 1)], newWatermark: 1 });
    const { skip } = render(h);

    // Kein Szenario-Wortlaut: abgelehnt mit dem Ablehnungstext der Engine (Code MATCH_FINISHED), nichts gesendet.
    expect(await skip(SPIEL_4)).toEqual(expect.stringContaining('Spiel ist beendet'));
    expect(h.api).not.toHaveBeenCalled();
    expect(status(h, SPIEL_4)).toBe('finished');
  });

  it('Gegenbeispiel 2: Absetzen eines laufenden fremden Spiels → abgelehnt, Ausgang leer', async () => {
    h.fetchConfirmed.mockResolvedValueOnce({ events: [seq(anpfiff, 1)], newWatermark: 1 });
    const { skip } = render(h);

    expect(await skip(SPIEL_4)).toBe('Diese Aktion ist gerade nicht möglich.');
    expect(h.api).not.toHaveBeenCalled();
    expect(status(h, SPIEL_4)).toBe('running');
  });

  it('Helfer Tom setzt ab → „nur Turnierleitung“, nichts gespeichert', async () => {
    role.actor = 'helper';
    const { skip } = render(h);

    expect(await skip(SPIEL_4)).toBe('nur Turnierleitung');
    expect(h.api).not.toHaveBeenCalled();
    expect((await h.store.load(h.value.accountId, SPIEL_4))?.pending ?? []).toEqual([]);
  });

  it('ohne Spiel-Engine → Hinweis, nichts gespeichert', async () => {
    const { skip } = render(null);

    expect(await skip(SPIEL_4)).toBe('Absetzen ist gerade nicht möglich');
  });
});
