/**
 * NoticeLine (Cockpit-Spec § 7, Mockup „Meldezeile“): reine Anzeige in einer Zeile fester Höhe.
 * Werte aus dem Gherkin: @SL-064 (verdeckt weder Uhr noch Stand, hält die Uhr nicht an).
 * Höhen 24/32 px und Kreuz 44 px nach der Entscheidung im Review Cockpit 2a (Punkt 3).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoticeLine } from '../NoticeLine';

const LANG = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921: 5. Foul in dieser Halbzeit';

describe('NoticeLine', () => {
  it('@SL-064 liegt im Fluss (nicht fixiert, nicht absolut) und kündigt höflich an', () => {
    render(<NoticeLine text="SV Süd: 5. Foul in dieser Halbzeit" closeLabel="Schließen" testId="notice-line" />);
    const line = screen.getByTestId('notice-line');
    expect(line).toHaveAttribute('aria-live', 'polite');
    expect(line).toHaveAttribute('role', 'status');
    expect(getComputedStyle(line).position).not.toBe('fixed');
    expect(getComputedStyle(line).position).not.toBe('absolute');
    expect(line).toHaveTextContent('SV Süd: 5. Foul in dieser Halbzeit');
  });

  it('@SL-064 Gegenbeispiel: ohne Meldung bleibt die Zeile leer, aber in voller Höhe stehen (die Tafel springt nicht)', () => {
    const { rerender } = render(<NoticeLine text={null} closeLabel="Schließen" testId="notice-line" />);
    const line = screen.getByTestId('notice-line');
    expect(line).toBeEmptyDOMElement();
    expect(line.style.height).toBe('var(--sizing-notice-line-height-compact)');
    rerender(<NoticeLine text="Tor für FC Nord" closeLabel="Schließen" testId="notice-line" />);
    expect(screen.getByTestId('notice-line').style.height).toBe('var(--sizing-notice-line-height-compact)');
  });

  it('ab Tablet ist die Zeile 32 px hoch (Token regular), sonst 24 px (compact)', () => {
    render(<NoticeLine text={null} size="regular" closeLabel="Schließen" testId="notice-line" />);
    expect(screen.getByTestId('notice-line').style.height).toBe('var(--sizing-notice-line-height-regular)');
  });

  it('eine lange Meldung bleibt eine Zeile: gekürzt mit „…“, der volle Text steht im Dokument für den Bildschirmleser', () => {
    render(<NoticeLine text={LANG} closeLabel="Schließen" testId="notice-line" />);
    const text = screen.getByText(LANG);
    expect(text.style.whiteSpace).toBe('nowrap');
    expect(text.style.textOverflow).toBe('ellipsis');
    expect(text.style.overflow).toBe('hidden');
  });

  it('ist reine Anzeige: ohne onClose gibt es keinen Knopf, ein Tipp auf die Zeile tut nichts', async () => {
    render(<NoticeLine text="Tor für FC Nord" closeLabel="Schließen" testId="notice-line" />);
    expect(screen.queryByRole('button')).toBeNull();
    await userEvent.click(screen.getByTestId('notice-line'));
    expect(screen.getByTestId('notice-line')).toHaveTextContent('Tor für FC Nord');
  });

  it('mit onClose hat die Zeile ein Kreuz mit Namen, das 44 px Tippfläche hat und die Zeile nicht höher macht', async () => {
    const onClose = vi.fn();
    render(<NoticeLine text="Bildschirm kann sich sperren" onClose={onClose} closeLabel="Hinweis schließen" testId="notice-line" />);
    const kreuz = screen.getByRole('button', { name: 'Hinweis schließen' });
    expect(kreuz.style.minWidth).toBe('var(--touch-target-minimum)');
    expect(kreuz.style.minHeight).toBe('var(--touch-target-minimum)');
    expect(screen.getByTestId('notice-line').style.height).toBe('var(--sizing-notice-line-height-compact)');
    await userEvent.click(kreuz);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: ohne Meldung gibt es auch mit onClose kein Kreuz', () => {
    render(<NoticeLine text={null} onClose={vi.fn()} closeLabel="Hinweis schließen" testId="notice-line" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
