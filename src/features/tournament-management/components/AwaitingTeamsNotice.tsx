/**
 * AwaitingTeamsNotice – Das Cockpit lässt einen Spiel mit offener Seite nicht anpfeifen (A-04a).
 * @TM-033 nennt den Wartegrund (Abschluss von Gruppe B / Vorgängerspiel);
 * @TM-035 sagt zusätzlich, dass der Stand dieses Geräts ohne Netz ist.
 */
import { useTranslation } from 'react-i18next';
import styles from '../ManagementTab.module.css';

export interface AwaitingTeamsNoticeProps {
  /** Übersetzte Wartegründe je offener Seite. */
  reasons: readonly string[];
  /** Das Gerät hat kein Netz: Die Besetzung am Server kann schon feststehen. */
  offline: boolean;
}

export function AwaitingTeamsNotice({ reasons, offline }: AwaitingTeamsNoticeProps) {
  const { t } = useTranslation('tournament');
  return (
    <div className={styles.noMatches} data-testid="cockpit-awaiting-teams" role="status">
      <strong>{t('management.awaitingTitle')}</strong>
      {reasons.map((reason) => (
        <div key={reason} data-testid="cockpit-awaiting-reason">{t('management.awaitingReason', { reason })}</div>
      ))}
      {offline && <div data-testid="cockpit-awaiting-offline">{t('management.awaitingOffline')}</div>}
    </div>
  );
}
