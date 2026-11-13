/**
 * Tabelle einer Gruppe am Handy (@ZM-088, @ZM-205): Platz, Team, Sp., Diff., Pkt. und am Zeilenende die Taste zum Aufklappen
 * (Pfeil nach unten, aufgeklappt nach oben, Symbol der App; Vorlesetext „Details zu <Team> anzeigen“, Tippfläche mindestens
 * `touchTargets.minimum`). Siege, Unentschieden, Niederlagen und Tore stehen erst im aufgeklappten Bereich.
 * Aus `GroupTables.tsx` ausgelagert; Platzziffer über `placeLabel` (@ZM-198).
 */
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../design-tokens';
import type { Standing } from '../../types/tournament';
import { ShortLabel } from '../ui/atoms';
import { Icons } from '../ui/Icons';
import { monitorTeamName } from '../../core/models/teamNameAbbrev';
import { placeLabel } from '../../core/standings/placeLabel';
import { StandingNameCell } from './StandingNameCell';
import { goalDiffColor, hiddenStyle, highlightStyle, mobileFixedColStyle, mobileTdStyle, mobileThStyle, tableStyle, type PlacementHighlights } from './groupTablesStyle';

export interface GroupStandingsMobileTableProps {
  standings: Standing[];
  title: string;
  highlights: PlacementHighlights;
  activeMatchTeamIds?: Set<string>;
  /** @W2A-059: Marke für Zuschauer, steht in der Namenszelle unter dem Namen. */
  publicTieMarker?: (teamId: string) => ReactNode;
  /** TB-6b: Marke der Verwaltung, eigene Zeile über die volle Breite (nicht in der schmalen Teamspalte). */
  tieMarker?: (teamId: string) => ReactNode;
}

const center: CSSProperties = { ...mobileTdStyle, textAlign: 'center' };

const toggleStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: cssVars.touchTargets.minimum,
  minHeight: cssVars.touchTargets.minimum,
  // Die Tippfläche (44 Pixel) ragt nach links über die schmale Zelle (32 Pixel) in die Zelle „Pkt.“ hinein; rechts schließt sie bündig ab, damit nichts überläuft (@ZM-205)
  margin: `0 0 0 calc(${cssVars.spacing.xl} - ${cssVars.touchTargets.minimum})`,
  padding: 0,
  background: 'transparent',
  border: 'none',
  color: cssVars.colors.textPrimary,
  cursor: 'pointer',
};

const detailCell: CSSProperties = { textAlign: 'center' };
const detailLabel: CSSProperties = { color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: cssVars.spacing.xs };
const detailValue: CSSProperties = { fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary };

function Detail({ label, value, span, active }: { label: string; value: ReactNode; span: number; active?: boolean }) {
  return (
    <div style={{ ...detailCell, gridColumn: `span ${String(span)}` }}>
      <div style={detailLabel}>{label}</div>
      <div style={{ ...detailValue, ...highlightStyle(active === true), display: 'inline-block' }}>{value}</div>
    </div>
  );
}

export function GroupStandingsMobileTable({ standings, title, highlights, activeMatchTeamIds, publicTieMarker, tieMarker }: GroupStandingsMobileTableProps) {
  const { t } = useTranslation('tournament');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggle = (teamId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(teamId)) { next.add(teamId); }
      return next;
    });
  };

  return (
    // position: relative: die nur zum Vorlesen sichtbaren Texte (absolut) werden mit der Tabelle im Kasten beschnitten und weiten die Seite nicht (@ZM-207)
    // overflowX: nur bei sehr langen Wörtern scrollt die Tabelle im Kasten; tabIndex/role/aria-label machen den Bereich per Tastatur erreichbar (axe scrollable-region-focusable)
    <div className="mobile-view" style={{ overflowX: 'auto', position: 'relative' }} tabIndex={0} role="region" aria-label={title}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={mobileFixedColStyle}><ShortLabel term="rank" /></th>
            <th style={mobileThStyle}>{t('groupTables.columns.team')}</th>
            <th style={mobileFixedColStyle}><ShortLabel term="played" /></th>
            <th style={mobileFixedColStyle}><ShortLabel term="goalDifference" /></th>
            <th style={mobileFixedColStyle}><ShortLabel term="points" /></th>
            <th style={mobileFixedColStyle}><span style={hiddenStyle}>{t('groupTables.details.column')}</span></th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing, index) => {
            const goalDiff = standing.goalsFor - standing.goalsAgainst;
            const teamKey = standing.team.id;
            const isExpanded = expanded.has(teamKey);
            const Chevron = isExpanded ? Icons.ChevronUp : Icons.ChevronDown;
            const tieRow = tieMarker?.(teamKey);
            return (
              <Fragment key={teamKey}>
                <tr onClick={() => { toggle(teamKey); }} style={{ cursor: 'pointer' }}>
                  <td style={{ ...center, fontWeight: cssVars.fontWeights.bold }}>{placeLabel(standings, index)}</td>
                  <td style={{ ...mobileTdStyle, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md }}>
                    {/* @ZM-169: nur hier Vereinskürzel nach der Monitor-Liste; Desktop-Tabelle und Spielkarten zeigen den vollen Namen */}
                    <StandingNameCell team={standing.team} label={monitorTeamName(standing.team.name)} playing={activeMatchTeamIds?.has(teamKey) === true} gap={cssVars.spacing.xs} />
                    {publicTieMarker?.(teamKey)}
                  </td>
                  <td style={{ ...center, fontWeight: cssVars.fontWeights.semibold }}>{standing.played}</td>
                  <td style={{ ...center, color: goalDiffColor(goalDiff) }}>
                    <span style={{ fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md, ...highlightStyle(highlights.goalDiff), fontVariantNumeric: 'tabular-nums' }}>
                      {goalDiff > 0 ? '+' : ''}{goalDiff}
                    </span>
                  </td>
                  <td style={center}>
                    <span style={{ fontWeight: cssVars.fontWeights.bold, fontSize: cssVars.fontSizes.md, ...highlightStyle(highlights.points), fontVariantNumeric: 'tabular-nums' }}>{standing.points}</span>
                  </td>
                  {/* ohne Polster: die Taste (44 Pixel) bestimmt die Zeilenhöhe, ohne sie über die bisherigen ~45 Pixel zu treiben */}
                  <td style={{ ...center, padding: 0 }}>
                    <button
                      type="button"
                      style={toggleStyle}
                      aria-expanded={isExpanded}
                      aria-label={t(isExpanded ? 'groupTables.details.hideFor' : 'groupTables.details.showFor', { team: standing.team.name })}
                      data-testid={`standing-toggle-${teamKey}`}
                      onClick={(event) => { event.stopPropagation(); toggle(teamKey); }}
                    >
                      <Chevron size={iconSizeValues.sm} />
                    </button>
                  </td>
                </tr>
                {/* TB-6b: auf dem Handy eigene Zeile über die volle Breite (nicht in der schmalen Teamspalte) */}
                {tieRow !== undefined && tieRow !== null && (
                  <tr data-testid="tie-marker-row">
                    <td colSpan={6} style={{ ...mobileTdStyle, textAlign: 'left' }}>{tieRow}</td>
                  </tr>
                )}
                {isExpanded && (
                  <tr>
                    <td colSpan={6} style={{ padding: cssVars.spacing.md, background: cssVars.colors.rankingExpandedBg, borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: cssVars.spacing.md, fontSize: cssVars.fontSizes.sm }}>
                        <Detail label={t('groupTables.details.wins')} value={standing.won} span={2} active={highlights.wins} />
                        <Detail label={t('groupTables.details.draws')} value={standing.drawn} span={2} />
                        <Detail label={t('groupTables.details.losses')} value={standing.lost} span={2} />
                        <Detail label={t('groupTables.details.goalsFor')} value={standing.goalsFor} span={3} active={highlights.goalsFor} />
                        <Detail label={t('groupTables.details.goalsAgainst')} value={standing.goalsAgainst} span={3} active={highlights.goalsAgainst} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
