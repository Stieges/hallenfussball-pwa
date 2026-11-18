/**
 * Kopfzeile der Live-Folie (B-44a2): LIVE-Marke links, Feld/Spiel in der Mitte, Gruppe rechts. Das Feld steht nur, wenn das Turnier mehr als ein Feld hat,
 * die Gruppe nur bei mehr als einer Gruppe (@ZM-215); das Spiel steht immer als Text („Spiel 3“). Feld und Gruppe stehen als Symbole in Kopfzeilenhöhe
 * (Spielfeld mit Nummer, Buchstabe im Kasten; zugängliche Namen „Feld 1“, „Gruppe A“, @ZM-215 Daniel 2026-11-19).
 * Der Wachhalten-Hinweis steht nicht hier, sondern als Ecke der Monitor-Seite (B-48a, `WakeLockNotice`).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displayLayout, type MonitorThemeColors } from '../../design-tokens';
import type { MatchBadgeModel } from '../../core/view';
import { isSingleGroupId } from '../../core/models/standingsGroups';
import { MatchStatusBadge } from '../ui/molecules/MatchStatusBadge';
import { monitorBadgeTone } from '../ui/molecules/matchStatusBadgeStyle';
import { FeldSymbol, GruppenKasten } from '../ui/atoms/MonitorSymbole';

const layout = displayLayout.scoreArea;

export interface LiveHeaderProps {
  /** Abzeichen der Ansicht (`MatchView.badge`); ohne Angabe aus dem Status der Live-Anzeige */
  badge: MatchBadgeModel;
  field: number;
  matchNumber: number | string;
  /** Gruppenname, falls vorhanden */
  group?: string;
  size: 'md' | 'lg' | 'xl';
  themeColors: MonitorThemeColors;
  /** Feld nennen (nur bei mehr als einem Feld im Turnier, @ZM-215); ohne Angabe ja */
  showField?: boolean;
  /** Gruppe nennen (nur bei mehr als einer Gruppe im Turnier, @ZM-215); ohne Angabe ja */
  showGroup?: boolean;
}

export function LiveHeader({ badge, field, matchNumber, group, size, themeColors, showField = true, showGroup = true }: LiveHeaderProps) {
  const { t } = useTranslation('monitor');
  const xl = size === 'xl';
  // B-44a2: feste drei Spalten (Marke links, Feld/Spiel Mitte, Gruppe rechts), auch wenn eine Gruppe fehlt
  const headerStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    width: '100%',
    height: layout.header,
    marginBottom: layout.headerGap,
    flexShrink: 0,
  };
  // B-44a2: eine Marken-Gestaltung für alle Zustände; @ZM-167: links in der Kopfzeile, nur so breit wie das Wort (kein Füllen einer festen Spalte)
  const badgeSlotStyle: CSSProperties = {
    display: 'flex',
    justifySelf: 'start',
    fontSize: xl ? displayFontSizes.liveBadge : displayFontSizes.bodySM,
  };
  const infoStyle: CSSProperties = {
    fontSize: xl ? displayFontSizes.liveInfo : displayFontSizes.bodyMD,
    fontWeight: cssVars.fontWeights.semibold,
    color: themeColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.headerSymbolGap,
  };
  // Feld und Gruppe in Kopfzeilenhöhe (xl); die kleineren Stufen nehmen die Schrift als Maß
  const symbolSize = xl ? layout.headerSymbol : displayFontSizes.bodyMD;

  return (
    <div style={headerStyle} data-testid="live-header">
      <div style={badgeSlotStyle} data-testid="live-badge">
        <MatchStatusBadge model={badge} size={xl ? 'display' : 'card'} tone={monitorBadgeTone(themeColors)} />
      </div>
      <div style={infoStyle} data-testid="live-info">
        {showField && <FeldSymbol number={field} label={t('fieldSelector.field', { field })} size={symbolSize} testId="live-field" />}
        <span>{t('liveMatch.matchOnly', { number: matchNumber })}</span>
      </div>
      <div style={{ ...infoStyle, color: themeColors.text, justifySelf: 'end' }} data-testid="live-group">
        {showGroup && group !== undefined && !isSingleGroupId(group) && (
          <GruppenKasten group={group} label={t('liveMatch.group', { group })} size={symbolSize} border={layout.groupBoxBorder} radius={layout.groupBoxRadius} testId="live-group-box" />
        )}
      </div>
    </div>
  );
}
