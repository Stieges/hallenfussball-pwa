/**
 * DA-2a: Turniertag-Dialoge auf `DialogActions` im festen Fuß (@OB-061 Tasten im Fuß, Haupttaste unten/zuletzt; @OB-062 Kopf und
 * Fuß stehen; Regel „Tasten im Dialog-Fuß“ im Record Oberfläche: Haupttaste immer unten, bei drei Tasten Mischform erlaubt).
 * Umgestellt: Abmelden mit offenen Änderungen, Konflikte im Spielplan-Editor, Spielplan-Filter (Blatt, über `BottomSheet`).
 * jsdom hat kein Layout: geprüft werden Ort (Fuß-Slot, nicht Inhalt), Reihenfolge, Haupttaste zuletzt, Tastenwirkung und die
 * Gegenbeispiele (Abbrechen/Schließen führt nichts aus). Die echte Anordnung bei 360×640 und 1280×720 prüft
 * tests/e2e/dialog-fuss-da2a.spec.ts. Texte: echte deutsche i18n.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { LogoutWarningDialog } from '../../../features/collaboration/outbox/LogoutWarningDialog';
import { ConflictDialog } from '../../../features/schedule-editor/components/ConflictDialog';
import { ScheduleFilterSheet } from '../../../features/tournament-management/components/schedule-filter/ScheduleFilterSheet';
import { BottomSheet } from '../../ui/BottomSheet';
import { DEFAULT_FILTERS } from '../../../types/scheduleFilters';
import type { ScheduleConflict } from '../../../features/schedule-editor/types';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const footerOf = () => screen.getByTestId('dialog-surface-footer');
const bodyOf = () => screen.getByTestId('dialog-surface-body');
const headerOf = () => screen.getByTestId('dialog-surface-header');
const tastenImFuss = () => within(footerOf()).getAllByRole('button').map((b) => b.textContent?.trim());

const fehler: ScheduleConflict = { id: 'k1', type: 'team_double_booking', severity: 'error', matchIds: ['m1', 'm2'], message: 'Team "FC Nordstadt" hat zwei Spiele gleichzeitig' };
const warnung: ScheduleConflict = { id: 'k2', type: 'break_violation', severity: 'warning', matchIds: ['m1'], message: 'Pause zu kurz' };

describe('DA-2a Abmelden mit offenen Änderungen (LogoutWarningDialog)', () => {
  it('@OB-061: „Abbrechen“ und „Trotzdem abmelden“ stehen im Fuß, nicht im Inhalt; Haupttaste zuletzt', () => {
    render(<LogoutWarningDialog isOpen count={3} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(tastenImFuss()).toEqual(['Abbrechen', 'Trotzdem abmelden']);
    expect(within(bodyOf()).queryByRole('button', { name: 'Trotzdem abmelden' })).toBeNull();
    expect(within(bodyOf()).queryByRole('button', { name: 'Abbrechen' })).toBeNull();
    expect(screen.getByTestId('logout-warning-confirm')).toHaveAttribute('data-primary');
  });

  it('@OB-062: Titel steht im Kopf, der Warntext im scrollenden Inhalt', () => {
    render(<LogoutWarningDialog isOpen count={3} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(within(headerOf()).getByRole('heading', { name: '3 Einträge noch nicht übertragen' })).toBeInTheDocument();
    expect(within(bodyOf()).getByText(/Es warten noch 3 Einträge auf Übertragung/)).toBeInTheDocument();
  });

  it('Gegenbeispiel: „Abbrechen“ ruft nur onCancel, „Trotzdem abmelden“ nur onConfirm', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<LogoutWarningDialog isOpen count={1} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('logout-warning-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('logout-warning-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('DA-2a Konflikte im Spielplan-Editor (ConflictDialog)', () => {
  const mount = (props: Partial<React.ComponentProps<typeof ConflictDialog>> = {}) => {
    const fns = { onClose: vi.fn(), onSaveAnyway: vi.fn(), onAutoResolve: vi.fn() };
    render(<ConflictDialog isOpen conflicts={[fehler]} matches={[]} {...fns} canAutoResolve {...props} />);
    return fns;
  };

  it('@OB-061: mit Fehlern „Automatisch beheben“ davor, „Verstanden“ als Haupttaste zuletzt, alles im Fuß', () => {
    mount();
    expect(tastenImFuss()).toEqual(['Automatisch beheben', 'Verstanden']);
    expect(within(bodyOf()).queryByRole('button', { name: 'Verstanden' })).toBeNull();
    expect(screen.getByTestId('conflict-close')).toHaveAttribute('data-primary');
  });

  it('@OB-061 Mischform bei drei Tasten: nur Warnungen → „Automatisch beheben“, „Trotzdem speichern“, dann „Verstanden“ zuletzt', () => {
    mount({ conflicts: [warnung] });
    expect(tastenImFuss()).toEqual(['Automatisch beheben', 'Trotzdem speichern', 'Verstanden']);
  });

  it('keine Konflikte: nur die Haupttaste „Schließen“ im Fuß', () => {
    mount({ conflicts: [] });
    expect(tastenImFuss()).toEqual(['Schließen']);
  });

  it('@OB-062: Titel und Schließen-Kreuz stehen im Kopf, die Konfliktliste im Inhalt', () => {
    mount();
    expect(within(headerOf()).getByRole('heading', { name: /Konflikte im Spielplan/ })).toBeInTheDocument();
    expect(within(headerOf()).getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
    expect(within(bodyOf()).getByText(/hat zwei Spiele gleichzeitig/)).toBeInTheDocument();
  });

  it('Gegenbeispiel: „Verstanden“ und das Kreuz schließen, ohne zu beheben oder zu speichern; „Trotzdem speichern“ speichert ohne zu schließen', () => {
    const fns = mount({ conflicts: [warnung] });
    fireEvent.click(screen.getByTestId('conflict-close'));
    fireEvent.click(within(headerOf()).getByRole('button', { name: 'Schließen' }));
    expect(fns.onClose).toHaveBeenCalledTimes(2);
    expect(fns.onAutoResolve).not.toHaveBeenCalled();
    expect(fns.onSaveAnyway).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('conflict-save-anyway'));
    expect(fns.onSaveAnyway).toHaveBeenCalledTimes(1);
    expect(fns.onClose).toHaveBeenCalledTimes(2);
  });

  it('Gegenbeispiel: bei Fehlern gibt es kein „Trotzdem speichern“', () => {
    mount({ conflicts: [fehler, warnung] });
    expect(screen.queryByTestId('conflict-save-anyway')).toBeNull();
  });
});

describe('DA-2a Spielplan-Filter (ScheduleFilterSheet, Blatt)', () => {
  const mount = () => {
    const fns = { onClose: vi.fn(), onApply: vi.fn(), onReset: vi.fn(), onDraftChange: vi.fn() };
    render(
      <ScheduleFilterSheet
        isOpen
        {...fns}
        draftFilters={DEFAULT_FILTERS}
        filterOptions={{ groups: [], fields: [1, 2], hasFinals: false, showGroupFilter: false, showFieldFilter: true, showPhaseFilter: false }}
        matchCount={7}
        totalMatches={12}
        data-testid="filter-sheet"
      />,
    );
    return fns;
  };

  it('@OB-061: „Zurücksetzen“ davor, „Anwenden (7)“ als Haupttaste zuletzt, beide im Fuß', () => {
    mount();
    expect(tastenImFuss()).toEqual(['Zurücksetzen', 'Anwenden (7)']);
    expect(within(bodyOf()).queryByTestId('filter-sheet-apply')).toBeNull();
    expect(screen.getByTestId('filter-sheet-apply')).toHaveAttribute('data-primary');
  });

  it('@OB-062: Griff und Titel „Filter“ stehen im Kopf, die Filter im Inhalt', () => {
    mount();
    expect(within(headerOf()).getByRole('heading', { name: 'Filter' })).toBeInTheDocument();
    expect(within(bodyOf()).getByTestId('filter-sheet-field')).toBeInTheDocument();
    expect(within(bodyOf()).getByTestId('filter-sheet-status')).toBeInTheDocument();
  });

  it('Gegenbeispiel: „Zurücksetzen“ setzt nur zurück (schließt und wendet nicht an), „Anwenden“ wendet nur an', () => {
    const fns = mount();
    fireEvent.click(screen.getByTestId('filter-sheet-reset'));
    expect(fns.onReset).toHaveBeenCalledTimes(1);
    expect(fns.onApply).not.toHaveBeenCalled();
    expect(fns.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('filter-sheet-apply'));
    expect(fns.onApply).toHaveBeenCalledTimes(1);
    expect(fns.onReset).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel Esc: schließt ohne anzuwenden', () => {
    const fns = mount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(fns.onClose).toHaveBeenCalledTimes(1);
    expect(fns.onApply).not.toHaveBeenCalled();
  });
});

describe('DA-2a BottomSheet: Fuß ist optional, die anderen Nutzer bleiben unverändert', () => {
  it('ohne `footer`: kein Kopf-, Inhalts- oder Fuß-Slot (Griff, Titel und Inhalt wie bisher in der Fläche)', () => {
    render(<BottomSheet isOpen onClose={vi.fn()} title="Menü"><p>Eintrag</p></BottomSheet>);
    expect(screen.queryByTestId('dialog-surface-header')).toBeNull();
    expect(screen.queryByTestId('dialog-surface-body')).toBeNull();
    expect(screen.queryByTestId('dialog-surface-footer')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Menü' })).toBeInTheDocument();
  });

  it('mit `footer`: Titel im Kopf, Inhalt im Inhalt, Fuß im Fuß', () => {
    render(<BottomSheet isOpen onClose={vi.fn()} title="Menü" footer={<button>Fertig</button>}><p>Eintrag</p></BottomSheet>);
    expect(within(headerOf()).getByRole('heading', { name: 'Menü' })).toBeInTheDocument();
    expect(within(bodyOf()).getByText('Eintrag')).toBeInTheDocument();
    expect(within(footerOf()).getByRole('button', { name: 'Fertig' })).toBeInTheDocument();
  });
});
