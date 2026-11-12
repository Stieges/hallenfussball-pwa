/**
 * @SL-239 Die Auswahl der Aktionen zeigt oben das Spiel und unten eine gefüllte Haupttaste (Szenariogrundriss, Beispiele je Zustand).
 * Gemessen wird der echte Weg: ScheduleDisplay mit echtem Spielplan-Generator und echten deutschen Texten (wie SL-193-aktionsauswahl);
 * die Aktionen selbst und ihre Menge prüft SL-193 (@SL-193 nennt sie als Menge ohne feste Reihenfolge).
 * Dazu: @OB-066 (Abzeichen trägt das Wort), @OB-064 (Spielzeile mit Kästen), @OB-022 (höchstens eine gefüllte Taste, Größen),
 * @EK-063 (beendet: „Ergebnis korrigieren“), @HE-042 @FU-113 (Helfer).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

import { generateFullSchedule, type ScheduledMatch } from '../../../core/generators';
import type { Match, Team } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ScheduleDisplay } from '../../ScheduleDisplay';
import { ToastProvider } from '../../ui/Toast';
import { MatchTimeShiftContext } from '../matchTimeShiftContext';
import type { MatchActionRights } from '../actionMenu/matchActions';
import { matchOf, viewOf, type Cache } from './scheduleViewFixture';

const LEITUNG: MatchActionRights = { lead: true, play: true, schedule: true };
const HELFER: MatchActionRights = { lead: false, play: true, schedule: false };

const teams: Team[] = [1, 2, 3, 4].map((n) => ({ id: testUuid(n), name: `Team ${n}`, group: 'A' }));
const turnier = createMockTournament({ id: 'turnier-239', teams, numberOfTeams: 4, numberOfGroups: 1, numberOfFields: 2, refereeConfig: { mode: 'organizer', numberOfReferees: 2 } });
const plan = generateFullSchedule(turnier);
const SPIEL: ScheduledMatch = plan.allMatches[0];

const ZUSTAND: Record<'geplant' | 'läuft' | 'beendet', Cache> = {
  geplant: {},
  läuft: { matchStatus: 'running', scoreA: 1, scoreB: 0 },
  beendet: { matchStatus: 'finished', scoreA: 2, scoreB: 1 },
};

function zeige(zustand: keyof typeof ZUSTAND | Cache, rights: MatchActionRights): void {
  const cache = typeof zustand === 'string' ? ZUSTAND[zustand] : zustand;
  const current: Match[] = plan.allMatches.map((m) => matchOf(m, m.id === SPIEL.id ? cache : {}));
  const view = viewOf(current, teams, { tournament: { numberOfFields: 2, refereeConfig: turnier.refereeConfig } });
  render(
    <ToastProvider><MatchTimeShiftContext.Provider value={{ originalTimeOf: () => undefined, shiftFrom: vi.fn() }}>
      <ScheduleDisplay
        schedule={plan} currentMatches={current} view={view} editable actionRights={rights}
        onNavigateToCockpit={vi.fn()} onCorrect={vi.fn()} onScoreChange={vi.fn()} onRefereeChange={vi.fn()} onFieldChange={vi.fn()}
        forfeit={{ mark: vi.fn(), revoke: vi.fn() }} canEndRunning={rights.lead}
      />
    </MatchTimeShiftContext.Provider></ToastProvider>,
  );
  act(() => { fireEvent.click(screen.getAllByTestId(`match-name-${SPIEL.id}-home`)[0]); });
}

const blatt = () => screen.getByTestId('match-action-menu');
const kopf = () => within(blatt()).getByTestId('dialog-surface-header');
const tasten = () => within(blatt()).getAllByRole('listitem').map((li) => within(li).getByRole('button'));
const gefuellt = () => tasten().filter((taste) => taste.hasAttribute('data-primary'));

beforeEach(() => { vi.clearAllMocks(); });

describe('@SL-239 Kopf des Blatts: Abzeichen neben dem Titel, Zeit, Feld, Spielzeile mit Kästen', () => {
  it('@SL-239 @OB-066 läuft: Abzeichen „Live“ steht neben dem Titel „Spiel n“, darunter Zeit und Feld, im Kasten der Stand 1 : 0', () => {
    zeige('läuft', LEITUNG);
    const titel = within(kopf()).getByRole('heading', { name: `Spiel ${SPIEL.matchNumber}` });
    const abzeichen = within(kopf()).getByTestId('match-action-badge');
    expect(abzeichen).toHaveTextContent('Live');
    expect(abzeichen.parentElement).toBe(titel.parentElement); // eine Zeile mit dem Titel, nicht darunter
    expect(within(kopf()).getByTestId('match-action-meta')).toHaveTextContent(new RegExp(`${SPIEL.time} Uhr · Feld ${SPIEL.field}`));
    expect(within(kopf()).getByTestId(`match-box-aktion-${SPIEL.id}-home-digits`)).toHaveTextContent('1');
    expect(within(kopf()).getByTestId(`match-box-aktion-${SPIEL.id}-away-digits`)).toHaveTextContent('0');
  });

  it('@SL-239 @OB-064 Heim steht oben, Gast darunter', () => {
    zeige('läuft', LEITUNG);
    const heim = within(kopf()).getByTestId(`match-name-aktion-${SPIEL.id}-home`);
    const gast = within(kopf()).getByTestId(`match-name-aktion-${SPIEL.id}-away`);
    expect(heim.compareDocumentPosition(gast) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('@SL-239 @OB-066 geplant: Abzeichen „Geplant“ (das Wort, nie nur Farbe), die Kästen sind leer; Gegenbeispiel läuft: Kästen tragen eine Ziffer', () => {
    zeige('geplant', LEITUNG);
    expect(within(kopf()).getByTestId('match-action-badge')).toHaveTextContent('Geplant');
    expect(within(kopf()).getByTestId(`match-box-aktion-${SPIEL.id}-home`)).toBeInTheDocument();
    expect(within(kopf()).queryByTestId(`match-box-aktion-${SPIEL.id}-home-digits`)).toBeNull();
  });

  it('@SL-239 @OB-066 beendet: Abzeichen „Ende“ mit dem Endstand 2 : 1', () => {
    zeige('beendet', LEITUNG);
    expect(within(kopf()).getByTestId('match-action-badge')).toHaveTextContent('Ende');
    expect(within(kopf()).getByTestId(`match-box-aktion-${SPIEL.id}-home-digits`)).toHaveTextContent('2');
    expect(within(kopf()).getByTestId(`match-box-aktion-${SPIEL.id}-away-digits`)).toHaveTextContent('1');
  });

  it('@SL-239 @OB-066 ein abgesetztes Spiel trägt das Wort „ausgefallen“, ein gewertetes („Nicht angetreten“) das Wort „Ende“', () => {
    zeige({ matchStatus: 'skipped' }, LEITUNG);
    expect(within(kopf()).getByTestId('match-action-badge')).toHaveTextContent('ausgefallen');
    cleanup();
    zeige({ matchStatus: 'finished', scoreA: 0, scoreB: 2, decidedBy: 'forfeit' }, LEITUNG);
    expect(within(kopf()).getByTestId('match-action-badge')).toHaveTextContent('Ende');
  });
});

describe('@SL-239 Haupttaste: gefüllt, zuletzt, höchstens eine', () => {
  const FALL: Array<[string, keyof typeof ZUSTAND, MatchActionRights, string, string]> = [
    ['Turnierleitung', 'geplant', LEITUNG, 'enterResult', 'Ergebnis eintragen'],
    ['Turnierleitung', 'läuft', LEITUNG, 'toCockpit', 'Zum Cockpit'],
    ['Turnierleitung', 'beendet', LEITUNG, 'correct', 'Ergebnis korrigieren'],
    ['Helfer', 'geplant', HELFER, 'toCockpit', 'Zum Cockpit'],
    ['Helfer', 'läuft', HELFER, 'toCockpit', 'Zum Cockpit'],
    ['Helfer', 'beendet', HELFER, 'protocol', 'Protokoll ansehen'],
  ];
  for (const [wer, zustand, rechte, id, wort] of FALL) {
    it(`@SL-239 ${wer}, Spiel ${zustand}: Haupttaste „${wort}“ steht gefüllt als letzte Taste, sonst ist keine gefüllt`, () => {
      zeige(zustand, rechte);
      expect(gefuellt().map((taste) => taste.dataset.testid)).toEqual([`match-action-${id}`]);
      expect(tasten().at(-1)).toBe(gefuellt()[0]);
      expect(gefuellt()[0]).toHaveTextContent(wort);
    });
  }

  it('@SL-239 @EK-063 @FU-113 Gegenbeispiel: ein Helfer bei einem beendeten Spiel hat keine Korrektur, seine Haupttaste ist „Protokoll ansehen“', () => {
    zeige('beendet', HELFER);
    expect(screen.queryByTestId('match-action-correct')).toBeNull();
    expect(gefuellt().map((taste) => taste.dataset.testid)).toEqual(['match-action-protocol']);
  });

  it('@SL-239 @HE-042 Gegenbeispiel: ein Helfer bei einem geplanten Spiel bekommt keine Eingabe als Haupttaste', () => {
    zeige('geplant', HELFER);
    expect(screen.queryByTestId('match-action-enterResult')).toBeNull();
    expect(gefuellt()[0]).toHaveTextContent('Zum Cockpit');
  });

  it('@SL-239 gewertet: die einzige Aktion „Wertung zurücknehmen“ ist keine Haupttaste (keine gefüllte Taste)', () => {
    zeige({ matchStatus: 'finished', scoreA: 0, scoreB: 2, decidedBy: 'forfeit' }, LEITUNG);
    expect(tasten().map((taste) => taste.textContent)).toEqual(['Wertung zurücknehmen']);
    expect(gefuellt()).toHaveLength(0);
  });

  it('@SL-239 abgesetzt: die Turnierleitung hat „Ergebnis eintragen“ als gefüllte Haupttaste (wie der Code es heute tut)', () => {
    zeige({ matchStatus: 'skipped' }, LEITUNG);
    expect(gefuellt().map((taste) => taste.dataset.testid)).toEqual(['match-action-enterResult']);
    expect(tasten().at(-1)).toBe(gefuellt()[0]);
  });

  it('@SL-239 „Nicht angetreten“ trägt die rote Randfarbe und ist nicht gefüllt; die übrigen Einträge haben die Randfarbe der Bedienelemente', () => {
    zeige('geplant', LEITUNG);
    expect(screen.getByTestId('match-action-forfeit').style.border).toContain('--color-error');
    expect(screen.getByTestId('match-action-forfeit')).not.toHaveAttribute('data-primary');
    // nur „Nicht angetreten“ ist rot: kein anderer Eintrag trägt die Farbe (auch „Ab hier verschieben“ nicht)
    for (const taste of tasten().filter((t) => t.dataset.testid !== 'match-action-forfeit')) {
      expect(taste.style.border, taste.dataset.testid).not.toContain('--color-error');
    }
  });

  it('@SL-239 @OB-022 jede Taste mindestens so hoch wie die Haupttaste (56 px, Token), Haupttaste im festen Fuß', () => {
    zeige('geplant', LEITUNG);
    for (const taste of tasten()) { expect(taste.style.minHeight).toContain('--touch-target-primary'); }
    expect(within(screen.getByTestId('dialog-surface-footer')).getByTestId('match-action-enterResult')).toBe(gefuellt()[0]);
  });
});

describe('@SL-239 Symbole und „X“ oben', () => {
  it('@SL-239 jeder Eintrag trägt ein Symbol und sein Wort', () => {
    zeige('geplant', LEITUNG);
    for (const taste of tasten()) {
      expect(taste.querySelector('svg')).not.toBeNull();
      expect(taste.querySelector('[aria-hidden="true"] svg')).not.toBeNull(); // dekorativ: das Wort trägt die Bedeutung
      expect(taste.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('@SL-239 oben rechts schließt ein „X“ (vorgelesen „Schließen“); unten gibt es keine Taste „Schließen“ mehr', () => {
    zeige('läuft', LEITUNG);
    const schliessen = within(blatt()).getAllByRole('button', { name: 'Schließen' });
    expect(schliessen).toHaveLength(1);
    expect(kopf()).toContainElement(schliessen[0]);
    expect(schliessen[0]).toHaveTextContent(/^$/); // nur Symbol, kein sichtbares Wort
    expect(within(screen.getByTestId('dialog-surface-footer')).queryByRole('button', { name: 'Schließen' })).toBeNull();
    act(() => { fireEvent.click(schliessen[0]); });
    expect(screen.queryByTestId('match-action-menu')).toBeNull();
  });

  it('@SL-239 @OB-022 das „X“ ist mindestens 44 px groß (Token)', () => {
    zeige('läuft', LEITUNG);
    const taste = screen.getByTestId('match-action-menu-close');
    expect(taste.style.minWidth).toContain('--touch-target-minimum');
    expect(taste.style.minHeight).toContain('--touch-target-minimum');
  });
});

describe('@SL-239 Anfangsfokus und Tastatur', () => {
  it('@SL-239 nach dem Öffnen trägt kein Bedienelement den Fokus (der Titel, ohne Rahmen), damit „X“ oder die erste Aktion nicht wie eine zweite Haupttaste wirken', () => {
    zeige('geplant', LEITUNG);
    const aktiv = document.activeElement as HTMLElement;
    expect(aktiv.tagName).toBe('H2');
    expect(aktiv).toHaveTextContent(`Spiel ${SPIEL.matchNumber}`);
    expect(aktiv.style.outline).toBe('none');
    expect(aktiv.style.boxShadow).toBe('none'); // die globale Regel [tabindex]:focus-visible setzt sonst auch einen Schatten
    expect(aktiv.closest('button')).toBeNull();
  });

  it('@SL-239 Tab erreicht danach „X“ und alle Einträge der Reihe nach, Esc schließt das Blatt', async () => {
    const user = userEvent.setup();
    zeige('geplant', LEITUNG);
    const erwartet = ['match-action-menu-close', ...tasten().map((taste) => taste.dataset.testid!)];
    const erreicht: string[] = [];
    // eslint-disable-next-line @typescript-eslint/prefer-for-of -- Tab-Schritte zählen, kein Element der Liste
    for (let schritt = 0; schritt < erwartet.length; schritt++) {
      await user.tab();
      erreicht.push((document.activeElement as HTMLElement).dataset.testid ?? '');
    }
    expect(erreicht).toEqual(erwartet);
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('match-action-menu')).toBeNull();
  });
});
