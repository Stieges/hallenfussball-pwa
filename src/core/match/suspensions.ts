/**
 * L6 (Cockpit-Spec § 10 L6, § 15 Nr. 4): Sperr-Hinweis nach Rot als reine Ableitung über alle
 * Spiele eines Turniers (@SL-089, @W2A-020, @SL-111, @SL-128, @SL-131, Gegenbeispiel @W2A-019).
 *
 * Quelle ist der Engine-Zustand (`CardRecord.type`, nur wirksame Karten – eine Rücknahme entfernt
 * die Karte), NICHT das RuntimeEvent: dort ist Gelb-Rot als `RED_CARD` mit
 * `payload.cardType='YELLOW_RED_CARD'` abgebildet und würde hier als Sperre durchgehen.
 * Reine Funktion ohne React, ohne i18n (Ort laut Brief L6, Ruling R-L6-1).
 */
import type { MatchState } from './types';

export interface SperrHinweis {
  teamId: string;
  playerNumber: number;
  ausSpielNummer: number;
}

export interface SuspensionMatchRef {
  id: string;
  matchNumber: number;
  teamIds: readonly [string, string];
}

/**
 * Sperr-Hinweise für das aktuelle Spiel: Rote Karten der Teams des aktuellen Spiels aus früheren
 * Spielen (kleinere Spielnummer), je (Team, Rückennummer) genau ein Hinweis mit dem frühesten Spiel.
 *
 * - `YELLOW_RED_CARD` sperrt nie (@W2A-019), eine Rote ohne Rückennummer nie (kein Spieler).
 * - Rot im aktuellen Spiel selbst erzeugt keinen Hinweis für dieses Spiel (die Unterzahl regelt
 *   ZA-2; Zone 1 „Sperre“: „Rot zeigt in späteren Spielen den Sperr-Hinweis“).
 * - Spiele ohne lokalen Zustand (`stateOf` → `undefined`) werden übersprungen, nie geworfen.
 * - Reihenfolge stabil: Heim-Team des aktuellen Spiels zuerst, dann Rückennummer aufsteigend.
 */
export function redCardSuspensions(
  matches: readonly SuspensionMatchRef[],
  stateOf: (matchId: string) => Pick<MatchState, 'cards'> | undefined,
  currentMatchId: string,
): SperrHinweis[] {
  const current = matches.find((match) => match.id === currentMatchId);
  if (current === undefined) {
    return [];
  }
  const teamOrder = new Map(current.teamIds.map((teamId, index) => [teamId, index]));
  const jeSpieler = new Map<string, SperrHinweis>();
  for (const match of matches) {
    if (match.matchNumber >= current.matchNumber) {
      continue;
    }
    const state = stateOf(match.id);
    if (state === undefined) {
      continue;
    }
    for (const card of state.cards) {
      if (card.type !== 'RED_CARD' || card.playerNumber === undefined) {
        continue;
      }
      if (!teamOrder.has(card.teamId)) {
        continue;
      }
      const key = `${card.teamId}|${card.playerNumber}`;
      const vorhanden = jeSpieler.get(key);
      if (vorhanden === undefined || match.matchNumber < vorhanden.ausSpielNummer) {
        jeSpieler.set(key, { teamId: card.teamId, playerNumber: card.playerNumber, ausSpielNummer: match.matchNumber });
      }
    }
  }
  return [...jeSpieler.values()].sort((a, b) => {
    const teamDiff = (teamOrder.get(a.teamId) ?? 0) - (teamOrder.get(b.teamId) ?? 0);
    return teamDiff !== 0 ? teamDiff : a.playerNumber - b.playerNumber;
  });
}
