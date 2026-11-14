/**
 * Schnittstelle des Web-Audio-Spielers (aus `hallTonSpieler.ts`, H4-1); die Implementierung und alle Exporte bleiben in
 * `hallTonSpieler.ts`.
 */
import type { AudioKontext } from './webAudioTypen';
import type { LadeStand, TonWahl } from './hallTonLader';
import type { AnhoerenErgebnis } from './hallTonVorschau';
import type { ReglerArt, Speicher, TonArt } from './tonEinstellungen';
import type { TorhymnenAusgabe } from './torhymnenAusgabe';

export type SpielerZustand = 'not_activated' | 'volume_zero' | 'custom_sound_failed' | 'ready';

export interface HallTonSpieler {
  aktivieren(): Promise<boolean>;
  laden(toene: Record<TonArt, TonWahl>): Promise<Record<TonArt, LadeStand>>;
  planen(id: string, art: TonArt, startAtAudioSec: number): boolean;
  abbrechen(id: string): void;
  /** Sofort spielen als echter Ton (Testton in der Halle, @HT-017): beendet jedes laufende Anhören. */
  jetztSpielen(art: TonArt): boolean;
  /**
   * „Anhören“ (@HT-023) als eigene Art, nur auf diesem Gerät: `'belegt'`, solange ein echter Ton (Torhymne, End-Ton, Testton)
   * klingt; ein laufendes Anhören beendet jeder echte Ton zu seinem Beginn und zählt nie als „läuft“.
   */
  anhoeren(art: TonArt): AnhoerenErgebnis;
  /** Audiozeit (s) für eine Serverzeit (ms), abzüglich `outputLatency`, wo vorhanden. */
  audioZeitFuerServerZeit(serverMs: number, serverNowMs: number): number;
  lautstaerke(art: ReglerArt): number;
  setzeLautstaerke(art: ReglerArt, prozent: number): void;
  zustand(): SpielerZustand;
  onZustand(fn: (zustand: SpielerZustand) => void): () => void;
  geplant(): string[];
  /** Für `ausgangsSignale` (dieselbe Ausgabe). */
  audioKontext(): AudioKontext;
  /** Torhymnen (@HT-024): laden, spielen, stoppen. */
  readonly hymnen: TorhymnenAusgabe;
}

export interface HallTonSpielerAbhaengigkeiten {
  erzeugeKontext: () => AudioKontext;
  ladeDaten: (url: string) => Promise<ArrayBuffer>;
  speicher: Speicher | null;
}
