/**
 * R3-7 Monitor nach dem Abschluss – über die gerenderte Seite (@LZ-076, @LZ-077 Z. 1, @ZM-121 Z. 1, 2 und 4, @ZM-012 Z. 2, @ZM-129, @ET-045,
 * @ZM-180). Übertragungsweg wie am Turniertag: Turnier über die Quelle (Zustand vom Server), Endstand über
 * `display_final_standings(tournament_id, monitor_id)` in der Form der ECHTEN Server-Antwort (Fixture `endstandFixture`, Torschützen nur
 * mit Schalter; nach dem Wiederöffnen über den Betreiber dieselbe Antwort wie vorher, Migration 20261118_008, Beweis
 * scripts/monitor-endstand-check.sh B2). Zeit in Schritten, echter Takt der Seite.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { MonitorSlide } from '../../../types/monitor';
import type { Tournament } from '../../../types/tournament';
import { attachMonitor, buildTournament, FIXTURE_SPONSOR, slide, withMatch, withMonitor } from './monitorFixture';
import { serverEndstand, SERVER_NONE } from './endstandFixture';

const { supabaseGet, localGet, endstand } = vi.hoisted(() => {
  const endstand: { antwort: unknown; aufrufe: string[]; monitore: string[] } = { antwort: undefined, aufrufe: [], monitore: [] };
  return { supabaseGet: vi.fn(), localGet: vi.fn(), endstand };
});

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({}) })),
    rpc: vi.fn((name: string, params: { p_tournament_id?: string; p_monitor_id?: string }) => {
      if (name === 'display_final_standings') {
        endstand.aufrufe.push(String(params.p_tournament_id));
        endstand.monitore.push(String(params.p_monitor_id));
        return endstand.antwort instanceof Error ? Promise.reject(endstand.antwort) : Promise.resolve({ data: endstand.antwort, error: null });
      }
      return Promise.resolve({ error: null });
    }),
  },
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet, getForDisplay: async (id: string) => { const t: unknown = await supabaseGet(id); return t ? { kind: 'full', version: 1, serverNowMs: 0, tournament: t } : { kind: 'not-found' }; } }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));
vi.mock('../../../core/realtime/displaySignal', () => ({ subscribeDisplaySignal: () => () => undefined }));
vi.mock('qrcode.react', async () => {
  const React = await import('react');
  return { QRCodeSVG: ({ value }: { value: string }) => React.createElement('svg', { 'data-testid': 'qr-code', 'data-value': value }) };
});

import { MonitorDisplayPage } from '../MonitorDisplayPage';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

const PROGRAMM: MonitorSlide[] = [
  slide('live', { fieldId: 'field-1' }), slide('all-standings'), slide('next-matches'), slide('schedule-field', { fieldId: 'field-1' }),
  slide('sponsor', { sponsorId: 'sp-1' }), slide('qr-code'),
];
// 50 Zeichen, ohne Wort aus der Kürzungsliste (@ZM-129)
const NAME_50 = 'Hinterzarten Niederbrunnen Obermusterdorf Kleinstadt';

/** Turnier „Hallencup Nord“ (Spiel 7 läuft); `abgeschlossen`: Zustand vom Server = finished, alle Spiele beendet. */
function turnier(opts: { abgeschlossen: boolean; kinder?: boolean; programm?: MonitorSlide[]; spielLaeuft?: boolean }): Tournament {
  const matches = opts.abgeschlossen ? withMatch('match-7', opts.spielLaeuft === true ? { matchStatus: 'running', scoreA: 1, scoreB: 1 } : { matchStatus: 'finished', scoreA: 2, scoreB: 1 }) : undefined;
  const basis = buildTournament({
    title: 'Nikolaus-Turnier 2026', sponsors: [FIXTURE_SPONSOR], hideScoresForPublic: opts.kinder === true,
    lifecycleStatus: opts.abgeschlossen ? 'finished' : 'fixed', ...(opts.abgeschlossen ? { finishedAt: '2026-11-28T12:10:00+00:00' } : {}),
    ...(matches === undefined ? {} : { matches }),
  });
  return attachMonitor(basis, withMonitor({ slides: opts.programm ?? PROGRAMM }));
}

function liefere(data: Tournament): void { supabaseGet.mockImplementation(async () => structuredClone(data)); }
async function vor(ms: number): Promise<void> {
  for (let rest = ms; rest > 0; rest -= 1_000) { await act(async () => { await vi.advanceTimersByTimeAsync(Math.min(1_000, rest)); }); }
}
async function starte(data: Tournament): Promise<void> {
  liefere(data);
  localGet.mockResolvedValue(null);
  render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}

/** Welche Folie steht gerade? (Kennung statt Text, damit Gegenbeispiele eindeutig sind) */
function folie(): string {
  if (screen.queryByTestId('monitor-final-standings') !== null) { return 'endstand'; }
  if (screen.queryByTestId('monitor-final-scorers') !== null) { return 'torschuetzen'; }
  if (screen.queryByTestId('monitor-final-kids') !== null) { return 'kinder'; }
  if (screen.queryByTestId('live-slide-area') !== null) { return 'live'; }
  if (screen.queryAllByTestId('standings-row').length > 0) { return 'tabelle'; }
  if (screen.queryAllByTestId('monitor-match-row').length > 0) { return 'spielliste'; }
  if (screen.queryByText('Bäckerei Maier') !== null) { return 'sponsor'; }
  if (screen.queryByTestId('qr-code') !== null) { return 'qr'; }
  return 'unbekannt';
}
/** Alle Folien eines Durchlaufs (jede Folie 15 s, bei mehreren Seiten je Seite). */
async function durchlauf(sekunden: number): Promise<string[]> {
  const gesehen: string[] = [folie()];
  for (let s = 0; s < sekunden; s += 5) { await vor(5_000); const f = folie(); if (gesehen.at(-1) !== f) { gesehen.push(f); } }
  return gesehen;
}

beforeEach(() => {
  vi.clearAllMocks();
  endstand.antwort = SERVER_NONE;
  endstand.aufrufe = [];
  endstand.monitore = [];
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});
afterEach(() => { vi.useRealTimers(); });

describe('@ZM-121 Z. 1, @LZ-076: Nach dem Abschluss zeigt der Monitor den Endstand statt Live-Spiel und Tabellen', () => {
  it('lädt der Monitor nach dem Abschluss neu, steht der Endstand FC Nord bis FC Berg da – Platz und Teamname, ohne Punkte und Tore', async () => {
    endstand.antwort = serverEndstand({ scorersPublic: false });
    await starte(turnier({ abgeschlossen: true }));
    expect(folie()).toBe('endstand');
    const zeilen = screen.getAllByTestId('monitor-final-row');
    expect(zeilen.map((z) => z.textContent)).toEqual(['1FC Nord', '2SV Süd', '3TSV West', '4SG Mitte', '5SC Ost', '6FC Berg']);
    expect(endstand.aufrufe[0]).toBe('tour-1');
  });

  it('C-MONITOR-ENDSTAND-OHNE-TEILEN behoben: der Monitor fragt über seinen Link (Turnier + eigene Kennung) – so gilt es auch ohne Online-Teilen (@ZM-101)', async () => {
    endstand.antwort = serverEndstand({ scorersPublic: false });
    await starte(turnier({ abgeschlossen: true }));
    expect(endstand.monitore[0]).toBe('mon-1');
    expect(folie()).toBe('endstand');
  });

  it('ein Durchlauf zeigt nie Live-Spiel, Tabelle, Nächste Spiele oder Spielplan – Sponsor „Bäckerei Maier“ und Zuschauer-QR laufen wie sonst', async () => {
    endstand.antwort = serverEndstand({ scorersPublic: false });
    // Spiel 7 steht im Stand noch auf „läuft“: eine Live-Folie im Programm fiele sofort auf (kein Rückfall durch „kein Spiel“)
    await starte(turnier({ abgeschlossen: true, spielLaeuft: true }));
    const gesehen = await durchlauf(60);
    expect(gesehen).toEqual(expect.arrayContaining(['endstand', 'sponsor', 'qr']));
    for (const weg of ['live', 'tabelle', 'spielliste']) { expect(gesehen).not.toContain(weg); }
  });

  it('Gegenbeispiel @LZ-075: ohne Abschluss meldet der Server keinen Endstand – das Programm läuft unverändert (Live-Folie zuerst), kein Abruf-Takt', async () => {
    endstand.antwort = SERVER_NONE;
    await starte(turnier({ abgeschlossen: false }));
    const gesehen = await durchlauf(60);
    expect(gesehen[0]).toBe('live');
    expect(gesehen).not.toContain('endstand');
    expect(endstand.aufrufe.length).toBeLessThanOrEqual(1);
    expect(screen.queryByTestId('monitor-final-standings')).toBeNull();
  });

  it('abgeschlossen, der Server meldet noch keinen Endstand: der Monitor erfindet keinen (kein Platz aus der Live-Tabelle)', async () => {
    await starte(turnier({ abgeschlossen: true }));
    expect(screen.queryByTestId('monitor-final-standings')).toBeNull();
    expect(screen.queryByTestId('monitor-final-row')).toBeNull();
  });

  it('@LZ-076 nach dem Neuladen: scheitert der erste Endstand-Abruf, erscheint im Durchlauf nie Live, Tabelle oder Spielliste – danach kommt der Endstand, sobald der Abruf klappt', async () => {
    endstand.antwort = new Error('offline');
    await starte(turnier({ abgeschlossen: true, spielLaeuft: true }));
    const gesehen = await durchlauf(40);
    for (const weg of ['live', 'tabelle', 'spielliste']) { expect(gesehen).not.toContain(weg); }
    expect(endstand.aufrufe.length).toBeGreaterThan(1);
    endstand.antwort = serverEndstand({ scorersPublic: false });
    await vor(10_000);
    expect(folie()).toBe('endstand');
  });
});

describe('@ZM-121 Z. 4: Kindermodus', () => {
  it('„Turnier beendet – danke fürs Mitspielen“ statt des Endstands, kein Platz, kein Teamname, kein Server-Aufruf nach dem Endstand', async () => {
    endstand.antwort = serverEndstand();
    await starte(turnier({ abgeschlossen: true, kinder: true }));
    expect(folie()).toBe('kinder');
    expect(screen.getByTestId('monitor-final-kids')).toHaveTextContent('Turnier beendet – danke fürs Mitspielen');
    expect(screen.queryByTestId('monitor-final-row')).toBeNull();
    expect(screen.queryByText('FC Nord')).toBeNull();
    expect(endstand.aufrufe).toEqual([]);
  });
});

describe('@LZ-077 Z. 1: Läuft → abschließt, ohne Neuladen nach höchstens 10 Sekunden', () => {
  it('der Monitor zeigt Spiel 7 live; nach dem Abschluss steht der Endstand ≤ 10 s später da, mitten in der Live-Folie', async () => {
    await starte(turnier({ abgeschlossen: false }));
    expect(folie()).toBe('live');
    endstand.antwort = serverEndstand({ scorersPublic: false });
    liefere(turnier({ abgeschlossen: true }));
    await vor(10_000);
    expect(folie()).toBe('endstand');
    expect(screen.queryByTestId('live-slide-area')).toBeNull();
  });
});

describe('@LZ-077 Z. 1: auch mitten im Durchlauf', () => {
  it('der Monitor steht gerade auf der Zuschauer-QR-Folie (nicht erste Folie), der Abschluss kommt: ≤ 10 s später steht der Endstand da, nicht erst im nächsten Durchlauf', async () => {
    await starte(turnier({ abgeschlossen: false, programm: [slide('sponsor', { sponsorId: 'sp-1' }), slide('qr-code'), slide('custom-text', { headline: 'Danke' })] }));
    await vor(16_000);
    expect(folie()).toBe('qr');
    endstand.antwort = serverEndstand({ scorersPublic: false });
    liefere(turnier({ abgeschlossen: true, programm: [slide('sponsor', { sponsorId: 'sp-1' }), slide('qr-code'), slide('custom-text', { headline: 'Danke' })] }));
    await vor(10_000);
    expect(folie()).toBe('endstand');
  });
});

describe('@ZM-012 Z. 2 und @ZM-011: Torschützen nur mit Schalter', () => {
  it('Schalter aus: der Durchlauf enthält keine Torschützen-Folie und die Antwort trägt keine Liste', async () => {
    endstand.antwort = serverEndstand({ scorersPublic: false });
    await starte(turnier({ abgeschlossen: true }));
    const gesehen = await durchlauf(60);
    expect(gesehen).not.toContain('torschuetzen');
    expect(gesehen).not.toContain('unbekannt'); // auch keine leere Folie
  });

  it('Schalter an: nach dem Endstand folgt die gespeicherte Torschützenliste, Rang 3 (drei Spieler) steht zusammen', async () => {
    endstand.antwort = serverEndstand();
    await starte(turnier({ abgeschlossen: true }));
    expect(folie()).toBe('endstand');
    await vor(15_000);
    expect(folie()).toBe('torschuetzen');
    const zeilen = screen.getAllByTestId('monitor-scorer-row');
    expect(zeilen[0]).toHaveTextContent('#9 FC Nord');
    expect(zeilen[0]).toHaveTextContent('5 Tore');
    expect(zeilen.filter((z) => z.getAttribute('data-rank') === '3')).toHaveLength(3);
  });
});

describe('@ZM-129: lange Namen blättern, nie gekürzt', () => {
  it('8 Teams mit 50-Zeichen-Namen: 4 Seiten mit je 2 Teams, jeder Name voll, jede Zeile genau einmal', async () => {
    const namen = Array.from({ length: 8 }, (_, i) => `${NAME_50.slice(0, 48)} ${String(i + 1)}`);
    endstand.antwort = serverEndstand({ names: namen, scorersPublic: false });
    await starte(turnier({ abgeschlossen: true, programm: [slide('qr-code')] }));
    const gesehen: string[] = [];
    for (let seite = 0; seite < 4; seite++) {
      expect(folie(), `Seite ${String(seite + 1)}`).toBe('endstand');
      expect(screen.getByTestId('monitor-final-standings')).toHaveAttribute('data-pages', '4');
      expect(screen.getAllByTestId('monitor-final-row')).toHaveLength(2);
      screen.getAllByTestId('monitor-final-team').forEach((n) => { gesehen.push(n.textContent ?? ''); });
      await vor(15_000);
    }
    expect(namen.every((n) => [...n].length === 50)).toBe(true);
    expect(gesehen).toEqual(namen);
    expect(gesehen.some((n) => n.includes('…'))).toBe(false);
  });
});

describe('@ET-045: gespeicherter Endstand, nie neu gerechnet', () => {
  it('der Server speichert SC Ost auf Platz 1 (die Live-Tabelle sähe FC Nord vorn): der Monitor zeigt den gespeicherten Stand', async () => {
    endstand.antwort = serverEndstand({ names: ['SC Ost', 'FC Nord', 'SV Süd'], scorersPublic: false });
    await starte(turnier({ abgeschlossen: true }));
    expect(screen.getAllByTestId('monitor-final-row').map((z) => z.textContent)).toEqual(['1SC Ost', '2FC Nord', '3SV Süd']);
  });

  it('geteilte Plätze erscheinen mit derselben Platzziffer (1, 2, 2, 4)', async () => {
    endstand.antwort = serverEndstand({ names: ['A', 'B', 'C', 'D'], places: [1, 2, 2, 4], scorersPublic: false });
    await starte(turnier({ abgeschlossen: true }));
    expect(screen.getAllByTestId('monitor-final-place').map((p) => p.textContent)).toEqual(['1', '2', '2', '4']);
  });
});

describe('@ZM-121 Z. 2: Wiederöffnen über den Betreiber (Notweg @LZ-091)', () => {
  // Soll (Muss): der Endstand von vor dem Wiederöffnen bleibt unverändert, bis neu abgeschlossen wird. Der Server (20261118_008) liefert
  // nach dem Wiederöffnen dieselbe Antwort wie vorher (Beweis scripts/monitor-endstand-check.sh B2); das Turnier meldet „läuft“.
  it('nach dem Wiederöffnen zeigt der Monitor den Endstand von vorher unverändert – nie Live, Tabelle oder Spielliste', async () => {
    endstand.antwort = serverEndstand({ scorersPublic: false });
    await starte(turnier({ abgeschlossen: true, spielLaeuft: true }));
    expect(folie()).toBe('endstand');
    const vorher = screen.getAllByTestId('monitor-final-row').map((z) => z.textContent);
    const wiederOffen = turnier({ abgeschlossen: false });
    wiederOffen.matches = withMatch('match-7', { matchStatus: 'running', scoreA: 1, scoreB: 1 });
    liefere(wiederOffen);
    const gesehen = await durchlauf(40);
    for (const weg of ['live', 'tabelle', 'spielliste']) { expect(gesehen).not.toContain(weg); }
    expect(gesehen).toContain('endstand');
    for (let i = 0; i < 12 && folie() !== 'endstand'; i++) { await vor(5_000); }
    expect(folie()).toBe('endstand');
    expect(screen.getAllByTestId('monitor-final-row').map((z) => z.textContent)).toEqual(vorher);
  });

  it('lädt der Monitor im wieder geöffneten Turnier neu, steht der Endstand von vorher da', async () => {
    endstand.antwort = serverEndstand({ scorersPublic: false });
    await starte(turnier({ abgeschlossen: false }));
    expect(folie()).toBe('endstand');
    expect(screen.getAllByTestId('monitor-final-row')).toHaveLength(6);
  });

  it('@LZ-091 letzte Zeile: schließt Olli neu ab, zeigt der Monitor ≤ 10 s später den neuen Endstand', async () => {
    endstand.antwort = serverEndstand({ scorersPublic: false });
    await starte(turnier({ abgeschlossen: false }));
    expect(screen.getAllByTestId('monitor-final-row')[0]).toHaveTextContent('FC Nord');
    endstand.antwort = serverEndstand({ names: ['SV Süd', 'FC Nord', 'TSV West', 'SG Mitte', 'SC Ost', 'FC Berg'], scorersPublic: false });
    liefere(turnier({ abgeschlossen: true }));
    await vor(10_000);
    expect(folie()).toBe('endstand');
    expect(screen.getAllByTestId('monitor-final-row')[0]).toHaveTextContent('SV Süd');
  });
});

describe('@ZM-180: beendet bleibt beendet', () => {
  it('ein älterer Stand des Turniers (Spiel 7 wieder „läuft“ 1:1) bringt die Live-Folie nicht zurück, solange der Server abgeschlossen meldet', async () => {
    endstand.antwort = serverEndstand({ scorersPublic: false });
    await starte(turnier({ abgeschlossen: true }));
    expect(folie()).toBe('endstand');
    const aelter = turnier({ abgeschlossen: true });
    aelter.matches = withMatch('match-7', { matchStatus: 'running', scoreA: 1, scoreB: 1 });
    liefere(aelter);
    const gesehen = await durchlauf(40);
    expect(gesehen).not.toContain('live');
    expect(gesehen).toContain('endstand');
  });

  it('der Endstand-Abruf scheitert (Netz): der Endstand bleibt stehen, nie ein leerer Bildschirm', async () => {
    endstand.antwort = serverEndstand({ scorersPublic: false });
    await starte(turnier({ abgeschlossen: true, programm: [slide('qr-code')] }));
    endstand.antwort = new Error('offline');
    await vor(31_000);
    expect(screen.getAllByTestId('monitor-final-row')).toHaveLength(6);
  });

  it('Gegenbeispiel: meldet der Server nach dem Wiederöffnen keinen Endstand mehr (z. B. Kindermodus eingeschaltet), läuft das normale Programm wieder', async () => {
    endstand.antwort = serverEndstand({ scorersPublic: false });
    await starte(turnier({ abgeschlossen: true }));
    expect(folie()).toBe('endstand');
    endstand.antwort = SERVER_NONE;
    liefere(turnier({ abgeschlossen: false }));
    await vor(10_000);
    expect(screen.queryByTestId('monitor-final-standings')).toBeNull();
  });
});
