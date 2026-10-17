/**
 * RunningBadge – Kennzeichen eines laufenden Spiels in der Kopfzeile der Spielkarte (@OB-064):
 * „läuft 07:30“, ohne bekannte Spielzeit „läuft“. Gruppen- und Finalrunden-Karte zeigen dasselbe Kennzeichen.
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';

export interface RunningBadgeProps {
  /** Spielzeit „07:30“; fehlt sie, steht nur „läuft“ */
  elapsedFormatted?: string;
  /** Kennung für Tests; Vorgabe `match-card-live` */
  testId?: string;
}

const badgeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.xs,
  backgroundColor: cssVars.colors.statusLiveBg,
  // Text in Textfarbe (Kontrast ≥ 4,5:1 auf dem Live-Grund); die Farbe „live“ trägt der Punkt (Farbe nie allein, VISUAL-DESIGN)
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.bold,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  borderRadius: cssVars.borderRadius.sm,
  fontVariantNumeric: 'tabular-nums',
};

const dotStyle: CSSProperties = {
  width: cssVars.spacing.sm,
  height: cssVars.spacing.sm,
  borderRadius: '50%',
  backgroundColor: cssVars.colors.statusLive,
  animation: 'pulse 2s ease-in-out infinite',
};

export const RunningBadge: React.FC<RunningBadgeProps> = ({ elapsedFormatted, testId = 'match-card-live' }) => {
  const { t } = useTranslation('tournament');
  return (
    <>
      <span style={badgeStyle} data-testid={testId}>
        <span style={dotStyle} />
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
  );
};
