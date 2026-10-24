/**
 * Zeigt den Dialog zum aktuellen Schritt des Ablaufs (GA4 A-13c): Gleichstand entscheiden (Dialog TB-B im Modus „mit Abschluss“),
 * Abschluss bestätigen, Meldung, Wiederöffnen. Genau ein Dialog zur Zeit; er hängt am Anbieter, nicht an einer Ansicht.
 */
import { groupNameOf } from './completionTexts';
import { GroupConfirmDialog } from './GroupConfirmDialog';
import { GroupNoticeDialog } from './GroupNoticeDialog';
import { GroupReopenDialog } from './GroupReopenDialog';
import { TieDecisionDialog } from '../standings/TieDecisionDialog';
import type { GroupCompletionApi } from './useGroupCompletion';
import { everCompleted } from '../../../core/standings/groupCompletions';

export const GroupCompletionDialogs = ({ api }: { api: GroupCompletionApi }) => {
  const { flow, tournament } = api;
  switch (flow.step) {
  case 'idle':
    return null;
  case 'tie': {
    const block = flow.blocks[0];
    return (
      <TieDecisionDialog
        key={block.teamIds.join('|')}
        tournament={tournament}
        block={block}
        mode="withClose"
        closeFlow={{ name: groupNameOf(tournament, flow.groupId), again: everCompleted(tournament, flow.groupId) }}
        onDraft={api.acceptDraft}
        onClose={api.dismissTie}
      />
    );
  }
  case 'confirm':
    return <GroupConfirmDialog api={api} groupId={flow.groupId} plan={flow.plan} busy={flow.busy} error={flow.error} />;
  case 'notice':
    return <GroupNoticeDialog api={api} groupId={flow.groupId} kind={flow.kind} {...(flow.open !== undefined ? { open: flow.open } : {})} {...(flow.knownLogId !== undefined ? { knownLogId: flow.knownLogId } : {})} />;
  case 'reopen':
    return <GroupReopenDialog api={api} groupId={flow.groupId} reason={flow.reason} busy={flow.busy} error={flow.error} />;
  }
};
