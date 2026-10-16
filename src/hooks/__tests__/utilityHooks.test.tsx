/**
 * A-03 – Abdeckung der kleinen Allzweck-Hooks (useDebounce, useOnlineStatus, useClickOutside, useFields).
 * Keine Szenario-Kennung: Verhalten unverändert, die Tests sichern es ab, damit die Hook-Abdeckung
 * des Bereichs `src/hooks` mit dem Umbau der Leser nicht zurückfällt.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce, useDebouncedCallback } from '../useDebounce';
import { useOnlineStatus, useIsOnline } from '../useOnlineStatus';
import { useClickOutside, useClickOutsideMultiple } from '../useClickOutside';
import { useFields } from '../useFields';
import type { Tournament, TournamentField } from '../../types/tournament';
import { createMockTournament } from '../../test/factories';

describe('useDebounce / useDebouncedCallback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('übernimmt den Wert erst nach der Verzögerung', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), { initialProps: { value: 'a' } });
    rerender({ value: 'b' });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('b');
  });

  it('Gegenbeispiel: ein neuer Wert innerhalb der Verzögerung startet die Wartezeit neu', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), { initialProps: { value: 'a' } });
    rerender({ value: 'b' });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ value: 'c' });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('c');
  });

  it('der entprellte Aufruf läuft einmal, mit den Argumenten des letzten Aufrufs', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));
    act(() => { result.current('x'); result.current('y'); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('y');
  });

  it('nach dem Ausblenden des Hooks läuft ein wartender Aufruf nicht mehr', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 500));
    act(() => { result.current(); });
    unmount();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('useOnlineStatus', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('folgt online/offline-Ereignissen und meldet die Wiederverbindung für drei Sekunden', () => {
    const { result } = renderHook(() => useOnlineStatus());
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current).toEqual({ isOnline: false, wasOffline: false });
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current).toEqual({ isOnline: true, wasOffline: true });
  });

  it('useIsOnline liefert nur den Wahrheitswert', () => {
    const { result } = renderHook(() => useIsOnline());
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current).toBe(false);
  });
});

describe('useClickOutside / useClickOutsideMultiple', () => {
  const makeRef = (el: HTMLElement) => ({ current: el });

  it('ruft den Handler bei einem Klick außerhalb, nicht innerhalb', () => {
    const inside = document.createElement('div');
    const child = document.createElement('span');
    inside.appendChild(child);
    const outside = document.createElement('div');
    document.body.append(inside, outside);
    const handler = vi.fn();
    renderHook(() => useClickOutside(makeRef(inside), handler));

    child.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    inside.remove();
    outside.remove();
  });

  it('Gegenbeispiel: ausgeschaltet hört der Hook nicht zu', () => {
    const inside = document.createElement('div');
    document.body.append(inside);
    const handler = vi.fn();
    renderHook(() => useClickOutside(makeRef(inside), handler, false));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    inside.remove();
  });

  it('Mehrfach-Variante: ein Klick in irgendeinem der Elemente zählt als innen', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const outside = document.createElement('div');
    document.body.append(a, b, outside);
    const handler = vi.fn();
    renderHook(() => useClickOutsideMultiple([makeRef(a), makeRef(b)], handler));
    b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    outside.dispatchEvent(new Event('touchstart', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    [a, b, outside].forEach((el) => el.remove());
  });
});

describe('useFields', () => {
  const fields: TournamentField[] = [
    { id: 'field-1', defaultName: 'Feld 1' },
    { id: 'field-2', defaultName: 'Feld 2', customName: 'Halle Nord' },
    { id: 'field-3', defaultName: 'Feld 3', shortCode: 'XY' },
  ];
  const tournamentWith = (overrides: Partial<Tournament> = {}): Tournament => createMockTournament({ fields, ...overrides });

  it('Anzeigename: eigener Name vor Standardname, unbekannte ID als „Feld <id>“', () => {
    const { result } = renderHook(() => useFields(tournamentWith(), vi.fn()));
    expect(result.current.getFieldDisplayName('field-1')).toBe('Feld 1');
    expect(result.current.getFieldDisplayName('field-2')).toBe('Halle Nord');
    expect(result.current.getFieldDisplayName('field-9')).toBe('Feld field-9');
  });

  it('Kurzcode: gesetzter Code, Initialen des eigenen Namens, sonst F<Nummer>', () => {
    const { result } = renderHook(() => useFields(tournamentWith(), vi.fn()));
    expect(result.current.getFieldShortCode('field-3')).toBe('XY');
    expect(result.current.getFieldShortCode('field-2')).toBe('HA');
    expect(result.current.getFieldShortCode('field-1')).toBe('F1');
    expect(result.current.getFieldShortCode('field-7')).toBe('F7');
  });

  it('ohne Turnier: keine Felder, kein Feld in Folien benutzt, Ändern wirft', async () => {
    const { result } = renderHook(() => useFields(null, vi.fn()));
    expect(result.current.fields).toEqual([]);
    expect(result.current.isFieldUsedInSlides('field-1')).toBe(false);
    await expect(result.current.updateField('field-1', { customName: 'X' })).rejects.toThrow('Kein Turnier');
  });

  it('updateField speichert Name und Kurzcode (getrimmt, groß, höchstens 3 Zeichen)', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useFields(tournamentWith(), save));
    const updated = await result.current.updateField('field-1', { customName: '  Halle Süd ', shortCode: 'abcd' });
    expect(updated).toMatchObject({ customName: 'Halle Süd', shortCode: 'ABC' });
    expect(save).toHaveBeenCalledTimes(1);
    expect((save.mock.calls[0][0] as Tournament).fields?.[0]).toMatchObject({ customName: 'Halle Süd' });
  });

  it('Gegenbeispiel: unbekanntes Feld wird nicht gespeichert', async () => {
    const save = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderHook(() => useFields(tournamentWith(), save));
    await expect(result.current.updateField('field-9', { customName: 'X' })).resolves.toBeUndefined();
    expect(save).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('erkennt ein Feld, das eine Folie benutzt', () => {
    const t = tournamentWith({
      monitors: [{ id: 'm1', slides: [{ type: 'live', config: { fieldId: 'field-2' } }] }] as unknown as Tournament['monitors'],
    });
    const { result } = renderHook(() => useFields(t, vi.fn()));
    expect(result.current.isFieldUsedInSlides('field-2')).toBe(true);
    expect(result.current.isFieldUsedInSlides('field-1')).toBe(false);
  });
});
