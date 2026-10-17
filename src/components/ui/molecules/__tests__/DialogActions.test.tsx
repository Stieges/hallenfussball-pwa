/**
 * @OB-061 (Tasten im Dialog-Fuß einzeilig nebeneinander oder untereinander, Haupttaste unten), @OB-022 (Haupttaste ≥ 56 px).
 * jsdom hat kein Layout: Hier steht der Vertrag, aus dem der Browser die Anordnung ableitet (umbrechende Flex-Zeile,
 * einzeilige Beschriftung, Haupttaste zuletzt, keine Gerätebreite). Die echte Anordnung bei 1440×900 und 360×640 prüft
 * tests/e2e/dialog-actions.spec.ts am PDF-Dialog.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DialogActions } from '../DialogActions';

const renderPdf = (extra: Partial<React.ComponentProps<typeof DialogActions>> = {}) => {
  const onCancel = vi.fn();
  const onSave = vi.fn();
  render(
    <DialogActions
      secondary={[{ label: 'Abbrechen', onClick: onCancel, 'data-testid': 'cancel' }]}
      primary={{ label: 'Als PDF speichern', onClick: onSave, 'data-testid': 'save' }}
      {...extra}
    />,
  );
  return { onCancel, onSave };
};

describe('DialogActions', () => {
  it('Haupttaste steht zuletzt (unten bzw. rechts), Nebentaste davor', () => {
    renderPdf();
    const tasten = screen.getAllByRole('button').map((b) => b.textContent);
    expect(tasten).toEqual(['Abbrechen', 'Als PDF speichern']);
  });

  it('mit mehreren Nebentasten bleibt die Haupttaste die letzte', () => {
    render(
      <DialogActions
        secondary={[{ label: 'Eins', onClick: vi.fn() }, { label: 'Zwei', onClick: vi.fn() }]}
        primary={{ label: 'Haupt', onClick: vi.fn() }}
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Eins', 'Zwei', 'Haupt']);
  });

  it('nebeneinander bei Platz, untereinander bei Platzmangel: umbrechende Zeile, Tasten füllen die Zeile, Beschriftung einzeilig', () => {
    renderPdf();
    const fuss = screen.getByTestId('dialog-actions');
    expect(fuss.style.display).toBe('flex');
    expect(fuss.style.flexWrap).toBe('wrap');
    for (const id of ['cancel', 'save']) {
      const taste = screen.getByTestId(id);
      expect(taste.style.whiteSpace).toBe('nowrap');
      expect(taste.style.flexGrow).toBe('1');
      expect(taste.style.flexShrink).toBe('1');
      // Flex-Basis auto: Mindestbreite = einzeilige Beschriftung (sonst stapelt die Zeile immer)
      expect(taste.style.flexBasis).toBe('auto');
    }
  });

  it('entscheidet nicht nach Gerätebreite (kein fester Umschaltwert, keine Fensterbreite im Quelltext)', () => {
    renderPdf();
    const fuss = screen.getByTestId('dialog-actions');
    expect(fuss.style.flexDirection).toBe('');
    const quelle = readFileSync(join(__dirname, '..', 'DialogActions.tsx'), 'utf8');
    expect(quelle).not.toMatch(/innerWidth|matchMedia|useMediaQuery|useBreakpoint|@media/);
  });

  it('kürzt nie: kein text-overflow, kein Abschneiden, kein „…“ im Text', () => {
    renderPdf();
    for (const id of ['cancel', 'save']) {
      const taste = screen.getByTestId(id);
      expect(taste.style.textOverflow).toBe('');
      expect(taste.style.overflow).toBe('');
      expect(taste.textContent).not.toMatch(/…|\.\.\./);
    }
    expect(screen.getByTestId('save').textContent).toBe('Als PDF speichern');
  });

  it('Haupttaste ≥ 56 px (Token), Nebentaste ≥ 44 px (Token), Haupttaste für die Prüfung markiert', () => {
    renderPdf();
    expect(screen.getByTestId('save').style.minHeight).toBe('var(--touch-target-primary)');
    expect(screen.getByTestId('cancel').style.minHeight).toBe('var(--touch-target-minimum)');
    expect(screen.getByTestId('save').hasAttribute('data-primary')).toBe(true);
    expect(screen.getByTestId('cancel').hasAttribute('data-primary')).toBe(false);
    expect(screen.getByTestId('dialog-actions').hasAttribute('data-dialog-actions')).toBe(true);
  });

  it('Tasten lösen ihre Aktion aus; gesperrte Taste nicht', () => {
    const { onCancel, onSave } = renderPdf({ primary: { label: 'Als PDF speichern', onClick: vi.fn(), disabled: true, 'data-testid': 'save' } });
    fireEvent.click(screen.getByTestId('save'));
    fireEvent.click(screen.getByTestId('cancel'));
    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: nur Haupttaste („Schließen“) steht allein, ohne Nebentaste', () => {
    render(<DialogActions primary={{ label: 'Schließen', onClick: vi.fn(), 'data-testid': 'close' }} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTestId('close').style.minHeight).toBe('var(--touch-target-primary)');
  });
});
