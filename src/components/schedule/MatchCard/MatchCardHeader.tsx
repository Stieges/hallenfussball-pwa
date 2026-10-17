/**
 * MatchCardHeader - Kopfzeile der Spielkarte (@OB-064, Mockup Variante D)
 *
 * Links die Anpfiffzeit, rechts Feld, Gruppe/Runde, SR und der Status:
 * - läuft: Kennzeichen „läuft 07:30“ (ohne bekannte Zeit „läuft“)
 * - beendet nach Strafstoßschießen: „beendet i. E.“
 * - nach Verlängerung entschieden: „n. V.“
 * - regulär beendet oder geplant: kein Zusatz
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { ResultFigures } from '../matchResult';
import type { MatchCardStatus } from './MatchCardScore';
import { formatTime } from './utils';

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

const liveBadgeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.xs,
  backgroundColor: cssVars.colors.statusLiveBg,
  color: cssVars.colors.statusLive,
  fontSize: cssVars.fontSizes.xs,
  fontWeight: cssVars.fontWeights.bold,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  borderRadius: cssVars.borderRadius.sm,
};

export const MatchCardHeader: React.FC<MatchCardHeaderProps> = ({
  scheduledTime, field, group, showGroupLabel, referee, status, result, elapsedFormatted,
}) => {
  const { t } = useTranslation('tournament');
  const isLive = status === 'running';
  const finishedNote = status === 'finished'
    ? result?.decision === 'penalty' ? t('matchResult.finishedPenalty') : result?.decision === 'overtime' ? t('matchResult.overtimeShort') : undefined
    : undefined;

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
        {isLive && (
          <>
            <span style={liveBadgeStyle} data-testid="match-card-live">
              <span style={{
                width: cssVars.spacing.sm,
                height: cssVars.spacing.sm,
                borderRadius: '50%',
                backgroundColor: cssVars.colors.statusLive,
                animation: 'pulse 2s ease-in-out infinite',
              }} />
              {elapsedFormatted ? t('matchResult.runningElapsed', { elapsed: elapsedFormatted }) : t('matchResult.running')}
            </span>
            <style>{`
              @keyframes pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.6; transform: scale(1.2); }
                100% { opacity: 1; transform: scale(1); }
              }
            `}</style>
          </>
        )}
        {finishedNote && (
          <span style={{ fontWeight: cssVars.fontWeights.bold }} data-testid="match-card-decision">{finishedNote}</span>
        )}
      </div>
    </div>
  );
};

export default MatchCardHeader;
