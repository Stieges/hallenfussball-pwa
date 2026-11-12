/**
 * Vorschlag der Leibchen-Karte (@SL-207, @SL-217, @SL-151, @SL-206, @SL-138). Testwerte aus dem Gherkin (docs/anforderungen/2026-10-02_spiel-leiten.md).
 */
import { describe, expect, it } from 'vitest';
import { karteNoetig, kitProposal } from '../kitProposal';

const BLAU = '#1565C0';
const NAVY = '#0D1B4C';
const GELB = '#FFCC00';
const ORANGE = '#FF6600';
const ROT = '#C62828';
const WEISS = '#FFFFFF';
const FELDER = (a: string | undefined, b: string | undefined) => ({ ...(a === undefined ? {} : { a }), ...(b === undefined ? {} : { b }) });

describe('@SL-207 die Karte schlägt Seite und Farbe nach den Einstellungen des Turniers vor', () => {
  it.each([
    { hallen: [GELB, ORANGE], regel: 'home', a: BLAU, b: BLAU, erwartet: { kind: 'vorschlag', seite: 'a', farbe: GELB }, zeile: 'Gelb, Orange · Heim · Blau/Blau' },
    { hallen: [GELB, ORANGE], regel: 'away', a: BLAU, b: BLAU, erwartet: { kind: 'vorschlag', seite: 'b', farbe: GELB }, zeile: 'Gelb, Orange · Gast · Blau/Blau' },
    { hallen: [ORANGE, GELB], regel: 'home', a: BLAU, b: NAVY, erwartet: { kind: 'vorschlag', seite: 'a', farbe: ORANGE }, zeile: 'Orange, Gelb · Heim · Blau/Navy: die Reihenfolge bestimmt die erste Farbe' },
    { hallen: [GELB, ORANGE], regel: 'home', a: GELB, b: GELB, erwartet: { kind: 'vorschlag', seite: 'a', farbe: ORANGE }, zeile: 'Gelb, Orange · Heim · Gelb/Gelb: Waging spielt selbst in Gelb' },
    { hallen: [GELB], regel: 'home', a: GELB, b: GELB, erwartet: { kind: 'keinPassendes', seite: 'a' }, zeile: 'nur Gelb · Gelb/Gelb: kein passendes Leibchen, Seite nach der Regel' },
    { hallen: [], regel: 'home', a: BLAU, b: BLAU, erwartet: { kind: 'vorschlag', seite: 'a', farbe: GELB }, zeile: 'keine eingetragen: Gelb ist vorgeschlagen' },
  ] as const)('@SL-207 $zeile', ({ hallen, regel, a, b, erwartet }) => {
    expect(kitProposal(FELDER(a, b), hallen, regel)).toEqual(erwartet);
  });

  it('@SL-207 spielt die ziehende Seite selbst in der ersten Hallenfarbe (Gelb), auch wenn der Gegner Blau trägt (Leibchen über „Leibchen festlegen“): die zweite Farbe', () => {
    expect(kitProposal(FELDER(GELB, BLAU), [GELB, ORANGE], 'home')).toEqual({ kind: 'vorschlag', seite: 'a', farbe: ORANGE });
  });

  it('@SL-207 Gegenbeispiel: die Regel „Gast“ ändert nichts an der Farbe, nur an der Seite', () => {
    expect(kitProposal(FELDER(BLAU, BLAU), [GELB, ORANGE], 'away')).toMatchObject({ farbe: GELB });
  });
});

describe('@SL-217 passt für die ziehende Seite keine Farbe, schlägt die Karte die andere Seite vor', () => {
  const SCHWARZ = '#000000';
  const BRAUN = '#663300';
  const DUNKELROT = '#DC0000';

  it('@SL-217 für Heim (Schwarz) ist Rot dem Trikot des Gastes (Braun) zu ähnlich, für Gast passt Rot: „Gast zieht Rot“, Tom kann auf Heim zurückstellen', () => {
    expect(kitProposal(FELDER(SCHWARZ, BRAUN), [DUNKELROT], 'home')).toEqual({ kind: 'vorschlag', seite: 'b', farbe: DUNKELROT });
  });

  it('@SL-217 Gegenbeispiel: die Regel „Gast“ bleibt bei Gast, wenn dort eine Farbe passt', () => {
    expect(kitProposal(FELDER(SCHWARZ, BRAUN), [DUNKELROT], 'away')).toEqual({ kind: 'vorschlag', seite: 'b', farbe: DUNKELROT });
  });

  it('@SL-217 für keine Seite passt eine Farbe: „Kein passendes Leibchen vorhanden“, die Seite nach der Turnierregel ist vorgewählt', () => {
    expect(kitProposal(FELDER(GELB, GELB), [GELB], 'home')).toEqual({ kind: 'keinPassendes', seite: 'a' });
    expect(kitProposal(FELDER(GELB, GELB), [GELB], 'away')).toEqual({ kind: 'keinPassendes', seite: 'b' });
  });
});

describe('@SL-206 @SL-138 wann die Karte erscheint', () => {
  it('@SL-206 beide Blau: Karte; @SL-206 Aber Rot und Weiß: keine Karte', () => {
    expect(karteNoetig(FELDER(BLAU, BLAU))).toBe(true);
    expect(karteNoetig(FELDER(ROT, WEISS))).toBe(false);
  });

  it('@SL-139 Blau/Navy (26,8) mit Karte, Weiß/Gelb (29,2) mit Karte', () => {
    expect(karteNoetig(FELDER(BLAU, NAVY))).toBe(true);
    expect(karteNoetig(FELDER(WEISS, '#FFEB3B'))).toBe(true);
  });

  it('@SL-138 Gegenbeispiel: hat ein Team keine Trikotfarbe, ist Farbgleichheit nicht festzustellen: keine Karte', () => {
    expect(karteNoetig(FELDER(undefined, BLAU))).toBe(false);
    expect(karteNoetig(FELDER(undefined, undefined))).toBe(false);
  });
});
