/**
 * Zustand fürs Lebenszeichen (H4-3, seit H4-6 mit Senden): Die Liste `HALL_SPEAKER_STATES` kennt seit der Migration 20261125_001 zwei
 * Zustände mehr (`output_lost`, `output_unconfirmed`). Seit H4-6 SENDET der Lautsprecher sie – aber nur, wenn der Spieler wegen des
 * gewählten Ausgangs steht (@HT-054 „Ausgang verloren“, @HT-055 „Ausgang bestätigen“); sie gehen vor „Ton nicht aktiviert“ und vor
 * „Hintergrund“, nur „schlafen gelegt“ (@HT-037) bleibt davor. Jede andere Lage ergibt weiter einen der sechs bisherigen Werte.
 */
import { describe, expect, it } from 'vitest';
import { HALL_SPEAKER_STATES, lautsprecherZustandLesen } from '../../../../core/repositories/hallentonRpc';
import { geraeteZustandAus } from '../laufzeitZustand';
import type { SpielerZustand } from '../hallTonSpielerTypen';

const BISHERIGE = ['ready', 'not_activated', 'background', 'slept', 'custom_sound_failed', 'volume_zero'];
const SPIELER_BISHER: readonly SpielerZustand[] = ['not_activated', 'volume_zero', 'custom_sound_failed', 'ready'];
const SPIELER_AUSGANG: readonly SpielerZustand[] = ['output_lost', 'output_unconfirmed'];
const LAGEN = [false, true];

describe('H4-3 Zustand fürs Lebenszeichen', () => {
  it('ohne Ausgang-Zustand des Spielers ergibt jede Lage einen der sechs bisherigen Zustände (Rückwärtsverträglichkeit)', () => {
    const gesendet = new Set<string>();
    for (const geschlafen of LAGEN) {
      for (const spieler of SPIELER_BISHER) {
        for (const ausgesetzt of LAGEN) {
          for (const taktFehler of LAGEN) {
            gesendet.add(geraeteZustandAus({ geschlafen, spieler, ausgesetzt, taktFehler }));
          }
        }
      }
    }
    expect([...gesendet].sort()).toEqual([...BISHERIGE].sort());
    expect(gesendet.has('output_lost')).toBe(false);
    expect(gesendet.has('output_unconfirmed')).toBe(false);
  });

  it('@HT-054 @HT-055 steht der Spieler wegen des Ausgangs, geht genau dieser Zustand ans Lebenszeichen – gleich ob der Takt aussetzt, ob der Ton aktiviert ist', () => {
    for (const spieler of SPIELER_AUSGANG) {
      for (const ausgesetzt of LAGEN) {
        for (const taktFehler of LAGEN) {
          expect(geraeteZustandAus({ geschlafen: false, spieler, ausgesetzt, taktFehler })).toBe(spieler);
        }
      }
    }
  });

  it('@HT-037 schlafen gelegt geht vor dem Ausgang (bis „Ton aktivieren“)', () => {
    for (const spieler of SPIELER_AUSGANG) {
      expect(geraeteZustandAus({ geschlafen: true, spieler, ausgesetzt: false, taktFehler: false })).toBe('slept');
    }
  });

  it('alle acht Zustände kommen vor, und nur die zwei neuen aus dem Ausgang', () => {
    const gesendet = new Set<string>();
    for (const geschlafen of LAGEN) {
      for (const spieler of [...SPIELER_BISHER, ...SPIELER_AUSGANG]) {
        for (const ausgesetzt of LAGEN) {
          for (const taktFehler of LAGEN) {
            gesendet.add(geraeteZustandAus({ geschlafen, spieler, ausgesetzt, taktFehler }));
          }
        }
      }
    }
    expect([...gesendet].sort()).toEqual([...HALL_SPEAKER_STATES].sort());
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
