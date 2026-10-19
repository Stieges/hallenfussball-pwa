/**
 * Wizard Step URL Utilities
 *
 * Helper functions for URL-based wizard step navigation.
 * Enables deep-linking to specific wizard steps via query parameters.
 */

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

/** Step labels for display */
export const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Stammdaten',
  2: 'Sportart',
  3: 'Modus',
  4: 'Gruppen & Felder',
  5: 'Teams',
  6: 'Übersicht',
};

/** Schritt aus der Adresse; fehlt der Parameter oder ist der Wert unbekannt, gibt es keinen Wunsch (null). */
export function parseStepParam(searchParams: URLSearchParams): WizardStep | null {
  const stepParam = searchParams.get('step');
  if (!stepParam || !/^\d+$/.test(stepParam)) { return null; }
  const parsed = parseInt(stepParam, 10);
  return parsed >= 1 && parsed <= 6 ? (parsed as WizardStep) : null;
}

/** Build wizard URL with step parameter */
export function buildWizardStepPath(step: WizardStep, tournamentId?: string): string {
  const basePath = tournamentId
    ? `/tournament/${tournamentId}/edit`
    : '/tournament/new';

  // Step 1 doesn't need query param (it's the default)
  if (step === 1) { return basePath; }

  return `${basePath}?step=${step}`;
}

/** Check if a path is a wizard path */
export function isWizardPath(pathname: string): boolean {
  return pathname === '/tournament/new' || pathname.endsWith('/edit');
}

/** Extract tournament ID from edit path */
export function getTournamentIdFromEditPath(pathname: string): string | null {
  const match = pathname.match(/^\/tournament\/([a-zA-Z0-9-]+)\/edit$/);
  return match?.[1] ?? null;
}
