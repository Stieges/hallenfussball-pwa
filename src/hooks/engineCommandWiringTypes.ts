/**
 * engineCommandWiringTypes (C3a-2a Fixrunde 3, P8/E2/W11): nur die Typen aus
 * `useEngineCommandWiring.ts` ausgelagert -- die "guarded delegates" (Implementierung) sitzen in
 * `./engineCommandWiringHelpers` (E2: keine Typ-Datei fuer Code).
 *
 * F3b2 (Ausnahme E2): `mapCardTypeToEngine` ist die einzige Funktion hier -- bewusst trotzdem in
 * dieser Datei statt einer eigenen, weil `useEngineCommandWiring.ts` (299, Grenzdatei) keine
 * einzige Zeile mehr wachsen darf; der Kickoff nennt diese Datei explizit als Zielort.
 */
export interface EngineCommandFallbackHandlers {
  handleStart: (matchId: string) => Promise<boolean>;
  handlePause: (matchId: string) => Promise<void>;
  handleResume: (matchId: string) => Promise<void>;
  handleFinish: (matchId: string) => Promise<void>;
  handleForceFinish: (matchId: string) => Promise<void>;
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
  handleStartOvertime: (matchId: string) => Promise<void>;
  handleStartGoldenGoal: (matchId: string) => Promise<void>;
  handleStartPenaltyShootout: (matchId: string) => Promise<void>;
  handleRecordPenaltyResult: (matchId: string, homeScore: number, awayScore: number) => Promise<void>;
  handleCancelTiebreaker: (matchId: string) => Promise<void>;
  handleAbortPenaltyShootout: (matchId: string) => Promise<void>;
  handleManualEditResult: (matchId: string, homeScore: number, awayScore: number) => Promise<void>;
  handleAdjustTime: (matchId: string, newElapsedSeconds: number) => Promise<void>;
  handleSkipMatch: (matchId: string, reason: string) => Promise<void>;
  handleUnskipMatch: (matchId: string) => Promise<void>;
  handleUndoLastEvent: (matchId: string) => Promise<void>;
  handleUpdateEvent: (
    matchId: string,
    eventId: string,
    updates: { playerNumber?: number; incomplete?: boolean },
  ) => Promise<void>;
  handleDeleteEvent: (matchId: string, eventId: string) => Promise<void>;
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

/** Die reinen "guarded delegates" (kein eigener MatchCommands-Aufruf, nur PC14-Toast-Wache vs.
 * unveraendertem Alt-Handler) -- Teilmenge von `EngineCommandFallbackHandlers`, die
 * `engineCommandWiringHelpers.createGuardedDelegates` erzeugt. */
export type GuardedDelegateHandlers = Pick<
  EngineCommandFallbackHandlers,
  | 'handleForceFinish'
  | 'handleStartOvertime'
  | 'handleStartGoldenGoal'
  | 'handleStartPenaltyShootout'
  | 'handleRecordPenaltyResult'
  | 'handleCancelTiebreaker'
  | 'handleAbortPenaltyShootout'
  | 'handleManualEditResult'
  | 'handleAdjustTime'
  | 'handleSkipMatch'
  | 'handleUnskipMatch'
  | 'handleUndoLastEvent'
  | 'handleUpdateEvent'
  | 'handleDeleteEvent'
>;
