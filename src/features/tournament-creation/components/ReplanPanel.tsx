/**
 * ReplanPanel – Vorschau einer Neuplanung (@W5-005, @W5-007, @W5-008, @W5-009).
 *
 * Zeigt Endzeit, Zahl neuer und entfallender Spiele (Record user_ux Z. 227),
 * Hinweise zu behaltenen Spielen, bei @W5-008 Grund UND Lösungsvorschlag.
 * Bestätigen ist bei `impossible` und `refused` gesperrt; Abbrechen ändert
 * nichts (@W5-007).
 */
import { CSSProperties, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match, Team } from '../../../types/tournament';
import { sideLabel, sidePairingRef } from '../utils/matchSides';
import type { ReplanPreviewResult } from '../utils/replan';
import { formatReplanTime } from '../utils/replan';
import { Dialog } from '../../../components/dialogs/Dialog';
import { Button } from '../../../components/ui';
import { cssVars } from '../../../design-tokens';

export interface ReplanPanelProps {
  isOpen: boolean;
  preview: ReplanPreviewResult;
  previousMatches: Match[];
  teams: Team[];
  onConfirm: () => void;
  onCancel: () => void;
}

/** G3/E3: Paarungsschlüssel wie replan.ts – Paarung und Phase, nicht die ID. */
const pairingKey = (
  teamA: string,
  teamB: string,
  phase: string
): string => [teamA, teamB].sort().join(':') + ':' + phase;



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
  teams,
  onConfirm,
  onCancel,
}) => {
  const { t, i18n } = useTranslation('wizard');
  // @OB-014: Startfokus auf „Abbrechen", Enter löst in der Neuplanungs-Rückfrage nichts aus.
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  // E3: nach Paarung und Phase zählen – der Generator vergibt neue IDs.
  const previousKeys = new Set(
    previousMatches.map((m) =>
      pairingKey(sidePairingRef(m, 'A'), sidePairingRef(m, 'B'), m.phase ?? (m.isFinal ? 'final' : 'groupStage'))
    )
  );
  const generatedKeys = new Set(
    preview.status === 'preview'
      ? preview.schedule.allMatches.map((g) =>
          pairingKey(g.originalTeamA, g.originalTeamB, g.phase)
        )
      : []
  );

  const newCount =
    preview.status === 'preview'
      ? preview.schedule.allMatches.filter(
          (g) =>
            !previousKeys.has(pairingKey(g.originalTeamA, g.originalTeamB, g.phase))
        ).length
      : 0;
  const droppedCount =
    preview.status === 'preview'
      ? previousMatches.filter(
          (m) =>
            !generatedKeys.has(
              pairingKey(sidePairingRef(m, 'A'), sidePairingRef(m, 'B'), m.phase ?? (m.isFinal ? 'final' : 'groupStage'))
            )
        ).length
      : 0;
  const blocked = preview.status !== 'preview';
  const pairingOf = (matchId: string): string => {
    const match =
      preview.status === 'preview'
        ? preview.keptMatches.find((k) => k.id === matchId)
        : undefined;
    return match
      ? `${sideLabel(match, 'A', teams)} – ${sideLabel(match, 'B', teams)}`
      : matchId;
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      title={t('replan.title')}
      closeOnBackdropClick={false}
      initialFocusRef={cancelButtonRef}
      suppressEnter
    >
      <div data-testid="replan-panel">
        {preview.status === 'preview' && (
          <>
            <div style={boxStyle} data-testid="replan-end-time">
              <strong>{t('replan.endTime')}:</strong> {formatReplanTime(preview.endTime, i18n.language)}
            </div>
            <div
              style={boxStyle}
              data-testid="replan-counts"
              data-new-count={newCount}
              data-dropped-count={droppedCount}
            >
              <div>{t('replan.newMatches', { count: newCount })}</div>
              <div>{t('replan.removedMatches', { count: droppedCount })}</div>
            </div>
            {preview.keptNotices.length > 0 && (
              <div style={boxStyle} data-testid="replan-kept-notices">
                <p style={hintStyle}>{t('replan.keptHint')}</p>
                <ul>
                  {preview.keptNotices.map((notice) => (
                    <li key={notice.matchId} style={hintStyle}>
                      {pairingOf(notice.matchId)}: {t('replan.keptMatch')}
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
                      {pairingOf(matchId)}: {t('replan.conflict')}
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
              <strong>{t('replan.reason')}:</strong> {t(preview.reasonKey)}
              {'detail' in preview && preview.detail ? ` (${preview.detail})` : ''}
            </p>
            {'suggestionKey' in preview && (
              <p style={hintStyle} data-testid="replan-suggestion">
                <strong>{t('replan.suggestion')}:</strong> {t(preview.suggestionKey)}
              </p>
            )}
            <p style={hintStyle} data-testid="replan-not-confirmable">
              {t('replan.notConfirmable')}
            </p>
          </div>
        )}
        <div style={{ display: 'flex', gap: cssVars.spacing.md, justifyContent: 'flex-end' }}>
          <Button
            ref={cancelButtonRef}
            variant="secondary"
            onClick={onCancel}
            data-testid="replan-cancel"
          >
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
