/**
 * Spielplan für gesäte Test-Turniere (offline-Suite, Seed über `seedIndexedDB`).
 *
 * Bis @W5-042 erzeugte die Verwaltung beim Laden eines Turniers ohne Spiele selbst einen Plan, und diese Specs säten bewusst
 * `matches: []`. Das Öffnen der Verwaltung schreibt jetzt nie und erzeugt keinen Plan (`TournamentService.loadTournament`); ein
 * festgelegtes Turnier trägt seine Spiele aus `publish()`. Der Seed tut dasselbe: derselbe Generator und dieselbe Abbildung wie
 * `TournamentCreationService.publish` (ohne Status-Felder: alle Spiele „angesetzt“).
 *
 * Der Generator liest `glossary.json` ohne Import-Attribut; Playwrights eigener Lader lehnt das ab, `tsx` lädt es. Darum wird er hier
 * über `tsImport` geladen.
 */
import { tsImport } from 'tsx/esm/api';
import type { Tournament } from '../../../src/core/models/types';

type GeneratorModule = typeof import('../../../src/core/generators');
type OriginModule = typeof import('../../../src/core/models/matchOrigin');

// Top-Level-`await` (die Suite läuft als ESM): `mitSpielplan` bleibt für die Aufrufer synchron.
const generators = (await tsImport('../../../src/core/generators/index.ts', import.meta.url)) as GeneratorModule;
const origin = (await tsImport('../../../src/core/models/matchOrigin.ts', import.meta.url)) as OriginModule;

export function mitSpielplan<T extends Record<string, unknown>>(tournament: T): T & { matches: unknown[] } {
  const schedule = generators.generateFullSchedule({ ...tournament, matches: [] } as unknown as Tournament);
  const numberOfFields = typeof tournament.numberOfFields === 'number' ? tournament.numberOfFields : 1;
  const matches = schedule.allMatches.map((scheduled, index) => ({
    id: scheduled.id,
    round: Math.floor(index / numberOfFields) + 1,
    field: scheduled.field,
    slot: scheduled.slot,
    slotA: scheduled.slotA,
    slotB: scheduled.slotB,
    ...origin.matchOrigins(scheduled),
    group: scheduled.group,
    isFinal: scheduled.phase !== 'groupStage',
    phase: scheduled.phase,
    finalType: scheduled.finalType,
    label: scheduled.label,
    scheduledTime: scheduled.startTime,
    matchNumber: scheduled.matchNumber,
    referee: scheduled.referee,
    matchStatus: 'scheduled' as const,
  }));
  return { ...tournament, matches };
}
