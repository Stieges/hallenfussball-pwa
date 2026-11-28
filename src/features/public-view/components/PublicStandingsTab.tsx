/**
 * Tabellen-Tab der Zuschauer-Seite (B-13d1, aus LiveViewScreen ausgelagert).
 * Texte wörtlich übernommen.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { Card } from '../../../components/ui/Card';
import { TieMarker } from '../../../components/ui/molecules/TieMarker';
import { standingsGroups } from '../../../core/models/standingsGroups';
import { groupTieView, publicTieMarkOf, type GroupTieView } from '../../../core/standings/tieViews';
import { GroupTables } from '../../../components/schedule/GroupTables';
import { wertungLines } from '../publicWertung';
import type { Standing, Tournament } from '../../../types/tournament';

export interface PublicStandingsTabProps {
  tournament: Tournament;
  standings: Standing[];
}

export const PublicStandingsTab: React.FC<PublicStandingsTabProps> = ({ tournament, standings }) => {
  const { t } = useTranslation('publicView');
  const tiebreak = wertungLines(t, tournament).tiebreakShort;
  const { t: tTournament } = useTranslation('tournament');
  // Gleichstände einmal je Gruppe rechnen (nicht je Zeile)
  const tieViews = useMemo(
    () => new Map<string, GroupTieView>(standingsGroups(tournament.teams).map(({ group }) => [group, groupTieView(tournament, group)])),
    [tournament],
  );
  if (tournament.hideRankingsForPublic) {
    return (
      <Card>
        <div
          style={{
            padding: cssVars.spacing.xl,
            textAlign: 'center',
            color: cssVars.colors.textMuted,
          }}
        >
          <p style={{ fontSize: cssVars.fontSizes.lg, marginBottom: cssVars.spacing.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: cssVars.spacing.sm }}>
            <span aria-hidden="true" data-testid="public-standings-hidden-icon" style={{ display: 'flex' }}><Icons.Trophy size={iconSizeValues.md} /></span>
            {t('standings.hidden')}
          </p>
          <p style={{ fontSize: cssVars.fontSizes.sm }}>
            {t('standings.bambini')}
          </p>
        </div>
      </Card>
    );
  }

  return (
    // Schmales Polster der Karte (statt xl): am Handy bleibt der Tabelle Breite für Name, Sp., Diff., Pkt. und Taste (@ZM-205)
    <Card style={{ padding: cssVars.spacing.sm }}>
      <GroupTables
        standings={standings}
        teams={tournament.teams}
        tournament={tournament}
        tieDisplay="public"
        renderGroupFooter={() => tiebreak === undefined ? null : (
          <p data-testid="public-standings-tiebreak" style={{ margin: `${cssVars.spacing.sm} 0 0`, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }}>{tiebreak}</p>
        )}
        renderPublicTieMarker={(teamId, groupId) => {
          const view = tieViews.get(groupId);
          const mark = view === undefined ? undefined : publicTieMarkOf(view, teamId);
          return mark === undefined ? null : (
            <TieMarker tone="warn" symbol="warn" data-testid="public-tie-mark" data-kind={mark}>{tTournament(`standingsTie.publicMark.${mark}`)}</TieMarker>
          );
        }}
      />
    </Card>
  );
};
