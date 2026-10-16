/**
 * @ZM-147 (Record zuschauer-und-monitor): „Halbfinale 1 wurde auf Papier geleitet. Olli trägt im Spielplan 2:2 und das
 * Strafstoßschießen 4:3 für FC Nord ein, ohne einzelne Tore oder Schüsse. Der Hallenmonitor zeigt 2:2,
 * ‚Strafstoßschießen 4 : 3‘ und FC Nord als Sieger.“ (Fixrunde A-36b, Review W2)
 *
 * Datenebene: so muss die Cloud-Zeile aussehen – die Ansicht liefert dann den Endstand ohne Verlauf.
 * Engine-Weg: RESULT_ENTRY kennt heute nur `scores` (kein Strafstoßschießen) → als `it.fails` markiert,
 * Befund C-DIREKTEINTRAG-OHNE-STRAFSTOSS (Ziel @FU-094).
 */
import { describe, expect, it, vi } from 'vitest';
import { buildTournamentView } from '../tournamentView';
import { directEntry, GAME, hf1Besetzt, NORD, withCloudColumns } from '../__fixtures__/hallencupNord';
import { getMatchWinner } from '../../../utils/calculations';

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

  // Befund C-DIREKTEINTRAG-OHNE-STRAFSTOSS (Ziel @FU-094): der Direkteintrag bringt das Strafstoßschießen nicht in die
  // Engine; der Cache liefert decided_by 'regular' ohne penalty_score_* – das Spiel bekommt keinen Sieger.
  it.fails('@ZM-147 Engine-Weg: Direkteintrag 2:2 + Strafstoß 4:3 ergibt FC Nord als Sieger (heute nicht möglich)', async () => {
    const cup = directEntry(await hf1Besetzt(), GAME.HF1, 2, 2);
    const score = buildTournamentView(cup.tournament, { audience: 'screen', medium: 'app', locale: 'de' }).byId.get(cup.tournament.matches[GAME.HF1].id)?.score;
    expect(score).toMatchObject(RECORD);
  });
});
