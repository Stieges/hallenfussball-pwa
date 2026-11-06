/**
 * useLeibchenWahl – Leibchen-Wahl der Anpfiff-Ansicht (@SL-137, @SL-138, @SL-148, @SL-149, @SL-151, @SL-196).
 *
 * Hält die Wahl je Spiel (neues Spiel → neue Vorbelegung, die Wahl gilt nur für dieses Spiel), liefert die Vorschau der Kästen
 * in den echten Trikotfarben und die Wahl für den Anpfiff. `wahlBeimAnpfiff` liest einen Ref: „Ohne Leibchen anpfeifen“ setzt
 * die Wahl und pfeift im selben Tipp an.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { KitConflict, KitSide } from '../../../core/models/kit';
import {
  ersteLeibchenWahl, kitHinweis, leibchenFarbeFuer, leibchenFarbeZuAehnlich, leibchenFarbenMit, leibchenGegenGegner, vorschauKaesten, type LeibchenWahl,
} from '../../../core/models/kitChoice';
import type { CockpitKasten, CockpitLeibchen } from '../typesFarben';

export interface LeibchenWahlZustand {
  wahl: LeibchenWahl;
  /** Hinweis auf gleiche oder zu ähnliche Trikotfarben (`none` = kein Hinweis). */
  hinweis: KitConflict;
  /** @SL-151: Leibchenfarbe der Farbe des Gegners zu ähnlich. */
  gegnerAehnlich: boolean;
  farben: string[];
  /** @SL-151: diese Leibchenfarbe ist dem Gegner der gewählten Seite zu ähnlich (Kennzeichen in der Auswahl). */
  zuAehnlich: (farbe: string) => boolean;
  /** Kästen vor dem Anpfiff in den echten Farben, mit Weste der gewählten Seite. */
  kasten: CockpitKasten;
  waehleSeite: (seite: KitSide | null) => void;
  waehleFarbe: (farbe: string) => void;
  /** Für den Anpfiff: die Wahl dieses Spiels. */
  wahlBeimAnpfiff: () => LeibchenWahl;
  /** Die Seiten-Tasten stehen: bei Konflikt, mit gewählter Seite oder nach „Leibchen festlegen“ (@SL-138, @SL-148). */
  zeigeSeiten: boolean;
  oeffne: () => void;
}

export function useLeibchenWahl(matchId: string | undefined, leibchen: CockpitLeibchen | undefined, standard: CockpitKasten): LeibchenWahlZustand | null {
  const vorbelegt = useMemo(() => (leibchen ? ersteLeibchenWahl(leibchen.farben, leibchen.turnierFarbe) : null), [leibchen]);
  // Wahl je Spiel: wechselt das Spiel, gilt wieder die Vorbelegung (im nächsten Spiel trägt das Team wieder sein Trikot)
  const [gewaehlt, setGewaehlt] = useState<{ matchId: string | undefined; wahl: LeibchenWahl } | null>(null);
  const wahl = gewaehlt !== null && gewaehlt.matchId === matchId ? gewaehlt.wahl : vorbelegt;
  const aktuell = useRef<LeibchenWahl | null>(wahl);
  aktuell.current = wahl;

  const setze = useCallback((naechste: LeibchenWahl) => {
    aktuell.current = naechste;
    setGewaehlt({ matchId, wahl: naechste });
  }, [matchId]);
  // Neue Seite: die bisherige Leibchenfarbe bleibt, wenn sie dem neuen Gegner nicht zu ähnlich ist, sonst die erste ohne Konflikt (@SL-151)
  const farbenRef = useRef(leibchen?.farben);
  farbenRef.current = leibchen?.farben;
  const waehleSeite = useCallback((seite: KitSide | null) => {
    const jetzt = aktuell.current;
    if (!jetzt) { return; }
    const farbe = seite !== null && farbenRef.current ? leibchenFarbeFuer(farbenRef.current, seite, jetzt.bibColor) : jetzt.bibColor;
    setze({ bibSide: seite, bibColor: farbe });
  }, [setze]);
  const waehleFarbe = useCallback((farbe: string) => {
    if (aktuell.current) { setze({ ...aktuell.current, bibColor: farbe }); }
  }, [setze]);
  const wahlBeimAnpfiff = useCallback((): LeibchenWahl => aktuell.current ?? { bibSide: null, bibColor: '' }, []);
  const [offenFuer, setOffenFuer] = useState<string | undefined | null>(null);
  const oeffne = useCallback(() => { setOffenFuer(matchId); }, [matchId]);

  return useMemo(() => {
    if (!leibchen || wahl === null) { return null; }
    const boxes = vorschauKaesten(leibchen.farben, wahl, { a: standard.home, b: standard.away });
    const hinweis = kitHinweis(leibchen.farben);
    return {
      wahl, hinweis, zeigeSeiten: hinweis !== 'none' || wahl.bibSide !== null || offenFuer === matchId, oeffne, gegnerAehnlich: leibchenGegenGegner(leibchen.farben, wahl),
      farben: leibchenFarbenMit(leibchen.turnierFarbe), kasten: { home: boxes.a, away: boxes.b },
      zuAehnlich: (farbe: string) => wahl.bibSide !== null && leibchenFarbeZuAehnlich(leibchen.farben, wahl.bibSide, farbe),
      waehleSeite, waehleFarbe, wahlBeimAnpfiff,
    };
  }, [leibchen, wahl, standard, waehleSeite, waehleFarbe, wahlBeimAnpfiff, offenFuer, matchId, oeffne]);
}
