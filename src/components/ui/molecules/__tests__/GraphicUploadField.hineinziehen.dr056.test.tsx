/**
 * @DR-056 Das Turnierlogo lässt sich auch hineinziehen: GraphicUploadField (reine Darstellung) nimmt eine abgelegte Datei
 * wie die Dateiwahl an, zeigt beim Darüberhalten den Ablege-Zustand und meldet mehrere oder keine Dateien zurück.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GraphicUploadField, type GraphicUploadFieldProps } from '../GraphicUploadField';

const BILD = 'data:image/png;base64,AAAA';
const datei = (name = 'wappen.svg', type = 'image/svg+xml'): File => new File(['x'], name, { type });
const mitDateien = (files: File[]) => ({ dataTransfer: { types: ['Files'], files, dropEffect: 'none' } });

function zeige(props: Partial<GraphicUploadFieldProps> = {}) {
  const onSelect = vi.fn();
  const onRemove = vi.fn();
  const onDropRejected = vi.fn();
  render(
    <GraphicUploadField
      testIdPrefix="turnierlogo" label="Turnierlogo" optionalHint="(optional)" previewAlt="Vorschau" uploadLabel="Logo hochladen"
      changeLabel="Ändern" removeLabel="Entfernen" formatHint="PNG, JPG oder SVG, bis 2 MB" dropHint="Hier ablegen"
      onSelect={onSelect} onRemove={onRemove} onDropRejected={onDropRejected} {...props}
    />,
  );
  return { onSelect, onDropRejected, feld: screen.getByTestId('turnierlogo-feld') };
}

describe('@DR-056 Hineinziehen ins Feld', () => {
  it('eine abgelegte Datei geht wie die Dateiwahl an onSelect (ohne und mit hinterlegter Grafik)', () => {
    for (const src of [undefined, BILD]) {
      const { onSelect, feld } = zeige({ src });
      const wappen = datei();
      fireEvent.drop(feld, mitDateien([wappen]));
      expect(onSelect).toHaveBeenCalledWith(wappen);
      expect(onSelect).toHaveBeenCalledTimes(1);
      document.body.innerHTML = '';
    }
  });

  it('Ablege-Zustand: über dem Feld zeigt es „Hier ablegen“, nach dem Verlassen ist er weg', () => {
    const { feld } = zeige();
    expect(screen.queryByTestId('turnierlogo-ablegen')).toBeNull();
    expect(feld).not.toHaveAttribute('data-drop-over');

    fireEvent.dragEnter(feld, mitDateien([]));
    expect(screen.getByTestId('turnierlogo-ablegen')).toHaveTextContent('Hier ablegen');
    expect(feld).toHaveAttribute('data-drop-over', 'true');

    fireEvent.dragLeave(feld, mitDateien([]));
    expect(screen.queryByTestId('turnierlogo-ablegen')).toBeNull();
  });

  it('Ruhezustand: das Feld trägt weder Rand noch Innenabstand (das Layout bleibt wie vor dem Hineinziehen)', () => {
    const { feld } = zeige();
    expect(feld.style.padding).toBe('');
    expect(feld.style.border).toBe('');
    expect(feld.style.outline).toBe('');
  });

  it('Gegenbeispiel: Ziehen über ein Kindelement (Enter innen, Leave außen) lässt den Zustand stehen', () => {
    const { feld } = zeige();
    const taste = screen.getByTestId('turnierlogo-hochladen');
    fireEvent.dragEnter(feld, mitDateien([]));
    fireEvent.dragEnter(taste, mitDateien([]));
    fireEvent.dragLeave(feld, mitDateien([]));
    expect(screen.getByTestId('turnierlogo-ablegen')).toBeInTheDocument();
    fireEvent.dragLeave(taste, mitDateien([]));
    expect(screen.queryByTestId('turnierlogo-ablegen')).toBeNull();
  });

  it('nach dem Ablegen endet der Ablege-Zustand', () => {
    const { feld } = zeige();
    fireEvent.dragEnter(feld, mitDateien([]));
    fireEvent.drop(feld, mitDateien([datei()]));
    expect(screen.queryByTestId('turnierlogo-ablegen')).toBeNull();
  });

  it('Gegenbeispiel: zwei Dateien gehen NICHT an onSelect, sondern als „multiple“ an onDropRejected', () => {
    const { onSelect, onDropRejected, feld } = zeige({ src: BILD });
    fireEvent.drop(feld, mitDateien([datei('a.svg'), datei('b.svg')]));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onDropRejected).toHaveBeenCalledWith('multiple');
  });

  it('Gegenbeispiel: etwas ohne Datei (z. B. markierter Text) geht als „none“ an onDropRejected', () => {
    const { onSelect, onDropRejected, feld } = zeige();
    fireEvent.drop(feld, { dataTransfer: { types: ['text/plain'], files: [], dropEffect: 'none' } });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onDropRejected).toHaveBeenCalledWith('none');
  });

  it('Gegenbeispiel: reines Textziehen zeigt keinen Ablege-Zustand', () => {
    const { feld } = zeige();
    fireEvent.dragEnter(feld, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(screen.queryByTestId('turnierlogo-ablegen')).toBeNull();
  });

  it('Gegenbeispiel: während die Aufbereitung läuft, wird nichts angenommen', () => {
    const { onSelect, onDropRejected, feld } = zeige({ busy: true });
    fireEvent.drop(feld, mitDateien([datei()]));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onDropRejected).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ohne dropHint nimmt das Feld nichts per Ziehen an (bisheriges Verhalten)', () => {
    const { onSelect, feld } = zeige({ dropHint: undefined });
    fireEvent.dragEnter(feld, mitDateien([]));
    fireEvent.drop(feld, mitDateien([datei()]));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByTestId('turnierlogo-ablegen')).toBeNull();
  });

  it('die Taste „Logo hochladen“ und die Dateiwahl bleiben', () => {
    zeige();
    expect(screen.getByTestId('turnierlogo-hochladen')).toHaveTextContent('Logo hochladen');
    expect(screen.getByTestId<HTMLInputElement>('turnierlogo-datei').type).toBe('file');
  });
});
