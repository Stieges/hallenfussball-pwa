/**
 * @SL-002 / @SL-101 / @W2A-035 / @W2A-037 (Versionsrisiko): Ein neues Turnier aus dem Assistenten speichert Uhr-Art und
 * Foul-Grenze ausdrücklich, damit jedes Gerät unabhängig von seiner App-Version denselben Wert liest.
 * Gegenbeispiel: ein bestehendes Turnier ohne gespeicherte Regelwerte bleibt unverändert.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tournament } from '../../types/tournament';
import { createTournamentRow } from '../../../tests/factories/supabase';
import { mapTournamentFromSupabase } from '../../core/repositories/supabaseMappers';

const save = vi.fn<(t: Tournament) => Promise<void>>();
vi.mock('../useRepository', () => ({
  useRepository: () => ({
    save: (t: Tournament) => save(t),
    get: () => Promise.resolve(null),
  }),
}));

import { useTournamentWizard } from '../useTournamentWizard';

describe('Neues Turnier im Assistenten: Regel-Vorgaben stehen ausdrücklich im Turnier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    save.mockResolvedValue(undefined);
  });

  it('@SL-002 @SL-101: das Formular eines neuen Turniers trägt clockMode „immer-durchlaufend“ und foulLimit null', () => {
    const { result } = renderHook(() => useTournamentWizard(undefined, () => Promise.resolve(false)));
    const einstellungen = result.current.formData.matchCockpitSettings;
    expect(einstellungen).toBeDefined();
    expect(einstellungen).toHaveProperty('clockMode', 'immer-durchlaufend');
    expect(einstellungen).toHaveProperty('foulLimit', null);
  });

  it('@W2A-035 @W2A-037: gespeichert wird beides (foulLimit null als eigener Schlüssel, nicht weggelassen)', async () => {
    const { result } = renderHook(() => useTournamentWizard(undefined, () => Promise.resolve(false)));
    await act(async () => { await result.current.saveDraft(); });

    const gespeichert = save.mock.calls[0][0].matchCockpitSettings;
    expect(gespeichert).toHaveProperty('clockMode', 'immer-durchlaufend');
    expect(Object.prototype.hasOwnProperty.call(gespeichert, 'foulLimit')).toBe(true);
    expect(gespeichert?.foulLimit).toBeNull();
    // @W1-004: nur diese zwei Regeln werden ausdrücklich geschrieben, keine weiteren Regelwerte
    expect(Object.keys(gespeichert ?? {}).sort()).toEqual(['clockMode', 'foulLimit']);
  });

  it('Gegenbeispiel: ein bestehendes Turnier ohne gespeicherte Regelwerte bekommt beim Speichern nichts dazu', async () => {
    const bestehend = mapTournamentFromSupabase(createTournamentRow({ version: null, config: {} }), [], []);
    expect(bestehend.matchCockpitSettings).toBeUndefined();
    const { result } = renderHook(() => useTournamentWizard(bestehend, () => Promise.resolve(false)));
    await act(async () => { await result.current.saveDraft(); });

    expect(save.mock.calls[0][0].matchCockpitSettings).toBeUndefined();
  });

  it('Gegenbeispiel: ein bestehendes Turnier mit foulLimit 5 und „letzte Minute angehalten“ behält beide Werte', async () => {
    const bestehend = mapTournamentFromSupabase(
      createTournamentRow({ version: null, config: { matchCockpitSettings: { clockMode: 'durchlaufend-letzte-minute-angehalten', foulLimit: 5 } } }),
      [],
      [],
    );
    const { result } = renderHook(() => useTournamentWizard(bestehend, () => Promise.resolve(false)));
    await act(async () => { await result.current.saveDraft(); });

    expect(save.mock.calls[0][0].matchCockpitSettings).toMatchObject({ clockMode: 'durchlaufend-letzte-minute-angehalten', foulLimit: 5 });
  });
});
