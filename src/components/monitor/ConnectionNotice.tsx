/**
 * Hinweis „Stand von 14:32 – keine Verbindung“ unten rechts (Paket M, @ZM-085, @ME-030, @ME-007).
 *
 * Steht, solange der Monitor 30 Sekunden keine Antwort des Servers hat; das letzte Bild bleibt stehen. Die Ecke gehört dem Hinweis:
 * die Schiedsrichter-Zeile liegt unten links, der Energiespar-Hinweis oben rechts. Das Symbol steht dabei, Farbe allein trägt nichts
 * (Regel 5). Rahmen und Schrift wie der Energiespar-Hinweis (Tokens, nie unter 3 % der Bildhöhe).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { toTournamentLocal, TOURNAMENT_TIME_ZONE } from '../../core/view';
import { displayFontSizes, type MonitorThemeColors } from '../../design-tokens';
import { Icons } from '../ui/Icons';
import { noticeBoxStyle } from './noticeBoxStyle';

export interface ConnectionNoticeProps {
  /** Serverzeit der letzten Antwort (ms); angezeigt in der Ortszeit des Turniers, nicht der des Rechners (@ME-031) */
  standMs: number;
  themeColors: MonitorThemeColors;
}

export function ConnectionNotice({ standMs, themeColors }: ConnectionNoticeProps) {
  const { t } = useTranslation('monitor');
  const style: CSSProperties = { ...noticeBoxStyle(themeColors), top: 'auto', bottom: 0 };
  return (
    <div style={style} data-testid="monitor-connection-hint" role="status">
      <Icons.WifiOff size={displayFontSizes.noticeIcon} color={themeColors.warningSymbol} />
      <span>{t('verbindung.stand', { time: toTournamentLocal(new Date(standMs), TOURNAMENT_TIME_ZONE).time })}</span>
    </div>
  );
}
