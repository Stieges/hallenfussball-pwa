/**
 * Entwurfsfunktionen des Monitor-Editors (@ME-071): ändern nie den gespeicherten Monitor.
 */
import { describe, it, expect } from 'vitest';
import {
  addSlideToDraft, isDraftDirty, moveSlideInDraft, removeSlideFromDraft, updateSettingsInDraft, updateSlideInDraft,
} from '../monitorDraft';
import type { MonitorSlide, TournamentMonitor } from '../../../../../types/monitor';
import { DEFAULT_SLIDE_CONFIG } from '../../../../../types/monitor';

const slide = (id: string, order: number): MonitorSlide => ({ id, type: 'live', config: { ...DEFAULT_SLIDE_CONFIG }, duration: null, order });
const monitor = (slides: MonitorSlide[] = []): TournamentMonitor => ({
  id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'none', transitionDuration: 0, theme: 'dark',
  performanceMode: 'auto', slides, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
});
const ids = (m: TournamentMonitor) => m.slides.map(s => s.id);

describe('addSlideToDraft', () => {
  it('hängt eine Folie mit neuer ID, Standardwerten und Reihenfolge ans Ende', () => {
    const original = monitor([slide('a', 0)]);
    const { draft, slide: neu } = addSlideToDraft(original, 'live', { fieldId: 'f1' });
    expect(draft.slides).toHaveLength(2);
    expect(neu).toMatchObject({ type: 'live', duration: null, order: 1, config: { ...DEFAULT_SLIDE_CONFIG, fieldId: 'f1' } });
    expect(neu.id).not.toBe('a');
    expect(original.slides).toHaveLength(1);
  });
  it('Gegenbeispiel: ohne config gibt es kein fieldId', () => {
    expect(addSlideToDraft(monitor(), 'live').slide.config.fieldId).toBeUndefined();
  });
});

describe('updateSlideInDraft', () => {
  it('ändert Folienzeit und Konfiguration nur der gewählten Folie', () => {
    const d = updateSlideInDraft(monitor([slide('a', 0), slide('b', 1)]), 'b', { duration: 30, config: { fieldId: 'f2' } });
    expect(d.slides[1]).toMatchObject({ duration: 30, config: { fieldId: 'f2' } });
    expect(d.slides[0].duration).toBeNull();
  });
  it('Gegenbeispiel: ohne duration bleibt die Zeit; duration null setzt zurück', () => {
    const base = monitor([{ ...slide('a', 0), duration: 20 }]);
    expect(updateSlideInDraft(base, 'a', { config: { fieldId: 'x' } }).slides[0].duration).toBe(20);
    expect(updateSlideInDraft(base, 'a', { duration: null }).slides[0].duration).toBeNull();
  });
  it('Gegenbeispiel: unbekannte ID ändert nichts', () => {
    const base = monitor([slide('a', 0)]);
    expect(updateSlideInDraft(base, 'zz', { duration: 5 })).toEqual(base);
  });
});

describe('removeSlideFromDraft', () => {
  it('entfernt die Folie und nummeriert neu', () => {
    const d = removeSlideFromDraft(monitor([slide('a', 0), slide('b', 1), slide('c', 2)]), 'a');
    expect(ids(d)).toEqual(['b', 'c']);
    expect(d.slides.map(s => s.order)).toEqual([0, 1]);
  });
  it('Gegenbeispiel: unbekannte ID entfernt nichts', () => {
    expect(ids(removeSlideFromDraft(monitor([slide('a', 0)]), 'zz'))).toEqual(['a']);
  });
});

describe('moveSlideInDraft', () => {
  const base = monitor([slide('a', 0), slide('b', 1), slide('c', 2)]);
  it('schiebt nach unten und nach oben und nummeriert neu', () => {
    const down = moveSlideInDraft(base, 'a', 'down');
    expect(ids(down)).toEqual(['b', 'a', 'c']);
    expect(down.slides.map(s => s.order)).toEqual([0, 1, 2]);
    expect(ids(moveSlideInDraft(base, 'c', 'up'))).toEqual(['a', 'c', 'b']);
  });
  it('Gegenbeispiel: die erste nicht nach oben, die letzte nicht nach unten, unbekannte nicht', () => {
    expect(ids(moveSlideInDraft(base, 'a', 'up'))).toEqual(['a', 'b', 'c']);
    expect(ids(moveSlideInDraft(base, 'c', 'down'))).toEqual(['a', 'b', 'c']);
    expect(ids(moveSlideInDraft(base, 'zz', 'down'))).toEqual(['a', 'b', 'c']);
  });
});

describe('updateSettingsInDraft', () => {
  it('übernimmt Farbschema und lässt den Namen UNGETRIMMT', () => {
    const d = updateSettingsInDraft(monitor(), { theme: 'light', name: '  Halle  ' });
    expect(d.theme).toBe('light');
    expect(d.name).toBe('  Halle  ');
  });
  it('Gegenbeispiel: nicht genannte Felder bleiben', () => {
    expect(updateSettingsInDraft(monitor(), { defaultSlideDuration: 30 })).toMatchObject({ name: 'Haupthalle', theme: 'dark' });
  });
});

describe('isDraftDirty', () => {
  it('ist falsch für den unveränderten Entwurf und für nur geänderte updatedAt', () => {
    const m = monitor([slide('a', 0)]);
    expect(isDraftDirty(m, { ...m, updatedAt: '2030-01-01T00:00:00.000Z' })).toBe(false);
  });
  it('ist wahr nach Einstellung, Folienänderung oder Reihenfolge', () => {
    const m = monitor([slide('a', 0), slide('b', 1)]);
    expect(isDraftDirty(m, updateSettingsInDraft(m, { transition: 'fade' }))).toBe(true);
    expect(isDraftDirty(m, updateSlideInDraft(m, 'a', { duration: 9 }))).toBe(true);
    expect(isDraftDirty(m, moveSlideInDraft(m, 'a', 'down'))).toBe(true);
  });
  it('Gegenbeispiel: Änderung und Zurückändern ist nicht dirty', () => {
    const m = monitor();
    const zurueck = updateSettingsInDraft(updateSettingsInDraft(m, { theme: 'light' }), { theme: 'dark' });
    expect(isDraftDirty(m, zurueck)).toBe(false);
  });
});
