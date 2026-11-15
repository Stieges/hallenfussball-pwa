/**
 * Liste der Audio-Ausgänge dieses Geräts (H4-6, @HT-053): `enumerateDevices`, Namen nur nach freiwilliger Mikrofon-Freigabe.
 *
 * Dies ist die EINZIGE Stelle der App mit `getUserMedia` (ESLint-Sperre `no-restricted-syntax`): Eine Mikrofon-Freigabe gilt für
 * die ganze Herkunft, jede weitere Stelle könnte die Hallen-App unbemerkt am Mikrofon lauschen lassen. Hier wird nichts
 * aufgenommen: der Strom wird sofort beendet (`track.stop()`), danach liest `enumerateDevices` die Namen.
 *
 * Ohne Freigabe liefert der Browser einen Eintrag ohne Namen und ohne Kennung (V-AUSGANG Teil 1): `lesen()` gibt dann eine leere
 * Liste zurück, `lesbar: false` – die Oberfläche zeigt nur „Standard“. Nichts wirft; fehlt `mediaDevices` (unsichere Herkunft),
 * ist die Liste leer. Namen und Kennungen verlassen das Gerät nie: nicht ins Lebenszeichen, nicht in Sentry, nicht in Logs.
 */
import { sortiereAusgaenge, type AusgangEintrag, type MikrofonErlaubnis } from '../../../../core/hallenton';

/** Ausschnitt von `MediaDeviceInfo`. */
export interface GeraeteInfo {
  readonly deviceId: string;
  readonly groupId: string;
  readonly kind: string;
  readonly label: string;
}

interface StromSpur { stop(): void }
interface Strom { getTracks(): StromSpur[] }

/** Ausschnitt von `navigator.mediaDevices`; im Test ersetzt ihn `src/test/hallenton/falscheMedienGeraete.ts`. */
export interface MedienGeraete {
  enumerateDevices(): Promise<readonly GeraeteInfo[]>;
  getUserMedia(auswahl: { audio: true }): Promise<Strom>;
  addEventListener(type: 'devicechange', fn: () => void): void;
  removeEventListener(type: 'devicechange', fn: () => void): void;
}

/** Ausschnitt von `navigator.permissions`. */
export interface Berechtigungen {
  query(beschreibung: { name: 'microphone' }): Promise<{ readonly state: string }>;
}

export interface AusgangsListe {
  /** Alle Ausgänge mit Kennung, sortiert; leer, wenn der Browser keine herausgibt. */
  eintraege: readonly AusgangEintrag[];
  /** Kennungen und Namen sind lesbar (Mikrofon erlaubt). */
  lesbar: boolean;
}

export interface AusgangListeQuelle {
  /** Der Browser kann Ausgänge auflisten (`mediaDevices` da). */
  verfuegbar(): boolean;
  lesen(): Promise<AusgangsListe>;
  erlaubnis(): Promise<MikrofonErlaubnis>;
  /** Auf Änderungen der Ausgänge hören (`devicechange`); gibt die Abmeldung zurück. */
  beiGeraeteWechsel(fn: () => void): () => void;
  /**
   * Nutzeraktion: einmal das Mikrofon erlauben lassen, den Strom SOFORT beenden. `false`, wenn abgelehnt oder nicht möglich.
   * Muss synchron in der Geste aufgerufen werden (vor jedem `await`).
   */
  mikrofonErlauben(): Promise<boolean>;
}

const LEER: AusgangsListe = { eintraege: [], lesbar: false };

export function erzeugeAusgangListe({ geraete, berechtigungen }: { geraete: MedienGeraete | null; berechtigungen: Berechtigungen | null }): AusgangListeQuelle {
  return {
    verfuegbar: () => geraete !== null,
    async lesen() {
      if (!geraete) {
        return LEER;
      }
      try {
        const alle = await geraete.enumerateDevices();
        const roh = alle.filter((g) => g.kind === 'audiooutput').map((g) => ({ id: g.deviceId, name: g.label, gruppe: g.groupId }));
        const eintraege = sortiereAusgaenge(roh);
        return { eintraege, lesbar: eintraege.length > 0 };
      } catch {
        return LEER;
      }
    },
    async erlaubnis() {
      if (!berechtigungen) {
        return null;
      }
      try {
        const { state } = await berechtigungen.query({ name: 'microphone' });
        return state === 'granted' || state === 'denied' || state === 'prompt' ? state : null;
      } catch {
        return null; // z. B. Safari: `microphone` nicht abfragbar
      }
    },
    beiGeraeteWechsel(fn) {
      geraete?.addEventListener('devicechange', fn);
      return () => geraete?.removeEventListener('devicechange', fn);
    },
    async mikrofonErlauben() {
      if (!geraete) {
        return false;
      }
      try {
        const strom = await geraete.getUserMedia({ audio: true });
        for (const spur of strom.getTracks()) {
          spur.stop(); // nichts wird aufgenommen: das Mikrofon ist sofort wieder frei
        }
        return true;
      } catch {
        return false; // abgelehnt, kein Mikrofon oder gesperrt
      }
    },
  };
}

/** Mit `navigator.mediaDevices` und `navigator.permissions` des Browsers (beides kann fehlen). */
export function erzeugeBrowserAusgangListe(): AusgangListeQuelle {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  return erzeugeAusgangListe({
    geraete: nav && 'mediaDevices' in nav ? nav.mediaDevices : null,
    berechtigungen: nav && 'permissions' in nav ? nav.permissions : null,
  });
}
