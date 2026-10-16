/**
 * B-28 C6 – Fassung „Spielplan zum Ausfüllen“ im fertigen PDF (pdfjs): @DR-005 (Zeilen 1–3: keine Ergebnisse, keine
 * Tabellenwerte, keine feststehenden Finalteams), @BM-052 (Kicker), @DR-002 (gleiche Seitenaufteilung wie „Spielplan“),
 * @DR-018 (Sichtbarkeit), @DR-009 (eine Gruppe ohne Finalrunde: Block mit Schreiblinien).
 * Pflichtfall: Tom druckt um 15:07; Spiel 11 steht 2:1, das Halbfinale 1 ist besetzt.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { printBox, printColors, printType } from '../../../design-tokens/print';
import type { Team } from '../../../types/tournament';
import { pageGeometry } from '../layout';
import { buildSchedulePdf, type PDFExportOptions } from '../schedulePdf';
import { HALLENCUP_STANDINGS, finalsMatches, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { readLayout, type LayoutPage } from './pdfjsLayout';
import { mitStand, SIZE_TOL, TOL, textsIn, waagerecht, senkrecht, zeileVon } from './pdfScoreSupport';
import { translatorFor } from './pdfText';
import { squash } from './pdfjsText';

const TOM = new Date(2026, 10, 14, 15, 7);
const ERGEBNIS = { 11: { scoreA: 2, scoreB: 1, matchStatus: 'finished' as const } };

/**
 * Halbfinale 1 mit festem Team, so wie die App es besetzt: `playoffResolver` ersetzt den Platzhalter durch die Team-ID,
 * ein Herkunftsschlüssel steht nicht mehr im Spiel. Laut Generator ist Halbfinale 1 „Zweiter Gruppe A“ gegen „Erster Gruppe B“.
 */
function halbfinaleBesetzt(): { schedule: ReturnType<typeof hallencupSchedule>; nummer: number } {
  const tournament = hallencupTournament();
  const stand = mitStand(hallencupSchedule(tournament), tournament, ERGEBNIS);
  const hf = finalsMatches(stand.schedule).filter(m => m.finalType === undefined).sort((a, b) => a.matchNumber - b.matchNumber)[0];
  hf.homeTeam = 'FC Nord';
  hf.originalTeamA = 'team-nord';
  return { schedule: stand.schedule, nummer: hf.matchNumber };
}

async function seiten(edition: 'plan' | 'blank', options: Partial<PDFExportOptions> = {}, tournament = hallencupTournament()): Promise<{ pages: LayoutPage[]; nummer: number }> {
  const { schedule, nummer } = halbfinaleBesetzt();
  const { doc } = await buildSchedulePdf({
    schedule,
    standings: HALLENCUP_STANDINGS,
    options: { locale: 'de', translate: translatorFor('de'), tournament, edition, now: TOM, includeScores: true, ...options },
  });
  return { pages: await readLayout(new Uint8Array(doc.output('arraybuffer'))), nummer };
}

const ziffern = (texte: Array<{ str: string; size: number }>): string[] =>
  texte.filter(t => Math.abs(t.size - printType.result) <= SIZE_TOL && /^\d+$/.test(t.str.trim())).map(t => t.str.trim());
const tabellenSeite = (pages: LayoutPage[]): LayoutPage => {
  const seite = pages.find(p => p.texts.some(t => /Tabelle\s*–\s*Gruppe A/.test(t.str)));
  if (!seite) {throw new Error('Seite der Gruppentabellen fehlt');}
  return seite;
};

describe('@DR-005 @BM-052 Pflichtfall: Tom um 15:07, Spiel 11 steht 2:1, Halbfinale 1 besetzt', () => {
  it('Kicker „Spielplan zum Ausfüllen“', async () => {
    const { pages } = await seiten('blank');

    expect(pages[0].texts.some(t => t.str.trim().toLowerCase() === 'spielplan zum ausfüllen')).toBe(true);
  });

  it('Spiel 11: keine Ergebnisziffer in der Zeile', async () => {
    const { pages } = await seiten('blank');

    expect(ziffern(textsIn(zeileVon(pages, 11)))).toEqual([]);
  });

  it('Gegenbeispiel: die Fassung „Spielplan“ derselben Fixture zeigt 2 und 1 bei Spiel 11', async () => {
    const { pages } = await seiten('plan');

    expect(ziffern(textsIn(zeileVon(pages, 11)))).toEqual(expect.arrayContaining(['2', '1']));
  });

  it('Gruppentabellen: alle 4 Teamnamen je Gruppe, ohne Zahl, mit Spalte „Tore“ aus „:“ und senkrechten Linien', async () => {
    const { pages } = await seiten('blank');
    const seite = tabellenSeite(pages);
    const oben = seite.texts.find(t => /Tabelle\s*–\s*Gruppe A/.test(t.str))?.y ?? 0;
    const namen = ['FC Nord', 'SV Süd', 'DJK Berg', 'TuS Tal', 'TSV West', 'SC Ost', 'FC Mitte', 'SV Hof'];
    const gezaehlt = seite.texts.filter(t => t.y > oben - 1 && !t.str.includes('Tabelle') && !t.str.includes('Platzierung'));

    for (const name of namen) {
      expect(seite.texts.some(t => t.str.trim() === name), name).toBe(true);
    }
    expect(gezaehlt.filter(t => /\d/.test(t.str) && t.y < pageGeometry('a4', 'portrait').footRuleY).map(t => t.str)).toEqual([]);
    expect(seite.texts.filter(t => t.str.trim() === ':').length).toBeGreaterThanOrEqual(namen.length);
    expect(seite.lines.filter(senkrecht).length).toBeGreaterThanOrEqual(namen.length);
  });

  it('keine Streifen: nur der Tabellenkopf trägt das Raster, die leeren Zeilen sind weiß', async () => {
    const { pages } = await seiten('blank');
    const tint = `#${printColors.tint.map(v => v.toString(16).padStart(2, '0')).join('')}`;
    const gefuellt = tabellenSeite(pages).rects.filter(r => r.fill === tint);

    expect(gefuellt.length).toBeGreaterThan(0);
    expect(gefuellt.every(r => r.h < printBox.blankRow)).toBe(true);
  });

  it('Zeile „Wertung: …“ aus den Regeln steht unter den Tabellen (G72)', async () => {
    const { pages } = await seiten('blank');
    const seite = tabellenSeite(pages);
    const zeile = seite.texts.find(t => t.str.trim().startsWith('Wertung:'));
    const letzteTabelle = Math.max(...seite.texts.filter(t => ['SV Hof', 'FC Mitte', 'SC Ost', 'TSV West'].includes(t.str.trim())).map(t => t.y));

    expect(zeile, 'Zeile Wertung').toBeDefined();
    expect(zeile?.y ?? 0).toBeGreaterThan(letzteTabelle);
  });

  it('kein Ausfüllhinweis über den Tabellen', async () => {
    const { pages } = await seiten('blank');

    expect(squash(pages.flatMap(p => p.texts.map(t => t.str)).join(' '))).not.toContain(squash('nach jedem Spiel'));
  });

  it('Halbfinale 1 (besetzt mit Team-ID): „Zweiter Gruppe A“ aus der Turnierstruktur klein an der Oberkante, ≥ Token über der Schreiblinie, nicht „FC Nord“', async () => {
    const { pages, nummer } = await seiten('blank');
    const zeile = zeileVon(pages, nummer);
    const herkunft = textsIn(zeile).find(t => t.str.trim() === 'Zweiter Gruppe A');
    const linien = zeile.page.lines.filter(l => waagerecht(l) && l.y1 > zeile.top + TOL && l.y1 < zeile.bottom - TOL && Math.abs(l.x2 - l.x1) > 10);

    expect(herkunft, 'Herkunft').toBeDefined();
    expect(Math.abs((herkunft?.size ?? 0) - printType.origin)).toBeLessThanOrEqual(SIZE_TOL);
    expect(textsIn(zeile).some(t => t.str.trim() === 'FC Nord')).toBe(false);
    const linie = linien.find(l => l.y1 > (herkunft?.y ?? Infinity) && Math.min(l.x1, l.x2) < (herkunft?.x ?? 0) + 1);
    expect(linie, 'Linie unter der Herkunft').toBeDefined();
    // W2: Platz zum Schreiben zwischen Herkunft und Linie, die Herkunft sitzt oben in der Zelle
    expect((linie?.y1 ?? 0) - (herkunft?.y ?? 0)).toBeGreaterThanOrEqual(printBox.writeSpace - TOL);
    expect((herkunft?.y ?? Infinity) - zeile.top).toBeLessThan(printBox.writeSpace);
  });

  it('K1 fail-safe: lässt sich die Herkunft nicht bestimmen (Spiel nicht im Plan der Struktur), steht „noch offen“, nie der Name', async () => {
    const { schedule, nummer } = halbfinaleBesetzt();
    const hf = finalsMatches(schedule).find(m => m.matchNumber === nummer);
    if (hf) {hf.finalType = 'seventhEighth';}
    const { doc } = await buildSchedulePdf({
      schedule, standings: HALLENCUP_STANDINGS,
      options: { locale: 'de', translate: translatorFor('de'), tournament: hallencupTournament(), edition: 'blank', now: TOM },
    });
    const pages = await readLayout(new Uint8Array(doc.output('arraybuffer')));
    const texte = textsIn(zeileVon(pages, nummer)).map(t => t.str.trim());

    expect(texte).toContain('noch offen');
    expect(texte).not.toContain('FC Nord');
  });

  it('K1-R: Turnier mit 3 Gruppen bei unverändertem Plan – keine geratene Herkunft, „noch offen“', async () => {
    const { pages, nummer } = await seiten('blank', {}, hallencupTournament({ numberOfGroups: 3 }));
    const texte = textsIn(zeileVon(pages, nummer)).map(t => t.str.trim());

    expect(texte).toContain('noch offen');
    expect(texte.filter(t => t.includes('Gruppe A'))).toEqual([]);
    expect(texte).not.toContain('FC Nord');
  });

  it('K1-R: Runde stimmt nicht überein (Halbfinale gegen Viertelfinale) – „noch offen“', async () => {
    const { schedule, nummer } = halbfinaleBesetzt();
    const hf = finalsMatches(schedule).find(m => m.matchNumber === nummer);
    if (hf) {hf.phase = 'quarterfinal';}
    const { doc } = await buildSchedulePdf({
      schedule, standings: HALLENCUP_STANDINGS,
      options: { locale: 'de', translate: translatorFor('de'), tournament: hallencupTournament(), edition: 'blank', now: TOM },
    });
    const texte = textsIn(zeileVon(await readLayout(new Uint8Array(doc.output('arraybuffer'))), nummer)).map(t => t.str.trim());

    expect(texte).toContain('noch offen');
    expect(texte).not.toContain('Zweiter Gruppe A');
  });

  it('K1-R: das besetzte Team spielt nicht in der Gruppe der Herkunft – „noch offen“', async () => {
    const { schedule, nummer } = halbfinaleBesetzt();
    const hf = finalsMatches(schedule).find(m => m.matchNumber === nummer);
    if (hf) {hf.homeTeam = 'TSV West';}
    const { doc } = await buildSchedulePdf({
      schedule, standings: HALLENCUP_STANDINGS,
      options: { locale: 'de', translate: translatorFor('de'), tournament: hallencupTournament(), edition: 'blank', now: TOM },
    });
    const texte = textsIn(zeileVon(await readLayout(new Uint8Array(doc.output('arraybuffer'))), nummer)).map(t => t.str.trim());

    expect(texte).toContain('noch offen');
    expect(texte).not.toContain('Zweiter Gruppe A');
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
    expect(texte.some(t => t.includes('Zweiter Gruppe A')), 'keine Herkunftszeile des besetzten Platzes').toBe(false);
  });

  it('@ZM-102 Gegenbeispiel: ein offener Platz bleibt „noch offen“ (nur Halbfinale 1 ist besetzt), Sieger-Herkunft bleibt', async () => {
    const tournament = hallencupTournament({ hideRankingsForPublic: true });
    const { pages } = await seiten('plan', {}, tournament);
    const text = squash(pages.flatMap(p => p.texts.map(t => t.str)).join(' '));

    expect(text).toContain(squash('noch offen'));
    expect(text).toContain(squash('Sieger Halbfinale 1'));
  });

  it('@DR-018 Gruppentabellen aus, Fassung „zum Ausfüllen“: keine Tabelle, aber die Herkunft „Zweiter Gruppe A“ über der Linie und kein „noch offen“ in der Zeile', async () => {
    const { pages, nummer } = await seiten('blank', {}, hallencupTournament({ hideRankingsForPublic: true }));
    const zeile = zeileVon(pages, nummer);
    const texte = textsIn(zeile).map(t => t.str.trim());

    expect(pages.some(p => p.texts.some(t => /Tabelle\s*–\s*Gruppe/.test(t.str)))).toBe(false);
    expect(texte).toContain('Zweiter Gruppe A');
    expect(texte).toContain('Erster Gruppe B');
    expect(texte).not.toContain('noch offen');
    expect(texte).not.toContain('FC Nord');
  });

  it('@DR-018 Gegenbeispiel: auch in den offenen Finalspielen steht in der Fassung zum Ausfüllen die Herkunft, nie „noch offen“', async () => {
    const { pages } = await seiten('blank', {}, hallencupTournament({ hideRankingsForPublic: true }));
    const text = squash(pages.flatMap(p => p.texts.map(t => t.str)).join(' '));

    expect(text).toContain(squash('Sieger Halbfinale 1'));
    expect(text).not.toContain(squash('noch offen'));
  });
});

describe('@DR-009 eine Gruppe ohne Finalrunde, Fassung zum Ausfüllen', () => {
  it('Block „Platzierung“ mit Schreiblinien, auch bei abgeschlossenem Turnier keine Teamnamen aus dem Endstand', async () => {
    const teams: Team[] = Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, name: `Team ${String.fromCharCode(65 + i)}`, group: undefined }));
    const tournament = hallencupTournament({ teams, numberOfTeams: 4, groupSystem: 'roundRobin', numberOfGroups: 1 });
    const { doc } = await buildSchedulePdf({
      schedule: generateFullSchedule(tournament, 'de'),
      standings: undefined,
      options: { locale: 'de', translate: translatorFor('de'), tournament, edition: 'blank', closed: true, ranking: teams.map((team, i) => ({ place: i + 1, team })), now: TOM },
    });
    const pages = await readLayout(new Uint8Array(doc.output('arraybuffer')));
    const texte = pages.flatMap(p => p.texts.map(t => t.str.trim()));

    expect(texte.some(t => /^\d+\s*Platzierung$/.test(t))).toBe(true);
    expect(texte.some(t => t.startsWith('Die Platzierung steht nach dem letzten Spiel fest'))).toBe(true);
    expect(texte.filter(t => t === '1.' || t === '4.')).toHaveLength(2);
  });
});
