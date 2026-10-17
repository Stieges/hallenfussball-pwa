/**
 * LegacyMatchHeader – heutiger Spielkopf des Live-Cockpits (Scheibe 1, ohne Sichtänderung).
 *
 * Spielnummer, Feld, Foul-Leiste (ab Tablet inline), Sync-Anzeige, Status-Abzeichen und der
 * Nur-Lesen-Hinweis. Übergangsweise, fällt mit der Tafel (Aufgabe 2.4) weg.
 */
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { LiveMatch } from '../types';
import { FoulBar } from '../components';
import styles from './LegacyAreas.module.css';

export interface LegacyMatchHeaderProps {
  match: LiveMatch;
  fieldName: string;
  isMobile: boolean;
  homeFouls: number;
  awayFouls: number;
  /** Sync-Anzeige (rendert selbst nichts außerhalb des Cloud-Modus). */
  sync: ReactNode;
  readOnly: boolean;
}

function statusLabel(status: LiveMatch['status']): string {
  switch (status) {
    case 'RUNNING': return 'LÄUFT';
    case 'PAUSED': return 'PAUSIERT';
    case 'FINISHED': return 'BEENDET';
    default: return 'NICHT GESTARTET';
  }
}

function liveRegionText(status: LiveMatch['status']): string {
  switch (status) {
    case 'RUNNING': return 'Spiel läuft';
    case 'PAUSED': return 'Spiel pausiert';
    case 'FINISHED': return 'Spiel beendet';
    default: return 'Spiel noch nicht gestartet';
  }
}

export function LegacyMatchHeader({ match, fieldName, isMobile, homeFouls, awayFouls, sync, readOnly }: LegacyMatchHeaderProps): ReactElement {
  const { t } = useTranslation('cockpit');
  return (
    <>
      <div className={styles.matchHeader}>
        <div className={styles.matchInfo}>
          <span className={styles.matchNumber}>Spiel {match.number}</span>
          <span className={styles.matchField}>{fieldName}</span>
        </div>

        {/* Foul Counter - Desktop inline, Mobile separate (in der Spielfläche) */}
        {!isMobile && (
          <FoulBar
            homeTeamName={match.homeTeam.name}
            awayTeamName={match.awayTeam.name}
            homeFouls={homeFouls}
            awayFouls={awayFouls}
            variant="inline"
          />
        )}

        <div className={styles.headerActions}>
          {sync}
          <span className={styles.statusBadge} data-status={match.status} data-testid="match-status-badge">{statusLabel(match.status)}</span>
          {/* ARIA-live region for screen readers to announce status changes */}
          <span aria-live="polite" aria-atomic="true" className={styles.liveRegion}>
            {liveRegionText(match.status)}
          </span>
        </div>
      </div>

      {/* Task R2: Read-Only-Banner — nur bei fehlender Berechtigung (readOnly), nicht bei
          beendetem Spiel allein. */}
      {readOnly && (
        <div className={styles.readOnlyBanner} data-testid="cockpit-readonly-banner" role="status">
          {t('readOnly.banner')}
        </div>
      )}
    </>
  );
}
