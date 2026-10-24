/**
 * PDF-Kopf: Altersklasse (Record Wizard-Regelprofile @W2B-022, @W2B-024, @W2B-026). Gelesen aus dem fertigen PDF (pdfjs).
 */
import { describe, expect, it } from 'vitest';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { layoutOf } from './pdfFixtureLayout';

async function kopfTexte(ageClass: string): Promise<string[]> {
  const tournament = hallencupTournament({ ageClass });
  const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
  return pages.flatMap(page => page.texts.map(t => t.str.trim())).filter(s => s !== '');
}

describe('Altersklasse im PDF', () => {
  it.each(['', '   '])('@W2B-022 „%s“: keine Zeile „Altersklasse“ und kein Trennzeichen am Anfang eines Textes (auch im Kurzkopf der Folgeseiten)', async wert => {
    const texte = await kopfTexte(wert);
    expect(texte).not.toContain('Altersklasse');
    expect(texte.filter(s => /^[·•|–-]\s/.test(s))).toEqual([]);
  });

  it('Gegenbeispiel @W2B-024: angegeben steht die Zeile „Altersklasse“ mit dem Wert genau so da', async () => {
    const texte = await kopfTexte('U11');
    expect(texte).toContain('Altersklasse');
    expect(texte).toContain('U11');
    expect(texte).not.toContain('E-Jugend');
  });

  it.each(['E2-Jugend', 'AH'])('@W2B-023 @W2B-026 „%s“ steht im Kopf', async wert => {
    expect(await kopfTexte(wert)).toContain(wert);
  });
});
