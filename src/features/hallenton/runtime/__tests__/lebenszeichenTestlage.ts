/**
 * Testlage des Lebenszeichens (H3b-3): ein Tab der Tonlaufzeit (`laufzeitTestlage.Tab`, echter Takt, Spieler, Sperren, Kanal)
 * mit echtem Lebenszeichen darauf – echte Melde-Sperre auf demselben gefälschten Gerät, echte Ausgangs-Signale auf dem
 * gefälschten AudioContext, Server-Doppel `FalscherHallServer`. `netz` schaltet nur das Netz dieses Tabs.
 */
import { FalscherHallServer } from '../../../../test/hallenton/falscherHallServer';
import { erzeugeAusgangsSignale, type GeraeteMelder } from '../ausgangsSignale';
import { erzeugeGeraeteSperre } from '../geraeteSperre';
import { erzeugeLebenszeichen, MELDE_SPERRE_NAME, type Lebenszeichen } from '../lautsprecherLebenszeichen';
import { flush } from './feldStandTestlage';
import { Tab, type TabOptionen } from './laufzeitTestlage';

export const TID = 'hallencup-nord';

/** `navigator.mediaDevices` zum Auslösen von `devicechange`. */
export class FalscheGeraeteMelder implements GeraeteMelder {
  private readonly fns = new Set<() => void>();
  addEventListener(_type: 'devicechange', fn: () => void): void {
    this.fns.add(fn);
  }
  removeEventListener(_type: 'devicechange', fn: () => void): void {
    this.fns.delete(fn);
  }
  melden(): void {
    for (const fn of [...this.fns]) {
      fn();
    }
  }
}

export interface LzOptionen extends TabOptionen {
  server: FalscherHallServer;
  deviceId?: string;
}

export class LzTab {
  readonly tab: Tab;
  readonly lz: Lebenszeichen;
  readonly name: string;
  readonly geraete = new FalscheGeraeteMelder();
  readonly abgeloest: number[][] = [];
  nachLebenszeichen = 0;
  netz = true;
  /** Nur die Quittung scheitert am Netz. */
  ackNetz = true;

  constructor(o: LzOptionen) {
    this.tab = new Tab(o);
    this.name = `tab${o.name ?? ''}`;
    const server = o.server;
    const ohneNetz = { ok: false as const, grund: 'netz' as const };
    this.lz = erzeugeLebenszeichen({
      turnierId: TID,
      felder: o.felder ?? [1],
      deviceId: o.deviceId ?? 'laptop',
      laufzeit: this.tab.laufzeit,
      spieler: this.tab.spieler,
      erzeugeAusgang: () => erzeugeAusgangsSignale({ kontext: this.tab.kontext, geraete: this.geraete }),
      sperre: erzeugeGeraeteSperre(this.tab.geraet.sperren, MELDE_SPERRE_NAME),
      kanal: this.tab.kanal,
      zeitgeber: this.tab.uhr.gruppe(`lz${o.name ?? ''}`),
      rpc: {
        heartbeat: (args) => (this.netz ? server.heartbeat(this.name, args) : Promise.resolve(ohneNetz)),
        ack: (args) => (this.netz && this.ackNetz ? server.ack(args) : Promise.resolve(ohneNetz)),
      },
      speicher: this.tab.geraet.speicher,
      abgeloest: (bleiben) => {
        this.tab.laufzeit.stop();
        this.abgeloest.push(bleiben);
      },
      nachLebenszeichen: () => {
        this.nachLebenszeichen += 1;
      },
    });
  }

  /** Wie der Baustein: Laufzeit und Lebenszeichen starten, optional danach „Ton aktivieren“. */
  async starte({ aktivieren = true }: { aktivieren?: boolean } = {}): Promise<void> {
    this.tab.laufzeit.start();
    this.lz.start();
    await flush();
    if (aktivieren) {
      await this.tab.laufzeit.tonAktivieren();
      await flush();
    }
  }

  /** Tab geschlossen: der Browser gibt beide Sperren frei. */
  schliessen(): void {
    this.lz.stop();
    this.tab.laufzeit.stop();
  }

  vor(ms: number, schritte: Array<{ um: number; tu: () => void }> = []): Promise<void> {
    return this.tab.vor(ms, schritte);
  }
}

export function lebenszeichenVon(server: FalscherHallServer, von: string): number {
  return server.lebenszeichen.filter((l) => l.von === von).length;
}
