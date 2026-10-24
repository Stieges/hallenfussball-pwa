/**
 * Ansicht des Reiters Tabellen (@W2A-075): Welche Ansicht gilt, steht in der Adresse (`?ansicht=`), Neuladen behält sie.
 * Rein, ohne React. Die Vorgabe hängt nicht von der Gruppe der Teams ab: Jeder gegen jeden ist EINE Tabelle (Turniermodus).
 */
import type { Tournament } from '../../types/tournament';

export type TabellenAnsicht = 'groups' | 'ranking';

/** Name des Abfrageparameters in der Adresse. */
export const TABELLEN_ANSICHT_PARAM = 'ansicht';

/** Vorgabe: die Tabelle (bei Jeder gegen jeden die Gesamttabelle aller Teams, sonst die Gruppentabellen). */
export const TABELLEN_ANSICHT_VORGABE: TabellenAnsicht = 'groups';

const WERT_IN_ADRESSE: Record<TabellenAnsicht, string> = { groups: 'tabelle', ranking: 'platzierung' };

export const tabellenAnsichtInAdresse = (ansicht: TabellenAnsicht): string => WERT_IN_ADRESSE[ansicht];

/** Ungültiger oder fehlender Wert → Vorgabe. */
export function tabellenAnsichtAusAdresse(wert: string | null): TabellenAnsicht {
  return (Object.keys(WERT_IN_ADRESSE) as TabellenAnsicht[]).find((a) => WERT_IN_ADRESSE[a] === wert) ?? TABELLEN_ANSICHT_VORGABE;
}

/**
 * „Jeder gegen jeden“ = eine Tabelle für alle Teams. Maßgeblich ist der Turniermodus; nur ohne Angabe des Modus (alte Daten)
 * entscheidet, ob irgendein Team eine Gruppe trägt.
 */
export function istEineTabelle(tournament: Pick<Tournament, 'groupSystem' | 'teams'>): boolean {
  if (tournament.groupSystem !== undefined) {
    return tournament.groupSystem === 'roundRobin';
  }
  return !tournament.teams.some((team) => team.group);
}

export type Medal = 'gold' | 'silver' | 'bronze' | 'none';

/** Medaille eines Platzes (1 bis 3); die Entscheidung „offener Gleichstand → keine Medaille“ trifft die Tabelle (@W2A-076). */
export const medalForRank = (rank: number): Medal => (rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'none');
