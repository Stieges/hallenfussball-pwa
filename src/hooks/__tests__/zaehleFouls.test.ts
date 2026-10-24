/**
 * Foul-Zählung je Abschnitt (Plan Cockpit v2 A5, Befund C-COCKPIT-FOULS-NICHT-JE-HALBZEIT).
 * Szenarien: @SL-100 (Tabelle, vier Zeilen), @SL-099 (4 + 2, dann 3/5, Gesamt 7), @SL-036 (zweiter Abschnitt beginnt bei 0),
 * @SL-035 (Gegenbeispiel unter der Grenze), @SL-102 (ohne Grenze nur die Zahl). Gherkin: docs/anforderungen/2026-10-02_spiel-leiten.md.
 */
import { describe, expect, it } from 'vitest';
import { zaehleFouls, type FoulCountEvent } from '../useFoulCounts';

const SUED = 'sv-sued';
const NORD = 'fc-nord';
const spiel = (events: FoulCountEvent[]) => ({ events, homeTeam: { id: NORD }, awayTeam: { id: SUED } });
const foul = (teamId: string, section?: number, type = 'FOUL'): FoulCountEvent => ({ type, payload: { teamId }, ...(section === undefined ? {} : { section }) });
const viele = (n: number, section: number, teamId = SUED): FoulCountEvent[] => Array.from({ length: n }, () => foul(teamId, section));

describe('@SL-100 Wofür die Fouls für die Grenze zählen, hängt von den Abschnitten ab', () => {
  // Zahl nach dem „Foul bei <Zeitpunkt>“ = vorherige Fouls im wirksamen Abschnitt + das neue
  it.each([
    { spielzeit: '1 × 10 Minuten', vorher: viele(4, 1), neu: foul(SUED, 1), abschnitt: { aktuell: 1, gesamt: 1 }, zahl: 5 },
    { spielzeit: '4 × 5 Minuten, 3 Fouls im ersten Abschnitt, im zweiten', vorher: viele(3, 1), neu: foul(SUED, 2), abschnitt: { aktuell: 2, gesamt: 4 }, zahl: 1 },
    { spielzeit: '2 × 6 Minuten, Halbfinale mit Verlängerung, 3 Fouls in der zweiten Halbzeit, in der Verlängerung', vorher: viele(3, 2), neu: foul(SUED, 3), abschnitt: { aktuell: 3, gesamt: 2 }, zahl: 4 },
    { spielzeit: '3 × 6 Minuten, 3 Fouls im zweiten Abschnitt, im dritten', vorher: viele(3, 2), neu: foul(SUED, 3), abschnitt: { aktuell: 3, gesamt: 3 }, zahl: 1 },
  ])('$spielzeit → $zahl', ({ vorher, neu, abschnitt, zahl }) => {
    expect(zaehleFouls(spiel([...vorher, neu]), abschnitt).away).toBe(zahl);
  });
});

describe('@SL-099 / @SL-036 Zähler je Halbzeit, Gesamtzahl getrennt', () => {
  const vier = viele(4, 1);
  it('@SL-099 4 Fouls im ersten, 2 im zweiten Abschnitt, ein weiteres Foul → 3 gegen die Grenze, 7 im ganzen Spiel', () => {
    const spielMit = spiel([...vier, ...viele(3, 2)]);
    expect(zaehleFouls(spielMit, { aktuell: 2, gesamt: 2 }).away).toBe(3);
    expect(zaehleFouls(spielMit).away).toBe(7);
  });
  it('@SL-036 Gegenbeispiel: zu Beginn des zweiten Abschnitts steht der Zähler bei 0, die 4 Fouls zählen im Spiel weiter', () => {
    const spielMit = spiel(vier);
    expect(zaehleFouls(spielMit, { aktuell: 2, gesamt: 2 }).away).toBe(0);
    expect(zaehleFouls(spielMit).away).toBe(4);
  });
  it('@SL-035 Gegenbeispiel: im ersten Abschnitt zählt jedes Foul sofort mit; die Gegenseite zählt für sich', () => {
    const spielMit = spiel([...viele(3, 1), foul(SUED, 1), foul(NORD, 1)]);
    expect(zaehleFouls(spielMit, { aktuell: 1, gesamt: 2 })).toEqual({ home: 1, away: 4 });
  });
  it('Karten und Zeitstrafe zählen als Foul (Fundament), Gelb-Rot ebenfalls', () => {
    const spielMit = spiel([foul(SUED, 1, 'YELLOW_CARD'), foul(SUED, 1, 'TIME_PENALTY'), { type: 'RED_CARD', payload: { teamId: SUED, cardType: 'YELLOW_RED' }, section: 1 }]);
    expect(zaehleFouls(spielMit, { aktuell: 1, gesamt: 2 }).away).toBe(3);
  });
  it('Gegenbeispiel Tor und Wechsel zählen nicht', () => {
    expect(zaehleFouls(spiel([foul(SUED, 1, 'GOAL'), foul(SUED, 1, 'SUBSTITUTION')]), { aktuell: 1, gesamt: 1 }).away).toBe(0);
  });
  it('ohne Abschnittsangabe am Eintrag (kein Engine-Spiel) zählt der Eintrag mit – nie weniger als vorher', () => {
    expect(zaehleFouls(spiel(viele(2, 0).map((e) => ({ ...e, section: undefined }))), { aktuell: 2, gesamt: 2 }).away).toBe(2);
  });
  it('ohne Abschnitt (keine Ansicht) das ganze Spiel; ohne Spiel 0:0', () => {
    expect(zaehleFouls(spiel([...vier, ...viele(2, 2)]), null).away).toBe(6);
    expect(zaehleFouls(null)).toEqual({ home: 0, away: 0 });
  });
});
