/**
 * Abschluss-Dialog „Gruppe abschließen“ ohne offenen Gleichstand (GA4 A-13c; Mockup Zustände 7, 8, 16, 28): die Tabelle zum
 * Prüfen (Punkte, Tore, Tordifferenz; @TM-044), die Wirkung (welche Plätze besetzt werden, @TM-016), eine schon gültige
 * Entscheidung aus der Tabelle (@W2A-058: nicht erneut verlangt) und eine Haupttaste. Haupttaste oben, „Abbrechen“ darunter.
 * Ohne Netz ist die Taste gesperrt und der Satz nennt den Grund (der Abschluss ohne Netz kommt mit A-15c).
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { completionEffect } from '../../../core/services/groupCompletionPlan';
import { groupIds } from '../../../core/services/GroupCompletionService';
import { activeCompletion } from '../../../core/standings/groupCompletions';
import { groupTieView } from '../../../core/standings/tieViews';
import { rankTournamentGroup } from '../../../core/standings/tournamentTable';
import { decidedTexts } from '../standings/decidedText';
import { groupNameOf, labelText, signed, withGroup } from './completionTexts';
import { GroupDialogShell } from './GroupDialogShell';
import type { CompletionError, GroupCompletionApi, ReadyPlan } from './useGroupCompletion';

const list: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.md, background: cssVars.colors.surface };
const row: CSSProperties = { display: 'grid', gridTemplateColumns: `${cssVars.spacing.lg} minmax(0, 1fr)`, gap: cssVars.spacing.sm, alignItems: 'start', padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`, borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}` };
const small: CSSProperties = { display: 'inline', marginLeft: cssVars.spacing.sm, color: cssVars.colors.textSecondary, fontWeight: cssVars.fontWeights.normal, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
const text: CSSProperties = { margin: 0 };

export interface GroupConfirmDialogProps {
  api: GroupCompletionApi;
  groupId: string;
  plan: ReadyPlan;
  busy: boolean;
  error: CompletionError | null;
}

export const GroupConfirmDialog = ({ api, groupId, plan, busy, error }: GroupConfirmDialogProps) => {
  const { t, i18n } = useTranslation('tournament');
  const { tournament } = api;
  const name = groupNameOf(tournament, groupId);
  const { ranking, openRanks, knownDecisionIds } = plan.request;
  const nameOf = (teamId: string): string => tournament.teams.find((team) => team.id === teamId)?.name ?? '';
  const rows = rankTournamentGroup(plan.preview, groupId).rows;
  const shown = ranking.flatMap((teamId, index) => {
    const standing = rows.find((r) => r.team.id === teamId);
    return standing === undefined ? [] : [{ standing, place: ranking.length === rows.length ? standing.place : index + 1 }];
  });
  const effect = completionEffect(plan.preview, groupId, ranking, openRanks);
  const items = effect.map((e) => t('groupCompletion.dialog.effectItem', {
    label: labelText(e.label), side: t(e.side === 'A' ? 'groupCompletion.done.sideHome' : 'groupCompletion.done.sideAway'), team: nameOf(e.teamId),
  }).trim());
  const othersOpen = groupIds(tournament).some((g) => g !== groupId && activeCompletion(tournament, g) === undefined);
  const known = groupTieView(plan.preview, groupId).decided.filter((d) => knownDecisionIds.includes(d.decision.id));
  const count = plan.request.expectedState.length;
  const title = t(plan.again ? 'groupCompletion.dialog.titleAgain' : 'groupCompletion.dialog.title', withGroup(name));
  const offline = !api.online;
  const effectText = items.length > 0
    ? `${t('groupCompletion.dialog.effectTitle', { list: items.join(', ') })}${othersOpen ? ` ${t('groupCompletion.dialog.effectOthers')}` : ''}`
    : t(name === undefined ? 'groupCompletion.dialog.effectAll' : 'groupCompletion.dialog.effectNone');

  const footer = (
    <>
      <Button variant="primary" size="lg" fullWidth style={{ minHeight: cssVars.touchTargets.primary }} disabled={busy || offline} onClick={api.confirm} data-primary data-testid="group-close-confirm">
        {t(plan.again ? 'groupCompletion.dialog.confirmAgain' : 'groupCompletion.dialog.confirm')}
      </Button>
      <Button variant="secondary" size="lg" fullWidth style={{ minHeight: cssVars.touchTargets.minimum }} disabled={busy} onClick={api.close} data-testid="group-close-cancel">
        {t('groupCompletion.dialog.cancel')}
      </Button>
    </>
  );

  return (
    <GroupDialogShell title={title} onClose={api.close} footer={footer} data-testid="group-close-dialog">
      <p style={text}>{t('groupCompletion.dialog.intro', withGroup(name, { count }))}</p>
      <ol style={list} aria-label={t('groupCompletion.dialog.rankAria')} data-testid="group-close-ranking">
        {shown.map(({ standing, place }, i) => (
          <li key={standing.team.id} style={i === 0 ? { ...row, borderTop: 0 } : row}>
            <span style={{ fontWeight: cssVars.fontWeights.bold }}>{place}</span>
            <span style={{ fontWeight: cssVars.fontWeights.semibold, minWidth: 0, overflowWrap: 'anywhere' }}>
              {standing.team.name}
              <span style={small}>{t('groupCompletion.dialog.rankLine', { points: standing.points, goals: `${String(standing.goalsFor)}:${String(standing.goalsAgainst)}`, diff: signed(standing.goalDifference) })}</span>
            </span>
          </li>
        ))}
      </ol>
      {known.map((d) => (
        <InlineNotice key={d.decision.id} tone="ok" data-testid="group-close-decided">
          <span>{t('groupCompletion.dialog.decided', { what: decidedTexts(t, i18n.language, d.decision, d, nameOf, true).heading })}</span>
        </InlineNotice>
      ))}
      <InlineNotice tone="info" data-testid="group-close-effect"><span>{effectText}</span></InlineNotice>
      {offline ? <p style={{ ...text, fontWeight: cssVars.fontWeights.semibold }} data-testid="group-close-offline">{t('groupCompletion.errors.OFFLINE')}</p> : null}
      {error !== null && !(offline && error === 'OFFLINE') ? <InlineNotice tone="error" data-testid="group-close-error"><span>{t(`groupCompletion.errors.${error}`)}</span></InlineNotice> : null}
    </GroupDialogShell>
  );
};
