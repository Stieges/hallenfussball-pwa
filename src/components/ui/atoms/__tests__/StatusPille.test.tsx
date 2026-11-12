/**
 * StatusPille (G6, @HT-045): Symbol + Wort (Farbe nie allein), Tippfläche ≥ 44 px, Aktionen, Tastatur, Umbruch statt „…“.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusPille } from '../StatusPille';
import { cssVars } from '../../../../design-tokens';
import { Icons } from '../../Icons';

const symbol = <Icons.Check size={16} />;

describe('StatusPille', () => {
  it('@HT-045 zeigt Symbol und Wort; das Symbol ist dekorativ, der Zustand steht im Wort und in der Randart', () => {
    render(<StatusPille ton="warn" rand="gestrichelt" symbol={symbol} aktion={{ art: 'ausloesen', onClick: vi.fn() }} data-testid="p">Feld 1 nicht bereit</StatusPille>);
    const pille = screen.getByTestId('p');
    expect(pille).toHaveTextContent('Feld 1 nicht bereit');
    const zeichen = pille.querySelector('svg');
    expect(zeichen).not.toBeNull();
    expect(zeichen?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(pille).toHaveAttribute('data-rand', 'gestrichelt');
    expect(pille.style.border).toContain('dashed');
  });

  it('Gegenbeispiel: die feste Randart ist durchgezogen, der Ton ändert die Randart nicht', () => {
    render(<StatusPille ton="ok" symbol={symbol} aktion={{ art: 'ausloesen', onClick: vi.fn() }} data-testid="p">bereit</StatusPille>);
    expect(screen.getByTestId('p').style.border).toContain('solid');
    expect(screen.getByTestId('p')).toHaveAttribute('data-rand', 'fest');
  });

  it('@HT-045 die Tippfläche ist mindestens so hoch wie touchTargets.minimum (44 px)', () => {
    render(<StatusPille ton="ok" symbol={symbol} aktion={{ art: 'ausloesen', onClick: vi.fn() }} data-testid="p">bereit</StatusPille>);
    expect(screen.getByTestId('p').style.minHeight).toBe(cssVars.touchTargets.minimum);
  });

  it('@HT-045 der Text bricht um, statt mit „…“ gekürzt zu werden', () => {
    render(<StatusPille ton="ok" symbol={symbol} aktion={{ art: 'ausloesen', onClick: vi.fn() }} data-testid="p">Lautsprecher Feld 1, 2 nicht bereit – keine Verbindung</StatusPille>);
    const stil = screen.getByTestId('p').style;
    expect(stil.overflowWrap).toBe('break-word');
    expect(stil.textOverflow).toBe('');
    expect(stil.whiteSpace).not.toBe('nowrap');
    expect(stil.maxWidth).toBe('100%');
  });

  it('hell und dunkel kommen aus Tokens: im Stil steht kein festes Farbliteral', () => {
    render(<StatusPille ton="info" symbol={symbol} aktion={{ art: 'ausloesen', onClick: vi.fn() }} data-testid="p">Probe läuft</StatusPille>);
    const stil = screen.getByTestId('p').getAttribute('style') ?? '';
    expect(stil).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(stil).not.toMatch(/rgba?\(/i);
    expect(stil).toContain('var(--color-');
  });

  it('@HT-045 „navigiere“ meldet das Ziel an den Gastgeber', async () => {
    const onNavigiere = vi.fn();
    render(<StatusPille ton="ok" symbol={symbol} aktion={{ art: 'navigiere', ziel: '/tournament/t1/admin/hallenton' }} onNavigiere={onNavigiere} data-testid="p">bereit</StatusPille>);
    await userEvent.setup().click(screen.getByTestId('p'));
    expect(onNavigiere).toHaveBeenCalledExactlyOnceWith('/tournament/t1/admin/hallenton');
  });

  it('Gegenbeispiel: „navigiere“ ohne Gastgeber tut nichts und wirft nicht', async () => {
    render(<StatusPille ton="ok" symbol={symbol} aktion={{ art: 'navigiere', ziel: '/x' }} data-testid="p">bereit</StatusPille>);
    await expect(userEvent.setup().click(screen.getByTestId('p'))).resolves.toBeUndefined();
  });

  it('@HT-045 „ausloesen“ ruft onClick, nicht onNavigiere', async () => {
    const onClick = vi.fn();
    const onNavigiere = vi.fn();
    render(<StatusPille ton="info" symbol={symbol} aktion={{ art: 'ausloesen', onClick }} onNavigiere={onNavigiere} data-testid="p">Prüfen</StatusPille>);
    await userEvent.setup().click(screen.getByTestId('p'));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onNavigiere).not.toHaveBeenCalled();
  });

  it('Tastatur: Tab erreicht die Pille, Enter und Leertaste lösen aus', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<StatusPille ton="ok" symbol={symbol} aktion={{ art: 'ausloesen', onClick }} data-testid="p">bereit</StatusPille>);
    await user.tab();
    expect(screen.getByTestId('p')).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('der Lesetext ersetzt das gekürzte Wort beim Vorlesen', () => {
    render(<StatusPille ton="ok" symbol={symbol} aktion={{ art: 'ausloesen', onClick: vi.fn() }} lesetext="Lautsprecher Feld 1 bereit" data-testid="p">Feld 1 bereit</StatusPille>);
    expect(screen.getByRole('button', { name: 'Lautsprecher Feld 1 bereit' })).toBeInTheDocument();
  });

  it('ohne Aktion ist es eine reine Marke: kein Knopf, keine Mindesthöhe', () => {
    render(<StatusPille ton="neutral" rand="gestrichelt" symbol={symbol} data-testid="p">Status unbekannt</StatusPille>);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('p')).toHaveTextContent('Status unbekannt');
    expect(screen.getByTestId('p').style.minHeight).toBe('');
  });
});
