/**
 * useLautsprecherAbmelden – „Abmelden“ an der Karte eines Felds mit Hallen-Lautsprecher (H4-11b, @HT-057): die Turnierleitung meldet den Lautsprecher ab, auch
 * wenn es ein ANDERES Gerät ist („meldet sich nicht“, verlorenes Tablet).
 *
 * Regel (Fixrunde 1): Es wird NIE abgemeldet, ohne dass unmittelbar davor die Rückfrage(n) für genau diesen Stand bestätigt wurden.
 * - Tipp → erste Rückfrage (Feld, Gerätename, Folge). Läuft auf dem Feld ein Spiel, folgt nach dem Ja eine zweite Rückfrage als Gefahr-Dialog (@OB-014: Fokus auf „Abbrechen“,
 *   Enter löst nichts aus), die ebenfalls Feld, Spiel und Gerätename nennt (@HT-017-Muster: danach ertönt kein Abpfiff).
 * - Direkt vor dem Aufruf (nach dem letzten Ja) wird der AKTUELLE Stand der Karte mit dem der Rückfrage verglichen (Lautsprecher da, Gerätename, eigenes Gerät, Zeitpunkt der Zuordnung
 *   – erkennt ein gleichnamiges Gerät –, laufendes Spiel); ist der Stand inzwischen nicht mehr aktuell lesbar (kein Netz), geht ebenfalls nichts raus. Hat sich
 *   etwas geändert (z. B. Gerät B hat das Feld übernommen), geht nichts raus: die Rückfrage öffnet sich mit dem neuen Stand erneut; ist kein Lautsprecher mehr da, schließt sie sich und
 *   ein Hinweis sagt es. Das Restfenster: der Client kennt nur den Stand der letzten Statusabfrage (Takt 5 s) – eine Übernahme in den letzten Sekunden vor dem Tipp sieht er nicht,
 *   und der Server löscht beim Abmelden jede Zuordnung des Felds.
 * - „Erneut versuchen“ führt wieder über `anfragen(feld)`, also über die Rückfragen für den dann aktuellen Stand; es meldet nie direkt ab.
 * - Ein anderes Gerät: `hall_speaker_unassign` über `meldeLautsprecherAb`. Ohne aktuellen Stand (kein Netz) kein Aufruf, der Hinweis sagt es. Ohne Recht am Server
 *   (`kein_recht`-Stand) wird die Taste gar nicht angeboten.
 * - DIESES Gerät: der bestehende Weg des Schalters (`feldAbmelden`, beim letzten Feld `ausschalten`): lokal sofort, ohne Netz gemerkt und nachgeholt (@HT-038).
 * Gerätenamen stehen nur im Text der Rückfragen, nie in einem Attribut.
 */
import { useCallback, useEffect, useState } from 'react';
import type { HallErgebnis, HallFehlerGrund } from '../../../core/repositories/hallentonRpc';
import { meldeLautsprecherAb } from '../hallAbmelden';
import type { HallStatusStand } from '../runtime/hallStatusAbfrage';
import type { HallLautsprecher } from '../useHallLautsprecher';
import type { FeldKarte } from './feldKarten';

/** Der Grund, warum nicht abgemeldet wurde; `weg` = inzwischen ist an dem Feld kein Hallen-Lautsprecher mehr (nichts zu tun). */
export type AbmeldenFehler = HallFehlerGrund | 'weg';

export interface AbmeldenFrage {
  feld: number;
  /** Name des Geräts, wie er in der Verwaltung steht. */
  geraetName: string;
  /** Der Lautsprecher ist dieses Gerät. */
  eigenes: boolean;
  /** 1 = erste Rückfrage, 2 = zweite Rückfrage bei laufendem Spiel. */
  stufe: 1 | 2;
  /** Nummer des laufenden Spiels (nur Stufe 2). */
  spiel?: number;
  /** Zeitpunkt der Zuordnung am Server (intern, nie anzeigen): erkennt ein gleichnamiges Gerät, das inzwischen übernommen hat. */
  zuordnung?: number;
}

export interface LautsprecherAbmelden {
  /** Die offene Rückfrage (`null`: keine). */
  frage: AbmeldenFrage | null;
  /** Felder, für die gerade ein Abmelden läuft. */
  laeuft: ReadonlySet<number>;
  /** Warum das Abmelden des Felds nicht geklappt hat (der Zustand der Karte ist dann unverändert). */
  fehler: Readonly<Record<number, AbmeldenFehler>>;
  /** Felder, die in dieser Sitzung abgemeldet wurden (kurze Bestätigung an der Karte, bis sich der Stand ändert). */
  abgemeldet: ReadonlySet<number>;
  /** Die Taste „Abmelden“ ist an der Karte des Felds zu zeigen. */
  anbieten(karte: FeldKarte): boolean;
  anfragen(feld: number): void;
  bestaetigen(): void;
  abbrechen(): void;
  /** „Erneut versuchen“ nach einem Fehler: wieder über die Rückfragen. */
  nochmal(feld: number): void;
}

export interface AbmeldenEingabe {
  tournamentId: string;
  karten: readonly FeldKarte[];
  stand: HallStatusStand;
  /** `useCan('manageScreens')` ohne Ausnahme: nach dem Turnierende falsch. */
  darfAendern: boolean;
  lautsprecher: Pick<HallLautsprecher, 'rolle' | 'felder' | 'feldAbmelden' | 'ausschalten'>;
  /** Feld → Nummer des angepfiffenen Spiels. */
  laufendeSpiele: ReadonlyMap<number, number>;
}

/** Der Aufruf, der ein Feld eines anderen Geräts am Server abmeldet (`meldeLautsprecherAb`); der Prüfstand der Bilder setzt einen anderen ein. */
export type MeldeAb = (turnierId: string, feld: number) => Promise<HallErgebnis<unknown>>;

export function useLautsprecherAbmelden({ tournamentId, karten, stand, darfAendern, lautsprecher, laufendeSpiele }: AbmeldenEingabe, melde: MeldeAb = meldeLautsprecherAb): LautsprecherAbmelden {
  const [frage, setFrage] = useState<AbmeldenFrage | null>(null);
  const [laeuft, setLaeuft] = useState<ReadonlySet<number>>(new Set());
  const [fehler, setFehler] = useState<Readonly<Record<number, AbmeldenFehler>>>({});
  const [abgemeldet, setAbgemeldet] = useState<ReadonlySet<number>>(new Set());
  const { rolle, felder, feldAbmelden, ausschalten } = lautsprecher;

  const anbieten = useCallback((karte: FeldKarte): boolean => darfAendern && stand !== 'kein_recht' && karte.zustand.art !== 'keinLautsprecher', [darfAendern, stand]);
  const eigenesFeld = useCallback((karte: FeldKarte): boolean => karte.eigenesGeraet && rolle === 'diesesTurnier' && felder.includes(karte.feld), [rolle, felder]);
  const setzeFehler = useCallback((feld: number, grund: AbmeldenFehler | null): void => {
    setFehler((alt) => {
      const rest = Object.fromEntries(Object.entries(alt).filter(([f]) => Number(f) !== feld));
      return grund === null ? rest : { ...rest, [feld]: grund };
    });
  }, []);

  const ausfuehren = useCallback(async (feld: number, eigenes: boolean): Promise<void> => {
    setLaeuft((alt) => new Set(alt).add(feld));
    setzeFehler(feld, null);
    let ergebnis: HallErgebnis<unknown> | null;
    if (eigenes) {
      // der bestehende Weg des Schalters: das letzte Feld schaltet das Gerät ganz aus
      ergebnis = rolle === 'diesesTurnier' && felder.length <= 1 ? await ausschalten() : await feldAbmelden(feld);
    } else {
      ergebnis = await melde(tournamentId, feld);
    }
    setLaeuft((alt) => { const neu = new Set(alt); neu.delete(feld); return neu; });
    // am eigenen Gerät wirkt es lokal sofort; ohne Netz holt das Gerät die Abmeldung nach (@HT-038), das ist kein Fehlschlag
    if (ergebnis !== null && !ergebnis.ok && !(eigenes && ergebnis.grund === 'netz')) {
      setzeFehler(feld, ergebnis.grund);
    } else {
      setAbgemeldet((alt) => new Set(alt).add(feld));
    }
  }, [tournamentId, rolle, felder, feldAbmelden, ausschalten, melde, setzeFehler]);

  /** Der aktuelle Stand der Karte, wie ihn die Rückfrage nennt; `null`: es gibt dort keinen (anzubietenden) Lautsprecher mehr. */
  const aktuell = useCallback((feld: number): { geraetName: string; eigenes: boolean; spiel: number | undefined; zuordnung: number | undefined } | null => {
    const karte = karten.find((k) => k.feld === feld);
    return karte === undefined || !anbieten(karte) ? null : { geraetName: karte.geraet?.name ?? '', eigenes: eigenesFeld(karte), spiel: laufendeSpiele.get(feld), zuordnung: karte.zuordnung };
  }, [karten, anbieten, eigenesFeld, laufendeSpiele]);

  const anfragen = useCallback((feld: number): void => {
    const jetzt = aktuell(feld);
    if (jetzt === null || stand === 'laedt') {
      return; // die erste Antwort steht noch aus: die Taste ist bis dahin aus
    }
    if (!jetzt.eigenes && stand !== 'aktuell') {
      setzeFehler(feld, 'netz'); // ohne aktuellen Stand kein Aufruf: der Hinweis sagt es, nichts geschieht still
      return;
    }
    setzeFehler(feld, null);
    setAbgemeldet((alt) => { const neu = new Set(alt); neu.delete(feld); return neu; });
    setFrage({ feld, geraetName: jetzt.geraetName, eigenes: jetzt.eigenes, stufe: 1, zuordnung: jetzt.zuordnung });
  }, [aktuell, stand, setzeFehler]);

  const bestaetigen = useCallback((): void => {
    const f = frage;
    if (f === null) {
      return;
    }
    const jetzt = aktuell(f.feld);
    if (jetzt === null) {
      setFrage(null); // inzwischen kein Lautsprecher mehr: nichts zu tun, kein Aufruf
      setzeFehler(f.feld, 'weg');
      return;
    }
    if (!jetzt.eigenes && stand !== 'aktuell') {
      setFrage(null); // zwischen Frage und Ja ist der Stand nicht mehr aktuell lesbar (kein Netz): kein Aufruf, der Hinweis führt über „Erneut versuchen“ wieder durch die Rückfragen
      setzeFehler(f.feld, 'netz');
      return;
    }
    if (jetzt.geraetName !== f.geraetName || jetzt.eigenes !== f.eigenes || jetzt.zuordnung !== f.zuordnung) {
      setFrage({ feld: f.feld, geraetName: jetzt.geraetName, eigenes: jetzt.eigenes, stufe: 1, zuordnung: jetzt.zuordnung }); // anderes (oder gleichnamiges, neu zugeordnetes) Gerät als genannt: noch einmal fragen, mit dem neuen Stand
      return;
    }
    if (jetzt.spiel !== undefined && (f.stufe === 1 || jetzt.spiel !== f.spiel)) {
      setFrage({ ...f, stufe: 2, spiel: jetzt.spiel }); // läuft ein Spiel (oder ein anderes als genannt): zweite Rückfrage
      return;
    }
    setFrage(null);
    void ausfuehren(f.feld, jetzt.eigenes);
  }, [frage, aktuell, stand, ausfuehren, setzeFehler]);

  // Hat das Feld wieder einen Lautsprecher (der Stand hat gewechselt), gilt die Bestätigung „abgemeldet“ nicht mehr
  useEffect(() => {
    setAbgemeldet((alt) => {
      const rest = [...alt].filter((feld) => karten.find((k) => k.feld === feld)?.zustand.art === 'keinLautsprecher');
      return rest.length === alt.size ? alt : new Set(rest);
    });
  }, [karten]);

  return { frage, laeuft, fehler, abgemeldet, anbieten, anfragen, bestaetigen, abbrechen: () => setFrage(null), nochmal: anfragen };
}
