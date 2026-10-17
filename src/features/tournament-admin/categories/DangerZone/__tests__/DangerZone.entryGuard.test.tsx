/**
 * A-08f3e4 Punkt 2 – @FU-090 Beispiel „in den Einstellungen „Ergebnisse zurücksetzen““ (Brief A-08f3e4c1c2 § 3).
 * Gegeben Spiel 7 im „Live-Cup“ hat 5 Einträge · Wenn Olli zurücksetzt · Dann führt die App es nicht aus und zeigt
 * „Spiel 7 hat Einträge – nur über Spielplan auf Anfang setzen“ · Und Spiel 7 behält alle 5 Einträge.
 * Echte Spiel-Engine (fake-indexeddb), echte DE-Texte, echter Toast.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('../../../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    myMembership: { id: 'm-1', userId: 'olli', tournamentId: 'T', role: 'owner', teamIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    isLoading: false,
  }),
}));

import { initRealDeI18n } from '../../../../../test/realDeI18n';
import { ToastProvider } from '../../../../../components/ui/Toast';
import { MatchEngineContext } from '../../../../match-engine/matchEngineContextInstance';
import { makeScheduleEngine, scheduleTournament, SPIEL_7, type ScheduleEngine } from '../../../../../test/scheduleEngineHarness';
import { entryCount, seedEntries } from '../../../../../test/matchEntrySeed';
import { DangerZoneCategory } from '../index';

await initRealDeI18n();

/** 2:1 = Anpfiff, drei Tore, Abpfiff = 5 Einträge (@FU-090). */
const ZWEI_ZU_EINS = { home: 2, away: 1 };

function renderDangerZone(h: ScheduleEngine) {
  const onLocalTournamentUpdate = vi.fn();
  const onMatchesUpdate = vi.fn();
  render(
    <ToastProvider>
      <MatchEngineContext.Provider value={h.value}>
        <DangerZoneCategory
          tournamentId="T"
          tournament={scheduleTournament({ [SPIEL_7]: { scoreA: 4, scoreB: 0, matchStatus: 'finished' } })}
          onTournamentUpdate={vi.fn()}
          onLocalTournamentUpdate={onLocalTournamentUpdate}
          onMatchesUpdate={onMatchesUpdate}
        />
      </MatchEngineContext.Provider>
    </ToastProvider>,
  );
  return { onLocalTournamentUpdate, onMatchesUpdate };
}

async function resetResults(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Spielplan zurücksetzen/i }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByRole('textbox'), 'ZURÜCKSETZEN');
  await user.click(within(dialog).getByRole('button', { name: /Spielplan zurücksetzen/i }));
}

describe('A-08f3e4 DangerZone: Zurücksetzen löscht keine Einträge still (@FU-090)', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
  });

  it('@FU-090 Spiel 7 hat 5 Einträge → nicht ausgeführt, Text wörtlich, Spiel 7 behält alle 5 Einträge', async () => {
    await seedEntries(h, SPIEL_7, ZWEI_ZU_EINS);
    const user = userEvent.setup();
    const { onLocalTournamentUpdate, onMatchesUpdate } = renderDangerZone(h);

    await resetResults(user);

    expect(await screen.findByText('Spiel 7 hat Einträge – nur über Spielplan auf Anfang setzen')).toBeInTheDocument();
    expect(onLocalTournamentUpdate).not.toHaveBeenCalled();
    expect(onMatchesUpdate).not.toHaveBeenCalled();
    expect(await entryCount(h, SPIEL_7)).toBe(5);
  });

  it('Gegenbeispiel: Turnier ohne Einträge → Zurücksetzen läuft wie heute', async () => {
    const user = userEvent.setup();
    const { onLocalTournamentUpdate } = renderDangerZone(h);

    await resetResults(user);

    await vi.waitFor(() => expect(onLocalTournamentUpdate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/hat Einträge/)).not.toBeInTheDocument();
  });
});
