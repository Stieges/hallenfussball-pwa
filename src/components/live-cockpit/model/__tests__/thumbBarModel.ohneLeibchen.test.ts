/**
 * @SL-149 „Ohne Leibchen anpfeifen“ steht vor dem Anpfiff bei einem Farbkonflikt neben dem Anpfiff in der Daumenleiste; @SL-138 ohne Konflikt nicht.
 */
import { describe, it, expect } from 'vitest';
import { leisteFuer } from '../thumbBarModel';
import type { CockpitPhase } from '../cockpitPhase';

const vor: CockpitPhase = { zustand: 'vorAnpfiff', abschnittArt: 'regulaer', abschnitt: 1, abschnitte: 1, letzterAbschnitt: true };
const laeuft: CockpitPhase = { ...vor, zustand: 'laeuft' };
const k = { istLeitung: false, fortsetzenMoeglich: false, korrigierenMoeglich: false };

describe('Daumenleiste vor dem Anpfiff', () => {
  it.each(['daumen', 'breit'] as const)('@SL-149 Konflikt (%s): Anpfiff, „Ohne Leibchen anpfeifen“, Mehr', (layout) => {
    expect(leisteFuer(vor, { ...k, layout, ohneLeibchenMoeglich: true }).aktionen).toEqual(['anpfiff', 'ohneLeibchen', 'mehr']);
  });

  it('@SL-138 ohne Konflikt: nur Anpfiff und Mehr', () => {
    expect(leisteFuer(vor, { ...k, layout: 'daumen', ohneLeibchenMoeglich: false }).aktionen).toEqual(['anpfiff', 'mehr']);
  });

  it('Gegenbeispiel: im laufenden Spiel nie „Ohne Leibchen anpfeifen“', () => {
    expect(leisteFuer(laeuft, { ...k, layout: 'daumen', ohneLeibchenMoeglich: true }).aktionen).not.toContain('ohneLeibchen');
  });
});
