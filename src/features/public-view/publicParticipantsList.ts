/** Reihenfolge der Teilnehmerliste der Zuschauer-Seite (@ZM-196): nach Gruppen, in der Gruppe nach Namen, Nummern fortlaufend. */
import type { Team } from '../../types/tournament';

/** Teams je Gruppe (Gruppen nach Buchstabe), je Gruppe nach Namen; fortlaufende Nummern über alle Gruppen. */
export function participantsByGroup(teams: readonly Team[]): Array<{ group: string; entries: Array<{ team: Team; number: number }> }> {
  const groups = Array.from(new Set(teams.map((t) => t.group ?? ''))).sort((a, b) => a.localeCompare(b, 'de'));
  let number = 0;
  return groups.map((group) => ({
    group,
    entries: teams
      .filter((t) => (t.group ?? '') === group)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map((team) => { number += 1; return { team, number }; }),
  }));
}
