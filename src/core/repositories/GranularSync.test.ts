
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineRepository } from './OfflineRepository';
import { SupabaseRepository } from './SupabaseRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { Tournament } from '../models/types';

// Mock dependencies
vi.mock('./SupabaseRepository');
vi.mock('./LocalStorageRepository');

describe('OfflineRepository - Granular Sync', () => {
    let offlineRepo: OfflineRepository;
    let mockSupabase: any;
    let mockLocal: any;

    const baseTournament = {
        id: 't1',
        title: 'Base Title',
        date: '2025-01-01',
        status: 'draft',
        version: 1,
        teams: [{ id: 'te1', name: 'A' }, { id: 'te2', name: 'B' }],
        matches: [
            { id: 'm1', teamA: 'te1', teamB: 'te2', round: 1, matchNumber: 1, field: 1 }
        ],
        groups: [],
        fields: [{ id: 'field-1', defaultName: 'Feld 1' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    } as unknown as Tournament;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        mockSupabase = new SupabaseRepository() as any;
        mockLocal = new LocalStorageRepository() as any;

        // Default mock implementations
        mockLocal.listForCurrentUser.mockResolvedValue([]);
        mockLocal.updateLocalVersion.mockResolvedValue(undefined); // Critical for Phase 2 fix verification

        mockSupabase.get.mockResolvedValue(null);
        mockSupabase.save.mockResolvedValue(undefined);
        mockSupabase.updateTournamentMetadata.mockResolvedValue(undefined);
        mockSupabase.updateMatches.mockResolvedValue(undefined);

        offlineRepo = new OfflineRepository(mockLocal, mockSupabase);
    });

    it('should perform granular metadata update when only title changes', async () => {
        const localT = { ...baseTournament, title: 'New Title', version: 2 };
        const remoteT = { ...baseTournament, title: 'Old Title', version: 1 };

        // Setup
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        // Execute
        await offlineRepo.syncUp();

        // Assert
        expect(mockSupabase.save).not.toHaveBeenCalled(); // Should NOT be full save
        expect(mockSupabase.updateTournamentMetadata).toHaveBeenCalledWith(
            't1',
            expect.objectContaining({ title: 'New Title', version: 1 }) // Base version passed!
        );
        expect(mockLocal.updateLocalVersion).toHaveBeenCalled(); // Phase 2 Fix Check
    });

    it('should perform granular match update when only score changes', async () => {
        const localMatch = { ...baseTournament.matches[0], scoreA: 1, scoreB: 0 };
        const localT = { ...baseTournament, matches: [localMatch], version: 2 };
        const remoteT = { ...baseTournament, version: 1 };

        // Setup
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        // Execute
        await offlineRepo.syncUp();

        // Assert
        expect(mockSupabase.save).not.toHaveBeenCalled();
        expect(mockSupabase.updateMatches).toHaveBeenCalledWith(
            't1',
            expect.arrayContaining([expect.objectContaining({ id: 'm1', scoreA: 1 })]),
            1 // Base version
        );
        expect(mockLocal.updateLocalVersion).toHaveBeenCalled(); // Phase 2 Fix Check
    });

    // A2 Fixrunde 3 (N2b, .superpowers/sdd/2026-09-25-oktober-fundament-helfer/
    // task-A2-rereview.md): `getMatchUpdates()` used to set `update.scoreA = lMatch.scoreA` even
    // when `lMatch.scoreA` was `undefined` (local device simply never loaded this match's live
    // state). Since A2 Fixrunde 1 changed the Supabase mapper from a value check to a KEY-PRESENCE
    // check, that assignment started writing `score_a = NULL` on every reconnect sync --
    // deleting a helper's live score in the cloud. The fix: only ever propagate a field the local
    // copy actually has an opinion on.
    it('A2 Fixrunde 3 (N2b): does NOT null out a live score the local copy simply does not know', async () => {
        // Local match carries NO score/status info at all; remote already has Tom's live score
        // (e.g. from a targeted UPDATE_MATCH the helper's own device sent earlier).
        const localMatch = { ...baseTournament.matches[0] };
        const remoteMatch = { ...baseTournament.matches[0], scoreA: 5, scoreB: 2, matchStatus: 'running' as const };
        const localT = { ...baseTournament, title: 'New Title', matches: [localMatch], version: 2 };
        const remoteT = { ...baseTournament, matches: [remoteMatch], version: 1 };

        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        await offlineRepo.syncUp();

        // The title change legitimately triggers a metadata sync ...
        expect(mockSupabase.updateTournamentMetadata).toHaveBeenCalled();
        // ... but Tom's live score/status must never be touched -- the local copy has no opinion
        // on them, so there is nothing legitimate to push.
        expect(mockSupabase.updateMatches).not.toHaveBeenCalled();
    });

    it('should perform full save when structural changes occur (teams added)', async () => {
        const newTeam = { id: 'te3', name: 'C', tournamentId: 't1' };
        const localT = { ...baseTournament, teams: [...baseTournament.teams, newTeam], version: 2 };
        const remoteT = { ...baseTournament, version: 1 };

        // Setup
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        // Execute
        await offlineRepo.syncUp();

        // Assert
        expect(mockSupabase.save).toHaveBeenCalled(); // MUST be full save
        expect(mockSupabase.updateTournamentMetadata).not.toHaveBeenCalled();
    });

    it('L3: erzwingt einen Voll-Save wenn sich nur die Monitor-Konfiguration ändert', async () => {
        const monitor = { id: 'mon-1', name: 'Haupthalle', slides: [] };
        const localT = { ...baseTournament, monitors: [monitor], version: 2 } as unknown as Tournament;
        const remoteT = { ...baseTournament, monitors: [], version: 1 } as unknown as Tournament;
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);
        await offlineRepo.syncUp();
        expect(mockSupabase.save).toHaveBeenCalled();
        expect(mockSupabase.updateTournamentMetadata).not.toHaveBeenCalled();
    });

    it('L3: erzwingt einen Voll-Save wenn sich nur die Sponsoren ändern', async () => {
        const sponsor = { id: 'spo-1', name: 'Autohaus Muster' };
        const localT = { ...baseTournament, sponsors: [sponsor], version: 2 } as unknown as Tournament;
        const remoteT = { ...baseTournament, version: 1 } as unknown as Tournament;
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);
        await offlineRepo.syncUp();
        expect(mockSupabase.save).toHaveBeenCalled();
    });

    it('L3: meldet KEINE Änderung, wenn sich nur die Schlüsselreihenfolge unterscheidet (jsonb-Round-Trip)', async () => {
        // Postgres jsonb re-serializes in internal order (key length, then lexicographic).
        // Local keeps whatever order the app built. stableKey() must normalize for comparison.
        const monitorLocal = { id: 'mon-1', name: 'Haupthalle', slides: [] };
        const monitorRemote = { slides: [], name: 'Haupthalle', id: 'mon-1' }; // Different key order, identical data
        const localT = { ...baseTournament, monitors: [monitorLocal], version: 2 } as unknown as Tournament;
        const remoteT = { ...baseTournament, monitors: [monitorRemote as any], version: 1 } as unknown as Tournament;
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);
        await offlineRepo.syncUp();
        // Without stableKey fix, this fails: JSON.stringify sees different strings due to key order
        // With the fix, same data in different key order is recognized as identical
        expect(mockSupabase.save).not.toHaveBeenCalled(); // No full save needed
        expect(mockSupabase.updateTournamentMetadata).not.toHaveBeenCalled(); // No changes at all
    });

    it('L3: meldet EINE Änderung, wenn sich die Slide-Reihenfolge unterscheidet (semantisch bedeutsam)', async () => {
        // Slide array order is the slideshow sequence and is meaningful
        const monitorLocal = { id: 'mon-1', name: 'Haupthalle', slides: [{ id: 's1' }, { id: 's2' }] };
        const monitorRemote = { id: 'mon-1', name: 'Haupthalle', slides: [{ id: 's2' }, { id: 's1' }] }; // Slides reordered
        const localT = { ...baseTournament, monitors: [monitorLocal], version: 2 } as unknown as Tournament;
        const remoteT = { ...baseTournament, monitors: [monitorRemote as any], version: 1 } as unknown as Tournament;
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);
        await offlineRepo.syncUp();
        // stableKey preserves array order (only sorts objects), so different slide order is detected
        expect(mockSupabase.save).toHaveBeenCalled(); // Full save due to slide array change
    });

    it('should update local version after successful sync', async () => {
        const localT = { ...baseTournament, title: 'Updated', version: 2 };
        const remoteT = { ...baseTournament, version: 1 }; // Remote is behind

        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        await offlineRepo.syncUp();

        // Expectation: After syncing (delta), we update local version to match what remote becomes (ver 2)
        // Note: Logic in code is: baseVer(1) -> update -> baseVer++ (2) -> updateLocal(2)
        expect(mockLocal.updateLocalVersion).toHaveBeenCalledWith('t1', 2);
    });

    it('should perform full save when team is renamed', async () => {
        // Same IDs, but name changed
        const renamedTeam = { ...baseTournament.teams[0], name: 'Renamed Team A' };
        const localT = { ...baseTournament, teams: [renamedTeam, baseTournament.teams[1]], version: 2 };
        const remoteT = { ...baseTournament, version: 1 };

        // Setup
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        // Execute
        await offlineRepo.syncUp();

        // Assert
        expect(mockSupabase.save).toHaveBeenCalled(); // Should trigger full save
        expect(mockSupabase.updateTournamentMetadata).not.toHaveBeenCalled();
    });

    // =========================================================================
    // M1-Fixwelle Fix 2: refreshFromCloudInBackground() muss lokal auch dann
    // korrigieren, wenn die Version gleich bleibt, aber isPublic abweicht.
    // Vor M1 hat der Mapper isPublic nie gelesen -> lokale Kopien tragen `undefined`.
    // Bei gleichem Versionsstand griff der Refresh bisher NIE, und der nächste
    // Voll-Save schrieb `is_public: false` erneut auf alle Team-/Spielzeilen.
    // =========================================================================
    it('Fix 2: refreshFromCloudInBackground schreibt lokal bei gleicher Version, wenn isPublic abweicht (vor M1 gecachte Kopie)', async () => {
        // isPublic bewusst weggelassen -> undefined, wie bei einer vor M1 gecachten Kopie.
        const localT = { ...baseTournament, version: 1 };
        const cloudT = { ...baseTournament, isPublic: false, version: 1 }; // echter Boolean seit K2, GLEICHE Version

        mockLocal.get.mockResolvedValue(localT);
        mockSupabase.get.mockResolvedValue(cloudT);

        // Privater Methodenzugriff, da refreshFromCloudInBackground() in get() nur
        // fire-and-forget (`void ...`) aufgerufen wird und hier isoliert geprüft werden soll.
        await (offlineRepo as unknown as { refreshFromCloudInBackground(id: string): Promise<void> })
            .refreshFromCloudInBackground('t1');

        expect(mockLocal.save).toHaveBeenCalledWith(cloudT);
    });

    it('Fix 2 (Kontrolle): refreshFromCloudInBackground schreibt NICHT, wenn Version UND isPublic gleich sind', async () => {
        const localT = { ...baseTournament, isPublic: false, version: 1 };
        const cloudT = { ...baseTournament, isPublic: false, version: 1 };

        mockLocal.get.mockResolvedValue(localT);
        mockSupabase.get.mockResolvedValue(cloudT);

        await (offlineRepo as unknown as { refreshFromCloudInBackground(id: string): Promise<void> })
            .refreshFromCloudInBackground('t1');

        expect(mockLocal.save).not.toHaveBeenCalled();
    });

    // =========================================================================
    // M1-Fixwelle Fix 3: getMetadataChanges() (über syncTournamentDelta/syncUp) muss
    // `isPublic: undefined` (vor M1 gecachte lokale Kopie) und `isPublic: false`
    // (echter Boolean von der Cloud seit K2) als GLEICH behandeln. Ein roher
    // Vergleich meldet sonst eine Phantom-Änderung, deren leerer Payload die
    // Cloud-Version nicht bewegt, während die lokale Version trotzdem hochgezählt
    // wird — das Gerät verliert danach dauerhaft alle Cloud-Updates.
    // =========================================================================
    it('Fix 3: isPublic undefined (lokal) vs. false (Cloud) meldet KEINE Metadaten-Änderung', async () => {
        const localT = { ...baseTournament, version: 2 }; // isPublic undefined
        const remoteT = { ...baseTournament, isPublic: false, version: 1 };

        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        await offlineRepo.syncUp();

        expect(mockSupabase.updateTournamentMetadata).not.toHaveBeenCalled();
    });

    // =========================================================================
    // Re-Review der Fix-Welle, N2: Die Normalisierung aus Fix 3 durfte nicht in die
    // andere Richtung kippen. Lokal `undefined` heißt "diese Kopie weiß es nicht"
    // (vor M1 gecacht), nicht "false". Als `false` hochgeschrieben nähme eine
    // veraltete lokale Kopie ein öffentliches Turnier wieder vom Netz — exakt der
    // K1-Schaden, dessen Beseitigung dieser Meilenstein ist.
    // =========================================================================
    // Re-Review PR1: Folge des neuen Triggers enforce_release_before_public. Ein lokaler
    // Stand mit isPublic=true aber ohne publishedAt (alter createDraft-Default) wuerde vom
    // Trigger mit HF001 abgewiesen — und weil der Metadaten-Payload ganz-oder-gar-nicht ist,
    // blieben Titel, Datum und Ort desselben Turniers dann ebenfalls ungesynct.
    it('schiebt isPublic=true NICHT hoch, wenn der lokale Stand keinen Freigabe-Beleg hat', async () => {
        const localT = { ...baseTournament, isPublic: true, title: 'Neuer Titel', version: 2 }; // kein publishedAt
        const remoteT = { ...baseTournament, isPublic: false, title: 'Alter Titel', version: 1 };

        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        await offlineRepo.syncUp();

        const calls = mockSupabase.updateTournamentMetadata.mock.calls as unknown[][];
        const payload = calls[0]?.[1] as { isPublic?: boolean; title?: string } | undefined;
        expect(payload).toBeDefined();
        expect('isPublic' in (payload ?? {})).toBe(false);
        // Der Titel muss trotzdem durchkommen — genau das wuerde die Ablehnung sonst mitreissen.
        expect(payload?.title).toBe('Neuer Titel');
    });

    it('schiebt isPublic=true weiterhin hoch, wenn ein Freigabe-Beleg vorliegt', async () => {
        const localT = { ...baseTournament, isPublic: true, publishedAt: '2026-01-01T00:00:00.000Z', version: 2 };
        const remoteT = { ...baseTournament, isPublic: false, publishedAt: '2026-01-01T00:00:00.000Z', version: 1 };

        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        await offlineRepo.syncUp();

        const calls = mockSupabase.updateTournamentMetadata.mock.calls as unknown[][];
        const payload = calls[0]?.[1] as { isPublic?: boolean } | undefined;
        expect(payload?.isPublic).toBe(true);
    });

    it('N2: isPublic undefined (lokal) vs. true (Cloud) nimmt das Turnier NICHT vom Netz', async () => {
        const localT = { ...baseTournament, version: 2 }; // isPublic undefined, lokale Version voraus
        const remoteT = { ...baseTournament, isPublic: true, version: 1 };

        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        await offlineRepo.syncUp();

        const calls = mockSupabase.updateTournamentMetadata.mock.calls as unknown[][];
        const pushedVisibility = calls.some((call) => {
            const payload = call[1] as { isPublic?: boolean } | undefined;
            return payload !== undefined && 'isPublic' in payload;
        });
        expect(pushedVisibility).toBe(false);
    });

    // =========================================================================
    // Re-Review der Fix-Welle, N3: `visibilityStale` aus Fix 2 hebelte die
    // Versionsprüfung für den GANZEN Datensatz aus. Eine offline vorgenommene
    // Veröffentlichung (lokale Version voraus, MutationQueue noch nicht abgespielt)
    // hätte sich damit selbst mit dem älteren Cloud-Stand überschrieben.
    // =========================================================================
    it('N3: refreshFromCloudInBackground überschreibt eine NEUERE lokale Kopie nicht, nur weil isPublic abweicht', async () => {
        const localT = { ...baseTournament, isPublic: true, shareCode: 'ABC123', version: 5 };
        const cloudT = { ...baseTournament, isPublic: false, version: 4 }; // ÄLTER

        mockLocal.get.mockResolvedValue(localT);
        mockSupabase.get.mockResolvedValue(cloudT);

        await (offlineRepo as unknown as { refreshFromCloudInBackground(id: string): Promise<void> })
            .refreshFromCloudInBackground('t1');

        expect(mockLocal.save).not.toHaveBeenCalled();
    });

    // =========================================================================
    // Fix 3 (Review 2026-09-18): publishedAt liegt nur im config-JSONB und hat keine eigene
    // Spalte — anders als title/date/status/startTime/location transportiert
    // updateTournamentMetadata() es NICHT. Ohne einen erzwungenen Voll-Save käme eine Zeile
    // mit geänderter Sichtbarkeit aber ohne aktualisiertes config.publishedAt in der Cloud an,
    // und die Drift, die dieser Meilenstein beseitigt hat (status widerspricht
    // config.publishedAt), käme über den Metadaten-Sync zurück.
    // =========================================================================
    it('Fix 3: erzwingt einen Voll-Save wenn sich publishedAt unterscheidet (lokal gesetzt, remote fehlt)', async () => {
        const localT = { ...baseTournament, publishedAt: '2026-02-01T10:00:00.000Z', version: 2 } as unknown as Tournament;
        const remoteT = { ...baseTournament, version: 1 } as unknown as Tournament; // kein publishedAt
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        await offlineRepo.syncUp();

        expect(mockSupabase.save).toHaveBeenCalled();
        expect(mockSupabase.updateTournamentMetadata).not.toHaveBeenCalled();
    });

    it('Fix 3 (Kontrolle): KEIN Voll-Save allein wegen publishedAt, wenn beide Seiten denselben Wert tragen', async () => {
        const same = '2026-02-01T10:00:00.000Z';
        const localT = { ...baseTournament, publishedAt: same, version: 2 } as unknown as Tournament;
        const remoteT = { ...baseTournament, publishedAt: same, version: 1 } as unknown as Tournament;
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        await offlineRepo.syncUp();

        expect(mockSupabase.save).not.toHaveBeenCalled();
    });

    // =========================================================================
    // Fix 2 (Review 2026-09-21) — der load-bearende Test: lokal FEHLT publishedAt, die Cloud
    // hat es (Read-Time-Backfill, siehe supabaseMappers.ts). Ein Voll-Save schreibt local ->
    // cloud und kann ein fehlendes publishedAt also niemals beschaffen — die rohe
    // Ungleichheit (`local.publishedAt !== remote.publishedAt`) würde hier einen Voll-Save bei
    // JEDEM Sync erzwingen, für immer, und jeder davon stempelt `is_public:
    // local.isPublic ?? false` auf alle Team-/Spielzeilen. Ohne die Fix-2-Bedingung
    // (`local.publishedAt !== undefined`) schlägt genau dieser Test fehl.
    // =========================================================================
    it('Fix 2: KEIN Voll-Save wenn lokal publishedAt fehlt, aber remote es hat (Voll-Save kann es nicht beschaffen)', async () => {
        const localT = { ...baseTournament, version: 2 } as unknown as Tournament; // kein publishedAt
        const remoteT = {
            ...baseTournament,
            publishedAt: '2026-02-01T10:00:00.000Z',
            version: 1,
        } as unknown as Tournament;
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        await offlineRepo.syncUp();

        expect(mockSupabase.save).not.toHaveBeenCalled();
    });
});
