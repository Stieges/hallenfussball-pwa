/**
 * @RZ-033 @RZ-034 @RZ-035 Überstandene Netzstörungen der Zuschauer-Seite: Art (kurz/lang) und genau eine Meldung je Störung
 * (docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md; Beispielzeilen und Wortlaut aus dem Gherkin).
 * Seit 2026-11-17: lang = mindestens zwei gescheiterte Abrufe in Folge, sonst kurz; die Dauer spielt keine Rolle.
 */
import { describe, expect, it } from 'vitest';
import { classifyOutage, noteOutageAnswered, noteOutageFailure, noteOutageRecovery, NO_OUTAGE, type OutageState } from '../publicOutage';
import type { ViewCountKind } from '../publicViewCount';

const fehlschlaege = (n: number): OutageState => {
  let zustand: OutageState = NO_OUTAGE;
  for (let i = 0; i < n; i += 1) { zustand = noteOutageFailure(zustand); }
  return zustand;
};

describe('@RZ-033 Art der Störung nach der Zahl gescheiterter Abrufe in Folge', () => {
  it.each([
    ['genau ein Abruf scheitert', 1, 'stoerung_kurz'],
    ['zwei Abrufe hintereinander scheitern', 2, 'stoerung_lang'],
    ['vier Abrufe hintereinander (45 Sekunden)', 4, 'stoerung_lang'],
    ['fünf Abrufe hintereinander (45 Sekunden)', 5, 'stoerung_lang'],
  ] as const)('Beispiel „%s“ → %s', (_name, anzahl, art) => {
    expect(noteOutageRecovery(fehlschlaege(anzahl)).outage).toBe(art);
  });

  it('Grenze: ein Fehlschlag ist kurz, zwei sind lang (Gegenbeispiele auf beiden Seiten)', () => {
    expect(classifyOutage(1)).toBe('stoerung_kurz');
    expect(classifyOutage(2)).toBe('stoerung_lang');
    expect(classifyOutage(3)).toBe('stoerung_lang');
  });

  it('die Meldeart gehört zu den Arten der Zählmeldung', () => {
    const arten: ViewCountKind[] = [classifyOutage(1), classifyOutage(2), 'aufruf', 'lebenszeichen'];
    expect(arten).toEqual(['stoerung_kurz', 'stoerung_lang', 'aufruf', 'lebenszeichen']);
  });
});

describe('@RZ-033 Genau eine Meldung je Störung beim nächsten gelungenen Abruf', () => {
  it('Fehlschlag, Erfolg → eine kurze Störung; danach ist die Störung weg und der Zähler steht auf null', () => {
    const erst = noteOutageRecovery(noteOutageFailure(NO_OUTAGE));
    expect(erst.outage).toBe('stoerung_kurz');
    expect(erst.state).toEqual({ failures: 0 });
    expect(noteOutageRecovery(erst.state).outage).toBeNull();
  });

  it('mehrere Fehlschläge in Folge sind EINE Störung, lang, und werden einmal gemeldet', () => {
    const erfolg = noteOutageRecovery(fehlschlaege(4));
    expect(erfolg.outage).toBe('stoerung_lang');
    expect(noteOutageRecovery(erfolg.state).outage).toBeNull();
  });

  it('Gegenbeispiel: Fehlschlag, Erfolg, Fehlschlag, Erfolg → zwei kurze Störungen, keine lange (der Zähler wird beim Erfolg zurückgesetzt)', () => {
    const a = noteOutageRecovery(noteOutageFailure(NO_OUTAGE));
    const b = noteOutageRecovery(noteOutageFailure(a.state));
    expect([a.outage, b.outage]).toEqual(['stoerung_kurz', 'stoerung_kurz']);
  });

  it('zwei getrennte Störungen sind zwei Meldungen, jede mit eigener Zahl', () => {
    const a = noteOutageRecovery(fehlschlaege(1));
    const b = noteOutageRecovery(noteOutageFailure(noteOutageFailure(a.state)));
    expect([a.outage, b.outage]).toEqual(['stoerung_kurz', 'stoerung_lang']);
  });

  it('erstes Laden scheitert (kein Erfolg davor): ein Fehlschlag kurz, zwei lang', () => {
    expect(noteOutageRecovery(fehlschlaege(1)).outage).toBe('stoerung_kurz');
    expect(noteOutageRecovery(fehlschlaege(2)).outage).toBe('stoerung_lang');
  });

  it('„Turnier nicht gefunden“ beendet die Folge ohne Meldung und setzt den Zähler zurück', () => {
    const beantwortet = noteOutageAnswered();
    expect(beantwortet).toEqual({ failures: 0 });
    expect(noteOutageRecovery(beantwortet).outage).toBeNull();
    // Gegenbeispiel: ein Fehlschlag danach ist wieder nur kurz
    expect(noteOutageRecovery(noteOutageFailure(beantwortet)).outage).toBe('stoerung_kurz');
  });
});

describe('@RZ-034 Ohne gescheiterten Abruf wird keine Störung gemeldet', () => {
  it('Erfolge ohne vorherigen Fehlschlag melden nichts, auch nicht viele hintereinander', () => {
    let zustand: OutageState = NO_OUTAGE;
    for (let i = 0; i < 5; i += 1) {
      const ergebnis = noteOutageRecovery(zustand);
      expect(ergebnis.outage).toBeNull();
      zustand = ergebnis.state;
    }
    expect(zustand).toEqual({ failures: 0 });
  });
});
