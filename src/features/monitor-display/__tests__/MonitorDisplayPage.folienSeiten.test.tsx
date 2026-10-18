/**
 * B-16f3 – Spielplan mit Uhrzeit, Folie „Alle Tabellen / Finalrunde“, Seiten (@ZM-071, @ZM-089, @ZM-129, @ZM-130).
 * Harness wie der Takt-Test: struktureller Klon je Poll, Zeit in Schritten, echter Takt über die Seite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { Match, Tournament } from '../../../types/tournament';
import { looseVs } from '../../../test/matchSlotFixtures';
import {
  attachMonitor, buildTournament, FIXTURE_TEAMS, slide, withMonitor, withPlayoffs, withScheduledTimes,
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
    getMatchById: () => undefined, lastGoalEvent: null, clearLastGoalEvent: vi.fn(),
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));

import { MonitorDisplayPage } from '../MonitorDisplayPage';

vi.unmock('i18next'); vi.unmock('react-i18next'); // B-41: echte DE-Texte, siehe src/test/realDeI18n.ts
await (await import('../../../test/realDeI18n')).initRealDeI18n();

function monitorTurnier(tournament: Tournament, slides: ReturnType<typeof slide>[], overrides: Parameters<typeof withMonitor>[0] = {}): Tournament {
  return attachMonitor(tournament, withMonitor({ slides, ...overrides }));
}

/** Jeder Poll liefert einen strukturellen Klon, so wie SupabaseRepository.get neue Objekte baut. */
function liefere(data: Tournament): void {
  supabaseGet.mockImplementation(async () => structuredClone(data));
}

async function vorspulenInSchritten(ms: number, schritt = 1_000): Promise<void> {
  let rest = ms;
  while (rest > 0) {
    const s = Math.min(schritt, rest);
    await act(async () => { await vi.advanceTimersByTimeAsync(s); });
    rest -= s;
  }
}

async function starte(data: Tournament): Promise<void> {
  liefere(data);
  localGet.mockResolvedValue(null);
  render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

const zeilen = () => screen.queryAllByTestId('monitor-match-row');

/** Turnier mit Finalrunde: die Playoff-Spiele tragen `isFinal` (wie der Generator sie setzt). */
const mitFinalrunde = (): Match[] => withPlayoffs().map(m => (m.id.startsWith('po-') ? { ...m, isFinal: true } : m));

/** 13 Spiele auf Feld 1, je 5 Minuten versetzt ab 14:00 (Uhrzeiten sind einmalig). */
const dreizehnSpiele = (): Match[] => Array.from({ length: 13 }, (_, i) => ({
  id: `m${i + 1}`, matchNumber: i + 1, round: 1, field: 1, group: 'A',
  ...looseVs('team-nord', 'team-sued'), matchStatus: 'scheduled' as const,
  scheduledTime: new Date(2026, 9, 10, 14, i * 5),
}));

const uhrzeiten = () => zeilen().map(z => z.textContent?.match(/\d{2}:\d{2}/)?.[0]);

describe('@ZM-071 Spielplan Feld 2: Paarungen mit Uhrzeit in Anpfiff-Reihenfolge', () => {
  it('Feld 2: Spiel 1 (13:40) vor Spiel 8 (14:20), beide mit Uhrzeit und Paarung', async () => {
    await starte(monitorTurnier(buildTournament({ matches: withScheduledTimes() }), [slide('schedule-field', { fieldId: 'field-2' })]));
    expect(screen.getByText(/Spielplan Feld 2/)).toBeInTheDocument();
    expect(zeilen()).toHaveLength(2);
    expect(uhrzeiten()).toEqual(['13:40', '14:20']);
    expect(zeilen()[1]).toHaveTextContent('DJK Berg');
  });
});

describe('@ZM-071 Spielplan: Wort „Live“ nur am laufenden Spiel (Ruling B-16f3)', () => {
  // Befund C-ABZEICHEN-WORT
  it.fails('@OB-066 Feld 1: laufendes Spiel 7 trägt das Wort „Live“, geplantes Spiel 9 keins', async () => {
    await starte(monitorTurnier(buildTournament({ matches: withScheduledTimes() }), [slide('schedule-field', { fieldId: 'field-1' })]));
    expect(zeilen()).toHaveLength(2);
    expect(zeilen()[0]).toHaveTextContent('FC Nord');
    expect(zeilen()[0]).toHaveTextContent('Live');
    expect(zeilen()[1]).not.toHaveTextContent('Live');
  });
});

describe('@ZM-071 Alle Tabellen / Finalrunde: Seite 0 Gruppe A, Seite 1 Gruppe B, Seite 2 Finalrunde', () => {
  it('ein Abschnitt je Seite, Finalrunde mit Finale und Sieger der Halbfinale (Spur-B-Wortlaut)', async () => {
    await starte(monitorTurnier(buildTournament({ matches: mitFinalrunde() }), [slide('all-standings')]));
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    expect(screen.queryByText('DJK Berg')).toBeNull();

    await vorspulenInSchritten(15_000);
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
    expect(screen.queryByText('FC Nord')).toBeNull();

    await vorspulenInSchritten(15_000);
    expect(screen.getByText('Finalrunde')).toBeInTheDocument();
    expect(screen.getByText('Finale')).toBeInTheDocument();
    expect(screen.getByText('Sieger Halbfinale 1')).toBeInTheDocument();
    expect(screen.getByText('Sieger Halbfinale 2')).toBeInTheDocument();
    expect(screen.queryByText('DJK Berg')).toBeNull();
  });
});

describe('@ZM-130 Zeile 3: Seitenwechsel über die gerenderte Seite (echter Poll, Klon je Poll)', () => {
  it('Dauer 20 s: Seiten wechseln bei 20 s und 40 s, die nächste Folie bei 60 s', async () => {
    await starte(monitorTurnier(buildTournament({ matches: mitFinalrunde() }), [
      slide('all-standings', {}, 20),
      slide('custom-text', { headline: 'Danach' }, 20),
    ]));
    await vorspulenInSchritten(19_999);
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    expect(screen.queryByText('DJK Berg')).toBeNull();
    await vorspulenInSchritten(1);
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
    await vorspulenInSchritten(19_999);
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
    expect(screen.queryByText('Finale')).toBeNull();
    await vorspulenInSchritten(1);
    expect(screen.getByText('Finale')).toBeInTheDocument();
    await vorspulenInSchritten(19_999);
    expect(screen.getByText('Finale')).toBeInTheDocument();
    expect(screen.queryByText('Danach')).toBeNull();
    await vorspulenInSchritten(1);
    expect(screen.getByText('Danach')).toBeInTheDocument();
  });

  it('Dauer leer, Monitor-Standard 15 s: Seiten bei 15 s und 30 s, die nächste Folie bei 45 s', async () => {
    await starte(monitorTurnier(buildTournament({ matches: mitFinalrunde() }), [
      slide('all-standings'),
      slide('custom-text', { headline: 'Danach' }),
    ]));
    await vorspulenInSchritten(14_999);
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    await vorspulenInSchritten(1);
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
    await vorspulenInSchritten(15_000);
    expect(screen.getByText('Finale')).toBeInTheDocument();
    await vorspulenInSchritten(14_999);
    expect(screen.getByText('Finale')).toBeInTheDocument();
    await vorspulenInSchritten(1);
    expect(screen.getByText('Danach')).toBeInTheDocument();
  });

  it('einzige Folie mit drei Seiten blättert und beginnt nach Seite 2 wieder mit Seite 0', async () => {
    await starte(monitorTurnier(buildTournament({ matches: mitFinalrunde() }), [slide('all-standings', {}, 20)]));
    await vorspulenInSchritten(20_000);
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
    await vorspulenInSchritten(20_000);
    expect(screen.getByText('Finale')).toBeInTheDocument();
    await vorspulenInSchritten(20_000);
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
  });

  it('Gegenbeispiel: eine Folie mit einer Seite blättert nicht', async () => {
    await starte(monitorTurnier(buildTournament(), [slide('custom-text', { headline: 'Einzeln' }, 20)]));
    await vorspulenInSchritten(60_000);
    expect(screen.getByText('Einzeln')).toBeInTheDocument();
  });
});

describe('@ZM-129 Spielplan mit 13 Spielen: 3 Seiten, jede Zeile genau auf einer Seite', () => {
  it('Seiten 6, 6 und 1 Zeilen; die Vereinigung ist alle 13 Uhrzeiten, keine doppelt', async () => {
    await starte(monitorTurnier(buildTournament({ matches: dreizehnSpiele() }), [slide('schedule-field', { fieldId: 'field-1' })]));
    expect(screen.getByText(/^Seite \d+ \/ \d+$/)).toBeInTheDocument();
    const seite1 = uhrzeiten();
    await vorspulenInSchritten(15_000);
    const seite2 = uhrzeiten();
    await vorspulenInSchritten(15_000);
    const seite3 = uhrzeiten();
    expect(seite1).toHaveLength(6);
    expect(seite2).toHaveLength(6);
    expect(seite3).toEqual(['15:00']);
    const alle = [...seite1, ...seite2, ...seite3];
    expect(new Set(alle).size).toBe(13);
    expect(alle).toHaveLength(13);
  });
});

describe('@ZM-129 Nächste Spiele mit 8 offenen Spielen (matchCount 10): 2 Seiten, 6 und 2 Zeilen', () => {
  it('Seite 1 zeigt 14:00 bis 14:25, nach 15 s Seite 2 mit 14:30 und 14:35 über den echten Takt', async () => {
    await starte(monitorTurnier(buildTournament({ matches: dreizehnSpiele().slice(0, 8) }), [slide('next-matches', { matchCount: 10 })]));
    expect(screen.getByText(/^Seite \d+ \/ \d+$/)).toBeInTheDocument();
    expect(uhrzeiten()).toEqual(['14:00', '14:05', '14:10', '14:15', '14:20', '14:25']);
    await vorspulenInSchritten(15_000);
    expect(uhrzeiten()).toEqual(['14:30', '14:35']);
  });
});

describe('@ZM-089 Kindermodus: Alle Tabellen wird übersprungen, nie Finalrunde oder Tabellenplatz', () => {
  it('nur Alle Tabellen im Programm → Zuschauer-QR', async () => {
    await starte(monitorTurnier(buildTournament({ hideScoresForPublic: true, matches: mitFinalrunde() }), [slide('all-standings')]));
    expect(screen.getByTestId('qr-code').getAttribute('data-value')).toContain('/#/live/ABC123');
    expect(screen.queryByText('Finalrunde')).toBeNull();
    expect(screen.queryByText('Gruppe A', { exact: false })).toBeNull();
  });

  it('Alle Tabellen neben einer Folie: nie sichtbar, auch nach 60 s nicht', async () => {
    await starte(monitorTurnier(buildTournament({ hideScoresForPublic: true, matches: mitFinalrunde() }), [
      slide('all-standings'),
      slide('custom-text', { headline: 'Danach' }, 20),
    ]));
    expect(screen.getByText('Danach')).toBeInTheDocument();
    await vorspulenInSchritten(60_000);
    expect(screen.getByText('Danach')).toBeInTheDocument();
    expect(screen.queryByText('Finalrunde')).toBeNull();
    expect(screen.queryByText('DJK Berg')).toBeNull();
  });
});

describe('Alle Tabellen ohne Gruppen (Jeder gegen Jeden): eine Gesamttabelle (Controller-Ruling B-16f3 Fixrunde 1)', () => {
  const ohneGruppen = () => FIXTURE_TEAMS.map(team => ({ ...team, group: undefined }));

  it('ein Abschnitt „Gesamttabelle“ mit allen Teams, keine Seitenanzeige, nie „Noch keine Tabellen“', async () => {
    await starte(monitorTurnier(buildTournament({ teams: ohneGruppen(), matches: withScheduledTimes() }), [slide('all-standings')]));
    expect(screen.getByText(/Gesamttabelle/)).toBeInTheDocument();
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
    expect(screen.queryByText('Noch keine Tabellen')).toBeNull();
    expect(screen.queryByText(/^Seite \d+ \/ \d+$/)).toBeNull();
    await vorspulenInSchritten(30_000);
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
  });

  it('Kindermodus: auch ohne Gruppen übersprungen, Zuschauer-QR statt Gesamttabelle', async () => {
    await starte(monitorTurnier(buildTournament({ teams: ohneGruppen(), matches: withScheduledTimes(), hideScoresForPublic: true }), [slide('all-standings')]));
    expect(screen.getByTestId('qr-code').getAttribute('data-value')).toContain('/#/live/ABC123');
    expect(screen.queryByText(/Gesamttabelle/)).toBeNull();
  });

  it('Gegenbeispiel mit Gruppen: je Gruppe ein Abschnitt, keine Gesamttabelle', async () => {
    await starte(monitorTurnier(buildTournament({ matches: withScheduledTimes() }), [slide('all-standings')]));
    expect(screen.queryByText(/Gesamttabelle/)).toBeNull();
    expect(screen.queryByText('DJK Berg')).toBeNull();
    await vorspulenInSchritten(15_000);
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
  });
});
