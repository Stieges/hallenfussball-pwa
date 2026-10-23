/**
 * Plätze der Platzierungsspiele und vorläufige Plätze offener Spiele (A-36b Fixrunde 1b, @ET-042).
 *
 * Vor dem Abschluss zeigt die Rangliste den Endstand, wie er gerade steht (Record Endstand Z. 73): Die Teams eines noch
 * offenen Platzierungsspiels stehen auf den Plätzen DIESES Spiels (Finale → 1–2), gemeinsam und ohne Reihenfolge als
 * „offen“ – nie hinter den Gruppenplätzen.
 */
import type { Match, Team, Tournament } from '../types/tournament';
import { matchSideTeamId } from '../core/models/matchSlot';

/** Plätze je Platzierungsspiel: [Sieger, Verlierer]. */
export const FINAL_TYPE_RANKS: Readonly<Record<string, [number, number]>> = {
  final: [1, 2],
  thirdPlace: [3, 4],
  fifthSixth: [5, 6],
  seventhEighth: [7, 8],
};

export const FINAL_TYPE_LABELS: Readonly<Record<string, string>> = {
  final: 'Finale',
  thirdPlace: 'Spiel um Platz 3',
  fifthSixth: 'Spiel um Platz 5',
  seventhEighth: 'Spiel um Platz 7',
};

export interface OpenPlacement {
  rank: number;
  /** Letzter Platz des gemeinsamen Bereichs (Finale offen: rank 1, rankTo 2). */
  rankTo: number;
  team: Team;
  decidedBy: 'open';
  matchLabel?: string;
  finalType: NonNullable<Match['finalType']>;
}

/**
 * Vorläufige Plätze der besetzten, noch nicht entschiedenen Platzierungsspiele. `isDecided` ist die zentrale
 * Siegerregel (`getMatchWinner(m) !== null`); bereits platzierte Teams bleiben außen vor.
 */
export function openPlacements(
  teams: readonly Team[],
  matches: readonly Match[],
  isDecided: (match: Match) => boolean,
  placed: ReadonlySet<string>,
): OpenPlacement[] {
  const seen = new Set<string>(placed); // N-K3: ein Team in zwei offenen Spielen (Datenfehler) erscheint nur einmal
  return matches.flatMap((match) => {
    const finalType = match.isFinal === true ? match.finalType : undefined;
    const ranks = finalType === undefined ? undefined : FINAL_TYPE_RANKS[finalType];
    if (finalType === undefined || ranks === undefined || isDecided(match)) {
      return [];
    }
    const found = [matchSideTeamId(match, 'A'), matchSideTeamId(match, 'B')].map((id) => teams.find((team) => team.id === id));
    if (found.some((team) => team === undefined || seen.has(team.id))) {
      return [];
    }
    return found.flatMap((team) => {
      if (team === undefined) {
        return [];
      }
      seen.add(team.id);
      return [{ rank: ranks[0], rankTo: ranks[1], team, decidedBy: 'open' as const, matchLabel: FINAL_TYPE_LABELS[finalType], finalType }];
    });
  });
}

/** Anzeige des Platzes: „1“ bzw. „1–2“ für einen gemeinsamen offenen Bereich. */
export function placementRankText(placement: { rank: number; rankTo?: number }): string {
  return placement.rankTo === undefined ? String(placement.rank) : `${placement.rank}–${placement.rankTo}`;
}

type BadgeKey =
  | 'ranking.playoff'
  | 'ranking.open'
  | `finals.labels.${NonNullable<Match['finalType']>}`;
type Translate = (key: BadgeKey, options?: { match: string }) => string;

/**
 * Kennzeichen „Entschieden durch“ (Rangliste/Tabellen): übersetzte Bezeichnung des Platzierungsspiels
 * (`tournament:finals.labels.*`, statt des deutschen `matchLabel`), bei offenen Plätzen mit `tournament:ranking.open`.
 */
export function placementBadgeText(
  placement: { decidedBy: string; finalType?: Match['finalType']; matchLabel?: string },
  t: Translate,
): string {
  const match = placement.finalType !== undefined
    ? t(`finals.labels.${placement.finalType}`)
    : placement.matchLabel ?? t('ranking.playoff');
  return placement.decidedBy === 'open' ? t('ranking.open', { match }) : match;
}

/**
 * Hat das Turnier eine Finalrunde? Aus dem echten Turniermodell (Nachzug F1, Daniel 16.10., @ET-042): es gibt
 * Finalrunden-Spiele oder die Finals-Konfiguration sieht eine vor. Ersetzt das nie gesetzte `finals.enabled`
 * (Befund C-FINALS-ENABLED-FEHLT / C-RANGLISTE-OHNE-FINALRUNDE).
 */
export function hasFinalRound(tournament: Pick<Tournament, 'matches' | 'finalsConfig' | 'groupSystem'>): boolean {
  // F1-W2: dieselbe Regel wie der Generator – ein Preset zählt nur bei „Gruppen + Finalrunde“ (ein vom Wizard
  // stehengebliebenes Preset bei Jeder gegen jeden erzeugt keine Finalspiele).
  return tournament.matches.some((match) => match.isFinal === true)
    || (tournament.groupSystem === 'groupsAndFinals' && (tournament.finalsConfig?.preset ?? 'none') !== 'none');
}
