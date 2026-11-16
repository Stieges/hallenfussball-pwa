/**
 * H4-11b Nachzug aus dem Review von H4-11 (@HT-054 Zeile 6, „jedes Ende genau einmal“): mit dem ECHTEN Spieler (kein Doppel) kommt nur ein Ton in die Menge der natürlich beendeten
 * Töne (`endeVerbrauchen`), der bis zu seinem Ende geklungen hat. Ein abgebrochener Ton – der Ausgang ist verloren, der Plan ändert sich – kommt nie hinein, auch wenn der Browser nach dem
 * `stop()` ein `ended`-Ereignis schickt; sonst zählte ihn die Steuerung als „gespielt“, und der Abpfiff fiele aus. Der AudioContext ist gefälscht (`FalscherAudioKontext`).
 */
import { describe, expect, it } from 'vitest';
import { FalscherAudioKontext, tonDaten } from '../../../../test/hallenton/falscherAudioKontext';
import { erzeugeHallTonSpieler } from '../hallTonSpieler';

async function bereit() {
  const kontext = new FalscherAudioKontext();
  const spieler = erzeugeHallTonSpieler({ erzeugeKontext: () => kontext, ladeDaten: () => Promise.resolve(tonDaten(2)), speicher: null });
  await spieler.laden({ abpfiff: 'horn-2', halbzeit: 'horn-1' });
  await spieler.aktivieren();
  return { kontext, spieler };
}

describe('endeVerbrauchen am echten Spieler', () => {
  it('ein Ton, der bis zu seinem Ende geklungen hat, steht genau einmal in der Menge der natürlich beendeten Töne', async () => {
    const { kontext, spieler } = await bereit();
    expect(spieler.planen('ton-1', 'abpfiff', 10)).toBe(true);
    expect(spieler.geplant()).toEqual(['ton-1']);
    kontext.endeMelden(); // der Browser meldet: der Ton ist zu Ende gespielt
    expect(spieler.geplant()).toEqual([]);
    expect(spieler.endeVerbrauchen('ton-1')).toBe(true);
    expect(spieler.endeVerbrauchen('ton-1')).toBe(false); // verbraucht: nie ein zweites Mal
  });

  it('Gegenbeispiel: ein ABGEBROCHENER Ton kommt nicht in die Menge, auch wenn der Browser nach dem stop() ein „ended“ schickt', async () => {
    const { kontext, spieler } = await bereit();
    spieler.planen('ton-1', 'abpfiff', 10);
    spieler.abbrechen('ton-1'); // z. B. der Ausgang ist verloren
    expect(kontext.quellen[0]?.stops.length).toBeGreaterThan(0);
    kontext.endeMelden(); // Browser: nach stop() folgt „ended“
    expect(spieler.endeVerbrauchen('ton-1')).toBe(false);
  });

  it('Gegenbeispiel: ein Ton, der überplant wird (neuer Plan unter derselben Kennung), zählt mit dem „ended“ der ALTEN Quelle nicht als gespielt', async () => {
    const { kontext, spieler } = await bereit();
    spieler.planen('ton-1', 'abpfiff', 10);
    spieler.planen('ton-1', 'abpfiff', 12); // Plan ändert sich: die alte Quelle wird abgebrochen
    kontext.quellen[0]?.onended?.(new Event('ended')); // „ended“ der alten Quelle
    expect(spieler.endeVerbrauchen('ton-1')).toBe(false);
    kontext.quellen[1]?.onended?.(new Event('ended')); // die neue klingt zu Ende
    expect(spieler.endeVerbrauchen('ton-1')).toBe(true);
  });

  it('Gegenbeispiel: ein Ton, der nie lief, ist nie „beendet“', async () => {
    const { spieler } = await bereit();
    expect(spieler.endeVerbrauchen('unbekannt')).toBe(false);
  });
});
