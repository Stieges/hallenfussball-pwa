/**
 * A-10 Teil C (brief-A-10.md § 3 Teil C, Gegenbeispiel 11): `decideCloudAdoption` übernimmt die ganze Cloud-Kopie auch,
 * wenn nur die Änderungszählung des Servers (`tournaments.change_revision` → `Tournament.changeRevision`) höher ist –
 * Spielplan-Änderungen ohne Versions-CAS (K.-o.-Auflösung per `updateMatches`, Befund C-SLOT-UPDATE-OHNE-VERSION).
 * Regel Q gilt unverändert; gleiche Zählung → Feldweg (kein Dauer-Übernehmen); Spalte fehlt → Verhalten wie heute.
 *
 * Anforderungen: @TM-027 (`2026-10-01_turniermodi.md`), @FU-089 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
 */
import { describe, it, expect } from 'vitest';
import { decideCloudAdoption } from '../cloudAdoption';
import { teamSlot } from '../../models/matchSlot';
import { FC_NORD, heimseite, liveCup, revisions } from '../../../test/queueGuardFixtures';
import type { Tournament } from '../../models/types';

const owned = (t: Tournament): Tournament => ({ ...t, ownerId: 'olli' });
const withRevision = (t: Tournament, changeRevision: number | undefined): Tournament =>
  changeRevision === undefined ? t : { ...t, changeRevision };

function decide(local: Tournament, cloud: Tournament, wholeAllowed = true) {
  return decideCloudAdoption(local, { tournament: cloud, matchRevisions: revisions() }, revisions(), {
    mayCache: true, whole: false, owned, wholeAllowed: () => wholeAllowed,
  });
}

describe('A-10 decideCloudAdoption mit Änderungszählung (@TM-027)', () => {
  it('@TM-027 Version gleich, Cloud-Zählung höher → ganze Kopie: Halbfinale 1 zeigt FC Nord auf der Heimseite', () => {
    const local = withRevision(liveCup(7), 2);
    const cloud = withRevision(liveCup(7, { hfHeim: FC_NORD }), 3);

    const adoption = decide(local, cloud);

    expect(adoption.save).toBeDefined();
    expect(heimseite(adoption.save!)).toBe(FC_NORD);
    expect(adoption.save!.changeRevision).toBe(3);
  });

  it('Cloud-Zählung höher, aber Regel Q blockiert (eigenes wartet) → Feldweg, nichts Eigenes überschrieben', () => {
    const local = withRevision(liveCup(7), 2);
    const cloud = withRevision(liveCup(7, { hfHeim: FC_NORD }), 3);

    const adoption = decide(local, cloud, false);

    expect(adoption.save).toBeUndefined();
  });

  it('Gegenbeispiel: Zählung gleich → Feldweg (kein Dauer-Übernehmen)', () => {
    const adoption = decide(withRevision(liveCup(7), 3), withRevision(liveCup(7, { hfHeim: FC_NORD }), 3));

    expect(adoption.save).toBeUndefined();
  });

  it('Gegenbeispiel: Spalte fehlt in der Cloud (DB vor F2b, undefined) → Verhalten wie heute (Feldweg)', () => {
    const adoption = decide(liveCup(7), liveCup(7, { hfHeim: FC_NORD }));

    expect(adoption.save).toBeUndefined();
  });

  it('Gegenbeispiel: lokale Zählung höher als die Cloud (veraltete Antwort) → kein Rückschritt', () => {
    const adoption = decide(withRevision(liveCup(7), 5), withRevision(liveCup(7, { hfHeim: FC_NORD }), 4));

    expect(adoption.save).toBeUndefined();
  });

  it('Versionsweg bleibt: Cloud-Version höher, Zählung gleich → ganze Kopie wie heute', () => {
    const local = { ...liveCup(7), matches: liveCup(7).matches.map((m) => (m.id === 'hf-1' ? { ...m, slotA: teamSlot(FC_NORD) } : m)) };
    const adoption = decide(withRevision(local, 1), withRevision(liveCup(8, { title: 'Hallen-Cup' }), 1));

    expect(adoption.save?.title).toBe('Hallen-Cup');
  });
});
