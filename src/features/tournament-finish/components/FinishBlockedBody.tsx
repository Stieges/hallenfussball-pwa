/**
 * Dialog „Turnier abschließen“, Zustand A „noch nicht möglich“ (@LZ-010, @LZ-012, @LZ-013, @LZ-029): der Hinweis oben (nur er
 * ist orange), darunter die Liste der offenen Punkte, je Eintrag mit Sprungziel. Die Einträge sind neutral (Rand, Pfeil, kleines
 * Symbol). Alle offenen Punkte stehen gemeinsam in der Liste, auch die der Klärungsliste (@LZ-012).
 */
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../../../types/tournament';
import type { FinishItem } from '../../../core/repositories/lifecycleRpc';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { HyphenSafe } from './HyphenSafe';
import { useFinishT } from '../hooks/useFinishT';
import { describeFinishItem } from '../model/finishItems';
import { listReset, rowButton, small, stack, strong, text } from './finishStyles';

export interface FinishBlockedBodyProps {
  items: readonly FinishItem[];
  tournament: Pick<Tournament, 'id' | 'teams' | 'matches' | 'groups'>;
  /** Springt zum Eintrag (der Aufrufer schließt den Dialog und navigiert). */
  onJump: (target: string) => void;
}

export function FinishBlockedBody({ items, tournament, onJump }: FinishBlockedBodyProps) {
  const { t, i18n } = useTranslation('tournament');
  const tt = useFinishT();
  return (
    <div style={stack} data-testid="finish-blocked">
      <InlineNotice tone="warn" data-testid="finish-blocked-notice">
        <span style={strong}>{t('finish.blocked.title')}</span>
        <span style={text}>{t('finish.blocked.lead', { count: items.length })}</span>
      </InlineNotice>
      <ul style={listReset} data-testid="finish-open-list">
        {items.map((item, index) => {
          const view = describeFinishItem(item, tournament, tt, index, i18n.language);
          return (
            <li key={view.id}>
              <button type="button" style={rowButton} data-testid="finish-open-item" data-target={view.target} onClick={() => { onJump(view.target); }}>
                <span style={{ color: cssVars.colors.warning, alignSelf: 'start', marginTop: cssVars.spacing.xs, display: 'flex' }} aria-hidden="true">
                  <Icons.AlertTriangle size={iconSizeValues.sm} />
                </span>
                <span style={{ display: 'grid', gap: cssVars.spacing.xs, minWidth: 0 }}>
                  <span style={{ ...strong, fontSize: cssVars.fontSizes.md }}><HyphenSafe text={view.title} /></span>
                  {view.detail !== null && <span style={small}><HyphenSafe text={view.detail} /></span>}
                </span>
                <span style={{ color: cssVars.colors.textSecondary, display: 'flex' }} aria-hidden="true"><Icons.ChevronRight size={iconSizeValues.md} /></span>
              </button>
            </li>
          );
        })}
      </ul>
      <p style={small}>{t('finish.blocked.after')}</p>
    </div>
  );
}
