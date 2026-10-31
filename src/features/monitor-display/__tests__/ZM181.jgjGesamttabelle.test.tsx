/**
 * @ZM-181 Bei „Jeder gegen jeden“ zeigt die Monitor-Folie „Alle Tabellen“ eine Gesamttabelle mit allen Teams, ohne „Gruppe A“ oder
 * „Gruppe B“ (Befund C-MONITOR-ALLE-TABELLEN-OHNE-ZEILEN, Prod-Nachlauf N1; Prüfregel @ZM-180: über die echte Server-Antwort).
 * Der Assistent hat bei „Jeder gegen jeden“ bisher die Standardgruppen A und B gespeichert, die Teams haben aber keine Gruppe.
 * Hier geht das Turnier den ganzen Weg: Gerät der Turnierleitung -> Zeilen der Datenbank -> `display_tournament` (Server-Antwort,
 * Kennung „screen“) -> `parsePublicPayload` -> Monitor-Ansicht -> Folie.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { parsePublicPayload } from '../../../core/repositories/publicPayload';
import { serverAntwort, turnierNordSued } from '../../../core/repositories/__tests__/publicEntscheidungKit';
import { createDefaultGroups } from '../../../utils/displayNames';
import { standingsSections } from '../slideContent';
import { buildMonitorView } from '../monitorView';
import { AllStandingsSlide } from '../slides/AllStandingsSlide';
import type { Tournament } from '../../../types/tournament';
import { initRealDeI18n } from '../../../test/realDeI18n';

await initRealDeI18n();

function ueberServer(lokal: Tournament): Tournament {
  const antwort = parsePublicPayload(serverAntwort(lokal, { art: 'gespeichert' }, 'screen'));
  if (antwort.kind !== 'full') {
    throw new Error(`Antwort ${antwort.kind}`);
  }
  return antwort.tournament;
}

/** Das Turnier, wie der Assistent es bisher geschrieben hat: Jeder gegen jeden, aber mit den Standardgruppen A und B. */
const jgjMitStandardgruppen = (): Tournament => ({
  ...turnierNordSued(), groupSystem: 'roundRobin', numberOfGroups: 2, groups: createDefaultGroups(2),
});

describe('@ZM-181 Monitor „Alle Tabellen“ bei Jeder gegen jeden (über die Server-Antwort)', () => {
  it('eine Gesamttabelle, keine Seite „Gruppe A“ oder „Gruppe B“, auch keine leere', () => {
    const t = ueberServer(jgjMitStandardgruppen());
    expect(standingsSections(t, buildMonitorView(t))).toEqual([{ kind: 'overall' }]);
  });

  it('die Folie zeigt alle 6 Teams mit ihren Ergebnissen und keine Gruppenangabe', () => {
    const t = ueberServer(jgjMitStandardgruppen());
    const { container } = render(<AllStandingsSlide tournament={t} view={buildMonitorView(t)} theme="dark" style={{}} page={0} />);
    for (const team of t.teams) {
      expect(container.textContent).toContain(team.name);
    }
    expect(container.textContent).not.toMatch(/Gruppe [AB]/);
  });

  it('Gegenbeispiel: bei Gruppen + Finalrunde bleiben die Gruppen A und B eigene Seiten', () => {
    const lokal: Tournament = {
      ...turnierNordSued(), groupSystem: 'groupsAndFinals', numberOfGroups: 2, groups: createDefaultGroups(2),
      teams: turnierNordSued().teams.map((team, i) => ({ ...team, group: i % 2 === 0 ? 'A' : 'B' })),
    };
    const t = ueberServer(lokal);
    expect(standingsSections(t, buildMonitorView(t)).map((s) => s.kind === 'group' ? s.groupId : s.kind)).toEqual(['A', 'B']);
  });
});
