/**
 * Inventar-Test Sperre nach dem Abschluss (Plan R3 V6, R3-3; @LZ-036 „Nach dem Abschluss ist alles gesperrt“, @LZ-037):
 * Jede Datei in `src`, die ein Turnier speichert (`onTournamentUpdate(`, `handleTournamentUpdate(`, `saveTournament(` ...),
 * steht hier -- entweder GESPERRT (mit der Datei, in der die Sperre sitzt, und einem Beleg dort) oder BEWUSST FREI (mit
 * Grund). Ein neuer Aufrufer ohne Eintrag macht den Test rot: dann ist zu entscheiden, ob die Stelle nach dem Abschluss
 * angeboten werden darf. Die Einzeltests je Einstieg stehen in `Abschluss.sperre.*.test.tsx` und `*.nachAbschluss.test.tsx`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const SRC = join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const isTest = (file: string): boolean => /__tests__|\.test\.|\.spec\.|\/test\//.test(file);
const rel = (file: string): string => relative(ROOT, file).split('\\').join('/');
const sourceFiles = walk(SRC)
  .filter((f) => /\.(ts|tsx)$/.test(f))
  .map((f) => ({ path: rel(f), text: readFileSync(f, 'utf8') }))
  .filter((f) => !isTest(f.path));

/** Aufrufe, die ein Turnier speichern. Nur Oberfläche und Hooks (core/ speichert nur im Auftrag dieser Stellen). */
const SAVE_CALL = /\b(onTournamentUpdate|handleTournamentUpdate|handleAsyncTournamentUpdate|saveTournament|softDeleteTournament|restoreTournament)\s*\(/;
const UI_DIRS = ['src/features/', 'src/screens/', 'src/components/', 'src/hooks/', 'src/services/', 'src/App.tsx'];

/** Beleg, dass an der Sperrstelle wirklich gefragt wird (Recht über useCan oder Zustand des Turniers). */
const LOCK_MARKER = /useCan\(|useCanState\(|useTournamentClosed\(|isTournamentClosed\(|useLifecycleLock\(|CategoryRightGate/;

interface Locked { gate: string; why: string }
interface Free { free: string }
type Entry = Locked | Free;

const HOME = 'src/features/tournament-management/';
const ADMIN = 'src/features/tournament-admin/';

const INVENTORY: Record<string, Entry> = {
  // --- gesperrt, Sperre in der Datei selbst ---
  'src/App.tsx': { gate: 'src/App.tsx', why: 'Wizard-Route und handleEditInWizard prüfen isTournamentClosed (Import/Kopie sind neue Turniere)' },
  [`${ADMIN}categories/DangerZone/index.tsx`]: { gate: `${ADMIN}categories/DangerZone/index.tsx`, why: 'Zurücksetzen entfällt (useTournamentClosed), Löschen braucht useCan(deleteTournament)' },
  [`${ADMIN}categories/Exports/index.tsx`]: { gate: `${ADMIN}categories/Exports/index.tsx`, why: 'Wiederherstellen entfällt (useTournamentClosed)' },
  [`${ADMIN}categories/Visibility/index.tsx`]: { gate: `${ADMIN}categories/Visibility/index.tsx`, why: 'Inhalts-Schalter über useCan(tournamentSettings); Teilen/Beenden bleibt (@LZ-037 Z. 5)' },
  [`${HOME}ManagementTab.tsx`]: { gate: `${HOME}ManagementTab.tsx`, why: 'Cockpit: canPlay/istLeitung aus useCan' },
  [`${HOME}ScheduleTab.tsx`]: { gate: `${HOME}ScheduleTab.tsx`, why: 'Spielplan: useCan(manageSchedule) + useTournamentClosed' },
  [`${HOME}SettingsTab.tsx`]: { gate: `${HOME}SettingsTab.tsx`, why: 'Formular hinter useCan(tournamentSettings), Wizard-Einstieg hinter useCan(restructure)' },
  [`${HOME}TeamsTab.tsx`]: { gate: `${HOME}TeamsTab.tsx`, why: 'useCan(teams/restructure)' },
  'src/screens/TournamentManagementScreen.tsx': { gate: 'src/screens/TournamentManagementScreen.tsx', why: 'Hinweis-Kasten, Monitor-Editor und Trefferliste nur offen' },
  'src/hooks/useTournaments.ts': { gate: 'src/hooks/useTournaments.ts', why: 'Papierkorb/Wiederherstellen werfen bei abgeschlossenem Turnier' },
  // --- gesperrt, Sperre sitzt im Elternteil ---
  [`${ADMIN}categories/MatchCockpit/index.tsx`]: { gate: `${ADMIN}components/CategoryRightGate.tsx`, why: 'CLOSED_LOCKED: nach dem Abschluss nur der Hinweis' },
  [`${ADMIN}categories/Metadata/index.tsx`]: { gate: `${ADMIN}components/CategoryRightGate.tsx`, why: 'Kategorie hinter useCan(tournamentSettings)' },
  [`${ADMIN}categories/Settings/index.tsx`]: { gate: `${ADMIN}components/CategoryRightGate.tsx`, why: 'Kategorie hinter useCan(tournamentSettings)' },
  [`${ADMIN}categories/Sponsors/index.tsx`]: { gate: `${ADMIN}components/CategoryRightGate.tsx`, why: 'Kategorie hinter useCan(tournamentSettings)' },
  [`${ADMIN}categories/Visibility/SpectatorDisplaySection.tsx`]: { gate: `${ADMIN}categories/Visibility/index.tsx`, why: 'canEdit kommt aus useCan(tournamentSettings)' },
  'src/features/schedule-editor/ScheduleEditor.tsx': { gate: `${HOME}ScheduleTab.tsx`, why: 'wird nur im Spielplan eingebunden, abgeschlossen nicht mehr gezeigt' },
  'src/features/schedule-editor/hooks/useScheduleEditor.ts': { gate: `${HOME}ScheduleTab.tsx`, why: 'wie ScheduleEditor' },
  [`${HOME}hooks/usePendingChanges.ts`]: { gate: `${HOME}ScheduleTab.tsx`, why: 'Bearbeitungsmodus des Spielplans, Einstieg gesperrt' },
  [`${HOME}hooks/useScheduleHistory.ts`]: { gate: `${HOME}ScheduleTab.tsx`, why: 'Rückgängig/Wiederholen im Bearbeitungsmodus' },
  [`${HOME}hooks/useScheduleTabActions.ts`]: { gate: `${HOME}ScheduleTab.tsx`, why: 'Ergebnis/Schiri/Feld: abgeschlossen ohne Eingabe in der Tabelle' },
  [`${HOME}time-shift/useTimeShift.ts`]: { gate: `${HOME}ScheduleTab.tsx`, why: 'Zeiten verschieben (B-26): enabled nur offen' },
  'src/hooks/useFields.ts': { gate: `${HOME}SettingsTab.tsx`, why: 'Felder: Formular gesperrt, Kategorie hinter CategoryRightGate' },
  'src/hooks/useSponsors.ts': { gate: `${HOME}SettingsTab.tsx`, why: 'Sponsoren: Formular gesperrt, Kategorie hinter CategoryRightGate' },
  'src/hooks/useMonitors.ts': { gate: `${HOME}MonitorsConfigTab.tsx`, why: 'Monitor-Folien: useCan(manageScreens), Editor öffnet abgeschlossen nicht' },
  'src/screens/TournamentCreationScreen.tsx': { gate: 'src/App.tsx', why: 'Wizard (alle 5 Schritte) öffnet abgeschlossen nicht, App.tsx zeigt den Hinweis' },
  // --- bewusst frei ---
  'src/hooks/useCopyTournament.ts': { free: 'Kopie/Probe-Kopie legt ein NEUES Turnier an (@LZ-037: Ablage bleibt)' },
  'src/services/api.ts': { free: 'alte HTTP-Schnittstelle ohne Aufrufer in der Oberfläche' },
};

const callers = sourceFiles.filter((f) => UI_DIRS.some((d) => f.path.startsWith(d)) && SAVE_CALL.test(f.text)).map((f) => f.path);
const text = (path: string): string => sourceFiles.find((f) => f.path === path)?.text ?? '';

describe('Inventar: Sperre nach dem Abschluss (R3-3, V6)', () => {
  it('jeder Aufrufer, der ein Turnier speichert, steht im Inventar (neuer Aufrufer ohne Eintrag: bewusst entscheiden)', () => {
    const missing = callers.filter((path) => !(path in INVENTORY));
    expect(missing).toEqual([]);
  });

  it('das Inventar enthält keine Dateien, die nichts mehr speichern oder nicht mehr existieren (nur kürzen)', () => {
    const stale = Object.keys(INVENTORY).filter((path) => !callers.includes(path));
    expect(stale).toEqual([]);
  });

  it('jede gesperrte Stelle hat an ihrer Sperrstelle einen Beleg (useCan, useTournamentClosed oder isTournamentClosed)', () => {
    const withoutMarker = Object.entries(INVENTORY)
      .filter((entry): entry is [string, Locked] => 'gate' in entry[1])
      .filter(([, entry]) => !LOCK_MARKER.test(text(entry.gate)))
      .map(([path, entry]) => `${path} -> ${entry.gate}`);
    expect(withoutMarker).toEqual([]);
  });

  it('jede bewusst freie Stelle hat einen Grund', () => {
    const noReason = Object.entries(INVENTORY).filter(([, e]) => 'free' in e && e.free.trim().length < 10).map(([p]) => p);
    expect(noReason).toEqual([]);
  });

  it('nur CategoryRightGate lässt per openAfterClose ein Recht nach dem Abschluss offen (Positivliste: nur kürzen, nie erweitern)', () => {
    const users = sourceFiles
      .filter((f) => /openAfterClose\s*:/.test(f.text) && f.path !== 'src/features/auth/hooks/useCan.ts')
      .map((f) => f.path);
    expect(users).toEqual([`${ADMIN}components/CategoryRightGate.tsx`]);
  });
});
