/**
 * Unimplemented Sport Capabilities
 *
 * `SportConfig` (siehe `types.ts`) deklariert Felder, die heute NICHT ausgewertet werden
 * — weder in der Ergebniseingabe noch in der Tabellenrechnung noch im Cockpit. Für Fußball
 * fällt das nicht auf, weil die Default-Werte dieser Felder zufällig zum tatsächlichen
 * Verhalten passen. Trüge jemand eine andere Sportart mit anderen Werten ein, würde die App
 * etwas versprechen, das sie nicht einlöst.
 *
 * Diese Liste macht das maschinenlesbar. Sie ist die Kennzeichnung "reserviert" aus
 * Task 6 (siehe `.superpowers/sdd/2026-09-21-terminologie-zentral/task-6-report.md`) und
 * wird von Task 7 ausgewertet — z. B. um vor dem Anlegen einer neuen Sportart zu warnen,
 * wenn deren Konfiguration von einem dieser Felder abweicht, oder um sie in Doku/UI als
 * "geplant, nicht verfügbar" zu markieren.
 *
 * NICHT löschen, wenn sich der Stand ändert — stattdessen den Eintrag entfernen, sobald das
 * Feld tatsächlich ausgewertet wird (siehe `rules.canDrawInGroupPhase`/`canDrawInFinals`: keine Produktivstelle
 * wertet sie aus; die Engine entscheidet über `rules.tiebreak` und das Ereignis TIEBREAK_CHOICE).
 */

import sportGlossary from '../../i18n/glossary.json';

export interface UnimplementedCapability {
  /** Punktweg zum Feld in `SportConfig`, z. B. `rules.isSetBased`. */
  field: string;
  /** Welche Fähigkeit das Feld voraussetzt. */
  requires: string;
  /** Was konkret fehlt, damit das Feld eine Wirkung hätte — so konkret, dass in zwei Jahren
   *  klar ist, was zu bauen wäre, nicht nur dass etwas fehlt. */
  missing: string;
}

export const UNIMPLEMENTED_CAPABILITIES: UnimplementedCapability[] = [
  {
    field: 'rules.isSetBased',
    requires: 'Satzbasierte Wertung (z. B. Volleyball)',
    missing:
      'Keine Auswertung in Ergebniseingabe, Tabellenrechnung und Cockpit. ' +
      'LiveMatch kennt nur homeScore/awayScore (+ overtimeScoreA/B, penaltyScoreA/B) — keine ' +
      'Satzliste. Die Engine (MatchCommands.goal) schreibt jeden Punkt direkt in den ' +
      'Gesamtscore statt in einen laufenden Satz; es gibt keine Satz-Gewinn-Erkennung, die einen ' +
      'neuen Satz startet. Die Tabellenberechnung (Gruppentabelle) kennt nur Tordifferenz/Punkte, ' +
      'keine Satzbilanz. Würde gebaut: eigenes `sets: { home: number; away: number }[]`-Feld auf ' +
      'LiveMatch, Satz-Abschluss-Logik in der Engine, Satzbilanz-Spalte in der Tabelle.',
  },
  {
    field: 'features.isSetBased',
    requires: 'Satzbasierte Wertung (UI-seitige Weiche für die Score-Eingabe)',
    missing:
      'Duplikat von rules.isSetBased auf Feature-Ebene, ebenfalls nirgends gelesen. Das ' +
      'Match-Cockpit (src/components/match-cockpit/, src/components/live-cockpit/) rendert immer ' +
      'die Tor-Eingabe (+1/-1-Buttons), es gibt keine alternative Satz-Eingabekomponente, die ' +
      'anhand dieses Flags eingeblendet würde.',
  },
  {
    field: 'rules.setsToWin',
    requires: 'Satzbasierte Wertung — Anzahl Sätze bis zum Matchgewinn',
    missing:
      'Setzt rules.isSetBased voraus (siehe dort). Ohne Satzverwaltung gibt es nichts, das diese ' +
      'Zahl auswerten könnte; kein Code prüft, ob eine Mannschaft die konfigurierte Satzanzahl ' +
      'erreicht hat, um das Match automatisch zu beenden.',
  },
  {
    field: 'rules.pointsPerSet',
    requires: 'Satzbasierte Wertung — Zielpunktzahl pro Satz',
    missing:
      'Setzt rules.isSetBased voraus. Kein Code beendet einen Satz automatisch, wenn diese ' +
      'Punktzahl erreicht ist — es gibt schon keinen Satz-Begriff in LiveMatch/Engine.',
  },
  {
    field: 'rules.tiebreakPoints',
    requires: 'Satzbasierte Wertung — abweichende Zielpunktzahl im Tiebreak-Satz',
    missing:
      'Setzt rules.isSetBased/pointsPerSet voraus. Kein Code unterscheidet einen "normalen" Satz ' +
      'von einem Tiebreak-Satz (z. B. 5. Satz Volleyball mit 15 statt 25 Punkten).',
  },
  {
    field: 'terminology.scoreFormat',
    requires: 'Anzeige-Format des Spielstands abhängig von der Sportart (Tore/Sätze/Punkte)',
    missing:
      'Wird deklariert (\'goals\' | \'sets\' | \'points\'), aber keine UI-Komponente liest es. ' +
      'Score-Anzeige in Cockpit, Tabelle und Monitor ist überall hart auf das Tore-Format ' +
      'ausgelegt (zwei Ganzzahlen "3 : 1"). Für \'sets\' oder \'points\' bräuchte es eine ' +
      'formatierende Stelle (z. B. eine gemeinsame `formatScore(sportConfig, match)`-Funktion), ' +
      'die heute nicht existiert.',
  },
  {
    field: 'features.hasDFBKeys',
    requires: 'Ein-/Ausblenden des DFB-Schlüssel-Systems je nach Sportart',
    missing:
      'Im MVP ist der DFB-Schlüssel @W4-028 aus: Der Schritt Modus/System rendert DFBKeySystem.tsx ' +
      'nicht, und der Spielplan-Generator bekommt kein dfbPatternCode. Das Flag wird deshalb ' +
      'von keiner Stelle ausgewertet. Die Reparatur der Tabelle (@W4-015, nach dem MVP) ' +
      'muss das Flag wieder auswerten, bevor es für eine zweite Sportart zählt.',
  },
  {
    field: 'features.hasBambiniMode',
    requires: 'Ein-/Ausblenden des Bambini-Modus je nach Sportart',
    missing:
      'BambiniSettings.tsx (src/features/tournament-creation/components/BambiniSettings.tsx) und ' +
      'die Bambini-Logik in Step1_SportAndType.tsx/Step2_ModeAndSystem.tsx/useTournamentWizard.ts ' +
      'sind unabhängig von diesem Flag aktiv. Keine Stelle liest ' +
      'sportConfig.features.hasBambiniMode.',
  },
  {
    field: 'features.hasRefereeAssignment',
    requires: 'Ein-/Ausblenden der Schiedsrichter-Zuweisung je nach Sportart',
    missing:
      'Die Schiedsrichter-Zuweisung (refereeAssigner.ts, RefereeSettings.tsx, ' +
      'RefereeAssignmentEditor.tsx) läuft für jede Sportart gleich, ungeachtet dieses Flags. ' +
      'Keine Stelle liest sportConfig.features.hasRefereeAssignment.',
  },
  {
    field: 'features.hasGoalAnimation',
    requires: 'Ein-/Ausblenden der Tor-Animation im Monitor je nach Sportart',
    missing:
      'GoalAnimation (src/components/monitor/GoalAnimation.tsx) wird in MonitorDisplayPage.tsx ' +
      'und MonitorTab.tsx fest eingebunden. useSportConfig.ts erwähnt hasGoalAnimation nur in ' +
      'einem JSDoc-Beispielkommentar (Zeile ~159) — kein produktiver Code liest es.',
  },
  {
    field: 'features.hasMatchTimer',
    requires: 'Ein-/Ausblenden des Spiel-Timers je nach Sportart',
    missing:
      'MatchTimer (src/components/monitor/MatchTimer.tsx) und die Timer-Logik in ' +
      'useMatchTimer.ts/useMatchCockpitPro.ts laufen für jede Sportart identisch. Keine Stelle ' +
      'liest sportConfig.features.hasMatchTimer.',
  },
  {
    field: 'features.hasPeriodTimer',
    requires: 'Ein-/Ausblenden von Halbzeit-/Perioden-spezifischer Timer-UI je nach Sportart',
    missing:
      'Es gibt keine eigenständige "Perioden-Timer"-Komponente — Halbzeitpause wird über ' +
      'HalftimeResetDialog.tsx und defaults.periodBreak abgewickelt (die bereits ausgewertet ' +
      'werden), ohne dieses Flag je zu konsultieren. Würde eine Sportart ohne Halbzeitpause ' +
      '(periods: 1) registriert, bliebe die Halbzeit-UI trotzdem erreichbar.',
  },
  {
    field: 'rules.hasOvertime',
    requires: 'Verfügbarkeit von Verlängerung als Tiebreaker-Option',
    missing:
      'Ob Verlängerung angeboten wird, hängt heute allein von rules.defaultTiebreaker ' +
      '(\'overtime-then-shootout\' vs. \'shootout\' vs. \'goldenGoal\') sowie der freien ' +
      'Tiebreaker-Auswahl im Cockpit ab — hasOvertime wird nirgends gelesen und könnte vom ' +
      'tatsächlich gewählten Tiebreaker-Modus abweichen, ohne dass es auffiele.',
  },
  {
    field: 'rules.overtimeDuration',
    requires: 'Standard-Dauer der Verlängerung, wenn hasOvertime aktiv ist',
    missing:
      'Setzt rules.hasOvertime als tatsächlich ausgewertetes Signal voraus (siehe dort). Die ' +
      'tatsächlich verwendete Dauer kommt aus rules.defaultTiebreakerDuration (bereits ' +
      'ausgewertet, siehe TournamentCreationService/useTournamentWizard) — overtimeDuration ist ' +
      'ein totes zweites Feld für denselben Zweck.',
  },
  {
    field: 'rules.hasShootout',
    requires: `Verfügbarkeit von ${sportGlossary.terms.penalty.de}/${sportGlossary.terms.penaltyShootout.de} als Tiebreaker-Option`,
    missing:
      'Wie hasOvertime: die tatsächlich angebotenen Tiebreaker-Optionen im Cockpit ' +
      'Die Tiebreaker-Befehle startOvertime/startGoldenGoal/startPenaltyShootout gibt es auf dem ' +
      'Engine-Weg nicht (Wiedereinschalten: B-09). Der Entscheidungsmodus läuft über rules.tiebreak ' +
      'bzw. das Ereignis TIEBREAK_CHOICE; dieses Flag wird von keiner Produktivstelle gelesen.',
  },
  {
    field: 'defaults.allowDraw',
    requires: 'Kennzeichnung, ob Unentschieden grundsätzlich zum Sport passen',
    missing:
      'Duplikat von rules.canDrawInGroupPhase, das derzeit von keiner Produktivstelle ausgewertet ' +
      'wird (die Engine entscheidet über rules.tiebreak). defaults.allowDraw selbst wird ebenfalls ' +
      'von keiner Stelle gelesen. Offene Frage (Befund in BEFUNDE-HEUTIGER-CODE.md): entfernen oder ' +
      'auf rules.canDrawInGroupPhase reduzieren, statt zwei Wahrheiten für dieselbe Frage zu pflegen.',
  },
];
