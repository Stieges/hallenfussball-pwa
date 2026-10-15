/**
 * B-28a3-4F F3 (Review M4): Abschnittstitel kleben nicht am vorigen Block. Die Grundlinie des Titels liegt um die
 * Oberlänge der Schrift unter der Unterkante des vorigen Blocks plus Abstand (`printGap.sectionGap`), gemessen an der
 * Oberkante der Titelzeile. Gilt für „Gruppenphase“ nach den Teilnehmer-Kästen, für Finalrunden-Überschriften und
 * für „Platzierung“ nach einer Finaltabelle. Gelesen aus dem fertigen PDF (pdfjs).
 * Szenarien: @DR-001, @DR-002 (Abschnitte mit Abstand), @DR-009 (Platzierung am Ende).
 */
import { describe, expect, it } from 'vitest';
import { printFont, printGap, printType, printUnit } from '../../../design-tokens/print';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { layoutOf, ohneNummer } from './pdfFixtureLayout';
import type { LayoutPage, LayoutText } from './pdfjsLayout';

const SIZE_TOL = 0.05;
const PAPIER = '#ffffff';

/** Oberkante einer Zeile in mm: Grundlinie minus Oberlänge der Schrift (Ascent × Größe). */
function oberkante(text: LayoutText): number {
  return text.y - text.size * printUnit.mmPerPt * printFont.ascentEm;
}

/** Unterkante der tiefsten Linie oder Fläche, die oberhalb `grenze` liegt (Tabellenkante, Kastenkante). */
function unterkanteDarueber(page: LayoutPage, grenze: number): number | undefined {
  const linien = page.lines
    .filter(l => Math.abs(l.y1 - l.y2) < 0.01 && l.y1 < grenze - 0.01)
    .map(l => l.y1);
  const flaechen = page.rects
    .filter(r => r.w > 20 && r.y + r.h <= grenze + 0.01)
    .map(r => r.y + r.h);
  const alle = [...linien, ...flaechen];
  return alle.length > 0 ? Math.max(...alle) : undefined;
}

/** Abstand zwischen dem Block über dem Titel und der Oberkante des Titels, nur wenn es einen Block darüber gibt. */
function abstandZuDarueber(page: LayoutPage, titel: LayoutText): number | undefined {
  const top = oberkante(titel);
  const unten = unterkanteDarueber(page, top);
  return unten === undefined ? undefined : top - unten;
}

const finde = (page: LayoutPage, text: string): LayoutText | undefined => page.texts.find(t => ohneNummer(t.str) === text);

describe('F3 Abschnittstitel mit Abstand zum vorigen Block', () => {
  it('„Gruppenphase“ liegt mindestens den Abstands-Token unter den Teilnehmer-Kästen', async () => {
    const tournament = hallencupTournament();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const seite = pages[0];
    const titel = finde(seite, 'Gruppenphase');
    expect(titel, 'Abschnittstitel „Gruppenphase“ auf Seite 1').toBeDefined();
    if (!titel) {return;}
    const kaesten = seite.rects.filter(r => r.fill === PAPIER && r.w > 20 && r.y < titel.y);
    expect(kaesten, 'Teilnehmer-Kästen über dem Titel (zwei Gruppen)').toHaveLength(2);

    const unterkante = Math.max(...kaesten.map(k => k.y + k.h));
    expect(oberkante(titel), 'Oberkante „Gruppenphase“ ≥ Unterkante Kasten + Abstand').toBeGreaterThanOrEqual(
      unterkante + printGap.sectionGap - SIZE_TOL,
    );
  });

  it('jede Finalrunden-Überschrift und „Platzierung“ liegen den Abstands-Token unter der Tabelle davor', async () => {
    const tournament = hallencupTournament();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const ueberschriften = ['Halbfinale', 'Spiel um Platz 3', 'Finale', 'Platzierung'];
    const geprueft: string[] = [];

    for (const page of pages) {
      for (const name of ueberschriften) {
        const titel = page.texts.find(t => ohneNummer(t.str) === name && Math.abs(t.size - printType.h2) <= SIZE_TOL);
        if (!titel) {continue;}
        const abstand = abstandZuDarueber(page, titel);
        if (abstand === undefined) {continue;}
        geprueft.push(name);
        expect(abstand, `Abstand über „${name}“`).toBeGreaterThanOrEqual(printGap.sectionGap - SIZE_TOL);
      }
    }

    expect(geprueft, 'Überschriften mit Tabelle darüber').toEqual(expect.arrayContaining(['Halbfinale', 'Spiel um Platz 3', 'Finale', 'Platzierung']));
  });
});
