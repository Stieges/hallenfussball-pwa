/**
 * GraphicUploadField (T5, @W3-030, @W3-040, @DR-040): Feld für eine hochladbare Grafik mit Vorschau, „Ändern“,
 * „Entfernen“, Warnung, Fehlertext und Hinweiszeile. Reine Darstellung; Aufbereiten und Speichern macht der Aufrufer.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { GraphicUploadField, type GraphicUploadFieldProps } from '../GraphicUploadField';

const BILD = 'data:image/png;base64,AAAA';

function zeige(props: Partial<GraphicUploadFieldProps> = {}) {
  const onSelect = vi.fn();
  const onRemove = vi.fn();
  render(
    <GraphicUploadField
      testIdPrefix="turnierlogo"
      label="Turnierlogo"
      optionalHint="(optional)"
      previewAlt="Vorschau Turnierlogo"
      uploadLabel="Logo hochladen"
      changeLabel="Ändern"
      removeLabel="Entfernen"
      formatHint="PNG, JPG oder SVG, bis 2 MB"
      onSelect={onSelect}
      onRemove={onRemove}
      {...props}
    />,
  );
  return { onSelect, onRemove };
}

describe('GraphicUploadField', () => {
  it('ohne Grafik: Taste „Logo hochladen“ und Formathinweis, keine Vorschau, kein „Ändern“/„Entfernen“', () => {
    zeige();
    expect(screen.getByTestId('turnierlogo-hochladen')).toHaveTextContent('Logo hochladen');
    expect(screen.getByText('PNG, JPG oder SVG, bis 2 MB')).toBeInTheDocument();
    expect(screen.queryByTestId('turnierlogo-vorschau')).toBeNull();
    expect(screen.queryByTestId('turnierlogo-aendern')).toBeNull();
    expect(screen.queryByTestId('turnierlogo-entfernen')).toBeNull();
  });

  it('mit Grafik: Vorschau mit Alt-Text, „Ändern“ und „Entfernen“, keine Taste „hochladen“, kein Formathinweis', () => {
    zeige({ src: BILD });
    const vorschau = screen.getByTestId('turnierlogo-vorschau');
    expect(vorschau).toHaveAttribute('src', BILD);
    expect(vorschau).toHaveAccessibleName('Vorschau Turnierlogo');
    expect(vorschau.style.background).toBe('var(--color-surface-paper)'); // Papierfläche, nie eine feste Farbe
    expect(screen.getByTestId('turnierlogo-aendern')).toHaveTextContent('Ändern');
    expect(screen.getByTestId('turnierlogo-entfernen')).toHaveTextContent('Entfernen');
    expect(screen.queryByTestId('turnierlogo-hochladen')).toBeNull();
    expect(screen.queryByText('PNG, JPG oder SVG, bis 2 MB')).toBeNull();
  });

  it('die Gruppe trägt die Beschriftung samt „(optional)“', () => {
    zeige();
    const gruppe = screen.getByRole('group', { name: /Turnierlogo \(optional\)/ });
    expect(gruppe).toBe(screen.getByTestId('turnierlogo-feld'));
  });

  it('Tippflächen mindestens 44 px (Token), auch mit Grafik', () => {
    zeige({ src: BILD });
    for (const id of ['turnierlogo-aendern', 'turnierlogo-entfernen']) {
      expect(screen.getByTestId(id).style.minHeight).toBe('44px');
    }
  });

  it('die Dateiwahl nimmt PNG, JPG und SVG; eine gewählte Datei geht an onSelect, das Feld wird danach geleert', () => {
    const { onSelect } = zeige();
    const eingabe = screen.getByTestId<HTMLInputElement>('turnierlogo-datei');
    expect(eingabe.type).toBe('file');
    expect(eingabe.accept).toContain('image/png');
    expect(eingabe.accept).toContain('image/jpeg');
    expect(eingabe.accept).toContain('image/svg+xml');

    const datei = new File(['x'], 'wappen.png', { type: 'image/png' });
    fireEvent.change(eingabe, { target: { files: [datei] } });

    expect(onSelect).toHaveBeenCalledWith(datei);
    expect(eingabe.value).toBe(''); // dieselbe Datei lässt sich danach erneut wählen
  });

  it('Gegenbeispiel: ohne gewählte Datei kein onSelect', () => {
    const { onSelect } = zeige();
    fireEvent.change(screen.getByTestId('turnierlogo-datei'), { target: { files: [] } });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('„Entfernen“ ruft onRemove', () => {
    const { onRemove } = zeige({ src: BILD });
    fireEvent.click(screen.getByTestId('turnierlogo-entfernen'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('Warnung als Hinweis (role status), Fehler als Meldung (role alert), je mit Text und Symbol', () => {
    zeige({ src: BILD, warning: 'Das Logo ist nur 141 Bildpunkte hoch.', error: 'Diese Datei wurde nicht übernommen.' });
    const warnung = screen.getByTestId('turnierlogo-warnung');
    const fehler = screen.getByTestId('turnierlogo-fehler');
    expect(warnung).toHaveAttribute('role', 'status');
    expect(warnung).toHaveTextContent('Das Logo ist nur 141 Bildpunkte hoch.');
    expect(fehler).toHaveAttribute('role', 'alert');
    expect(fehler).toHaveTextContent('Diese Datei wurde nicht übernommen.');
    expect(warnung.querySelector('svg')).not.toBeNull();
    expect(fehler.querySelector('svg')).not.toBeNull();
  });

  it('Gegenbeispiel: ohne Warnung und Fehler stehen keine Meldungen im Feld', () => {
    zeige({ src: BILD });
    expect(screen.queryByTestId('turnierlogo-warnung')).toBeNull();
    expect(screen.queryByTestId('turnierlogo-fehler')).toBeNull();
  });

  it('die Hinweiszeile steht im Feld und nach den Tasten; ohne deviceHint gibt es keine', () => {
    zeige({ src: BILD, deviceHint: 'Nur auf diesem Gerät gespeichert.' });
    const feld = screen.getByTestId('turnierlogo-feld');
    const hinweis = within(feld).getByTestId('turnierlogo-geraet');
    expect(hinweis).toHaveTextContent('Nur auf diesem Gerät gespeichert.');
    expect(screen.getByTestId('turnierlogo-entfernen').compareDocumentPosition(hinweis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Gegenbeispiel: ohne deviceHint keine Hinweiszeile', () => {
    zeige();
    expect(screen.queryByTestId('turnierlogo-geraet')).toBeNull();
  });

  it('children (die Farbzeile) stehen zwischen den Tasten und der Warnung', () => {
    zeige({ src: BILD, warning: 'Warnung', children: <span data-testid="farbzeile">Farbe</span> });
    const farbzeile = screen.getByTestId('farbzeile');
    expect(screen.getByTestId('turnierlogo-entfernen').compareDocumentPosition(farbzeile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(farbzeile.compareDocumentPosition(screen.getByTestId('turnierlogo-warnung')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('das zweite Feld trägt sein eigenes Präfix (zweite-grafik-…)', () => {
    zeige({ testIdPrefix: 'zweite-grafik', label: 'Zweite Grafik rechts' });
    expect(screen.getByTestId('zweite-grafik-feld')).toBeInTheDocument();
    expect(screen.getByTestId('zweite-grafik-hochladen')).toBeInTheDocument();
    expect(screen.queryByTestId('turnierlogo-feld')).toBeNull();
  });
});
