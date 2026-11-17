/**
 * @HT-060 Registrierung der Aufräumer bei Konto-Wechsel: jeder Eingetragene wird gerufen, Austragen wirkt, ein Fehler hält die anderen nicht auf.
 */
import { describe, expect, it, vi } from 'vitest';
import { beiKontoWechsel, meldeKontoWechsel } from '../kontoWechsel';

describe('@HT-060 Konto-Wechsel melden', () => {
  it('ruft jeden Eingetragenen; nach dem Austragen nicht mehr', () => {
    const a = vi.fn();
    const b = vi.fn();
    const aus = beiKontoWechsel(a);
    const ausB = beiKontoWechsel(b);
    meldeKontoWechsel();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    aus();
    meldeKontoWechsel();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    ausB();
  });

  it('Gegenbeispiel: ein werfender Aufräumer hält die übrigen nicht auf', () => {
    const danach = vi.fn();
    const aus1 = beiKontoWechsel(() => { throw new Error('kaputt'); });
    const aus2 = beiKontoWechsel(danach);
    expect(() => meldeKontoWechsel()).not.toThrow();
    expect(danach).toHaveBeenCalledTimes(1);
    aus1(); aus2();
  });
});
