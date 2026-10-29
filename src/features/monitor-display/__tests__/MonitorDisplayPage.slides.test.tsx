/**
 * Folieninhalte, Tasten und Einblendungen des Monitors — heutiges Verhalten (B-16a1).
 * Keine Produktivdatei wird geändert. Was heute nicht dem Soll entspricht, steht als
 * `it.fails` (Soll) mit grünem „Bestand:“-Zwilling daneben.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
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
// QR-Wert sichtbar machen: die Tests lesen `data-value` statt des SVG-Inhalts.
vi.mock('qrcode.react', async () => {
  const React = await import('react');
  return {
    QRCodeSVG: ({ value }: { value: string }) => React.createElement('svg', { 'data-testid': 'qr-code', 'data-value': value }),
  };
});

import { MonitorDisplayPage } from '../MonitorDisplayPage';

vi.unmock('i18next'); vi.unmock('react-i18next'); // B-41: echte DE-Texte, siehe src/test/realDeI18n.ts
await (await import('../../../test/realDeI18n')).initRealDeI18n();

/** Punkte-Zelle (letzte Spalte) der Tabellenzeile eines Teams. */
function pointsOf(teamName: string): string | null {
  return screen.getByText(teamName).parentElement?.lastElementChild?.textContent ?? null;
}

/** Lädt den Monitor über die Cloud-Quelle und wartet, bis die Seite steht. */
async function renderMonitor(tournament: Tournament, slides: MonitorSlide[]) {
  const monitor = withMonitor({ slides });
  supabaseGet.mockResolvedValue(attachMonitor(tournament, monitor));
  localGet.mockResolvedValue(null);
  const onBack = vi.fn();
  render(<MonitorDisplayPage tournamentId={tournament.id} monitorId={monitor.id} onBack={onBack} />);
  await waitFor(() => expect(screen.queryByText('Lade Display...')).not.toBeInTheDocument(), { timeout: 5_000 });
  return { onBack };
}

/** Tabellen-Tests: Spiel 7 läuft noch und zählt sonst mit seinem Zwischenstand (siehe Bestand unten). */
function tabelle(flags: Partial<Tournament> = {}): Tournament {
  return buildTournament({ ...flags, matches: withMatch('match-7', { scoreA: undefined, scoreB: undefined }) });
}

/** Spiel 8 läuft auf Feld 2 (DJK Berg – TuS Mitte); `patch` ändert den Stand bzw. die Ereignisse. */
const spiel8 = (patch: Partial<Match> = {}): Tournament =>
  buildTournament({ sponsors: [FIXTURE_SPONSOR], matches: withMatch('match-8', { matchStatus: 'running', scoreA: 0, scoreB: 0, ...patch }) });

/**
 * R5 PR 1: Einblendungen kommen aus derselben Antwort wie der Stand. Erst-Laden mit `vorher`, die nächste Antwort
 * (Rückfall-Takt 2 s; das Änderungssignal holt sie sonst sofort) bringt `nachher`.
 */
async function ladeUndAendere(slides: MonitorSlide[], vorher: Tournament, nachher: Tournament): Promise<void> {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  const monitor = withMonitor({ slides });
  supabaseGet.mockResolvedValue(attachMonitor(vorher, monitor));
  localGet.mockResolvedValue(null);
  render(<MonitorDisplayPage tournamentId="tour-1" monitorId={monitor.id} onBack={vi.fn()} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  supabaseGet.mockResolvedValue(attachMonitor(nachher, monitor));
  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MonitorDisplayPage — Folieninhalt (Bestand)', { timeout: 15_000 }, () => {
  it.each([
    {
      zeile: 'Tabelle einer Gruppe (Gruppe A)',
      run: async () => {
        await renderMonitor(tabelle(), [slide('standings', { groupId: 'A' })]);
        expect(screen.getByText(/Gruppe A/)).toBeInTheDocument();
        expect(pointsOf('FC Nord')).toBe('3');
        expect(pointsOf('SC Ost')).toBe('0');
      },
    },
    {
      zeile: 'Sponsor („Bäckerei Maier“)',
      run: async () => {
        await renderMonitor(buildTournament({ sponsors: [FIXTURE_SPONSOR] }), [slide('sponsor', { sponsorId: 'sp-1' })]);
        expect(screen.getByText('Bäckerei Maier')).toBeInTheDocument();
      },
    },
    {
      zeile: 'Eigener Text („Kuchen in der Pausenhalle“)',
      run: async () => {
        await renderMonitor(buildTournament(), [slide('custom-text', { headline: 'Kuchen in der Pausenhalle' })]);
        expect(screen.getByText('Kuchen in der Pausenhalle')).toBeInTheDocument();
      },
    },
  ])('@ZM-071 $zeile', async ({ run }) => { await run(); });

  it('Bestand: Live-Folie Feld 1 zeigt FC Nord – SV Süd mit 1:0, ohne „1. Halbzeit“', async () => {
    await renderMonitor(buildTournament(), [slide('live', { fieldId: 'field-1' })]);
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    expect(screen.getByText('SV Süd')).toBeInTheDocument();
    expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Gast: 0')).toBeInTheDocument();
    expect(screen.queryByText('1. Halbzeit')).not.toBeInTheDocument();
  });

  // @TM-143 (B-40): Der Bestand „6 Punkte“ (laufendes Spiel 7 zählte mit Zwischenstand) ist bewusst umgedreht.
  it('@TM-143 Tabelle zählt das laufende Spiel 7 nicht (FC Nord 3 Punkte, nur Spiel 1)', async () => {
    await renderMonitor(buildTournament(), [slide('standings', { groupId: 'A' })]);
    expect(pointsOf('FC Nord')).toBe('3');
  });

  it('@TM-143 Tabelle zählt Spiel 7 nach dem Abpfiff (FC Nord 6 Punkte)', async () => {
    await renderMonitor(
      buildTournament({ matches: withMatch('match-7', { matchStatus: 'finished' }) }),
      [slide('standings', { groupId: 'A' })],
    );
    expect(pointsOf('FC Nord')).toBe('6');
  });
});

describe('MonitorDisplayPage — Tasten (Bestand)', { timeout: 15_000 }, () => {
  const zweiFolien = () => [
    slide('custom-text', { headline: 'Erste Folie' }),
    slide('custom-text', { headline: 'Zweite Folie' }),
    slide('custom-text', { headline: 'Dritte Folie' }),
  ];

  // B-17 Fixrunde (@ME-022, Record monitor-einrichten Z. 175–177): Pfeiltasten schalten nicht weiter.
  // Vorher: ArrowRight/ArrowLeft wechselten die Folie (Gegenbeispiel zum Soll).
  it('B-17: Pfeiltasten schalten nicht weiter und nicht zurück', async () => {
    await renderMonitor(buildTournament(), zweiFolien());
    expect(screen.getByText('Erste Folie')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Erste Folie')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Erste Folie')).toBeInTheDocument();
  });

  // B-17 Fixrunde (@ME-022, Record Z. 175–177): Leertaste hält nicht an, es gibt kein Pausen-Badge mehr.
  // Vorher: Leertaste schaltete den Pausen-Indikator (Gegenbeispiel zum Soll).
  it('B-17: Leertaste hat keine Wirkung, kein Pausen-Indikator', async () => {
    await renderMonitor(buildTournament(), zweiFolien());
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.queryByTestId('monitor-pause-indicator')).not.toBeInTheDocument();
    expect(screen.getByText('Erste Folie')).toBeInTheDocument();
  });

  // B-17 (@ME-022, Befund C-MONITOR-DAUERBETRIEB): Escape verlässt die Seite nicht mehr; das alte Verhalten
  // (Rücksprung zur Startseite) war der Fehler. Vorher: onBack einmal aufgerufen.
  it('B-17: Escape ruft onBack nicht auf, die Seite bleibt offen', async () => {
    const { onBack } = await renderMonitor(buildTournament(), zweiFolien());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).not.toHaveBeenCalled();
  });

  it('Bestand: Taste c blendet die Cache-Anzeige ein', async () => {
    await renderMonitor(buildTournament(), zweiFolien());
    expect(screen.queryByText(/^\d+s$/)).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'c' });
    expect(screen.getByText(/^\d+s$/)).toBeInTheDocument();
  });
});

describe('MonitorDisplayPage — Einblendungen (Tor)', { timeout: 15_000 }, () => {
  afterEach(() => { vi.useRealTimers(); });

  it('@ZM-083 Eingang: Tor in Spiel 8 (DJK Berg) wird im Monitor eingeblendet', async () => {
    await ladeUndAendere([slide('custom-text', { headline: 'Willkommen' })], spiel8(), spiel8({ scoreA: 1 }));
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
  });

  it('@ZM-083 Feld 1: Tor auf Feld 2 wird auf dem Feld-1-Monitor nicht eingeblendet', async () => {
    await ladeUndAendere([slide('live', { fieldId: 'field-1' })], spiel8(), spiel8({ scoreA: 1 }));
    expect(screen.queryByText('DJK Berg')).not.toBeInTheDocument();
  });

  it('@ZM-083 Feld 2 mit Live-Folie von Spiel 8: Einblendung und zugleich der neue Stand, danach die Live-Folie mit dem Stand', async () => {
    await ladeUndAendere([slide('live', { fieldId: 'field-2' })], spiel8(), spiel8({ scoreA: 1 }));
    expect(screen.getByText('TOR!')).toBeInTheDocument();
    expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    expect(screen.queryByText('TOR!')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Heim: 1')).toBeInTheDocument();
  });

  it('erstes Laden mit Toren: keine Einblendung (Plan R5 Test 7)', async () => {
    await ladeUndAendere([slide('custom-text', { headline: 'Willkommen' })], spiel8({ scoreA: 3 }), spiel8({ scoreA: 3 }));
    expect(screen.queryByText('DJK Berg')).not.toBeInTheDocument();
  });
});

describe('MonitorDisplayPage — Karteneinblendung (@ZM-119, Fake-Timer)', () => {
  // Szenario-Daten: DJK Berg Nr. 4, Spiel 8, Sponsor-Folie „Bäckerei Maier“.
  const gelbeKarte: RuntimeMatchEvent = {
    id: 'ev-gelb-4', matchId: 'match-8', timestampSeconds: 120, type: 'YELLOW_CARD', payload: { teamId: 'team-berg', playerNumber: 4 }, scoreAfter: { home: 0, away: 0 },
  };

  async function renderMitKarte(): Promise<void> {
    await ladeUndAendere([slide('sponsor', { sponsorId: 'sp-1' })], spiel8(), spiel8({ events: [gelbeKarte] }));
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  // Kein Soll-Anspruch: die Verweildauer 3000 ms steht nicht im Szenario (Review B3).
  it('Bestand: Karte erscheint und verschwindet von selbst (bei 3000 ms), kommt mit weiteren Antworten nicht wieder', async () => {
    await renderMitKarte();
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByText('DJK Berg')).not.toBeInTheDocument();
    // Dieselbe Karte in den nächsten Antworten (Rückfall-Takt): keine zweite Einblendung (Gesehen-Menge).
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(screen.queryByText('DJK Berg')).not.toBeInTheDocument();
  });

  it('@ZM-178 Feld 1: Karte in Spiel 8 (Feld 2) wird auf dem Feld-1-Monitor nicht eingeblendet', async () => {
    await ladeUndAendere([slide('live', { fieldId: 'field-1' })], spiel8(), spiel8({ events: [gelbeKarte] }));
    expect(screen.queryByText('DJK Berg')).not.toBeInTheDocument();
  });
});
