/**
 * Admin-Hülle (Seitenleiste und Kopf): Mindestgrößen und Lesbarkeit (C-MATCHCOCKPIT-EINSTELLUNGEN-HART).
 * @OB-022: jede Taste ist mindestens 44 Bildpunkte groß. @OB-025 (Gedanke): ein langer Text wird nicht mit
 * Auslassungspunkten abgeschnitten (visual:metrics `text.abgeschnitten`).
 * jsdom misst keine Pixel; geprüft werden die gesetzten Größen und Stile, die echte Messung ist
 * `npm run visual:metrics` (Ansicht admin-match-cockpit-regeln).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initRealDeI18n } from '../../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

import { AdminSidebar } from '../AdminSidebar';
import { AdminHeader } from '../AdminHeader';

vi.mock('../../../match-engine/useEngineOutboxSummary', () => ({
  useEngineOutboxSummary: () => ({ rejectedCount: 0, reviewCount: 0, entries: [], pendingCount: 0, dismiss: vi.fn() }),
}));
vi.mock('../../../../components/ui/Toast/ToastContext', () => ({ useToast: () => ({ showError: vi.fn() }) }));
vi.mock('../../../collaboration', () => ({
  AwaitingServerCopyLine: () => null,
  SyncStatusIndicator: () => null,
}));

const mindestens44 = (px: string): boolean => /^\d+(\.\d+)?px$/.test(px) && parseFloat(px) >= 44;

describe('Admin-Hülle: Seitenleiste', () => {
  it('@OB-022 „Zurück zum Turnier“ ist mindestens 44 hoch', () => {
    render(<AdminSidebar activeCategory="match-cockpit" onNavigate={vi.fn()} onBackToTournament={vi.fn()} />);
    const knopf = screen.getByText('Zurück zum Turnier').closest('button')!;
    expect(mindestens44(knopf.style.minHeight), `minHeight ${knopf.style.minHeight}`).toBe(true);
  });

  it('visual:metrics text.abgeschnitten: Namen der Bereiche werden umbrochen, nicht mit Auslassungspunkten gekürzt', () => {
    render(<AdminSidebar activeCategory="match-cockpit" onNavigate={vi.fn()} onBackToTournament={vi.fn()} />);
    const bezeichnung = screen.getAllByRole('button').map((b) => b.querySelectorAll('span')[1]).filter(Boolean);
    expect(bezeichnung.length).toBeGreaterThan(3);
    for (const el of bezeichnung) {
      expect(el.style.textOverflow, el.textContent ?? '').not.toBe('ellipsis');
      expect(el.style.whiteSpace, el.textContent ?? '').not.toBe('nowrap');
    }
  });

  it('Kontrast: Gruppenüberschriften und Warnbereich-Text nutzen keine zu blasse Farbe (kein Muted, kein Error-Text auf Rot-Tönung)', () => {
    const { container } = render(
      <AdminSidebar activeCategory="match-cockpit" onNavigate={vi.fn()} onBackToTournament={vi.fn()} />
    );
    // Gruppenüberschrift und Knopf heißen beide „Gefahrenbereich“ (@OB-072).
    const bezeichnungen = screen.getAllByText('Gefahrenbereich');
    for (const kritisch of bezeichnungen) { expect(kritisch.style.color).not.toBe('var(--color-error)'); }
    const gefahr = bezeichnungen.map((b) => b.closest('button')).find((b): b is HTMLButtonElement => b !== null)!;
    expect(gefahr.style.color).not.toBe('var(--color-warning)');
    expect(gefahr.style.color).not.toBe('var(--color-error)');
    const gruppen = Array.from(container.querySelectorAll<HTMLElement>('div')).filter(
      (d) => d.style.textTransform === 'uppercase'
    );
    expect(gruppen.length).toBeGreaterThan(1);
    for (const g of gruppen) { expect(g.style.color, g.textContent ?? '').not.toBe('var(--color-text-muted)'); }
  });
});

describe('Admin-Hülle: Kopf', () => {
  it('@OB-022 der Zurück-Pfeil im Kopf der schmalen Ansicht ist mindestens 44 × 44', () => {
    render(<AdminHeader title="Match Cockpit" showBackToHub onBackToHub={vi.fn()} onBackToTournament={vi.fn()} tournamentId="t1" />);
    const pfeil = screen.getAllByRole('button')[0];
    expect(mindestens44(pfeil.style.width), `Breite ${pfeil.style.width}`).toBe(true);
    expect(mindestens44(pfeil.style.height), `Höhe ${pfeil.style.height}`).toBe(true);
  });
});
