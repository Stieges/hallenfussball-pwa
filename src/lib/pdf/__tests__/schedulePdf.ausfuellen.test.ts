/**
 * B-28 C6 – Fassung „Spielplan ohne Ergebnisse“ im fertigen PDF (pdfjs): @DR-005 (Zeilen 1–3: keine Ergebnisse, keine
 * Tabellenwerte, keine feststehenden Finalteams), @BM-052 (Kicker), @DR-002 (gleiche Seitenaufteilung wie „Spielplan“),
 * @DR-018 (Sichtbarkeit), @DR-009 (eine Gruppe ohne Finalrunde: Block mit Schreiblinien).
 * Pflichtfall: Tom druckt um 15:07; Spiel 11 steht 2:1, das Halbfinale 1 ist besetzt.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { printType } from '../../../design-tokens/print';
import { printAccentDefault, printFinals, printTableGrid, printWriteLine } from '../../../design-tokens/print-sheet';
import type { Team } from '../../../types/tournament';
import { pageGeometry } from '../layout';
import { buildSchedulePdf, type PDFExportOptions } from '../schedulePdf';
import { HALLENCUP_ID, HALLENCUP_STANDINGS, finalsMatches, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { readLayout, readMetadata, type LayoutPage } from './pdfjsLayout';
import { linienIn, mitStand, SIZE_TOL, TOL, textsIn, senkrecht, zeileVon } from './pdfScoreSupport';
import { translatorFor } from './pdfText';
import { squash } from './pdfjsText';
import { testUuid } from '../../../test/testIds';
import { teamSlot } from '../../../core/models/matchSlot';

const TOM = new Date(2026, 10, 14, 15, 7);
const ERGEBNIS = { 11: { scoreA: 2, scoreB: 1, matchStatus: 'finished' as const } };

/**
 * Halbfinale 1 mit festem Team, so wie die App es besetzt: `playoffResolver` setzt die Team-ID in den Slot, die Herkunft
 * des Platzes bleibt in `originA` (A-36a). Laut Generator ist Halbfinale 1 „Erster Gruppe A“ gegen „Zweiter Gruppe B“ (W8).
 */
function halbfinaleBesetzt(): { schedule: ReturnType<typeof hallencupSchedule>; nummer: number } {
  const tournament = hallencupTournament();
  const stand = mitStand(hallencupSchedule(tournament), tournament, ERGEBNIS);
  const hf = finalsMatches(stand.schedule).filter(m => m.finalType === undefined).sort((a, b) => a.matchNumber - b.matchNumber)[0];
  hf.homeTeam = 'FC Nord';
  hf.originalTeamA = HALLENCUP_ID.nord;
  hf.slotA = teamSlot(HALLENCUP_ID.nord, hf.originA);
  return { schedule: stand.schedule, nummer: hf.matchNumber };
}

async function seiten(edition: 'plan' | 'blank', options: Partial<PDFExportOptions> = {}, tournament = hallencupTournament()): Promise<{ pages: LayoutPage[]; nummer: number; bytes: Uint8Array }> {
  const { schedule, nummer } = halbfinaleBesetzt();
  const { doc } = await buildSchedulePdf({
    schedule,
    standings: HALLENCUP_STANDINGS,
    options: { locale: 'de', translate: translatorFor('de'), tournament, edition, now: TOM, includeScores: true, ...options },
  });
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  return { pages: await readLayout(bytes), nummer, bytes };
}

const ziffern = (texte: Array<{ str: string; size: number }>): string[] =>
  texte.filter(t => Math.abs(t.size - printType.result) <= SIZE_TOL && /^\d+$/.test(t.str.trim())).map(t => t.str.trim());
const tabellenSeite = (pages: LayoutPage[]): LayoutPage => {
  const seite = pages.find(p => p.texts.some(t => t.str.trim() === 'Gruppe A'));
  if (!seite) {throw new Error('Seite der Gruppentabellen fehlt');}
  return seite;
};

describe('@DR-005 @BM-052 Pflichtfall: Tom um 15:07, Spiel 11 steht 2:1, Halbfinale 1 besetzt', () => {
  it('@DR-005 oben im PDF steht „Spielplan“ am Anfang der Zeile unter dem Titel, wie in der Fassung mit Ergebnissen, ohne Zusatz', async () => {
    const { pages, bytes } = await seiten('blank');
    const meta = await readMetadata(bytes);

    expect(meta.title).toBe('Hallencup Nord – Spielplan');
    expect(pages[0].texts.some(t => t.str.startsWith('Spielplan · '))).toBe(true);
    expect(pages[0].texts.some(t => /zum ausfüllen|ohne ergebnisse/i.test(t.str))).toBe(false);
  });

  it('Spiel 11: keine Ergebnisziffer in der Zeile', async () => {
    const { pages } = await seiten('blank');

    expect(ziffern(textsIn(zeileVon(pages, 11)))).toEqual([]);
  });

  it('Gegenbeispiel: die Fassung „Spielplan“ derselben Fixture zeigt 2 und 1 bei Spiel 11', async () => {
    const { pages } = await seiten('plan');

    expect(ziffern(textsIn(zeileVon(pages, 11)))).toEqual(expect.arrayContaining(['2', '1']));
  });

  it('@DR-035 Gruppentabellen: alle 4 Teamnamen je Gruppe, ohne Zahl, mit Spalte „Tore“ aus „:“ und Kästchen mit grauem Raster', async () => {
    const { pages } = await seiten('blank');
    const seite = tabellenSeite(pages);
    const oben = seite.texts.find(t => t.str.trim() === 'Gruppe A')?.y ?? 0;
    const namen = ['FC Nord', 'SV Süd', 'DJK Berg', 'TuS Tal', 'TSV West', 'SC Ost', 'FC Mitte', 'SV Hof'];
    const tabelle = seite.texts.filter(t => t.y > oben - 1 && t.y < pageGeometry('a4', 'portrait').footRuleY);
    const grau = `#${printTableGrid.color.map(v => v.toString(16).padStart(2, '0')).join('')}`;

    for (const name of namen) {
      expect(seite.texts.some(t => t.str.trim() === name), name).toBe(true);
    }
    // keine Zahl in den Kästchen der Tabellen (von „Gruppe A“ bis unter die letzte Zeile)
    const ende = Math.max(...seite.texts.filter(t => namen.includes(t.str.trim())).map(t => t.y)) + 5;
    expect(tabelle.filter(t => /\d/.test(t.str) && t.y < ende).map(t => t.str)).toEqual([]);
    expect(seite.texts.filter(t => t.str.trim() === ':').length).toBeGreaterThanOrEqual(namen.length);
    const senkrechte = seite.lines.filter(senkrecht).filter(l => l.color.toLowerCase() === grau);
    expect(senkrechte.length).toBeGreaterThanOrEqual(2 * 9);
    expect(seite.lines.filter(l => l.color.toLowerCase() === grau).every(l => Math.abs(l.width - printTableGrid.stroke) < TOL)).toBe(true);
  });

  it('@DR-035 keine Streifen: nur der Kopf der Tabelle trägt die helle Fläche, die Zeilen sind weiß', async () => {
    const { pages } = await seiten('blank');
    const tint = printAccentDefault.tint;
    const nahe = (a: string, b: string): boolean => [1, 3, 5].every(i => Math.abs(Number.parseInt(a.slice(i, i + 2), 16) - Number.parseInt(b.slice(i, i + 2), 16)) <= 2);
    const seite = tabellenSeite(pages);
    const oben = seite.texts.find(t => t.str.trim() === 'Gruppe A')?.y ?? 0;
    const unten = seite.texts.find(t => t.str.trim() === 'SV Hof')?.y ?? 0;
    const gefuellt = seite.rects.filter(r => r.fill !== undefined && nahe(r.fill, tint) && r.w > 100 && r.y > oben - 6 && r.y < unten);

    expect(gefuellt).toHaveLength(2);
    expect(gefuellt.every(r => r.h < 8)).toBe(true);
  });

  it('@DR-035 unter den Tabellen steht keine Erklärung der Spaltenköpfe und keine zweite Wertungszeile (die Wertung steht im Kopf von Seite 1)', async () => {
    const { pages } = await seiten('blank');
    const text = pages.flatMap(p => p.texts.map(t => t.str.trim()));

    expect(text.some(t => t.startsWith('Wertung:'))).toBe(false);
    expect(squash(pages[0].texts.map(t => t.str).join(' '))).toContain(squash('Wertung: Punkte'));
    expect(text.some(t => /Platz\s*·\s*Sp/.test(t) || t.startsWith('Pl Platz'))).toBe(false);
  });

  it('kein Ausfüllhinweis über den Tabellen', async () => {
    const { pages } = await seiten('blank');

    expect(squash(pages.flatMap(p => p.texts.map(t => t.str)).join(' '))).not.toContain(squash('nach jedem Spiel'));
  });

  it('@DR-005 @DR-037 Halbfinale 1 (besetzt mit Team-ID): „1. Gruppe A“ aus der gespeicherten Herkunft klein UNTER der Namenslinie, ≥ 5 mm Schreibraum über ihr, nicht „FC Nord“', async () => {
    const { pages, nummer } = await seiten('blank');
    const zeile = zeileVon(pages, nummer);
    const herkunft = textsIn(zeile).find(t => t.str.trim() === '1. Gruppe A');
    const linien = linienIn(zeile, printFinals.cols.referee);

    expect(herkunft, 'Herkunft').toBeDefined();
    expect(Math.abs((herkunft?.size ?? 0) - printFinals.smallPt)).toBeLessThanOrEqual(SIZE_TOL);
    expect(textsIn(zeile).some(t => t.str.trim() === 'FC Nord')).toBe(false);
    const linie = linien.find(l => l.y1 < (herkunft?.y ?? -Infinity) && Math.min(l.x1, l.x2) < (herkunft?.x ?? 0) + 1);
    expect(linie, 'Namenslinie über der Herkunft').toBeDefined();
    // Die Herkunft steht unter der Linie; über der Linie bleiben bis zur Oberkante der Zeile mindestens 5 mm frei
    expect((herkunft?.y ?? 0) - (linie?.y1 ?? 0)).toBeGreaterThan(0);
    expect((herkunft?.y ?? 0) - (linie?.y1 ?? 0)).toBeLessThan(printWriteLine.minWriteSpace);
    const zebra = pages[zeile.index].rects.filter(r => r.w > 100 && r.y <= (linie?.y1 ?? 0) && r.y + r.h >= (linie?.y1 ?? 0));
    const oberkante = zebra.length > 0 ? Math.min(...zebra.map(r => r.y)) : zeile.nr.y - printFinals.baselineRise - printWriteLine.minWriteSpace;
    expect((linie?.y1 ?? 0) - oberkante).toBeGreaterThanOrEqual(printWriteLine.minWriteSpace - TOL);
  });

  it('fail-safe: fehlt die Herkunft am Spiel (Altdaten ohne `originA`, Slot ohne `resolvedFrom`), steht „noch offen“, nie der Name', async () => {
    const { schedule, nummer } = halbfinaleBesetzt();
    const hf = finalsMatches(schedule).find(m => m.matchNumber === nummer);
    if (hf) {
      hf.originA = undefined;
      hf.slotA = teamSlot(HALLENCUP_ID.nord);
    }
    const { doc } = await buildSchedulePdf({
      schedule, standings: HALLENCUP_STANDINGS,
      options: { locale: 'de', translate: translatorFor('de'), tournament: hallencupTournament(), edition: 'blank', now: TOM },
    });
    const texte = textsIn(zeileVon(await readLayout(new Uint8Array(doc.output('arraybuffer'))), nummer)).map(t => t.str.trim());

    expect(texte).toContain('noch offen');
    expect(texte).not.toContain('FC Nord');
  });

  it('A-36a: die gespeicherte Herkunft gilt auch, wenn die Turnierkonfiguration vom Plan abweicht (3 Gruppen eingestellt)', async () => {
    const { pages, nummer } = await seiten('blank', {}, hallencupTournament({ numberOfGroups: 3 }));
    const texte = textsIn(zeileVon(pages, nummer)).map(t => t.str.trim());

    expect(texte).toContain('1. Gruppe A');
    expect(texte).not.toContain('noch offen');
    expect(texte).not.toContain('FC Nord');
  });

  it('Gegenbeispiel: in der Fassung „Spielplan“ steht das besetzte Team „FC Nord“ im Halbfinale 1', async () => {
    const { pages, nummer } = await seiten('plan');

    expect(textsIn(zeileVon(pages, nummer)).some(t => t.str.trim() === 'FC Nord')).toBe(true);
  });

  it('gleiche Seitenaufteilung wie „Spielplan“: dieselbe Seitenzahl', async () => {
    const blank = await seiten('blank');
    const plan = await seiten('plan');

    expect(blank.pages).toHaveLength(plan.pages.length);
  });
});

describe('@DR-018 Sichtbarkeit gilt auch in der Fassung zum Ausfüllen', () => {
  it('@ZM-102 Gruppentabellen aus, Fassung „Spielplan“: besetztes Halbfinale 1 zeigt den Teamnamen „FC Nord“ ohne Herkunft; nur die offene Gegenseite ist „noch offen“', async () => {
    const { pages, nummer } = await seiten('plan', {}, hallencupTournament({ hideRankingsForPublic: true }));
    const texte = textsIn(zeileVon(pages, nummer)).map(t => t.str.trim());

    expect(texte).toContain('FC Nord');
    expect(texte.filter(t => t === 'noch offen'), 'genau die offene Gegenseite').toHaveLength(1);
    expect(texte.some(t => t.includes('1. Gruppe A')), 'keine Herkunftszeile des besetzten Platzes').toBe(false);
  });

  it('@ZM-102 Gegenbeispiel: ein offener Platz bleibt „noch offen“ (nur Halbfinale 1 ist besetzt), Sieger-Herkunft bleibt', async () => {
    const tournament = hallencupTournament({ hideRankingsForPublic: true });
    const { pages } = await seiten('plan', {}, tournament);
    const text = squash(pages.flatMap(p => p.texts.map(t => t.str)).join(' '));

    expect(text).toContain(squash('noch offen'));
    expect(text).toContain(squash('Sieger Spiel 13'));
  });

  it('@DR-018 Gruppentabellen aus, Fassung „zum Ausfüllen“: keine Tabelle, aber die Herkunft „1. Gruppe A“ unter der Linie und kein „noch offen“ in der Zeile', async () => {
    const { pages, nummer } = await seiten('blank', {}, hallencupTournament({ hideRankingsForPublic: true }));
    const zeile = zeileVon(pages, nummer);
    const texte = textsIn(zeile).map(t => t.str.trim());

    expect(pages.some(p => p.texts.some(t => t.str.trim() === 'Gruppe A'))).toBe(false);
    expect(texte).toContain('1. Gruppe A');
    expect(texte).toContain('2. Gruppe B');
    expect(texte).not.toContain('noch offen');
    expect(texte).not.toContain('FC Nord');
  });

  it('@DR-018 Gegenbeispiel: auch in den offenen Finalspielen steht in der Fassung zum Ausfüllen die Herkunft, nie „noch offen“', async () => {
    const { pages } = await seiten('blank', {}, hallencupTournament({ hideRankingsForPublic: true }));
    const text = squash(pages.flatMap(p => p.texts.map(t => t.str)).join(' '));

    expect(text).toContain(squash('Sieger Spiel 13'));
    expect(text).not.toContain(squash('noch offen'));
  });
});

describe('@DR-009 eine Gruppe ohne Finalrunde, Fassung zum Ausfüllen', () => {
  it('Block „Platzierung“ mit Schreiblinien, auch bei abgeschlossenem Turnier keine Teamnamen aus dem Endstand', async () => {
    const teams: Team[] = Array.from({ length: 4 }, (_, i) => ({ id: testUuid(i), name: `Team ${String.fromCharCode(65 + i)}`, group: undefined }));
    const tournament = hallencupTournament({ teams, numberOfTeams: 4, groupSystem: 'roundRobin', numberOfGroups: 1 });
    const { doc } = await buildSchedulePdf({
      schedule: generateFullSchedule(tournament, 'de'),
      standings: undefined,
      options: { locale: 'de', translate: translatorFor('de'), tournament, edition: 'blank', closed: true, ranking: teams.map((team, i) => ({ place: i + 1, team })), now: TOM },
    });
    const pages = await readLayout(new Uint8Array(doc.output('arraybuffer')));
    const texte = pages.flatMap(p => p.texts.map(t => t.str.trim()));

    expect(texte.some(t => t === 'Platzierung')).toBe(true);
    expect(texte.some(t => t.startsWith('Die Platzierung steht nach dem letzten Spiel fest'))).toBe(true);
    expect(texte.filter(t => t === '1.' || t === '4.')).toHaveLength(2);
  });
});
