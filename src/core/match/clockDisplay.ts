/**
 * Restzeit und Uhr-Hervorhebung (@ZM-139, @ZM-137, @SL-003, @SL-069, @SL-136).
 * Eine reine Funktion für Monitor, Zuschauer-Seite und (später) Cockpit.
 * Gespielte Zeit = Spielzeit im aktuellen Abschnitt. Die Uhr zählt herunter.
 */

/** Uhr-Arten je Turnier – eine Quelle für Typ und Zod-Schema (kein zweites Enum). */
export const CLOCK_MODES = ['durchlaufend-letzte-minute-angehalten', 'immer-durchlaufend', 'immer-angehalten'] as const;

export type ClockMode = (typeof CLOCK_MODES)[number];

export const DEFAULT_CLOCK_MODE: ClockMode = 'durchlaufend-letzte-minute-angehalten';

/** Länge der angehaltenen Schlussphase in Minuten (@W2A-040): wählbar 1 bis 5, vorbelegt 1. */
export const DEFAULT_FINAL_PHASE_MINUTES = 1;
export const FINAL_PHASE_MINUTES_MIN = 1;
export const FINAL_PHASE_MINUTES_MAX = 5;

export interface FinalPhaseCheck {
  valid: boolean;
  /** Gültiger Bereich in ganzen Minuten; `null`, wenn ein Abschnitt kürzer als eine Minute ist. */
  range: { min: number; max: number } | null;
}

/**
 * @W2A-040: „ist die Länge größer als ein Abschnitt, nennt die App am Feld den gültigen Bereich und
 * übernimmt den Wert nicht“ – reine Prüfung, die Anzeige baut B-08e. Bereich 1 bis
 * min(5, ganze Minuten eines Abschnitts).
 */
export function finalPhaseValid(settings: { finalPhaseMinutes: number }, sectionSeconds: number): FinalPhaseCheck {
  const max = Math.min(FINAL_PHASE_MINUTES_MAX, Math.floor(sectionSeconds / 60));
  if (max < FINAL_PHASE_MINUTES_MIN) {
    return { valid: false, range: null };
  }
  const minutes = settings.finalPhaseMinutes;
  const valid = Number.isInteger(minutes) && minutes >= FINAL_PHASE_MINUTES_MIN && minutes <= max;
  return { valid, range: { min: FINAL_PHASE_MINUTES_MIN, max } };
}

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
  /** Länge der Schlussphase in Minuten (Turnierregel `finalPhaseMinutes`), Vorgabe 1 (@SL-136, @W2A-040) */
  schlussphaseMinuten?: number;
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
  const schlussphase = (input.schlussphaseMinuten ?? DEFAULT_FINAL_PHASE_MINUTES) * 60;
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
