/**
 * Adapter der Team-Spalte (Scheibe 3, Aufgabe 3.3): aus Spiel, Engine-Ansicht und Zustand das, was `TeamColumn` zeigt.
 * Rein, ohne React. Szenarien: @SL-099, @SL-102, @SL-031, @SL-086, @SL-032, @SL-029, @SL-089, @SL-023, @SL-093, @SL-030.
 */
import type { SperrHinweis } from '../../../core/match';
import type { EnabledCards } from '../../../types/tournament';
import type { PhaseView } from '../engine/phaseView';
import type { LiveMatch } from '../types';
import type { CockpitPhase, CockpitZustand } from './cockpitPhase';
import type { Side } from './cockpitTypes';
import { AKTION_ZEITSTRAFE, darfAktion } from './darf';
import { formatUhr } from './toScoreboardModel';

export interface TeamColumnModel {
  seite: Side;
  teamId: string;
  name: string;
  farbe: string | null;
  /** Fouls gegen die Grenze (@SL-099); `grenze: null` = ausgeschaltet, dann nur die Zahl (@SL-102). */
  fouls: { zaehlt: number; grenze: number | null };
  strafen: { id: string; rest: string; nummer: number | null; steht: boolean }[];
  unterzahl: { rest: string } | null;
  darfErgaenzen: boolean;
  gesperrt: number[];
  zeitstrafeMinuten: number;
  kartenArten: EnabledCards;
}

export interface TeamColumnInput {
  match: LiveMatch;
  seite: Side;
  view: PhaseView | null;
  zustand: CockpitZustand;
  /** Bis B-11a: Fouls des ganzen Spiels (`useFoulCounts`). */
  fouls: number;
  foulGrenze: number | null;
  sperrHinweise: readonly SperrHinweis[];
  zeitstrafeSekunden: number;
  unterzahl: { restMs: number } | null; // B-10b2; bis dahin null
  darfErgaenzen: boolean; // B-10b2; bis dahin false
  kartenArten: EnabledCards;
}

export interface TeamKnoepfe { tor: boolean; foul: boolean; zeitstrafe: boolean; karte: boolean }

export function toTeamColumnModel(input: TeamColumnInput): TeamColumnModel {
  const team = input.seite === 'home' ? input.match.homeTeam : input.match.awayTeam;
  return {
    seite: input.seite,
    teamId: team.id,
    name: team.name,
    farbe: team.colors?.primary ?? null,
    fouls: { zaehlt: input.fouls, grenze: input.foulGrenze },
    strafen: (input.view?.penalties ?? [])
      .filter((p) => p.teamId === team.id)
      .map((p) => ({ id: p.id, rest: formatUhr(p.remainingMs / 1000), nummer: p.playerNumber ?? null, steht: input.zustand !== 'laeuft' })),
    unterzahl: input.unterzahl ? { rest: formatUhr(input.unterzahl.restMs / 1000) } : null,
    darfErgaenzen: input.darfErgaenzen,
    gesperrt: input.sperrHinweise.filter((h) => h.teamId === team.id).map((h) => h.playerNumber),
    zeitstrafeMinuten: Math.round(input.zeitstrafeSekunden / 60),
    kartenArten: input.kartenArten,
  };
}

/** Welche der vier Knöpfe der Zustand und das Recht erlauben (die Kartenarten blendet `TeamColumn` zusätzlich aus, @SL-026). */
export function teamKnoepfe(phase: CockpitPhase, kannSteuern: boolean): TeamKnoepfe {
  return {
    tor: darfAktion(phase, kannSteuern, 'tor'),
    foul: darfAktion(phase, kannSteuern, 'foul'),
    zeitstrafe: darfAktion(phase, kannSteuern, AKTION_ZEITSTRAFE),
    karte: darfAktion(phase, kannSteuern, 'karte'),
  };
}
