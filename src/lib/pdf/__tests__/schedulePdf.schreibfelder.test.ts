/**
 * B-28 C1 (a4-1): Schreibfelder je Zustand und je Regel der Runde, gelesen aus dem fertigen PDF (pdfjs).
 * Szenarien: @DR-004 (Felder zum Eintragen), @DR-019 (laufend mit Feldern, ausgefallen ohne, Halbfinale mit
 * Strafstoßschießen, Finale mit Verlängerung und Strafstoßschießen), @DR-018 (jedes Spiel in der Vorlage).
 */
import { describe, expect, it } from 'vitest';
import { printBox, printGap, printType } from '../../../design-tokens/print';
import type { Match, Tournament } from '../../../types/tournament';
import { finalsMatches, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { hallencupMitStand, kaestchenIn, SIZE_TOL, textsIn, TOL, zeileVon, type Zeile } from './pdfScoreSupport';
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

const gross = (zeile: Zeile) => kaestchenIn(zeile, printBox.scoreField.w, printBox.scoreField.h);
const klein = (zeile: Zeile) => kaestchenIn(zeile, printBox.penField.w, printBox.penField.h);
const wort = (zeile: Zeile, text: string) => textsIn(zeile).find(t => t.str.trim() === text);

async function seiten(updates: Record<number, Partial<Match>> = {}, options: Record<string, unknown> = {}): Promise<LayoutPage[]> {
  return hallencupMitStand(updates, REGELN, options);
}

describe('@DR-004 @DR-019 Spiel ohne Ergebnis: Felder fürs Ergebnis und, je nach Regel der Runde, kleine Felder', () => {
  it('Halbfinale (bei Gleichstand direkt Strafstoßschießen): zwei Felder, darunter „Strafstoßschießen“ mit zwei kleinen Feldern fluchtend', async () => {
    const zeile = zeileVon(await seiten(), HF);
    const grosse = gross(zeile);
    const kleine = klein(zeile);
    const titel = wort(zeile, 'Strafstoßschießen');

    expect(grosse).toHaveLength(2);
    expect(kleine).toHaveLength(2);
    expect(titel, 'Beschriftung').toBeDefined();
    expect(Math.abs((titel?.size ?? 0) - printType.penLabel)).toBeLessThanOrEqual(SIZE_TOL);
    expect(Math.abs(kleine[0].x - grosse[0].x), 'links fluchtend').toBeLessThanOrEqual(TOL);
    expect(Math.abs(kleine[1].x - grosse[1].x), 'rechts fluchtend').toBeLessThanOrEqual(TOL);
    expect(titel?.y ?? 0).toBeGreaterThan(grosse[0].y + grosse[0].h);
    expect(titel?.y ?? 0).toBeLessThan(kleine[0].y);
    expect(wort(zeile, 'nach Verlängerung')).toBeUndefined();
  });

  it('Finale (erst Verlängerung, dann Strafstoßschießen): „nach Verlängerung“ und darunter „Strafstoßschießen“, je zwei kleine Felder', async () => {
    const zeile = zeileVon(await seiten(), FINALE);
    const grosse = gross(zeile);
    const kleine = klein(zeile);
    const verlaengerung = wort(zeile, 'nach Verlängerung');
    const schiessen = wort(zeile, 'Strafstoßschießen');

    expect(grosse).toHaveLength(2);
    expect(kleine).toHaveLength(4);
    expect(verlaengerung && schiessen).toBeTruthy();
    expect(verlaengerung?.y ?? 0).toBeGreaterThan(grosse[0].y + grosse[0].h);
    expect(verlaengerung?.y ?? 0).toBeLessThan(kleine[0].y);
    expect(schiessen?.y ?? 0).toBeGreaterThan(kleine[1].y + kleine[1].h);
    expect(schiessen?.y ?? 0).toBeLessThan(kleine[2].y);
    kleine.forEach((k, i) => expect(Math.abs(k.x - grosse[i % 2].x), `kleines Feld ${i + 1} fluchtet`).toBeLessThanOrEqual(TOL));
  });

  it('Gegenbeispiel Golden Goal: das Spiel um Platz 3 hat nur die zwei Felder fürs Ergebnis, keine kleinen', async () => {
    const zeile = zeileVon(await seiten(), P3);

    expect(gross(zeile)).toHaveLength(2);
    expect(klein(zeile)).toEqual([]);
    expect(wort(zeile, 'Strafstoßschießen')).toBeUndefined();
  });

  it('Gegenbeispiel Gruppenspiel: keine kleinen Felder und keine Beschriftung', async () => {
    const zeile = zeileVon(await seiten(), 10);

    expect(gross(zeile)).toHaveLength(2);
    expect(klein(zeile)).toEqual([]);
    expect(wort(zeile, 'Strafstoßschießen')).toBeUndefined();
  });

  it('Vorlage (Fassung zum Ausfüllen): auch das beendete Finale steht mit leeren Feldern, kleine Felder inklusive', async () => {
    const zeile = zeileVon(
      await seiten({ [FINALE]: { matchStatus: 'finished', scoreA: 2, scoreB: 1 } }, { edition: 'blank', includeScores: false }),
      FINALE,
    );

    expect(gross(zeile)).toHaveLength(2);
    expect(klein(zeile)).toHaveLength(4);
  });
});

describe('@DR-019 laufend, ausgefallen, beendet', () => {
  it('Spiel 12 läuft: „läuft“ und je ein leeres Feld für Heim und Gast', async () => {
    const zeile = zeileVon(await seiten({ 12: { matchStatus: 'running', scoreA: 1, scoreB: 0 } }), 12);

    expect(gross(zeile)).toHaveLength(2);
    expect(wort(zeile, 'läuft')).toBeDefined();
  });

  it('laufendes Finale: „läuft“, Felder fürs Ergebnis und die kleinen Felder seiner Runde', async () => {
    const zeile = zeileVon(await seiten({ [FINALE]: { matchStatus: 'running', scoreA: 1, scoreB: 1 } }), FINALE);

    expect(wort(zeile, 'läuft')).toBeDefined();
    expect(gross(zeile)).toHaveLength(2);
    expect(klein(zeile)).toHaveLength(4);
  });

  it('Spiel 9 ausgefallen: „ausgefallen“ ohne Felder', async () => {
    const zeile = zeileVon(await seiten({ 9: { matchStatus: 'skipped' } }), 9);

    expect(wort(zeile, 'ausgefallen')).toBeDefined();
    expect(gross(zeile)).toEqual([]);
    expect(klein(zeile)).toEqual([]);
  });

  it('ausgefallenes Halbfinale: ebenfalls ohne Felder, auch ohne kleine', async () => {
    const zeile = zeileVon(await seiten({ [HF]: { matchStatus: 'skipped' } }), HF);

    expect(wort(zeile, 'ausgefallen')).toBeDefined();
    expect(gross(zeile)).toEqual([]);
    expect(klein(zeile)).toEqual([]);
  });

  it('Gegenbeispiel: beendetes Finale ohne Verlängerung und Strafstoßschießen hat keine leeren kleinen Felder', async () => {
    const zeile = zeileVon(await seiten({ [FINALE]: { matchStatus: 'finished', scoreA: 3, scoreB: 1 } }), FINALE);

    expect(gross(zeile)).toHaveLength(2);
    expect(klein(zeile)).toEqual([]);
    expect(wort(zeile, 'Strafstoßschießen')).toBeUndefined();
    expect(wort(zeile, 'nach Verlängerung')).toBeUndefined();
  });

  it('beendetes Halbfinale 2:2 mit Strafstoßschießen 4:3: Beschriftung und die Zahlen in den kleinen Feldern', async () => {
    const zeile = zeileVon(
      await seiten({ [HF]: { matchStatus: 'finished', scoreA: 2, scoreB: 2, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' } }),
      HF,
    );
    const kleine = klein(zeile);
    const ziffern = textsIn(zeile).filter(t => Math.abs(t.size - printType.penField) <= SIZE_TOL && /^\d$/.test(t.str.trim()));

    expect(wort(zeile, 'Strafstoßschießen')).toBeDefined();
    expect(wort(zeile, 'nach Verlängerung')).toBeUndefined();
    expect(kleine).toHaveLength(2);
    expect(ziffern.map(t => t.str.trim())).toEqual(['4', '3']);
    expect(ziffern[0].x).toBeGreaterThan(kleine[0].x);
    expect(ziffern[0].x).toBeLessThan(kleine[0].x + kleine[0].w);
    expect(ziffern[1].x).toBeGreaterThan(kleine[1].x);
  });

  it('beendetes Finale 2:2, nach Verlängerung 3:3, Strafstoßschießen 5:4: beide Zeilen gefüllt', async () => {
    const zeile = zeileVon(
      await seiten({
        [FINALE]: {
          matchStatus: 'finished', scoreA: 2, scoreB: 2, overtimeScoreA: 3, overtimeScoreB: 3, penaltyScoreA: 5, penaltyScoreB: 4, decidedBy: 'penalty',
        },
      }),
      FINALE,
    );
    const ziffern = textsIn(zeile).filter(t => Math.abs(t.size - printType.penField) <= SIZE_TOL && /^\d$/.test(t.str.trim()));

    expect(klein(zeile)).toHaveLength(4);
    expect(ziffern.map(t => t.str.trim())).toEqual(['3', '3', '5', '4']);
    expect(wort(zeile, 'nach Verlängerung') && wort(zeile, 'Strafstoßschießen')).toBeTruthy();
  });
});

describe('C1-F S2 Finalzeilen: Polster wie v7.2 (1,8 mm)', () => {
  it('Finale: die kleinen Felder haben oben und unten mindestens printGap.finalPadV Abstand zu den Zeilenlinien', async () => {
    const zeile = zeileVon(await seiten(), FINALE);
    const felder = [...gross(zeile), ...klein(zeile)];
    const oben = Math.min(...felder.map(f => f.y)) - zeile.top;
    const unten = zeile.bottom - Math.max(...felder.map(f => f.y + f.h));

    expect(oben, 'Abstand oben').toBeGreaterThanOrEqual(printGap.finalPadV - TOL);
    expect(unten, 'Abstand unten').toBeGreaterThanOrEqual(printGap.finalPadV - TOL);
  });

  it('Gegenbeispiel: Gruppenzeilen behalten das schmale Polster (printGap.bodyPadV)', async () => {
    const zeile = zeileVon(await seiten(), 10);
    const felder = gross(zeile);
    const oben = Math.min(...felder.map(f => f.y)) - zeile.top;

    expect(oben).toBeLessThan(printGap.finalPadV);
  });
});
