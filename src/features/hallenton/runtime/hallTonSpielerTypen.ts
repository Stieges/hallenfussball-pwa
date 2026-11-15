/**
 * Schnittstelle des Web-Audio-Spielers (aus `hallTonSpieler.ts`, H4-1); die Implementierung und alle Exporte bleiben in
 * `hallTonSpieler.ts`.
 */
import type { AudioKontext } from './webAudioTypen';
import type { LadeStand, TonWahl } from './hallTonLader';
import type { AnhoerenErgebnis } from './hallTonVorschau';
import type { ReglerArt, Speicher, TonArt } from './tonEinstellungen';
import type { SpielerAusgang } from './ausgang/ausgangWaechter';
import type { TorhymnenAusgabe } from './torhymnenAusgabe';

/**
 * `output_lost` / `output_unconfirmed` (H4-6, @HT-054, @HT-055) stehen vor `not_activated`: der gewählte Ausgang fehlt bzw. ist
 * nach dem Neuladen nicht bestätigt. Sie halten die Sperre, planen nichts und holen nichts nach.
 */
export type SpielerZustand = 'not_activated' | 'volume_zero' | 'custom_sound_failed' | 'ready' | 'output_lost' | 'output_unconfirmed';

/** Steht die Ausgabe wegen des Ausgangs (nichts darf erklingen)? */
export function istAusgangsZustand(zustand: SpielerZustand): zustand is 'output_lost' | 'output_unconfirmed' {
  return zustand === 'output_lost' || zustand === 'output_unconfirmed';
}

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
  /** Dieser Tab ist aktiviert und die Ausgabe läuft – ohne Blick auf den Ausgang (wie `zustand() !== 'not_activated'` vor H4-6). */
  ausgabeLaeuft(): boolean;
  /** Der Abpfiff-Ton ist geladen (unabhängig vom Ausgang). */
  tonGeladen(): boolean;
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
  /** Wächter des gewählten Ausgangs (H4-6); ohne ihn bleibt alles wie vor H4-6 (Standard-Ausgang). */
  ausgang?: SpielerAusgang | null;
}
