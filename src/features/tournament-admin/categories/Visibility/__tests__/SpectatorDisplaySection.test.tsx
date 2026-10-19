/**
 * Spielanzeige 2.3: Bereich „Anzeige für Zuschauer“ in den Turnier-Einstellungen (Sichtbarkeit).
 * @ZM-152 Vorbelegung + Vorschau · @ZM-153 Hinweis bei zu ähnlichen Standardfarben, speichern bleibt möglich · RF2 Blau/Blau.
 * Hallencup Nord, Spiel 7 (FC Nord – SV Süd) ohne eingetragene Farben: so sieht der Monitor das Ergebnis der Einstellung.
 * Rechte (@ZM-019): `Visibility.spectatorDisplay.rechte.test.tsx`.
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.unmock('i18next'); vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../../../test/realDeI18n';
await initRealDeI18n();

import { SpectatorDisplaySection } from '../SpectatorDisplaySection';
import type { Tournament } from '../../../../../types/tournament';
import { buildTournament } from '../../../../monitor-display/__tests__/monitorFixture';
import { buildMonitorView } from '../../../../monitor-display/monitorView';
import { palette } from '../../../../../design-tokens/colors/palette';

const BLAU = palette.kit.blue;
const ROT = palette.kit.red;
const NAVY = palette.kit.navy;

/** Hält das Turnier wie die Verwaltung: `onTournamentUpdate` ersetzt es. */
function Host({ initial, canEdit = true, onUpdate }: { initial: Tournament; canEdit?: boolean; onUpdate: (t: Tournament) => void }) {
  const [tournament, setTournament] = useState(initial);
  return (
    <SpectatorDisplaySection
      tournament={tournament}
      canEdit={canEdit}
      onTournamentUpdate={(next) => { setTournament(next); onUpdate(next); }}
    />
  );
}

function zeige(overrides: Partial<Tournament> = {}, canEdit = true) {
  const onUpdate = vi.fn<(t: Tournament) => void>();
  render(<Host initial={buildTournament(overrides)} canEdit={canEdit} onUpdate={onUpdate} />);
  return onUpdate;
}

/** Wählt in der Farbauswahl „Standardfarbe <seite>“ die Voreinstellung `hex`. */
function waehle(testId: 'spectator-display-home-color' | 'spectator-display-away-color', hex: string) {
  fireEvent.click(within(screen.getByTestId(testId)).getAllByRole('button')[0]);
  fireEvent.click(screen.getByRole('option', { name: `Farbe ${hex}` }));
}

const gespeichert = (onUpdate: ReturnType<typeof zeige>): Tournament => onUpdate.mock.calls.at(-1)![0];
const vorschau = (seite: 'home' | 'away') => screen.getByTestId(`preview-${seite}`);

describe('@ZM-152 Vorbelegung der Anzeige für Zuschauer', () => {
  it('@ZM-152 Vorbelegung: „Teamfarben in den Ergebniskästen“ steht auf eingeschaltet', () => {
    zeige();
    const schalter = screen.getByRole('switch', { name: /Teamfarben in den Ergebniskästen/ });
    expect(schalter).toHaveAttribute('aria-checked', 'true');
    expect(within(screen.getByTestId('spectator-display-team-colors')).getByText('An')).toBeInTheDocument();
  });

  it.each([
    ['Standardfarbe Heim', 'spectator-display-home-color', 'Blau', BLAU],
    ['Standardfarbe Gast', 'spectator-display-away-color', 'Rot', ROT],
  ] as const)('@ZM-152 Vorbelegung: „%s“ steht auf %s', (_label, testId, name, hex) => {
    zeige();
    const feld = screen.getByTestId(testId);
    expect(within(feld).getByText(name)).toBeInTheDocument();
    expect(within(feld).getByText(hex)).toBeInTheDocument();
  });

  it('@ZM-152 Vorschau zeigt zwei Ergebniskästen mit diesen Einstellungen (Heim Blau, Gast Rot)', () => {
    zeige();
    expect(within(screen.getByTestId('spectator-display-preview')).getAllByRole('img')).toHaveLength(2);
    expect(vorschau('home')).toHaveAttribute('data-color', BLAU);
    expect(vorschau('away')).toHaveAttribute('data-color', ROT);
  });

  it('@ZM-152 gespeicherte Einstellung wird gezeigt (Heim Rot, Teamfarben aus)', () => {
    zeige({ spectatorDisplay: { teamColors: false, homeColor: ROT, awayColor: BLAU } });
    expect(screen.getByRole('switch', { name: /Teamfarben/ })).toHaveAttribute('aria-checked', 'false');
    expect(vorschau('home')).toHaveAttribute('data-color', ROT);
    expect(vorschau('away')).toHaveAttribute('data-color', BLAU);
  });
});

describe('@ZM-153 Die Vorschau weist auf zu ähnliche Standardfarben hin', () => {
  it('@ZM-153 Blau/Rot: kein Hinweis, speichern geht', () => {
    const onUpdate = zeige();
    expect(screen.queryByTestId('spectator-display-similar-hint')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(gespeichert(onUpdate).spectatorDisplay).toEqual({ teamColors: true, homeColor: BLAU, awayColor: ROT });
  });

  it('@ZM-153 Blau/Navy: Hinweis „zu ähnlich“, Vorschau zeigt Navy, speichern geht trotzdem', () => {
    const onUpdate = zeige();
    waehle('spectator-display-away-color', NAVY);
    expect(screen.getByTestId('spectator-display-similar-hint')).toHaveTextContent('Diese beiden Farben sehen sich zu ähnlich.');
    expect(vorschau('home')).toHaveAttribute('data-color', BLAU);
    expect(vorschau('away')).toHaveAttribute('data-color', NAVY);
    const speichern = screen.getByRole('button', { name: 'Speichern' });
    expect(speichern).toBeEnabled();
    fireEvent.click(speichern);
    expect(gespeichert(onUpdate).spectatorDisplay).toEqual({ teamColors: true, homeColor: BLAU, awayColor: NAVY });
  });

  it('@ZM-153 Gegenbeispiel: zurück auf Rot, der Hinweis verschwindet wieder', () => {
    zeige();
    waehle('spectator-display-away-color', NAVY);
    expect(screen.getByTestId('spectator-display-similar-hint')).toBeInTheDocument();
    waehle('spectator-display-away-color', ROT);
    expect(screen.queryByTestId('spectator-display-similar-hint')).toBeNull();
  });

  it('@ZM-153 Navy gespeichert: der Monitor zeigt in einem Spiel ohne Farben Heim Blau und Gast Weiß', () => {
    const onUpdate = zeige();
    waehle('spectator-display-away-color', NAVY);
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const boxes = buildMonitorView(gespeichert(onUpdate)).byId.get('match-7')!.boxes;
    expect(boxes.home.fill).toEqual({ kind: 'solid', color: BLAU });
    expect(boxes.away.fill).toEqual({ kind: 'solid', color: palette.neutral[0] });
  });

  it('RF2 Blau/Blau: Hinweis, speicherbar, der Monitor zeigt Gast Weiß', () => {
    const onUpdate = zeige();
    waehle('spectator-display-away-color', BLAU);
    expect(screen.getByTestId('spectator-display-similar-hint')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const saved = gespeichert(onUpdate);
    expect(saved.spectatorDisplay).toEqual({ teamColors: true, homeColor: BLAU, awayColor: BLAU });
    expect(buildMonitorView(saved).byId.get('match-7')!.boxes.away.fill).toEqual({ kind: 'solid', color: palette.neutral[0] });
  });
});

describe('@ZM-154 Teamfarben ausschalten', () => {
  it('@ZM-154 Schalter aus und speichern: gespeichert mit teamColors false, Monitor zeigt die Standardfarben', () => {
    const onUpdate = zeige();
    fireEvent.click(screen.getByRole('switch', { name: /Teamfarben in den Ergebniskästen/ }));
    expect(screen.getByRole('switch', { name: /Teamfarben/ })).toHaveAttribute('aria-checked', 'false');
    expect(within(screen.getByTestId('spectator-display-team-colors')).getByText('Aus')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(gespeichert(onUpdate).spectatorDisplay?.teamColors).toBe(false);
  });

  it('Gegenbeispiel: ohne Speichern ändert sich das Turnier nicht', () => {
    const onUpdate = zeige();
    fireEvent.click(screen.getByRole('switch', { name: /Teamfarben/ }));
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('Fixrunde A5 Speichern-Knopf', () => {
  it('A5 nach dem Speichern räumt der Abbau den Timer der Meldung „Gespeichert“ auf', () => {
    const aufraeumen = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount } = render(<Host initial={buildTournament()} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(screen.getByRole('status')).toHaveTextContent('Gespeichert');
    const vorher = aufraeumen.mock.calls.length;
    unmount();
    expect(aufraeumen.mock.calls.length).toBeGreaterThan(vorher);
    aufraeumen.mockRestore();
  });

  it('Gegenbeispiel: ohne Speichern kein Timer zum Aufräumen und keine Meldung', () => {
    zeige();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('Fixrunde 2 A6: Speichern in fester Fußleiste (Mockup einstellungen.html)', () => {
  it('A6 Speichern steht in einer am Fensterrand festen Leiste und ist die Haupttaste', () => {
    zeige();
    const leiste = screen.getByTestId('spectator-display-footer');
    expect(leiste).toHaveStyle({ position: 'fixed', bottom: '0px' });
    const knopf = within(leiste).getByRole('button', { name: 'Speichern' });
    expect(knopf).toHaveAttribute('data-primary');
  });

  it('A6 die Leiste speichert wie der Knopf vorher (Navy bleibt speicherbar)', () => {
    const onUpdate = zeige();
    waehle('spectator-display-away-color', NAVY);
    fireEvent.click(within(screen.getByTestId('spectator-display-footer')).getByRole('button', { name: 'Speichern' }));
    expect(gespeichert(onUpdate).spectatorDisplay?.awayColor).toBe(NAVY);
  });

  it('A6 Gegenbeispiel: ohne Recht keine Leiste und kein Speichern', () => {
    zeige({}, false);
    expect(screen.queryByTestId('spectator-display-footer')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
  });
});
