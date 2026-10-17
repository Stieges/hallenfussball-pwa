/**
 * MatchCardHeader - Kopfzeile der Spielkarte (@OB-064, Mockup Variante D)
 *
 * Links die Anpfiffzeit, rechts Feld, Gruppe/Runde, SR und der Status:
 * - läuft (auch unterbrochen): Kennzeichen „läuft 07:30“ (ohne bekannte Zeit „läuft“)
 * - ausgefallen / gewertet: Kennzeichen nach dem Wortlaut der Ansicht (@ZM-104)
 * - beendet nach Strafstoßschießen: „beendet i. E.“
 * - nach Verlängerung entschieden: „n. V.“
 * - regulär beendet oder geplant: kein Zusatz
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { ViewMatchStatus } from '../../../core/view';
import type { ResultFigures } from '../matchResult';
import type { MatchCardStatus } from './MatchCardScore';
import { formatTime } from './utils';
import { RunningBadge } from '../RunningBadge';

export interface MatchCardHeaderProps {
  scheduledTime?: string;
  field?: number;
  group?: string;
  showGroupLabel: boolean;
  referee?: string;
  status: MatchCardStatus;
  result: ResultFigures | null;
  /** Spielzeit eines laufenden Spiels, z. B. „07:30“ */
  elapsedFormatted?: string;
  /** Fachlicher Status der Ansicht: „ausgefallen“ und „gewertet“ stehen in der Kopfzeile (@ZM-104) */
  viewStatus?: ViewMatchStatus;
}

const headerStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'center',
  columnGap: cssVars.spacing.md,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
  borderBottom: `1px solid ${cssVars.colors.border}`,
  backgroundColor: cssVars.colors.surfaceDark,
};

const metaStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: cssVars.spacing.sm,
  fontSize: cssVars.fontSizes.xs,
  color: cssVars.colors.textSecondary,
};

export const MatchCardHeader: React.FC<MatchCardHeaderProps> = ({
  scheduledTime, field, group, showGroupLabel, referee, status, result, elapsedFormatted, viewStatus,
}) => {
  const { t } = useTranslation('tournament');
  const isLive = status === 'running';
  const finishedNote = status === 'finished'
    ? result?.decision === 'penalty' ? t('matchResult.finishedPenalty') : result?.decision === 'overtime' ? t('matchResult.overtimeShort') : undefined
    : undefined;

  const statusNote = viewStatus === 'cancelled' || viewStatus === 'awarded' ? t(`view.status.${viewStatus}`) : undefined;

  return (
    <div style={headerStyle}>
      <span style={{
        fontSize: cssVars.fontSizes.sm,
        fontWeight: cssVars.fontWeights.medium,
        color: isLive ? cssVars.colors.primary : cssVars.colors.textSecondary,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatTime(scheduledTime)}
      </span>
      <div style={metaStyle}>
        {field !== undefined && <span>{t('matchCard.field', { field })}</span>}
        {showGroupLabel && group && group !== 'all' && <span>{t('matchCard.groupPrefix', { group })}</span>}
        {referee && <span>{t('matchCard.refereePrefix', { referee })}</span>}
        {isLive && <RunningBadge elapsedFormatted={elapsedFormatted} />}
        {statusNote && (
          <span style={{ fontWeight: cssVars.fontWeights.bold }} data-testid="match-card-status-note">{statusNote}</span>
        )}
        {finishedNote && (
          <span style={{ fontWeight: cssVars.fontWeights.bold }} data-testid="match-card-decision">{finishedNote}</span>
        )}
      </div>
    </div>
  );
};

export default MatchCardHeader;
