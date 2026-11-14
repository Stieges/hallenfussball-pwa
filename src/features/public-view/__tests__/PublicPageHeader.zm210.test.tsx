/**
 * @ZM-210 Unter dem Turniernamen stehen Wann und Wo, die Einzelheiten lassen sich zuklappen
 * (docs/anforderungen/2026-10-02_zuschauer-und-monitor.md). Beispielzeilen und Wortlaut aus dem Gherkin.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MatchView } from '../../../core/view';
import { PublicPageHeader, type PublicPageHeaderProps } from '../components/PublicPageHeader';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

const SHARE = 'NIKO26';
const spiel = (status: MatchView['status'], time: string): MatchView => ({ status, kickoff: { date: '2026-11-28', time } } as MatchView);
const geplant = [spiel('scheduled', '17:10'), spiel('scheduled', '16:30'), spiel('scheduled', '16:50')];
const angepfiffen = [spiel('running', '16:30'), spiel('scheduled', '16:50')];

const turnier: PublicPageHeaderProps['tournament'] = {
  title: 'Nikolaus-Turnier', ageClass: 'D-Junioren', date: '2026-11-28', groupPhaseGameDuration: 9,
  location: { name: 'Sporthalle Waging', street: 'Mozartstraße 9', postalCode: '83329', city: 'Waging am See' },
  organizer: 'TSV Waging', teams: Array.from({ length: 6 }, (_, i) => ({ id: `t${String(i)}`, name: `Team ${String(i)}` })),
};
const zeige = (matches: readonly MatchView[], tournament = turnier) =>
  render(<PublicPageHeader tournament={tournament} matches={matches} shareCode={SHARE} ended={false} />);
const taste = () => screen.getByTestId('public-head-when-where');
const einzelheiten = () => screen.getByTestId('public-head-details');
const sichtbar = () => einzelheiten().style.display !== 'none';

// Der globale Setup ersetzt localStorage durch Attrappen ohne Speicher: hier ein echter kleiner Speicher
const speicher = new Map<string, string>();
beforeEach(() => {
  speicher.clear();
  vi.stubGlobal('localStorage', { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => { speicher.set(k, v); }, removeItem: (k: string) => { speicher.delete(k); } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('@ZM-210 die Zeile unter dem Turniernamen', () => {
  it('nennt Wochentag und Datum, Beginn des ersten Spiels und den Ort – als Taste, ≥ 44 Bildpunkte, mit aria-expanded und aria-controls', () => {
    zeige(geplant);
    expect(taste()).toHaveTextContent('Sa, 28.11. · ab 16:30 Uhr · Sporthalle Waging');
    expect(taste().style.minHeight).toBe('var(--touch-target-minimum)');
    expect(taste()).toHaveAttribute('aria-controls', einzelheiten().id);
    expect(taste().tagName).toBe('BUTTON');
  });

  it('die bisherige Kopfzeile „Altersklasse • Datum“ gibt es nicht mehr', () => {
    const { container } = zeige(geplant);
    expect(container.textContent).not.toContain('•');
    expect(container.textContent).not.toContain('28.11.2026');
  });
});

describe('@ZM-210 Zeile 1: kein Spiel angepfiffen, erster Besuch – aufgeklappt', () => {
  it('Einzelheiten sichtbar: Altersklasse, Ort ausgeschrieben, Spielzeit, Teams, Veranstalter', () => {
    zeige(geplant);
    expect(taste()).toHaveAttribute('aria-expanded', 'true');
    expect(sichtbar()).toBe(true);
    expect(screen.getByTestId('public-head-age')).toHaveTextContent('D-Junioren');
    expect(screen.getByTestId('public-head-location')).toHaveTextContent('Sporthalle Waging, Mozartstraße 9, 83329 Waging am See');
    expect(screen.getByTestId('public-head-duration')).toHaveTextContent('9 Minuten je Spiel');
    expect(screen.getByTestId('public-head-teams')).toHaveTextContent('6 Teams');
    expect(screen.getByTestId('public-head-organizer')).toHaveTextContent('TSV Waging');
  });

  it('Plural: 1 Minute je Spiel, 1 Team', () => {
    zeige(geplant, { ...turnier, groupPhaseGameDuration: 1, teams: turnier.teams.slice(0, 1) });
    expect(screen.getByTestId('public-head-duration')).toHaveTextContent('1 Minute je Spiel');
    expect(screen.getByTestId('public-head-teams')).toHaveTextContent('1 Team');
  });
});

describe('@ZM-210 Zeile 2: das erste Spiel ist angepfiffen, erster Besuch – zugeklappt', () => {
  it('Einzelheiten zu, die Zeile bleibt sichtbar (Gegenbeispiel)', () => {
    zeige(angepfiffen);
    expect(taste()).toHaveAttribute('aria-expanded', 'false');
    expect(sichtbar()).toBe(false);
    expect(taste()).toBeVisible();
    expect(taste()).toHaveTextContent('Sa, 28.11. · ab 16:30 Uhr · Sporthalle Waging');
  });

  it('Gegenbeispiel: ein ausgefallenes Spiel ist kein Anpfiff, es bleibt aufgeklappt', () => {
    zeige([spiel('cancelled', '16:30'), spiel('scheduled', '16:50')]);
    expect(sichtbar()).toBe(true);
  });
});

describe('@ZM-210 Zeile 3: eigene Wahl gilt am Gerät für dieses Turnier weiter, auch nach dem Neuladen', () => {
  it('Petra klappt vor dem Anpfiff zu und öffnet die Seite neu: zugeklappt', async () => {
    const { unmount } = zeige(geplant);
    await userEvent.click(taste());
    expect(sichtbar()).toBe(false);
    unmount();
    zeige(geplant);
    expect(sichtbar()).toBe(false);
  });

  it('Gegenbeispiel: nach dem Anpfiff aufgeklappt bleibt aufgeklappt (die Wahl schlägt den Standard)', async () => {
    const { unmount } = zeige(angepfiffen);
    await userEvent.click(taste());
    expect(sichtbar()).toBe(true);
    unmount();
    zeige(angepfiffen);
    expect(sichtbar()).toBe(true);
  });

  it('Gegenbeispiel: die Wahl für ein Turnier gilt nicht für ein anderes (Schlüssel je Turnier)', async () => {
    const { unmount } = zeige(geplant);
    await userEvent.click(taste());
    unmount();
    render(<PublicPageHeader tournament={turnier} matches={geplant} shareCode="ANDERES" ended={false} />);
    expect(sichtbar()).toBe(true);
  });

  it('ohne Speicher (Zugriff wirft) gilt der Standard, die Taste funktioniert trotzdem', async () => {
    const gesperrt = (): never => { throw new Error('gesperrt'); };
    vi.stubGlobal('localStorage', { getItem: gesperrt, setItem: gesperrt, removeItem: gesperrt });
    zeige(geplant);
    expect(sichtbar()).toBe(true);
    await userEvent.click(taste());
    expect(sichtbar()).toBe(false);
  });
});

describe('@ZM-210 fehlt eine Angabe, fehlt nur dieser Teil – keine leere Zeile, kein „undefined“', () => {
  it('kein Ort, kein Veranstalter, keine Altersklasse', () => {
    const { container } = zeige(geplant, { ...turnier, location: { name: '' }, organizer: undefined, ageClass: '' });
    expect(taste().querySelector('span')).toHaveTextContent(/^Sa, 28\.11\. · ab 16:30 Uhr$/);
    expect(screen.queryByTestId('public-head-location')).toBeNull();
    expect(screen.queryByTestId('public-head-organizer')).toBeNull();
    expect(screen.queryByTestId('public-head-age')).toBeNull();
    expect(screen.getByTestId('public-head-teams')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/undefined|null/);
    expect(einzelheiten().querySelectorAll('dd')).toHaveLength(2);
  });

  it('ohne Anstoßzeiten fehlt „ab … Uhr“', () => {
    zeige([{ status: 'scheduled' } as MatchView]);
    expect(taste().querySelector('span')).toHaveTextContent(/^Sa, 28\.11\. · Sporthalle Waging$/);
  });
});

describe('@ZM-210 Datum über die Sprache der Ansicht', () => {
  it('Deutsch „Sa, 28.11.“, Englisch „Sat, 28/11“; ohne Datum nichts', async () => {
    const { headDateText } = await import('../publicHeadFacts');
    expect(headDateText('2026-11-28', 'de')).toBe('Sa, 28.11.');
    expect(headDateText('2026-11-28', 'en')).toBe('Sat, 28/11');
    expect(headDateText(undefined, 'de')).toBeUndefined();
  });
});
