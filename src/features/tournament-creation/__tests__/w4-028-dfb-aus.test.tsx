/**
 * @W4-028 – DFB-Schlüssel wird nicht angeboten, solange er nicht exakt umgesetzt ist.
 *
 * Gegeben die exakten DFB-Schlüssel (@W4-015) sind noch nicht umgesetzt,
 * wenn die Turnierleitung im Assistenten die Spielplan-Art wählt,
 * dann kann sie keinen DFB-Schlüssel wählen und sieht keinen Schalter dafür.
 * Auch wenn im Entwurf noch useDFBKeys=true steht, erscheint der Block nicht.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Step2_ModeAndSystem } from '../Step2_ModeAndSystem';
import { initRealDeI18n } from '../../../test/realDeI18n';
import type { Tournament } from '../../../types/tournament';
import { ToastProvider } from '../../../components/ui/Toast/ToastContext';

await initRealDeI18n();

const renderStep2 = (formData: Partial<Tournament>) => {
  const onUpdate = vi.fn();
  const utils = render(
    <ToastProvider>
      <Step2_ModeAndSystem
        formData={formData}
        onUpdate={onUpdate}
        onMovePlacementLogic={vi.fn()}
        onTogglePlacementLogic={vi.fn()}
      />
    </ToastProvider>,
  );
  return { ...utils, onUpdate };
};

describe('@W4-028 Schritt Modus/System bietet keinen DFB-Schlüssel an', () => {
  it('@W4-028 ohne gespeicherten Schlüssel: kein DFB-Schalter sichtbar', () => {
    const { container } = renderStep2({ mode: 'classic', groupSystem: 'roundRobin', numberOfTeams: 6, useDFBKeys: false });

    expect(container.querySelector('#dfb-description')).toBeNull();
    expect(container.querySelector('input[aria-describedby="dfb-description"]')).toBeNull();
  });

  it('@W4-028 auch bei formData.useDFBKeys=true: weder Schalter noch Musterauswahl', () => {
    const { container } = renderStep2({
      mode: 'classic',
      groupSystem: 'roundRobin',
      numberOfTeams: 6,
      useDFBKeys: true,
      dfbKeyPattern: '1T06M',
    });

    expect(container.querySelector('#dfb-description')).toBeNull();
    expect(container.querySelector('input[type="checkbox"][aria-describedby="dfb-description"]')).toBeNull();
    expect(container.querySelector('[role="region"][aria-label]')).toBeNull();
  });
});
