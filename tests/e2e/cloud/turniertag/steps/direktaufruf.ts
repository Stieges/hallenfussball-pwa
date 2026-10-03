/**
 * @OB-029 "Jede Seite lässt sich über ihren Link direkt öffnen" (Szenariogrundriss) -- ein
 * parametrisierter Test, jede Beispielzeile ist ein Fall (Fallname = Kennung + Zeilenschlüssel).
 * Olli ist angemeldet, öffnet den kopierten Link in einem NEUEN Fenster (frischer Context mit
 * derselben Anmeldung) und sieht genau die Seite. A-24 ergänzt den Direktaufruf je Seite als Schritt.
 * Besitzer der noch roten Zeilen: der Routing-Auftrag der Oberfläche (Filter und Wizard-Schritt
 * stehen heute nicht in der URL).
 */
import { expect } from '@playwright/test';
import { E2E_DRAFT_CUP_ID } from '../../testData';
import { fetchTurniertagBracket, fetchTurniertagTeams, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

interface DirektCase {
  key: string;
  seite: string;
  expectedFail: boolean;
  open: (ctx: StepContext) => Promise<void>;
}

const CASES: readonly DirektCase[] = [
  {
    key: 'Spielplan Gruppe B',
    seite: 'den Spielplan des Hallencup Ost, gefiltert auf Gruppe B',
    expectedFail: true,
    open: async ({ asRole }) => {
      const page = await asRole('owner');
      await page.goto(`/#/tournament/${TURNIERTAG_ID}/schedule?group=B`);
      await page.waitForLoadState('networkidle');
      // Der Filter steht in der URL: die Gruppe ist gewählt UND der Link bleibt erhalten.
      await expect(page.locator('[data-testid="filter-group"]')).toHaveValue('B', { timeout: 5000 });
      expect(page.url()).toContain('group=B');
    },
  },
  {
    key: 'Admin Center Sichtbarkeit',
    seite: 'das Admin Center des Hallencup Ost, Bereich Sichtbarkeit',
    expectedFail: false,
    open: async ({ asRole }) => {
      const page = await asRole('owner');
      await page.goto(`/#/tournament/${TURNIERTAG_ID}/admin/visibility`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'Sichtbarkeit' }).first()).toBeVisible({ timeout: 15000 });
      expect(page.url()).toContain(`/tournament/${TURNIERTAG_ID}/admin/visibility`);
    },
  },
  {
    key: 'Wizard Schritt 3',
    seite: 'Schritt 3 beim Anlegen des Entwurfs',
    expectedFail: true,
    open: async ({ asRole }) => {
      const page = await asRole('owner');
      await page.goto(`/#/tournament/${E2E_DRAFT_CUP_ID}/edit?step=3`);
      await page.waitForLoadState('networkidle');
      // Aktiver Schritt des Wizard-Reiters ist Schritt 3 (aria-current="step").
      await expect(page.locator('[aria-current="step"]')).toHaveAttribute('aria-label', /^Schritt 3:/, { timeout: 5000 });
    },
  },
  {
    key: 'Cockpit Spiel 9',
    seite: 'das Cockpit von Spiel 9',
    expectedFail: false,
    open: async ({ asRole }) => {
      const { groupMatches } = await fetchTurniertagBracket();
      const match = groupMatches[8];
      const teams = new Map((await fetchTurniertagTeams()).map((team) => [team.id, team.name]));
      const page = await asRole('owner');
      await page.goto(`/#/tournament/${TURNIERTAG_ID}/live?matchId=${match.id}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-testid="team-name-home"]')).toHaveText(teams.get(match.team_a_id ?? '') ?? '', { timeout: 15000 });
      await expect(page.locator('[data-testid="team-name-away"]')).toHaveText(teams.get(match.team_b_id ?? '') ?? '');
    },
  },
  {
    key: 'App-Einstellungen',
    seite: 'die Einstellungen der App',
    expectedFail: false,
    open: async ({ asRole }) => {
      const page = await asRole('owner');
      await page.goto('/#/settings');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible({ timeout: 15000 });
    },
  },
];

export const steps: readonly TurniertagStep[] = CASES.map<TurniertagStep>((c) => ({
  id: `@OB-029 ${c.key}`,
  title: `Direktaufruf: ${c.seite}`,
  scenarios: ['@OB-029'],
  owner: c.expectedFail ? 'Routing-Auftrag Oberfläche (A-24)' : 'A-24 (Direktaufruf je Seite)',
  expectedFail: c.expectedFail,
  run: c.open,
}));
