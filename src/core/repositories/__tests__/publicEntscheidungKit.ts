/**
 * Test-Hilfen zu C-PUBLIC-ENTSCHEIDUNG-BASIS-LEER (@W2A-059 Z. 3, @ET-055, @ET-044, @ZM-180): eine entschiedene Gleichstands-Lage, einmal
 * so, wie sie auf dem Gerät der Turnierleitung entsteht, und einmal als Antwort der Server-Funktionen `public_tournament` /
 * `display_tournament` (Form des B-14-Vertrags, `20261117_104_public_payload.sql` + `20261118_007_public_entscheidung_basis.sql`).
 * Nur Testumgebung.
 *
 * Lage: privates Turnier „Jeder gegen jeden“ mit 6 Teams, alle Spiele beendet. FC Nord und SV Süd haben je 13 Punkte, 6:2 Tore und
 * spielten direkt 2:2 – nach allen Kriterien gleich auf Platz 1 (Platz 1 ist auszuspielen, Voreinstellung). Die Turnierleitung
 * schließt die Gruppe mit dem Strafstoßschießen 4:3 für FC Nord ab (Entscheidung wie im Abschluss-Ablauf: `draftToDecision`).
 *
 * Die Server-Zeilen entstehen wie beim Veröffentlichen (`mapTournamentToSupabase`), die Ergebnisse wie nach dem Abpfiff
 * (`score_*`, `match_status = finished`, `decided_by = regular`). Die Antwort trägt nur die Felder der Positivliste.
 */
import type { Tournament } from '../../../types/tournament';
import { draftToDecision } from '../../services/groupCompletionPlan';
import { mapTournamentToSupabase } from '../supabaseMappers';
import { id, league, NAME } from '../../standings/__tests__/fixtures';

type Row = Record<string, unknown>;

export const SHARE_CODE_ENTSCHEIDUNG = 'NORDSUED';
export const MONITOR_ID_ENTSCHEIDUNG = 'mon-tabelle';
export const NORD = NAME.N;
export const SUED = NAME.S;

/** FC Nord und SV Süd: je 13 Punkte, 6:2 Tore, direktes Spiel 2:2; dahinter SG Mitte 6, TSV West 3 … (gegengerechnet). */
export const ERGEBNISSE_NORD_SUED =
  'N–S 2:2; N–M 1:0; N–W 1:0; N–O 1:0; N–B 1:0; S–M 1:0; S–W 1:0; S–O 1:0; S–B 1:0; M–W 1:0; M–O 1:0; M–B 1:0; W–O 1:0; W–B 1:0; O–B 1:0';

/** Das Turnier auf dem Gerät der Turnierleitung, vor der Entscheidung (öffentlich geteilt, Tabellen sichtbar, ein Monitor mit Tabellen-Folie). */
export function turnierNordSued(): Tournament {
  const { tournament } = league('NSMWOB', ERGEBNISSE_NORD_SUED);
  return {
    ...tournament,
    id: 'c0ffee00-0000-4000-8000-000000000001',
    title: 'Hallencup Nord',
    isPublic: true,
    shareCode: SHARE_CODE_ENTSCHEIDUNG,
    hideRankingsForPublic: false,
    monitors: [{
      id: MONITOR_ID_ENTSCHEIDUNG,
      name: 'Hallenmonitor Feld 1',
      defaultSlideDuration: 15,
      transition: 'fade',
      transitionDuration: 500,
      theme: 'dark',
      performanceMode: 'auto',
      slides: [{ id: 'folie-tabelle', type: 'standings', config: { groupId: '' }, duration: null, order: 0 }],
      createdAt: '2026-10-30T09:00:00.000Z',
      updatedAt: '2026-10-30T09:00:00.000Z',
    }],
  };
}

/** Strafstoßschießen 4:3 für FC Nord, eingetragen beim Abschluss der Gruppe (Kennung, Grundlage wie auf Ollis Gerät). */
export function mitStrafstossNord(tournament: Tournament): Tournament {
  const decision = draftToDecision(tournament, {
    groupId: '', teamIds: [id('N'), id('S')], order: [id('N'), id('S')], kind: 'shootout', shootout: { winner: 4, loser: 3 },
  }, 'entscheidung-nord-sued');
  const { reason: _reason, ...stored } = decision;
  return { ...tournament, standingDecisions: [...(tournament.standingDecisions ?? []), stored] };
}

const TIMESTAMP = '2026-10-30T12:00:00.000000+00:00';

/** Zeilen, wie sie nach Veröffentlichen und Abpfiff aller Spiele in der Datenbank stehen. */
export function serverZeilen(tournament: Tournament): { tournament: Row; teams: Row[]; matches: Row[] } {
  const { tournamentRow, teamRows, matchRows } = mapTournamentToSupabase(tournament, 'owner-olli');
  const byId = new Map(tournament.matches.map((m) => [m.id, m] as const));
  return {
    tournament: { ...tournamentRow, is_public: true, share_code: tournament.shareCode, created_at: TIMESTAMP, updated_at: TIMESTAMP },
    teams: teamRows.map((row) => ({ ...row })),
    matches: matchRows.map((row) => {
      const match = byId.get(String(row.id));
      const finished = match?.matchStatus === 'finished';
      return {
        ...row,
        score_a: finished ? match.scoreA ?? null : null,
        score_b: finished ? match.scoreB ?? null : null,
        match_status: match?.matchStatus ?? 'scheduled',
        decided_by: finished ? 'regular' : null,
      };
    }),
  };
}

// --- Antwort der Server-Funktion (Positivliste B-14) -----------------------------------------------------------------

const TOURNAMENT_PUBLIC = [
  'id', 'title', 'date', 'start_time', 'sport', 'tournament_type', 'status', 'number_of_fields', 'number_of_teams',
  'number_of_groups', 'group_phase_duration', 'group_phase_break', 'final_round_duration', 'final_round_break', 'point_system',
  'finals_config', 'is_public', 'share_code', 'completed_at', 'lifecycle_status', 'finished_at',
] as const;
/** `c_config_keys` aus `public_view.config_for`. */
const CONFIG_PUBLIC = [
  'sportId', 'tournamentType', 'tournamentSystem', 'mode', 'groupSystem', 'breakBetweenPhases', 'gamePeriods',
  'halftimeBreak', 'gameDuration', 'breakDuration', 'roundLogic', 'numberOfRounds', 'placementLogic',
  'fieldAssignments', 'groups', 'fields', 'finals', 'playoffConfig', 'minRestSlots', 'isKidsTournament',
  'hideScoresForPublic', 'hideRankingsForPublic', 'publicLiveScore', 'publicEvents', 'publicScorers', 'resultMode',
  'ageClass', 'organizer', 'bibColor', 'spectatorDisplay', 'hostTeamIds', 'openingMode', 'placementsToPlayOut',
  'forfeitScore', 'monitorReferees',
] as const;
const TEAM_PUBLIC = ['id', 'name', 'group_letter', 'is_removed', 'logo_path', 'logo_background_color', 'color_primary', 'color_secondary'] as const;
const MATCH_PUBLIC = [
  'id', 'match_number', 'round', 'field', 'slot', 'phase', 'group_letter', 'slot_a_source', 'slot_b_source', 'origin_a', 'origin_b',
  'is_final', 'final_type', 'label', 'scheduled_start', 'original_start', 'match_status', 'live_state', 'timer_start_time',
  'timer_paused_at', 'timer_elapsed_seconds', 'actual_start', 'actual_end', 'skipped_at', 'kit_color_a', 'kit_color_b', 'bib_side',
  'score_a', 'score_b', 'overtime_score_a', 'overtime_score_b', 'penalty_score_a', 'penalty_score_b', 'decided_by', 'forfeit_absent',
] as const;

/** Wie `public_view.without_nulls`: nur Schlüssel mit Wert. */
function pick(row: Row, keys: readonly string[]): Row {
  return Object.fromEntries(keys.filter((key) => row[key] !== undefined && row[key] !== null).map((key) => [key, row[key]]));
}

/**
 * `basis` der Entscheidungen in der Antwort: `gespeichert` = wie in der Datenbank (Migration 20261118_007), `leer` = die Fassung aus
 * 20261117_104 (immer ""), oder ein anderer, veralteter Fingerabdruck.
 */
export type BasisInAntwort = { art: 'gespeichert' } | { art: 'leer' } | { art: 'anders'; basis: string };

function publicConfig(config: Row, basis: BasisInAntwort, audience: 'viewer' | 'screen'): Row {
  const out = pick(config, CONFIG_PUBLIC);
  const decisions = Array.isArray(config.standingDecisions) ? (config.standingDecisions as Row[]) : [];
  out.standingDecisions = decisions.map((d) => pick({
    id: d.id, groupId: d.groupId, teamIds: d.teamIds, order: d.order, kind: d.kind, shootout: d.shootout,
    basis: basis.art === 'gespeichert' ? d.basis : basis.art === 'leer' ? '' : basis.basis,
  }, ['id', 'groupId', 'teamIds', 'order', 'kind', 'shootout', 'basis']));
  if (audience === 'screen' && Array.isArray(config.monitors)) {
    out.monitors = (config.monitors as Row[]).filter((m) => m.id === MONITOR_ID_ENTSCHEIDUNG);
    out.sponsors = [];
  }
  return out;
}

/** Volle Antwort `{state:'full', …}` von `public_tournament` (Zuschauer) bzw. `display_tournament` (Bildschirm). */
export function serverAntwort(tournament: Tournament, basis: BasisInAntwort, audience: 'viewer' | 'screen' = 'viewer'): Row {
  const zeilen = serverZeilen(tournament);
  return {
    state: 'full',
    version: 1_793_000_000_000_000,
    server_now: 1_793_000_000_000,
    tournament: { ...pick(zeilen.tournament, TOURNAMENT_PUBLIC), config: publicConfig(zeilen.tournament.config as Row, basis, audience) },
    teams: zeilen.teams.map((row) => pick(row, TEAM_PUBLIC)),
    // Seiten immer mit Schlüssel (Vertrag: null = kein Team)
    matches: zeilen.matches.map((row) => ({ ...pick(row, MATCH_PUBLIC), team_a_id: row.team_a_id ?? null, team_b_id: row.team_b_id ?? null })),
  };
}
