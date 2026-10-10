/**
 * Ergebnisse ausgeblendet am Monitor (B-16e2, @W2A-031, @ZM-090, @ZM-118) – über die gerenderte Seite.
 * Kindermodus: kein Stand, keine Tabelle, keine Tor-Einblendung; Paarung, Feld und Uhr bleiben.
 * Gegenbeispiele: ohne Schalter bleiben Tabelle und Tor-Einblendung da. Sponsor-QR (R7): Zuschauer-Adresse.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { GoalEventInfo } from '../../../hooks/useLiveMatches';
import type { MonitorSlide } from '../../../types/monitor';
import type { Tournament } from '../../../types/tournament';
import {
  attachMonitor, buildTournament, FIXTURE_SPONSOR, slide, withMonitor,
} from './monitorFixture';

const { supabaseGet, localGet, live } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
  live: { goal: null as GoalEventInfo | null, clearGoal: vi.fn() },
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({}) })), rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));
vi.mock('qrcode.react', async () => {
  const React = await import('react');
  return {
    QRCodeSVG: ({ value }: { value: string }) => React.createElement('svg', { 'data-testid': 'qr-code', 'data-value': value }),
  };
});
vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    liveMatches: new Map(), runningMatches: [], pausedMatches: [], runningMatchIds: new Set<string>(),
    getMatchById: () => undefined, lastGoalEvent: live.goal, clearLastGoalEvent: live.clearGoal,
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));

import { MonitorDisplayPage } from '../MonitorDisplayPage';

/** Lädt den Monitor über die Cloud-Quelle und wartet, bis die Seite steht. */
async function renderMonitor(tournament: Tournament, slides: MonitorSlide[]): Promise<void> {
  supabaseGet.mockResolvedValue(attachMonitor(tournament, withMonitor({ slides })));
  localGet.mockResolvedValue(null);
  render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
  await waitFor(() => expect(screen.queryByText('Lade Display...')).not.toBeInTheDocument());
}

/** Tor von DJK Berg in Spiel 8 (Feld 2). */
function torInSpiel8(): GoalEventInfo {
  return { matchId: 'match-8', teamId: 'team-berg', teamName: 'DJK Berg', side: 'home', timestamp: 1, newScore: { home: 1, away: 0 } };
}

beforeEach(() => {
  vi.clearAllMocks();
  live.goal = null;
});

describe('@W2A-031 Monitor im Kindermodus: Live-Folie ohne Stand', () => {
  it('zeigt Paarung und Feld des laufenden Spiels, aber weder Stand noch Stand-Ziffern', async () => {
    await renderMonitor(buildTournament({ hideScoresForPublic: true }), [slide('live', { fieldId: 'field-1' })]);
    expect(screen.getAllByText('FC Nord').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SV Süd').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Feld 1/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Heim: 1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Gast: 0')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Heim')).toBeInTheDocument();
    expect(screen.queryByText('1:0')).not.toBeInTheDocument();
  });

  it('Spielplan-Folie zeigt Paarung und Feld, ohne Ergebnis und ohne „-:-“', async () => {
    await renderMonitor(buildTournament({ hideScoresForPublic: true }), [slide('schedule-field', { fieldId: 'field-1' })]);
    expect(screen.getAllByText('FC Nord').length).toBeGreaterThan(0);
    expect(screen.queryByText('1:0')).not.toBeInTheDocument();
    expect(screen.queryByText('-:-')).not.toBeInTheDocument();
  });
});

describe('@ZM-090 / @ZM-118 Kindermodus am Monitor', () => {
  it('@ZM-090 Nur eine Tabelle im Programm: der Monitor zeigt die Zuschauer-QR-Folie (Zuschauer-Adresse)', async () => {
    await renderMonitor(buildTournament({ hideScoresForPublic: true }), [slide('standings', { groupId: 'A' })]);
    expect(screen.getByTestId('qr-code').getAttribute('data-value')).toContain('/#/live/ABC123');
    expect(screen.queryByText('FC Nord')).not.toBeInTheDocument();
  });

  it('@ZM-118 Kindermodus: Tor in Spiel 8 wird nicht eingeblendet', async () => {
    live.goal = torInSpiel8();
    await renderMonitor(buildTournament({ sponsors: [FIXTURE_SPONSOR], hideScoresForPublic: true }), [slide('sponsor', { sponsorId: 'sp-1' })]);
    expect(screen.queryByText('DJK Berg')).not.toBeInTheDocument();
  });
});

describe('Gegenbeispiele ohne Schalter (Ergebnisse öffentlich)', () => {
  it('Tabelle bleibt sichtbar und zeigt Punkte', async () => {
    await renderMonitor(buildTournament({ hideScoresForPublic: false }), [slide('standings', { groupId: 'A' })]);
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });

  it('@ZM-083 Eingang: die Tor-Einblendung bleibt grün', async () => {
    live.goal = torInSpiel8();
    await renderMonitor(buildTournament({ sponsors: [FIXTURE_SPONSOR], hideScoresForPublic: false }), [slide('sponsor', { sponsorId: 'sp-1' })]);
    expect(await screen.findByText('DJK Berg')).toBeInTheDocument();
  });
});

describe('Sponsor-QR-Rückfall (R7): nie die Verwaltung', () => {
  it('öffentliches Turnier: Sponsor-Folie ohne eigene Adresse führt zur Zuschauer-Adresse', async () => {
    await renderMonitor(buildTournament({ sponsors: [FIXTURE_SPONSOR] }), [slide('sponsor', { sponsorId: 'sp-1' })]);
    const wert = screen.getByTestId('qr-code').getAttribute('data-value') ?? '';
    expect(wert).toContain('/#/live/ABC123');
    expect(wert).not.toContain('/#/tournament/');
  });

  it('nicht öffentliches Turnier: kein QR-Code auf der Sponsor-Folie', async () => {
    await renderMonitor(
      buildTournament({ sponsors: [FIXTURE_SPONSOR], isPublic: false, shareCode: undefined }),
      [slide('sponsor', { sponsorId: 'sp-1' })],
    );
    expect(screen.getByText('Bäckerei Maier')).toBeInTheDocument();
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });
});
