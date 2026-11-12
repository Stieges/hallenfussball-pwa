/**
 * useLeibchenBereich – alles Leibchen des Cockpits an einer Stelle (Leibchen 2b-2): die Karte über der Daumenleiste bzw. im Endstand (@SL-206, @SL-215),
 * Nachtragen im laufenden Spiel unter „Mehr“ (@SL-150), der Hinweis auf gleiche Trikotfarben in der Tafel und die Meldungen der Warteschlange in der
 * Meldezeile (@SL-228, @SL-229).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { KitConflict } from '../../../core/models/kit';
import { kitHinweis, trikotFarben } from '../../../core/models/kitChoice';
import type { KitChoiceNotice } from '../../../core/match/client/kitChoiceQueue';
import { leibchenMeldungKey } from '../model/leibchenMeldung';
import { LeibchenKarte } from '../../ui/molecules/LeibchenKarte';
import { LeibchenNachtragen } from '../areas/LeibchenNachtragen';
import type { MehrPunkt } from '../model/mehrPunkte';
import type { CockpitZustand } from '../model/cockpitPhase';
import type { LiveCockpitFarbenProps } from '../typesFarben';
import { useLeibchenKarte, useLeibchenNachtrag } from './useLeibchenKarte';

export interface LeibchenBereichArgs {
  turnier: LiveCockpitFarbenProps['leibchenTurnier'];
  matchId: string | undefined;
  zustand: CockpitZustand;
  melde: (stufe: 1 | 2 | 3, text: string) => void;
  kannSteuern: boolean;
  onUebernehmen?: (() => void) | undefined;
}

export interface LeibchenBereich {
  /** Die Wahl von Team und Farbe ist offen (am Handy weichen Tafel und Einträge, @SL-221). */
  wahlOffen: boolean;
  farbKonflikt: KitConflict | undefined;
  karte: ReactNode;
  mehrAktion: Partial<Record<MehrPunkt, () => void>>;
  nachtragBlatt: ReactNode;
}

export function useLeibchenBereich({ turnier, matchId, zustand, melde, kannSteuern, onUebernehmen }: LeibchenBereichArgs): LeibchenBereich {
  const { t } = useTranslation('cockpit');
  // Die Wahl gilt nur für die Karte, die sie geöffnet hat: verschwindet die Karte (Anpfiff, Spielwechsel), ist sie zu (@SL-237 Zeile 2, @SL-221)
  const [wahlFuer, setWahlFuer] = useState<string | null>(null);
  const [nachtragOffen, setNachtragOffen] = useState(false);
  const meldungText = useCallback((n: KitChoiceNotice): string => t(`leibchenKarte.meldung.${leibchenMeldungKey(n)}`), [t]);
  const daten = useLeibchenKarte({ tournament: turnier?.tournament, matchId, zustand, melde, meldungText, epoche: turnier?.epoche });
  const kartenId = daten === null ? null : `${daten.matchId}:${zustand}`;
  useEffect(() => { if (wahlFuer !== null && wahlFuer !== kartenId) { setWahlFuer(null); } }, [wahlFuer, kartenId]);
  const nachtrag = useLeibchenNachtrag(turnier?.tournament, matchId, turnier?.epoche);
  const farbKonflikt = useMemo(() => {
    const spiel = turnier?.tournament.matches.find((m) => m.id === matchId);
    return turnier && spiel && zustand === 'vorAnpfiff' ? kitHinweis(trikotFarben(spiel, turnier.tournament.teams)) : undefined;
  }, [turnier, matchId, zustand]);
  const karte = daten === null ? null : (
    <LeibchenKarte
      key={kartenId ?? daten.matchId} spielNummer={daten.spielNummer} teams={daten.teams} trikot={daten.trikot} hallenFarben={daten.hallenFarben} gewaehlt={daten.gewaehlt}
      vorschlag={daten.vorschlag} nurFestlegen={daten.nurFestlegen} senden={daten.senden} lesen={!kannSteuern}
      onUebernehmen={onUebernehmen} onBestaetigen={daten.onBestaetigen} onKeine={daten.onKeine} onWahlOffen={(offen) => { setWahlFuer(offen ? kartenId : null); }}
    />
  );
  return {
    wahlOffen: wahlFuer !== null && wahlFuer === kartenId, farbKonflikt, karte,
    mehrAktion: nachtrag ? { leibchenNachtragen: () => { setNachtragOffen(true); } } : {},
    nachtragBlatt: nachtrag && nachtragOffen ? <LeibchenNachtragen isOpen daten={nachtrag} onClose={() => { setNachtragOffen(false); }} /> : null,
  };
}
