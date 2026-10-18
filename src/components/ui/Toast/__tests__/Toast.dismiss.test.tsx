/**
 * Paket 3 (Befund C-TOAST-SCHLIESSEN-ZEICHEN): Der Schließen-Knopf zeigte die Escape-Folge als Text
 * statt des Zeichens. Der Knopf muss ein Symbol zeigen, einen über i18n gebildeten zugänglichen Namen
 * haben und ein Touch-Ziel von mindestens 44 px nutzen.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { Toast } from '../Toast';

describe('Toast – Schließen-Knopf (Paket 3)', () => {
  beforeAll(async () => {
    await initRealDeI18n();
  });

  function renderToast() {
    return render(
      <Toast id="t1" type="info" message="Gespeichert" onDismiss={vi.fn()} duration={0} />,
    );
  }

  it('hat die Rolle button und den deutschen Namen „Hinweis schließen"', () => {
    renderToast();
    expect(screen.getByRole('button', { name: 'Hinweis schließen' })).toBeInTheDocument();
  });

  it('zeigt kein wörtliches „\\u00D7" und kein „×" als Text', () => {
    renderToast();
    const knopf = screen.getByRole('button', { name: 'Hinweis schließen' });
    expect(knopf.textContent).not.toContain('×');
    expect(knopf.textContent).not.toContain('\\u00D7');
  });

  it('zeigt ein Symbol (SVG) statt Text', () => {
    renderToast();
    const knopf = screen.getByRole('button', { name: 'Hinweis schließen' });
    expect(knopf.querySelector('svg')).not.toBeNull();
  });
});
