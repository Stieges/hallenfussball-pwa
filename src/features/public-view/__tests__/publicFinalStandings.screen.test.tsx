/**
 * R3-6 Endstand auf der Zuschauer-Seite (@LZ-074, @LZ-075, @ET-044, @ET-045, @ET-022, @ZM-012, @ZM-102, E7 Kindermodus).
 * Erwartungen aus dem Gherkin (`2026-10-01_turnier-lebenszyklus.md`, `2026-10-02_zuschauer-und-monitor.md`). Gemockt nur die
 * Datenquellen (wie hideScoresStandings.test.tsx) und die Antwort von `public_final_standings`; die Seite ist echt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';
import { buildLiveViewTournament, SHARE_CODE, TEAM_IDS } from '../../../screens/__tests__/liveViewFixture';

const { supabaseGet, localGet, rpc } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn(), rpc: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: vi.fn(), rpc } }));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));
vi.mock('../defaultPublicSource', async () => {
  const { createLegacyPublicSource } = await import('../legacyPublicSource');
  return { defaultPublicTournamentSource: createLegacyPublicSource() };
});
await initRealDeI18n();

import { LiveViewScreen } from '../../../screens/LiveViewScreen';
import { RepositoryProvider } from '../../../core/contexts/RepositoryContext';

const ORDER = [TEAM_IDS.nord, TEAM_IDS.sued, TEAM_IDS.west, TEAM_IDS.ost, TEAM_IDS.mitte, TEAM_IDS.hafen, TEAM_IDS.berg, TEAM_IDS.tal];
const NAMES = ['FC Nord', 'SV Süd', 'TSV West', 'SC Ost', 'VfL Mitte', 'FC Hafen', 'SV Berg', 'TuS Tal'];
const FINISHED_AT = '2026-11-28T12:10:00+00:00';

interface Options { scorers?: boolean; points?: number }
/** Gespeicherter Endstand; bewusst NICHT, was die Tabelle aus den Spielen ergäbe (Punkte 99: @ET-045 „nie neu gerechnet“). */
function stored(options: Options = {}): unknown {
  const standings = {
    format: 1, appVersion: 'alt', computedAt: '2026-11-28T13:10:00+01:00',
    ranking: ORDER.map((teamId, i) => ({
      place: i + 1, teamId, teamName: NAMES[i], origin: { kind: 'groupPlace', group: i < 4 ? 'A' : 'B', place: (i % 4) + 1 },
      tableValues: { games: 3, goalsFor: 9 - i, goalsAgainst: 3, goalDiff: 6 - i, points: i === 0 ? (options.points ?? 99) : 9 - i },
    })),
    ...(options.scorers === false ? {} : { scorers: [
      { kind: 'player', rank: 1, teamId: TEAM_IDS.nord, teamName: 'FC Nord', number: 9, goals: 5 },
      { kind: 'player', rank: 2, teamId: TEAM_IDS.sued, teamName: 'SV Süd', number: 7, goals: 4 },
    ] }),
  };
  return { status: 'final', finishedAt: FINISHED_AT, standings };
}

async function renderWith(tournament: Tournament, reply: unknown) {
  supabaseGet.mockResolvedValue(tournament);
  localGet.mockResolvedValue(null);
  rpc.mockImplementation((name: string) => Promise.resolve(name === 'public_final_standings' ? { data: reply, error: null } : { data: null, error: { message: 'x' } }));
  const view = render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${SHARE_CODE}`]}><LiveViewScreen shareCode={SHARE_CODE} /></MemoryRouter>
    </RepositoryProvider>,
  );
  await screen.findAllByRole('heading', { level: 1, name: tournament.title });
  return view;
}

describe('R3-6 Zuschauer-Seite: Endstand', () => {
  beforeEach(() => { supabaseGet.mockReset(); localGet.mockReset(); rpc.mockReset(); localStorage.clear(); });

  it('@LZ-074 @ET-044: nach dem Abschluss alle Plätze 1 bis 8 in der Reihenfolge des gespeicherten Endstands, mit Sieger und Abzeichen', async () => {
    await renderWith(buildLiveViewTournament(), stored());
    const list = await screen.findByTestId('final-standings-list');
    const rows = within(list).getAllByTestId('final-standing-row');
    expect(rows.map((row) => row.getAttribute('data-place'))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(rows.map((row) => within(row).getByText(/^(FC|SV|TSV|SC|VfL|TuS)/).textContent)).toEqual(NAMES);
    expect(within(screen.getByTestId('final-standings-winner')).getByText('FC Nord')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-ended')).toHaveTextContent('Turnier abgeschlossen');
    expect(rpc).toHaveBeenCalledWith('public_final_standings', { p_share_code: SHARE_CODE });
  });

  it('@LZ-074 @ZM-011: Torschützen mit Rückennummer und Team, wenn die Antwort sie trägt', async () => {
    await renderWith(buildLiveViewTournament(), stored());
    const scorers = await screen.findByTestId('final-scorers');
    const rows = within(scorers).getAllByTestId('final-scorer-row');
    expect(rows[0]).toHaveTextContent('#9 FC Nord');
    expect(rows[0]).toHaveTextContent('5 Tore');
    expect(rows[1]).toHaveTextContent('#7 SV Süd');
  });

  it('@ET-045 @ET-022: Spiele, Tordifferenz und Punkte stehen so da, wie sie gespeichert sind – nie neu gerechnet', async () => {
    await renderWith(buildLiveViewTournament(), stored({ points: 99 }));
    await screen.findByTestId('final-standings-list');
    expect(screen.getByTestId('final-standings-header')).toHaveTextContent('Sp');
    const first = screen.getAllByTestId('final-standing-row')[0];
    expect(within(first).getByTestId('final-standing-points')).toHaveTextContent('99');
    expect(within(first).getByTestId('final-standing-games')).toHaveTextContent('3');
    expect(within(first).getByTestId('final-standing-diff')).toHaveTextContent('+6');
  });

  it('@ET-022 m-1: die Sieger-Karte nennt Punkte und Tordifferenz aus dem gespeicherten Stand (Punkte 99 = nie neu gerechnet)', async () => {
    await renderWith(buildLiveViewTournament(), stored({ points: 99 }));
    expect(await screen.findByTestId('final-standings-winner-values')).toHaveTextContent('99 Punkte, Tordifferenz +6');
  });

  it('@ZM-102 m-1 Gegenbeispiel: Tabellen für Zuschauer aus – keine Punkte in der Sieger-Karte', async () => {
    await renderWith(buildLiveViewTournament({ hideRankingsForPublic: true }), stored({ points: 99 }));
    await screen.findByTestId('final-standings-winner');
    expect(screen.queryByTestId('final-standings-winner-values')).toBeNull();
  });

  it('Gold nur für Platz 1: Sieger-Karte und erste Zeile tragen medalGold, Platz 2 nicht', async () => {
    await renderWith(buildLiveViewTournament(), stored());
    await screen.findByTestId('final-standings-list');
    const rows = screen.getAllByTestId('final-standing-row');
    expect(screen.getByTestId('final-standings-winner').getAttribute('style')).toContain('--color-medal-gold');
    expect(rows[0].getAttribute('style')).toContain('--color-medal-gold');
    expect(rows[0].getAttribute('style')).not.toMatch(/border-left/);
    expect(rows[1].getAttribute('style') ?? '').not.toContain('--color-medal-gold');
  });

  it('@LZ-075: vor dem Abschluss kein Endstand, auch kein vorläufiger – selbst wenn alle Spiele beendet sind', async () => {
    const t = buildLiveViewTournament();
    const alleBeendet: Tournament = { ...t, matches: t.matches.map((m) => ({ ...m, matchStatus: 'finished' as const, scoreA: m.scoreA ?? 1, scoreB: m.scoreB ?? 0 })) };
    await renderWith(alleBeendet, { status: 'none' });
    expect(rpc).toHaveBeenCalledWith('public_final_standings', { p_share_code: SHARE_CODE });
    expect(screen.queryByTestId('final-standings')).toBeNull();
    expect(screen.queryByTestId('final-standings-list')).toBeNull();
    expect(screen.queryByTestId('tournament-ended')).toBeNull();
    expect(screen.queryByText(/vorläufig/i)).toBeNull();
  });

  it('@ZM-012 Gegenbeispiel: Torschützen-Schalter aus – die Plätze stehen da, aber keine Torschützenliste', async () => {
    await renderWith(buildLiveViewTournament(), stored({ scorers: false }));
    await screen.findByTestId('final-standings-list');
    expect(screen.getAllByTestId('final-standing-row')).toHaveLength(8);
    expect(screen.queryByTestId('final-scorers')).toBeNull();
    expect(screen.queryByText('Torschützen')).toBeNull();
  });

  it('@ZM-102: Gruppentabellen für Zuschauer aus – der Endstand verrät weder Herkunft aus Gruppen noch Tabellenzahlen', async () => {
    await renderWith(buildLiveViewTournament({ hideRankingsForPublic: true }), stored());
    await screen.findByTestId('final-standings-list');
    expect(screen.getAllByTestId('final-standing-row')).toHaveLength(8);
    expect(screen.getByTestId('final-standings-list').textContent).not.toMatch(/Gruppe|Tabelle/);
    expect(screen.queryByTestId('final-standings-header')).toBeNull();
    expect(screen.queryByTestId('final-standing-points')).toBeNull();
  });

  it('E7 Kindermodus (@ZM-121 Z. 4): abgeschlossen + Kindermodus + Server „none“ – der Satz steht da, keine Plätze, keine Torschützen', async () => {
    const t = { ...buildLiveViewTournament({ hideScoresForPublic: true }), lifecycleStatus: 'finished' as const };
    await renderWith(t, { status: 'none' });
    expect(await screen.findByTestId('final-standings-kids')).toHaveTextContent('Turnier beendet – danke fürs Mitspielen');
    expect(screen.getByTestId('tournament-ended')).toBeInTheDocument();
    expect(screen.queryByTestId('final-standings')).toBeNull();
    expect(screen.queryByTestId('final-standing-row')).toBeNull();
    expect(screen.queryByTestId('final-scorers')).toBeNull();
  });

  it('E7 Kindermodus: auch eine (ältere) Server-Antwort „final“ zeigt im Kindermodus nie Plätze oder Torschützen', async () => {
    const t = { ...buildLiveViewTournament({ hideScoresForPublic: true }), lifecycleStatus: 'finished' as const };
    await renderWith(t, stored());
    expect(await screen.findByTestId('final-standings-kids')).toBeInTheDocument();
    expect(screen.queryByTestId('final-standing-row')).toBeNull();
    expect(screen.queryByTestId('final-scorers')).toBeNull();
  });

  it('E7 Gegenbeispiel: abgeschlossen ohne Kindermodus + Server „none“ – kein Kindersatz, kein Endstand', async () => {
    const t = { ...buildLiveViewTournament(), lifecycleStatus: 'finished' as const };
    await renderWith(t, { status: 'none' });
    await screen.findAllByText(/FC Nord/);
    expect(screen.queryByTestId('final-standings-kids')).toBeNull();
    expect(screen.queryByTestId('final-standings')).toBeNull();
  });

  it('E7 Gegenbeispiel: Kindermodus, Turnier noch nicht abgeschlossen – kein „Turnier beendet“', async () => {
    const t = { ...buildLiveViewTournament({ hideScoresForPublic: true }), lifecycleStatus: 'fixed' as const };
    await renderWith(t, { status: 'none' });
    await screen.findAllByText(/FC Nord/);
    expect(screen.queryByTestId('final-standings-kids')).toBeNull();
    expect(screen.queryByTestId('tournament-ended')).toBeNull();
  });

  it('Gegenbeispiel: ein Endstand, der nicht jedes Team trägt, wird nicht gezeigt (kein halber Endstand)', async () => {
    const halb = stored() as { standings: { ranking: unknown[] } };
    halb.standings.ranking = halb.standings.ranking.slice(0, 4);
    await renderWith(buildLiveViewTournament(), halb);
    await screen.findAllByText(/FC Nord/);
    expect(screen.queryByTestId('final-standings')).toBeNull();
  });
});
