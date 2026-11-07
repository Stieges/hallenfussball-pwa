/**
 * Befunde C-FILTER-AKTIV-UNSICHTBAR und Startseiten-Review Optik O7/O10/O16: Token-Werte sind `var(--…)`-Zeichenketten.
 * `${var}15`, `${var}40` und `${var}px` ergeben ungültiges CSS (der Browser verwirft die Zeile), der Chip blieb durchsichtig,
 * der Live-Rand und der Innenabstand von „Registrieren“ fehlten. Quelltext-Wächter über die Dateien der Startseite
 * (Gegenstück zur Wirkung: SearchFilterBar.ob077.test.tsx, TournamentCard.lz001.test.tsx).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DATEIEN = [
  'components/dashboard/SearchFilterBar.tsx',
  'components/dashboard/DashboardNav.tsx',
  'components/ui/CollapsibleSection.tsx',
  'components/layout/AuthSection.tsx',
  'components/TournamentCard.tsx',
  'screens/DashboardScreen.tsx',
];
// ${…} direkt gefolgt von Ziffern oder px (Hex-Alpha-Suffix bzw. Einheit hinter einer CSS-Variable)
const UNGUELTIG = /\$\{[^}]*(?:colors|spacing|fontSizes)[^}]*\}(?:\d{2}\b|px\b)/;

describe('keine ungültigen CSS-Ausdrücke in den Dateien der Startseite', () => {
  it.each(DATEIEN)('%s', (datei) => {
    const quelltext = readFileSync(join(__dirname, '..', '..', '..', datei), 'utf8');
    expect(quelltext.match(UNGUELTIG)).toBeNull();
  });
});
