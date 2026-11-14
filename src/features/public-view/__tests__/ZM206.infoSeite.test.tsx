/**
 * @ZM-206 Die Info-Seite der Zuschauer-Seite zeigt nichts Technisches („Share-Code“) und nutzt die Symbole der App statt Emoji; jeder Text der
 * Darstellungs-Auswahl (auch „(aktuell: Hell)“) hat mindestens 4,5 : 1 Kontrast, hell wie dunkel. Echte Komponente mit echtem deutschem Wortlaut;
 * die gemessenen Kontrastwerte (axe, hell und dunkel) stehen im Browser-Test `tests/e2e/zuschauer-info-zm206.spec.ts`.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicInfoTab } from '../components/PublicInfoTab';
import { createMockTournament } from '../../../test/factories';
import { cssVars } from '../../../design-tokens';
import { initRealDeI18n } from '../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F500}-\u{1F5FF}☀🔄🌙◐]/u;

function zeigen() {
  return render(
    <PublicInfoTab
      tournament={createMockTournament({ title: 'Nikolaus-Turnier', shareCode: 'WDBF06', isPublic: true })}
      theme="system"
      setTheme={vi.fn()}
      resolvedTheme="light"
    />,
  );
}

describe('@ZM-206 Info-Seite der Zuschauer-Seite', () => {
  it('kein „Share-Code“ und keine technische Kennung; Name, Datum, Ort und Teams bleiben', () => {
    const { container } = zeigen();
    expect(container.textContent).not.toMatch(/share|code/i);
    expect(container.textContent).not.toContain('WDBF06');
    expect(screen.getByText('Nikolaus-Turnier')).toBeInTheDocument();
    expect(container.textContent).toMatch(/Teams/i);
  });

  it('die Auswahl der Darstellung zeigt Symbole der App (SVG), keine Emoji; je Eintrag ein Symbol', () => {
    const { container } = zeigen();
    const auswahl = screen.getAllByRole('radio');
    expect(auswahl).toHaveLength(4);
    for (const eintrag of auswahl) {
      expect(eintrag.querySelector('svg')).not.toBeNull();
      expect(eintrag.textContent ?? '').not.toMatch(EMOJI);
    }
    expect(container.textContent ?? '').not.toMatch(EMOJI);
  });

  it('Gegenbeispiel: der Zusatz „(aktuell: Hell)“ steht bei „System“ und trägt die Schriftfarbe zweiter Ordnung, nicht die blasse dritte Stufe', () => {
    zeigen();
    const zusatz = screen.getByText(/aktuell: Hell/);
    expect(zusatz.style.color).toBe(cssVars.colors.textSecondary);
    expect(zusatz.style.color).not.toBe(cssVars.colors.textTertiary);
  });
});
