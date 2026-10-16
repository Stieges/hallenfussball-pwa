/**
 * Wahlschritt des PDF-Dialogs (B-28 C8, Mockup „PDF-Dialog“): Karten „Spielplan“, „Spielplan ohne Ergebnisse“, „Endstand“
 * (bis zum Abschluss ausgegraut, G44) und „Aushang mit QR-Code“ (ohne Online-Teilen ausgegraut, @ZM-064), darunter die
 * Hinweise zu Sichtbarkeit, Netz und Fehler und die Zeile „Format: A4 hoch“ (@DR-026, keine Wahl „quer“). Zuschauer
 * (`audience viewer`) sehen nur „Spielplan“ ohne Wahl (@BM-057, G47).
 */
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues, letterSpacing } from '../../../design-tokens';
import { Icons } from '../../ui/Icons';
import { ChoiceCard, InlineNotice } from '../../ui/molecules';
import type { PdfChoice } from './buildChoice';

export interface PdfFormStepProps {
  viewer: boolean;
  choice: PdfChoice;
  onChoice: (choice: PdfChoice) => void;
  /** Das Turnier ist online geteilt (Aushang möglich). */
  shared: boolean;
  /** Der Endstand ist wählbar (erst nach dem Abschluss, C10). */
  finalAvailable: boolean;
  hideScores: boolean;
  hideTables: boolean;
  /** „TT.MM.“ und „HH:mm“, gesetzt wenn das Gerät kein Netz hat (@DR-021, G69). */
  offlineStamp: { date: string; time: string } | undefined;
  failed: boolean;
  notShared: boolean;
  /** Wege zu den Schaltern; ohne Angabe erscheint nur der Text. */
  onOpenVisibility?: () => void;
}

const groupLabel: CSSProperties = {
  margin: `${cssVars.spacing.md} 0 ${cssVars.spacing.sm}`,
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.bold,
  letterSpacing: letterSpacing.wide,
  textTransform: 'uppercase',
  color: cssVars.colors.textSecondary,
};
const cards: CSSProperties = { display: 'grid', gap: cssVars.spacing.sm };
const stack: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const small: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary };
const bold: CSSProperties = { display: 'block', fontWeight: cssVars.fontWeights.semibold };
const link: CSSProperties = {
  minHeight: cssVars.touchTargets.minimum,
  padding: `0 ${cssVars.spacing.sm}`,
  background: 'none',
  border: 0,
  color: cssVars.colors.primary,
  fontWeight: cssVars.fontWeights.semibold,
  fontSize: 'inherit',
  textDecoration: 'underline',
  cursor: 'pointer',
};

export const PdfFormStep = ({ viewer, choice, onChoice, shared, finalAvailable, hideScores, hideTables, offlineStamp, failed, notShared, onOpenVisibility }: PdfFormStepProps) => {
  const { t } = useTranslation('tournament');
  const card = (id: PdfChoice, icon: ReactNode, disabled: boolean, reasonKey?: 'pdfExport.cards.final.reason' | 'pdfExport.cards.notice.reason') => (
    <ChoiceCard
      key={id}
      data-testid={`pdf-choice-${id}`}
      icon={icon}
      title={t(`pdfExport.cards.${id}.title`)}
      description={t(`pdfExport.cards.${id}.description`)}
      selected={choice === id}
      disabled={disabled}
      reason={reasonKey ? t(reasonKey) : undefined}
      onSelect={() => onChoice(id)}
    />
  );
  const visibilityKey = hideScores && hideTables ? 'resultsAndTables' : hideScores ? 'results' : hideTables ? 'tables' : undefined;
  // Beide Wege führen zu den Schaltern der Verwaltung; die Beschriftung nennt, was dort geschieht (Mockup)
  const wayLink = (label: string, testId: string) =>
    onOpenVisibility ? (
      <button type="button" style={link} onClick={onOpenVisibility} data-testid={testId}>{label}</button>
    ) : null;

  return (
    <div style={stack}>
      {viewer ? (
        <>
          <div data-testid="pdf-viewer-plan">
            <strong>{t('pdfExport.cards.schedule.title')}</strong>
            <p style={small}>{t('pdfExport.viewer.description')}</p>
          </div>
          <InlineNotice tone="info">{t('pdfExport.hints.viewerHidden')}</InlineNotice>
        </>
      ) : (
        <div>
          <div style={groupLabel}>{t('pdfExport.groups.print')}</div>
          <div style={cards} role="radiogroup" aria-label={t('pdfExport.groups.print')}>
            {card('schedule', <Icons.Calendar size={iconSizeValues.sm} />, false)}
            {card('blank', <Icons.Edit size={iconSizeValues.sm} />, false)}
            {card('final', <Icons.Trophy size={iconSizeValues.sm} />, !finalAvailable, 'pdfExport.cards.final.reason')}
          </div>
          <div style={groupLabel}>{t('pdfExport.groups.hang')}</div>
          <div style={cards} role="radiogroup" aria-label={t('pdfExport.groups.hang')}>
            {card('notice', <Icons.QrCode size={iconSizeValues.sm} />, !shared, 'pdfExport.cards.notice.reason')}
          </div>
        </div>
      )}

      {!viewer && !shared ? (
        <InlineNotice tone="warn" data-testid="pdf-hint-not-shared">
          <span>{t('pdfExport.hints.notShared')}</span>
          {onOpenVisibility ? <span>{wayLink(t('pdfExport.hints.shareOnline'), 'pdf-open-share')}</span> : null}
        </InlineNotice>
      ) : null}
      {!viewer && choice === 'notice' ? <InlineNotice tone="info" data-testid="pdf-hint-notice">{t('pdfExport.hints.notice')}</InlineNotice> : null}
      {!viewer && choice !== 'notice' && visibilityKey ? (
        <InlineNotice tone="info" data-testid="pdf-hint-visibility">
          <span>{t(`pdfExport.hints.visibility.${visibilityKey}`)}</span>
          {onOpenVisibility ? <span>{wayLink(t('pdfExport.hints.changeVisibility'), 'pdf-open-visibility')}</span> : null}
        </InlineNotice>
      ) : null}

      <p style={small}>{t('pdfExport.format')}</p>

      {offlineStamp ? (
        <InlineNotice tone="warn" icon={<Icons.WifiOff size={iconSizeValues.sm} />} data-testid="pdf-hint-offline">
          <span style={bold}>{t('pdfExport.offline.title', offlineStamp)}</span>
          <span>{t('pdfExport.offline.body')}</span>
        </InlineNotice>
      ) : null}
      {failed ? (
        <InlineNotice tone="error" data-testid="pdf-error">
          <span style={bold}>{t('pdfExport.error.title')}</span>
          <span>{t('pdfExport.error.body')}</span>
        </InlineNotice>
      ) : null}
      {notShared ? (
        <InlineNotice tone="error" data-testid="pdf-error-not-shared">
          <span>{t('pdfExport.hints.notShared')}</span>
        </InlineNotice>
      ) : null}
    </div>
  );
};
