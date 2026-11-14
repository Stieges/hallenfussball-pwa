/**
 * @ME-075 Eine neue Folie ist so weit vorbelegt, wie das Turnier es eindeutig hergibt (vier Beispielzeilen) und
 * Vorschau und Folienzeile widersprechen sich nicht. Echte Hooks, echte deutsche Texte.
 * @see docs/anforderungen/2026-10-03_monitor-einrichten.md
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
import type { Tournament } from '../../../types/tournament';
import { SlidePreview } from '../components/SlidePreview';
import { monitor, nikolaus, oeffneEditor, slide } from './monitorEditorTestHarness';

await initRealDeI18n();

const zweiFelder = (): Tournament => nikolaus(monitor(), { numberOfFields: 2 });

async function folieHinzufuegen(user: ReturnType<typeof oeffneEditor>['user'], art: string) {
  await user.click(screen.getByTestId('monitor-add-slide'));
  await user.click(screen.getByTestId(`monitor-add-slide-${art}`));
}

describe('@ME-075 Vorbelegung je Folie', () => {
  it('Zeile 1: nur „Feld 1“, „Spielplan (Feld)“ gilt Feld 1, die Feldwahl wird nicht gezeigt', async () => {
    const { user, gespeichert } = oeffneEditor(nikolaus(monitor()));
    await folieHinzufuegen(user, 'schedule-field');
    expect(screen.getByTestId('monitor-slide-desc')).toHaveTextContent(/^Feld 1$/);
    expect(screen.queryByLabelText(/Spielfeld/)).toBeNull();
    expect(screen.queryByTestId('monitor-slide-problem')).toBeNull();
    await user.click(screen.getByTestId('monitor-editor-save'));
    expect(gespeichert().slides[0]).toMatchObject({ type: 'schedule-field', config: { fieldId: 'field-1' } });
  });

  it('Zeile 2: nur „Feld 1“, „Live-Spiel“ gilt Feld 1, die Feldwahl wird nicht gezeigt', async () => {
    const { user, gespeichert } = oeffneEditor(nikolaus(monitor()));
    await folieHinzufuegen(user, 'live');
    expect(screen.getByTestId('monitor-slide-desc')).toHaveTextContent(/^Feld 1$/);
    expect(screen.queryByLabelText(/Spielfeld/)).toBeNull();
    await user.click(screen.getByTestId('monitor-editor-save'));
    expect(gespeichert().slides[0].config.fieldId).toBe('field-1');
  });

  it('Zeile 3: zwei Felder, „Spielplan (Feld)“ hat „Feld 1“ ausgewählt, „Feld 2“ ist wählbar', async () => {
    const { user, gespeichert } = oeffneEditor(zweiFelder());
    await folieHinzufuegen(user, 'schedule-field');
    const auswahl = screen.getByLabelText<HTMLSelectElement>(/Spielfeld/);
    expect(auswahl.value).toBe('field-1');
    await user.selectOptions(auswahl, 'field-2');
    expect(screen.getByTestId('monitor-slide-desc')).toHaveTextContent(/^Feld 2$/);
    await user.click(screen.getByTestId('monitor-editor-save'));
    expect(gespeichert().slides[0].config.fieldId).toBe('field-2');
  });

  it('Zeile 4: keine Gruppen, „Tabelle“ steht bei „Alle Teams“, ohne Auswahl einer Gruppe', async () => {
    const { user } = oeffneEditor(nikolaus(monitor()));
    await folieHinzufuegen(user, 'standings');
    expect(screen.getByTestId('monitor-slide-desc')).toHaveTextContent(/^Alle Teams$/);
    expect(screen.queryByLabelText('Gruppe')).toBeNull();
    expect(screen.queryByTestId('monitor-slide-problem')).toBeNull();
  });

  it('Gegenbeispiel: mit zwei Gruppen heißt die Tabelle ohne Auswahl „Alle Gruppen“ und die Gruppenwahl ist da', async () => {
    const zweiGruppen = nikolaus(monitor(), {
      groupSystem: 'groupsAndFinals', numberOfGroups: 2, groups: [{ id: 'A' }, { id: 'B' }],
      teams: [{ id: 'a1', name: 'A1', group: 'A' }, { id: 'b1', name: 'B1', group: 'B' }] as never,
    });
    const { user } = oeffneEditor(zweiGruppen);
    await folieHinzufuegen(user, 'standings');
    expect(screen.getByTestId('monitor-slide-desc')).toHaveTextContent(/^Alle Gruppen$/);
    expect(screen.getByLabelText('Gruppe')).toBeInTheDocument();
  });

  it('Gegenbeispiel: eine Folie ohne Feldbezug („Nächste Spiele“) bekommt kein Feld', async () => {
    const { user, gespeichert } = oeffneEditor(nikolaus(monitor()));
    await folieHinzufuegen(user, 'next-matches');
    await user.click(screen.getByTestId('monitor-editor-save'));
    expect(gespeichert().slides[0].config.fieldId).toBeUndefined();
  });

  it('Gegenbeispiel: ein einziges Feld, aber die Folie zeigt ein anderes Feld – die Wahl bleibt, sonst wäre sie nicht zu reparieren', async () => {
    const { user } = oeffneEditor(nikolaus(monitor([slide('s1', 'live', { fieldId: 'field-9' })])));
    await user.click(screen.getByTestId('monitor-slide-edit-s1'));
    expect(await screen.findByLabelText(/Spielfeld/)).toBeInTheDocument();
  });
});

describe('@ME-075 Vorschau und Folienzeile widersprechen sich nicht', () => {
  const spiele = [{ id: 'm1', round: 1, field: 1, slotA: { kind: 'team', teamId: 'team-0' }, slotB: { kind: 'team', teamId: 'team-1' } }];
  const mitSpielen = { ...nikolaus(monitor()), matches: spiele } as unknown as Tournament;

  it('ohne gewähltes Feld zeigt die Vorschau „Kein Feld gewählt“ und keine Spiele von Feld 1', () => {
    render(<SlidePreview slide={slide('p1', 'schedule-field')} tournament={mitSpielen} />);
    expect(screen.getByText('Kein Feld gewählt')).toBeInTheDocument();
    expect(screen.queryByText(/Waging/)).toBeNull();
    expect(screen.getByText('Keine Spiele')).toBeInTheDocument();
  });

  it('Gegenbeispiel: mit Feld 1 zeigt die Vorschau die Spiele von Feld 1', () => {
    render(<SlidePreview slide={slide('p2', 'schedule-field', { fieldId: 'field-1' })} tournament={mitSpielen} />);
    expect(screen.getByText('Feld 1')).toBeInTheDocument();
    expect(screen.getByText(/Waging/)).toBeInTheDocument();
  });
});
