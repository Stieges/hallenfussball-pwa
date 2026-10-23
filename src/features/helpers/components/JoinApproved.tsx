/**
 * „Du bist zugelassen“ (A-17c, Mockup M3 n1/n3, @HE-001, @HE-097, @HE-028): Der Warteschirm wechselt von allein, sobald die
 * Turnierleitung zulässt – ohne neuen Scan. Darunter der Hinweis „Zum Startbildschirm hinzufügen“ (einmal), „Offline bereit“,
 * sobald Spielplan und Feld auf dem Gerät liegen, und die Haupttaste „Feld N öffnen“.
 */
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { useRepositories } from '../../../core/contexts/RepositoryContext';
import type { JoinTournament } from '../joinFlow';
import { helperFieldPath, helperTournamentPath } from '../joinPaths';
import { useOfflineReady } from '../useOfflineReady';
import { AddToHomeHint } from './AddToHomeHint';
import { JoinInfoCard } from './JoinInfoCard';
import { JoinNotice } from './JoinNotice';

export interface JoinApprovedProps {
  tournament: JoinTournament;
  /** Zugeteiltes Feld; `null` = ohne Feld. */
  field: number | null;
  deviceUserId: string | null;
  /** Nur für Tests. */
  loadOfflineCopy?: (tournamentId: string) => Promise<boolean>;
  onNavigate: (path: string) => void;
}

export const JoinApproved = ({ tournament, field, deviceUserId, loadOfflineCopy, onNavigate }: JoinApprovedProps) => {
  const { t } = useTranslation('helpers');
  const { tournamentRepository } = useRepositories();
  const { ready } = useOfflineReady(tournamentRepository, tournament.id, deviceUserId ?? '', { enabled: deviceUserId !== null, load: loadOfflineCopy });
  const path = field === null ? helperTournamentPath(tournament.id) : helperFieldPath(tournament.id, field);
  return (
    <>
      <JoinInfoCard title={tournament.title} date={tournament.date} />
      <JoinNotice
        tone="ok"
        title={t('join.approved.title')}
        text={field === null ? t('join.approved.textNoField') : t('join.approved.textField', { field })}
        data-testid="helper-approved"
      />
      {deviceUserId ? <AddToHomeHint deviceUserId={deviceUserId} tournamentId={tournament.id} field={field} /> : null}
      {ready ? (
        <JoinNotice
          tone="ok"
          icon={<Icons.Save size={iconSizeValues.sm} />}
          title={t('join.offlineReady.title')}
          text={field === null ? t('join.offlineReady.textNoField') : t('join.offlineReady.textField', { field })}
          data-testid="offline-ready"
        />
      ) : null}
      <Button
        variant="primary"
        fullWidth
        onClick={() => onNavigate(path)}
        style={{ minHeight: cssVars.touchTargets.primary, fontSize: cssVars.fontSizes.lg }}
        data-primary
        data-testid="helper-open-field"
      >
        {field === null ? t('join.approved.openTournament') : t('join.approved.openField', { field })}
      </Button>
    </>
  );
};
