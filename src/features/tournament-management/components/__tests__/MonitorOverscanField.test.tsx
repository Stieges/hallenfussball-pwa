/**
 * Bildrand-Regler im Monitor-Editor (Paket MS2): @ME-067 (Vorbelegung 5 %, 0–10 % in Schritten von 0,5),
 * @ME-020 (Einstellung wird gespeichert und wirkt am Monitor).
 * Wortlaut der Texte kommt aus der echten DE-Übersetzung (B-41).
 */
import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { MonitorOverscanField } from '../MonitorOverscanField';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const regler = () => screen.getByTestId<HTMLInputElement>('monitor-overscan-input');

describe('Bildrand-Regler (@ME-067)', () => {
  it('@ME-067 ohne gespeicherten Wert steht der Regler auf 5 % und der Text nennt Prozent', () => {
    render(<MonitorOverscanField value={undefined} onChange={vi.fn()} />);
    expect(regler().value).toBe('5');
    expect(screen.getByText('Bildrand (5 %)')).toBeInTheDocument();
    expect(screen.queryByText(/px/)).not.toBeInTheDocument();
  });

  it('@ME-067 der Regler läuft von 0 bis 10 in Schritten von 0,5, der Hinweis nennt die Vorbelegung', () => {
    render(<MonitorOverscanField value={5} onChange={vi.fn()} />);
    expect(regler().min).toBe('0');
    expect(regler().max).toBe('10');
    expect(regler().step).toBe('0.5');
    expect(screen.getByText('Vorbelegung 5 % passt für die meisten Fernseher')).toBeInTheDocument();
    expect(regler().getAttribute('aria-describedby')).toBe('monitor-overscan-hint');
  });

  it('@ME-067 Gegenbeispiel: ein alter Pixelwert (48) wird nicht als Prozent gezeigt, es gilt die Vorbelegung', () => {
    render(<MonitorOverscanField value={48} onChange={vi.fn()} />);
    expect(screen.getByText('Bildrand (5 %)')).toBeInTheDocument();
  });

  it('@ME-067 Rand 0 % ist ein gültiger gespeicherter Wert und bleibt 0', () => {
    render(<MonitorOverscanField value={0} onChange={vi.fn()} />);
    expect(regler().value).toBe('0');
    expect(screen.getByText('Bildrand (0 %)')).toBeInTheDocument();
  });

  it('@ME-020 eine Änderung auf 8 % wird als Zahl gemeldet', () => {
    const onChange = vi.fn();
    render(<MonitorOverscanField value={5} onChange={onChange} />);
    fireEvent.change(regler(), { target: { value: '8' } });
    expect(onChange).toHaveBeenCalledWith(8);
  });
});
