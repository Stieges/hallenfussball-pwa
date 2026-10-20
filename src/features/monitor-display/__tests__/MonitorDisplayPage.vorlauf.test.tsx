/**
 * @ZM-138 / @ZM-122 / @ZP-090 (Monitor-Anzeige): Vor dem Anpfiff zeigt die Live-Folie des Feld-Monitors das nächste Spiel
 * mit Anstoßzeit – ab der Vorlaufzeit (Pausendauer, mindestens 5 Minuten). Davor überspringt der Monitor die Folie.
 * Befund C-MONITOR-OHNE-NAECHSTES-SPIEL: ein Monitor mit nur der Live-Folie zeigte stattdessen die Zuschauer-QR-Folie.
 *
 * Die Uhr ist fest (Europe/Berlin, Dezember = UTC+1); nur `Date` ist gefälscht, damit die Abfrage der Seite normal läuft.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props: { value: string }) => <div data-testid="qr-code" data-value={props.value} />,
}));

const { supabaseGet, localGet } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn() }));

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
vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    liveMatches: new Map(), runningMatches: [], pausedMatches: [], runningMatchIds: new Set<string>(),
    getMatchById: vi.fn(), lastGoalEvent: null, clearLastGoalEvent: vi.fn(),
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));

import { MonitorDisplayPage } from '../MonitorDisplayPage';
import type { Match, Team } from '../../../types/tournament';
import { attachMonitor, buildTournament, FIXTURE_TEAMS, slide, withMonitor } from './monitorFixture';
import { looseVs } from '../../../test/matchSlotFixtures';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

/** Turniertag 5.12.2026; Berlin im Winter = UTC+1, also ist 16:10 Berlin = 15:10 UTC. */
const TAG = '2026-12-05';
const um = (stunde: number, minute: number): Date => new Date(Date.UTC(2026, 11, 5, stunde - 1, minute));

function spiel(id: string, nummer: number, feld: number, h: number, min: number, status: Match['matchStatus'] = 'scheduled'): Match {
  return {
    id, matchNumber: nummer, round: nummer, field: feld, group: 'A', ...looseVs('team-sued', 'team-nord'),
    matchStatus: status, scheduledTime: new Date(2026, 11, 5, h, min),
  };
}

function turnier(opts: { spiele: Match[]; folien: ReturnType<typeof slide>[]; pause?: number; teams?: Team[] }) {
  return attachMonitor(
    buildTournament({ date: TAG, matches: opts.spiele, groupPhaseBreakDuration: opts.pause ?? 3, ...(opts.teams ? { teams: opts.teams } : {}) }),
    withMonitor({ id: 'mon-1', slides: opts.folien, performanceMode: 'low' }),
  );
}

async function zeigeUm(zeit: Date, t: ReturnType<typeof turnier>) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(zeit);
  supabaseGet.mockResolvedValue(t);
  return render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
}

describe('Monitor mit nur der Live-Folie vor dem Anpfiff (@ZM-138, @ZP-090)', () => {
  beforeEach(() => { vi.clearAllMocks(); localGet.mockResolvedValue(null); });
  afterEach(() => { vi.useRealTimers(); });

  it('@ZP-090: 16:10, erster Anstoß 16:15 → „Nächstes Spiel“ mit Anstoß 16:15, nicht die Zuschauer-QR-Folie', async () => {
    await zeigeUm(um(16, 10), turnier({ spiele: [spiel('m1', 1, 1, 16, 15)], folien: [slide('live', { fieldId: 'field-1' })] }));
    await waitFor(() => expect(screen.getByText('Nächstes Spiel')).toBeInTheDocument());
    expect(screen.getByText(/Anstoß 16:15/)).toBeInTheDocument();
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });

  it('@ZM-138: Pause 3 Minuten, um 15:30 SV Süd gegen FC Nord, nur SV Süd mit Logo → um 15:26 „Nächstes Spiel“ mit Anstoßzeit, SV Süd mit Logo, FC Nord mit Initialen', async () => {
    const teams = FIXTURE_TEAMS.map(t => (t.id === 'team-sued' ? { ...t, logo: { type: 'url' as const, value: 'https://logos.example/sued.png' } } : t));
    await zeigeUm(um(15, 26), turnier({ teams, spiele: [spiel('m1', 1, 1, 15, 30)], folien: [slide('live', { fieldId: 'field-1' })] }));
    await waitFor(() => expect(screen.getByText('Nächstes Spiel')).toBeInTheDocument());
    expect(screen.getByText(/Anstoß 15:30/)).toBeInTheDocument();
    const logo = screen.getByAltText('SV Süd Logo');
    expect(logo).toHaveAttribute('src', 'https://logos.example/sued.png');
    expect(screen.getByText('SV Süd')).toBeInTheDocument();
    expect(screen.getByText('FN')).toBeInTheDocument(); // Initialen von FC Nord
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    expect(screen.queryByAltText('FC Nord Logo')).not.toBeInTheDocument();
  });

  it('@ZM-138: Pause 3 Minuten → genau um 15:25 beginnt die Vorlaufzeit (mindestens 5 Minuten)', async () => {
    await zeigeUm(um(15, 25), turnier({ spiele: [spiel('m1', 1, 1, 15, 30)], folien: [slide('live', { fieldId: 'field-1' })] }));
    await waitFor(() => expect(screen.getByText('Nächstes Spiel')).toBeInTheDocument());
  });

  it('@ZM-138 Gegenbeispiel: Pause 3 Minuten → um 15:24 ist es zu früh, kein „Nächstes Spiel“', async () => {
    await zeigeUm(um(15, 24), turnier({ spiele: [spiel('m1', 1, 1, 15, 30)], folien: [slide('live', { fieldId: 'field-1' })] }));
    await waitFor(() => expect(supabaseGet).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Wird geladen...')).not.toBeInTheDocument());
    expect(screen.queryByText('Nächstes Spiel')).not.toBeInTheDocument();
  });

  it('@ZM-138: Pause 8 Minuten → ab 15:22 „Nächstes Spiel“', async () => {
    await zeigeUm(um(15, 22), turnier({ pause: 8, spiele: [spiel('m1', 1, 1, 15, 30)], folien: [slide('live', { fieldId: 'field-1' })] }));
    await waitFor(() => expect(screen.getByText('Nächstes Spiel')).toBeInTheDocument());
  });

  it('@ZM-138 Gegenbeispiel: Pause 8 Minuten → um 15:21 noch nicht', async () => {
    await zeigeUm(um(15, 21), turnier({ pause: 8, spiele: [spiel('m1', 1, 1, 15, 30)], folien: [slide('live', { fieldId: 'field-1' })] }));
    await waitFor(() => expect(supabaseGet).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Wird geladen...')).not.toBeInTheDocument());
    expect(screen.queryByText('Nächstes Spiel')).not.toBeInTheDocument();
  });

  it('@ZM-122: zeigt nie das nächste Spiel eines anderen Felds (Spiel nur auf Feld 2, Monitor auf Feld 1)', async () => {
    await zeigeUm(um(16, 10), turnier({ spiele: [spiel('m2', 2, 2, 16, 15)], folien: [slide('live', { fieldId: 'field-1' })] }));
    await waitFor(() => expect(supabaseGet).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Wird geladen...')).not.toBeInTheDocument());
    expect(screen.queryByText('Nächstes Spiel')).not.toBeInTheDocument();
  });

  it('@ZM-122: der Anstoß liegt auf dem Turnierdatum – dasselbe Uhrzeit-Fenster an einem anderen Tag zählt nicht', async () => {
    const anderesDatum = new Date(Date.UTC(2026, 11, 4, 15, 10)); // Vortag 16:10 Berlin
    await zeigeUm(anderesDatum, turnier({ spiele: [spiel('m1', 1, 1, 16, 15)], folien: [slide('live', { fieldId: 'field-1' })] }));
    await waitFor(() => expect(supabaseGet).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Wird geladen...')).not.toBeInTheDocument());
    expect(screen.queryByText('Nächstes Spiel')).not.toBeInTheDocument();
  });
});

describe('Monitor mit mehreren Folien: die Live-Folie nur in der Vorlaufzeit (@ZM-122, @ZM-138)', () => {
  beforeEach(() => { vi.clearAllMocks(); localGet.mockResolvedValue(null); });
  afterEach(() => { vi.useRealTimers(); });

  const folien = () => [slide('live', { fieldId: 'field-1' }), slide('qr-code', {})];

  it('@ZM-122: 12:45, Spiel um 13:00, Vorlaufzeit nicht begonnen → die Live-Folie wird übersprungen, QR steht da', async () => {
    await zeigeUm(um(12, 45), turnier({ spiele: [spiel('m1', 1, 1, 13, 0)], folien: folien() }));
    await waitFor(() => expect(screen.getByTestId('qr-code')).toBeInTheDocument());
    expect(screen.queryByText('Nächstes Spiel')).not.toBeInTheDocument();
  });

  it('@ZM-138: 12:55 (Vorlaufzeit begonnen) → die Live-Folie kommt in der Folge dran und zeigt „Nächstes Spiel“', async () => {
    await zeigeUm(um(12, 55), turnier({ spiele: [spiel('m1', 1, 1, 13, 0)], folien: folien() }));
    await waitFor(() => expect(screen.getByText('Nächstes Spiel')).toBeInTheDocument());
    expect(screen.getByText(/Anstoß 13:00/)).toBeInTheDocument();
  });
});

describe('Der Beginn der Vorlaufzeit erreicht den laufenden Monitor ohne Neuladen (@ZM-138)', () => {
  beforeEach(() => { vi.clearAllMocks(); localGet.mockResolvedValue(null); });
  afterEach(() => { vi.useRealTimers(); });

  it('Nur Live-Folie, Anstoß 15:30, Pause 3: um 15:24:50 kein „Nächstes Spiel“, nach dem nächsten Abruf (ab 15:25) steht es da', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date(Date.UTC(2026, 11, 5, 14, 24, 50)));
    const t = turnier({ spiele: [spiel('m1', 1, 1, 15, 30)], folien: [slide('live', { fieldId: 'field-1' })] });
    supabaseGet.mockImplementation(async () => structuredClone(t)); // jeder Abruf liefert neue Objekte
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByText('Nächstes Spiel')).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); }); // ein Abruf alle 10 s (Profil „low“)
    expect(screen.getByText('Nächstes Spiel')).toBeInTheDocument();
    expect(screen.getByText(/Anstoß 15:30/)).toBeInTheDocument();
  });
});
