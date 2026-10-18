/**
 * MatchClock – die Restzeit beim Stand (Aufgabe 5.1a Spielanzeige, @ZM-162, @OB-067, @ZM-040, @OB-066).
 *
 * Nur die Restzeit des Abschnitts (herunterzählend, nie die gespielte Zeit), in Schriftstärke 800 mit gleich breiten
 * Ziffern; der Abschnitt steht klein davor („Restzeit · 2. Halbzeit“). In der Pause steht die Pausen-Restzeit mit dem
 * Wort der Pause. Nach Ablauf der Spielzeit bis zum Abpfiff steht „Spielzeit abgelaufen – Ergebnis folgt“.
 * Ohne Restzeit (Pause ohne Pausen-Daten) steht nur das Abschnittswort. Reine Anzeige.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes } from '../../../design-tokens';
import type { SpectatorClock } from '../../../core/view';

export interface MatchClockProps {
  clock: SpectatorClock;
  /** Spielkarte/Kopf | Monitor (nach `displayFontSizes`) */
  size: 'card' | 'display';
  /** Farbe der Ziffern; Vorgabe die Textfarbe, gedämpft bei stehender Uhr */
  color?: string;
  /** Vorgabe `match-clock`; der Abschnitt `match-clock-section`, „abgelaufen“ `match-clock-expired` */
  testId?: string;
}

export function MatchClock({ clock, size, color, testId }: MatchClockProps): ReactElement | null {
  const { t } = useTranslation('tournament');
  const key = clock.sectionKey;
  const section = key === null ? null : t(`matchClock.section.${key}`, { section: clock.section, sections: clock.sections });
  if (clock.remaining === null && section === null && !clock.expired) {
    return null;
  }
  // „Restzeit · 2. Halbzeit“, „Pause · Halbzeit“; „Pause vor der Verlängerung“ trägt das Wort schon
  const prefix = key === 'breakBeforeOvertime' || key === 'breakBeforeShootout' ? null : key === 'halftimeBreak' || key === 'sectionBreak' ? t('matchClock.breakPrefix') : t('matchClock.remaining');
  const display = size === 'display';
  const wrap: CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: cssVars.spacing.sm, minWidth: 0 };
  const meta: CSSProperties = { fontSize: display ? displayFontSizes.bodySM : cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, minWidth: 0 };
  const zeit: CSSProperties = {
    fontSize: display ? displayFontSizes.clockXL : cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.extrabold,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    color: color ?? (clock.stopped ? cssVars.colors.textSecondary : cssVars.colors.textPrimary),
  };
  return (
    <div style={wrap} data-testid={testId === undefined ? undefined : `${testId}-area`} aria-label={clock.remaining === null ? undefined : t('matchClock.ariaRemaining', { time: clock.remaining })}>
      <span style={meta}>
        {prefix !== null && <>{prefix}{section !== null && ' · '}</>}
        {section !== null && <span data-testid={testId === undefined ? 'match-clock-section' : `${testId}-section`}>{section}</span>}
      </span>
      {clock.remaining !== null && (
        <span style={zeit} data-testid={testId ?? 'match-clock'} data-stopped={clock.stopped ? 'true' : undefined}>{clock.remaining}</span>
      )}
      {clock.expired && (
        <span style={meta} data-testid="match-clock-expired">{t('matchClock.expired')}</span>
      )}
    </div>
  );
}
