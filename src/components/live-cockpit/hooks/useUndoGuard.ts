/**
 * useUndoGuard – 1-Sekunden-Sperre für „Rückgängig“ (L4, @SL-108): ein Doppeltipp nimmt nur einen Eintrag zurück,
 * ein zweiter Tipp nach der Sperre den nächstjüngeren (@SL-107). Die Sperre ist ein lokaler Schutz vor Doppeltipps,
 * keine Frist der Spiel-Uhr: dafür genügt die Gerätezeit.
 */
import { useCallback, useRef } from 'react';

/** @SL-108 */
export const UNDO_SPERRE_MS = 1000;

export function useUndoGuard(undo: () => Promise<void>): () => void {
  const zuletzt = useRef(Number.NEGATIVE_INFINITY);
  return useCallback(() => {
    const jetzt = Date.now();
    if (jetzt - zuletzt.current < UNDO_SPERRE_MS) { return; }
    zuletzt.current = jetzt;
    void undo();
  }, [undo]);
}
