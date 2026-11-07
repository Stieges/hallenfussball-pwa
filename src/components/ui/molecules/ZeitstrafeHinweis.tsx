/**
 * ZeitstrafeHinweis – laufende Zeitstrafen eines Teams auf der Spielkarte, beim Team (@ZM-184): „Zeitstrafe #5 · 1:23“, ohne
 * Rückennummer „Zeitstrafe · 1:23“. Die Restzeit läuft mit der Spieluhr (Uhr der Karte). Neutrale Farbe, nicht Kartenrot.
 * Umschließt den Namen (`children`): ohne laufende Strafe bleibt der Name unverändert stehen (kein zusätzlicher Rahmen),
 * mit Strafe stehen die Zeilen darunter.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { zeitstrafeRestText, type OeffentlicheZeitstrafe } from '../../../core/view';

export interface ZeitstrafeHinweisProps {
  liste: readonly OeffentlicheZeitstrafe[] | undefined;
  testId: string;
  /** Ausrichtung in der Zeile (Laptop: Heim rechtsbündig) */
  align?: 'start' | 'end';
  /** Der Name des Teams */
  children: ReactNode;
}

const spalte: CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0 };

const stil: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.semibold,
  color: cssVars.colors.textSecondary,
  fontVariantNumeric: 'tabular-nums',
};

export function ZeitstrafeHinweis({ liste, testId, align = 'start', children }: ZeitstrafeHinweisProps): ReactElement {
  const { t } = useTranslation('tournament');
  if (liste === undefined || liste.length === 0) {
    return <>{children}</>;
  }
  const ausrichtung = align === 'end' ? 'flex-end' : 'flex-start';
  return (
    <span style={{ ...spalte, alignItems: ausrichtung }}>
      {children}
      <span style={{ ...stil, alignItems: ausrichtung }} data-testid={testId}>
      {liste.map((strafe) => {
        const rest = zeitstrafeRestText(strafe);
        return (
          <span key={strafe.id}>
            {strafe.nummer === null ? t('matchCard.timePenaltyNoNumber', { rest }) : t('matchCard.timePenalty', { number: strafe.nummer, rest })}
          </span>
        );
      })}
      </span>
    </span>
  );
}
