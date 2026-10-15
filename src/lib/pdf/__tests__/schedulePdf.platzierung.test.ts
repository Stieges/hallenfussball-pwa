/**
 * B-28 C2 – Platzierung (@DR-009, @DR-005, @BM-016, @BM-046). Gelesen aus dem fertigen PDF (pdfjs).
 * Offen (auch Fassung zum Ausfüllen): Satz und je Team eine nummerierte Schreiblinie, keine Teamnamen, keine Punkte.
 * Nach dem Abschluss (`final`): alle Plätze mit Teamnamen in der Reihenfolge des gespeicherten Endstands.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { printLimits } from '../../../design-tokens/print';
import { buildSchedulePdf, type PDFExportOptions } from '../schedulePdf';
import type { RankEntry } from '../placement';
import { HALLENCUP_STANDINGS, HALLENCUP_TEAMS, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { readLayout, type LayoutPage } from './pdfjsLayout';
import { translatorFor } from './pdfText';

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
  const index = pages.map(p => p.texts.some(t => t.str.trim() === 'Platzierung')).lastIndexOf(true);
  const letzte = pages[index];
  const titel = letzte?.texts.find(t => t.str.trim() === 'Platzierung');
  if (!titel) {throw new Error('Überschrift „Platzierung“ fehlt');}
  const kurzkopf = [tournament.title, tournament.ageClass];
  const folgeseiten = pages.slice(index + 1);
  const darunter = [
    ...letzte.texts.filter(t => t.y > titel.y),
    ...folgeseiten.flatMap(p => p.texts),
  ].filter(t => t.str.trim() !== '' && !kurzkopf.includes(t.str.trim()));
  const zeilen = darunter; // Reihenfolge des Dokuments (Seiten nacheinander)
  const sätze = zeilen.filter(t => t.str.trim().startsWith('Die Platzierung'));
  // pdfjs fasst Platznummer und Teamname einer Zeile zu einem Textstück zusammen („1. SC Ost“)
  const platzZeilen = zeilen.filter(t => /^\d+\./.test(t.str.trim()));
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
  ].filter(l => Math.abs(l.y1 - l.y2) < FLAT_TOL && Math.abs(l.x2 - l.x1) >= LINE_MIN_LENGTH).length;
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

describe('@DR-009 Seitenumbruch der Platzierung', () => {
  it('Liste bricht nur zwischen Zeilen: jede Nummer hat ihre Linie auf derselben Seite, 24 Teams', async () => {
    const teams = Array.from({ length: 24 }, (_, i) => ({ id: `t${i}`, name: `Team ${i + 1}`, group: i < 12 ? 'A' : 'B' }));
    const tournament = hallencupTournament({ teams, numberOfTeams: 24 });
    const { pages } = await platzierung({}, undefined, generateFullSchedule(tournament, 'de'), tournament);
    const nummern = pages.flatMap(p => p.texts.filter(t => /^\d+\.$/.test(t.str.trim())).map(t => ({ page: p, t })));

    expect(nummern.length).toBeGreaterThanOrEqual(24);
    for (const { page, t } of nummern.slice(-24)) {
      const hat = page.lines.some(l => Math.abs(l.y1 - l.y2) < FLAT_TOL && Math.abs(l.y1 - t.y) < 4 && Math.abs(l.x2 - l.x1) >= LINE_MIN_LENGTH);
      expect(hat, `Linie zu ${t.str}`).toBe(true);
    }
  });
});
