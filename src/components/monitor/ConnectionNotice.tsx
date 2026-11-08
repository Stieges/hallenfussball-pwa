/**
 * Verbindungs-Symbol unten rechts (Paket M, @ZM-085, @ME-030, @ME-007, @ME-047): nur ein Warnsymbol mit Ausrufezeichen, ohne Text.
 * Es sagt der Turnierleitung, dass sie nachsehen muss; Zuschauer stört kein Wort. Steht, solange der Monitor 30 Sekunden keine
 * Antwort des Servers hat. Der zugängliche Name („Keine Verbindung seit 14:32“, Ortszeit des Turniers) ist nur für Vorlese-Programme.
 * Rahmen und Symbolgröße wie der Energiespar-Hinweis (Tokens); Symbolfarbe mindestens 3 : 1 zum Thema.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { type MonitorThemeColors, displayFontSizes } from '../../design-tokens';
import { toTournamentLocal, TOURNAMENT_TIME_ZONE } from '../../core/view';
import { Icons } from '../ui/Icons';
import { noticeBoxStyle } from './noticeBoxStyle';

export interface ConnectionNoticeProps {
  /** Serverzeit der letzten Antwort (ms) */
  standMs: number;
  themeColors: MonitorThemeColors;
}

export function ConnectionNotice({ standMs, themeColors }: ConnectionNoticeProps) {
  const { t } = useTranslation('monitor');
  const name = t('verbindung.seit', { time: toTournamentLocal(new Date(standMs), TOURNAMENT_TIME_ZONE).time });
  const style: CSSProperties = { ...noticeBoxStyle(themeColors), top: 'auto', bottom: 0 };
  return (
    <div style={style} data-testid="monitor-connection-hint" role="img" aria-label={name}>
      <Icons.AlertTriangle size={displayFontSizes.noticeIcon} color={themeColors.warningSymbol} />
    </div>
  );
}
