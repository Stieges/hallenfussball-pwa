/**
 * Überstandene Netzstörungen der Zuschauer-Seite mitzählen (intern, Stufe 1c; @RZ-033 bis @RZ-036,
 * docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md).
 * Reine Logik ohne React, ohne Uhr und ohne Netz: aus „erster Fehlschlag um t0, nächster gelungener Abruf um t1“ wird die Art der Störung.
 * Eine Störung ist die Folge gescheiterter Abrufe bis zum nächsten gelungenen; mehrere Fehlschläge in Folge sind EINE Störung (@RZ-033).
 * Ihre Dauer zählt ab dem letzten gelungenen Abruf (nicht ab dem ersten erkannten Fehlschlag): ein hängender Abruf wird erst nach seiner
 * Zeitüberschreitung als Fehlschlag erkannt, der Hinweis „keine Verbindung“ zählt aber schon ab dem Erfolg davor.
 * „Nichts Neues“ und „Turnier nicht gefunden“ sind keine Fehlschläge (@RZ-034) – das entscheidet der Aufrufer, hier gibt es nur Fehlschlag und Erfolg.
 * Der Stand lebt nur im Arbeitsspeicher des Aufrufers; hier wird nichts gelesen oder gespeichert (@RZ-035).
 */

/** Die zwei Arten, wie sie die Server-Funktion der Zählung als `p_art` kennt. */
export type OutageKind = 'stoerung_kurz' | 'stoerung_lang';

/**
 * Zustand einer Störung. `anchorMs` ist der Bezug der Dauer: die Zeit des LETZTEN gelungenen Abrufs dieser Sitzung der Seite – wie beim Hinweis
 * „Stand von … – keine Verbindung“ (@ZM-032), der ab dem letzten Erfolg zählt. Gab es noch keinen Erfolg, ist es der Beginn des ersten Abrufs.
 * `null` = noch nichts begonnen. `failing` = seit dem Bezug ist mindestens ein Abruf gescheitert.
 */
export interface OutageState {
  anchorMs: number | null;
  failing: boolean;
}

export const NO_OUTAGE: OutageState = { anchorMs: null, failing: false };

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

/** Ein Abruf beginnt: gab es noch keinen Bezug (erstes Laden), ist es der Beginn dieses Abrufs. */
export function noteOutageAttempt(state: OutageState, nowMs: number): OutageState {
  return state.anchorMs === null ? { anchorMs: nowMs, failing: state.failing } : state;
}

/** Ein Abruf ist gescheitert: die Störung ist offen; der Bezug bleibt der letzte Erfolg, mehrere Fehlschläge in Folge ändern ihn nicht. */
export function noteOutageFailure(state: OutageState, nowMs: number): OutageState {
  return { anchorMs: state.anchorMs ?? nowMs, failing: true };
}

/** Ein Abruf ist gelungen: war eine Störung offen, ist sie überstanden und wird einmal gemeldet; der Erfolg ist der neue Bezug. */
export function noteOutageRecovery(
  state: OutageState,
  nowMs: number,
  longAfterMs: number,
): { state: OutageState; outage: OutageKind | null } {
  const outage = state.failing && state.anchorMs !== null ? classifyOutage(nowMs - state.anchorMs, longAfterMs) : null;
  return { state: { anchorMs: nowMs, failing: false }, outage };
}

/** Die Antwort „Turnier nicht gefunden“: der Server hat geantwortet, die Folge endet ohne Meldung; die Antwort ist der neue Bezug. */
export function noteOutageAnswered(nowMs: number): OutageState {
  return { anchorMs: nowMs, failing: false };
}

/**
 * Uhr für die Dauer der Störung: monoton (`performance.now`), damit ein Zeitsprung der Geräteuhr (Abgleich mit dem Netz, Sommerzeit,
 * von Hand verstellt) die Dauer nicht verfälscht. Ohne `performance` die Geräteuhr.
 * Bekannte Unschärfe: `performance.now()` kann im Geräteschlaf je Plattform stehen bleiben, der Hinweis zählt dagegen mit der Geräteuhr.
 * Nach dem Entsperren kann die Einordnung kurz/lang daher vom Hinweis abweichen.
 */
export function monotonicNowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}
