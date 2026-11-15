/**
 * Wächter des gewählten Ausgangs (H4-6, @HT-054, @HT-055): hält Wahl, Liste der Ausgänge und Mikrofon-Erlaubnis dieses Tabs und
 * leitet daraus die Lage ab (`bewerteAusgang`, `core/hallenton/ausgang.ts`): `standard`, `ok`, `lost` (Ausgang verschwunden),
 * `unconfirmed` (Kennungen nicht lesbar oder `setSinkId` scheitert).
 *
 * - Die Wahl kommt aus `ausgangWahl.ts` (lokal je Gerät, `storage` in jeden Tab): Eine Wahl in Tab A wirkt im tönenden Tab B.
 * - `devicechange` liest die Ausgänge neu: Dock abgezogen → `lost`, wieder angesteckt → `ok` ohne neue Wahl (Rückkehr).
 * - Ohne gespeicherte Wahl liest der Wächter nichts und ruft nichts auf (Geräte ohne Wahl verhalten sich wie vor H4-6); erst ein
 *   Aufruf von `neuLesen()` (die Oberfläche) lässt ihn auch bei `devicechange` die Liste aktualisieren.
 * - Bis zum ersten Lesen gilt mit gespeicherter Wahl `unconfirmed` (im Zweifel kein Ton, nie ein stiller Wechsel auf „Standard“).
 * - Nichts davon verlässt das Gerät.
 */
import { bewerteAusgang, type AusgangLage, type GewaehlterAusgang, type MikrofonErlaubnis } from '../../../../core/hallenton';
import { echterZeitgeber, type Zeitgeber } from '../zeitgeber';
import type { AusgangListeQuelle, AusgangsListe } from './ausgangListe';
import type { AusgangWahl } from './ausgangWahl';

/** Was der Spieler vom Wächter braucht (nur Lage, Wahl, Anstoß, Fehlermeldung der Senke). */
export interface SpielerAusgang {
  /** Zeit für die Zeitgrenzen (Lesen, `setSinkId`, Gnadenfrist); im Test die manuelle Uhr. */
  readonly zeitgeber: Zeitgeber;
  lage(): AusgangLage;
  /** Die Ausgänge wurden mindestens einmal gelesen (oder das Lesen lief in die Zeitgrenze). */
  gelesen(): boolean;
  wahl(): GewaehlterAusgang | null;
  /** Lage oder Wahl hat sich geändert. */
  beobachten(fn: () => void): () => void;
  /** `setSinkId` mit der Kennung `id` ist gescheitert (`true`) bzw. gelungen (`false`). */
  senkeMelden(id: string, scheitert: boolean): void;
  /** Ausgänge neu lesen (z. B. nach `sinkchange`). */
  neuLesen(): Promise<void>;
}

export interface AusgangWaechter extends SpielerAusgang {
  liste(): AusgangsListe;
  erlaubnis(): MikrofonErlaubnis;
  beenden(): void;
}

export interface AusgangWaechterDeps {
  liste: AusgangListeQuelle;
  wahl: AusgangWahl;
  zeitgeber?: Zeitgeber;
}

/**
 * Zeitgrenze für das Lesen der Ausgänge und für `setSinkId` (ms): „im Zweifel kein Ton, aber nie dauerhaft tot“. Danach gilt die
 * zuletzt gelesene Liste weiter bzw. der Versuch als gescheitert (`output_unconfirmed`, nie still „Standard“).
 */
export const AUSGANG_ZEITGRENZE_MS = 2000;

const NICHT_GELESEN: AusgangsListe = { eintraege: [], lesbar: false };

export function erzeugeAusgangWaechter({ liste: quelle, wahl: wahlSpeicher, zeitgeber = echterZeitgeber }: AusgangWaechterDeps): AusgangWaechter {
  const zuhoerer = new Set<() => void>();
  let wahl: GewaehlterAusgang | null = wahlSpeicher.lesen();
  let liste: AusgangsListe = NICHT_GELESEN;
  let erlaubnis: MikrofonErlaubnis = null;
  let fehlerId: string | null = null; // `setSinkId` mit dieser Kennung ist gescheitert
  let gesetztId: string | null = null; // diese Kennung wurde in dieser Sitzung erfolgreich gesetzt
  let liest = wahl !== null;
  let lauf = 0;
  let beendet = false;
  let gelesen = false;

  const berechneLage = (): AusgangLage => bewerteAusgang({
    wahl, eintraege: liste.eintraege, erlaubnis, senkeScheitert: fehlerId !== null && fehlerId === wahl?.id,
    inSitzungGesetzt: gesetztId !== null && gesetztId === wahl?.id,
  });
  let lage: AusgangLage = berechneLage();

  const melden = (): void => {
    for (const fn of [...zuhoerer]) {
      try {
        fn();
      } catch {
        // ein werfender Zuhörer darf die übrigen und das Lesen nicht stören (kein Text nach außen)
      }
    }
  };

  /** Lage neu rechnen; `true`, wenn sich etwas Sichtbares geändert hat (dann geht die Meldung an alle). */
  const auswerten = (geaendert: boolean): void => {
    const neu = berechneLage();
    if (neu === 'lost') {
      gesetztId = null; // nachweislich verschwunden: nach der Rückkehr gilt wieder nur, was lesbar bestätigt ist
    }
    if (neu !== lage || geaendert) {
      lage = neu;
      melden();
    }
  };

  let runde: Promise<void> = Promise.resolve();
  /**
   * Liest Ausgänge und Erlaubnis neu; eine überholte Runde wartet auf die neueste (wer wartet, sieht erst das Endergebnis).
   * Antwortet der Browser nicht innerhalb der Zeitgrenze, endet die Runde ohne Änderung (die zuletzt gelesene Liste gilt weiter);
   * eine später doch eintreffende Antwort gilt nur, wenn keine neuere Runde läuft.
   */
  const neuLesen = (): Promise<void> => {
    liest = true;
    const meine = ++lauf;
    const lesen = (async (): Promise<void> => {
      const [neueListe, neueErlaubnis] = await Promise.all([quelle.lesen(), quelle.erlaubnis()]);
      if (beendet) {
        return;
      }
      if (meine !== lauf) {
        await runde; // eine neuere Runde läuft
        return;
      }
      gelesen = true;
      const geaendert = JSON.stringify(neueListe) !== JSON.stringify(liste) || neueErlaubnis !== erlaubnis;
      liste = neueListe;
      erlaubnis = neueErlaubnis;
      auswerten(geaendert);
    })();
    const diese = new Promise<void>((fertig) => {
      const ab = zeitgeber.spaeter(() => {
        if (meine === lauf && !gelesen) {
          gelesen = true; // ohne Antwort: nicht ewig „wird gelesen“; Lage bleibt, wie sie war
          auswerten(true);
        }
        fertig();
      }, AUSGANG_ZEITGRENZE_MS);
      void lesen.then(() => { ab(); fertig(); }, () => { ab(); fertig(); });
    });
    runde = diese;
    return diese;
  };

  const beiWahlWechsel = (): void => {
    const neu = wahlSpeicher.lesen();
    if (neu?.id !== wahl?.id) {
      gesetztId = null; // eine andere Kennung: in dieser Sitzung noch nicht gesetzt
    }
    wahl = neu;
    fehlerId = null; // neue Wahl, „Bestätigen“ in einem anderen Tab: der alte Fehler gilt nicht mehr, `setSinkId` wird neu versucht
    auswerten(true);
    if (neu !== null || liest) {
      void neuLesen(); // „Bestätigen“ in einem anderen Tab oder neue Wahl: frisch lesen
    }
  };

  const abWahl = wahlSpeicher.beobachten(beiWahlWechsel);
  const abGeraete = quelle.beiGeraeteWechsel(() => {
    fehlerId = null; // ein zurückgekehrter Ausgang soll neu versucht werden (Rückkehr ohne neue Wahl, @HT-054)
    if (liest) {
      void neuLesen();
    }
  });
  if (wahl !== null) {
    void neuLesen();
  }

  return {
    zeitgeber,
    lage: () => lage,
    gelesen: () => gelesen,
    wahl: () => wahl,
    liste: () => liste,
    erlaubnis: () => erlaubnis,
    beobachten(fn) {
      zuhoerer.add(fn);
      return () => {
        zuhoerer.delete(fn);
      };
    },
    neuLesen,
    senkeMelden(id, scheitert) {
      if (scheitert ? fehlerId === id && gesetztId !== id : gesetztId === id && fehlerId !== id) {
        return;
      }
      if (scheitert) {
        fehlerId = id;
        gesetztId = gesetztId === id ? null : gesetztId;
      } else {
        gesetztId = id;
        fehlerId = fehlerId === id ? null : fehlerId;
      }
      auswerten(false);
    },
    beenden() {
      beendet = true;
      abWahl();
      abGeraete();
      zuhoerer.clear();
    },
  };
}
