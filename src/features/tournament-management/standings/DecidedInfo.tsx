/**
 * Hinweis zu einem entschiedenen Gleichstand (Paket TB-B, TB-6b'; Mockup v3): das Ergebnis, nie Person und Zeit (kommen mit
 * dem Verlaufsprotokoll, GA4 A-13b, Befund C-ENTSCHEIDUNG-PERSON-OEFFENTLICH). Die Turnierleitung kann bis zum Abschluss der
 * Gruppe zurücknehmen – ohne Rückfrage, ein Tipp (Daniel G6); danach steht der Hinweis mit Schloss und Wort. Der Helfer sieht
 * nur das Ergebnis, keine Taste und keinen Schloss-Hinweis (@W2A-071).
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import type { DecidedTieBlock } from '../../../core/standings/tieViews';
import { decidedTexts } from './decidedText';

export interface DecidedInfoProps {
  block: DecidedTieBlock;
  /** Teamname je Team-ID. */
  nameOf: (teamId: string) => string;
  canDecide: boolean;
  /** Gruppe abgeschlossen (Zwischenregel bis GA4 A-13): nicht mehr zurücknehmbar. */
  closed: boolean;
  busy: boolean;
  failed: string | null;
  onWithdraw: () => void;
}

const title: CSSProperties = { fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md };
const line: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };

// Innenabstand klein: kein Wort im Wort auf 360 px (VISUAL-DESIGN § 2)
const withdrawButton: CSSProperties = { padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}` };

const LockSymbol = () => (
  <svg width={iconSizeValues.sm} height={iconSizeValues.sm} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const DecidedInfo = ({ block, nameOf, canDecide, closed, busy, failed, onWithdraw }: DecidedInfoProps) => {
  const { t, i18n } = useTranslation('tournament');
  const { decision } = block;
  const { heading, body } = decidedTexts(t, i18n.language, decision, block, nameOf, canDecide);
  const withdrawLabel = decision.kind === 'shared' ? t('standingsTie.decided.withdrawShared') : decision.kind === 'shootout' ? t('standingsTie.decided.withdrawShootout') : t('standingsTie.decided.withdrawOrder');
  const showClosed = canDecide && closed;

  return (
    <InlineNotice
      tone="ok"
      icon={showClosed ? <LockSymbol /> : undefined}
      data-testid="tie-decided-info"
      footer={(canDecide && !closed) || failed !== null ? (
        <>
          {canDecide && !closed ? (
            <>
              <Button variant="secondary" size="md" fullWidth disabled={busy} onClick={onWithdraw} style={withdrawButton} data-testid="tie-accept-withdraw">
                {withdrawLabel}
              </Button>
              <p style={{ ...line, fontWeight: cssVars.fontWeights.semibold }}>{t('standingsTie.decided.withdrawUntil')}</p>
            </>
          ) : null}
          {failed !== null ? <p role="alert" style={{ ...line, fontWeight: cssVars.fontWeights.semibold }}>{failed}</p> : null}
        </>
      ) : undefined}
    >
      <span style={title}>{heading}</span>
      <p style={line}>{body}</p>
      {showClosed ? <p style={line} data-testid="tie-closed-note">{t('standingsTie.decided.closed')}</p> : null}
    </InlineNotice>
  );
};
