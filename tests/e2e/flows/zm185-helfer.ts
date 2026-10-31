/**
 * Gemeinsame Saat und Messhelfer für @ZM-185 (Zeilen der Monitor-Folien) und @ZM-157 (Logo über dem Namen).
 * „Nikolaus-Turnier“: Jeder gegen jeden, 6 Teams, 15 Spiele auf Feld 1 (Gherkin @ZM-185). TSV Waging rot trägt ein breites Logo,
 * „Sportgemeinschaft Nordheim“ ein hohes, TSV 1921 Fridolfing keines. Die Logos sind Platzhalter-Formen im Test, keine echten Wappen.
 */
import type { Page } from '@playwright/test';
import type { TestOptions } from '../helpers/test-fixtures';

export const NIKOLAUS = 'z185-nikolaus';
export const MIT_KO = 'z185-ko';
const STAMP = '2026-03-14T09:00:00.000Z';
const ID = (n: number): string => `00000000-0000-4000-8000-0000000001a${n}`;

const svg = (breite: number, hoehe: number, farbe: string): string =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${breite}" height="${hoehe}" viewBox="0 0 ${breite} ${hoehe}"><rect width="${breite}" height="${hoehe}" fill="${farbe}"/><rect x="${breite / 2 - 2}" width="4" height="${hoehe}" fill="white"/></svg>`,
  ).toString('base64')}`;

/** Breites Schild (3:1) und hohes Schild (1:3): jede Ecke des Bildes läge ohne Einpassen außerhalb des Kreises. */
export const LOGO_BREIT = svg(300, 100, '#c0392b');
export const LOGO_HOCH = svg(100, 300, '#1f6feb');

export const TEAMS = [
  { name: 'TSV Waging rot', logo: { type: 'base64', value: LOGO_BREIT } },
  { name: 'TSV 1921 Fridolfing' },
  { name: 'Sportgemeinschaft Nordheim', logo: { type: 'base64', value: LOGO_HOCH } },
  { name: 'DJK Kammer' },
  // Langes Wort, das die Kürzungsliste des Monitors nicht kennt: „Sportgemeinschaft“ würde dort zu „SG“ (Lücke im Gherkin, siehe Bericht)
  { name: 'Fußballgemeinschaft Oberweiler' },
  { name: 'DJK Otting' },
] as const;

export function nikolausTurnier(id: string, opts: { theme?: string; mitKo?: boolean; beendet?: number; teams?: ReadonlyArray<{ name: string; logo?: { type: string; value: string } }> } = {}) {
  const teams = (opts.teams ?? TEAMS).map((t, i) => ({ id: ID(i + 1), group: 'A', ...t }));
  const paare: Array<[number, number]> = [];
  for (let i = 0; i < 6; i += 1) { for (let j = i + 1; j < 6; j += 1) { paare.push([i, j]); } }
  const spiel = (n: number, a: string, b: string, ende: boolean) => ({
    id: `m${n}`, number: n, round: 1, teamA: a, teamB: b, slotA: { kind: 'team', teamId: a }, slotB: { kind: 'team', teamId: b },
    field: 1, fieldNumber: 1, group: 'A', groupId: 'A', matchStatus: ende ? 'finished' : 'scheduled', status: ende ? 'FINISHED' : 'SCHEDULED',
    ...(ende ? { scoreA: 2, scoreB: 1, timerElapsedSeconds: 600 } : {}),
    scheduledTime: `2026-03-14T${String(10 + Math.floor((n - 1) / 6)).padStart(2, '0')}:${String(((n - 1) % 6) * 10).padStart(2, '0')}:00.000Z`, durationSeconds: 600,
  });
  const matches = paare.map(([i, j], n) => spiel(n + 1, ID(i + 1), ID(j + 1), n < (opts.beendet ?? 0)));
  if (opts.mitKo) {
    matches.push({ ...spiel(16, ID(1), ID(2), false), phase: 'final', round: 2, group: undefined, groupId: undefined } as never);
  }
  const monitor = (id2: string, type: string, config: object) => ({
    id: id2, name: id2, slides: [{ id: 's1', type, config, duration: null, order: 0 }],
    defaultSlideDuration: 60, transition: 'none', transitionDuration: 0, theme: opts.theme ?? 'dark', performanceMode: 'auto', createdAt: STAMP, updatedAt: STAMP,
  });
  return {
    id, title: 'Nikolaus-Turnier', name: 'Nikolaus-Turnier', status: 'published', sport: 'hallenfussball', sportId: 'football-indoor',
    tournamentType: 'classic', mode: 'classic', numberOfFields: 1, numberOfTeams: 6, groupPhaseGameDuration: 10,
    placementLogic: ['points', 'goalDiff', 'goalsFor'], finals: { enabled: false }, isKidsTournament: false,
    ...(opts.mitKo ? { finalsConfig: { preset: 'final-only' } } : {}),
    hideScoresForPublic: false, hideRankingsForPublic: false, isPublic: false, resultMode: 'standard',
    date: '2026-03-14', timeSlot: '10:00 - 14:00', startDate: '2026-03-14', startTime: '10:00', numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2, ageClass: 'U11', location: { name: 'Test-Halle' },
    pointSystem: { win: 3, draw: 1, loss: 0 }, groups: [{ id: 'A', name: 'Gruppe A', teamIds: teams.map((t) => t.id) }], teams, matches,
    monitors: [monitor('mon-plan', 'schedule-field', { fieldId: 'field-1' }), monitor('mon-naechste', 'next-matches', { matchCount: 10 })],
    fields: [{ id: 'field-1', defaultName: 'Feld 1' }], createdAt: STAMP, updatedAt: STAMP,
  };
}

export async function saeen(seedIndexedDB: TestOptions['seedIndexedDB'], theme = 'dark'): Promise<void> {
  await seedIndexedDB({
    tournaments: [
      nikolausTurnier(NIKOLAUS, { theme, beendet: 2 }),
      nikolausTurnier(MIT_KO, { theme, beendet: 2, mitKo: true }),
    ],
  });
}

export async function oeffneMonitor(page: Page, turnier: string, monitor: string): Promise<void> {
  await page.goto(`/#/display/${turnier}/${monitor}`);
  await page.locator('[data-testid="monitor-slide"]').waitFor({ timeout: 15_000 });
  await page.locator('[data-testid="monitor-match-row"]').first().waitFor({ timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}
