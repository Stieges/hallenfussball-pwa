/**
 * Bundle-Beleg T5 (Review G6): Turnierlogo und zweite Grafik im Assistenten ziehen kein jsPDF und kein Zeichenmodul des
 * Druckens (`src/lib/pdf`) in den Assistenten. Geprüft am Import-Graphen ab `TournamentGraphicsFields.tsx` (alle
 * relativen Importe, rekursiv). Den Beleg am gebauten Stand liefert tests/e2e/turnierlogo-pdf.spec.ts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WURZEL = resolve(__dirname, '..', 'components', 'TournamentGraphicsFields.tsx');
const IMPORT = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function aufloesen(von: string, spec: string): string | undefined {
  const basis = resolve(dirname(von), spec);
  for (const kandidat of [basis, `${basis}.ts`, `${basis}.tsx`, join(basis, 'index.ts'), join(basis, 'index.tsx')]) {
    if (existsSync(kandidat) && /\.tsx?$/.test(kandidat)) { return kandidat; }
  }
  return undefined;
}

function graph(start: string): { dateien: Set<string>; fremde: Set<string> } {
  const dateien = new Set<string>();
  const fremde = new Set<string>();
  const offen = [start];
  while (offen.length > 0) {
    const datei = offen.pop()!;
    if (dateien.has(datei)) { continue; }
    dateien.add(datei);
    for (const treffer of readFileSync(datei, 'utf8').matchAll(IMPORT)) {
      const spec = treffer[1] ?? treffer[2] ?? treffer[3];
      if (spec.startsWith('.')) {
        const ziel = aufloesen(datei, spec);
        if (ziel !== undefined) { offen.push(ziel); }
      } else {
        fremde.add(spec);
      }
    }
  }
  return { dateien, fremde };
}

describe('T5 Bundle: Assistent-Felder ohne jsPDF', () => {
  const { dateien, fremde } = graph(WURZEL);

  it('der Graph erreicht Aufbereitung, Akzent und Speicher (der Test misst wirklich etwas)', () => {
    const namen = [...dateien].map(d => d.split('/').pop());
    expect(namen).toEqual(expect.arrayContaining(['prepareTournamentGraphic.ts', 'accent.ts', 'tournamentGraphicsStore.ts', 'GraphicUploadField.tsx', 'ColorDot.tsx']));
  });

  it('kein Import von jspdf (auch nicht von jspdf-autotable)', () => {
    expect([...fremde].filter(spec => spec.startsWith('jspdf'))).toEqual([]);
  });

  it('kein Modul unter src/lib/pdf und kein PDF-Dialog im Graphen', () => {
    const pdf = [...dateien].filter(d => /\/src\/lib\/pdf\/|\/PDFExportDialog|\/pdfExport|Exporter/.test(d));
    expect(pdf).toEqual([]);
  });
});
