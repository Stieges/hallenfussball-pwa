/**
 * HelperCodeCard – der Helfer-QR-Code der Turnierleitung (A-18a, Mockup M4 `r1`/`r3`): QR, Code zum Abtippen, Gültigkeit
 * („gilt bis Sa 28.11., 23:59 Uhr“, R-GA5-3), Hinweis und „Code erneuern“ (@HE-007). Nach dem Abschluss gibt es keinen Code
 * mehr (@LZ-044, Leitungs-Sicht). Der QR trägt immer dunkel auf hell, auch im dunklen Thema (Scanner brauchen den Kontrast).
 * Reine Darstellung: Laden und Erneuern gehören `useHelperAdminActions`.
 */
import type { CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/Button';
import { Icons } from '../../../../components/ui/Icons';
import { InlineNotice } from '../../../../components/ui/molecules/InlineNotice';
import { cssVars, displayMonitor, iconSizeValues } from '../../../../design-tokens';
import { helperJoinUrl } from '../../../../lib/qr/helperQr';
import type { HelperCodeInfo, HelperCodeState } from './useHelperAdminActions';
import { formatValidDay } from './helperAdminModel';
import { noticeText, noticeTitle } from './noticeStyles';

export interface HelperCodeCardProps {
  code: HelperCodeInfo | null;
  state: HelperCodeState;
  disabled: boolean;
  /** Ohne Netz: beim ersten Laden steht statt „Wird geladen“ der Grund (Geht nur mit Netz). */
  offline?: boolean;
  onRenew: () => void;
}

const card: CSSProperties = {
  display: 'grid',
  gap: cssVars.spacing.sm,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  background: cssVars.colors.surface,
  borderRadius: cssVars.borderRadius.md,
  padding: cssVars.spacing.md,
};
const head: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: `${cssVars.spacing.xs} ${cssVars.spacing.md}` };
const h2: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.xl, lineHeight: cssVars.lineHeights.title, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };
const meta: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
const qrBox: CSSProperties = { display: 'flex', justifyContent: 'center' };
const qrFrame: CSSProperties = { borderRadius: cssVars.borderRadius.md, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`, lineHeight: 0, overflow: 'hidden' };
const codeText: CSSProperties = { margin: 0, fontWeight: cssVars.fontWeights.bold, fontSize: cssVars.fontSizes.lg, letterSpacing: cssVars.letterSpacing.wider, overflowWrap: 'anywhere', color: cssVars.colors.textPrimary };
const hint: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };

export const HelperCodeCard = ({ code, state, disabled, offline = false, onRenew }: HelperCodeCardProps) => {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language === 'en' ? 'en-GB' : 'de-DE';

  if (state === 'closed') {
    return (
      <section data-testid="helper-code-card" data-state="closed">
        <InlineNotice tone="info" data-testid="helper-code-closed">
          <b style={noticeTitle}>{t('teamHelpers.code.closedTitle')}</b>
          <span style={noticeText}>{t('teamHelpers.code.closedText')}</span>
        </InlineNotice>
      </section>
    );
  }
  if (state === 'loading' || state === 'error' || code === null) {
    return (
      <section style={card} data-testid="helper-code-card" data-state={state}>
        <h2 style={h2}>{t('teamHelpers.code.title')}</h2>
        <p style={meta} role={state === 'error' ? 'alert' : 'status'}>
          {state === 'error' ? t('teamHelpers.code.error') : offline ? t('teamHelpers.offline.title') : t('teamHelpers.code.loading')}
        </p>
      </section>
    );
  }
  const url = helperJoinUrl(code.code);
  return (
    <section style={card} data-testid="helper-code-card" data-state="ready">
      <div style={head}>
        <h2 style={h2}>{t('teamHelpers.code.title')}</h2>
        <span style={meta}>{t('teamHelpers.code.validUntil', { date: formatValidDay(code.validUntil, locale) })}</span>
      </div>
      <div style={qrBox}>
        <div style={qrFrame} data-testid="helper-qr" data-url={url}>
          <QRCodeSVG
            value={url}
            size={displayMonitor.qr.sizeLarge}
            bgColor={displayMonitor.qr.background}
            fgColor={displayMonitor.qr.foreground}
            level="M"
            title={t('teamHelpers.code.qrLabel')}
            marginSize={2}
          />
        </div>
      </div>
      <p style={codeText} data-testid="helper-code">{code.code}</p>
      <p style={hint}>{t('teamHelpers.code.hint')}</p>
      <Button
        variant="secondary"
        size="lg"
        fullWidth
        icon={<Icons.Restore size={iconSizeValues.sm} />}
        disabled={disabled}
        onClick={onRenew}
        style={{ minHeight: cssVars.touchTargets.primary }}
        data-testid="helper-code-renew"
      >
        {t('teamHelpers.code.renew')}
      </Button>
    </section>
  );
};
