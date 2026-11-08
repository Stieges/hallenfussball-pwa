/**
 * @DR-052 Das Endstand-PDF hat eine eigene Seite „Siegerehrung“: alle Plätze als gleichförmige schlichte Liste (kein Treppchen) und, wenn
 * Tore mit Rückennummer erfasst sind, die Torschützenliste Rang | Verein | Nr. | Tore. Dazu @DR-002 (Seiten „Seite x von y“ fortlaufend).
 * Gelesen aus dem fertigen PDF (pdfjs) mit den Daten des freigegebenen Mockups.
 */
import { describe, expect, it } from 'vitest';
import type { ScorerRow } from '../../../core/standings/finalStandings/types';
import type { TeamId } from '../../../core/models/schemas/MatchSlotSchema';
import { printCeremony } from '../../../design-tokens/print-endstand';
import { printMatchTable } from '../../../design-tokens/print-sheet';
import { printType } from '../../../design-tokens/print';
import { endstandHallencup, endstandNikolaus, endstandPages, HALLENCUP_PLAETZE, HALLENCUP_SCHUETZEN, istFett } from './endstandSupport';
import type { LayoutPage, LayoutText } from './pdfjsLayout';
import { HALLENCUP_ID } from './pdfFixture';

const TOL = 0.1;
const trim = (t: LayoutText): string => t.str.trim();
/** Seiten „Siegerehrung“: die Seiten, deren Kurzkopf mit „· Siegerehrung“ endet. */
const siegerSeiten = (pages: LayoutPage[]): LayoutPage[] => pages.filter(p => p.texts.some(t => trim(t).endsWith('· Siegerehrung')));
const titel = (page: LayoutPage, text: string): LayoutText | undefined => page.texts.find(t => trim(t) === text && Math.abs(t.size - printType.h2) < TOL);
/** Zeilen der Torschützenliste einer Seite: (Verein, Nr., Tore, Rang) von oben nach unten. */
function schuetzen(page: LayoutPage): Array<{ team: string; nr: string; tore: string; rang: string }> {
  const kopf = page.texts.find(t => trim(t) === 'Rang');
  const c = printCeremony.scorerCols;
  const x = { club: 15 + c.rank, nr: 15 + c.rank + c.club, goals: 15 + c.rank + c.club + c.number };
  const zeilen = page.texts.filter(t => trim(t) !== '' && kopf && t.y > kopf.y + 1 && t.y < 270 && Math.abs(t.size - printCeremony.scorerPt) < TOL && t.x < 15 + printCeremony.scorerWidth + 1 && !trim(t).startsWith("Außerdem"));
  const ys = [...new Set(zeilen.map(t => Math.round(t.y * 10)))].sort((a, b) => a - b);
  return ys.map(y => {
    const row = zeilen.filter(t => Math.round(t.y * 10) === y);
    const inRange = (from: number, to: number): string => row.find(t => t.x >= from - TOL && t.x < to - TOL)?.str.trim() ?? '';
    return { rang: inRange(15, x.club), team: inRange(x.club, x.nr), nr: inRange(x.nr, x.goals), tore: row.find(t => t.x >= x.goals)?.str.trim() ?? '' };
  });
}

describe('@DR-052 Seite „Siegerehrung“: Plätze als schlichte Liste', () => {
  it('eigene Seite am Ende, alle 8 Plätze in der Reihenfolge des Endstands', async () => {
    const pages = await endstandPages(endstandHallencup());
    const seite = siegerSeiten(pages);

    expect(seite).toHaveLength(1);
    expect(pages.at(-1)).toBe(seite[0]);
    const unter = titel(seite[0], 'Torschützen');
    const platz = titel(seite[0], 'Platzierung');
    expect(platz).toBeDefined();
    const namen = seite[0].texts.filter(t => platz && unter && t.y > platz.y && t.y < unter.y && trim(t) !== '' && Math.abs(t.size - printCeremony.placePt) < TOL && !/^\d+\.$/.test(trim(t)));
    expect(namen.map(trim)).toEqual(HALLENCUP_PLAETZE.map(entry => entry.team.name));
  });

  it('gleichförmig: Platznummern fett, Namen normal, jeder Platz in derselben Größe, kein Treppchen und keine Kästen', async () => {
    const [seite] = siegerSeiten(await endstandPages(endstandHallencup()));
    const oben = titel(seite, 'Torschützen')?.y ?? 0;
    const liste = seite.texts.filter(t => trim(t) !== '' && t.y < oben && t.y > (titel(seite, 'Platzierung')?.y ?? 0));
    const nummern = liste.filter(t => /^\d\.$/.test(trim(t)));

    expect(nummern.map(trim)).toEqual(['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.']);
    expect(liste.every(t => Math.abs(t.size - printCeremony.placePt) < TOL)).toBe(true);
    expect(nummern.every(t => istFett(seite, t))).toBe(true);
    expect(liste.filter(t => !/^\d\.$/.test(trim(t))).some(t => istFett(seite, t))).toBe(false);
    // Abstand der Zeilen gleich (keine hervorgehobenen Plätze 1 bis 3)
    const abstaende = nummern.slice(1).map((t, i) => t.y - nummern[i].y);
    expect(Math.max(...abstaende) - Math.min(...abstaende)).toBeLessThan(TOL);
    // keine hinterlegte Fläche und kein Rahmen im Bereich der Platzliste (nur der QR-Code ist schwarz gefüllt)
    expect(seite.rects.filter(r => r.fill !== '#000000' && r.y < oben)).toEqual([]);
    expect(Math.max(...seite.texts.filter(t => t.y < oben && t.y > 40).map(t => t.size))).toBeLessThanOrEqual(printType.h2 + TOL);
  });

  it('@DR-009 @DR-052 Nikolausturnier-Datensatz des Mockups (eine Gruppe, keine Finalrunde): Abschlusstabelle ohne Block „Platzierung“ darunter, danach die Siegerehrung mit allen 6 Plätzen, drei Seiten', async () => {
    const pages = await endstandPages(endstandNikolaus());
    const [seite] = siegerSeiten(pages);

    expect(pages).toHaveLength(3);
    expect(pages.at(-1)).toBe(seite);
    expect(titel(seite, 'Platzierung')).toBeDefined();
    expect(seite.texts.filter(t => /^\d\.$/.test(trim(t))).map(trim)).toEqual(['1.', '2.', '3.', '4.', '5.', '6.']);
    const tabelle = pages.find(p => p.texts.some(t => trim(t) === 'Abschlusstabelle'));
    expect(tabelle).toBeDefined();
    expect(tabelle?.texts.some(t => trim(t) === 'Platzierung')).toBe(false);
  });

  it('Seitenzahlen laufen fortlaufend „Seite x von y“ über alle vier Seiten (@DR-002)', async () => {
    const pages = await endstandPages(endstandHallencup());
    const zahlen = pages.map(p => p.texts.map(trim).find(t => /^Seite \d+ von \d+$/.test(t)));

    expect(zahlen).toEqual(['Seite 1 von 4', 'Seite 2 von 4', 'Seite 3 von 4', 'Seite 4 von 4']);
  });

  it('geteilte Plätze stehen mit ihrer gespeicherten Platzziffer (2., 2., 4.)', async () => {
    const fall = endstandNikolaus();
    const geteilt = { ...fall, ranking: fall.ranking.map((e, i) => ({ ...e, place: [1, 2, 2, 4, 5, 6][i] })) };
    const [seite] = siegerSeiten(await endstandPages(geteilt));

    expect(seite.texts.filter(t => /^\d\.$/.test(trim(t))).map(trim)).toEqual(['1.', '2.', '2.', '4.', '5.', '6.']);
  });
});

describe('@DR-052 Torschützenliste: Rang | Verein | Nr. | Tore', () => {
  it('Spaltenköpfe Rang, Verein, Nr., Tore; je Spieler eine Zeile in der Reihenfolge der Liste, ohne Namen', async () => {
    const [seite] = siegerSeiten(await endstandPages(endstandHallencup()));
    const kopf = seite.texts.filter(t => ['Rang', 'Verein', 'Nr.', 'Tore'].includes(trim(t)) && Math.abs(t.size - printMatchTable.headPt) < TOL).sort((a, b) => a.x - b.x);
    const zeilen = schuetzen(seite);
    const spieler = HALLENCUP_SCHUETZEN.filter((r): r is Extract<ScorerRow, { kind: 'player' }> => r.kind === 'player');

    expect(kopf.map(trim)).toEqual(['Rang', 'Verein', 'Nr.', 'Tore']);
    expect(titel(seite, 'Torschützen')).toBeDefined();
    expect(zeilen.map(z => z.team)).toEqual(spieler.map(r => r.teamName));
    expect(zeilen.map(z => z.nr)).toEqual(spieler.map(r => `#${r.number}`));
    expect(zeilen.map(z => z.tore)).toEqual(spieler.map(r => String(r.goals)));
  });

  it('Rückennummer fett mit Raute, Tore fett und rechtsbündig, Rang nur bei der ersten Zeile seiner Gruppe', async () => {
    const [seite] = siegerSeiten(await endstandPages(endstandHallencup()));
    const kopf = seite.texts.find(t => trim(t) === 'Rang');
    const daten = seite.texts.filter(t => kopf && t.y > kopf.y + 1 && t.y < 270 && Math.abs(t.size - printCeremony.scorerPt) < TOL);
    const nummern = daten.filter(t => /^#\d+$/.test(trim(t)));
    const rechterRand = 15 + printCeremony.scorerWidth - printCeremony.scorerInsetRight;
    const tore = daten.filter(t => t.x > 15 + printCeremony.scorerWidth - printCeremony.scorerCols.goals && /^\d$/.test(trim(t)));
    const raenge = daten.filter(t => t.x < 15 + printCeremony.scorerCols.rank && /^\d+\.$/.test(trim(t)));

    expect(nummern).toHaveLength(16);
    expect(nummern.every(t => istFett(seite, t))).toBe(true);
    expect(tore).toHaveLength(16);
    expect(tore.every(t => istFett(seite, t) && Math.abs(t.x + t.w - rechterRand) < TOL)).toBe(true);
    expect(raenge.map(trim)).toEqual(['1.', '3.', '9.']);
    expect(raenge.every(t => istFett(seite, t) && Math.abs(t.x + t.w / 2 - (15 + printCeremony.scorerCols.rank / 2)) < TOL)).toBe(true);
  });

  it('Zeilen abwechselnd hinterlegt, die erste Zeile weiß', async () => {
    const [seite] = siegerSeiten(await endstandPages(endstandHallencup()));
    const flaechen = seite.rects.filter(r => r.fill !== '#000000' && Math.abs(r.w - printCeremony.scorerWidth) < TOL && Math.abs(r.h - printCeremony.scorerRowHeight) < TOL).sort((a, b) => a.y - b.y);
    const erste = schuetzen(seite).length > 0 ? seite.texts.find(t => trim(t) === '#10') : undefined;

    expect(flaechen).toHaveLength(8);
    flaechen.slice(1).forEach((r, i) => expect(r.y - flaechen[i].y).toBeCloseTo(2 * printCeremony.scorerRowHeight, 1));
    expect((erste?.y ?? 0) < flaechen[0].y).toBe(true);
  });

  it('@DR-052 Fußnote „Außerdem: 2 Tore ohne Rückennummer · 1 Eigentor“ unter der Liste, wenn es solche Tore gibt', async () => {
    const [seite] = siegerSeiten(await endstandPages(endstandHallencup()));
    const note = seite.texts.find(t => trim(t).startsWith('Außerdem'));
    const letzte = Math.max(...seite.texts.filter(t => /^#\d+$/.test(trim(t))).map(t => t.y));

    expect(note && trim(note)).toBe('Außerdem: 2 Tore ohne Rückennummer · 1 Eigentor');
    expect((note?.y ?? 0) > letzte).toBe(true);
  });

  it('@DR-052 Fußnote in Einzahl und Mehrzahl: „1 Tor ohne Rückennummer · 2 Eigentore“', async () => {
    const fall = endstandHallencup({}, [
      ...HALLENCUP_SCHUETZEN.filter(r => r.kind === 'player'),
      { kind: 'noNumber', rank: null, teamId: HALLENCUP_ID.nord as TeamId, teamName: 'FC Nord', goals: 1 },
      { kind: 'ownGoals', rank: null, teamId: HALLENCUP_ID.ost as TeamId, teamName: 'SC Ost', goals: 2 },
    ]);
    const [seite] = siegerSeiten(await endstandPages(fall));

    expect(seite.texts.map(trim)).toContain('Außerdem: 1 Tor ohne Rückennummer · 2 Eigentore');
  });

  it('@DR-052 ohne erfasste Torschützen: keine Liste und keine leere Überschrift (Nikolausturnier-Datensatz ohne Torschützen)', async () => {
    const [seite] = siegerSeiten(await endstandPages(endstandNikolaus()));
    const texte = seite.texts.map(trim);

    expect(texte).not.toContain('Torschützen');
    expect(texte).not.toContain('Rang');
    expect(texte.some(t => t.startsWith('Außerdem'))).toBe(false);
  });

  it('nur Sammelzeilen ohne einen Spieler mit Nummer: ebenfalls keine Liste', async () => {
    const [seite] = siegerSeiten(await endstandPages(endstandHallencup({}, HALLENCUP_SCHUETZEN.filter(r => r.kind !== 'player'))));

    expect(seite.texts.map(trim)).not.toContain('Torschützen');
    expect(seite.texts.some(t => trim(t).startsWith('Außerdem'))).toBe(false);
  });

  it('eine lange Liste läuft auf eine Folgeseite „Siegerehrung“ mit wiederholtem Spaltenkopf, die Fußnote steht am Ende', async () => {
    const viele: ScorerRow[] = Array.from({ length: 60 }, (_, i) => ({ kind: 'player', rank: i + 1, teamId: HALLENCUP_ID.nord as TeamId, teamName: 'FC Nord', number: i + 1, goals: 99 - i }));
    const pages = await endstandPages(endstandHallencup({}, [...viele, { kind: 'ownGoals', rank: null, teamId: HALLENCUP_ID.nord as TeamId, teamName: 'FC Nord', goals: 1 }]));
    const seiten = siegerSeiten(pages);

    expect(seiten.length).toBeGreaterThan(1);
    expect(seiten.every(p => p.texts.some(t => trim(t) === 'Rang'))).toBe(true);
    expect(seiten.flatMap(p => p.texts.filter(t => /^#\d+$/.test(trim(t)))).length).toBe(60);
    expect(seiten.slice(0, -1).some(p => p.texts.some(t => trim(t).startsWith('Außerdem')))).toBe(false);
    expect(seiten.at(-1)?.texts.some(t => trim(t).startsWith('Außerdem'))).toBe(true);
    expect(pages.map(p => p.texts.map(trim).find(t => /^Seite \d+ von \d+$/.test(t)))).toEqual(pages.map((_, i) => `Seite ${i + 1} von ${pages.length}`));
  });

  it('@DR-052 ohne Tore ohne Rückennummer und ohne Eigentore steht keine Fußnote', async () => {
    const [seite] = siegerSeiten(await endstandPages(endstandHallencup({}, HALLENCUP_SCHUETZEN.filter(r => r.kind === 'player'))));

    expect(seite.texts.some(t => trim(t).startsWith('Außerdem'))).toBe(false);
  });

  it('@DR-052 läuft eine Rang-Gruppe über den Seitenumbruch, beginnt die Folgeseite ohne Rang (Rang nur bei der ersten Zeile der Gruppe)', async () => {
    // 60 Spieler mit gleich vielen Toren: eine einzige Gruppe „1.“ über mehrere Seiten
    const gleich: ScorerRow[] = Array.from({ length: 60 }, (_, i) => ({ kind: 'player', rank: 1, teamId: HALLENCUP_ID.nord as TeamId, teamName: 'FC Nord', number: i + 1, goals: 2 }));
    const seiten = siegerSeiten(await endstandPages(endstandHallencup({}, gleich)));
    const raenge = (page: LayoutPage): string[] => page.texts.filter(t => trim(t) !== '' && t.x < 15 + printCeremony.scorerCols.rank && /^\d+\.$/.test(trim(t)) && t.size <= printCeremony.scorerPt + TOL && t.y > (page.texts.find(x => trim(x) === 'Rang')?.y ?? 0)).map(trim);

    expect(seiten.length).toBeGreaterThan(1);
    expect(raenge(seiten[0])).toEqual(['1.']);
    expect(raenge(seiten[1])).toEqual([]);
  });

  it('Gegenbeispiel: der Spielplan (nicht der Endstand) hat keine Seite „Siegerehrung“', async () => {
    const pages = await endstandPages(endstandHallencup(), { edition: 'plan' });

    expect(siegerSeiten(pages)).toHaveLength(0);
    expect(pages.flatMap(p => p.texts).map(trim)).not.toContain('Torschützen');
  });

  it('englisch: „Awards ceremony“, „Top scorers“, „Rank“, „Club“', async () => {
    const { translatorFor } = await import('./pdfText');
    const pages = await endstandPages(endstandHallencup(), { locale: 'en', translate: translatorFor('en') });
    const texte = pages.flatMap(p => p.texts).map(trim);

    expect(texte.some(t => t.endsWith('· Awards ceremony'))).toBe(true);
    expect(texte).toEqual(expect.arrayContaining(['Top scorers', 'Rank', 'Club']));
    expect(texte).toContain('Also: 2 goals without shirt number · 1 own goal');
  });
});
