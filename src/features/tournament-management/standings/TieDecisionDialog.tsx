/**
 * Dialog „Gleichstand entscheiden“ (Paket TB-B, TB-6c; Mockup v3, Daniel G1, G2, G6; @ET-055, @W2A-044, @W2A-060 bis
 * @W2A-064, @W2A-067). Aus der Tabelle (Modus „table“) speichert der Dialog über `StandingDecisionService`; aus „Gruppe
 * abschließen“ (GA4 A-13c, Modus „withClose“) gibt er den geprüften Entwurf zurück. Zwei Teams: Ergebnis des
 * Strafstoßschießens, drei und mehr: Reihenfolge mit Grund. Ist der Platz nicht auszuspielen, steht daneben „Ergebnis so
 * akzeptieren“ – ein Tipp, ohne Grund, ohne Rückfrage. Mehr Datenbezug gibt es hier nicht: Wer/wann erst mit GA4 A-13b.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { cssVars, dialogWidths, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { Button } from '../../../components/ui/Button';
import { DialogActions } from '../../../components/ui/molecules/DialogActions';
import { DialogSurface } from '../../../components/ui/molecules/DialogSurface';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import type { Tournament } from '../../../types/tournament';
import type { DecisionDraft } from '../../../core/standings/decisions';
import { groupTieView, type OpenTieBlock } from '../../../core/standings/tieViews';
import { decidedTexts } from './decidedText';
import { ChoiceStep, OrderStep, ShootoutStep } from './TieDialogSteps';
import { stepText } from './tieStyles';
import { useStandingTie } from './standingTieContext';
import { useTieDraft, type TieDialogMode } from './useTieDraft';

export interface TieDecisionDialogProps {
  tournament: Tournament;
  block: OpenTieBlock;
  onClose: () => void;
  mode?: TieDialogMode;
  /** Modus „withClose“: bekommt den geprüften Entwurf statt eines Speicherns. */
  onDraft?: (draft: DecisionDraft) => void;
}

const bodyStack: CSSProperties = { display: 'grid', gap: cssVars.spacing.md, padding: `0 ${cssVars.spacing.md} ${cssVars.spacing.md}` };

export const TieDecisionDialog = ({ tournament, block, onClose, mode = 'table', onDraft }: TieDecisionDialogProps) => {
  const { t, i18n } = useTranslation('tournament');
  const tie = useStandingTie();
  const draft = useTieDraft({ tournament, block, mode, onDraft, onClose });
  const nameOf = (teamId: string): string => tournament.teams.find((team) => team.id === teamId)?.name ?? '';
  const { step } = draft;
  const titleKey = step === 'order' ? 'titleOrder' : step === 'shootout' ? 'titleShootout' : 'titleChoice';
  const title = step === 'seen' ? t('standingsTie.dialog.seen.title') : t(`standingsTie.dialog.${titleKey}`);

  const effect = useMemo(() => {
    if (draft.shootoutDraft === null) {
      return null;
    }
    const list = draft.shootoutDraft.order.map((teamId, i) => `${String(block.place + i)}. ${nameOf(teamId)}`).join(', ');
    return t('standingsTie.dialog.effect', { list });
    // nameOf liest nur `tournament.teams`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.shootoutDraft, block.place, tournament.teams, t]);

  const goRules = (): void => {
    onClose();
    tie?.openRules();
  };

  const current = useMemo(() => {
    const view = groupTieView(tournament, block.groupId);
    return view.decided.find((d) => block.teamIds.every((id) => d.decision.teamIds.includes(id)));
  }, [tournament, block]);

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.sm, padding: `${cssVars.spacing.md} ${cssVars.spacing.sm} ${cssVars.spacing.sm} ${cssVars.spacing.md}` }}>
      <h2 id="tie-dialog-title" style={{ margin: 0, fontSize: cssVars.fontSizes.xl, lineHeight: cssVars.lineHeights.title }}>{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('standingsTie.dialog.close')}
        data-testid="tie-dialog-close"
        style={{ width: cssVars.touchTargets.minimum, height: cssVars.touchTargets.minimum, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 0, color: cssVars.colors.textPrimary, cursor: 'pointer', flex: 'none' }}
      >
        <Icons.X size={iconSizeValues.sm} />
      </button>
    </div>
  );

  const cancel = { label: t(block.mayShare && step !== 'choice' && step !== 'seen' ? 'standingsTie.dialog.back' : 'standingsTie.dialog.cancel'), onClick: block.mayShare && step !== 'choice' && step !== 'seen' ? () => draft.setStep('choice') : onClose, 'data-testid': 'tie-dialog-cancel' };
  const footer = step === 'choice' ? (
    <Button variant="secondary" size="lg" fullWidth style={{ minHeight: cssVars.touchTargets.primary }} onClick={onClose} data-testid="tie-dialog-cancel">{t('standingsTie.dialog.cancel')}</Button>
  ) : step === 'seen' ? (
    <DialogActions primary={{ label: t('standingsTie.dialog.understood'), onClick: onClose, 'data-testid': 'tie-dialog-understood' }} />
  ) : (
    <DialogActions
      secondary={[cancel]}
      primary={{ label: t('standingsTie.dialog.save'), onClick: () => { void draft.submit(step === 'order' ? 'order' : 'shootout'); }, disabled: draft.busy || draft.needsNet || !draft.canSave, 'data-testid': 'tie-decision-save' }}
    />
  );

  const errorText = draft.error === null ? null : t(`standingsTie.dialog.errors.${draft.error}`);

  return (
    <DialogSurface isOpen onClose={onClose} labelledBy="tie-dialog-title" header={header} footer={footer} testId="tie-decision-dialog" maxWidth={dialogWidths.md}>
      <div style={bodyStack}>
        {step === 'choice' ? (
          <ChoiceStep
            block={block}
            nameOf={nameOf}
            busy={draft.busy}
            needsNet={draft.needsNet}
            onPick={() => draft.setStep(block.size === 2 ? 'shootout' : 'order')}
            onAccept={() => { void draft.submit('shared'); }}
          />
        ) : null}
        {step === 'shootout' ? (
          <ShootoutStep block={block} nameOf={nameOf} scores={draft.scores} onScore={draft.setScore} fieldError={draft.shootoutFieldError} effect={effect} onRules={goRules} />
        ) : null}
        {step === 'order' ? (
          <OrderStep block={block} nameOf={nameOf} order={draft.order} onMove={draft.move} reason={draft.reason} onReason={draft.setReason} onRules={goRules} />
        ) : null}
        {step === 'seen' ? (
          <>
            <InlineNotice tone="warn" data-testid="tie-seen">
              <span style={{ fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md }}>{t('standingsTie.dialog.seen.title')}</span>
              <p style={stepText}>{t('standingsTie.dialog.seen.body')}</p>
            </InlineNotice>
            {current !== undefined ? (
              <InlineNotice tone="info" data-testid="tie-seen-current">
                <span>{t('standingsTie.dialog.seen.current', { what: decidedTexts(t, i18n.language, current.decision, current, nameOf, true).heading })}</span>
              </InlineNotice>
            ) : null}
            <p style={stepText}>{t('standingsTie.dialog.seen.notSaved')}</p>
          </>
        ) : null}
        {draft.needsNet && step !== 'seen' ? (
          <p style={{ ...stepText, fontWeight: cssVars.fontWeights.semibold }} data-testid="tie-offline-hint">{t('standingsTie.dialog.errors.OFFLINE')}</p>
        ) : null}
        {errorText !== null ? <InlineNotice tone="error" data-testid="tie-error"><span>{errorText}</span></InlineNotice> : null}
      </div>
    </DialogSurface>
  );
};
