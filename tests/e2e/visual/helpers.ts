/**
 * Gemeinsame Helfer für die Visual-Regression-Specs (Task T5,
 * .superpowers/sdd/2026-09-24-testumgebung/task-T5-brief.md).
 *
 * ## Uhrzeit einfrieren
 *
 * `freezeClock()` nutzt `page.clock.setFixedTime()` statt des volleren
 * `page.clock.install()`+`pauseAt()`-Paars. Begründung (siehe Playwright-Doku,
 * node_modules/playwright/types/test.d.ts, Interface `Clock`):
 * - `install()` ersetzt `Date`, `setTimeout`, `setInterval`, `requestAnimationFrame` UND
 *   `requestIdleCallback` durch Fake-Implementierungen. Ungepaust laufen deren Timer nicht von
 *   selbst weiter ("Date.now will progress as timers fire") -- erst `pauseAt()` friert sie ein.
 *   Für diese App ist das riskant: `src/lib/lazyWithRetry.ts:47` nutzt `setTimeout` für einen
 *   Retry-Backoff beim Nachladen von Lazy-Chunks. Würde die Uhr VOR der Navigation eingefroren
 *   (nötig, damit der erste Render schon die richtige Zeit sieht), und schlüge aus irgendeinem
 *   Grund ein Chunk-Import fehl, bliebe der Retry-`setTimeout` für immer hängen -- der Screenshot-
 *   Test würde nie fertig.
 * - `setFixedTime()` patcht NUR `Date`/`Date.now()`, lässt `setTimeout`/`setInterval`/
 *   `requestAnimationFrame` unangetastet in Echtzeit weiterlaufen. Das reicht für alles, was diese
 *   App an Uhrzeit-Anzeigen hat, weil jede geprüfte Quelle ihren Wert aus `Date.now()` (bzw.
 *   `new Date()`) ableitet, nicht aus einem eigenen Tick-Zähler:
 *   - Spieluhr (`useMatchTimerExtended`, src/hooks/useMatchTimer.ts:70/131) läuft über
 *     `requestAnimationFrame` und berechnet bei JEDEM Frame `Date.now() - startTime` neu -- bei
 *     eingefrorenem `Date.now()` ist das Ergebnis auf jedem Frame identisch, obwohl rAF selbst
 *     unangetastet weiterläuft (kein Hänge-Risiko).
 *   - Monitor-Timer (`toLiveMatch`, src/features/monitor-display/MonitorDisplayPage.tsx:237-277)
 *     rechnet genauso über `timerStartTime`/`Date.now()`.
 *   - Pixel-Shift (`usePixelShift`, src/hooks/usePixelShift.ts) setzt erst nach 60 echten
 *     Sekunden `setInterval` einen neuen Zufalls-Shift -- ein Testlauf dauert weit unter 60s,
 *     der Shift bleibt bei der Initialposition `{x:0, y:0}` (identisch zu `IDENTITY`).
 *   - „vor X Min." (`formatLastSync`, src/features/collaboration/components/SyncStatusBar.tsx:138)
 *     vergleicht `new Date(timestamp)` mit `new Date()` -- beide über dieselbe gefrorene Uhr.
 *   Ergebnis: volle Determinismus-Wirkung ohne das Hänge-Risiko von `install()+pauseAt()`.
 *
 * `freezeClock()` MUSS vor der ersten Navigation aufgerufen werden (die Fixtures hier tun das
 * immer als ersten Schritt), damit auch der allererste Render bereits die gefrorene Zeit sieht.
 *
 * ## Masken
 *
 * `commonMasks()` deckt zusätzlich zur eingefrorenen Uhr (defensiv, „belegen nicht annehmen")
 * die im Brief genannten Elemente ab, die NICHT über `Date.now()` laufen:
 * - Toast-Container (`aria-label="Benachrichtigungen"`, src/components/ui/Toast/ToastContainer.tsx)
 *   -- existiert, matcht auf den gewählten Screens meist 0 Elemente (kein Toast im Ladepfad).
 * - Sync-Status-Badge (`data-testid="sync-status"`, src/features/collaboration/components/
 *   SyncStatusBar.tsx:220) -- existiert, zeigt u.U. „vor X Min." zusätzlich zur Uhr-Berechnung
 *   auch als reinen Text-Snapshot beim Mount.
 * - QR-Code (`data-testid="qr-code"`) -- KEIN existierendes Ziel (T5-Review, Issue #4, geprüft):
 *   der QR-Code wird in `src/components/dialogs/ShareDialog.tsx` per `generateQRCode()`
 *   (`src/utils/qrCodeGenerator.ts`) gerendert, aber OHNE dieses (oder irgendein) `data-testid`.
 *   Diese Maske ist bewusst rein aspirational (Brief nennt "QR- und Share-Codes" explizit) und
 *   bleibt wirkungslos, bis jemand das Testid am echten Element ergänzt UND ein Screen mit
 *   sichtbarem ShareDialog visuell getestet wird -- keiner der aktuell acht Screens zeigt ihn im
 *   initialen Ladezustand.
 * Playwright ignoriert Masken, die 0 Elemente matchen (kein Testfehler dadurch).
 */

import { Page, Locator } from '@playwright/test';

/** Eingefrorene "Jetzt"-Zeit für alle Visual-Specs (beliebig, aber fix -- siehe Zweck oben). */
export const FIXED_NOW = new Date('2026-03-14T09:30:00.000Z');

/** Turnier-Datum passend zu FIXED_NOW (App sieht dieses Datum konsistent als "heute"). */
export const FIXED_DATE = '2026-03-14';

/**
 * Friert `Date`/`Date.now()` auf `FIXED_NOW` ein. Muss vor der ersten Navigation/Seed-Operation
 * aufgerufen werden.
 */
export async function freezeClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_NOW);
}

/** Gemeinsame Masken, siehe Datei-Kommentar oben. */
export function commonMasks(page: Page): Locator[] {
  return [
    page.locator('[aria-label="Benachrichtigungen"]'),
    page.locator('[data-testid="sync-status"]'),
    page.locator('[data-testid="qr-code"]'),
  ];
}

// =============================================================================
// TOURNAMENT FIXTURE
// =============================================================================

export interface VisualTeam {
  id: string;
  name: string;
}

export interface VisualMatchOverride {
  id: string;
  round: number;
  teamA: string;
  teamB: string;
  field: number;
  matchStatus: 'scheduled' | 'running' | 'finished';
  scoreA?: number;
  scoreB?: number;
  scheduledTime: string;
  timerStartTime?: string;
  timerElapsedSeconds?: number;
}

/**
 * Ein vollständig deterministisches Turnier für Visual-Snapshots: feste IDs, feste Daten (kein
 * `new Date()`), vier Teams, drei Spiele (beendet/laufend/geplant) -- deckt die Stats-Anzeigen von
 * Dashboard/Turnier-Admin realistisch ab, ohne dass irgendein Feld vom echten "jetzt" abhängt.
 */
export function buildVisualTournament(overrides: {
  id: string;
  title: string;
  matches?: VisualMatchOverride[];
  monitors?: Record<string, unknown>[];
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const teams: VisualTeam[] = [
    { id: 'team-1', name: 'FC Nordstadt' },
    { id: 'team-2', name: 'SV Südpark' },
    { id: 'team-3', name: 'TSV Westtal' },
    { id: 'team-4', name: 'BSC Ostring' },
  ];

  const matches: VisualMatchOverride[] = overrides.matches ?? [
    {
      id: 'visual-match-1',
      round: 1,
      teamA: 'team-1',
      teamB: 'team-3',
      field: 1,
      matchStatus: 'finished',
      scoreA: 3,
      scoreB: 1,
      scheduledTime: '2026-03-14T09:00:00.000Z',
    },
    {
      id: 'visual-match-2',
      round: 2,
      teamA: 'team-2',
      teamB: 'team-4',
      field: 1,
      matchStatus: 'running',
      scoreA: 2,
      scoreB: 1,
      scheduledTime: '2026-03-14T09:20:00.000Z',
      timerStartTime: '2026-03-14T09:24:40.000Z', // FIXED_NOW - 320s
      timerElapsedSeconds: 0,
    },
    {
      id: 'visual-match-3',
      round: 3,
      teamA: 'team-1',
      teamB: 'team-4',
      field: 1,
      matchStatus: 'scheduled',
      scheduledTime: '2026-03-14T09:45:00.000Z',
    },
  ];

  return {
    id: overrides.id,
    title: overrides.title,
    status: 'published',
    sport: 'Hallenfußball',
    sportId: 'indoor-soccer',
    tournamentType: 'classic',
    mode: 'classic',
    date: FIXED_DATE,
    timeSlot: '09:00 - 12:00',
    startDate: FIXED_DATE,
    startTime: '09:00',
    numberOfTeams: 4,
    numberOfFields: 1,
    numberOfGroups: 1,
    groupSystem: 'roundRobin',
    groupPhaseGameDuration: 10,
    groupPhaseBreakDuration: 2,
    gameDuration: 10,
    breakDuration: 2,
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    placementLogic: ['points', 'goalDifference', 'goalsFor'],
    finals: { enabled: false },
    ageClass: 'U12',
    location: { name: 'Sporthalle Nordstadt' },
    teams,
    fields: [{ id: 'field-1', defaultName: 'Feld 1' }],
    matches: matches.map((m) => ({
      id: m.id,
      round: m.round,
      teamA: m.teamA,
      teamB: m.teamB,
      field: m.field,
      matchStatus: m.matchStatus,
      status: m.matchStatus.toUpperCase(),
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      scheduledTime: m.scheduledTime,
      time: m.scheduledTime.slice(11, 16),
      timerStartTime: m.timerStartTime,
      timerElapsedSeconds: m.timerElapsedSeconds,
    })),
    monitors: overrides.monitors ?? [],
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-14T09:00:00.000Z',
    ...overrides.extra,
  };
}

/**
 * Seedet die `liveMatches-<tournamentId>`-localStorage-Quelle, die das Live-Cockpit-Tab
 * (`useLiveMatches`, src/hooks/useLiveMatches.ts) tatsächlich liest -- getrennt vom
 * IndexedDB-Turnier-Blob. Muss NACH der ersten Navigation (Storage existiert erst dann) und vor
 * dem Aufruf des `/live`-Tabs passieren.
 */
export async function seedRunningLiveMatch(
  page: Page,
  tournamentId: string,
  match: {
    id: string;
    number: number;
    phaseLabel: string;
    fieldId: string;
    field: number;
    scheduledKickoff: string;
    durationSeconds: number;
    homeTeam: VisualTeam;
    awayTeam: VisualTeam;
    homeScore: number;
    awayScore: number;
    elapsedSeconds: number;
    timerStartTime: string;
  }
): Promise<void> {
  await page.evaluate(
    ({ key, liveMatch }) => {
      const record = {
        [liveMatch.id]: {
          ...liveMatch,
          status: 'RUNNING',
          events: [],
          timerElapsedSeconds: 0,
        },
      };
      localStorage.setItem(key, JSON.stringify(record));
    },
    { key: `liveMatches-${tournamentId}`, liveMatch: match }
  );
}
