/**
 * @ZM-152 „Die Einstellungen eines Monitors bieten keine eigene Farbe für die Ergebniskästen an“: die Live-Folie hat keine
 * Farbvorlagen, keine Heim-/Gast-Farbe und keinen Schalter „Team-Farben verwenden“ mehr (die Farbe liegt in „Anzeige für Zuschauer“).
 * Gegenbeispiel: die Rotations-Einstellung der Live-Folie bleibt, und die Farbvorlage der Freitext-Folie (andere Sache) ebenso.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next'); vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../../test/realDeI18n';
await initRealDeI18n();

import { SlideConfigEditor } from '../SlideConfigEditor';
import type { MonitorSlide, SlideType } from '../../../../types/monitor';

function zeige(type: SlideType) {
  const slide: MonitorSlide = { id: 's1', type, config: { fieldId: 'field-1' }, duration: null, order: 0 };
  return render(
    <SlideConfigEditor
      slide={slide}
      fields={[{ id: 'field-1', defaultName: 'Feld 1' }]}
      groups={[]}
      sponsors={[]}
      onUpdate={vi.fn()}
      getFieldDisplayName={(id) => id}
      styles={{}}
    />,
  );
}

describe('@ZM-152 Einstellungen der Live-Folie bieten keine eigene Farbe an', () => {
  it('@ZM-152 Live-Folie: keine Score-Farben, keine Heim-/Gast-Farbe, kein „Team-Farben verwenden“, keine Farbvorlagen', () => {
    const { container } = zeige('live');
    expect(screen.queryByText('Score-Farben')).toBeNull();
    expect(screen.queryByText('Heim-Farbe')).toBeNull();
    expect(screen.queryByText('Gast-Farbe')).toBeNull();
    expect(screen.queryByText(/Team-Farben verwenden/)).toBeNull();
    expect(container.querySelector('[aria-label^="Farbschema"]')).toBeNull();
    expect(container.querySelector('input[type="color"]')).toBeNull();
  });

  it('Gegenbeispiel: „Rotation bei laufendem Spiel pausieren“ bleibt an der Live-Folie', () => {
    zeige('live');
    expect(screen.getByLabelText(/Rotation bei laufendem Spiel pausieren/)).toBeInTheDocument();
  });

  it('Gegenbeispiel: die Farbvorlage der Freitext-Folie bleibt (keine Ergebniskästen)', () => {
    zeige('custom-text');
    expect(screen.getByText('Farbschema')).toBeInTheDocument();
  });
});
