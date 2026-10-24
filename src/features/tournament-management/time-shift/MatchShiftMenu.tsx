/**
 * B-26 „Ab hier verschieben“ am Spiel (@ZP-098, Mockup Bild 1 „spiel-menue“, E12): ⋮ je Spiel öffnet ein Blatt (Handy) bzw.
 * ein kleines Fenster mit Spiel, Uhrzeit und Paarung. Bei einem geplanten Spiel öffnet „Ab hier verschieben“ den Dialog mit
 * „ab Spiel N“; bei laufenden, beendeten und ausgefallenen Spielen ist die Option grau mit „Nicht möglich“ und einem Satz,
 * warum (fehlt nicht still).
 */
import { useId, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, dialogWidths, iconSizeValues } from '../../../design-tokens';
import { DialogSurface } from '../../../components/ui/molecules/DialogSurface';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import type { ViewMatchStatus } from '../../../core/view';

export interface MatchShiftMenuProps {
  matchId: string;
  matchNumber: number | undefined;
  time: string | undefined;
  pairing: string;
  status: ViewMatchStatus;
  /** Spiele, die „ab hier“ verschoben würden: Anzahl und letzte Nummer */
  affected: { count: number; last: number | undefined };
  onShiftFrom: (matchId: string) => void;
}

const trigger: CSSProperties = {
  width: cssVars.touchTargets.minimum,
  height: cssVars.touchTargets.minimum,
  minWidth: cssVars.touchTargets.minimum,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: cssVars.borderRadius.md,
  color: cssVars.colors.textPrimary,
  cursor: 'pointer',
};
const content: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, padding: cssVars.spacing.xl };
const heading: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };
const sub: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, overflowWrap: 'anywhere' };
const why: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textPrimary };

function itemStyle(enabled: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: `${cssVars.iconSizes.md} minmax(0, 1fr)`,
    gap: cssVars.spacing.md,
    alignItems: 'center',
    width: '100%',
    minHeight: cssVars.touchTargets.primary,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    textAlign: 'left',
    fontFamily: cssVars.fontFamilies.body,
    fontSize: cssVars.fontSizes.md,
    color: enabled ? cssVars.colors.textPrimary : cssVars.colors.textSecondary,
    background: cssVars.colors.surface,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

const WHY_KEY = {
  running: 'timeShift.menuWhyRunning',
  paused: 'timeShift.menuWhyRunning',
  finished: 'timeShift.menuWhyFinished',
  awarded: 'timeShift.menuWhyFinished',
  cancelled: 'timeShift.menuWhyCancelled',
} as const satisfies Partial<Record<ViewMatchStatus, string>>;

export function MatchShiftMenu({ matchId, matchNumber, time, pairing, status, affected, onShiftFrom }: MatchShiftMenuProps) {
  const { t } = useTranslation('tournament');
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const number = matchNumber ?? '?';
  const enabled = status === 'scheduled';
  const running = status === 'running' || status === 'paused';
  const statusText = enabled ? t('timeShift.statusPlanned') : running ? t('timeShift.statusRunning') : t('timeShift.statusFinished');
  const whyKey = status === 'scheduled' ? undefined : WHY_KEY[status];
  return (
    <>
      <button type="button" style={trigger} aria-label={t('timeShift.menuLabel', { number })} aria-haspopup="dialog" onClick={() => setOpen(true)} data-testid={`match-menu-${matchId}`}>
        <Icons.MoreVertical size={iconSizeValues.md} />
      </button>
      <DialogSurface
        isOpen={open}
        onClose={() => setOpen(false)}
        placement="center"
        maxWidth={dialogWidths.sm}
        labelledBy={titleId}
        testId="match-menu-sheet"
      >
        <div style={content}>
          <div>
            <h4 id={titleId} style={heading}>{t(running ? 'timeShift.menuTitleRunning' : 'timeShift.menuTitle', { number, time: time ?? '–' })}</h4>
            <p style={sub}>{pairing} · {statusText}</p>
          </div>
          <button
            type="button"
            style={itemStyle(enabled)}
            aria-disabled={!enabled}
            onClick={() => {
              if (enabled) {
                setOpen(false);
                onShiftFrom(matchId);
              }
            }}
            data-testid="ab-hier-verschieben"
          >
            <Icons.Clock size={iconSizeValues.md} />
            <span>
              <b>{t('timeShift.menuShift')}</b><br />
              <span style={sub}>{enabled
                ? t('timeShift.menuShiftSub', { count: affected.count, first: number, last: affected.last ?? number })
                : t('timeShift.menuNotPossible')}</span>
            </span>
          </button>
          {!enabled && whyKey !== undefined && <p style={why} data-testid="ab-hier-verschieben-grund">{t(whyKey, { number })}</p>}
          <Button variant="secondary" size="lg" fullWidth style={{ minHeight: cssVars.touchTargets.minimum }} onClick={() => setOpen(false)} data-testid="match-menu-cancel">
            {t('timeShift.cancel')}
          </Button>
        </div>
      </DialogSurface>
    </>
  );
}
