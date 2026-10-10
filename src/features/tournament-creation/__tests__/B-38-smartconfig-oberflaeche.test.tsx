/**
 * B-38 — @W4-021: Die Zeit-Empfehlung nennt die Spielstruktur, mit der sie rechnet.
 *
 * Gegeben die Turnierleitung hat „Gruppen + Finalrunde“ mit 2 Gruppen und Halbfinale + Finale eingestellt
 * Wenn sie die Zeit-Empfehlung berechnen lässt
 * Dann nennt die Empfehlung „2 Gruppen, Halbfinale + Finale“ und die Zahl der Spiele
 * Und die Gruppenzahl lässt sich nur im Feld „Anzahl Gruppen“ ändern, nicht in der Empfehlung
 *
 * Gegenbeispiel: jeder gegen jeden → kein Gruppentext.
 * Mutation: Strukturtext entfernt → rot.
 *
 * @W4-022: Eine festgehaltene Teamzahl ändert die Zeit-Empfehlung nie.
 *
 * Gegeben die Turnierleitung hat „Anzahl Teams: 12“ festgehalten und die verfügbare Zeit reicht dafür nicht
 * Wenn sie die Zeit-Empfehlung berechnen lässt und übernimmt
 * Dann bleiben es 12 Teams
 * Und die Empfehlung sagt, dass die Zeit mit 12 Teams nicht reicht
 *
 * Gegenbeispiel: Teamzahl nicht fix → die Empfehlung darf die Teamzahl vorschlagen (8 statt 12).
 * Mutation: Teamzahl-Fix überschreibbar (Fallback reduziert trotz Fix) → rot;
 * Hinweis entfernt → rot.
 *
 * Die Oberfläche läuft über die echte Komponente und den echten Hook; die Übersetzung
 * kommt aus der deutschen wizard.json, damit der Text geprüft werden kann.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { SmartConfig } from '../components/SmartConfig';
import { useSmartConfig } from '../hooks/useSmartConfig';

vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showWarning: vi.fn(), showSuccess: vi.fn(), showError: vi.fn() }),
}));

vi.mock('react-i18next', async () => {
  const de = (await import('../../../i18n/locales/de/wizard.json')).default as Record<string, unknown>;
  const translate = (key: string, opts?: Record<string, unknown>): string => {
    const value = key
      .split('.')
      .reduce<unknown>(
        (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
        de
      );
    if (typeof value !== 'string') {
      return key;
    }
    return value.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(opts?.[name] ?? ''));
  };
  return {
    useTranslation: () => ({ t: translate }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
  };
});

const gruppenFormData = (): Partial<Tournament> => ({
  numberOfTeams: 8,
  groupSystem: 'groupsAndFinals',
  numberOfGroups: 2,
  finalsConfig: { preset: 'top-4' },
  numberOfFields: 1,
  groupPhaseGameDuration: 10,
  groupPhaseBreakDuration: 2,
});

const oeffnenUndBerechnen = (formData: Partial<Tournament>) => {
  render(<SmartConfig formData={formData} onApply={vi.fn()} />);
  fireEvent.click(screen.getByText('Smart-Konfiguration'));
};

describe('@W4-021 Zeit-Empfehlung nennt die Spielstruktur', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Gruppen + Finalrunde (2 Gruppen, Halbfinale + Finale) → Text nennt Gruppen und Finalrunde, Panel hat kein Gruppenfeld', () => {
    oeffnenUndBerechnen(gruppenFormData());

    expect(screen.getByTestId('smart-config-structure').textContent).toBe(
      '2 Gruppen, Halbfinale + Finale'
    );
    expect(screen.getByText('16 Spiele')).toBeTruthy();
    expect(screen.queryByText(/Anzahl Gruppen/)).toBeNull();
    // Teams, Felder, Spieldauer, Pause — die Gruppenzeile ist weg
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('Gegenbeispiel: jeder gegen jeden → kein Gruppentext', () => {
    oeffnenUndBerechnen({
      ...gruppenFormData(),
      groupSystem: 'roundRobin',
      finalsConfig: undefined,
    });

    expect(screen.getByText('28 Spiele')).toBeTruthy();
    expect(screen.queryByTestId('smart-config-structure')).toBeNull();
  });

  it('Rückfall: Top 8 mit 2 Gruppen wird als gerechnete Finalrunde Halbfinale + Finale genannt (16 Spiele)', () => {
    oeffnenUndBerechnen({
      ...gruppenFormData(),
      finalsConfig: { preset: 'top-8' },
    });

    expect(screen.getByTestId('smart-config-structure').textContent).toBe(
      '2 Gruppen, Halbfinale + Finale'
    );
    expect(screen.getByText('16 Spiele')).toBeTruthy();
  });

  it('Gegenbeispiel Rückfall: Top 8 mit 4 Gruppen bleibt Viertelfinale bis Finale', () => {
    oeffnenUndBerechnen({
      ...gruppenFormData(),
      numberOfTeams: 16,
      numberOfGroups: 4,
      finalsConfig: { preset: 'top-8' },
    });

    expect(screen.getByTestId('smart-config-structure').textContent).toBe(
      '4 Gruppen, Viertelfinale bis Finale'
    );
  });
});

const teams12FormData = (): Partial<Tournament> => ({
  numberOfTeams: 12,
  groupSystem: 'roundRobin',
  numberOfFields: 1,
  groupPhaseGameDuration: 10,
  groupPhaseBreakDuration: 2,
});

describe('@W4-022 festgehaltene Teamzahl ändert die Zeit-Empfehlung nie', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Hook: 12 Teams fix, Zeit zu knapp → Empfehlung und Übernehmen bleiben bei 12 Teams, Hinweis gesetzt', () => {
    const onApply = vi.fn();
    const { result } = renderHook(() =>
      useSmartConfig({ formData: teams12FormData(), onApply })
    );
    act(() => {
      result.current.setHours(0);
      result.current.setMinutes(5);
    });
    act(() => {
      result.current.handleCalculate();
    });
    expect(result.current.recommendation?.teams).toBe(12);
    expect(result.current.teamsKeptTimeShort).toBe(true);

    act(() => {
      result.current.handleApply();
    });
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ numberOfTeams: 12 }));
    expect(result.current.teamsKeptTimeShort).toBe(true);
  });

  it('Gegenbeispiel Hook: Teamzahl nicht fix → Empfehlung darf 12 auf 8 reduzieren, kein Hinweis', () => {
    const { result } = renderHook(() =>
      useSmartConfig({ formData: teams12FormData(), onApply: vi.fn() })
    );
    act(() => {
      result.current.setLockTeams(false);
      result.current.setHours(0);
      result.current.setMinutes(5);
    });
    act(() => {
      result.current.handleCalculate();
    });
    expect(result.current.recommendation?.teams).toBe(8);
    expect(result.current.teamsKeptTimeShort).toBe(false);
  });

  it('Oberfläche: Hinweis „reicht nicht“ bleibt nach Übernehmen sichtbar, übernommen werden 12 Teams', () => {
    const onApply = vi.fn();
    render(<SmartConfig formData={teams12FormData()} onApply={onApply} />);
    fireEvent.click(screen.getByText('Smart-Konfiguration'));
    fireEvent.change(screen.getByLabelText('Stunden'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Minuten'), { target: { value: '5' } });
    fireEvent.click(screen.getByLabelText('Optimale Konfiguration berechnen'));

    expect(screen.getByTestId('smart-config-teams-short').textContent).toContain('12 Teams');
    fireEvent.click(screen.getByLabelText('Empfohlene Konfiguration übernehmen'));

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ numberOfTeams: 12 }));
    expect(screen.getByTestId('smart-config-teams-short')).toBeTruthy();
  });

  it('Hinweis nennt die gerechnete Teamzahl (12), nicht die Wizard-Teamzahl (10)', () => {
    const onApply = vi.fn();
    render(
      <SmartConfig
        formData={{ ...teams12FormData(), numberOfTeams: 10 }}
        onApply={onApply}
      />
    );
    fireEvent.click(screen.getByText('Smart-Konfiguration'));
    // Erste Auswahlliste = festgehaltene Teamzahl im Panel
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Stunden'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Minuten'), { target: { value: '5' } });
    fireEvent.click(screen.getByLabelText('Optimale Konfiguration berechnen'));

    const hinweis = screen.getByTestId('smart-config-teams-short').textContent ?? '';
    expect(hinweis).toContain('12 Teams');
    expect(hinweis).not.toContain('10 Teams');

    fireEvent.click(screen.getByLabelText('Empfohlene Konfiguration übernehmen'));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ numberOfTeams: 12 }));
  });
});
