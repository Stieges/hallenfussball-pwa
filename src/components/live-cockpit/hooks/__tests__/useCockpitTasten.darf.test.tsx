/**
 * Die Taste gehört dem Cockpit nur, wo die Aktion wirken darf (Review PR #385, M2; @SL-154, @SL-143).
 * Sonst bleibt die Leertaste beim Browser: ein fokussierter Knopf („Anpfiff“, „Wiederanpfiff“, „Mehr“) löst damit wie bisher aus.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCockpitTasten } from '../useCockpitTasten';
import type { CockpitPhase, CockpitZustand } from '../../model/cockpitPhase';

const phase = (zustand: CockpitZustand): CockpitPhase => ({ zustand, abschnittArt: 'regulaer', abschnitt: 1, abschnitte: 2, letzterAbschnitt: false });

const aufbau = (zustand: CockpitZustand, kannSteuern: boolean) => {
  const onPauseResume = vi.fn();
  const tippeTor = vi.fn();
  const ergebnis = renderHook(() => useCockpitTasten({
    aktiv: kannSteuern, uebersichtAktiv: true, phase: phase(zustand), kannSteuern,
    sides: { links: 'home', rechts: 'away' },
    flows: { tippeTor, tippeFoul: vi.fn() },
    controls: { onPauseResume, onUndo: undefined, canUndo: false },
  }));
  return { ...ergebnis, onPauseResume, tippeTor };
};

const druecke = (typ: 'keydown' | 'keyup', key: string, ziel: Element = document.body, repeat = false): KeyboardEvent => {
  const e = new KeyboardEvent(typ, { key, bubbles: true, cancelable: true, repeat });
  ziel.dispatchEvent(e);
  return e;
};

afterEach(() => { document.body.innerHTML = ''; });

describe('Leertaste und Zahlentasten, wenn die Aktion nicht wirken darf', () => {
  it('Helfer ohne Steuerrecht: Leertaste, 1, 2, F und J bleiben beim Browser (Leertaste auf einem fokussierten Knopf löst ihn aus)', () => {
    const { onPauseResume, tippeTor, unmount } = aufbau('laeuft', false);
    const knopf = document.createElement('button');
    document.body.append(knopf);
    for (const k of [' ', '1', '2', 'f', 'j']) {
      expect(druecke('keydown', k, knopf).defaultPrevented, `keydown ${k}`).toBe(false);
      expect(druecke('keyup', k, knopf).defaultPrevented, `keyup ${k}`).toBe(false);
    }
    expect(onPauseResume).not.toHaveBeenCalled();
    expect(tippeTor).not.toHaveBeenCalled();
    unmount();
  });

  it.each<CockpitZustand>(['vorAnpfiff', 'halbzeitpause', 'entscheidung'])('Phase „%s“: die Leertaste löst den fokussierten Knopf aus, die Uhr wird nicht berührt', (zustand) => {
    const { onPauseResume, unmount } = aufbau(zustand, true);
    const knopf = document.createElement('button');
    document.body.append(knopf);
    expect(druecke('keydown', ' ', knopf).defaultPrevented).toBe(false);
    expect(druecke('keyup', ' ', knopf).defaultPrevented).toBe(false);
    expect(onPauseResume).not.toHaveBeenCalled();
    unmount();
  });

  it('Gegenprobe: im laufenden Spiel schaltet die Leertaste die Uhr und wird auf keydown, Wiederholung und keyup verschluckt', () => {
    const { onPauseResume, unmount } = aufbau('laeuft', true);
    const knopf = document.createElement('button');
    document.body.append(knopf);
    expect(druecke('keydown', ' ', knopf).defaultPrevented).toBe(true);
    expect(druecke('keydown', ' ', knopf, true).defaultPrevented).toBe(true);
    expect(druecke('keyup', ' ', knopf).defaultPrevented).toBe(true);
    expect(onPauseResume).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('keyup folgt der Entscheidung des keydown: ohne Wirkung beim Drücken wird auch das Loslassen nicht geschluckt', () => {
    const { unmount } = aufbau('halbzeitpause', true);
    const knopf = document.createElement('button');
    document.body.append(knopf);
    druecke('keydown', ' ', knopf);
    expect(druecke('keydown', ' ', knopf, true).defaultPrevented).toBe(false);
    expect(druecke('keyup', ' ', knopf).defaultPrevented).toBe(false);
    unmount();
  });
});
