import { describe, it, expect } from 'vitest';
import { darfAktion, type CockpitAktion } from '../darf';
import type { CockpitPhase, CockpitZustand } from '../cockpitPhase';

const phase = (zustand: CockpitZustand, extra: Partial<CockpitPhase> = {}): CockpitPhase => ({ zustand, abschnittArt: 'regulaer', abschnitt: 1, abschnitte: 2, letzterAbschnitt: false, ...extra });

describe('darfAktion – Matrix § 6 und Nur-Lesen § 4.4', () => {
  it.each<[string, CockpitAktion, boolean]>([
    ['eine Gelbe Karte für SV Süd, Nr. 5', 'karte', true],
    ['eine Zeitstrafe für SV Süd, Nr. 5', 'zeitstrafe', true],
    ['ein Tor für FC Nord', 'tor', false],
    ['ein Foul für SV Süd', 'foul', false],
  ])('@SL-087 Halbzeitpause: %s → %s', (_e, aktion, erwartet) => {
    expect(darfAktion(phase('halbzeitpause'), true, aktion)).toBe(erwartet);
  });

  it.each<[string, CockpitAktion, boolean]>([
    ['eine Gelbe Karte für SV Süd, Nr. 5', 'karte', true],
    ['eine Zeitstrafe für SV Süd, Nr. 5', 'zeitstrafe', true],
    ['ein Tor für FC Nord', 'tor', false],
    ['ein Foul für SV Süd', 'foul', false],
  ])('Spec § 6 Pause vor der Verlängerung (wie die Halbzeitpause, @SL-087): %s → %s', (_e, aktion, erwartet) => {
    expect(darfAktion(phase('pauseVorVerlaengerung'), true, aktion)).toBe(erwartet);
  });

  it.each<CockpitAktion>(['tor', 'foul', 'karte', 'zeitstrafe'])('@SL-085 pausiert: %s erlaubt', (aktion) => {
    expect(darfAktion(phase('pausiert'), true, aktion)).toBe(true);
  });

  it.each<CockpitAktion>(['anpfiff', 'tor', 'foul', 'karte', 'zeitstrafe', 'rueckgaengig', 'abpfiff', 'eintragZuruecknehmen', 'einstellungenAendern'])(
    '@SL-018 @SL-046 ohne Steuer: %s nicht erlaubt', (aktion) => {
      expect(darfAktion(phase('laeuft'), false, aktion)).toBe(false);
    });

  it('ohne Steuer bleibt Seiten tauschen (nur Anzeige dieses Geräts)', () => {
    expect(darfAktion(phase('laeuft'), false, 'seitenTauschen')).toBe(true);
  });

  it.each<[CockpitZustand, CockpitAktion, boolean]>([
    ['abgepfiffen', 'rueckgaengig', false], ['abgepfiffen', 'eintragZuruecknehmen', false], ['abgepfiffen', 'nummerNachtragen', true],
    ['abgepfiffen', 'nummerAendern', false], ['abgepfiffen', 'ergebnisBestaetigen', true], ['laeuft', 'nummerAendern', true],
    ['vorAnpfiff', 'tor', false], ['vorAnpfiff', 'anpfiff', true], ['entscheidung', 'entscheidung', true], ['entscheidung', 'rueckgaengig', false], ['strafstoss', 'tor', false],
  ])('%s: %s → %s (@SL-045, @SL-113, @SL-041)', (zustand, aktion, erwartet) => {
    expect(darfAktion(phase(zustand), true, aktion)).toBe(erwartet);
  });
});
