/**
 * Der Gruppenspielplan passt nicht vollständig in die Einstellungen (@W4-025).
 *
 * `message` ist technisch und nur für Logs. Der Nutzertext kommt über i18n
 * (`wizard:schedule.incomplete`, `wizard:replan.reasonScheduleIncomplete`) und
 * wird aus `missingMatches` gebildet.
 */
export class IncompleteScheduleError extends Error {
  readonly missingMatches: number;

  constructor(missingMatches: number) {
    super(`Schedule incomplete: ${missingMatches} matches missing`);
    this.name = 'IncompleteScheduleError';
    this.missingMatches = missingMatches;
  }
}
