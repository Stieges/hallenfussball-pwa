import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HoldButton, HOLD_MS } from '../HoldButton';

const BESCHREIBUNG = 'Gedrückt halten, etwa eine Sekunde';

function setup(props: Partial<React.ComponentProps<typeof HoldButton>> = {}) {
  const onHold = vi.fn();
  const view = render(
    <HoldButton label="Abpfiff" sublabel="halten" onHold={onHold} testId="abpfiff" beschreibung={BESCHREIBUNG} {...props} />,
  );
  const knopf = screen.getByTestId('abpfiff');
  return { onHold, knopf, ...view };
}
const ms = (n: number) => { act(() => { vi.advanceTimersByTime(n); }); };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('HoldButton (Plan 3.1)', () => {
  it('@SL-157 löst nach 1000 ms Gedrückthalten genau einmal aus und füllt sich dabei', () => {
    const { onHold, knopf } = setup();
    fireEvent.pointerDown(knopf, { pointerId: 1, button: 0 });
    expect(knopf).toHaveAttribute('data-fuellt', 'true');
    ms(HOLD_MS - 1);
    expect(onHold).toHaveBeenCalledTimes(0);
    ms(1);
    expect(onHold).toHaveBeenCalledTimes(1);
    ms(3000);
    expect(onHold).toHaveBeenCalledTimes(1);
  });

  it('@SL-158 kurzer Tipp löst nicht aus', () => {
    const { onHold, knopf } = setup();
    fireEvent.click(knopf);
    ms(HOLD_MS * 2);
    expect(onHold).toHaveBeenCalledTimes(0);
  });

  it('@SL-158 Loslassen nach einer halben Sekunde löst nicht aus', () => {
    const { onHold, knopf } = setup();
    fireEvent.pointerDown(knopf, { pointerId: 1, button: 0 });
    ms(500);
    fireEvent.pointerUp(knopf, { pointerId: 1, button: 0 });
    ms(HOLD_MS);
    expect(onHold).toHaveBeenCalledTimes(0);
    expect(knopf).not.toHaveAttribute('data-fuellt', 'true');
  });

  it.each([['Enter', 'Enter'], ['Leertaste', ' ']])('@SL-158 %s kurz gedrückt löst nicht aus', (_n, key) => {
    const { onHold, knopf } = setup();
    knopf.focus();
    const down = fireEvent.keyDown(knopf, { key });
    ms(100);
    const up = fireEvent.keyUp(knopf, { key });
    ms(HOLD_MS * 2);
    expect(onHold).toHaveBeenCalledTimes(0);
    // fireEvent liefert false, wenn preventDefault aufgerufen wurde
    expect(down).toBe(false);
    expect(up).toBe(false);
  });

  it('Gegenbeispiel: Verlassen des Knopfs mit gedrücktem Finger bricht ab', () => {
    const { onHold, knopf } = setup();
    fireEvent.pointerDown(knopf, { pointerId: 1, button: 0 });
    ms(600);
    fireEvent.pointerLeave(knopf, { pointerId: 1 });
    ms(600);
    expect(onHold).toHaveBeenCalledTimes(0);
  });

  it('Gegenbeispiel: Wegschieben außerhalb des Knopf-Rechtecks (pointermove) bricht ab', () => {
    const { onHold, knopf } = setup();
    vi.spyOn(knopf, 'getBoundingClientRect').mockReturnValue({
      left: 100, right: 300, top: 100, bottom: 160, width: 200, height: 60, x: 100, y: 100, toJSON: () => ({}),
    });
    fireEvent.pointerDown(knopf, { pointerId: 1, button: 0, clientX: 150, clientY: 130 });
    ms(400);
    fireEvent.pointerMove(knopf, { pointerId: 1, clientX: 150, clientY: 130 });
    ms(100);
    expect(knopf).toHaveAttribute('data-fuellt', 'true');
    fireEvent.pointerMove(knopf, { pointerId: 1, clientX: 400, clientY: 130 });
    ms(HOLD_MS);
    expect(onHold).toHaveBeenCalledTimes(0);
  });

  it('rechte Maustaste startet nichts', () => {
    const { onHold, knopf } = setup();
    fireEvent.pointerDown(knopf, { pointerId: 1, button: 2 });
    ms(HOLD_MS);
    expect(onHold).toHaveBeenCalledTimes(0);
  });

  it('zweiter Finger startet keinen zweiten Lauf: nach Loslassen des ersten ist Schluss', () => {
    const { onHold, knopf } = setup();
    fireEvent.pointerDown(knopf, { pointerId: 1, button: 0 });
    ms(500);
    fireEvent.pointerDown(knopf, { pointerId: 2, button: 0 });
    ms(499);
    expect(onHold).toHaveBeenCalledTimes(0);
    ms(1);
    expect(onHold).toHaveBeenCalledTimes(1);
  });

  it('Aushängen während des Haltens → kein onHold', () => {
    const { onHold, knopf, unmount } = setup();
    fireEvent.pointerDown(knopf, { pointerId: 1, button: 0 });
    ms(500);
    unmount();
    ms(HOLD_MS);
    expect(onHold).toHaveBeenCalledTimes(0);
  });

  it('disabled während des Haltens (Abpfiff von selbst) → kein onHold', () => {
    const onHold = vi.fn();
    const props = { label: 'Abpfiff', onHold, testId: 'abpfiff', beschreibung: BESCHREIBUNG };
    const { rerender } = render(<HoldButton {...props} />);
    fireEvent.pointerDown(screen.getByTestId('abpfiff'), { pointerId: 1, button: 0 });
    ms(500);
    rerender(<HoldButton {...props} disabled />);
    ms(HOLD_MS);
    expect(onHold).toHaveBeenCalledTimes(0);
  });

  it('Zugänglicher Name „Abpfiff halten“, Beschreibung über aria-describedby', () => {
    setup();
    const knopf = screen.getByRole('button', { name: 'Abpfiff halten' });
    expect(knopf).toHaveAccessibleDescription(BESCHREIBUNG);
  });

  it.each([['Leertaste', ' '], ['Eingabetaste', 'Enter']])(
    '@SL-167 %s auf dem fokussierten Knopf 1000 ms gehalten löst genau einmal aus, 500 ms nicht',
    (_n, key) => {
      const { onHold, knopf } = setup();
      knopf.focus();
      fireEvent.keyDown(knopf, { key });
      expect(knopf).toHaveAttribute('data-fuellt', 'true');
      ms(500);
      fireEvent.keyDown(knopf, { key, repeat: true });
      ms(499);
      fireEvent.keyDown(knopf, { key, repeat: true });
      expect(onHold).toHaveBeenCalledTimes(0);
      ms(1);
      expect(onHold).toHaveBeenCalledTimes(1);
      fireEvent.keyUp(knopf, { key });
      ms(HOLD_MS * 2);
      expect(onHold).toHaveBeenCalledTimes(1);
    },
  );

  it.each([['Leertaste', ' '], ['Eingabetaste', 'Enter']])('@SL-167 %s nach 500 ms losgelassen löst nicht aus', (_n, key) => {
    const { onHold, knopf } = setup();
    knopf.focus();
    fireEvent.keyDown(knopf, { key });
    ms(500);
    fireEvent.keyUp(knopf, { key });
    ms(HOLD_MS);
    expect(onHold).toHaveBeenCalledTimes(0);
  });

  it('Gegenbeispiel: Fokusverlust während des Haltens bricht ab', () => {
    const { onHold, knopf } = setup();
    knopf.focus();
    fireEvent.keyDown(knopf, { key: ' ' });
    ms(500);
    fireEvent.blur(knopf);
    ms(HOLD_MS);
    expect(onHold).toHaveBeenCalledTimes(0);
  });

  it('--hold-duration ist gleich HOLD_MS', () => {
    const { knopf } = setup();
    expect(knopf.style.getPropertyValue('--hold-duration')).toBe(`${HOLD_MS}ms`);
    expect(HOLD_MS).toBe(1000);
  });

  it('Füllbalken trägt die Test-ID und füllt sich', () => {
    const { knopf } = setup();
    const fuellung = screen.getByTestId('abpfiff-fuellung');
    expect(fuellung.style.transform).toBe('scaleX(0)');
    fireEvent.pointerDown(knopf, { pointerId: 1, button: 0 });
    expect(fuellung.style.transform).toBe('scaleX(1)');
  });

  it('S5 Füllung ist ein Balken am unteren Rand auf einer Spur, keine Vollfläche über den Knopf', () => {
    const { knopf } = setup();
    const fuellung = screen.getByTestId('abpfiff-fuellung');
    const spur = screen.getByTestId('abpfiff-spur');
    expect(spur).toContainElement(fuellung);
    expect(knopf).toContainElement(spur);
    expect(spur.style.bottom).toBe('var(--spacing-xs)');
    expect(spur.style.height).toBe('var(--spacing-xs)');
    expect(fuellung.style.inset).toBe('');
  });

  it('S5 ein tabIndex von außen (Roving Tabindex der Leiste) landet am Knopf', () => {
    render(<HoldButton label="Abpfiff" onHold={vi.fn()} testId="abpfiff" beschreibung="Gedrückt halten" tabIndex={-1} />);
    expect(screen.getByTestId('abpfiff')).toHaveAttribute('tabindex', '-1');
  });
});
