/**
 * @OB-075 Begriffe stehen ausgeschrieben, Kurzformen nur in Tabellenköpfen · @OB-076 zusammengesetzte Bezeichnungen folgen der Sprache.
 * Offline (lokaler Speicher, ohne Server), Deutsch und Englisch: der Spielplan der Finalrunde zeigt „Halbfinale 1“ bzw. „Semifinal 1“,
 * die Spielkarten „Schiedsrichter 2“ bzw. „Referee 2“ und „Gruppe A“ bzw. „Group A“, die Gruppentabelle trägt im Kopf nur die erlaubten
 * Kurzformen mit dem ausgeschriebenen Begriff als Hinweis. Gegenbeispiel: nirgends „HF 1“, „SR 2“, „Gr. A“, „Pl.“ im sichtbaren Text.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';

const ID = 'ob075-begriffe';
const T = (n: number): string => `00000000-0000-4000-8000-0000000075${String(n).padStart(2, '0')}`;
const TEAMS = [
  { id: T(1), name: 'DJK Kammer', group: 'A' }, { id: T(2), name: 'TSV Petting', group: 'A' },
  { id: T(3), name: 'FC Nord', group: 'B' }, { id: T(4), name: 'SV Süd', group: 'B' },
];
const ZEIT = '2026-03-14T09:00:00.000Z';

const gruppenspiel = (n: number, a: number, b: number, group: string, referee: number) => ({
  id: `ob075-g${String(n)}`, round: n, field: 1, group, isFinal: false, phase: 'groupStage', referee,
  slotA: { kind: 'team', teamId: T(a) }, slotB: { kind: 'team', teamId: T(b) },
  matchStatus: 'scheduled', status: 'SCHEDULED', scheduledTime: ZEIT, time: '09:00',
});

const halbfinale = (n: 1 | 2) => ({
  id: `ob075-hf${String(n)}`, round: 7 + n, field: 1, isFinal: true, phase: 'semifinal', label: `${String(n)}. Halbfinale`, referee: 2,
  slotA: { kind: 'pending', source: { kind: 'groupRank', group: n === 1 ? 'A' : 'B', rank: 1 } },
  slotB: { kind: 'pending', source: { kind: 'groupRank', group: n === 1 ? 'B' : 'A', rank: 2 } },
  matchStatus: 'scheduled', status: 'SCHEDULED', scheduledTime: ZEIT, time: '10:00',
});

function turnier(): Record<string, unknown> {
  return buildVisualTournament({
    id: ID,
    title: 'Hallencup Nord',
    extra: {
      groupSystem: 'groupsAndFinals',
      numberOfTeams: 4,
      numberOfGroups: 2,
      groups: [{ id: 'A', customName: 'Gruppe A' }, { id: 'B', customName: 'Gruppe B' }],
      teams: TEAMS,
      refereeConfig: { mode: 'organizer', numberOfReferees: 2 },
      finals: { enabled: true },
      matches: [gruppenspiel(4, 1, 2, 'A', 2), gruppenspiel(5, 3, 4, 'B', 1), halbfinale(1), halbfinale(2)],
    },
  });
}

type Seed = (d: Record<string, unknown>) => Promise<void>;

// Läuft nur im Projekt `desktop`: Tabellen und Karten sind dort wie im Test beschrieben sichtbar (Handy: eigene Karten, abgesicherte
// Texte in den Komponententests `OB-075-tabellenkopf.test.tsx`).
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, 'nur breite Fenster (Projekt desktop)');

async function oeffneSpielplan(page: Page, seed: Seed, sprache: 'de' | 'en'): Promise<void> {
  await page.addInitScript((lang) => {
    localStorage.setItem('hallenfussball-settings', JSON.stringify({ language: lang }));
  }, sprache);
  await seed({ tournaments: [turnier()] });
  await page.goto(`/#/tournament/${ID}/schedule`);
  await expect(page.getByTestId('schedule-action-pdf')).toBeAttached({ timeout: 15000 });
}

const sichtbarerText = (page: Page): Promise<string> => page.locator('body').innerText();

/** Der sichtbare Text ohne die Tabellenköpfe mit Kurzform (ShortLabel, `data-short-term`): dort ist die Kurzform („SR“/„Ref“) erlaubt, mit ausgeschriebenem Hinweis (@OB-075). */
async function textOhneTabellenkopf(page: Page): Promise<string> {
  let text = await sichtbarerText(page);
  for (const kopf of await page.locator('thead th:has([data-short-term])').allInnerTexts()) {
    if (kopf.trim() !== '') { text = text.split(kopf).join(''); }
  }
  return text;
}

test.describe('@OB-075 / @OB-076 Spielplan der Finalrunde und Spielkarten', () => {
  test('@OB-075 Deutsch: „Halbfinale 1“, „Schiedsrichter 2“, „Gruppe A“ – nie „HF 1“, „SR 2“, „Gr. A“', async ({ page, seedIndexedDB }) => {
    await oeffneSpielplan(page, seedIndexedDB, 'de');
    const text = await textOhneTabellenkopf(page);
    expect(text).toContain('Halbfinale 1');
    expect(text).toMatch(/Schiedsrichter 2\b/);
    expect(text).not.toMatch(/Schiedsrichter: /);
    expect(text).toContain('Gruppe A');
    expect(text).not.toMatch(/\bHF\b|\bSR\b|\bGr\.|\bSF\b/);
  });

  test('@OB-075 Englisch: „Semifinal 1“, @OB-076 „Referee 2“ und „Group A“ – nie „SF 1“, „Ref 2“, „SR 2“', async ({ page, seedIndexedDB }) => {
    await oeffneSpielplan(page, seedIndexedDB, 'en');
    const text = await textOhneTabellenkopf(page);
    expect(text).toContain('Semifinal 1');
    expect(text).toMatch(/Referee 2\b/);
    expect(text).not.toMatch(/Referee: /);
    expect(text).toContain('Group A');
    expect(text).not.toMatch(/\bHF\b|\bSR\b|\bGr\.|\bSF\b|\bRef\b|Schiedsrichter|Halbfinale/);
  });

  test('@OB-076 Englisch: der Schiedsrichter-Block (Bearbeiten-Modus) bietet „Referee 1“ und „Referee 2“ an, nie „SR 1“ oder „Ref 1“', async ({ page, seedIndexedDB }) => {
    await oeffneSpielplan(page, seedIndexedDB, 'en');
    await page.getByTestId('schedule-edit-start').click();
    const optionen = (await page.locator('select option').allTextContents()).map((o) => o.trim());
    expect(optionen).toEqual(expect.arrayContaining(['Referee 1', 'Referee 2']));
    expect(optionen.join(' | ')).not.toMatch(/\bSR\b|\bRef\b|Schiedsrichter/);
  });

  test('@OB-076 Deutsch: der Schiedsrichter-Block (Bearbeiten-Modus) bietet „Schiedsrichter 1“ und „Schiedsrichter 2“ an, nie „SR 1“', async ({ page, seedIndexedDB }) => {
    await oeffneSpielplan(page, seedIndexedDB, 'de');
    await page.getByTestId('schedule-edit-start').click();
    const optionen = (await page.locator('select option').allTextContents()).map((o) => o.trim());
    expect(optionen).toEqual(expect.arrayContaining(['Schiedsrichter 1', 'Schiedsrichter 2']));
    expect(optionen.join(' | ')).not.toMatch(/\bSR\b/);
  });
});

test.describe('@OB-075 Tabellenkopf: Kurzformen nur dort, mit ausgeschriebenem Hinweis', () => {
  test('Deutsch: Gruppentabelle trägt #, Sp., S, U, N, Diff., Pkt. mit title „Platz“, „Spiele“ … (Gegenbeispiel: nie „Pl.“)', async ({ page, seedIndexedDB }) => {
    await page.addInitScript(() => localStorage.setItem('hallenfussball-settings', JSON.stringify({ language: 'de' })));
    await seedIndexedDB({ tournaments: [turnier()] });
    await page.goto(`/#/tournament/${ID}/standings`);
    const kopf = page.locator('table thead').first();
    await expect(kopf).toBeVisible({ timeout: 15000 });
    await expect(kopf.locator('[title="Spiele"]')).toHaveCount(1);
    await expect(kopf.locator('[title="Tordifferenz"]')).toHaveCount(1);
    await expect(kopf.locator('[title="Punkte"]')).toHaveCount(1);
    await expect(kopf.locator('[title="Platz"]')).toHaveCount(1);
    expect(await kopf.innerText()).toContain('Sp.');
    expect(await sichtbarerText(page)).not.toMatch(/\bPl\.|\bPkt\b(?!\.)|\bUnent\./);
  });

  test('Englisch: P, W, D, L, GD, Pts mit title „Played“, „Goal difference“, „Points“', async ({ page, seedIndexedDB }) => {
    await page.addInitScript(() => localStorage.setItem('hallenfussball-settings', JSON.stringify({ language: 'en' })));
    await seedIndexedDB({ tournaments: [turnier()] });
    await page.goto(`/#/tournament/${ID}/standings`);
    const kopf = page.locator('table thead').first();
    await expect(kopf).toBeVisible({ timeout: 15000 });
    await expect(kopf.locator('[title="Played"]')).toHaveCount(1);
    await expect(kopf.locator('[title="Goal difference"]')).toHaveCount(1);
    await expect(kopf.locator('[title="Points"]')).toHaveCount(1);
    expect(await sichtbarerText(page)).not.toMatch(/\bPos\b/);
  });
});
