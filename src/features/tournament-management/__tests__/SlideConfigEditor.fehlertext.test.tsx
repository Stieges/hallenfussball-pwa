/**
 * @ME-076 Der Editor zeigt, was an der Folie fehlt, in Warnfarbe wie die Folienliste; ein echter Feldfehler
 * (z. B. zu lange Überschrift) behält seinen Text und die Fehlerfarbe. Ein fehlendes Feld ist kein Fehler.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../test/realDeI18n';
import type { MonitorSlide } from '../../../types/monitor';
import { SlideConfigEditor } from '../components/SlideConfigEditor';
import { slide } from './monitorEditorTestHarness';

await initRealDeI18n();

function zeige(s: MonitorSlide, fields = [{ id: 'field-1', defaultName: 'Feld 1' }, { id: 'field-2', defaultName: 'Feld 2' }]) {
  render(
    <SlideConfigEditor
      slide={s}
      fields={fields as never}
      groups={[]}
      sponsors={[{ id: 'sp1', name: 'Bäckerei' }]}
      onUpdate={vi.fn()}
      getFieldDisplayName={(id) => id}
      styles={{ inputGroupStyle: {} }}
      showErrors
    />
  );
}

describe('@ME-076 Fehlertexte im Folien-Editor', () => {
  it('Überschrift fehlt: „Überschrift fehlt“ in Warnfarbe, auch am Rand des Feldes', () => {
    zeige(slide('s', 'custom-text', {}));
    const hinweis = screen.getByRole('alert');
    expect(hinweis).toHaveTextContent('Überschrift fehlt');
    expect(hinweis.style.color).toBe('var(--color-warning)');
    expect(screen.getByLabelText(/Überschrift/).style.borderColor).toBe('var(--color-warning)');
  });

  it('Sponsor fehlt: „Sponsor fehlt“ in Warnfarbe', () => {
    zeige(slide('s', 'sponsor', {}));
    const hinweis = screen.getByRole('alert');
    expect(hinweis).toHaveTextContent('Sponsor fehlt');
    expect(hinweis.style.color).toBe('var(--color-warning)');
  });

  it('echter Feldfehler (zu lange Überschrift): sein Text in Fehlerfarbe, nicht „Überschrift fehlt“', () => {
    zeige(slide('s', 'custom-text', { headline: 'x'.repeat(101) }));
    const hinweis = screen.getByRole('alert');
    expect(hinweis).toHaveTextContent('Überschrift darf max. 100 Zeichen lang sein');
    expect(hinweis).not.toHaveTextContent('fehlt');
    expect(hinweis.style.color).toBe('var(--color-error)');
  });

  it('Gegenbeispiel: eingerichtete Folien zeigen keinen Hinweis', () => {
    zeige(slide('s', 'custom-text', { headline: 'Willkommen' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['live', 'schedule-field'] as const)('%s ohne Feld: kein Fehler, kein „Feld fehlt“, das Feld ist kein Pflichtfeld', (typ) => {
    zeige(slide('s', typ, {}));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Feld fehlt/)).toBeNull();
    const auswahl = screen.getByLabelText(/Spielfeld/);
    expect(auswahl).not.toHaveAttribute('aria-required');
    expect(auswahl).not.toHaveAttribute('aria-invalid');
  });

  it('Live-Folie ohne Feldwahl (ein Feld, gewählt): die Zeile „Rotation pausieren“ beginnt ohne leere Lücke darüber', () => {
    zeige(slide('s', 'live', { fieldId: 'field-1' }), [{ id: 'field-1', defaultName: 'Feld 1' }]);
    expect(screen.queryByLabelText(/Spielfeld/)).toBeNull();
    const zeile = screen.getByRole('checkbox').closest('div') as HTMLElement;
    expect(zeile.style.marginTop).toBe('');
  });

  it('Gegenbeispiel: mit Feldwahl darüber bleibt der Abstand', () => {
    zeige(slide('s', 'live', { fieldId: 'field-1' }));
    expect(screen.getByLabelText(/Spielfeld/)).toBeInTheDocument();
    const zeile = screen.getByRole('checkbox').closest('div') as HTMLElement;
    expect(zeile.style.marginTop).not.toBe('');
  });
});
