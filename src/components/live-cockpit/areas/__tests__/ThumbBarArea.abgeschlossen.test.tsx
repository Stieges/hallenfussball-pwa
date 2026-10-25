/**
 * R3-3 (Review #394 M-3, @SL-159, @LZ-036): nach dem Abschluss liest das Cockpit nur und sagt „Das Turnier ist abgeschlossen“ --
 * für die Turnierleitung wie für Helfer, nie „Korrektur über die Turnierleitung“ (das gilt nur für Helfer im offenen Turnier, @HE-043).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { ThumbBarArea, type ThumbBarAreaProps } from '../ThumbBarArea';

await initRealDeI18n();

const phase = { zustand: 'abgepfiffen', abschnittArt: 'regulaer', abschnitt: 2, abschnitte: 2, letzterAbschnitt: true } as const;
const controls = {
  onStart: vi.fn(), onPauseResume: vi.fn(), onFinish: vi.fn(), onEventLog: vi.fn(), onMore: vi.fn(), canUndo: false,
} as unknown as ThumbBarAreaProps['controls'];

function zeige(over: Partial<ThumbBarAreaProps>) {
  render(<ThumbBarArea phase={phase} layout="daumen" kannSteuern={false} istLeitung fieldName="Feld 1" controls={controls} onWeiterNaechstes={vi.fn()} {...over} />);
}

describe('@SL-159 @LZ-036 Cockpit-Leiste nach dem Abschluss', () => {
  it.each([true, false])('abgeschlossen (Leitung=%s): „Das Turnier ist abgeschlossen“, kein Helfer-Satz', (istLeitung) => {
    zeige({ abgeschlossen: true, istLeitung });
    expect(screen.getByTestId('leiste-abgeschlossen')).toHaveTextContent('Das Turnier ist abgeschlossen');
    expect(screen.queryByText(/Korrektur über die Turnierleitung/)).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: offenes Turnier, nur lesend – kein Abschluss-Satz', () => {
    zeige({});
    expect(screen.queryByTestId('leiste-abgeschlossen')).not.toBeInTheDocument();
  });
});
