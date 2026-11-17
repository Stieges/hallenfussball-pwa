/**
 * @RZ-033 Seiten-Ebene: die Zuschauer-Seite gibt die überstandene Netzstörung an die Zählung weiter (Anbindung von `usePublicTournament`
 * an `usePublicViewCount`). Gemockt nur die Datenquellen und die Zählung selbst (ihre Optionen werden mitgelesen); die Seite ist echt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildLiveViewTournament, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';
import type { UsePublicViewCountOptions } from '../usePublicViewCount';

const { supabaseGet, localGet, rpc, zaehlung } = vi.hoisted(() => ({
  supabaseGet: vi.fn(), localGet: vi.fn(), rpc: vi.fn(),
  zaehlung: vi.fn<(code: string, geladen: boolean, optionen?: UsePublicViewCountOptions) => void>(),
}));

vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: vi.fn(), rpc } }));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));
vi.mock('../defaultPublicSource', async () => {
  const { createLegacyPublicSource } = await import('../legacyPublicSource');
  return { defaultPublicTournamentSource: createLegacyPublicSource() };
});
vi.mock('../usePublicViewCount', () => ({ usePublicViewCount: zaehlung }));

import { LiveViewScreen } from '../../../screens/LiveViewScreen';
import { RepositoryProvider } from '../../../core/contexts/RepositoryContext';

const letzte = () => zaehlung.mock.calls.at(-1);
const ausfaelle = (): UsePublicViewCountOptions['outages'] => letzte()?.[2]?.outages ?? [];
const netzZurueck = async () => { await act(async () => { window.dispatchEvent(new Event('online')); await Promise.resolve(); }); };

describe('@RZ-033 Die Zuschauer-Seite reicht überstandene Störungen an die Zählung weiter', () => {
  beforeEach(() => {
    supabaseGet.mockReset(); localGet.mockReset(); rpc.mockReset(); zaehlung.mockReset(); localStorage.clear();
    localGet.mockResolvedValue(null);
    rpc.mockResolvedValue({ data: { status: 'none' }, error: null });
  });

  function zeige() {
    return render(
      <RepositoryProvider user={null}>
        <MemoryRouter initialEntries={[`/live/${SHARE_CODE}`]}><LiveViewScreen shareCode={SHARE_CODE} /></MemoryRouter>
      </RepositoryProvider>,
    );
  }

  it('Abruf scheitert, der nächste gelingt: die Zählung bekommt genau eine Störung für dieses Turnier; vorher keine', async () => {
    supabaseGet.mockResolvedValue(buildLiveViewTournament());
    zeige();
    await waitFor(() => { expect(letzte()?.[1]).toBe(true); });
    expect(ausfaelle()).toEqual([]);

    supabaseGet.mockRejectedValue(new Error('Netz weg'));
    await netzZurueck();
    await waitFor(() => { expect(supabaseGet).toHaveBeenCalledTimes(2); });
    expect(ausfaelle()).toEqual([]);

    supabaseGet.mockResolvedValue({ ...buildLiveViewTournament(), title: 'Nikolaus-Turnier neu' });
    await netzZurueck();
    await waitFor(() => { expect(ausfaelle()).toHaveLength(1); });
    expect(ausfaelle()).toEqual([{ id: 1, shareCode: SHARE_CODE, kind: 'stoerung_kurz' }]);
  });

  it('Gegenbeispiel: gelingen alle Abrufe, bekommt die Zählung nie eine Störung', async () => {
    supabaseGet.mockResolvedValue(buildLiveViewTournament());
    zeige();
    await waitFor(() => { expect(letzte()?.[1]).toBe(true); });
    await netzZurueck();
    await waitFor(() => { expect(supabaseGet).toHaveBeenCalledTimes(2); });
    expect(zaehlung.mock.calls.every(([, , optionen]) => (optionen?.outages ?? []).length === 0)).toBe(true);
  });
});
