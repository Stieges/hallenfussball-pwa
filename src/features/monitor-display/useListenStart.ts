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
  /** Wurde der Versatz mit Daten gerechnet? Beim Kaltstart fehlen sie noch (Daten kommen asynchron). */
  mitDaten: boolean;
}

/**
 * @param berechne Versatz (Index der Startseite) nach dem aktuellen Stand, `null` solange die Daten fehlen; wird nur beim Eintritt
 *   aufgerufen und genau einmal nachgeholt, wenn der Eintritt ohne Daten geschah (Kaltstart, @ZM-190).
 */
export function useListenStart(index: number, page: number, berechne: () => number | null): number {
  const neu = (): Eintritt => {
    const versatz = berechne();
    return { index, page, versatz: versatz ?? 0, mitDaten: versatz !== null };
  };
  const [eintritt, setEintritt] = useState<Eintritt>(neu);
  if (eintritt.index !== index || (page === 0 && eintritt.page !== 0)) {
    // neuer Eintritt: andere Folie, oder der Durchlauf beginnt wieder auf Seite 0
    setEintritt(neu());
  } else if (!eintritt.mitDaten && eintritt.page === page) {
    // Kaltstart: die Daten sind jetzt da, die Folie hat noch keine andere Seite gezeigt – einmal mit Daten rechnen
    const versatz = berechne();
    if (versatz !== null) { setEintritt({ ...eintritt, versatz, mitDaten: true }); }
  } else if (eintritt.page !== page) {
    setEintritt({ ...eintritt, page, mitDaten: true });
  }
  return eintritt.versatz;
}
