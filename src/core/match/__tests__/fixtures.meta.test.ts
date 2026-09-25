/**
 * Meta-Test der Fixture-Sammlung (B1c). Prüft die Pflege-Regeln aus dem Brief (Abschnitt 3),
 * unabhängig vom fachlichen Fixture-Runner (`fixtures.test.ts`): vollständige `results`/
 * `serverState`, eindeutige Event-IDs je Datei, ganzzahlige `at`-Werte, gesetztes `actorUser`
 * aus der erlaubten Rollen-Menge (B3b-Vertrag) -- und dass jedes in Abschnitt 1 des Briefs
 * geforderte Szenario durch mindestens eine Fixture abgedeckt ist (Konstante `IN_SCOPE_SZENARIEN`
 * unten, wörtlich aus dem Fundament-Dokument, `docs/anforderungen/plattform/
 * 2026-09-24_fundament-gemeinsamer-stand.md`, Zeilen 53-648).
 *
 * @see .superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B1c-brief.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EngineEvent } from '../types';

interface Fixture {
  title: string;
  szenario: string | null;
  ctx: { matchId: string; teamAId: string; teamBId: string };
  mode: 'log' | 'batch';
  prior?: EngineEvent[];
  events: EngineEvent[];
  expect: {
    results: Array<{ id: string; status: string; code?: string; detail?: unknown }>;
    serverState: Record<string, unknown>;
    state?: Record<string, unknown>;
    penaltyChecks?: unknown[];
  };
}

const fixturesDir = path.join(__dirname, '..', '__fixtures__');
const fixtureFileNames = fs
  .readdirSync(fixturesDir)
  .filter((name) => name.endsWith('.json'))
  .sort();

function loadFixture(fileName: string): Fixture {
  const raw = fs.readFileSync(path.join(fixturesDir, fileName), 'utf-8');
  return JSON.parse(raw) as Fixture;
}

const fixtures = fixtureFileNames.map((fileName) => ({ fileName, fixture: loadFixture(fileName) }));

/**
 * Ausnahme von der Je-Datei-Eindeutigkeit der Event-IDs: `07-idempotency.json` testet absichtlich
 * die Idempotenz-Prüfung (R11) -- vier Ereignisse mit derselben ID (teils gleicher, teils
 * abweichender Inhalt), um `duplicate`/`ID_CONFLICT` zu erzwingen. Eine doppelte ID ist dort die
 * Fachlichkeit der Fixture, kein Autorenfehler.
 */
const DUPLICATE_ID_ALLOWLIST = new Set(['07-idempotency.json']);

/** Erlaubte `actorUser`-Rollen (Brief Abschnitt 3): B3b mappt darauf echte Testnutzer. */
const ALLOWED_ACTOR_USERS = new Set(['owner', 'coadmin', 'helper', 'trainer', 'stranger']);

/** Die verbindliche `serverState`-Form (`serverState.ts`, Ruling P2) -- genau diese Schlüssel. */
const SERVER_STATE_KEYS = [
  'status',
  'phase',
  'section',
  'clock',
  'scores',
  'effectiveScores',
  'shootoutKicks',
  'lastScoreEventId',
  'decidedBy',
  'finishedAt',
].sort();

/**
 * In-scope-Szenarien für die Rechenfunktion (Brief Abschnitt 1), Titel wörtlich aus dem
 * Fundament-Dokument. Jeder Titel muss bei mindestens einer Fixture als `szenario` stehen.
 */
const IN_SCOPE_SZENARIEN = [
  'Zurücknehmen ist dauerhaft',
  'Wiederholte Übertragung erzeugt keinen zweiten Eintrag',
  'Ein abgelehnter Eintrag hält die anderen nicht auf',
  'Gleichzeitiger Anpfiff',
  'Teamtausch behält die Zuordnung zur Seite',
  'Helfer kann ein beendetes Spiel nicht korrigieren',
  'Unzulässiger Schritt wird abgelehnt',
  'Spiel wird nur einmal beendet',
  'Nur erlaubte Schritte',
  'Abschnittspausen nach Turnierregel',
  'Zeitstrafe läuft über die Abschnittspause weiter',
  'Zeitstrafe läuft in die Verlängerung weiter',
  'Laufende Strafe übersteht Neuladen',
  'Zwei entscheidende Tore im Golden Goal',
  'Entscheidung offen ohne Auswahl, wenn die Regel eindeutig ist',
  'Auswahl nur, wenn die Turnierregel sie offen lässt',
  'Ergebnis direkt im Spielplan eintragen',
  'Direkteintrag in ein gesteuertes Feld',
  'Zwei Korrekturen vom selben Stand',
  'Korrektur einer Korrektur',
  'Unzulässiger Schritt wird auch am Server abgelehnt',
] as const;

describe('Fixture-Sammlung: Pflege-Regeln (B1c)', () => {
  it('deckt mindestens 21 in-scope-Szenarien ab (keine Dubletten in der Konstante)', () => {
    expect(new Set(IN_SCOPE_SZENARIEN).size).toBe(IN_SCOPE_SZENARIEN.length);
    expect(IN_SCOPE_SZENARIEN.length).toBeGreaterThanOrEqual(21);
  });

  for (const szenario of IN_SCOPE_SZENARIEN) {
    it(`Szenario "${szenario}" ist durch ≥ 1 Fixture abgedeckt`, () => {
      const matches = fixtures.filter(({ fixture }) => fixture.szenario === szenario);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  }

  for (const { fileName, fixture } of fixtures) {
    describe(fileName, () => {
      it('trägt das Feld `szenario` (Titel oder null)', () => {
        expect(fixture.szenario === null || typeof fixture.szenario === 'string').toBe(true);
      });

      it('hat für jedes Event in `events` genau ein `results`-Ergebnis', () => {
        expect(fixture.expect.results.length).toBe(fixture.events.length);
      });

      it('jedes `results`-Ergebnis referenziert per `id` ein Event aus `events`', () => {
        const eventIds = new Set(fixture.events.map((event) => event.id));
        for (const result of fixture.expect.results) {
          expect(eventIds.has(result.id)).toBe(true);
        }
      });

      it('hat einen vollständigen `serverState` (genau die Schlüssel aus `serverState.ts`)', () => {
        expect(Object.keys(fixture.expect.serverState).sort()).toEqual(SERVER_STATE_KEYS);
      });

      it('hat eindeutige Event-IDs je Datei (prior + events), außer auf der Allowlist', () => {
        if (DUPLICATE_ID_ALLOWLIST.has(fileName)) {
          return;
        }
        const allEvents = [...(fixture.prior ?? []), ...fixture.events];
        const ids = allEvents.map((event) => event.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('hat für jedes Event ganzzahlige `at`-Werte', () => {
        const allEvents = [...(fixture.prior ?? []), ...fixture.events];
        for (const event of allEvents) {
          expect(Number.isInteger(event.at)).toBe(true);
        }
      });

      it('hat für jedes Event ein gesetztes `actorUser` aus der erlaubten Rollen-Menge', () => {
        const allEvents = [...(fixture.prior ?? []), ...fixture.events];
        for (const event of allEvents) {
          expect(typeof event.actorUser).toBe('string');
          expect(ALLOWED_ACTOR_USERS.has(event.actorUser!)).toBe(true);
        }
      });
    });
  }

  it('Event-IDs sind NICHT global eindeutig (bewusst, begründet): jedes Fixture ist ein eigener, in sich geschlossener Spiel-Log mit eigenem `ctx.matchId` -- Kollisionen über Dateigrenzen hinweg haben keine fachliche Wirkung, da `applyEvent`/`reduceMatch` pro Fixture-Lauf frisch aus `initialState(fixture.ctx)` starten und keinen Zustand zwischen Dateien teilen (z. B. teilen sich fast alle B1a-Fixtures das Präfix `11111111-1111-4111-8111-…`). Uniqueness wird deshalb bewusst nur je Datei geprüft (Test oben), nicht über alle Dateien hinweg -- mit einer dokumentierten Ausnahme sogar innerhalb einer Datei (`DUPLICATE_ID_ALLOWLIST`, Idempotenz-Fixture 07).', () => {
    expect(true).toBe(true);
  });
});
