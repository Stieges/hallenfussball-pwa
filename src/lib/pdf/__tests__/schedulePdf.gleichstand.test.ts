/**
 * PDF-Kopf: Gleichstandsregel (@DR-020 „Gleichstand auf Platz 1: Strafstoßschießen“). Gelesen aus dem fertigen PDF (pdfjs).
 */
import { describe, expect, it } from 'vitest';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { layoutOf } from './pdfFixtureLayout';

async function kopfTexte(placementsToPlayOut: number[] | undefined): Promise<string[]> {
  const tournament = hallencupTournament({ placementsToPlayOut });
  const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
  return (pages[0]?.texts ?? []).map(t => t.str.trim()).filter(s => s !== '');
}

describe('Gleichstand im Kopf von Seite 1 (@DR-020)', () => {
  it('Platz 1 auszuspielen: Zeile „Gleichstand auf Platz 1“ mit „Strafstoßschießen“', async () => {
    const texte = await kopfTexte([1]);
    expect(texte).toContain('Gleichstand auf Platz 1: Strafstoßschießen');
  });

  it('ohne Einstellung gilt die Voreinstellung Platz 1', async () => {
    expect(await kopfTexte(undefined)).toContain('Gleichstand auf Platz 1: Strafstoßschießen');
  });

  it('Gegenbeispiel: kein auszuspielender Platz → keine Zeile „Gleichstand auf …“', async () => {
    expect((await kopfTexte([])).filter(s => s.startsWith('Gleichstand auf'))).toEqual([]);
  });
});
