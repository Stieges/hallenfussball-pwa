/**
 * Grundauswahl der Leibchenfarben (@SL-219, @SL-199, @W3-029), Zustände der Wahl (@SL-220), Warnung „wie Trikot“ (@SL-231),
 * Vorschau-Kästen mit Fallback-Muster (@ZM-203). Testwerte aus dem Gherkin (docs/anforderungen/2026-10-02_spiel-leiten.md), nicht aus dem Code.
 */
import { describe, expect, it } from 'vitest';
import { kitChoiceState, parseKitDecision, KIT_DECISIONS } from '../kit';
import { LEIBCHEN_FARBEN, leibchenAuswahl, leibchenFarbName, leibchenFarbenMit } from '../kitChoice';
import { bibColorPresets, palette, wizardJerseyPresets } from '../../../design-tokens/colors/palette';

const J = palette.jersey;
const NAMEN = (farben: readonly string[]): Array<string | null> => farben.map((f) => leibchenFarbName(f));

describe('@SL-219 Grundauswahl aus 8 Farben, Hallenfarben zuerst, nichts doppelt', () => {
  it('@SL-219 die Grundauswahl: Gelb, Orange, Neongrün, Pink, Rot, Blau, Weiß, Schwarz – in dieser Reihenfolge, jede mit ihrem Namen', () => {
    expect(NAMEN(LEIBCHEN_FARBEN)).toEqual(['gelb', 'orange', 'neongruen', 'pink', 'rot', 'blau', 'weiss', 'schwarz']);
    expect(LEIBCHEN_FARBEN).toHaveLength(8);
  });

  it('@SL-219 Zeile „Gelb und Orange“: zuerst Gelb und Orange, darunter Neongrün, Pink, Rot, Blau, Weiß, Schwarz', () => {
    const auswahl = leibchenAuswahl([J.yellow, J.orange]);
    expect(NAMEN(auswahl.alle)).toEqual(['gelb', 'orange', 'neongruen', 'pink', 'rot', 'blau', 'weiss', 'schwarz']);
    expect(NAMEN(auswahl.halle)).toEqual(['gelb', 'orange']);
  });

  it('@SL-219 Zeile „Gelb und Grün“: zuerst Gelb und Grün, darunter Orange, Neongrün, Pink, Rot, Blau, Weiß, Schwarz (Grün steht nicht in der Grundauswahl)', () => {
    const auswahl = leibchenAuswahl([J.yellow, J.green]);
    expect(NAMEN(auswahl.alle)).toEqual(['gelb', 'gruen', 'orange', 'neongruen', 'pink', 'rot', 'blau', 'weiss', 'schwarz']);
    expect(LEIBCHEN_FARBEN).not.toContain(J.green);
  });

  it('@SL-219 Zeile „keine eingetragen“: gleich die 8 Farben der Grundauswahl', () => {
    const auswahl = leibchenAuswahl([]);
    expect(auswahl.halle).toEqual([]);
    expect(NAMEN(auswahl.alle)).toEqual(['gelb', 'orange', 'neongruen', 'pink', 'rot', 'blau', 'weiss', 'schwarz']);
  });

  it('@SL-219 nichts doppelt: Kleinschreibung und Kurzform derselben Farbe zählen als eine', () => {
    const auswahl = leibchenAuswahl(['#ffcc00', '#FFCC00', '#fc0']);
    expect(auswahl.halle).toEqual(['#FFCC00']);
    expect(auswahl.alle.filter((f) => f === '#FFCC00')).toHaveLength(1);
    expect(new Set(auswahl.alle).size).toBe(auswahl.alle.length);
  });

  it('@SL-219 Gegenbeispiel: eine ungültige Hallenfarbe ergibt keinen Eintrag (kein Müll in der Auswahl)', () => {
    expect(leibchenAuswahl(['rot', '']).halle).toEqual([]);
  });

  it('@SL-219 jede Farbe hat einen Namen als Wort (auch die Hallenfarben außerhalb der Grundauswahl); eine fremde Farbe keinen', () => {
    for (const farbe of Object.values(J)) {
      expect(leibchenFarbName(farbe)).not.toBeNull();
    }
    expect(leibchenFarbName('#123456')).toBeNull();
  });

  it('@W3-029 die Werte stammen aus der Trikot-Palette des Assistenten (derselbe Farbwähler), nur Neongrün kommt dazu', () => {
    const wizard = wizardJerseyPresets;
    for (const farbe of LEIBCHEN_FARBEN) {
      if (farbe !== J.neonGreen) { expect(wizard).toContain(farbe); }
    }
    expect(wizard).not.toContain(J.neonGreen);
  });

  it('@W3-029 die Auswahl der Leibchenfarben des Turniers enthält alle 8 Farben der Grundauswahl (auch Neongrün), der Trikot-Farbwähler bleibt ohne Neongrün', () => {
    for (const farbe of LEIBCHEN_FARBEN) { expect(bibColorPresets).toContain(farbe); }
    expect(bibColorPresets).toHaveLength(wizardJerseyPresets.length + 1);
  });

  it('@SL-199 leibchenFarbenMit: die Farbe des Turniers steht zuerst, ohne Doppel (alter Aufruf mit einer Farbe)', () => {
    const farben = leibchenFarbenMit(J.orange);
    expect(farben[0]).toBe(J.orange);
    expect(farben).toHaveLength(8);
  });
});

describe('@SL-220 drei Zustände der Wahl', () => {
  it('@SL-220 NULL = offen, none = Keine Leibchen, bib = bestätigt', () => {
    expect(kitChoiceState(undefined)).toBe('open');
    expect(kitChoiceState(null)).toBe('open');
    expect(kitChoiceState('none')).toBe('none');
    expect(kitChoiceState('bib')).toBe('confirmed');
  });

  it('@SL-220 Gegenbeispiel: „Keine Leibchen“ ist nicht „offen“ (sonst käme nach dem Neuladen wieder die Karte)', () => {
    expect(kitChoiceState('none')).not.toBe(kitChoiceState(undefined));
  });

  it('@SL-220 nur bib und none sind gespeicherte Werte; alles andere gilt als nichts getippt', () => {
    expect(KIT_DECISIONS).toEqual(['bib', 'none']);
    expect(parseKitDecision('bib')).toBe('bib');
    expect(parseKitDecision('none')).toBe('none');
    for (const roh of ['BIB', 'open', '', null, undefined, 1]) {
      expect(parseKitDecision(roh)).toBeUndefined();
    }
  });
});

