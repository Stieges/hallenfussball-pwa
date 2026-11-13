/**
 * H4-8 (@HT-033 Zeile 8, Nachtrag 13.11.): Ein zweites Fenster prüft sofort per `navigator.locks.query`, ob ein anderes Fenster des
 * Geräts die Sperre `hallenton` hält → gleich der ruhige Hinweis „Lautsprecher läuft schon in einem anderen Fenster“ (ohne Klick),
 * „Ton nicht aktiv – hier klicken“ nur, wenn kein Fenster tönt. Ohne `navigator.locks` wie bisher.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hallAnzeige, tonNichtAktivLokal, type LokaleLage } from '../hallAnzeige';
import { browserSperrAbfrage, haeltEinFensterDieSperre, type SperrAbfrage } from '../runtime/anderesFenster';
import { ABFRAGE_MS, useAnderesFensterTont } from '../useAnderesFensterTont';

const lokal = (rolle: LokaleLage['rolle'], zustand: 'not_activated' | 'ready'): LokaleLage => ({ felder: [1], rolle, zustandJeFeld: { 'field-1': zustand } });
const eingabe = (l: LokaleLage, anderesFensterTont?: boolean) => ({
  server: { stand: 'aktuell' as const, felder: {}, antwort: null }, lokal: l, angepfiffen: new Set<number>(), lautsprecherBekannt: false, anderesFensterTont,
});
const haelt = (...namen: string[]): SperrAbfrage => ({ query: () => Promise.resolve({ held: namen.map((name) => ({ name })) }) });

describe('@HT-033 Zeile 8 Anzeige', () => {
  it('ein anderes Fenster tönt → sofort „läuft schon in einem anderen Fenster“, nicht „Ton nicht aktiv“', () => {
    expect(hallAnzeige(eingabe(lokal('wartet', 'not_activated'), true)).felder[0]?.anzeige).toEqual({ art: 'anderesFenster' });
  });
  it('Gegenbeispiel: kein Fenster tönt → „Ton nicht aktiv – hier klicken“', () => {
    expect(hallAnzeige(eingabe(lokal('wartet', 'not_activated'), false)).felder[0]?.anzeige).toEqual({ art: 'tonNichtAktiv' });
    expect(hallAnzeige(eingabe(lokal('wartet', 'not_activated'))).felder[0]?.anzeige).toEqual({ art: 'tonNichtAktiv' });
  });
  it('gefragt wird nur auf „Ton nicht aktiv“ im wartenden Fenster', () => {
    expect(tonNichtAktivLokal(lokal('wartet', 'not_activated'))).toBe(true);
    expect(tonNichtAktivLokal(lokal('toent', 'ready'))).toBe(false);
    expect(tonNichtAktivLokal(lokal('andererTab', 'ready'))).toBe(false);
    expect(tonNichtAktivLokal(null)).toBe(false);
  });
});

describe('@HT-033 Zeile 8 Abfrage der Sperre', () => {
  it('Sperre „hallenton“ gehalten → ein Fenster tönt', async () => {
    expect(await haeltEinFensterDieSperre(haelt('hallenton'))).toBe(true);
  });
  it('Gegenbeispiel: nur andere Sperren (z. B. „hallenton-melden“) oder keine → niemand tönt', async () => {
    expect(await haeltEinFensterDieSperre(haelt('hallenton-melden'))).toBe(false);
    expect(await haeltEinFensterDieSperre(haelt())).toBe(false);
  });
  it('ohne navigator.locks (null) und bei Fehlern der Abfrage: „niemand tönt“, nichts wirft', async () => {
    expect(await haeltEinFensterDieSperre(null)).toBe(false);
    expect(await haeltEinFensterDieSperre({ query: () => Promise.reject(new Error('nein')) })).toBe(false);
  });
});

describe('@HT-033 Zeile 8 Hook', () => {
  let held: string[];
  beforeEach(() => {
    vi.useFakeTimers();
    held = [];
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { query: () => Promise.resolve({ held: held.map((name) => ({ name })) }) } });
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'locks');
  });

  it('sofort nach dem Einbinden: ein anderes Fenster tönt → true, ohne Klick', async () => {
    held = ['hallenton'];
    const { result } = renderHook(() => useAnderesFensterTont(lokal('wartet', 'not_activated')));
    await act(async () => { await Promise.resolve(); });
    expect(result.current).toBe(true);
  });
  it('Gegenbeispiel: kein Fenster tönt → false', async () => {
    const { result } = renderHook(() => useAnderesFensterTont(lokal('wartet', 'not_activated')));
    await act(async () => { await Promise.resolve(); });
    expect(result.current).toBe(false);
  });
  it('schließt das andere Fenster, springt der Hinweis nach der nächsten Abfrage zurück', async () => {
    held = ['hallenton'];
    const { result } = renderHook(() => useAnderesFensterTont(lokal('wartet', 'not_activated')));
    await act(async () => { await Promise.resolve(); });
    expect(result.current).toBe(true);
    held = [];
    await act(async () => { await vi.advanceTimersByTimeAsync(ABFRAGE_MS + 10); });
    expect(result.current).toBe(false);
  });
  it('dieses Fenster tönt selbst oder ist kein Lautsprecher → keine Abfrage, false', async () => {
    held = ['hallenton'];
    const abfrage = vi.spyOn(navigator.locks, 'query');
    const { result } = renderHook(() => useAnderesFensterTont(lokal('toent', 'ready')));
    await act(async () => { await vi.advanceTimersByTimeAsync(ABFRAGE_MS * 2); });
    expect(result.current).toBe(false);
    expect(abfrage).not.toHaveBeenCalled();
  });
  it('browserSperrAbfrage: mit query vorhanden, ohne navigator.locks null', () => {
    expect(browserSperrAbfrage()).not.toBeNull();
    Reflect.deleteProperty(navigator, 'locks');
    expect(browserSperrAbfrage()).toBeNull();
  });
});
