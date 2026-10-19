/**
 * EntrySheets – die Blätter der Eintrags-Abläufe (Aufgabe 3.4: Nummernauswahl des Tors und des Eigentors).
 *
 * Baut aus dem offenen Eintrag (`useEntryFlows`) den Nummern-Baustein: Titel mit Team, die Zeile „Eigentor (Gegner)“ nur im
 * ersten Schritt, „ohne Nummer“ gegenüber dem auslösenden Knopf (`ausloeserSeite`, @SL-020). Tastatur-Modus nach „per Taste
 * geöffnet“ oder feinem Zeiger, nie nach der Breite (Auflage 8, @SL-153).
 */
import type { ReactElement } from 'react';
import { NumberPicker } from '../../ui/molecules/NumberPicker';
import { useFeinerZeiger } from '../hooks/useFeinerZeiger';
import type { UseEntryFlowsReturn } from '../hooks/useEntryFlows';
import type { Side, Uebersetzer } from '../model/cockpitTypes';

export interface EntrySheetsProps {
  flows: UseEntryFlowsReturn;
  teams: { home: { id: string; name: string }; away: { id: string; name: string } };
  /** Wo steht der Knopf des Teams auf dem Bildschirm (nach „Seiten tauschen“)? */
  ausloeserSeite: (seite: Side) => 'links' | 'rechts';
  /** Eingeschaltete Kartenarten des Turniers (@SL-025, @SL-026). */
  kartenArten: { yellow: boolean; yellowRed: boolean; red: boolean };
  t: Uebersetzer;
}

export function EntrySheets({ flows, teams, ausloeserSeite, t }: EntrySheetsProps): ReactElement | null {
  const feinerZeiger = useFeinerZeiger();
  const offen = flows.offen;
  if (offen?.art !== 'tor' || offen.seite === null) { return null; }

  const team = offen.seite === 'home' ? teams.home : teams.away;
  const gegner = offen.seite === 'home' ? teams.away : teams.home;
  return (
    <NumberPicker
      isOpen
      texte={{
        titel: offen.eigentor ? t('nummer.titelEigentor', { gegner: gegner.name }) : t('nummer.titelTor', { team: team.name }),
        ohneNummer: t('nummer.ohneNummer'),
        andereNummer: t('nummer.andere'),
        uebernehmen: t('nummer.uebernehmen'),
        eingabeLabel: t('nummer.eingabe'),
      }}
      ausloeserSeite={ausloeserSeite(offen.seite)}
      onWaehle={(nummer) => { void flows.waehleNummer(nummer); }}
      onSchliesse={(grund) => { void flows.schliesseAuswahl(grund); }}
      eigentor={offen.eigentor ? undefined : { label: t('nummer.eigentor', { gegner: gegner.name }), onWaehle: () => { void flows.waehleEigentor(); } }}
      tastatur={offen.perTaste === true || feinerZeiger}
    />
  );
}
