/**
 * @RE-001 Der Einstieg ist frei: Beim ersten Besuch (leerer Speicher, nie etwas bestätigt) liegt kein Dialog über der Seite.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppChrome } from '../AppChrome';

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
vi.mock('../OfflineBanner', () => ({ OfflineBanner: () => null }));
vi.mock('../StorageWarningBanner', () => ({ StorageWarningBanner: () => null }));

function ersterBesuch(pfad: string) {
  vi.mocked(localStorage.getItem).mockReturnValue(null);
  return render(
    <MemoryRouter initialEntries={[pfad]}>
      <AppChrome><main data-testid="einstieg">Spielplan</main></AppChrome>
    </MemoryRouter>,
  );
}

describe('@RE-001 Erster Besuch ohne Dialog', () => {
  it.each(['/live/ABC123', '/join/ABCD2345', '/login', '/'])('%s: kein Dialog, kein Overlay, der Einstieg ist sichtbar', (pfad) => {
    ersterBesuch(pfad);
    expect(screen.getByTestId('einstieg')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
  });

  it('es wird nichts über Einwilligungen gespeichert, und der Besuch verlangt keinen Klick', () => {
    ersterBesuch('/live/ABC123');
    expect(localStorage.setItem).not.toHaveBeenCalledWith('app:consent', expect.anything());
    expect(screen.queryByRole('button', { name: /akzeptier|zustimm|einwillig/i })).toBeNull();
  });
});

/**
 * @OB-056 (Dialog „Datenschutz-Einstellungen“: beide Antworten gleich gewichtet, Ansprache mit „du“) entfällt mit @RE-001:
 * Es gibt keinen Dialog und damit keine Antworten, die ungleich gewichtet sein könnten. Dieser Test hält die Kennung belegt, bis der
 * Record Oberfläche @OB-056 ersetzt oder streicht (Lern-Spur); danach kann er entfallen.
 */
describe('@OB-056 entfällt mit @RE-001: keine Antworten mehr, die ungleich gewichtet sein könnten', () => {
  it('erster Besuch: weder „Alle akzeptieren“ noch „Nur notwendige“ noch ein Dialog „Datenschutz-Einstellungen“', () => {
    ersterBesuch('/');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: /Alle akzeptieren|Nur notwendige|Accept All|Necessary Only/i })).toBeNull();
    expect(screen.queryByText(/Datenschutz-Einstellungen|Privacy Settings/)).toBeNull();
  });
});
