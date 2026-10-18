/**
 * NoticeLine – Meldezeile der Anzeigetafel (Cockpit-Spec § 7).
 *
 * Eine Zeile fester Höhe (24 px kompakt, 32 px ab Tablet), im Fluss, überlagert nichts. Höchstens eine
 * Meldung, in einer Zeile gekürzt mit „…“; der volle Text steht im Dokument und wird als `aria-live`
 * angesagt. Reine Anzeige: nur das optionale Kreuz ist antippbar (44 px Tippfläche, ragt über negativen
 * Rand aus der Zeile). Ohne Meldung bleibt die Zeile leer, behält aber ihre Höhe.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';

export interface NoticeLineProps {
  text: string | null;
  onClose?: () => void;
  closeLabel: string;
  testId?: string;
  /** `compact` 24 px (Handy), `regular` 32 px (ab Tablet). */
  size?: 'compact' | 'regular';
  /** Symbol vor dem Text (Farbe allein trägt keine Bedeutung). */
  icon?: ReactNode;
}

export function NoticeLine({ text, onClose, closeLabel, testId, size = 'compact', icon }: NoticeLineProps): ReactElement {
  const hoehe = size === 'regular' ? cssVars.sizing.noticeLineHeightRegular : cssVars.sizing.noticeLineHeightCompact;
  const zeile: CSSProperties = {
    position: 'relative',
    height: hoehe,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: `0 ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.md,
    background: text ? cssVars.colors.noticeLineBg : 'transparent',
    color: cssVars.colors.noticeLineText,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
  };
  const textStil: CSSProperties = { flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const kreuz: CSSProperties = {
    flex: 'none',
    minWidth: cssVars.touchTargets.minimum,
    minHeight: cssVars.touchTargets.minimum,
    margin: `calc(-1 * (${cssVars.touchTargets.minimum} - ${hoehe}) / 2) calc(-1 * ${cssVars.spacing.sm}) calc(-1 * (${cssVars.touchTargets.minimum} - ${hoehe}) / 2) 0`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 0,
    color: cssVars.colors.noticeLineText,
    cursor: 'pointer',
  };
  return (
    <div data-testid={testId} role="status" aria-live="polite" style={zeile}>
      {text !== null && icon !== undefined && <span aria-hidden="true" style={{ display: 'flex', flex: 'none' }}>{icon}</span>}
      {text !== null && <span style={textStil}>{text}</span>}
      {text !== null && onClose && (
        <button type="button" aria-label={closeLabel} onClick={onClose} style={kreuz} data-testid={testId ? `${testId}-close` : undefined}>
          <Icons.X size={iconSizeValues.sm} />
        </button>
      )}
    </div>
  );
}
