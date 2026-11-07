/**
 * Reload-Tor des Hallen-Lautsprechers für alle Tabs eines Geräts (H3b-2b, Plan „Schutz – Neuladen bei neuer Version“):
 * Solange der Lautsprecher auf diesem Gerät für ein Feld bereit ist (Meldung im `lautsprecherKanal`), hält jeder Tab einen
 * Halter des zusammensetzbaren Tors (`attachReloadGate`), der nein sagt. Sonst lüde `vite-plugin-pwa` über `controlling`
 * alle Tabs neu, und die Nutzergeste „Ton aktivieren“ wäre weg (@HT-013). Ist er nicht (mehr) bereit oder veraltet die
 * Meldung, meldet sich der Halter ab; dann gilt wieder der Leerlauf-Pfad wie ohne Lautsprecher.
 *
 * Auch der Eilpfad des Monitors (@ME-032) wartet, solange der Lautsprecher bereit ist (`blocksUrgent`, Review k5).
 * Ohne Meldung kostet das nichts: Der Tab hört nur auf den Kanal. Nur solange der Halter angemeldet ist, prüft er alle 5 s,
 * ob die Meldung veraltet ist (Tab mit dem Lautsprecher abgestürzt).
 */
import type { ReloadGate } from '../../../lib/swRegistration';
import { bereiteLautsprecherFeldIds, MELDUNG_ERNEUERN_MS, type LautsprecherKanal } from './lautsprecherKanal';
import type { Zeitgeber } from './zeitgeber';

export interface LautsprecherReloadTorDeps {
  kanal: LautsprecherKanal;
  halteTor: (gate: ReloadGate) => () => void;
  zeitgeber: Pick<Zeitgeber, 'wiederholen'>;
}

export function verbindeLautsprecherReloadTor({ kanal, halteTor, zeitgeber }: LautsprecherReloadTorDeps): () => void {
  let abmelden: (() => void) | null = null;
  let pruefTakt: (() => void) | null = null;
  const bereit = (): boolean => bereiteLautsprecherFeldIds(kanal.lesen()).length > 0;

  const loesen = (): void => {
    pruefTakt?.();
    pruefTakt = null;
    abmelden?.();
    abmelden = null;
  };

  const pruefen = (): void => {
    if (bereit() && abmelden === null) {
      abmelden = halteTor({ allowsReload: () => !bereit(), blocksUrgent: true });
      pruefTakt = zeitgeber.wiederholen(pruefen, MELDUNG_ERNEUERN_MS);
    } else if (!bereit() && abmelden !== null) {
      loesen();
    }
  };

  const nichtMehrHoeren = kanal.beobachten(pruefen);
  pruefen();
  return () => {
    nichtMehrHoeren();
    loesen();
  };
}
