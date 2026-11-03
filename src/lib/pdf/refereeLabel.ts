/**
 * Anzeige des Schiedsrichters in der Spalte „SR“ (B-28 C1, @DR-025). Rein. Ohne Eintrag am Spiel bleibt die Anzeige
 * leer (gibt es nirgends einen Eintrag, hat der Spielplan keine Spalte). Mit Eintrag: die Nummer, bei „Teams pfeifen“ der
 * Teamname, nie der Name einer Person (C-SR-PERSONENNAME-IM-PDF; Personennamen im Ausdruck sind MVP+, @DR-042).
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
    // Veranstalter-Modus: nur die Nummer, auch wenn ein Name eingetragen ist (Personendaten, @DR-025 Beispiel 3)
    if (unknownTeam || schedule.refereeConfig?.mode !== 'teams') {
      return String(number);
    }
    return getRefereeDisplayName(number, { ...schedule.refereeConfig, refereeNames: undefined }, schedule.teams);
  };
}
