/**
 * useFeinerZeiger – Maus oder Trackpad am Gerät (`(hover: hover) and (pointer: fine)`), @SL-153.
 * Tastatur-Modus des Nummern-Bausteins hängt daran und an „per Taste geöffnet“, nie an der Breite (Auflage 8):
 * Ein Tablet quer ist breit, hat aber keinen feinen Zeiger.
 */
import { useEffect, useState } from 'react';

const ABFRAGE = '(hover: hover) and (pointer: fine)';

export function useFeinerZeiger(): boolean {
  const [fein, setFein] = useState((): boolean => (typeof window.matchMedia === 'function' ? window.matchMedia(ABFRAGE).matches : false));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') { return undefined; }
    const abfrage = window.matchMedia(ABFRAGE);
    const beiAenderung = (e: { matches: boolean }): void => { setFein(e.matches); };
    setFein(abfrage.matches);
    abfrage.addEventListener('change', beiAenderung);
    return () => { abfrage.removeEventListener('change', beiAenderung); };
  }, []);
  return fein;
}
