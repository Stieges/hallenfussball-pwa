/**
 * ApproveSheet – Zulassen-Blatt (A-18a, Mockup M4 `r4`/`r4b`, S-1, @HE-001, @HE-040, @HE-105): Tipp 1 „Zulassen“ in der Zeile
 * öffnet es, Tipp 2 wählt das Feld (ohne Tipp bleibt die letzte Wahl), Tipp 3 ist die Zahl: Olli tippt die Zahl, die das Handy
 * der Person zeigt – eine von vier Zahlknöpfen. Der Zahlknopf IST das Zulassen; es gibt keine zweite Taste und keine grüne
 * Haupttaste. Die richtige Zahl wird nicht hervorgehoben. Der Server prüft die Zahl: bei einer falschen ändert sich nichts, das
 * Blatt bleibt offen und sagt „Zahl stimmt nicht – frag nach der Zahl auf dem Handy“ (rot, Symbol + Wort).
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../../../components/dialogs/Dialog';
import { Button } from '../../../../components/ui/Button';
import { InlineNotice } from '../../../../components/ui/molecules/InlineNotice';
import { NumberChoiceRow } from '../../../../components/ui/molecules/NumberChoiceRow';
import { SegmentedChoice } from '../../../../components/ui/molecules/SegmentedChoice';
import { cssVars } from '../../../../design-tokens';
import { noticeText, noticeTitle } from './noticeStyles';
import { checkNumberChoices, formatClock, type JoinRequestRow } from './helperAdminModel';
import type { HelperActionOutcome } from './useHelperAdminActions';

export interface ApproveSheetProps {
  request: JoinRequestRow;
  /** Anzahl der Felder des Turniers (Feld 1 bis n). */
  fieldCount: number;
  /** Zuletzt gewähltes Feld (`null` = ohne Feld): bleibt stehen, wenn Olli nichts antippt. */
  initialField: number | null;
  onFieldChange: (field: number | null) => void;
  onApprove: (requestId: string, checkNumber: number, field: number | null) => Promise<HelperActionOutcome>;
  onClose: () => void;
  busy: boolean;
}

const NONE = 'none';
const stack: CSSProperties = { display: 'grid', gap: cssVars.spacing.md };
const nameStyle: CSSProperties = { margin: 0, fontWeight: cssVars.fontWeights.bold, fontSize: cssVars.fontSizes.lg, lineHeight: cssVars.lineHeights.title, overflowWrap: 'break-word', color: cssVars.colors.textPrimary };
const ctx: CSSProperties = { margin: 0, color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.md };
const footer: CSSProperties = { display: 'grid', padding: cssVars.spacing.md };

export const ApproveSheet = ({ request, fieldCount, initialField, onFieldChange, onApprove, onClose, busy }: ApproveSheetProps) => {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language === 'en' ? 'en-GB' : 'de-DE';
  const [field, setField] = useState<string>(initialField === null ? NONE : String(initialField));
  const [mismatch, setMismatch] = useState(false);
  const choices = useMemo(() => checkNumberChoices(request.id, request.checkNumber), [request.id, request.checkNumber]);
  const name = request.name.trim();

  const options = [
    ...Array.from({ length: fieldCount }, (_, i) => ({ value: String(i + 1), label: t('teamHelpers.approve.fieldN', { field: i + 1 }) })),
    { value: NONE, label: t('teamHelpers.approve.fieldNone') },
  ];

  const choose = async (checkNumber: number) => {
    setMismatch(false);
    const outcome = await onApprove(request.id, checkNumber, field === NONE ? null : Number(field));
    if (outcome === 'checkMismatch') {
      setMismatch(true);
      return;
    }
    onClose();
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={t('teamHelpers.approve.title', { name })}
      footer={(
        <div style={footer}>
          <Button variant="secondary" size="lg" onClick={onClose} style={{ minHeight: cssVars.touchTargets.primary }} data-testid="approve-cancel">
            {t('teamHelpers.approve.cancel')}
          </Button>
        </div>
      )}
    >
      <div style={stack} data-testid="approve-sheet">
        <div>
          <p style={nameStyle} data-teamname>{name}</p>
          <p style={ctx}>{t('teamHelpers.approve.intro', { time: formatClock(request.createdAt, locale) })}</p>
        </div>
        {mismatch ? (
          <InlineNotice tone="error" data-testid="check-number-mismatch">
            <b style={noticeTitle}>{t('teamHelpers.approve.mismatchTitle')}</b>
            <span style={noticeText}>{t('teamHelpers.approve.mismatchText')}</span>
          </InlineNotice>
        ) : null}
        <SegmentedChoice
          legend={t('teamHelpers.approve.fieldLegend', { name })}
          hint={t('teamHelpers.approve.fieldHint', { name })}
          options={options}
          value={field}
          disabled={busy}
          testId="approve-field"
          onChange={(value) => {
            setField(value);
            onFieldChange(value === NONE ? null : Number(value));
          }}
        />
        <NumberChoiceRow
          legend={t('teamHelpers.approve.numberLegend')}
          hint={t('teamHelpers.approve.numberHint', { name })}
          values={choices}
          disabled={busy}
          valueLabel={(n) => t('teamHelpers.approve.numberLabel', { number: n })}
          testId="approve-number"
          onChoose={(n) => { void choose(n); }}
        />
      </div>
    </Dialog>
  );
};
