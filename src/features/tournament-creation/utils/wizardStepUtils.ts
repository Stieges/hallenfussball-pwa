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

/** Parse step from URL search params */
export function getStepFromSearchParams(searchParams: URLSearchParams): WizardStep {
  const stepParam = searchParams.get('step');
  if (!stepParam) { return 1; }

  const parsed = parseInt(stepParam, 10);
  if (isNaN(parsed) || parsed < 1 || parsed > 6) { return 1; }

  return parsed as WizardStep;
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
