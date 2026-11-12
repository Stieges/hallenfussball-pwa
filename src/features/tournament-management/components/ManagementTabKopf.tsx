/**
 * ManagementTabKopf – der schmale Kopf des Live-Bereichs der Turnierverwaltung (aus `ManagementTab` herausgelöst, H4-5; Verhalten
 * unverändert): `CockpitSlimHeader` mit Feldwahl, Verbindungsanzeige und Klärungsliste.
 */
import type { ReactElement } from 'react';
import { CockpitSlimHeader } from '../../../components/live-cockpit/frame/CockpitSlimHeader';
import { ConnectionPill } from '../../../components/live-cockpit/frame/ConnectionPill';
import { KLAERUNG_IM_COCKPIT_KOPF, KlaerungslisteEinstieg } from '../../klaerungsliste/KlaerungslisteEinstieg';
import type { Tournament } from '../../../types/tournament';

export interface ManagementTabKopfProps {
  tournament: Tournament;
  feld: number;
  onFeld: (n: number) => void;
  /** Steuernde Geräte je Feld für die Feldwahl (@HE-049). */
  halter: Readonly<Record<number, string>>;
  onTastenkuerzel: () => void;
}

export function ManagementTabKopf({ tournament, feld, onFeld, halter, onTastenkuerzel }: ManagementTabKopfProps): ReactElement {
  return (
    <CockpitSlimHeader
      tournamentId={tournament.id} turnierName={tournament.title} felder={tournament.numberOfFields} feld={feld} onFeld={onFeld} halter={halter}
      verbindung={<ConnectionPill tournamentId={tournament.id} />} onTastenkuerzel={onTastenkuerzel}
      klaerung={KLAERUNG_IM_COCKPIT_KOPF ? <KlaerungslisteEinstieg tournament={tournament} variant="cockpit" /> : undefined}
    />
  );
}
