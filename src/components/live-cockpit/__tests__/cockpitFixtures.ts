import { vi } from 'vitest';
import type { LiveCockpitProps } from '../types';
import type { LiveMatch } from '../../../core/models/LiveMatch';

export const NAME_50 = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';

export function makeLiveMatch(overrides: Partial<LiveMatch> = {}): LiveMatch {
  return {
    id: 'match-11', number: 11, phaseLabel: 'Gruppenphase', fieldId: 'field-1',
    scheduledKickoff: '2026-11-28T10:00:00.000Z', durationSeconds: 600,
    homeTeam: { id: 'fc-nord', name: 'FC Nord' }, awayTeam: { id: 'sv-sued', name: 'SV Süd' },
    homeScore: 0, awayScore: 0, status: 'RUNNING', elapsedSeconds: 192, playPhase: 'regular',
    events: [], retractedEvents: [],
    ...overrides,
  } as LiveMatch;
}

export function makeProps(match: LiveMatch | null, overrides: Partial<LiveCockpitProps> = {}): LiveCockpitProps {
  return {
    fieldName: 'Feld 1', tournamentName: 'Hallencup Süd', tournamentId: 'tour-1',
    currentMatch: match, upcomingMatches: [],
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
    onLoadNextMatch: vi.fn(),
    ...overrides,
  };
}
