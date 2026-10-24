/**
 * Altersklasse (Record Wizard-Regelprofile, @W2B-010, @W2B-022 bis @W2B-026): reine Logik, ohne React.
 *
 * Gespeichert wird genau ein Text in `tournament.ageClass` (Config-JSON, kein eigenes Feld). Die Auswahl im Assistenten
 * baut diesen Text zusammen und liest ihn wieder auseinander; gedruckt wird der Text unverändert (@W2B-024).
 * Leer bedeutet „keine Angabe“: dann zeigt keine Stelle etwas an, auch kein Trennzeichen davor (@W2B-022).
 */

export type AgeGroupId = 'youth' | 'uClasses' | 'adults' | 'general';

export interface AgeGroup {
  id: AgeGroupId;
  entries: readonly string[];
  /** Nur die Jugend kennt eine Stufe (Spielstärke) 1 bis 3 (@W2B-023). */
  hasLevel: boolean;
}

export type AgeLevel = 1 | 2 | 3;
export const AGE_LEVELS: readonly AgeLevel[] = [1, 2, 3];

const YOUTH: readonly string[] = ['G-Jugend', 'F-Jugend', 'E-Jugend', 'D-Jugend', 'C-Jugend', 'B-Jugend', 'A-Jugend'];

const FOOTBALL_GROUPS: readonly AgeGroup[] = [
  { id: 'youth', entries: YOUTH, hasLevel: true },
  { id: 'uClasses', entries: ['U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U19'], hasLevel: false },
  { id: 'adults', entries: ['Herren', 'Frauen', 'Senioren', 'Ü32', 'Ü40', 'Ü50'], hasLevel: false },
];

/** Andere Sportarten behalten ihre eigene, kürzere Liste (bisher `getOtherAgeClassOptions`). */
const OTHER_GROUPS: readonly AgeGroup[] = [
  { id: 'uClasses', entries: ['U8', 'U10', 'U12', 'U14', 'U16', 'U18'], hasLevel: false },
  { id: 'general', entries: ['Jugend', 'Erwachsene', 'Mixed'], hasLevel: false },
];

export function ageGroupsFor(sport: 'football' | 'other' | undefined): readonly AgeGroup[] {
  return sport === 'other' ? OTHER_GROUPS : FOOTBALL_GROUPS;
}

export type ParsedAgeClass =
  | { kind: 'none' }
  | { kind: 'entry'; group: AgeGroupId; entry: string; level: AgeLevel | null }
  /** Wert außerhalb der Liste (frei getippt oder aus einem älteren Turnier): erscheint unter „Sonstiges …“ (@W2B-026). */
  | { kind: 'custom'; text: string };

const LEVEL_PATTERN = /^([A-G])([1-3])-Jugend$/;

export function composeAgeClass(entry: string, level: AgeLevel | null): string {
  if (level === null || !YOUTH.includes(entry)) {
    return entry;
  }
  return `${entry.slice(0, 1)}${level}-Jugend`;
}

export function parseAgeClass(value: string | undefined, sport: 'football' | 'other' | undefined): ParsedAgeClass {
  const text = (value ?? '').trim();
  if (text === '') {
    return { kind: 'none' };
  }
  const groups = ageGroupsFor(sport);
  const leveled = LEVEL_PATTERN.exec(text);
  if (leveled && groups.some((group) => group.hasLevel)) {
    return { kind: 'entry', group: 'youth', entry: `${leveled[1]}-Jugend`, level: Number(leveled[2]) as AgeLevel };
  }
  for (const group of groups) {
    if (group.entries.includes(text)) {
      return { kind: 'entry', group: group.id, entry: text, level: null };
    }
  }
  return { kind: 'custom', text: value ?? text };
}

/** Der Text, der gezeigt wird; leer, wenn nichts angegeben ist. */
export function ageClassText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** Fügt Angaben mit Trennzeichen zusammen und lässt Leere samt Trennzeichen weg (@W2B-022). */
export function joinMeta(parts: ReadonlyArray<string | null | undefined>, separator: string): string {
  return parts.map((part) => (part ?? '').trim()).filter((part) => part !== '').join(separator);
}
