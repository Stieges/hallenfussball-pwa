/**
 * Text der Meldung zu einer Wahl, die nicht ankam (@SL-202, @SL-227, @SL-228, @SL-229): ein reiner Schlüssel unter `cockpit:leibchenKarte.meldung.*`.
 * - Das Gerät hielt das Feld und ein anderes hat es übernommen (OTHER_DEVICE/STALE_EPOCH mit Epoche): „nicht übernommen, bitte neu bestätigen“ (@SL-229 Zeile 4).
 * - Das Gerät hat das Feld nie gehalten (OTHER_DEVICE ohne Epoche): „Nur das steuernde Gerät kann Leibchen bestätigen.“ (@SL-227).
 */
import type { KitChoiceNotice } from '../../../core/match/client/kitChoiceQueue';

export type LeibchenMeldungKey =
  | 'nichtUebernommen' | 'nurSteuerndes' | 'zurueckgenommen' | 'anderesGeraet' | 'zuSpaet' | 'fehlgeschlagen';

export function leibchenMeldungKey(n: KitChoiceNotice): LeibchenMeldungKey {
  switch (n.kind) {
    case 'rejected':
      if (n.code === 'NOT_CONTROLLER' && n.reason === 'OTHER_DEVICE' && n.hadControl !== true) { return 'nurSteuerndes'; }
      return n.code === 'TEAMS_CHANGED' ? 'zurueckgenommen' : 'nichtUebernommen';
    case 'changedElsewhere': return 'anderesGeraet';
    case 'tooLate': return 'zuSpaet';
    case 'withdrawn': return 'zurueckgenommen';
    case 'failed': return 'fehlgeschlagen';
  }
}
