/**
 * @OB-075 Kurzformen nur im Kopf einer Tabellenspalte – bei „n. V.“ und „i. E.“ auch in der Ergebniszelle einer Tabelle –, immer mit
 * ausgeschriebenem Begriff für Darüberfahren und Screenreader (Daniel 02.11.2026). Je Beispielzeile des Grundrisses, Deutsch und Englisch:
 * Schiedsrichter „SR“/„Ref“, Gruppe „Gr.“/„Grp“, Strafstoßschießen „i. E.“, Verlängerung „n. V.“. · @OB-064 drei Zeilen (Karte am Handy
 * schreibt „nach Verlängerung“ aus, Tabelle am Desktop „2:2 (4:3 i. E.)“ und „3:2 n. V.“) · @W3-031 „Schiedsrichter 2“ im Spielplan.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactElement } from 'react';
import { MatchCardDesktop } from '../MatchCard/MatchCardDesktop';
import { MatchCardHeader } from '../MatchCard/MatchCardHeader';
import { MatchCard } from '../MatchCard';
import { ShortLabel } from '../../ui/atoms/ShortLabel';
import { formatTableResult, type ResultFigures } from '../matchResult';
import { createRealI18n, type RealLanguage } from '../../../test/realI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../ui/TeamAvatar', () => ({ TeamAvatar: () => null }));

async function renderIn(lng: RealLanguage, ui: ReactElement) {
  const i18n = await createRealI18n(lng);
  return { i18n, ...render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>) };
}

const NORD = { id: 'nord', name: 'FC Nord' };
const MITTE = { id: 'mitte', name: 'SG Mitte' };
const strafstoss: ResultFigures = { goalsA: 2, goalsB: 2, penaltyA: 4, penaltyB: 3, winner: 'a', decision: 'penalty' };
const verlaengerung: ResultFigures = { goalsA: 3, goalsB: 2, winner: 'a', decision: 'overtime' };
const regulaer: ResultFigures = { goalsA: 1, goalsB: 0, winner: 'a', decision: null };

describe('@OB-075 Tabellenkopf: Schiedsrichter und Gruppe mit ausgeschriebenem Hinweis', () => {
  it.each([
    ['referee', 'de', 'SR', 'Schiedsrichter'],
    ['referee', 'en', 'Ref', 'Referee'],
    ['group', 'de', 'Gr.', 'Gruppe'],
    ['group', 'en', 'Grp', 'Group'],
  ] as const)('%s (%s): sichtbar „%s“, Hinweis (title) und Vorlesetext „%s“', async (term, lng, kurz, lang) => {
    const { container } = await renderIn(lng, <table><thead><tr><th><ShortLabel term={term} /></th></tr></thead></table>);
    const th = container.querySelector('th')!;
    const sichtbar = th.querySelector('[aria-hidden="true"]');
    expect(sichtbar?.textContent).toBe(kurz);
    expect(sichtbar?.getAttribute('title')).toBe(lang);
    // Vorlesetext: eigener Text, der nicht versteckt ist
    const vorlesen = Array.from(th.querySelectorAll('span')).find((s) => s.getAttribute('aria-hidden') !== 'true' && s.textContent === lang);
    expect(vorlesen).toBeDefined();
  });
});

describe('@OB-075 Ergebniszelle einer Tabelle: „i. E.“ und „n. V.“ mit ausgeschriebenem Begriff', () => {
  it.each([
    ['de', 'i. E.', 'Strafstoßschießen', '3:2 n. V.', 'nach Verlängerung'],
    ['en', 'pens', 'Penalty Shootout', '3:2 a.e.t.', 'after extra time'],
  ] as const)('%s: Tabellenzeile zeigt „2:2 (4:3 %s)“ und „%s“ zum Darüberfahren und Vorlesen; „%s“ bei Verlängerung', async (lng, kurzE, langE, tabelleV, langV) => {
    const { i18n } = await renderIn(lng, <span />);
    const t = (key: 'matchResult.overtimeShort' | 'matchResult.penaltyShort') => i18n.t(key, { ns: 'tournament' });
    expect(formatTableResult(strafstoss, t)).toBe(`2:2 (4:3 ${kurzE})`);
    expect(formatTableResult(verlaengerung, t)).toBe(tabelleV);
    expect(formatTableResult(regulaer, t)).toBe('1:0');

    for (const [ergebnis, langer, text] of [[strafstoss, langE, `2:2 (4:3 ${kurzE})`], [verlaengerung, langV, tabelleV]] as const) {
      const zeile = render(
        <I18nextProvider i18n={i18n}>
          <MatchCardDesktop matchId="hf1" homeTeam={NORD} awayTeam={MITTE} status="finished" result={ergebnis} />
        </I18nextProvider>,
      );
      const knopf = within(zeile.container).getByTestId('match-circle-hf1');
      expect(knopf.textContent).toBe(text);
      expect(knopf.getAttribute('title')?.toLowerCase()).toContain(langer.toLowerCase());
      expect(knopf.getAttribute('aria-label')?.toLowerCase()).toContain(langer.toLowerCase());
      zeile.unmount();
    }
  });

  it.each(['de', 'en'] as const)('%s: außerhalb der Ergebniszelle steht die Entscheidung ausgeschrieben (Kopf der Spielkarte), nie als Kurzform', async (lng) => {
    const lang = lng === 'de' ? ['nach Strafstoßschießen', 'nach Verlängerung'] : ['on penalties', 'after extra time'];
    const kurz = /\bi\. E\.|\bn\. V\.|\bpens\b|\ba\.e\.t\./;
    for (const [ergebnis, erwartet] of [[strafstoss, lang[0]], [verlaengerung, lang[1]]] as const) {
      const { container, unmount } = await renderIn(lng, <MatchCardHeader scheduledTime="13:00" showGroupLabel={false} status="finished" result={ergebnis} />);
      expect(container.textContent).toContain(erwartet);
      expect(container.textContent).not.toMatch(kurz);
      unmount();
    }
  });
});

describe('@OB-064 Spielkarte am Handy und Tabelle am Desktop (Halbfinale 1 „FC Nord gegen SG Mitte“)', () => {
  const karte = (ergebnis: ResultFigures) => (
    <MatchCard matchId="hf1" homeTeam={NORD} awayTeam={MITTE} scheduledTime="14:20" field={1} status="finished" result={ergebnis} />
  );

  it('Zeile 1, Strafstoßschießen 4:3: Karte „(4)“ / „(3)“ ohne Kurzform, Tabelle „2:2 (4:3 i. E.)“', async () => {
    const { container, unmount } = await renderIn('de', karte(strafstoss));
    const handy = container.querySelector('.mobile-view') ?? container;
    expect(handy.textContent).toContain('nach Strafstoßschießen');
    expect(handy.textContent).not.toMatch(/i\. E\./);
    unmount();
    const tabelle = await renderIn('de', <MatchCardDesktop matchId="hf1" homeTeam={NORD} awayTeam={MITTE} status="finished" result={strafstoss} />);
    expect(tabelle.getByTestId('match-circle-hf1').textContent).toBe('2:2 (4:3 i. E.)');
  });

  it('Zeile 2, 3:2 nach Verlängerung: Karte schreibt „nach Verlängerung“ aus (nie „n. V.“), Tabelle „3:2 n. V.“', async () => {
    const { container, unmount } = await renderIn('de', karte(verlaengerung));
    const handy = container.querySelector('.mobile-view') ?? container;
    expect(handy.textContent).toContain('nach Verlängerung');
    expect(handy.textContent).not.toContain('n. V.');
    unmount();
    const tabelle = await renderIn('de', <MatchCardDesktop matchId="hf1" homeTeam={NORD} awayTeam={MITTE} status="finished" result={verlaengerung} />);
    expect(tabelle.getByTestId('match-circle-hf1').textContent).toBe('3:2 n. V.');
  });

  it('Zeile 3, 1:0 regulär: weder Karte noch Tabelle tragen einen Zusatz', async () => {
    const { container, unmount } = await renderIn('de', karte(regulaer));
    expect(container.textContent).not.toMatch(/n\. V\.|i\. E\.|Verlängerung|Strafstoß/);
    unmount();
    const tabelle = await renderIn('de', <MatchCardDesktop matchId="hf1" homeTeam={NORD} awayTeam={MITTE} status="finished" result={regulaer} />);
    expect(tabelle.getByTestId('match-circle-hf1').textContent).toBe('1:0');
  });
});

describe('@W3-031 Schiedsrichter im Spielplan: „Schiedsrichter 2“, „SR“ nur als Spaltenkopf', () => {
  it.each([['de', 'Schiedsrichter 2'], ['en', 'Referee 2']] as const)('%s: Karte und Zeile zeigen „%s“, nirgends „SR“ oder „Ref“ im Text', async (lng, erwartet) => {
    const kopf = await renderIn(lng, <MatchCardHeader scheduledTime="13:00" field={1} group="A" showGroupLabel referee="2" status="scheduled" result={null} />);
    expect(kopf.container.textContent).toContain(erwartet);
    expect(kopf.container.textContent).not.toMatch(/\bSR\b|\bRef\b|Gr\.|\bGrp\b/);
    kopf.unmount();
    const zeile = await renderIn(lng, <MatchCardDesktop matchId="m4" matchNumber={4} scheduledTime="13:00" field={1} referee="2" group="A" showGroupLabel homeTeam={NORD} awayTeam={MITTE} status="scheduled" />);
    expect(within(zeile.container).getByText(erwartet)).toBeInTheDocument();
    expect(zeile.container.textContent).not.toMatch(/\bSR\b|\bRef\b|\bGr\.|\bGrp\b/);
  });
});
