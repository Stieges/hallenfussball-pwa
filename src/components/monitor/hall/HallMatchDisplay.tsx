/**
 * HallMatchDisplay – Live-Folie im Profil „Halle (sehr fern)“, Anordnung „Farbseiten“ (@ZM-212, @ZM-213, @ZM-214).
 *
 * Für einen Bildschirm, der aus der Hallentiefe gelesen wird (Hallentest 17.11.2026: 86 × 49 cm, rund 22 m): zwei Farbflächen in den
 * getragenen Farben füllen die oberen 69 % der Folienfläche, darin oben der Teamname (höchstens zwei Zeilen), darunter die Torzahl
 * (36 % der Höhe). Darunter Zeitbalken und Uhrband (`HallBand`). Keine Kopfzeile, keine Logos.
 * Dieselben Daten wie `LiveMatchDisplay` (Spiel, Kästen der Ansicht, Endstand, Abzeichen, Uhr, Zeitstrafen); die Zustandsregeln
 * (Sieger, Kindermodus, Uhr, Abzeichen) kommen aus denselben Funktionen, hier nur eine andere Anordnung.
 * Kindermodus (`hideScore`): keine Ziffern, die Flächen und Namen bleiben an ihrer Stelle; nach dem Abschluss steht stattdessen der Satz „Turnier beendet – danke fürs Mitspielen“ (`LiveSlide`, @ZM-121).
 */
import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import { useMonitorTheme } from '../../../hooks';
import { pairFrameStrength, type ScoreBoxOutcome } from '../../ui/molecules/scoreBoxStyle';
import type { LiveMatchDisplayProps } from '../LiveMatchDisplay';
import { badgeOfLiveMatch, monitorLiveBadge } from '../liveBadge';
import { outcomeOfSide, winnerOf } from '../matchOutcome';
import { standardBoxes } from '../standardBoxes';
import { gemeinsameNamenGroesse } from '../teamNameFit';
import { useLaufendeZeitstrafen } from '../useLaufendeZeitstrafen';
import { HallBand } from './HallBand';
import { HallPanel } from './HallPanel';
import { colonDotStyle, colonStyle, panelRowStyle, rootStyle } from './hallStyles';

export type HallMatchDisplayProps = Pick<
  LiveMatchDisplayProps,
  'match' | 'group' | 'theme' | 'boxes' | 'hideScore' | 'clockMode' | 'finalScore' | 'finalRound' | 'badge' | 'uhr' | 'zeitstrafenQuelle'
> & {
  /** Vor dem Anpfiff (@ZM-195): Anstoßzeit an der Stelle der Restzeit; die Flächen zeigen 0 und 0 */
  kickoff?: { time: string; notes?: ReactNode };
  /** Feld bzw. Gruppe im Band nur bei mehr als einem Feld bzw. mehr als einer Gruppe im Turnier (@ZM-215) */
  showField?: boolean;
  showGroup?: boolean;
};

export function HallMatchDisplay({
  match, group, theme = 'dark', boxes, hideScore = false, clockMode, finalScore, finalRound = false, badge, uhr, zeitstrafenQuelle, kickoff, showField, showGroup,
}: HallMatchDisplayProps): ReactElement {
  const { themeColors, resolvedTheme } = useMonitorTheme(theme);
  const shown = boxes ?? standardBoxes();
  const zeitstrafen = useLaufendeZeitstrafen(hideScore ? undefined : zeitstrafenQuelle, match.homeTeam.id, match.awayTeam.id);

  // B3: beide Teamnamen in derselben Größe (die kleinere der beiden passenden)
  const [namePx, setNamePx] = useState<{ home?: number; away?: number }>({});
  const onHomePx = useCallback((px: number) => setNamePx((p) => (p.home === px ? p : { ...p, home: px })), []);
  const onAwayPx = useCallback((px: number) => setNamePx((p) => (p.away === px ? p : { ...p, away: px })), []);
  const sharedNamePx = gemeinsameNamenGroesse(namePx.home, namePx.away);

  // Sieger/Verlierer nur nach dem Abpfiff und mit Entscheidung; ein Unentschieden in der Gruppe hat weder Ring noch Pokal (wie `LiveScoreGrid`)
  const winner = winnerOf(match.status, hideScore, finalScore);
  const outcomeOf = (side: 'a' | 'b'): ScoreBoxOutcome | undefined => outcomeOfSide(winner, side);
  // Gleiche Rahmenbreite beider Flächen, unabhängig vom Zustand (@ZM-151)
  const frame = pairFrameStrength({ fill: shown.home.fill }, { fill: shown.away.fill }, themeColors.background);

  return (
    <div style={rootStyle(themeColors)} data-testid="hall-display">
      <div style={panelRowStyle} data-testid="hall-panels">
        <HallPanel
          side="home" name={match.homeTeam.name} score={hideScore ? null : match.homeScore} box={shown.home} outcome={outcomeOf('a')}
          cup={winner === 'a' && finalRound} frame={frame} colors={themeColors} sizePx={sharedNamePx} onFitPx={onHomePx}
          zeitstrafen={match.status === 'FINISHED' ? undefined : zeitstrafen}
        />
        <HallPanel
          side="away" name={match.awayTeam.name} score={hideScore ? null : match.awayScore} box={shown.away} outcome={outcomeOf('b')}
          cup={winner === 'b' && finalRound} frame={frame} colors={themeColors} sizePx={sharedNamePx} onFitPx={onAwayPx}
          zeitstrafen={match.status === 'FINISHED' ? undefined : zeitstrafen}
        />
        {!hideScore && (
          <div style={colonStyle} aria-hidden="true" data-testid="hall-separator">
            <i style={colonDotStyle(themeColors)} />
            <i style={colonDotStyle(themeColors)} />
          </div>
        )}
      </div>
      <HallBand
        match={match} group={group ?? match.group} badge={monitorLiveBadge(badge ?? badgeOfLiveMatch(match))} theme={theme} colors={themeColors} resolvedTheme={resolvedTheme}
        clockMode={clockMode} uhr={uhr} finalScore={finalScore} hideScore={hideScore} kickoff={kickoff} showField={showField} showGroup={showGroup}
      />
    </div>
  );
}
