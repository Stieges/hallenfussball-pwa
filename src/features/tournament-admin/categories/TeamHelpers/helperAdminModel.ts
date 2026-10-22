/**
 * Reine Hilfsfunktionen der Seite „Team & Helfer“ (A-18a): Zahlknöpfe fürs Zulassen (S-1), Hinweise zu gleichen Namen
 * (S-2, @HE-021, @HE-106), Zeilentexte der Helfer-Übersicht (@HE-052, @HE-049). Kein React, kein Netz.
 *
 * Szenarien: @HE-021 @HE-052 @HE-075 @HE-077 @HE-105 @HE-106.
 */
import type { HelperAccessList } from '../../../../core/repositories/helperAccessRpc';

export type JoinRequestRow = HelperAccessList['requests'][number];
export type HelperMemberRow = HelperAccessList['members'][number];

export const CHECK_NUMBER_MIN = 10;
export const CHECK_NUMBER_MAX = 99;
/** S-1: vier Zahlknöpfe, genau einer gehört zur Anfrage. */
export const CHECK_NUMBER_CHOICES = 4;

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Kleiner, fester Zufallsstrom (mulberry32): gleiche Anfrage, gleiche Knöpfe – auch nach jedem 2-s-Abruf. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Die vier Zahlen des Zulassen-Blatts (S-1, @HE-105): die Prüfzahl der Anfrage plus drei andere Zahlen von 10 bis 99,
 * aufsteigend sortiert – so verrät die Stelle der richtigen Zahl nichts. Die Wahl hängt nur von Anfrage und Zahl ab
 * (stabil über alle Abrufe). Die Entscheidung trifft der Server, nie diese Liste.
 */
export function checkNumberChoices(requestId: string, correct: number): number[] {
  const random = seededRandom(hashSeed(requestId));
  const chosen = new Set<number>([correct]);
  const span = CHECK_NUMBER_MAX - CHECK_NUMBER_MIN + 1;
  while (chosen.size < CHECK_NUMBER_CHOICES) {
    chosen.add(CHECK_NUMBER_MIN + Math.floor(random() * span));
  }
  return [...chosen].sort((a, b) => a - b);
}

/** Namen, die mehrere offene Anfragen tragen („2 Anfragen mit dem Namen Tom“, @HE-021), je Name einmal. */
export function duplicateNames(requests: readonly JoinRequestRow[]): Array<{ name: string; count: number }> {
  const seen = new Map<string, { name: string; count: number }>();
  for (const r of requests) {
    const key = r.name.trim().toLowerCase();
    if (r.sameNamePending > 1 && !seen.has(key)) {
      seen.set(key, { name: r.name.trim(), count: r.sameNamePending });
    }
  }
  return [...seen.values()];
}

export type RequestMark =
  | { kind: 'member'; name: string; deviceLabel: string | null }
  | { kind: 'declined'; name: string; at: string };

/** S-2/@HE-106: Hinweise an einer Anfrage mit bekanntem Namen (schon zugelassen, schon abgelehnt). */
export function requestMarks(request: JoinRequestRow): RequestMark[] {
  const marks: RequestMark[] = [];
  const name = request.name.trim();
  if (request.sameNameMember !== null) {
    marks.push({ kind: 'member', name, deviceLabel: request.sameNameMember.deviceLabel });
  }
  if (request.sameNameDeclinedAt !== null) {
    marks.push({ kind: 'declined', name, at: request.sameNameDeclinedAt });
  }
  return marks;
}

/** Uhrzeit „14:02“ in der Ortszeit des Turniers (Deutschland), unabhängig von der Zeitzone des Geräts. */
export function formatClock(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Berlin' }).format(date);
}

/** „Sa 28.11.“ des letzten Tages, an dem der Code gilt: der Server liefert 00:00 Uhr des Folgetages (R-GA5-3). */
export function formatValidDay(validUntil: string, locale: string): string {
  const cutoff = new Date(validUntil);
  if (Number.isNaN(cutoff.getTime())) {
    return '';
  }
  const lastMinute = new Date(cutoff.getTime() - 60_000);
  // „Sa., 28.11.“ → „Sa 28.11.“ wie im Mockup (kein Komma, kein Punkt hinter dem Wochentag)
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'Europe/Berlin' }).format(lastMinute).replace(/^(\S+?)\.?,\s*/, '$1 ');
}

export type HelperStatus = { kind: 'controls' } | { kind: 'seen'; at: string } | { kind: 'unseen' };

export interface HelperRowModel {
  memberId: string;
  name: string;
  field: number | null;
  status: HelperStatus;
  deviceLabel: string | null;
  viewerOnly: boolean;
  revoked: boolean;
}

/** Zeile der Helfer-Übersicht: „Tom – Feld 2 – steuert“, „Clara – ohne Feld – zuletzt 12:03“ (@HE-052). */
export function helperRowModel(member: HelperMemberRow): HelperRowModel {
  let status: HelperStatus = { kind: 'unseen' };
  if (member.controls.length > 0) {
    status = { kind: 'controls' };
  } else if (member.lastSeenAt !== null) {
    status = { kind: 'seen', at: member.lastSeenAt };
  }
  return {
    memberId: member.memberId,
    name: (member.name ?? '').trim(),
    field: member.field,
    status,
    deviceLabel: member.deviceLabel,
    viewerOnly: member.mode === 'viewer',
    revoked: member.revokedAt !== null,
  };
}

/** Aktive Zugänge zuerst (Reihenfolge der Zulassung), entzogene danach – sie bleiben sichtbar, nie gelöscht (R-GA5-10). */
export function sortedHelperRows(members: readonly HelperMemberRow[]): HelperRowModel[] {
  const rows = members.map(helperRowModel);
  return [...rows.filter((r) => !r.revoked), ...rows.filter((r) => r.revoked)];
}
