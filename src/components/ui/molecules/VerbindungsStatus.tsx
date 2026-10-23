/**
 * VerbindungsStatus – Zustand der Verbindung (Plan LT-2, @SL-140, @SL-168).
 *
 * Zwei Zustände, nie Farbe allein (WCAG 1.4.1): verbunden (Punkt + Wort „Verbunden“, kein Knopf) und nicht verbunden (Punkt + „Offline“,
 * optional „N Einträge warten“ und der Knopf „Verbinden“, nur wenn `onVerbinden` übergeben ist). Läuft der Versuch (`verbindet`, kommt
 * vom Aufrufer), steht in DERSELBEN Pille „Verbinde …“ statt „Verbinden“ (gleiche Größe, der Knopf reagiert nicht erneut).
 * Eine Meldung „Wieder verbunden“ gibt es nicht.
 * Höhe: Der Knopf ist das einzige Element über der Mindest-Tippfläche und bekommt keinen Rahmen aus Innenabstand – die Anzeige
 * ist nie höher als `touchTargets.minimum`, damit ein schmaler Kopf beim Wechsel Online/Offline nicht wächst und nichts springt.
 * Die Variante `kompakt` (Handy) zeigt mit Netz nur den Punkt, ohne Netz EINE Pille als Knopf (oben „Verbinden“, darunter klein
 * „Offline“ und die wartenden Einträge). role="status" sitzt nie um den Knopf,
 * nur um den Statustext: ein dauerhaftes, unsichtbares role="status"-Element in jedem Zustand (H12), alles Sichtbare daneben aria-hidden. Fachfrei: Status, Zahl und Handler kommen vom
 * Aufrufer, alle Texte als `texte`. Nur Design-Tokens.
 */
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';

export interface VerbindungsStatusTexte {
  online: string;
  offline: string;
  verbinden: string;
  /** „Verbinde …“ – solange der Versuch läuft */
  verbindet: string;
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
  /** Der Versuch nach dem Tippen läuft (nur ohne Netz sichtbar). */
  verbindet?: boolean;
  variante?: 'normal' | 'kompakt';
  testId?: string;
}

const farbe = (online: boolean) => ({
  bg: online ? cssVars.colors.successLight : cssVars.colors.warningBannerBg,
  rand: online ? cssVars.colors.success : cssVars.colors.warningBannerBorder,
});
const schrift: CSSProperties = { fontFamily: 'inherit', fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.medium, color: cssVars.colors.textPrimary };
const huelleStil = (online: boolean, mitKnopf: boolean): CSSProperties => ({
  position: 'relative', display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: cssVars.spacing.xs, flex: 'none', ...schrift,
  // Mit Knopf: kein Innenabstand um ihn (Rand als innerer Schatten, damit er keine Höhe kostet), ohne Knopf wie bisher
  padding: mitKnopf ? 0 : `${cssVars.spacing.xs} ${cssVars.spacing.sm}`, borderRadius: cssVars.borderRadius.full,
  background: farbe(online).bg, boxShadow: `inset 0 0 0 ${cssVars.borderWidth.thin} ${farbe(online).rand}`,
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
  // Gleiche Rundung wie „Zurück“ und Feldwahl im Kopf (md): die dritte Zeile reicht fast bis an den Rand und liegt nie auf der Rundung.
  // Seitlicher Innenabstand xs: mit sm bricht der Kopf mit zwei Feldern bei 360 px um (Karte 578 > 565, im E2E gemessen)
  borderRadius: cssVars.borderRadius.md, cursor: 'pointer',
};
const kleinStil: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs, fontSize: cssVars.fontSizes.xs, fontWeight: cssVars.fontWeights.medium, whiteSpace: 'nowrap' };
/** Nur für Bildschirmleser: die dauerhafte Live-Region („Offline, 3 Einträge warten“), nie um den Knopf. */
const unsichtbarStil: CSSProperties = {
  position: 'absolute', width: cssVars.sizing.hairline, height: cssVars.sizing.hairline, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap', margin: `calc(-1 * ${cssVars.sizing.hairline})`, padding: 0, border: 0,
};

export function VerbindungsStatus({ status, texte, wartende = 0, onVerbinden, verbindet = false, variante = 'normal', testId }: VerbindungsStatusProps): ReactElement {
  const online = status === 'online';
  const kompakt = variante === 'kompakt';
  const wort = online ? texte.online : texte.offline;
  const knopfText = verbindet ? texte.verbindet : texte.verbinden;
  const wartend = !online && wartende > 0 ? texte.wartend(wartende) : null;
  const wartendTeil = wartend !== null && <span aria-hidden="true" data-testid={testId && `${testId}-wartend`}>{wartend}</span>;
  const verbindenId = testId && `${testId}-verbinden`;
  // H12: EIN dauerhaftes, unsichtbares Live-Region-Element in jedem Zustand (der Inhalt wechselt, das Element bleibt), sonst sagen
  // Bildschirmleser „Offline“ und „Wieder verbunden“ nicht an. Alles Sichtbare daneben ist `aria-hidden`; der Knopf bleibt ein Knopf.
  const ansage = <span role="status" style={unsichtbarStil}>{verbindet && !online ? texte.verbindet : wartend === null ? wort : `${wort}, ${wartend}`}</span>;
  const knopfProps = { type: 'button' as const, 'aria-disabled': verbindet || undefined, 'aria-busy': verbindet || undefined, 'data-verbindet': verbindet ? 'true' : undefined, onClick: () => { if (!verbindet) { onVerbinden?.(); } } };

  if (!online && onVerbinden && kompakt) {
    return (
      <span style={{ position: 'relative', display: 'inline-flex', flex: 'none' }} data-testid={testId} data-status={status}>
        {ansage}
        <button {...knopfProps} style={pilleKnopfStil} data-testid={verbindenId}>
          <span style={{ fontWeight: cssVars.fontWeights.semibold }}>{knopfText}</span>
          <span style={kleinStil} aria-hidden="true"><span style={punktStil(false)} />{texte.offline}</span>
          {wartend !== null && <span style={kleinStil} aria-hidden="true" data-testid={testId && `${testId}-wartend`}>{wartend}</span>}
        </button>
      </span>
    );
  }
  if (!online && onVerbinden) {
    return (
      <span style={huelleStil(false, true)} data-testid={testId} data-status={status}>
        {ansage}
        <span style={statusTeilStil} aria-hidden="true"><span style={punktStil(false)} />{wort}{wartendTeil}</span>
        <button {...knopfProps} style={segmentKnopfStil} data-testid={verbindenId}>{knopfText}</button>
      </span>
    );
  }
  // Kompakt und ruhig online: nur der Punkt, der Name bleibt das Wort (in der Ansage)
  const nurPunkt = kompakt && online;
  return (
    <span style={huelleStil(online, false)} data-testid={testId} data-status={status}>
      {ansage}
      <span style={punktStil(online)} aria-hidden="true" />
      {!nurPunkt && <span aria-hidden="true">{wort}</span>}
      {wartendTeil}
    </span>
  );
}
