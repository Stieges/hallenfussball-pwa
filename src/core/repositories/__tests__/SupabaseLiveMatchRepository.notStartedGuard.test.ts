/**
 * SupabaseLiveMatchRepository — Schreibschutz für NOT_STARTED (Review-Fix Minor 3,
 * Fixrunde 1, 2026-09-25).
 *
 * Root cause: `skipMatch()` setzt `match_status='skipped'` auf einer Zeile, die noch
 * `live_state` hat (z. B. ein initialisiertes, aber nie gestartetes Spiel). `isMatchActive()`
 * liest eine solche Zeile weiter als aktiv, der Mapper macht daraus `LiveMatch.status =
 * NOT_STARTED` (weil `'skipped'` kein Schlüssel in STATUS_TO_FRONTEND ist). Ein
 * anschliessendes `save()` schrieb vor diesem Fix `match_status='scheduled'` — und traf
 * dabei (je nach Versions-Zufall) potenziell eine Zeile, die tatsächlich `'skipped'` ist,
 * und hätte sie stillschweigend zurückgesetzt. Vorher verhinderte das nur zufällig der
 * CHECK-Constraint (`'not_started'` war ohnehin ungültig); seit C-NSTART ist `'scheduled'`
 * gültig und die Lücke real.
 *
 * Fix: das CAS-Update für den NOT_STARTED-Schreibfall bekommt einen zusätzlichen Filter
 * `match_status = 'scheduled'` — nur eine Zeile, die selbst noch 'scheduled' ist, darf so
 * geschrieben werden. Trifft der Filter nicht (weil die Zeile z. B. 'skipped' ist), matcht
 * `maybeSingle()` keine Zeile, und der bestehende Konfliktpfad greift: Status bleibt
 * unverändert, `OptimisticLockError` fliegt statt eines stillen Überschreibens.
 *
 * Fake-Tabelle statt reiner Call-Arity-Mocks: die Mock-Implementierung wertet die
 * angehängten `.eq()`-Filter tatsächlich gegen eine kleine In-Memory-Zeile aus — sonst würde
 * ein Test, der nur prüft "wurde .eq('match_status', 'scheduled') aufgerufen" nichts über
 * das tatsächliche Verhalten aussagen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiveMatch } from '../../models/LiveMatch';
import { OptimisticLockError } from '../../errors';

// ============================================================================
// FAKE `matches`-TABELLE — wertet .eq()-Filter gegen eine Zeile aus
// ============================================================================

interface FakeMatchRow {
  id: string;
  version: number;
  match_status: string;
}

function buildFakeMatchesTable(initialRow: FakeMatchRow) {
  const row: FakeMatchRow = { ...initialRow };

  function query(mode: 'update' | 'select', payload?: Record<string, unknown>) {
    const filters: Array<{ col: keyof FakeMatchRow; val: unknown }> = [];
    const api = {
      eq(col: keyof FakeMatchRow, val: unknown) {
        filters.push({ col, val });
        return api;
      },
      // Spaltenliste wird ignoriert — die Fake-Tabelle kennt nur die drei Felder oben.
      select() {
        return api;
      },
      async maybeSingle() {
        const matched = filters.every((f) => row[f.col] === f.val);
        if (!matched) {
          return { data: null, error: null };
        }
        if (mode === 'update' && payload) {
          if (typeof payload.match_status === 'string') {
            row.match_status = payload.match_status;
          }
          row.version += 1; // DB-Trigger erhöht die Version bei jedem erfolgreichen Update.
        }
        return { data: { version: row.version }, error: null };
      },
      async single() {
        const matched = filters.every((f) => row[f.col] === f.val);
        if (!matched) {
          return { data: null, error: { message: 'not found' } };
        }
        return { data: { version: row.version, match_status: row.match_status }, error: null };
      },
    };
    return api;
  }

  return {
    getRow: (): FakeMatchRow => ({ ...row }),
    update: (payload: Record<string, unknown>) => query('update', payload),
    select: () => query('select'),
  };
}

// ============================================================================
// MOCKS
// ============================================================================

let fakeMatchesTable: ReturnType<typeof buildFakeMatchesTable>;

const hoisted = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: hoisted.fromMock },
  isSupabaseConfigured: true,
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

import { SupabaseLiveMatchRepository } from '../SupabaseLiveMatchRepository';

function makeNotStartedMatch(overrides: Partial<LiveMatch> = {}): LiveMatch {
  return {
    id: 'm1',
    number: 1,
    phaseLabel: 'Gruppenphase',
    fieldId: 'field-1',
    scheduledKickoff: '2024-01-01T12:00:00.000Z',
    version: 5,
    homeTeam: { id: 'a', name: 'A' },
    awayTeam: { id: 'b', name: 'B' },
    homeScore: 0,
    awayScore: 0,
    status: 'NOT_STARTED',
    elapsedSeconds: 0,
    durationSeconds: 600,
    tournamentPhase: 'groupStage',
    events: [],
    ...overrides,
  };
}

describe('SupabaseLiveMatchRepository — Schreibschutz für NOT_STARTED (Minor 3)', () => {
  beforeEach(() => {
    hoisted.fromMock.mockReset();
    hoisted.fromMock.mockImplementation((table: string) => {
      if (table === 'matches') { return fakeMatchesTable; }
      if (table === 'match_events') { return { upsert: vi.fn().mockResolvedValue({ error: null }) }; }
      throw new Error(`unexpected table in test mock: ${table}`);
    });
  });

  it('übersprungenes Spiel: save() mit NOT_STARTED setzt "skipped" NICHT auf "scheduled" zurück, Konfliktpfad greift', async () => {
    // Zeile ist real 'skipped', aber match.version (5) trifft zufällig exakt die
    // aktuelle DB-Version — ohne den zusätzlichen match_status-Filter würde die reine
    // ID+Versions-CAS das Update trotzdem durchlassen.
    fakeMatchesTable = buildFakeMatchesTable({ id: 'm1', version: 5, match_status: 'skipped' });

    const repo = new SupabaseLiveMatchRepository();
    const match = makeNotStartedMatch({ version: 5 });

    await expect(repo.save('t1', match)).rejects.toThrow(OptimisticLockError);

    // Status bleibt unverändert — kein stilles Überschreiben.
    expect(fakeMatchesTable.getRow().match_status).toBe('skipped');
  });

  it('Normalfall: ein nie gestartetes Spiel mit "scheduled" wird weiterhin erfolgreich initialisiert', async () => {
    fakeMatchesTable = buildFakeMatchesTable({ id: 'm1', version: 1, match_status: 'scheduled' });

    const repo = new SupabaseLiveMatchRepository();
    const match = makeNotStartedMatch({ version: 1 });

    await expect(repo.save('t1', match)).resolves.toBeUndefined();

    expect(fakeMatchesTable.getRow().match_status).toBe('scheduled');
  });
});
