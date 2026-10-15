/**
 * @OB-056 — Im Dialog „Datenschutz-Einstellungen“ sind beide Antworten gleich
 * gewichtet („Alle akzeptieren“ und „Nur notwendige“ gleich groß und gleich
 * auffällig) und der Dialog spricht „du“ an.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import deSettings from '../../../i18n/locales/de/settings.json';
import { ConsentDialog } from '../ConsentDialog';

function buttons() {
  render(<ConsentDialog isOpen onConsent={vi.fn()} />);
  return {
    accept: screen.getByRole('button', { name: /acceptAll|Alle akzeptieren/ }),
    necessary: screen.getByRole('button', { name: /acceptNecessary|Nur notwendige/ }),
  };
}

describe('@OB-056 Einwilligung – gleich gewichtete Antworten', () => {
  it('„Alle akzeptieren“ und „Nur notwendige“ haben dieselbe Knopf-Variante und Größe', () => {
    const { accept, necessary } = buttons();
    for (const prop of ['background', 'color', 'border', 'padding', 'minHeight', 'fontSize', 'fontWeight'] as const) {
      expect(accept.style[prop], prop).toBe(necessary.style[prop]);
    }
  });

  it('Gegenbeispiel: die Primär-Variante („Alle akzeptieren“ in Primärfarbe) ist nicht mehr da', () => {
    const { accept } = buttons();
    expect(accept.style.background).not.toBe('var(--color-primary)');
  });

  it('der Text spricht Olli mit „du“ an (DE): kein „Sie“/„Ihnen“/„Ihre“ im Dialog', () => {
    const consent = deSettings.consent as Record<string, string>;
    const texts = [consent.title, consent.description, consent.necessaryDescription, consent.optionalDescription];
    for (const text of texts) {
      expect(text).not.toMatch(/\b(Sie|Ihnen|Ihre|Ihr|Ihrem|Ihren)\b/);
    }
  });

  it('die Widerruf-Rückfrage „Einwilligung widerrufen“ spricht ebenfalls „du“ an (DE, @OB-056)', () => {
    const revoke = (deSettings.privacy as Record<string, Record<string, string>>).revoke;
    for (const text of [revoke.confirmMessage, revoke.successMessage]) {
      expect(text).not.toMatch(/\b(Sie|Ihnen|Ihre|Ihr|Ihrem|Ihren|Ihrer)\b/);
    }
  });

  it('Verhalten unverändert: Esc schließt den Dialog nicht und ruft keine Antwort auf', () => {
    const onConsent = vi.fn();
    render(<ConsentDialog isOpen onConsent={onConsent} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onConsent).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
