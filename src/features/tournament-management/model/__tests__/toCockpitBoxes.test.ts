/**
 * @SL-176 Kästen im Cockpit wie am Hallenmonitor: dieselbe Farbe zur selben Zeit.
 * Szenarien: @SL-176 (drei Beispiele), @ZM-159 (acht Fälle als Literale), Parität mit `buildTournamentView` (Hallenmonitor).
 * Gherkin: docs/anforderungen/2026-10-02_spiel-leiten.md (@SL-176), 2026-10-02_zuschauer-und-monitor.md (@ZM-159).
 */
import { describe, expect, it } from 'vitest';
import { toCockpitBoxes } from '../toCockpitBoxes';
import { buildTournamentView } from '../../../../core/view';
import type { TournamentViewInput } from '../../../../core/view';
import { teamSlot } from '../../../../core/models/matchSlot';
import type { SpectatorDisplaySettings } from '../../../../core/models/spectatorDisplay';
import type { Match, Team } from '../../../../types/tournament';

const BLAU = '#1565C0';
const ROT = '#C62828';
const LILA = '#6A1B9A';
const GRUEN = '#2E7D32';
const GELB = '#FDD835';
const WEISS = '#FFFFFF';
const GRAUVIOLETT = '#736469';
const HEIM = '00000000-0000-4000-8000-000000000001';
const GAST = '00000000-0000-4000-8000-000000000006';

const team = (id: string, name: string, primary?: string): Team => (primary === undefined ? { id, name } : { id, name, colors: { primary } });
const spiel = (extra: Partial<Match> = {}): Match => ({ id: 'spiel-3', matchNumber: 3, round: 1, field: 1, slotA: teamSlot(HEIM), slotB: teamSlot(GAST), matchStatus: 'running', ...extra });
const STANDARD: SpectatorDisplaySettings = { teamColors: true, homeColor: BLAU, awayColor: ROT };
const turnier = (teams: Team[], matches: Match[], spectatorDisplay?: SpectatorDisplaySettings) => ({ teams, matches, ...(spectatorDisplay ? { spectatorDisplay } : {}) });

describe('@SL-176 Die Ergebniskästen im Cockpit zeigen dieselbe Farbe wie am Monitor', () => {
  const petting = team(HEIM, 'TSV Petting', LILA);
  const otting = team(GAST, 'DJK Otting', GRUEN);

  it('Petting trägt Lila, Otting Grün → Lila für Petting, Grün für Otting', () => {
    const k = toCockpitBoxes(turnier([petting, otting], [spiel({ kit: { a: LILA, b: GRUEN } })]), 'spiel-3');
    expect(k?.home).toEqual({ fill: { kind: 'solid', color: LILA }, bib: false });
    expect(k?.away).toEqual({ fill: { kind: 'solid', color: GRUEN }, bib: false });
  });

  it('Otting trägt gelbe Leibchen über grünen Trikots → Gelb für Otting (Weste mit grünen Streifen, Leibchen-Zeichen)', () => {
    const k = toCockpitBoxes(turnier([petting, otting], [spiel({ kit: { a: LILA, b: GELB, bibSide: 'b' } })]), 'spiel-3');
    expect(k?.home.fill).toEqual({ kind: 'solid', color: LILA });
    expect(k?.away).toEqual({ fill: { kind: 'vest', center: GELB, stripes: GRUEN }, bib: true });
  });

  it('„Teamfarben in den Ergebniskästen“ ausgeschaltet → die Standardfarben Heim und Gast', () => {
    const aus = { teamColors: false, homeColor: BLAU, awayColor: ROT };
    const k = toCockpitBoxes(turnier([petting, otting], [spiel({ kit: { a: LILA, b: GRUEN } })], aus), 'spiel-3');
    expect(k?.home.fill).toEqual({ kind: 'solid', color: BLAU });
    expect(k?.away.fill).toEqual({ kind: 'solid', color: ROT });
  });

  it('Gegenbeispiel: ohne dieses Spiel im Turnier keine Kästen (das Cockpit nimmt die Standardfarben)', () => {
    expect(toCockpitBoxes(turnier([petting, otting], []), 'spiel-3')).toBeUndefined();
    expect(toCockpitBoxes(turnier([petting, otting], [spiel()]), undefined)).toBeUndefined();
  });
});

type F = { kind: 'solid'; color: string } | { kind: 'vest'; center: string; stripes: string };
const solid = (color: string): F => ({ kind: 'solid', color });

describe('@ZM-159 welche Farbe ein Kasten bekommt (Tabelle als Literale), Cockpit = Hallenmonitor', () => {
  // Heim = SV Süd, Gast = FC Nord, Standardfarben Blau/Rot
  const faelle: Array<{ fall: string; heim?: string; gast?: string; kit: Match['kit']; teams?: { heim?: string; gast?: string }; erwarteHeim: F; erwarteGast: F }> = [
    { fall: 'A keine/keine', kit: {}, erwarteHeim: solid(BLAU), erwarteGast: solid(ROT) },
    { fall: 'B keine/Gelb', kit: { b: GELB }, erwarteHeim: solid(BLAU), erwarteGast: solid(GELB) },
    { fall: 'B keine/Blau (Heim weicht auf Rot aus)', kit: { b: BLAU }, erwarteHeim: solid(ROT), erwarteGast: solid(BLAU) },
    { fall: 'B keine/Grauviolett (Heim Weiß)', kit: { b: GRAUVIOLETT }, erwarteHeim: solid(WEISS), erwarteGast: solid(GRAUVIOLETT) },
    { fall: 'C Gelb/Blau', kit: { a: GELB, b: BLAU }, erwarteHeim: solid(GELB), erwarteGast: solid(BLAU) },
    { fall: 'D Gelb / rote Leibchen über gelben Trikots', kit: { a: GELB, b: ROT, bibSide: 'b' }, teams: { gast: GELB }, erwarteHeim: solid(GELB), erwarteGast: { kind: 'vest', center: ROT, stripes: GELB } },
    { fall: 'D2 Gelb/Gelb ohne Leibchen (Gast weicht auf Rot aus)', kit: { a: GELB, b: GELB }, erwarteHeim: solid(GELB), erwarteGast: solid(ROT) },
    { fall: 'D2 Rot/Rot ohne Leibchen (Gast weicht auf Blau aus)', kit: { a: ROT, b: ROT }, erwarteHeim: solid(ROT), erwarteGast: solid(BLAU) },
  ];
  it.each(faelle)('$fall', ({ kit, teams, erwarteHeim, erwarteGast }) => {
    const ts = [team(HEIM, 'SV Süd', teams?.heim), team(GAST, 'FC Nord', teams?.gast)];
    const turn = turnier(ts, [spiel({ kit })], STANDARD);
    const cockpit = toCockpitBoxes(turn, 'spiel-3');
    expect(cockpit?.home.fill).toEqual(erwarteHeim);
    expect(cockpit?.away.fill).toEqual(erwarteGast);
    // derselbe Fall über die Ansicht des Hallenmonitors (`LiveSlide` liest `MatchView.boxes`)
    const eingang: TournamentViewInput = {
      teams: ts, matches: turn.matches, date: '2026-11-28', hideScoresForPublic: false, hideRankingsForPublic: false, isPublic: true, shareCode: 'NORD26', spectatorDisplay: STANDARD,
    };
    const monitor = buildTournamentView(eingang, { audience: 'screen', medium: 'app', locale: 'de' }).byId.get('spiel-3')?.boxes;
    expect(cockpit).toEqual(monitor);
  });
});
