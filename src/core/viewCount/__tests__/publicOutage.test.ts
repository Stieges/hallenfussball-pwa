/**
 * @RZ-033 @RZ-034 @RZ-035 Überstandene Netzstörungen der Zuschauer-Seite: Art (kurz/lang) und genau eine Meldung je Störung
 * (docs/anforderungen/2026-09-26_reichweite-zuschauersicht.md; Beispielzeilen und Wortlaut aus dem Gherkin).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyOutage, monotonicNowMs, noteOutageAnswered, noteOutageAttempt, noteOutageFailure, noteOutageRecovery, NO_OUTAGE, type OutageState,
} from '../publicOutage';
import type { ViewCountKind } from '../publicViewCount';

/** Frist des Hinweises „keine Verbindung“ (@ZM-032); die Gleichheit mit der Konstante der Oberfläche prüft der Hook-Test. */
const LANG_AB = 20_000;

describe('@RZ-033 Art der Störung nach der Dauer ohne gelungenen Abruf', () => {
  it.each([
    ['10 Sekunden', 10_000, 'stoerung_kurz'],
    ['45 Sekunden', 45_000, 'stoerung_lang'],
  ] as const)('Beispiel %s → %s', (_name, dauer, art) => {
    expect(classifyOutage(dauer, LANG_AB)).toBe(art);
  });

  it('Grenze: 19,999 Sekunden sind kurz, genau 20 Sekunden sind lang (Gegenbeispiele auf beiden Seiten)', () => {
    expect(classifyOutage(LANG_AB - 1, LANG_AB)).toBe('stoerung_kurz');
    expect(classifyOutage(LANG_AB, LANG_AB)).toBe('stoerung_lang');
    expect(classifyOutage(LANG_AB + 1, LANG_AB)).toBe('stoerung_lang');
  });

  it('eine negative Dauer (Uhr zurückgestellt) ist eine kurze Störung, nie eine lange', () => {
    expect(classifyOutage(-5_000, LANG_AB)).toBe('stoerung_kurz');
    expect(classifyOutage(-1e12, LANG_AB)).toBe('stoerung_kurz');
  });

  it('die Meldeart gehört zu den Arten der Zählmeldung', () => {
    const arten: ViewCountKind[] = [classifyOutage(1, LANG_AB), classifyOutage(LANG_AB, LANG_AB), 'aufruf', 'lebenszeichen'];
    expect(arten).toEqual(['stoerung_kurz', 'stoerung_lang', 'aufruf', 'lebenszeichen']);
  });
});

/** Ein gelungener Abruf um `t` (Bezug der Dauer), ohne dass eine Störung offen war */
const erfolgBei = (t: number): OutageState => noteOutageRecovery(NO_OUTAGE, t, LANG_AB).state;

describe('@RZ-033 Die Dauer zählt ab dem letzten gelungenen Abruf und wird beim nächsten gelungenen genau einmal gemeldet', () => {
  it('Erfolg um 1000, Fehlschlag, Erfolg um 11000 (10 s) → eine kurze Störung; danach ist die Störung weg', () => {
    const offen = noteOutageFailure(erfolgBei(1_000), 1_500);
    const erst = noteOutageRecovery(offen, 11_000, LANG_AB);
    expect(erst.outage).toBe('stoerung_kurz');
    expect(erst.state).toEqual({ anchorMs: 11_000, failing: false });
    expect(noteOutageRecovery(erst.state, 12_000, LANG_AB).outage).toBeNull();
  });

  it('Erfolg um 1000, Erfolg um 46000 nach Fehlschlägen (45 s) → eine lange Störung', () => {
    expect(noteOutageRecovery(noteOutageFailure(erfolgBei(1_000), 2_000), 46_000, LANG_AB).outage).toBe('stoerung_lang');
  });

  it('der Fehlschlag wird erst spät erkannt (hängender Abruf, Zeitüberschreitung): Erfolg 0, erkannt bei 28 s, Erfolg bei 30 s → lang, nicht kurz', () => {
    const offen = noteOutageFailure(erfolgBei(0), 28_000);
    expect(noteOutageRecovery(offen, 30_000, LANG_AB).outage).toBe('stoerung_lang');
  });

  it('Grenze ab dem letzten Erfolg, unabhängig davon, wann der Fehlschlag erkannt wird', () => {
    const offen = noteOutageFailure(erfolgBei(0), 18_000);
    expect(noteOutageRecovery(offen, LANG_AB - 1, LANG_AB).outage).toBe('stoerung_kurz');
    expect(noteOutageRecovery(offen, LANG_AB, LANG_AB).outage).toBe('stoerung_lang');
  });

  it('mehrere Fehlschläge in Folge sind EINE Störung mit dem Bezug des letzten Erfolgs', () => {
    let zustand: OutageState = erfolgBei(1_000);
    for (const t of [6_000, 11_000, 16_000, 21_000]) { zustand = noteOutageFailure(zustand, t); }
    expect(zustand.anchorMs).toBe(1_000);
    const erfolg = noteOutageRecovery(zustand, 26_000, LANG_AB);
    expect(erfolg.outage).toBe('stoerung_lang');
    expect(noteOutageRecovery(erfolg.state, 27_000, LANG_AB).outage).toBeNull();
  });

  it('zwei getrennte Störungen sind zwei Meldungen, jede mit eigener Dauer', () => {
    const a = noteOutageRecovery(noteOutageFailure(erfolgBei(0), 1_000), 5_000, LANG_AB);
    const b = noteOutageRecovery(noteOutageFailure(a.state, 100_000), 160_000, LANG_AB);
    expect([a.outage, b.outage]).toEqual(['stoerung_kurz', 'stoerung_lang']);
  });

  it('erstes Laden scheitert (kein Erfolg davor): der Bezug ist der Beginn des ersten Abrufs, spätere Abrufe ändern ihn nicht', () => {
    let zustand = noteOutageAttempt(NO_OUTAGE, 1_000);
    zustand = noteOutageFailure(zustand, 9_000);
    zustand = noteOutageAttempt(zustand, 10_000);
    zustand = noteOutageFailure(zustand, 18_000);
    expect(noteOutageRecovery(zustand, 20_999, LANG_AB).outage).toBe('stoerung_kurz');
    expect(noteOutageRecovery(zustand, 21_000, LANG_AB).outage).toBe('stoerung_lang');
  });

  it('„Turnier nicht gefunden“ beendet die Folge ohne Meldung; der Bezug ist danach diese Antwort', () => {
    const offen = noteOutageFailure(erfolgBei(0), 5_000);
    const beantwortet = noteOutageAnswered(30_000);
    expect(beantwortet).toEqual({ anchorMs: 30_000, failing: false });
    expect(offen.failing).toBe(true);
    expect(noteOutageRecovery(beantwortet, 31_000, LANG_AB).outage).toBeNull();
  });
});

describe('@RZ-034 Ohne gescheiterten Abruf wird keine Störung gemeldet', () => {
  it('Erfolge ohne vorherigen Fehlschlag melden nichts, auch nicht viele hintereinander', () => {
    let zustand: OutageState = NO_OUTAGE;
    for (const t of [0, 10_000, 20_000, 30_000, 40_000]) {
      const ergebnis = noteOutageRecovery(zustand, t, LANG_AB);
      expect(ergebnis.outage).toBeNull();
      zustand = ergebnis.state;
    }
    expect(zustand).toEqual({ anchorMs: 40_000, failing: false });
  });
});

describe('@RZ-033 Uhr für die Dauer', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('monoton: ein Sprung der Geräteuhr verändert sie nicht (Gegenbeispiel: Date.now springt um einen Tag)', () => {
    const davor = monotonicNowMs();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86_400_000);
    const danach = monotonicNowMs();
    expect(danach - davor).toBeLessThan(1_000);
    expect(danach).toBeGreaterThanOrEqual(davor);
  });

  it('ohne performance.now fällt sie auf die Geräteuhr zurück', () => {
    vi.stubGlobal('performance', undefined);
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    expect(monotonicNowMs()).toBe(1234);
    vi.unstubAllGlobals();
  });
});
