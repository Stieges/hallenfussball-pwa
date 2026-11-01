/**
 * Schiedsrichter der offenen Spiele neu verteilen (rein): @W3-034 Zurücksetzen ändert nur Schiedsrichter offener Spiele,
 * @W3-035 Hand-Zuteilungen werden gezählt (Rückfrage), @ZP-104 „bereits optimal“ ergibt keinen Schritt.
 */
import { describe, it, expect } from 'vitest';
import type { Tournament } from '../../../../types/tournament';
import { applyDraftSteps } from '../draftSteps';
import { redistributeOpenReferees } from '../refereeRedistribution';
import { hallencup, matchOf } from './draftFixture';

/** Spiele 1 bis 3 beendet (mit Ergebnis), bei Spiel 4 von Hand ein anderer Schiedsrichter */
function mitHandarbeit(handSr: number): Tournament {
  const beendet = { matchStatus: 'finished' as const, scoreA: 2, scoreB: 1 };
  const base = hallencup({}, { 1: beendet, 2: beendet, 3: beendet });
  return {
    ...base,
    refereeConfig: { ...base.refereeConfig!, manualAssignments: { s4: handSr, s1: 3 } },
    matches: base.matches.map((m) => (m.id === 's4' ? { ...m, referee: handSr } : m)),
  };
}

/** Der Stand, den die Regeln für die offenen Spiele ergeben (Zurücksetzen angewendet) */
function zurueckgesetzt(t: Tournament): Tournament {
  const { step } = redistributeOpenReferees(t, 'resetReferees');
  return step ? applyDraftSteps(t, [step]).tournament : t;
}

describe('@W3-034 Zuteilung zurücksetzen ändert nur die Schiedsrichter offener Spiele', () => {
  it('@W3-034 die Hand-Zuteilung von Spiel 4 entfällt, Spiel 4 bekommt den Schiedsrichter nach den Regeln', () => {
    const nachHand2 = zurueckgesetzt(mitHandarbeit(2));
    const nachHand1 = zurueckgesetzt(mitHandarbeit(1));
    // nach den Regeln = unabhängig davon, was von Hand eingetragen war
    expect(matchOf(nachHand2, 's4').referee).toBe(matchOf(nachHand1, 's4').referee);
    expect(nachHand2.refereeConfig?.manualAssignments?.s4).toBeUndefined();
  });

  it('@W3-034 Ergebnisse, Uhrzeiten, Felder und Spielstände aller Spiele bleiben unverändert', () => {
    const vorher = mitHandarbeit(2);
    const nachher = zurueckgesetzt(vorher);
    for (const m of vorher.matches) {
      const n = matchOf(nachher, m.id);
      expect({ t: n.scheduledTime, f: n.field, a: n.scoreA, b: n.scoreB, s: n.matchStatus })
        .toEqual({ t: m.scheduledTime, f: m.field, a: m.scoreA, b: m.scoreB, s: m.matchStatus });
    }
  });

  it('@W3-034 die Schiedsrichter beendeter Spiele bleiben, wie sie waren (auch ihre Hand-Zuteilung)', () => {
    const vorher = mitHandarbeit(2);
    const nachher = zurueckgesetzt(vorher);
    for (const id of ['s1', 's2', 's3']) {
      expect(matchOf(nachher, id).referee).toBe(matchOf(vorher, id).referee);
    }
    expect(nachher.refereeConfig?.manualAssignments?.s1).toBe(3);
  });

  it('@W3-034 auch ein laufendes Spiel behält seinen Schiedsrichter', () => {
    const base = mitHandarbeit(2);
    const laufend = { ...base, matches: base.matches.map((m) => (m.id === 's4' ? { ...m, matchStatus: 'running' as const } : m)) };
    expect(matchOf(zurueckgesetzt(laufend), 's4').referee).toBe(2);
  });

  it('@ZP-104 nach dem Zurücksetzen ist die Verteilung „bereits optimal“: neu verteilen ergibt keinen Schritt', () => {
    expect(redistributeOpenReferees(zurueckgesetzt(mitHandarbeit(2))).step).toBeNull();
  });
});

describe('@W3-035 Neu verteilen zählt die Hand-Zuteilungen, die es überschreiben würde', () => {
  it('@W3-035 Spiel 4 von Hand mit anderem Schiedsrichter als nach den Regeln: 1 Spiel', () => {
    const regel = matchOf(zurueckgesetzt(mitHandarbeit(2)), 's4').referee ?? 1;
    const anders = regel === 1 ? 2 : 1;
    const { overwrittenManualIds, step } = redistributeOpenReferees(mitHandarbeit(anders));
    expect(overwrittenManualIds).toEqual(['s4']);
    expect(step?.manual).toEqual({ s4: null });
  });

  it('@W3-035 Gegenbeispiel: ohne Hand-Zuteilung offener Spiele gibt es nichts zu fragen', () => {
    const base = hallencup();
    base.matches = base.matches.map((m) => ({ ...m, referee: undefined }));
    const { overwrittenManualIds, step } = redistributeOpenReferees(base);
    expect(overwrittenManualIds).toEqual([]);
    expect(step?.patches.length).toBeGreaterThan(0);
  });

  it('@W3-035 Teams pfeifen: verteilt nach den Regeln des Spielplans (Heimteam des vorigen Spiels auf dem Feld)', () => {
    const base = hallencup({ refereeConfig: { mode: 'teams' } });
    const nachher = zurueckgesetzt({ ...base, refereeConfig: { mode: 'teams', manualAssignments: { s5: 6 } } });
    // Spiel 5 (Feld 1) folgt auf Spiel 3 (Feld 1): Heimteam von Spiel 3 ist Team 5
    expect(matchOf(nachher, 's5').referee).toBe(5);
  });
});
