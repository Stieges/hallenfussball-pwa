/**
 * B-28 C1 (a4-1), T7b: Schreiblinien der Finalrunde je Zustand und je Regel der Runde, gelesen aus dem fertigen PDF (pdfjs).
 * Szenarien: @DR-004 (Linien zum Eintragen), @DR-019 (laufend wie ohne Ergebnis, ausgefallen ohne Linien, Halbfinale mit
 * Strafstoßschießen, Finale und Golden Goal mit Verlängerung und Strafstoßschießen), @DR-018 (jedes Spiel in der Vorlage),
 * @DR-034 (Schreibraum über den Linien).
 */
import { describe, expect, it } from 'vitest';
import { printLimits } from '../../../design-tokens/print';
import { printFinals, printWriteLine } from '../../../design-tokens/print-sheet';
import type { Match, Tournament } from '../../../types/tournament';
import { finalsMatches, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { hallencupMitStand, linienIn, SIZE_TOL, textsIn, TOL, zeileVon, type Zeile } from './pdfScoreSupport';
import type { LayoutPage } from './pdfjsLayout';

const REGELN: Partial<Tournament> = {
  finalsConfig: {
    preset: 'top-4',
    tiebreakerByRound: { semifinal: 'shootout', final: 'overtime-then-shootout', placement: 'goldenGoal' },
  },
};

/** Spielnummern der Finalrunde im Hallencup: zwei Halbfinals, Spiel um Platz 3, Finale. */
function finalNummern(): { halbfinale: number; platz3: number; finale: number } {
  const finals = finalsMatches(hallencupSchedule(hallencupTournament(REGELN)));
  const nummer = (pruefe: (m: (typeof finals)[number]) => boolean): number => {
    const treffer = finals.find(pruefe);
    if (!treffer) {throw new Error('Finalspiel fehlt im Fixture-Plan');}
    return treffer.matchNumber;
  };
  return {
    halbfinale: nummer(m => m.finalType === undefined),
    platz3: nummer(m => m.finalType === 'thirdPlace'),
    finale: nummer(m => m.finalType === 'final'),
  };
}

const { halbfinale: HF, platz3: P3, finale: FINALE } = finalNummern();

/**
 * Fenster einer Finalzeile mit `paare` Paaren kleiner Linien: von knapp über der Zeile bis unter die Beschriftung des letzten Paars.
 * Die Zeilen der Finalrunde sind unterschiedlich hoch (zwei Paare stehen untereinander), darum gilt je Test das Fenster, nicht die
 * Mitte zur Nachbarzeile.
 */
const UNTER_DER_LINIE = 4.5;
const STUFE = printWriteLine.minWriteSpace + 4;
/** Der Hallencup hat zwei Felder: die kleinen Linien stehen unter dem Ergebnis, die erste Stufe liegt `minWriteSpace` darunter (@DR-037). */
const ERSTE_STUFE = printWriteLine.minWriteSpace;
const fenster = (zeile: Zeile, paare: number): Zeile => ({ ...zeile, top: zeile.nr.y - 5, bottom: zeile.nr.y + UNTER_DER_LINIE + ERSTE_STUFE + (paare - 1) * STUFE });
const mitte = (l: { x1: number; x2: number }): number => (l.x1 + l.x2) / 2;

/** Linien fürs Ergebnis (schmal, 10 mm) und kleine Linien (8 mm) einer Zeile, jede ein einziger Strich, von oben nach unten. */
const gross = (zeile: Zeile) => linienIn(zeile).filter(l => Math.abs(Math.abs(l.x2 - l.x1) - printWriteLine.resultNarrow) <= TOL);
const klein = (zeile: Zeile) => linienIn(zeile).filter(l => Math.abs(Math.abs(l.x2 - l.x1) - printWriteLine.small) <= TOL).sort((x, y) => x.y1 - y.y1 || x.x1 - y.x1);
const wort = (zeile: Zeile, text: string) => textsIn(zeile).find(t => t.str.trim() === text);

async function seiten(updates: Record<number, Partial<Match>> = {}, options: Record<string, unknown> = {}): Promise<LayoutPage[]> {
  return hallencupMitStand(updates, REGELN, options);
}

describe('@DR-004 @DR-019 @DR-037 Spiel ohne Ergebnis: Linien fürs Ergebnis und, je nach Regel der Runde, kleine Linien darunter (zwei Felder: kein Platz daneben)', () => {
  it('Halbfinale (bei Gleichstand direkt Strafstoßschießen): zwei Linien fürs Ergebnis, darunter ein Paar kleiner Linien „Strafstoßschießen“, mittig und mit 5 mm Schreibraum', async () => {
    const zeile = fenster(zeileVon(await seiten(), HF), 1);
    const grosse = gross(zeile);
    const kleine = klein(zeile);
    const titel = wort(zeile, 'Strafstoßschießen');

    expect(grosse).toHaveLength(2);
    expect(kleine).toHaveLength(2);
    expect(titel, 'Beschriftung').toBeDefined();
    expect(Math.abs((titel?.size ?? 0) - printFinals.smallPt)).toBeLessThanOrEqual(SIZE_TOL);
    expect(kleine[0].y1 - grosse[0].y1, 'Schreibraum über der unteren Reihe').toBeGreaterThanOrEqual(printWriteLine.minWriteSpace - TOL);
    expect((mitte(kleine[0]) + mitte(kleine[1])) / 2, 'Paar mittig unter dem Ergebnis').toBeCloseTo((mitte(grosse[0]) + mitte(grosse[1])) / 2, 1);
    expect(titel?.y ?? 0).toBeGreaterThan(kleine[0].y1);
    expect(wort(zeile, 'nach Verlängerung')).toBeUndefined();
  });

  it('Finale (erst Verlängerung, dann Strafstoßschießen): zwei Paare kleiner Linien untereinander, „nach Verlängerung“ und „Strafstoßschießen“ unter ihren Linien', async () => {
    const zeile = fenster(zeileVon(await seiten(), FINALE), 2);
    const grosse = gross(zeile);
    const kleine = klein(zeile);
    const verlaengerung = wort(zeile, 'nach Verlängerung');
    const schiessen = wort(zeile, 'Strafstoßschießen');

    expect(grosse).toHaveLength(2);
    expect(kleine).toHaveLength(4);
    expect(verlaengerung && schiessen).toBeTruthy();
    expect(kleine[0].y1 - grosse[0].y1).toBeGreaterThanOrEqual(printWriteLine.minWriteSpace - TOL);
    expect(kleine[2].y1 - kleine[0].y1, 'Schreibraum über dem zweiten Paar').toBeGreaterThanOrEqual(printWriteLine.minWriteSpace - TOL);
    expect(verlaengerung?.y ?? 0).toBeGreaterThan(kleine[0].y1);
    expect(verlaengerung?.y ?? 0).toBeLessThan(kleine[2].y1);
    expect(schiessen?.y ?? 0).toBeGreaterThan(kleine[2].y1);
  });

  it('Spiel um Platz 3 bei Golden Goal: auch hier kleine Linien „nach Verlängerung“ und „Strafstoßschießen“ (auch ein Golden-Goal-Spiel kann im Strafstoßschießen enden)', async () => {
    const zeile = fenster(zeileVon(await seiten(), P3), 2);

    expect(gross(zeile)).toHaveLength(2);
    expect(klein(zeile)).toHaveLength(4);
    expect(wort(zeile, 'nach Verlängerung')).toBeDefined();
    expect(wort(zeile, 'Strafstoßschießen')).toBeDefined();
  });

  it('Vorlage (Fassung ohne Ergebnisse): auch das beendete Finale steht mit leeren Linien, kleine Linien inklusive', async () => {
    const zeile = fenster(zeileVon(
      await seiten({ [FINALE]: { matchStatus: 'finished', scoreA: 2, scoreB: 1 } }, { edition: 'blank', includeScores: false }),
      FINALE,
    ), 2);

    expect(gross(zeile)).toHaveLength(2);
    expect(klein(zeile)).toHaveLength(4);
  });
});

describe('@DR-019 laufend, ausgefallen, beendet', () => {
  // @DR-019: ein laufendes Spiel (auch in der Halbzeit) steht wie ein Spiel ohne Ergebnis da, auch das Finale: Linien der Runde,
  // kein „läuft“, kein Zwischenstand (1:1 ist gesetzt und darf nicht erscheinen)
  it.each(['running', 'paused'] as const)('laufendes Finale (%s): Linien fürs Ergebnis und die kleinen Linien seiner Runde, kein „läuft“, kein Zwischenstand', async status => {
    const zeile = fenster(zeileVon(await seiten({ [FINALE]: { matchStatus: status, scoreA: 1, scoreB: 1 } }), FINALE), 2);

    expect(wort(zeile, 'läuft')).toBeUndefined();
    expect(textsIn(zeile).some(t => /^\d$/.test(t.str.trim()) && t.size >= printLimits.resultPt - 0.05)).toBe(false);
    expect(gross(zeile)).toHaveLength(2);
    expect(klein(zeile)).toHaveLength(4);
  });

  it('Spiel 9 ausgefallen: „ausgefallen“ ohne Linien fürs Ergebnis', async () => {
    const zeile = zeileVon(await seiten({ 9: { matchStatus: 'skipped' } }), 9);

    expect(wort(zeile, 'ausgefallen')).toBeDefined();
    expect(gross(zeile)).toEqual([]);
  });

  it('ausgefallenes Halbfinale: ebenfalls ohne Linien, auch ohne kleine', async () => {
    const zeile = fenster(zeileVon(await seiten({ [HF]: { matchStatus: 'skipped' } }), HF), 1);

    expect(wort(zeile, 'ausgefallen')).toBeDefined();
    expect(gross(zeile)).toEqual([]);
    expect(klein(zeile)).toEqual([]);
  });

  it('Gegenbeispiel: beendetes Finale ohne Verlängerung und Strafstoßschießen hat keine kleinen Linien und keine Beschriftung', async () => {
    const zeile = fenster(zeileVon(await seiten({ [FINALE]: { matchStatus: 'finished', scoreA: 3, scoreB: 1 } }), FINALE), 2);

    expect(gross(zeile)).toEqual([]);
    expect(klein(zeile)).toEqual([]);
    expect(wort(zeile, 'Strafstoßschießen')).toBeUndefined();
    expect(wort(zeile, 'nach Verlängerung')).toBeUndefined();
  });

  it('beendetes Halbfinale 2:2 mit Strafstoßschießen 4:3: Beschriftung und der Stand „4 : 3“ statt der kleinen Linien', async () => {
    const zeile = fenster(zeileVon(
      await seiten({ [HF]: { matchStatus: 'finished', scoreA: 2, scoreB: 2, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' } }),
      HF,
    ), 1);

    expect(wort(zeile, 'Strafstoßschießen')).toBeDefined();
    expect(wort(zeile, 'nach Verlängerung')).toBeUndefined();
    expect(wort(zeile, '4 : 3')).toBeDefined();
    expect(klein(zeile)).toEqual([]);
  });

  it('beendetes Finale 2:2, nach Verlängerung 3:3, Strafstoßschießen 5:4: beide Stände stehen mit ihrer Beschriftung', async () => {
    const zeile = fenster(zeileVon(
      await seiten({
        [FINALE]: {
          matchStatus: 'finished', scoreA: 2, scoreB: 2, overtimeScoreA: 3, overtimeScoreB: 3, penaltyScoreA: 5, penaltyScoreB: 4, decidedBy: 'penalty',
        },
      }),
      FINALE,
    ), 2);

    expect(wort(zeile, '3 : 3')).toBeDefined();
    expect(wort(zeile, '5 : 4')).toBeDefined();
    expect(wort(zeile, 'nach Verlängerung') && wort(zeile, 'Strafstoßschießen')).toBeTruthy();
  });
});
