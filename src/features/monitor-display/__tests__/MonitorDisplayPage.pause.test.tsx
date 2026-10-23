/**
 * Leertaste ohne Wirkung (B-17 Fixrunde, @ME-022): die Folienfolge läuft unabhängig von der Taste weiter.
 * Dazu die Seitenzuordnung der Spielplan-Zeile (B-16d1 Lücke: Seite A links,
 * Seite B rechts). Eigene Datei, damit die eingefrorenen a-Dateien unverändert bleiben.
 * Jeder Poll liefert einen strukturellen Klon (wie SupabaseRepository.get), die Zeit läuft in Schritten.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import type { GoalEventInfo } from '../../../hooks/useLiveMatches';
import type { Tournament } from '../../../types/tournament';
import { attachMonitor, buildTournament, slide, withMatch, withMonitor } from './monitorFixture';

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
vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    liveMatches: new Map(), runningMatches: [], pausedMatches: [], runningMatchIds: new Set<string>(),
    getMatchById: () => undefined, lastGoalEvent: live.goal, clearLastGoalEvent: live.clearGoal,
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));

import { MonitorDisplayPage } from '../MonitorDisplayPage';

function monitorTurnier(): Tournament {
  return attachMonitor(buildTournament(), withMonitor({
    slides: [slide('custom-text', { headline: 'Folie A' }), slide('custom-text', { headline: 'Folie B' })],
  }));
}

/** Jeder Poll liefert einen strukturellen Klon, so wie SupabaseRepository.get neue Objekte baut. */
function liefere(data: Tournament): void {
  supabaseGet.mockImplementation(async () => structuredClone(data));
}

async function vorspulen(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

/** Spult in 1-s-Schritten vor, damit zwischen Polls und Timern gerendert wird. */
async function vorspulenInSchritten(ms: number): Promise<void> {
  for (let i = 0; i < ms / 1_000; i++) { await vorspulen(1_000); }
}

beforeEach(() => {
  vi.clearAllMocks();
  live.goal = null;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MonitorDisplayPage — Leertaste ohne Wirkung (@ME-022, B-17 Fixrunde)', () => {
  // Begründung: @ME-022 „die Leertaste … halten das Folienprogramm nicht an“ und Record monitor-einrichten
  // Z. 175–177 „Leertaste und Pfeiltasten halten das Folienprogramm nicht mehr an und schalten nicht weiter“.
  // Vorher: Leertaste hielt die Folie an (Befund C-MONITOR-DAUERBETRIEB, Gegenbeispiel zum Soll).
  it('Leertaste bei 5 s hält Folie A nicht an: Folie B kommt nach den 15 s der Dauer, kein Pausen-Badge', async () => {
    liefere(monitorTurnier());
    localGet.mockResolvedValue(null);
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await vorspulen(0);
    expect(screen.getByText('Folie A')).toBeInTheDocument();

    await vorspulenInSchritten(5_000);
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.queryByTestId('monitor-pause-indicator')).not.toBeInTheDocument();
    await vorspulenInSchritten(9_000);
    expect(screen.getByText('Folie A')).toBeInTheDocument();
    await vorspulen(1_000);
    expect(screen.getByText('Folie B')).toBeInTheDocument();
  });

  it('Spielplan-Zeile: Seite A links, Seite B rechts (Feld 1: FC Nord 1:0 SV Süd)', async () => {
    liefere(attachMonitor(buildTournament(), withMonitor({ slides: [slide('schedule-field', { fieldId: 'field-1' })] })));
    localGet.mockResolvedValue(null);
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await vorspulen(0);
    // B-16f3: Zeile mit Uhrzeit und Feld; geprüft wird nur die Reihenfolge der Teams (A vor B) und der Stand.
    const zeile = screen.getByText('FC Nord').closest('[data-testid="monitor-match-row"]')?.textContent ?? '';
    expect(zeile).toContain('1:0');
    expect(zeile.indexOf('FC Nord')).toBeLessThan(zeile.indexOf('SV Süd'));
  });
});

describe('MonitorDisplayPage — Heim/Gast der Live-Folie und nächstes Spiel (B-16d1 Fixliste 1)', () => {
  it('Live-Folie Feld 1 mit laufendem Spiel 7: FC Nord (Heim) steht vor SV Süd (Gast)', async () => {
    liefere(attachMonitor(buildTournament(), withMonitor({ slides: [slide('live', { fieldId: 'field-1' })] })));
    localGet.mockResolvedValue(null);
    const { container } = render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await vorspulen(0);
    const text = container.textContent ?? '';
    expect(text.indexOf('FC Nord')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('FC Nord')).toBeLessThan(text.indexOf('SV Süd'));
  });

  // Ruling B-16e1 (@ZM-122): Ist die einzige Folie eine Live-Folie ohne Spiel auf ihrem Feld, gilt der Rückfall
  // (Zuschauer-QR). „Nächstes Spiel“ erscheint nicht mehr. Der frühere Stand (TuS Mitte vor Kickers West) entfällt.
  it('Live-Folie Feld 1 nach Ende von Spiel 7, nächstes Spiel auf Feld 1 außerhalb der Vorlaufzeit → Zuschauer-QR statt „Nächstes Spiel“', async () => {
    // Uhr: 10:00 am Turnierdatum, vor allen Anstößen und außerhalb der Vorlaufzeit (@ZM-122, @ZM-138)
    vi.setSystemTime(new Date('2025-01-15T09:00:00Z'));
    liefere(attachMonitor(
      buildTournament({ matches: withMatch('match-7', { matchStatus: 'finished' }) }),
      withMonitor({ slides: [slide('live', { fieldId: 'field-1' })] }),
    ));
    localGet.mockResolvedValue(null);
    const { container } = render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await vorspulen(0);
    expect(container.querySelector('[data-testid="qr-code"]')).not.toBeNull();
    expect(container.textContent ?? '').not.toContain('Nächstes Spiel');
  });
});
