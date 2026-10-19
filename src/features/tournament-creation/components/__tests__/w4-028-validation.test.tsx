/**
 * @W4-028 – DFB-Schlüssel wird nicht angeboten, solange er nicht exakt umgesetzt ist.
 *
 * Auch ein alter Entwurf mit useDFBKeys=true und einem Muster, dessen Teamzahl nicht passt,
 * zeigt im Schritt Modus/System keinen DFB-Hinweis (keine Aufforderung zu einer Wahl, die es nicht gibt).
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ValidationWarnings } from '../ValidationWarnings';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { ToastProvider } from '../../../../components/ui/Toast/ToastContext';
import type { Tournament } from '../../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

describe('@W4-028 Validierungshinweise ohne DFB-Muster', () => {
  it('@W4-028 Entwurf mit useDFBKeys=true, Muster 1T06M und 8 Teams: kein DFB-Hinweis', () => {
    const formData: Partial<Tournament> = {
      numberOfTeams: 8,
      numberOfFields: 1,
      groupSystem: 'roundRobin',
      useDFBKeys: true,
      dfbKeyPattern: '1T06M',
    };

    const { container } = render(
      <ToastProvider>
        <ValidationWarnings formData={formData} />
      </ToastProvider>,
    );

    expect(container.textContent ?? '').not.toMatch(/DFB/);
  });
});
