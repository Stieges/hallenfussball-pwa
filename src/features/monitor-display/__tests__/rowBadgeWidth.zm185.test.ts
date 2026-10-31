/**
 * @ZM-185 @ZM-151 Breite der Abzeichen-Spalte in den Spielzeilen: je Turnier so breit wie das längste mögliche Wort,
 * gleich in allen Zeilen. Ohne K.-o.-Spiele kein „Verlängerung“/„Strafstoßschießen“ (Gleichstand in der Gruppe ist eine
 * Platzentscheidung, kein Spiel). Die Pixelbreite der Token prüft `tests/e2e/flows/zm185-zeilen.spec.ts` im Browser.
 */
import { describe, it, expect } from 'vitest';
import { displayList } from '../../../design-tokens';
import { hasKnockoutMatches, rowBadgeWidth } from '../rowBadgeWidth';
import { buildTournament } from './monitorFixture';

describe('rowBadgeWidth', () => {
  it('@ZM-185 Nikolaus (Jeder gegen jeden, nur Gruppenspiele, keine Finalrunde): schmale Spalte', () => {
    const t = buildTournament({ finalsConfig: { preset: 'none' } });
    expect(hasKnockoutMatches(t)).toBe(false);
    expect(rowBadgeWidth(t)).toContain(displayList.badgeColumnGroup);
    expect(rowBadgeWidth(t)).not.toContain(displayList.badgeColumnKnockout);
  });

  it('@ZM-185 Gegenbeispiel: Finalrunde eingerichtet → breite Spalte für „Strafstoßschießen“', () => {
    const t = buildTournament({ finalsConfig: { preset: 'top-4' } });
    expect(hasKnockoutMatches(t)).toBe(true);
    expect(rowBadgeWidth(t)).toContain(displayList.badgeColumnKnockout);
  });

  it('@ZM-185 Gegenbeispiel: ein Spiel außerhalb der Gruppenphase genügt, auch ohne Finalrunden-Einstellung', () => {
    const base = buildTournament({ finalsConfig: { preset: 'none' } });
    const t = { ...base, matches: base.matches.map((m, i) => (i === 0 ? { ...m, phase: 'final' as const } : m)) };
    expect(hasKnockoutMatches(t)).toBe(true);
  });

  it('@ZM-151 die breite Spalte ist breiter als die schmale, beide mit dem Polster des Abzeichens', () => {
    expect(parseFloat(displayList.badgeColumnKnockout)).toBeGreaterThan(parseFloat(displayList.badgeColumnGroup));
    expect(rowBadgeWidth(buildTournament({ finalsConfig: { preset: 'none' } }))).toMatch(/^calc\(.+ \+ 2 \* .+\)$/);
  });
});
