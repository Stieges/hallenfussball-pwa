/**
 * Dialog „Turnier abschließen“, Zustand B „bereit“ (@LZ-007, @LZ-009, @LZ-018; Mockup Runde 2): oben ein Hinweis zum Zustand
 * (Kein Netz, Speichern läuft, Fehler, nicht bestätigt) oder die Warnungen, dann Sieger, Plätze 1 bis 3 mit „Alle N Plätze“,
 * die drei Zahlen und „Das passiert beim Abschließen“. Kein Bestätigungs-Häkchen (Daniel 25.10.). Der Endstand ist der, der
 * gespeichert wird (`ready.snapshot`), nicht eine zweite Rechnung der Oberfläche.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../../../types/tournament';
import type { FinishReady } from '../../../core/services/finishPreparation';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { HyphenSafe, TeamName } from './HyphenSafe';
import { finishFacts, pointsByTeam, shootoutNote } from '../model/finishSummary';
import { FinishWarnings } from './FinishWarnings';
import { disclosureIcon, factsLine, winnerBox, winnerIcon } from './finishReadyStyles';
import { placeList, placeNumber, placeRow, secondaryButton, small, stack, strong, subHeading, text, tightStack } from './finishStyles';

export interface FinishReadyBodyProps {
  ready: FinishReady;
  /** Der Stand, den der Dienst geprüft hat (roh, ohne Überlagerung): Siegerzeile, Punkte, Zahlen. */
  tournament: Pick<Tournament, 'teams' | 'matches' | 'groups' | 'groupCompletions' | 'finalsConfig' | 'groupSystem' | 'pointSystem'
    | 'placementLogic' | 'standingDecisions' | 'placementsToPlayOut' | 'forfeitScore' | 'publicScorers'>;
  /** Hinweis über allem (Kein Netz, Speichern läuft, Fehler, nicht bestätigt). */
  topNotice?: ReactNode;
  /** Die Warnungen zeigen (nicht beim Speichern). */
  showWarnings?: boolean;
}

export function FinishReadyBody({ ready, tournament, topNotice, showWarnings = true }: FinishReadyBodyProps) {
  const { t } = useTranslation('tournament');
  const [expanded, setExpanded] = useState(false);
  const { ranking } = ready.snapshot;
  const winner = ranking.find((row) => row.place === 1) ?? ranking[0];
  const note = shootoutNote(tournament, ranking);
  const points = pointsByTeam(tournament);
  const facts = finishFacts(tournament);
  const rows = expanded ? ranking : ranking.slice(0, 3);
  const scorers = tournament.publicScorers === true;
  return (
    <div style={stack} data-testid="finish-ready">
      {topNotice}
      {showWarnings && <FinishWarnings warnings={ready.warnings} />}
      <div style={winnerBox} data-testid="finish-winner">
        <span style={winnerIcon} aria-hidden="true"><Icons.Trophy size={iconSizeValues.lg} /></span>
        <span style={{ ...tightStack, gap: cssVars.spacing.xs, minWidth: 0 }}>
          <span style={small}>{t('finish.ready.winner')}</span>
          <strong style={{ fontSize: cssVars.fontSizes.xxl, lineHeight: cssVars.lineHeights.headlineMd, overflowWrap: 'anywhere' }}><TeamName name={winner.teamName} /></strong>
          {note !== null && <span style={small}><HyphenSafe text={t('finish.ready.shootout', { winner: note.winner, loser: note.loser, other: note.otherName })} /></span>}
        </span>
      </div>
      <div style={tightStack}>
        <h3 style={subHeading}>{expanded ? t('finish.ready.allPlaces') : t('finish.ready.podium')}</h3>
        <ol style={placeList} data-testid="finish-places">
          {rows.map((row, index) => (
            <li key={row.teamId} style={{ ...placeRow, ...(index === rows.length - 1 ? { borderBottom: 'none' } : {}) }}>
              <span style={placeNumber}>{row.place}</span>
              <span style={strong}><TeamName name={row.teamName} /></span>
              <span style={small}>{points?.has(row.teamId) === true ? t('finish.ready.points', { points: points.get(row.teamId) }) : ''}</span>
            </li>
          ))}
        </ol>
        {ranking.length > 3 && (
          <button type="button" style={secondaryButton} aria-expanded={expanded} data-testid="finish-places-toggle" onClick={() => { setExpanded((open) => !open); }}>
            <span>{expanded ? t('finish.ready.hideAll') : t('finish.ready.showAll', { count: ranking.length })}</span>
            <span style={disclosureIcon} aria-hidden="true">{expanded ? <Icons.ChevronUp size={iconSizeValues.sm} /> : <Icons.ChevronDown size={iconSizeValues.sm} />}</span>
          </button>
        )}
      </div>
      <div style={factsLine} data-testid="finish-facts">
        <span><b>{t('finish.ready.playedOf', { played: facts.played, total: facts.total })}</b> {t('finish.ready.played')}</span>
        <span><b>{facts.skipped}</b> {t('finish.ready.skipped')}</span>
        <span><b>{facts.teams}</b> {t('finish.ready.teams')}</span>
      </div>
      <InlineNotice tone="neutral" icon={<Icons.Lock size={iconSizeValues.sm} />} live={false} data-testid="finish-consequences">
        <span style={strong}>{t('finish.ready.consequences')}</span>
        <ul style={{ margin: 0, paddingLeft: cssVars.spacing.lg, display: 'grid', gap: cssVars.spacing.xs, ...text }}>
          <li>{scorers ? t('finish.ready.saveWithScorers') : t('finish.ready.saveStandings')}</li>
          <li>{t('finish.ready.locked')}</li>
          <li>{t('finish.ready.codes')}</li>
          <li>{t('finish.ready.display')}</li>
        </ul>
        <span style={text}>{t('finish.ready.reopen')}</span>
      </InlineNotice>
    </div>
  );
}
