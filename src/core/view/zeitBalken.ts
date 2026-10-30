/**
 * Regel des Zeitbalkens unter der Uhr – eine Quelle für Cockpit-Tafel und Hallenmonitor (@ZM-145, @ZM-166, @SL-180;
 * Daniel 25.10. „Monitor und Cockpit gleich“). Reine Funktionen, kein React.
 *
 * Der gefüllte Anteil ist der Rest durch die Länge (des Abschnitts bzw. der Pause) und nimmt mit der Restzeit ab.
 * Ton: Grün läuft, Grau angehalten, Gedämpft Pause, Violett nur in der Schlussphase der Uhr-Art „durchlaufend, letzte x
 * Minuten angehalten“ – nie Rot (Rot gehört dem Live-Abzeichen). Ist die Spielzeit abgelaufen, ist er leer; die Spur bleibt.
 */

export type ZeitBalkenTon = 'gruen' | 'grau' | 'gedaempft' | 'violett';

export interface ZeitBalkenModell {
  /** Gefüllter Anteil 0 bis 1 (Rest durch Länge) */
  anteil: number;
  ton: ZeitBalkenTon;
}

/** Farbe in der Schlussphase „durchlaufend, letzte x Minuten angehalten“: Violett wie die Uhr-Ziffern (Daniel 25.10., @ZM-166). */
export const BALKEN_TON_SCHLUSSPHASE: ZeitBalkenTon = 'violett';

function anteilOf(rest: number, laenge: number): number {
  return laenge > 0 ? Math.min(1, Math.max(0, rest / laenge)) : 0;
}

/**
 * Balken der laufenden bzw. angehaltenen Spielzeit (@ZM-145, @ZM-166). `rest` und `laenge` in derselben Einheit.
 * Abgelaufen (`rest <= 0`): leer und grün (die Spur bleibt sichtbar).
 */
export function zeitBalkenLaufend(rest: number, laenge: number, steht: boolean, schlussphase: boolean): ZeitBalkenModell {
  if (rest <= 0) { return { anteil: 0, ton: 'gruen' }; }
  return { anteil: anteilOf(rest, laenge), ton: steht ? 'grau' : schlussphase ? BALKEN_TON_SCHLUSSPHASE : 'gruen' };
}

/** Balken der Pause zwischen zwei Abschnitten: die Pausenzeit läuft gedämpft herunter (@ZM-166 „Pause · Halbzeit“). */
export function zeitBalkenPause(rest: number, laenge: number | undefined): ZeitBalkenModell {
  return { anteil: laenge === undefined ? 0 : anteilOf(rest, laenge), ton: 'gedaempft' };
}
