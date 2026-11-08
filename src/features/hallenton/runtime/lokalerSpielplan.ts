/**
 * Spielplan des Feldstands aus der lokalen Turnierkopie (H3b-2b, Befund 6a): gilt nur, solange der Server keinen geliefert hat
 * (Start ohne Netz), damit die Felder ihr Spiel kennen und „keine Verbindung“ warnen (@HT-033 Zeile 11, H3b-4). Gleiche Felder
 * wie `planSpielAus` (Spalten des Servers), `MatchContext` wie `buildValidMatches`: Team-IDs klein, beide gesetzt, verschieden.
 */
import { matchSideTeamId } from '../../../core/models/matchSlot';
import type { Tournament } from '../../../types/tournament';
import type { FeldSpielStatus } from './aktuellesSpielJeFeld';
import { ctxAus, type PlanSpiel } from './feldStandSpiele';

const STATUS: Readonly<Record<string, FeldSpielStatus>> = { running: 'RUNNING', paused: 'PAUSED', finished: 'FINISHED', skipped: 'FINISHED' };

export function planAusTurnier(turnier: Tournament): PlanSpiel[] {
  return turnier.matches.map((match) => {
    const status = match.matchStatus === undefined ? undefined : STATUS[match.matchStatus];
    const mitErgebnis = match.scoreA !== undefined && match.scoreB !== undefined && status !== 'RUNNING' && status !== 'PAUSED';
    return {
      id: match.id.toLowerCase(),
      field: match.field,
      slot: match.slot,
      matchNumber: match.matchNumber ?? match.round,
      startTime: match.scheduledTime ? new Date(match.scheduledTime) : undefined,
      status: mitErgebnis ? 'FINISHED' : status,
      ctx: ctxAus({ id: match.id, team_a_id: matchSideTeamId(match, 'A') ?? null, team_b_id: matchSideTeamId(match, 'B') ?? null }),
    };
  });
}
