/**
 * ConnectionPill – Verbindungsanzeige im schmalen Kopf (Plan LT-2, @SL-140 „Verbindungsstatus“, K2; @SL-168 „Verbinden“).
 * Im Vollbild entfallen die festen Hinweisleisten der App (Offline, Speicher). Zwei Zustände: verbunden (Punkt, kein Knopf) und nicht
 * verbunden (Pille „Verbinden“ mit „Offline“ und den wartenden Einträgen). Nach dem Tippen steht in derselben Pille „Verbinde …“
 * (gleiche Wirkung wie im Offline-Hinweis, `useVerbindenVersuch`); klappt es, verschwindet die Pille, sonst steht wieder „Verbinden“.
 * Das Molekül `VerbindungsStatus` zeichnet; hier hängen nur Status, Zähler, Versuch und Texte des Cockpits daran.
 */
import { useTranslation } from 'react-i18next';
import type { ReactElement } from 'react';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { useEngineOutboxSummary } from '../../../features/match-engine/useEngineOutboxSummary';
import { useVerbindenVersuch } from '../../../features/match-engine/useVerbindenVersuch';
import { VerbindungsStatus } from '../../ui/molecules/VerbindungsStatus';

export function ConnectionPill({ tournamentId }: { tournamentId: string }): ReactElement {
  const { t } = useTranslation('cockpit');
  const { isOnline } = useOnlineStatus();
  const { pendingCount } = useEngineOutboxSummary(tournamentId);
  const { verbinde, laeuft } = useVerbindenVersuch();
  const kompakt = useBreakpoint().isMobile;
  return (
    <VerbindungsStatus
      // Solange der Versuch läuft, bleibt die Pille stehen (auch wenn das Netz schon zurück ist); danach gilt der Netzstatus
      status={isOnline && !laeuft ? 'online' : 'offline'}
      wartende={pendingCount}
      onVerbinden={verbinde}
      verbindet={laeuft}
      variante={kompakt ? 'kompakt' : 'normal'}
      testId="cockpit-verbindung"
      texte={{
        online: t('rahmen.online'), offline: t('rahmen.offline'), verbinden: t('rahmen.verbinden'), verbindet: t('rahmen.verbindet'),
        wartend: (count) => t('tafel.eintraegeWarten', { count }),
      }}
    />
  );
}
