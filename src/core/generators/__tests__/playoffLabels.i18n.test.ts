/**
 * A-04a (K1) – Schutztest: Jede Bezeichnung, die der Playoff-Generator erzeugt, hat einen Übersetzungsschlüssel.
 * Ändert jemand einen Generatortext (z. B. „Halbfinale 1“), würde EN still wieder Deutsch zeigen – dieser Test
 * schlägt dann fehl.
 */
import { describe, it, expect } from 'vitest';
import { generatePlayoffMatches } from '../playoffGenerator';
import { describeMatchLabel } from '../../models/slotLabel';
import type { FinalsPreset } from '../../../types/tournament';

const PRESETS: FinalsPreset[] = ['final-only', 'top-4', 'top-8', 'top-16', 'all-places'];
const GROUP_COUNTS = [2, 3, 4, 8];

describe('A-04a K1: Generator-Bezeichnungen sind übersetzbar', () => {
  const cases = PRESETS.flatMap((preset) => GROUP_COUNTS.map((groups) => [preset, groups] as const));

  it.each(cases)('A-04a K1: Preset %s mit %i Gruppen – jede Bezeichnung hat einen Schlüssel', (preset, groups) => {
    const matches = generatePlayoffMatches(groups, { preset });
    for (const match of matches) {
      const description = describeMatchLabel(match.label);
      expect(description, `Bezeichnung „${match.label}“ (${match.id}) ist unübersetzt`).toHaveProperty('key');
    }
  });

  it('A-04a K1: die Prüfung deckt Viertelfinale, Halbfinale, Platz 3 und Finale tatsächlich ab', () => {
    const labels = cases.flatMap(([preset, groups]) => generatePlayoffMatches(groups, { preset }).map((m) => m.label));
    for (const expected of [/^Viertelfinale \d$/, /^\d\. Halbfinale$/, /^Spiel um Platz 3$/, /^Finale$/]) {
      expect(labels.some((label) => expected.test(label))).toBe(true);
    }
  });

  it('A-04a K1 Gegenbeispiel: ein geänderter Generatortext ohne Schlüssel würde auffallen', () => {
    expect(describeMatchLabel('Halbfinale 1')).not.toHaveProperty('key');
  });
});
