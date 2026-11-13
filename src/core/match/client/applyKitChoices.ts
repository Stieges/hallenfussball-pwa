/**
 * Die lokale Wahl der Leibchen über der Turnierkopie (Leibchen 2b, Punkt 3): `applyKitChoices` legt die Einträge der `KitChoiceQueue` auf die Spiele,
 * damit Toms Cockpit die Wahl sofort zeigt (auch ohne Netz), und `kitRowStateOf` liest, was die Zeile des Spiels (Server) zur Wahl sagt.
 * Rein, framework-frei. Referenzstabil: ändert sich nichts, kommt dasselbe Objekt zurück.
 *
 * Wie `match_kit_set` die Zeile schreibt:
 * - vor dem Anpfiff: `bib` → nur die Leibchen-Seite trägt Farbe (`bibSide` + Leibchenfarbe an dieser Seite), `none` → kein `kit`; `kitDecision` entsprechend;
 * - im laufenden Spiel: beide Seiten tragen eine festgehaltene Farbe, die Seite mit neuem Leibchen die Leibchenfarbe, eine Seite, die ihr Leibchen verliert,
 *   ihre Teamfarbe, die übrige Seite behält ihre;
 * - beendet oder ausgefallen: nichts (der Server weist ab).
 */
import type { Match, Team } from '../../../types/tournament';
import { compactKit, normalizeKitColor, type KitSide, type MatchKit } from '../../models/kit';
import { trikotFarben } from '../../models/kitChoice';
import { slotTeamId } from '../../models/matchSlot';
import type { KitChoiceEntry, KitRowState } from './kitChoiceQueue';

type ChoosableMatch = Pick<Match, 'id' | 'slotA' | 'slotB' | 'matchStatus' | 'kit' | 'kitDecision'>;

const NOT_KICKED_OFF = new Set<Match['matchStatus']>([undefined, 'scheduled', 'skipped']);

function liveKit(match: ChoosableMatch, entry: KitChoiceEntry, teams: readonly Pick<Team, 'id' | 'colors'>[]): MatchKit {
  const trikot = trikotFarben(match, teams);
  const old = match.kit;
  const bibColor = normalizeKitColor(entry.bibColor);
  const colorOf = (side: KitSide): string | undefined => {
    if (entry.decision === 'bib' && entry.bibSide === side) {
      return bibColor;
    }
    return old?.bibSide === side ? trikot[side] : old?.[side];
  };
  return compactKit({ a: colorOf('a'), b: colorOf('b'), ...(entry.decision === 'bib' && entry.bibSide !== undefined ? { bibSide: entry.bibSide } : {}) });
}

function beforeKit(entry: KitChoiceEntry): MatchKit | undefined {
  const bibColor = normalizeKitColor(entry.bibColor);
  if (entry.decision !== 'bib' || entry.bibSide === undefined || bibColor === undefined) {
    return undefined;
  }
  return compactKit({ [entry.bibSide]: bibColor, bibSide: entry.bibSide });
}

function sameKit(left: MatchKit | undefined, right: MatchKit | undefined): boolean {
  return left?.a === right?.a && left?.b === right?.b && left?.bibSide === right?.bibSide && (left === undefined) === (right === undefined);
}

function applyOne<T extends ChoosableMatch>(match: T, entry: KitChoiceEntry, teams: readonly Pick<Team, 'id' | 'colors'>[]): T {
  if (match.matchStatus === 'finished' || match.matchStatus === 'skipped') {
    return match;
  }
  const kicked = !NOT_KICKED_OFF.has(match.matchStatus);
  const kit = kicked ? liveKit(match, entry, teams) : beforeKit(entry);
  if (sameKit(match.kit, kit) && match.kitDecision === entry.decision) {
    return match;
  }
  const rest: Partial<ChoosableMatch> = { ...match };
  delete rest.kit;
  return { ...rest, kitDecision: entry.decision, ...(kit === undefined ? {} : { kit }) } as T;
}

/** Die Einträge (höchstens einer je Spiel) auf die Spiele des Turniers; ohne passenden Eintrag dasselbe Objekt. */
export function applyKitChoices<TTournament extends { matches: ChoosableMatch[]; teams: readonly Pick<Team, 'id' | 'colors'>[] }>(
  tournament: TTournament,
  entries: readonly KitChoiceEntry[],
): TTournament {
  if (entries.length === 0) {
    return tournament;
  }
  const byMatch = new Map(entries.map((entry) => [entry.matchId, entry]));
  let changed = false;
  const matches = tournament.matches.map((match) => {
    const entry = byMatch.get(match.id);
    if (entry === undefined) {
      return match;
    }
    const next = applyOne(match, entry, tournament.teams);
    changed ||= next !== match;
    return next;
  });
  return changed ? { ...tournament, matches } : tournament;
}

/** Was die Zeile des Spiels zur Wahl sagt (für `KitChoiceQueue.submit`/`reconcile`). */
export function kitRowStateOf(match: Pick<Match, 'slotA' | 'slotB' | 'kit' | 'kitDecision'> & Partial<Pick<Match, 'matchStatus'>>): KitRowState {
  const side = match.kit?.bibSide;
  return {
    decision: match.kitDecision,
    bibSide: side,
    bibColor: side === undefined ? undefined : match.kit?.[side],
    teams: { a: slotTeamId(match.slotA), b: slotTeamId(match.slotB) },
    kickedOff: match.matchStatus === 'running' || match.matchStatus === 'paused',
  };
}
