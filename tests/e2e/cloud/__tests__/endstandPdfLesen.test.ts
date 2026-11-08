/**
 * Lesehilfen des Durchstichs N8 am echten Endstand-PDF (@DR-052, @DR-009): `plaetzeImPdf` liest nur die Platzzeilen der Seite „Siegerehrung“
 * und hört vor der Torschützenliste auf (Befund PR #484: der Seed des Nikolaus-Turniers hat Tore mit Rückennummer, die Vereine der Liste
 * kamen als 7. Name dazu); `schuetzenImPdf` liest die Liste, ihre Spaltenköpfe und die Fußnote.
 */
import { describe, expect, it } from 'vitest';
import { endstandHallencup, endstandNikolaus, endstandPdf, HALLENCUP_PLAETZE, HALLENCUP_SCHUETZEN, NIKOLAUS_SCHUETZEN } from '../../../../src/lib/pdf/__tests__/endstandSupport';
import { extractPdfText } from '../../../../src/lib/pdf/__tests__/pdfjsText';
import { erwarteteFussnote, erwarteteZeilen, plaetzeImPdf, schuetzenImPdf, type GespeicherterSchuetze } from '../turniertag/steps/endstandPdfLesen';

async function seiten(fall: Parameters<typeof endstandPdf>[0]): Promise<string[][]> {
  return (await extractPdfText((await endstandPdf(fall)).bytes, 'endstand.pdf')).pages;
}

describe('N8 liest das Endstand-PDF: Plätze und Torschützen der Siegerehrung (@DR-052)', () => {
  it('Nikolaus-Seed mit Torschützen: genau die 6 Plätze in Endstand-Reihenfolge, nicht die Vereine der Torschützenliste', async () => {
    const fall = endstandNikolaus({}, NIKOLAUS_SCHUETZEN);
    const namen = fall.ranking.map((e) => e.team.name);

    expect(plaetzeImPdf(await seiten(fall), namen)).toEqual(namen);
  });

  it('Hallencup mit Torschützen: alle 8 Plätze, danach nichts', async () => {
    const fall = endstandHallencup();
    const namen = HALLENCUP_PLAETZE.map((e) => e.team.name);

    expect(plaetzeImPdf(await seiten(fall), namen)).toEqual(namen);
  });

  it('ohne Torschützen: dieselben Plätze, keine Überschrift „Torschützen“', async () => {
    const fall = endstandNikolaus();
    const gelesen = await seiten(fall);

    expect(plaetzeImPdf(gelesen, fall.ranking.map((e) => e.team.name))).toHaveLength(6);
    expect(schuetzenImPdf(gelesen, 0).ueberschrift).toBe(false);
  });

  it('Torschützenliste: Spaltenköpfe, Zeilen wie gespeichert (Rang nur bei der ersten Zeile seiner Gruppe) und Fußnote', async () => {
    const fall = endstandNikolaus({}, NIKOLAUS_SCHUETZEN);
    const gespeichert: GespeicherterSchuetze[] = fall.scorers;
    const gelesen = schuetzenImPdf(await seiten(fall), erwarteteZeilen(gespeichert).length);

    expect(erwarteteZeilen(gespeichert).filter((t) => /^\d+\.$/.test(t))).toEqual(['1.', '2.', '4.']);
    expect(gelesen.kopf).toEqual(['Rang', 'Verein', 'Nr.', 'Tore']);
    expect(gelesen.zeilen).toEqual(erwarteteZeilen(gespeichert));
    expect(gelesen.fussnote).toBe('Außerdem: 1 Tor ohne Rückennummer · 1 Eigentor');
    expect(erwarteteFussnote(gespeichert)).toBe(gelesen.fussnote);
  });

  it('Hallencup: Fußnote im Plural „2 Tore ohne Rückennummer · 1 Eigentor“', async () => {
    const fall = endstandHallencup();

    expect(schuetzenImPdf(await seiten(fall), erwarteteZeilen(HALLENCUP_SCHUETZEN).length).fussnote).toBe('Außerdem: 2 Tore ohne Rückennummer · 1 Eigentor');
  });
});
