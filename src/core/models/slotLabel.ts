/**
 * Anzeige einer Spielseite – die EINE Funktion (A-03, MVP-Bauplan Spur A; Vorlage V-TEAM-Plan V12).
 *
 * - Team: `team.name`, gefunden NUR über `team.id`. Eine unbekannte Team-ID zeigt `slot.unknown` –
 *   nie einen Namen aus einer anderen Quelle (kein Namens-Lookup, kein Rückfall auf `Match.teamA`).
 * - Offen: die Herkunft (Gruppenrang bzw. Sieger/Verlierer eines Spiels), @TM-015.
 * - Fehlt der Slot (Altdaten ohne `slotA`) oder das Vorgängerspiel: `slot.unknown`.
 *
 * `describeSlot` ist rein (Text oder Schlüssel + Werte), `slotLabel` übersetzt über i18next.
 */
import i18next from 'i18next';
import type { Team, TournamentGroup } from '../../types/tournament';
import type { MatchSlot } from './schemas/MatchSlotSchema';

/** Das, was die Anzeige von einem Spiel braucht, um es als Vorgänger zu benennen. */
export interface SlotLabelMatch {
  id: string;
  label?: string;
  matchNumber?: number;
}

export interface SlotLabelContext {
  teams: readonly Pick<Team, 'id' | 'name'>[];
  matches: readonly SlotLabelMatch[];
  groups?: readonly TournamentGroup[];
  locale?: 'de' | 'en';
}

/** Die Übersetzungsschlüssel der Spielseiten-Anzeige (`tournament.json`, Gruppe `slot`). */
export type SlotKey =
  | 'tournament:slot.groupRank'
  | 'tournament:slot.groupRankFallback'
  | 'tournament:slot.groupDefault'
  | 'tournament:slot.rank1'
  | 'tournament:slot.rank2'
  | 'tournament:slot.rank3'
  | 'tournament:slot.rank4'
  | 'tournament:slot.winnerOf'
  | 'tournament:slot.loserOf'
  | 'tournament:slot.matchNumber'
  | 'tournament:slot.unknown';

export type SlotDescriptionValue = string | number | SlotDescription;

/** Entweder fertiger Text (Teamname) oder ein Übersetzungsschlüssel mit Werten. */
export type SlotDescription =
  | { text: string }
  | { key: SlotKey; vars: Record<string, SlotDescriptionValue> };

/** Ordinalwörter je Rang (1–4); andere Ränge nutzen `slot.groupRankFallback`. */
const RANK_WORDS: Record<number, SlotKey | undefined> = {
  1: 'tournament:slot.rank1',
  2: 'tournament:slot.rank2',
  3: 'tournament:slot.rank3',
  4: 'tournament:slot.rank4',
};

const UNKNOWN: SlotDescription = { key: 'tournament:slot.unknown', vars: {} };

export function describeSlot(slot: MatchSlot | undefined, ctx: SlotLabelContext): SlotDescription {
  if (slot === undefined) {
    return UNKNOWN;
  }
  if (slot.kind === 'team') {
    const team = ctx.teams.find((candidate) => candidate.id === slot.teamId);
    return team === undefined ? UNKNOWN : { text: team.name };
  }
  const source = slot.source;
  if (source.kind === 'groupRank') {
    const customName = ctx.groups?.find((candidate) => candidate.id === source.group)?.customName;
    // Ohne eigenen Namen ein Schlüssel statt hartkodiertem „Gruppe X“ – DE/EN-Parität
    const group: SlotDescriptionValue = customName !== undefined && customName !== ''
      ? customName
      : { key: 'tournament:slot.groupDefault', vars: { id: source.group } };
    const rankKey = RANK_WORDS[source.rank];
    return rankKey === undefined
      ? { key: 'tournament:slot.groupRankFallback', vars: { rank: source.rank, group } }
      : { key: 'tournament:slot.groupRank', vars: { rankWord: { key: rankKey, vars: {} }, group } };
  }
  const previous = ctx.matches.find((candidate) => candidate.id === source.matchId);
  if (previous === undefined) {
    return UNKNOWN;
  }
  let match: SlotDescriptionValue;
  if (previous.label !== undefined && previous.label !== '') {
    match = previous.label;
  } else if (previous.matchNumber !== undefined) {
    match = { key: 'tournament:slot.matchNumber', vars: { number: previous.matchNumber } };
  } else {
    return UNKNOWN;
  }
  return {
    key: source.role === 'winner' ? 'tournament:slot.winnerOf' : 'tournament:slot.loserOf',
    vars: { match },
  };
}

function translate(description: SlotDescription, locale: 'de' | 'en' | undefined): string {
  if ('text' in description) {
    return description.text;
  }
  const vars: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(description.vars)) {
    vars[name] = typeof value === 'object' ? translate(value, locale) : value;
  }
  return i18next.t(description.key, { ...vars, ...(locale ? { lng: locale } : {}) });
}

/** Übersetzter Anzeigetext einer Spielseite. */
export function slotLabel(slot: MatchSlot | undefined, ctx: SlotLabelContext): string {
  return translate(describeSlot(slot, ctx), ctx.locale);
}

/** Teamname zu einer Team-ID (z. B. für Team-ID-Listen wie Export-Filter); unbekannt → `slot.unknown`. */
export function teamDisplayName(
  teams: readonly Pick<Team, 'id' | 'name'>[],
  teamId: string,
  locale?: 'de' | 'en',
): string {
  const team = teams.find((candidate) => candidate.id === teamId);
  return team === undefined ? translate(UNKNOWN, locale) : team.name;
}
