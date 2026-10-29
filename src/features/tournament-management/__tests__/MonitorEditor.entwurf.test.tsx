/**
 * Monitor-Editor mit Entwurf (@ME-071, @ME-072): Änderungen gelten erst mit „Speichern“.
 * Echte Hooks und echte deutsche Texte; das Turnier wird über onTournamentUpdate abgefangen.
 * @see docs/anforderungen/2026-10-03_monitor-einrichten.md
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide, TournamentMonitor } from '../../../types/monitor';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../../hooks', async () => {
  const monitors = await import('../../../hooks/useMonitors');
  const sponsors = await import('../../../hooks/useSponsors');
  const fields = await import('../../../hooks/useFields');
  return { useMonitors: monitors.useMonitors, useSponsors: sponsors.useSponsors, useFields: fields.useFields };
});
vi.mock('../../../hooks/useTournaments', () => ({ useTournaments: () => ({ activeTournaments: [], loading: false }) }));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({ useMyTournamentRole: () => ({ role: 'owner' }) }));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { ToastProvider } from '../../../components/ui/Toast';
import { MonitorEditor } from '../MonitorEditor';

await initRealDeI18n();

const slide = (id: string, order: number, fieldId: string): MonitorSlide => ({ id, type: 'live', config: { fieldId }, duration: null, order });
const monitor = (overrides: Partial<TournamentMonitor> = {}): TournamentMonitor => ({
  id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500, theme: 'dark',
  performanceMode: 'auto', slides: [], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...overrides,
});
const turnier = (m: TournamentMonitor): Tournament => ({
  id: 't1', title: 'Hallencup', teams: [], matches: [], sponsors: [], numberOfFields: 2,
  monitors: [m, monitor({ id: 'mon-2', name: 'Hallenmonitor Halle' })],
}) as unknown as Tournament;

function oeffnen(m: TournamentMonitor = monitor(), onUpdate = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <MonitorEditor tournament={turnier(m)} monitorId="mon-1" onTournamentUpdate={onUpdate} onClose={onClose} />
    </ToastProvider>
  );
  const speichern = () => user.click(screen.getByTestId('monitor-editor-save'));
  const gespeichert = (): TournamentMonitor => (onUpdate.mock.calls.at(-1)?.[0] as Tournament).monitors![0];
  return { user, onUpdate, onClose, speichern, gespeichert };
}

describe('@ME-071 Änderungen gelten erst mit „Speichern“', () => {
  it('Folienzeit 30 s und „Abbrechen“: nichts gespeichert, ohne Rückfrage geschlossen', async () => {
    const { user, onUpdate, onClose } = oeffnen();
    await user.selectOptions(screen.getByLabelText('Slide-Dauer (Sek.)'), '30');
    await user.click(screen.getByTestId('monitor-editor-cancel'));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Änderungen verwerfen?')).toBeNull();
  });

  it('Folienzeit 30 s und „Speichern“: „Gespeichert“, Wert gilt, Dialog schließt', async () => {
    const { user, onClose, speichern, gespeichert } = oeffnen();
    await user.selectOptions(screen.getByLabelText('Slide-Dauer (Sek.)'), '30');
    await speichern();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(gespeichert().defaultSlideDuration).toBe(30);
    expect(await screen.findByText('Gespeichert')).toBeInTheDocument();
  });

  it('Gegenbeispiel: „Speichern“ ohne Änderung schließt ohne Schreiben und ohne Meldung', async () => {
    const { onUpdate, onClose, speichern } = oeffnen();
    await speichern();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Gespeichert')).toBeNull();
  });

  it('✕ mit Änderung: Rückfrage „Änderungen verwerfen?“, Fokus auf „Weiter bearbeiten“; „Verwerfen“ schließt', async () => {
    const { user, onUpdate, onClose } = oeffnen();
    await user.selectOptions(screen.getByLabelText('Slide-Dauer (Sek.)'), '30');
    await user.click(screen.getByTestId('monitor-editor-close'));
    expect(await screen.findByText('Änderungen verwerfen?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Weiter bearbeiten' })).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('✕ mit Änderung und „Weiter bearbeiten“: Rückfrage weg, Eingabe bleibt', async () => {
    const { user, onClose } = oeffnen();
    await user.selectOptions(screen.getByLabelText('Slide-Dauer (Sek.)'), '30');
    await user.click(screen.getByTestId('monitor-editor-close'));
    await user.click(await screen.findByRole('button', { name: 'Weiter bearbeiten' }));
    expect(screen.queryByText('Änderungen verwerfen?')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLSelectElement>('Slide-Dauer (Sek.)').value).toBe('30');
  });

  it('Esc mit Änderung fragt ebenfalls', async () => {
    const { user, onClose } = oeffnen();
    await user.selectOptions(screen.getByLabelText('Slide-Dauer (Sek.)'), '30');
    await user.keyboard('{Escape}');
    expect(await screen.findByText('Änderungen verwerfen?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ✕ ohne Änderung schließt sofort ohne Rückfrage', async () => {
    const a = oeffnen();
    await a.user.click(screen.getByTestId('monitor-editor-close'));
    expect(a.onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Änderungen verwerfen?')).toBeNull();
  });

  it('Zurück-Taste mit Änderung: genau eine Rückfrage; „Weiter bearbeiten“; erneut Zurück: wieder genau eine', async () => {
    const { user, onClose } = oeffnen();
    await user.selectOptions(screen.getByLabelText('Slide-Dauer (Sek.)'), '30');
    act(() => { window.history.back(); });
    expect(await screen.findByText('Änderungen verwerfen?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }));
    await waitFor(() => expect(screen.queryByText('Änderungen verwerfen?')).toBeNull());
    act(() => { window.history.back(); });
    expect(await screen.findByText('Änderungen verwerfen?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLSelectElement>('Slide-Dauer (Sek.)').value).toBe('30');
  });

  it('Klick auf die Abdunkelung mit Änderung: Rückfrage; Gegenbeispiel ohne Änderung schließt sofort', async () => {
    const mit = oeffnen();
    await mit.user.selectOptions(screen.getByLabelText('Slide-Dauer (Sek.)'), '30');
    fireEvent.click(document.querySelector('.dialog-surface-scrim')!);
    expect(await screen.findByText('Änderungen verwerfen?')).toBeInTheDocument();
    expect(mit.onClose).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Abdunkelung ohne Änderung schließt ohne Rückfrage', () => {
    const { onClose } = oeffnen();
    fireEvent.click(document.querySelector('.dialog-surface-scrim')!);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Änderungen verwerfen?')).toBeNull();
  });

  it('Folie anlegen, dann „Abbrechen“: nichts gespeichert', async () => {
    const { user, onUpdate, onClose } = oeffnen();
    await user.click(screen.getByRole('button', { name: /Slide hinzufügen/ }));
    await user.click(screen.getByRole('button', { name: /Nächste Spiele/ }));
    await user.click(screen.getByTestId('monitor-editor-cancel'));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Speichern scheitert: Meldung im Fuß, Dialog und Eingabe bleiben', async () => {
    const { user, onClose, speichern } = oeffnen(monitor(), vi.fn().mockRejectedValue(new Error('offline')));
    await user.selectOptions(screen.getByLabelText('Slide-Dauer (Sek.)'), '30');
    await speichern();
    expect(await screen.findByText('Fehler beim Speichern')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLSelectElement>('Slide-Dauer (Sek.)').value).toBe('30');
  });

  it('Doppelklick auf „Speichern“: genau ein Speichern', async () => {
    let fertig: () => void = () => undefined;
    const langsam = vi.fn(() => new Promise<void>(res => { fertig = res; }));
    const { user, onUpdate, onClose } = oeffnen(monitor(), langsam);
    await user.selectOptions(screen.getByLabelText('Slide-Dauer (Sek.)'), '30');
    await user.dblClick(screen.getByTestId('monitor-editor-save'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    fertig();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('Farbschema „Hell“ wird gespeichert', async () => {
    const { user, speichern, gespeichert } = oeffnen();
    await user.selectOptions(screen.getByLabelText('Farbschema'), 'light');
    await speichern();
    await waitFor(() => expect(gespeichert().theme).toBe('light'));
  });

  it('Name ändern und „Speichern“: gespeichert', async () => {
    const { user, speichern, gespeichert } = oeffnen();
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Eingang');
    await speichern();
    await waitFor(() => expect(gespeichert().name).toBe('Eingang'));
  });

  it('Folien: ↓ an Folie 1 tauscht die Reihenfolge erst mit „Speichern“', async () => {
    const { user, onUpdate, speichern, gespeichert } = oeffnen(monitor({ slides: [slide('a', 0, 'field-1'), slide('b', 1, 'field-2')] }));
    await user.click(screen.getAllByTitle('Nach unten')[0]);
    expect(onUpdate).not.toHaveBeenCalled();
    await speichern();
    await waitFor(() => expect(gespeichert().slides.map(s => s.id)).toEqual(['b', 'a']));
  });

  it('Folien: 🗑️ entfernt die Folie erst mit „Speichern“', async () => {
    const { user, onUpdate, speichern, gespeichert } = oeffnen(monitor({ slides: [slide('a', 0, 'field-1'), slide('b', 1, 'field-2')] }));
    await user.click(screen.getAllByTitle('Entfernen')[0]);
    expect(onUpdate).not.toHaveBeenCalled();
    await speichern();
    await waitFor(() => expect(gespeichert().slides.map(s => s.id)).toEqual(['b']));
  });
});

describe('@ME-072 Name mit Leerzeichen und Prüfung beim Speichern', () => {
  it('„  Halle Nord  “ wird als „Halle Nord“ gespeichert', async () => {
    const { user, speichern, gespeichert } = oeffnen();
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), '  Halle Nord  ');
    expect(screen.getByLabelText('Name')).toHaveValue('  Halle Nord  ');
    await speichern();
    await waitFor(() => expect(gespeichert().name).toBe('Halle Nord'));
  });

  it('im Feld steht „Halle Nord“ mit dem Leerzeichen, nicht gekürzt', async () => {
    const { user } = oeffnen();
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Halle Nord');
    expect(screen.getByLabelText('Name')).toHaveValue('Halle Nord');
    await user.type(screen.getByLabelText('Name'), ' ');
    expect(screen.getByLabelText('Name')).toHaveValue('Halle Nord ');
  });

  it.each([
    ['leer', '', 'Name ist erforderlich'],
    ['51 Zeichen', 'a'.repeat(51), 'Name darf maximal 50 Zeichen haben'],
    ['doppelt', 'hallenmonitor halle', 'Ein Monitor mit diesem Namen existiert bereits'],
  ])('%s: Hinweis am Feld, nichts gespeichert, Dialog bleibt', async (_titel, eingabe, hinweis) => {
    const { user, onUpdate, onClose, speichern } = oeffnen();
    await user.clear(screen.getByLabelText('Name'));
    if (eingabe) {await user.type(screen.getByLabelText('Name'), eingabe);}
    expect(screen.queryByTestId('monitor-name-error')).toBeNull();
    await speichern();
    expect(await screen.findByText(hinweis)).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(hinweis);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: der eigene Name „Haupthalle“ gilt nicht als doppelt', async () => {
    const { user, speichern, gespeichert } = oeffnen();
    await user.selectOptions(screen.getByLabelText('Slide-Dauer (Sek.)'), '20');
    await speichern();
    await waitFor(() => expect(gespeichert().name).toBe('Haupthalle'));
  });
});
