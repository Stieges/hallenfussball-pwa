/**
 * Meldungen zu „Gruppe abschließen“ (GA4 A-13c; Mockup Zustände 29, 35, 36): ein Spiel ist nicht mehr entschieden (rot, nichts
 * gespeichert, @TM-054), schon gleichlautend abgeschlossen (blau, kein Fehler), die Tabelle hat sich geändert, anders
 * abgeschlossen. Einzige Taste „Verstanden“ (56 px); der Stand wird danach frisch gezeigt.
 */
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { InlineNotice, type InlineNoticeTone } from '../../../components/ui/molecules/InlineNotice';
import { undecidedMatches } from '../../../core/services/GroupCompletionService';
import { groupNameOf, matchText, withGroup } from './completionTexts';
import { newGroupActor } from './completionLog';
import { GroupDialogShell } from './GroupDialogShell';
import type { GroupCompletionApi, NoticeKind } from './useGroupCompletion';

const TONE: Record<NoticeKind, InlineNoticeTone> = { openMatches: 'error', already: 'info', tableChanged: 'warn', differently: 'warn', decidedElsewhere: 'warn' };
const OK_ID: Record<NoticeKind, string> = {
  openMatches: 'group-close-error-ok', already: 'group-already-ok', tableChanged: 'group-stale-ok', differently: 'group-conflict-ok',
  decidedElsewhere: 'group-decided-elsewhere-ok',
};
const NOTICE_ID: Record<NoticeKind, string> = {
  openMatches: 'group-close-error', already: 'group-already', tableChanged: 'group-stale', differently: 'group-conflict',
  decidedElsewhere: 'group-decided-elsewhere',
};

export interface GroupNoticeDialogProps {
  api: GroupCompletionApi;
  groupId: string;
  kind: NoticeKind;
  /** Zahl der offenen Spiele laut Server (sonst aus dem Turnier). */
  open?: number;
  /** Höchste Verlaufs-Kennung beim Absenden; genannt wird nur, wer danach eingetragen hat (@W2A-060). */
  knownLogId?: number;
}

export const GroupNoticeDialog = ({ api, groupId, kind, open, knownLogId }: GroupNoticeDialogProps) => {
  const { t } = useTranslation('tournament');
  const { tournament } = api;
  const name = groupNameOf(tournament, groupId);
  const matches = undecidedMatches(tournament, groupId);
  const count = open ?? matches.length;
  const title = kind === 'openMatches'
    ? t('groupCompletion.notice.openMatches.title', { count: Math.max(count, 1) })
    : t(`groupCompletion.notice.${kind}.title`, withGroup(name));
  // @W2A-060: wer zuerst abgeschlossen bzw. entschieden hat – nur ein Eintrag, der nach dem Absenden neu ins Gerät kam
  // (Verlauf der Turnierleitung, Review #382 M2/M3); sonst der allgemeine Text
  const by = knownLogId === undefined || kind === 'openMatches' || kind === 'tableChanged'
    ? undefined
    : newGroupActor(tournament, groupId, kind === 'decidedElsewhere' ? 'standing_decision' : 'complete_group', knownLogId);
  const body = kind === 'openMatches'
    ? t('groupCompletion.notice.openMatches.body', withGroup(name, { matches: matches.map((m) => matchText(tournament, m)).join(', ') || '–' }))
    : kind === 'tableChanged'
      ? t('groupCompletion.notice.tableChanged.body', withGroup(name))
      : by !== undefined
        ? t(`groupCompletion.notice.${kind}.bodyBy`, withGroup(name, { by }))
        : t(`groupCompletion.notice.${kind}.body`, withGroup(name));
  const footer = (
    <Button variant="primary" size="lg" fullWidth style={{ minHeight: cssVars.touchTargets.primary }} onClick={api.close} data-primary data-testid={OK_ID[kind]}>
      {t('groupCompletion.dialog.understood')}
    </Button>
  );
  return (
    <GroupDialogShell title={t('groupCompletion.dialog.title', withGroup(name))} onClose={api.close} footer={footer} data-testid="group-notice-dialog" alert>
      <InlineNotice tone={TONE[kind]} data-testid={NOTICE_ID[kind]}>
        <span style={{ fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md }}>{title}</span>
        <p style={{ margin: 0 }}>{body}</p>
        {kind === 'openMatches' ? <p style={{ margin: 0 }}>{t('groupCompletion.notice.openMatches.hint')}</p> : null}
      </InlineNotice>
    </GroupDialogShell>
  );
};
