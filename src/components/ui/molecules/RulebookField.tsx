/**
 * RulebookField – Eingabefeld „Regelwerk“ (@DR-016), gemeinsam für Wizard Schritt 3 und Admin-Center.
 *
 * Höchstens RULEBOOK_MAX_LENGTH Zeichen. Kein natives maxLength am input: der Browser würde überlange
 * Eingaben (Einfügen, Tippen) vor dem input-Event kürzen, dann bliebe der Kürzungshinweis tot.
 * Stattdessen kürzt `handleChange` und meldet die Kürzung. Leer → `undefined` (nicht ""), damit kein
 * leeres Feld gespeichert wird. Alle Texte kommen vom Aufrufer (i18n-Namespace des Aufrufers).
 */
import { useId, useState, type CSSProperties } from 'react';
import { Input } from '../Input';
import { cssVars } from '../../../design-tokens';
import { RULEBOOK_MAX_LENGTH } from '../../../constants/rulebook';

export interface RulebookFieldProps {
  label: string;
  placeholder: string;
  /** Hinweis unter dem Feld, z. B. „Höchstens 80 Zeichen.“ */
  limitHint: string;
  /** Hinweis, wenn eine Eingabe gekürzt wurde. */
  truncatedHint: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  testId?: string;
  style?: CSSProperties;
}

export function RulebookField({
  label,
  placeholder,
  limitHint,
  truncatedHint,
  value,
  onChange,
  testId,
  style,
}: RulebookFieldProps) {
  const [truncated, setTruncated] = useState(false);
  const hintId = useId();
  const statusId = useId();
  const current = value ?? '';

  const handleChange = (raw: string) => {
    const next = raw.slice(0, RULEBOOK_MAX_LENGTH);
    setTruncated(raw.length > RULEBOOK_MAX_LENGTH);
    onChange(next.trim() === '' ? undefined : next);
  };

  return (
    <div style={style}>
      <Input
        label={label}
        value={current}
        onChange={handleChange}
        placeholder={placeholder}
        describedBy={`${hintId} ${statusId}`}
        data-testid={testId}
      />
      <div
        id={hintId}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: cssVars.spacing.sm,
          marginTop: cssVars.spacing.xs,
          fontSize: cssVars.fontSizes.sm,
          color: cssVars.colors.textSecondary,
        }}
      >
        <span>{limitHint}</span>
        <span>{`${current.length}/${RULEBOOK_MAX_LENGTH}`}</span>
      </div>
      <div
        id={statusId}
        role="status"
        style={{
          marginTop: cssVars.spacing.xs,
          fontSize: cssVars.fontSizes.sm,
          color: cssVars.colors.warning,
        }}
      >
        {truncated ? truncatedHint : ''}
      </div>
    </div>
  );
}
