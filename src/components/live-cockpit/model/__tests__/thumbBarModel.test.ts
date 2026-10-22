/**
 * Daumenleiste je Zustand (Cockpit-Spec § 6; Plan PR 3, Aufgabe 3.6, Tabelle `leisteFuer`).
 * Die Tabelle des Plans wird 1 : 1 gepinnt, je Layout. Entscheidung A2: unter 1024 px ist „Abpfiff halten“ der fünfte Platz.
 */
import { describe, it, expect } from 'vitest';
import { leisteFuer, type LeisteKontext, type LeistenAktion } from '../thumbBarModel';
import type { CockpitPhase, CockpitZustand } from '../cockpitPhase';

const phase = (zustand: CockpitZustand): CockpitPhase => ({ zustand, abschnittArt: 'regulaer', abschnitt: 1, abschnitte: 2, letzterAbschnitt: false });
const kontext = (layout: LeisteKontext['layout'], extra: Partial<LeisteKontext> = {}): LeisteKontext => ({
  layout, istLeitung: true, fortsetzenMoeglich: false, korrigierenMoeglich: false, ...extra,
});

const TABELLE: Array<[string, CockpitZustand, LeistenAktion[], LeistenAktion[]]> = [
  ['@SL-001 @SL-050 vorAnpfiff', 'vorAnpfiff', ['anpfiff', 'mehr'], ['anpfiff', 'mehr']],
  ['laeuft (auch Verlängerung)', 'laeuft', ['rueckgaengig', 'pause', 'ereignisse', 'abpfiffHalten', 'mehr'], ['pause', 'abpfiffHalten', 'rueckgaengig', 'mehr']],
  ['pausiert (auch Verlängerung)', 'pausiert', ['rueckgaengig', 'weiter', 'ereignisse', 'abpfiffHalten', 'mehr'], ['weiter', 'abpfiffHalten', 'rueckgaengig', 'mehr']],
  ['@SL-006 halbzeitpause', 'halbzeitpause', ['rueckgaengig', 'wiederanpfiff', 'ereignisse', 'mehr'], ['wiederanpfiff', 'rueckgaengig', 'mehr']],
  ['pauseVorVerlaengerung', 'pauseVorVerlaengerung', ['rueckgaengig', 'anpfiffVerlaengerung', 'ereignisse', 'mehr'], ['anpfiffVerlaengerung', 'rueckgaengig', 'mehr']],
  ['@SL-053 entscheidung', 'entscheidung', ['entscheidung', 'mehr'], ['entscheidung', 'mehr']],
  ['@SL-110 strafstoss', 'strafstoss', ['rueckgaengig', 'ereignisse', 'mehr'], ['rueckgaengig', 'mehr']],
  ['@SL-045 @SL-113 @SL-061 abgepfiffen (ohne Fortsetzen/Korrigieren; unter 1024 px bleibt die Liste per Knopf erreichbar)', 'abgepfiffen', ['weiterNaechstes', 'ereignisse', 'mehr'], ['weiterNaechstes', 'mehr']],
  ['wartetAufHerkunft (Anpfiff gesperrt, 2.5)', 'wartetAufHerkunft', ['mehr'], ['mehr']],
  ['keinSpiel', 'keinSpiel', [], []],
];

describe('Daumenleiste je Zustand', () => {
  it.each(TABELLE)('%s → daumen', (_n, zustand, daumen) => {
    expect(leisteFuer(phase(zustand), kontext('daumen')).aktionen).toEqual(daumen);
  });
  it.each(TABELLE)('%s → breit', (_n, zustand, _daumen, breit) => {
    expect(leisteFuer(phase(zustand), kontext('breit')).aktionen).toEqual(breit);
  });

  it('das Layout im Modell ist das übergebene (eine Quelle: data-layout der Hülle)', () => {
    expect(leisteFuer(phase('laeuft'), kontext('breit')).layout).toBe('breit');
    expect(leisteFuer(phase('laeuft'), kontext('daumen')).layout).toBe('daumen');
  });

  it('@SL-157 laeuft daumen: fünf Plätze, abpfiffHalten an vierter Stelle (Entscheidung A2)', () => {
    const aktionen = leisteFuer(phase('laeuft'), kontext('daumen')).aktionen;
    expect(aktionen).toHaveLength(5);
    expect(aktionen.indexOf('abpfiffHalten')).toBe(3);
  });

  it('@SL-157 pausiert daumen: ebenfalls fünf Plätze mit abpfiffHalten an vierter Stelle', () => {
    const aktionen = leisteFuer(phase('pausiert'), kontext('daumen')).aktionen;
    expect(aktionen).toHaveLength(5);
    expect(aktionen.indexOf('abpfiffHalten')).toBe(3);
  });

  it.each(['daumen', 'breit'] as const)('Gegenbeispiel: halbzeitpause (%s) enthält kein abpfiffHalten', (layout) => {
    expect(leisteFuer(phase('halbzeitpause'), kontext(layout)).aktionen).not.toContain('abpfiffHalten');
  });

  it.each(['daumen', 'breit'] as const)('Gegenbeispiel: kein Zustand außer laeuft/pausiert hat abpfiffHalten (%s)', (layout) => {
    const alle: CockpitZustand[] = ['vorAnpfiff', 'halbzeitpause', 'pauseVorVerlaengerung', 'entscheidung', 'strafstoss', 'abgepfiffen', 'wartetAufHerkunft', 'keinSpiel'];
    for (const z of alle) { expect(leisteFuer(phase(z), kontext(layout)).aktionen, z).not.toContain('abpfiffHalten'); }
  });

  describe('abgepfiffen: Fortsetzen und Korrigieren nur, wenn möglich (Reihenfolge je Layout)', () => {
    it('daumen: fortsetzen vor weiterNaechstes, korrigieren danach', () => {
      const k = kontext('daumen', { fortsetzenMoeglich: true, korrigierenMoeglich: true });
      expect(leisteFuer(phase('abgepfiffen'), k).aktionen).toEqual(['fortsetzen', 'weiterNaechstes', 'ereignisse', 'korrigieren', 'mehr']);
    });
    it('breit: weiterNaechstes zuerst, dann fortsetzen und korrigieren', () => {
      const k = kontext('breit', { fortsetzenMoeglich: true, korrigierenMoeglich: true });
      expect(leisteFuer(phase('abgepfiffen'), k).aktionen).toEqual(['weiterNaechstes', 'fortsetzen', 'korrigieren', 'mehr']);
    });
    it('@SL-061 @SL-113 Gegenbeispiel: abgepfiffen breit hat keinen Platz „ereignisse“ (die Liste steht daneben), daumen höchstens fünf Plätze', () => {
      const voll = { fortsetzenMoeglich: true, korrigierenMoeglich: true };
      expect(leisteFuer(phase('abgepfiffen'), kontext('breit', voll)).aktionen).not.toContain('ereignisse');
      expect(leisteFuer(phase('abgepfiffen'), kontext('daumen', voll)).aktionen).toHaveLength(5);
    });
    it('Gegenbeispiel: Leitung ohne korrigierenMoeglich enthält kein korrigieren (beide Layouts)', () => {
      for (const layout of ['daumen', 'breit'] as const) {
        const k = kontext(layout, { fortsetzenMoeglich: true, korrigierenMoeglich: false });
        expect(leisteFuer(phase('abgepfiffen'), k).aktionen, layout).not.toContain('korrigieren');
      }
    });
    it('Gegenbeispiel: korrigieren erscheint nur für die Leitung, auch wenn die Korrektur möglich ist', () => {
      const k = kontext('daumen', { istLeitung: false, korrigierenMoeglich: true });
      expect(leisteFuer(phase('abgepfiffen'), k).aktionen).not.toContain('korrigieren');
    });
    it('Gegenbeispiel: ohne fortsetzenMoeglich kein fortsetzen', () => {
      const k = kontext('breit', { fortsetzenMoeglich: false, korrigierenMoeglich: true });
      expect(leisteFuer(phase('abgepfiffen'), k).aktionen).not.toContain('fortsetzen');
    });
  });

  describe('@SL-045 @HE-043 Hinweis „Spiel ist beendet“ nur für den Helfer nach dem Abpfiff', () => {
    it('abgepfiffen ohne Leitung → hinweis beendetHelfer', () => {
      expect(leisteFuer(phase('abgepfiffen'), kontext('daumen', { istLeitung: false })).hinweis).toBe('beendetHelfer');
    });
    it('Gegenbeispiel: abgepfiffen mit Leitung → kein Hinweis', () => {
      expect(leisteFuer(phase('abgepfiffen'), kontext('daumen', { istLeitung: true })).hinweis).toBeNull();
    });
    it('Gegenbeispiel: ohne Leitung im laufenden Spiel → kein Hinweis', () => {
      expect(leisteFuer(phase('laeuft'), kontext('daumen', { istLeitung: false })).hinweis).toBeNull();
    });
  });
});
