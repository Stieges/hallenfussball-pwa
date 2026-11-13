/**
 * @ZM-198 Tabelle der Zuschauer-Seite: vor dem ersten beendeten Spiel „–“ statt sechsmal „1“ ·
 * @ZM-205 Tabelle am Handy mit „Sp.“, Aufklapp-Symbol der App statt „▶“ (Vorlesetext, Tippfläche mindestens 44 Pixel) und Tordifferenz mit ausreichendem Kontrast.
 * Echte Komponenten (Gruppentabelle, Handy- und breite Ansicht) mit dem echten deutschen Wortlaut. Der Kontrast im Browser (hell und dunkel, 360 Pixel) steht in
 * `tests/e2e/zuschauer-tabelle-handy-zm205.spec.ts`.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { GroupTables } from '../GroupTables';
import { calculateStandingsPerGroup } from '../../../utils/calculations';
import { nikolaus } from '../../../core/standings/__tests__/decisionTestKit';
import { cssVars } from '../../../design-tokens';
import { initRealDeI18n } from '../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../ui/TeamAvatar', () => ({ TeamAvatar: () => null }));

await initRealDeI18n();

const alleBeendet = nikolaus();
/** Dasselbe Turnier vor dem ersten Anpfiff: kein Spiel beendet, keine Ergebnisse. */
const keinSpiel: Tournament = {
  ...alleBeendet,
  matches: alleBeendet.matches.map(({ scoreA: _a, scoreB: _b, decidedBy: _d, penaltyScoreA: _pa, penaltyScoreB: _pb, ...rest }) => ({ ...rest, matchStatus: 'scheduled' as const })),
};

function tabelle(turnier: Tournament) {
  const { container } = render(<GroupTables standings={calculateStandingsPerGroup(turnier)} teams={turnier.teams} />);
  return {
    container,
    handy: container.querySelector<HTMLElement>('.mobile-view')!,
    breit: container.querySelector<HTMLElement>('.desktop-view')!,
  };
}
const datenzeilen = (wurzel: HTMLElement) => Array.from(wurzel.querySelectorAll('tbody tr')).filter((tr) => tr.querySelector('td:nth-child(2)') !== null && tr.getAttribute('data-testid') !== 'tie-marker-row' && tr.querySelectorAll('td').length > 1);

describe('@ZM-198 Tabelle der Zuschauer-Seite ohne Platz vor dem ersten beendeten Spiel', () => {
  it('kein Spiel beendet: in der Handy- und der breiten Ansicht steht bei allen 6 Teams „–“, nirgends „1“ als Platz', () => {
    const { handy, breit } = tabelle(keinSpiel);
    for (const ansicht of [handy, breit]) {
      const plaetze = datenzeilen(ansicht).map((tr) => tr.querySelector('td')?.textContent);
      expect(plaetze).toEqual(['–', '–', '–', '–', '–', '–']);
    }
  });

  it('Gegenbeispiel: sind Spiele beendet, stehen die Plätze nach der Wertung da und kein „–“', () => {
    const { handy, breit } = tabelle(alleBeendet);
    for (const ansicht of [handy, breit]) {
      const plaetze = datenzeilen(ansicht).map((tr) => tr.querySelector('td')?.textContent);
      expect(plaetze).not.toContain('–');
      expect(plaetze[0]).toBe('1');
    }
  });
});

describe('@ZM-205 Tabelle der Zuschauer-Seite am Handy', () => {
  it('Kopf und Zeile: Platz, Name, „Sp.“, „Diff.“, „Pkt.“ – und eine Spalte für die Taste am Ende', () => {
    const { handy } = tabelle(alleBeendet);
    const kopf = Array.from(handy.querySelectorAll('thead th')).map((th) => th.querySelector('[aria-hidden="true"]')?.textContent ?? '');
    expect(kopf.slice(0, 5)).toEqual(['#', '', 'Sp.', 'Diff.', 'Pkt.']);
    const zeile = datenzeilen(handy)[0];
    const zellen = Array.from(zeile.querySelectorAll('td'));
    expect(zellen).toHaveLength(6);
    expect(zellen[2].textContent).toBe('5'); // alle 15 Spiele beendet: je Team 5 Spiele
    expect(zellen[5].querySelector('button')).not.toBeNull();
  });

  it('Siege, Unentschieden, Niederlagen und Tore stehen erst im aufgeklappten Bereich', () => {
    const { handy } = tabelle(alleBeendet);
    expect(handy.textContent).not.toMatch(/Siege|Unentschieden|Niederlagen|Tore geschossen/);
    const taste = within(handy).getAllByRole('button', { hidden: true })[0];
    fireEvent.click(taste);
    expect(handy.textContent).toMatch(/Siege/);
    expect(handy.textContent).toMatch(/Unentschieden/);
    expect(handy.textContent).toMatch(/Niederlagen/);
    expect(handy.textContent).toMatch(/Tore geschossen/);
    expect(handy.textContent).toMatch(/Tore kassiert/);
  });

  it('Aufklapp-Symbol der App statt „▶“: Pfeil nach unten, aufgeklappt nach oben; Vorlesetext „Details zu <Team> anzeigen“; Tippfläche mindestens 44 Pixel', () => {
    const { handy } = tabelle(alleBeendet);
    const erstesTeam = alleBeendet.teams.find((team) => handy.textContent?.includes(team.name.split(' ')[0]));
    expect(erstesTeam).toBeDefined();
    const tasten = within(handy).getAllByRole('button', { hidden: true });
    expect(tasten).toHaveLength(alleBeendet.teams.length);
    const taste = tasten[0];
    expect(taste.getAttribute('aria-label')).toMatch(/^Details zu .+ anzeigen$/);
    expect(taste.getAttribute('aria-expanded')).toBe('false');
    expect(taste.querySelector('svg')).not.toBeNull();
    const pfadZu = taste.querySelector('svg')?.innerHTML;
    expect(taste.style.minWidth).toBe(cssVars.touchTargets.minimum);
    expect(taste.style.minHeight).toBe(cssVars.touchTargets.minimum);
    fireEvent.click(taste);
    expect(taste.getAttribute('aria-expanded')).toBe('true');
    expect(taste.getAttribute('aria-label')).toMatch(/^Details zu .+ ausblenden$/);
    expect(taste.querySelector('svg')?.innerHTML).not.toBe(pfadZu);
    // ein Antippen der Zeile daneben klappt ebenfalls auf und wieder zu (kein doppeltes Umschalten durch die Taste)
    fireEvent.click(taste);
    expect(taste.getAttribute('aria-expanded')).toBe('false');
  });

  it('Gegenbeispiel: kein grünes Dreieck „▶“ und kein „▼“ als Text irgendwo in der Tabelle', () => {
    const { container, handy } = tabelle(alleBeendet);
    fireEvent.click(within(handy).getAllByRole('button', { hidden: true })[0]);
    expect(container.textContent).not.toMatch(/[▶▼▲►]/);
  });

  it('Tordifferenz: Minus in der Schriftfarbe der Tabelle (4,5 : 1 auf der Wertungsfläche), Plus in der Hauptfarbe – nie Rot auf der Fläche', () => {
    const { handy } = tabelle(alleBeendet);
    const farben = datenzeilen(handy).map((tr) => {
      const zelle = tr.querySelectorAll('td')[3];
      return { wert: Number((zelle.textContent ?? '0').replace('+', '').replace('\u2212', '-')), farbe: (zelle as HTMLElement).style.color };
    });
    expect(farben.some((f) => f.wert < 0)).toBe(true);
    for (const { wert, farbe } of farben) {
      expect(farbe).not.toBe(cssVars.colors.error);
      if (wert < 0) { expect(farbe).toBe(cssVars.colors.textPrimary); }
      if (wert > 0) { expect(farbe).toBe(cssVars.colors.primary); }
    }
  });

  it('die breite Ansicht (Tablet, Laptop) zeigt weiter alle Spalten: Sp., S, U, N, Tore, Diff., Pkt.', () => {
    const { breit } = tabelle(alleBeendet);
    const kopf = Array.from(breit.querySelectorAll('thead th')).map((th) => th.querySelector('[aria-hidden="true"]')?.textContent ?? th.textContent);
    expect(kopf).toEqual(['#', 'Team', 'Sp.', 'S', 'U', 'N', 'Tore', 'Diff.', 'Pkt.']);
    expect(within(breit).queryAllByRole('button', { hidden: true })).toHaveLength(0);
  });
});
