import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThumbBar, type ThumbBarSlot } from '../ThumbBar';

type Aktion = Extract<ThumbBarSlot, { art: 'aktion' }>;
const a = (label: string, testId: string, rolle: Aktion['rolle'], extra: Partial<Aktion> = {}): Aktion => ({
  art: 'aktion', label, icon: null, onPress: vi.fn(), rolle, testId, ...extra,
});
const vier = (): ThumbBarSlot[] => [
  a('Rückgängig', 'bar-undo', 'neben'),
  a('Pause', 'bar-main', 'haupt'),
  a('Ereignisse', 'bar-events', 'neben'),
  a('Mehr', 'bar-more', 'mehr'),
];

describe('ThumbBar (Plan 3.1)', () => {
  it('zeigt bei daumen die Texte in Slot-Reihenfolge; Haupt-Knopf ≥ 56 px, übrige ≥ 44 px; jeder Knopf hat Text', async () => {
    const slots = vier();
    render(<ThumbBar ariaLabel="Spielsteuerung" layout="daumen" slots={slots} />);
    const bar = screen.getByRole('toolbar', { name: 'Spielsteuerung' });
    expect(within(bar).getAllByRole('button').map((b) => b.textContent)).toEqual(['Rückgängig', 'Pause', 'Ereignisse', 'Mehr']);
    expect(screen.getByTestId('bar-main').style.minHeight).toBe('var(--touch-target-primary)');
    expect(screen.getByTestId('bar-undo').style.minHeight).toBe('var(--touch-target-minimum)');
    expect(screen.getByTestId('bar-more').style.minHeight).toBe('var(--touch-target-minimum)');
    await userEvent.click(screen.getByTestId('bar-main'));
    expect((slots[1] as Aktion).onPress).toHaveBeenCalledTimes(1);
  });

  it('@OB-049 hält die Safe-Area unten, links und rechts ein', () => {
    render(<ThumbBar ariaLabel="Spielsteuerung" layout="daumen" slots={[a('Mehr', 'bar-more', 'mehr')]} />);
    const style = screen.getByRole('toolbar').style;
    expect(style.paddingBottom).toContain('env(safe-area-inset-bottom');
    expect(style.paddingLeft).toContain('env(safe-area-inset-left');
    expect(style.paddingRight).toContain('env(safe-area-inset-right');
  });

  it('@HE-043 Hinweiszeile steht über den Knöpfen und ist kein Knopf', () => {
    render(
      <ThumbBar ariaLabel="Spielsteuerung" layout="daumen" slots={[a('Mehr', 'bar-more', 'mehr')]}
        hinweis={{ text: 'Spiel ist beendet – Korrektur über die Turnierleitung', testId: 'bar-finished' }} />,
    );
    const hinweis = screen.getByTestId('bar-finished');
    expect(hinweis).toHaveTextContent('Korrektur über die Turnierleitung');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(hinweis.compareDocumentPosition(screen.getByTestId('bar-more')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Gegenbeispiel: ohne Haupt-Aktion kein leerer Mittelknopf', () => {
    render(<ThumbBar ariaLabel="Spielsteuerung" layout="daumen" slots={[a('Ereignisse', 'bar-events', 'neben'), a('Mehr', 'bar-more', 'mehr')]} />);
    expect(screen.queryByTestId('bar-main')).toBeNull();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Ereignisse', 'Mehr']);
  });

  it('@SL-153 bei breit zeigt der Pause-Knopf den Tasten-Hinweis „Leertaste“, bei daumen nicht; aria-keyshortcuts="Space" in beiden', () => {
    const slots = (): ThumbBarSlot[] => [a('Pause', 'bar-main', 'haupt', { taste: { text: 'Leertaste', aria: 'Space' } })];
    const { unmount } = render(<ThumbBar ariaLabel="x" layout="breit" slots={slots()} />);
    const breit = screen.getByTestId('bar-main');
    expect(within(breit).getByText('Leertaste').tagName).toBe('KBD');
    expect(within(breit).getByText('Leertaste')).toHaveAttribute('aria-hidden', 'true');
    expect(breit).toHaveAttribute('aria-keyshortcuts', 'Space');
    unmount();
    render(<ThumbBar ariaLabel="x" layout="daumen" slots={slots()} />);
    const daumen = screen.getByTestId('bar-main');
    expect(within(daumen).queryByText('Leertaste')).toBeNull();
    expect(daumen).toHaveAttribute('aria-keyshortcuts', 'Space');
  });

  it('@SL-153 Rückgängig mit taste.aria = „Control+Z Meta+Z“ trägt genau diesen Wert', () => {
    render(<ThumbBar ariaLabel="x" layout="breit" slots={[a('Rückgängig', 'bar-undo', 'neben', { taste: { text: 'Strg+Z', aria: 'Control+Z Meta+Z' } })]} />);
    expect(screen.getByTestId('bar-undo')).toHaveAttribute('aria-keyshortcuts', 'Control+Z Meta+Z');
  });

  it('Gegenbeispiel: ohne taste kein aria-keyshortcuts', () => {
    render(<ThumbBar ariaLabel="x" layout="breit" slots={[a('Mehr', 'bar-more', 'mehr')]} />);
    expect(screen.getByTestId('bar-more')).not.toHaveAttribute('aria-keyshortcuts');
  });

  it('fünf Plätze bei daumen: Reihenfolge bleibt, alle Zellen ≥ 44 px Mindestbreite', () => {
    const slots: ThumbBarSlot[] = [
      a('Rückgängig', 'bar-undo', 'neben'),
      a('Pause', 'bar-main', 'haupt'),
      a('Ereignisse', 'bar-events', 'neben'),
      { art: 'halten', halten: { label: 'Abpfiff', sublabel: 'halten', onHold: vi.fn(), testId: 'bar-abpfiff', beschreibung: 'Gedrückt halten, etwa eine Sekunde' } },
      a('Mehr', 'bar-more', 'mehr'),
    ];
    render(<ThumbBar ariaLabel="x" layout="daumen" slots={slots} />);
    // Halteknopf: zugänglicher Name statt textContent (die versteckte Beschreibung steht im Text)
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Rückgängig', 'Pause', 'Ereignisse', 'Abpfiff halten', 'Mehr']);
    for (const id of ['bar-undo', 'bar-main', 'bar-events', 'bar-abpfiff', 'bar-more']) {
      expect(screen.getByTestId(id).style.minWidth).toBe('var(--touch-target-minimum)');
    }
  });

  it('@SL-157 ein Halte-Slot rendert den Halteknopf mit Füllung', () => {
    const slots: ThumbBarSlot[] = [
      { art: 'halten', halten: { label: 'Abpfiff', sublabel: 'halten', onHold: vi.fn(), testId: 'bar-abpfiff', beschreibung: 'Gedrückt halten, etwa eine Sekunde' } },
    ];
    render(<ThumbBar ariaLabel="x" layout="breit" slots={slots} />);
    expect(screen.getByRole('button', { name: 'Abpfiff halten' })).toBeInTheDocument();
    expect(screen.getByTestId('bar-abpfiff-fuellung')).toBeInTheDocument();
  });

  it('breit: data-layout gesetzt; Slots in einer Reihe', () => {
    render(<ThumbBar ariaLabel="x" layout="breit" slots={vier()} />);
    expect(screen.getByRole('toolbar')).toHaveAttribute('data-layout', 'breit');
  });

  it('disabled Aktion ist nicht auslösbar', async () => {
    const slot = a('Pause', 'bar-main', 'haupt', { disabled: true });
    render(<ThumbBar ariaLabel="x" layout="daumen" slots={[slot]} />);
    await userEvent.click(screen.getByTestId('bar-main'));
    expect(slot.onPress).not.toHaveBeenCalled();
  });

  describe('S5 Werkzeugleiste: Pfeiltasten wechseln den Fokus, nur ein Knopf ist per Tab erreichbar', () => {
    const mitHalten = (): ThumbBarSlot[] => [
      a('Rückgängig', 'bar-undo', 'neben'),
      a('Pause', 'bar-main', 'haupt'),
      { art: 'halten', halten: { label: 'Abpfiff', sublabel: 'halten', onHold: vi.fn(), testId: 'bar-abpfiff', beschreibung: 'Gedrückt halten' } },
      a('Mehr', 'bar-more', 'mehr'),
    ];

    it('Roving Tabindex: genau ein Knopf hat tabindex 0, die übrigen -1 (auch der Halteknopf)', () => {
      render(<ThumbBar ariaLabel="x" layout="daumen" slots={mitHalten()} />);
      const knoepfe = screen.getAllByRole('button');
      expect(knoepfe.filter((b) => b.getAttribute('tabindex') === '0')).toHaveLength(1);
      expect(knoepfe.filter((b) => b.getAttribute('tabindex') === '-1')).toHaveLength(3);
      expect(screen.getByTestId('bar-undo')).toHaveAttribute('tabindex', '0');
    });

    it('Pfeil rechts/links wechselt zum nächsten/vorigen Knopf und nimmt den Tabstopp mit; am Rand bleibt es stehen', async () => {
      const u = userEvent.setup();
      render(<ThumbBar ariaLabel="x" layout="daumen" slots={mitHalten()} />);
      screen.getByTestId('bar-undo').focus();
      await u.keyboard('{ArrowRight}');
      expect(screen.getByTestId('bar-main')).toHaveFocus();
      expect(screen.getByTestId('bar-main')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('bar-undo')).toHaveAttribute('tabindex', '-1');
      await u.keyboard('{ArrowRight}');
      expect(screen.getByTestId('bar-abpfiff')).toHaveFocus();
      await u.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
      expect(screen.getByTestId('bar-undo')).toHaveFocus();
    });

    it('Pos1 und Ende springen an die Ränder; ein gesperrter Knopf wird übersprungen', async () => {
      const u = userEvent.setup();
      const slots = mitHalten();
      slots[1] = a('Pause', 'bar-main', 'haupt', { disabled: true });
      render(<ThumbBar ariaLabel="x" layout="daumen" slots={slots} />);
      screen.getByTestId('bar-undo').focus();
      await u.keyboard('{ArrowRight}');
      expect(screen.getByTestId('bar-abpfiff')).toHaveFocus();
      await u.keyboard('{End}');
      expect(screen.getByTestId('bar-more')).toHaveFocus();
      await u.keyboard('{Home}');
      expect(screen.getByTestId('bar-undo')).toHaveFocus();
    });

    it('Gegenbeispiel: Pfeil nach oben/unten ändert den Fokus nicht', async () => {
      const u = userEvent.setup();
      render(<ThumbBar ariaLabel="x" layout="daumen" slots={mitHalten()} />);
      screen.getByTestId('bar-main').focus();
      await u.keyboard('{ArrowDown}{ArrowUp}');
      expect(screen.getByTestId('bar-main')).toHaveFocus();
    });
  });

  it('ariaLabel nennt mehr als der sichtbare Text und enthält ihn (WCAG 2.5.3, Rückgängig mit Ziel)', () => {
    render(<ThumbBar ariaLabel="x" layout="daumen" slots={[a('Rückgängig', 'bar-undo', 'neben', { ariaLabel: 'Rückgängig: Tor Nr. 7 zurücknehmen' })]} />);
    expect(screen.getByRole('button', { name: 'Rückgängig: Tor Nr. 7 zurücknehmen' })).toHaveTextContent('Rückgängig');
  });
});
