/**
 * Überstandene Netzstörungen der Zuschauer-Seite mitzählen (intern, Stufe 1c; @RZ-033 bis @RZ-036,
 * docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md).
 * Reine Logik ohne React, ohne Uhr und ohne Netz: aus „erster Fehlschlag um t0, nächster gelungener Abruf um t1“ wird die Art der Störung.
 * Eine Störung ist die Folge gescheiterter Abrufe bis zum nächsten gelungenen; mehrere Fehlschläge in Folge sind EINE Störung (@RZ-033).
 * „Nichts Neues“ und „Turnier nicht gefunden“ sind keine Fehlschläge (@RZ-034) – das entscheidet der Aufrufer, hier gibt es nur Fehlschlag und Erfolg.
 * Der Stand lebt nur im Arbeitsspeicher des Aufrufers; hier wird nichts gelesen oder gespeichert (@RZ-035).
 */

/** Die zwei Arten, wie sie die Server-Funktion der Zählung als `p_art` kennt. */
export type OutageKind = 'stoerung_kurz' | 'stoerung_lang';

/** Seit wann scheitern die Abrufe (Zeit der Uhr des Aufrufers in ms); `null` = keine laufende Störung. */
export interface OutageState {
  failingSinceMs: number | null;
}

export const NO_OUTAGE: OutageState = { failingSinceMs: null };

/** Eine überstandene Störung, die gemeldet werden soll – genau einmal (`id` steigt je Seite um 1). */
export interface RecoveredOutage {
  id: number;
  /** Das Turnier, in dem die Störung stattfand */
  shareCode: string;
  kind: OutageKind;
}

/**
 * Art der Störung nach der Dauer ohne gelungenen Abruf: unter `longAfterMs` kurz, ab `longAfterMs` lang. Die Frist ist dieselbe wie die
 * des Hinweises „Stand von … – keine Verbindung“ (@ZM-032); der Aufrufer reicht sie herein (die Konstante liegt in der Oberfläche).
 * Eine negative Dauer (Uhr zurückgestellt) gilt als 0.
 */
export function classifyOutage(durationMs: number, longAfterMs: number): OutageKind {
  return Math.max(0, durationMs) >= longAfterMs ? 'stoerung_lang' : 'stoerung_kurz';
}

/** Ein Abruf ist gescheitert: die Störung beginnt beim ERSTEN Fehlschlag, weitere ändern den Beginn nicht. */
export function noteOutageFailure(state: OutageState, nowMs: number): OutageState {
  return state.failingSinceMs === null ? { failingSinceMs: nowMs } : state;
}

/** Ein Abruf ist gelungen: war eine Störung offen, ist sie überstanden und wird einmal gemeldet; danach gibt es keine mehr. */
export function noteOutageRecovery(
  state: OutageState,
  nowMs: number,
  longAfterMs: number,
): { state: OutageState; outage: OutageKind | null } {
  if (state.failingSinceMs === null) {
    return { state, outage: null };
  }
  return { state: NO_OUTAGE, outage: classifyOutage(nowMs - state.failingSinceMs, longAfterMs) };
}

/**
 * Uhr für die Dauer der Störung: monoton (`performance.now`), damit ein Zeitsprung der Geräteuhr (Abgleich mit dem Netz, Sommerzeit,
 * von Hand verstellt) die Dauer nicht verfälscht. Ohne `performance` die Geräteuhr.
 */
export function monotonicNowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}
