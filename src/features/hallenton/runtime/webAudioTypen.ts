/**
 * Ausschnitte der Web-Audio-Typen für den Hallen-Lautsprecher (H3b-1). Ein echter `AudioContext` erfüllt `AudioKontext`
 * (vom Compiler geprüft in `erzeugeBrowserHallTonSpieler`); im Test ersetzt ihn `src/test/hallenton/falscherAudioKontext.ts`.
 */
export type AudioZiel = object;
export interface AudioPuffer { readonly duration: number }
interface AudioWert { value: number }
export interface QuellKnoten {
  buffer: AudioPuffer | null;
  onended: ((ereignis: Event) => unknown) | null;
  connect(ziel: AudioZiel): unknown;
  disconnect(): void;
  start(wann?: number): void;
  stop(wann?: number): void;
}
export interface GainKnoten { readonly gain: AudioWert; connect(ziel: AudioZiel): unknown; disconnect(): void }
export interface KompressorKnoten {
  readonly threshold: AudioWert; readonly knee: AudioWert; readonly ratio: AudioWert;
  readonly attack: AudioWert; readonly release: AudioWert;
  connect(ziel: AudioZiel): unknown;
}
export interface AudioKontext {
  readonly currentTime: number;
  readonly outputLatency?: number;
  readonly state: string;
  readonly destination: AudioZiel;
  resume(): Promise<void>;
  decodeAudioData(daten: ArrayBuffer): Promise<AudioPuffer>;
  createBufferSource(): QuellKnoten;
  createGain(): GainKnoten;
  createDynamicsCompressor(): KompressorKnoten;
  addEventListener(type: 'statechange', fn: () => void): void;
  removeEventListener(type: 'statechange', fn: () => void): void;
}
