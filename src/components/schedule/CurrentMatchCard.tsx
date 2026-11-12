/**
 * CurrentMatchCard – die Karte „läuft / als Nächstes / zuletzt beendet“ (Zuschauer-Kopfblock @ZM-141/@ZM-195, Spielplan der
 * Turnierleitung @ZP-109). Ein Aufbau für beide: Kopfzeile, Mannschaften untereinander mit Kästen (`TeamScoreRows`, @OB-064),
 * danach Platz für die Restzeit (`belowScore`), Tasten (`actions`) und eine Fußzeile (`footer`, z. B. „Danach“).
 *
 * Was die Zielgruppen unterscheidet, kommt von außen: Kopfinhalt (`head`, `headRight`), Rahmen (`frame`: Zuschauer `active`, Turnierleitung
 * beim laufenden Spiel `live`), Kästen beim nächsten Spiel (`showPlannedZero`: Zuschauer 0 : 0 nach @ZM-195, Turnierleitung leere Kästen
 * nach Mockup Runde 4). Reine Anzeige, keine Daten- und keine Rechtelogik.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cssVars } from '../../design-tokens';
import type { MatchView, SpectatorClock } from '../../core/view';
import type { ScheduledMatch } from '../../core/generators';
import { TeamScoreRows } from './MatchCard/TeamScoreRows';
import { sideDisplay, type SideContext } from './matchSides';
import { cardStatusOf, resultFigures } from './matchResult';

export interface CurrentMatchCardProps {
  match: MatchView;
  scheduled: ScheduledMatch;
  sides: SideContext;
  /** Restzeit des laufenden Spiels samt Zeitstrafen (`useSpectatorClocks`); sonst `null` */
  clock: SpectatorClock | null;
  /** Kästen der Ansicht für dieses Spiel; `undefined` = Zahl statt Kasten (Ergebnisse für die Zielgruppe aus) */
  kasten: MatchView['boxes'] | undefined;
  /** Beendetes Spiel (Zuschauer „zuletzt beendet“): Ring beim Sieger, Pokal in der Finalrunde */
  ende?: { cup: boolean };
  /** Kopfzeile links (Meta, Abzeichen) und rechts (Anstoß, Restzeit) */
  head: ReactNode;
  headRight?: ReactNode;
  /** `strip`: abgesetzter Streifen (Zuschauer); `plain`: Zeile auf der Karte (Turnierleitung) */
  headVariant: 'strip' | 'plain';
  /** `active`: Rahmen in der Hauptfarbe beim laufenden Spiel (Zuschauer); `live`: roter Live-Rahmen (Turnierleitung) */
  frame: 'active' | 'live';
  /** Nächstes Spiel: Kästen mit 0 statt leer (Zuschauer, @ZM-195) */
  showPlannedZero: boolean;
  /** Unter dem Stand, z. B. die Restzeit der Zuschauer-Karte */
  belowScore?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  /** Kennung der Karte; Kinder: `${testIdPrefix}-card-${id}` */
  testIdPrefix: string;
  /** Wert für `data-current-kind` (`live` | `next` | `last`) */
  kind: 'live' | 'next' | 'last';
}

const noop = (): void => undefined;

const cardStyle = (live: boolean, frame: 'active' | 'live'): CSSProperties => ({
  background: cssVars.colors.surface,
  border: `${live ? cssVars.borderWidth.medium : cssVars.borderWidth.thin} solid ${
    live ? (frame === 'live' ? cssVars.colors.statusLive : cssVars.colors.borderActive) : cssVars.colors.border
  }`,
  borderRadius: cssVars.borderRadius.lg,
  overflow: 'hidden',
  minWidth: 0,
});

const headBase: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  columnGap: cssVars.spacing.md,
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textSecondary,
};
const headStrip: CSSProperties = {
  ...headBase,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
  borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  background: cssVars.colors.surfaceDark,
};
const headPlain: CSSProperties = {
  ...headBase,
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.md} 0`,
  fontSize: cssVars.fontSizes.md,
  color: cssVars.colors.textPrimary,
  fontWeight: cssVars.fontWeights.semibold,
};
const bodyStyle: CSSProperties = { display: 'flex', padding: cssVars.spacing.sm };
const belowStyle: CSSProperties = { padding: `0 ${cssVars.spacing.sm} ${cssVars.spacing.sm}` };

export function CurrentMatchCard({
  match, scheduled, sides, clock, kasten, ende, head, headRight, headVariant, frame, showPlannedZero, belowScore, actions, footer, testIdPrefix, kind,
}: CurrentMatchCardProps): ReactElement {
  const status = cardStatusOf(match);
  return (
    <article style={cardStyle(match.isLive, frame)} data-testid={`${testIdPrefix}-card-${match.id}`} data-current-kind={kind}>
      <div style={headVariant === 'strip' ? headStrip : headPlain}>
        {head}
        {headRight}
      </div>
      <div style={bodyStyle}>
        <TeamScoreRows
          matchId={`kopf-${match.id}`}
          homeTeam={sideDisplay(scheduled, 'A', sides)}
          awayTeam={sideDisplay(scheduled, 'B', sides)}
          result={resultFigures(match.score, status)}
          status={status}
          onScoreClick={noop}
          disabled
          zeitstrafen={clock?.zeitstrafen}
          kasten={kasten}
          ende={ende}
          emptyBoxes={!showPlannedZero}
        />
      </div>
      {belowScore !== undefined && <div style={belowStyle}>{belowScore}</div>}
      {actions}
      {footer}
    </article>
  );
}
