/**
 * GA4 A-13c: „Gruppe abschließen“ im Browser (lokaler Speicher/Gast, ohne Server) – Desktop 1280 px und Handy 360 px, hell und dunkel.
 * Ablauf wie im freigegebenen Mockup A-13c: Banner „Gruppe A ist fertig“ (@TM-044), Dialog mit Tabelle und Wirkung (@TM-016),
 * Abschluss besetzt Halbfinale 1 Heim und Halbfinale 2 Gast (@TM-046, @TM-047), „Gruppe wieder öffnen“ mit Pflichtgrund (@TM-072).
 * Gleichstand: Strafstoßschießen verlangt, ohne Eingabe bleibt die Gruppe offen (@TM-048, @TM-049). Bilder liegen unter
 * `test-results/a13c-bilder` (Vergleich gegen das Mockup per Skill `visuelle-pruefung`).
 * Der Cloud-Ablauf (Server besetzt, Verlauf) steht im Nikolaus-Durchlauf N7a (`tests/e2e/cloud/turniertag/steps/nikolaus-tabelle.ts`, bis zum Fenster am 10.11. erwartet rot).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';

const ID = 'a13c-gruppe-abschliessen';
const BILDER = join('test-results', 'a13c-bilder');
const T = (n: number): string => `00000000-0000-4000-8000-0000000013${String(n).padStart(2, '0')}`;
const TEAMS = [
  { id: T(1), name: 'FC Nord', group: 'A' }, { id: T(2), name: 'SV Süd', group: 'A' },
  { id: T(3), name: 'TSV West', group: 'A' }, { id: T(4), name: 'SC Ost', group: 'A' },
];
const ZEIT = '2026-03-14T09:00:00.000Z';

const spiel = (n: number, a: number, b: number, scoreA: number, scoreB: number) => ({
  id: `a13c-g${String(n)}`, round: n, field: 1, group: 'A', isFinal: false, phase: 'groupStage',
  slotA: { kind: 'team', teamId: T(a) }, slotB: { kind: 'team', teamId: T(b) },
  matchStatus: 'finished', status: 'FINISHED', scoreA, scoreB, scheduledTime: ZEIT, time: '09:00', finishedAt: '2026-03-14T10:00:00.000Z',
});

const halbfinale = (n: 1 | 2) => ({
  id: `a13c-hf${String(n)}`, round: 7, field: n, isFinal: true, phase: 'semifinal', label: `${String(n)}. Halbfinale`,
  slotA: { kind: 'pending', source: n === 1 ? { kind: 'groupRank', group: 'A', rank: 1 } : { kind: 'groupRank', group: 'B', rank: 1 } },
  slotB: { kind: 'pending', source: n === 1 ? { kind: 'groupRank', group: 'B', rank: 2 } : { kind: 'groupRank', group: 'A', rank: 2 } },
  matchStatus: 'scheduled', status: 'SCHEDULED', scheduledTime: ZEIT, time: '09:00',
});

/** Gruppe A (6 Spiele, alle entschieden), eine Gruppe, Halbfinals mit Herkunft; `gleichstand` = Süd und West gleich auf Platz 2 und 3. */
function turnier(gleichstand: boolean): Record<string, unknown> {
  return buildVisualTournament({
    id: ID,
    title: 'Hallencup Nord',
    extra: {
      groupSystem: 'groupsAndFinals',
      numberOfTeams: 4,
      numberOfGroups: 1,
      groups: [{ id: 'A', customName: 'Gruppe A' }],
      teams: TEAMS,
      placementsToPlayOut: [1, 2],
      placementLogic: [{ id: 'points', enabled: true }, { id: 'directComparison', enabled: true }, { id: 'goalDifference', enabled: true }, { id: 'goalsFor', enabled: true }],
      matches: [
        spiel(1, 1, 2, 2, 1), spiel(2, 1, 3, 1, 0), spiel(3, 1, 4, 3, 0),
        // ohne Gleichstand schlägt Süd West 2:0; mit Gleichstand 1:1 und gleiche Torbilanz (4:4), nach allen Kriterien gleich
        spiel(4, 2, 3, gleichstand ? 1 : 2, gleichstand ? 1 : 0), spiel(5, 2, 4, gleichstand ? 2 : 2, gleichstand ? 1 : 0), spiel(6, 3, 4, gleichstand ? 3 : 2, gleichstand ? 2 : 1),
        halbfinale(1), halbfinale(2),
      ],
    },
  });
}

type Seed = (d: Record<string, unknown>) => Promise<void>;

async function oeffneTabellen(page: Page, seed: Seed, gleichstand: boolean): Promise<void> {
  await seed({ tournaments: [turnier(gleichstand)] });
  await page.goto(`/#/tournament/${ID}/standings`);
  await expect(page.getByTestId('group-state-A')).toBeVisible({ timeout: 15000 });
}

const GERAETE = [
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'handy', width: 360, height: 800 },
] as const;

for (const geraet of GERAETE) {
  test.describe(`Gruppe abschließen – ${geraet.name}`, () => {
    test.use({ viewport: { width: geraet.width, height: geraet.height } });

    test('Banner, Dialog, Abschluss (Wirkung aus der Rangfolge), Wiederöffnen mit Grund (@TM-044, @TM-016, @TM-046, @TM-072)', async ({ page, seedIndexedDB }) => {
      mkdirSync(BILDER, { recursive: true });
      await oeffneTabellen(page, seedIndexedDB, false);

      // @TM-044: der Vorschlag steht da, die Plätze sind noch nicht besetzt
      await expect(page.getByTestId('group-close-suggestion')).toContainText('Gruppe A ist fertig');
      await expect(page.getByTestId('group-state-A')).toHaveText('bereit zum Abschluss');
      await page.screenshot({ path: join(BILDER, `z1-${geraet.name}.png`) });

      // @TM-016: Dialog mit Tabelle und Wirkung
      await page.getByTestId('group-close-button-A').click();
      const dialog = page.getByTestId('group-close-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId('group-close-effect')).toContainText('Halbfinale 1 Heim FC Nord');
      await expect(dialog.getByTestId('group-close-ranking').locator('li')).toHaveCount(4);
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(BILDER, `z7-${geraet.name}.png`) });
      await dialog.getByTestId('group-close-confirm').click();

      // @TM-046: abgeschlossen, Wirkung im Hinweis (aus der Rangfolge; das Besetzen der Halbfinal-Seiten selbst belegt `localGroupCompletion.besetzen.test.ts`), „Gruppe wieder öffnen“ vorhanden
      await expect(page.getByTestId('group-state-A')).toHaveText('abgeschlossen');
      await expect(page.getByTestId('group-done-A')).toContainText('FC Nord');
      await expect(page.getByTestId('group-close-suggestion')).toHaveCount(0);
      await page.screenshot({ path: join(BILDER, `z17-${geraet.name}.png`) });

      // @TM-072: Pflichtfeld Grund
      await page.getByTestId('group-reopen-A').click();
      const reopen = page.getByTestId('group-reopen-dialog');
      await expect(reopen.getByTestId('group-reopen-confirm')).toBeDisabled();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(BILDER, `z22-${geraet.name}.png`) });
      await reopen.getByTestId('group-reopen-reason').fill('Ergebnis SV Süd – TSV West prüfen');
      await reopen.getByTestId('group-reopen-confirm').click();
      await expect(page.getByTestId('group-state-A')).toHaveText('bereit zum Abschluss');
      await expect(page.getByTestId('group-close-button-A')).toHaveText('Erneut abschließen');
    });

    test('Gleichstand: das Strafstoßschießen wird verlangt, ohne Eingabe bleibt die Gruppe offen (@TM-048, @TM-049, @TM-043)', async ({ page, seedIndexedDB }) => {
      await oeffneTabellen(page, seedIndexedDB, true);
      await page.getByTestId('group-close-button-A').click();
      const dialog = page.getByTestId('tie-decision-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).not.toContainText(/Los\b|Auslos/);
      await expect(dialog.getByTestId('group-close-confirm')).toBeDisabled();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(BILDER, `z11-${geraet.name}.png`) });
      await dialog.getByTestId('tie-dialog-cancel').click();
      await expect(page.getByTestId('group-state-A')).toHaveText('bereit zum Abschluss');
    });
  });
}
