/**
 * `bekanntSeit` je Feld des Feldstands (H3b-2a, @HT-051, @HT-033 Zeile 10): Serverzeit, zu der sich der Stand eines Felds
 * zuletzt geändert hat. Über einen Fingerabdruck des Stands (`standKennung`):
 * - gleicher Fingerabdruck und gleiches Spiel → bleibt stehen, auch beim Wechsel der Quelle (Zeile 10);
 * - neue Daten vom Server für dasselbe Spiel → Serverzeit der Antwort, die sie brachte (nicht die Zeit des Lesens);
 * - neues aktuelles Spiel, Wechsel der Quelle mit anderem Stand oder Änderung der eigenen Engine → Serverzeit jetzt.
 */
import type { FeldStand } from '../../../core/hallenton';
import type { MatchState } from '../../../core/match';
import type { FeldKennung } from './aktuellesSpielJeFeld';
import { standKennung } from './feldStandSpiele';

type QuellArt = FeldStand['quelle']['art'];

interface FeldMerker {
  matchId: string;
  art: QuellArt;
  kennung: string;
  bekanntSeit: number;
}

export interface Gemerkt {
  bekanntSeit: number;
  /** Das bisher aktuelle Spiel des Felds ist jetzt zu Ende (Spielplan sofort neu lesen). */
  spielEndete: boolean;
}

export interface BekanntSeitMerker {
  merke(kennung: FeldKennung, matchId: string, art: QuellArt, state: MatchState, geaendertAt: number, now: number): Gemerkt;
  leeren(): void;
}

export function erzeugeBekanntSeitMerker(): BekanntSeitMerker {
  const merker = new Map<FeldKennung, FeldMerker>();
  return {
    merke(kennung, matchId, art, state, geaendertAt, now) {
      const stand = standKennung(state);
      const alt = merker.get(kennung);
      if (alt?.matchId === matchId && alt.kennung === stand) {
        merker.set(kennung, { ...alt, art });
        return { bekanntSeit: alt.bekanntSeit, spielEndete: false };
      }
      const ausDaten = alt?.matchId === matchId && alt.art === art && art === 'server';
      const bekanntSeit = ausDaten ? geaendertAt : now;
      merker.set(kennung, { matchId, art, kennung: stand, bekanntSeit });
      return { bekanntSeit, spielEndete: alt?.matchId === matchId && state.status === 'finished' };
    },
    leeren: () => merker.clear(),
  };
}
