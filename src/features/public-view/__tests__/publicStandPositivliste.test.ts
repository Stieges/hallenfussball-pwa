/**
 * Gespeicherter Stand = Positivliste (B-15 Review A2, @ZM-110): nur, was die Zuschauer-Seite anzeigt. Ein Ansprechpartner mit
 * E-Mail, Sponsoren-Logos (Base64), Absage-Grund, Statistik, Trainer und Korrekturnamen landen nicht im Speicher.
 */
import { describe, it, expect } from 'vitest';
import { buildLiveViewTournament } from '../../../screens/__tests__/liveViewFixture';
import type { Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';
import { saveStand, loadStand, type StandStorage } from '../publicStandStore';

function memory(): StandStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() { return data.size; },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

const withSecrets = (): Tournament => {
  const t = buildLiveViewTournament();
  return {
    ...t,
    contactInfo: { name: 'Erika Beispiel', email: 'erika@example.org', phone: '0170 1234567' },
    sponsors: [{ id: 's1', name: 'Autohaus', logoBase64: 'data:image/png;base64,AAAAGEHEIMLOGO' }],
    cancelledReason: 'Hallenschaden',
    statsSnapshot: { teamCount: 8, totalMatches: 15 },
    adminNotes: 'Schlüssel unter der Matte',
    monitors: [{ id: 'm1', accessCode: 'GEHEIM' }],
    externalSource: 'CSV Import',
    teams: t.teams.map((team, i) => (i === 0 ? { ...team, trainers: [{ id: 'tr', name: 'Trainer Tom', email: 'tom@example.org' }] } : team)),
    matches: t.matches.map((m, i) => (i === 0 ? { ...m, skippedReason: 'Team zurückgezogen (Freitext)', correctionHistory: [{ timestamp: 'x', previousScoreA: 0, previousScoreB: 0, newScoreA: 1, newScoreB: 0, userName: 'Olli Orga' }] } : m)),
  } as unknown as Tournament;
};

describe('Stand-Speicher: Positivliste', () => {
  it('@ZM-110 Gegenbeispiel: Kontakt-E-Mail, Sponsoren-Base64, Absage-Grund, Statistik, Notizen, Monitor, Trainer und Korrekturnamen landen nicht im Speicher', () => {
    const storage = memory();
    saveStand(storage, 'ABC123', { source: 'legacy', version: '1', day: '2026-10-10', tournament: withSecrets() });
    const stored = storage.getItem('publicStand:v1:ABC123') ?? '';
    for (const secret of ['erika@example.org', '0170 1234567', 'GEHEIMLOGO', 'Hallenschaden', 'Schlüssel unter der Matte', 'GEHEIM"', 'CSV Import', 'tom@example.org', 'Olli Orga', 'Team zurückgezogen', 'statsSnapshot', 'contactInfo']) {
      expect(stored).not.toContain(secret);
    }
  });

  it('@ZM-035 die Positivliste reicht: aus dem geladenen Stand entsteht derselbe Spielplan wie aus dem Original', () => {
    const storage = memory();
    const original = withSecrets();
    saveStand(storage, 'ABC123', { source: 'legacy', version: '1', day: '2026-10-10', tournament: original });
    const loaded = loadStand(storage, 'ABC123', '2026-10-10', 'legacy');
    expect(loaded).not.toBeNull();
    const restored = loaded!.stand.tournament;
    expect(restored.title).toBe(original.title);
    expect(restored.teams.map((t) => t.name)).toEqual(original.teams.map((t) => t.name));
    expect(generateFullSchedule(restored).allMatches.map((m) => m.id)).toEqual(generateFullSchedule(original).allMatches.map((m) => m.id));
    expect(restored.matches.map((m) => [m.id, m.scoreA, m.matchStatus])).toEqual(original.matches.map((m) => [m.id, m.scoreA, m.matchStatus]));
  });
});
