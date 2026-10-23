/**
 * A-08f3b H-1 Gegenbeispiele: Nachladen nur für Spiele mit geladener Engine-Kopie und nur für Konten (nie Gast).
 * Pflichttest mit echtem Engine-Kontext: `features/tournament-management/__tests__/ScheduleTab.engineCatchUp.test.tsx`.
 * Anforderungen: @FU-087, @FU-023.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ServerRevisionRegistry } from '../../core/repositories/serverRevisionRegistry';
import { MatchEngineContext, type MatchEngineContextValue } from '../../features/match-engine/matchEngineContextInstance';

const repos = vi.hoisted(() => ({ tournamentRepository: null as object | null }));
vi.mock('../../core/contexts/RepositoryContext', () => ({ useRepositories: () => repos }));

import { useEngineCatchUpOnCloudChange } from '../useEngineCatchUpOnCloudChange';

function setup(accountId: string) {
  const registry = new ServerRevisionRegistry();
  repos.tournamentRepository = {
    serverLedMatchIds: (id: string) => registry.serverLedMatchIds(id),
    subscribeServerRevisions: (id: string, cb: (raised: ReadonlySet<string>) => void) => registry.subscribe(id, cb),
  };
  const engine = { view: vi.fn((id: string) => (id === 'loaded' ? {} : null)), catchUp: vi.fn().mockResolvedValue(undefined) };
  const value = { engine, accountId } as unknown as MatchEngineContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => <MatchEngineContext.Provider value={value}>{children}</MatchEngineContext.Provider>;
  renderHook(() => useEngineCatchUpOnCloudChange('T'), { wrapper });
  return { registry, engine };
}

describe('useEngineCatchUpOnCloudChange (A-08f3b, H-1)', () => {
  it('höhere Revision: geladene Kopie wird nachgeladen, Spiel ohne geladene Kopie nicht', () => {
    const { registry, engine } = setup('olli');

    act(() => registry.record('T', new Map([['loaded', 4], ['notloaded', 4]])));

    expect(engine.catchUp).toHaveBeenCalledTimes(1);
    expect(engine.catchUp).toHaveBeenCalledWith('loaded');
  });

  it('gleiche Revision erneut → kein weiteres Nachladen', () => {
    const { registry, engine } = setup('olli');
    act(() => registry.record('T', new Map([['loaded', 4]])));

    act(() => registry.record('T', new Map([['loaded', 4]])));

    expect(engine.catchUp).toHaveBeenCalledTimes(1);
  });

  it('Gast → kein catchUp', () => {
    const { registry, engine } = setup('guest');

    act(() => registry.record('T', new Map([['loaded', 4]])));

    expect(engine.catchUp).not.toHaveBeenCalled();
  });
});
