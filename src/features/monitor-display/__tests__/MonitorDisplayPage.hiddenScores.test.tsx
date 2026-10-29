/**
 * Ergebnisse ausgeblendet am Monitor (B-16e2, @W2A-031, @ZM-090, @ZM-118) – über die gerenderte Seite.
 * Kindermodus: kein Stand, keine Tabelle, keine Tor-Einblendung; Paarung, Feld und Uhr bleiben.
 * Gegenbeispiele: ohne Schalter bleiben Tabelle und Tor-Einblendung da. Sponsor-QR (R7): Zuschauer-Adresse.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import type { MonitorSlide } from '../../../types/monitor';
import type { Match, RuntimeMatchEvent, Tournament } from '../../../types/tournament';
import {
  attachMonitor, buildTournament, FIXTURE_SPONSOR, slide, withMatch, withMonitor,
} from './monitorFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({}) })), rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet, getForDisplay: async (id: string) => { const t: unknown = await supabaseGet(id); return t ? { kind: 'full', version: 1, serverNowMs: 0, tournament: t } : { kind: 'not-found' }; } }; }),
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

import { MonitorDisplayPage } from '../MonitorDisplayPage';

/** Lädt den Monitor über die Cloud-Quelle und wartet, bis die Seite steht. */
async function renderMonitor(tournament: Tournament, slides: MonitorSlide[]): Promise<void> {
  supabaseGet.mockResolvedValue(attachMonitor(tournament, withMonitor({ slides })));
  localGet.mockResolvedValue(null);
  render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
  // Ohne echte Übersetzung steht der Schlüssel `monitor:loading` statt „Lade Display...“ – beides abwarten.
  await waitFor(() => expect(screen.queryByText(/Lade Display\.\.\.|monitor:loading/)).not.toBeInTheDocument());
}

/** Spiel 8 läuft auf Feld 2 (DJK Berg – TuS Mitte), Sponsor „Bäckerei Maier“ im Turnier. */
function spiel8(flags: Partial<Tournament>, patch: Partial<Match> = {}): Tournament {
  return buildTournament({ sponsors: [FIXTURE_SPONSOR], ...flags, matches: withMatch('match-8', { matchStatus: 'running', scoreA: 0, scoreB: 0, ...patch }) });
}

/** Gelbe Karte für DJK Berg Nr. 4 in Spiel 8 (Feld 2). */
const gelbeKarte: RuntimeMatchEvent = {
  id: 'ev-gelb-4', matchId: 'match-8', timestampSeconds: 120, type: 'YELLOW_CARD', payload: { teamId: 'team-berg', playerNumber: 4 }, scoreAfter: { home: 0, away: 0 },
};

/**
 * R5 PR 1: Tor und Karte kommen in der nächsten Antwort (Rückfall-Takt 2 s) – Einblendungen entstehen aus dem Stand.
 * Im Kindermodus liefert der Server keinen Stand; hier liefert die Attrappe ihn trotzdem, damit die Seite die Regel
 * selbst zeigen muss (zweite Sicherung neben dem Server).
 */
async function sponsorMonitorMitAenderung(flags: Partial<Tournament>, nachher: Partial<Match>): Promise<void> {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  const monitor = withMonitor({ slides: [slide('sponsor', { sponsorId: 'sp-1' })] });
  supabaseGet.mockResolvedValue(attachMonitor(spiel8(flags), monitor));
  localGet.mockResolvedValue(null);
  render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  supabaseGet.mockResolvedValue(attachMonitor(spiel8(flags, nachher), monitor));
  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
  expect(screen.getByText('Bäckerei Maier')).toBeInTheDocument();
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('@W2A-031 Monitor im Kindermodus: Live-Folie ohne Stand', () => {
  it('zeigt Paarung und Feld des laufenden Spiels, aber weder Stand noch Stand-Ziffern', async () => {
    await renderMonitor(buildTournament({ hideScoresForPublic: true }), [slide('live', { fieldId: 'field-1' })]);
    expect(screen.getAllByText('FC Nord').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SV Süd').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Feld 1/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Heim: 1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Gast: 0')).not.toBeInTheDocument();
    expect(screen.queryByText('1:0')).not.toBeInTheDocument();
    // B-44a (@W2A-031 neu gefasst): im Kindermodus gibt es keine leeren Kästen mehr, Namen bleiben groß,
    // darunter die Uhr und klein „ohne Ergebnis“
    expect(screen.queryByLabelText('Heim')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Gast')).not.toBeInTheDocument();
    expect(screen.getByText(/liveMatch\.withoutResult/)).toBeInTheDocument();
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

  it('@ZM-118 Kindermodus: gelbe Karte in Spiel 8 wird nicht eingeblendet', async () => {
    await sponsorMonitorMitAenderung({ hideScoresForPublic: true }, { events: [gelbeKarte] });
    expect(screen.queryByText('DJK Berg')).not.toBeInTheDocument();
  });

  it('@ZM-118 Kindermodus: Tor in Spiel 8 wird nicht eingeblendet', async () => {
    await sponsorMonitorMitAenderung({ hideScoresForPublic: true }, { scoreA: 1 });
    expect(screen.queryByText('DJK Berg')).not.toBeInTheDocument();
  });
});

describe('Gegenbeispiele ohne Schalter (Ergebnisse öffentlich)', () => {
  it('Tabelle bleibt sichtbar und zeigt Punkte', async () => {
    await renderMonitor(buildTournament({ hideScoresForPublic: false }), [slide('standings', { groupId: 'A' })]);
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel ohne Schalter: gelbe Karte wird eingeblendet', async () => {
    await sponsorMonitorMitAenderung({ hideScoresForPublic: false }, { events: [gelbeKarte] });
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
  });

  it('Gegenbeispiel ohne Schalter: die Stand-Blöcke zeigen den sichtbaren Stand 1:0', async () => {
    await renderMonitor(buildTournament({ hideScoresForPublic: false }), [slide('live', { fieldId: 'field-1' })]);
    expect(screen.getByLabelText('Heim: 1').textContent).toBe('1');
    expect(screen.getByLabelText('Gast: 0').textContent).toBe('0');
  });

  it('@ZM-083 Eingang: die Tor-Einblendung bleibt grün', async () => {
    await sponsorMonitorMitAenderung({ hideScoresForPublic: false }, { scoreA: 1 });
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
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
