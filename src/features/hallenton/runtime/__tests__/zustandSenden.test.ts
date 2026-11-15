/**
 * H4-3 Rückwärtsverträglichkeit: Die Liste `HALL_SPEAKER_STATES` kennt seit der Migration 20261125_001 zwei Zustände mehr
 * (`output_lost`, `output_unconfirmed`). Der Lautsprecher SENDET sie erst ab H4-6: jede Lage, aus der `geraeteZustandAus` den Zustand für
 * das Lebenszeichen bildet, ergibt weiter einen der sechs bisherigen Werte (gilt auch vor dem Einspielen der Migration).
 */
import { describe, expect, it } from 'vitest';
import { HALL_SPEAKER_STATES, lautsprecherZustandLesen } from '../../../../core/repositories/hallentonRpc';
import { geraeteZustandAus } from '../laufzeitZustand';
import type { SpielerZustand } from '../hallTonSpielerTypen';

const BISHERIGE = ['ready', 'not_activated', 'background', 'slept', 'custom_sound_failed', 'volume_zero'];
const SPIELER: readonly SpielerZustand[] = ['not_activated', 'volume_zero', 'custom_sound_failed', 'ready'];

describe('H4-3 Zustand fürs Lebenszeichen', () => {
  it('jede Lage des Geräts ergibt einen der sechs bisherigen Zustände (die neuen werden noch nicht gesendet)', () => {
    const gesendet = new Set<string>();
    for (const geschlafen of [false, true]) {
      for (const spieler of SPIELER) {
        for (const ausgesetzt of [false, true]) {
          for (const taktFehler of [false, true]) {
            gesendet.add(geraeteZustandAus({ geschlafen, spieler, ausgesetzt, taktFehler }));
          }
        }
      }
    }
    expect([...gesendet].sort()).toEqual([...BISHERIGE].sort());
    expect(gesendet.has('output_lost')).toBe(false);
    expect(gesendet.has('output_unconfirmed')).toBe(false);
  });

  it('die Liste enthält die sechs bisherigen Zustände unverändert und dazu die zwei neuen', () => {
    expect(HALL_SPEAKER_STATES.slice(0, 6)).toEqual(BISHERIGE);
    expect(HALL_SPEAKER_STATES.slice(6)).toEqual(['output_lost', 'output_unconfirmed']);
  });

  it('Gegenbeispiel: ein Zustand außerhalb der Liste wird weiter „zustandUnbekannt“ gelesen', () => {
    expect(lautsprecherZustandLesen('output_lost')).toBe('output_lost');
    expect(lautsprecherZustandLesen('output_gone')).toBe('zustandUnbekannt');
  });
});
