/**
 * H4-6 Hook `useHallAusgang()` (@HT-053, @HT-054, @HT-055): ohne Freigabe nur „Standard“, nach Freigabe Namen mit virtuellen am
 * Ende, Wahl und Standard, Verlust und Bestätigen. Keine Oberfläche (die baut H4-11). Fälschungen: `mediaDevices`, `AudioContext`
 * mit/ohne `setSinkId`, Spieler des Geräts.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FalscheMedienGeraete } from '../../../test/hallenton/falscheMedienGeraete';
import { FalscherSpeicher } from '../../../test/hallenton/falschesGeraet';
import { __setzeGeraetFuerTests } from '../lautsprecherGeraet';
import { erzeugeAusgangListe } from '../runtime/ausgang/ausgangListe';
import { erzeugeAusgangWaechter } from '../runtime/ausgang/ausgangWaechter';
import { AUSGANG_SCHLUESSEL, erzeugeAusgangWahl } from '../runtime/ausgang/ausgangWahl';
import { __setzeAusgangFuerTests } from '../runtime/ausgang/browserAusgang';
import type { HallTonSpieler } from '../runtime/hallTonSpieler';
import { useHallAusgang } from '../useHallAusgang';

const DOCK = { id: 'dock', name: 'ThinkPad Thunderbolt 3 Dock USB Audio (17ef:306a)', gruppe: 'g-dock' };
let medien: FalscheMedienGeraete;
let speicher: FalscherSpeicher;
let aktivieren: ReturnType<typeof vi.fn>;

function baue(): void {
  const liste = erzeugeAusgangListe({ geraete: medien, berechtigungen: medien });
  const wahl = erzeugeAusgangWahl({ speicher, seite: null });
  __setzeAusgangFuerTests({ liste, wahl, waechter: erzeugeAusgangWaechter({ liste, wahl }) });
}

const mitSetSinkId = class { setSinkId(): Promise<void> { return Promise.resolve(); } };
const ohneSetSinkId = class { resume(): Promise<void> { return Promise.resolve(); } };

beforeEach(() => {
  medien = new FalscheMedienGeraete();
  speicher = new FalscherSpeicher();
  aktivieren = vi.fn(() => Promise.resolve(true));
  __setzeGeraetFuerTests({ spieler: { aktivieren } as unknown as HallTonSpieler });
  vi.stubGlobal('AudioContext', mitSetSinkId);
  baue();
});

afterEach(() => {
  vi.unstubAllGlobals();
  __setzeAusgangFuerTests(null);
  __setzeGeraetFuerTests();
});

describe('@HT-053 Ausgang wählen (Hook)', () => {
  it('@HT-053 das Mikrofon nicht freigegeben → nur „Standard“: leere Liste, keine Wahl, das Mikrofon wurde nie angefragt', async () => {
    const { result } = renderHook(() => useHallAusgang());
    await act(async () => { await Promise.resolve(); });
    expect(result.current).toMatchObject({ verfuegbar: true, gewaehlt: null, liste: [], zustand: 'standard' });
    expect(medien.mikrofonAnfragen).toBe(0);
    expect(medien.spuren).toHaveLength(0);
  });

  it('@HT-053 das Mikrofon einmal erlaubt → alle Ausgänge mit Namen, virtuelle am Ende, der Strom sofort beendet', async () => {
    const { result } = renderHook(() => useHallAusgang());
    let erlaubt = false;
    await act(async () => { erlaubt = await result.current.mikrofonErlauben(); });
    expect(erlaubt).toBe(true);
    expect(medien.spuren.every((s) => s.gestoppt)).toBe(true);
    expect(result.current.liste.map((e) => e.id)).toEqual(['default', 'lg', 'dock', 'mac', 'teams']);
    expect(result.current.liste.at(-1)?.virtuell).toBe(true);
    expect(result.current.liste.find((e) => e.id === 'lg')?.name).toBe('LG Ultra HD (DisplayPort)');
  });

  it('@HT-053 Olli wählt das Dock → die Wahl steht lokal (hallenton:ausgang) und gilt; „Standard“ (null) setzt sie zurück; eine unbekannte Kennung ändert nichts', async () => {
    const { result } = renderHook(() => useHallAusgang());
    await act(async () => { await result.current.mikrofonErlauben(); });
    act(() => { result.current.waehle('dock'); });
    expect(result.current.gewaehlt).toEqual(DOCK);
    expect(result.current.zustand).toBe('ok');
    expect(JSON.parse(speicher.getItem(AUSGANG_SCHLUESSEL) ?? 'null')).toEqual(DOCK);
    act(() => { result.current.waehle('gibt-es-nicht'); });
    expect(result.current.gewaehlt?.id).toBe('dock');
    act(() => { result.current.waehle(null); });
    expect(result.current.gewaehlt).toBeNull();
    expect(result.current.zustand).toBe('standard');
    expect(speicher.getItem(AUSGANG_SCHLUESSEL)).toBeNull();
  });

  it('@HT-053 der Browser kann keinen Ausgang wählen (kein setSinkId) → „Standard“ ohne Wahl: verfuegbar false, leere Liste, waehle ändert nichts', async () => {
    vi.stubGlobal('AudioContext', ohneSetSinkId);
    medien.erlaubt = true;
    const { result } = renderHook(() => useHallAusgang());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.verfuegbar).toBe(false);
    expect(result.current.liste).toEqual([]);
    act(() => { result.current.waehle('dock'); });
    expect(result.current.gewaehlt).toBeNull();
    expect(medien.leseAufrufe).toBe(0);
  });
});

describe('@HT-054 Ausgang verloren (Hook)', () => {
  it('@HT-054 das Dock wird abgezogen → zustand „lost“, wieder angesteckt → „ok“ ohne neue Wahl', async () => {
    const { result } = renderHook(() => useHallAusgang());
    await act(async () => { await result.current.mikrofonErlauben(); });
    act(() => { result.current.waehle('dock'); });
    await act(async () => { medien.abziehen('dock'); await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.zustand).toBe('lost');
    expect(result.current.gewaehlt?.id).toBe('dock');
    await act(async () => { medien.anstecken({ id: 'dock', name: DOCK.name, gruppe: DOCK.gruppe }); await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.zustand).toBe('ok');
  });
});

describe('@HT-055 Ausgang bestätigen (Hook)', () => {
  beforeEach(() => {
    speicher.setItem(AUSGANG_SCHLUESSEL, JSON.stringify(DOCK));
    medien.erlaubt = false; // App neu geladen, „Nur dieses Mal“ vorbei
    baue();
  });

  it('@HT-055 nach dem Neuladen steht „unconfirmed“, nie „lost“; die Wahl bleibt erhalten', async () => {
    const { result } = renderHook(() => useHallAusgang());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.zustand).toBe('unconfirmed');
    expect(result.current.gewaehlt?.id).toBe('dock');
  });

  it('@HT-055 Olli tippt „Ausgang bestätigen“ und erlaubt → „Ton aktivieren“ und die Mikrofon-Frage starten in derselben Geste, danach gilt das Dock, der Strom ist beendet', async () => {
    const { result } = renderHook(() => useHallAusgang());
    await act(async () => { await Promise.resolve(); });
    let antwort: Promise<boolean> = Promise.resolve(false);
    act(() => { antwort = result.current.bestaetigen(); });
    expect(aktivieren).toHaveBeenCalledTimes(1); // vor jedem await: Nutzergeste für resume()
    expect(medien.mikrofonAnfragen).toBe(1);
    await act(async () => { expect(await antwort).toBe(true); });
    expect(medien.spuren.every((s) => s.gestoppt)).toBe(true);
    expect(result.current.zustand).toBe('ok');
  });

  it('@HT-055 Olli lehnt das Mikrofon ab → bestätigen() ist false, es bleibt „unconfirmed“ (Olli kann „Standard“ wählen)', async () => {
    medien.ablehnen = true;
    const { result } = renderHook(() => useHallAusgang());
    await act(async () => { await Promise.resolve(); });
    let ok = true;
    await act(async () => { ok = await result.current.bestaetigen(); });
    expect(ok).toBe(false);
    expect(result.current.zustand).toBe('unconfirmed');
    act(() => { result.current.waehle(null); });
    expect(result.current.zustand).toBe('standard');
  });
});
