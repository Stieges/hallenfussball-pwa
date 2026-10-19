/**
 * TimeStepper (B-08d, fachfrei): zählt um einen Schritt, begrenzt auf [min, max], meldet die Grenze
 * über deaktivierte Knöpfe. Testwerte: @SL-012 (Obergrenze), @SL-077 (Untergrenze).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeStepper } from '../TimeStepper';

const formatMmSs = (sekunden: number): string => `${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, '0')}`;

function stepper(value: number, min: number, max: number, onChange = vi.fn()) {
  render(
    <TimeStepper
      value={value}
      min={min}
      max={max}
      step={10}
      format={formatMmSs}
      labelDecrease="weniger"
      labelIncrease="mehr"
      onChange={onChange}
    />,
  );
  return onChange;
}

describe('TimeStepper', () => {
  it('zeigt den Wert über format und zählt um den Schritt', () => {
    const onChange = stepper(290, 0, 360);
    expect(screen.getByText('4:50')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'mehr' }));
    expect(onChange).toHaveBeenLastCalledWith(300);
    fireEvent.click(screen.getByRole('button', { name: 'weniger' }));
    expect(onChange).toHaveBeenLastCalledWith(280);
  });

  it('@SL-012 Gegenbeispiel: an der Obergrenze lässt sich nicht weiter erhöhen (Grenze im TimeStepper)', () => {
    const onChange = stepper(350, 0, 360);
    fireEvent.click(screen.getByRole('button', { name: 'mehr' }));
    expect(onChange).toHaveBeenLastCalledWith(360);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('@SL-012 Gegenbeispiel: auf der Obergrenze ist der Zähler-Knopf aus, 370 wird nie gemeldet', () => {
    stepper(360, 0, 360);
    expect(screen.getByRole('button', { name: 'mehr' })).toBeDisabled();
  });

  it('@SL-077 Gegenbeispiel: an der Untergrenze lässt sich nicht weiter verringern', () => {
    const onChange = stepper(310, 310, 360);
    expect(screen.getByRole('button', { name: 'weniger' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'weniger' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ein Schritt über die Grenze hinaus wird auf die Grenze gekappt', () => {
    const onChange = stepper(355, 0, 360);
    fireEvent.click(screen.getByRole('button', { name: 'mehr' }));
    expect(onChange).toHaveBeenLastCalledWith(360);
  });

  it('@SL-011 Raster: von 5:23 springt „weniger“ auf 5:20 und „mehr“ auf 5:30, nicht auf 5:13 / 5:33', () => {
    const onChange = stepper(323, 0, 360);
    fireEvent.click(screen.getByRole('button', { name: 'weniger' }));
    expect(onChange).toHaveBeenLastCalledWith(320);
    fireEvent.click(screen.getByRole('button', { name: 'mehr' }));
    expect(onChange).toHaveBeenLastCalledWith(330);
  });

  it('@SL-011 Gegenbeispiel: liegt der Wert genau auf dem Raster, bleibt es ein voller Schritt (5:20 → 5:10 / 5:30)', () => {
    const onChange = stepper(320, 0, 360);
    fireEvent.click(screen.getByRole('button', { name: 'weniger' }));
    expect(onChange).toHaveBeenLastCalledWith(310);
    fireEvent.click(screen.getByRole('button', { name: 'mehr' }));
    expect(onChange).toHaveBeenLastCalledWith(330);
  });
});
