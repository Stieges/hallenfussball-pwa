/**
 * MatchChoiceDialog (@SL-193): „Schiedsrichter ändern“ und „Feld ändern“ direkt am Spiel, eine Auswahl mit „Übernehmen“.
 * Die Änderung selbst (Sperre für angepfiffene Spiele @ZP-093, Konflikte) liegt im Handler des Spielplans.
 */
import { useId, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, dialogWidths } from '../../../design-tokens';
import { Select } from '../../ui/Select';
import { DialogActions } from '../../ui/molecules/DialogActions';
import { DialogSurface } from '../../ui/molecules/DialogSurface';

export type MatchChoiceKind = 'referee' | 'field';

export interface MatchChoiceOption {
  /** `''` = keiner (nur beim Schiedsrichter) */
  value: string;
  label: string;
}

export interface MatchChoiceDialogProps {
  kind: MatchChoiceKind;
  matchNumber: number | undefined;
  options: readonly MatchChoiceOption[];
  /** aktueller Wert, `''` = keiner */
  current: string;
  onApply: (value: string) => void;
  onClose: () => void;
}

const bodyStyle: CSSProperties = { padding: cssVars.spacing.lg, display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const titleStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };

export function MatchChoiceDialog({ kind, matchNumber, options, current, onApply, onClose }: MatchChoiceDialogProps) {
  const { t } = useTranslation('tournament');
  const [value, setValue] = useState(current);
  const titleId = useId();
  const number = matchNumber ?? '?';
  return (
    <DialogSurface isOpen onClose={onClose} maxWidth={dialogWidths.sm} labelledBy={titleId} testId={`match-choice-${kind}`}>
      <div style={bodyStyle}>
        <h2 id={titleId} style={titleStyle}>{t(kind === 'referee' ? 'actionMenu.choose.refereeTitle' : 'actionMenu.choose.fieldTitle', { number })}</h2>
        <Select
          label={t(kind === 'referee' ? 'actionMenu.choose.refereeLabel' : 'actionMenu.choose.fieldLabel')}
          value={value}
          options={[...options]}
          onChange={setValue}
          data-testid={`match-choice-${kind}-select`}
        />
        <DialogActions
          secondary={[{ label: t('actionMenu.choose.cancel'), onClick: onClose, 'data-testid': `match-choice-${kind}-cancel` }]}
          primary={{ label: t('actionMenu.choose.save'), onClick: () => { onApply(value); }, 'data-testid': `match-choice-${kind}-apply` }}
        />
      </div>
    </DialogSurface>
  );
}
