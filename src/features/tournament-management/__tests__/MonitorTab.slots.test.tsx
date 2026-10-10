/**
 * MonitorTab (Leitungs-Vorschau des Monitors) – A-04a: „nächstes Spiel“ über slotLabel.
 * @TM-015 offene Seite zeigt ihre Herkunft; Gegenbeispiel: Umbenennen wirkt, nie der gespeicherte Name.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule, ScheduledMatch } from '../../../core/generators';
import { teamSlot, pendingSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';

vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    runningMatches: [], pausedMatches: [], lastGoalEvent: null, clearLastGoalEvent: vi.fn(),
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));
vi.mock('../../../components/monitor', () => ({
  LiveMatchDisplay: () => null, NoMatchDisplay: () => null, FieldSelector: () => null, FullscreenControls: () => null,
  useFullscreen: () => ({ isFullscreen: false, toggleFullscreen: vi.fn() }),
  GoalAnimation: () => null, CardAnimation: () => null, NextMatchPreview: () => null,
}));
vi.mock('../components/StandingsDisplay', () => ({ StandingsDisplay: () => null }));
vi.mock('i18next', async () => {
  const actual = await vi.importActual<typeof import('i18next')>('i18next');
  const de = (await import('../../../i18n/locales/de/tournament.json')).default;
  const instance = actual.default.createInstance();
  await instance.init({ lng: 'de', fallbackLng: false, resources: { de: { tournament: de } }, interpolation: { escapeValue: false } });
  return { default: instance };
});

import { MonitorTab } from '../MonitorTab';

const NORD = testUuid(1);
const start = new Date('2026-10-03T10:00:00');
const hf1: ScheduledMatch = {
  id: testUuid(101), matchNumber: 7, time: '11:00', field: 1, slot: 1, phase: 'semifinal', duration: 10,
  startTime: start, endTime: start, label: '1. Halbfinale',
  homeTeam: 'ALTER NAME HEIM', awayTeam: 'ALTER NAME GAST', originalTeamA: 'alt-a', originalTeamB: 'alt-b',
  slotA: teamSlot(NORD), slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }),
};

function setup(teamName: string) {
  const teams = [{ id: NORD, name: teamName }];
  const tournament = { id: 't1', numberOfFields: 1, teams, groups: [], matches: [] } as unknown as Tournament;
  const schedule = { teams, phases: [{ name: 'final', label: 'Finale', matches: [hf1] }], allMatches: [hf1] } as unknown as GeneratedSchedule;
  return render(<MonitorTab tournament={tournament} schedule={schedule} currentStandings={[]} />);
}

describe('MonitorTab – nächstes Spiel über slotLabel', () => {
  beforeEach(async () => { await i18next.changeLanguage('de'); });

  it('@TM-015 offene Seite zeigt „Zweiter Gruppe B“, besetzte den Teamnamen', () => {
    setup('FC Nord');
    expect(screen.getByText(/FC Nord vs\. Zweiter Gruppe B/)).toBeInTheDocument();
  });

  it('@TM-015 Gegenbeispiel: nach Umbenennen zeigt die Karte den neuen Namen, nie „ALTER NAME“', () => {
    setup('FC Nordlicht');
    expect(screen.getByText(/FC Nordlicht vs\. Zweiter Gruppe B/)).toBeInTheDocument();
    expect(screen.queryByText(/ALTER NAME/)).toBeNull();
  });
});
