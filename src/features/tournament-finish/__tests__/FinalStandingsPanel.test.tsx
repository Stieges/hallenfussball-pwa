/**
 * R3-5 Endstand und Torschützen in der App. Erwartungen aus dem Gherkin `2026-10-01_endstand-und-torschuetzen.md`
 * (@ET-041, @ET-042, @ET-044, @ET-045), `2026-10-01_turniermodi.md` (@TM-058) und dem Mockup Runde 2 (Zuschauer-Block, Daniel 25.10.).
 * Gelesen wird die gespeicherte Zeile über `readStoredFinalStandings` (gemockt: Antwort der Datenbank); alles Übrige läuft echt.
 * Der Pflichttest @ET-045: der gespeicherte Endstand weicht von der Neurechnung ab – die App zeigt den gespeicherten.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { TeamId } from '../../../core/models/schemas/MatchSlotSchema';
import type { FinalStandingsSnapshot } from '../../../core/standings/finalStandings';
import type { StoredFinalStandingsResult } from '../../../core/repositories/storedFinalStandingsRead';

vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {} }));
const read = vi.hoisted(() => vi.fn<(client: unknown, id: string) => Promise<StoredFinalStandingsResult>>());
vi.mock('../../../core/repositories/storedFinalStandingsRead', () => ({ readStoredFinalStandings: read }));
const recompute = vi.hoisted(() => ({ calls: 0 }));
vi.mock('../../../core/standings/finalStandings', async (importActual) => {
  const actual = await importActual<typeof import('../../../core/standings/finalStandings')>();
  return { ...actual, computeFinalStandings: (...args: Parameters<typeof actual.computeFinalStandings>) => { recompute.calls += 1; return actual.computeFinalStandings(...args); } };
});
await initRealDeI18n();

import { NK } from '../../../core/standings/__tests__/groupCompletionKit';
import { N7C, nikolausFertig } from '../../../core/services/__tests__/finishKit';
const { FinalStandingsPanel } = await import('../components/FinalStandingsPanel');

const FINISHED_AT = '2026-11-28T12:10:00.000Z';
const ids = [NK.kammer, NK.wagingRot, NK.otting, NK.petting, NK.fridolfing, NK.wagingBlau];

/** Gespeicherter Endstand, bewusst ANDERS als die Neurechnung (Kammer ganz hinten): so einer entstünde mit einer anderen Rechnung. */
function storedOther(over: Partial<FinalStandingsSnapshot> = {}): FinalStandingsSnapshot {
  const names = ['TSV Waging blau', 'TSV 1921 Fridolfing', 'TSV Petting', 'DJK Otting', 'TSV Waging rot', 'DJK Kammer'];
  return {
    format: 1, appVersion: 'alt', computedAt: '2026-11-28T12:10:00.000+00:00',
    ranking: names.map((teamName, index) => ({ place: index + 1, teamId: ids[5 - index] as never, teamName, origin: { kind: 'groupPlace' as const, group: '', place: index + 1 } })),
    scorers: [
      { kind: 'player', rank: 1, teamId: NK.kammer as TeamId, teamName: 'DJK Kammer', number: 9, goals: 5 },
      { kind: 'player', rank: 2, teamId: NK.otting as TeamId, teamName: 'DJK Otting', number: 7, goals: 4 },
      { kind: 'player', rank: 3, teamId: NK.petting as TeamId, teamName: 'TSV Petting', number: 10, goals: 3 },
      { kind: 'player', rank: 3, teamId: NK.wagingRot as TeamId, teamName: 'TSV Waging rot', number: 4, goals: 3 },
      { kind: 'player', rank: 5, teamId: NK.fridolfing as TeamId, teamName: 'TSV 1921 Fridolfing', number: 2, goals: 1 },
      { kind: 'noNumber', rank: null, teamId: NK.kammer as TeamId, teamName: 'DJK Kammer', goals: 2 },
      { kind: 'ownGoals', rank: null, teamId: NK.otting as TeamId, teamName: 'DJK Otting', goals: 1 },
    ],
    ...over,
  };
}

const rowsOf = (): string[] => within(screen.getByTestId('final-standings-list')).getAllByTestId('final-standing-row').map((r) => r.textContent ?? '');

let fertig: Tournament;
const finished = (t: Tournament): Tournament => ({ ...t, lifecycleStatus: 'finished', finishedAt: FINISHED_AT });

beforeEach(async () => {
  fertig = await nikolausFertig();
  read.mockReset();
  recompute.calls = 0;
});

describe('@ET-045 nach dem Abschluss gilt der gespeicherte Endstand, nie eine Neurechnung', () => {
  it('der gespeicherte Endstand weicht von der Neurechnung ab: die App zeigt den gespeicherten und rechnet nicht', async () => {
    read.mockResolvedValue({ status: 'ok', snapshot: storedOther(), finishedAt: FINISHED_AT });
    render(<FinalStandingsPanel tournament={finished(fertig)} />);
    await screen.findByTestId('final-standings-list');
    const rows = rowsOf();
    expect(rows[0]).toContain('TSV Waging blau');
    expect(rows[5]).toContain('DJK Kammer');
    expect(recompute.calls).toBe(0);
    expect(screen.getByTestId('final-standings')).toHaveAttribute('data-state', 'stored');
    expect(screen.queryByTestId('final-standings-badge')).toBeNull();
  });

  it('Torschützen und Herkunft kommen aus derselben gespeicherten Zeile (nicht aus den Spielen)', async () => {
    read.mockResolvedValue({ status: 'ok', snapshot: storedOther(), finishedAt: FINISHED_AT });
    render(<FinalStandingsPanel tournament={finished(fertig)} />);
    await screen.findByTestId('final-standings-list');
    expect(rowsOf()[2]).toContain('Platz 3 der Tabelle');
    const scorers = within(screen.getByTestId('final-scorers')).getAllByTestId('final-scorer-row').map((r) => r.textContent);
    expect(scorers[0]).toContain('#9 DJK Kammer');
    expect(scorers[0]).toContain('5 Tore');
  });

  it('nach dem Wiederöffnen (Zeile bleibt am Server) ist der Stand vorläufig und wird nicht aus der Zeile gelesen (E1)', () => {
    read.mockResolvedValue({ status: 'ok', snapshot: storedOther(), finishedAt: FINISHED_AT });
    render(<FinalStandingsPanel tournament={{ ...fertig, lifecycleStatus: 'fixed', finishedAt: undefined }} />);
    expect(screen.getByTestId('final-standings')).toHaveAttribute('data-state', 'provisional');
    expect(screen.getByTestId('final-standings-badge')).toHaveTextContent('vorläufig');
    expect(read).not.toHaveBeenCalled();
    expect(rowsOf()[0]).toContain('DJK Kammer');
  });

  it('Gegenbeispiel: ist die gespeicherte Zeile nicht lesbar, steht ein Hinweis – kein errechneter Ersatz', async () => {
    read.mockResolvedValue({ status: 'failed' });
    render(<FinalStandingsPanel tournament={finished(fertig)} />);
    expect(await screen.findByTestId('final-standings-unavailable')).toHaveTextContent('konnte gerade nicht gelesen werden');
    expect(screen.queryByTestId('final-standings-list')).toBeNull();
    expect(recompute.calls).toBe(0);
  });

  it('solange gelesen wird, steht „wird geladen“, kein errechneter Zwischenstand', () => {
    read.mockReturnValue(new Promise(() => undefined));
    render(<FinalStandingsPanel tournament={finished(fertig)} />);
    expect(screen.getByTestId('final-standings-loading')).toBeTruthy();
    expect(recompute.calls).toBe(0);
  });
});

describe('@ET-041 Plätze, Herkunft je Platz, Torschützen, Sieger', () => {
  it('Herkunft je Platz: Sieger Finale, Verlierer Halbfinale, Dritter Gruppe A, noch offen', async () => {
    const snapshot = storedOther({
      ranking: [
        { place: 1, teamId: NK.kammer as TeamId, teamName: 'FC Nord', origin: { kind: 'placementGame', finalType: 'final', role: 'winner' } },
        { place: 2, teamId: NK.otting as TeamId, teamName: 'SG Mitte', origin: { kind: 'placementGame', finalType: 'final', role: 'loser' } },
        { place: 3, teamId: NK.petting as TeamId, teamName: 'DJK Berg', origin: { kind: 'koRound', round: 'semi' } },
        { place: 4, teamId: NK.wagingRot as TeamId, teamName: 'SV Süd', origin: { kind: 'koRound', round: 'semi' } },
        { place: 5, teamId: NK.fridolfing as TeamId, teamName: 'TSV West', origin: { kind: 'groupPlace', group: 'A', place: 3 } },
        { place: 6, teamId: NK.wagingBlau as TeamId, teamName: 'VfB Ufer', origin: { kind: 'open' } },
      ],
    });
    read.mockResolvedValue({ status: 'ok', snapshot, finishedAt: FINISHED_AT });
    render(<FinalStandingsPanel tournament={finished(fertig)} />);
    await screen.findByTestId('final-standings-list');
    const origins = within(screen.getByTestId('final-standings-list')).getAllByTestId('final-standing-origin').map((o) => o.textContent);
    expect(origins).toEqual(['Sieger Finale', 'Verlierer Finale', 'Verlierer Halbfinale', 'Verlierer Halbfinale', 'Dritter Gruppe A', 'noch offen']);
  });

  it('Sieger-Karte und „Platz 1 per Strafstoßschießen“ (E6) mit dem Ergebnis aus der Entscheidung', async () => {
    const t = finished(fertig);
    read.mockResolvedValue({ status: 'ok', snapshot: { ...storedOther(), ranking: storedOther().ranking.map((row, i) => ({ ...row, teamId: [NK.otting, NK.petting, NK.kammer, NK.wagingRot, NK.fridolfing, NK.wagingBlau][i] as never, teamName: ['DJK Otting', 'TSV Petting', 'DJK Kammer', 'TSV Waging rot', 'TSV 1921 Fridolfing', 'TSV Waging blau'][i] })) }, finishedAt: FINISHED_AT });
    render(<FinalStandingsPanel tournament={t} />);
    const winner = await screen.findByTestId('final-standings-winner');
    expect(winner).toHaveTextContent('Sieger');
    expect(winner).toHaveTextContent('DJK Otting');
    expect(winner).toHaveTextContent('Platz 1 per Strafstoßschießen entschieden: 4:3 gegen TSV Petting');
    expect(rowsOf()[0]).toContain('Platz 1 per Strafstoßschießen');
  });

  it('Gegenbeispiel (Review #397 M-1): die Entscheidung gilt nicht mehr (Grundlage verfallen) → Sieger-Karte ohne „Strafstoßschießen“', async () => {
    const t = finished(fertig);
    const verfallen = { ...t, standingDecisions: (t.standingDecisions ?? []).map((d) => ({ ...d, basis: 'verfallen' })) };
    read.mockResolvedValue({ status: 'ok', snapshot: { ...storedOther(), ranking: storedOther().ranking.map((row, i) => ({ ...row, teamId: [NK.otting, NK.petting, NK.kammer, NK.wagingRot, NK.fridolfing, NK.wagingBlau][i] as never, teamName: ['DJK Otting', 'TSV Petting', 'DJK Kammer', 'TSV Waging rot', 'TSV 1921 Fridolfing', 'TSV Waging blau'][i] })) }, finishedAt: FINISHED_AT });
    render(<FinalStandingsPanel tournament={verfallen} />);
    const winner = await screen.findByTestId('final-standings-winner');
    expect(winner).toHaveTextContent('DJK Otting');
    expect(winner).not.toHaveTextContent('Strafstoßschießen');
    expect(rowsOf()[0]).not.toContain('Strafstoßschießen');
    expect(rowsOf()[0]).toContain('Platz 1 der Tabelle');
  });

  it('Torschützen: Rang 1 bis 3 sichtbar, der Rest und die Sammelzeilen hinter „Alle Torschützen anzeigen“', async () => {
    read.mockResolvedValue({ status: 'ok', snapshot: storedOther(), finishedAt: FINISHED_AT });
    render(<FinalStandingsPanel tournament={finished(fertig)} />);
    await screen.findByTestId('final-scorers');
    expect(screen.getAllByTestId('final-scorer-row')).toHaveLength(4);
    fireEvent.click(screen.getByTestId('final-scorers-toggle'));
    const all = screen.getAllByTestId('final-scorer-row').map((r) => r.textContent ?? '');
    expect(all).toHaveLength(7);
    expect(all[5]).toContain('ohne Nummer – DJK Kammer');
    expect(all[6]).toContain('Eigentore für DJK Otting');
  });

  it('der Hinweis „Gespeichert am … Uhr“ steht nur beim gespeicherten Endstand', async () => {
    read.mockResolvedValue({ status: 'ok', snapshot: storedOther(), finishedAt: FINISHED_AT });
    render(<FinalStandingsPanel tournament={finished(fertig)} />);
    expect(await screen.findByTestId('final-standings-saved')).toHaveTextContent('Der Endstand steht fest. Gespeichert am');
  });
});

describe('@ET-042 / @TM-058 vor dem Abschluss: vorläufig', () => {
  it('@ET-042 alle Spiele entschieden, nicht abgeschlossen: der Stand, wie er gerade steht, gekennzeichnet „vorläufig“', () => {
    render(<FinalStandingsPanel tournament={fertig} />);
    expect(screen.getByTestId('final-standings-provisional')).toHaveTextContent('Vorläufig – der Endstand steht noch nicht fest');
    expect(screen.getByTestId('final-standings-badge')).toHaveTextContent('vorläufig');
    expect(rowsOf().map((r) => r.replace(/^\d/, ''))).toEqual(N7C.map((n) => expect.stringContaining(n)));
    expect(screen.queryByTestId('final-standings-winner')).toBeNull();
    expect(screen.queryByTestId('final-standings-saved')).toBeNull();
  });

  it('@TM-058 Jeder gegen jeden, 14 von 15 Spielen entschieden: der Endstand steht nicht fest, er ist vorläufig', () => {
    const letztes = fertig.matches[fertig.matches.length - 1];
    const t: Tournament = { ...fertig, matches: fertig.matches.map((m) => (m.id === letztes.id ? { ...m, matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined } : m)) };
    render(<FinalStandingsPanel tournament={t} />);
    expect(screen.getByTestId('final-standings')).toHaveAttribute('data-state', 'provisional');
    expect(screen.getByTestId('final-standings-provisional')).toBeTruthy();
    expect(screen.queryByTestId('final-standings-saved')).toBeNull();
  });

  it('noch kein Spiel entschieden: Hinweis „Noch keine Ergebnisse“ statt einer Liste aus lauter Nullen', () => {
    const t: Tournament = { ...fertig, matches: fertig.matches.map((m) => ({ ...m, matchStatus: 'scheduled' as const })) };
    render(<FinalStandingsPanel tournament={t} />);
    expect(screen.getByTestId('final-standings-empty')).toBeTruthy();
    expect(screen.queryByTestId('final-standings-list')).toBeNull();
  });

  it('die vorläufige Torschützenliste zählt die Tore aus den Spielen', async () => {
    const t: Tournament = { ...fertig, matches: fertig.matches.map((m, i) => (i === 0 ? { ...m, events: [
      { id: 'e1', type: 'GOAL', timestampSeconds: 10, payload: { teamId: NK.kammer, playerNumber: 9 } },
    ] as never } : m)) };
    render(<FinalStandingsPanel tournament={t} />);
    await waitFor(() => expect(screen.getAllByTestId('final-scorer-row').length).toBeGreaterThan(0));
    expect(screen.getAllByTestId('final-scorer-row')[0]).toHaveTextContent('#9');
  });
});
