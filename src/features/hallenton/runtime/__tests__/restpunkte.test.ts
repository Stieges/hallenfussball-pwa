/**
 * H3b-3 Restpunkte aus H3b-2b: Meldung auch bei zurückgesprungener Uhr (k4-neu-1, Regel 3), Tonwahl-Wechsel erst in Ruhe
 * (k-neu-2, @HT-025) und „Anhören“ vor der Aktivierung mit der Hupe des Turniers (k4-neu-2, @HT-023). Die Tests zu Befund 6a
 * (Steuer-Stand über ein Neuladen) entfallen mit Regel 2 vom 07.11. (Hinweis K4 aus dem Review von H3b-3).
 */
import { describe, expect, it, vi } from 'vitest';
import { ENDE_A2, T0, anpfiff, server, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { bereiteLautsprecherFeldIds, leseLautsprecherFelder } from '../lautsprecherKanal';
import { Tab, feldAus } from './laufzeitTestlage';

describe('k4-neu-1 – springt die Uhr zurück, wird die Meldung trotzdem erneuert (Regel 3)', () => {
  it('Regel 3: Geräteuhr springt 5 s zurück → die Meldung „bereit“ ist nach höchstens 1,25 s wieder gültig und bleibt es', async () => {
    let versatz = 0;
    const tab = new Tab({ start: T0, kanalVersatz: () => versatz });
    const feld = feldAus([{ ab: T0, log: anpfiff() }], undefined, 'field-1', server(200));
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte();
    await tab.vor(3000);
    versatz = -5000;
    const bereit = (): string[] => bereiteLautsprecherFeldIds(leseLautsprecherFelder(tab.geraet.speicher, tab.uhr.jetzt() + versatz), 'hallencup-nord');
    await tab.vor(1250);
    expect(bereit()).toEqual(['field-1']);
    for (let i = 0; i < 20; i += 1) {
      await tab.vor(250);
      expect(bereit()).toEqual(['field-1']);
    }
  });
});

describe('k-neu-2 – die Tonwahl ändert sich während des Turniers (@HT-025)', () => {
  async function tabVorEnde(abstandMs: number) {
    const tab = new Tab({ start: ENDE_A2 - 20_000 });
    const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }], undefined, 'field-1', server(200));
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte();
    await tab.vor(ENDE_A2 - abstandMs - tab.uhr.jetzt());
    return tab;
  }
  const dauern = (tab: Tab): number[] => tab.kontext.quellen.filter((q) => q.starts.length > 0).map((q) => q.buffer?.duration ?? 0);

  it('@HT-025 neue Abpfiff-Hupe weniger als 3 s vor dem Ende → dieser Ton noch mit der alten Wahl; danach gilt die neue', async () => {
    const tab = await tabVorEnde(2000);
    const laden = vi.spyOn(tab.spieler, 'laden');
    tab.laufzeit.setzeTonWahl({ abpfiff: 'horn-3', halbzeit: 'horn-3' }); // Hupe 3 (1 s) statt Hupe 2 (2 s)
    await tab.vor(2500);
    expect(dauern(tab)).toEqual([2]); // der geplante Ton behielt seinen Puffer
    expect(laden).not.toHaveBeenCalled(); // noch nicht: der Ton klingt bis zum harten Stopp (5 s nach seinem Beginn)
    await tab.vor(2000);
    expect(laden).not.toHaveBeenCalled();
    await tab.vor(3000); // Beginn + 5 s ist vorbei
    expect(laden).toHaveBeenCalledWith({ abpfiff: 'horn-3', halbzeit: 'horn-3' });
    await tab.vor(100);
    expect(tab.spieler.jetztSpielen('abpfiff')).toBe(true);
    expect(dauern(tab)).toEqual([2, 1]);
  });

  it('Gegenprobe: ändert sich die Wahl, während kein Ton bevorsteht, wird sie sofort geladen; eine gleiche Wahl lädt nichts', async () => {
    const tab = await tabVorEnde(15_000);
    const laden = vi.spyOn(tab.spieler, 'laden');
    tab.laufzeit.setzeTonWahl({ abpfiff: 'horn-2', halbzeit: 'horn-3' }); // unverändert (Vorgabe der Testlage)
    expect(laden).not.toHaveBeenCalled();
    tab.laufzeit.setzeTonWahl({ abpfiff: 'horn-3', halbzeit: 'horn-3' });
    expect(laden).toHaveBeenCalledTimes(1);
    await tab.vor(16_000);
    expect(dauern(tab)).toEqual([1]);
  });
});

describe('k4-neu-2 – „Anhören“ vor der Aktivierung spielt die Hupe des Turniers (@HT-023)', () => {
  it('@HT-023 Tab nicht aktiviert, Turnier mit Abpfiff „Hupe 3“ → „Anhören“ lädt die Wahl des Turniers, nicht Hupe 1', async () => {
    const tab = new Tab({ start: T0, leseTonWahl: () => Promise.resolve({ abpfiff: 'horn-3', halbzeit: 'horn-1' }) });
    await tab.starte({ aktivieren: false });
    await tab.spieler.aktivieren();
    await tab.laufzeit.ladeToeneZumAnhoeren();
    expect(tab.spieler.jetztSpielen('abpfiff')).toBe(true);
    expect(tab.kontext.quellen.map((q) => q.buffer?.duration)).toEqual([1]);
    expect(tab.laufzeit.getSnapshot().rolle).toBe('wartet'); // Anhören aktiviert den Tab nicht (W2-neu-1)
  });
});
