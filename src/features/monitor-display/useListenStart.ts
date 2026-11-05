/**
 * Startseite einer Listen-Folie, beim Eintritt festgehalten (@ZM-190, @ZM-187).
 *
 * „Beginnt mit der Seite des laufenden oder nächsten Spiels“ gilt, wenn die Folie zu laufen beginnt: bei einem Folienwechsel und beim
 * Neubeginn des Durchlaufs auf Seite 0. Danach bleibt der Versatz stehen; ändert sich ein Spiel (Anpfiff, Abpfiff), zeigt dieselbe Seite
 * weiter dieselben Spiele, und im Durchlauf wird keine Seite doppelt oder übersprungen. Der nächste Eintritt rechnet neu.
 */
import { useState } from 'react';

interface Eintritt {
  index: number;
  page: number;
  versatz: number;
}

/** @param berechne Versatz (Index der Startseite) nach dem aktuellen Stand; wird nur beim Eintritt aufgerufen. */
export function useListenStart(index: number, page: number, berechne: () => number): number {
  const [eintritt, setEintritt] = useState<Eintritt>(() => ({ index, page, versatz: berechne() }));
  if (eintritt.index !== index || (page === 0 && eintritt.page !== 0)) {
    // neuer Eintritt: andere Folie, oder der Durchlauf beginnt wieder auf Seite 0
    setEintritt({ index, page, versatz: berechne() });
  } else if (eintritt.page !== page) {
    setEintritt({ ...eintritt, page });
  }
  return eintritt.versatz;
}
