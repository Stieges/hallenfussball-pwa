/**
 * Visual Regression: Monitor-Anzeige (Task T5)
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 *
 * Route: /display/:tournamentId/:monitorId (MonitorDisplayPage). Anders als das Live-Cockpit
 * liest der Monitor die Match-Timer-Felder DIREKT aus `tournament.matches`, nicht aus der
 * `liveMatches-<id>`-localStorage-Quelle (toLiveMatch(), src/features/monitor-display/
 * MonitorDisplayPage.tsx:237-277) -- deshalb reicht hier das normale IndexedDB-Seeding.
 * `matchStatus: 'running'` ist der einzige von toLiveMatch()s statusMap erkannte Wert für
 * "läuft" (die Werte 'playing'/'RUNNING' aus anderen bestehenden Specs, z.B.
 * tests/e2e/flows/monitor-display.spec.ts, werden dort NICHT erkannt und fallen still auf
 * NOT_STARTED zurück -- für diesen Screenshot bewusst der laut statusMap korrekte Wert).
 *
 * Pixel-Shift (usePixelShift, src/hooks/usePixelShift.ts) bleibt dank freezeClock() auf der
 * Initialposition (siehe helpers.ts-Kommentar) -- kein zusätzlicher CSS-Mask nötig.
 */

import { test, expect } from '../helpers/test-fixtures';
import { freezeClock, commonMasks, buildVisualTournament, FIXED_NOW } from './helpers';

const TOURNAMENT_ID = 'visual-monitor-tournament';

test('Monitor: laufendes Spiel', async ({ page, seedIndexedDB }) => {
  // Ein Monitor ist ein Bildschirm im Querformat; Hochformat wird nicht unterstützt (zuschauer-und-monitor,
  // „Geparkt – Darstellung im Grenzfall“; wie MON-B02). Deshalb ohne das Handy-Profil (Hochformat).
  test.skip(test.info().project.name === 'visual-mobile', 'Monitor im Hochformat ist geparkt');
  await freezeClock(page);

  const tournament = buildVisualTournament({
    id: TOURNAMENT_ID,
    title: 'Nordstadt Hallencup',
    matches: [
      {
        id: 'visual-monitor-match',
        round: 1,
        teamA: '00000000-0000-4000-8000-0000000000a1',
        teamB: '00000000-0000-4000-8000-0000000000a2',
        field: 1,
        matchStatus: 'running',
        scoreA: 2,
        scoreB: 1,
        scheduledTime: '2026-03-14T09:20:00.000Z',
        // FIXED_NOW - 320s
        timerStartTime: new Date(FIXED_NOW.getTime() - 320_000).toISOString(),
        timerElapsedSeconds: 0,
      },
    ],
    monitors: [
      {
        id: 'visual-monitor-1',
        name: 'Haupthalle Monitor',
        defaultSlideDuration: 15,
        transition: 'fade',
        transitionDuration: 500,
        theme: 'dark',
        performanceMode: 'auto',
        slides: [
          {
            id: 'slide-live',
            type: 'live',
            config: { fieldId: 'field-1' },
            duration: null,
            order: 0,
          },
        ],
        createdAt: '2026-03-01T08:00:00.000Z',
        updatedAt: '2026-03-14T09:00:00.000Z',
      },
    ],
  });

  await seedIndexedDB({ tournaments: [tournament] });

  await page.goto(`/#/display/${TOURNAMENT_ID}/visual-monitor-1`);
  await page.waitForLoadState('networkidle');
  // Fehler-/Leerzustand darf nicht auftreten -- sonst würde ein leerer Monitor-Screen geprüft.
  await expect(page.getByTestId('monitor-error-state')).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('monitor-no-slides-state')).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByText('FC Nordstadt')).toBeVisible({ timeout: 10000 });

  await expect(page).toHaveScreenshot('monitor.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});

/**
 * MS1 (@ZM-087, @ZM-149): Folie „Nächste Spiele“ mit Vereinskürzeln bei 1280×720. Nur das Desktop-Profil
 * (1280×720, Querformat); Handy und Tablet im Hochformat sind für Monitore geparkt. Das Referenzbild entsteht im
 * CI-Lauf mit dem Label `visual-update` (Container), nicht lokal.
 */
test('Monitor: Nächste Spiele mit Vereinskürzeln', async ({ page, seedIndexedDB }) => {
  test.skip(test.info().project.name !== 'visual-desktop', 'Monitor nur im Querformat (1280×720)');
  await freezeClock(page);

  const tournament = buildVisualTournament({
    id: 'visual-monitor-kuerzel',
    title: 'Nordstadt Hallencup',
    matches: [
      { id: 'vk-1', round: 1, teamA: '00000000-0000-4000-8000-0000000000a1', teamB: '00000000-0000-4000-8000-0000000000a2', field: 1, matchStatus: 'scheduled', scheduledTime: '2026-03-14T10:00:00.000Z' },
      { id: 'vk-2', round: 1, teamA: '00000000-0000-4000-8000-0000000000a3', teamB: '00000000-0000-4000-8000-0000000000a4', field: 1, matchStatus: 'scheduled', scheduledTime: '2026-03-14T10:20:00.000Z' },
    ],
    extra: {
      teams: [
        { id: '00000000-0000-4000-8000-0000000000a1', name: 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921' },
        { id: '00000000-0000-4000-8000-0000000000a2', name: 'Eintracht Oberweiler-Niederstetten 1919' },
        { id: '00000000-0000-4000-8000-0000000000a3', name: 'Turn- und Sportverein Ost' },
        { id: '00000000-0000-4000-8000-0000000000a4', name: 'Sportvereinigung Nordheim' },
      ],
    },
    monitors: [
      {
        id: 'visual-monitor-kuerzel-1',
        name: 'Eingang Monitor',
        defaultSlideDuration: 15,
        transition: 'none',
        transitionDuration: 0,
        theme: 'dark',
        performanceMode: 'auto',
        slides: [{ id: 'slide-next', type: 'next-matches', config: {}, duration: null, order: 0 }],
        createdAt: '2026-03-01T08:00:00.000Z',
        updatedAt: '2026-03-14T09:00:00.000Z',
      },
    ],
  });

  await seedIndexedDB({ tournaments: [tournament] });

  await page.goto('/#/display/visual-monitor-kuerzel/visual-monitor-kuerzel-1');
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('monitor-error-state')).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByText('SG FF Nordheim-Süd 1921')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('TSV Ost')).toBeVisible();

  await expect(page).toHaveScreenshot('monitor-kuerzel.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});

/**
 * MS2 (@ME-067): Bildrand 5 % je Seite (Vorbelegung) und, als Paar dazu, Rand 0 % über `?rand=0` – Folie „Alle Tabellen“
 * bei 1280×720 (64/36 Bildpunkte Rand). Das Referenzbild entsteht im Container (scripts/visual-in-container.sh).
 */
for (const [abfrage, bild] of [['', 'monitor-rand.png'], ['?rand=0', 'monitor-rand0.png']] as const) {
  test(`Monitor: Bildrand ${abfrage === '' ? '5 % (Vorbelegung)' : '0 % (?rand=0)'}`, async ({ page, seedIndexedDB }) => {
    test.skip(test.info().project.name !== 'visual-desktop', 'Monitor nur im Querformat (1280×720)');
    await freezeClock(page);

    const tournament = buildVisualTournament({
      id: 'visual-monitor-rand',
      title: 'Nordstadt Hallencup',
      monitors: [
        {
          id: 'visual-monitor-rand-1',
          name: 'Halle Monitor',
          defaultSlideDuration: 15,
          transition: 'none',
          transitionDuration: 0,
          theme: 'dark',
          performanceMode: 'auto',
          slides: [{ id: 'slide-tabellen', type: 'all-standings', config: {}, duration: null, order: 0 }],
          createdAt: '2026-03-01T08:00:00.000Z',
          updatedAt: '2026-03-14T09:00:00.000Z',
        },
      ],
    });

    await seedIndexedDB({ tournaments: [tournament] });

    await page.goto(`/#/display/visual-monitor-rand/visual-monitor-rand-1${abfrage}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('monitor-error-state')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('monitor-slide')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('FC Nordstadt').first()).toBeVisible({ timeout: 10000 });

    await expect(page).toHaveScreenshot(bild, {
      fullPage: true,
      mask: commonMasks(page),
    });
  });
}

/**
 * B-27 (@ZP-003, @ZP-004, @ZP-046): Folie „Nächste Spiele“ nach dem Verschieben um 10 Minuten: groß die neue Uhrzeit, klein
 * „ursprünglich hh:mm“ darunter; das dritte Spiel ist nicht verschoben und trägt nichts. Nur das Desktop-Profil (1280×720).
 */
test('Monitor: Nächste Spiele mit ursprünglicher Uhrzeit', async ({ page, seedIndexedDB }) => {
  test.skip(test.info().project.name !== 'visual-desktop', 'Monitor nur im Querformat (1280×720)');
  await freezeClock(page);

  const a = (n: number) => `00000000-0000-4000-8000-0000000000a${n}`;
  const tournament = buildVisualTournament({
    id: 'visual-monitor-urspruenglich',
    title: 'Nordstadt Hallencup',
    matches: [
      { id: 'vu-1', round: 1, teamA: a(1), teamB: a(2), field: 1, matchStatus: 'scheduled', scheduledTime: '2026-03-14T10:10:00.000Z', originalStart: '2026-03-14T10:00:00.000Z' },
      { id: 'vu-2', round: 1, teamA: a(3), teamB: a(4), field: 1, matchStatus: 'scheduled', scheduledTime: '2026-03-14T10:30:00.000Z', originalStart: '2026-03-14T10:20:00.000Z' },
      { id: 'vu-3', round: 2, teamA: a(1), teamB: a(3), field: 1, matchStatus: 'scheduled', scheduledTime: '2026-03-14T10:50:00.000Z' },
    ],
    monitors: [
      {
        id: 'visual-monitor-urspruenglich-1',
        name: 'Eingang Monitor',
        defaultSlideDuration: 15,
        transition: 'none',
        transitionDuration: 0,
        theme: 'dark',
        performanceMode: 'auto',
        slides: [{ id: 'slide-next', type: 'next-matches', config: {}, duration: null, order: 0 }],
        createdAt: '2026-03-01T08:00:00.000Z',
        updatedAt: '2026-03-14T09:00:00.000Z',
      },
    ],
  });

  await seedIndexedDB({ tournaments: [tournament] });

  await page.goto('/#/display/visual-monitor-urspruenglich/visual-monitor-urspruenglich-1');
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('monitor-error-state')).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('monitor-match-original').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('monitor-match-original')).toHaveCount(2);

  await expect(page).toHaveScreenshot('monitor-urspruenglich.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});
