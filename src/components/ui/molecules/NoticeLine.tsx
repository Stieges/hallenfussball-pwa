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
  /**
   * Reservierte Zeilen. 1 (Vorgabe): eine Zeile, lange Texte gekürzt mit „…“. 2 oder 3: dauerhaft so viele Zeilen hoch, der Text bricht
   * um und wird nie gekürzt – am Handy (Meldungen mit Teamnamen sind länger als eine Zeile; 3 bei langen Namen) (Namen nie mit „…“, VISUAL-DESIGN § 1).
   */
  zeilen?: 1 | 2 | 3;
  /**
   * `einblendung` (Laptop-Tafel, @SL-180): die Meldung blendet sich über die Kopfzeile der Tafel ein, ohne Platz zu reservieren und ohne zu verschieben;
   * der Text bricht um (nie „…“), der Rand zeigt die Stufe (Farbe allein trägt nichts: das Symbol steht davor). Ohne Meldung bleibt nur der leere
   * Bereich für die Ansage (`aria-live`).
   */
  art?: 'zeile' | 'einblendung';
  /** Stufe der Meldung für den Rand der Einblendung: 3 Bestätigung (grün), 2 Warnung, 1 Hinweis. */
  stufe?: 1 | 2 | 3;
}

export function NoticeLine({ text, onClose, closeLabel, testId, size = 'compact', icon, zeilen = 1, art = 'zeile', stufe = 3 }: NoticeLineProps): ReactElement {
  const einzeilig = size === 'regular' ? cssVars.sizing.noticeLineHeightRegular : cssVars.sizing.noticeLineHeightCompact;
  // mehrzeilig: drei Zeilen der kleinen Zeilenhöhe plus der Abstand, den die einzeilige Zeile über ihre Schrift hinaus hat
  const hoehe = zeilen === 1 ? einzeilig : `calc(${zeilen} * ${cssVars.lineHeights.bodySm} + ${cssVars.spacing.xs})`;
  const einblendung = art === 'einblendung';
  const randFarbe = stufe === 3 ? cssVars.colors.scoreboardOk : stufe === 2 ? cssVars.colors.scoreboardHighlight : cssVars.colors.scoreboardInfo;
  const zeile: CSSProperties = einblendung ? {
    position: 'relative', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm,
    // ohne Meldung ein leerer Bereich ohne Höhe (der Ansagebereich bleibt im Baum, `aria-live` sagt die nächste Meldung an)
    ...(text ? { minHeight: einzeilig, padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`, border: `${cssVars.borderWidth.thin} solid ${randFarbe}` } : { height: 0, overflow: 'hidden' }),
    borderRadius: cssVars.borderRadius.md,
    // deckend, damit die Kopfzeile darunter nicht durchscheint: Meldefläche über dem Grund der Tafel
    background: `linear-gradient(${cssVars.colors.noticeLineBg}, ${cssVars.colors.noticeLineBg}), ${cssVars.colors.scoreboardBg}`,
    color: cssVars.colors.noticeLineText, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold, lineHeight: cssVars.lineHeights.bodyMd,
  } : {
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
  const textStil: CSSProperties = einblendung
    ? { flex: 1, minWidth: 0, whiteSpace: 'normal', overflowWrap: 'break-word' }
    : zeilen === 1
    ? { flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
    : { flex: 1, minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: cssVars.lineHeights.bodySm };
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
    <div data-testid={testId} data-zeilen={zeilen} role="status" aria-live="polite" style={zeile}>
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
