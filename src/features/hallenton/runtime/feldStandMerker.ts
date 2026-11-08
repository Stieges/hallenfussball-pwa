/**
 * `bekanntSeit` je Feld des Feldstands (H3b-2a, @HT-051): Serverzeit, zu der sich der Stand eines Felds zuletzt geändert hat.
 * Über einen Fingerabdruck des Stands (`standKennung`):
 * - gleicher Fingerabdruck und gleiches Spiel → bleibt stehen;
 * - neue Daten vom Server für dasselbe Spiel → Serverzeit der Antwort, die sie brachte (nicht die Zeit des Lesens);
 * - neues aktuelles Spiel → Serverzeit jetzt.
 */
import type { MatchState } from '../../../core/match';
import type { FeldKennung } from './aktuellesSpielJeFeld';
import { standKennung } from './feldStandSpiele';

interface FeldMerker {
  matchId: string;
  kennung: string;
  bekanntSeit: number;
}

export interface Gemerkt {
  bekanntSeit: number;
  /** Das bisher aktuelle Spiel des Felds ist jetzt zu Ende (Spielplan sofort neu lesen). */
  spielEndete: boolean;
}

export interface BekanntSeitMerker {
  merke(kennung: FeldKennung, matchId: string, state: MatchState, geaendertAt: number, now: number): Gemerkt;
  leeren(): void;
}

export function erzeugeBekanntSeitMerker(): BekanntSeitMerker {
  const merker = new Map<FeldKennung, FeldMerker>();
  return {
    merke(kennung, matchId, state, geaendertAt, now) {
      const stand = standKennung(state);
      const alt = merker.get(kennung);
      if (alt?.matchId === matchId && alt.kennung === stand) {
        return { bekanntSeit: alt.bekanntSeit, spielEndete: false };
      }
      const bekanntSeit = alt?.matchId === matchId ? geaendertAt : now;
      merker.set(kennung, { matchId, kennung: stand, bekanntSeit });
      return { bekanntSeit, spielEndete: alt?.matchId === matchId && state.status === 'finished' };
    },
    leeren: () => merker.clear(),
  };
}
