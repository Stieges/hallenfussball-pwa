/**
 * TeamScoreRows - Mannschaften untereinander, Tore je Zeile (@OB-064, Mockup Variante D)
 *
 * ┌────────────────────────────────────┐
 * │ [FN] FC Nord                  2 (4)│
 * │ [SM] SG Mitte                 2 (3)│
 * └────────────────────────────────────┘
 *
 * Die Torzahl steht rechts in der Zeile ihrer Mannschaft, ein Strafstoßergebnis kleiner daneben. Der Sieger eines
 * beendeten Spiels steht fett. Die Torzahl ist der Klickbereich ins Cockpit (≥ 44 px hoch).
 * Beim laufenden und beim nächsten Spiel steht die Torzahl in einem kleinen Kasten in der Farbe der Mannschaft (Weste = Trainingsleibchen
 * mit Leibchen-Zeichen bei festgelegtem Leibchen, @ZM-158, @ZM-161); alle anderen Spiele zeigen die Zahl wie bisher.
 */
import { Fragment, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { overHex } from '../../../design-tokens/displayColor';
import { useTheme } from '../../../hooks/useTheme';
import { MATCH_BADGE_WORD_KEY } from '../../../core/view/badge';
import { TeamAvatar } from '../../ui/TeamAvatar';
import { ScoreBox } from '../../ui/molecules/ScoreBox';
import { pairFrameStrength } from '../../ui/molecules/scoreBoxStyle';
import { ZeitstrafeHinweis } from '../../ui/molecules/ZeitstrafeHinweis';
import type { MatchView, OeffentlicheZeitstrafen } from '../../../core/view';
import type { ResultFigures } from '../matchResult';
import type { MatchCardStatus } from './MatchCardScore';
import type { Team } from './MatchCard';

export interface TeamScoreRowsProps {
  matchId: string;
  homeTeam: Team;
  awayTeam: Team;
  /** `null`: geplantes Spiel, es stehen keine Tore */
  result: ResultFigures | null;
  status: MatchCardStatus;
  onScoreClick: () => void;
  disabled?: boolean;
  /** Laufende Zeitstrafen (Uhr der Karte, @ZM-184): „Zeitstrafe #5 · 1:23“ unter dem Namen des Teams */
  zeitstrafen?: OeffentlicheZeitstrafen;
  /** Kästen der Ansicht (`MatchView.boxes`) für das laufende und das nächste Spiel; ohne Angabe steht die Zahl wie bisher */
  kasten?: MatchView['boxes'];
  /**
   * Beendetes Spiel im Kasten (@ZM-158, @OB-064): der Sieger trägt den Ring, der Verlierer ist zurückgenommen, ein Unentschieden hat keins von beiden;
   * `cup`: Pokal beim Sieger (nur Finalrunde); „nach Verlängerung“ klein unter dem Namen des Siegers. Nur zusammen mit `kasten`.
   */
  ende?: { cup: boolean };
  /** Kästen eines Spiels ohne Stand bleiben leer statt 0 zu zeigen (Aktionsblatt eines geplanten Spiels, @SL-239); wirkt nur mit `kasten` */
  blankWithoutScore?: boolean;
}

type Side = 'a' | 'b';

/** Ein Raster für beide Zeilen: Torzahlen und Strafstöße stehen untereinander in einer Spalte. */
const gridStyle: CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
  alignItems: 'center',
  columnGap: cssVars.spacing.xs,
  rowGap: cssVars.spacing.xs,
  minWidth: 0,
};

const teamStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs, minWidth: 0 };

const goalsStyle: CSSProperties = {
  minWidth: cssVars.touchTargets.minimum,
  minHeight: cssVars.touchTargets.minimum,
  padding: 0,
  background: 'transparent',
  border: 'none',
  textAlign: 'right',
  fontSize: cssVars.fontSizes.xl,
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'inherit',
};

export const TeamScoreRows: React.FC<TeamScoreRowsProps> = ({ matchId, homeTeam, awayTeam, result, status, onScoreClick, disabled = false, zeitstrafen, kasten, ende, blankWithoutScore = false }) => {
  const { t } = useTranslation('tournament');
  const { colors } = useTheme();
  const decided = result?.winner !== undefined && result.winner !== null;

  const spokenResult = (() => {
    // Ohne Stand (Live-Stand aus, noch nicht angepfiffen) sagt die Karte den Zustand, nie „Spiel starten“ einem, der nur zusieht (@ZM-116)
    if (result === null) {
      if (status === 'scheduled' || status === 'waiting') { return disabled ? t('matchCard.notStarted') : t('matchCard.startMatch'); }
      // Zustandswort statt „Spiel starten“: läuft (ohne Stand), ausgefallen, Ende (Kindermodus) – @ZM-104, @OB-066
      return t(status === 'running' ? 'matchCard.liveNoScore' : status === 'skipped' ? MATCH_BADGE_WORD_KEY.cancelled : MATCH_BADGE_WORD_KEY.ended);
    }
    const values = { homeScore: result.goalsA, awayScore: result.goalsB, homePenalty: result.penaltyA, awayPenalty: result.penaltyB };
    if (status === 'running') { return t('matchCard.scoreAriaLive', { ...values, elapsed: t('matchCard.live') }); }
    if (result.decision === 'penalty') { return t('matchResult.scoreAriaPenalty', values); }
    if (result.decision === 'overtime') { return t('matchResult.scoreAriaOvertime', values); }
    return t('matchCard.scoreAriaFinal', values);
  })();

  // Hintergrund hinter dem Kasten = die sichtbare Farbe der Karte (Fläche der Karte über der Seite; das laufende Spiel zusätzlich mit der Tönung), hell oder dunkel
  const kartenFarbe = overHex(colors.surface, colors.background);
  const hintergrund = status === 'running' ? overHex(colors.primaryMedium, kartenFarbe) : kartenFarbe;
  // Gleiche Rahmenbreite beider Kästen
  const rahmen = kasten === undefined ? undefined : pairFrameStrength({ fill: kasten.home.fill }, { fill: kasten.away.fill }, hintergrund);

  // „Leibchen“ ist auch für Bildschirmleser hörbar: der Vorlesetext des Stands nennt die Mannschaften mit Leibchen (@ZM-158, @ZM-161)
  const bibTeams = kasten === undefined ? [] : [kasten.home.bib ? homeTeam.name : null, kasten.away.bib ? awayTeam.name : null].filter((name) => name !== null);
  const spokenWithBib = bibTeams.length === 0 ? spokenResult : `${spokenResult}. ${bibTeams.map((name) => t('matchCard.bibSpoken', { team: name })).join(', ')}`;

  // „nach Verlängerung“ klein beim Stand des Siegers, rechtsbündig in einer eigenen Rasterzeile unter seinem Kasten (wie die Finalkarte, @ZM-158, @OB-064);
  // der Rasterabstand der Kästen (spacing.md) wird nach oben aufgehoben (Höhe der Zeile und Hinweis dicht unter dem Kasten, etwa spacing.xs), damit der Zusatz am Kasten des Siegers hängt und nicht mittig zwischen beiden schwebt
  const noteSide: Side | null = kasten !== undefined && ende !== undefined && status === 'finished' && result?.decision === 'overtime' && decided ? result.winner : null;
  const rowOf = (side: Side): number => (side === 'a' ? 1 : noteSide === 'a' ? 3 : 2);

  const renderRow = (side: Side, team: Team) => {
    const isWinner = decided && result?.winner === side;
    const isLoser = decided && result?.winner !== side;
    const goals = result === null ? undefined : side === 'a' ? result.goalsA : result.goalsB;
    const penalty = side === 'a' ? result?.penaltyA : result?.penaltyB;
    const finished = kasten !== undefined && ende !== undefined && status === 'finished';
    const nameStyle: CSSProperties = {
      fontSize: cssVars.fontSizes.md,
      fontWeight: isWinner ? cssVars.fontWeights.bold : isLoser || status === 'finished' ? cssVars.fontWeights.medium : cssVars.fontWeights.semibold,
      color: isLoser ? cssVars.colors.textSecondary : cssVars.colors.textPrimary,
      // MOBILE-UX: Mannschaftsnamen werden nie abgeschnitten; minWidth 0 lässt den Namen schrumpfen statt über die Torfläche zu laufen
      overflowWrap: 'break-word',
      minWidth: 0,
    };
    const first = side === 'a';
    const seite = first ? 'home' : 'away';
    // Feste Zelle je Element: ohne Strafstoß-Spalte würde die automatische Platzierung die nächste Zeile in die freie Zelle ziehen
    const row = rowOf(side);
    const nameBlock = (
      <ZeitstrafeHinweis liste={zeitstrafen?.[seite]} testId={`match-time-penalty-${matchId}-${seite}`}>
        <span style={nameStyle} data-winner={isWinner ? 'true' : undefined} data-testid={`match-name-${matchId}-${seite}`}>{team.name}</span>
      </ZeitstrafeHinweis>
    );
    return (
      <Fragment key={side}>
        <div style={{ ...teamStyle, gridColumn: 1, gridRow: row }}>
          <TeamAvatar team={team} size="sm" />
          {nameBlock}
        </div>
        <button
          type="button"
          data-score-circle
          data-testid={`match-goals-${matchId}-${side === 'a' ? 'home' : 'away'}`}
          style={{
            ...goalsStyle,
            gridColumn: 2,
            gridRow: row,
            cursor: disabled ? 'default' : 'pointer',
            fontWeight: isWinner ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold,
            color: isLoser || goals === undefined ? cssVars.colors.textSecondary : cssVars.colors.textPrimary,
          }}
          aria-label={first ? spokenWithBib : undefined}
          aria-hidden={first ? undefined : true}
          tabIndex={first && !disabled ? 0 : -1}
          onClick={(e) => { e.stopPropagation(); if (!disabled) { onScoreClick(); } }}
        >
          {kasten === undefined ? (goals ?? '–') : (
            <ScoreBox
              score={goals === undefined && blankWithoutScore ? null : (goals ?? 0)}
              fill={(first ? kasten.home : kasten.away).fill}
              size="compact"
              background={hintergrund}
              textColor={colors.textPrimary}
              bib={(first ? kasten.home : kasten.away).bib}
              outcome={finished && decided ? (isWinner ? 'winner' : 'loser') : undefined}
              cup={finished && isWinner && ende.cup}
              frameStrength={rahmen}
              ariaLabel={[goals === undefined && blankWithoutScore ? team.name : `${team.name}: ${String(goals ?? 0)}`, finished && isWinner ? t('matchCard.winnerAria') : null, (first ? kasten.home : kasten.away).bib ? t('matchCard.bibAria') : null].filter((x) => x !== null).join(', ')}
              testId={`match-box-${matchId}-${seite}`}
              position={seite}
            />
          )}
        </button>
        {penalty !== undefined && (
          <span
            style={{
              fontSize: cssVars.fontSizes.md,
              fontWeight: isWinner ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold,
              color: cssVars.colors.textSecondary,
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'right',
              gridColumn: 3,
              gridRow: row,
            }}
            data-testid={`match-penalty-${matchId}-${side === 'a' ? 'home' : 'away'}`}
          >
            ({penalty})
          </span>
        )}
        {noteSide === side && (
          <span style={{ gridColumn: '1 / -1', gridRow: row + 1, textAlign: 'right', fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: `calc(-1 * ${cssVars.spacing.md})` }} data-testid={`match-overtime-${matchId}-${seite}`}>
            {t('matchResult.afterOvertime')}
          </span>
        )}
      </Fragment>
    );
  };

  return (
    <div style={kasten === undefined ? gridStyle : { ...gridStyle, rowGap: cssVars.spacing.md, paddingTop: cssVars.spacing.sm }} data-kasten={kasten === undefined ? undefined : 'true'}>
      {renderRow('a', homeTeam)}
      {renderRow('b', awayTeam)}
    </div>
  );
};

export default TeamScoreRows;
