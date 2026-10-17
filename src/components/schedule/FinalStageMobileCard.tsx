/**
 * FinalStageMobileCard - Spielkarte der Finalrunde für Handy und Tablet hochkant (@OB-064, Variante D)
 *
 * Mannschaften untereinander, ihre Tore rechts in der Zeile; Strafstoß kleiner daneben, Sieger fett.
 * Ein offenes Spiel lässt sich hier eintragen (C-FINALRUNDE-MOBIL-EINGABE, `FinalStageMobileScore`).
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import type { ScheduledMatch } from '../../core/generators';
import { LiveBadge } from './LiveBadge';
import { MobileScoreInput, ScoreDraftProvider } from './FinalStageMobileScore';
import type { ResultFigures } from './matchResult';

export interface FinalMobileOption {
  value: number;
  label: string;
}

export interface FinalStageMobileCardProps {
  match: ScheduledMatch;
  /** Rundenname („Halbfinale“, „Finale“ …) */
  label: string;
  homeName: string;
  awayName: string;
  homePending: boolean;
  awayPending: boolean;
  result: ResultFigures | null;
  isRunning: boolean;
  isFinished: boolean;
  /** Tore dürfen eingetragen werden (Verwaltung, Spiel nicht beendet) */
  canEditScore: boolean;
  inCorrectionMode: boolean;
  onScoreChange?: (matchId: string, scoreA: number, scoreB: number) => void;
  onStartCorrection?: (matchId: string) => void;
  showReferees: boolean;
  showFields: boolean;
  editingSchedule: boolean;
  displayedRef: number | null | undefined;
  displayedField: number | undefined;
  hasPendingRef: boolean;
  hasPendingField: boolean;
  refereeOptions: FinalMobileOption[];
  fieldOptions: FinalMobileOption[];
  onRefereeChange?: (matchId: string, refereeNumber: number | null) => void;
  onFieldChange?: (matchId: string, fieldNumber: number) => void;
}

const nameStyle: CSSProperties = { overflowWrap: 'break-word' };

const selectStyle: CSSProperties = {
  width: '100%',
  height: cssVars.touchTargets.minimum,
  padding: `0 ${cssVars.spacing.lg} 0 ${cssVars.spacing.sm}`,
  borderRadius: cssVars.borderRadius.sm,
  fontSize: cssVars.fontSizes.lg,
  fontWeight: cssVars.fontWeights.semibold,
  cursor: 'pointer',
  backgroundColor: cssVars.colors.background,
  color: cssVars.colors.textPrimary,
};

export const FinalStageMobileCard: React.FC<FinalStageMobileCardProps> = (props) => {
  const {
    match, label, homeName, awayName, homePending, awayPending, result, isRunning, isFinished, canEditScore, inCorrectionMode,
    onScoreChange, onStartCorrection, showReferees, showFields, editingSchedule, displayedRef, displayedField,
    hasPendingRef, hasPendingField, refereeOptions, fieldOptions, onRefereeChange, onFieldChange,
  } = props;
  const { t } = useTranslation('tournament');
  const decided = result?.winner !== undefined && result.winner !== null;
  const note = isFinished
    ? result?.decision === 'penalty' ? t('matchResult.finishedPenalty') : result?.decision === 'overtime' ? t('matchResult.overtimeShort') : undefined
    : undefined;
  const editable = canEditScore || inCorrectionMode;

  const renderRow = (side: 'a' | 'b', name: string, pending: boolean, draftValue: string, onDraft: (value: string) => void) => {
    const isWinner = decided && result?.winner === side;
    const isLoser = decided && result?.winner !== side;
    const goals = result === null ? undefined : side === 'a' ? result.goalsA : result.goalsB;
    const penalty = side === 'a' ? result?.penaltyA : result?.penaltyB;
    const rowKey = side === 'a' ? 'home' : 'away';
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: cssVars.spacing.sm,
          padding: `${cssVars.spacing.xs} 0`,
          fontSize: cssVars.fontSizes.md,
          fontWeight: isWinner ? cssVars.fontWeights.bold : cssVars.fontWeights.normal,
          color: pending ? cssVars.colors.textPlaceholder : isLoser ? cssVars.colors.textSecondary : cssVars.colors.textPrimary,
          fontStyle: pending ? 'italic' : 'normal',
        }}
      >
        <span style={nameStyle} data-winner={isWinner ? 'true' : undefined} data-testid={`final-name-${match.id}-${rowKey}`}>{name}</span>
        {editable ? (
          <MobileScoreInput
            value={draftValue}
            onChange={onDraft}
            inCorrectionMode={inCorrectionMode}
            testId={`final-score-input-${match.id}-${rowKey}`}
            ariaLabel={name}
          />
        ) : (
          <span style={{ display: 'flex', alignItems: 'baseline', gap: cssVars.spacing.xs, fontVariantNumeric: 'tabular-nums' }}>
            <span
              style={{ fontSize: cssVars.fontSizes.xl, fontWeight: isWinner ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold }}
              data-testid={`final-goals-${match.id}-${rowKey}`}
            >
              {goals ?? '–'}
            </span>
            {penalty !== undefined && (
              <span style={{ fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary }} data-testid={`final-penalty-${match.id}-${rowKey}`}>
                ({penalty})
              </span>
            )}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      data-testid={`final-card-${match.id}`}
      style={{
        backgroundColor: isRunning ? cssVars.colors.statusLiveRowBg : cssVars.colors.background,
        border: `2px solid ${isRunning ? cssVars.colors.statusLive : cssVars.colors.accent}`,
        borderRadius: cssVars.borderRadius.md,
        padding: `${cssVars.spacing.sm} ${cssVars.spacing.sm}`,
        marginBottom: cssVars.spacing.sm,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: cssVars.spacing.xs, fontSize: cssVars.fontSizes.sm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs, color: cssVars.colors.textSecondary }}>
          <span style={{ fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.accent }}>#{match.matchNumber}</span>
          <span>•</span>
          <span>{match.time}</span>
          {isRunning && <LiveBadge compact />}
          {note && <span style={{ fontWeight: cssVars.fontWeights.bold }} data-testid={`final-decision-${match.id}`}>{note}</span>}
        </div>
        <div style={{ display: 'flex', gap: cssVars.spacing.sm, color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.xs }}>
          {showReferees && displayedRef && <span style={hasPendingRef ? { color: cssVars.colors.primary } : undefined}>SR:{displayedRef}</span>}
          {showFields && displayedField && displayedField > 1 && <span style={hasPendingField ? { color: cssVars.colors.primary } : undefined}>F:{displayedField}</span>}
        </div>
      </div>

      <div
        style={{
          fontSize: cssVars.fontSizes.sm,
          fontWeight: cssVars.fontWeights.bold,
          color: cssVars.colors.accent,
          marginBottom: cssVars.spacing.xs,
          textAlign: 'center',
          backgroundColor: cssVars.colors.accentLight,
          padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
          borderRadius: cssVars.borderRadius.sm,
        }}
      >
        {label}
      </div>

      <ScoreDraftProvider
        matchId={match.id}
        scoreA={match.scoreA}
        scoreB={match.scoreB}
        onCommit={(a, b) => onScoreChange?.(match.id, a, b)}
      >
        {(draft) => (
          <>
            {renderRow('a', homeName, homePending, draft.a, draft.setA)}
            {renderRow('b', awayName, awayPending, draft.b, draft.setB)}
          </>
        )}
      </ScoreDraftProvider>

      {isFinished && !inCorrectionMode && onStartCorrection && (
        <button
          onClick={() => onStartCorrection(match.id)}
          style={{
            marginTop: cssVars.spacing.xs,
            padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
            minHeight: cssVars.touchTargets.minimum,
            fontSize: cssVars.fontSizes.xs,
            color: cssVars.colors.textSecondary,
            backgroundColor: 'transparent',
            border: `1px solid ${cssVars.colors.borderControl}`,
            borderRadius: cssVars.borderRadius.sm,
            cursor: 'pointer',
            width: '100%',
          }}
          className="correction-btn-mobile"
        >
          {t('finals.correct')}
        </button>
      )}

      {editingSchedule && (showReferees || showFields) && (
        <div style={{ display: 'flex', gap: cssVars.spacing.sm, marginTop: cssVars.spacing.xs, paddingTop: cssVars.spacing.xs, borderTop: `1px solid ${cssVars.colors.border}` }}>
          {showReferees && onRefereeChange && (
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textMuted }}>SR</label>
              <select
                value={displayedRef ?? ''}
                onChange={(e) => onRefereeChange(match.id, e.target.value ? parseInt(e.target.value, 10) : null)}
                style={{ ...selectStyle, border: `1px solid ${hasPendingRef ? cssVars.colors.primary : cssVars.colors.borderControl}` }}
              >
                <option value="">-</option>
                {refereeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}
          {showFields && onFieldChange && (
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textMuted }}>{t('finals.field')}</label>
              <select
                value={displayedField ?? 1}
                onChange={(e) => onFieldChange(match.id, parseInt(e.target.value, 10))}
                style={{ ...selectStyle, border: `1px solid ${hasPendingField ? cssVars.colors.primary : cssVars.colors.borderControl}` }}
              >
                {fieldOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FinalStageMobileCard;
