/**
 * engineCommandWiringTypes (C3a-2a Fixrunde 3, P8/E2/W11): nur die Typen aus
 * `useEngineCommandWiring.ts` ausgelagert.
 *
 * F3b2 (Ausnahme E2): `mapCardTypeToEngine` ist die einzige Funktion hier -- bewusst trotzdem in
 * dieser Datei statt einer eigenen, weil `useEngineCommandWiring.ts` (299, Grenzdatei) keine
 * einzige Zeile mehr wachsen darf; der Kickoff nennt diese Datei explizit als Zielort.
 */
/**
 * A-08d2b: die neun Engine-Handler des Cockpits. B-07 (S4/R4): Befehle liefern die Ereignis-ID
 * (`null` bei Ablehnung oder noop). Kein Fallback mehr -- jede Aktion ohne Engine-Weg
 * wird in `useEngineCommandWiring` abgelehnt (mit Hinweis), nicht an einen Altweg weitergereicht.
 */
/** B-07: Optionen von `handleGoal` -- `clockMs`/`section` = Spielzeit und Abschnitt des ersten Tipps (L1, F5). */
export interface GoalHandlerOptions {
  own?: boolean;
  playerNumber?: number;
  assists?: number[];
  incomplete?: boolean;
  clockMs?: number;
  section?: number;
}

export interface EngineCommandHandlers {
  handleStart: (matchId: string) => Promise<boolean>;
  handlePause: (matchId: string) => Promise<string | null>;
  handleResume: (matchId: string) => Promise<string | null>;
  handleFinish: (matchId: string) => Promise<string | null>;
  /** B-07: liefert die ID des gespeicherten Tors (S4/R4), `null` bei Ablehnung; `own` = Eigentor (L2). */
  handleGoal: (matchId: string, teamId: string, delta: 1 | -1, options?: GoalHandlerOptions) => Promise<string | null>;
  handleCard: (
    matchId: string,
    teamId: string,
    cardType: 'YELLOW' | 'YELLOW_RED' | 'RED',
    options?: { playerNumber?: number; clockMs?: number; section?: number },
  ) => Promise<string | null>;
  handleTimePenalty: (
    matchId: string,
    teamId: string,
    options?: { playerNumber?: number; durationSeconds?: number; clockMs?: number; section?: number },
  ) => Promise<string | null>;
  handleSubstitution: (
    matchId: string,
    teamId: string,
    options?: { playersIn?: number[]; playersOut?: number[] },
  ) => Promise<string | null>;
  handleFoul: (matchId: string, teamId: string, options?: { playerNumber?: number }) => Promise<string | null>;
}

/**
 * F3b2 (Gelb-Rot im Cockpit): UI-Kartentyp -> Engine-Befehl (`MatchCommands.card`,
 * `MatchCommands.ts:125`). Ersetzt den fruehen ternaeren Ausdruck in `useEngineCommandWiring.ts`
 * (`cardType === 'YELLOW' ? 'YELLOW_CARD' : 'RED_CARD'`), der 'YELLOW_RED' faelschlich auf
 * 'RED_CARD' abbildete -- Gelb-Rot waere im Engine-Log als einfaches Rot gelandet.
 */
export function mapCardTypeToEngine(
  cardType: 'YELLOW' | 'YELLOW_RED' | 'RED',
): 'YELLOW_CARD' | 'YELLOW_RED_CARD' | 'RED_CARD' {
  switch (cardType) {
    case 'YELLOW':
      return 'YELLOW_CARD';
    case 'YELLOW_RED':
      return 'YELLOW_RED_CARD';
    case 'RED':
      return 'RED_CARD';
  }
}
