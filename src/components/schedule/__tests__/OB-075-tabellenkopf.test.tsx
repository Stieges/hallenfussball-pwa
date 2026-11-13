/**
 * @OB-075 Begriffe stehen ausgeschrieben, Kurzformen nur in Tabellenköpfen · @OB-076 zusammengesetzte Bezeichnungen folgen der Sprache.
 * Die echten Komponenten des Spielplans (Gruppentabelle, Kopf der Spielkarte, Zeile der Spielkarte) in Deutsch und Englisch.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactElement } from 'react';
import { GroupTables } from '../GroupTables';
import { MatchCardHeader } from '../MatchCard/MatchCardHeader';
import { MatchCardDesktop } from '../MatchCard/MatchCardDesktop';
import { calculateStandingsPerGroup } from '../../../utils/calculations';
import { nikolaus } from '../../../core/standings/__tests__/decisionTestKit';
import { createRealI18n, type RealLanguage } from '../../../test/realI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../ui/TeamAvatar', () => ({ TeamAvatar: () => null }));

async function renderIn(lng: RealLanguage, ui: ReactElement) {
  const i18n = await createRealI18n(lng);
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

const turnier = nikolaus();
const standings = calculateStandingsPerGroup(turnier);

/** Kopfzeile der Desktop-Tabelle: je Zelle sichtbarer Text (ohne den Vorlesetext) und title. */
function kopfzellen(container: HTMLElement) {
  const tabelle = container.querySelector<HTMLElement>('.desktop-view table')!;
  return Array.from(tabelle.querySelectorAll('thead th')).map((th) => ({
    sichtbar: th.querySelector('[aria-hidden="true"]')?.textContent ?? th.textContent ?? '',
    titel: th.querySelector('[title]')?.getAttribute('title') ?? null,
  }));
}

describe('@OB-075 Tabellenkopf der Gruppentabelle: Kurzformen mit ausgeschriebenem Hinweis', () => {
  it('Deutsch: #, Sp., S, U, N, Diff., Pkt. – jede mit dem ausgeschriebenen Begriff als title', async () => {
    const { container } = await renderIn('de', <GroupTables standings={standings} teams={turnier.teams} />);
    const kopf = kopfzellen(container);
    expect(kopf.map((k) => k.sichtbar)).toEqual(['#', 'Team', 'Sp.', 'S', 'U', 'N', 'Tore', 'Diff.', 'Pkt.']);
    expect(kopf.map((k) => k.titel)).toEqual(['Platz', null, 'Spiele', 'Siege', 'Unentschieden', 'Niederlagen', null, 'Tordifferenz', 'Punkte']);
  });

  it('Englisch: #, P, W, D, L, GD, Pts – jede mit dem ausgeschriebenen Begriff als title', async () => {
    const { container } = await renderIn('en', <GroupTables standings={standings} teams={turnier.teams} />);
    const kopf = kopfzellen(container);
    expect(kopf.map((k) => k.sichtbar)).toEqual(['#', 'Team', 'P', 'W', 'D', 'L', 'Goals', 'GD', 'Pts']);
    expect(kopf.map((k) => k.titel)).toEqual(['Position', null, 'Played', 'Won', 'Drawn', 'Lost', null, 'Goal difference', 'Points']);
  });

  it('Handy-Tabelle: #, Sp., Diff., Pkt. mit Hinweis (@ZM-205: Sp. ist dazugekommen); Gegenbeispiel: nie „Pl.“, „Pos“ oder „Pl“', async () => {
    const { container } = await renderIn('de', <GroupTables standings={standings} teams={turnier.teams} />);
    const mobil = container.querySelector<HTMLElement>('.mobile-view table')!;
    const kopf = Array.from(mobil.querySelectorAll('thead th')).map((th) => th.querySelector('[aria-hidden="true"]')?.textContent ?? th.textContent);
    expect(kopf.slice(0, 5)).toEqual(['#', 'Team', 'Sp.', 'Diff.', 'Pkt.']);
    expect(container.textContent).not.toMatch(/\bPl\.?(?![a-zäöüß])|\bPos\b/);
  });

  it('Detailzeile (ausgeklappt gelesen): Unentschieden und Niederlagen ausgeschrieben, nie „Unent.“ oder „Niederl.“', async () => {
    const { container } = await renderIn('de', <GroupTables standings={standings} teams={turnier.teams} />);
    expect(container.textContent).not.toMatch(/Unent\.|Niederl\./);
  });
});

describe('@OB-076 Spielkarte: Gruppe und Schiedsrichter in der gewählten Sprache', () => {
  const kopf = (referee: string) => (
    <MatchCardHeader scheduledTime="13:00" field={1} group="A" showGroupLabel referee={referee} status="scheduled" result={null} />
  );

  it('Englisch: „Group A“ und „Referee 2“, nie „Gr.“, „SR“ oder „Ref“', async () => {
    const { container } = await renderIn('en', kopf('2'));
    expect(container.textContent).toContain('Group A');
    expect(container.textContent).toContain('Referee 2');
    expect(container.textContent).not.toMatch(/\bGr\.|\bSR\b|\bRef\b|Referee:/);
  });

  it('Deutsch: „Gruppe A“ und „Schiedsrichter 2“, nie „Gr.“ oder „SR“', async () => {
    const { container } = await renderIn('de', kopf('2'));
    expect(container.textContent).toContain('Gruppe A');
    expect(container.textContent).toContain('Schiedsrichter 2');
    expect(container.textContent).not.toMatch(/\bGr\.|\bSR\b|Schiedsrichter:/);
  });

  it('Beendet nach Strafstoßschießen: „beendet nach Strafstoßschießen“, nie „i. E.“; nach Verlängerung ausgeschrieben', async () => {
    const strafstoss = { goalsA: 2, goalsB: 2, penaltyA: 4, penaltyB: 3, winner: 'a' as const, decision: 'penalty' as const };
    const { container, unmount } = await renderIn('de', <MatchCardHeader scheduledTime="13:00" showGroupLabel={false} status="finished" result={strafstoss} />);
    expect(container.textContent).toContain('beendet nach Strafstoßschießen');
    expect(container.textContent).not.toMatch(/i\. E\./);
    unmount();
    const verlaengerung = { goalsA: 3, goalsB: 2, winner: 'a' as const, decision: 'overtime' as const };
    const en = await renderIn('en', <MatchCardHeader scheduledTime="13:00" showGroupLabel={false} status="finished" result={verlaengerung} />);
    expect(en.container.textContent).toContain('ended after extra time');
    expect(en.container.textContent).not.toMatch(/a\.e\.t\./);
  });

  it('Zeile der Spielkarte (Desktop): „Referee 2“ auf Englisch, „Schiedsrichter 2“ auf Deutsch', async () => {
    const team = (id: string, name: string) => ({ id, name });
    const zeile = (
      <MatchCardDesktop
        matchId="m4" matchNumber={4} scheduledTime="13:00" field={1} referee="2" group="A" showGroupLabel
        homeTeam={team('h', 'DJK Kammer')} awayTeam={team('a', 'TSV Petting')} status="scheduled"
      />
    );
    const en = await renderIn('en', zeile);
    expect(within(en.container).getByText('Referee 2')).toBeInTheDocument();
    expect(en.container.textContent).toContain('Group A');
    en.unmount();
    const de = await renderIn('de', zeile);
    expect(within(de.container).getByText('Schiedsrichter 2')).toBeInTheDocument();
    expect(screen.queryByText(/\bSR\b/)).toBeNull();
  });
});
