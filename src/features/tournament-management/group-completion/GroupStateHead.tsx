/**
 * Zustand je Gruppe (GA4 A-13c; @TM-059; Mockup Zustände 1 bis 6, 17 bis 21): neben dem Gruppennamen genau eines der vier
 * Zustandswörter – „offen“, „läuft“, „bereit zum Abschluss“, „abgeschlossen“ – und, wenn nötig, eine Zusatzmarke („Besetzung
 * prüfen“ nach einer Korrektur; „noch nicht gesendet“ nach einem Abschluss ohne Netz, A-15c). Zusatzmarken ersetzen das Zustandswort nie: nach einer
 * Korrektur bleibt die Gruppe „abgeschlossen“. Darunter der Zähler, in einer laufenden Gruppe die gesperrte Zweittaste
 * „Gruppe abschließen“ mit kurzem Grund (@TM-054) und nach dem Abschluss ein Hinweis mit Wirkung, Person und Zeit (nur
 * Turnierleitung) und der leisen Taste „Gruppe wieder öffnen“. Test-IDs: `group-state-<Gruppe>`, `group-flag-<lage>-<Gruppe>`,
 * `group-reopen-<Gruppe>`, `group-close-button-<Gruppe>`; die Gruppe immer über `groupTestId()`.
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties, ReactNode } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { StateMark, type StateMarkSymbol, type StateMarkTone } from '../../../components/ui/molecules/StateMark';
import {
  groupMatches, groupState, groupStateLabel, phaseState, undecidedMatches, type GroupStateWord, type PhaseState,
} from '../../../core/services/GroupCompletionService';
import { isPendingSlot } from '../../../core/models/matchSlot';
import { completionEffect } from '../../../core/services/groupCompletionPlan';
import { activeCompletion } from '../../../core/standings/groupCompletions';
import { timeText } from '../standings/tieFormat';
import { groupNameOf, labelText, withGroup } from './completionTexts';
import { lastGroupLog } from './completionLog';
import { useGroupCompletionUi } from './groupCompletionContext';
import { groupTestId } from './groupTestId';

const WORD: Record<GroupStateWord, { tone: StateMarkTone; symbol: StateMarkSymbol }> = {
  open: { tone: 'neutral', symbol: 'circle' },
  running: { tone: 'neutral', symbol: 'play' },
  ready: { tone: 'info', symbol: 'flag' },
  completed: { tone: 'done', symbol: 'check' },
};

const marksRow: CSSProperties = { display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: cssVars.spacing.sm };
const meta: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
const line: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };
const title: CSSProperties = { fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md };

/** Die Zustandsmarken einer Gruppe; ohne Anbieter nichts. */
export const GroupStateMarks = ({ groupId }: { groupId: string }) => {
  const { t } = useTranslation('tournament');
  const api = useGroupCompletionUi();
  if (api === null || groupMatches(api.tournament, groupId).length === 0) {
    return null;
  }
  const id = groupTestId(groupId);
  const label = groupStateLabel(groupState(api.tournament, groupId), { unsent: activeCompletion(api.tournament, groupId)?.unsent === true });
  const look = WORD[label.word];
  return (
    <span style={marksRow}>
      <StateMark tone={look.tone} symbol={look.symbol} data-testid={`group-state-${id}`} data-kind={label.word}>{t(`groupCompletion.state.${label.word}`)}</StateMark>
      {label.flags.map((flag) => (
        <StateMark key={flag} tone="warn" symbol={flag === 'notSent' ? 'offline' : 'warn'} data-testid={`group-flag-${flag}-${id}`} data-kind={flag}>
          {t(`groupCompletion.state.${flag}`)}
        </StateMark>
      ))}
    </span>
  );
};

const lockedStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: cssVars.touchTargets.minimum, padding: `0 ${cssVars.spacing.md}`,
  background: cssVars.colors.background, color: cssVars.colors.textSecondary, border: `${cssVars.borderWidth.thin} dashed ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md, font: 'inherit', fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold, cursor: 'not-allowed',
};

/** Zähler, gesperrte Taste und Abschluss-Hinweis einer Gruppe; ohne Anbieter nichts. */
export const GroupStateDetails = ({ groupId }: { groupId: string }) => {
  const { t } = useTranslation('tournament');
  const api = useGroupCompletionUi();
  if (api === null || groupMatches(api.tournament, groupId).length === 0) {
    return null;
  }
  const { tournament, canManage } = api;
  const id = groupTestId(groupId);
  const state = groupState(tournament, groupId);
  const matches = groupMatches(tournament, groupId);
  const open = undecidedMatches(tournament, groupId).length;
  const parts: ReactNode[] = [t('groupCompletion.head.count', { done: matches.length - open, total: matches.length })];
  if (!canManage && state === 'finished') {
    parts.push(t('groupCompletion.head.helperNote'));
  }
  const completion = activeCompletion(tournament, groupId);
  return (
    <div style={{ display: 'grid', gap: cssVars.spacing.sm }}>
      <p style={meta} data-testid={`group-count-${id}`}>{parts.join(' · ')}</p>
      {canManage && state === 'running' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${cssVars.spacing.xs} ${cssVars.spacing.md}` }}>
          <button type="button" style={lockedStyle} aria-disabled="true" onClick={() => { api.begin(groupId); }} data-testid={`group-close-button-${id}`}>
            {t('groupCompletion.button.close')}
          </button>
          <span style={meta} data-testid={`group-close-why-${id}`}>{t('groupCompletion.head.lockedWhy', { count: open })}</span>
        </div>
      ) : null}
      {completion !== undefined ? <CompletedNote groupId={groupId} /> : null}
    </div>
  );
};

/** Hinweis „Gruppe abgeschlossen“ mit Wirkung; Person und Zeit nur für die Turnierleitung (@TM-113). */
const CompletedNote = ({ groupId }: { groupId: string }) => {
  const { t, i18n } = useTranslation('tournament');
  const api = useGroupCompletionUi();
  const completion = api === null ? undefined : activeCompletion(api.tournament, groupId);
  if (api === null || completion === undefined) {
    return null;
  }
  const { tournament, canManage } = api;
  const id = groupTestId(groupId);
  const name = groupNameOf(tournament, groupId);
  const nameOf = (teamId: string): string => tournament.teams.find((team) => team.id === teamId)?.name ?? '';
  const person = canManage ? lastGroupLog(tournament, 'complete_group', groupId) : undefined;
  const at = person?.at ?? (canManage ? completion.completedAt : undefined);
  const suffix = at === undefined ? '' : person?.name !== undefined ? ` · ${t('groupCompletion.done.by', { name: person.name, time: timeText(at, i18n.language) })}` : ` · ${timeText(at, i18n.language)}`;
  const effect = completionEffect(tournament, groupId, completion.ranking, completion.openRanks)
    .map((e) => t('groupCompletion.done.effect', { label: labelText(e.label), side: t(e.side === 'A' ? 'groupCompletion.done.sideHome' : 'groupCompletion.done.sideAway'), team: nameOf(e.teamId) }).trim());
  // „Alle Plätze der Finalrunde sind besetzt“ nur, wenn es Finalspiele gibt, keine Seite mehr auf einen Gruppenplatz wartet (aus den Seiten) UND die Gruppenphase abgeschlossen ist
  const finalMatches = tournament.matches.filter((m) => m.isFinal === true);
  const allGroupSidesFilled = finalMatches.length > 0 && finalMatches.every((m) => [m.slotA, m.slotB].every((slot) => !(isPendingSlot(slot) && slot.source.kind === 'groupRank')));
  return (
    <InlineNotice
      tone="ok"
      data-testid={`group-done-${id}`}
      footer={canManage ? (
        <div>
          <Button
            variant="secondary"
            size="md"
            icon={<Icons.Restore size={iconSizeValues.sm} />}
            style={{ minHeight: cssVars.touchTargets.minimum, padding: `0 ${cssVars.spacing.md}` }}
            onClick={() => { api.beginReopen(groupId); }}
            data-testid={`group-reopen-${id}`}
          >
            {t('groupCompletion.button.reopen')}
          </Button>
        </div>
      ) : undefined}
    >
      <span style={title}>{`${t('groupCompletion.done.title', withGroup(name))}${suffix}`}</span>
      <p style={line}>{name === undefined ? t('groupCompletion.done.effectAll') : effect.join(' ')}</p>
      {allGroupSidesFilled && phaseState(tournament, 'groups') === 'completed' ? <p style={line} data-testid="group-phase-done">{t('groupCompletion.done.phaseDone')}</p> : null}
    </InlineNotice>
  );
};

const PHASE_LOOK: Record<PhaseState, { tone: StateMarkTone; symbol: StateMarkSymbol }> = {
  open: WORD.open, running: WORD.running, completed: WORD.completed,
};

/** Zustand der Gruppenphase und der Finalrunde (@TM-059); nur bei Turnieren mit Finalrunde. */
export const PhaseMarks = () => {
  const { t } = useTranslation('tournament');
  const api = useGroupCompletionUi();
  if (api === null || !api.tournament.matches.some((m) => m.isFinal === true) || !api.tournament.matches.some((m) => m.isFinal !== true)) {
    return null;
  }
  const mark = (phase: 'groups' | 'finals') => {
    const state = phaseState(api.tournament, phase);
    const look = PHASE_LOOK[state];
    return (
      <StateMark key={phase} tone={look.tone} symbol={look.symbol} data-testid={`phase-state-${phase}`} data-kind={state}>
        {t('groupCompletion.phase.label', { phase: t(`groupCompletion.phase.${phase}`), state: t(`groupCompletion.state.${state}`) })}
      </StateMark>
    );
  };
  return <div style={marksRow} data-testid="phase-marks">{mark('groups')}{mark('finals')}</div>;
};
