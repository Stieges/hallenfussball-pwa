/**
 * @ZM-147 (Record zuschauer-und-monitor): „Halbfinale 1 wurde auf Papier geleitet. Olli trägt im Spielplan 2:2 und das
 * Strafstoßschießen 4:3 für FC Nord ein, ohne einzelne Tore oder Schüsse. Der Hallenmonitor zeigt 2:2,
 * ‚Strafstoßschießen 4 : 3‘ und FC Nord als Sieger.“ (Fixrunde A-36b, Review W2)
 *
 * Datenebene: so muss die Cloud-Zeile aussehen – die Ansicht liefert dann den Endstand ohne Verlauf.
 * Engine-Weg (A-25a, @FU-094): RESULT_ENTRY trägt `shootout`; die Engine legt es in die Überschreibung,
 * `cacheColumns` schreibt daraus `penalty_score_*` und `decided_by = 'penalty'` (Befund
 * C-DIREKTEINTRAG-OHNE-STRAFSTOSS behoben).
 */
import { describe, expect, it, vi } from 'vitest';
import { buildTournamentView } from '../tournamentView';
import { GAME, hf1Besetzt, NORD, SUED, withCloudColumns } from '../__fixtures__/hallencupNord';
import { getMatchWinner } from '../../../utils/calculations';
import { reduceMatch } from '../../match/reduceMatch';
import { cacheColumns } from '../../match/client/cacheColumns';

vi.mock('i18next', async () => (await import('./realI18n')).realI18nModule());

const RECORD = { a: 2, b: 2, penalty: { a: 4, b: 3 }, decidedBy: 'penalty', winner: 'a' } as const;

describe('@ZM-147 Ist nur das Ergebnis eingetragen, zeigt der Monitor den Endstand ohne Verlauf', () => {
  it('@ZM-147 Datenebene: Halbfinale 1 2:2, Strafstoßschießen 4:3 für FC Nord, kein Ereignis → Endstand und Sieger', async () => {
    const base = await hf1Besetzt();
    const cup = withCloudColumns(base, GAME.HF1, {
      score_a: 2, score_b: 2, penalty_score_a: 4, penalty_score_b: 3, match_status: 'finished', decided_by: 'penalty',
    });
    const hf1 = cup.tournament.matches[GAME.HF1];
    const view = buildTournamentView(cup.tournament, { audience: 'screen', medium: 'app', locale: 'de' });
    expect(view.byId.get(hf1.id)).toMatchObject({ status: 'finished', labelText: 'Halbfinale 1', score: RECORD });
    expect(view.byId.get(hf1.id)?.score?.overtime).toBeUndefined();
    expect(cup.events.get(hf1.id)).toBeUndefined(); // kein Verlauf: keine Tore, keine Schüsse
    expect(getMatchWinner(hf1)?.winner).toBe(NORD);
  });

  it('@ZM-147 Gegenbeispiel: 2:2 ohne Strafstoß-Stand hat keinen Sieger (nichts wird geraten)', async () => {
    const cup = withCloudColumns(await hf1Besetzt(), GAME.HF1, { score_a: 2, score_b: 2, match_status: 'finished', decided_by: 'regular' });
    const score = buildTournamentView(cup.tournament, { audience: 'screen', medium: 'app', locale: 'de' }).byId.get(cup.tournament.matches[GAME.HF1].id)?.score;
    expect(score).toMatchObject({ a: 2, b: 2, decidedBy: null, winner: null });
  });

  it('@ZM-147 Engine-Weg: Direkteintrag 2:2 + Strafstoß 4:3 ergibt FC Nord als Sieger', async () => {
    const base = await hf1Besetzt();
    const hf1Id = base.tournament.matches[GAME.HF1].id;
    const ctx = { matchId: hf1Id, teamAId: NORD, teamBId: SUED };
    // Olli trägt nur das Ergebnis ein: ein RESULT_ENTRY, keine Tore, keine Schüsse.
    const { state } = reduceMatch([{
      id: '0000a25a-0000-4000-8000-000000000147', type: 'RESULT_ENTRY', actor: 'leitung', at: 1000, section: null, clockMs: null,
      payload: { scores: { [NORD]: 2, [SUED]: 2 }, shootout: { [NORD]: 4, [SUED]: 3 } },
    }], ctx);
    const c = cacheColumns(state, ctx);
    const cup = withCloudColumns(base, GAME.HF1, {
      score_a: c.score_a, score_b: c.score_b, overtime_score_a: c.overtime_score_a, overtime_score_b: c.overtime_score_b,
      penalty_score_a: c.penalty_score_a, penalty_score_b: c.penalty_score_b, match_status: c.match_status, decided_by: c.decided_by,
    });
    const hf1 = cup.tournament.matches[GAME.HF1];
    const score = buildTournamentView(cup.tournament, { audience: 'screen', medium: 'app', locale: 'de' }).byId.get(hf1.id)?.score;
    expect(score).toMatchObject(RECORD);
    expect(score?.overtime).toBeUndefined();
    expect(getMatchWinner(hf1)?.winner).toBe(NORD);
  });
});
