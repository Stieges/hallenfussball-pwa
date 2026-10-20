/**
 * ConnectionPill – Verbindungsanzeige im schmalen Kopf (Plan LT-2, @SL-140 „Verbindungsstatus“, K2; @SL-168 „Verbinden“).
 * Im Vollbild entfallen die festen Hinweisleisten der App (Offline, Speicher); der Kopf sagt, ob das Gerät Netz hat, nennt die wartenden
 * Einträge, bietet ohne Netz „Verbinden“ an (gleiche Wirkung wie im Offline-Hinweis, `useVerbinden`) und meldet kurz „Wieder verbunden“.
 * Das Molekül `VerbindungsStatus` zeichnet; hier hängen nur Status, Zähler und Texte des Cockpits daran.
 */
import { useTranslation } from 'react-i18next';
import type { ReactElement } from 'react';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { useEngineOutboxSummary } from '../../../features/match-engine/useEngineOutboxSummary';
import { useVerbinden } from '../../../features/match-engine/useVerbinden';
import { VerbindungsStatus } from '../../ui/molecules/VerbindungsStatus';

export function ConnectionPill({ tournamentId }: { tournamentId: string }): ReactElement {
  const { t } = useTranslation('cockpit');
  const { isOnline, wasOffline } = useOnlineStatus();
  const { pendingCount } = useEngineOutboxSummary(tournamentId);
  const verbinden = useVerbinden();
  const kompakt = useBreakpoint().isMobile;
  return (
    <VerbindungsStatus
      status={isOnline ? 'online' : 'offline'}
      wartende={pendingCount}
      onVerbinden={verbinden}
      wiederVerbunden={isOnline && wasOffline}
      variante={kompakt ? 'kompakt' : 'normal'}
      testId="cockpit-verbindung"
      texte={{
        online: t('rahmen.online'), offline: t('rahmen.offline'), verbinden: t('rahmen.verbinden'), wiederVerbunden: t('rahmen.wiederVerbunden'),
        wartend: (count) => t('tafel.eintraegeWarten', { count }),
      }}
    />
  );
}
