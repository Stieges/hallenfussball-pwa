/**
 * Anzeige einer Spielseite – die EINE Funktion (A-03, MVP-Bauplan Spur A; Vorlage V-TEAM-Plan V12).
 *
 * - Team: `team.name`, gefunden NUR über `team.id`. Eine unbekannte Team-ID zeigt `slot.unknown` –
 *   nie einen Namen aus einer anderen Quelle (kein Namens-Lookup, kein Rückfall auf das Übergangsfeld am Spiel).
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
  | 'tournament:slot.unknown'
  | 'tournament:slot.playoffFinal'
  | 'tournament:slot.playoffSemifinal'
  | 'tournament:slot.playoffQuarterfinal'
  | 'tournament:slot.playoffRoundOf16'
  | 'tournament:slot.playoffPlace'
  | 'tournament:slot.awaitGroup'
  | 'tournament:slot.awaitMatch';

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

/**
 * Bezeichnungen, die der Playoff-Generator erzeugt (`Match.label`, deutscher Text in der Datenhaltung).
 * Die Anzeige übersetzt sie über Schlüssel + Nummer (K1-Rest, A-04a), damit EN keine deutschen Teile zeigt.
 * Eigene, von der Leitung vergebene Bezeichnungen bleiben unverändert.
 */
const PLAYOFF_LABELS: ReadonlyArray<{ pattern: RegExp; key: SlotKey }> = [
  { pattern: /^Finale$/, key: 'tournament:slot.playoffFinal' },
  { pattern: /^(\d+)\. Halbfinale$/, key: 'tournament:slot.playoffSemifinal' },
  { pattern: /^Viertelfinale (\d+)$/, key: 'tournament:slot.playoffQuarterfinal' },
  { pattern: /^Achtelfinale (\d+)$/, key: 'tournament:slot.playoffRoundOf16' },
  { pattern: /^Spiel um Platz (\d+)$/, key: 'tournament:slot.playoffPlace' },
];

/** Bezeichnung eines Spiels als Text (eigene Bezeichnung) oder Schlüssel + Nummer (Generator-Bezeichnung). */
export function describeMatchLabel(label: string): SlotDescription {
  for (const { pattern, key } of PLAYOFF_LABELS) {
    const found = pattern.exec(label);
    if (found !== null) {
      return { key, vars: found[1] === undefined ? {} : { n: Number(found[1]) } };
    }
  }
  return { text: label };
}

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
    const group = describeGroup(source.group, ctx);
    const rankKey = RANK_WORDS[source.rank];
    return rankKey === undefined
      ? { key: 'tournament:slot.groupRankFallback', vars: { rank: source.rank, group } }
      : { key: 'tournament:slot.groupRank', vars: { rankWord: { key: rankKey, vars: {} }, group } };
  }
  const match = describePreviousMatch(source.matchId, ctx);
  if (match === undefined) {
    return UNKNOWN;
  }
  return {
    key: source.role === 'winner' ? 'tournament:slot.winnerOf' : 'tournament:slot.loserOf',
    vars: { match },
  };
}

/** Gruppenname: eigener Name oder Standardname über Schlüssel – DE/EN-Parität. */
function describeGroup(groupId: string, ctx: SlotLabelContext): SlotDescriptionValue {
  const customName = ctx.groups?.find((candidate) => candidate.id === groupId)?.customName;
  return customName !== undefined && customName !== ''
    ? customName
    : { key: 'tournament:slot.groupDefault', vars: { id: groupId } };
}

/** Bezeichnung des Vorgängerspiels (Bezeichnung, sonst Spielnummer); unbekanntes Spiel → `undefined`. */
function describePreviousMatch(matchId: string, ctx: SlotLabelContext): SlotDescriptionValue | undefined {
  const previous = ctx.matches.find((candidate) => candidate.id === matchId);
  if (previous === undefined) {
    return undefined;
  }
  if (previous.label !== undefined && previous.label !== '') {
    return describeMatchLabel(previous.label);
  }
  if (previous.matchNumber !== undefined) {
    return { key: 'tournament:slot.matchNumber', vars: { number: previous.matchNumber } };
  }
  return undefined;
}

/**
 * Wartegrund einer offenen Seite (@TM-033): was abgeschlossen sein muss, bevor die Seite besetzt ist –
 * „Abschluss von Gruppe B“ bzw. „Abschluss von <Vorgängerspiel>“. Besetzte Seite → `undefined`.
 */
export function describeAwaiting(slot: MatchSlot | undefined, ctx: SlotLabelContext): SlotDescription | undefined {
  if (slot === undefined || slot.kind === 'team') {
    return undefined;
  }
  if (slot.source.kind === 'groupRank') {
    return { key: 'tournament:slot.awaitGroup', vars: { group: describeGroup(slot.source.group, ctx) } };
  }
  const match = describePreviousMatch(slot.source.matchId, ctx);
  return match === undefined ? UNKNOWN : { key: 'tournament:slot.awaitMatch', vars: { match } };
}

/** Übersetzter Wartegrund; `undefined`, wenn die Seite besetzt ist. */
export function awaitingLabel(slot: MatchSlot | undefined, ctx: SlotLabelContext): string | undefined {
  const description = describeAwaiting(slot, ctx);
  return description === undefined ? undefined : translate(description, ctx.locale);
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

/** Übersetzte Spielbezeichnung (z. B. „1. Halbfinale“ / „Semifinal 1“). */
export function matchLabelText(label: string, locale?: 'de' | 'en'): string {
  return translate(describeMatchLabel(label), locale);
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
