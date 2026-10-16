/**
 * Typisierte Fehler fuer den Schreibweg (C3a-2a, W6): werden vom Hook gefangen und als Toast
 * gezeigt (`useToast().showWarning`/`showError`) -- nie ungefangen in die UI geworfen (Ruling
 * W6, ersetzt "werfen" in PC14/RC1).
 */

/** PC14: eine Aktion, die fuer Engine-Spiele in diesem Schritt noch nicht umgestellt ist
 * (RETRACT/AMEND/Halbzeit/Verlaengerung/Strafstoss/Reopen/Direkteintrag/Skip/…). */
export class NotOnEngineYetError extends Error {
  constructor() {
    super('Diese Aktion folgt in einem späteren Schritt.');
    this.name = 'NotOnEngineYetError';
  }
}
