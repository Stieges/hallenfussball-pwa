/**
 * Torschützenliste im Endstand (R3-5, @ET-041, Regeln @ET-036 bis @ET-040 stecken in `computeScorers`): Rang 1 bis 3 sichtbar,
 * der Rest hinter „Alle Torschützen anzeigen“; die Sammelzeilen „ohne Nummer“ und „Eigentore“ stehen ohne Rang am Ende.
 * Nur Darstellung der übergebenen Zeilen (gespeichert oder vorläufig).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScorerRow } from '../../../core/standings/finalStandings';
import { iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { TeamName } from './HyphenSafe';
import { heading, placeList, secondaryButton, small, strong, tightStack } from './finishStyles';
import { scorerGoals, scorerName, scorerRank, scorerRow } from './finalStandingsStyles';

const VISIBLE_RANK = 3;

export function ScorerList({ scorers }: { scorers: readonly ScorerRow[] }) {
  const { t } = useTranslation('tournament');
  const [all, setAll] = useState(false);
  const isShort = (row: ScorerRow): boolean => row.kind === 'player' && row.rank <= VISIBLE_RANK;
  const shown = all ? scorers : scorers.filter(isShort);
  const hasMore = scorers.some((row) => !isShort(row));
  const label = (row: ScorerRow) => {
    if (row.kind === 'player') {
      return <><span>#{row.number} </span><TeamName name={row.teamName} /></>;
    }
    return <TeamName name={t(row.kind === 'noNumber' ? 'finalStandings.scorerNoNumber' : 'finalStandings.scorerOwnGoals', { team: row.teamName })} />;
  };
  return (
    <section style={tightStack} aria-labelledby="final-scorers-title" data-testid="final-scorers">
      <h3 id="final-scorers-title" style={heading}>{t('finalStandings.scorers')}</h3>
      {scorers.length === 0 ? <p style={small} data-testid="final-scorers-empty">{t('finalStandings.scorersEmpty')}</p> : (
        <ol style={placeList}>
          {shown.map((row, index) => (
            <li key={`${row.kind}-${row.teamId}-${row.kind === 'player' ? row.number : ''}`} style={{ ...scorerRow, ...(index === shown.length - 1 ? { borderBottom: 'none' } : {}) }} data-testid="final-scorer-row">
              <span style={scorerRank}>{row.rank ?? ''}</span>
              <span style={{ ...strong, ...scorerName }}>{label(row)}</span>
              <span style={{ ...strong, ...scorerGoals }}>{t('finalStandings.goals', { count: row.goals })}</span>
            </li>
          ))}
        </ol>
      )}
      {hasMore && (
        <button type="button" style={secondaryButton} onClick={() => setAll((open) => !open)} aria-expanded={all} data-testid="final-scorers-toggle">
          <span>{t(all ? 'finalStandings.showFewerScorers' : 'finalStandings.showAllScorers')}</span>
          {all ? <Icons.ChevronUp size={iconSizeValues.sm} /> : <Icons.ChevronDown size={iconSizeValues.sm} />}
        </button>
      )}
    </section>
  );
}
