/**
 * A-12a – Vorlagen der Finalrunde als Herkunfts-Plan (`buildFinalsTemplate`), Record Turniermodi (2026-10-01):
 * @TM-002 (Zeile 2×4), @TM-004 (Platzierungsspiele je Platz), @TM-005 (Platz 3 vorbelegt), @TM-142 (Top 4).
 * Befund C-GENERATOR-GRUPPENZAHL-DEFAULT (fehlende Gruppenzahl → sichtbarer Fehler) und „ab 3 Gruppen keine Vorlage“
 * (Plan GA4 v2 § 5 A-12a, Daniel E6 15.10.).
 *
 * Der Plan ist rein (keine Zeiten, keine Spiel-IDs): Seiten als Platzhalter-Verweis („group-a-1st“, „semi1-loser“),
 * Phase und Art des Finalspiels je Spiel. Den echten Weg bis zur Cloud-Zeile prüft `finalsTemplates.publish.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { buildFinalsTemplate, FinalsTemplateError } from '../finalsTemplates';
import type { PlayoffMatchDefinition } from '../playoffScheduler';
import type { FinalsConfig } from '../../../types/tournament';

const keyOf = (defs: readonly PlayoffMatchDefinition[]): string[] => defs.map((d) => d.label);
const byLabel = (defs: readonly PlayoffMatchDefinition[], label: string): PlayoffMatchDefinition => {
  const def = defs.find((d) => d.label === label);
  if (def === undefined) { throw new Error(`Spiel „${label}“ fehlt im Plan`); }
  return def;
};
const sides = (def: PlayoffMatchDefinition): [string, string] => [def.teamASource, def.teamBSource];

/** „Hallencup Nord“: 2 Gruppen à 4 Teams. */
const cup = (config: FinalsConfig): PlayoffMatchDefinition[] => buildFinalsTemplate(2, [4, 4], config);

describe('@TM-004 Platzierungsspiele sind frei wählbar je Platz („Hallencup Nord“ mit Halbfinale und Finale)', () => {
  it.each([
    { auswahl: 'keine', placements: [], spiele: [] },
    { auswahl: 'Platz 3', placements: [3], spiele: ['Spiel um Platz 3'] },
    { auswahl: 'Platz 3 und 7', placements: [3, 7], spiele: ['Spiel um Platz 7', 'Spiel um Platz 3'] },
    { auswahl: 'alle', placements: [3, 5, 7], spiele: ['Spiel um Platz 7', 'Spiel um Platz 5', 'Spiel um Platz 3'] },
  ])('@TM-004 Auswahl $auswahl → außer HF und Finale genau: $spiele', ({ placements, spiele }) => {
    const plan = cup({ preset: 'top-4', placements });

    expect(keyOf(plan)).toEqual(['1. Halbfinale', '2. Halbfinale', ...spiele, 'Finale']);
    for (const def of plan) {
      expect(def.teamASource).not.toBe('');
      expect(def.teamBSource).not.toBe('');
    }
  });

  it('@TM-004 Platz 5 = Dritter A gegen Dritter B, Platz 7 = Vierter A gegen Vierter B (Art des Finalspiels je Platz)', () => {
    const plan = cup({ preset: 'top-4', placements: [3, 5, 7] });

    expect(sides(byLabel(plan, 'Spiel um Platz 5'))).toEqual(['group-a-3rd', 'group-b-3rd']);
    expect(sides(byLabel(plan, 'Spiel um Platz 7'))).toEqual(['group-a-4th', 'group-b-4th']);
    expect(plan.map((d) => d.finalType)).toEqual([undefined, undefined, 'seventhEighth', 'fifthSixth', 'thirdPlace', 'final']);
  });

  it('@TM-004 Gegenbeispiel: „Platz 3 und 7“ erzeugt kein Spiel um Platz 5', () => {
    const plan = cup({ preset: 'top-4', placements: [7, 3] });

    expect(plan.some((d) => d.finalType === 'fifthSixth')).toBe(false);
    expect(plan.filter((d) => d.finalType === 'seventhEighth')).toHaveLength(1);
  });

  it('@TM-004 die Vorlagen belegen vor: „Top 4“ → Platz 3, „Alle Plätze“ → Platz 3, 5 und 7', () => {
    expect(keyOf(cup({ preset: 'top-4' }))).toEqual(['1. Halbfinale', '2. Halbfinale', 'Spiel um Platz 3', 'Finale']);
    expect(keyOf(cup({ preset: 'all-places' }))).toEqual([
      '1. Halbfinale', '2. Halbfinale', 'Spiel um Platz 7', 'Spiel um Platz 5', 'Spiel um Platz 3', 'Finale',
    ]);
  });

  it('@TM-004 Gegenbeispiel: eine gewählte Auswahl gilt auch bei „Alle Plätze“ (keine stille Vorbelegung darüber)', () => {
    expect(keyOf(cup({ preset: 'all-places', placements: [3] }))).toEqual([
      '1. Halbfinale', '2. Halbfinale', 'Spiel um Platz 3', 'Finale',
    ]);
  });

  it('@TM-004 Gegenbeispiel: Platz 5 oder 7 ohne genug Teams in der Gruppe ist ein sichtbarer Fehler, kein stilles Weglassen', () => {
    expect(() => buildFinalsTemplate(2, [3, 3], { preset: 'top-4', placements: [3, 7] })).toThrow(FinalsTemplateError);
    expect(() => buildFinalsTemplate(2, [3, 3], { preset: 'top-4', placements: [3, 7] })).toThrow(/Platz 7/);
  });

  it('@TM-004 Vorbelegung „Alle Plätze“ bei 2 × 3 Teams: ohne Platz 7 (Bestand, keine Meldung)', () => {
    expect(keyOf(buildFinalsTemplate(2, [3, 3], { preset: 'all-places' }))).toEqual([
      '1. Halbfinale', '2. Halbfinale', 'Spiel um Platz 5', 'Spiel um Platz 3', 'Finale',
    ]);
  });

  it.each([[2], [4], [6], [9]])('@TM-004 Gegenbeispiel: unbekannter Platz %i ist ein sichtbarer Fehler', (place) => {
    expect(() => cup({ preset: 'top-4', placements: [3, place] })).toThrow(FinalsTemplateError);
  });

  it('@TM-004 Gegenbeispiel: Platzierungsspiele ohne Halbfinale („Nur Finale“) sind ein sichtbarer Fehler', () => {
    expect(() => cup({ preset: 'final-only', placements: [3] })).toThrow(FinalsTemplateError);
    expect(keyOf(cup({ preset: 'final-only', placements: [] }))).toEqual(['Finale']);
  });
});

describe('@TM-005 Das Spiel um Platz 3 ist mit Herkunft je Seite vorbelegt', () => {
  it('@TM-005 Platz 3 = Verlierer Halbfinale 1 gegen Verlierer Halbfinale 2', () => {
    const plan = cup({ preset: 'top-4', placements: [3] });
    const [hf1, hf2] = plan;

    expect(sides(byLabel(plan, 'Spiel um Platz 3'))).toEqual([`${hf1.id}-loser`, `${hf2.id}-loser`]);
  });
});

describe('@TM-142 Die Vorlage „Top 4“ paart die Halbfinals nach dem Verbandsmuster', () => {
  it('@TM-142 2 Gruppen: HF1 Erster A gegen Zweiter B, HF2 Erster B gegen Zweiter A, dann Platz 3 und Finale', () => {
    const plan = cup({ preset: 'top-4' });

    expect(sides(byLabel(plan, '1. Halbfinale'))).toEqual(['group-a-1st', 'group-b-2nd']);
    expect(sides(byLabel(plan, '2. Halbfinale'))).toEqual(['group-b-1st', 'group-a-2nd']);
    expect(keyOf(plan).slice(2)).toEqual(['Spiel um Platz 3', 'Finale']);
  });

  it('@TM-142 1 Gruppe: HF1 Erster gegen Vierter, HF2 Zweiter gegen Dritter, dann Platz 3 und Finale', () => {
    const plan = buildFinalsTemplate(1, [5], { preset: 'top-4' });

    expect(sides(byLabel(plan, '1. Halbfinale'))).toEqual(['group-a-1st', 'group-a-4th']);
    expect(sides(byLabel(plan, '2. Halbfinale'))).toEqual(['group-a-2nd', 'group-a-3rd']);
    expect(keyOf(plan).slice(2)).toEqual(['Spiel um Platz 3', 'Finale']);
  });

  it.each(['top-4', 'top-8', 'top-16', 'all-places'] as const)(
    '@TM-142 Gegenbeispiel (%s, 2 Gruppen): im Halbfinale treffen nie zwei Teams derselben Gruppe aufeinander',
    (preset) => {
      const semis = cup({ preset }).filter((d) => d.phase === 'semifinal');
      expect(semis).toHaveLength(2);
      for (const semi of semis) {
        const groupOf = (ref: string) => /^group-([a-z])-/.exec(ref)?.[1];
        expect(groupOf(semi.teamASource)).not.toBe(groupOf(semi.teamBSource));
      }
    },
  );
});

describe('A-12a Phase je Spiel aus dem Generator (C-FINALPHASE-AUS-ID)', () => {
  it('A-12a Halbfinale tragen semifinal, Platzierungsspiele und Finale final', () => {
    const plan = cup({ preset: 'all-places' });

    expect(plan.map((d) => [d.label, d.phase])).toEqual([
      ['1. Halbfinale', 'semifinal'], ['2. Halbfinale', 'semifinal'], ['Spiel um Platz 7', 'final'],
      ['Spiel um Platz 5', 'final'], ['Spiel um Platz 3', 'final'], ['Finale', 'final'],
    ]);
  });
});

describe('@TM-002 Die eigene Vorlage bezieht jede Gruppe ein (Zeile 2 Gruppen × 4 Teams)', () => {
  it.each(['final-only', 'top-4', 'all-places'] as const)('@TM-002 2 × 4, Vorlage %s: jede Seite hat eine Herkunft, beide Gruppen sind enthalten, keine fremde Gruppe', (preset) => {
    const plan = cup({ preset });
    const refs = plan.flatMap(sides);
    const groups = new Set(refs.flatMap((ref) => /^group-([a-z])-/.exec(ref)?.[1] ?? []));

    expect(refs.every((ref) => ref.length > 0)).toBe(true);
    expect([...groups].sort()).toEqual(['a', 'b']);
  });

  it.each([3, 4, 8])('@TM-002 Gegenbeispiel: %i Gruppen ergeben einen sichtbaren Fehler (nur 1 oder 2 Gruppen), keinen Plan ohne Gruppe C', (groups) => {
    const sizes = Array.from({ length: groups }, () => 4);
    expect(() => buildFinalsTemplate(groups, sizes, { preset: 'top-4' })).toThrow(FinalsTemplateError);
    expect(() => buildFinalsTemplate(groups, sizes, { preset: 'top-4' })).toThrow(/nur für 1 oder 2 Gruppen/);
  });
});

describe('A-12a Gruppenzahl muss bekannt sein (C-GENERATOR-GRUPPENZAHL-DEFAULT)', () => {
  it('A-12a fehlende Gruppenzahl ist ein sichtbarer Fehler (kein stilles „2 Gruppen“)', () => {
    expect(() => buildFinalsTemplate(undefined, [4, 4], { preset: 'top-4' })).toThrow(FinalsTemplateError);
    expect(() => buildFinalsTemplate(undefined, [4, 4], { preset: 'top-4' })).toThrow(/Gruppenzahl/);
  });

  it('A-12a Gegenbeispiel: Gruppenzahl passt nicht zu den Gruppen der Teams → sichtbarer Fehler', () => {
    expect(() => buildFinalsTemplate(2, [8], { preset: 'top-4' })).toThrow(/Gruppenzahl/);
  });

  it('A-12a Gegenbeispiel: „Keine Finalrunde“ braucht keine Gruppenzahl', () => {
    expect(buildFinalsTemplate(undefined, [4, 4], { preset: 'none' })).toEqual([]);
  });
});
