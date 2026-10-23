/**
 * B-41 Fixrunde 1 + 2 (Controller-Ruling): Zuschauer-Seite und Monitor zeigen Deutsch, auch bei
 * englischer Browsersprache. Die globale Sprache bleibt unberührt (kein changeLanguage).
 *
 * Gemockt nur die Datenquellen (wie LiveViewScreen.scenarios.test.tsx und folien.test.tsx).
 * i18n ist das echte App-i18n aus src/i18n (Browsersprache en-US in jsdom).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../types/tournament';
import type { MonitorSlide } from '../../types/monitor';
import { buildLiveViewTournament, SHARE_CODE } from '../../screens/__tests__/liveViewFixture';
import {
  attachMonitor, buildTournament, slide, withMonitor, withPlayoffs,
} from '../../features/monitor-display/__tests__/monitorFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => { const q: Record<string, unknown> = { upsert: vi.fn().mockResolvedValue({}), select: () => q, eq: () => q, limit: () => Promise.resolve({ data: [], error: null }) }; return q; }), rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
vi.mock('../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet, getForDisplay: async (id: string) => { const t: unknown = await supabaseGet(id); return t ? { kind: 'full', version: 1, serverNowMs: 0, tournament: t } : { kind: 'not-found' }; }, getByShareCode: supabaseGet }; }),
}));
vi.mock('../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet, getByShareCode: localGet }; }),
}));
// Mit Supabase liest die Seite über die Server-Funktion (Adapter (b)), ohne Supabase über getByShareCode (Adapter (a)).
// Diese Datei prüft die Anzeige mit Daten aus den Repository-Mocks und legt deshalb den Weg ohne Supabase fest (Adapter (a)).
vi.mock('../../features/public-view/defaultPublicSource', async () => {
  const { createLegacyPublicSource } = await import('../../features/public-view/legacyPublicSource');
  return { defaultPublicTournamentSource: createLegacyPublicSource() };
});
vi.mock('../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    liveMatches: new Map(), runningMatches: [], pausedMatches: [], runningMatchIds: new Set<string>(),
    getMatchById: () => undefined, lastGoalEvent: null, clearLastGoalEvent: vi.fn(),
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));

vi.unmock('i18next');
vi.unmock('react-i18next');

import i18n from '../index';
import { anzeigeT, anzeigeI18n, ANZEIGE_SPRACHE } from '../anzeigeSprache';
import { LiveViewScreen } from '../../screens/LiveViewScreen';
import { MonitorDisplayPage } from '../../features/monitor-display/MonitorDisplayPage';
import { createMonitorSource } from '../../features/monitor-display/monitorDataSource';
import { applyFetchError, initialDisplayState } from '../../features/monitor-display/monitorDisplayState';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';

function liveViewMit(data: Tournament | null) {
  supabaseGet.mockResolvedValue(data);
  localGet.mockResolvedValue(null);
  return render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${SHARE_CODE}`]}>
        <LiveViewScreen shareCode={SHARE_CODE} />
      </MemoryRouter>
    </RepositoryProvider>
  );
}

function monitorTurnier(tournament: Tournament, slides: MonitorSlide[]): Tournament {
  return attachMonitor(tournament, withMonitor({ slides }));
}

async function vorspulen(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

/** Monitor-Seite mit Daten aus dem Fixture (Harness wie folien.test.tsx). */
async function starteMonitor(data: Tournament): Promise<void> {
  supabaseGet.mockImplementation(async () => structuredClone(data));
  localGet.mockResolvedValue(null);
  render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
  await vorspulen(0);
}

describe('Feste Anzeigesprache (B-41 Fixrunde 1)', () => {
  beforeEach(() => {
    supabaseGet.mockReset();
    localGet.mockReset();
  });

  it('Vorbedingung: Browsersprache ist Englisch, die globale Sprache steht auf en', () => {
    expect(i18n.language).toBe('en');
    expect(ANZEIGE_SPRACHE).toBe('de');
  });

  it('Gegenbeispiel: globale Sprache bleibt en, ein Admin-Text bleibt englisch', () => {
    expect(anzeigeI18n().language).toBe('de');
    expect(i18n.language).toBe('en');
    expect(i18n.t('admin:visibility.printQr')).toBe('Print QR code');
  });

  it('Nicht-React: anzeigeT liefert Deutsch, applyFetchError meldet den deutschen Standardtext', () => {
    expect(anzeigeT('monitor:error.connection')).toMatch(/^Turnier konnte nicht geladen werden/);
    const next = applyFetchError(initialDisplayState, 'kein Fehlerobjekt');
    expect(next.error).toBe('Fehler beim Laden');
  });

  it('Zuschauer-Seite: Nicht-gefunden-Ansicht zeigt „Zur Startseite“ (nicht englisch)', async () => {
    liveViewMit(null);
    expect(await screen.findByRole('button', { name: 'Zur Startseite' })).toBeInTheDocument();
    expect(screen.queryByText('Go to start page')).toBeNull();
    expect(i18n.language).toBe('en');
  });

  it('Zuschauer-Seite: Spielplan zeigt „Mein Team:“ und den geteilten Baustein „Endstand“ (Ergebnis-Beschriftung)', async () => {
    const tournament = buildLiveViewTournament({ hideRankingsForPublic: true });
    liveViewMit(tournament);
    await screen.findAllByRole('heading', { level: 1, name: tournament.title });
    expect(screen.getByText('Mein Team:')).toBeInTheDocument();
    // @OB-064: der Kreis mit „Ende“ entfällt; der geteilte Baustein ist die Beschriftung des Ergebnisses der Tabellenzeile
    expect(screen.getAllByLabelText(/^Endstand \d+:\d+/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/^Final score/)).toBeNull();
  });

  it('Zuschauer-Seite (c): Ladefehler zeigt „Fehler beim Laden des Turniers“ (nicht englisch)', async () => {
    // Ein Turnier, das beim Verarbeiten scheitert (Teams fehlen), führt zum Ladefehler.
    // Wirft nur die Quelle, meldet die Seite „Turnier nicht gefunden“ (siehe Befund im Report).
    const kaputt = { ...buildLiveViewTournament(), teams: undefined } as unknown as Tournament;
    liveViewMit(kaputt);
    expect(await screen.findByText('Fehler beim Laden des Turniers')).toBeInTheDocument();
    expect(screen.queryByText('Error while loading the tournament')).toBeNull();
    expect(i18n.language).toBe('en');
  });

  it('Monitor: Ladeansicht zeigt „Lade Display...“ (nicht englisch)', () => {
    supabaseGet.mockReturnValue(new Promise(() => undefined));
    localGet.mockReturnValue(new Promise(() => undefined));
    render(
      <RepositoryProvider user={null}>
        <MonitorDisplayPage tournamentId="t-1" monitorId="m-1" />
      </RepositoryProvider>
    );
    expect(screen.getByText('Lade Display...')).toBeInTheDocument();
    expect(screen.queryByText('Loading display...')).toBeNull();
    expect(i18n.language).toBe('en');
  });
});

describe('Monitor-Folien bei Browsersprache en (B-41 Fixrunde 2)', () => {
  beforeEach(() => {
    supabaseGet.mockReset();
    localGet.mockReset();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('(a) Folie „Nächste Spiele“ im Kindermodus zeigt „Nächste Spiele“ und „noch offen“', async () => {
    // Gruppenspiele 8 und 9 beendet: das früheste offene Spiel ist das Halbfinale, Kindermodus verdeckt Platzhalter.
    const data = buildTournament({
      hideScoresForPublic: true,
      matches: withPlayoffs().map(m => (m.id === 'match-8' || m.id === 'match-9' ? { ...m, matchStatus: 'finished' as const, scoreA: 1, scoreB: 0 } : m)),
    });
    await starteMonitor(monitorTurnier(data, [slide('next-matches', { matchCount: 1 })]));
    expect(screen.getByText('Nächste Spiele')).toBeInTheDocument();
    const zeile = screen.getAllByTestId('monitor-match-row')[0];
    expect(within(zeile).getAllByText('noch offen').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Next matches')).toBeNull();
  });

  it('(b) Folie „Alle Tabellen“ mit Gruppen zeigt „Gruppe A“ (B-44b: Linien-Symbol statt Emoji)', async () => {
    await starteMonitor(monitorTurnier(buildTournament(), [slide('all-standings')]));
    expect(screen.getByText('Gruppe A')).toBeInTheDocument();
    expect(screen.queryByText('Group A')).toBeNull();
  });

  it('Soll: Cloud-Timeout-Text bleibt deutsch (monitorDataSource, geloggte Meldung)', async () => {
    supabaseGet.mockReturnValue(new Promise(() => undefined));
    localGet.mockResolvedValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const quelle = createMonitorSource('tour-1', 'mon-1');
    const ergebnis = quelle.fetch(null);
    await vorspulen(4_000);
    await ergebnis;
    const meldungen = warn.mock.calls.map(c => c[1]).filter((x): x is Error => x instanceof Error);
    expect(meldungen.map(e => e.message)).toContain('Cloud-Anfrage nach 4000ms abgebrochen (Timeout)');
    warn.mockRestore();
  });
});
