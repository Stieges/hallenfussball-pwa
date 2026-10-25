/**
 * Einstellungen: Spielzeit und Pause gesperrt, das Schloss erklärt sich (@ZP-095, Mockup Bild 7 „einst“, „einst-schloss“, E9),
 * und der Abschnitt „Uhrzeiten“ führt zu „Zeiten verschieben“ im Spielplan (B-26; ersetzt den früheren Platzhalter
 * „Auto-Time-Continuation“). Der Satz zu „Zeiten verschieben“ erscheint nur, wenn die Funktion angeboten wird: die Kategorie
 * sehen nur Rollen mit `tournamentSettings` (CategoryRightGate: Eigentümer, Co-Admin), beide haben `manageSchedule`; nach dem
 * Abschluss bietet der Spielplan das Verschieben nicht an.
 * Spielzeit und Pause bleiben schreibgeschützte Felder mit dem Hinweis aus @OB-043; das Schloss ersetzt das frühere „🔒“.
 */
import { useId, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cssVars, dialogWidths, iconSizeValues } from '../../../../design-tokens';
import { CollapsibleSection } from '../shared';
import { Icons } from '../../../../components/ui/Icons';
import { DialogSurface } from '../../../../components/ui/molecules/DialogSurface';
import { DialogActions } from '../../../../components/ui/molecules/DialogActions';
import { SHIFT_QUERY } from '../../../tournament-management/time-shift/useTimeShift';
import type { Tournament } from '../../../../types/tournament';
import { isTournamentClosed } from '../../../../core/services/lifecycle';

const row: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs, marginBottom: cssVars.spacing.md };
const label: CSSProperties = { fontSize: cssVars.fontSizes.labelSm, color: cssVars.colors.textSecondary };
const valueRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm };
const input: CSSProperties = {
  width: '5em',
  minHeight: cssVars.touchTargets.minimum,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  background: cssVars.colors.inputBg,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.bodyMd,
  textAlign: 'center',
  opacity: cssVars.opacity.disabled,
};
const unit: CSSProperties = { fontSize: cssVars.fontSizes.bodySm, color: cssVars.colors.textSecondary };
const hint: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.labelSm, color: cssVars.colors.textSecondary };
const lockButton: CSSProperties = {
  width: cssVars.touchTargets.minimum,
  height: cssVars.touchTargets.minimum,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: cssVars.colors.surface,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md,
  color: cssVars.colors.textPrimary,
  cursor: 'pointer',
};
const shiftButton: CSSProperties = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  gap: cssVars.spacing.sm,
  minHeight: cssVars.touchTargets.primary,
  background: cssVars.colors.primaryLight,
  color: cssVars.colors.textPrimary,
  border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.primary}`,
  borderRadius: cssVars.borderRadius.md,
  fontFamily: cssVars.fontFamilies.body,
  fontSize: cssVars.fontSizes.md,
  fontWeight: cssVars.fontWeights.bold,
  cursor: 'pointer',
};
const sheetBody: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, padding: cssVars.spacing.xl };
const sheetTitle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };

export function GameTimesSection({ tournament }: { tournament: Tournament }) {
  const { t } = useTranslation('admin');
  const { t: tt } = useTranslation('tournament');
  const navigate = useNavigate();
  const titleId = useId();
  const inputId = useId();
  const canShift = !isTournamentClosed(tournament);
  const [why, setWhy] = useState(false);
  const toShift = () => {
    setWhy(false);
    void navigate(`/tournament/${tournament.id}/schedule?${SHIFT_QUERY}=1`);
  };
  const locked = [
    { key: 'game', name: t('settingsSection.gameTimePerMatch'), minutes: tournament.groupPhaseGameDuration },
    { key: 'break', name: t('settingsSection.breakTime'), minutes: tournament.groupPhaseBreakDuration ?? 0 },
  ];

  return (
    <>
      <CollapsibleSection icon="⏱️" title={t('settingsSection.gameTimes')}>
        {locked.map((item) => (
          <div key={item.key} style={row}>
            <label htmlFor={`${inputId}-${item.key}`} style={label}>{item.name}</label>
            <div style={valueRow}>
              <input id={`${inputId}-${item.key}`} type="number" value={item.minutes} disabled readOnly style={input} data-testid={`settings-locked-${item.key}`} />
              <span style={unit}>{tt('timeShift.minutesUnit')}</span>
              <button type="button" style={lockButton} aria-label={tt('timeShift.lockButton', { name: item.name })} onClick={() => setWhy(true)} data-testid={`settings-lock-${item.key}`}>
                <Icons.Lock size={iconSizeValues.sm} />
              </button>
            </div>
            <p style={hint}>{t('settingsSection.gameTimeLockedHint')}</p>
          </div>
        ))}
      </CollapsibleSection>

      {canShift && (
        <CollapsibleSection icon="🕒" title={tt('timeShift.timesSection')} defaultOpen>
          <p style={{ ...hint, marginBottom: cssVars.spacing.md }}>{tt('timeShift.timesSectionDesc')}</p>
          <button type="button" style={shiftButton} onClick={toShift} data-testid="settings-time-shift">
            <Icons.Clock size={iconSizeValues.md} />
            {tt('timeShift.button')}
          </button>
        </CollapsibleSection>
      )}

      <DialogSurface
        isOpen={why}
        onClose={() => setWhy(false)}
        maxWidth={dialogWidths.sm}
        labelledBy={titleId}
        testId="settings-lock-why"
        footer={canShift
          ? <DialogActions secondary={[{ label: tt('timeShift.close'), onClick: () => setWhy(false) }]} primary={{ label: tt('timeShift.button'), onClick: toShift, 'data-testid': 'settings-lock-shift' }} />
          : <DialogActions primary={{ label: tt('timeShift.close'), onClick: () => setWhy(false) }} />}
      >
        <div style={sheetBody}>
          <h4 id={titleId} style={sheetTitle}>{tt('timeShift.lockWhyTitle')}</h4>
          <p style={{ margin: 0 }} data-testid="settings-lock-why-text">{canShift ? tt('timeShift.lockWhy') : t('settingsSection.gameTimeLockedHint')}</p>
        </div>
      </DialogSurface>
    </>
  );
}
