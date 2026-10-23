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

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

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

/** M2/M10: Sidebar-Limit in Anzeige-Reihenfolge (neueste zuerst). Zaehlt nur wirksame
 *  Eintraege — zurueckgenommene verdraengen keine. U5: Zurueckgenommene erscheinen nur
 *  im Zeitfenster der gezeigten wirksamen Eintraege, sichtbar ab dem Zeitstempel des
 *  aeltesten gezeigten wirksamen Eintrags (>=). Ohne gezeigte wirksame Eintraege
 *  erscheinen keine Zurueckgenommenen. Reihenfolge bleibt stabil. */
export function takeRecent(entries: readonly ProtocolEntry[], maxEffective: number): ProtocolEntry[] {
  const shownEffective: ProtocolEntry[] = [];
  for (const entry of entries) {
    if (!entry.retracted && shownEffective.length < maxEffective) {
      shownEffective.push(entry);
    }
  }
  if (shownEffective.length === 0) {
    return [];
  }
  let cutoff = shownEffective[0].event.timestampSeconds;
  for (const entry of shownEffective) {
    cutoff = Math.min(cutoff, entry.event.timestampSeconds);
  }
  return entries.filter(
    (entry) =>
      (!entry.retracted && shownEffective.includes(entry)) ||
      (entry.retracted && entry.event.timestampSeconds >= cutoff),
  );
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
