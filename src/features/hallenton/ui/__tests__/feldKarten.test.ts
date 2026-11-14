/**
 * H4-8 Karten je Feld (@HT-016, @HT-041, @HT-042, @HT-039): Erwartungen aus dem Gherkin der Anforderung Hallenton, nicht am Code
 * abgelesen. Die Karten rechnen nur mit Server-Alter; die Uhr des Geräts spielt keine Rolle.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HallSpeakerStateGelesen } from '../../../../core/repositories/hallentonRpc';
import { hallAnzeige, type HallAnzeigeEingabe } from '../../hallAnzeige';
import { lautsprecherLage, type LautsprecherLage } from '../../runtime/hallStatusAuswertung';
import { baueFeldKarten, type FeldKartenEingabe } from '../feldKarten';

const SERVER_JETZT = new Date(2026, 10, 13, 14, 3, 10).getTime(); // Serverzeit 14:03:10
const uhrzeit = (ms: number): string => `${String(new Date(ms).getHours()).padStart(2, '0')}:${String(new Date(ms).getMinutes()).padStart(2, '0')}`;
const sprecher = [{ field: 1, deviceName: 'Laptop Turnierleitung' }];

function karten(lagen: Record<number, LautsprecherLage>, extra: Partial<FeldKartenEingabe> = {}, anzeige: Partial<HallAnzeigeEingabe> = {}) {
  const a = hallAnzeige({ server: { stand: 'aktuell', felder: lagen, antwort: null }, lokal: null, angepfiffen: new Set(), lautsprecherBekannt: true, ...anzeige });
  return baueFeldKarten({ felder: [1, 2], anzeige: a, serverLagen: lagen, sprecher, eigenerName: null, lokalerZustand: {}, uhrzeit, ...extra });
}
const lage = (state: HallSpeakerStateGelesen, ageMs: number): LautsprecherLage => lautsprecherLage({ state, ageMs, outputHint: false }, SERVER_JETZT);

afterEach(() => vi.useRealTimers());

describe('@HT-016 ein Feld ohne Hallen-Lautsprecher bleibt neutral', () => {
  it('Feld 1 hat einen Lautsprecher, Feld 2 keinen → Feld 2 „kein Hallen-Lautsprecher“, ohne Gerät und ohne Warnung', () => {
    const k = karten({ 1: lage('ready', 3000) });
    expect(k[0]?.zustand).toEqual({ art: 'bereit' });
    expect(k[0]?.geraet).toEqual({ name: 'Laptop Turnierleitung', art: 'laptop' });
    expect(k[1]).toMatchObject({ feld: 2, zustand: { art: 'keinLautsprecher' }, pruefen: false });
    expect(k[1]?.geraet).toBeUndefined();
  });
  it('kein Lautsprecher im ganzen Turnier → beide Felder neutral', () => {
    const k = karten({}, { sprecher: [] });
    expect(k.map((x) => x.zustand.art)).toEqual(['keinLautsprecher', 'keinLautsprecher']);
  });
});

describe('@HT-041 hat die Verwaltung selbst kein Netz, steht „Status unbekannt“ statt eines alten „bereit“', () => {
  it('Feld 1 „Status unbekannt“ mit dem zuletzt bekannten Gerät, Feld 2 bleibt „kein Hallen-Lautsprecher“', () => {
    const k = karten({}, {}, { server: { stand: 'unbekannt', felder: {}, antwort: null } });
    expect(k[0]).toMatchObject({ zustand: { art: 'statusUnbekannt' }, geraet: { name: 'Laptop Turnierleitung' } });
    expect(k[1]?.zustand).toEqual({ art: 'keinLautsprecher' });
  });
  it('Gegenbeispiel: mit Netz (Stand aktuell, Lautsprecher weg) wird aus der Erinnerung kein „Status unbekannt“', () => {
    const k = karten({});
    expect(k[0]?.zustand).toEqual({ art: 'keinLautsprecher' });
  });
  it('am eigenen Gerät gilt der lokale Zustand auch ohne Netz (kein „Status unbekannt“)', () => {
    const a = hallAnzeige({
      server: { stand: 'unbekannt', felder: {}, antwort: null },
      lokal: { felder: [1], rolle: 'wartet', zustandJeFeld: { 'field-1': 'not_activated' } }, angepfiffen: new Set(), lautsprecherBekannt: true,
    });
    const k = baueFeldKarten({ felder: [1], anzeige: a, serverLagen: {}, sprecher, eigenerName: 'Laptop Turnierleitung', lokalerZustand: { 'field-1': 'not_activated' }, uhrzeit });
    expect(k[0]?.zustand).toEqual({ art: 'nichtBereit', grund: 'tonNichtAktiviert' });
  });
});

describe('@HT-042 eine falsch gehende Uhr am Verwaltungsgerät ändert die Anzeige nicht', () => {
  it.each([-20_000, 20_000])('Uhr %i ms daneben: Lautsprecher meldet sich regelmäßig → bereit, unverändert', (abweichung) => {
    vi.useFakeTimers();
    vi.setSystemTime(SERVER_JETZT + abweichung);
    expect(karten({ 1: lage('ready', 4000) })[0]?.zustand).toEqual({ art: 'bereit' });
  });
  it.each([-20_000, 20_000])('Uhr %i ms daneben: seit 14:02 nicht mehr gemeldet → „meldet sich nicht (zuletzt 14:02)“, unverändert', (abweichung) => {
    vi.useFakeTimers();
    vi.setSystemTime(SERVER_JETZT + abweichung);
    // zuletzt gesehen 14:02:55 (Serverzeit), jetzt 14:03:10 → Alter 15 s, vom Server gerechnet; die Uhr des Geräts (±20 s) zählt nie
    expect(karten({ 1: lage('ready', 15_000) })[0]?.zustand).toEqual({ art: 'meldetSichNicht', zuletzt: '14:02' });
  });
});

describe('@HT-039 im Unterpunkt steht der Grund, auf anderen Geräten nur die Pille', () => {
  it.each([
    ['not_activated', 'tonNichtAktiviert'], ['background', 'hintergrund'], ['slept', 'schlafenGelegt'], ['volume_zero', 'lautstaerkeNull'],
  ] as const)('Server-Zustand %s → Grund %s', (state, grund) => {
    expect(karten({ 1: lage(state, 2000) })[0]?.zustand).toEqual({ art: 'nichtBereit', grund });
  });
  it('ein unbekannter Server-Zustand → „nicht bereit“ ohne Wortgrund', () => {
    expect(karten({ 1: lage('zustandUnbekannt', 2000) })[0]?.zustand).toEqual({ art: 'zustandUnbekannt' });
  });
  it('eigenes Gerät ohne Netz → Grund „keine Verbindung“ (sofort, vor dem Server)', () => {
    const lokal = { felder: [1], rolle: 'toent' as const, zustandJeFeld: { 'field-1': 'keineVerbindung' as const } };
    const a = hallAnzeige({ server: { stand: 'aktuell', felder: { 1: lage('ready', 2000) }, antwort: null }, lokal, angepfiffen: new Set(), lautsprecherBekannt: true });
    const k = baueFeldKarten({ felder: [1], anzeige: a, serverLagen: { 1: lage('ready', 2000) }, sprecher, eigenerName: null, lokalerZustand: lokal.zustandJeFeld, uhrzeit });
    expect(k[0]?.zustand).toEqual({ art: 'nichtBereit', grund: 'keineVerbindung' });
  });
  it('bereit mit „Prüfen“-Hinweis und „Hupe 1 statt eigener Ton“ (ruhige Hinweise, kein „nicht bereit“)', () => {
    const k = karten({ 1: { art: 'bereit', pruefen: true, eigenerTonFehlt: true } });
    expect(k[0]).toMatchObject({ zustand: { art: 'bereit' }, pruefen: true, hupeStattEigenerTon: true });
  });
});

describe('@HT-033 Zeile 8 anderes Fenster tönt: ruhig, nicht „nicht bereit“', () => {
  it('dieses Fenster wartet auf „Ton aktivieren“, ein anderes Fenster tönt → bereit mit Hinweis „anderes Fenster“', () => {
    const lokal = { felder: [1], rolle: 'wartet' as const, zustandJeFeld: { 'field-1': 'not_activated' as const } };
    const a = hallAnzeige({ server: { stand: 'aktuell', felder: { 1: lage('ready', 1000) }, antwort: null }, lokal, angepfiffen: new Set(), lautsprecherBekannt: true, anderesFensterTont: true });
    const k = baueFeldKarten({ felder: [1], anzeige: a, serverLagen: { 1: lage('ready', 1000) }, sprecher, eigenerName: null, lokalerZustand: lokal.zustandJeFeld, uhrzeit });
    expect(k[0]).toMatchObject({ zustand: { art: 'bereit' }, anderesFenster: true });
  });
});
