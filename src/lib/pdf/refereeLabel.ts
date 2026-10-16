/**
 * Anzeige des Schiedsrichters in der Spalte „SR“ (B-28 C1, @DR-025). Rein. Ohne Eintrag am Spiel bleibt die Anzeige
 * leer; die Spalte zeichnet dann ein Schreibfeld. Mit Eintrag: die Nummer, bei „Teams pfeifen“ der Teamname, bei
 * eingetragenen Namen der Name (`getRefereeDisplayName`).
 */
import { getRefereeDisplayName, type GeneratedSchedule, type ScheduledMatch } from '../../core/generators';

/** Anzeige für ein Spiel; leere Zeichenkette, wenn niemand eingetragen ist. */
export function refereeLabelFor(schedule: Pick<GeneratedSchedule, 'refereeConfig' | 'teams'>): (match: ScheduledMatch) => string {
  return match => {
    const number = match.referee;
    // Ohne Schiedsrichter-Modus blendet die App die Zuteilung aus; eine alte Nummer am Spiel zählt nicht (C1-F)
    const active = schedule.refereeConfig?.mode === 'organizer' || schedule.refereeConfig?.mode === 'teams';
    if (number === undefined || !active) {
      return '';
    }
    // Nummer ohne zugehöriges Team (veraltete Zuteilung): die Nummer zeigen statt abzubrechen
    const unknownTeam = schedule.refereeConfig?.mode === 'teams' && (number < 1 || number > schedule.teams.length);
    return unknownTeam ? String(number) : getRefereeDisplayName(number, schedule.refereeConfig, schedule.teams);
  };
}
