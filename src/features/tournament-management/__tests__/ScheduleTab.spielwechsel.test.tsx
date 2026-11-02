/**
 * @SL-194 Beim Wechsel zu einem anderen Spiel sagt die Rückfrage, dass das laufende Spiel weiterläuft.
 * Gherkin: „Spiel 5 läuft, und Olli wählt im Spielplan bei Spiel 6 ‚Im Cockpit anpfeifen‘ / Dann lautet die Frage
 * ‚Spiel 5 läuft weiter. Trotzdem zu Spiel 6 wechseln?‘ / Und nach ‚Wechseln‘ läuft Spiel 5 unverändert weiter.“
 * Dazu @EK-063: Spielplan und Cockpit öffnen dieselbe Dialog-Komponente für „Korrigieren“.
 * Echte Kette: ScheduleTab (Rolle Turnierleitung über useCan), Aktionsauswahl, Rückfrage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Team, Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../auth/hooks/useMyTournamentRole', () => ({ useMyTournamentRole: () => ({ role: 'owner', isLoading: false }) }));
const mockContext = {
  tournamentRepository: {},
  liveMatchRepository: { getAll: vi.fn().mockResolvedValue(new Map()) },
  isRealtimeEnabled: true,
  supabaseLiveMatchRepo: { getAll: vi.fn().mockResolvedValue(new Map()), subscribe: vi.fn(), unsubscribe: vi.fn(), unsubscribeAll: vi.fn() },
  publicLiveMatchRepo: null as unknown,
};
vi.mock('../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => mockContext }));

import { generateFullSchedule } from '../../../core/generators';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ToastProvider } from '../../../components/ui/Toast';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { ScheduleTab } from '../ScheduleTab';

await initRealDeI18n();

const teams: Team[] = ['SG Mitte', 'VfB Ufer', 'TSV West', 'DJK Berg'].map((name, i) => ({ id: testUuid(i + 1), name, group: 'A' }));
const base = createMockTournament({ id: 'hallencup-ost', title: 'Hallencup Ost', teams, numberOfTeams: 4, numberOfGroups: 1, numberOfFields: 1 });
const schedule = generateFullSchedule(base);
const spiel = (nummer: number) => schedule.allMatches.find((m) => m.matchNumber === nummer)!;

function renderTab(laeuft: boolean) {
  const matches = schedule.allMatches.map((m) => (laeuft && m.matchNumber === 5
    ? { ...m, matchStatus: 'running' as const, scoreA: 1, scoreB: 0 }
    : m)) as unknown as Tournament['matches'];
  const tournament: Tournament = { ...base, matches };
  const onNavigateToCockpit = vi.fn();
  const onTournamentUpdate = vi.fn();
  const onMatchesUpdate = vi.fn();
  render(
    <MemoryRouter><ToastProvider>
      <ScheduleTab
        tournament={tournament} schedule={schedule} currentStandings={[]}
        onTournamentUpdate={onTournamentUpdate} onLocalTournamentUpdate={vi.fn()} onMatchesUpdate={onMatchesUpdate}
        onNavigateToCockpit={onNavigateToCockpit}
      />
    </ToastProvider></MemoryRouter>,
  );
  return { onNavigateToCockpit, onTournamentUpdate, onMatchesUpdate };
}

async function anpfeifenBeiSpiel6(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByTestId(`match-name-${spiel(6).id}-home`)[0]);
  await user.click(await screen.findByTestId('match-action-kickOff'));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('@SL-194 Rückfrage beim Wechsel zu einem anderen Spiel', () => {
  it('@SL-194 Spiel 5 läuft, „Im Cockpit anpfeifen“ bei Spiel 6: die Frage lautet „Spiel 5 läuft weiter. Trotzdem zu Spiel 6 wechseln?“ mit der Taste „Wechseln“', async () => {
    const user = userEvent.setup();
    const { onNavigateToCockpit } = renderTab(true);
    await anpfeifenBeiSpiel6(user);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Spiel 5 läuft weiter. Trotzdem zu Spiel 6 wechseln?');
    expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('Wechseln');
    expect(onNavigateToCockpit).not.toHaveBeenCalled();
  });

  it('@SL-194 nach „Wechseln“ öffnet das Cockpit Spiel 6 und Spiel 5 läuft unverändert weiter (nichts beendet, nichts gespeichert)', async () => {
    const user = userEvent.setup();
    const { onNavigateToCockpit, onTournamentUpdate, onMatchesUpdate } = renderTab(true);
    await anpfeifenBeiSpiel6(user);
    await user.click(await screen.findByTestId('confirm-dialog-confirm'));
    expect(onNavigateToCockpit).toHaveBeenCalledExactlyOnceWith(spiel(6).id);
    expect(onTournamentUpdate).not.toHaveBeenCalled();
    expect(onMatchesUpdate).not.toHaveBeenCalled();
  });

  it('@SL-194 Gegenbeispiel: „Abbrechen“ bleibt im Spielplan, das Cockpit wird nicht geöffnet', async () => {
    const user = userEvent.setup();
    const { onNavigateToCockpit } = renderTab(true);
    await anpfeifenBeiSpiel6(user);
    await user.click(await screen.findByTestId('confirm-dialog-cancel'));
    expect(onNavigateToCockpit).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('@SL-194 Gegenbeispiel: läuft kein anderes Spiel, öffnet „Im Cockpit anpfeifen“ das Cockpit ohne Rückfrage', async () => {
    const user = userEvent.setup();
    const { onNavigateToCockpit } = renderTab(false);
    await anpfeifenBeiSpiel6(user);
    expect(onNavigateToCockpit).toHaveBeenCalledExactlyOnceWith(spiel(6).id);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('@SL-194 die alte Beschriftung „Trotzdem wechseln“ ist weg (sie klang nach Beenden)', async () => {
    const user = userEvent.setup();
    renderTab(true);
    await anpfeifenBeiSpiel6(user);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).not.toHaveTextContent('Trotzdem wechseln');
    expect(dialog).not.toHaveTextContent('beende');
  });
});
