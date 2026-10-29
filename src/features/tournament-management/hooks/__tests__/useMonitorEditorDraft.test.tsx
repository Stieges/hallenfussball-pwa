/**
 * useMonitorEditorDraft (@ME-071, @ME-072): Änderungen gelten erst mit „Speichern“.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMonitorEditorDraft } from '../useMonitorEditorDraft';
import type { TournamentMonitor } from '../../../../types/monitor';

const monitor = (): TournamentMonitor => ({
  id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'none', transitionDuration: 0, theme: 'dark',
  performanceMode: 'auto', slides: [], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
});

function einrichten(saveMonitor = vi.fn((m: TournamentMonitor) => Promise.resolve(m)), andere: string[] = ['Eingang']) {
  const stored = monitor();
  const { result } = renderHook(() => useMonitorEditorDraft(stored, andere, saveMonitor));
  return { result, saveMonitor };
}

describe('useMonitorEditorDraft', () => {
  it('@ME-071 Folienzeit ändern ohne „Speichern“ ruft nie das Speichern auf', () => {
    const { result, saveMonitor } = einrichten();
    act(() => { result.current.updateSettings({ defaultSlideDuration: 30 }); });
    expect(result.current.draft.defaultSlideDuration).toBe(30);
    expect(result.current.isDirty).toBe(true);
    expect(saveMonitor).not.toHaveBeenCalled();
  });

  it('@ME-071 Gegenbeispiel: unverändert ist nicht dirty und save meldet „unchanged“ ohne Speichern', async () => {
    const { result, saveMonitor } = einrichten();
    expect(result.current.isDirty).toBe(false);
    let r = '';
    await act(async () => { r = await result.current.save(); });
    expect(r).toBe('unchanged');
    expect(saveMonitor).not.toHaveBeenCalled();
  });

  it('@ME-071 save speichert den Entwurf genau einmal', async () => {
    const { result, saveMonitor } = einrichten();
    act(() => { result.current.updateSettings({ theme: 'light' }); });
    let r = '';
    await act(async () => { r = await result.current.save(); });
    expect(r).toBe('saved');
    expect(saveMonitor).toHaveBeenCalledTimes(1);
    expect(saveMonitor.mock.calls[0][0]).toMatchObject({ id: 'mon-1', theme: 'light' });
  });

  it('@ME-071 doppeltes save während des Speicherns ergibt genau einen Aufruf', async () => {
    let fertig: () => void = () => undefined;
    const saveMonitor = vi.fn((m: TournamentMonitor) => new Promise<TournamentMonitor>(res => { fertig = () => res(m); }));
    const { result } = einrichten(saveMonitor);
    act(() => { result.current.updateSettings({ theme: 'light' }); });
    let p1: Promise<string> = Promise.resolve('');
    let p2: Promise<string> = Promise.resolve('');
    await act(async () => { p1 = result.current.save(); p2 = result.current.save(); });
    expect(result.current.isSaving).toBe(true);
    expect(saveMonitor).toHaveBeenCalledTimes(1);
    await act(async () => { fertig(); await Promise.all([p1, p2]); });
    expect(result.current.isSaving).toBe(false);
    expect(saveMonitor).toHaveBeenCalledTimes(1);
  });

  it('@ME-071 scheitert das Speichern: Entwurf unverändert, saveError gesetzt, „failed“', async () => {
    const { result } = einrichten(vi.fn(() => Promise.reject(new Error('Netz weg'))));
    act(() => { result.current.updateSettings({ theme: 'light', defaultSlideDuration: 40 }); });
    const vorher = result.current.draft;
    let r = '';
    await act(async () => { r = await result.current.save(); });
    expect(r).toBe('failed');
    expect(result.current.saveError).toBe('Netz weg');
    expect(result.current.draft).toEqual(vorher);
    expect(result.current.isSaving).toBe(false);
  });

  it('@ME-072 ungültiger Name: „invalid“, nichts gespeichert, nameError erst nach dem Speichern-Versuch', async () => {
    const { result, saveMonitor } = einrichten();
    act(() => { result.current.updateSettings({ name: 'eingang' }); });
    expect(result.current.nameError).toBeNull();
    let r = '';
    await act(async () => { r = await result.current.save(); });
    expect(r).toBe('invalid');
    expect(result.current.nameError).toBe('duplicateName');
    expect(saveMonitor).not.toHaveBeenCalled();
  });

  it('@ME-072 Gegenbeispiel: „  Halle Nord  “ ist gültig und wird gespeichert', async () => {
    const { result, saveMonitor } = einrichten();
    act(() => { result.current.updateSettings({ name: '  Halle Nord  ' }); });
    await act(async () => { await result.current.save(); });
    expect(saveMonitor).toHaveBeenCalledTimes(1);
    expect(result.current.nameError).toBeNull();
  });

  it('Folien: hinzufügen, verschieben, ändern, entfernen wirken nur im Entwurf', () => {
    const { result, saveMonitor } = einrichten();
    let a = ''; let b = '';
    act(() => { a = result.current.addSlide('live').id; });
    act(() => { b = result.current.addSlide('live').id; });
    act(() => { result.current.moveSlide(b, 'up'); });
    expect(result.current.draft.slides.map(s => s.id)).toEqual([b, a]);
    act(() => { result.current.updateSlide(a, { duration: 12 }); });
    expect(result.current.draft.slides[1].duration).toBe(12);
    act(() => { result.current.removeSlide(b); });
    expect(result.current.draft.slides.map(s => s.id)).toEqual([a]);
    expect(saveMonitor).not.toHaveBeenCalled();
  });
});
