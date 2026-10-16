/**
 * Hinweis-Schritt vor dem Speichern (B-28 C8; @DR-012, @DR-027, @DR-024, G45, G78 bis G80): nennt Teamnamen und Angaben mit
 * Zeichen, die als „?“ gedruckt werden (Original und Gedrucktes untereinander), die Ersatzschrift und unbrauchbare Grafiken.
 * Das PDF entsteht trotzdem.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { InlineNotice } from '../../ui/molecules';
import type { PdfHints, PrintedText } from '../../../lib/pdf/notes';

const stack: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const heading: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.bold };
const list: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs };
const item: CSSProperties = {
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  borderRadius: cssVars.borderRadius.md,
  background: cssVars.colors.background,
  overflowWrap: 'anywhere',
};
const caption: CSSProperties = { display: 'block', fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary };
const strong: CSSProperties = { fontWeight: cssVars.fontWeights.semibold };
const note: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary };

export const PdfHintStep = ({ hints }: { hints: PdfHints }) => {
  const { t } = useTranslation('tournament');
  const entry = (label: string, text: PrintedText, key: string) => (
    <li key={key} style={item} data-testid="pdf-hint-item">
      <span style={caption}>{label}</span>
      <span style={strong}>{text.original}</span>
      <span style={caption}>{t('pdfExport.hints.printedAs')}</span>
      <span style={strong}>{text.printed}</span>
    </li>
  );
  const hasChars = hints.names.length > 0 || hints.fields.length > 0;

  return (
    <div style={stack} data-testid="pdf-hint-step">
      {hints.fontFallback ? (
        <InlineNotice tone="warn" data-testid="pdf-hint-font">
          <span style={strong}>{t('pdfExport.hints.fontTitle')}</span>
          <span>{t('pdfExport.hints.fontBody')}</span>
        </InlineNotice>
      ) : null}
      {hints.names.length > 0 ? (
        <div>
          <p style={heading}>{t('pdfExport.hints.names', { count: hints.names.length })}</p>
          <ul style={list}>{hints.names.map((name, i) => entry(t('pdfExport.hints.teamName'), name, `n${i}`))}</ul>
        </div>
      ) : null}
      {hints.fields.length > 0 ? (
        <div>
          <p style={heading}>{t('pdfExport.hints.fields', { count: hints.fields.length })}</p>
          <ul style={list}>{hints.fields.map((field, i) => entry(field.label, field, `f${i}`))}</ul>
        </div>
      ) : null}
      {hints.logos.map(side => (
        <InlineNotice key={side} tone="warn" data-testid="pdf-hint-logo">
          {t(side === 'left' ? 'pdfExport.hints.logoLeft' : 'pdfExport.hints.logoRight')}
        </InlineNotice>
      ))}
      {hasChars ? (
        <p style={note}>
          {t('pdfExport.hints.proceed')}
          {hints.names.length > 0 ? ` ${t('pdfExport.hints.changeNames')}` : ''}
          {hints.fields.length > 0 ? ` ${t('pdfExport.hints.changeFields')}` : ''}
        </p>
      ) : null}
    </div>
  );
};
