/**
 * Foul-Zähler je Halbzeit über die echte Engine und den echten Adapter (Plan Cockpit v2 A5/M3): Verlängerung zählt zum letzten Abschnitt,
 * Neuladen mitten in der 2. Halbzeit ändert die Zahl nicht (sie kommt aus den Einträgen, nie aus lokalem Zustand).
 * Szenarien: @SL-100 (2 × Minuten, Halbfinale mit Verlängerung: 3 Fouls in der 2. Halbzeit, Foul in der Verlängerung → 4),
 * @SL-036 (zweiter Abschnitt beginnt bei 0). Die Gesamtzahl nach dem Abpfiff (@SL-099) steht in `LiveCockpit.foulGrenze.engine.test.tsx`. Gherkin: docs/anforderungen/2026-10-02_spiel-leiten.md.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveCockpit } from '../LiveCockpit';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { engineAusLog } from './engineLogFixture';
import { makeProps } from './cockpitFixtures';
import type { EngineEvent } from '../../../core/match';
import {
  HF_CTX, NORD, OT_KICKOFF_AT, T0, hfEvent, overtimeRunningLog, regularTimeDrawLog, viewAt,
} from '../../../core/match/client/__tests__/overtimeFixtures';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [], syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
afterEach(() => { vi.useRealTimers(); });

const foul = (atMs: number, section: number, clockMs: number): EngineEvent => hfEvent('FOUL', atMs, section, clockMs, { teamId: NORD });
const sortiert = (log: EngineEvent[]): EngineEvent[] => [...log].sort((a, b) => a.at - b.at);

/** Halbfinale: 4 Fouls von FC Nord im 1. Abschnitt, 3 im 2. Abschnitt. */
const ersterAbschnitt = [20_000, 40_000, 60_000, 80_000].map((s) => foul(T0 + s, 1, s));
const zweiterAbschnitt = [380_000, 420_000, 460_000].map((s) => foul(T0 + s + 60_000, 2, s));
const mitFouls = (log: EngineEvent[], extra: EngineEvent[] = []): EngineEvent[] => sortiert([...log, ...ersterAbschnitt, ...zweiterAbschnitt, ...extra]);

async function zeige(log: EngineEvent[], now: number) {
  vi.setSystemTime(now);
  const engine = await engineAusLog(log, HF_CTX);
  const ansicht = viewAt(log, now);
  const ui = (): ReturnType<typeof engine.mitEngine> => engine.mitEngine(<LiveCockpit {...makeProps(ansicht)} />);
  return { ui, ...render(ui()) };
}
const zaehler = (): string => screen.getByTestId('team-fouls-home').textContent ?? '';

describe('Foul-Zähler je Halbzeit (Engine)', () => {
  it('@SL-036 im 1. Abschnitt zählen alle 4 Fouls (Foul 4/5); im 2. Abschnitt mit 3 Fouls steht „Foul 3/5“ (nicht 7)', async () => {
    const erster = sortiert([...regularTimeDrawLog('overtime-then-shootout').slice(0, 2), ...ersterAbschnitt]);
    const { unmount } = await zeige(erster, T0 + 90_000);
    expect(zaehler()).toContain('Foul 4/5');
    unmount();
    const log = mitFouls(regularTimeDrawLog('overtime-then-shootout').slice(0, 4));
    await zeige(log, T0 + 560_000);
    expect(zaehler()).toContain('Foul 3/5');
  });

  it('@SL-100 Verlängerung zählt zum letzten Abschnitt: 3 Fouls in der 2. Halbzeit, ein Foul in der Verlängerung → „Foul 4/5“', async () => {
    const log = mitFouls(overtimeRunningLog('overtime-then-shootout'), [foul(OT_KICKOFF_AT + 30_000, 3, 650_000)]);
    await zeige(log, OT_KICKOFF_AT + 40_000);
    expect(zaehler()).toContain('Foul 4/5');
  });

  it('Gegenbeispiel: ohne das Foul in der Verlängerung steht dort „Foul 3/5“ (die 4 Fouls des ersten Abschnitts zählen nicht mit)', async () => {
    await zeige(mitFouls(overtimeRunningLog('overtime-then-shootout')), OT_KICKOFF_AT + 40_000);
    expect(zaehler()).toContain('Foul 3/5');
  });

  it('Neuladen mitten in der 2. Halbzeit: die Zahl bleibt „Foul 3/5“ – sie kommt aus den Einträgen, nicht aus lokalem Zustand', async () => {
    const log = mitFouls(regularTimeDrawLog('overtime-then-shootout').slice(0, 4));
    const erste = await zeige(log, T0 + 560_000);
    expect(zaehler()).toContain('Foul 3/5');
    erste.unmount();
    await zeige(log, T0 + 560_000); // frisch gemountet = Neuladen
    expect(zaehler()).toContain('Foul 3/5');
  });
});
