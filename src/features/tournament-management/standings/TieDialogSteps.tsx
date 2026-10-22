/**
 * Schritte des Entscheidungs-Dialogs (Paket TB-B, TB-6c; Mockup v3): Wahl (Strafstoßschießen/Reihenfolge oder „Ergebnis so
 * akzeptieren“, kein Grundfeld), Strafstoßschießen mit zwei Zahlenfeldern, Reihenfolge von drei und mehr Teams mit Grund.
 * Nur Darstellung; Zustand und Speichern liegen in `useTieDraft`.
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { OrderPicker } from '../../../components/ui/molecules/OrderPicker';
import { ShootoutScoreInput } from '../../../components/ui/molecules/ShootoutScoreInput';
import { DECISION_REASON_MAX_LENGTH } from '../../../core/standings/decisions';
import type { OpenTieBlock } from '../../../core/standings/tieViews';
import { listText, placeText } from './tieFormat';
import { useTiePlaceTexts } from './useTiePlaceTexts';
import { stepText } from './tieStyles';

const hint: CSSProperties = { margin: `${cssVars.spacing.sm} 0 0`, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd, color: cssVars.colors.textSecondary };
const strongHint: CSSProperties = { ...hint, color: cssVars.colors.textPrimary };

interface BlockProps {
  block: OpenTieBlock;
  nameOf: (teamId: string) => string;
}

/** Satz „Gleichauf auf Platz 3 und 4 nach allen Kriterien: A und B.“ */
export const TieContext = ({ block, nameOf, extra }: BlockProps & { extra?: string }) => {
  const { t, i18n } = useTranslation('tournament');
  const placeTexts = useTiePlaceTexts();
  const places = placeText(placeTexts, block.place, block.place + block.size - 1);
  return (
    <p style={stepText} data-testid="tie-dialog-context">
      {t('standingsTie.dialog.context', { places, names: listText(block.teamIds.map(nameOf), i18n.language) })}
      {extra !== undefined ? ` ${extra}` : ''}
    </p>
  );
};

/** Warum es nur das Strafstoßschießen gibt (Daniel G2): der Grund, bei „Einstellung“ mit Sprung in die Turnierregeln. */
export const WhyOnly = ({ block, onRules }: { block: OpenTieBlock; onRules: () => void }) => {
  const { t } = useTranslation('tournament');
  const reason = block.mandatory;
  if (reason === undefined) {
    return null;
  }
  return (
    <InlineNotice tone="info" data-testid="tie-why">
      <span style={{ fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md }}>{t('standingsTie.dialog.whyTitle')}</span>
      <p style={stepText}>{reason.kind === 'setting' ? t('standingsTie.notice.needSetting', { place: reason.place }) : t('standingsTie.notice.needFollowUp', { place: reason.place })}</p>
      {reason.kind === 'setting' ? <Button variant="secondary" size="md" fullWidth onClick={onRules} data-testid="tie-open-rules">{t('standingsTie.dialog.whyRules')}</Button> : null}
    </InlineNotice>
  );
};

export interface ChoiceStepProps extends BlockProps {
  busy: boolean;
  needsNet: boolean;
  onPick: () => void;
  onAccept: () => void;
}

/** Wahl: „Strafstoßschießen eintragen“ (bzw. „Reihenfolge festlegen“) als Normalweg, daneben „Ergebnis so akzeptieren“. */
export const ChoiceStep = ({ block, nameOf, busy, needsNet, onPick, onAccept }: ChoiceStepProps) => {
  const { t, i18n } = useTranslation('tournament');
  const placeTexts = useTiePlaceTexts();
  const places = placeText(placeTexts, block.place, block.place + block.size - 1);
  const two = block.size === 2;
  const group: CSSProperties = { display: 'grid', gap: cssVars.spacing.md };
  const primary: CSSProperties = { minHeight: cssVars.touchTargets.primary };
  return (
    <>
      <TieContext block={block} nameOf={nameOf} extra={t('standingsTie.dialog.contextNoPlay', { places })} />
      <div style={{ ...group, marginTop: cssVars.spacing.md }} role="group" aria-label={t('standingsTie.dialog.choiceGroup')}>
        <div>
          <Button variant="primary" size="lg" fullWidth style={primary} onClick={onPick} data-primary data-testid="tie-pick-shootout">
            {two ? t('standingsTie.notice.shootout') : t('standingsTie.notice.order')}
          </Button>
          <p style={hint}>{two ? t('standingsTie.dialog.shootoutHint') : t('standingsTie.dialog.orderHint')}</p>
        </div>
        <div>
          <Button variant="secondary" size="lg" fullWidth style={primary} disabled={busy || needsNet} onClick={onAccept} data-testid="tie-accept-result">
            {t('standingsTie.dialog.accept')}
          </Button>
          <p style={strongHint}>
            {t('standingsTie.dialog.acceptHint', { names: listText(block.teamIds.map(nameOf), i18n.language), places: t('standingsTie.places.one', { from: block.place }), next: block.place + block.size })}
          </p>
        </div>
      </div>
    </>
  );
};

export interface ShootoutStepProps extends BlockProps {
  scores: readonly [string, string];
  onScore: (index: 0 | 1, value: string) => void;
  fieldError: { a: string; b: string } | null;
  effect: string | null;
  onRules: () => void;
}

export const ShootoutStep = ({ block, nameOf, scores, onScore, fieldError, effect, onRules }: ShootoutStepProps) => {
  const { t } = useTranslation('tournament');
  const [a, b] = block.teamIds;
  return (
    <>
      <TieContext block={block} nameOf={nameOf} />
      {!block.mayShare ? <WhyOnly block={block} onRules={onRules} /> : null}
      <ShootoutScoreInput
        legend={t('standingsTie.dialog.shootoutLegend')}
        hitsLabel={t('standingsTie.dialog.hits')}
        sides={[{ id: a, name: nameOf(a) }, { id: b, name: nameOf(b) }]}
        values={scores}
        onChange={onScore}
        error={fieldError === null ? undefined : t('standingsTie.dialog.needWinner', fieldError)}
        hint={t('standingsTie.dialog.shootoutInfo')}
      />
      {effect !== null && fieldError === null ? <InlineNotice tone="info" data-testid="tie-effect"><span>{effect}</span></InlineNotice> : null}
    </>
  );
};

export interface OrderStepProps extends BlockProps {
  order: readonly string[];
  onMove: (index: number, direction: -1 | 1) => void;
  reason: string;
  onReason: (value: string) => void;
  onRules: () => void;
  /** Kennung des Grund-Feldes (Standard `tie-reason`; im Abschluss `group-close-reason`). */
  reasonTestId?: string;
}

export const OrderStep = ({ block, nameOf, order, onMove, reason, onReason, onRules, reasonTestId = 'tie-reason' }: OrderStepProps) => {
  const { t } = useTranslation('tournament');
  const area: CSSProperties = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: `calc(${cssVars.touchTargets.primary} + ${cssVars.spacing.sm})`,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    font: 'inherit',
    fontSize: cssVars.fontSizes.lg, // Eingabefelder mindestens 16 px
    lineHeight: cssVars.lineHeights.bodyLg,
    color: cssVars.colors.textPrimary,
    background: cssVars.colors.background,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    resize: 'vertical',
  };
  const label: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: cssVars.spacing.sm, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md, marginBottom: cssVars.spacing.xs };
  return (
    <>
      <TieContext block={block} nameOf={nameOf} />
      {!block.mayShare ? <WhyOnly block={block} onRules={onRules} /> : null}
      <OrderPicker
        legend={t('standingsTie.dialog.orderLegend')}
        items={order.map((teamId) => ({ id: teamId, label: nameOf(teamId) }))}
        firstPlace={block.place}
        onMove={onMove}
        moveUpLabel={(name) => t('standingsTie.dialog.moveUp', { name })}
        moveDownLabel={(name) => t('standingsTie.dialog.moveDown', { name })}
      />
      <p style={hint}>{t('standingsTie.dialog.orderAfter')}</p>
      <div>
        <div style={label}>
          <label htmlFor="tie-reason">{t('standingsTie.dialog.reasonLabel')}</label>
          <span style={{ color: cssVars.colors.textSecondary, fontWeight: cssVars.fontWeights.normal, fontSize: cssVars.fontSizes.sm }}>
            {t('standingsTie.dialog.reasonCount', { count: reason.length, max: DECISION_REASON_MAX_LENGTH })}
          </span>
        </div>
        <textarea
          id="tie-reason"
          data-testid={reasonTestId}
          style={area}
          value={reason}
          maxLength={DECISION_REASON_MAX_LENGTH}
          required
          aria-describedby="tie-reason-hint"
          onChange={(e) => onReason(e.target.value)}
        />
        <p id="tie-reason-hint" style={strongHint}>{t('standingsTie.dialog.reasonHint')}</p>
      </div>
    </>
  );
};
