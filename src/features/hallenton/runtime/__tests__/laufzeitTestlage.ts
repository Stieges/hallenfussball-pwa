/**
 * Testlage der Tonlaufzeit (H3b-2b): ein Tab mit echter Laufzeit, echtem Takt-Adapter samt Worker-Kern
 * (`falscheTaktQuelle`), echtem Web-Audio-Spieler auf `FalscherAudioKontext` (Audiozeit = Uhr), echter Sperre und echtem
 * Kanal auf einem gefälschten Gerät. Der Feldstand ist entweder echt (Supabase-Doppel, `Lage` aus H3b-2a) oder gefälscht
 * (`FalscherFeldStand`: Stand je Feld als Funktion der Zeit, für genaue Lagen der Freigabe).
 * Ein Ton „erklingt“, wenn seine Quelle gestartet und nicht vor dem Start gestoppt wurde; seine Serverzeit folgt aus der
 * Audiozeit. Abpfiff-Ton = „Hupe 2“ (2 s), Halbzeit-Ton = „Hupe 3“ (1 s).
 */
import type { FeldStand, HallTonArt, StandQuelle } from '../../../../core/hallenton';
import type { EngineEvent, MatchContext } from '../../../../core/match';
import { CTX_11, server, stand, stateAus } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalscherAudioKontext, tonDaten } from '../../../../test/hallenton/falscherAudioKontext';
import { FalschesGeraet } from '../../../../test/hallenton/falschesGeraet';
import { erzeugeFalscheTaktQuelle, type FalscheTaktQuelle } from '../../../../test/hallenton/falscheTaktQuelle';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import type { FeldStandQuelle, FeldStandVerfuegbarkeit } from '../feldStand';
import { erzeugeGeraeteSperre } from '../geraeteSperre';
import { erzeugeHallLautsprecherLaufzeit, type HallLautsprecherLaufzeit } from '../HallLautsprecherLaufzeit';
import { erzeugeHallTonSpieler, type HallTonSpieler, type Speicher } from '../hallTonSpieler';
import { erzeugeLautsprecherKanal, type LautsprecherKanal } from '../lautsprecherKanal';
import { flush, Lage } from './feldStandTestlage';

const DAUER: Record<string, number> = { '/sounds/horn-1.mp3': 3, '/sounds/horn-2.mp3': 2, '/sounds/horn-3.mp3': 1 };
const ART_JE_DAUER: Record<number, HallTonArt> = { 2: 'abpfiff', 1: 'halbzeit' };

export type Stufe = { ab: number; log: EngineEvent[] };

/** Stand eines Felds je Zeit aus Stufen am Server; ein Ereignis um `ab` ist 300 ms später am Rechner bekannt. */
export function feldAus(stufen: Stufe[], ctx: MatchContext = CTX_11, feldId = 'field-1', quelle: StandQuelle | ((jetzt: number) => StandQuelle) = server(200)) {
  const states = stufen.map((s) => ({ ab: s.ab, state: stateAus(s.log, ctx) }));
  return (jetzt: number): FeldStand => {
    let aktuell = states[0];
    for (const s of states) {
      if (jetzt >= s.ab + 300) {
        aktuell = s;
      }
    }
    return stand(aktuell.state, ctx, typeof quelle === 'function' ? quelle(jetzt) : quelle, aktuell.ab + 300, feldId);
  };
}

/** Feldstand als Funktion der Zeit; `haengt` hält `aktualisieren` offen (eine Runde läuft). */
export class FalscherFeldStand implements FeldStandQuelle {
  staendeZu: (jetzt: number) => FeldStand[] = () => [];
  verf: FeldStandVerfuegbarkeit = 'verfuegbar';
  gescheitert = false;
  haengt = false;
  aufrufe = 0;
  staendeAufrufe = 0;
  private offen: Array<() => void> = [];

  constructor(private readonly uhr: ManuelleUhr) {}

  aktualisieren(): Promise<void> {
    this.aufrufe += 1;
    return this.haengt ? new Promise((resolve) => { this.offen.push(resolve); }) : Promise.resolve();
  }
  /** Hängende Runden beenden. */
  loesen(): void {
    this.haengt = false;
    for (const fn of this.offen.splice(0)) {
      fn();
    }
  }
  staende(): FeldStand[] {
    this.staendeAufrufe += 1;
    return this.staendeZu(this.uhr.jetzt());
  }
  naechsterAbfrageTaktMs = (): number => 1000;
  letzteAntwortAt = (): number | null => null;
  letzterVersuchGescheitert = (): boolean => this.gescheitert;
  verfuegbarkeit = (): FeldStandVerfuegbarkeit => this.verf;
  unlesbareSpiele = (): string[] => [];
}

export interface TabOptionen {
  start: number;
  felder?: number[];
  geraet?: FalschesGeraet;
  uhr?: ManuelleUhr;
  name?: string;
  /** `echt`: Feldstand mit Supabase-Doppel (`lage`); sonst `falsch` (`ffs`). */
  feldStand?: 'echt' | 'falsch';
  wurdeVerworfen?: boolean;
  speicher?: Speicher | null;
  erzeugenScheitert?: boolean;
  /** Versatz der Serveruhr gegen die Uhr des Geräts (ms), z. B. nach `sync()`. */
  serverVersatz?: () => number;
  /** Wirkung von `uhr.sync()` (z. B. Versatz zurücksetzen). */
  beiSync?: () => void;
}

export class Tab {
  readonly geraet: FalschesGeraet;
  readonly uhr: ManuelleUhr;
  readonly takt: FalscheTaktQuelle;
  readonly kontext = new FalscherAudioKontext();
  readonly spieler: HallTonSpieler;
  readonly kanal: LautsprecherKanal;
  readonly laufzeit: HallLautsprecherLaufzeit;
  readonly ffs: FalscherFeldStand;
  readonly lage: Lage | null;
  /** Probe der Geräteuhr (`Date.now`, `performance.now`) für den Uhrsprung. */
  wandVersatz = 0;
  syncAufrufe = 0;
  feldStandErzeugt = 0;
  private readonly t0: number;

  constructor(o: TabOptionen) {
    this.geraet = o.geraet ?? new FalschesGeraet();
    this.uhr = o.uhr ?? new ManuelleUhr(o.start);
    this.t0 = this.uhr.jetzt();
    const name = o.name ?? '';
    this.takt = erzeugeFalscheTaktQuelle({ uhr: this.uhr, name, erzeugenScheitert: o.erzeugenScheitert });
    Object.defineProperty(this.kontext, 'currentTime', { get: () => (this.uhr.jetzt() - this.t0) / 1000 });
    this.spieler = erzeugeHallTonSpieler({
      erzeugeKontext: () => this.kontext,
      ladeDaten: (url) => Promise.resolve(tonDaten(DAUER[url] ?? 255)),
      speicher: o.speicher ?? null,
    });
    this.kanal = erzeugeLautsprecherKanal({ speicher: this.geraet.speicher, kanal: this.geraet.kanal(), tabId: `tab${name}`, jetzt: () => this.uhr.jetzt() });
    this.ffs = new FalscherFeldStand(this.uhr);
    const felder = o.felder ?? [1];
    this.lage = o.feldStand === 'echt' ? new Lage({ felder, uhr: this.uhr }) : null;
    const versatz = o.serverVersatz ?? (() => 0);
    this.laufzeit = erzeugeHallLautsprecherLaufzeit({
      turnierId: 'hallencup-nord',
      felder,
      erzeugeTakt: () => this.takt.quelle,
      spieler: this.spieler,
      erzeugeFeldStand: () => {
        this.feldStandErzeugt += 1;
        return this.lage?.fs ?? this.ffs;
      },
      uhr: { serverNow: () => this.uhr.jetzt() + versatz(), sync: () => { this.syncAufrufe += 1; o.beiSync?.(); return Promise.resolve(true); } },
      uhrProbe: () => ({ wandMs: this.uhr.jetzt() + this.wandVersatz, monoMs: this.uhr.jetzt() }),
      sperre: erzeugeGeraeteSperre(this.geraet.sperren),
      kanal: this.kanal,
      wurdeVerworfen: o.wurdeVerworfen ?? false,
      tonWahl: { abpfiff: 'horn-2', halbzeit: 'horn-3' },
      gedaechtnisSpeicher: this.geraet.speicher,
    });
  }

  async starte({ aktivieren = true }: { aktivieren?: boolean } = {}): Promise<void> {
    this.laufzeit.start();
    await flush();
    if (aktivieren) {
      await this.laufzeit.tonAktivieren();
      await flush();
    }
  }

  /** Zeit im 10-ms-Raster vorrücken; nach jedem Schritt laufen die Versprechen der Runde. */
  async vor(ms: number, schritte: Array<{ um: number; tu: () => void }> = []): Promise<void> {
    const offen = [...schritte].sort((a, b) => a.um - b.um);
    const ziel = this.uhr.jetzt() + ms;
    while (this.uhr.jetzt() < ziel) {
      while (offen.length > 0 && offen[0].um <= this.uhr.jetzt()) {
        offen.shift()?.tu();
      }
      this.uhr.vorruecken(Math.min(10, ziel - this.uhr.jetzt()));
      await flush();
    }
    if (offen.some((schritt) => schritt.um <= ziel)) {
      throw new Error('Schritt am Ende des Zeitraums: Zeitraum verlängern');
    }
  }

  /** Erklungene Töne mit Serverzeit (ms) und Art; ein vor dem Start abgebrochener Ton erklingt nicht. */
  toene(): Array<{ at: number; art: HallTonArt; gain: number }> {
    return this.kontext.quellen.flatMap((quelle, i) => {
      const start = quelle.starts[0];
      const erklungen = start !== undefined && quelle.stops.every((stop) => stop === undefined || stop > start);
      const art = ART_JE_DAUER[quelle.buffer?.duration ?? 0] ?? 'abpfiff';
      return erklungen ? [{ at: Math.round(this.t0 + start * 1000), art, gain: this.kontext.gains[i]?.gain.value ?? 0 }] : [];
    });
  }

  /** Abgebrochene Töne (gestartet, dann vor dem Start gestoppt). */
  abgebrochen(): number {
    return this.kontext.quellen.filter((q) => q.starts[0] !== undefined && q.stops.some((stop) => stop !== undefined && stop <= q.starts[0])).length;
  }
}
