/**
 * H3b-1: die drei starken Anzeichen für einen Wechsel des Audio-Ausgangs (@HT-047), mit allen Beispielzeilen des
 * Szenariogrundrisses. Gegeben: bereiter Lautsprecher für Feld 1, Testton um 14:02. Die Schnittstelle meldet
 * „Anzeichen seit dem letzten Lebenszeichen“; `abholen()` setzt zurück (das nächste Lebenszeichen sendet `p_output_changed`).
 */
import { describe, expect, it } from 'vitest';
import { FalscherAudioKontext } from '../../../../test/hallenton/falscherAudioKontext';
import { erzeugeAusgangsSignale, LATENZ_SPRUNG_SEK, type GeraeteMelder } from '../ausgangsSignale';
import { erzeugeHallTonSpieler } from '../hallTonSpieler';

class FalscheGeraete implements GeraeteMelder {
  private readonly zuhoerer = new Set<() => void>();
  addEventListener(_type: 'devicechange', fn: () => void): void { this.zuhoerer.add(fn); }
  removeEventListener(_type: 'devicechange', fn: () => void): void { this.zuhoerer.delete(fn); }
  melden(): void { for (const fn of this.zuhoerer) { fn(); } }
  anzahl(): number { return this.zuhoerer.size; }
}

/** Gegeben: bereiter Lautsprecher (Ausgabe läuft), Testton um 14:02 bei 20 ms Verzögerung gespielt. */
function gegebenBereitMitTestton() {
  const kontext = new FalscherAudioKontext();
  kontext.zustandSetzen('running');
  kontext.outputLatency = 0.02;
  const geraete = new FalscheGeraete();
  const signale = erzeugeAusgangsSignale({ kontext, geraete });
  signale.testtonGespielt();
  return { kontext, geraete, signale };
}

describe('ausgangsSignale (@HT-047)', () => {
  it('@HT-047 Zeile 1: die gemessene Verzögerung hat sich seit dem Testton um mehr als 50 ms geändert → Anzeichen', () => {
    const { kontext, signale } = gegebenBereitMitTestton();
    expect(LATENZ_SPRUNG_SEK).toBe(0.05);
    kontext.outputLatency = 0.18;
    expect(signale.abholen()).toEqual(['verzoegerung']);
  });

  it('@HT-047 Zeile 1 auch abwärts (Bluetooth → eingebauter Lautsprecher)', () => {
    const { kontext, signale } = gegebenBereitMitTestton();
    kontext.outputLatency = 0.2;
    signale.testtonGespielt();
    kontext.outputLatency = 0.03;
    expect(signale.abholen()).toEqual(['verzoegerung']);
  });

  it('@HT-047 Zeile 1 Gegenbeispiel: genau 50 ms oder weniger ist kein Anzeichen', () => {
    const { kontext, signale } = gegebenBereitMitTestton();
    kontext.outputLatency = 0.07;
    expect(signale.abholen()).toEqual([]);
    kontext.outputLatency = 0.06;
    expect(signale.abholen()).toEqual([]);
  });

  it('@HT-047 Zeile 1: ein kurzer Sprung zwischen zwei Lebenszeichen bleibt gemerkt, wenn er gemessen wurde', () => {
    const { kontext, signale } = gegebenBereitMitTestton();
    kontext.outputLatency = 0.2;
    signale.messen();
    kontext.outputLatency = 0.02;
    expect(signale.abholen()).toEqual(['verzoegerung']);
  });

  it('@HT-047 Zeile 2: der Browser meldet geänderte Geräte → Anzeichen', () => {
    const { geraete, signale } = gegebenBereitMitTestton();
    geraete.melden();
    expect(signale.abholen()).toEqual(['geraete']);
  });

  it('@HT-047 Zeile 3: die Ton-Ausgabe war ohne Zutun der App unterbrochen und läuft wieder → Anzeichen', () => {
    const { kontext, signale } = gegebenBereitMitTestton();
    kontext.zustandSetzen('suspended');
    kontext.zustandSetzen('running');
    expect(signale.abholen()).toEqual(['unterbrochen']);
  });

  it('@HT-047 Zeile 3: auch „interrupted“ (Safari) zählt', () => {
    const { kontext, signale } = gegebenBereitMitTestton();
    kontext.zustandSetzen('interrupted');
    expect(signale.abholen()).toEqual(['unterbrochen']);
  });

  it('@HT-047 Zeile 3 Gegenbeispiel: unterbricht die App selbst (angekündigt), ist das kein Anzeichen', () => {
    const { kontext, signale } = gegebenBereitMitTestton();
    signale.eigeneUnterbrechung();
    kontext.zustandSetzen('suspended');
    kontext.zustandSetzen('running');
    expect(signale.abholen()).toEqual([]);
    kontext.zustandSetzen('suspended');
    expect(signale.abholen()).toEqual(['unterbrochen']);
  });

  it('@HT-047 Zeile 4: die App war minimiert und ist wieder vorn → kein Anzeichen', () => {
    const { kontext, signale } = gegebenBereitMitTestton();
    // Minimieren ändert weder Geräte noch Ausgabe noch die gemessene Verzögerung; die Signale hören nicht auf die Sichtbarkeit.
    kontext.outputLatency = 0.025;
    expect(signale.abholen()).toEqual([]);
  });

  it('@HT-047 Zeile 5: die App wurde neu geladen, und Olli hat danach „Ton aktivieren“ geklickt → kein Anzeichen', async () => {
    // Nach dem Neuladen: neuer AudioContext (startet „suspended“), eigener resume() aus der Geste, kein Testton seit dem Laden
    const kontext = new FalscherAudioKontext();
    kontext.outputLatency = 0;
    const signale = erzeugeAusgangsSignale({ kontext, geraete: new FalscheGeraete() });
    await kontext.resume();
    kontext.outputLatency = 0.144;
    expect(signale.abholen()).toEqual([]);
  });

  it('@HT-047 Zeile 6: die Bluetooth-Box wurde getrennt, ohne dass der Browser etwas meldet → kein Anzeichen (Lücke: Probe und Testton)', () => {
    const { signale } = gegebenBereitMitTestton();
    expect(signale.abholen()).toEqual([]);
  });

  it('abholen() setzt zurück: dasselbe Anzeichen wird nur einmal gemeldet', () => {
    const { kontext, geraete, signale } = gegebenBereitMitTestton();
    geraete.melden();
    kontext.outputLatency = 0.2;
    kontext.zustandSetzen('suspended');
    expect(signale.abholen()).toEqual(['verzoegerung', 'geraete', 'unterbrochen']);
    expect(signale.abholen()).toEqual([]);
  });

  it('Messwert 0 beim Testton (Ausgabe noch nicht gemessen, Spike: 0 → 144 ms) ist keine Bezugsgröße', () => {
    const kontext = new FalscherAudioKontext();
    kontext.zustandSetzen('running');
    kontext.outputLatency = 0;
    const signale = erzeugeAusgangsSignale({ kontext, geraete: null });
    signale.testtonGespielt();
    kontext.outputLatency = 0.144;
    expect(signale.abholen()).toEqual([]);
    kontext.outputLatency = 0.3;
    expect(signale.abholen()).toEqual(['verzoegerung']);
  });

  it('Gegenbeispiel: ohne outputLatency (ältere Browser) und ohne mediaDevices meldet nur die Unterbrechung', () => {
    const kontext = new FalscherAudioKontext();
    kontext.zustandSetzen('running');
    kontext.outputLatency = undefined;
    const signale = erzeugeAusgangsSignale({ kontext, geraete: null });
    signale.testtonGespielt();
    expect(signale.abholen()).toEqual([]);
    kontext.zustandSetzen('suspended');
    expect(signale.abholen()).toEqual(['unterbrochen']);
  });

  it('beenden() meldet die Zuhörer ab', () => {
    const { kontext, geraete, signale } = gegebenBereitMitTestton();
    signale.beenden();
    geraete.melden();
    kontext.zustandSetzen('suspended');
    expect(geraete.anzahl()).toBe(0);
    expect(signale.abholen()).toEqual([]);
  });

  it('@HT-047 Zeile 5 mit dem Spieler: „Ton aktivieren“ (eigenes resume) auf derselben Ausgabe ist kein Anzeichen', async () => {
    const kontext = new FalscherAudioKontext();
    const spieler = erzeugeHallTonSpieler({ erzeugeKontext: () => kontext, ladeDaten: () => Promise.reject(new Error('egal')), speicher: null });
    const signale = erzeugeAusgangsSignale({ kontext: spieler.audioKontext(), geraete: null });
    await spieler.aktivieren();
    expect(signale.abholen()).toEqual([]);
    kontext.zustandSetzen('interrupted');
    expect(signale.abholen()).toEqual(['unterbrochen']);
  });
});
