/**
 * @TS-021 Sortierkopf: per Tastatur bedienbar, Name nennt Spalte und Richtung, Touch-Ziel, aria-sort.
 * @TS-014 Kopf „Tore“ zeigt „Gegentore“. Bausteine „Nach Platzierung“ (@TS-005) und „Sortieren nach …“ (@TS-004).
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { SortableHeader } from '../SortableHeader';
import { SortReset } from '../SortReset';
import { SortPicker } from '../SortPicker';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const inTable = (ui: React.ReactElement) => render(<table><thead><tr>{ui}</tr></thead></table>);

describe('SortableHeader', () => {
  it('@TS-021 Enter und Leertaste lösen den Kopf aus, Name „Tore, meiste zuerst sortiert“', async () => {
    const onTap = vi.fn();
    inTable(<SortableHeader column="tore" label="Tore" state={{ column: 'tore', reversed: false }} onTap={onTap} testId="sort-head-gA-tore" />);
    const button = screen.getByRole('button', { name: 'Tore, meiste zuerst sortiert' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onTap).toHaveBeenCalledTimes(2);
    expect(onTap).toHaveBeenCalledWith('tore');
    expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('descending');
  });

  it('@TS-021 Touch-Ziel: minHeight = touchTargets.minimum', () => {
    inTable(<SortableHeader column="pkt" label="Punkte" state={null} onTap={() => undefined} />);
    expect(screen.getByRole('button').style.minHeight).toBe('var(--touch-target-minimum)');
  });

  it('@TS-021 ohne Sortierung: aria-sort none, Name nur die Spalte, kein Pfeil', () => {
    inTable(<SortableHeader column="pkt" label="Punkte" state={null} onTap={() => undefined} />);
    expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('none');
    expect(screen.getByRole('button', { name: 'Punkte' }).querySelector('svg')).toBeNull();
  });

  it('@TS-021 umgekehrt: Name „wenigste zuerst“, aria-sort ascending, Pfeil + Text', () => {
    inTable(<SortableHeader column="pkt" label="Punkte" state={{ column: 'pkt', reversed: true }} onTap={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Punkte, wenigste zuerst sortiert' }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('ascending');
  });

  it('@TS-021 Team A–Z: „A bis Z sortiert“, umgekehrt „Z bis A“', () => {
    const { rerender } = inTable(<SortableHeader column="team" label="Team" state={{ column: 'team', reversed: false }} onTap={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Team, A bis Z sortiert' })).toBeTruthy();
    rerender(<table><thead><tr><SortableHeader column="team" label="Team" state={{ column: 'team', reversed: true }} onTap={() => undefined} /></tr></thead></table>);
    expect(screen.getByRole('button', { name: 'Team, Z bis A sortiert' })).toBeTruthy();
  });

  it('@TS-014 Kopf „Tore“ zeigt „Gegentore“, wenn nach Gegentoren sortiert ist', () => {
    inTable(<SortableHeader column="tore" label="Tore" state={{ column: 'gegentore', reversed: false }} onTap={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Gegentore, wenigste zuerst sortiert' }).textContent).toBe('Gegentore');
  });

  it('@TS-021 as="div" ist ein columnheader mit aria-sort', () => {
    render(<SortableHeader as="div" column="tore" label="Tore" state={null} onTap={() => undefined} />);
    expect(screen.getByRole('columnheader').tagName).toBe('DIV');
  });
});

describe('SortReset und SortPicker', () => {
  it('@TS-005 Taste „Nach Platzierung“ nur sichtbar, wenn sortiert ist', () => {
    const onReset = vi.fn();
    const { rerender } = render(<SortReset visible={false} onReset={onReset} />);
    expect(screen.queryByTestId('sort-reset')).toBeNull();
    rerender(<SortReset visible onReset={onReset} testId="sort-reset-gA" />);
    fireEvent.click(screen.getByTestId('sort-reset-gA'));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Nach Platzierung' })).toBeTruthy();
  });

  it('@TS-004 Auswahl „Sortieren nach …“: natives select, Schrift 16 px, Platzierung zuerst, Wahl meldet SortState', () => {
    const onChange = vi.fn();
    render(
      <SortPicker
        options={[{ value: { column: 'pkt', reversed: false }, label: 'Punkte' }, { value: { column: 'team', reversed: true }, label: 'Team Z–A' }]}
        state={null}
        onChange={onChange}
        testId="sort-picker-gA"
      />,
    );
    const select = screen.getByLabelText<HTMLSelectElement>('Sortieren nach …');
    expect(select.tagName).toBe('SELECT');
    expect(select.style.fontSize).toBe('var(--font-size-lg)');
    expect([...select.options].map((o) => o.text)).toEqual(['Nach Platzierung', 'Punkte', 'Team Z–A']);
    fireEvent.change(select, { target: { value: 'team.r' } });
    expect(onChange).toHaveBeenCalledWith({ column: 'team', reversed: true });
    fireEvent.change(select, { target: { value: 'platz' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
