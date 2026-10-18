/**
 * Aufgabe 1.1 (Spielanzeige): `MatchView.badge` und `MatchView.engine` über `buildTournamentView` auf der
 * Fixture „Hallencup Nord“ (@OB-065, @OB-066, @ZM-039, @ZM-104).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { buildTournamentView } from '../tournamentView';
import type { MatchBadgeEngineDetail } from '../badge';
import type { TournamentView } from '../types';
import { fAUS, fES, fPAUSE, GAME, type Hallencup } from '../__fixtures__/hallencupNord';

const idOf = (cup: Hallencup, index: number): string => cup.tournament.matches[index].id;
const build = (cup: Hallencup, engineDetail?: (id: string) => MatchBadgeEngineDetail | undefined): TournamentView =>
  buildTournamentView(
    { ...cup.tournament, ...(engineDetail === undefined ? {} : { engineDetail }) },
    { audience: 'screen', medium: 'app', locale: 'de' },
  );

let pause: Hallencup;
let aus: Hallencup;
beforeAll(async () => {
  pause = await fPAUSE();
  aus = await fAUS();
});

describe('@OB-065 @OB-066 MatchView.badge', () => {
  it('@OB-065 Spiel 8 läuft: „Live“, Spiel 7 (Uhr angehalten, Cache „paused“): „Pause“, Spiel 9 geplant: Anstoßzeit 14:40', () => {
    const v = build(pause);
    expect(v.byId.get(idOf(pause, GAME[8]))?.badge).toEqual({ kind: 'badge', state: 'live' });
    expect(v.byId.get(idOf(pause, GAME[7]))?.badge).toEqual({ kind: 'badge', state: 'pause' });
    expect(v.byId.get(idOf(pause, GAME[9]))?.badge).toEqual({ kind: 'kickoff', time: '14:40' });
  });

  it('@OB-065 Halbfinale 1 im Strafstoßschießen: engineDetail hat Vorrang, obwohl der Cache „paused“ sagt', () => {
    const id = idOf(pause, GAME[7]);
    const detail: MatchBadgeEngineDetail = { status: 'shootout', phase: 'shootout', section: 1, sections: 2 };
    const v = build(pause, (matchId) => (matchId === id ? detail : undefined));
    const m = v.byId.get(id);
    expect(m?.status).toBe('running');
    expect(m?.badge).toEqual({ kind: 'badge', state: 'shootout' });
    expect(m?.engine).toEqual(detail);
    // Gegenbeispiel: andere Spiele bleiben beim Cache
    expect(v.byId.get(idOf(pause, GAME[8]))?.badge).toEqual({ kind: 'badge', state: 'live' });
    expect(v.byId.get(idOf(pause, GAME[8]))?.engine).toBeUndefined();
  });

  it('@OB-066 Spiel 7 in der Halbzeit (live_state): „Halbzeit“ und weiter laufend (@ZM-039)', () => {
    const id = idOf(pause, GAME[7]);
    const v = build(pause, (matchId) => (matchId === id ? { status: 'section_break', phase: 'regular', section: 1, sections: 2, breakRemainingSec: 90 } : undefined));
    const m = v.byId.get(id);
    expect(m?.badge).toEqual({ kind: 'badge', state: 'halftime' });
    expect(m?.isLive).toBe(true);
  });

  it('@OB-066 Spiel 9 ausgefallen: „ausgefallen“, ohne Ergebnis (@ZM-104)', () => {
    const v = build(aus);
    expect(v.byId.get(idOf(aus, GAME[9]))?.badge).toEqual({ kind: 'badge', state: 'cancelled' });
  });

  it('@OB-066 beendetes Spiel: „Ende“; Gegenbeispiel: auch ohne Ergebnis-Sichtbarkeit bleibt das Abzeichen', async () => {
    const cup = await fES();
    const final = idOf(cup, GAME.FINAL);
    expect(build(cup).byId.get(final)?.badge).toEqual({ kind: 'badge', state: 'ended' });
    const kids = buildTournamentView({ ...cup.tournament, hideScoresForPublic: true }, { audience: 'screen', medium: 'app', locale: 'de' });
    expect(kids.byId.get(final)?.badge).toEqual({ kind: 'badge', state: 'ended' });
  });

  it('@OB-065 Vorlage (blank): kein Zustand, keine Feinstatus-Daten', () => {
    const id = idOf(pause, GAME[7]);
    const v = buildTournamentView(
      { ...pause.tournament, engineDetail: () => ({ status: 'shootout', phase: 'shootout', section: 1, sections: 1 }) },
      { audience: 'organizer', medium: 'print', locale: 'de', edition: 'blank' },
    );
    expect(v.byId.get(id)?.badge.kind).not.toBe('badge');
    expect(v.byId.get(id)?.engine).toBeUndefined();
  });
});
