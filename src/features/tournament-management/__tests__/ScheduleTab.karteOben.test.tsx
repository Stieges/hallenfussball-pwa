/**
 * @ZP-109 Die Karte oben im Spielplan der Turnierleitung im ganzen Reiter (`ScheduleTab`): kein Filter ändert sie (@ZM-141), im Bearbeiten-Modus
 * steht keine Karte, die Haupttaste fragt beim Wechsel bei laufendem anderem Spiel nach (@SL-194). Fixture „Hallencup Nord“ (zwei Felder).
 * Echte Kette useCan -> hasPermission (Eigentümer); die Tabelle ist eine Attrappe, hier zählt nur, was darüber steht.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner', isLoading: false }),
}));
vi.mock('../../schedule-editor', () => ({ ScheduleEditor: () => <div data-testid="schedule-editor-stub" /> }));
vi.mock('../../../components/ScheduleDisplay', () => ({ ScheduleDisplay: () => null }));
const mockContext = {
  tournamentRepository: {},
  liveMatchRepository: { getAll: vi.fn().mockResolvedValue(new Map()) },
  isRealtimeEnabled: true,
  supabaseLiveMatchRepo: { getAll: vi.fn().mockResolvedValue(new Map()), subscribe: vi.fn(), unsubscribe: vi.fn(), unsubscribeAll: vi.fn() },
  publicLiveMatchRepo: null as unknown,
};
vi.mock('../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => mockContext }));

import { generateFullSchedule } from '../../../core/generators';
import { ToastProvider } from '../../../components/ui/Toast';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { fPAUSE, fZEIT, GAME } from '../../../core/view/__fixtures__/hallencupNord';
import { ScheduleTab } from '../ScheduleTab';

await initRealDeI18n();

function zeige(tournament: Tournament, entry = '/schedule') {
  const schedule = generateFullSchedule(tournament);
  const onNavigateToCockpit = vi.fn();
  render(
    <MemoryRouter initialEntries={[entry]}><ToastProvider>
      <ScheduleTab
        tournament={tournament} schedule={schedule} currentStandings={[]}
        onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} onMatchesUpdate={vi.fn()}
        onNavigateToCockpit={onNavigateToCockpit}
      />
    </ToastProvider></MemoryRouter>,
  );
  return { onNavigateToCockpit };
}

const kartenText = () => screen.queryByTestId('schedule-current')?.textContent;

beforeEach(() => { vi.clearAllMocks(); vi.mocked(localStorage.getItem).mockReturnValue(null); });

describe('@ZP-109 Karte oben im Reiter „Spielplan“', () => {
  it('@ZP-109 oben steht die Karte; sie liegt vor der Werkzeugleiste und der Filterzeile', async () => {
    const { tournament } = await fZEIT();
    zeige(tournament);
    const karte = screen.getByTestId('schedule-current');
    const leiste = screen.getByTestId('schedule-filter-bar');
    expect(karte.compareDocumentPosition(leiste) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each(['?g=B', '?p=finals', '?f=2', '?g=A&f=1&p=groupStage'])('@ZM-141 @ZP-109 kein Filter ändert die Karte (Adresse %s)', async (query) => {
    const { tournament } = await fZEIT();
    zeige(tournament);
    const ohne = kartenText();
    cleanup();
    zeige(tournament, `/schedule${query}`);
    expect(ohne).toContain('Nächstes Spiel · Spiel 9');
    expect(kartenText()).toBe(ohne);
  });

  it('@ZP-109 Aber im Bearbeiten-Modus steht keine Karte; nach „Abbrechen“ wieder', async () => {
    const { tournament } = await fZEIT();
    zeige(tournament);
    expect(screen.getByTestId('schedule-current')).toBeTruthy();
    await userEvent.click(screen.getByTestId('schedule-edit-start'));
    expect(screen.queryByTestId('schedule-current')).toBeNull();
  });

  it('@ZP-109 @SL-194 läuft ein anderes Spiel, fragt die Haupttaste „Spiel 7 läuft weiter. Trotzdem zu Spiel 8 wechseln?“; „Wechseln“ führt ins Cockpit', async () => {
    const { tournament } = await fPAUSE();
    const { onNavigateToCockpit } = zeige(tournament);
    const id8 = tournament.matches[GAME[8]].id;
    await userEvent.click(screen.getByTestId(`schedule-current-cockpit-${id8}`));
    expect(onNavigateToCockpit).not.toHaveBeenCalled();
    expect(screen.getByText(/Spiel 7 läuft weiter\. Trotzdem zu Spiel 8 wechseln\?/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /wechseln/i }));
    expect(onNavigateToCockpit).toHaveBeenCalledWith(id8);
  });

  it('@ZP-109 Gegenbeispiel: läuft nichts, geht die Haupttaste ohne Rückfrage ins Cockpit', async () => {
    const { tournament } = await fZEIT();
    const { onNavigateToCockpit } = zeige(tournament);
    const id9 = tournament.matches[GAME[9]].id;
    await userEvent.click(screen.getByTestId(`schedule-current-cockpit-${id9}`));
    expect(onNavigateToCockpit).toHaveBeenCalledWith(id9);
  });
});
