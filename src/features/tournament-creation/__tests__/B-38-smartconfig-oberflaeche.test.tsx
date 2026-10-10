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
 * Die Oberfläche läuft über die echte Komponente und den echten Hook; die Übersetzung
 * kommt aus der deutschen wizard.json, damit der Text geprüft werden kann.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { SmartConfig } from '../components/SmartConfig';

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
});
