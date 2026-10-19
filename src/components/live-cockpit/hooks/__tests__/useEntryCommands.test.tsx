/**
 * useEntryCommands (Aufgabe 3.4): die Befehle der Eintrags-Abläufe aus den Rückrufen des Aufrufers.
 * Szenarien: @SL-019 (Tor liefert die ID), @SL-022 (Eigentor: Tor zurück, dann OWN_GOAL des Gegners mit der Spielzeit des ersten Tipps),
 * @SL-084 (Spielzeit des ersten Tipps), @SL-029 (keine Dauer gesendet). Spiel 11, FC Nord – SV Süd.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { makeLiveMatch, makeProps } from '../../__tests__/cockpitFixtures';
import type { LiveCockpitProps } from '../../types';
import type { FreshEntryCommands } from '../useFreshEntryCommands';
import { useEntryCommands } from '../useEntryCommands';

function setup(props: Partial<LiveCockpitProps> = {}) {
  const frisch: FreshEntryCommands = { nummer: vi.fn().mockResolvedValue(undefined), zuruecknehmen: vi.fn().mockResolvedValue(undefined) };
  const p = makeProps(makeLiveMatch(), props);
  const hook = renderHook(() => useEntryCommands(p, frisch));
  return { commands: hook.result.current, frisch, p };
}

describe('useEntryCommands', () => {
  it('@SL-019 Tor für FC Nord: onGoal(+1) ohne Nummer, die Ereignis-ID kommt zurück', async () => {
    const onGoal = vi.fn().mockResolvedValue('goal-1');
    const { commands } = setup({ onGoal });
    expect(await commands.tor('fc-nord')).toBe('goal-1');
    expect(onGoal).toHaveBeenCalledWith('match-11', 'fc-nord', 1, undefined);
  });

  it('Gegenbeispiel: ein Rückruf ohne Antwort (Altspiel, abgelehnt) liefert keine ID', async () => {
    const { commands } = setup(); // makeProps: onGoal = vi.fn() ohne Antwort
    expect(await commands.tor('fc-nord')).toBeNull();
  });

  it('die Nummer geht an den frischen Nachtrag-Weg', async () => {
    const { commands, frisch } = setup();
    await commands.nummer('goal-1', 7);
    expect(frisch.nummer).toHaveBeenCalledWith('goal-1', 7);
  });

  it('@SL-022 Eigentor der Gegner-Mannschaft: erst das Tor zurücknehmen, dann OWN_GOAL für SV Süd mit der Spielzeit des ersten Tipps', async () => {
    const reihenfolge: string[] = [];
    const onGoal = vi.fn().mockImplementation(() => { reihenfolge.push('onGoal'); return Promise.resolve('own-1'); });
    const { commands, frisch } = setup({ onGoal });
    (frisch.zuruecknehmen as ReturnType<typeof vi.fn>).mockImplementation(() => { reihenfolge.push('zurueck'); return Promise.resolve(); });
    expect(await commands.eigentor({ torEventId: 'goal-1', gegnerTeamId: 'sv-sued', clockMs: 340_000 })).toBe('own-1');
    expect(frisch.zuruecknehmen).toHaveBeenCalledWith('goal-1');
    expect(onGoal).toHaveBeenCalledWith('match-11', 'sv-sued', 1, { own: true, clockMs: 340_000 });
    expect(reihenfolge).toEqual(['zurueck', 'onGoal']);
  });

  it('Foul: onFoul mit dem Team', async () => {
    const onFoul = vi.fn();
    const { commands } = setup({ onFoul });
    await commands.foul('sv-sued');
    expect(onFoul).toHaveBeenCalledWith('match-11', 'sv-sued');
  });

  it('@SL-084 Karte: Art, Nummer und Spielzeit des ersten Tipps; ohne Nummer fehlt sie', async () => {
    const onCard = vi.fn();
    const { commands } = setup({ onCard });
    await commands.karte('sv-sued', 'YELLOW', { nummer: 5, clockMs: 192_000 });
    expect(onCard).toHaveBeenLastCalledWith('match-11', 'sv-sued', 'YELLOW', { playerNumber: 5, clockMs: 192_000 });
    await commands.karte('sv-sued', 'RED', { nummer: null, clockMs: 192_000 });
    expect(onCard).toHaveBeenLastCalledWith('match-11', 'sv-sued', 'RED', { playerNumber: undefined, clockMs: 192_000 });
  });

  it('@SL-029 Zeitstrafe: Nummer und Spielzeit, keine Dauer (die setzt die Engine aus der Regel)', async () => {
    const onTimePenalty = vi.fn();
    const { commands } = setup({ onTimePenalty });
    await commands.zeitstrafe('sv-sued', { nummer: 5, clockMs: 192_000 });
    expect(onTimePenalty).toHaveBeenCalledWith('match-11', 'sv-sued', { playerNumber: 5, clockMs: 192_000 });
    expect(onTimePenalty.mock.calls[0][2]).not.toHaveProperty('durationSeconds');
  });

  it('Gegenbeispiel: ohne Rückrufe für Foul, Karte und Zeitstrafe bricht nichts', async () => {
    const { commands } = setup({ onFoul: undefined, onCard: undefined, onTimePenalty: undefined });
    await expect(commands.foul('sv-sued')).resolves.toBeUndefined();
    await expect(commands.karte('sv-sued', 'YELLOW', { nummer: 5, clockMs: 0 })).resolves.toBeUndefined();
    await expect(commands.zeitstrafe('sv-sued', { nummer: 5, clockMs: 0 })).resolves.toBeUndefined();
  });
});
