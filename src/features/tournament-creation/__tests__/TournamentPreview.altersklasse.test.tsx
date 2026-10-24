/**
 * Entwurfs-Vorschau: Altersklasse im Kopf (Record Wizard-Regelprofile @W2B-022, @W2B-024, @W2B-026).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';

const generateFullScheduleMock = vi.fn();

vi.mock('../../../core/generators', () => ({
  generateFullSchedule: (t: Tournament) => generateFullScheduleMock(t),
}));

vi.mock('../../../components/ScheduleDisplay', () => ({
  ScheduleDisplay: () => <div data-testid="schedule-display-stub" />,
}));

vi.mock('../../../components/RefereeAssignmentEditor', () => ({
  RefereeAssignmentEditor: ({
    onResetAssignments,
  }: {
    onResetAssignments: () => void;
  }) => (
    <button data-testid="reset-referees-stub" onClick={onResetAssignments}>
      reset
    </button>
  ),
}));

vi.mock('../../../lib/pdfExporter', () => ({
  exportScheduleToPDF: vi.fn(),
}));

import { TournamentPreview } from '../TournamentPreview';

const tournament: Tournament = {
  id: 't1',
  title: 'Test Cup',
  ageClass: '',
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
  refereeConfig: {
    mode: 'fixedPerField',
    refereeNames: {},
    manualAssignments: {},
  },
  location: { name: 'Halle' },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
} as unknown as Tournament;

const initialSchedule: GeneratedSchedule = {
  allMatches: [],
  initialStandings: [],
  tournament,
} as unknown as GeneratedSchedule;


function untertitel(ageClass: string): string {
  const t = { ...tournament, ageClass };
  render(<TournamentPreview tournament={t} schedule={{ ...initialSchedule, tournament: t }} onEdit={() => undefined} onPublish={() => undefined} />);
  const heading = screen.getByRole('heading', { level: 1, name: 'Test Cup' });
  return (heading.nextElementSibling?.textContent ?? '').trim();
}

describe('Vorschau-Kopf: Altersklasse (@W2B-022, @W2B-024, @W2B-026)', () => {
  it('@W2B-022 ohne Altersklasse beginnt die Zeile nicht mit einem Trennzeichen', () => {
    const text = untertitel('');
    expect(text.startsWith('\u2022')).toBe(false);
    // @W1-039: das Datum steht wie im PDF-Kopf (Wochentag, TT.MM.JJJJ), nie roh als 2030-01-01
    expect(text).toContain('Dienstag, 01.01.2030');
    expect(text).not.toContain('2030-01-01');
  });

  it.each(['U11', 'AH'])('@W2B-024 @W2B-026 „%s“ steht genau so davor', (wert) => {
    expect(untertitel(wert).startsWith(`${wert} \u2022 `)).toBe(true);
  });
});
