/**
 * engineMatchModel (C3a-2a Fixrunde 3, P8/W11): reine Klassifizierungs-/Projektionslogik fuer
 * Engine-Spiele -- aus `useEngineMatches.ts` ausgelagert, damit die Datei nicht weiter waechst.
 * Kein React-Zustand hier (keine Hooks), nur pure Funktionen ueber Turnierdaten + MatchEngine-View.
 *
 * `useEngineMatches.ts` re-exportiert diese Symbole weiterhin (Bestandsschutz fuer bestehende
 * Importe/Mocks, z. B. `useEngineCommandWiring.ts`); `useEngineMatchReadiness.ts`,
 * `useScheduleTabActions.ts` und `useCockpitExecution.ts` importieren ab dieser Runde direkt von hier.
 */
import type { Tournament, Team } from '../types/tournament';
import type { LiveMatch } from '../core/models/LiveMatch';
import { matchSideTeamId } from '../core/models/matchSlot';
import { serverRules, type MatchContext } from '../core/match';
import { toLiveMatchView, type LiveMatchMeta } from '../core/match/client';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';

export interface ValidMatchEntry {
  /** Kleingeschrieben -- Engine-interner Schluessel (Store/`engineMatchIds`, Server-Konvention). */
  matchId: string;
  /** N-m2: die AUSSEN sichtbare ID (Original-Schreibweise aus `tournament.matches[].id`) -- der
   * Schluessel der zurueckgegebenen `liveMatches`-Map. So finden Aufrufer (`useCockpitExecution`s
   * B4/B5-Wachen, `getLiveMatchData`, `handleReopenMatch`, ...), die mit `match.id`/`matchData.id`
   * in Original-Schreibweise nachschlagen, den Eintrag auch dann, wenn eine Spiel-ID theoretisch
   * Grossbuchstaben enthaelt (heutige Generatoren liefern durchgehend kleine UUIDs, s. Report). */
  externalId: string;
  ctx: MatchContext;
  meta: LiveMatchMeta;
  /** I6/K3/W5: Phase (`groupStage`/Finalrunde) fuer `serverRules` -- eine Finalrunde hat eine andere
   * Dauer als die Gruppenphase, `undefined` waere immer "Gruppenphase". */
  phase: string | undefined;
  /** B1 (C3a-2a): Turnierkopie-Status (`match.matchStatus`), fehlend zaehlt als `'scheduled'`. */
  matchStatus: string | undefined;
  /** I1/K7 (Fixrunde 1): ein bereits eingetragenes Ergebnis (z. B. Spielplan-Schnelleingabe,
   * `useScheduleTabActions.ts` setzt NUR `scoreA/B`, kein `matchStatus`) -- ein solches Spiel darf
   * NICHT als neues Engine-Spiel bei 0:0 anlaufen (das Overlay wuerde das eingetragene Ergebnis
   * sonst ueberschreiben). */
  hasExistingResult: boolean;
  /** W5: `toLiveMatchView` kennt kein Logo/Farben (Adapter unveraendert) -- der Hook traegt sie nach. */
  homeVisual: { logo?: Team['logo']; colors?: Team['colors'] };
  awayVisual: { logo?: Team['logo']; colors?: Team['colors'] };
}

/**
 * W4/V17 (A-03): Ein Spiel wird nur dann ein Engine-Spiel, wenn BEIDE Seiten besetzt sind (Slot `team`),
 * die Team-IDs verschieden sind und beide in der Teamliste stehen. Offene Seiten (Slot `pending`),
 * fehlende Slots und unbekannte Team-IDs ergeben keinen Eintrag – kein Namens-Lookup, keine Kopie.
 */
function findTeamById(tournament: Tournament, teamId: string): Team | undefined {
  return tournament.teams.find((team) => team.id.toLowerCase() === teamId);
}

export function buildValidMatches(tournament: Tournament): ValidMatchEntry[] {
  const entries: ValidMatchEntry[] = [];
  for (const match of tournament.matches) {
    const teamAId = matchSideTeamId(match, 'A')?.toLowerCase();
    const teamBId = matchSideTeamId(match, 'B')?.toLowerCase();
    if (teamAId === undefined || teamBId === undefined || teamAId === teamBId) {
      continue;
    }
    const homeTeam = findTeamById(tournament, teamAId);
    const awayTeam = findTeamById(tournament, teamBId);
    if (homeTeam === undefined || awayTeam === undefined) {
      continue; // unbekannte Team-ID: kein Engine-Spiel, kein Name aus anderer Quelle
    }
    // m5: der Server liefert `match_id` klein zurueck (uuid als Text) -- die Sammelabfrage
    // (`engineMatchIds`) und die Engine-eigenen Store-Schluessel muessen dieselbe Schreibweise
    // verwenden, sonst greift `engineMatchIds.has(matchId)` bei gross geschriebenen IDs nicht.
    const matchId = match.id.toLowerCase();
    const ctx: MatchContext = { matchId, teamAId, teamBId };
    const meta: LiveMatchMeta = {
      id: match.id,
      number: match.matchNumber ?? match.round,
      phaseLabel: match.label ?? match.group ?? match.phase ?? '',
      fieldId: `field-${match.field}`,
      scheduledKickoff: (match.scheduledTime ?? new Date()).toISOString(),
      refereeName: match.referee !== undefined ? `SR ${match.referee}` : undefined,
      homeTeam: { id: ctx.teamAId, name: homeTeam.name },
      awayTeam: { id: ctx.teamBId, name: awayTeam.name },
      version: 0,
    };
    entries.push({
      matchId,
      externalId: match.id,
      ctx,
      meta,
      phase: match.phase,
      matchStatus: match.matchStatus,
      hasExistingResult: (match.scoreA ?? 0) > 0 || (match.scoreB ?? 0) > 0,
      homeVisual: { logo: homeTeam.logo, colors: homeTeam.colors },
      awayVisual: { logo: awayTeam.logo, colors: awayTeam.colors },
    });
  }
  return entries;
}

/** K3: exakte serverRules-Eingabe wie supabaseMappers.ts:616-652. */
function rulesFor(tournament: Tournament, matchPhase: string | undefined) {
  return serverRules({
    durationMinutes: null,
    phase: matchPhase ?? null,
    groupPhaseDuration: tournament.groupPhaseGameDuration,
    finalRoundDuration: tournament.finalRoundGameDuration ?? null,
    config: {
      gamePeriods: tournament.gamePeriods,
      halftimeBreak: tournament.halftimeBreak,
      matchCockpitSettings: tournament.matchCockpitSettings,
    },
    finalsConfig: tournament.finalsConfig ?? null,
  });
}

/**
 * B1 (C3a-2a, Plan-Review PC15a): die "scheduled"-Klausel schaltet die Umschaltung fuer NEUE
 * Spiele scharf -- ein Spiel ohne jedes Ereignis wird Engine-Spiel, wenn die Turnierkopie noch
 * `scheduled` ist (oder das Feld fehlt) UND kein Altspiel schon in Betrieb ist (kein LiveMatch
 * ODER dessen Status noch `NOT_STARTED`). Ein bereits laufendes/pausiertes Altspiel bleibt beim
 * Altpfad, bis es dort beendet ist (Uebergangsschutz aus dem Review).
 */
export function isNewScheduledMatch(entry: ValidMatchEntry, localLiveMatches: Map<string, LiveMatch>): boolean {
  const isScheduled = (entry.matchStatus ?? 'scheduled') === 'scheduled';
  if (!isScheduled || entry.hasExistingResult) {
    return false;
  }
  const oldLiveMatch = localLiveMatches.get(entry.externalId);
  return !oldLiveMatch || oldLiveMatch.status === 'NOT_STARTED';
}

/**
 * P2 (Fixrunde 3, E1-Randfall): nicht `scheduled`, aber (auf DIESEM Geraet) weder eine aktive
 * Altzeile noch ein Ergebnis -- der Kandidat fuer ein fremd (auf einem anderen Geraet) laufendes
 * Engine-Spiel. Spiegelbildlich zu `isNewScheduledMatch` (dort: `scheduled`). Fixrunde 4, Minor 5:
 * hierher verschoben (aus `useEngineMatchReadiness.ts`), damit `scoreChangeHelpers.ts` (Schnell-
 * eingabe-Sperre) dieselbe Klassifizierung wiederverwenden kann statt sie zu duplizieren.
 * Fixrunde 5 (Regression aus dem Fixrunde-4-Review): `'skipped'` ist ein regulaerer, NICHT
 * Engine-bezogener Endzustand (manuelles Ueberspringen) -- ohne
 * expliziten Ausschluss galt jedes uebersprungene Spiel ohne Ergebnis faelschlich als fremder
 * Engine-Kandidat und sperrte die Schnelleingabe mit dem irrefuehrenden `engine.notYet`-Toast.
 */
export function isForeignCandidate(entry: ValidMatchEntry, localLiveMatches: Map<string, LiveMatch>): boolean {
  const status = entry.matchStatus ?? 'scheduled';
  if (status === 'scheduled' || status === 'skipped' || entry.hasExistingResult) {
    return false;
  }
  const oldLiveMatch = localLiveMatches.get(entry.externalId);
  return !oldLiveMatch || oldLiveMatch.status === 'NOT_STARTED';
}

export function computeLiveMatches(
  context: MatchEngineContextValue | null,
  validMatches: ValidMatchEntry[],
  engineMatchIds: Set<string>,
  tournament: Tournament,
  localLiveMatches: Map<string, LiveMatch>,
): Map<string, LiveMatch> {
  const map = new Map<string, LiveMatch>();
  if (!context) {
    return map;
  }
  const { engine, clock } = context;
  for (const entry of validMatches) {
    const view = engine.view(entry.matchId);
    if (!view) {
      continue;
    }
    const hasLocalEvents = view.log.length > 0;
    const isEngineByServer = hasLocalEvents || engineMatchIds.has(entry.matchId);
    if (!isEngineByServer && !isNewScheduledMatch(entry, localLiveMatches)) {
      continue; // B1: bleibt Altspiel.
    }
    const rules = view.result.state.rules ?? rulesFor(tournament, entry.phase);
    const viewClock = { serverNow: engine.serverNow(), offsetMs: clock.offsetMs };
    const meta: LiveMatchMeta = { ...entry.meta, version: view.confirmedCount };
    const state = view.result.state.rules ? view.result.state : { ...view.result.state, rules };
    const liveMatch = toLiveMatchView(state, meta, viewClock, view.log);
    // W5: Teamfarben/-logo traegt der Hook nach (Adapter kennt nur id/name).
    map.set(entry.externalId, {
      ...liveMatch,
      homeTeam: { ...liveMatch.homeTeam, ...entry.homeVisual },
      awayTeam: { ...liveMatch.awayTeam, ...entry.awayVisual },
    });
  }
  return map;
}
