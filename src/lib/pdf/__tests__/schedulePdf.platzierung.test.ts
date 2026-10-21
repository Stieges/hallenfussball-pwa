/**
 * B-28 C2 – Platzierung (@DR-009, @DR-005, @BM-016, @BM-046). Gelesen aus dem fertigen PDF (pdfjs).
 * Offen (auch Fassung zum Ausfüllen): Satz und je Team eine nummerierte Schreiblinie, keine Teamnamen, keine Punkte.
 * Nach dem Abschluss (`final`): alle Plätze mit Teamnamen in der Reihenfolge des gespeicherten Endstands.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { printFont, printGap, printLimits, printMetrics, printUnit } from '../../../design-tokens/print';
import { pageGeometry } from '../layout';
import { buildSchedulePdf, type PDFExportOptions } from '../schedulePdf';
import type { RankEntry } from '../placement';
import { HALLENCUP_STANDINGS, HALLENCUP_TEAMS, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { ohneNummer } from './pdfFixtureLayout';
import { readLayout, type LayoutPage } from './pdfjsLayout';
import { translatorFor } from './pdfText';
import { testUuid } from '../../../test/testIds';
import { storedSchedule } from './storedSchedule';

const LINE_MIN_LENGTH = 40;
const FLAT_TOL = 0.01;
const SIZE_TOL = 0.05;
const SATZ_FINALE = 'Die Platzierung steht nach dem Finale fest';
const SATZ_LETZTES = 'Die Platzierung steht nach dem letzten Spiel fest';

/** Endstand, der absichtlich nicht der Punkte-Reihenfolge von HALLENCUP_STANDINGS entspricht. */
const ENDSTAND_NAMEN = ['SC Ost', 'SV Hof', 'FC Nord', 'TuS Tal', 'DJK Berg', 'FC Mitte', 'TSV West', 'SV Süd'];
const ENDSTAND: RankEntry[] = ENDSTAND_NAMEN.map((name, i) => {
  const team = HALLENCUP_TEAMS.find(t => t.name === name);
  if (!team) {throw new Error(`Team ${name} fehlt`);}
  return { place: i + 1, team };
});

interface Auswertung {
  satz: string[];
  platzNummern: string[];
  linien: number;
  /** Teamnamen und sonstige Texte (ohne Satz, ohne Titel, ohne Platznummern) in Zeilenreihenfolge. */
  weitere: Array<{ str: string; size: number }>;
}

async function platzierung(
  options: Partial<PDFExportOptions> = {},
  standings = undefined as typeof HALLENCUP_STANDINGS | undefined,
  schedule = hallencupSchedule(),
  tournament = hallencupTournament(),
): Promise<{ aus: Auswertung; pages: LayoutPage[] }> {
  const { doc } = await buildSchedulePdf({
    schedule,
    standings,
    options: { locale: 'de', translate: translatorFor('de'), tournament, ...options },
  });
  const pages = await readLayout(new Uint8Array(doc.output('arraybuffer')));
  // Überschrift „Platzierung“ (nicht die Regelzeile im Kopf): letzte Seite mit dem Wort als eigenem Textstück
  const index = pages.map(p => p.texts.some(t => ohneNummer(t.str) === 'Platzierung')).lastIndexOf(true);
  const letzte = pages[index];
  const titel = letzte?.texts.find(t => ohneNummer(t.str) === 'Platzierung');
  if (!titel) {throw new Error('Überschrift „Platzierung“ fehlt');}
  const kurzkopf = [tournament.title, tournament.ageClass];
  const folgeseiten = pages.slice(index + 1);
  const darunter = [
    ...letzte.texts.filter(t => t.y > titel.y),
    ...folgeseiten.flatMap(p => p.texts),
  ].filter(t => t.str.trim() !== '' && !kurzkopf.includes(t.str.trim()));
  // Die Fußzeile (Text und Linie unter `footRuleY`) gehört nicht zur Platzierung (B-28 C3)
  const fuss = pageGeometry('a4', 'portrait').footRuleY;
  const zeilen = darunter.filter(t => t.y < fuss); // Reihenfolge des Dokuments (Seiten nacheinander)
  const sätze = zeilen.filter(t => t.str.trim().startsWith('Die Platzierung'));
  // pdfjs fasst Platznummer und Teamname einer Zeile zu einem Textstück zusammen („1. SC Ost“)
  // zweispaltig gezeichnet (Zeile für Zeile links, rechts): nach Platznummer ordnen
  const platzNr = (t: { str: string }): number => Number(/^\d+/.exec(t.str.trim())?.[0]);
  const platzZeilen = zeilen.filter(t => /^\d+\./.test(t.str.trim())).sort((a, b) => platzNr(a) - platzNr(b));
  const nummern = platzZeilen.map(t => /^\d+\./.exec(t.str.trim())?.[0] ?? '');
  const weitere = [
    ...platzZeilen.map(t => ({ str: t.str.trim().replace(/^\d+\.\s*/, ''), size: t.size })).filter(w => w.str !== ''),
    ...zeilen
      .filter(t => !sätze.includes(t) && !platzZeilen.includes(t) && !/^Seite \d+ von \d+$/.test(t.str.trim()))
      .map(t => ({ str: t.str.trim(), size: t.size })),
  ];
  const linien = [
    ...letzte.lines.filter(l => l.y1 > titel.y),
    ...folgeseiten.flatMap(p => p.lines),
  ].filter(l => Math.abs(l.y1 - l.y2) < FLAT_TOL && Math.abs(l.x2 - l.x1) >= LINE_MIN_LENGTH && l.y1 < fuss - FLAT_TOL).length;
  return {
    pages,
    aus: { satz: sätze.map(t => t.str.trim()), platzNummern: nummern, linien, weitere },
  };
}

const NUMMERN_8 = ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.'];

describe('@DR-009 Platzierung vor dem Abschluss', () => {
  it('@DR-009 offen: Satz „nach dem Finale“, genau 8 Schreiblinien 1.–8., kein Teamname, keine Punkte', async () => {
    const { aus } = await platzierung();

    expect(aus.satz).toEqual([SATZ_FINALE]);
    expect(aus.platzNummern).toEqual(NUMMERN_8);
    expect(aus.linien).toBe(8);
    expect(aus.weitere).toEqual([]);
  });

  it('@DR-009 offen auch nachdem Gruppenspiele gespielt sind: weder Teamnamen noch Punkte (C-RANK-FIN)', async () => {
    const { aus } = await platzierung({}, HALLENCUP_STANDINGS);

    expect(aus.satz).toEqual([SATZ_FINALE]);
    expect(aus.platzNummern).toEqual(NUMMERN_8);
    expect(aus.linien).toBe(8);
    expect(aus.weitere).toEqual([]);
  });

  it('@DR-009 Gegenbeispiel: ein Ranking ohne Abschluss ändert nichts (immer offen, keine Übergangsplatzierung)', async () => {
    const { aus } = await platzierung({ ranking: ENDSTAND }, HALLENCUP_STANDINGS);

    expect(aus.satz).toEqual([SATZ_FINALE]);
    expect(aus.weitere).toEqual([]);
    expect(aus.linien).toBe(8);
  });

  it('@DR-009 Gegenbeispiel: Abschluss ohne Ranking bleibt offen', async () => {
    const { aus } = await platzierung({ closed: true });

    expect(aus.satz).toEqual([SATZ_FINALE]);
    expect(aus.weitere).toEqual([]);
  });

  it('@BM-046 ohne Finalrunde (Jeder gegen jeden): Satz „nach dem letzten Spiel“, Schreiblinie je Team', async () => {
    const teams = HALLENCUP_TEAMS.map(team => ({ ...team, group: undefined }));
    const tournament = hallencupTournament({ teams, groupSystem: 'roundRobin' });
    const { aus } = await platzierung({}, undefined, generateFullSchedule(tournament, 'de'), tournament);

    expect(aus.satz).toEqual([SATZ_LETZTES]);
    expect(aus.platzNummern).toEqual(NUMMERN_8);
    expect(aus.linien).toBe(8);
    expect(aus.weitere).toEqual([]);
  });

  it('@BM-046 Gruppen ohne Finalrunde (finalsConfig.preset none): Satz „nach dem letzten Spiel“, Schreiblinie je Team', async () => {
    const tournament = hallencupTournament({
      finalsConfig: { preset: 'none' },
      finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    });
    const { aus } = await platzierung({}, undefined, generateFullSchedule(tournament, 'de'), tournament);

    expect(aus.satz).toEqual([SATZ_LETZTES]);
    expect(aus.platzNummern).toEqual(NUMMERN_8);
    expect(aus.linien).toBe(8);
    expect(aus.weitere).toEqual([]);
  });

  it('@DR-009 mit Finalrunde steht nirgends „nach dem letzten Spiel“', async () => {
    const { aus } = await platzierung();

    expect(aus.satz).not.toContain(SATZ_LETZTES);
  });

  it('@DR-005 blank = offen: Fassung zum Ausfüllen mit Ranking und Abschluss zeigt Satz und Linien, keine Namen', async () => {
    const { aus } = await platzierung({ edition: 'blank', ranking: ENDSTAND, closed: true });

    expect(aus.satz).toEqual([SATZ_FINALE]);
    expect(aus.platzNummern).toEqual(NUMMERN_8);
    expect(aus.linien).toBe(8);
    expect(aus.weitere).toEqual([]);
  });

  it('@DR-009 sechs Teams: sechs Schreiblinien (n = Zahl der Teams, nicht nur ausgespielte Plätze)', async () => {
    const teams = HALLENCUP_TEAMS.slice(0, 6);
    const tournament = hallencupTournament({ teams, numberOfTeams: 6 });
    const { aus } = await platzierung({}, undefined, generateFullSchedule(tournament, 'de'), tournament);

    expect(aus.platzNummern).toEqual(['1.', '2.', '3.', '4.', '5.', '6.']);
    expect(aus.linien).toBe(6);
  });
});

describe('@DR-009 Platzierung nach dem Abschluss', () => {
  it('@DR-009 final: alle 8 Plätze mit Teamnamen in der Reihenfolge des gespeicherten Endstands', async () => {
    const { aus } = await platzierung({ ranking: ENDSTAND, closed: true }, HALLENCUP_STANDINGS);

    expect(aus.satz).toEqual([]);
    expect(aus.platzNummern).toEqual(NUMMERN_8);
    expect(aus.weitere.map(w => w.str)).toEqual(ENDSTAND_NAMEN);
  });

  it('@DR-009 final: geteilte Plätze 5, 5, 7 werden genau so gedruckt, ohne „6.“ (Platznummer aus place, nicht aus der Position)', async () => {
    const plaetze = [1, 2, 3, 4, 5, 5, 7, 8];
    const ranking = ENDSTAND.map((e, i) => ({ ...e, place: plaetze[i] }));
    const { aus } = await platzierung({ ranking, closed: true });

    expect(aus.platzNummern).toEqual(['1.', '2.', '3.', '4.', '5.', '5.', '7.', '8.']);
    expect(aus.platzNummern).not.toContain('6.');
    expect(aus.weitere.map(w => w.str)).toEqual(ENDSTAND_NAMEN);
  });

  it('@DR-009 final: Gegenbeispiel – die Punkte-Reihenfolge der Standings taucht nicht auf', async () => {
    const { aus } = await platzierung({ ranking: ENDSTAND, closed: true }, HALLENCUP_STANDINGS);
    const nachPunkten = [...HALLENCUP_STANDINGS]
      .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)
      .map(s => s.team.name);

    expect(nachPunkten).not.toEqual(ENDSTAND_NAMEN);
    expect(aus.weitere.map(w => w.str)).not.toEqual(nachPunkten);
  });

  it('@DR-001 final: Teamnamen mindestens 12 pt', async () => {
    const { aus } = await platzierung({ ranking: ENDSTAND, closed: true });

    for (const w of aus.weitere) {
      expect(w.size, w.str).toBeGreaterThanOrEqual(printLimits.teamPt - SIZE_TOL);
    }
  });

  it('@DR-009 final: unvollständiger Endstand (weniger Einträge als Teams) bleibt offen', async () => {
    const { aus } = await platzierung({ ranking: ENDSTAND.slice(0, 4), closed: true });

    expect(aus.satz).toEqual([SATZ_FINALE]);
    expect(aus.weitere).toEqual([]);
  });
});

describe('@DR-009 Platzierung zweispaltig', () => {
  const nummernDer = (page: LayoutPage) =>
    page.texts.filter(t => /^\d+\.$/.test(t.str.trim())).sort((a, b) => Number.parseInt(a.str, 10) - Number.parseInt(b.str, 10));

  it('Plätze 1–4 links, 5–8 rechts, gleiche Zeilen nebeneinander (x-Positionen)', async () => {
    const { pages } = await platzierung();
    const nr = nummernDer(pages[pages.length - 1]);
    const [links, rechts] = [nr.slice(0, 4), nr.slice(4)];

    expect(nr.map(t => t.str.trim())).toEqual(NUMMERN_8);
    for (const t of links) {expect(t.x + t.w, t.str).toBeCloseTo(links[0].x + links[0].w, 0);}
    for (const t of rechts) {expect(t.x + t.w, t.str).toBeCloseTo(rechts[0].x + rechts[0].w, 0);}
    expect(rechts[0].x).toBeGreaterThan(links[0].x + pageGeometry('a4', 'portrait').contentWidth / 2 - printMetrics.placeNumberWidth);
    links.forEach((t, i) => expect(rechts[i].y, `Zeile ${i + 1}`).toBeCloseTo(t.y, 1));
  });

  it('Zeilenhöhe mindestens der Token (und der Token mindestens 8 mm)', async () => {
    const { pages } = await platzierung();
    const links = nummernDer(pages[pages.length - 1]).slice(0, 4);

    expect(printMetrics.placeRowHeight).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < links.length; i++) {
      expect(links[i].y - links[i - 1].y).toBeGreaterThanOrEqual(printMetrics.placeRowHeight - SIZE_TOL);
    }
  });

  it('final: zweispaltig mit Teamnamen, jede Spalte hält ihre Namen im eigenen Bereich', async () => {
    const { pages } = await platzierung({ ranking: ENDSTAND, closed: true });
    const seite = pages[pages.length - 1];
    const geo = pageGeometry('a4', 'portrait');
    const zeilen = seite.texts.filter(t => /^\d+\. /.test(t.str.trim()));

    expect(zeilen).toHaveLength(8);
    const mitte = geo.left + geo.contentWidth / 2;
    expect(zeilen.filter(t => t.x < mitte)).toHaveLength(4);
    for (const t of zeilen.filter(t => t.x < mitte)) {expect(t.x + t.w, t.str).toBeLessThan(mitte);}
  });

  it('@BM-021 final: ein 50-Zeichen-Name wird umbrochen, nie gekürzt (≤ 3 Zeilen, alle Wörter, keine Überlappung)', async () => {
    const lang = 'Sportverein Blau-Weiss Hintertupfingen Jugend e.V.';
    const ranking = ENDSTAND.map((e, i) => (i === 0 ? { ...e, team: { ...e.team, name: lang } } : e));
    const { pages } = await platzierung({ ranking, closed: true });
    const seite = pages[pages.length - 1];
    const geo = pageGeometry('a4', 'portrait');
    const mitte = geo.left + geo.contentWidth / 2;
    const titel = seite.texts.find(t => ohneNummer(t.str) === 'Platzierung');
    const links = seite.texts.filter(t => titel && t.y > titel.y && t.x < mitte && !/^Seite \d/.test(t.str.trim()) && t.str.trim() !== '' && ohneNummer(t.str) !== 'Platzierung');
    const ersteZeile = links.filter(t => t.y < (links.find(x => /^\d+\./.test(x.str.trim()) && x.str.trim().startsWith("2."))?.y ?? Infinity) - SIZE_TOL);
    const gesamt = ersteZeile.map(t => t.str.trim()).join(' ');

    expect(lang.length).toBe(50);
    for (const wort of lang.split(' ')) {expect(gesamt, wort).toContain(wort);}
    expect(new Set(ersteZeile.map(t => Math.round(t.y))).size).toBeLessThanOrEqual(3);
    expect(new Set(ersteZeile.map(t => Math.round(t.y))).size).toBeGreaterThan(1);
    for (const t of seite.texts.filter(t => titel && t.y > titel.y && t.x < mitte && t.str.trim() !== '' && !/^Seite \d/.test(t.str.trim()))) {
      expect(t.x + t.w, t.str).toBeLessThan(mitte);
    }
    // Zeilenpaar bleibt gleich hoch: Platz 5 (rechts) steht auf der Höhe von Platz 1 (links)
    const fuenf = seite.texts.find(t => t.str.trim().startsWith("5."));
    const eins = seite.texts.find(t => t.str.trim().startsWith("1."));
    expect(fuenf?.y).toBeCloseTo(eins?.y ?? -1, 1);
  });

  it('@BM-021 final: 50-Zeichen-Name auf Platz 5 (rechts): Paar 1/5 gleich hoch, „2.“ unter der letzten Namenszeile, nichts überlappt', async () => {
    const lang = 'Sportverein Blau-Weiss Hintertupfingen Jugend e.V.';
    const ranking = ENDSTAND.map((e, i) => (i === 4 ? { ...e, team: { ...e.team, name: lang } } : e));
    const { pages } = await platzierung({ ranking, closed: true });
    const seite = pages[pages.length - 1];
    const geo = pageGeometry('a4', 'portrait');
    const mitte = geo.left + geo.contentWidth / 2;
    const titel = seite.texts.find(t => ohneNummer(t.str) === 'Platzierung');
    if (!titel) {throw new Error('Überschrift fehlt');}
    const liste = seite.texts.filter(t => t.y > titel.y && t.str.trim() !== '' && !/^Seite \d/.test(t.str.trim()));
    const platz = (n: number) => liste.find(t => new RegExp(`^${n}\\.`).test(t.str.trim()));
    const [eins, zwei, fuenf, sechs] = [platz(1), platz(2), platz(5), platz(6)];
    if (!eins || !zwei || !fuenf || !sechs) {throw new Error('Platzzeilen fehlen');}
    const namenRechts = liste.filter(t => t.x > mitte && t.y >= fuenf.y - SIZE_TOL && t.y < sechs.y - SIZE_TOL);
    const letzteZeile = Math.max(...namenRechts.map(t => t.y));

    expect(new Set(namenRechts.map(t => Math.round(t.y))).size).toBeGreaterThan(1);
    expect(new Set(namenRechts.map(t => Math.round(t.y))).size).toBeLessThanOrEqual(3);
    expect(namenRechts.map(t => t.str.trim()).join(' ')).toContain('Hintertupfingen');
    expect(fuenf.y).toBeCloseTo(eins.y, 1);
    expect(zwei.y - letzteZeile).toBeGreaterThanOrEqual(printMetrics.placeRowHeight - SIZE_TOL);
    for (const t of namenRechts) {expect(t.x + t.w, t.str).toBeLessThanOrEqual(geo.left + geo.contentWidth + SIZE_TOL);}
    for (const t of liste.filter(t => t.x < mitte)) {expect(t.x + t.w, t.str).toBeLessThan(mitte);}
  });

  it('liegt auf der Finalseite unter der Finaltabelle, ohne sie zu überlappen, und über dem Seitenende', async () => {
    const { pages } = await platzierung();
    const geo = pageGeometry('a4', 'portrait');
    const seite = pages[pages.length - 1];
    const titel = seite.texts.find(t => ohneNummer(t.str) === 'Platzierung');
    if (!titel) {throw new Error('Überschrift fehlt');}
    const darueber = [...seite.lines.map(l => l.y1), ...seite.rects.map(r => r.y + r.h)].filter(y => y < titel.y);
    const unterkanteDarueber = Math.max(...darueber);

    expect(seite.texts.some(t => t.str.trim() === 'Finale')).toBe(true);
    expect(titel.y - titel.size * printUnit.mmPerPt * printFont.ascentEm).toBeGreaterThanOrEqual(unterkanteDarueber + printGap.sectionGap - SIZE_TOL);
    for (const t of nummernDer(seite)) {expect(t.y).toBeLessThanOrEqual(geo.bottom);}
  });

  it('80 Teams (40 Zeilen) brechen nur zwischen Zeilen um: jede Nummer hat ihre Linie auf derselben Seite', async () => {
    const teams = Array.from({ length: 80 }, (_, i) => ({ id: testUuid(i), name: `Team ${i + 1}`, group: `G${Math.floor(i / 10)}` }));
    const tournament = hallencupTournament({ teams, numberOfTeams: 80, numberOfGroups: 8 });
    // 8 Gruppen: seit A-12a nur noch als gespeichertes Turnier (Lesepfad), der Generator legt es nicht mehr an
    const { pages } = await platzierung({}, undefined, storedSchedule(tournament, 'de'), tournament);
    const geo = pageGeometry('a4', 'portrait');
    const mitNummern = pages.filter(p => nummernDer(p).length > 0 && p.texts.some(t => t.str.trim() !== '' && /^\d+\.$/.test(t.str.trim())));
    const nummern = mitNummern.flatMap(p => nummernDer(p).map(t => ({ page: p, t })));

    expect(nummern.length).toBe(80);
    expect(mitNummern.length).toBeGreaterThanOrEqual(2);
    for (const { page, t } of nummern) {
      const hat = page.lines.some(l => Math.abs(l.y1 - l.y2) < FLAT_TOL && Math.abs(l.y1 - t.y) < 4 && Math.abs(l.x2 - l.x1) >= LINE_MIN_LENGTH);
      expect(hat, `Linie zu ${t.str}`).toBe(true);
      expect(t.y).toBeLessThanOrEqual(geo.bottom);
    }
  });
});
