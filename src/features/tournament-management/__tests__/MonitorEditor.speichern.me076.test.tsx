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
import { selectDisplayableSlides } from '../../monitor-display/slideProgramme';
import type { Sponsor } from '../../../types/sponsor';
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
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { user, onUpdate } = oeffneEditor(nikolaus(monitor(unfertig())));
    await mitAenderung(user);
    await user.click(screen.getByTestId('monitor-editor-save'));
    await user.click(await screen.findByRole('button', { name: 'Zurück zum Editor' }));
    // die Folie steht oben im Bild, nicht in der Mitte (Handy: sonst verdeckt die Tastatur die Auswahl)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
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
    // Die Live-Folie ohne Feld gehört nicht dazu: sie gilt als eingerichtet und zeigt „Feld 1“ (@ME-076, @ZM-074)
    expect(probleme.map(p => p.textContent)).toEqual(['Sponsor fehlt', 'Überschrift fehlt']);
    expect(within(screen.getByTestId('monitor-slide-row-s-live')).getByTestId('monitor-slide-desc')).toHaveTextContent('Feld 1');
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

  it('eine Folie „Live-Spiel“ oder „Spielplan (Feld)“ ohne Feld löst keine Rückfrage aus und wird unverändert gespeichert', async () => {
    const { user, onClose, gespeichert } = oeffneEditor(nikolaus(monitor([slide('s-live', 'live'), slide('s-plan', 'schedule-field')])));
    await mitAenderung(user);
    await user.click(screen.getByTestId('monitor-editor-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('monitor-unready-dialog')).toBeNull();
    expect(gespeichert().slides.map(s => s.config.fieldId)).toEqual([undefined, undefined]);
  });

  it('Weg „Trotzdem speichern“ → gespeichertes Programm → Monitor: nur eingerichtete Folien laufen, Live ohne Feld bleibt (@ME-077)', async () => {
    const sponsor = { id: 'sp1', name: 'Bäckerei Huber', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' } as Sponsor;
    const programm = [
      slide('s-live', 'live'),
      slide('s-sponsor-leer', 'sponsor'),
      slide('s-sponsor-weg', 'sponsor', { sponsorId: 'geloescht' }),
      slide('s-text-leer', 'custom-text', { headline: ' ' }),
      slide('s-sponsor-ok', 'sponsor', { sponsorId: 'sp1' }),
      slide('s-text-ok', 'custom-text', { headline: 'Willkommen' }),
    ];
    const turnier = nikolaus(monitor(programm), { sponsors: [sponsor] });
    const { user, onClose, gespeichert } = oeffneEditor(turnier);
    await mitAenderung(user);
    await user.click(screen.getByTestId('monitor-editor-save'));
    expect(await screen.findByTestId('monitor-unready-dialog')).toHaveTextContent('3 Folien sind noch nicht eingerichtet');
    await user.click(screen.getByRole('button', { name: 'Trotzdem speichern' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    const gezeigt = selectDisplayableSlides(gespeichert().slides, { qrMoeglich: true, sponsors: turnier.sponsors });
    expect(gezeigt.map(f => f.id)).toEqual(['s-live', 's-sponsor-ok', 's-text-ok']);
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
