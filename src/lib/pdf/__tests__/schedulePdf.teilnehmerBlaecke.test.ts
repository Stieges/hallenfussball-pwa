/**
 * B-28a3-4b Punkt 8 und 6 (Controller 15.10., Daniel „Teilnehmer wieder als Blöcke“): je Gruppe ein Kasten,
 * Kästen nebeneinander und umbrechend, Kennungen A1… fett, Teamnamen 12 pt, Umbruch statt Kürzen (bis drei Zeilen),
 * Abschnittstitel mit Abstand, keine Überlappung. Gelesen aus dem fertigen PDF (pdfjs).
 * Szenarien: @DR-001, @DR-002, @BM-021, @BM-009.
 */
import { describe, expect, it } from 'vitest';
import { printLimits } from '../../../design-tokens/print';
import type { Team } from '../../../types/tournament';
import { HALLENCUP_TEAMS, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { layoutOf } from './pdfFixtureLayout';
import { textIn, type Box, type LayoutPage, type LayoutText } from './pdfjsLayout';
import { squash } from './pdfjsText';
import { fettMap } from './pdfSchnitt';

const LONG_50 = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
const SIZE_TOL = 0.05;
/** Oberlänge der Schrift grob als Anteil der Schriftgröße (Inter), für Ober- und Unterkanten. */
const DESCENT_EM = 0.25;
const MM_PER_PT = 25.4 / 72;
/** Weiß: Füllung der Kästen (Papier). Tabellenzeilen nutzen dieselbe Farbe, sie liegen aber unterhalb der Gruppenspiele. */
const PAPIER = '#ffffff';

const trimmed = (text: LayoutText): string => text.str.trim();

const hallencupMitRegelwerk = (): ReturnType<typeof hallencupTournament> => hallencupTournament();

/** Kästen der Teilnehmer auf Seite 1: weiße Rechtecke zwischen dem Abschnittstitel und dem Spieltabellen-Kopf. */
function kaesten(page: LayoutPage): Box[] {
  const titel = page.texts.find(t => trimmed(t) === 'Teilnehmer');
  // Erste Spaltenüberschrift der Spieltabelle markiert das Ende der Teilnehmer
  const spiele = page.texts.find(t => trimmed(t) === 'Nr' && (titel?.y ?? 0) < t.y);
  expect(titel, 'Abschnittstitel „Teilnehmer“').toBeDefined();
  expect(spiele, 'Spaltenkopf der Spieltabelle').toBeDefined();
  return page.rects
    .filter(r => r.fill === PAPIER && r.w > 20 && r.y > (titel?.y ?? 0) && r.y < (spiele?.y ?? 0))
    .map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h }));
}

const ueberlappt = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('Punkt 8 Teilnehmer als Blöcke je Gruppe (Daniel 15.10.)', () => {
  it('zwei Gruppen ergeben zwei Kästen auf Seite 1', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));

    expect(kaesten(pages[0])).toHaveLength(2);
  });

  it('die Kästen überlappen sich nicht und liegen unter dem Abschnittstitel (Oberkante ≥ Unterkante Titel)', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const titel = pages[0].texts.find(t => trimmed(t) === 'Teilnehmer');
    const felder = kaesten(pages[0]);

    const unterkanteTitel = (titel?.y ?? 0) + DESCENT_EM * (titel?.size ?? 0) * MM_PER_PT;
    for (const kasten of felder) {
      expect(kasten.y, 'Oberkante Kasten unter Titel').toBeGreaterThanOrEqual(unterkanteTitel);
    }
    for (let i = 0; i < felder.length; i++) {
      for (let j = i + 1; j < felder.length; j++) {
        expect(ueberlappt(felder[i], felder[j]), `Kasten ${i} und ${j} überlappen sich`).toBe(false);
      }
    }
  });

  it('Kennungen A1 … B4 stehen fett, die Teamnamen in den Kästen 12 pt', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const inKaesten = kaesten(pages[0]).flatMap(kasten => textIn(pages[0], kasten));
    const kennungen = inKaesten.filter(t => /^[AB]\d$/.test(trimmed(t)));
    const fett = await fettMap(inKaesten);

    expect(kennungen.map(trimmed).sort()).toEqual(['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4']);
    for (const k of kennungen) {
      expect(fett.get(k), `„${trimmed(k)}“ fett`).toBe(true);
    }
    for (const name of HALLENCUP_TEAMS.map(team => team.name)) {
      const stuecke = inKaesten.filter(t => trimmed(t) === name);
      expect(stuecke.length, `Teamname „${name}“ in einem Kasten`).toBeGreaterThan(0);
      for (const t of stuecke) {
        expect(Math.abs(t.size - printLimits.teamPt), `„${name}“`).toBeLessThanOrEqual(SIZE_TOL);
      }
    }
  });

  it('@BM-021 der 50-Zeichen-Name steht vollständig im Kasten und umbricht auf höchstens drei Zeilen', async () => {
    const teams: Team[] = HALLENCUP_TEAMS.map((team, i) => (i === 0 ? { ...team, name: LONG_50 } : team));
    const tournament = hallencupTournament({ teams });
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const kasten = kaesten(pages[0])[0];
    expect(kasten, 'Kasten Gruppe A').toBeDefined();
    const stuecke = textIn(pages[0], kasten).filter(t => trimmed(t) !== '' && LONG_50.includes(trimmed(t)) && trimmed(t).length >= 2);
    const zeilen = new Set(stuecke.map(t => Math.round(t.y * 10)));

    expect(squash(stuecke.map(trimmed).join(' '))).toContain(squash(LONG_50));
    expect(zeilen.size).toBeGreaterThanOrEqual(2);
    expect(zeilen.size).toBeLessThanOrEqual(3);
  });

  it('Gegenbeispiel: ohne Gruppen (Jeder gegen jeden) ein einziger Kasten über die Breite', async () => {
    const teams = HALLENCUP_TEAMS.map(team => ({ ...team, group: undefined }));
    const tournament = hallencupTournament({ teams, groupSystem: 'roundRobin' });
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));

    expect(kaesten(pages[0])).toHaveLength(1);
  });
});
