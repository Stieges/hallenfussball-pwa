/**
 * LT-6 „Spiel fortsetzen“ – reine Regeln (model/fortsetzen.ts). Werte aus @SL-074 (zwei Abschnitte zu 6 Minuten, Restzeit 0:40 →
 * Spielzeit 5:20 im zweiten Abschnitt) und @SL-075 (nur in den 30 Sekunden, nicht nach „Weiter“).
 */
import { describe, expect, it } from 'vitest';
import { fortsetzenMoeglich, fortsetzenUhrMs, restGrenzenOf, type FortsetzenAnsicht } from '../fortsetzen';

/** Spiel 11 mit Ablauf beendet: zweiter Abschnitt 6:00–12:00 auf der Spieluhr, letztes Tor bei 1:00 im Abschnitt. */
const BEENDET: FortsetzenAnsicht = {
  status: 'finished', quittungRestMs: 10_000, fortsetzenSperre: null, sectionLimitMs: 360_000, fortsetzenFruehestMs: 60_000, limitClockMs: 720_000,
};
const LAGE = { kannSteuern: true, endstandSteht: true };

describe('LT-6 fortsetzenMoeglich', () => {
  it('@SL-074 beendet durch Ablauf, Endstand steht, Steuer: angeboten', () => {
    expect(fortsetzenMoeglich(BEENDET, LAGE)).toBe(true);
  });

  it.each([
    ['@SL-075 Z. 1 nach „Weiter“', BEENDET, { ...LAGE, endstandSteht: false }],
    ['@SL-075 Z. 2 nach 30 Sekunden', { ...BEENDET, quittungRestMs: 0 }, LAGE],
    ['@SL-075 Z. 3 schon einmal fortgesetzt', { ...BEENDET, fortsetzenSperre: 'ALREADY_CONTINUED' as const }, LAGE],
    ['@SL-146 Abpfiff von Hand', { ...BEENDET, fortsetzenSperre: 'NOT_ENDED_BY_CLOCK' as const }, LAGE],
    ['@SL-104 nach dem Strafstoßschießen', { ...BEENDET, fortsetzenSperre: 'SHOOTOUT_FINISHED' as const }, LAGE],
    ['ohne Steuer', BEENDET, { ...LAGE, kannSteuern: false }],
    ['Spiel läuft', { ...BEENDET, status: 'running' as const }, LAGE],
    ['Ersatz-Ansicht ohne Engine (keine Sperre bekannt)', { ...BEENDET, fortsetzenSperre: undefined }, LAGE],
    ['letzter Eintrag genau beim Abpfiff (keine Restzeit möglich)', { ...BEENDET, fortsetzenFruehestMs: 360_000 }, LAGE],
  ])('nicht angeboten: %s', (_name, ansicht, lage) => {
    expect(fortsetzenMoeglich(ansicht, lage)).toBe(false);
  });

  it('ohne Ansicht nie', () => {
    expect(fortsetzenMoeglich(null, LAGE)).toBe(false);
  });
});

describe('LT-6 Restzeit und Uhrstand', () => {
  it('@SL-074 Restzeit 0:40 → Spieluhr 11:20 (Spielzeit 5:20 im zweiten Abschnitt)', () => {
    expect(fortsetzenUhrMs(BEENDET, 40)).toBe(680_000);
  });

  it('Grenzen: höchstens bis zum letzten Eintrag des Abschnitts (5:00), Vorbelegung 1:00, kleinster Schritt 0:10', () => {
    expect(restGrenzenOf(BEENDET)).toEqual({ min: 10, max: 300, start: 60 });
  });

  it('Grenzen: Eintrag 5 Sekunden vor Schluss → höchstens 0:05, Vorbelegung und Minimum ebenso', () => {
    expect(restGrenzenOf({ sectionLimitMs: 360_000, fortsetzenFruehestMs: 355_000 })).toEqual({ min: 5, max: 5, start: 5 });
  });
});
