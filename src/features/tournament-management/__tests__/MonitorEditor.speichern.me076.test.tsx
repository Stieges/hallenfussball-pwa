/**
 * @ME-076 „Speichern“ weist auf Folien hin, die noch nicht eingerichtet sind: ein eigener Dialog mit Liste,
 * „Zurück zum Editor“ öffnet die erste Folie, „Trotzdem speichern“ speichert; sind alle eingerichtet, keine Rückfrage.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';

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
import { monitor, nikolaus, oeffneEditor, slide } from './monitorEditorTestHarness';

await initRealDeI18n();

const MELDUNG = '2 Folien sind noch nicht eingerichtet und werden am Monitor nicht gezeigt. Trotzdem speichern?';
const unfertig = () => [slide('s-sponsor', 'sponsor'), slide('s-text', 'custom-text', { headline: '  ' })];
/** Der Monitor ist gespeichert; die Änderung macht den Entwurf „geändert“ */
const mitAenderung = async (user: ReturnType<typeof oeffneEditor>['user']) => {
  await user.selectOptions(screen.getByLabelText('Folienzeit'), '30');
};

describe('@ME-076 Rückfrage beim Speichern', () => {
  it('Sponsor-Folie ohne Sponsor und „Eigener Text“ ohne Überschrift: eine Rückfrage mit dem Wortlaut und beiden Folien, noch nichts gespeichert', async () => {
    const { user, onUpdate } = oeffneEditor(nikolaus(monitor(unfertig())));
    await mitAenderung(user);
    await user.click(screen.getByTestId('monitor-editor-save'));
    const dialog = await screen.findByTestId('monitor-unready-dialog');
    expect(dialog).toHaveTextContent(MELDUNG);
    const liste = within(screen.getByTestId('monitor-unready-list')).getAllByRole('listitem').map(li => li.textContent);
    expect(liste).toEqual(['Sponsor: Sponsor fehlt', 'Eigener Text: Überschrift fehlt']);
    expect(screen.getByText('Folien nicht eingerichtet')).toBeInTheDocument(); // eigener Dialog mit eigenem Titel
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('„Zurück zum Editor“ öffnet die erste betroffene Folie; gespeichert wird nichts', async () => {
    const { user, onUpdate } = oeffneEditor(nikolaus(monitor(unfertig())));
    await mitAenderung(user);
    await user.click(screen.getByTestId('monitor-editor-save'));
    await user.click(await screen.findByRole('button', { name: 'Zurück zum Editor' }));
    expect(screen.queryByTestId('monitor-unready-dialog')).toBeNull();
    expect(screen.getByTestId('monitor-slide-edit-s-sponsor')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('monitor-slide-edit-s-text')).toHaveAttribute('aria-expanded', 'false');
    expect(await screen.findByLabelText(/Sponsor/, { selector: 'select' })).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('„Trotzdem speichern“ speichert beide Folien unverändert', async () => {
    const { user, onClose, gespeichert } = oeffneEditor(nikolaus(monitor(unfertig())));
    await mitAenderung(user);
    await user.click(screen.getByTestId('monitor-editor-save'));
    await user.click(await screen.findByRole('button', { name: 'Trotzdem speichern' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(gespeichert().slides.map(s => s.id)).toEqual(['s-sponsor', 's-text']);
    expect(gespeichert().defaultSlideDuration).toBe(30);
  });

  it('in der Folienliste steht bei jeder solchen Folie in Warnfarbe und ungekürzt, was fehlt', async () => {
    oeffneEditor(nikolaus(monitor([...unfertig(), slide('s-live', 'live')])));
    const probleme = screen.getAllByTestId('monitor-slide-problem');
    expect(probleme.map(p => p.textContent)).toEqual(['Sponsor fehlt', 'Überschrift fehlt', 'Feld fehlt']);
    for (const p of probleme) {
      expect(p.style.color).toBe('var(--color-warning)');
      expect(p.style.textOverflow).not.toBe('ellipsis');
      expect(p.style.whiteSpace).not.toBe('nowrap');
    }
  });

  it('Gegenbeispiel: sind alle Folien eingerichtet, speichert „Speichern“ ohne Rückfrage', async () => {
    const eingerichtet = [slide('s1', 'live', { fieldId: 'field-1' }), slide('s2', 'custom-text', { headline: 'Willkommen' })];
    const { user, onClose, gespeichert } = oeffneEditor(nikolaus(monitor(eingerichtet)));
    await mitAenderung(user);
    await user.click(screen.getByTestId('monitor-editor-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('monitor-unready-dialog')).toBeNull();
    expect(gespeichert().defaultSlideDuration).toBe(30);
    expect(screen.queryAllByTestId('monitor-slide-problem')).toHaveLength(0);
  });

  it('Gegenbeispiel: nur eine Folie fehlt – die Meldung steht in der Einzahl', async () => {
    const { user } = oeffneEditor(nikolaus(monitor([slide('s-sponsor', 'sponsor')])));
    await mitAenderung(user);
    await user.click(screen.getByTestId('monitor-editor-save'));
    expect(await screen.findByTestId('monitor-unready-dialog')).toHaveTextContent(
      '1 Folie ist noch nicht eingerichtet und wird am Monitor nicht gezeigt. Trotzdem speichern?'
    );
  });

  it('Gegenbeispiel: ungültiger Name – keine Rückfrage, der Hinweis steht am Namensfeld', async () => {
    const { user, onUpdate } = oeffneEditor(nikolaus(monitor(unfertig())));
    await user.clear(screen.getByTestId('monitor-name-input'));
    await user.click(screen.getByTestId('monitor-editor-save'));
    expect(await screen.findByTestId('monitor-name-error')).toBeInTheDocument();
    expect(screen.queryByTestId('monitor-unready-dialog')).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ohne Änderung schließt „Speichern“ ohne Rückfrage, auch wenn gespeicherte Folien unfertig sind', async () => {
    const { user, onClose } = oeffneEditor(nikolaus(monitor(unfertig())));
    await user.click(screen.getByTestId('monitor-editor-save'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('monitor-unready-dialog')).toBeNull();
  });
});
