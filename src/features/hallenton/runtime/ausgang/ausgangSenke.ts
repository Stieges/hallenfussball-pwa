/**
 * Senke des Spielers (H4-6, @HT-053 bis @HT-055): setzt den gewählten Ausgang am `AudioContext` (`setSinkId`, Weg B aus
 * V-AUSGANG), bestätigt ihn über `sinkchange` und liefert dem Spieler die Zustände `output_lost` / `output_unconfirmed`.
 *
 * - Ohne gespeicherte Wahl (alle heutigen Geräte) ruft sie `setSinkId` nie auf: Ton über den Standard-Ausgang wie vor H4-6.
 *   Nur eine Wahl, die zurück auf „Standard“ geht, setzt `''`.
 * - `ok`: Ausgang gesetzt, dann „bereit“. Solange er noch nicht gesetzt ist, spielt der Spieler nichts (nie kurz über den Standard).
 * - `lost` / `unconfirmed`: kein `setSinkId`, kein Ton, nie ein stiller Wechsel auf „Standard“. Der Spieler bricht alles
 *   Geplante ab (`beiVerlust`), damit nach der Rückkehr nichts nachgeholt wird (@HT-013, 5-s-Regel).
 * - Rückkehr ohne neue Wahl (@HT-054) und Bestätigen (@HT-055): `setSinkId` mit der gespeicherten Kennung, danach ein `resume()`
 *   – nur ohne Gewähr (ohne Nutzergeste lehnt der Browser es evtl. ab; dann bleibt „Ton nicht aktiviert“ und ein Klick genügt).
 * - `sinkchange` mit einem anderen Ausgang als gewählt (der Browser wechselte von selbst): erst neu lesen, dann den gewählten
 *   wieder setzen oder, wenn er fehlt, `lost`.
 * Fehlertexte des Browsers (sie können Kennungen enthalten) werden nie weitergegeben.
 */
import type { AusgangLage } from '../../../../core/hallenton';
import type { SpielerAusgang } from './ausgangWaechter';

/** Ausschnitt des `AudioContext` für die Senke. */
export interface SenkenKontext {
  readonly state: string;
  readonly sinkId?: string | { readonly type: string };
  setSinkId?(sinkId: string): Promise<void>;
  resume(): Promise<void>;
  addEventListener(type: 'sinkchange', fn: () => void): void;
  removeEventListener(type: 'sinkchange', fn: () => void): void;
}

export type AusgangsZustand = 'output_lost' | 'output_unconfirmed';

export interface Senke {
  /**
   * Der `AudioContext` hat den Zustand gewechselt. Steht er still, obwohl ein Ausgang gewählt ist, prüft die Senke sofort, ob der
   * Ausgang verschwunden ist (Abziehen: `devicechange` und `suspended` kommen in beliebiger Reihenfolge) – bis dahin gilt
   * `output_unconfirmed`, damit das Gerät die Sperre nicht kurz als „Ton nicht aktiviert“ loslässt.
   */
  beiStatus(): void;
  /** Der Spieler hat seinen `AudioContext` erzeugt: Ausgang setzen, auf `sinkchange` hören. */
  kontextErzeugt(): void;
  /** Wartet, bis der gerade laufende Wechsel des Ausgangs durch ist. */
  fertig(): Promise<void>;
  /** `output_lost`/`output_unconfirmed` oder `null`. */
  zustand(): AusgangsZustand | null;
  /** Der Ausgang am Kontext ist der gewünschte (ohne Wahl: immer, wie vor H4-6). */
  bereit(): boolean;
  beenden(): void;
}

export interface SenkeDeps {
  /** `null`: kein Wächter (Tests, ältere Einbauten) – alles wie vor H4-6. */
  ausgang: SpielerAusgang | null;
  kontext: () => SenkenKontext | null;
  /** Lage oder Ausgang geändert: der Spieler bewertet seinen Zustand neu. */
  geaendert: () => void;
  /** Der Ausgang ist verloren oder unbestätigt: alles Geplante abbrechen. */
  beiVerlust: () => void;
  /** Hat dieser Tab „Ton aktivieren“ erlebt? Nur dann versucht die Senke nach der Rückkehr ein `resume()`. */
  darfResume: () => boolean;
}

const KEINER = '\u0000keiner';

const kontextLaeuft = (k: SenkenKontext): boolean => k.state === 'running';

export function erzeugeSenke({ ausgang, kontext, geaendert, beiVerlust, darfResume }: SenkeDeps): Senke {
  let angewendet: string | undefined; // zuletzt gesetzte Kennung; `''` = Standard; `undefined` = nie gesetzt
  let kette: Promise<void> = Promise.resolve();
  let fehlteZuvor = false;
  let beendet = false;
  let pruefungen = 0;
  let abSinkchange: (() => void) | null = null;

  const lage = (): AusgangLage => ausgang?.lage() ?? 'standard';

  const gewuenscht = (): string | null => {
    const l = lage();
    if (l === 'standard') {
      return '';
    }
    return l === 'ok' ? (ausgang?.wahl()?.id ?? null) : null;
  };

  const einmal = async (): Promise<void> => {
    const k = kontext();
    const ziel = gewuenscht();
    if (!ausgang || !k || ziel === null || (angewendet ?? '') === ziel) {
      return; // ohne Wahl und ohne frühere Wahl: kein Aufruf
    }
    if (typeof k.setSinkId !== 'function') {
      if (ziel !== '') {
        ausgang.senkeMelden(ziel, true); // der Browser kann keinen Ausgang wählen: nie still über „Standard“
      }
      return;
    }
    try {
      await k.setSinkId(ziel);
    } catch {
      if (ziel !== '') {
        ausgang.senkeMelden(ziel, true); // Kennung nicht mehr gültig o. Ä.: unbestätigt (nie den Browsertext weitergeben)
      }
      return;
    }
    angewendet = ziel;
    if (ziel !== '') {
      ausgang.senkeMelden(ziel, false);
    }
    if (fehlteZuvor && darfResume()) {
      fehlteZuvor = false;
      void k.resume().catch(() => undefined); // ohne Gewähr; nicht abwarten (der Browser kann es offen lassen)
    }
  };

  const anwenden = (): Promise<void> => {
    kette = kette.then(einmal).then(() => {
      if (!beendet) {
        geaendert();
      }
    });
    return kette;
  };

  const beiLage = (): void => {
    const l = lage();
    if (l === 'lost' || l === 'unconfirmed') {
      fehlteZuvor = true;
      angewendet = KEINER; // nach der Rückkehr muss `setSinkId` neu gesetzt werden, auch mit derselben Kennung
      beiVerlust();
    }
    geaendert();
    void anwenden();
  };

  const beiSinkchange = (): void => {
    const k = kontext();
    if (!k || !ausgang) {
      return;
    }
    angewendet = typeof k.sinkId === 'string' ? k.sinkId : KEINER;
    geaendert();
    void ausgang.neuLesen().then(anwenden); // fehlt der gewählte Ausgang jetzt, wird die Lage `lost`; sonst setzen wir ihn wieder
  };

  const abLage = ausgang?.beobachten(beiLage) ?? null;
  if (ausgang) {
    const l = lage();
    fehlteZuvor = l === 'lost' || l === 'unconfirmed';
  }

  return {
    kontextErzeugt() {
      const k = kontext();
      if (!k || !ausgang) {
        return; // ohne Wächter nichts hören, nichts setzen
      }
      k.addEventListener('sinkchange', beiSinkchange);
      abSinkchange = () => k.removeEventListener('sinkchange', beiSinkchange);
      void anwenden();
    },
    fertig: () => kette,
    beiStatus() {
      const k = kontext();
      if (!ausgang || !k || ausgang.wahl() === null || lage() !== 'ok' || kontextLaeuft(k)) {
        return;
      }
      pruefungen += 1;
      void ausgang.neuLesen().finally(() => {
        pruefungen -= 1;
        if (!beendet) {
          geaendert();
        }
      });
    },
    zustand() {
      const l = lage();
      if (pruefungen > 0 && l === 'ok') {
        return 'output_unconfirmed'; // Ausgang wird geprüft: nie kurz „Ton nicht aktiviert“ (die Sperre bleibt)
      }
      return l === 'lost' ? 'output_lost' : l === 'unconfirmed' ? 'output_unconfirmed' : null;
    },
    bereit() {
      const ziel = gewuenscht();
      return ziel !== null && (angewendet ?? '') === ziel;
    },
    beenden() {
      beendet = true;
      abLage?.();
      abSinkchange?.();
    },
  };
}
