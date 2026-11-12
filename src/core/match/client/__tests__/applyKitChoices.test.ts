/**
 * Die lokale Wahl der Leibchen liegt über der Turnierkopie (Leibchen 2b, Punkt 3): Toms Cockpit zeigt sie sofort, auch ohne Netz (@SL-202 Zeile 3,
 * @SL-226 „Toms Cockpit sofort“); Monitor und Zuschauer lesen den Server und zeigen sie erst, wenn er sie kennt. Im laufenden Spiel (@SL-150)
 * trägt jede Seite eine festgehaltene Farbe, eine Seite, die ihr Leibchen verliert, bekommt ihre Teamfarbe zurück.
 * Testwerte aus dem Gherkin (docs/anforderungen/2026-10-02_spiel-leiten.md), nicht aus dem Code.
 */
import { describe, expect, it } from 'vitest';
import { applyKitChoices, kitRowStateOf } from '../applyKitChoices';
import type { KitChoiceEntry } from '../kitChoiceQueue';
import { teamSlot } from '../../../models/matchSlot';
import type { Match, Team } from '../../../../types/tournament';

const WAGING = '00000000-0000-4000-8000-0000000000a1';
const PETTING = '00000000-0000-4000-8000-0000000000a2';
const BLAU = '#1565C0';
const GELB = '#FFCC00';
const ORANGE = '#FF9800';
const teams: Team[] = [
  { id: WAGING, name: 'TSV Waging 1', colors: { primary: BLAU } },
  { id: PETTING, name: 'TSV Petting', colors: { primary: BLAU } },
];
const spiel = (extra: Partial<Match> = {}): Match => ({ id: 'spiel-2', round: 1, field: 1, slotA: teamSlot(WAGING), slotB: teamSlot(PETTING), matchStatus: 'scheduled', ...extra });
const eintrag = (extra: Partial<KitChoiceEntry> = {}): KitChoiceEntry => ({
  matchId: 'spiel-2', seq: 1, status: 'pending', decision: 'bib', bibSide: 'a', bibColor: GELB, ...extra,
});
const mit = (matches: Match[], entries: KitChoiceEntry[]) => applyKitChoices({ teams, matches }, entries).matches;

describe('@SL-202 @SL-226 vor dem Anpfiff zeigt Toms Cockpit die Wahl sofort', () => {
  it('@SL-226 „TSV Waging 1 zieht Gelb“ bestätigt (wartet noch): kit trägt nur die Leibchen-Seite, kitDecision bib – die Trikotfarben kommen aus den Teams', () => {
    const [m] = mit([spiel()], [eintrag()]);
    expect(m.kit).toEqual({ a: GELB, bibSide: 'a' });
    expect(m.kitDecision).toBe('bib');
  });

  it('@SL-209 „TSV Petting zieht Orange“ ersetzt die frühere Wahl für Waging: nie beide Seiten', () => {
    const [m] = mit([spiel({ kitDecision: 'bib', kit: { a: GELB, bibSide: 'a' } })], [eintrag({ bibSide: 'b', bibColor: ORANGE })]);
    expect(m.kit).toEqual({ b: ORANGE, bibSide: 'b' });
  });

  it('@SL-208 „Keine Leibchen“: kitDecision none und kein kit mit Seite', () => {
    const [m] = mit([spiel({ kitDecision: 'bib', kit: { a: GELB, bibSide: 'a' } })], [eintrag({ decision: 'none', bibSide: undefined, bibColor: undefined })]);
    expect(m.kitDecision).toBe('none');
    expect(m.kit).toBeUndefined();
  });

  it('@SL-229 Gegenbeispiel: ein Spiel ohne Eintrag und ein Eintrag ohne Spiel bleiben unberührt (dieselbe Referenz)', () => {
    const turnier = { teams, matches: [spiel()] };
    expect(applyKitChoices(turnier, [])).toBe(turnier);
    expect(applyKitChoices(turnier, [eintrag({ matchId: 'gibt-es-nicht' })])).toBe(turnier);
  });

  it('@SL-229 Gegenbeispiel: ein beendetes oder ausgefallenes Spiel nimmt die Wahl nicht an (der Server weist ab)', () => {
    const fertig = spiel({ matchStatus: 'finished', kitDecision: 'none' });
    expect(mit([fertig], [eintrag()])[0]).toBe(fertig);
    const aus = spiel({ matchStatus: 'skipped' });
    expect(mit([aus], [eintrag()])[0]).toBe(aus);
  });

  it('@SL-216 dieselbe Eingabe zweimal angewandt ergibt dasselbe Ergebnis (keine neue Referenz, kein Flackern)', () => {
    const einmal = applyKitChoices({ teams, matches: [spiel()] }, [eintrag()]);
    expect(applyKitChoices(einmal, [eintrag()])).toBe(einmal);
  });
});

describe('@SL-150 @SL-226 Nachtragen im laufenden Spiel (Turnierleitung)', () => {
  const laeuft = spiel({ matchStatus: 'running', kit: { a: BLAU, b: BLAU } });

  it('@SL-150 Orange für TSV Petting nachgetragen: Gast trägt Orange, Heim bleibt Blau', () => {
    const [m] = mit([laeuft], [eintrag({ bibSide: 'b', bibColor: ORANGE })]);
    expect(m.kit).toEqual({ a: BLAU, b: ORANGE, bibSide: 'b' });
    expect(m.kitDecision).toBe('bib');
  });

  it('@SL-150 Seite wechseln (Heim → Gast): die Heim-Seite bekommt ihre Teamfarbe zurück', () => {
    const heimTraegt = spiel({ matchStatus: 'running', kitDecision: 'bib', kit: { a: GELB, b: BLAU, bibSide: 'a' } });
    const [m] = mit([heimTraegt], [eintrag({ bibSide: 'b', bibColor: GELB })]);
    expect(m.kit).toEqual({ a: BLAU, b: GELB, bibSide: 'b' });
  });

  it('@SL-150 Entfernen: „Keine Leibchen“ im laufenden Spiel gibt der Seite die Teamfarbe zurück und nimmt die Seite', () => {
    const heimTraegt = spiel({ matchStatus: 'running', kitDecision: 'bib', kit: { a: GELB, b: BLAU, bibSide: 'a' } });
    const [m] = mit([heimTraegt], [eintrag({ decision: 'none', bibSide: undefined, bibColor: undefined })]);
    expect(m.kit).toEqual({ a: BLAU, b: BLAU });
    expect(m.kitDecision).toBe('none');
  });

  it('@SL-150 Gegenbeispiel: ein Nachtrag auf eine Seite, die schon so trägt, ändert die Farbe der anderen Seite nicht', () => {
    const [m] = mit([spiel({ matchStatus: 'running', kitDecision: 'bib', kit: { a: BLAU, b: GELB, bibSide: 'b' } })], [eintrag({ bibSide: 'b', bibColor: ORANGE })]);
    expect(m.kit).toEqual({ a: BLAU, b: ORANGE, bibSide: 'b' });
  });
});

describe('kitRowStateOf: was die Zeile (Server) zur Wahl sagt', () => {
  it('@SL-220 bestätigt: Zustand bib, Seite und Leibchenfarbe, die Teams der Seiten', () => {
    expect(kitRowStateOf(spiel({ kitDecision: 'bib', kit: { b: ORANGE, bibSide: 'b' } }))).toEqual({ decision: 'bib', bibSide: 'b', bibColor: ORANGE, teams: { a: WAGING, b: PETTING } });
  });

  it('@SL-220 offen: kein Zustand, keine Seite', () => {
    const zeile = kitRowStateOf(spiel());
    expect(zeile.decision).toBeUndefined();
    expect(zeile.bibSide).toBeUndefined();
  });

  it('@SL-212 Gegenbeispiel: eine offene Seite (Platzhalter) hat kein Team', () => {
    const zeile = kitRowStateOf({ ...spiel(), slotA: { kind: 'pending', source: { kind: 'groupRank', group: 'B', rank: 1 } } });
    expect(zeile.teams).toEqual({ a: undefined, b: PETTING });
  });
});
