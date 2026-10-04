/**
 * ReplanPanel – Vorschau einer Neuplanung (@W5-005, @W5-007, @W5-008, @W5-009).
 *
 * Zeigt Endzeit, Zahl neuer und entfallender Spiele (Record user_ux Z. 227),
 * Hinweise zu behaltenen Spielen, bei @W5-008 Grund UND Lösungsvorschlag.
 * Bestätigen ist bei `impossible` und `refused` gesperrt; Abbrechen ändert
 * nichts (@W5-007).
 */
import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match } from '../../../types/tournament';
import type { ReplanPreviewResult } from '../utils/replan';
import { Dialog } from '../../../components/dialogs/Dialog';
import { Button } from '../../../components/ui';
import { cssVars } from '../../../design-tokens';

export interface ReplanPanelProps {
  isOpen: boolean;
  preview: ReplanPreviewResult;
  previousMatches: Match[];
  onConfirm: () => void;
  onCancel: () => void;
}

const formatTime = (date: Date): string =>
  date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

const boxStyle: CSSProperties = {
  padding: cssVars.spacing.md,
  borderRadius: cssVars.borderRadius.md,
  border: `1px solid ${cssVars.colors.border}`,
  marginBottom: cssVars.spacing.md,
};

const hintStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textSecondary,
  lineHeight: 1.6,
};

export const ReplanPanel: React.FC<ReplanPanelProps> = ({
  isOpen,
  preview,
  previousMatches,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation('wizard');
  const previousIds = new Set(previousMatches.map((m) => m.id));

  const newCount =
    preview.status === 'preview'
      ? preview.schedule.allMatches.filter((m) => !previousIds.has(m.id)).length
      : 0;
  const droppedCount =
    preview.status === 'preview'
      ? previousMatches.filter(
          (m) =>
            !preview.schedule.allMatches.some((g) => g.id === m.id) &&
            !preview.keptMatches.some((k) => k.id === m.id)
        ).length
      : 0;
  const blocked = preview.status !== 'preview';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      title={t('replan.title')}
      closeOnBackdropClick={false}
      maxWidth="560px"
    >
      <div data-testid="replan-panel">
        {preview.status === 'preview' && (
          <>
            <div style={boxStyle} data-testid="replan-end-time">
              <strong>{t('replan.endTime')}:</strong> {formatTime(preview.endTime)}
            </div>
            <div style={boxStyle} data-testid="replan-counts">
              <div>{t('replan.newMatches', { count: newCount })}</div>
              <div>{t('replan.removedMatches', { count: droppedCount })}</div>
            </div>
            {preview.keptNotices.length > 0 && (
              <div style={boxStyle} data-testid="replan-kept-notices">
                <p style={hintStyle}>{t('replan.keptHint')}</p>
                <ul>
                  {preview.keptNotices.map((notice) => (
                    <li key={notice.matchId} style={hintStyle}>
                      {t('replan.keptMatch')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {preview.conflictMatchIds.length > 0 && (
              <div style={boxStyle} data-testid="replan-conflicts">
                <ul>
                  {preview.conflictMatchIds.map((matchId) => (
                    <li key={matchId} style={hintStyle}>
                      {t('replan.conflict')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {preview.status !== 'preview' && (
          <div style={boxStyle} data-testid="replan-blocked">
            <p style={hintStyle} data-testid="replan-reason">
              <strong>{t('replan.reason')}:</strong> {preview.reason}
            </p>
            {'suggestion' in preview && (
              <p style={hintStyle} data-testid="replan-suggestion">
                <strong>{t('replan.suggestion')}:</strong> {preview.suggestion}
              </p>
            )}
            <p style={hintStyle} data-testid="replan-not-confirmable">
              {t('replan.notConfirmable')}
            </p>
          </div>
        )}
        <div style={{ display: 'flex', gap: cssVars.spacing.md, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancel} data-testid="replan-cancel">
            {t('replan.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={blocked}
            data-testid="replan-confirm"
          >
            {t('replan.confirm')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
