/**
 * useLautsprecherAbmelden – „Abmelden“ an der Karte eines Felds mit Hallen-Lautsprecher (H4-11b, @HT-057): die Turnierleitung meldet den Lautsprecher ab, auch
 * wenn es ein ANDERES Gerät ist („meldet sich nicht“, verlorenes Tablet). Ablauf: Tipp → Rückfrage (Feld, Gerätename, Folge) → bei Ja und laufendem Spiel
 * auf dem Feld die zusätzliche Rückfrage wie beim Testton (danach ertönt kein Abpfiff, @HT-017) → Aufruf → die Karte liest den Stand sofort neu.
 * - Ein anderes Gerät: `hall_speaker_unassign` über `meldeLautsprecherAb`. Ohne aktuellen Stand kein Aufruf, die Karte sagt „kein Netz“ (kein stiller Fehlschlag).
 * - DIESES Gerät: der bestehende Weg des Schalters „Dieses Gerät ist Hallen-Lautsprecher“ (`feldAbmelden`, beim letzten Feld `ausschalten`): lokal sofort, ohne Netz
 *   gemerkt und nachgeholt (@HT-038). Kein zweiter Weg mit anderem Verhalten, und die Marke „abgemeldet“ gehört nur einem Gerät, das ein ANDERES abgemeldet hat.
 * - Nach einem Fehler bleibt der Zustand, die Karte zeigt den Grund mit „Erneut versuchen“. Ohne Recht (`darfAendern`, nach dem Turnierende auch nicht) tut nichts etwas.
 * Gerätenamen stehen nur im Text der Rückfrage, nie in einem Attribut.
 */
import { useCallback, useState } from 'react';
import type { HallErgebnis, HallFehlerGrund } from '../../../core/repositories/hallentonRpc';
import { meldeLautsprecherAb } from '../hallAbmelden';
import type { HallStatusStand } from '../runtime/hallStatusAbfrage';
import type { HallLautsprecher } from '../useHallLautsprecher';
import type { FeldKarte } from './feldKarten';
import type { AnhoerenRueckfrage } from './useAnhoerenRueckfrage';

export interface AbmeldenFrage {
  feld: number;
  /** Name des Geräts, wie er in der Verwaltung steht. */
  geraetName: string;
  /** Der Lautsprecher ist dieses Gerät. */
  eigenes: boolean;
}

export interface LautsprecherAbmelden {
  /** Die Rückfrage vor dem Abmelden (`null`: keine offen). */
  frage: AbmeldenFrage | null;
  /** Felder, für die gerade ein Abmelden läuft. */
  laeuft: ReadonlySet<number>;
  /** Warum das Abmelden des Felds nicht geklappt hat (der Zustand der Karte ist dann unverändert). */
  fehler: Readonly<Record<number, HallFehlerGrund>>;
  /** Die Taste „Abmelden“ ist an der Karte des Felds zu zeigen. */
  anbieten(karte: FeldKarte): boolean;
  anfragen(feld: number): void;
  bestaetigen(): void;
  abbrechen(): void;
  /** „Erneut versuchen“ nach einem Fehler (die Rückfrage war schon beantwortet). */
  nochmal(feld: number): void;
}

export interface AbmeldenEingabe {
  tournamentId: string;
  karten: readonly FeldKarte[];
  stand: HallStatusStand;
  /** `useCan('manageScreens')` ohne Ausnahme: nach dem Turnierende falsch. */
  darfAendern: boolean;
  lautsprecher: Pick<HallLautsprecher, 'rolle' | 'felder' | 'feldAbmelden' | 'ausschalten'>;
  rueckfrage: AnhoerenRueckfrage;
}

/** Der Aufruf, der ein Feld eines anderen Geräts am Server abmeldet (`meldeLautsprecherAb`); der Prüfstand der Bilder setzt einen anderen ein. */
export type MeldeAb = (turnierId: string, feld: number) => Promise<HallErgebnis<unknown>>;

export function useLautsprecherAbmelden({ tournamentId, karten, stand, darfAendern, lautsprecher, rueckfrage }: AbmeldenEingabe, melde: MeldeAb = meldeLautsprecherAb): LautsprecherAbmelden {
  const [frage, setFrage] = useState<AbmeldenFrage | null>(null);
  const [laeuft, setLaeuft] = useState<ReadonlySet<number>>(new Set());
  const [fehler, setFehler] = useState<Readonly<Record<number, HallFehlerGrund>>>({});
  const { rolle, felder, feldAbmelden, ausschalten } = lautsprecher;

  const anbieten = useCallback((karte: FeldKarte): boolean => darfAendern && karte.zustand.art !== 'keinLautsprecher', [darfAendern]);

  const ausfuehren = useCallback(async (feld: number, eigenes: boolean): Promise<void> => {
    setLaeuft((alt) => new Set(alt).add(feld));
    setFehler((alt) => Object.fromEntries(Object.entries(alt).filter(([f]) => Number(f) !== feld)));
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
      const grund = ergebnis.grund;
      setFehler((alt) => ({ ...alt, [feld]: grund }));
    }
  }, [tournamentId, rolle, felder, feldAbmelden, ausschalten, melde]);

  const eigenesFeld = useCallback((karte: FeldKarte): boolean => karte.eigenesGeraet && rolle === 'diesesTurnier' && felder.includes(karte.feld), [rolle, felder]);

  const anfragen = useCallback((feld: number): void => {
    const karte = karten.find((k) => k.feld === feld);
    if (karte === undefined || !anbieten(karte) || stand === 'laedt') {
      return; // die erste Antwort steht noch aus: die Taste ist bis dahin aus
    }
    const eigenes = eigenesFeld(karte);
    if (!eigenes && stand !== 'aktuell') {
      setFehler((alt) => ({ ...alt, [feld]: 'netz' })); // ohne aktuellen Stand kein Aufruf: der Hinweis sagt es, nichts geschieht still
      return;
    }
    setFrage({ feld, geraetName: karte.geraet?.name ?? '', eigenes });
  }, [karten, anbieten, stand, eigenesFeld]);

  const bestaetigen = useCallback((): void => {
    const f = frage;
    setFrage(null);
    if (f !== null) {
      rueckfrage.fragen('abmelden', [f.feld], () => { void ausfuehren(f.feld, f.eigenes); }); // läuft ein Spiel auf dem Feld, erst die zweite Rückfrage
    }
  }, [frage, rueckfrage, ausfuehren]);

  const nochmal = useCallback((feld: number): void => {
    const karte = karten.find((k) => k.feld === feld);
    if (karte === undefined || !anbieten(karte)) {
      return;
    }
    if (!eigenesFeld(karte) && stand !== 'aktuell') {
      setFehler((alt) => ({ ...alt, [feld]: 'netz' }));
      return;
    }
    void ausfuehren(feld, eigenesFeld(karte));
  }, [karten, anbieten, stand, eigenesFeld, ausfuehren]);

  return { frage, laeuft, fehler, anbieten, anfragen, bestaetigen, abbrechen: () => setFrage(null), nochmal };
}
