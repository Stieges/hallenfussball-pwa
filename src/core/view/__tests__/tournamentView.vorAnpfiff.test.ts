/**
 * Leibchen 2b, Punkt 7 (Modell): Vor dem Anpfiff zeigen Monitor, Zuschauer-Seite und Cockpit die bestätigte Weste – dieselbe Rechnung (`matchBoxes`).
 * Szenarien: @ZM-195, @ZM-200, @ZM-201, @SL-196, @SL-201, @SL-226 (Anzeige), @ZM-203 (Fallback-Muster). Testwerte aus dem Gherkin, nicht aus dem Code.
 * Gherkin: docs/anforderungen/2026-10-02_zuschauer-und-monitor.md, 2026-10-02_spiel-leiten.md.
 */
import { describe, expect, it } from 'vitest';
import { buildTournamentView } from '../tournamentView';
import type { TournamentViewInput } from '../types';
import { pendingSlot, teamSlot } from '../../models/matchSlot';
import type { Match, Team } from '../../../types/tournament';
import { FALLBACK_PATTERN } from '../../models/scoreBoxColors';

const BLAU = '#1565C0';
const GELB = '#FFCC00';
const ORANGE = '#FF9800';
const ROT = '#C62828';
const WAGING = '00000000-0000-4000-8000-0000000000a1';
const PETTING = '00000000-0000-4000-8000-0000000000a2';

const team = (id: string, name: string, primary?: string): Team => (primary === undefined ? { id, name } : { id, name, colors: { primary } });
const spiel2 = (extra: Partial<Match> = {}): Match => ({ id: 'spiel-2', matchNumber: 2, round: 1, field: 1, slotA: teamSlot(WAGING), slotB: teamSlot(PETTING), matchStatus: 'scheduled', ...extra });
const input = (teams: Team[], matches: Match[]): TournamentViewInput => ({
  teams, matches, date: '2026-11-28', hideScoresForPublic: false, hideRankingsForPublic: false, isPublic: true, shareCode: 'NORD26',
});
const blauBlau = [team(WAGING, 'TSV Waging 1', BLAU), team(PETTING, 'TSV Petting', BLAU)];
const boxen = (teams: Team[], match: Match, audience: 'organizer' | 'viewer' | 'screen' = 'screen') =>
  buildTournamentView(input(teams, [match]), { audience, medium: 'app', locale: 'de' }).byId.get(match.id)?.boxes;

describe('@ZM-200 @ZM-195 Bei gleichen Trikotfarben: echte Farben, bis die Leibchen bestätigt sind', () => {
  it('@ZM-200 Zeile „noch nicht geklärt“: beide Kästen in Blau, keine Ausweichfarbe', () => {
    const b = boxen(blauBlau, spiel2());
    expect(b?.home).toEqual({ fill: { kind: 'solid', color: BLAU }, bib: false });
    expect(b?.away).toEqual({ fill: { kind: 'solid', color: BLAU }, bib: false });
  });

  it('@ZM-200 Zeile „Keine Leibchen getippt“: beide Kästen in Blau', () => {
    const b = boxen(blauBlau, spiel2({ kitDecision: 'none' }));
    expect(b?.home.fill).toEqual({ kind: 'solid', color: BLAU });
    expect(b?.away.fill).toEqual({ kind: 'solid', color: BLAU });
  });

  it('@ZM-195 Karte nur geöffnet, nicht bestätigt (kein Leibchen im Spiel): Kasten bleibt Trikotfarbe', () => {
    expect(boxen(blauBlau, spiel2())?.home.bib).toBe(false);
  });
});

describe('@ZM-200 @ZM-201 @SL-201 Bestätigt vor dem Anpfiff: die Weste steht, das Spiel ist noch nicht angepfiffen', () => {
  const bestaetigt = spiel2({ kitDecision: 'bib', kit: { a: GELB, bibSide: 'a' } });

  it('@ZM-200 „TSV Waging 1 zieht Gelb“ bestätigt: Waging als Weste (Gelb über Blau, Leibchen-Zeichen), Petting in Blau', () => {
    const b = boxen(blauBlau, bestaetigt);
    expect(b?.home).toEqual({ fill: { kind: 'vest', center: GELB, stripes: BLAU }, bib: true });
    expect(b?.away).toEqual({ fill: { kind: 'solid', color: BLAU }, bib: false });
  });

  it('@ZM-160 Monitor, Zuschauer-Seite und Verwaltung lesen dieselben Kästen', () => {
    const von = (audience: 'organizer' | 'viewer' | 'screen') => boxen(blauBlau, bestaetigt, audience);
    expect(von('organizer')).toEqual(von('screen'));
    expect(von('viewer')).toEqual(von('screen'));
  });

  it('@SL-209 für TSV Petting in Orange bestätigt: nur die Gast-Seite trägt, Heim bleibt Blau', () => {
    const b = boxen(blauBlau, spiel2({ kitDecision: 'bib', kit: { b: ORANGE, bibSide: 'b' } }));
    expect(b?.away).toEqual({ fill: { kind: 'vest', center: ORANGE, stripes: BLAU }, bib: true });
    expect(b?.home).toEqual({ fill: { kind: 'solid', color: BLAU }, bib: false });
  });

  it('@ZM-195 Zeile 4: bestätigt, aber für die Seite ist keine Trikotfarbe eingetragen: die Weste über dem grauen Streifenmuster', () => {
    const b = boxen([team(WAGING, 'TSV Waging 1'), team(PETTING, 'TSV Petting', BLAU)], bestaetigt);
    expect(b?.home).toEqual({ fill: { kind: 'vest', center: GELB, stripes: FALLBACK_PATTERN.dark, stripesUnknown: true }, bib: true });
  });

  it('@ZM-195 Gegenbeispiel: ändert Olli die Trikotfarbe nach dem Bestätigen, bleibt die Weste (@W3-028), die Streifen folgen der neuen Teamfarbe', () => {
    const b = boxen([team(WAGING, 'TSV Waging 1', ROT), team(PETTING, 'TSV Petting', BLAU)], bestaetigt);
    expect(b?.home).toEqual({ fill: { kind: 'vest', center: GELB, stripes: ROT }, bib: true });
  });

  it('@SL-212 Gegenbeispiel: auf der Heim-Seite steht (noch) kein Team (Platzhalter): keine Weste ohne Team', () => {
    const b = boxen([team(PETTING, 'TSV Petting', BLAU)], { ...bestaetigt, slotA: pendingSlot({ kind: 'groupRank', group: 'B', rank: 1 }) });
    expect(b?.home.bib).toBe(false);
  });

  it('@ZM-195 Gegenbeispiel: kit ohne Leibchen-Seite (nur Trikot festgehalten) ändert vor dem Anpfiff nichts', () => {
    const b = boxen(blauBlau, spiel2({ kit: { a: GELB } }));
    expect(b?.home).toEqual({ fill: { kind: 'solid', color: BLAU }, bib: false });
  });
});

describe('@SL-210 @ZM-200 nach dem Anpfiff ohne Tipp', () => {
  it('@ZM-200 Spiel 2 ist angepfiffen, vorher nichts getippt: beide Kästen in Blau, auch im laufenden Spiel', () => {
    const b = boxen(blauBlau, spiel2({ matchStatus: 'running', kit: { a: BLAU, b: BLAU } }));
    expect(b?.home).toEqual({ fill: { kind: 'solid', color: BLAU }, bib: false });
    expect(b?.away).toEqual({ fill: { kind: 'solid', color: BLAU }, bib: false });
  });

  it('@ZM-200 Spiel 2 läuft, die Turnierleitung trägt Orange für TSV Petting nach (@SL-150): Petting als Weste, Waging in Blau', () => {
    const b = boxen(blauBlau, spiel2({ matchStatus: 'running', kitDecision: 'bib', kit: { a: BLAU, b: ORANGE, bibSide: 'b' } }));
    expect(b?.away).toEqual({ fill: { kind: 'vest', center: ORANGE, stripes: BLAU }, bib: true });
    expect(b?.home.bib).toBe(false);
  });
});
