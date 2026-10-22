/**
 * Rahmen der Helfer-Seite (A-17b, Mockup M1/M2): Überschrift „Helfer-Zugang“ und schmale Lesespalte. Der Helfer ist am
 * Handy, die Spalte bleibt auf Dialogbreite (`dialogWidths.md`), größere Fenster zeigen sie zentriert.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, dialogWidths } from '../../../design-tokens';

const page: CSSProperties = { minHeight: 'var(--min-h-screen)', background: cssVars.colors.background, color: cssVars.colors.textPrimary };
const header: CSSProperties = { maxWidth: dialogWidths.md, margin: '0 auto', padding: `${cssVars.spacing.md} ${cssVars.spacing.md} 0` };
const title: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.xl, lineHeight: cssVars.lineHeights.title, fontWeight: cssVars.fontWeights.bold };
const main: CSSProperties = {
  maxWidth: dialogWidths.md,
  margin: '0 auto',
  padding: cssVars.spacing.md,
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.md,
};

export const JoinShell = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation('helpers');
  return (
    <div style={page} data-testid="join-screen">
      <header style={header}>
        <h1 style={title}>{t('join.title')}</h1>
      </header>
      <main style={main}>{children}</main>
    </div>
  );
};
