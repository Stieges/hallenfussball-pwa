/**
 * H4-12 Ton je Gerät (C-TON-TURNIERWEIT, @HT-009, @SL-125): Ton an/aus und Lautstärke des Cockpit-Tons gelten je Gerät, nicht für das Turnier.
 * „Anderes Gerät“ = anderer Speicher (eigener `localStorage`); das erste Öffnen eines Geräts heißt Ton an, 100 %.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { neuerSpeicher } from '../../../../test/geraetSpeicher';
import { COCKPIT_TON_SCHLUESSEL, __setzeCockpitTonFuerTests, liesCockpitTon, useCockpitTon } from '../useCockpitTon';

let gerät: Storage;
function wechsleGeraet(speicher: Storage): void {
  gerät = speicher;
  __setzeCockpitTonFuerTests();
}

beforeEach(() => {
  gerät = neuerSpeicher();
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => gerät);
  __setzeCockpitTonFuerTests();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('@HT-009 @SL-125 Ton je Gerät', () => {
  it('das erste Öffnen eines Geräts: Ton an, 100 %', () => {
    const { result } = renderHook(() => useCockpitTon());
    expect(result.current.an).toBe(true);
    expect(result.current.lautstaerke).toBe(100);
  });

  it('@SL-125 Tom schaltet den Ton auf seinem Gerät aus → das bleibt nach dem Neuladen (neuer Hook) auf diesem Gerät', () => {
    const { result } = renderHook(() => useCockpitTon());
    act(() => { result.current.setAn(false); });
    expect(result.current.an).toBe(false);
    __setzeCockpitTonFuerTests(); // „Neuladen“: nur der Speicher des Geräts bleibt
    const neu = renderHook(() => useCockpitTon());
    expect(neu.result.current.an).toBe(false);
  });

  it('@SL-125 Gegenbeispiel: ein anderes Gerät (eigener Speicher) bleibt unberührt – Ton an, 100 %', () => {
    const { result } = renderHook(() => useCockpitTon());
    act(() => { result.current.setAn(false); result.current.setLautstaerke(30); });
    wechsleGeraet(neuerSpeicher()); // Claras Gerät
    const clara = renderHook(() => useCockpitTon());
    expect(clara.result.current).toMatchObject({ an: true, lautstaerke: 100 });
  });

  it('die Lautstärke gilt je Gerät, bleibt zwischen 0 und 100 und wird gerundet', () => {
    const { result } = renderHook(() => useCockpitTon());
    act(() => { result.current.setLautstaerke(42.4); });
    expect(result.current.lautstaerke).toBe(42);
    act(() => { result.current.setLautstaerke(250); });
    expect(result.current.lautstaerke).toBe(100);
    act(() => { result.current.setLautstaerke(-5); });
    expect(result.current.lautstaerke).toBe(0);
  });

  it('zwei Bausteine desselben Geräts (Cockpit und Dialog) sehen denselben Stand sofort', () => {
    const a = renderHook(() => useCockpitTon());
    const b = renderHook(() => useCockpitTon());
    act(() => { a.result.current.setAn(false); });
    expect(b.result.current.an).toBe(false);
  });

  it('der Wert eines anderen Tabs desselben Geräts (storage-Ereignis) kommt an', () => {
    const { result } = renderHook(() => useCockpitTon());
    gerät.setItem(COCKPIT_TON_SCHLUESSEL, JSON.stringify({ an: false, lautstaerke: 20 }));
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: COCKPIT_TON_SCHLUESSEL })); });
    expect(result.current).toMatchObject({ an: false, lautstaerke: 20 });
  });

  it('der turnierweite Wert wird nicht gelesen: nur `cockpit:ton` zählt, Unlesbares fällt auf die Vorgabe', () => {
    expect(liesCockpitTon(null)).toEqual({ an: true, lautstaerke: 100 });
    expect(liesCockpitTon('kaputt')).toEqual({ an: true, lautstaerke: 100 });
    expect(liesCockpitTon(JSON.stringify({ an: 'nein', lautstaerke: 500 }))).toEqual({ an: true, lautstaerke: 100 });
    expect(liesCockpitTon(JSON.stringify({ an: false }))).toEqual({ an: false, lautstaerke: 100 });
  });

  it('gesperrter Speicher (privates Fenster): nichts wirft, der Wert gilt bis zum Neuladen', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('gesperrt'); });
    __setzeCockpitTonFuerTests();
    const { result } = renderHook(() => useCockpitTon());
    act(() => { result.current.setAn(false); });
    expect(result.current.an).toBe(false);
  });
});
