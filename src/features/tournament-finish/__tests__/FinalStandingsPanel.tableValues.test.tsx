/**
 * R3-5b Spiele, Punkte und Tordifferenz in der Endstand-Anzeige der App. Erwartungen aus dem Gherkin
 * `2026-10-01_endstand-und-torschuetzen.md`: @ET-001 (Gruppen-Ausgeschiedene mit Punkten und Tordifferenz), @ET-022 (je Platz Spiele,
 * Punkte, Tordifferenz), @ET-045 (dieselben Zahlen nach neuer App-Version: gespeichert, nie neu gerechnet).
 * Gelesen wird die gespeicherte Zeile über `readStoredFinalStandings` (gemockt); alles Übrige läuft echt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
import { render, screen, within } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { TeamIdSchema } from '../../../core/models/schemas/MatchSlotSchema';
import { testUuid } from '../../../test/matchSlotFixtures';
import type { FinalStandingRow, FinalStandingsSnapshot, TableValues } from '../../../core/standings/finalStandings';
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

import { nikolausFertig } from '../../../core/services/__tests__/finishKit';
const { FinalStandingsPanel } = await import('../components/FinalStandingsPanel');

const FINISHED_AT = '2026-11-28T12:10:00.000Z';

/** Plätze 5 bis 8 aus @ET-001 (Punkte/Tordifferenz 4/+1, 3/−3, 0/−5, 0/−7), Plätze 1 bis 4 aus Platzierungsspielen ohne Werte. */
const tv = (points: number, goalDiff: number): TableValues => ({ games: 3, goalsFor: Math.max(goalDiff, 0) + 2, goalsAgainst: Math.max(-goalDiff, 0) + 2, goalDiff, points });
function hallencup(): FinalStandingsSnapshot {
  const ids = [910, 911, 912, 913, 914, 915, 916, 917].map((n) => TeamIdSchema.parse(testUuid(n)));
  const namen = ['FC Nord', 'SG Mitte', 'DJK Berg', 'SV Süd', 'TSV West', 'VfB Ufer', 'TuS Tal', 'SC Ost'];
  const origins: FinalStandingRow['origin'][] = [
    { kind: 'placementGame', finalType: 'final', role: 'winner' }, { kind: 'placementGame', finalType: 'final', role: 'loser' },
    { kind: 'placementGame', finalType: 'thirdPlace', role: 'winner' }, { kind: 'placementGame', finalType: 'thirdPlace', role: 'loser' },
    { kind: 'groupPlace', group: 'A', place: 3 }, { kind: 'groupPlace', group: 'B', place: 3 },
    { kind: 'groupPlace', group: 'B', place: 4 }, { kind: 'groupPlace', group: 'A', place: 4 },
  ];
  const values: Array<TableValues | undefined> = [undefined, undefined, undefined, undefined, tv(4, 1), tv(3, -3), tv(0, -5), tv(0, -7)];
  return {
    format: 1, appVersion: 'alt', computedAt: '2026-11-28T12:10:00.000+00:00', scorers: [],
    ranking: namen.map((teamName, i) => ({
      place: i + 1, teamId: ids[i], teamName, origin: origins[i], ...(values[i] !== undefined ? { tableValues: values[i] } : {}),
    })),
  };
}

const cells = (testId: string): string[] => screen.getAllByTestId('final-standing-row').map((row) => within(row).getByTestId(testId).textContent ?? '');

let fertig: Tournament;
const finished = (t: Tournament): Tournament => ({ ...t, lifecycleStatus: 'finished', finishedAt: FINISHED_AT });

beforeEach(async () => {
  fertig = await nikolausFertig();
  read.mockReset();
  recompute.calls = 0;
});

describe('R3-5b @ET-001 Gruppen-Ausgeschiedene zeigen Spiele, Punkte und Tordifferenz mit Vorzeichen', () => {
  it('Plätze 5 bis 8: Punkte 4, 3, 0, 0 und Tordifferenz +1, −3, −5, −7; Spaltenköpfe Sp, Diff, Pkt', async () => {
    read.mockResolvedValue({ status: 'ok', snapshot: hallencup(), finishedAt: FINISHED_AT });
    render(<FinalStandingsPanel tournament={finished(fertig)} />);
    await screen.findByTestId('final-standings-list');
    const header = within(screen.getByTestId('final-standings-header'));
    expect([header.getByText('Sp'), header.getByText('Diff'), header.getByText('Pkt')]).toHaveLength(3);
    expect(cells('final-standing-points').slice(4)).toEqual(['4', '3', '0', '0']);
    expect(cells('final-standing-diff').slice(4)).toEqual(['+1', '−3', '−5', '−7']);
    expect(cells('final-standing-games').slice(4)).toEqual(['3', '3', '3', '3']);
  });

  it('Gegenbeispiel: Zeilen aus Platzierungsspielen (Plätze 1 bis 4) haben leere Zellen, keine Null', async () => {
    read.mockResolvedValue({ status: 'ok', snapshot: hallencup(), finishedAt: FINISHED_AT });
    render(<FinalStandingsPanel tournament={finished(fertig)} />);
    await screen.findByTestId('final-standings-list');
    expect(cells('final-standing-points').slice(0, 4)).toEqual(['', '', '', '']);
    expect(cells('final-standing-diff').slice(0, 4)).toEqual(['', '', '', '']);
  });

  it('Tordifferenz 0 steht als „0“ ohne Vorzeichen', async () => {
    const snapshot = hallencup();
    snapshot.ranking[4] = { ...snapshot.ranking[4], tableValues: tv(2, 0) };
    read.mockResolvedValue({ status: 'ok', snapshot, finishedAt: FINISHED_AT });
    render(<FinalStandingsPanel tournament={finished(fertig)} />);
    await screen.findByTestId('final-standings-list');
    expect(cells('final-standing-diff')[4]).toBe('0');
  });
});

describe('R3-5b @ET-045 die gespeicherten Zahlen gelten, auch wenn das Turnierobjekt anders rechnen würde', () => {
  it('ein Spielergebnis im Turnierobjekt wird danach geändert: die Anzeige zeigt weiter die gespeicherten Zahlen, ohne Neurechnung', async () => {
    const geaendert: Tournament = {
      ...finished(fertig),
      matches: fertig.matches.map((match, i) => (i === 0 ? { ...match, scoreA: 9, scoreB: 0 } : match)),
    };
    read.mockResolvedValue({ status: 'ok', snapshot: hallencup(), finishedAt: FINISHED_AT });
    render(<FinalStandingsPanel tournament={geaendert} />);
    await screen.findByTestId('final-standings-list');
    expect(cells('final-standing-points').slice(4)).toEqual(['4', '3', '0', '0']);
    expect(cells('final-standing-diff').slice(4)).toEqual(['+1', '−3', '−5', '−7']);
    expect(recompute.calls).toBe(0);
  });
});

describe('R3-5b ohne gespeicherte Werte (älterer Stand) bleibt die Tabelle ohne Zahlenspalten, nie neu gerechnet', () => {
  it('kein Kopf, keine Zellen, keine Neurechnung', async () => {
    const ohne = hallencup();
    read.mockResolvedValue({ status: 'ok', snapshot: { ...ohne, ranking: ohne.ranking.map(({ tableValues: _tableValues, ...row }) => row) }, finishedAt: FINISHED_AT });
    render(<FinalStandingsPanel tournament={finished(fertig)} />);
    await screen.findByTestId('final-standings-list');
    expect(screen.queryByTestId('final-standings-header')).toBeNull();
    expect(screen.queryAllByTestId('final-standing-points')).toHaveLength(0);
    expect(recompute.calls).toBe(0);
  });
});
