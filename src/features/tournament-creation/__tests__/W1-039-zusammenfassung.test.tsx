/**
 * @W1-039 Die Zusammenfassung vor dem Festlegen zeigt, was gilt (Nikolaus-Turnier, echte deutsche Texte).
 * Entwurf über den echten `TournamentCreationService.createDraft`, Plan über den echten Generator.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Team, Tournament } from '../../../types/tournament';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { TournamentCreationService } from '../../../core/services/TournamentCreationService';
import { generateFullSchedule } from '../../../core/generators';
import { pdfRuleEntries, pdfRuleLines, pdfRulesFrom } from '../../../lib/pdf/rules';
import { appTranslator } from '../../../lib/pdf/appTranslator';
import { buildPdfTexts } from '../../../lib/pdf/translations';
import { testUuid } from '../../../test/testIds';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

import { Step5_Overview } from '../Step5_Overview';
import { ModeSelection } from '../components/ModeSelection';

const TEAMS: Team[] = ['Adler', 'Bären', 'Condor', 'Delfine', 'Eulen', 'Falken'].map((name, i) => ({ id: testUuid(i + 1), name }));

function nikolaus(overrides: Partial<Tournament> = {}): Tournament {
  return new TournamentCreationService({} as never).createDraft({
    title: 'Nikolaus-Turnier', ageClass: '', teams: TEAMS, numberOfTeams: 6, numberOfFields: 1,
    groupSystem: 'roundRobin', date: '2026-11-28', startTime: '10:00',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, placementsToPlayOut: [1],
    location: { name: 'Sporthalle' }, ...overrides,
  });
}

function zusammenfassung(draft: Tournament): void {
  render(<Step5_Overview formData={draft} onSave={vi.fn()} createDraft={() => draft} />);
}

const wert = (testId: string): string => within(screen.getByTestId(testId)).getByText(/./, { selector: 'div:last-child' }).textContent;

describe('@W1-039 Zusammenfassung mit den Werten des Nikolaus-Turniers', () => {
  it('zeigt Hallenfußball, Wochentag und Datum, Uhrzeit, Modus, Spielzahl, Spielzeit, Pause und die Gleichstandsregel', () => {
    zusammenfassung(nikolaus());
    expect(screen.getByText('Hallenfußball')).toBeInTheDocument();
    expect(screen.queryByText('Fußball')).toBeNull();
    expect(wert('step5-date')).toBe('Samstag, 28.11.2026');
    expect(wert('step5-time')).toBe('10:00 Uhr');
    expect(wert('step5-mode')).toBe('Jeder gegen jeden');
    expect(wert('step5-matches')).toBe('15 Spiele');
    expect(wert('step5-duration')).toBe('10 Min.');
    expect(wert('step5-break')).toBe('2 Min.');
    expect(wert('step5-fields')).toBe('1 Feld');
    expect(within(screen.getByTestId('step5-rules')).getByText('Gleichstand auf Platz 1: Strafstoßschießen')).toBeInTheDocument();
  });

  it('kein Begriff steht doppelt: „Klassisch“ und das Datum je einmal, das Rohdatum nirgends', () => {
    zusammenfassung(nikolaus());
    expect(screen.getAllByText('Klassisch')).toHaveLength(1);
    expect(screen.queryByText(/2026-11-28/)).toBeNull();
    expect(screen.getAllByText(/28\.11\.2026/)).toHaveLength(1);
  });

  it('die Regelzeilen sind genau die Zeilen des PDF-Kopfs (Wertung, Gleichstand), ohne eigene Formulierung', () => {
    const draft = nikolaus({ rulebook: 'BFV-Richtlinien' });
    zusammenfassung(draft);
    const t = buildPdfTexts(appTranslator('de'), 'de');
    const kopf = pdfRuleLines(pdfRulesFrom(draft, generateFullSchedule(draft)), t);
    const angezeigt = within(screen.getByTestId('step5-rules')).getAllByRole('listitem').map(li => li.textContent);
    expect(angezeigt.length).toBeGreaterThan(1);
    expect(angezeigt.every(zeile => kopf.includes(zeile ?? ''))).toBe(true);
    // Modus und Spielzeit stehen als eigene Felder da, alles andere des Kopfs steht unverändert in den Regeln
    const erwartet = pdfRuleEntries(pdfRulesFrom(draft, generateFullSchedule(draft)), t)
      .filter(e => e.kind !== 'mode' && e.kind !== 'duration').map(e => e.line);
    expect(angezeigt).toEqual(erwartet);
    expect(angezeigt).toContain('Regelwerk: BFV-Richtlinien');
  });

  it('Gegenbeispiel Gruppen + Finale: Modus „Gruppen + Finalrunde“, nicht „Jeder gegen jeden“', () => {
    const teams = Array.from({ length: 8 }, (_, i): Team => ({ id: testUuid(50 + i), name: `Team ${i + 1}`, group: i < 4 ? 'A' : 'B' }));
    zusammenfassung(nikolaus({ groupSystem: 'groupsAndFinals', numberOfGroups: 2, numberOfTeams: 8, teams }));
    expect(wert('step5-mode')).toBe('Gruppen + Finalrunde');
    expect(screen.queryByText('Jeder gegen jeden')).toBeNull();
  });

  it('ohne Pause und ohne ausgespielten Platz entfallen die Pause-Box und die Gleichstandszeile', () => {
    zusammenfassung(nikolaus({ groupPhaseBreakDuration: 0, placementsToPlayOut: [] }));
    expect(screen.queryByTestId('step5-break')).toBeNull();
    expect(screen.queryByText(/Gleichstand auf/)).toBeNull();
  });
});

describe('@W1-039 Untertitel der Modus-Karte passt zur Wahl', () => {
  it('Jeder gegen jeden → „Jeder gegen jeden“, nicht „Gruppen + Finalrunde“', () => {
    render(<ModeSelection selectedMode="classic" onModeChange={vi.fn()} groupSystem="roundRobin" />);
    expect(screen.getByTestId('wizard-mode-classic')).toHaveTextContent('Jeder gegen jeden');
    expect(screen.getByTestId('wizard-mode-classic')).not.toHaveTextContent('Gruppen + Finalrunde');
  });

  it('Gruppen und Finalrunde → „Gruppen + Finalrunde“', () => {
    render(<ModeSelection selectedMode="classic" onModeChange={vi.fn()} groupSystem="groupsAndFinals" />);
    expect(screen.getByTestId('wizard-mode-classic')).toHaveTextContent('Gruppen + Finalrunde');
  });
});
