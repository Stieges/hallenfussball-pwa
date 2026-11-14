/**
 * useAnhoeren – „Anhören“ auf diesem Gerät mit der Rückfrage aus @HT-017 und der ruhigen Zeile, wenn nichts zu hören war (H4-10, @HT-023). Ist dieses
 * Gerät Hallen-Lautsprecher für ein Feld, auf dem ein Spiel läuft, klingt „Anhören“ in der Halle: dann erst fragen, ohne Bestätigen spielt nichts.
 * Auf einem Gerät ohne Lautsprecher-Funktion (Ollis Handy) gibt es keine Rückfrage (@HT-017 Zeile 1). Kein Markup.
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AnhoerenErgebnis } from '../runtime/hallTonVorschau';
import type { ReglerArt } from '../runtime/tonEinstellungen';
import type { HallLautsprecher } from '../useHallLautsprecher';
import type { AnhoerenRueckfrage } from './useAnhoerenRueckfrage';

export interface AnhoerenZustand {
  anhoeren: (art: ReglerArt) => void;
  hinweis: { art: ReglerArt; text: string } | null;
}

export function useAnhoeren(lautsprecher: Pick<HallLautsprecher, 'felder' | 'hierAnhoeren' | 'lautstaerke' | 'stumm'>, rueckfrage: AnhoerenRueckfrage): AnhoerenZustand {
  const { t } = useTranslation('hallenton');
  const [letztes, setLetztes] = useState<{ art: ReglerArt; ergebnis: AnhoerenErgebnis } | null>(null);
  const { felder, hierAnhoeren, lautstaerke, stumm } = lautsprecher;
  const { fragen } = rueckfrage;
  const anhoeren = useCallback((art: ReglerArt): void => {
    fragen('anhoeren', felder, () => {
      void hierAnhoeren(art).then((ergebnis) => setLetztes({ art, ergebnis }));
    });
  }, [fragen, felder, hierAnhoeren]);
  let text: string | null = null;
  if (letztes?.ergebnis === 'belegt') {
    text = t('regler.belegt');
  } else if (letztes?.ergebnis === false) {
    text = stumm || lautstaerke[letztes.art] === 0 ? t('regler.nichtSpielbarNull') : t('regler.nichtSpielbar');
  }
  return { anhoeren, hinweis: letztes !== null && text !== null ? { art: letztes.art, text } : null };
}
