/**
 * @ZM-212 Monitor mit dem Profil „Halle (sehr fern)“ auf der Monitor-Seite: nur die Live-Folie, auch zwischen den Spielen; die gespeicherte
 * Folienliste bleibt unberührt; Monitore ohne Profil (bisherige Darstellung) und mit einem unbekannten Profilwert zeigen ihre Folien unverändert.
 * Aufbau wie `MonitorDisplayPage.programme.test.tsx` (Cloud-Quelle, Fake-Timer).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { Match, Tournament } from '../../../types/tournament';
import type { MonitorSlide, TournamentMonitor } from '../../../types/monitor';
import { attachMonitor, buildTournament, slide, withMatch, withMonitor } from './monitorFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn() }));

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
  return { QRCodeSVG: ({ value }: { value: string }) => React.createElement('svg', { 'data-testid': 'qr-code', 'data-value': value }) };
});
vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    liveMatches: new Map(), runningMatches: [], pausedMatches: [], runningMatchIds: new Set<string>(),
    getMatchById: () => undefined, lastGoalEvent: null, clearLastGoalEvent: vi.fn(),
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));

import { MonitorDisplayPage } from '../MonitorDisplayPage';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

const HALLE = 'hall-very-far' as const;
const text = (headline: string): MonitorSlide => slide('custom-text', { headline });

function monitorMit(slides: MonitorSlide[], overrides: Partial<TournamentMonitor> = {}): Tournament {
  return attachMonitor(buildTournament(), withMonitor({ slides, ...overrides }));
}
function monitorMitSpielen(slides: MonitorSlide[], spiele: Match[], overrides: Partial<TournamentMonitor> = {}): Tournament {
  return attachMonitor(buildTournament({ matches: spiele }), withMonitor({ slides, ...overrides }));
}

async function vorspulen(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
async function starte(data: Tournament): Promise<void> {
  supabaseGet.mockImplementation(async () => structuredClone(data));
  localGet.mockResolvedValue(null);
  render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" />);
  await vorspulen(0);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});
afterEach(() => { vi.useRealTimers(); });

describe('@ZM-212 Profil „Halle (sehr fern)“: nur die Live-Folie', () => {
  it('Live-Spiel, Eigener Text und Tabelle eingerichtet: der Monitor zeigt die Live-Folie als Farbseiten, den Text zeigt er nie', async () => {
    await starte(monitorMit([text('Willkommen'), slide('live', { fieldId: 'field-1' }), slide('standings', { groupId: 'A' })], { profile: HALLE }));
    expect(screen.getByTestId('hall-display')).toBeInTheDocument();
    expect(screen.getByTestId('hall-teamname-home')).toHaveTextContent('FC Nord');
    await vorspulen(60_000); // vier Folienzeiten später
    expect(screen.getByTestId('hall-display')).toBeInTheDocument();
    expect(screen.queryByText('Willkommen')).toBeNull();
    expect(screen.queryByTestId('monitor-slide-dots')).toBeNull(); // nur eine Folie: keine Positionspunkte
  });

  it('Die Folien in der Liste stehen weiter im Monitor (das Profil löscht nichts): ohne Profil zeigt derselbe Monitor sie wieder', async () => {
    // Feld 2 hat kein laufendes Spiel (auf Feld 1 hielte das laufende Spiel die Live-Folie fest): die Folienfolge beginnt beim Text
    const slides = [text('Willkommen'), slide('live', { fieldId: 'field-2' })];
    await starte(monitorMit(slides, {}));
    expect(screen.getByText('Willkommen')).toBeInTheDocument(); // Gegenbeispiel: ohne Profil beginnt die Folienfolge beim Text
    expect(screen.queryByTestId('hall-display')).toBeNull();
  });

  it('Ohne Live-Folie in der Liste ergänzt das Profil eine für Feld 1', async () => {
    await starte(monitorMit([text('Willkommen')], { profile: HALLE }));
    expect(screen.getByTestId('hall-display')).toBeInTheDocument();
    expect(screen.queryByText('Willkommen')).toBeNull();
  });

  it('Läuft auf dem Feld kein Spiel und folgt keines mehr: der Satz „Auf Feld 2 folgt heute kein Spiel mehr“, nicht der Rückfall auf Spielplan oder QR', async () => {
    const fertig = withMatch('match-8', { matchStatus: 'finished', scoreA: 1, scoreB: 0 });
    await starte(monitorMitSpielen([slide('live', { fieldId: 'field-2' })], fertig, { profile: HALLE }));
    expect(screen.getByTestId('hall-no-match')).toHaveTextContent('Auf Feld 2 folgt heute kein Spiel mehr');
    expect(screen.queryByTestId('qr-code')).toBeNull();
  });

  it('Gegenbeispiel: dieselbe Lage ohne Profil überspringt die Live-Folie (Rückfall), den Satz zeigt sie nicht', async () => {
    const fertig = withMatch('match-8', { matchStatus: 'finished', scoreA: 1, scoreB: 0 });
    await starte(monitorMitSpielen([slide('live', { fieldId: 'field-2' })], fertig));
    expect(screen.queryByTestId('hall-no-match')).toBeNull();
  });

  it('Zwischen den Spielen zeigt das Profil das nächste Spiel mit Anstoßzeit (Feld 2, Spiel 8 um 14:20)', async () => {
    await starte(monitorMit([slide('live', { fieldId: 'field-2' })], { profile: HALLE }));
    expect(screen.getByTestId('hall-kickoff')).toHaveTextContent('14:20');
    expect(screen.getByTestId('hall-teamname-home')).toHaveTextContent('DJK Berg');
  });

  it('Ein unbekannter Profilwert (z. B. aus einer neueren Fassung) gilt als nicht gesetzt: bisherige Darstellung, kein Absturz', async () => {
    const unbekannt = { profile: 'zukunft-profil' } as unknown as Partial<TournamentMonitor>;
    await starte(monitorMit([text('Willkommen'), slide('live', { fieldId: 'field-2' })], unbekannt));
    expect(screen.getByText('Willkommen')).toBeInTheDocument();
    expect(screen.queryByTestId('hall-display')).toBeNull();
  });
});
