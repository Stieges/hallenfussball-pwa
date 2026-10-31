/**
 * TeamName – Teamname mit Logo bzw. Initialen davor, dahinter oder darüber und freigehaltenen Zusatzzeilen (Aufgabe 3.1 Spielanzeige,
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
  /** Monitor: Zusätze unter dem Namen, volle Breite | Karte/Kopf: Avatar vor dem Namen */
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
  /**
   * Lage des Avatars zum Namen: `before` davor (Handy, Karte, Kopf) | `after` dahinter (Monitor „Nächste Spiele“, Heimseite: Logo am Strich, @ZM-185)
   * | `above` mittig über dem Namen, der Name behält die volle Breite (Monitor Live-Folie, Endstand und Spielplan eines Felds, @ZM-157, @ZM-185)
   */
  avatarPlacement?: 'before' | 'after' | 'above';
  /** Zeilenhöhe der Zusätze (Faktor); ohne Angabe `displayLayout.scoreArea.hintLineHeight` */
  addonLineHeight?: number;
  /** Abstand zwischen Avatar und Name bei `avatarPlacement="above"`; ohne Angabe `displayList.avatarStackGap` */
  avatarGap?: string;
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
  avatarPlacement = 'before',
  avatarGap = displayList.avatarStackGap,
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
  const above = avatarPlacement === 'above';
  const avatar = <TeamAvatar team={team} neutral={avatarNeutral} {...avatarProps} data-testid={`${testId}-avatar`} />;
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: flexJustify[justify], minWidth: 0, maxWidth: '100%', width: stacked || above ? '100%' : undefined }}
      data-testid={testId}
      data-layout={layout}
      {...(emphasis !== undefined ? { 'data-emphasis': emphasis } : {})}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: above ? 'column' : 'row',
          alignItems: above ? 'center' : 'flex-start',
          justifyContent: above ? 'flex-start' : flexJustify[justify],
          gap: above ? avatarGap : cssVars.spacing.sm,
          minWidth: 0,
          maxWidth: '100%',
          width: stacked || above ? '100%' : undefined,
        }}
        data-avatar-placement={avatarPlacement}
      >
        {avatarPlacement !== 'after' && avatar}
        <div style={{ flex: stacked && !above ? '1 1 0' : '0 1 auto', minWidth: 0, width: above ? '100%' : undefined, overflowWrap: 'break-word', hyphens: 'manual' }}>{name}</div>
        {avatarPlacement === 'after' && avatar}
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
