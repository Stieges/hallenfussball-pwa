import { Match, Tournament, Standing, Team, RuntimeMatchEvent } from '../types/tournament';
import { DEFAULT_FAIR_PLAY_PROFILE, type FairPlayProfile } from '../core/stats/fairPlayProfiles';
import { cardKindOf } from './cardKind';
import { matchSideTeamId } from '../core/models/matchSlot';
import { rankGroup } from '../core/standings/groupTable';
import { tableInput } from '../core/standings/tournamentTable';
import { standingsGroups, OVERALL_GROUP } from '../core/models/standingsGroups';
import { matchFinalScore } from '../core/view/finalScore';
import type { TeamId } from '../core/models/schemas/MatchSlotSchema';
import { FINAL_TYPE_LABELS, FINAL_TYPE_RANKS, openPlacements } from './openPlacements';
export { hasFinalRound, placementBadgeText, placementRankText } from './openPlacements';

export { countsForStandings } from '../core/standings/countsForStandings';

/**
 * Tabelle einer Gruppe bzw. aller Teams – Fassade über den Rechenkern (Paket TB, Plan v2 § 3.1); welche Teams, Spiele
 * und welcher Modus gelten, steht in `core/standings/tournamentTable.ts`. Entscheidungen der Turnierleitung
 * (`tournament.standingDecisions`) wirken je Gruppe.
 */
export const calculateStandings = (
  teams: Team[],
  matches: Match[],
  tournament: Tournament,
  group?: string
): Standing[] => rankGroup(tableInput(teams, matches, tournament, group)).rows;

/**
 * Tabellen aller Gruppen hintereinander (je Gruppe sortiert). Ein Turnier ohne Gruppen ist eine Gruppe über alle Teams
 * (`standingsGroups`, C-ZUSCHAUER-TABELLE-OHNE-GRUPPEN) – die Rechnung selbst bleibt `calculateStandings`.
 */
export const calculateStandingsPerGroup = (tournament: Tournament): Standing[] =>
  standingsGroups(tournament.teams).flatMap(({ group, teams }) =>
    group === OVERALL_GROUP
      ? calculateStandings(teams, tournament.matches, tournament)
      : calculateStandings(teams, tournament.matches, tournament, group)
  );

/**
 * Get winners/qualified teams from standings
 */
export const getQualifiedTeams = (standings: Standing[], count: number): Team[] => {
  return standings.slice(0, count).map((s) => s.team);
};

// ============================================================================
// FINALS PLACEMENT CALCULATION
// ============================================================================

export interface FinalPlacement {
  rank: number;
  /** Nur bei `open`: letzter Platz des gemeinsamen Bereichs (A-36b Fixrunde 1b, @ET-042). */
  rankTo?: number;
  team: Team;
  /** Platzierungsspiel (für die übersetzte Bezeichnung, `placementBadgeText`). */
  finalType?: Match['finalType'];
  decidedBy: 'playoff' | 'groupStage' | 'open';
  matchLabel?: string; // e.g., "Finale", "Spiel um Platz 3"
}

export interface FinalsPlacementResult {
  placements: FinalPlacement[];
  allFinalsCompleted: boolean;
  completedFinalsCount: number;
  totalFinalsCount: number;
  playoffStatus: 'not-started' | 'in-progress' | 'completed';
}

/**
 * Sieger/Verlierer eines Finalspiels aus dem zentralen Endstand (`matchFinalScore`, A-36b Auflage Tabelle):
 * Verlängerung, Golden Goal und Strafstoßschießen entscheiden dort, nicht hier (@ET-002, @ET-013).
 * Team-IDs aus den Slots; offene Seite, fehlender Stand, laufendes Spiel oder Unentschieden → `null`.
 */
export const getMatchWinner = (match: Match): { winner: TeamId; loser: TeamId } | null => {
  const idA = matchSideTeamId(match, 'A');
  const idB = matchSideTeamId(match, 'B');
  const winner = matchFinalScore(match)?.winner ?? null;
  if (idA === undefined || idB === undefined || winner === null) {
    return null;
  }
  return winner === 'a' ? { winner: idA, loser: idB } : { winner: idB, loser: idA };
};

/**
 * Calculate final placements based on playoff results
 *
 * This function determines actual placements from finals matches:
 * - Finale → 1st and 2nd place
 * - Spiel um Platz 3 → 3rd and 4th place
 * - Spiel um Platz 5 → 5th and 6th place
 * - Spiel um Platz 7 → 7th and 8th place
 *
 * Teams not participating in playoffs get their placement from group standings.
 */
export const calculateFinalsPlacement = (
  teams: Team[],
  matches: Match[],
  _groupStandings: Standing[]
): FinalsPlacementResult => {
  const finalsMatches = matches.filter(m => m.isFinal);

  if (finalsMatches.length === 0) {
    return {
      placements: [],
      allFinalsCompleted: false,
      completedFinalsCount: 0,
      totalFinalsCount: 0,
      playoffStatus: 'not-started',
    };
  }

  // A-36b Fixrunde (W1): abgeschlossen = entschieden (zentraler Endstand), nicht „hat einen Stand“ – ein laufendes
  // Finale oder ein Remis ohne Entscheidung ist offen.
  const completedFinals = finalsMatches.filter(m => getMatchWinner(m) !== null);

  const placements: FinalPlacement[] = [];
  const placedTeamIds = new Set<string>();

  // Team nur über die Team-ID (A-03) – ein Name findet keins
  const findTeam = (teamId: string): Team | undefined => {
    return teams.find(t => t.id === teamId);
  };

  const finalTypeToRanks = FINAL_TYPE_RANKS;
  const finalTypeLabels = FINAL_TYPE_LABELS;

  // Process each finalType
  for (const [finalType, [winnerRank, loserRank]] of Object.entries(finalTypeToRanks)) {
    const match = completedFinals.find(m => m.finalType === finalType);

    if (match) {
      const result = getMatchWinner(match);
      if (result) {
        const winnerTeam = findTeam(result.winner);
        const loserTeam = findTeam(result.loser);

        if (winnerTeam && !placedTeamIds.has(winnerTeam.id)) {
          placements.push({
            rank: winnerRank,
            team: winnerTeam,
            decidedBy: 'playoff',
            matchLabel: finalTypeLabels[finalType], finalType: finalType as Match['finalType'],
          });
          placedTeamIds.add(winnerTeam.id);
        }

        if (loserTeam && !placedTeamIds.has(loserTeam.id)) {
          placements.push({
            rank: loserRank,
            team: loserTeam,
            decidedBy: 'playoff',
            matchLabel: finalTypeLabels[finalType], finalType: finalType as Match['finalType'],
          });
          placedTeamIds.add(loserTeam.id);
        }
      }
    }
  }

  // Sort placements by rank
  placements.sort((a, b) => a.rank - b.rank);

  // Determine playoff status
  let playoffStatus: 'not-started' | 'in-progress' | 'completed';
  if (completedFinals.length === 0) {
    playoffStatus = 'not-started';
  } else if (completedFinals.length === finalsMatches.length) {
    playoffStatus = 'completed';
  } else {
    playoffStatus = 'in-progress';
  }

  return {
    placements,
    allFinalsCompleted: completedFinals.length === finalsMatches.length,
    completedFinalsCount: completedFinals.length,
    totalFinalsCount: finalsMatches.length,
    playoffStatus,
  };
};

/**
 * F1-W1 (Review A-36b F1, Record Endstand Z. 62): in der Gruppe Ausgeschiedene zuerst nach Gruppenplatz (alle Dritten vor
 * allen Vierten), bei gleichem Platz in der Reihenfolge der Gesamtwertung `standings` (stabile Sortierung). Ohne Gruppen
 * (Jeder gegen jeden) bleibt die Ligatabelle.
 */
const byGroupPlace = (teams: Team[], matches: Match[], standings: Standing[], tournament: Tournament): Standing[] => {
  const place = new Map<string, number>();
  for (const group of new Set(teams.map(t => t.group).filter((g): g is string => g !== undefined && g !== ''))) {
    calculateStandings(teams.filter(t => t.group === group), matches, tournament, group)
      .forEach((standing, index) => place.set(standing.team.id, index + 1));
  }
  return [...standings].sort((a, b) => (place.get(a.team.id) ?? 0) - (place.get(b.team.id) ?? 0));
};

/**
 * Merge finals placements with group standings for complete ranking
 *
 * Returns a unified ranking where:
 * 1. Playoff-decided placements come first (in rank order)
 * 2. Remaining teams are added from group standings
 */
export const getMergedFinalRanking = (
  teams: Team[],
  matches: Match[],
  groupStandings: Standing[],
  tournament: Tournament
): { ranking: FinalPlacement[]; finalsResult: FinalsPlacementResult } => {
  const finalsResult = calculateFinalsPlacement(teams, matches, groupStandings);
  const ranking: FinalPlacement[] = [...finalsResult.placements];
  const placedTeamIds = new Set(ranking.map(p => p.team.id));

  // A-36b Fixrunde 1b (@ET-042): Teams eines offenen Platzierungsspiels stehen vorläufig auf dessen Plätzen, gemeinsam.
  for (const open of openPlacements(teams, matches, (m) => getMatchWinner(m) !== null, placedTeamIds)) {
    ranking.push(open);
    placedTeamIds.add(open.team.id);
  }
  // N-W1 (Nachreview A-36b): übrige Teams auf die niedrigsten freien Plätze, belegte Bereiche rank…rankTo überspringen –
  // keine Lücken, später Ausgeschiedene stehen vorn (Record Endstand Z. 61).
  const taken = new Set(ranking.flatMap(p => Array.from({ length: (p.rankTo ?? p.rank) - p.rank + 1 }, (_, i) => p.rank + i)));
  let nextRank = 1;
  for (const standing of byGroupPlace(teams, matches, groupStandings, tournament)) {
    if (!placedTeamIds.has(standing.team.id)) {
      while (taken.has(nextRank)) { nextRank++; }
      ranking.push({ rank: nextRank, team: standing.team, decidedBy: 'groupStage' });
      taken.add(nextRank);
      placedTeamIds.add(standing.team.id);
    }
  }
  ranking.sort((a, b) => a.rank - b.rank);

  return { ranking, finalsResult };
};

// ============================================================================
// STATISTICS CALCULATION
// ============================================================================

export interface Scorer {
  teamName: string;
  playerName: string;
  goals: number;
  assists: number;
}

/** Engine-Ereignisse je Spiel (aus `toRuntimeEvents`, ohne Zurückgenommenes) -- §8 Nr. 12. */
export type EngineEventsById = ReadonlyMap<string, RuntimeMatchEvent[]>;

/**
 * C3b-2b (§8 Nr. 12): Ereignisse eines Spiels für die Leser (Torschützenliste, Fair-Play,
 * Export). Engine-Spiele haben in `match.events` nichts (die App schreibt dort nicht, kein
 * syncUp) -- für sie zählt die Map aus dem Adapter; sonst `match.events`.
 */
export const eventsForMatch = (
  match: Match,
  engineEventsById?: EngineEventsById,
): RuntimeMatchEvent[] => engineEventsById?.get(match.id) ?? match.events ?? [];

export const calculateScorers = (tournament: Tournament, engineEventsById?: EngineEventsById): Scorer[] => {
  const scorerMap = new Map<string, Scorer>();

  const getKey = (teamId: string, playerNum?: number) => `${teamId}-${playerNum ?? 'unknown'}`;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty team name should use fallback
  const getTeamName = (id: string) => tournament.teams.find(t => t.id === id)?.name || 'Unbekannt';

  tournament.matches.forEach(match => {
      eventsForMatch(match, engineEventsById).forEach(event => {
        if (event.type === 'GOAL' && event.payload.ownGoal !== true) { // B-07 F1 (@SL-022): Eigentor ohne Schützen
          const teamId = event.payload.teamId;
          const playerNum = event.payload.playerNumber;

          if (teamId) {
            const key = getKey(teamId, playerNum);
            let scorer = scorerMap.get(key);
            if (!scorer) {
              const teamName = getTeamName(teamId);
              scorer = {
                teamName,
                playerName: playerNum ? `#${playerNum}` : 'Unbekannt',
                goals: 0,
                assists: 0
              };
              scorerMap.set(key, scorer);
            }
            scorer.goals++;

            // Assists (inside teamId check to ensure teamId is defined)
            if (event.payload.assists) {
              event.payload.assists.forEach(assistNum => {
                // Assume assist is from same team
                const key = getKey(teamId, assistNum);
                let scorer = scorerMap.get(key);
                if (!scorer) {
                  const teamName = getTeamName(teamId);
                  scorer = {
                    teamName,
                    playerName: `#${assistNum}`,
                    goals: 0,
                    assists: 0
                  };
                  scorerMap.set(key, scorer);
                }
                scorer.assists++;
              });
            }
          }
        }
      });
  });

  return Array.from(scorerMap.values()).sort((a, b) => b.goals - a.goals || b.assists - a.assists);
};

export interface FairPlayEntry {
  teamName: string;
  points: number;
  yellowCards: number;
  /** Gelb-Rot (F3b1): eigener Zaehler, nicht in redCards enthalten. */
  yellowRedCards: number;
  redCards: number;
  timePenalties: number;
}

/**
 * Punkte einer einzelnen Spieler-Kombination (Team + Rueckennummer, je Spiel) nach Profil.
 * `secondYellowReplacesFirst`: eine Gelbe und eine Gelb-Rot desselben Spielers im selben Spiel ersetzen
 * sich unabhaengig von der Reihenfolge im Log (zaehlt nur einmal als Gelb-Rot). `yellowPlusRed`: Gelb + direktes Rot desselben Spielers
 * (kein Ersetzen, eigener Kombi-Wert: fest oder Summe).
 */
function scorePlayerCards(yellow: number, yellowRed: number, red: number, profile: FairPlayProfile): number {
  let points = 0;
  let yellowsLeft = yellow;
  let yellowRedsLeft = yellowRed;
  let redsLeft = red;

  if (profile.secondYellowReplacesFirst && yellowsLeft > 0 && yellowRedsLeft > 0) {
    points += profile.yellowRed;
    yellowsLeft -= 1;
    yellowRedsLeft -= 1;
  }
  points += yellowRedsLeft * profile.yellowRed;

  if (yellowsLeft > 0 && redsLeft > 0) {
    points += profile.yellowPlusRed === 'SUM' ? profile.yellow + profile.red : profile.yellowPlusRed;
    yellowsLeft -= 1;
    redsLeft -= 1;
  }
  points += yellowsLeft * profile.yellow;
  points += redsLeft * profile.red;
  return points;
}

/**
 * Fair-Play-Punkte je Team nach austauschbarem Profil (DFBNET/UEFA/FIFA, Standard DFBNET).
 * Die Reihenfolge von Gelb und Gelb-Rot im Ereignis-Log ist dabei egal: `playerTally` summiert
 * zuerst alle Karten eines Spielers im Spiel auf (unabhaengig von der Zeile im Log) und
 * `scorePlayerCards` kombiniert erst danach -- eine Gelb-Rot ersetzt die Gelbe desselben Spielers
 * im selben Spiel egal ob die Gelbe vor oder (durch Nacherfassung/Korrektur) nach der Gelb-Rot
 * im Log steht.
 */
export const calculateFairPlay = (
  tournament: Tournament,
  engineEventsById?: EngineEventsById,
  profile: FairPlayProfile = DEFAULT_FAIR_PLAY_PROFILE,
): FairPlayEntry[] => {
  const map = new Map<string, FairPlayEntry>();

  // Initialize all teams
  tournament.teams.forEach(t => {
    map.set(t.id, {
      teamName: t.name,
      points: 0,
      yellowCards: 0,
      yellowRedCards: 0,
      redCards: 0,
      timePenalties: 0
    });
  });

  tournament.matches.forEach(match => {
      // Kombinationen (Gelb + Gelb-Rot/Rot desselben Spielers, Reihenfolge egal) gelten nur je Spiel --
      // transienter Schluessel Team + Rueckennummer; ohne Rueckennummer keine Zusammenfuehrung.
      const playerTally = new Map<string, { teamId: string; yellow: number; yellowRed: number; red: number }>();
      let anonCounter = 0;

      eventsForMatch(match, engineEventsById).forEach(event => {
        const teamId = event.payload.teamId;
        if (!teamId) { return; }
        const entry = map.get(teamId);
        if (!entry) { return; }

        if (event.type === 'TIME_PENALTY') {
          entry.timePenalties++;
          entry.points += profile.timePenalty;
          return;
        }
        const kind = cardKindOf(event);
        if (kind === null) { return; }

        const playerNumber = event.payload.playerNumber;
        // Fixrunde Aufgabe 3: nur eine echte Zahl bildet den gemeinsamen Spieler-Schluessel.
        // Altspiele koennen `playerNumber: null` persistiert haben (Legacy-Daten) -- `!== undefined`
        // liess das durch und fuehrte verschiedene Spieler faelschlich unter demselben Schluessel
        // `${teamId}#null` zusammen (secondYellowReplacesFirst griff dann faelschlich).
        const key = typeof playerNumber === 'number' ? `${teamId}#${playerNumber}` : `${teamId}#anon-${anonCounter++}`;
        const tally = playerTally.get(key) ?? { teamId, yellow: 0, yellowRed: 0, red: 0 };

        if (kind === 'YELLOW') {
          entry.yellowCards++;
          tally.yellow++;
        } else if (kind === 'YELLOW_RED') {
          entry.yellowRedCards++;
          tally.yellowRed++;
        } else {
          entry.redCards++;
          tally.red++;
        }
        playerTally.set(key, tally);
      });

      playerTally.forEach(({ teamId, yellow, yellowRed, red }) => {
        const entry = map.get(teamId);
        if (!entry) { return; }
        entry.points += scorePlayerCards(yellow, yellowRed, red, profile);
      });
  });

  return Array.from(map.values()).sort((a, b) => a.points - b.points); // Lower points is better
};
