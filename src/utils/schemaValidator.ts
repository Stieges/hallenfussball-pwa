import {
  TournamentSchema,
  TournamentConfiguration,
  ValidationResult,
  Condition,
  ConditionExpression,
  TournamentCase,
} from '../types/tournamentSchema';

/**
 * Evaluiert eine einzelne Condition Expression
 */
const evaluateExpression = (
  expression: ConditionExpression,
  config: TournamentConfiguration
): boolean => {
  const varValue = (config as any)[expression.var];

  switch (expression.op) {
    case '=':
      return varValue === expression.value;
    case '!=':
      return varValue !== expression.value;
    case '>':
      return varValue > expression.value;
    case '<':
      return varValue < expression.value;
    case '>=':
      return varValue >= expression.value;
    case '<=':
      return varValue <= expression.value;
    default:
      return false;
  }
};

/**
 * Evaluiert eine Condition (mit all/any)
 */
const evaluateCondition = (
  condition: Condition,
  config: TournamentConfiguration
): boolean => {
  if (condition.all) {
    return condition.all.every((expr) => evaluateExpression(expr, config));
  }

  if (condition.any) {
    return condition.any.some((expr) => evaluateExpression(expr, config));
  }

  return false;
};

/**
 * Validiert eine Turnierkonfiguration gegen ein Schema
 */
export const validateTournamentConfiguration = (
  schema: TournamentSchema,
  config: TournamentConfiguration
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Prüfe Constraints
  for (const constraint of schema.constraints) {
    const conditionMet = evaluateCondition(constraint.condition, config);

    if (conditionMet && !constraint.result.valid) {
      errors.push(constraint.result.reason);
    }
  }

  // 2. Finde passenden Case
  let matchedCase: TournamentCase | undefined;

  for (const tournamentCase of schema.cases) {
    const conditionMet = evaluateCondition(tournamentCase.condition, config);

    if (conditionMet) {
      matchedCase = tournamentCase;
      break;
    }
  }

  // 3. Warnungen, wenn kein Case gefunden wurde
  if (!matchedCase) {
    warnings.push(
      'Keine passende Turnier-Vorlage gefunden. Manuelle Konfiguration erforderlich.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    matchedCase,
  };
};

/**
 * Findet den passenden TournamentCase für eine Konfiguration
 */
export const findMatchingCase = (
  schema: TournamentSchema,
  config: TournamentConfiguration
): TournamentCase | undefined => {
  for (const tournamentCase of schema.cases) {
    const conditionMet = evaluateCondition(tournamentCase.condition, config);

    if (conditionMet) {
      return tournamentCase;
    }
  }

  return undefined;
};

/**
 * Generiert eine lesbare Beschreibung der Turnier-Struktur
 */
export const describeTournamentStructure = (
  tournamentCase: TournamentCase
): string => {
  const { tournamentStructure } = tournamentCase;
  const phases: string[] = [];

  for (const phase of tournamentStructure.phaseOrder) {
    const phaseMatches = tournamentStructure.phases[phase];

    if (!phaseMatches || phaseMatches.length === 0) {
      phases.push(`${getPhaseLabel(phase)} (manuell)`);
    } else {
      phases.push(`${getPhaseLabel(phase)} (${phaseMatches.length} Spiele)`);
    }
  }

  return phases.join(' → ');
};

/**
 * Liefert eine lesbare Bezeichnung für eine Phase
 */
const getPhaseLabel = (phase: string): string => {
  const labels: Record<string, string> = {
    quarterfinal: 'Viertelfinale',
    semifinal: 'Halbfinale',
    final: 'Finale',
    placement: 'Platzierungsspiele',
  };

  return labels[phase] || phase;
};

/**
 * Prüft, ob eine Konfiguration manuelle Paarungen erfordert
 */
export const requiresManualPairings = (
  tournamentCase: TournamentCase
): boolean => {
  const { tournamentStructure } = tournamentCase;

  // Prüfe, ob irgendeine Phase leer ist (manuelle Konfiguration erforderlich)
  for (const phase of tournamentStructure.phaseOrder) {
    const phaseMatches = tournamentStructure.phases[phase];

    if (!phaseMatches || phaseMatches.length === 0) {
      return true;
    }
  }

  return false;
};
