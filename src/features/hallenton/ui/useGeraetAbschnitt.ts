/**
 * useGeraetAbschnitt – Zustand und Handlungen des Abschnitts „Dieses Gerät“ (H4-9; @HT-001, @HT-002, @HT-015, @HT-021, @HT-056). Kein Markup.
 * - Schalter „Ein“ legt nur die Feldwahl frei; erst ein gewähltes Feld ordnet dieses Gerät zu (`einschalten` mit allen gewählten Feldern, die
 *   Zuordnung ist am Server additiv). Der letzte abgewählte Chip und „Aus“ schalten ganz aus (lokal sofort, dann der Server).
 * - Belegt ein anderes Gerät das Feld, kommt die Rückfrage „Ablösen?“ (@HT-015); ist dieses Gerät schon Lautsprecher für ein anderes
 *   Turnier, davor „Wechseln?“ (@HT-056, Name aus dem lokalen Turnier). Abbrechen ändert nichts.
 * - Ohne `darfAendern` (nach dem Turnierende) ist nichts änderbar; der Abschnitt bleibt lesbar (@HT-046).
 * - „Ton aktivieren“ in der Fußleiste, solange der Browser noch einen Klick braucht („Ton nicht aktiv“, „schlafen gelegt“).
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { HallAssignAntwort, HallErgebnis, HallFehlerGrund } from '../../../core/repositories/hallentonRpc';
import type { HallentonDaten } from '../useHallentonDaten';
import { ladeTurnierLokal } from '../lokalesTurnier';
import { abonniereInstallAngebot, installAngebotVorhanden, installiereApp } from '../runtime/installAngebot';
import { baueGeraetBanner, type GeraetBanner } from './geraetBanner';
import { gespeicherterGeraetename, istHandy, laeuftAlsApp, speichereGeraetename } from './geraeteArt';
import type { AbloesenFrage, WechselFrage } from './GeraetRueckfragen';

export interface GeraetAbschnittEingabe {
  daten: HallentonDaten;
  felderAnzahl: number;
  /** `useCan('manageScreens')` ohne Ausnahme: nach dem Turnierende falsch. */
  darfAendern: boolean;
}

export type GeraetModus = 'einrichtung' | 'abschnitt';

export interface GeraetAbschnitt {
  modus: GeraetModus;
  /** Der Abschnitt steht vor den Feldkarten (Einrichtung, eigener Lautsprecher) statt danach. */
  oben: boolean;
  banner: readonly GeraetBanner[];
  verstanden: () => void;
  felder: readonly number[];
  gewaehlt: readonly number[];
  an: boolean;
  name: string;
  setzeName: (name: string) => void;
  nameVerlassen: () => void;
  schalterUmlegen: (an: boolean) => void;
  feldUmschalten: (feld: number) => void;
  beschaeftigt: boolean;
  fehler: HallFehlerGrund | null;
  handy: boolean;
  installiert: boolean;
  installAngebot: boolean;
  installieren: () => void;
  schalterErledigt: boolean;
  tonErledigt: boolean;
  /** „Ton aktivieren“ ist nötig (Fußleiste). */
  tonNoetig: boolean;
  tonAktivieren: () => void;
  abloesen: AbloesenFrage | null;
  wechseln: WechselFrage | null;
  abloesenBestaetigen: () => void;
  abloesenAbbrechen: () => void;
  wechselnBestaetigen: () => void;
  wechselnAbbrechen: () => void;
}

interface OffeneAbloesung { felder: readonly number[]; belegt: AbloesenFrage['belegt']; wechsel: boolean }
interface OffenerWechsel { felder: readonly number[]; turnierName: string | null }

export function useGeraetAbschnitt({ daten, felderAnzahl, darfAendern }: GeraetAbschnittEingabe): GeraetAbschnitt {
  const { t } = useTranslation('hallenton');
  const { lautsprecher, anzeige, karten, status, keinLautsprecherImTurnier } = daten;
  const standardName = istHandy() ? t('geraet.standardNameHandy') : t('geraet.standardNameLaptop');
  const [vorgemerkt, setVorgemerkt] = useState(false);
  const [name, setName] = useState(() => lautsprecher.name ?? gespeicherterGeraetename() ?? standardName);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [fehler, setFehler] = useState<HallFehlerGrund | null>(null);
  const [abloesung, setAbloesung] = useState<OffeneAbloesung | null>(null);
  const [wechsel, setWechsel] = useState<OffenerWechsel | null>(null);
  const installAngebot = useSyncExternalStore(abonniereInstallAngebot, installAngebotVorhanden, () => false);

  useEffect(() => {
    if (lautsprecher.name !== null) {
      setName(lautsprecher.name); // ein anderes Fenster dieses Geräts hat den Namen geändert
    }
  }, [lautsprecher.name]);

  const eigenerName = name.trim() === '' ? standardName : name.trim();
  const istLautsprecher = lautsprecher.rolle === 'diesesTurnier' && lautsprecher.felder.length > 0;
  const gewaehlt = lautsprecher.felder;
  const felder = useMemo(() => Array.from({ length: felderAnzahl }, (_, i) => i + 1), [felderAnzahl]);
  const eigeneAnzeige = useMemo(() => anzeige.felder.filter((f) => f.eigenesGeraet), [anzeige]);

  const ausfuehren = useCallback(async <T,>(aktion: () => Promise<T>): Promise<T> => {
    setBeschaeftigt(true);
    setFehler(null);
    try {
      return await aktion();
    } finally {
      setBeschaeftigt(false);
    }
  }, []);

  const versuche = useCallback(async (felderNeu: readonly number[], umziehen: boolean, ersetzen: boolean): Promise<void> => {
    const umgezogen: HallErgebnis<HallAssignAntwort> | null = await ausfuehren(() => (umziehen ? lautsprecher.wechseln(felderNeu, eigenerName, ersetzen) : lautsprecher.einschalten(felderNeu, eigenerName, ersetzen)));
    // `null`: inzwischen nicht mehr in einem anderen Turnier (anderes Fenster) – ganz normal einschalten
    const ergebnis = umgezogen ?? await ausfuehren(() => lautsprecher.einschalten(felderNeu, eigenerName, ersetzen));
    if (!ergebnis.ok) {
      setFehler(ergebnis.grund);
    } else if (ergebnis.status === 'occupied') {
      setAbloesung({ felder: felderNeu, belegt: ergebnis.fields, wechsel: umziehen });
    } else {
      speichereGeraetename(eigenerName);
    }
  }, [ausfuehren, lautsprecher, eigenerName]);

  const schalterUmlegen = useCallback((an: boolean): void => {
    if (!darfAendern) {
      return;
    }
    if (an) {
      setVorgemerkt(true);
      return;
    }
    setVorgemerkt(false);
    if (lautsprecher.rolle === 'diesesTurnier') {
      void ausfuehren(() => lautsprecher.ausschalten()).then((e) => {
        if (e !== null && !e.ok && e.grund !== 'netz') {
          setFehler(e.grund); // ohne Netz hat das Gerät lokal schon aufgehört; die Abmeldung holt es nach (@HT-038)
        }
      });
    }
  }, [darfAendern, lautsprecher, ausfuehren]);

  const feldUmschalten = useCallback((feld: number): void => {
    if (!darfAendern) {
      return;
    }
    if (gewaehlt.includes(feld)) {
      if (gewaehlt.length === 1) {
        schalterUmlegen(false);
        return;
      }
      void ausfuehren(() => lautsprecher.feldAbmelden(feld)).then((e) => {
        if (e !== null && !e.ok && e.grund !== 'netz') {
          setFehler(e.grund);
        }
      });
      return;
    }
    const neu = [...gewaehlt, feld].sort((a, b) => a - b);
    if (lautsprecher.rolle === 'anderesTurnier' && lautsprecher.anderesTurnier !== null) {
      void ladeTurnierLokal(lautsprecher.anderesTurnier.turnierId).then((turnier) => setWechsel({ felder: neu, turnierName: turnier?.title ?? null }));
      return;
    }
    void versuche(neu, false, false);
  }, [darfAendern, gewaehlt, lautsprecher, ausfuehren, schalterUmlegen, versuche]);

  const nameVerlassen = useCallback((): void => {
    if (darfAendern && istLautsprecher && eigenerName !== lautsprecher.name) {
      void versuche(lautsprecher.felder, false, false); // gleiche Felder, neuer Name (für dasselbe Gerät ersetzt die Zuordnung nur den Namen)
    }
  }, [darfAendern, istLautsprecher, eigenerName, lautsprecher.name, lautsprecher.felder, versuche]);

  const sprecherName = useCallback((feld: number): string | undefined => {
    const antwort = status.antwort;
    const sprecher = antwort?.sicht === 'voll' ? antwort.speakers.find((s) => s.field === feld && !s.isThisDevice) : undefined;
    return sprecher?.deviceName;
  }, [status.antwort]);

  const banner = useMemo(() => baueGeraetBanner({
    rolle: lautsprecher.rolle, felder: lautsprecher.felder, name: lautsprecher.name, abgeloest: lautsprecher.abgeloest,
    eigeneAnzeige, karten, sprecherName, t,
  }), [lautsprecher.rolle, lautsprecher.felder, lautsprecher.name, lautsprecher.abgeloest, eigeneAnzeige, karten, sprecherName, t]);

  const tonNoetig = darfAendern && istLautsprecher && eigeneAnzeige.some((f) => f.anzeige.art === 'tonNichtAktiv' || f.anzeige.art === 'schlafenGelegt');
  const modus: GeraetModus = !istLautsprecher && keinLautsprecherImTurnier && status.stand === 'aktuell' && lautsprecher.abgeloest === null ? 'einrichtung' : 'abschnitt';
  const { tonAktivieren: aktivieren, abgeloestVerstanden } = lautsprecher;

  return {
    modus, oben: modus === 'einrichtung' || istLautsprecher, banner, verstanden: abgeloestVerstanden,
    felder, gewaehlt, an: istLautsprecher || vorgemerkt, name, setzeName: setName, nameVerlassen, schalterUmlegen, feldUmschalten,
    beschaeftigt, fehler, handy: istHandy(), installiert: laeuftAlsApp(), installAngebot, installieren: () => { void installiereApp(); },
    schalterErledigt: istLautsprecher, tonErledigt: istLautsprecher && eigeneAnzeige.some((f) => f.anzeige.art === 'bereit'),
    tonNoetig, tonAktivieren: () => { void aktivieren(); },
    abloesen: abloesung === null ? null : { felder: abloesung.felder, belegt: abloesung.belegt, eigenerName },
    wechseln: wechsel === null ? null : { turnierName: wechsel.turnierName },
    abloesenBestaetigen: () => {
      const a = abloesung;
      setAbloesung(null);
      if (a !== null) {
        void versuche(a.felder, a.wechsel, true);
      }
    },
    abloesenAbbrechen: () => setAbloesung(null),
    wechselnBestaetigen: () => {
      const w = wechsel;
      setWechsel(null);
      if (w !== null) {
        void versuche(w.felder, true, false);
      }
    },
    wechselnAbbrechen: () => setWechsel(null),
  };
}
