/**
 * Tastenkürzel – reine Tastenlogik (Plan Cockpit v2 K1). Szenarien: @SL-153 (sieben Zeilen), @SL-154 (Eingabefeld, Leertaste nach Klick),
 * @SL-141 (Cmd+Z), @SL-142 (Dialog offen), @SL-143 (Leertaste nur Uhr), @SL-144 (Strg+Z im Feld), @SL-167 (Halteknopf mit Tastatur-Fokus).
 * Gherkin: docs/anforderungen/2026-10-02_spiel-leiten.md.
 */
import { describe, it, expect } from 'vitest';
import { tasteZuAktion, type KurzAktion, type TastenEreignis, type TastenLage } from '../shortcutKey';

const taste = (key: string, extra: Partial<TastenEreignis> = {}): TastenEreignis => (
  { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false, type: 'keydown', ...extra }
);
const FREI: TastenLage = { istEingabe: false, dialogOffen: false, halteFokus: false };

describe('@SL-153 Am Laptop leitet Olli ein Spiel mit Tastenkürzeln', () => {
  it.each<[string, TastenEreignis, KurzAktion]>([
    ['Leertaste', taste(' '), 'uhr'],
    ['1', taste('1'), 'torLinks'],
    ['2', taste('2'), 'torRechts'],
    ['F', taste('F', { shiftKey: true }), 'foulLinks'],
    ['f', taste('f'), 'foulLinks'],
    ['J', taste('j'), 'foulRechts'],
    ['Strg+Z', taste('z', { ctrlKey: true }), 'rueckgaengig'],
    ['Cmd+Z (@SL-141)', taste('z', { metaKey: true }), 'rueckgaengig'],
    ['?', taste('?', { shiftKey: true }), 'uebersicht'],
  ])('%s → %s', (_name, ereignis, aktion) => {
    expect(tasteZuAktion(ereignis, FREI)).toEqual({ aktion, verhindern: true });
  });
});

describe('@SL-154 / @SL-142 / @SL-144 im Eingabefeld und bei offenem Dialog wirkt nichts, der Browser behält seine Taste', () => {
  it.each([' ', '1', '2', 'f', 'j', '?'])('Eingabefeld: „%s“ löst nichts aus und wird nicht verhindert', (key) => {
    expect(tasteZuAktion(taste(key), { ...FREI, istEingabe: true })).toEqual({ aktion: null, verhindern: false });
  });
  it('@SL-144 Strg+Z im Eingabefeld bleibt das Rückgängig des Browsers', () => {
    expect(tasteZuAktion(taste('z', { ctrlKey: true }), { ...FREI, istEingabe: true })).toEqual({ aktion: null, verhindern: false });
  });
  it('@SL-142 / A4-1: bei offenem Dialog (auch Abpfiff-Rückfrage) schaltet die Leertaste die Uhr nicht', () => {
    expect(tasteZuAktion(taste(' '), { ...FREI, dialogOffen: true })).toEqual({ aktion: null, verhindern: false });
    expect(tasteZuAktion(taste('1'), { ...FREI, dialogOffen: true }).aktion).toBeNull();
  });
  it('IME-Eingabe (isComposing) löst nichts aus', () => {
    expect(tasteZuAktion(taste('1', { isComposing: true }), FREI).aktion).toBeNull();
  });
});

describe('@SL-143 / @SL-154 Zeile 2: die Leertaste steuert immer nur die Uhr', () => {
  it('keyup der Leertaste wird verhindert (kein Klick auf den angeklickten Knopf), ohne Aktion', () => {
    expect(tasteZuAktion(taste(' ', { type: 'keyup' }), FREI)).toEqual({ aktion: null, verhindern: true });
  });
  it('gehaltene Leertaste (repeat) schaltet nicht erneut, wird aber verhindert', () => {
    expect(tasteZuAktion(taste(' ', { repeat: true }), FREI)).toEqual({ aktion: null, verhindern: true });
  });
  it('@SL-167 / A4-2 Gegenbeispiel: mit Tastatur-Fokus auf „Abpfiff halten“ gehört die Leertaste dem Halteknopf (kein Uhr-Wechsel, nicht verhindert)', () => {
    const halten = { ...FREI, halteFokus: true };
    expect(tasteZuAktion(taste(' '), halten)).toEqual({ aktion: null, verhindern: false });
    expect(tasteZuAktion(taste(' ', { type: 'keyup' }), halten)).toEqual({ aktion: null, verhindern: false });
  });
});

describe('Gegenbeispiele und Modifikatoren', () => {
  it.each([
    ['Strg+1', taste('1', { ctrlKey: true })],
    ['Cmd+1 (Tab-Wechsel)', taste('1', { metaKey: true })],
    ['Strg+Q', taste('q', { ctrlKey: true })],
    ['Umschalt+Strg+Z (Wiederholen)', taste('z', { ctrlKey: true, shiftKey: true })],
    ['AltGr+Q', taste('q', { ctrlKey: true, altKey: true })],
    ['Alt+F', taste('f', { altKey: true })],
    ['Q (kein Kürzel mehr, jetzt 1)', taste('q')],
    ['P', taste('p')],
  ])('%s löst nichts aus und wird nicht verhindert', (_n, ereignis) => {
    expect(tasteZuAktion(ereignis, FREI)).toEqual({ aktion: null, verhindern: false });
  });
  it('gehaltene „1“ (repeat) zählt kein zweites Tor', () => {
    expect(tasteZuAktion(taste('1', { repeat: true }), FREI).aktion).toBeNull();
  });
  it('gehaltenes Strg+Z (repeat) nimmt nur einmal zurück, wird aber verhindert', () => {
    expect(tasteZuAktion(taste('z', { ctrlKey: true, repeat: true }), FREI)).toEqual({ aktion: null, verhindern: true });
  });
  it('Taste loslassen (keyup) von „1“ löst nichts aus', () => {
    expect(tasteZuAktion(taste('1', { type: 'keyup' }), FREI).aktion).toBeNull();
  });
});
