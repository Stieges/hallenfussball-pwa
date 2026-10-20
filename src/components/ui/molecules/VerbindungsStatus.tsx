/**
 * VerbindungsStatus – Zustand der Verbindung (Plan LT-2, @SL-140, @SL-168).
 *
 * Zustandspunkt + Wort („Online“/„Offline“), nie Farbe allein (WCAG 1.4.1). Ohne Netz optional „N Einträge warten“ und der Knopf
 * „Verbinden“ (nur wenn `onVerbinden` übergeben ist); nach der Rückkehr kurz „Wieder verbunden“ (`wiederVerbunden`).
 * Höhe: Der Knopf ist das einzige Element über der Mindest-Tippfläche und bekommt keinen Rahmen aus Innenabstand – die Anzeige
 * ist nie höher als `touchTargets.minimum`, damit ein schmaler Kopf beim Wechsel Online/Offline nicht wächst und nichts springt.
 * Die Variante `kompakt` (Handy) zeigt mit Netz nur den Punkt, ohne Netz EINE Pille als Knopf (oben „Verbinden“, darunter klein
 * „Offline“ und die wartenden Einträge) und „Wieder verbunden“ in zwei schmalen Zeilen. role="status" sitzt nie um den Knopf,
 * nur um den Statustext (bei der einen Pille: ein unsichtbarer Text daneben). Fachfrei: Status, Zahl und Handler kommen vom
 * Aufrufer, alle Texte als `texte`. Nur Design-Tokens.
 */
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';

export interface VerbindungsStatusTexte {
  online: string;
  offline: string;
  verbinden: string;
  wiederVerbunden: string;
  /** „1 Eintrag wartet“ / „3 Einträge warten“ */
  wartend: (anzahl: number) => string;
}

export interface VerbindungsStatusProps {
  status: 'online' | 'offline';
  texte: VerbindungsStatusTexte;
  /** Anzahl wartender Einträge (nur ohne Netz sichtbar, wenn größer als 0). */
  wartende?: number;
  /** Ohne Netz: stößt die Verbindung und die Übertragung an. Ohne Handler kein Knopf. */
  onVerbinden?: () => void;
  /** Kurz nach der Rückkehr des Netzes. */
  wiederVerbunden?: boolean;
  variante?: 'normal' | 'kompakt';
  testId?: string;
}

const farbe = (online: boolean) => ({
  bg: online ? cssVars.colors.successLight : cssVars.colors.warningBannerBg,
  rand: online ? cssVars.colors.success : cssVars.colors.warningBannerBorder,
});
const schrift: CSSProperties = { fontFamily: 'inherit', fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.medium, color: cssVars.colors.textPrimary };
const huelleStil = (online: boolean, mitKnopf: boolean, schmal: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: cssVars.spacing.xs, flex: 'none', ...schrift,
  // Mit Knopf: kein Innenabstand um ihn (Rand als innerer Schatten, damit er keine Höhe kostet), ohne Knopf wie bisher
  padding: mitKnopf ? 0 : `${cssVars.spacing.xs} ${cssVars.spacing.sm}`, borderRadius: cssVars.borderRadius.full,
  background: farbe(online).bg, boxShadow: `inset 0 0 0 ${cssVars.borderWidth.thin} ${farbe(online).rand}`,
  // „Wieder verbunden“ am Handy in zwei schmalen Zeilen statt einer breiten
  ...(schmal ? { flexWrap: 'nowrap', width: 'min-content', lineHeight: 'normal' } : {}),
});
const punktStil = (online: boolean): CSSProperties => ({
  flex: 'none', width: cssVars.spacing.sm, height: cssVars.spacing.sm, borderRadius: cssVars.borderRadius.full,
  background: online ? cssVars.colors.success : cssVars.colors.warning,
});
/** Teil mit Wort und Zähler neben dem Knopf (Laptop): Innenabstand nur seitlich. */
const statusTeilStil: CSSProperties = { display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: cssVars.spacing.xs, padding: `0 ${cssVars.spacing.sm}` };
const segmentKnopfStil: CSSProperties = {
  ...schrift, minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum, padding: `0 ${cssVars.spacing.sm}`,
  background: 'transparent', border: 'none', borderLeft: `${cssVars.borderWidth.thin} solid ${cssVars.colors.warningBannerBorder}`,
  borderRadius: `0 ${cssVars.borderRadius.full} ${cssVars.borderRadius.full} 0`, fontWeight: cssVars.fontWeights.semibold, cursor: 'pointer',
};
/** Handy ohne Netz: die ganze Pille ist der Knopf, drei kurze Zeilen in der Mindest-Tippfläche. */
const pilleKnopfStil: CSSProperties = {
  ...schrift, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
  minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum, padding: `0 ${cssVars.spacing.xs}`, lineHeight: 'normal',
  background: cssVars.colors.warningBannerBg, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.warning}`,
  // Große Rundung statt Halbkreis: die dritte Zeile reicht fast bis an den Rand und würde an den Ecken eines Halbkreises anstoßen
  borderRadius: cssVars.borderRadius.lg, cursor: 'pointer',
};
const kleinStil: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs, fontSize: cssVars.fontSizes.xs, fontWeight: cssVars.fontWeights.medium, whiteSpace: 'nowrap' };
/** Nur für Bildschirmleser: sagt „Offline, 3 Einträge warten“, ohne den Knopf zu umschließen. */
const unsichtbarStil: CSSProperties = {
  position: 'absolute', width: cssVars.sizing.hairline, height: cssVars.sizing.hairline, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap', margin: `calc(-1 * ${cssVars.sizing.hairline})`, padding: 0, border: 0,
};

export function VerbindungsStatus({ status, texte, wartende = 0, onVerbinden, wiederVerbunden = false, variante = 'normal', testId }: VerbindungsStatusProps): ReactElement {
  const online = status === 'online';
  const kompakt = variante === 'kompakt';
  const wort = online ? (wiederVerbunden ? texte.wiederVerbunden : texte.online) : texte.offline;
  const wartend = !online && wartende > 0 ? texte.wartend(wartende) : null;
  const wartendTeil = wartend !== null && <span data-testid={testId && `${testId}-wartend`}>{wartend}</span>;
  const verbindenId = testId && `${testId}-verbinden`;

  if (!online && onVerbinden && kompakt) {
    return (
      <span style={{ position: 'relative', display: 'inline-flex', flex: 'none' }} data-testid={testId} data-status={status}>
        <button type="button" style={pilleKnopfStil} data-testid={verbindenId} onClick={onVerbinden}>
          <span style={{ fontWeight: cssVars.fontWeights.semibold }}>{texte.verbinden}</span>
          <span style={kleinStil} aria-hidden="true"><span style={punktStil(false)} />{texte.offline}</span>
          {wartend !== null && <span style={kleinStil} aria-hidden="true" data-testid={testId && `${testId}-wartend`}>{wartend}</span>}
        </button>
        <span role="status" style={unsichtbarStil}>{wartend === null ? wort : `${wort}, ${wartend}`}</span>
      </span>
    );
  }
  if (!online && onVerbinden) {
    return (
      <span style={huelleStil(false, true, false)} data-testid={testId} data-status={status}>
        <span role="status" style={statusTeilStil}><span style={punktStil(false)} aria-hidden="true" />{wort}{wartendTeil}</span>
        <button type="button" style={segmentKnopfStil} data-testid={verbindenId} onClick={onVerbinden}>{texte.verbinden}</button>
      </span>
    );
  }
  // Kompakt und ruhig online: nur der Punkt, der Name bleibt das Wort
  const nurPunkt = kompakt && online && !wiederVerbunden;
  return (
    <span style={huelleStil(online, false, kompakt && online && wiederVerbunden)} role="status" aria-label={nurPunkt ? wort : undefined} data-testid={testId} data-status={status}>
      <span style={punktStil(online)} aria-hidden="true" />
      {!nurPunkt && wort}
      {wartendTeil}
    </span>
  );
}
