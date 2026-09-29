/**
 * protocolEntries (C3b-1, G6): fuegt wirksame und zurueckgenommene Ereignisse fuer die Protokoll-
 * Anzeige zusammen. Reine Anzeige-Hilfe -- `LiveMatch.events` bleibt ohne Zurueckgenommenes, nur
 * EventLog-Ansichten (Sidebar, EventLogBottomSheet) lesen `retractedEvents`.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import type { RuntimeMatchEvent } from '../../../types/tournament';

export interface ProtocolEntry {
  event: RuntimeMatchEvent;
  retracted: boolean;
}

/** Nach Spielzeit aufsteigend; bei gleicher Sekunde stehen wirksame Eintraege vor zurueckgenommenen.
 *  Ohne Zurueckgenommenes bleibt die Log-/Array-Reihenfolge (M2: kein Umsortieren von Altspielen). */
export function mergeProtocol(
  events: readonly RuntimeMatchEvent[],
  retractedEvents: readonly RuntimeMatchEvent[] = [],
): ProtocolEntry[] {
  const entries: ProtocolEntry[] = [
    ...events.map((event) => ({ event, retracted: false })),
    ...retractedEvents.map((event) => ({ event, retracted: true })),
  ];
  if (retractedEvents.length === 0) {
    return entries;
  }
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.event.timestampSeconds - b.entry.event.timestampSeconds || a.index - b.index)
    .map(({ entry }) => entry);
}

/** M2: Sidebar-Limit in Anzeige-Reihenfolge (neueste zuerst). Zaehlt nur wirksame Eintraege —
 *  zurueckgenommene verdraengen keine und bleiben vollstaendig sichtbar. */
export function takeRecent(entries: readonly ProtocolEntry[], maxEffective: number): ProtocolEntry[] {
  const recent: ProtocolEntry[] = [];
  let effectiveCount = 0;
  for (const entry of entries) {
    if (entry.retracted) {
      recent.push(entry);
    } else if (effectiveCount < maxEffective) {
      recent.push(entry);
      effectiveCount += 1;
    }
  }
  return recent;
}

/** Zurückgenommener Eintrag: ausgegraut + durchgestrichen. */
export const retractedRowStyle: CSSProperties = {
  textDecoration: 'line-through',
  color: cssVars.colors.textMuted,
  opacity: 0.7,
};

/** Kennwort "zurückgenommen": nicht durchgestrichen, damit es lesbar bleibt. */
export const retractedMarkStyle: CSSProperties = {
  display: 'inline-block',
  textDecoration: 'none',
  fontStyle: 'italic',
  marginLeft: cssVars.spacing.xs,
};
