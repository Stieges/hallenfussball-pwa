/**
 * Test-Fälschung von `navigator.mediaDevices` und `navigator.permissions` für den Ausgang (H4-6, G11): `enumerateDevices` mit und
 * ohne Kennungen (ohne Mikrofon-Freigabe ein Eintrag ohne Namen und ohne Kennung, wie Chrome im Versuch V-AUSGANG), `getUserMedia`
 * mit Spion auf `track.stop`, `devicechange` beim Abziehen und Anstecken, `permissions.query({ name: 'microphone' })`.
 *
 * „Nur dieses Mal“ (`dauerhaft = false`): die Freigabe gilt bis zum Neuladen (`neuLaden()`), danach liefert der Browser wieder keine
 * Kennungen (@HT-055). „Bei Besuchen dieser Website“ (`dauerhaft = true`) bleibt über das Neuladen.
 * Die Zähler heißen bewusst nicht wie die Browser-Funktionen (die ESLint-Sperre sperrt `getUserMedia` außerhalb von `ausgangListe.ts`).
 */
import type { Berechtigungen, GeraeteInfo, MedienGeraete } from '../../features/hallenton/runtime/ausgang/ausgangListe';

export interface FalscherAusgang {
  id: string;
  name: string;
  gruppe: string;
}

/** Wie in V-AUSGANG Teil 2: ein Standard, Anzeige, Dock, Laptop-Lautsprecher und ein Konferenz-Programm (virtuell). */
export const AUSGAENGE: readonly FalscherAusgang[] = [
  { id: 'default', name: 'Standard - MacBook Pro-Lautsprecher (Built-in)', gruppe: 'g-mac' },
  { id: 'lg', name: 'LG Ultra HD (DisplayPort)', gruppe: 'g-lg' },
  { id: 'teams', name: 'Microsoft Teams Audio Device (Virtual)', gruppe: 'g-teams' },
  { id: 'dock', name: 'ThinkPad Thunderbolt 3 Dock USB Audio (17ef:306a)', gruppe: 'g-dock' },
  { id: 'mac', name: 'MacBook Pro-Lautsprecher (Built-in)', gruppe: 'g-mac' },
];

export interface FalscheSpur {
  gestoppt: boolean;
  stop(): void;
}

export class FalscheMedienGeraete implements MedienGeraete, Berechtigungen {
  /** Angeschlossene Ausgänge in der Reihenfolge des Browsers. */
  ausgaenge: FalscherAusgang[];
  /** Das Mikrofon ist freigegeben (Namen und Kennungen lesbar). */
  erlaubt = false;
  /** „Bei Besuchen dieser Website erlauben“: bleibt nach `neuLaden()`; sonst „Nur dieses Mal“. */
  dauerhaft = false;
  /** Der Nutzer lehnt die Frage ab. */
  ablehnen = false;
  /** Der Browser kennt `permissions.query` für das Mikrofon nicht (z. B. Safari). */
  ohneBerechtigungen = false;
  readonly spuren: FalscheSpur[] = [];
  mikrofonAnfragen = 0;
  leseAufrufe = 0;
  erlaubnisAbfragen = 0;
  private readonly zuhoerer = new Set<() => void>();

  constructor(ausgaenge: readonly FalscherAusgang[] = AUSGAENGE) {
    this.ausgaenge = [...ausgaenge];
  }

  /** `enumerateDevices` antwortet nie (hängender Browser-Dienst). */
  leseHaengt = false;

  enumerateDevices(): Promise<readonly GeraeteInfo[]> {
    this.leseAufrufe += 1;
    if (this.leseHaengt) {
      return new Promise(() => undefined);
    }
    const eingang: GeraeteInfo = { deviceId: this.erlaubt ? 'mikro-1' : '', groupId: this.erlaubt ? 'g-mikro' : '', kind: 'audioinput', label: this.erlaubt ? 'Eingebautes Mikrofon' : '' };
    if (!this.erlaubt) {
      return Promise.resolve([eingang, { deviceId: '', groupId: '', kind: 'audiooutput', label: '' }]); // ohne Freigabe: ohne Namen, ohne Kennung
    }
    return Promise.resolve([eingang, ...this.ausgaenge.map((a): GeraeteInfo => ({ deviceId: a.id, groupId: a.gruppe, kind: 'audiooutput', label: a.name }))]);
  }

  getUserMedia(_auswahl: { audio: true }): Promise<{ getTracks(): FalscheSpur[] }> {
    this.mikrofonAnfragen += 1;
    if (this.ablehnen) {
      return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    }
    this.erlaubt = true;
    const spur: FalscheSpur = { gestoppt: false, stop() { this.gestoppt = true; } };
    this.spuren.push(spur);
    return Promise.resolve({ getTracks: () => [spur] });
  }

  query(_beschreibung: { name: 'microphone' }): Promise<{ readonly state: string }> {
    this.erlaubnisAbfragen += 1;
    if (this.ohneBerechtigungen) {
      return Promise.reject(new TypeError('microphone is not a valid permission'));
    }
    return Promise.resolve({ state: this.erlaubt ? 'granted' : 'prompt' });
  }

  addEventListener(_type: 'devicechange', fn: () => void): void {
    this.zuhoerer.add(fn);
  }

  removeEventListener(_type: 'devicechange', fn: () => void): void {
    this.zuhoerer.delete(fn);
  }

  /** Der Browser meldet `devicechange`. */
  geraeteWechsel(): void {
    for (const fn of [...this.zuhoerer]) {
      fn();
    }
  }

  /** `melden = false`: die Liste ändert sich, `devicechange` kommt erst später (`geraeteWechsel()`), wie bei offener Reihenfolge im Browser. */
  abziehen(id: string, melden = true): void {
    this.ausgaenge = this.ausgaenge.filter((a) => a.id !== id);
    if (melden) {
      this.geraeteWechsel();
    }
  }

  anstecken(ausgang: FalscherAusgang): void {
    if (!this.ausgaenge.some((a) => a.id === ausgang.id)) {
      this.ausgaenge.push(ausgang);
    }
    this.geraeteWechsel();
  }

  /** Die App wird neu geladen: „Nur dieses Mal“ ist vorbei, eine dauerhafte Freigabe bleibt. */
  neuLaden(): void {
    if (!this.dauerhaft) {
      this.erlaubt = false;
    }
  }
}
