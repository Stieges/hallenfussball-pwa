/**
 * TeamHeadBar – Kopf einer Team-Spalte im Cockpit in der Farbe des Ergebniskastens (@SL-176): Name und „Heim“/„Gast“ auf der
 * getragenen Farbe (Weste bei Leibchen, Leibchen-Zeichen davor). Schriftfarbe Schwarz oder Weiß mit mehr Kontrast (≥ 4,5 : 1).
 * Reine Anzeige: Fläche und Farben kommen aus derselben Rechnung wie die Kästen und der Hallenmonitor (`resolveBoxColors`).
 * Der Name wird nie gekürzt und nie getrennt (VISUAL-DESIGN § 1/§ 2): er bricht um.
 */
import { Fragment, type CSSProperties, type ReactElement } from 'react';
import { fillBaseColor, type BoxFill } from '../../../core/models/scoreBoxColors';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { MatchIcons } from '../IconsMatch';
import { fillSurface, fillTextColor } from './scoreBoxStyle';

export interface TeamHeadBarProps {
  name: string;
  /** „Heim“ oder „Gast“ */
  label: string;
  fill: BoxFill;
  /** Leibchen-Zeichen vor dem Namen, mit zugänglichem Namen */
  bib?: { ariaLabel: string } | null;
  /** Größere Schrift ab 1024 px */
  breit?: boolean;
  testId: string;
  nameTestId: string;
  stripeTestId?: string;
  /** Füllt die Höhe seiner Zeile: in der Tastenspalte sind beide Köpfe gleich hoch, auch wenn ein Name dreizeilig umbricht. */
  fuellend?: boolean;
  /**
   * Handy (K5/K11, @SL-061): ein Kopf so flach wie möglich – „Heim“/„Gast“ steht rechts in der ersten Zeile, der Name fließt darum herum
   * (kurze Namen einzeilig), die Weste als schmale Streifen am Rand, damit der Name die Breite behält und nie im Wort bricht.
   */
  kompakt?: boolean;
  /**
   * Beide Namen des Spiels (@SL-245: beide Köpfe in gleicher Schriftgröße, der längste Name entscheidet). Ohne Angabe entscheidet nur der eigene Name.
   */
  namen?: readonly string[];
}

/**
 * Handy: ab dieser Länge wird die Schrift kleiner und die Zeilenhöhe enger (am Laptop steht „Heim“/„Gast“ immer über dem Namen, @SL-245): der Name bekommt die ganze Breite und bricht nur zwischen Wörtern um
 * (nie mitten im Wort, VISUAL-DESIGN § 2; gemessen am Handy mit 50 Zeichen, `titel.wortbruch`).
 */
const LANGER_NAME = 16;

const laengstes = (namen: readonly string[], mass: (name: string) => number): number => Math.max(...namen.map(mass));
const laengstesWort = (name: string): number => Math.max(...name.split(' ').map((wort) => wort.length));

export function TeamHeadBar(props: TeamHeadBarProps): ReactElement {
  return props.kompakt ? <TeamHeadBarKompakt {...props} /> : <TeamHeadBarNormal {...props} />;
}

/**
 * Weste (Handy und Laptop): schmale Streifen fester Breite statt eines Anteils der Fläche (der Name behält die Breite, K11). Die Fläche des Kopfes ist EINE Farbe
 * (die der Leibchen); die Streifen sind eigene dekorative Elemente neben dem Text (`Streifen`), kein Farbverlauf unter der Schrift – so misst der
 * Kontrast (@SL-225) die Schrift gegen die Leibchenfarbe, und `fillTextColor` (dieselbe Regel wie die Ziffer im Kasten) wählt Schwarz oder Weiß.
 */
function schmaleWeste(fill: BoxFill): CSSProperties {
  if (fill.kind === 'striped') { return fillSurface(fill); }
  if (fill.kind !== 'vest') { return { backgroundColor: fill.color }; }
  return { backgroundColor: fill.center, position: 'relative' };
}

/** Die zwei Streifen der Weste (Trikotfarbe, bei unbekannter Trikotfarbe das graue Muster) links und rechts, hinter dem Rand des Textes. */
function Streifen({ fill }: { fill: BoxFill }): ReactElement | null {
  if (fill.kind !== 'vest') { return null; }
  const flaeche: CSSProperties = { position: 'absolute', top: 0, bottom: 0, width: cssVars.spacing.sm, backgroundColor: fill.stripes, pointerEvents: 'none' };
  return (
    <>
      <i aria-hidden="true" data-teil="streifen" style={{ ...flaeche, left: 0, borderRadius: `${cssVars.borderRadius.md} 0 0 ${cssVars.borderRadius.md}` }} />
      <i aria-hidden="true" data-teil="streifen" style={{ ...flaeche, right: 0, borderRadius: `0 ${cssVars.borderRadius.md} ${cssVars.borderRadius.md} 0` }} />
    </>
  );
}

/** Ab dieser Wortlänge (z. B. „Oberweiler-Niederstetten“) wird die Schrift am Handy noch kleiner, damit das Wort in eine Zeile passt (kleiner statt getrennt). */
const LANGES_WORT = 18;
/** Normal-Kopf (Tablet/Laptop): mehr Platz, ein Wort wie „Oberweiler-Niederstetten“ (24) passt noch in normaler Schrift; erst darüber wird kleiner statt getrennt */
const LANGES_WORT_NORMAL = 26;

/**
 * Handy-Kopf: Name mit Wörtern, die nie umbrechen (`titel.wortbruch`, @OB-058), auch nicht am Bindestrich („Nordheim-/Süd“). Umgebrochen wird nur zwischen
 * den Wörtern; der Text bleibt derselbe.
 */
function Woerter({ name }: { name: string }): ReactElement {
  const woerter = name.split(' ');
  return (
    <>
      {woerter.map((wort, index) => (
        // Das Leerzeichen steht AUSSERHALB des Wortes: nur dort darf die Zeile umbrechen (sonst bleibt der ganze Name einzeilig und läuft über)
        <Fragment key={`${String(index)}-${wort}`}><span style={{ whiteSpace: 'nowrap' }}>{wort}</span>{index < woerter.length - 1 ? ' ' : null}</Fragment>
      ))}
    </>
  );
}

function TeamHeadBarKompakt({ name, label, fill, bib = null, fuellend = false, testId, nameTestId, namen = [name] }: TeamHeadBarProps): ReactElement {
  const text = fillTextColor(fill);
  const lang = laengstes(namen, (n) => n.length) > LANGER_NAME; // der längste Name beider Köpfe entscheidet (@SL-245)
  const langesWort = laengstes(namen, laengstesWort) > LANGES_WORT;
  const rand = fill.kind === 'vest' ? `calc(${cssVars.spacing.sm} + ${cssVars.spacing.xs})` : cssVars.spacing.sm;
  const kopf: CSSProperties = {
    display: 'block', boxSizing: 'border-box', minWidth: 0, padding: `${cssVars.spacing.xs} ${rand}`, borderRadius: cssVars.borderRadius.md,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderSolid}`, color: text, ...(fuellend ? { flex: '1 1 auto' } : {}), ...schmaleWeste(fill),
  };
  const zeilenHoehe = lang ? cssVars.lineHeights.bodySm : cssVars.lineHeights.bodyMd;
  const seite: CSSProperties = {
    float: 'right', marginLeft: cssVars.spacing.xs, fontSize: cssVars.fontSizes.labelMd, fontWeight: cssVars.fontWeights.bold, textTransform: 'uppercase', lineHeight: zeilenHoehe,
  };
  const nameStil: CSSProperties = {
    margin: 0, minWidth: 0, hyphens: 'manual', overflowWrap: 'normal', wordBreak: 'normal', lineHeight: zeilenHoehe,
    fontSize: langesWort ? cssVars.fontSizes.xs : lang ? cssVars.fontSizes.sm : cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.bold,
  };
  return (
    <div style={kopf} data-testid={testId} data-fill={fill.kind} data-kompakt="true" data-color={fillBaseColor(fill)}>
      <Streifen fill={fill} />
      <span style={seite}>{label}</span>
      <p data-teamname="" data-testid={nameTestId} style={nameStil}>
        {bib && (
          <span role="img" aria-label={bib.ariaLabel} data-testid={`${testId}-leibchen`} style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: cssVars.spacing.xs }}>
            <MatchIcons.Shirt size={iconSizeValues.xs} />
          </span>
        )}
        <Woerter name={name} />
      </p>
    </div>
  );
}

function TeamHeadBarNormal({ name, label, fill, bib = null, breit = false, fuellend = false, testId, nameTestId, namen = [name] }: TeamHeadBarProps): ReactElement {
  const text = fillTextColor(fill);
  const langesWort = laengstes(namen, laengstesWort) > LANGES_WORT_NORMAL; // ein sehr langes Einzelwort in EINEM der Namen macht beide Köpfe kleiner statt getrennt (wie im Handy-Kopf)
  // @SL-245: am Laptop/Tablet immer „Heim“/„Gast“ in der ersten Zeile, der Name darunter – unabhängig von der Namenslänge, damit beide Köpfe gleich aufgebaut sind
  // (und der Name die ganze Breite bekommt und nur zwischen Wörtern bricht, VISUAL-DESIGN § 2, `titel.wortbruch`)
  const kopf: CSSProperties = {
    display: 'flex', flexDirection: 'column-reverse', alignItems: 'stretch', justifyContent: 'center', gap: breit ? 0 : cssVars.spacing.xs, boxSizing: 'border-box', minWidth: 0,
    // Die Schrift bleibt von den Weste-Streifen weg (N3: „Gast“ auf dem Streifen fiele unter 4,5 : 1)
    padding: `${cssVars.spacing.xs} ${fill.kind === 'vest' ? `calc(${cssVars.spacing.sm} + ${cssVars.spacing.sm})` : cssVars.spacing.sm}`, borderRadius: cssVars.borderRadius.md,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderSolid}`, color: text, hyphens: 'manual',
    ...(fuellend ? { flex: '1 1 auto' } : {}),
    ...(breit ? { minHeight: 'var(--cockpit-kopf, var(--sizing-cockpit-kopf-normal))' } : {}),
    ...schmaleWeste(fill),
  };
  const nameStil: CSSProperties = {
    margin: 0, flex: 'none', minWidth: 0, hyphens: 'manual', overflowWrap: 'normal', wordBreak: 'normal', lineHeight: cssVars.lineHeights.bodyMd,
    fontSize: langesWort ? cssVars.fontSizes.sm : breit ? 'var(--cockpit-kopf-schrift, var(--font-size-title-lg))' : `clamp(${cssVars.fontSizes.md}, 4vw, ${cssVars.fontSizes.lg})`, fontWeight: cssVars.fontWeights.bold,
    display: 'flex', alignItems: 'flex-start', gap: cssVars.spacing.xs,
  };
  const seite: CSSProperties = { flex: 'none', textAlign: 'right', fontSize: cssVars.fontSizes.labelMd, fontWeight: cssVars.fontWeights.bold, textTransform: 'uppercase', lineHeight: cssVars.lineHeights.label }; // eng: hält den Kopf bei Laptop-Fensterhöhe 620 px möglichst niedrig; er wird mit `breit` trotzdem etwas höher (knapp +6 px, normal +2 px), das fängt der Überschuss der Tor-Taste auf (@SL-187)
  return (
    <div style={kopf} data-testid={testId} data-fill={fill.kind} data-gestapelt="true" data-color={fillBaseColor(fill)}>
      <Streifen fill={fill} />
      <p data-teamname="" data-testid={nameTestId} style={nameStil}>
        {bib && (
          <span role="img" aria-label={bib.ariaLabel} data-testid={`${testId}-leibchen`} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', minHeight: cssVars.lineHeights.bodyMd }}>
            <MatchIcons.Shirt size={iconSizeValues.xs} />
          </span>
        )}
        <span style={{ minWidth: 0 }}><Woerter name={name} /></span>
      </p>
      <span style={seite}>{label}</span>
    </div>
  );
}
