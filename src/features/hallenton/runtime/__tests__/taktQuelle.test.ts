/**
 * H3b-1: Taktquelle des Hallen-Lautsprechers (Worker-Takt 250 ms, Weckrufe, Aussetzer, Fehler).
 * Spike 06.11.: Takt im Hauptthread scheitert im Hintergrund, der Worker hält (Aussetzer bis 1,6 s). @HT-014: „Hintergrund“
 * nur, wenn der Takt ausbleibt (länger als 3 s), nie beim bloßen Verdecken. @HT-029: der Weckruf kommt im Hintergrund.
 */
import { describe, expect, it, vi } from 'vitest';
import { erzeugeFalscheTaktQuelle } from '../../../../test/hallenton/falscheTaktQuelle';
import { erzeugeTaktQuelle, TAKT_MS, AUSSETZER_AB_MS } from '../taktQuelle';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';

describe('taktQuelle', () => {
  it('Takt alle 250 ms mit monotoner Zeit, erst nach start()', () => {
    const { quelle, uhr } = erzeugeFalscheTaktQuelle({ startMs: 10_000 });
    const takte: number[] = [];
    quelle.onTakt((mono) => takte.push(mono));
    uhr.vorruecken(1000);
    expect(takte).toEqual([]);
    quelle.start();
    uhr.vorruecken(1000);
    expect(TAKT_MS).toBe(250);
    expect(takte).toEqual([11_250, 11_500, 11_750, 12_000]);
    expect(quelle.zustand()).toBe('laeuft');
  });

  it('der Worker wird einmal beim Start erzeugt, nicht je Weckruf (Spike: Start bis 1,7 s)', () => {
    const takt = erzeugeFalscheTaktQuelle();
    takt.quelle.start();
    takt.quelle.wecken('ton-1', 5000);
    takt.quelle.wecken('ton-2', 9000);
    takt.quelle.start();
    takt.uhr.vorruecken(10_000);
    expect(takt.erzeugt()).toBe(1);
  });

  it('@HT-029 Weckruf zum angefragten Zeitpunkt aus dem Worker', () => {
    const { quelle, uhr } = erzeugeFalscheTaktQuelle();
    const weckrufe: Array<{ id: string; bei: number }> = [];
    quelle.onWeckruf((id, mono) => weckrufe.push({ id, bei: mono }));
    quelle.start();
    quelle.wecken('abpfiff-s11', 117_000);
    uhr.vorruecken(116_999);
    expect(weckrufe).toEqual([]);
    uhr.vorruecken(1);
    expect(weckrufe).toEqual([{ id: 'abpfiff-s11', bei: 117_000 }]);
  });

  it('@HT-029 Abbruch eines Weckrufs (Uhr angehalten) und neuer Weckruf unter derselben Kennung ersetzt den alten', () => {
    const { quelle, uhr } = erzeugeFalscheTaktQuelle();
    const weckrufe: string[] = [];
    quelle.onWeckruf((id) => weckrufe.push(`${id}@${uhr.jetzt()}`));
    quelle.start();
    quelle.wecken('a', 1000);
    quelle.wecken('b', 2000);
    quelle.abbrechen('a');
    quelle.wecken('b', 30_000);
    uhr.vorruecken(40_000);
    expect(weckrufe).toEqual(['b@30000']);
  });

  it('@HT-029 Weckruf auch dann, wenn der Worker kurz aussetzt (bis 1,6 s): er kommt verspätet, aber er kommt', () => {
    const takt = erzeugeFalscheTaktQuelle();
    const weckrufe: number[] = [];
    takt.quelle.onWeckruf((_id, mono) => weckrufe.push(mono));
    takt.quelle.start();
    takt.quelle.wecken('a', 1000);
    takt.uhr.vorruecken(900);
    takt.workerAussetzen();
    takt.uhr.vorruecken(1600);
    expect(weckrufe).toEqual([]);
    takt.workerWeiter();
    expect(weckrufe).toEqual([2500]);
  });

  it('@HT-014 Aussetzer von 1,6 s ist kein Hintergrund', () => {
    const takt = erzeugeFalscheTaktQuelle();
    const aussetzer = vi.fn();
    takt.quelle.onAussetzer(aussetzer);
    takt.quelle.start();
    takt.uhr.vorruecken(500);
    takt.workerAussetzen();
    takt.uhr.vorruecken(1600);
    takt.workerWeiter();
    takt.uhr.vorruecken(1000);
    expect(aussetzer).not.toHaveBeenCalled();
    expect(takt.quelle.zustand()).toBe('laeuft');
  });

  it('@HT-014 bleibt der Takt länger als 3 s aus, meldet die Quelle den Aussetzer – und sein Ende mit Dauer', () => {
    const takt = erzeugeFalscheTaktQuelle();
    const ereignisse: unknown[] = [];
    takt.quelle.onAussetzer((e) => ereignisse.push(e));
    takt.quelle.start();
    takt.uhr.vorruecken(1000);
    takt.workerAussetzen();
    takt.uhr.vorruecken(AUSSETZER_AB_MS);
    expect(ereignisse).toEqual([]);
    takt.uhr.vorruecken(1000);
    expect(ereignisse).toEqual([{ art: 'beginn', seitMs: expect.any(Number) as number }]);
    expect(takt.quelle.zustand()).toBe('aussetzer');
    takt.uhr.vorruecken(10_000);
    takt.workerWeiter();
    expect(ereignisse).toHaveLength(2);
    expect(ereignisse[1]).toEqual({ art: 'ende', dauerMs: 14_000 });
    expect(takt.quelle.zustand()).toBe('laeuft');
  });

  it('@HT-014 Gegenbeispiel: auch der Hauptthread war gedrosselt – die Lücke wird beim nächsten Takt nachgemeldet', () => {
    const takt = erzeugeFalscheTaktQuelle();
    const ereignisse: unknown[] = [];
    takt.quelle.onAussetzer((e) => ereignisse.push(e));
    takt.quelle.start();
    takt.uhr.vorruecken(1000);
    takt.workerAussetzen();
    takt.uhr.stummschalten('haupt');
    takt.uhr.vorruecken(20_000);
    takt.workerWeiter();
    takt.uhr.lautschalten('haupt');
    expect(ereignisse.map((e) => (e as { art: string }).art)).toEqual(['beginn', 'ende']);
    expect(ereignisse[1]).toEqual({ art: 'ende', dauerMs: 20_000 });
  });

  it('stop(): keine Takte und keine Weckrufe mehr, kein Aussetzer', () => {
    const takt = erzeugeFalscheTaktQuelle();
    const takte = vi.fn();
    const weckrufe = vi.fn();
    const aussetzer = vi.fn();
    takt.quelle.onTakt(takte);
    takt.quelle.onWeckruf(weckrufe);
    takt.quelle.onAussetzer(aussetzer);
    takt.quelle.start();
    takt.quelle.wecken('a', 2000);
    takt.uhr.vorruecken(500);
    takte.mockClear();
    takt.quelle.stop();
    takt.uhr.vorruecken(10_000);
    expect(takte).not.toHaveBeenCalled();
    expect(weckrufe).not.toHaveBeenCalled();
    expect(aussetzer).not.toHaveBeenCalled();
    expect(takt.quelle.zustand()).toBe('aus');
  });

  it('Abmelden eines Zuhörers', () => {
    const { quelle, uhr } = erzeugeFalscheTaktQuelle();
    const takte = vi.fn();
    const ab = quelle.onTakt(takte);
    quelle.start();
    uhr.vorruecken(250);
    ab();
    uhr.vorruecken(1000);
    expect(takte).toHaveBeenCalledTimes(1);
  });

  it('Scheitert das Erzeugen des Workers (CSP, Datei fehlt), meldet die Quelle einen Fehlerzustand statt still zu bleiben', () => {
    const takt = erzeugeFalscheTaktQuelle({ erzeugenScheitert: true });
    const fehler = vi.fn();
    takt.quelle.onFehler(fehler);
    takt.quelle.start();
    expect(takt.quelle.zustand()).toBe('fehler');
    expect(fehler).toHaveBeenCalledTimes(1);
    expect(takt.quelle.wecken('a', 100)).toBe(false);
  });

  it('Fehler des laufenden Workers: Fehlerzustand, kein Aussetzer; ein neuer Start erzeugt einen neuen Worker', () => {
    const takt = erzeugeFalscheTaktQuelle();
    const fehler = vi.fn();
    const aussetzer = vi.fn();
    takt.quelle.onFehler(fehler);
    takt.quelle.onAussetzer(aussetzer);
    takt.quelle.start();
    takt.uhr.vorruecken(500);
    takt.workerFehler();
    expect(takt.quelle.zustand()).toBe('fehler');
    expect(fehler).toHaveBeenCalledTimes(1);
    takt.uhr.vorruecken(10_000);
    expect(aussetzer).not.toHaveBeenCalled();
    takt.quelle.start();
    expect(takt.erzeugt()).toBe(2);
    expect(takt.quelle.zustand()).toBe('laeuft');
  });

  it('Gegenbeispiel: fremde Nachrichten vom Worker werden ignoriert', () => {
    const uhr = new ManuelleUhr();
    let anHaupt: ((d: unknown) => void) | null = null;
    const quelle = erzeugeTaktQuelle({
      zeitgeber: uhr.gruppe('haupt'),
      erzeugeWorker: () => ({
        senden: () => undefined,
        beenden: () => undefined,
        beiNachricht: (fn) => { anHaupt = fn; },
        beiFehler: () => undefined,
      }),
    });
    const takte = vi.fn();
    const weckrufe = vi.fn();
    quelle.onTakt(takte);
    quelle.onWeckruf(weckrufe);
    quelle.start();
    const senden = anHaupt as ((d: unknown) => void) | null;
    senden?.({ art: 'ton', id: 'x' });
    senden?.(null);
    senden?.({ art: 'takt', mono: 'jetzt' });
    senden?.({ art: 'weckruf', id: 7 });
    expect(takte).not.toHaveBeenCalled();
    expect(weckrufe).not.toHaveBeenCalled();
  });
});
