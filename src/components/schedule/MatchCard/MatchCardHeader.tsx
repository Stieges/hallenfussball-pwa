/**
 * MatchCardHeader - Kopfzeile der Spielkarte (@OB-064, Mockup Variante D)
 *
 * Links die Anpfiffzeit, rechts Feld, Gruppe/Runde, SR und der Status:
 * - Abzeichen der Ansicht mit dem Wort des Zustands (Live, Pause, Halbzeit, …, ausgefallen), ohne Uhr (@OB-065, @OB-066)
 * - gewertet: Kennzeichen „gewertet“ neben dem Abzeichen „Ende“ (@ZM-104)
 * - beendet nach Strafstoßschießen: „beendet i. E.“
 * - nach Verlängerung entschieden: „n. V.“
 * - regulär beendet oder geplant: kein Zusatz
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { matchBadgeModel, type MatchBadgeModel, type ViewMatchStatus } from '../../../core/view';
import type { ResultFigures } from '../matchResult';
import type { MatchCardStatus } from './MatchCardScore';
import { formatTime } from './utils';
import { MatchStatusBadge } from '../../ui/molecules/MatchStatusBadge';

export interface MatchCardHeaderProps {
  scheduledTime?: string;
  field?: number;
  group?: string;
  showGroupLabel: boolean;
  referee?: string;
  status: MatchCardStatus;
  result: ResultFigures | null;
  /** Abzeichen der Ansicht (`MatchView.badge`): Wort je Zustand, ohne Uhr (@OB-065, @OB-066) */
  badge?: MatchBadgeModel;
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

const FROM_CARD_STATUS: Record<MatchCardStatus, ViewMatchStatus> = { scheduled: 'scheduled', waiting: 'scheduled', running: 'running', finished: 'finished', skipped: 'cancelled' };

export const MatchCardHeader: React.FC<MatchCardHeaderProps> = ({
  scheduledTime, field, group, showGroupLabel, referee, status, result, badge, viewStatus,
}) => {
  const { t } = useTranslation('tournament');
  const isLive = status === 'running';
  // Ohne Abzeichen der Ansicht (Aufrufer ohne `MatchView`): grobes Abzeichen aus dem Status, ohne Feinstatus
  const model = badge ?? matchBadgeModel({ status: viewStatus ?? FROM_CARD_STATUS[status] });
  const finishedNote = status === 'finished'
    ? result?.decision === 'penalty' ? t('matchResult.finishedPenalty') : result?.decision === 'overtime' ? t('matchResult.overtimeShort') : undefined
    : undefined;

  const statusNote = viewStatus === 'awarded' ? t('view.status.awarded') : undefined;

  return (
    <div style={headerStyle}>
      <span style={{
        fontSize: cssVars.fontSizes.sm,
        fontWeight: cssVars.fontWeights.medium,
        color: isLive ? cssVars.colors.primary : cssVars.colors.textSecondary,
        fontVariantNumeric: 'tabular-nums',
      }} data-testid={badge?.kind === 'kickoff' ? 'match-kickoff' : undefined}>
        {formatTime(scheduledTime)}
      </span>
      <div style={metaStyle}>
        {field !== undefined && <span>{t('matchCard.field', { field })}</span>}
        {showGroupLabel && group && group !== 'all' && <span>{t('matchCard.groupPrefix', { group })}</span>}
        {referee && <span>{t('matchCard.refereePrefix', { referee })}</span>}
        {model.kind === 'badge' && <MatchStatusBadge model={model} size="card" />}
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
