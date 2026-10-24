/**
 * Hinweise einer Gruppentabelle bei Gleichstand (Paket TB-B, TB-6b/c): je offenem Block ein Hinweis mit Taste, je
 * entschiedenem Block das Ergebnis mit „zurücknehmen“. Die Tabelle selbst ist die einzige Quelle (`groupTieView`); wer
 * entscheiden darf und der Dienst kommen aus `StandingTieContext`. Ohne Anbieter erscheinen nur Texte, keine Tasten.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import { decidedBy, withdrawalOfBlock } from '../../../core/standings/decisionLog';
import { groupTieView, type OpenTieBlock } from '../../../core/standings/tieViews';
import { DecidedInfo } from './DecidedInfo';
import { OpenTieNotice } from './OpenTieNotice';
import { TieDecisionDialog } from './TieDecisionDialog';
import { useGroupCompletionUi } from '../group-completion/groupCompletionContext';
import { useStandingTie } from './standingTieContext';

export interface TieGroupHintProps {
  tournament: Tournament;
  /** Gruppenbuchstabe, `''` bei Jeder gegen jeden. */
  groupId: string;
}

const list: CSSProperties = { display: 'grid', gap: cssVars.spacing.sm, marginBottom: cssVars.spacing.md };

export const TieGroupHint = ({ tournament, groupId }: TieGroupHintProps) => {
  const { t } = useTranslation('tournament');
  const tie = useStandingTie();
  const view = useMemo(() => groupTieView(tournament, groupId), [tournament, groupId]);
  const [dialogBlock, setDialogBlock] = useState<OpenTieBlock | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});
  const completion = useGroupCompletionUi();
  const nameOf = (teamId: string): string => tournament.teams.find((team) => team.id === teamId)?.name ?? '';
  const canDecide = tie?.canDecide ?? false;
  // Ein Kasten, eine Haupttaste (Daniel 23.10., VISUAL-DESIGN § 8): sind alle Gruppenspiele entschieden, trägt der Kasten „Gruppe
  // abschließen“ oben die Entscheidung („Gleichstand entscheiden“ / „Strafstoßschießen eintragen“) – der eigene Hinweis entfällt dann.
  const inBanner = completion !== null && completion.canManage
    && (completion.proposals.includes(groupId) || completion.staleGroups.includes(groupId));
  const openBlocks = canDecide && inBanner ? [] : view.open;

  if (openBlocks.length === 0 && view.decided.length === 0) {
    return null;
  }

  const withdraw = async (decisionId: string): Promise<void> => {
    if (tie === null) {
      return;
    }
    setBusyId(decisionId);
    setFailed(({ [decisionId]: _drop, ...rest }) => rest);
    try {
      const result = await tie.service.withdraw(tournament.id, decisionId);
      if (result.ok) {
        tie.onChanged();
      } else {
        const message = result.code === 'OFFLINE' ? t('standingsTie.decided.withdrawOffline') : t('standingsTie.decided.withdrawFailed');
        setFailed((current) => ({ ...current, [decisionId]: message }));
      }
    } catch {
      setFailed((current) => ({ ...current, [decisionId]: t('standingsTie.decided.withdrawFailed') })); // Netz- oder Serverfehler: nie still
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={list} data-testid="tie-hints">
      {openBlocks.map((block) => (
        <OpenTieNotice
          key={block.teamIds.join('|')}
          block={block}
          names={block.teamIds.map(nameOf)}
          canDecide={canDecide}
          online={tie?.online ?? true}
          withdrawn={canDecide ? withdrawalOfBlock(tournament, block.teamIds) : undefined}
          onEntry={() => setDialogBlock(block)}
        />
      ))}
      {view.decided.map((block) => (
        <DecidedInfo
          key={block.decision.id}
          block={block}
          nameOf={nameOf}
          canDecide={canDecide}
          author={canDecide ? decidedBy(tournament, block.decision.id) : undefined}
          closed={view.closed}
          busy={busyId === block.decision.id}
          failed={failed[block.decision.id] ?? null}
          onWithdraw={() => { void withdraw(block.decision.id); }}
        />
      ))}
      {dialogBlock !== null && tie !== null ? (
        <TieDecisionDialog tournament={tournament} block={dialogBlock} onClose={() => setDialogBlock(null)} />
      ) : null}
    </div>
  );
};
