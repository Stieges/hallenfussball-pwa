/**
 * @W2A-051 – Bei zwei direkten Spielen zählen beide für den direkten Vergleich (Record 2026-09-27_wizard-regelinhalte),
 * Zusammenspiel mit @TM-152 (mehrere Runden bei „Jeder gegen jeden“). Test aus dem Gherkin:
 * Hin- und Rückrunde, TSV Waging rot und DJK Kammer punktgleich, Waging rot gewinnt das Hinspiel 2:1, Kammer das
 * Rückspiel 3:0 → Kammer steht vor Waging rot.
 * Daten so gewählt, dass die Gegenbeispiele trennen: Waging rot hat die bessere Tordifferenz aller Spiele (+8 zu +4),
 * und nur mit dem Hinspiel stünde Waging rot vorn (Mutationsprobe im Bericht).
 */
import { describe, expect, it } from 'vitest';
import { rankGroup } from '../groupTable';
import { DEFAULT_FORFEIT_SCORE } from '../../models/forfeit';
import { BFV_ORDER, GD_FIRST_ORDER, league, names, NAME, POINTS_310 } from './fixtures';

/** Hinrunde, dann Rückrunde mit getauschtem Heim/Gast (4 Teams, je Runde 6 Spiele). */
const HINRUNDE = 'R–K 2:1; R–N 5:0; R–O 1:1; K–N 1:0; K–O 0:0; N–O 1:0';
const RUECKRUNDE = 'K–R 3:0; N–R 0:5; O–R 1:1; N–K 0:1; O–K 0:0; O–N 1:0';

function table(results: string, placementLogic = BFV_ORDER) {
  const { teams, matches } = league('RKNO', results);
  return rankGroup({
    groupId: '',
    teams,
    matches,
    pointSystem: POINTS_310,
    forfeitScore: { ...DEFAULT_FORFEIT_SCORE },
    placementLogic,
    decisions: [],
    mode: 'group',
    placesToPlayOut: [1],
    followUpRanks: [],
  });
}

describe('@W2A-051 zwei direkte Spiele im direkten Vergleich', () => {
  it('@W2A-051 Hin- und Rückrunde: Waging rot gewinnt das Hinspiel 2:1, Kammer das Rückspiel 3:0 → Kammer steht vor Waging rot', () => {
    const { rows } = table(`${HINRUNDE}; ${RUECKRUNDE}`);

    const kammer = rows.find((r) => r.team.name === NAME.K);
    const waging = rows.find((r) => r.team.name === NAME.R);
    expect(kammer?.points).toBe(11);
    expect(waging?.points).toBe(11);
    expect(names(rows).slice(0, 2)).toEqual([NAME.K, NAME.R]);
    // Gegenbeispiel in den Daten: nach der Tordifferenz aller Spiele läge Waging rot vorn
    expect(waging?.goalDifference).toBe(8);
    expect(kammer?.goalDifference).toBe(4);
    expect(rows.some((r) => r.decisionNeeded)).toBe(false);
  });

  it('@W2A-051 Gegenbeispiel: mit „Tordifferenz vor direktem Vergleich“ steht Waging rot vorn', () => {
    const { rows } = table(`${HINRUNDE}; ${RUECKRUNDE}`, GD_FIRST_ORDER);

    expect(names(rows).slice(0, 2)).toEqual([NAME.R, NAME.K]);
  });
});
