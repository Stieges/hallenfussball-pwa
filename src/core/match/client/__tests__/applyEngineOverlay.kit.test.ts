/**
 * Befund C-KIT-OVERLAY-UEBERSCHREIBT-VOR-ANPFIFF (Leibchen 2b): die lokale Überlagerung überschreibt die Wahl der Leibchen nicht mehr.
 * Szenarien: @SL-216/@SL-220 (bestätigte Wahl übersteht Neuladen und Übernahme), @SL-150/@SL-226 (Nachtrag im laufenden Spiel bleibt sichtbar),
 * @SL-210/@SL-214 (Anpfiff ohne Tipp, Anpfiff rückgängig), @SL-149 (ausdrücklich Keine Leibchen), @ZM-200.
 * Testwerte aus dem Gherkin (docs/anforderungen/2026-10-02_spiel-leiten.md), nicht aus dem Code.
 */
import { describe, expect, it } from 'vitest';
import { reduceMatch } from '../../index';
import type { EngineEvent, MatchContext } from '../../types';
import { applyEngineOverlay, engineOverlayFields, type OverlayableMatch } from '../applyEngineOverlay';
import type { MatchEngineView } from '../MatchEngine';
import { hfEvent, hfRules, T0 } from './overtimeFixtures';

const CTX: MatchContext = { matchId: 'spiel-2', teamAId: 'waging', teamBId: 'petting' };
const BLAU = '#1565C0';
const GELB = '#FFCC00';
const ORANGE = '#FF9800';

function anpfiff(kit: unknown, seq = 1): EngineEvent {
  return hfEvent('MATCH_START', T0, seq, null, { payload: { rules: hfRules('overtime-then-shootout'), ...(kit === undefined ? {} : { kit }) } });
}

function ansicht(log: EngineEvent[], confirmedCount: number): MatchEngineView {
  return { result: { state: reduceMatch(log, CTX).state, localRejected: [], needsFullReload: false }, log, confirmedCount };
}

function ueberlagere(match: OverlayableMatch, log: EngineEvent[], confirmedCount = 0): OverlayableMatch {
  const fields = engineOverlayFields(ansicht(log, confirmedCount), CTX);
  return applyEngineOverlay({ matches: [match] }, new Map([[match.id, fields]])).matches[0];
}

const bestaetigt: OverlayableMatch = { id: 'spiel-2', matchStatus: 'scheduled', kitDecision: 'bib', kit: { a: GELB, bibSide: 'a' } };

describe('@SL-216 @SL-220 eine vor dem Anpfiff bestätigte Wahl geht lokal nicht verloren', () => {
  it('@SL-216 die Überlagerung ohne Anpfiff-Ereignis lässt kit und kitDecision der Zeile stehen', () => {
    // Das Spiel hat eine lokale Kopie (Ereignis, das nicht der Anpfiff ist) – früher setzte die Überlagerung kit auf „leer“.
    const ereignis = hfEvent('PAUSE', T0, 1, null, { payload: {} });
    const ergebnis = ueberlagere(bestaetigt, [ereignis]);
    expect(ergebnis.kit).toEqual({ a: GELB, bibSide: 'a' });
    expect(ergebnis.kitDecision).toBe('bib');
  });

  it('@SL-216 Gegenbeispiel: eine zweite Überlagerung mit demselben Ergebnis lässt die Turnierkopie dieselbe Referenz (kein Flackern)', () => {
    const ereignis = hfEvent('PAUSE', T0, 1, null, { payload: {} });
    const fields = engineOverlayFields(ansicht([anpfiff({ a: BLAU, b: BLAU })], 0), CTX);
    const einmal = applyEngineOverlay({ matches: [{ ...bestaetigt }] }, new Map([[bestaetigt.id, fields]]));
    const zweimal = applyEngineOverlay(einmal, new Map([[bestaetigt.id, fields]]));
    expect(zweimal).toBe(einmal);
    expect(ereignis.type).toBe('PAUSE');
  });

  it('@SL-210 Anpfiff ohne Tipp (kit ohne bibSide), noch nicht beim Server: keine Leibchen, kitDecision bleibt offen', () => {
    const offen: OverlayableMatch = { id: 'spiel-2', matchStatus: 'scheduled' };
    const ergebnis = ueberlagere(offen, [anpfiff({ a: BLAU, b: BLAU })]);
    expect(ergebnis.kit).toEqual({ a: BLAU, b: BLAU });
    expect(ergebnis.kit?.bibSide).toBeUndefined();
    expect(ergebnis.kitDecision).toBeUndefined();
  });

  it('@SL-202 Anpfiff nach der Bestätigung (kit nennt die Seite, noch nicht beim Server): die Weste bleibt, das Trikot der anderen Seite kommt dazu', () => {
    const ergebnis = ueberlagere(bestaetigt, [anpfiff({ a: GELB, b: BLAU, bibSide: 'a' })]);
    expect(ergebnis.kit).toEqual({ a: GELB, b: BLAU, bibSide: 'a' });
    expect(ergebnis.kitDecision).toBe('bib');
  });

  it('@SL-216 Behalte-Regel: bestätigte Wahl, der Anpfiff nennt nichts zum Leibchen – Seite und Leibchenfarbe bleiben, die andere Seite bekommt das Trikot', () => {
    const ergebnis = ueberlagere(bestaetigt, [anpfiff({ a: BLAU, b: BLAU })]);
    expect(ergebnis.kit).toEqual({ a: GELB, b: BLAU, bibSide: 'a' });
    expect(ergebnis.kitDecision).toBe('bib');
  });

  it('@SL-149 ausdrücklich Keine Leibchen im Anpfiff (bibSide null), noch nicht beim Server: die bestätigte Wahl ist aufgegeben', () => {
    const ergebnis = ueberlagere(bestaetigt, [anpfiff({ a: BLAU, b: BLAU, bibSide: null })]);
    expect(ergebnis.kit).toEqual({ a: BLAU, b: BLAU });
    expect(ergebnis.kitDecision).toBe('none');
  });
});

describe('@SL-150 @SL-226 ein Nachtrag im laufenden Spiel bleibt im Cockpit sichtbar', () => {
  const nachtrag: OverlayableMatch = { id: 'spiel-2', matchStatus: 'running', kitDecision: 'bib', kit: { a: BLAU, b: ORANGE, bibSide: 'b' } };

  it('@SL-150 Anpfiff beim Server bestätigt, die Zeile trägt den Nachtrag (Orange für Gast): die Überlagerung setzt nicht den Stand vom Anpfiff zurück', () => {
    const ergebnis = ueberlagere(nachtrag, [anpfiff({ a: BLAU, b: BLAU })], 1);
    expect(ergebnis.kit).toEqual({ a: BLAU, b: ORANGE, bibSide: 'b' });
    expect(ergebnis.kitDecision).toBe('bib');
  });

  it('@SL-150 Nachtrag „Entfernen“ (Zeile: none, Trikotfarben): bleibt Keine Leibchen, auch wenn der Anpfiff einmal eine Seite nannte', () => {
    const entfernt: OverlayableMatch = { id: 'spiel-2', matchStatus: 'running', kitDecision: 'none', kit: { a: BLAU, b: BLAU } };
    const ergebnis = ueberlagere(entfernt, [anpfiff({ a: GELB, b: BLAU, bibSide: 'a' })], 1);
    expect(ergebnis.kit).toEqual({ a: BLAU, b: BLAU });
    expect(ergebnis.kitDecision).toBe('none');
  });

  it('@SL-229 Gegenbeispiel: ist der Anpfiff nur lokal (noch nicht bestätigt), gilt er – ohne Netz zeigt das Cockpit die Weste des Anpfiffs', () => {
    const ohneZeile: OverlayableMatch = { id: 'spiel-2', matchStatus: 'scheduled' };
    const ergebnis = ueberlagere(ohneZeile, [anpfiff({ a: GELB, b: BLAU, bibSide: 'a' })], 0);
    expect(ergebnis.kit).toEqual({ a: GELB, b: BLAU, bibSide: 'a' });
  });

  it('@SL-150 die Zeile hat den Anpfiff noch nicht (bestätigt, aber noch nicht synchron): fehlende Farben kommen aus dem Anpfiff, die Wahl nicht verloren', () => {
    const vorAnpfiff: OverlayableMatch = { id: 'spiel-2', matchStatus: 'scheduled', kitDecision: 'bib', kit: { b: ORANGE, bibSide: 'b' } };
    const ergebnis = ueberlagere(vorAnpfiff, [anpfiff({ a: BLAU, b: BLAU })], 1);
    expect(ergebnis.kit).toEqual({ a: BLAU, b: ORANGE, bibSide: 'b' });
  });
});

describe('@SL-214 Anpfiff rückgängig zeigt den Stand davor', () => {
  it('@SL-214 Karte bestätigt, Anpfiff, Rückgängig: ohne Anpfiff im Log bleibt die Zeile bestätigt', () => {
    const ergebnis = ueberlagere(bestaetigt, [hfEvent('PAUSE', T0, 1, null, { payload: {} })]);
    expect(ergebnis.kitDecision).toBe('bib');
  });
});
