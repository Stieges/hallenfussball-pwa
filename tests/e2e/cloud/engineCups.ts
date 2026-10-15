/**
 * tests/e2e/cloud/engineCups.ts — EINZIGE Quelle für die "Engine-Cups" der Cloud-E2E (A-23,
 * übernimmt C3b-3a, S5): je schreibendem Test ein eigenes Turnier mit genau EINEM Spiel, dessen
 * Spalten (Ergebnis, Status, Uhr, `live_state`) nur die RPC `append_match_events` gesetzt hat.
 * `scripts/e2e-seed.ts` und die Tests lesen nur aus dieser Tabelle; `testData.ts` re-exportiert sie.
 *
 * Zeiten: `atOffsetMs` ist relativ zur SERVERZEIT des Seed-Laufs (`seedNow`, S3), immer <= 0 und
 * streng aufsteigend. Ereignis-IDs sind fest (`engineEventId`), damit ein Test den Seed-Stand
 * exakt wiedererkennt ("Seed verbraucht", `expectSeededEngineMatch`).
 */

import type { EventType } from '../../../src/core/match';
import { e2eUuid } from './e2eUuid';

export type EngineCupForm = 'running' | 'finished' | 'untouched';

export interface EngineSeedEventSpec {
  /** Schlüssel innerhalb des Cups (ergibt mit dem Slug die feste Ereignis-ID). */
  key: string;
  type: EventType;
  /** Mannschaft des Ereignisses (Tor, Karte …); bei MATCH_START/MATCH_END weglassen. */
  side?: 'home' | 'away';
  /** Zeitpunkt relativ zur Serverzeit des Seed-Laufs (<= 0, streng aufsteigend je Cup). */
  atOffsetMs: number;
  payload?: Record<string, unknown>;
  /** Schlüssel des Zielereignisses (RETRACT/AMEND). */
  targetKey?: string;
}

export interface EngineCupSpec {
  slug: string;
  title: string;
  form: EngineCupForm;
  events: readonly EngineSeedEventSpec[];
  /** Erwarteter Stand der Spalten nach dem Seed. */
  expected: { status: 'scheduled' | 'running' | 'finished'; scoreA: number; scoreB: number };
  /** Zusätzliche Mitglieder (Rolle `collaborator`); der Owner ist immer Mitglied. */
  helper: boolean;
}

const START_OFFSET_MS = -60_000;
const GOAL_OFFSET_MS = -30_000;

const START: EngineSeedEventSpec = { key: 'start', type: 'MATCH_START', atOffsetMs: START_OFFSET_MS };
const GOAL_HOME: EngineSeedEventSpec = { key: 'goal-home', type: 'GOAL', side: 'home', atOffsetMs: GOAL_OFFSET_MS };

/** Standardform "running": Anpfiff vor 60 s, Tor Heim vor 30 s -> 1:0. */
const RUNNING_1_0 = [START, GOAL_HOME] as const;

function runningCup(slug: string, helper = true, events: readonly EngineSeedEventSpec[] = RUNNING_1_0): EngineCupSpec {
  return {
    slug,
    title: `Engine-Cup ${slug}`,
    form: 'running',
    events,
    expected: { status: 'running', scoreA: 1, scoreB: 0 },
    helper,
  };
}

/** Tor Heim mit Nr. 7 (fester Schlüssel `goal-home`), Grundlage für AMEND/RETRACT-Cups. */
const GOAL_HOME_NR7: EngineSeedEventSpec = { ...GOAL_HOME, payload: { playerNumber: 7 } };

export const E2E_ENGINE_CUPS = [
  runningCup('TOR'),
  runningCup('FINISH'),
  runningCup('FINISHAUSGANG'),
  runningCup('A2'),
  runningCup('UNDO'),
  runningCup('SYNC'),
  runningCup('REJECT'),
  runningCup('RECONNECT'),
  // A-06l: Offline-Robustheit (WLAN ohne Internet, hängende Anfrage, Rückkehr aus dem Ruhezustand).
  runningCup('OFFLINEWLAN'),
  runningCup('HAENGT'),
  runningCup('RUHEZUSTAND'),
  // A-06m: genau einmal (@FU-010), Einzel-Ablehnung (@FU-011), Realtime unterbrochen (@FU-025), Tab-Wechsel.
  runningCup('DOPPELT'),
  runningCup('DOPPELTLIVE'),
  runningCup('TEILABLEHNUNG'),
  runningCup('ALLEDREI'),
  runningCup('REALTIME'),
  runningCup('TABWECHSEL'),
  runningCup('TABSCHNELL'),
  runningCup('QUEUE', false),
  runningCup('AMEND', true, [START, GOAL_HOME_NR7]),
  // Zusätzlich eine Gelbe Karte VOR dem Tor: das Protokoll zeigt Zurückgenommenes nur im Zeitfenster
  // gezeigter wirksamer Einträge (U5, protocolEntries.takeRecent) -- ohne einen wirksamen Eintrag
  // bliebe es nach der Rücknahme leer ("Noch keine Ereignisse").
  runningCup('RETRACT', true, [START, { key: 'card-away', type: 'YELLOW_CARD', side: 'away', atOffsetMs: -40_000 }, GOAL_HOME_NR7]),
  runningCup('GELBROT'),
  {
    slug: 'HELPERAMEND',
    title: 'Engine-Cup HELPERAMEND',
    form: 'finished',
    events: [
      START,
      { ...GOAL_HOME_NR7, atOffsetMs: -50_000 },
      { key: 'goal-away', type: 'GOAL', side: 'away', atOffsetMs: -40_000 },
      { key: 'end', type: 'MATCH_END', atOffsetMs: -20_000 },
    ],
    expected: { status: 'finished', scoreA: 1, scoreB: 1 },
    helper: true,
  },
  {
    slug: 'HELPERSTART',
    title: 'Engine-Cup HELPERSTART',
    form: 'untouched',
    events: [],
    expected: { status: 'scheduled', scoreA: 0, scoreB: 0 },
    helper: true,
  },
  {
    slug: 'NSTART',
    title: 'Engine-Cup NSTART',
    form: 'untouched',
    events: [],
    expected: { status: 'scheduled', scoreA: 0, scoreB: 0 },
    helper: false,
  },
  {
    // Fixture für C3b-3b/C4 (kein Test darauf): Turniere mit AMEND- und RETRACT-Zeilen müssen
    // löschbar sein (FK target_event_id ON DELETE RESTRICT, 20260928_001:127).
    slug: 'LOESCHPROBE',
    title: 'Engine-Cup LOESCHPROBE',
    form: 'running',
    events: [
      START,
      { key: 'goal-home', type: 'GOAL', side: 'home', atOffsetMs: -50_000, payload: { playerNumber: 7 } },
      { key: 'amend', type: 'AMEND', atOffsetMs: -40_000, targetKey: 'goal-home', payload: { playerNumber: 8 } },
      { key: 'goal-away', type: 'GOAL', side: 'away', atOffsetMs: -30_000 },
      { key: 'retract', type: 'RETRACT', atOffsetMs: -20_000, targetKey: 'goal-away' },
    ],
    expected: { status: 'running', scoreA: 1, scoreB: 0 },
    helper: false,
  },
] as const satisfies readonly EngineCupSpec[];

/**
 * A-07d3: je ein laufendes Engine-Spiel für die drei Fälle von `abmelden-geraete.cloud.spec.ts`.
 * Eigentümer ist das Konto `abmelden` (nicht `owner`), siehe `testData.ts`. `scripts/e2e-seed.ts`
 * legt sie mit dessen Anmeldung an; `E2E_ENGINE_CUPS` (Eigentümer `owner`) bleibt unverändert.
 */
export const E2E_ABMELDEN_CUP_SLUGS = ['ABMELDEN1', 'ABMELDEN2', 'ABMELDEN3'] as const;
export type AbmeldenCupSlug = (typeof E2E_ABMELDEN_CUP_SLUGS)[number];
export const E2E_ABMELDEN_CUPS: readonly EngineCupSpec[] = E2E_ABMELDEN_CUP_SLUGS.map((slug) => runningCup(slug, false));

export type EngineCupSlug = (typeof E2E_ENGINE_CUPS)[number]['slug'] | AbmeldenCupSlug;

export interface EngineCupIds {
  tournamentId: string;
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
}

export function engineCupIds(slug: EngineCupSlug): EngineCupIds {
  return {
    tournamentId: e2eUuid(`tournament:engine-cup:${slug}`),
    matchId: e2eUuid(`match:engine-cup:${slug}`),
    homeTeamId: e2eUuid(`team:engine-cup:${slug}:home`),
    awayTeamId: e2eUuid(`team:engine-cup:${slug}:away`),
    homeTeamName: `Heim ${slug}`,
    awayTeamName: `Gast ${slug}`,
  };
}

export function engineEventId(slug: EngineCupSlug, key: string): string {
  return e2eUuid(`event:engine-cup:${slug}:${key}`);
}

export function getEngineCup(slug: EngineCupSlug): EngineCupSpec {
  const cup = [...E2E_ENGINE_CUPS, ...E2E_ABMELDEN_CUPS].find((candidate) => candidate.slug === slug);
  if (!cup) {
    throw new Error(`Engine-Cup ${slug} ist nicht definiert.`);
  }
  return cup;
}

/** Seed-IDs aller Engine-Ereignisse eines Cups (für `expectSeededEngineMatch`, exakter Vergleich). */
export function engineCupSeedEventIds(slug: EngineCupSlug): string[] {
  return getEngineCup(slug).events.map((event) => engineEventId(slug, event.key));
}

export const ENGINE_CUP_SEED_NOW_START_OFFSET_MS = START_OFFSET_MS;

// =============================================================================
// ALTSPIEL-CUPS (S8): nur Fixtures für C3b-3b, Tests darauf folgen dort.
// =============================================================================

export const E2E_LEGACY_CUPS = [
  { slug: 'FERTIG', title: 'Altspiel-Cup Fertig', rawStatus: 'finished', scoreA: 3, scoreB: 1 },
  { slug: 'GHOST', title: 'Altspiel-Cup Ghost', rawStatus: 'running', scoreA: 1, scoreB: 0 },
] as const;
export type LegacyCupSlug = (typeof E2E_LEGACY_CUPS)[number]['slug'];

export function legacyCupIds(slug: LegacyCupSlug): EngineCupIds {
  return {
    tournamentId: e2eUuid(`tournament:legacy-cup:${slug}`),
    matchId: e2eUuid(`match:legacy-cup:${slug}`),
    homeTeamId: e2eUuid(`team:legacy-cup:${slug}:home`),
    awayTeamId: e2eUuid(`team:legacy-cup:${slug}:away`),
    homeTeamName: `Alt Heim ${slug}`,
    awayTeamName: `Alt Gast ${slug}`,
  };
}
