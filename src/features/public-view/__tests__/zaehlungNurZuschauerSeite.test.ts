/**
 * @RZ-028 Gezählt wird nur die öffentliche Zuschauer-Seite: Hallenmonitor, Cockpit und Verwaltung binden die Zählung nicht ein.
 * Der Hook `usePublicViewCount` und der Versandweg stehen nur in der Zuschauer-Seite (LiveViewScreen) und ihrem eigenen Modul.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..', '..', '..');
const ERLAUBT = new Set([
  'screens/LiveViewScreen.tsx',
  'features/public-view/usePublicViewCount.ts',
  'features/public-view/viewCountTransport.ts',
  'core/viewCount/publicViewCount.ts',
]);

function quellen(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) { return name === '__tests__' || name === 'test' ? [] : quellen(pfad); }
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [pfad] : [];
  });
}

describe('@RZ-028 nur die Zuschauer-Seite zählt', () => {
  it('Zählhook, Versandweg und Server-Funktion kommen nur in der Zuschauer-Seite und im Zählmodul vor', () => {
    const treffer = quellen(SRC)
      .map((pfad) => ({ rel: relative(SRC, pfad).split('\\').join('/'), text: readFileSync(pfad, 'utf8') }))
      .filter(({ text }) => /usePublicViewCount|viewCountTransport|count_public_view|sendViewCount/.test(text))
      .map(({ rel }) => rel)
      .filter((rel) => rel !== 'types/supabase.ts');
    expect(treffer.filter((rel) => !ERLAUBT.has(rel))).toEqual([]);
    expect(treffer).toContain('screens/LiveViewScreen.tsx');
  });
});
