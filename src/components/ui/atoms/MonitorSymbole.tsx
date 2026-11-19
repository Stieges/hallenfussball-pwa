/**
 * Symbole der Live-Sichten des Monitors statt Wörtern (@ZM-215, Daniel 2026-11-19: „Symbole nachziehen“): Zustand der Uhr, Feld, Gruppe und Abschnitt.
 * Ein gemeinsamer Satz Bausteine für die Live-Folie „Spielfeld (fern)“ und das Profil „Halle (sehr fern)“; jede Größe kommt als Token-Wert von außen
 * (cqh der Folie bzw. em der Seitenspalte), die Farbe ist die Textfarbe der Umgebung. Jedes Symbol trägt einen zugänglichen Namen (`role="img"` + `aria-label`
 * mit dem bisherigen Wort aus der Übersetzung), damit Vorleseprogramme und Tests den Zustand erkennen; die Zeichnung selbst ist für Leseprogramme verborgen.
 */
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';
import { MonitorIcons } from '../IconsMonitor';

export type MonitorSymbolKind = 'pause' | 'halbzeit' | 'pfeife' | 'verlaengerung' | 'uhr' | 'spielfeld';

const ICON: Record<MonitorSymbolKind, (p: { size: string }) => ReactElement> = {
  pause: MonitorIcons.Pause,
  halbzeit: MonitorIcons.HalfCircle,
  pfeife: MonitorIcons.Whistle,
  verlaengerung: MonitorIcons.PlusCircle,
  uhr: MonitorIcons.Clock,
  spielfeld: MonitorIcons.Pitch,
};

const mittig: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

export interface MonitorSymbolProps {
  kind: MonitorSymbolKind;
  /** Zugänglicher Name: das bisherige Wort („angehalten“, „Zeit abgelaufen“ …) */
  label: string;
  /** Kantenlänge als Token-Wert */
  size: string;
  /** Farbe, sonst die Textfarbe der Umgebung */
  color?: string;
  /** In einer Spalte (Flex) zum Anfang statt zum Ende ausrichten */
  alignSelf?: CSSProperties['alignSelf'];
  testId?: string;
}

/** Ein Symbol (Pause, Halbzeit, Pfeife, Verlängerung, Uhr, Spielfeld) in Kantenlänge `size`. */
export function MonitorSymbol({ kind, label, size, color, alignSelf, testId }: MonitorSymbolProps): ReactElement {
  const Icon = ICON[kind];
  return (
    <span role="img" aria-label={label} data-symbol={kind} data-testid={testId} style={{ ...mittig, width: size, height: size, ...(color === undefined ? {} : { color }), ...(alignSelf === undefined ? {} : { alignSelf }) }}>
      <Icon size="100%" />
    </span>
  );
}

export interface FeldSymbolProps {
  /** Feldnummer (sichtbar neben dem Spielfeld-Symbol) */
  number: number | string;
  /** Zugänglicher Name, z. B. „Feld 1“ */
  label: string;
  /** Höhe des Symbols als Token-Wert; die Nummer ist etwas kleiner */
  size: string;
  color?: string;
  testId?: string;
}

/** Feld als Spielfeld-Symbol mit Nummer statt „Feld 1“. */
export function FeldSymbol({ number, label, size, color, testId }: FeldSymbolProps): ReactElement {
  return (
    <span role="img" aria-label={label} data-testid={testId} style={{ ...mittig, gap: `calc(${size} * 0.25)`, height: size, fontWeight: cssVars.fontWeights.bold, lineHeight: 1, ...(color === undefined ? {} : { color }) }}>
      <span style={{ ...mittig, width: size, height: size }}><MonitorIcons.Pitch size="100%" /></span>
      <span aria-hidden="true" style={{ fontSize: `calc(${size} * 0.85)` }}>{number}</span>
    </span>
  );
}

export interface GruppenKastenProps {
  /** Gruppe, meist ein Buchstabe */
  group: string;
  /** Zugänglicher Name, z. B. „Gruppe A“ */
  label: string;
  /** Höhe des Kastens (mindestens so breit) als Token-Wert */
  size: string;
  border: string;
  radius: string;
  testId?: string;
}

/** Gruppe als Buchstabe in einem Kasten statt „Gruppe A“. */
export function GruppenKasten({ group, label, size, border, radius, testId }: GruppenKastenProps): ReactElement {
  return (
    <span
      role="img" aria-label={label} data-testid={testId}
      style={{
        ...mittig, boxSizing: 'border-box', height: size, minWidth: size, paddingInline: `calc(${size} * 0.15)`, border: `${border} solid currentColor`, borderRadius: radius,
        fontSize: `calc(${size} * 0.66)`, fontWeight: cssVars.fontWeights.extrabold, lineHeight: 1,
      }}
    >
      <span aria-hidden="true">{group}</span>
    </span>
  );
}

export interface AbschnittPunkteProps {
  /** Laufender Abschnitt (1-basiert) */
  current: number;
  /** Zahl der Abschnitte des Spiels */
  total: number;
  /** Zugänglicher Name, z. B. „2. Halbzeit“ oder „Abschnitt 3 von 3“ */
  label: string;
  size: string;
  gap: string;
  border: string;
  color?: string;
  testId?: string;
}

/** Abschnitt (Halbzeit, Drittel) als Punkte: gefüllt bis zum laufenden Abschnitt, der Rest leer. */
export function AbschnittPunkte({ current, total, label, size, gap, border, color, testId }: AbschnittPunkteProps): ReactElement {
  const punkte = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <span role="img" aria-label={label} data-testid={testId} data-aktuell={current} data-gesamt={total} style={{ ...mittig, gap, ...(color === undefined ? {} : { color }) }}>
      {punkte.map((nr) => (
        <span
          key={nr} aria-hidden="true" data-gefuellt={nr <= current ? 'ja' : 'nein'}
          style={{ display: 'block', boxSizing: 'border-box', width: size, height: size, borderRadius: cssVars.borderRadius.full, border: `${border} solid currentColor`, background: nr <= current ? 'currentColor' : 'transparent' }}
        />
      ))}
    </span>
  );
}
