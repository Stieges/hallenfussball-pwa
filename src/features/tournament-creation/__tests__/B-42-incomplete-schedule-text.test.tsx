/**
 * B-42 F1 (@W4-025): Der Hinweis auf einen unvollstaendigen Spielplan erscheint im Wizard
 * (TournamentPreview) und im Neuplanen (ReplanPanel) als verstaendlicher deutscher Text
 * ueber i18n – ohne Rohtext, ohne interne Namen, ohne doppelten Vorschlag.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Echte deutsche Texte pruefen (src/test/realDeI18n.ts).
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import type { Match, Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import { IncompleteScheduleError } from '../../../core/generators/incompleteScheduleError';
import type { ReplanPreviewResult } from '../utils/replan';

const generateFullScheduleMock = vi.fn();

vi.mock('../../../core/generators', () => ({
  generateFullSchedule: (t: Tournament) => generateFullScheduleMock(t),
}));

vi.mock('../../../components/ScheduleDisplay', () => ({
  ScheduleDisplay: () => <div data-testid="schedule-display-stub" />,
}));

vi.mock('../../../components/RefereeAssignmentEditor', () => ({
  RefereeAssignmentEditor: ({ onResetAssignments }: { onResetAssignments: () => void }) => (
    <button data-testid="reset-referees-stub" onClick={onResetAssignments}>
      reset
    </button>
  ),
}));

vi.mock('../../../lib/pdfExporter', () => ({
  exportScheduleToPDF: vi.fn(),
}));

vi.mock('../../../components/dialogs/Dialog', () => ({
  Dialog: ({ isOpen, title, children }: { isOpen: boolean; title: string; children: React.ReactNode }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

import { TournamentPreview } from '../TournamentPreview';
import { ReplanPanel } from '../components/ReplanPanel';

const tournament = {
  id: 't1',
  title: 'Test Cup',
  ageClass: 'U13',
  sport: 'football',
  tournamentType: 'classic',
  mode: 'roundRobin',
  groupSystem: 'roundRobin',
  date: '2030-01-01',
  timeSlot: '09:00',
  startDate: '2030-01-01',
  startTime: '09:00',
  numberOfTeams: 4,
  numberOfFields: 1,
  numberOfGroups: 1,
  groupPhaseGameDuration: 10,
  groupPhaseBreakDuration: 2,
  finalRoundGameDuration: 10,
  finalRoundBreakDuration: 2,
  breakBetweenPhases: 0,
  teams: [
    { id: '1', name: 'A' },
    { id: '2', name: 'B' },
    { id: '3', name: 'C' },
    { id: '4', name: 'D' },
  ],
  matches: [],
  status: 'draft',
  refereeConfig: { mode: 'fixedPerField', refereeNames: {}, manualAssignments: {} },
  location: { name: 'Halle' },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
} as unknown as Tournament;

const initialSchedule = { allMatches: [], initialStandings: [], tournament } as unknown as GeneratedSchedule;

describe('B-42 F1 – Wizard (TournamentPreview): unvollstaendiger Spielplan', () => {
  beforeEach(() => {
    generateFullScheduleMock.mockReset();
  });

  it('zeigt die Anzahl fehlender Spiele in verstaendlichem Deutsch, ohne Rohtext', () => {
    generateFullScheduleMock.mockImplementation(() => {
      throw new IncompleteScheduleError(2);
    });

    render(
      <TournamentPreview tournament={tournament} schedule={initialSchedule} onEdit={() => undefined} onPublish={() => undefined} />,
    );
    fireEvent.click(screen.getByTestId('reset-referees-stub'));

    const banner = screen.getByTestId('schedule-error-banner');
    expect(
      within(banner).getByText(
        'Der Spielplan lässt sich so nicht vollständig erstellen: 2 Spiele passen nicht hinein. Bitte ein weiteres Feld hinzufügen oder die Mindestpause verkürzen.',
      ),
    ).toBeInTheDocument();
    expect(banner.textContent).not.toMatch(/Matches|minRestSlotsPerTeam|Could not/);
  });

  it('nennt bei genau einem fehlenden Spiel die Einzahl', () => {
    generateFullScheduleMock.mockImplementation(() => {
      throw new IncompleteScheduleError(1);
    });

    render(
      <TournamentPreview tournament={tournament} schedule={initialSchedule} onEdit={() => undefined} onPublish={() => undefined} />,
    );
    fireEvent.click(screen.getByTestId('reset-referees-stub'));

    expect(screen.getByTestId('schedule-error-banner').textContent).toContain('1 Spiel passt nicht hinein.');
  });
});

describe('B-42 F1 – Neuplanen (ReplanPanel): unvollstaendiger Spielplan', () => {
  const previousMatches: Match[] = [{ id: 'm1', round: 1, field: 1, teamA: '1', teamB: '2' }];
  const teams = [{ id: '1', name: 'Team A' }, { id: '2', name: 'Team B' }];

  function renderImpossible(reasonCount: number): void {
    const impossible: ReplanPreviewResult = {
      status: 'impossible',
      reasonKey: 'replan.reasonScheduleIncomplete',
      reasonCount,
      suggestionKey: 'replan.suggestionMinRestOrAddField',
    };
    render(
      <ReplanPanel
        isOpen
        preview={impossible}
        previousMatches={previousMatches}
        teams={teams}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
  }

  it('zeigt den Grund mit der Anzahl und den Vorschlag genau einmal, ohne Klammer-Doppelung', () => {
    renderImpossible(3);

    const reason = screen.getByTestId('replan-reason');
    expect(reason).toHaveTextContent(
      'Der Spielplan lässt sich so nicht vollständig erstellen: 3 Spiele passen nicht hinein.',
    );
    expect(reason.textContent).not.toMatch(/\(/);
    expect(screen.getByTestId('replan-suggestion')).toHaveTextContent('Mindestpause senken oder ein Feld hinzufügen.');
    expect(screen.getByTestId('replan-confirm')).toBeDisabled();
  });
});
