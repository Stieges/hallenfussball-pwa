/**
 * MatchCardSidesSymmetric – Fassung für die Zuschauer-Seite (@ZM-218): zwei gleich breite Hälften um den Stand, Pfeil am Zeilenende. Die Turnierleitung nutzt `MatchCardSides`. Sonst wie: die Teams nebeneinander in der Tabellenzeile (Aufgabe 5.1a Spielanzeige, Auslagerung aus
 * `MatchCardDesktop` ohne Sichtänderung): Heim rechtsbündig, das Ergebnis in der Mitte (mit Restzeit), Gast linksbündig.
 * Liefert drei Zellen für das Raster der Zeile (`MatchCardDesktop`).
 */
import { type CSSProperties, type ReactNode } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../ui/Icons';
import { TeamAvatar } from '../../ui/TeamAvatar';
import { SlashBreaks } from '../../ui/atoms/TeamName';
import { ZeitstrafeHinweis } from '../../ui/molecules/ZeitstrafeHinweis';
import type { SpectatorClock, ViewMatchStatus } from '../../../core/view';
import type { ResultFigures } from '../matchResult';
import { MatchCardScore, type MatchCardStatus } from './MatchCardScore';
import type { Team } from './MatchCardDesktop';

export interface MatchCardSidesSymmetricProps {
  matchId: string;
  homeTeam: Team;
  awayTeam: Team;
  result: ResultFigures | null;
  status: MatchCardStatus;
  clock?: SpectatorClock | null;
  viewStatus?: ViewMatchStatus;
  onCircleClick: () => void;
  disabled: boolean;
  hasEvents: boolean;
  isExpanded: boolean;
  /** Inhalt links neben dem Heim-Team (Uhrzeit, Feld): liegt in der linken Hälfte, damit der Stand in der Kartenmitte steht (@ZM-218) */
  leading?: ReactNode;
  /** Inhalt rechts neben dem Gast-Team (Gruppe, Menü): liegt in der rechten Hälfte */
  trailing?: ReactNode;
}

const halfStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.md, minWidth: 0 };
const teamStyle = (align: 'left' | 'right'): CSSProperties => ({
  display: 'flex',
  flex: 1,
  minWidth: 0,
  alignItems: 'center',
  gap: cssVars.spacing.sm,
  justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
});

// Mitte: nur der Stand, mit fester Mindestbreite für „12:3“ (tabular-nums); gleicher Abstand zu beiden Logos (Zeilenabstand des Rasters)
const standZelleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: `calc(${cssVars.spacing.xxl} + ${cssVars.spacing.xl})`,
};
// Pfeil: eigene Spalte am rechten Zeilenende, in jeder Zeile reserviert (leer ohne Pfeil), Tippfläche mindestens 44 px, tippbar zum Auf- und Zuklappen
const pfeilPlatzStyle: CSSProperties = {
  flexShrink: 0,
  minWidth: cssVars.touchTargets.minimum,
  minHeight: cssVars.touchTargets.minimum,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const MatchCardSidesSymmetric: React.FC<MatchCardSidesSymmetricProps> = ({
  matchId, homeTeam, awayTeam, result, status, clock, viewStatus, onCircleClick, disabled, hasEvents, isExpanded, leading, trailing,
}) => {
  const isLive = status === 'running';
  const decided = result?.winner !== undefined && result.winner !== null;
  const teamNameStyle = (side: 'a' | 'b'): CSSProperties => {
    const isWinner = decided && result?.winner === side;
    const isLoser = decided && result?.winner !== side;
    return {
      fontSize: cssVars.fontSizes.lg,
      fontWeight: isWinner ? cssVars.fontWeights.bold : isLoser || status === 'finished' ? cssVars.fontWeights.medium : cssVars.fontWeights.semibold,
      color: isLoser ? cssVars.colors.textSecondary : cssVars.colors.textPrimary,
      // MOBILE-UX: keine Kürzung. `overflow-wrap: break-word` bricht nur ein Wort, das allein länger ist als die Zeile; `word-break: break-word`
      // (wie `anywhere`) ließe die Spalte unter die Wortbreite schrumpfen und brach „Tengling“ mitten im Wort (@ZM-207)
      overflowWrap: 'break-word',
    };
  };

  return (
    <>
      {/* Linke Hälfte: Uhrzeit und Feld, dann das Heim-Team rechtsbündig; beide Hälften sind gleich breit (1fr), der Stand liegt in der Kartenmitte */}
      <div style={halfStyle}>
      {leading}
      <div style={teamStyle('right')}>
        <ZeitstrafeHinweis liste={clock?.zeitstrafen?.home} testId={`match-time-penalty-${matchId}-home`} align="end">
          <span style={teamNameStyle('a')} data-testid={`match-name-${matchId}-home`} data-teamname data-winner={decided && result?.winner === 'a' ? 'true' : undefined}><SlashBreaks text={homeTeam.name} /></span>
        </ZeitstrafeHinweis>
        <TeamAvatar team={homeTeam} size="sm" />
      </div>
      </div>

      {/* Mitte: der Stand (Klickfläche fürs Aufklappen), links und rechts gleicher Abstand zum Logo (@ZM-218) */}
      <div data-score-circle style={standZelleStyle}>
        <MatchCardScore result={result} status={status} clock={clock} viewStatus={viewStatus} onClick={onCircleClick} disabled={disabled} matchId={matchId} />
      </div>

      {/* Rechte Hälfte: Gast-Team linksbündig, dann Gruppe und Menü */}
      <div style={halfStyle}>
      <div style={teamStyle('left')}>
        <TeamAvatar team={awayTeam} size="sm" />
        <ZeitstrafeHinweis liste={clock?.zeitstrafen?.away} testId={`match-time-penalty-${matchId}-away`}>
          <span style={teamNameStyle('b')} data-testid={`match-name-${matchId}-away`} data-teamname data-winner={decided && result?.winner === 'b' ? 'true' : undefined}><SlashBreaks text={awayTeam.name} /></span>
        </ZeitstrafeHinweis>
      </div>
      {trailing}
      <div
        data-score-circle
        style={{ ...pfeilPlatzStyle, cursor: hasEvents && !isLive && !disabled ? 'pointer' : 'default' }}
        onClick={() => { if (!disabled) { onCircleClick(); } }}
        aria-hidden="true"
      >
        {hasEvents && !isLive && (
          <span data-testid={`match-arrow-${matchId}`} style={{ display: 'flex', color: cssVars.colors.textMuted, transition: 'transform 0.2s ease', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}><Icons.ChevronDown size={iconSizeValues.xs} /></span>
        )}
      </div>
      </div>
    </>
  );
};
