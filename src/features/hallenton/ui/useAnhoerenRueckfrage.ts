/**
 * useAnhoerenRueckfrage – die Rückfrage vor einem Ton, der in der Halle stören könnte (H4-10, @HT-017): läuft auf einem betroffenen Feld ein
 * angepfiffenes Spiel, fragt die App „Auf Feld 1 läuft Spiel 11. … trotzdem …?“, und ohne Bestätigen passiert nichts. Ohne laufendes Spiel
 * läuft die Aktion sofort, ohne Frage. Betroffen: bei „Testton in der Halle“ das eine Feld, bei „Anhören“ die Felder dieses Geräts
 * (ist es Hallen-Lautsprecher, klingt es in der Halle). Die Aktion läuft synchron im Klick der Bestätigung (Nutzergeste für den Ton).
 */
import { useCallback, useState } from 'react';

export type RueckfrageArt = 'anhoeren' | 'testton';

export interface LaufendesSpiel {
  feld: number;
  spiel: number;
}

export interface OffeneRueckfrage {
  art: RueckfrageArt;
  laufende: readonly LaufendesSpiel[];
}

/** Die angepfiffenen Spiele auf den betroffenen Feldern, nach Feld sortiert. */
export function laufendeAufFeldern(laufend: ReadonlyMap<number, number>, felder: readonly number[]): LaufendesSpiel[] {
  return [...new Set(felder)].sort((a, b) => a - b).flatMap((feld) => {
    const spiel = laufend.get(feld);
    return spiel === undefined ? [] : [{ feld, spiel }];
  });
}

export interface AnhoerenRueckfrage {
  frage: OffeneRueckfrage | null;
  /** Fragt, wenn auf einem der `felder` ein Spiel läuft, sonst läuft `aktion` sofort. */
  fragen: (art: RueckfrageArt, felder: readonly number[], aktion: () => void) => void;
  ja: () => void;
  nein: () => void;
}

export function useAnhoerenRueckfrage(laufend: ReadonlyMap<number, number>): AnhoerenRueckfrage {
  const [offen, setOffen] = useState<{ frage: OffeneRueckfrage; aktion: () => void } | null>(null);
  const fragen = useCallback((art: RueckfrageArt, felder: readonly number[], aktion: () => void): void => {
    const laufende = laufendeAufFeldern(laufend, felder);
    if (laufende.length === 0) {
      aktion();
    } else {
      setOffen({ frage: { art, laufende }, aktion });
    }
  }, [laufend]);
  const ja = useCallback((): void => {
    const a = offen;
    setOffen(null);
    a?.aktion();
  }, [offen]);
  const nein = useCallback((): void => setOffen(null), []);
  return { frage: offen?.frage ?? null, fragen, ja, nein };
}
