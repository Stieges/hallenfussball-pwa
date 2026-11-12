/**
 * Einstellung „Leibchenfarben dieses Turniers“ im Assistenten (@W3-029, @W3-041): bis zu zwei Hallenfarben aus den Trikotfarben plus Neongrün, jede mit ihrem
 * Namen als Wort, die Regel „Bei gleicher Trikotfarbe zieht die Leibchen an“ (Heim Vorgabe, oder Gast). Testwerte aus dem Gherkin
 * (docs/anforderungen/2026-09-27_wizard-turniertag-vorbereiten.md).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { leibchenFarbName } from '../../../../core/models/kitChoice';
import { BibColorsSettings } from '../BibColorsSettings';
import { bibColorPresets, palette } from '../../../../design-tokens/colors/palette';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../../test/realDeI18n';
await initRealDeI18n();

const J = palette.jersey;

function aufbau(formData: Parameters<typeof BibColorsSettings>[0]['formData'] = {}) {
  const onUpdate = vi.fn();
  render(<BibColorsSettings formData={formData} onUpdate={onUpdate} />);
  return { onUpdate, user: userEvent.setup() };
}

describe('@W3-029 Leibchenfarben dieses Turniers', () => {
  it('@W3-029 die Auswahl ist die Trikot-Palette plus Neongrün, jede Farbe mit Namen als Wort', () => {
    aufbau();
    expect(bibColorPresets).toContain(J.neonGreen);
    for (const farbe of bibColorPresets) { const name = leibchenFarbName(farbe); expect(name).not.toBeNull(); expect(screen.getByTestId(`wizard-bib-farbe-${name ?? ''}`).textContent?.length).toBeGreaterThan(2); }
    expect(screen.getByTestId('wizard-bib-farbe-neongruen')).toHaveTextContent('Neongrün');
    expect(screen.getByTestId('wizard-bib-farbe-gelb')).toHaveTextContent('Gelb');
  });

  it('@W3-029 Gelb und Orange gewählt: bibColors in der Reihenfolge der Eintragung, bibColor = erste', async () => {
    const { onUpdate, user } = aufbau();
    await user.click(screen.getByTestId('wizard-bib-farbe-gelb'));
    expect(onUpdate).toHaveBeenCalledWith('bibColors', [J.yellow.toUpperCase()]);
    expect(onUpdate).toHaveBeenCalledWith('bibColor', J.yellow.toUpperCase());
  });

  it('@W3-029 die zweite Farbe wird angehängt, die gewählten tragen ihre Stelle in Klammern und im Namen für Vorlesen', () => {
    aufbau({ bibColors: [J.yellow.toUpperCase(), J.orange.toUpperCase()] });
    expect(screen.getByTestId('wizard-bib-farbe-gelb')).toHaveTextContent('Gelb (1)');
    expect(screen.getByTestId('wizard-bib-farbe-orange')).toHaveTextContent('Orange (2)');
    expect(screen.getByTestId('wizard-bib-farbe-orange')).toHaveAccessibleName('Orange, gewählt als 2. Farbe');
  });

  it('@W3-029 Gegenbeispiel: eine dritte Farbe wird nicht angenommen (höchstens zwei)', async () => {
    const { onUpdate, user } = aufbau({ bibColors: [J.yellow.toUpperCase(), J.orange.toUpperCase()] });
    await user.click(screen.getByTestId('wizard-bib-farbe-pink'));
    expect(onUpdate).toHaveBeenCalledWith('bibColors', [J.yellow.toUpperCase(), J.orange.toUpperCase()]);
  });

  it('@W3-029 eine gewählte Farbe lässt sich wieder abwählen; die zweite rückt nach vorn', async () => {
    const { onUpdate, user } = aufbau({ bibColors: [J.yellow.toUpperCase(), J.orange.toUpperCase()] });
    await user.click(screen.getByTestId('wizard-bib-farbe-gelb'));
    expect(onUpdate).toHaveBeenCalledWith('bibColors', [J.orange.toUpperCase()]);
    expect(onUpdate).toHaveBeenCalledWith('bibColor', J.orange.toUpperCase());
  });

  it('@W3-029 das alte einzelne bibColor gilt als erste Hallenfarbe', () => {
    aufbau({ bibColor: J.orange });
    expect(screen.getByTestId('wizard-bib-farbe-orange')).toHaveTextContent('Orange (1)');
  });
});

describe('@W3-041 Bei gleicher Farbe zieht', () => {
  it('@W3-041 Vorgabe ist die erstgenannte Mannschaft (Heim); „Gast“ stellt um', async () => {
    const { onUpdate, user } = aufbau();
    expect(screen.getByTestId('wizard-bib-regel-heim')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('wizard-bib-regel-gast')).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByTestId('wizard-bib-regel-gast'));
    expect(onUpdate).toHaveBeenCalledWith('bibRule', 'away');
  });

  it('@W3-041 Gegenbeispiel: mit Regel Gast ist „Gast“ gewählt, „Heim“ nicht', () => {
    aufbau({ bibRule: 'away' });
    expect(screen.getByTestId('wizard-bib-regel-gast')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('wizard-bib-regel-heim')).toHaveAttribute('aria-pressed', 'false');
  });
});
