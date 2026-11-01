/**
 * „Tauschen mit …“ (@ZP-100): Auswahl des Zielspiels als Weg ohne Ziehen. Angepfiffene Spiele sind nicht wählbar
 * (@ZP-093). Stellt den Karten die Taste bereit (SwapWithContext) und zeigt die Auswahl im Dialog der App.
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScheduledMatch } from '../../../core/generators';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SwapWithContext, type SwapWithApi } from '../../../components/schedule/swapWithContext';
import { cssVars } from '../../../design-tokens';
import { swapPhaseOf } from '../schedule-draft/draftSteps';

interface ScheduleSwapWithProps {
  enabled: boolean;
  matches: readonly ScheduledMatch[];
  lockedIds: ReadonlySet<string>;
  onSwap: (matchId1: string, matchId2: string) => boolean;
  children: ReactNode;
}

const byTime = (a: ScheduledMatch, b: ScheduledMatch): number =>
  a.startTime.getTime() - b.startTime.getTime() || a.field - b.field || a.matchNumber - b.matchNumber;

export const ScheduleSwapWith: React.FC<ScheduleSwapWithProps> = ({ enabled, matches, lockedIds, onSwap, children }) => {
  const { t } = useTranslation('tournament');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState('');

  const api = useMemo<SwapWithApi | null>(() => (enabled ? { request: (id) => { setSourceId(id); setTargetId(''); } } : null), [enabled]);
  const source = matches.find((m) => m.id === sourceId);
  const candidates = useMemo(
    // @ZP-107: nur Spiele derselben Phase; @ZP-093: keine angepfiffenen
    () => [...matches].filter((m) => m.id !== sourceId && !lockedIds.has(m.id) && (!source || swapPhaseOf(m) === swapPhaseOf(source))).sort(byTime),
    [matches, sourceId, lockedIds, source],
  );
  const chosen = targetId || candidates[0]?.id || '';
  const close = () => { setSourceId(null); setTargetId(''); };

  const selectStyle: CSSProperties = {
    width: '100%',
    minHeight: cssVars.touchTargets.minimum,
    marginTop: cssVars.spacing.sm,
    padding: `0 ${cssVars.spacing.sm}`,
    fontSize: cssVars.fontSizes.lg,
    border: `1px solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.sm,
    backgroundColor: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
  };

  return (
    <SwapWithContext.Provider value={api}>
      {children}
      {enabled && source && (
        <ConfirmDialog
          isOpen
          onClose={close}
          onConfirm={() => { if (chosen) { onSwap(source.id, chosen); } close(); }}
          title={t('draft.swapWithTitle', { number: source.matchNumber })}
          confirmText={t('draft.swapConfirm')}
          cancelText={t('draft.overwriteCancel')}
          variant="info"
          message={
            <label style={{ display: 'block' }}>
              {t('draft.swapWithLabel')}
              <select value={chosen} onChange={(e) => setTargetId(e.target.value)} style={selectStyle} data-testid="swap-with-select">
                {candidates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {t('draft.swapOption', { number: m.matchNumber, time: m.time, field: m.field, home: m.homeTeam, away: m.awayTeam })}
                  </option>
                ))}
              </select>
            </label>
          }
        />
      )}
    </SwapWithContext.Provider>
  );
};
