/**
 * EventNumberField (C3b-1, G5): Rueckennummer-Feld des Bearbeiten-Dialogs als eigene Unterkomponente.
 * `lockedReason` sperrt das Feld (Helfer nach dem Abpfiff bei bereits gesetzter Nummer) und zeigt den
 * Grund an -- die Entscheidung trifft der Aufrufer (`canAmendField` im Hook).
 */
import { cssVars } from '../../../../design-tokens';

interface EventNumberFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Gesetzt = Feld gesperrt; der Text erklaert warum. */
  lockedReason?: string;
}

const QUICK_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function EventNumberField({ value, onChange, lockedReason }: EventNumberFieldProps) {
  const locked = lockedReason !== undefined;
  return (
    <div style={styles.inputSection}>
      <label style={styles.inputLabel} htmlFor="event-edit-number">Rückennummer</label>
      <div style={styles.inputContainer}>
        <input
          id="event-edit-number"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="#"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={styles.numberInput}
          autoFocus
          min={1}
          max={99}
          disabled={locked}
          data-testid="event-edit-number"
        />
      </div>

      {locked && (
        <p style={styles.lockedText} data-testid="event-edit-locked" role="status">{lockedReason}</p>
      )}

      <div style={styles.quickNumbers}>
        {QUICK_NUMBERS.map((num) => (
          <button
            key={num}
            type="button"
            disabled={locked}
            style={{
              ...styles.quickNumberButton,
              opacity: locked ? 0.5 : 1,
              cursor: locked ? 'not-allowed' : 'pointer',
              backgroundColor: value === String(num) ? cssVars.colors.primaryLight : cssVars.colors.surface,
              borderColor: value === String(num) ? cssVars.colors.primary : 'transparent',
            }}
            onClick={() => onChange(String(num))}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  inputSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  },
  inputLabel: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    fontWeight: 500,
  },
  inputContainer: {
    display: 'flex',
    justifyContent: 'center',
  },
  numberInput: {
    width: 100,
    height: 64,
    fontSize: cssVars.fontSizes.xxl,
    fontWeight: 700,
    textAlign: 'center',
    backgroundColor: cssVars.colors.surface,
    border: `2px solid ${cssVars.colors.borderDefault}`,
    borderRadius: cssVars.borderRadius.lg,
    color: cssVars.colors.textPrimary,
    outline: 'none',
  },
  lockedText: {
    margin: 0,
    textAlign: 'center',
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.warning,
  },
  quickNumbers: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: cssVars.spacing.sm,
  },
  quickNumberButton: {
    height: 44,
    fontSize: cssVars.fontSizes.md,
    fontWeight: 600,
    color: cssVars.colors.textPrimary,
    backgroundColor: cssVars.colors.surface,
    border: '2px solid transparent',
    borderRadius: cssVars.borderRadius.md,
    transition: 'all 0.15s ease',
  },
};
