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
import { cssVars, displayFontSizes, displayLayout } from '../../../design-tokens';
import type { TeamColors, TeamLogo } from '../../../types/tournament';
import { TeamAvatar, type AvatarSize } from '../TeamAvatar';

export interface TeamNameProps {
  team: { name: string; logo?: TeamLogo; colors?: TeamColors; pending?: boolean };
  /** Monitor: TeamNameDisplay (Kurzform, Einpassung); sonst der volle Name */
  name: ReactNode;
  /** Monitor: Avatar links neben dem Namen unter dem Kasten, Zusätze darunter | Karte/Kopf: Avatar vor dem Namen */
  layout: 'stacked' | 'inline';
  /** `display` = Größe des Monitor-Namens (Token `displayFontSizes.teamName`) */
  avatarSize: AvatarSize | 'display';
  /** Höchstens zwei Zusätze, je Zeile einer */
  addons: readonly string[];
  /** Freigehaltene Zusatzzeilen: Monitor 2, Karte 0 */
  reserveAddonLines: 0 | 1 | 2;
  emphasis?: 'winner' | 'loser';
  /** Farbe der Zusätze (Monitor: Textfarbe zweiter Ordnung des Themas) */
  addonColor?: string;
  /** Schriftgröße der Zusätze; ohne Angabe `cssVars.fontSizes.sm` */
  addonFontSize?: string;
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
  addonColor = cssVars.colors.textSecondary,
  addonFontSize = cssVars.fontSizes.sm,
  testId,
}: TeamNameProps): ReactElement {
  const stacked = layout === 'stacked';
  const lineHeight = displayLayout.scoreArea.hintLineHeight;
  const addonStyle: CSSProperties = {
    fontSize: addonFontSize,
    fontWeight: cssVars.fontWeights.bold,
    lineHeight,
    color: addonColor,
    textAlign: 'center',
    minHeight: `calc(${addonFontSize} * ${lineHeight})`,
  };
  const shown = addons.slice(0, Math.min(MAX_ADDONS, Math.max(reserveAddonLines, addons.length)));
  const avatarProps = avatarSize === 'display' ? { dimension: displayFontSizes.teamName } : { size: avatarSize };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, maxWidth: '100%', width: stacked ? '100%' : undefined }}
      data-testid={testId}
      data-layout={layout}
      {...(emphasis !== undefined ? { 'data-emphasis': emphasis } : {})}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: cssVars.spacing.sm, minWidth: 0, maxWidth: '100%' }}>
        <TeamAvatar team={team} {...avatarProps} data-testid={`${testId}-avatar`} />
        <div style={{ flex: '1 1 0', minWidth: 0, overflowWrap: 'break-word', hyphens: 'manual' }}>{name}</div>
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
