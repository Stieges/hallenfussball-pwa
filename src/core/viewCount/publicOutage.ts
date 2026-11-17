/**
 * Überstandene Netzstörungen der Zuschauer-Seite mitzählen (intern, Stufe 1c; @RZ-033 bis @RZ-036,
 * docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md).
 * Reine Logik ohne React, ohne Uhr und ohne Netz: aus der Zahl der gescheiterten Abrufe in Folge wird die Art der Störung.
 * Eine Störung ist die Folge gescheiterter Abrufe bis zum nächsten gelungenen; mehrere Fehlschläge in Folge sind EINE Störung (@RZ-033).
 * „Lang“ heißt mindestens zwei gescheiterte Abrufe in Folge, sonst „kurz“: ein einzelner Aussetzer ist immer kurz, auch wenn der Abruf lange hing.
 * „Nichts Neues“ und „Turnier nicht gefunden“ sind keine Fehlschläge (@RZ-034) – das entscheidet der Aufrufer, hier gibt es nur Fehlschlag und Erfolg.
 * Der Stand lebt nur im Arbeitsspeicher des Aufrufers; hier wird nichts gelesen oder gespeichert (@RZ-035).
 */

/** Die zwei Arten, wie sie die Server-Funktion der Zählung als `p_art` kennt. */
export type OutageKind = 'stoerung_kurz' | 'stoerung_lang';

/** Ab so vielen gescheiterten Abrufen in Folge ist die Störung lang (@RZ-033). */
export const LONG_OUTAGE_FAILURES = 2;

/** Zustand einer Störung: `failures` = gescheiterte Abrufe in Folge seit dem letzten Erfolg (0 = keine Störung offen). */
export interface OutageState {
  failures: number;
}

export const NO_OUTAGE: OutageState = { failures: 0 };

/** Eine überstandene Störung, die gemeldet werden soll – genau einmal (`id` steigt je Seite um 1). */
export interface RecoveredOutage {
  id: number;
  /** Das Turnier, in dem die Störung stattfand */
  shareCode: string;
  kind: OutageKind;
}

/** Art der Störung nach der Zahl gescheiterter Abrufe in Folge: ab zwei lang, sonst kurz. */
export function classifyOutage(failures: number): OutageKind {
  return failures >= LONG_OUTAGE_FAILURES ? 'stoerung_lang' : 'stoerung_kurz';
}

/** Ein Abruf (ein ganzer Durchlauf, auch mit zweitem Versuch) ist gescheitert: die Störung ist offen oder wird länger. */
export function noteOutageFailure(state: OutageState): OutageState {
  return { failures: state.failures + 1 };
}

/** Ein Abruf ist gelungen: war eine Störung offen, ist sie überstanden und wird einmal gemeldet; danach beginnt die Zählung von vorn. */
export function noteOutageRecovery(state: OutageState): { state: OutageState; outage: OutageKind | null } {
  return { state: NO_OUTAGE, outage: state.failures > 0 ? classifyOutage(state.failures) : null };
}

/** Die Antwort „Turnier nicht gefunden“: der Server hat geantwortet, die Folge endet ohne Meldung. */
export function noteOutageAnswered(): OutageState {
  return NO_OUTAGE;
}
