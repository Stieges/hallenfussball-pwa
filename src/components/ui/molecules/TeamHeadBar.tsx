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
import { fillStreifenProzent, fillSurface, fillTextColor } from './scoreBoxStyle';

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
}

/**
 * Ab dieser Länge steht „Heim“/„Gast“ über dem Namen statt neben ihm: der Name bekommt die ganze Breite und bricht nur zwischen Wörtern um
 * (nie mitten im Wort, VISUAL-DESIGN § 2; gemessen am Handy mit 50 Zeichen, `titel.wortbruch`).
 */
const LANGER_NAME = 16;

export function TeamHeadBar(props: TeamHeadBarProps): ReactElement {
  return props.kompakt ? <TeamHeadBarKompakt {...props} /> : <TeamHeadBarNormal {...props} />;
}

/** Weste am Handy: schmale Streifen fester Breite statt eines Anteils der Fläche (der Name behält die Breite, K11). */
function schmaleWeste(fill: BoxFill): CSSProperties {
  if (fill.kind === 'striped') { return fillSurface(fill); }
  if (fill.kind !== 'vest') { return { backgroundColor: fill.color }; }
  const breite = cssVars.spacing.sm;
  return {
    backgroundColor: fill.center,
    backgroundImage: `linear-gradient(90deg, ${fill.stripes} ${breite}, ${fill.center} ${breite}, ${fill.center} calc(100% - ${breite}), ${fill.stripes} calc(100% - ${breite}))`,
  };
}

/** Ab dieser Wortlänge (z. B. „Oberweiler-Niederstetten“) wird die Schrift am Handy noch kleiner, damit das Wort in eine Zeile passt (kleiner statt getrennt). */
const LANGES_WORT = 18;

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

function TeamHeadBarKompakt({ name, label, fill, bib = null, fuellend = false, testId, nameTestId }: TeamHeadBarProps): ReactElement {
  const text = fillTextColor(fill);
  const lang = name.length > LANGER_NAME;
  const langesWort = Math.max(...name.split(' ').map((wort) => wort.length)) > LANGES_WORT;
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

function TeamHeadBarNormal({ name, label, fill, bib = null, breit = false, fuellend = false, testId, nameTestId }: TeamHeadBarProps): ReactElement {
  const text = fillTextColor(fill);
  const gestapelt = name.length > LANGER_NAME; // auch am Laptop: „Heim“/„Gast“ über dem langen Namen, sonst bricht er am Bindestrich (VISUAL-DESIGN § 2, `titel.wortbruch`)
  const kopf: CSSProperties = {
    display: 'flex', flexDirection: gestapelt ? 'column-reverse' : 'row', alignItems: gestapelt ? 'stretch' : 'flex-start', justifyContent: 'space-between', gap: gestapelt ? (breit ? 0 : cssVars.spacing.xs) : cssVars.spacing.sm, boxSizing: 'border-box', minWidth: 0,
    // Die Schrift bleibt von den Weste-Streifen weg (N3: „Gast“ auf dem Streifen fiele unter 4,5 : 1)
    padding: `${cssVars.spacing.xs} calc(${String(fillStreifenProzent(fill))}% + ${cssVars.spacing.sm})`, borderRadius: cssVars.borderRadius.md,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderSolid}`, color: text, hyphens: 'manual',
    ...(fuellend ? { flex: '1 1 auto' } : {}),
    ...(breit ? { minHeight: 'var(--cockpit-kopf, var(--sizing-cockpit-kopf-normal))', alignItems: 'center' } : {}),
    ...fillSurface(fill),
  };
  const nameStil: CSSProperties = {
    margin: 0, flex: gestapelt ? 'none' : '1 1 0', minWidth: 0, hyphens: 'manual', overflowWrap: 'normal', wordBreak: 'normal', lineHeight: cssVars.lineHeights.bodyMd,
    fontSize: breit ? 'var(--cockpit-kopf-schrift, var(--font-size-title-lg))' : `clamp(${cssVars.fontSizes.md}, 4vw, ${cssVars.fontSizes.lg})`, fontWeight: cssVars.fontWeights.bold,
    display: 'flex', alignItems: 'flex-start', gap: cssVars.spacing.xs,
  };
  const seite: CSSProperties = { flex: 'none', textAlign: gestapelt ? 'right' : undefined, fontSize: cssVars.fontSizes.labelMd, fontWeight: cssVars.fontWeights.bold, textTransform: 'uppercase', lineHeight: cssVars.lineHeights.bodyMd };
  return (
    <div style={kopf} data-testid={testId} data-fill={fill.kind} data-gestapelt={gestapelt ? 'true' : undefined} data-color={fillBaseColor(fill)}>
      <p data-teamname="" data-testid={nameTestId} style={nameStil}>
        {bib && (
          <span role="img" aria-label={bib.ariaLabel} data-testid={`${testId}-leibchen`} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', minHeight: cssVars.lineHeights.bodyMd }}>
            <MatchIcons.Shirt size={iconSizeValues.xs} />
          </span>
        )}
        <span style={{ minWidth: 0 }}>{name}</span>
      </p>
      <span style={seite}>{label}</span>
    </div>
  );
}
