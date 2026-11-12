/**
 * H4-5 hallAnzeige (G7): eine Quelle der Anzeige. Erwartungen aus dem Gherkin der Anforderung Hallenton (@HT-011, @HT-012, @HT-016,
 * @HT-028, @HT-033 Zeile 8, @HT-035, @HT-037, @HT-038, @HT-039, @HT-041, @HT-042), nicht am Code abgelesen.
 */
import { describe, expect, it } from 'vitest';
import { hallAnzeige, type HallAnzeigeEingabe, type LokaleLage } from '../hallAnzeige';
import { lautsprecherLage, type LautsprecherLage } from '../runtime/hallStatusAuswertung';
import type { FeldZustand } from '../runtime/laufzeitZustand';
import type { HallStatusAntwort } from '../../../core/repositories/hallentonRpc';

const T0 = 1_000_000;
const server = (felder: Record<number, LautsprecherLage>, extra: Partial<HallAnzeigeEingabe['server']> = {}): HallAnzeigeEingabe['server'] => ({
  stand: 'aktuell', felder, antwort: null, ...extra,
});
const lokal = (zustand: FeldZustand, rolle: LokaleLage['rolle'] = 'toent'): LokaleLage => ({ felder: [1], rolle, zustandJeFeld: { 'field-1': zustand } });
const bereit: LautsprecherLage = { art: 'bereit', pruefen: false };
const eingabe = (e: Partial<HallAnzeigeEingabe>): HallAnzeigeEingabe => ({ server: server({}), lokal: null, lautsprecherBekannt: false, ...e });

describe('@HT-012 @HT-011 @HT-037 am eigenen Gerät gilt der lokale Zustand, mit Grund', () => {
  it('@HT-012 Ton nicht aktiviert → „Ton nicht aktiv“ am eigenen Gerät', () => {
    const a = hallAnzeige(eingabe({ lokal: lokal('not_activated', 'wartet') }));
    expect(a.felder).toEqual([{ feld: 1, anzeige: { art: 'tonNichtAktiv' }, eigenesGeraet: true }]);
  });
  it('@HT-011 kein Netz am Lautsprecher → „keine Verbindung“, sofort, ohne auf den Server zu warten', () => {
    const a = hallAnzeige(eingabe({ lokal: lokal('keineVerbindung'), server: server({ 1: bereit }) }));
    expect(a.felder[0]?.anzeige).toEqual({ art: 'keineVerbindung' });
  });
  it('@HT-037 vom Browser schlafen gelegt → „schlafen gelegt“', () => {
    expect(hallAnzeige(eingabe({ lokal: lokal('slept', 'wartet') })).felder[0]?.anzeige).toEqual({ art: 'schlafenGelegt' });
  });
  it('lokal vor Server: der Server sagt noch „bereit“, das Gerät ist schon nicht aktiviert', () => {
    const a = hallAnzeige(eingabe({ lokal: lokal('not_activated', 'wartet'), server: server({ 1: bereit }) }));
    expect(a.felder[0]?.anzeige.art).toBe('tonNichtAktiv');
  });
  it('Hintergrund und Lautstärke 0 % am eigenen Gerät: nur die Pille „nicht bereit“, kein Wortgrund (@HT-039)', () => {
    expect(hallAnzeige(eingabe({ lokal: lokal('background') })).felder[0]?.anzeige).toEqual({ art: 'nichtBereit' });
    expect(hallAnzeige(eingabe({ lokal: lokal('volume_zero') })).felder[0]?.anzeige).toEqual({ art: 'nichtBereit' });
  });
  it('@HT-033 Zeile 8: hält ein anderes Fenster die Sperre, steht „läuft schon in einem anderen Fenster“', () => {
    expect(hallAnzeige(eingabe({ lokal: lokal('ready', 'andererTab') })).felder[0]?.anzeige).toEqual({ art: 'anderesFenster' });
  });
  it('Gegenbeispiel: die Laufzeit ist still (Gast, Turnierende) → der Stand am Server gilt', () => {
    const a = hallAnzeige(eingabe({ lokal: lokal('not_activated', 'still'), server: server({ 1: bereit }) }));
    expect(a.felder[0]).toEqual({ feld: 1, anzeige: { art: 'bereit', pruefen: false, hupeStattEigenerTon: false }, eigenesGeraet: false });
  });
  it('„Prüfen“ kennt nur der Server und bleibt am eigenen Gerät erhalten', () => {
    const a = hallAnzeige(eingabe({ lokal: lokal('ready'), server: server({ 1: { art: 'bereit', pruefen: true } }) }));
    expect(a.felder[0]?.anzeige).toEqual({ art: 'bereit', pruefen: true, hupeStattEigenerTon: false });
  });
});

describe('@HT-039 @HT-042 auf anderen Geräten: Pille ohne Grund, Alter vom Server', () => {
  it.each(['not_activated', 'background', 'slept', 'volume_zero'] as const)('Server-Zustand %s → nur „nicht bereit“, kein Grund', (state) => {
    const lage = lautsprecherLage({ state, ageMs: 2000, outputHint: false }, T0);
    expect(hallAnzeige(eingabe({ server: server({ 1: lage }) })).felder[0]).toEqual({ feld: 1, anzeige: { art: 'nichtBereit' }, eigenesGeraet: false });
  });
  it('@HT-011 meldet sich seit 14:02 nicht → auf anderen Geräten die Pille „nicht bereit“', () => {
    const lage = lautsprecherLage({ state: 'ready', ageMs: 20_000, outputHint: false }, T0);
    expect(hallAnzeige(eingabe({ server: server({ 1: lage }) })).felder[0]?.anzeige).toEqual({ art: 'nichtBereit' });
  });
  it('@HT-042 das Alter rechnet der Server: ein Lebenszeichen von 2 s ist bereit, egal wie die Uhr des Geräts geht', () => {
    const lage = lautsprecherLage({ state: 'ready', ageMs: 2000, outputHint: false }, T0 + 99 * 3_600_000);
    expect(hallAnzeige(eingabe({ server: server({ 1: lage }) })).felder[0]?.anzeige.art).toBe('bereit');
  });
  it('unbekannter Zustand (zustandUnbekannt) = „nicht bereit“ ohne Wortgrund und NICHT „Status unbekannt“', () => {
    const lage = lautsprecherLage({ state: 'zustandUnbekannt', ageMs: 1000, outputHint: false }, T0);
    const a = hallAnzeige(eingabe({ server: server({ 1: lage }), lautsprecherBekannt: true }));
    expect(a.felder[0]?.anzeige).toEqual({ art: 'nichtBereit' });
    expect(a.statusUnbekannt).toBe(false);
  });
});

describe('@HT-028 eigener Ton nicht ladbar: bereit mit ruhigem Hinweis', () => {
  it('Server custom_sound_failed → bereit, nicht „nicht bereit“, mit Hinweis „Hupe 1 statt eigener Ton“', () => {
    const lage = lautsprecherLage({ state: 'custom_sound_failed', ageMs: 1000, outputHint: false }, T0);
    expect(hallAnzeige(eingabe({ server: server({ 1: lage }) })).felder[0]?.anzeige).toEqual({ art: 'bereit', pruefen: false, hupeStattEigenerTon: true });
  });
  it('am eigenen Gerät ebenso', () => {
    expect(hallAnzeige(eingabe({ lokal: lokal('custom_sound_failed') })).felder[0]?.anzeige).toEqual({ art: 'bereit', pruefen: false, hupeStattEigenerTon: true });
  });
});

describe('@HT-016 @HT-038 @HT-041 ohne Lautsprecher, ohne Netz', () => {
  it('ohne Lautsprecher im Turnier: nichts, nie „bereit“', () => {
    const a = hallAnzeige(eingabe({ server: server({ 1: { art: 'keiner' } }) }));
    expect(a).toEqual({ felder: [], handyOhneNetz: [], statusUnbekannt: false });
  });
  it('@HT-041 die Verwaltung hat kein Netz und kannte einen Lautsprecher → „Status unbekannt“, kein alter „bereit“-Eintrag', () => {
    const a = hallAnzeige(eingabe({ server: { stand: 'unbekannt', felder: {}, antwort: null }, lautsprecherBekannt: true }));
    expect(a.statusUnbekannt).toBe(true);
    expect(a.felder).toEqual([]);
  });
  it('Gegenbeispiel @HT-038: ohne je einen Lautsprecher zu kennen, keine Warnung ohne Netz', () => {
    expect(hallAnzeige(eingabe({ server: { stand: 'unbekannt', felder: {}, antwort: null } })).statusUnbekannt).toBe(false);
  });
  it('„lädt“ und „kein Recht“ zeigen nichts', () => {
    for (const stand of ['laedt', 'kein_recht'] as const) {
      expect(hallAnzeige(eingabe({ server: { stand, felder: {}, antwort: null }, lautsprecherBekannt: true })).statusUnbekannt).toBe(false);
    }
  });
});

describe('@HT-035 Handy ohne Netz', () => {
  const antwort = (leads: { field: number; ageMs: number }[]): HallStatusAntwort => ({
    sicht: 'voll', serverNow: T0, closed: false, speakers: [], leads,
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
  });
  it('Lebenszeichen der Leitung älter als 10 s auf einem Feld mit Lautsprecher → „Feld 1: Handy ohne Netz“', () => {
    const a = hallAnzeige(eingabe({ server: server({ 1: bereit }, { antwort: antwort([{ field: 1, ageMs: 12_000 }]) }) }));
    expect(a.handyOhneNetz).toEqual([1]);
  });
  it('Gegenbeispiele: frisches Lebenszeichen, oder Feld ohne Lautsprecher → kein Hinweis', () => {
    expect(hallAnzeige(eingabe({ server: server({ 1: bereit }, { antwort: antwort([{ field: 1, ageMs: 3000 }]) }) })).handyOhneNetz).toEqual([]);
    expect(hallAnzeige(eingabe({ server: server({ 1: bereit }, { antwort: antwort([{ field: 2, ageMs: 40_000 }]) }) })).handyOhneNetz).toEqual([]);
  });
});
