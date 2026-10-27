/**
 * Reiter Tabellen mit der Ansicht in der Adresse (`?ansicht=tabelle|platzierung`, URL-ROUTING.md, @W2A-075).
 * Ersetzt den Eintrag in der Adresse (kein Verlauf je Klick); ungültiger Wert → Vorgabe.
 */
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { TabellenTab, type TabellenTabProps } from './TabellenTab';
import { TABELLEN_ANSICHT_PARAM, tabellenAnsichtAusAdresse, tabellenAnsichtInAdresse, tabellenAnsichtVorgabe, type TabellenAnsicht } from './tabellenAnsicht';

export const TabellenTabMitAdresse: React.FC<Omit<TabellenTabProps, 'view' | 'onViewChange'>> = (props) => {
  const [params, setParams] = useSearchParams();
  const view = tabellenAnsichtAusAdresse(params.get(TABELLEN_ANSICHT_PARAM), tabellenAnsichtVorgabe(props.tournament));
  const onViewChange = (next: TabellenAnsicht): void => {
    setParams((alt) => {
      const neu = new URLSearchParams(alt);
      neu.set(TABELLEN_ANSICHT_PARAM, tabellenAnsichtInAdresse(next));
      return neu;
    }, { replace: true });
  };
  return <TabellenTab {...props} view={view} onViewChange={onViewChange} />;
};
