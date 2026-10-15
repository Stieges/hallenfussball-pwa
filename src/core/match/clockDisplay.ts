/**
 * Restzeit und Uhr-Hervorhebung (@ZM-139, @ZM-137, @SL-003, @SL-069, @SL-136).
 * Eine reine Funktion für Monitor, Zuschauer-Seite und (später) Cockpit.
 * Gespielte Zeit = Spielzeit im aktuellen Abschnitt. Die Uhr zählt herunter.
 */

/** Uhr-Art je Turnier (Vorbelegung: durchlaufend, letzte Minute angehalten). */
export type ClockMode = 'durchlaufend-letzte-minute-angehalten' | 'immer-durchlaufend' | 'immer-angehalten';

export const DEFAULT_CLOCK_MODE: ClockMode = 'durchlaufend-letzte-minute-angehalten';

/** Länge der Schlussphase in Sekunden (Vorgabe: letzte Minute, bis die Turnierregel ein Feld hat). */
export const SCHLUSSPHASE_SEKUNDEN = 60;

export type ClockPhase = 'normal' | 'schlussphaseAngehalten' | 'abgelaufen';

export interface ClockDisplayInput {
  /** Gespielte Sekunden im aktuellen Abschnitt */
  gespielt: number;
  /** Länge des Abschnitts in Sekunden */
  abschnittSekunden: number;
  /** Uhr-Art des Turniers, Vorgabe siehe DEFAULT_CLOCK_MODE */
  uhrArt?: ClockMode;
  /** Spiel ist unterbrochen (Pause) */
  angehalten: boolean;
  /** Länge der Schlussphase, Vorgabe SCHLUSSPHASE_SEKUNDEN (@SL-136) */
  schlussphaseSekunden?: number;
  /** Aktueller Abschnitt, 1-basiert; fehlt er, gilt der einzige Abschnitt als letzter (@SL-069) */
  abschnitt?: number;
  /** Anzahl der Abschnitte des Spiels */
  abschnitteGesamt?: number;
  /** Spielzeit läuft in der Verlängerung; deren letzte Minute zählt als Schlussphase (@SL-081) */
  verlaengerung?: boolean;
}

export interface ClockDisplay {
  /** Restzeit in ganzen Sekunden, nie negativ */
  restSekunden: number;
  phase: ClockPhase;
  /** Hervorhebung in der angehaltenen Schlussphase (keine Teamfarbe, keine Eskalation) */
  hervorhebung: boolean;
  /** Hinweis „Uhr hält bei Unterbrechung“ */
  hinweisUhrHaelt: boolean;
  /** Zusätzlicher Hinweis „angehalten“ (nur bei unterbrochenem Spiel) */
  angehalten: boolean;
}

export function getClockDisplay(input: ClockDisplayInput): ClockDisplay {
  const uhrArt = input.uhrArt ?? DEFAULT_CLOCK_MODE;
  const schlussphase = input.schlussphaseSekunden ?? SCHLUSSPHASE_SEKUNDEN;
  const gespielt = Math.max(0, Math.floor(input.gespielt));
  const abgelaufen = gespielt >= input.abschnittSekunden;
  const restSekunden = abgelaufen ? 0 : input.abschnittSekunden - gespielt;

  if (abgelaufen) {
    return { restSekunden: 0, phase: 'abgelaufen', hervorhebung: false, hinweisUhrHaelt: false, angehalten: false };
  }

  // Schlussphase nur im letzten Abschnitt oder in der Verlängerung (@SL-069, @SL-081)
  const letzterAbschnitt = input.verlaengerung === true
    || input.abschnitt === undefined
    || input.abschnitteGesamt === undefined
    || input.abschnitt >= input.abschnitteGesamt;
  const inSchlussphase = uhrArt === 'durchlaufend-letzte-minute-angehalten'
    && letzterAbschnitt
    && restSekunden <= schlussphase;
  const phase: ClockPhase = inSchlussphase ? 'schlussphaseAngehalten' : 'normal';
  const hinweisUhrHaelt = inSchlussphase || uhrArt === 'immer-angehalten';
  const angehalten = input.angehalten && hinweisUhrHaelt;

  return {
    restSekunden,
    phase,
    hervorhebung: phase === 'schlussphaseAngehalten',
    hinweisUhrHaelt,
    angehalten,
  };
}
