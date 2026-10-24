/**
 * Altersklasse wählen (Record Wizard-Regelprofile @W2B-010, @W2B-022 bis @W2B-026; Mockup Variante B2).
 * Oben der Umschalter der Schreibweise (Jugend / U-Klassen / Erwachsene), darunter eine wischbare Chip-Reihe mit den
 * Einträgen dieser Schreibweise und „Sonstiges …“ für freien Text, bei der Jugend darunter die Stufe 1 bis 3. Das Feld
 * startet leer und ist freiwillig; gespeichert wird ein einziger Text, gedruckt wird er genau so.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../design-tokens';
import { Input } from './ui/Input';
import { ChipChoice, InlineNotice, SegmentedChoice } from './ui/molecules';
import {
  AGE_LEVELS,
  ageClassText,
  ageGroupsFor,
  composeAgeClass,
  parseAgeClass,
  type AgeGroupId,
  type AgeLevel,
} from '../core/view';
import { readLastAgeGroup, writeLastAgeGroup } from './ageClassPickerStorage';

export interface AgeClassPickerProps {
  value: string;
  onChange: (value: string) => void;
  sport?: 'football' | 'other';
  testId?: string;
}

const CUSTOM_CHIP = 'custom';
const CUSTOM_MAX_LENGTH = 40;

export function AgeClassPicker({ value, onChange, sport = 'football', testId = 'age-class' }: AgeClassPickerProps) {
  const { t } = useTranslation('wizard');
  const groups = ageGroupsFor(sport);
  const parsed = parseAgeClass(value, sport);

  const [group, setGroup] = useState<AgeGroupId>(() => {
    const preferred = parsed.kind === 'entry' ? parsed.group : readLastAgeGroup();
    return groups.find((candidate) => candidate.id === preferred)?.id ?? groups[0].id;
  });
  const [custom, setCustom] = useState(parsed.kind === 'custom');
  // Ein Wert außerhalb der Liste, der beim Öffnen schon da war, bleibt unverändert und wird erklärt (@W2B-026).
  const [adopted] = useState(parsed.kind === 'custom' ? parsed.text : '');

  const current = groups.find((candidate) => candidate.id === group) ?? groups[0];
  const entry = !custom && parsed.kind === 'entry' && current.entries.includes(parsed.entry) ? parsed.entry : null;
  const level: AgeLevel | null = entry && parsed.kind === 'entry' ? parsed.level : null;
  const shown = ageClassText(value);

  const switchGroup = (next: AgeGroupId) => {
    setGroup(next);
    // Eine Wahl aus der anderen Schreibweise wäre unsichtbar: sie wird aufgehoben, „Sonstiges …“ bleibt.
    if (!custom && value !== '') {
      onChange('');
    }
  };

  const selectEntry = (chip: string) => {
    if (chip === CUSTOM_CHIP) {
      setCustom(!custom);
      onChange('');
      return;
    }
    setCustom(false);
    if (chip === entry) {
      onChange('');
      return;
    }
    writeLastAgeGroup(group);
    onChange(composeAgeClass(chip, current.hasLevel ? level : null));
  };

  const selectLevel = (next: AgeLevel) => {
    if (entry) {
      onChange(composeAgeClass(entry, level === next ? null : next));
    }
  };

  const chips = [
    ...current.entries.map((name) => ({ value: name, label: name })),
    { value: CUSTOM_CHIP, label: t('ageClassPicker.custom') },
  ];

  return (
    <div style={{ display: 'grid', gap: cssVars.spacing.sm }} data-testid={testId}>
      <SegmentedChoice
        legend={t('ageClassPicker.label')}
        options={groups.map((candidate) => ({ value: candidate.id, label: t(`ageClassPicker.groups.${candidate.id}`) }))}
        value={group}
        onChange={switchGroup}
        testId={`${testId}-group`}
        compact
      />
      <ChipChoice
        legend={t('ageClassPicker.entriesLabel', { group: t(`ageClassPicker.groups.${current.id}`) })}
        options={chips}
        value={custom ? CUSTOM_CHIP : entry}
        onSelect={selectEntry}
        testId={`${testId}-chip`}
      />
      {current.hasLevel && entry ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm }}>
          <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.md }}>{t('ageClassPicker.level')}</span>
          <ChipChoice
            legend={t('ageClassPicker.level')}
            options={AGE_LEVELS.map((n) => ({ value: String(n), label: String(n) }))}
            value={level === null ? null : String(level)}
            onSelect={(chosen) => selectLevel(Number(chosen) as AgeLevel)}
            testId={`${testId}-level`}
          />
        </div>
      ) : null}
      {custom ? (
        <Input
          label={t('ageClassPicker.customLabel')}
          value={value}
          maxLength={CUSTOM_MAX_LENGTH}
          onChange={(text) => {
            onChange(text);
            if (text.trim() !== '') {
              writeLastAgeGroup(group);
            }
          }}
          data-testid={`${testId}-custom-input`}
        />
      ) : null}
      {custom && adopted !== '' ? (
        <InlineNotice tone="info" data-testid={`${testId}-adopted`}>
          {t('ageClassPicker.adopted', { value: adopted })}
        </InlineNotice>
      ) : null}
      <p
        data-testid={`${testId}-preview`}
        style={{
          margin: 0,
          padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
          border: `${cssVars.borderWidth.thin} dashed ${cssVars.colors.borderControl}`,
          borderRadius: cssVars.borderRadius.md,
          fontSize: cssVars.fontSizes.md,
          color: cssVars.colors.textPrimary,
        }}
      >
        {shown === '' ? t('ageClassPicker.previewEmpty') : (
          <>
            <span style={{ display: 'block' }}>{t('ageClassPicker.previewLead')}</span>
            <strong>{shown}</strong>
          </>
        )}
      </p>
    </div>
  );
}
