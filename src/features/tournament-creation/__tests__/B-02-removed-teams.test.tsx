/**
 * B-02 Paket B1 – entfernte Teams (@W5-010, Controller-Zusatz B-02):
 * handleGenerateTeams verwirft keine Teams (isRemoved + vorhandene aktive bleiben),
 * Zähler in Step5_Overview und TournamentPreview zählen nur aktive Teams (!isRemoved).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Team, Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';

vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'step5.teamsCount' && typeof opts?.count === 'number') {
        return `${opts.count} Teams`;
      }
      const prefix = ns ? `${ns}:` : '';
      let result = `${prefix}${key}`;
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          if (k === 'count' || k === 'defaultValue' || k === 'ns') { continue; }
          result = result.replace(`{{${k}}}`, String(v));
        }
      }
      return result;
    },
    i18n: {
      language: 'de',
      changeLanguage: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const generateFullScheduleMock = vi.fn();

vi.mock('../../../core/generators', () => ({
  generateFullSchedule: (t: Tournament) => generateFullScheduleMock(t),
}));

vi.mock('../../../components/ScheduleDisplay', () => ({
  ScheduleDisplay: () => <div data-testid="schedule-stub" />,
}));

vi.mock('../../../lib/pdfExporter', () => ({ exportScheduleToPDF: vi.fn() }));

import { Step4_Teams } from '../Step4_Teams';
import { Step5_Overview } from '../Step5_Overview';
import { TournamentPreview } from '../TournamentPreview';

const baseTeams: Team[] = [
  { id: 't1', name: 'Alpha', group: 'A', isRemoved: true },
  { id: 't2', name: 'Beta', group: 'A' },
  { id: 't3', name: 'Gamma', group: 'B' },
  { id: 't4', name: 'Delta', group: 'B' },
];

const previewTournament = {
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
  teams: baseTeams,
  matches: [],
  status: 'draft',
  location: { name: 'Halle' },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
} as unknown as Tournament;

const previewSchedule = {
  allMatches: [
    {
      id: 'm1',
      field: 1,
      slot: 0,
      startTime: new Date('2030-01-01T09:00:00Z'),
      endTime: new Date('2030-01-01T09:10:00Z'),
      originalTeamA: 't2',
      originalTeamB: 't3',
      phase: 'groupStage',
    },
  ],
  initialStandings: [],
  tournament: previewTournament,
  endTime: new Date('2030-01-01T09:10:00Z'),
  numberOfFields: 1,
} as unknown as GeneratedSchedule;

describe('B-02 Paket B1 – entfernte Teams', () => {
  it('handleGenerateTeams ergänzt nur fehlende aktive Teams und verwirft nichts', () => {
    const onUpdate = vi.fn();
    render(
      <Step4_Teams
        formData={{
          teams: baseTeams,
          numberOfTeams: 5,
          numberOfGroups: 1,
          groupSystem: 'roundRobin',
        } as unknown as Tournament}
        onUpdate={onUpdate}
        onAddTeam={vi.fn()}
        onRemoveTeam={vi.fn()}
        onUpdateTeam={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('wizard-generate-teams'));

    expect(onUpdate).toHaveBeenCalledWith('teams', expect.any(Array));
    const nextTeams = onUpdate.mock.calls.find((c) => c[0] === 'teams')?.[1] as Team[];
    const ids = nextTeams.map((t) => t.id);
    expect(ids).toContain('t1');
    expect(ids).toContain('t2');
    expect(ids).toContain('t3');
    expect(ids).toContain('t4');
    expect(nextTeams.find((t) => t.id === 't1')?.isRemoved).toBe(true);
    expect(nextTeams.filter((t) => !t.isRemoved)).toHaveLength(5);
  });

  it('Step5_Overview zeigt bei 3 aktiven und 1 entfernten Team den Zählerwert 3', () => {
    render(
      <Step5_Overview
        formData={{ teams: baseTeams }}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText('3 Teams')).toBeInTheDocument();
  });

  it('TournamentPreview zeigt bei 3 aktiven und 1 entfernten Team den Zählerwert 3', () => {
    render(
      <TournamentPreview
        tournament={previewTournament}
        schedule={previewSchedule}
        onEdit={vi.fn()}
        onPublish={vi.fn()}
      />
    );
    const teamsLabel = screen.getByText('Teams');
    expect(teamsLabel.nextElementSibling).toHaveTextContent('3');
  });
});
