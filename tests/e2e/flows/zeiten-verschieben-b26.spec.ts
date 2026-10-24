/**
 * B-26 „Zeiten verschieben“, offline (Gast, ohne Anmeldung): Record Zeitplan am Turniertag, Mockup „Zeiten verschieben“.
 * Ein Feld, alle 12 Minuten (10 Spiel + 2 Pause); Spiel 1 und 2 beendet, Spiel 3 läuft, Spiel 4 bis 8 geplant (in der Zukunft).
 * Szenarien: @ZP-094 (Taste im Spielplan-Reiter), @ZP-098 (⋮ je Spiel), @ZP-017/@ZP-018 (Vorschau, ohne Bestätigung nichts),
 * @ZP-012/@ZP-016 (bestätigt verschiebt, laufendes bleibt), @ZP-036 (Streifen, Rückgängig/Wiederherstellen).
 * Vitest: src/features/tournament-management/time-shift/__tests__/ScheduleTimeShift.test.tsx, src/core/services/__tests__/scheduleShift.test.ts.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';

const TOURNAMENT = 'b26-zeiten-verschieben-offline';
const TEAMS = Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-0000000026a${i}`);
const MATCH = (n: number) => `00000000-0000-4000-8000-0000000026b${n}`;
const BILDER = process.env.B26_BILDER;

/** Spielbeginn als Wanduhr: Spiel 1 liegt 30 Minuten vor jetzt (auf 5 Minuten abgerundet). */
function base(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - (d.getMinutes() % 5) - 30);
  return d;
}
/** Wanduhr in Europe/Berlin (die App rechnet „jetzt“ in der Turnier-Zeitzone; der Browser läuft in derselben Zone) */
const berlin = (d: Date, part: 'date' | 'time') => new Intl.DateTimeFormat('en-CA', part === 'date'
  ? { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }
  : { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
const clock = (d: Date) => berlin(d, 'time');
const kickoff = (n: number) => new Date(base().getTime() + (n - 1) * 12 * 60_000);

function turnier(): Record<string, unknown> {
  const date = berlin(base(), 'date'); // nie toISOString: zwischen 0 und 2 Uhr wäre das der Vortag (B5)
  const status = (n: number) => (n <= 2 ? { matchStatus: 'finished', scoreA: 1, scoreB: 0 } : n === 3
    ? { matchStatus: 'running', scoreA: 0, scoreB: 0, timerStartTime: new Date().toISOString(), timerElapsedSeconds: 0 }
    : { matchStatus: 'scheduled' });
  const matches = Array.from({ length: 8 }, (_, i) => {
    const n = i + 1;
    const a = TEAMS[i % 6];
    const b = TEAMS[(i + 1) % 6];
    return {
      id: MATCH(n), round: n, field: 1, matchNumber: n, phase: 'groupStage', group: 'A', teamA: a, teamB: b,
      slotA: { kind: 'team', teamId: a }, slotB: { kind: 'team', teamId: b },
      scheduledTime: kickoff(n).toISOString(), ...status(n),
    };
  });
  return {
    id: TOURNAMENT, status: 'published', sport: 'football', sportId: 'football-indoor', tournamentType: 'classic', mode: 'classic',
    numberOfFields: 1, numberOfTeams: 6, numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: false }, finalsConfig: { preset: 'none' },
    isKidsTournament: false, hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 }, title: 'Nikolaus-Turnier', ageClass: 'U12',
    date, timeSlot: '10:00 - 14:00', startDate: date, startTime: clock(base()), location: { name: 'Halle Nord' },
    teams: TEAMS.map((id, i) => ({ id, name: ['FC Nord', 'SC Ost', 'SV Süd', 'TSV West', 'DJK Berg', 'TuS Tal'][i], group: 'A' })),
    matches,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

const original = (page: Page, n: number) => page.getByTestId(`match-original-${MATCH(n)}`).filter({ visible: true });

/** Neu laden; ein Dialog räumt beim Schließen seinen Verlaufseintrag (history.back) auf – bricht das Laden daran ab, einmal wiederholen. */
async function reloadSchedule(page: Page): Promise<void> {
  try {
    await page.reload();
  } catch {
    await page.reload();
  }
  await expect(page.getByTestId('schedule-shift-button')).toBeVisible();
}

async function openSchedule(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${TOURNAMENT}/schedule`);
  await expect(page.getByTestId('schedule-shift-button')).toBeVisible();
}

async function shiftFromFirstOpen(page: Page): Promise<void> {
  await page.getByTestId('schedule-shift-button').click();
  await page.getByTestId('time-shift-proceed').click();
  await expect(page.getByTestId('time-shift-preview')).toContainText('5 Spiele verschieben sich');
  await page.getByTestId('time-shift-confirm').click();
}

test.describe('B-26 Zeiten verschieben (offline)', () => {
  test.use({ timezoneId: 'Europe/Berlin' });
  test.beforeEach(async ({ seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [turnier()] });
  });

  test('@ZP-094 @ZP-017 @ZP-018 Taste öffnet den Dialog, die Vorschau ändert ohne Bestätigung nichts', async ({ page }) => {
    await openSchedule(page);
    await page.getByTestId('schedule-shift-button').click();
    await expect(page.getByTestId('time-shift-summary')).toContainText('5 Spiele verschieben sich');
    await page.getByTestId('time-shift-proceed').click();
    const preview = page.getByTestId('time-shift-preview');
    await expect(preview).toContainText('Noch nichts geändert');
    await expect(preview).toContainText(`${clock(kickoff(4))}`);
    if (BILDER) { await page.screenshot({ path: `${BILDER}/vorschau-${test.info().project.name}.png` }); }
    await page.getByTestId('time-shift-preview-cancel').click();
    await expect(preview).toBeHidden();
    await expect(original(page, 4)).toHaveCount(0);
    await reloadSchedule(page);
    await expect(original(page, 4)).toHaveCount(0);
  });

  test('@ZP-012 @ZP-016 Bestätigen verschiebt die geplanten Spiele, das laufende Spiel bleibt; Streifen erscheint', async ({ page }) => {
    await openSchedule(page);
    await shiftFromFirstOpen(page);
    for (const n of [4, 8]) {
      await expect(original(page, n)).toHaveText(`ursprünglich ${clock(kickoff(n))}`);
    }
    await expect(original(page, 3)).toHaveCount(0);
    const strip = page.getByTestId('time-shift-strip');
    await expect(strip).toContainText('Zeiten um 10 Min. verschoben');
    await expect(strip).toContainText('Ausdrucke sind veraltet');
    if (BILDER) { await page.screenshot({ path: `${BILDER}/danach-${test.info().project.name}.png` }); }
    // gespeichert: nach dem Neuladen steht weiter „ursprünglich“
    await reloadSchedule(page);
    await expect(original(page, 4)).toHaveText(`ursprünglich ${clock(kickoff(4))}`);
  });

  test('@ZP-098 ⋮ am laufenden Spiel nicht wählbar, am geplanten Spiel mit „ab Spiel“ vorbelegt', async ({ page }) => {
    await openSchedule(page);
    await page.getByTestId(`match-menu-${MATCH(3)}`).filter({ visible: true }).click();
    await expect(page.getByTestId('ab-hier-verschieben')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('ab-hier-verschieben-grund')).toContainText('Spiel 3 läuft bereits');
    await page.getByTestId('match-menu-cancel').click();
    await page.getByTestId(`match-menu-${MATCH(6)}`).filter({ visible: true }).click();
    await page.getByTestId('ab-hier-verschieben').click();
    await expect(page.getByTestId('time-shift-from-match')).toHaveValue(MATCH(6));
    await expect(page.getByTestId('time-shift-summary')).toContainText('3 Spiele verschieben sich');
  });

  test('@ZP-036 Rückgängig aus dem Streifen stellt die ursprünglichen Uhrzeiten wieder her', async ({ page }) => {
    await openSchedule(page);
    await shiftFromFirstOpen(page);
    await expect(original(page, 4)).toBeVisible();
    await page.getByTestId('zeiten-rueckgaengig').click();
    await expect(page.getByTestId('time-shift-restore-preview')).toContainText('5 Spiele verschieben sich');
    await page.getByTestId('time-shift-confirm').click();
    await expect(original(page, 4)).toHaveCount(0);
    await expect(original(page, 8)).toHaveCount(0);
    await expect(page.getByTestId('time-shift-strip')).toHaveCount(0);
  });
});
