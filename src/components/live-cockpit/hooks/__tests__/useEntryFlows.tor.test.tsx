/**
 * useEntryFlows – Tor (Aufgabe 3.4; Spec § 5.1, § 5.2, Entscheidung E1).
 * Szenarien: @SL-019, @SL-020, @SL-021, @SL-083, @SL-084, @SL-022, @SL-153 (Tastatur-Modus), RF1, RF3.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntryFlows, type EntryCommands, type EntryFlowsParams } from '../useEntryFlows';
import type { NumberPickerSchliessGrund } from '../../../ui/molecules/NumberPicker';

function setup(overrides: Partial<EntryFlowsParams> = {}) {
  const commands: EntryCommands = {
    tor: vi.fn().mockResolvedValue('goal-1'), nummer: vi.fn().mockResolvedValue(undefined),
    eigentor: vi.fn().mockResolvedValue('own-1'), foul: vi.fn().mockResolvedValue(undefined),
    karte: vi.fn().mockResolvedValue(undefined), zeitstrafe: vi.fn().mockResolvedValue(undefined),
  };
  const params: EntryFlowsParams = {
    matchId: 'match-11', teams: { home: { id: 'fc-nord', name: 'FC Nord' }, away: { id: 'sv-sued', name: 'SV Süd' } },
    commands, spielzeitJetzt: () => 192_000, zustand: 'laeuft', melde: vi.fn(), t: (k) => k, hatSchonGelb: () => false, ...overrides,
  };
  const hook = renderHook((p: EntryFlowsParams) => useEntryFlows(p), { initialProps: params });
  return { ...hook, commands, params };
}

describe('useEntryFlows – Tor', () => {
  it('@SL-019 Tor zählt mit dem ersten Tipp, die Nummer 7 kommt als Nachtrag an dasselbe Tor', async () => {
    const { result, commands } = setup();
    await act(async () => { result.current.tippeTor('home'); });
    expect(commands.tor).toHaveBeenCalledWith('fc-nord');
    expect(result.current.offen).toMatchObject({ art: 'tor', seite: 'home', ersterTippMs: 192_000 });
    await act(async () => { await result.current.waehleNummer(7); });
    expect(commands.nummer).toHaveBeenCalledWith('goal-1', 7);
    expect(result.current.offen).toBeNull();
  });

  it.each<NumberPickerSchliessGrund>(['schliessen', 'abdunkelung', 'zeitablauf', 'ohneNummer'])(
    '@SL-083 @SL-020 Schließen über „%s“ lässt das Tor ohne Nummer stehen', async (grund) => {
      const { result, commands } = setup();
      await act(async () => { result.current.tippeTor('home'); });
      await act(async () => { await result.current.schliesseAuswahl(grund); });
      expect(commands.tor).toHaveBeenCalledTimes(1);
      expect(commands.nummer).not.toHaveBeenCalled();
      expect(result.current.offen).toBeNull();
    });

  it('RF1 @SL-021 zwei Tipps im selben Durchlauf zählen ein Tor', async () => {
    const { result, commands } = setup();
    await act(async () => { result.current.tippeTor('home'); result.current.tippeTor('home'); });
    expect(commands.tor).toHaveBeenCalledTimes(1);
  });

  it('@SL-021 Gegenbeispiel: nach der Nummer ist die Wache frei, das nächste Tor zählt wieder', async () => {
    const { result, commands } = setup();
    await act(async () => { result.current.tippeTor('home'); });
    await act(async () => { await result.current.waehleNummer(7); });
    await act(async () => { result.current.tippeTor('away'); });
    expect(commands.tor).toHaveBeenCalledTimes(2);
    expect(commands.tor).toHaveBeenLastCalledWith('sv-sued');
  });

  it('wählt Tom die Nummer, bevor das Tor gespeichert ist, landet sie trotzdem am Tor', async () => {
    let loese: (id: string) => void = () => undefined;
    const { result, commands } = setup();
    (commands.tor as ReturnType<typeof vi.fn>).mockReturnValue(new Promise<string>((r) => { loese = r; }));
    act(() => { result.current.tippeTor('home'); });
    const wahl = act(async () => { await result.current.waehleNummer(7); });
    loese('goal-9');
    await wahl;
    expect(commands.nummer).toHaveBeenCalledWith('goal-9', 7);
  });

  it('die Nummer geht an die zum Zeitpunkt der Antwort aktuellen commands, nicht an die des Tipps (keine veraltete Closure)', async () => {
    let loese: (id: string) => void = () => undefined;
    const { result, rerender, params, commands } = setup();
    (commands.tor as ReturnType<typeof vi.fn>).mockReturnValue(new Promise<string>((r) => { loese = r; }));
    act(() => { result.current.tippeTor('home'); });
    const neu = { ...commands, nummer: vi.fn().mockResolvedValue(undefined) };
    rerender({ ...params, commands: neu });
    const wahl = act(async () => { await result.current.waehleNummer(7); });
    loese('goal-9');
    await wahl;
    expect(neu.nummer).toHaveBeenCalledWith('goal-9', 7);
    expect(commands.nummer).not.toHaveBeenCalled();
  });

  it('wurde das Tor abgelehnt (keine ID), geht keine Nummer hinaus', async () => {
    const { result, commands } = setup();
    (commands.tor as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await act(async () => { result.current.tippeTor('home'); });
    await act(async () => { await result.current.waehleNummer(7); });
    expect(commands.nummer).not.toHaveBeenCalled();
  });

  it('@SL-022 @SL-084 Eigentor: Tor zurück, OWN_GOAL für SV Süd mit der Spielzeit des ERSTEN Tipps (5:40, nicht der späteren Wahl), Nummer an das Eigentor', async () => {
    const spielzeitJetzt = vi.fn().mockReturnValueOnce(340_000).mockReturnValue(999_000);
    const { result, commands } = setup({ spielzeitJetzt });
    await act(async () => { result.current.tippeTor('home'); });
    await act(async () => { await result.current.waehleEigentor(); });
    expect(commands.eigentor).toHaveBeenCalledWith({ torEventId: 'goal-1', gegnerTeamId: 'sv-sued', clockMs: 340_000 });
    expect(result.current.offen).toMatchObject({ art: 'tor', eigentor: true });
    await act(async () => { await result.current.waehleNummer(4); });
    expect(commands.nummer).toHaveBeenCalledWith('own-1', 4);
  });

  it('@SL-022 Gegenbeispiel: zweimal auf „Eigentor“ getippt erfasst nur ein Eigentor', async () => {
    const { result, commands } = setup();
    await act(async () => { result.current.tippeTor('home'); });
    await act(async () => { await Promise.all([result.current.waehleEigentor(), result.current.waehleEigentor()]); });
    expect(commands.eigentor).toHaveBeenCalledTimes(1);
  });

  it('@SL-022 Eigentor ohne Nummer: Schließen lässt das Eigentor stehen, es geht keine Nummer hinaus', async () => {
    const { result, commands } = setup();
    await act(async () => { result.current.tippeTor('home'); });
    await act(async () => { await result.current.waehleEigentor(); });
    await act(async () => { await result.current.schliesseAuswahl('ohneNummer'); });
    expect(commands.eigentor).toHaveBeenCalledTimes(1);
    expect(commands.nummer).not.toHaveBeenCalled();
    expect(result.current.offen).toBeNull();
  });

  it('Gegenbeispiel: ein Tor für FC Nord sendet nichts für SV Süd', async () => {
    const { result, commands } = setup();
    await act(async () => { result.current.tippeTor('home'); });
    expect(commands.tor).not.toHaveBeenCalledWith('sv-sued');
  });

  it('Gegenbeispiel: waehleEigentor ohne offenes Tor tut nichts', async () => {
    const { result, commands } = setup();
    await act(async () => { await result.current.waehleEigentor(); });
    expect(commands.eigentor).not.toHaveBeenCalled();
  });

  it('ein Spielwechsel schließt die Auswahl; das nächste Tor im neuen Spiel zählt', async () => {
    const { result, rerender, params, commands } = setup();
    await act(async () => { result.current.tippeTor('home'); });
    rerender({ ...params, matchId: 'match-12' });
    expect(result.current.offen).toBeNull();
    await act(async () => { result.current.tippeTor('home'); });
    expect(commands.tor).toHaveBeenCalledTimes(2);
  });

  it('@SL-083 eine Meldung bestätigt das Tor (Stufe 3)', async () => {
    const melde = vi.fn();
    const { result } = setup({ melde });
    await act(async () => { result.current.tippeTor('home'); });
    expect(melde).toHaveBeenCalledWith(3, 'meldung.tor');
  });
});
