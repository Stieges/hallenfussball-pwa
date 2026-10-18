/**
 * @EK-062 (Record ergebnisse-korrigieren): „Halbfinale 1 wurde im Spielplan mit 2:2 und Strafstoßschießen 4:3 für FC Nord
 * eingetragen. Olli eröffnet es wieder, nach einem weiteren Tor endet es 2:3 für DJK Berg. Dann ist DJK Berg Sieger von
 * Halbfinale 1 mit 2:3, und das Strafstoßergebnis 4:3 zählt nirgends mehr. Und Monitor, Zuschauer-Seite und Finalrunde
 * zeigen 2:3 ohne Strafstoß. … Aber endet Halbfinale 1 nach dem Wiedereröffnen erneut 2:2 …“ (SW, Schritt 4)
 *
 * Echte Kette: Ereignisse → `reduceMatch` → `cacheColumns` (Cloud-Zeile, TS == SQL laut match-engine-parity.sh 68a/68b)
 * bzw. `engineOverlayFields` (eigenes Gerät) → Endstand (`matchFinalScore`, Ansicht), Sieger (`getMatchWinner`) und
 * Finalrunde (`resolveBracketAfterPlayoffMatch`). Keine von Hand gebaute Zeile.
 */
import { describe, expect, it, vi } from 'vitest';
import { buildTournamentView } from '../tournamentView';
import { matchFinalScore } from '../finalScore';
import { BERG, GAME, NORD, type Hallencup } from '../__fixtures__/hallencupNord';
import { gespielt } from '../__fixtures__/ek062Halbfinale';
import { getMatchWinner } from '../../../utils/calculations';
import { resolveBracketAfterPlayoffMatch } from '../../generators';
import { slotTeamId } from '../../models/matchSlot';

vi.mock('i18next', async () => (await import('./realI18n')).realI18nModule());

/** Team auf der Seite des Finales, deren Herkunft „Sieger Halbfinale 1“ ist. */
function finalistAusHalbfinale1(cup: Hallencup): string | undefined {
  const hf1Id = cup.tournament.matches[GAME.HF1].id;
  const finale = cup.tournament.matches[GAME.FINAL];
  const vonHf1 = (o: typeof finale.originA) => o?.kind === 'matchResult' && o.matchId === hf1Id && o.role === 'winner';
  if (vonHf1(finale.originA)) {
    return slotTeamId(finale.slotA);
  }
  return vonHf1(finale.originB) ? slotTeamId(finale.slotB) : undefined;
}

const ansicht = (cup: Hallencup, id: string) =>
  buildTournamentView(cup.tournament, { audience: 'screen', medium: 'app', locale: 'de' }).byId.get(id)?.score;

describe('@EK-062 Monitor, Zuschauer-Seite und Finalrunde zeigen 2:3 ohne Strafstoß', () => {
  it('@EK-062 Ansicht (Monitor, Zuschauer-Seite): Halbfinale 1 2:3, regulär, kein Strafstoß, Sieger DJK Berg', async () => {
    const { cup, hf1 } = await gespielt(true);
    const score = ansicht(cup, hf1.id);
    expect(score).toMatchObject({ a: 2, b: 3, decidedBy: 'regular', winner: 'b' });
    expect(score?.penalty).toBeUndefined();
  });

  it('@EK-062 eigenes Gerät (Überlagerung aus der Engine): 2:3 ohne Strafstoß', async () => {
    const { lokal } = await gespielt(true);
    expect(lokal).toMatchObject({ scoreA: 2, scoreB: 3, penaltyScoreA: undefined, penaltyScoreB: undefined, decidedBy: 'regular' });
    expect(matchFinalScore({ ...lokal, matchStatus: 'finished' })).toMatchObject({ a: 2, b: 3, decidedBy: 'regular', winner: 'b' });
  });

  it('@EK-062 Finalrunde: DJK Berg ist Sieger von Halbfinale 1 und steht im Finale', async () => {
    const { cup, hf1 } = await gespielt(true);
    expect(getMatchWinner(hf1)?.winner).toBe(BERG);
    resolveBracketAfterPlayoffMatch(cup.tournament);
    expect(finalistAusHalbfinale1(cup)).toBe(BERG);
  });

  it('@EK-062 Gegenbeispiel: erneut 2:2 – Strafstoßschießen 4 : 3 zählt, FC Nord Sieger und im Finale', async () => {
    const { cup, hf1, lokal } = await gespielt(false);
    expect(ansicht(cup, hf1.id)).toMatchObject({ a: 2, b: 2, penalty: { a: 4, b: 3 }, decidedBy: 'penalty', winner: 'a' });
    expect(lokal).toMatchObject({ penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' });
    expect(getMatchWinner(hf1)?.winner).toBe(NORD);
    resolveBracketAfterPlayoffMatch(cup.tournament);
    expect(finalistAusHalbfinale1(cup)).toBe(NORD);
  });
});
