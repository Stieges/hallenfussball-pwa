/**
 * TeamName – Teamname mit Logo bzw. Initialen davor und freigehaltenen Zusatzzeilen (Aufgabe 3.1 Spielanzeige,
 * @ZM-157, @ZM-088, @ZM-155, RF4).
 *
 * Der Name selbst kommt als `name` (Monitor: `TeamNameDisplay` mit Kurzform und Einpassung, sonst der volle Name) und bricht
 * an Leerzeichen um – nie „…“, keine Silbentrennung (VISUAL-DESIGN Regel 2). Logo/Initialen stehen immer außerhalb des
 * Ergebniskastens und haben auch ohne Logo denselben Platz. Die Zusatzzeilen („nach Verlängerung“ …) sind je `reserveAddonLines`
 * in jedem Zustand freigehalten: der Kasten darüber springt nie (@ZM-151). Reine Anzeige, ohne Wissen über Spielstände.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cssVars, displayLayout, displayList } from '../../../design-tokens';
import type { TeamColors, TeamLogo } from '../../../types/tournament';
import { TeamAvatar, type AvatarSize } from '../TeamAvatar';

export interface TeamNameProps {
  team: { name: string; logo?: TeamLogo; colors?: TeamColors; pending?: boolean };
  /** Monitor: TeamNameDisplay (Kurzform, Einpassung); sonst der volle Name */
  name: ReactNode;
  /** Monitor: Avatar links neben dem Namen unter dem Kasten, Zusätze darunter | Karte/Kopf: Avatar vor dem Namen */
  layout: 'stacked' | 'inline';
  /** `display` = Avatar-Größe der Live-Folie (Token `displayLayout.scoreArea.avatarSize`), `list` = Monitor-Zeile (`displayList.avatarSize`, damit die Initialen ≥ 3 % Bildhöhe in den Kreis passen) */
  avatarSize: AvatarSize | 'display' | 'list';
  /** Höchstens zwei Zusätze, je Zeile einer */
  addons: readonly string[];
  /** Freigehaltene Zusatzzeilen: Monitor 2, Karte 0 */
  reserveAddonLines: 0 | 1 | 2;
  emphasis?: 'winner' | 'loser';
  /** Lage von Avatar und Name in der Zeile; Standard mittig (Monitor-Zeile: Heim rechtsbündig, Gast linksbündig) */
  justify?: 'start' | 'center' | 'end';
  /** Farbe der Zusätze (Monitor: Textfarbe zweiter Ordnung des Themas) */
  addonColor?: string;
  /** Schriftgröße der Zusätze; ohne Angabe `cssVars.fontSizes.sm` */
  addonFontSize?: string;
  /** Monitor: der Avatar kommt zur Breite der Zelle dazu, der Name behält so die volle Breite (Einpassung, @ZM-087, @ZM-125); die Reihe ragt je zur Hälfte links und rechts über die Zelle */
  avatarOutside?: boolean;
  /** Zeilenhöhe der Zusätze (Faktor); ohne Angabe `displayLayout.scoreArea.hintLineHeight` */
  addonLineHeight?: number;
  /** Initialen neutral (Fläche, Schrift, Rand vom Thema der Anzeige), siehe TeamAvatar */
  avatarNeutral?: { background: string; color: string; border: string };
  /** Kinder: `${testId}-avatar`, `${testId}-addons`, `${testId}-addon-0|1` */
  testId: string;
}

const MAX_ADDONS = 2;

export function TeamName({
  team,
  name,
  layout,
  avatarSize,
  addons,
  reserveAddonLines,
  emphasis,
  justify = 'center',
  avatarOutside = false,
  avatarNeutral,
  addonColor = cssVars.colors.textSecondary,
  addonFontSize = cssVars.fontSizes.sm,
  addonLineHeight = displayLayout.scoreArea.hintLineHeight,
  testId,
}: TeamNameProps): ReactElement {
  const stacked = layout === 'stacked';
  const lineHeight = addonLineHeight;
  const addonStyle: CSSProperties = {
    fontSize: addonFontSize,
    fontWeight: cssVars.fontWeights.bold,
    lineHeight,
    color: addonColor,
    textAlign: 'center',
    minHeight: `calc(${addonFontSize} * ${lineHeight})`,
  };
  const shown = addons.slice(0, Math.min(MAX_ADDONS, Math.max(reserveAddonLines, addons.length)));
  const avatarProps =
    avatarSize === 'display' ? { dimension: displayLayout.scoreArea.avatarSize }
    : avatarSize === 'list' ? { dimension: displayList.avatarSize }
    : { size: avatarSize };
  const flexJustify = { start: 'flex-start', center: 'center', end: 'flex-end' } as const;
  const avatarWidth = avatarSize === 'display' ? displayLayout.scoreArea.avatarSize : avatarSize === 'list' ? displayList.avatarSize : undefined;
  const rootWidth = avatarOutside && avatarWidth !== undefined ? `calc(100% + ${avatarWidth} + ${cssVars.spacing.sm})` : stacked ? '100%' : undefined;
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: flexJustify[justify], minWidth: 0, maxWidth: avatarOutside ? undefined : '100%', width: rootWidth }}
      data-testid={testId}
      data-layout={layout}
      {...(emphasis !== undefined ? { 'data-emphasis': emphasis } : {})}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: flexJustify[justify], gap: cssVars.spacing.sm, minWidth: 0, maxWidth: '100%', width: stacked ? '100%' : undefined }}>
        <TeamAvatar team={team} neutral={avatarNeutral} {...avatarProps} data-testid={`${testId}-avatar`} />
        <div style={{ flex: stacked ? '1 1 0' : '0 1 auto', minWidth: 0, overflowWrap: 'break-word', hyphens: 'manual' }}>{name}</div>
      </div>
      {reserveAddonLines > 0 && (
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minHeight: `calc(${addonFontSize} * ${lineHeight} * ${reserveAddonLines})` }}
          data-testid={`${testId}-addons`}
        >
          {shown.map((text, i) => (
            <div key={text} style={addonStyle} data-testid={`${testId}-addon-${i}`}>{text}</div>
          ))}
        </div>
      )}
    </div>
  );
}
