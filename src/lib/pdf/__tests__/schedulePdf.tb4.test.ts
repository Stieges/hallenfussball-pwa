/**
 * Paket TB, Task TB-4: Spielplan-PDF, Gruppentabellen und Abschlusstabelle nach BFV privat (@W2A-049 PDF, @BM-009,
 * @W2A-047/@ET-055 Platzziffer, @ET-020, @ET-029, @W2A-063 geteilter Gruppenplatz). Das PDF übernimmt Reihenfolge und
 * Platzziffer der Rechnung (`rankGroup`), es ordnet nicht selbst nach Punkten und Tordifferenz (R5, M12).
 * Daten: Plan v2 Abschnitt 6. Gelesen aus dem Mitschnitt von `exportScheduleToPDF`.
 */
import { describe, it, expect, vi } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { calculateStandings, calculateStandingsPerGroup, getMergedFinalRanking } from '../../../utils/calculations';
import type { Tournament } from '../../../types/tournament';
import { DATA, GD_FIRST_ORDER, NAME } from '../../../core/standings/__tests__/fixtures';
import { DATEN_029, DATEN_063, mitGleichemPlatz, zweiGruppenWaging } from '../../../core/standings/__tests__/tb4Kit';
import { jgj } from '../../../core/standings/__tests__/decisionTestKit';
import { flatText, renderSchedulePdf } from './pdfText';

vi.mock('jspdf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('jspdf')>();
  const { capturingJsPdf } = await import('./pdfCapture');
  return { ...mod, default: capturingJsPdf(mod.default), jsPDF: capturingJsPdf(mod.jsPDF) };
});

/** Textstücke der Tabelle „Tabelle – Gruppe A“ (bis zur Tabelle der Gruppe B). */
function tabelleGruppeA(text: string[]): string[] {
  const von = text.findIndex((t) => t.endsWith('Tabelle – Gruppe A'));
  const bis = text.findIndex((t) => t.endsWith('Tabelle – Gruppe B'));
  expect(von, 'Titel „Tabelle – Gruppe A“').toBeGreaterThan(-1);
  return text.slice(von, bis > von ? bis : undefined);
}
/** Platzziffer (Zelle vor dem Teamnamen) in einem Tabellenabschnitt. */
const ziffer = (abschnitt: string[], name: string): string | undefined => abschnitt[abschnitt.indexOf(name) - 1];

async function gruppenPdf(tournament: Tournament): Promise<string[]> {
  const schedule = generateFullSchedule(tournament);
  const pdf = await renderSchedulePdf(schedule, calculateStandingsPerGroup(tournament), { locale: 'de', includeStandings: true, tournament });
  return flatText(pdf);
}

describe('TB-4 PDF Gruppentabellen', () => {
  it('@W2A-049 @BM-009 PDF: Gruppe A zeigt DJK Kammer vor TSV Waging rot (direktes Spiel), nicht nach Tordifferenz', async () => {
    const abschnitt = tabelleGruppeA(await gruppenPdf(zweiGruppenWaging(DATA.ET_056)));
    expect(abschnitt.indexOf(NAME.K), 'Kammer steht in der Tabelle').toBeGreaterThan(-1);
    expect(abschnitt.indexOf(NAME.K)).toBeLessThan(abschnitt.indexOf(NAME.R));
    expect([ziffer(abschnitt, NAME.K), ziffer(abschnitt, NAME.R)]).toEqual(['1', '2']);
  });

  it('@W2A-049 Gegenbeispiel PDF: bei „Punkte, Tordifferenz, Tore, direkter Vergleich“ steht Waging rot vor Kammer', async () => {
    const abschnitt = tabelleGruppeA(await gruppenPdf(zweiGruppenWaging(DATA.ET_056, { placementLogic: GD_FIRST_ORDER })));
    expect(abschnitt.indexOf(NAME.R)).toBeLessThan(abschnitt.indexOf(NAME.K));
  });

  it('@W2A-047 @ET-055 PDF: offener Gleichstand zeigt die gemeinsame Platzziffer 3, 3, dann 5; mitten in der Gruppe 2, 2, 4', async () => {
    const fertig = tabelleGruppeA(await gruppenPdf(zweiGruppenWaging(DATA.ET_055)));
    expect([ziffer(fertig, NAME.R), ziffer(fertig, NAME.K), ziffer(fertig, NAME.N)]).toEqual(['3', '3', '5']);

    const offen = tabelleGruppeA(await gruppenPdf(zweiGruppenWaging(DATA.ET_055, { open: ['M–U', 'U–N', 'N–O'] })));
    expect([ziffer(offen, NAME.R), ziffer(offen, NAME.K), ziffer(offen, NAME.U)]).toEqual(['2', '2', '4']);
  });
});

/** Abschlusstabelle (Jeder gegen jeden, abgeschlossen): Endstand aus `getMergedFinalRanking` als gespeicherte Rangfolge. */
async function abschlusstabelle(tournament: Tournament): Promise<string[]> {
  const overall = calculateStandings(tournament.teams, tournament.matches, tournament);
  const { ranking } = getMergedFinalRanking(tournament.teams, tournament.matches, overall, tournament);
  const schedule = generateFullSchedule(tournament);
  const pdf = await renderSchedulePdf(schedule, overall, {
    locale: 'de', includeStandings: true, tournament, edition: 'final', closed: true, closedAt: new Date('2026-12-06T16:00:00Z'),
    ranking: ranking.map((p) => ({ place: p.rank, team: p.team })),
  });
  const text = flatText(pdf);
  const von = text.findIndex((t) => t.includes('Abschlusstabelle'));
  expect(von, 'Titel „Abschlusstabelle“').toBeGreaterThan(-1);
  return text.slice(von);
}

describe('TB-4 PDF Abschlusstabelle mit geteiltem Gruppenplatz (Variante C)', () => {
  it('@ET-020 drei Teams lassen den gleichen Platz: Abschlusstabelle 1, 2, 2, 2, 5; Gegenbeispiel ohne „gleichen Platz lassen“ teilt nicht', async () => {
    const mit = await abschlusstabelle(await mitGleichemPlatz(jgj('WOUMNB', DATA.W2A_044), ['U', 'W', 'O']));
    expect([NAME.M, NAME.U, NAME.W, NAME.O, NAME.B].map((n) => ziffer(mit, n))).toEqual(['1', '2', '2', '2', '5']);

    const ohne = await abschlusstabelle(jgj('WOUMNB', DATA.W2A_044));
    expect([NAME.M, NAME.W, NAME.O, NAME.U, NAME.B].map((n) => ziffer(ohne, n))).toEqual(['1', '2', '3', '4', '5']);
  });

  it('@ET-029 Nord und Ufer lassen den gleichen Platz 2: 1, 2, 2, 4', async () => {
    const mit = await abschlusstabelle(await mitGleichemPlatz(jgj('MNUWOB', DATEN_029), ['N', 'U']));
    expect([NAME.M, NAME.N, NAME.U, NAME.W].map((n) => ziffer(mit, n))).toEqual(['1', '2', '2', '4']);
  });

  it('@W2A-063 Waging blau und Petting lassen den gleichen Platz 5: beide 5', async () => {
    const mit = await abschlusstabelle(await mitGleichemPlatz(jgj('MNUWXP', DATEN_063), ['X', 'P']));
    expect([NAME.X, NAME.P].map((n) => ziffer(mit, n))).toEqual(['5', '5']);
    const ohne = await abschlusstabelle(jgj('MNUWXP', DATEN_063));
    expect([NAME.X, NAME.P].map((n) => ziffer(ohne, n))).toEqual(['5', '6']);
  });
});
