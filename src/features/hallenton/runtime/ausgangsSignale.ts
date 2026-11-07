/**
 * Starke Anzeichen für einen Wechsel des Audio-Ausgangs (H3b-1, @HT-047). Nur drei Anlässe zählen:
 * 1. `verzoegerung`: `outputLatency` weicht um mehr als 50 ms vom Wert beim letzten Testton ab
 * 2. `geraete`: `navigator.mediaDevices` meldet `devicechange`
 * 3. `unterbrochen`: die Ausgabe wechselte ohne Zutun der App von „running“ nach `suspended`/`interrupted`
 * Neuladen, Verdecken und Minimieren zählen nicht: die Signale hören nicht auf die Sichtbarkeit, und eine neue Seite
 * beginnt ohne Bezugswert und ohne Vorgeschichte. Gemeldet wird „seit dem letzten Lebenszeichen“: `abholen()` liefert
 * die Anzeichen und setzt zurück; ein gemeldeter Sprung der Verzögerung wird der neue Bezugswert (einmal melden).
 * Ein Messwert 0 gilt als „noch nicht gemessen“ (Spike 06.11.: 0 ms am Start, später 144 ms) und ist kein Bezugswert.
 */
export type AusgangsAnzeichen = 'verzoegerung' | 'geraete' | 'unterbrochen';

export const LATENZ_SPRUNG_SEK = 0.05;
const REIHENFOLGE: readonly AusgangsAnzeichen[] = ['verzoegerung', 'geraete', 'unterbrochen'];
const RUNDUNG = 1e-9;

export interface AusgangsKontext {
  readonly outputLatency?: number;
  readonly state: string;
  addEventListener(type: 'statechange', fn: () => void): void;
  removeEventListener(type: 'statechange', fn: () => void): void;
}

export interface GeraeteMelder {
  addEventListener(type: 'devicechange', fn: () => void): void;
  removeEventListener(type: 'devicechange', fn: () => void): void;
}

export interface AusgangsSignale {
  /** Nach einem gespielten Testton: die jetzige Verzögerung ist der Bezugswert. */
  testtonGespielt(): void;
  /** Verzögerung jetzt messen (z. B. im Takt), damit ein kurzer Sprung zwischen zwei Lebenszeichen nicht verloren geht. */
  messen(): void;
  /** Die App unterbricht die Ausgabe gleich selbst (`suspend()`): der nächste Wechsel zählt nicht. */
  eigeneUnterbrechung(): void;
  /** Anzeichen seit dem letzten Abholen, danach zurückgesetzt. */
  abholen(): AusgangsAnzeichen[];
  beenden(): void;
}

export function erzeugeAusgangsSignale({ kontext, geraete }: { kontext: AusgangsKontext; geraete: GeraeteMelder | null }): AusgangsSignale {
  const offen = new Set<AusgangsAnzeichen>();
  let bezug: number | null = null;
  let testtonErfolgt = false;
  let letzterZustand = kontext.state;
  let eigeneAusstehend = false;
  let beendet = false;

  const latenz = (): number | null => {
    const wert = kontext.outputLatency;
    return typeof wert === 'number' && Number.isFinite(wert) && wert > 0 ? wert : null;
  };

  const messen = (): void => {
    const jetzt = latenz();
    if (beendet || !testtonErfolgt || jetzt === null) {
      return;
    }
    if (bezug === null) {
      bezug = jetzt; // beim Testton noch nicht gemessen: der erste Messwert danach ist der Bezug
      return;
    }
    if (Math.abs(jetzt - bezug) > LATENZ_SPRUNG_SEK + RUNDUNG) {
      offen.add('verzoegerung');
      bezug = jetzt;
    }
  };

  const beiZustand = (): void => {
    const neu = kontext.state;
    const unterbrochen = letzterZustand === 'running' && (neu === 'suspended' || neu === 'interrupted');
    letzterZustand = neu;
    if (!unterbrochen) {
      return;
    }
    if (eigeneAusstehend) {
      eigeneAusstehend = false;
      return;
    }
    offen.add('unterbrochen');
  };

  const beiGeraeten = (): void => {
    offen.add('geraete');
  };

  kontext.addEventListener('statechange', beiZustand);
  geraete?.addEventListener('devicechange', beiGeraeten);

  return {
    testtonGespielt() {
      testtonErfolgt = true;
      bezug = latenz();
    },
    messen,
    eigeneUnterbrechung() {
      eigeneAusstehend = true;
    },
    abholen() {
      messen();
      const anzeichen = REIHENFOLGE.filter((a) => offen.has(a));
      offen.clear();
      return anzeichen;
    },
    beenden() {
      beendet = true;
      offen.clear();
      kontext.removeEventListener('statechange', beiZustand);
      geraete?.removeEventListener('devicechange', beiGeraeten);
    },
  };
}

/** Mit `navigator.mediaDevices` des Browsers (fehlt außerhalb sicherer Herkunft: dann ohne Geräte-Signal). */
export function erzeugeBrowserAusgangsSignale(kontext: AusgangsKontext): AusgangsSignale {
  const geraete: GeraeteMelder | null = typeof navigator !== 'undefined' && 'mediaDevices' in navigator ? navigator.mediaDevices : null;
  return erzeugeAusgangsSignale({ kontext, geraete });
}
