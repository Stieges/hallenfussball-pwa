/**
 * B-26 „Zeiten verschieben“ im Spielplan-Reiter (@ZP-094, @ZP-098): Streifen nach dem Verschieben, Zeile mit Hinweis und
 * deutlicher Taste, ⋮ je Spiel und „ursprünglich hh:mm“ an den Karten (über `MatchTimeShiftContext`), Dialog, Vorschau,
 * Wiederherstellen und „Neu drucken“ (PDF-Dialog des Spielplans).
 * Ohne Recht `manageSchedule`, im Bearbeitungsmodus und nach dem Abschluss bietet die App das Verschieben nicht an (@ZP-087).
 */
import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { PDFExportDialog } from '../../../components/dialogs/PDFExportDialog';
import { MatchTimeShiftContext, type MatchTimeShiftSlotsValue } from '../../../components/schedule/matchTimeShiftContext';
import { originalStartToShow } from '../../../core/services/scheduleShift';
import type { GeneratedSchedule } from '../../../core/generators';
import type { TournamentView } from '../../../core/view';
import type { Standing, Tournament } from '../../../types/tournament';
import { MatchShiftMenu } from './MatchShiftMenu';
import { TimeShiftDialog } from './TimeShiftDialog';
import { TimeShiftPreview } from './TimeShiftPreview';
import { TimeShiftStrip } from './TimeShiftStrip';
import type { MatchChoice } from './TimeShiftForm';
import { clockText } from './timeShiftText';
import { useTimeShift } from './useTimeShift';

interface ScheduleTimeShiftProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  standings: Standing[];
  view: TournamentView;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
  showSuccess: (message: string) => void;
  /** Verschieben anbieten (Recht, nicht im Bearbeitungsmodus, nicht abgeschlossen) */
  enabled: boolean;
  canCreateNotice: boolean;
  children: ReactNode;
}

const bar: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.sm, marginBottom: cssVars.spacing.md };
const hint: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, flex: '1 1 12em', minWidth: 0 };
// Deutlich, aber keine Haupttaste (Mockup E5): kräftiger Rahmen in der Hauptfarbe, leichte Tönung, fette Schrift
const shiftButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: cssVars.spacing.sm,
  flex: '1 1 auto',
  minHeight: cssVars.touchTargets.primary,
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
  background: cssVars.colors.primaryLight,
  color: cssVars.colors.textPrimary,
  border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.primary}`,
  borderRadius: cssVars.borderRadius.md,
  fontFamily: cssVars.fontFamilies.body,
  fontSize: cssVars.fontSizes.md,
  fontWeight: cssVars.fontWeights.bold,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

export function ScheduleTimeShift({ tournament, schedule, standings, view, onTournamentUpdate, showSuccess, enabled, canCreateNotice, children }: ScheduleTimeShiftProps) {
  const { t } = useTranslation('tournament');
  const shift = useTimeShift({ tournament, view, onTournamentUpdate, showSuccess });
  const [printing, setPrinting] = useState(false);
  const { statusOf, open } = shift;

  const pairingOf = useCallback((matchId: string) => {
    const shown = view.byId.get(matchId);
    return shown ? `${shown.home.label} – ${shown.away.label}` : '';
  }, [view]);

  const openMatches = useMemo(
    () => tournament.matches
      .filter((m) => m.scheduledTime !== undefined && statusOf(m) === 'scheduled')
      .sort((a, b) => new Date(a.scheduledTime ?? 0).getTime() - new Date(b.scheduledTime ?? 0).getTime() || a.field - b.field),
    [tournament.matches, statusOf],
  );
  const choices: MatchChoice[] = useMemo(() => openMatches.map((match) => {
    const shown = view.byId.get(match.id);
    return { match, home: shown?.home.label ?? '', away: shown?.away.label ?? '' };
  }), [openMatches, view]);

  const slots: MatchTimeShiftSlotsValue = useMemo(() => {
    const byId = new Map(tournament.matches.map((m) => [m.id, m]));
    return {
      originalTimeOf: (id) => {
        const m = byId.get(id);
        return m === undefined ? undefined : clockText(originalStartToShow(m));
      },
      ...(enabled ? {
        renderMenu: (id: string) => {
          const m = byId.get(id);
          if (m?.scheduledTime === undefined) {
            return null;
          }
          const from = new Date(m.scheduledTime).getTime();
          const after = openMatches.filter((x) => new Date(x.scheduledTime ?? 0).getTime() >= from);
          const numbers = after.map((x) => x.matchNumber).filter((n): n is number => n !== undefined);
          return (
            <MatchShiftMenu
              matchId={id}
              matchNumber={m.matchNumber}
              time={clockText(m.scheduledTime)}
              pairing={pairingOf(id)}
              status={statusOf(m)}
              affected={{ count: after.length, last: numbers.length > 0 ? Math.max(...numbers) : undefined }}
              onShiftFrom={open}
            />
          );
        },
      } : {}),
    };
  }, [tournament.matches, enabled, openMatches, pairingOf, statusOf, open]);

  return (
    <>
      {enabled && shift.strip !== null && (
        <TimeShiftStrip
          strip={shift.strip}
          canUndo={shift.restorable}
          onReprint={() => { setPrinting(true); shift.dismissStrip(); }}
          onUndo={shift.openRestore}
          onClose={shift.dismissStrip}
        />
      )}
      {enabled && (
        <div style={bar}>
          <p style={hint}>{t('timeShift.listHint')}</p>
          <button type="button" style={shiftButton} onClick={() => open()} data-testid="schedule-shift-button">
            <Icons.Clock size={iconSizeValues.md} />
            {t('timeShift.button')}
          </button>
        </div>
      )}
      <MatchTimeShiftContext.Provider value={slots}>{children}</MatchTimeShiftContext.Provider>
      {enabled && (
        <>
          <TimeShiftDialog
            isOpen={shift.step === 'form'}
            form={shift.form}
            onFormChange={shift.setForm}
            plan={shift.plan}
            kickedOff={shift.kickedOff}
            restorable={shift.restorable}
            choices={choices}
            fieldCount={tournament.numberOfFields}
            onProceed={shift.proceed}
            onRestore={shift.openRestore}
            onClose={shift.close}
          />
          <TimeShiftPreview isOpen={shift.step === 'preview'} kind="shift" plan={shift.plan} pairingOf={pairingOf} onConfirm={shift.confirm} onCancel={shift.close} />
          <TimeShiftPreview isOpen={shift.step === 'restore'} kind="restore" plan={shift.restorePlan} pairingOf={pairingOf} onConfirm={shift.confirmRestore} onCancel={shift.close} />
          <PDFExportDialog isOpen={printing} onClose={() => setPrinting(false)} tournament={tournament} schedule={schedule} standings={standings} canCreateNotice={canCreateNotice} />
        </>
      )}
    </>
  );
}
