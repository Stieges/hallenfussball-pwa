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
import type { AusgangListeQuelle, AusgangsListe } from './ausgangListe';
import type { AusgangWahl } from './ausgangWahl';

/** Was der Spieler vom Wächter braucht (nur Lage, Wahl, Anstoß, Fehlermeldung der Senke). */
export interface SpielerAusgang {
  lage(): AusgangLage;
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
}

const NICHT_GELESEN: AusgangsListe = { eintraege: [], lesbar: false };

export function erzeugeAusgangWaechter({ liste: quelle, wahl: wahlSpeicher }: AusgangWaechterDeps): AusgangWaechter {
  const zuhoerer = new Set<() => void>();
  let wahl: GewaehlterAusgang | null = wahlSpeicher.lesen();
  let liste: AusgangsListe = NICHT_GELESEN;
  let erlaubnis: MikrofonErlaubnis = null;
  let senke: { id: string; scheitert: boolean } | null = null;
  let liest = wahl !== null;
  let lauf = 0;
  let beendet = false;

  const berechneLage = (): AusgangLage => bewerteAusgang({
    wahl, eintraege: liste.eintraege, erlaubnis, senkeScheitert: senke !== null && senke.scheitert && senke.id === wahl?.id,
  });
  let lage: AusgangLage = berechneLage();

  const melden = (): void => {
    for (const fn of [...zuhoerer]) {
      fn();
    }
  };

  /** Lage neu rechnen; `true`, wenn sich etwas Sichtbares geändert hat (dann geht die Meldung an alle). */
  const auswerten = (geaendert: boolean): void => {
    const neu = berechneLage();
    if (neu !== lage || geaendert) {
      lage = neu;
      melden();
    }
  };

  let runde: Promise<void> = Promise.resolve();
  /** Liest Ausgänge und Erlaubnis neu; eine überholte Runde wartet auf die neueste (wer wartet, sieht erst das Endergebnis). */
  const neuLesen = (): Promise<void> => {
    liest = true;
    const meine = ++lauf;
    const diese = (async (): Promise<void> => {
      const [neueListe, neueErlaubnis] = await Promise.all([quelle.lesen(), quelle.erlaubnis()]);
      if (beendet) {
        return;
      }
      if (meine !== lauf) {
        await runde; // eine neuere Runde läuft
        return;
      }
      const geaendert = JSON.stringify(neueListe) !== JSON.stringify(liste) || neueErlaubnis !== erlaubnis;
      liste = neueListe;
      erlaubnis = neueErlaubnis;
      auswerten(geaendert);
    })();
    runde = diese;
    return diese;
  };

  const beiWahlWechsel = (): void => {
    const neu = wahlSpeicher.lesen();
    wahl = neu;
    senke = null; // neue Wahl, „Bestätigen“ in einem anderen Tab: der alte Fehler gilt nicht mehr, `setSinkId` wird neu versucht
    auswerten(true);
    if (neu !== null || liest) {
      void neuLesen(); // „Bestätigen“ in einem anderen Tab oder neue Wahl: frisch lesen
    }
  };

  const abWahl = wahlSpeicher.beobachten(beiWahlWechsel);
  const abGeraete = quelle.beiGeraeteWechsel(() => {
    senke = null; // ein zurückgekehrter Ausgang soll neu versucht werden (Rückkehr ohne neue Wahl, @HT-054)
    if (liest) {
      void neuLesen();
    }
  });
  if (wahl !== null) {
    void neuLesen();
  }

  return {
    lage: () => lage,
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
      if (senke?.id === id && senke.scheitert === scheitert) {
        return;
      }
      senke = { id, scheitert };
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
