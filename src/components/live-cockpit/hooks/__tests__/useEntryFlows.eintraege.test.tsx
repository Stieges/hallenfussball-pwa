/**
 * useEntryFlows – Foul, Karte, Zeitstrafe (Aufgabe 3.5).
 * Szenarien: @SL-084 (Spielzeit des ersten Tipps), @SL-029 (keine Dauer-Auswahl), @SL-088 (zweite Gelbe), @SL-085 (angehaltene Uhr),
 * @SL-087 (Halbzeitpause), @SL-023, RF5 (Zustandswechsel bei offener Auswahl).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntryFlows, type EntryCommands, type EntryFlowsParams } from '../useEntryFlows';
import type { CockpitZustand } from '../../model/cockpitPhase';

function setup(overrides: Partial<EntryFlowsParams> = {}) {
  const commands: EntryCommands = {
    tor: vi.fn().mockResolvedValue('goal-1'), nummer: vi.fn().mockResolvedValue(undefined), eigentor: vi.fn().mockResolvedValue('own-1'),
    foul: vi.fn().mockResolvedValue(undefined), karte: vi.fn().mockResolvedValue(undefined), zeitstrafe: vi.fn().mockResolvedValue(undefined),
  };
  let jetzt = 192_000;
  const melde = vi.fn();
  const params: EntryFlowsParams = {
    matchId: 'match-11', teams: { home: { id: 'fc-nord', name: 'FC Nord' }, away: { id: 'sv-sued', name: 'SV Süd' } },
    commands, spielzeitJetzt: () => jetzt, zustand: 'laeuft', melde, t: (k) => k, hatSchonGelb: () => false, ...overrides,
  };
  const hook = renderHook((p: EntryFlowsParams) => useEntryFlows(p), { initialProps: params });
  return { ...hook, commands, params, melde, setJetzt: (ms: number) => { jetzt = ms; } };
}

describe('useEntryFlows – Foul, Karte, Zeitstrafe', () => {
  it('Foul zählt mit einem Tipp und meldet es', async () => {
    const { result, commands, melde } = setup();
    await act(async () => { result.current.tippeFoul('away'); });
    expect(commands.foul).toHaveBeenCalledWith('sv-sued');
    expect(melde).toHaveBeenCalledWith(3, 'meldung.foul');
    expect(result.current.offen).toBeNull();
  });

  it('@SL-084 Karte: Spielzeit des ersten Tipps (3:12), auch wenn die Nummer erst bei 3:25 kommt', async () => {
    const { result, commands, setJetzt } = setup();
    act(() => { result.current.tippeKarte('away'); });
    act(() => { result.current.waehleKartenArt('YELLOW'); });
    setJetzt(205_000);
    await act(async () => { await result.current.waehleNummer(5); });
    expect(commands.karte).toHaveBeenCalledWith('sv-sued', 'YELLOW', { nummer: 5, clockMs: 192_000 });
    expect(result.current.offen).toBeNull();
  });

  it('@SL-023 jede Kartenart geht mit ihrer Art hinaus und meldet sie', async () => {
    for (const [art, meldung] of [['YELLOW_RED', 'meldung.karteGelbRot'], ['RED', 'meldung.karteRot']] as const) {
      const { result, commands, melde } = setup();
      act(() => { result.current.tippeKarte('away'); });
      act(() => { result.current.waehleKartenArt(art); });
      await act(async () => { await result.current.waehleNummer(5); });
      expect(commands.karte).toHaveBeenCalledWith('sv-sued', art, { nummer: 5, clockMs: 192_000 });
      expect(melde).toHaveBeenCalledWith(3, meldung);
    }
  });

  it('@SL-084 Zeitstrafe: Spielzeit des ersten Tipps (3:12), auch wenn die Nummer erst bei 3:25 kommt', async () => {
    const { result, commands, setJetzt } = setup();
    act(() => { result.current.tippeZeitstrafe('away'); });
    setJetzt(205_000);
    await act(async () => { await result.current.waehleNummer(5); });
    expect(commands.zeitstrafe).toHaveBeenCalledWith('sv-sued', { nummer: 5, clockMs: 192_000 });
  });

  it('@SL-029 Zeitstrafe ohne Dauer-Auswahl: gesendet werden nur Nummer und Spielzeit', async () => {
    const { result, commands, melde } = setup();
    act(() => { result.current.tippeZeitstrafe('away'); });
    await act(async () => { await result.current.waehleNummer(5); });
    expect(commands.zeitstrafe).toHaveBeenCalledWith('sv-sued', { nummer: 5, clockMs: 192_000 });
    expect(melde).toHaveBeenCalledWith(3, 'meldung.strafeErfasst');
  });

  it('Zeitstrafe „ohne Nummer“ erfasst ohne Nummer; Schließen über die Abdunkelung verwirft', async () => {
    const a = setup();
    act(() => { a.result.current.tippeZeitstrafe('away'); });
    await act(async () => { await a.result.current.schliesseAuswahl('ohneNummer'); });
    expect(a.commands.zeitstrafe).toHaveBeenCalledWith('sv-sued', { nummer: null, clockMs: 192_000 });
    const b = setup();
    act(() => { b.result.current.tippeZeitstrafe('away'); });
    await act(async () => { await b.result.current.schliesseAuswahl('abdunkelung'); });
    expect(b.commands.zeitstrafe).not.toHaveBeenCalled();
    expect(b.result.current.offen).toBeNull();
  });

  it('Karte „ohne Nummer“ erfasst die Karte ohne Nummer; ohne gewählte Art erfasst „ohne Nummer“ nichts', async () => {
    const a = setup();
    act(() => { a.result.current.tippeKarte('away'); });
    act(() => { a.result.current.waehleKartenArt('RED'); });
    await act(async () => { await a.result.current.schliesseAuswahl('ohneNummer'); });
    expect(a.commands.karte).toHaveBeenCalledWith('sv-sued', 'RED', { nummer: null, clockMs: 192_000 });
    const b = setup();
    act(() => { b.result.current.tippeKarte('away'); });
    await act(async () => { await b.result.current.schliesseAuswahl('ohneNummer'); });
    expect(b.commands.karte).not.toHaveBeenCalled();
  });

  it('@SL-088 zweite Gelbe: Rückfrage, „Gelb-Rot“ mit einem Tipp; „Trotzdem Gelb“ erfasst Gelb', async () => {
    const a = setup({ hatSchonGelb: (teamId, n) => teamId === 'sv-sued' && n === 7 });
    act(() => { a.result.current.tippeKarte('away'); });
    act(() => { a.result.current.waehleKartenArt('YELLOW'); });
    await act(async () => { await a.result.current.waehleNummer(7); });
    expect(a.result.current.rueckfrageZweiteGelbe).toEqual({ nummer: 7 });
    expect(a.commands.karte).not.toHaveBeenCalled();
    await act(async () => { await a.result.current.antworteZweiteGelbe('gelbRot'); });
    expect(a.commands.karte).toHaveBeenCalledWith('sv-sued', 'YELLOW_RED', { nummer: 7, clockMs: 192_000 });
    expect(a.result.current.rueckfrageZweiteGelbe).toBeNull();
    const b = setup({ hatSchonGelb: () => true });
    act(() => { b.result.current.tippeKarte('away'); });
    act(() => { b.result.current.waehleKartenArt('YELLOW'); });
    await act(async () => { await b.result.current.waehleNummer(7); });
    await act(async () => { await b.result.current.antworteZweiteGelbe('trotzdemGelb'); });
    expect(b.commands.karte).toHaveBeenCalledWith('sv-sued', 'YELLOW', { nummer: 7, clockMs: 192_000 });
  });

  it('@SL-088 Gegenbeispiel: erste Gelbe für Nr. 7 ohne Rückfrage', async () => {
    const { result, commands } = setup();
    act(() => { result.current.tippeKarte('away'); });
    act(() => { result.current.waehleKartenArt('YELLOW'); });
    await act(async () => { await result.current.waehleNummer(7); });
    expect(result.current.rueckfrageZweiteGelbe).toBeNull();
    expect(commands.karte).toHaveBeenCalledTimes(1);
  });

  it('@SL-088 Gegenbeispiel: eine Rote Karte für eine Nummer mit Gelb fragt nicht nach (nur die zweite Gelbe)', async () => {
    const { result, commands } = setup({ hatSchonGelb: () => true });
    act(() => { result.current.tippeKarte('away'); });
    act(() => { result.current.waehleKartenArt('RED'); });
    await act(async () => { await result.current.waehleNummer(7); });
    expect(result.current.rueckfrageZweiteGelbe).toBeNull();
    expect(commands.karte).toHaveBeenCalledWith('sv-sued', 'RED', { nummer: 7, clockMs: 192_000 });
  });

  it('@SL-088 die Rückfrage verwerfen (schließen) erfasst keine Karte', async () => {
    const { result, commands } = setup({ hatSchonGelb: () => true });
    act(() => { result.current.tippeKarte('away'); });
    act(() => { result.current.waehleKartenArt('YELLOW'); });
    await act(async () => { await result.current.waehleNummer(7); });
    act(() => { result.current.schliesse(); });
    expect(result.current.offen).toBeNull();
    expect(result.current.rueckfrageZweiteGelbe).toBeNull();
    expect(commands.karte).not.toHaveBeenCalled();
  });

  it.each<[string, (r: ReturnType<typeof setup>) => Promise<void>, keyof EntryCommands]>([
    ['ein Tor für FC Nord, Nr. 7', async (r) => { await act(async () => { r.result.current.tippeTor('home'); }); await act(async () => { await r.result.current.waehleNummer(7); }); }, 'nummer'],
    ['ein Eigentor der Nummer 4 von SV Süd', async (r) => { await act(async () => { r.result.current.tippeTor('home'); }); await act(async () => { await r.result.current.waehleEigentor(); }); }, 'eigentor'],
    ['ein Foul für SV Süd', async (r) => { await act(async () => { r.result.current.tippeFoul('away'); }); }, 'foul'],
    ['eine Gelbe Karte für SV Süd, Nr. 5', async (r) => { act(() => { r.result.current.tippeKarte('away'); }); act(() => { r.result.current.waehleKartenArt('YELLOW'); }); await act(async () => { await r.result.current.waehleNummer(5); }); }, 'karte'],
    ['eine Zeitstrafe für SV Süd, Nr. 5', async (r) => { act(() => { r.result.current.tippeZeitstrafe('away'); }); await act(async () => { await r.result.current.waehleNummer(5); }); }, 'zeitstrafe'],
  ])('@SL-085 bei angehaltener Uhr (4:12) lässt sich %s erfassen', async (_e, ablauf, befehl) => {
    const r = setup({ zustand: 'pausiert', spielzeitJetzt: () => 252_000 });
    await ablauf(r);
    expect(r.commands[befehl]).toHaveBeenCalled();
  });

  it('RF5 Abpfiff bei offener Karten-Auswahl: schließt, nichts erfasst, Meldezeile sagt es', () => {
    const r = setup();
    act(() => { r.result.current.tippeKarte('away'); });
    r.rerender({ ...r.params, zustand: 'abgepfiffen' as CockpitZustand });
    expect(r.result.current.offen).toBeNull();
    expect(r.commands.karte).not.toHaveBeenCalled();
    expect(r.melde).toHaveBeenCalledWith(3, 'meldung.nichtErfasst');
  });

  it('RF5 Abpfiff bei offener Zeitstrafen-Auswahl und bei offener Rückfrage: schließt ebenfalls, ohne zweiten Befehl', async () => {
    const a = setup();
    act(() => { a.result.current.tippeZeitstrafe('away'); });
    a.rerender({ ...a.params, zustand: 'abgepfiffen' as CockpitZustand });
    expect(a.result.current.offen).toBeNull();
    expect(a.commands.zeitstrafe).not.toHaveBeenCalled();
    const b = setup({ hatSchonGelb: () => true });
    act(() => { b.result.current.tippeKarte('away'); });
    act(() => { b.result.current.waehleKartenArt('YELLOW'); });
    await act(async () => { await b.result.current.waehleNummer(7); });
    b.rerender({ ...b.params, zustand: 'abgepfiffen' as CockpitZustand });
    expect(b.result.current.rueckfrageZweiteGelbe).toBeNull();
    expect(b.result.current.offen).toBeNull();
    expect(b.commands.karte).not.toHaveBeenCalled();
  });

  it('RF5 Gegenbeispiel: Halbzeitpause bei offener Tor-Nummernauswahl lässt sie offen', async () => {
    const r = setup();
    await act(async () => { r.result.current.tippeTor('home'); });
    r.rerender({ ...r.params, zustand: 'halbzeitpause' as CockpitZustand });
    expect(r.result.current.offen?.art).toBe('tor');
  });

  it('@SL-087 Gegenbeispiel: Halbzeitpause bei offener Karten-Auswahl lässt sie offen (Karten sind dort erlaubt)', () => {
    const r = setup();
    act(() => { r.result.current.tippeKarte('away'); });
    r.rerender({ ...r.params, zustand: 'halbzeitpause' as CockpitZustand });
    expect(r.result.current.offen?.art).toBe('karte');
    expect(r.melde).not.toHaveBeenCalledWith(3, 'meldung.nichtErfasst');
  });
});
