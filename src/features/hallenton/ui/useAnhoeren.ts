/**
 * useAnhoeren – „Anhören“ auf diesem Gerät mit der Rückfrage aus @HT-017 und der ruhigen Zeile, wenn nichts zu hören war (H4-10, @HT-023). Ist dieses
 * Gerät Hallen-Lautsprecher für ein Feld, auf dem ein Spiel läuft, klingt „Anhören“ in der Halle: dann erst fragen, ohne Bestätigen spielt nichts.
 * Auf einem Gerät ohne Lautsprecher-Funktion (Ollis Handy) gibt es keine Rückfrage (@HT-017 Zeile 1). Jede Taste hat ihre eigene Zeile: was
 * „Hier anhören“ meldet, steht bei dieser Taste (`quelle: 'hier'`), was ein Regler meldet, bei diesem Regler (`quelle: 'regler'`). Kein Markup.
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AnhoerenErgebnis } from '../runtime/hallTonVorschau';
import type { ReglerArt } from '../runtime/tonEinstellungen';
import type { HallLautsprecher } from '../useHallLautsprecher';
import type { AnhoerenRueckfrage } from './useAnhoerenRueckfrage';

export type AnhoerenQuelle = 'regler' | 'hier';

export interface AnhoerenZustand {
  anhoeren: (art: ReglerArt, quelle: AnhoerenQuelle) => void;
  /** Zeile unter dem Regler `art` (nur, was von diesem Regler kam), sonst `null`. */
  hinweis: { art: ReglerArt; text: string } | null;
  /** Zeile unter „Hier anhören“ (nur, was von dieser Taste kam), sonst `null`. */
  hierHinweis: string | null;
}

export function useAnhoeren(lautsprecher: Pick<HallLautsprecher, 'felder' | 'hierAnhoeren' | 'lautstaerke'>, rueckfrage: AnhoerenRueckfrage): AnhoerenZustand {
  const { t } = useTranslation('hallenton');
  const [letztes, setLetztes] = useState<{ art: ReglerArt; quelle: AnhoerenQuelle; ergebnis: AnhoerenErgebnis } | null>(null);
  const { felder, hierAnhoeren, lautstaerke } = lautsprecher;
  const { fragen } = rueckfrage;
  const anhoeren = useCallback((art: ReglerArt, quelle: AnhoerenQuelle): void => {
    fragen('anhoeren', felder, () => {
      void hierAnhoeren(art).then((ergebnis) => setLetztes({ art, quelle, ergebnis }));
    });
  }, [fragen, felder, hierAnhoeren]);
  let text: string | null = null;
  if (letztes?.ergebnis === 'belegt') {
    text = t('regler.belegt');
  } else if (letztes?.ergebnis === false) {
    text = lautstaerke[letztes.art] === 0 ? t('regler.nichtSpielbarNull') : t('regler.nichtSpielbar');
  }
  return {
    anhoeren,
    hinweis: letztes?.quelle === 'regler' && text !== null ? { art: letztes.art, text } : null,
    hierHinweis: letztes?.quelle === 'hier' ? text : null,
  };
}
