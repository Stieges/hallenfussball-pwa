/**
 * ConnectionPill – Verbindungsanzeige im schmalen Kopf (Plan LT-2, @SL-140 „Verbindungsstatus“, K2; @SL-168 „Verbinden“).
 * Im Vollbild entfallen die festen Hinweisleisten der App (Offline, Speicher). Zwei Zustände: verbunden (Punkt, kein Knopf) und nicht
 * verbunden – kein Netz oder Netz ohne Durchkommen, @SL-168 – (Pille „Verbinden“ mit „Offline“ und den wartenden Einträgen). Nach dem Tippen steht in derselben Pille „Verbinde …“
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
  const { pendingCount, sendBlocked } = useEngineOutboxSummary(tournamentId);
  const { verbinde, laeuft } = useVerbindenVersuch();
  const kompakt = useBreakpoint().isMobile;
  return (
    <VerbindungsStatus
      // Nicht verbunden: kein Netz ODER das Netz ist da, aber der Ausgang wartet nach einem Fehlschlag (Hallen-WLAN ohne Internet,
      // `sendBlocked`) ODER der Versuch läuft (die Pille bleibt stehen, auch wenn das Netz schon zurück ist); sonst verbunden
      status={isOnline && !sendBlocked && !laeuft ? 'online' : 'offline'}
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
