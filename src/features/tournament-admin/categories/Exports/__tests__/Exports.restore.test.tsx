/**
 * Exports.restore.test.tsx – A-08f3e4 Punkt 2 (Brief A-08f3e4c1c2 § 3), umgeschrieben nach Baustein Regel 3: vorher pinnte
 * die Datei den A2-Altweg „Ergebnisse der Sicherung per `diffMatchResultStatusUpdates` → `onMatchesUpdate` schreiben“.
 *
 * @FU-091: Gegeben Spiel 7 im „Live-Cup“ hat Einträge und steht 2:1 · Und in Ollis Sicherungsdatei steht Spiel 7 mit 0:0 ·
 * Wenn Olli die Sicherung wiederherstellt · Dann steht Spiel 7 weiter 2:1 · Und Olli sieht „Bei 1 Spiel mit Einträgen wurde
 * das Ergebnis nicht wiederhergestellt“.
 * F2 (Controller, Vorschlag gilt): Bei Konto-Turnieren stellt die Sicherung keine Ergebnisse wieder her (ein Ergebnis ohne
 * Eintrag spränge durch Regel S Stufe 2 nach ≤ 5 s zurück, Falle F4); im Gastmodus unverändert.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// A-11: die Komponente fragt Rechte über useCan -- hier die Turnierleitung (alles erlaubt).
vi.mock('../../../../auth/hooks/useCan', () => ({ useCan: () => true }));
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../../test/realDeI18n';
import { ToastProvider } from '../../../../../components/ui/Toast';
import { MatchEngineContext } from '../../../../match-engine/matchEngineContextInstance';
import { makeScheduleEngine, scheduleTournament, SPIEL_7, SPIEL_9, type ScheduleEngine } from '../../../../../test/scheduleEngineHarness';
import { seedEntries } from '../../../../../test/matchEntrySeed';
import type { Tournament } from '../../../../../types/tournament';
import { ExportsCategory } from '../index';

await initRealDeI18n();

const HINWEIS_1 = 'Bei 1 Spiel mit Einträgen wurde das Ergebnis nicht wiederhergestellt';
/** Aktueller Stand: Spiel 7 2:1 (aus Einträgen), Spiel 9 ohne Ergebnis. */
const aktuell = (): Tournament => scheduleTournament({ [SPIEL_7]: { scoreA: 2, scoreB: 1, matchStatus: 'finished' } });
/** Sicherung: Spiel 7 0:0, Spiel 9 3:3 beendet, anderer Titel. */
const sicherung = (): Tournament => ({
  ...scheduleTournament({
    [SPIEL_7]: { scoreA: 0, scoreB: 0, matchStatus: 'scheduled' },
    [SPIEL_9]: { scoreA: 3, scoreB: 3, matchStatus: 'finished', scheduledTime: new Date('2026-10-18T10:00:00.000Z') },
  }),
  title: 'Live-Cup (Sicherung)',
});

async function restore(h: ScheduleEngine) {
  const onTournamentUpdate = vi.fn();
  const onMatchesUpdate = vi.fn();
  const user = userEvent.setup();
  const { container } = render(
    <ToastProvider>
      <MatchEngineContext.Provider value={h.value}>
        <ExportsCategory tournamentId="T" tournament={aktuell()} onTournamentUpdate={onTournamentUpdate} onMatchesUpdate={onMatchesUpdate} />
      </MatchEngineContext.Provider>
    </ToastProvider>,
  );
  const file = new File([JSON.stringify({ version: '1.0', exportedAt: '2026-10-18T10:00:00.000Z', tournament: sicherung() })], 'backup.json', { type: 'application/json' });
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) { throw new Error('Datei-Eingabe fehlt'); }
  await user.upload(input, file);
  await vi.waitFor(() => expect(onTournamentUpdate).toHaveBeenCalledTimes(1));
  const restored = onTournamentUpdate.mock.calls[0][0] as Tournament;
  const match = (id: string) => restored.matches.find((m) => m.id === id);
  return { restored, match, onMatchesUpdate };
}

describe('A-08f3e4 Sicherung wiederherstellen überschreibt keine Ergebnisse von Spielen mit Einträgen (@FU-091)', () => {
  let h: ScheduleEngine;

  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    // jsdom kennt weder createObjectURL noch revokeObjectURL (Auto-Sicherung vor dem Wiederherstellen).
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('@FU-091 Spiel 7 mit Einträgen steht 2:1, Sicherung 0:0 → weiter 2:1, Hinweis „Bei 1 Spiel …“', async () => {
    h = await makeScheduleEngine();
    await seedEntries(h, SPIEL_7, { home: 2, away: 1 });

    const { restored, match, onMatchesUpdate } = await restore(h);

    expect(match(SPIEL_7)).toMatchObject({ scoreA: 2, scoreB: 1, matchStatus: 'finished' });
    expect(restored.title).toBe('Live-Cup (Sicherung)'); // Spielplan-/Turnierdaten wie heute
    expect(match(SPIEL_9)?.scheduledTime).toBeInstanceOf(Date); // Fixrunde 1: Sicherung hydriert (sonst Absturz der Verwaltung)
    expect(await screen.findByText(HINWEIS_1)).toBeInTheDocument();
    expect(onMatchesUpdate).not.toHaveBeenCalled(); // kein Altweg mehr
  });

  it('Gegenbeispiel (6) Gast: Spiel 9 ohne Einträge wird aus der Sicherung wiederhergestellt, Spiel 7 mit Einträgen bleibt 2:1', async () => {
    h = await makeScheduleEngine('guest');
    await seedEntries(h, SPIEL_7, { home: 2, away: 1 });

    const { match } = await restore(h);

    expect(match(SPIEL_9)).toMatchObject({ scoreA: 3, scoreB: 3, matchStatus: 'finished' });
    expect(match(SPIEL_7)).toMatchObject({ scoreA: 2, scoreB: 1 });
    expect(await screen.findByText(HINWEIS_1)).toBeInTheDocument();
  });

  it('F2/F4 Konto-Turnier: auch das Ergebnis von Spiel 9 ohne Einträge wird nicht wiederhergestellt (spränge nach ≤ 5 s zurück)', async () => {
    h = await makeScheduleEngine();
    await seedEntries(h, SPIEL_7, { home: 2, away: 1 });

    const { match } = await restore(h);

    expect(match(SPIEL_9)).toMatchObject({ scoreA: undefined, scoreB: undefined, matchStatus: 'scheduled' });
  });

  it('F-c Konto-Turnier ohne Einträge: Ergebnisse der Sicherung bleiben draußen, Hinweis „der Server führt sie“', async () => {
    h = await makeScheduleEngine();

    const { match } = await restore(h);

    expect(match(SPIEL_9)).toMatchObject({ scoreA: undefined, matchStatus: 'scheduled' });
    expect(await screen.findByText('Ergebnisse werden nicht aus der Sicherung übernommen – der Server führt sie')).toBeInTheDocument();
    expect(screen.queryByText(/mit Einträgen/)).not.toBeInTheDocument();
  });

  it('Gegenbeispiel Gast ohne Einträge: alles wird wiederhergestellt, kein Hinweis', async () => {
    h = await makeScheduleEngine('guest');

    const { match } = await restore(h);

    expect(match(SPIEL_7)).toMatchObject({ scoreA: 0, scoreB: 0, matchStatus: 'scheduled' });
    expect(match(SPIEL_9)).toMatchObject({ scoreA: 3, scoreB: 3 });
    expect(screen.queryByText(/mit Einträgen/)).not.toBeInTheDocument();
    expect(screen.queryByText(/der Server führt sie/)).not.toBeInTheDocument();
  });
});
