/**
 * engineCommandWiringTypes (C3a-2a Fixrunde 3, P8/E2/W11): nur die Typen aus
 * `useEngineCommandWiring.ts` ausgelagert.
 *
 * F3b2 (Ausnahme E2): `mapCardTypeToEngine` ist die einzige Funktion hier -- bewusst trotzdem in
 * dieser Datei statt einer eigenen, weil `useEngineCommandWiring.ts` (299, Grenzdatei) keine
 * einzige Zeile mehr wachsen darf; der Kickoff nennt diese Datei explizit als Zielort.
 */
/**
 * A-08d2b: die neun Engine-Handler des Cockpits. Kein Fallback mehr -- jede Aktion ohne Engine-Weg
 * wird in `useEngineCommandWiring` abgelehnt (mit Hinweis), nicht an einen Altweg weitergereicht.
 */
export interface EngineCommandHandlers {
  handleStart: (matchId: string) => Promise<boolean>;
  handlePause: (matchId: string) => Promise<void>;
  handleResume: (matchId: string) => Promise<void>;
  handleFinish: (matchId: string) => Promise<void>;
  handleGoal: (
    matchId: string,
    teamId: string,
    delta: 1 | -1,
    options?: { playerNumber?: number; assists?: number[]; incomplete?: boolean },
  ) => Promise<void>;
  handleCard: (
    matchId: string,
    teamId: string,
    cardType: 'YELLOW' | 'YELLOW_RED' | 'RED',
    options?: { playerNumber?: number },
  ) => Promise<void>;
  handleTimePenalty: (
    matchId: string,
    teamId: string,
    options?: { playerNumber?: number; durationSeconds?: number },
  ) => Promise<void>;
  handleSubstitution: (
    matchId: string,
    teamId: string,
    options?: { playersIn?: number[]; playersOut?: number[] },
  ) => Promise<void>;
  handleFoul: (matchId: string, teamId: string, options?: { playerNumber?: number }) => Promise<void>;
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
