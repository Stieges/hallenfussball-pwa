/**
 * Paket „Endstand-PDF“ (Befund C-ENDSTAND-PDF-GESPERRT) – Tests aus dem Gherkin, mit echtem PDF-Bau; nur `doc.save` ist am
 * Mitschnitt ersetzt und das Lesen des gespeicherten Endstands (`readStoredFinalStandings`, Server) durch eine Vorgabe.
 * Szenarien: @DR-011, @DR-009, @DR-048 (Z. 2 Rechte und Vorwahl), @DR-049, @BM-041 und das Gegenbeispiel „Kindermodus-Lecks“
 * (Record Endstand) für das PDF der Zuschauer-Seite.
 *
 * Der gespeicherte Endstand ist absichtlich NICHT die Reihenfolge, die eine Neurechnung ergäbe (keine Ergebnisse im Plan):
 * stehen die Plätze im PDF so, kommen sie aus der gespeicherten Zeile (@ET-045).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import deTournament from '../../../i18n/locales/de/tournament.json';
import enTournament from '../../../i18n/locales/en/tournament.json';
import { lastCapture, resetCapture } from '../../../lib/pdf/__tests__/pdfCapture';
import { HALLENCUP_TEAMS, hallencupSchedule, hallencupTournament, withMatchResult } from '../../../lib/pdf/__tests__/pdfFixture';
import type { FinalStandingsSnapshot } from '../../../core/standings/finalStandings/types';
import type { TeamId } from '../../../core/models/schemas/MatchSlotSchema';
import type { StoredFinalStandingsResult } from '../../../core/repositories/storedFinalStandingsRead';
import type { Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('jspdf', async importOriginal => {
  const mod = await importOriginal<typeof import('jspdf')>();
  const { capturingJsPdf } = await import('../../../lib/pdf/__tests__/pdfCapture');
  return { ...mod, default: capturingJsPdf(mod.default), jsPDF: capturingJsPdf(mod.jsPDF) };
});
const readStored = vi.fn<(client: unknown, id: string) => Promise<StoredFinalStandingsResult>>();
vi.mock('../../../core/repositories/storedFinalStandingsRead', () => ({ readStoredFinalStandings: (client: unknown, id: string) => readStored(client, id) }));

const i18next = (await import('i18next')).default;
const { initReactI18next } = await import('react-i18next');
const { PDFExportDialog } = await import('../PDFExportDialog');
const { PublicPdfButton } = await import('../../PublicPdfButton');
const { publicFinalSource } = await import('../pdfExport/finalPdfSource');
const { buildChoice } = await import('../pdfExport/buildChoice');

const NOW = new Date(2026, 10, 14, 18, 5);
const CLOSED_AT = new Date(2026, 10, 14, 17, 40);
const ENDSTAND_NAMEN = ['SC Ost', 'SV Hof', 'FC Nord', 'TuS Tal', 'DJK Berg', 'FC Mitte', 'TSV West', 'SV Süd'];
const ABSCHLUSS = 'Endstand – abgeschlossen am 14.11.2026 um 17:40';

const snapshot: FinalStandingsSnapshot = {
  format: 1,
  ranking: ENDSTAND_NAMEN.map((name, i) => {
    const team = HALLENCUP_TEAMS.find(t => t.name === name);
    if (!team) { throw new Error(name); }
    return { place: i + 1, teamId: team.id as TeamId, teamName: name, origin: { kind: 'groupPlace', group: team.group ?? '', place: 1 } };
  }),
  scorers: [],
  appVersion: 'test',
  computedAt: CLOSED_AT.toISOString(),
};
const STORED_OK: StoredFinalStandingsResult = { status: 'ok', snapshot, finishedAt: CLOSED_AT.toISOString() };

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: 'de', fallbackLng: 'de', defaultNS: 'tournament', ns: ['tournament'],
    resources: { de: { tournament: deTournament }, en: { tournament: enTournament } }, interpolation: { escapeValue: false },
  });
});
beforeEach(() => {
  resetCapture();
  readStored.mockReset();
  readStored.mockResolvedValue(STORED_OK);
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
});

const closed = (overrides: Partial<Tournament> = {}): Tournament =>
  hallencupTournament({ lifecycleStatus: 'finished', finishedAt: CLOSED_AT.toISOString(), ...overrides });

function renderDialog(tournament: Tournament, props: { canCreateFinal?: boolean; canCreateNotice?: boolean } = { canCreateFinal: true, canCreateNotice: true }) {
  return render(
    <MemoryRouter>
      <PDFExportDialog isOpen onClose={vi.fn()} tournament={tournament} schedule={hallencupSchedule(tournament)} standings={[]} {...props} />
    </MemoryRouter>,
  );
}
const save = async (): Promise<void> => {
  fireEvent.click(screen.getByTestId('pdf-save'));
  await waitFor(() => expect(screen.queryByTestId('pdf-done')).toBeInTheDocument(), { timeout: 20000 });
};
const pages = (): string[][] => lastCapture()?.pages ?? [];
const all = (): string[] => pages().flat();
/**
 * Plätze nach der letzten Überschrift „Platzierung“ (der Block steht am Ende, zweispaltig gesetzt: „1.“ „SC Ost“ „5.“ „DJK Berg“ …),
 * nach Platzziffer geordnet: der Name, der hinter „n.“ steht.
 */
const placementNames = (): string[] => {
  const texts = all();
  const start = texts.lastIndexOf('Platzierung');
  if (start < 0) { return []; }
  const rest = texts.slice(start + 1);
  const places: Array<[number, string]> = [];
  rest.forEach((s, i) => {
    const m = /^(\d+)\.$/.exec(s);
    if (m && ENDSTAND_NAMEN.includes(rest[i + 1] ?? '')) { places.push([Number(m[1]), rest[i + 1]]); }
  });
  return places.sort((a, b) => a[0] - b[0]).map(([, name]) => name);
};
const finalReady = async (): Promise<void> => {
  await waitFor(() => expect(screen.getByTestId('pdf-choice-final')).toHaveAttribute('aria-disabled', 'false'));
};

describe('@DR-011 Das Endstand-PDF gibt es erst nach dem Abschluss', () => {
  it('abgeschlossen am 14.11.2026 um 17:40: jede Seite trägt „Endstand – abgeschlossen am 14.11.2026 um 17:40“ statt eines Stands', async () => {
    renderDialog(closed());
    await finalReady();
    await save();

    expect(pages().length).toBeGreaterThan(0);
    for (const page of pages()) {
      expect(page.join(' ')).toContain(ABSCHLUSS);
      expect(page.join(' ')).not.toMatch(/Stand \d{2}\.\d{2}\./);
    }
    expect(lastCapture()?.filename).toBe('Hallencup_Nord_Endstand_2026-11-14_1740.pdf');
  });

  it('es nennt die Plätze 1 bis 8 so, wie sie der gespeicherte Endstand führt (nicht neu gerechnet)', async () => {
    renderDialog(closed());
    await finalReady();
    await save();

    expect(placementNames()).toEqual(ENDSTAND_NAMEN);
    expect(readStored).toHaveBeenCalledWith(null, 'tour-hallencup-nord');
  });

  it('vor dem Abschluss: die Karte „Endstand“ ist ausgegraut mit „Erst nach Abschluss des Turniers“, der Server wird nicht gefragt', () => {
    renderDialog(hallencupTournament({ lifecycleStatus: 'fixed' }));

    expect(screen.getByTestId('pdf-choice-final')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('pdf-choice-final-reason')).toHaveTextContent('Erst nach Abschluss des Turniers');
    expect(screen.getByTestId('pdf-choice-schedule')).toHaveAttribute('aria-checked', 'true');
    expect(readStored).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel ohne Netz: der gespeicherte Endstand ist nicht lesbar – kein Endstand-PDF, kein Spielplan mit „steht nach dem Finale fest“, klare Meldung', async () => {
    readStored.mockResolvedValue({ status: 'failed' });
    renderDialog(closed());

    await waitFor(() => expect(screen.getByTestId('pdf-choice-final-reason')).toHaveTextContent('Der gespeicherte Endstand ist gerade nicht lesbar. Mit Netz noch einmal öffnen.'));
    expect(screen.getByTestId('pdf-choice-final')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('pdf-choice-schedule')).toHaveAttribute('aria-disabled', 'true');
    // Vorwahl springt auf die Fassung ohne Ergebnisse (die nie einen Endstand zeigt)
    expect(screen.getByTestId('pdf-choice-blank')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('@DR-048 Z. 2 Gegenbeispiel: ein schneller Tipp, solange der gespeicherte Endstand lädt', () => {
  it('solange gelesen wird, ist „Als PDF speichern“ gesperrt und weder „Spielplan ohne Ergebnisse“ noch „Spielplan“ vorgewählt', async () => {
    readStored.mockReturnValue(new Promise<StoredFinalStandingsResult>(() => undefined));
    renderDialog(closed(), { canCreateFinal: true });

    await waitFor(() => expect(screen.getByTestId('pdf-choice-final-reason')).toHaveTextContent('Der gespeicherte Endstand wird geladen'));
    expect(screen.getByTestId('pdf-save')).toBeDisabled();
    expect(screen.getByTestId('pdf-choice-blank')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('pdf-choice-schedule')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('pdf-save'));
    expect(lastCapture()).toBeUndefined();
  });

  it('ohne Endstand-Karte: solange gelesen wird, ist Speichern gesperrt, „Spielplan ohne Ergebnisse“ ist nicht vorgewählt', async () => {
    readStored.mockReturnValue(new Promise<StoredFinalStandingsResult>(() => undefined));
    renderDialog(closed(), { canCreateFinal: false });

    await waitFor(() => expect(screen.getByTestId('pdf-choice-schedule')).toHaveAttribute('aria-disabled', 'true'));
    expect(screen.getByTestId('pdf-save')).toBeDisabled();
    expect(screen.getByTestId('pdf-choice-blank')).toHaveAttribute('aria-checked', 'false');
  });
});

describe('@DR-009 Nach dem Abschluss nennt der Spielplan den ganzen Endstand', () => {
  it('abgeschlossen: „Spielplan“ nennt alle 8 Plätze so, wie sie der gespeicherte Endstand führt; Fußzeile bleibt „Stand …“', async () => {
    renderDialog(closed());
    await finalReady();
    fireEvent.click(screen.getByTestId('pdf-choice-schedule'));
    await save();

    expect(placementNames()).toEqual(ENDSTAND_NAMEN);
    expect(all().join(' ')).not.toContain('Die Platzierung steht nach dem Finale fest');
    expect(all().join(' ')).toMatch(/Stand 14\.11\. 18:05/);
    expect(lastCapture()?.filename).toBe('Hallencup_Nord_Spielplan_2026-11-14_1805.pdf');
  });

  it('vor dem Abschluss steht „Die Platzierung steht nach dem Finale fest“', async () => {
    renderDialog(hallencupTournament({ lifecycleStatus: 'fixed' }));
    await save();

    expect(all().join(' ')).toContain('Die Platzierung steht nach dem Finale fest');
    expect(placementNames()).toEqual([]);
  });
});

describe('@DR-048 Z. 2 „Als PDF“ im Turnier – „Endstand“ ist schon vorgewählt; Turnierleitung, Co-Admin und Helfer', () => {
  it('Olli/Maria/Tom (Recht writeMatchData): nach dem Abschluss ist „Endstand“ vorgewählt, ein Tipp auf „Als PDF speichern“ erzeugt es', async () => {
    renderDialog(closed(), { canCreateFinal: true });
    await waitFor(() => expect(screen.getByTestId('pdf-choice-final')).toHaveAttribute('aria-checked', 'true'));
    await save();

    expect(all().join(' ')).toContain(ABSCHLUSS);
  });

  it('ohne Recht auf das Endstand-PDF (z. B. Trainer): die Karte „Endstand“ fehlt, der Spielplan nennt trotzdem den gespeicherten Endstand (@DR-009)', async () => {
    renderDialog(closed(), { canCreateFinal: false });
    await waitFor(() => expect(screen.getByTestId('pdf-choice-schedule')).toHaveAttribute('aria-disabled', 'false'));

    expect(screen.queryByTestId('pdf-choice-final')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('pdf-choice-schedule')).toHaveAttribute('aria-checked', 'true'));
    await save();
    expect(all().join(' ')).not.toContain(ABSCHLUSS);
    expect(placementNames()).toEqual(ENDSTAND_NAMEN);
  });
});

describe('@DR-050 Sind Ergebnisse oder Tabellen für Zuschauer ausgeblendet, gibt es kein Endstand-PDF', () => {
  for (const [name, hidden] of [['Tabellen ausgeblendet', { hideRankingsForPublic: true }], ['Ergebnisse ausgeblendet (Kindermodus)', { hideScoresForPublic: true }]] as const) {
    it(`${name}: die Karte „Endstand“ ist ausgegraut und nennt den Grund; die App erzeugt kein Endstand-PDF ohne Plätze`, async () => {
      renderDialog(closed(hidden), { canCreateFinal: true, canCreateNotice: true });
      await waitFor(() => expect(screen.getByTestId('pdf-choice-schedule')).toHaveAttribute('aria-checked', 'true'));

      expect(screen.getByTestId('pdf-choice-final')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByTestId('pdf-choice-final-reason')).toHaveTextContent('Ergebnisse oder Tabellen sind für Zuschauer ausgeblendet – ohne sie zeigt das PDF keine Plätze.');
      fireEvent.click(screen.getByTestId('pdf-choice-final'));
      expect(screen.getByTestId('pdf-choice-final')).toHaveAttribute('aria-checked', 'false');
      await save();
      expect(all().join(' '), 'gespeichert wird der Spielplan, kein Endstand-PDF').not.toContain(ABSCHLUSS);
    });
  }

  it('Sicherung im Bau: auch direkt aufgerufen entsteht kein Endstand-PDF ohne Plätze', async () => {
    const tournament = closed({ hideRankingsForPublic: true });
    const ranking = snapshot.ranking.map((row) => ({ place: row.place, team: { id: row.teamId, name: row.teamName } }));
    await expect(buildChoice('final', {
      tournament, schedule: hallencupSchedule(tournament), standings: [], audience: 'organizer', online: true, now: NOW, final: { ranking, closedAt: CLOSED_AT },
    })).rejects.toThrow();
  });
});

describe('@DR-049 Ein abgebrochenes Turnier bietet kein Endstand-PDF an', () => {
  it('abgebrochen: die Karte „Endstand“ im Dialog ist ausgegraut, vorgewählt bleibt „Spielplan“', () => {
    renderDialog(hallencupTournament({ lifecycleStatus: 'cancelled', cancelledAt: CLOSED_AT.toISOString() }));

    expect(screen.getByTestId('pdf-choice-final')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('pdf-choice-final-reason')).toHaveTextContent('Erst nach Abschluss des Turniers');
    expect(screen.getByTestId('pdf-choice-schedule')).toHaveAttribute('aria-checked', 'true');
    expect(readStored).not.toHaveBeenCalled();
  });
});

describe('@BM-041 Mama Petra lädt nach dem Abschluss das Endstand-PDF', () => {
  const played = (tournament: Tournament) => withMatchResult(hallencupSchedule(tournament), 1, { scoreA: 2, scoreB: 0 });
  const viewerShown = { results: true, tables: true, finalShown: true };
  const publicStandings = { status: 'final' as const, finishedAt: CLOSED_AT.toISOString(), snapshot };

  it('auf der Zuschauer-Seite: Plätze 1 bis 8 und die Ergebnisse der Spiele, „Endstand – abgeschlossen am …“, keine Torschützenliste', async () => {
    const tournament = closed();
    const schedule = played(tournament);
    const withResult = { ...tournament, matches: schedule.fixtureMatches };
    render(<MemoryRouter><PublicPdfButton tournament={withResult} schedule={schedule} standings={[]} final={publicFinalSource(withResult, viewerShown, publicStandings)} /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('public-pdf-button'));

    expect(screen.getByTestId('pdf-choice-final')).toHaveAttribute('aria-checked', 'true');
    await save();
    expect(placementNames()).toEqual(ENDSTAND_NAMEN);
    expect(all().join(' ')).toContain(ABSCHLUSS);
    // Spiel 1 (TuS Tal – FC Nord) mit 2:0: im PDF stehen „2“, „:“, „0“ als eigene Stücke
    expect(all().join(' ')).toContain('TuS Tal 2 : 0 FC Nord');
    expect(all().join(' ')).not.toContain('Torschützen');
    expect(readStored).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel Kindermodus-Lecks: im Kindermodus oder mit ausgeblendeten Tabellen gibt es auf der Zuschauer-Seite kein Endstand-PDF', () => {
    const tournament = closed();
    expect(publicFinalSource(tournament, { ...viewerShown, results: false }, publicStandings)).toEqual({ kind: 'open' });
    expect(publicFinalSource(tournament, { ...viewerShown, tables: false }, publicStandings)).toEqual({ kind: 'open' });
    expect(publicFinalSource(tournament, viewerShown, { status: 'none' })).toEqual({ kind: 'open' });
    render(<MemoryRouter><PublicPdfButton tournament={tournament} schedule={hallencupSchedule(tournament)} standings={[]} final={{ kind: 'open' }} /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('public-pdf-button'));

    expect(screen.queryByTestId('pdf-choice-final')).toBeNull();
    expect(screen.getByTestId('pdf-viewer-plan')).toBeInTheDocument();
  });

  it('Gegenbeispiel vor dem Abschluss: kein Endstand für Zuschauer, auch wenn der Server noch einen alten liefert (wieder geöffnet)', () => {
    expect(publicFinalSource(hallencupTournament({ lifecycleStatus: 'fixed' }), viewerShown, publicStandings)).toEqual({ kind: 'open' });
  });
});
