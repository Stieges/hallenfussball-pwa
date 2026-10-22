/**
 * Reine Hilfen der Seite „Team & Helfer“ (A-18a): Zahlknöpfe (S-1), Namenshinweise (S-2), Zeiten und Zeilentexte.
 * Szenarien: @HE-021 @HE-052 @HE-105 @HE-106.
 */
import { describe, it, expect } from 'vitest';
import {
  CHECK_NUMBER_CHOICES, CHECK_NUMBER_MAX, CHECK_NUMBER_MIN, checkNumberChoices, duplicateNames, formatClock, formatValidDay,
  helperRowModel, requestMarks, sortedHelperRows, type HelperMemberRow, type JoinRequestRow,
} from '../helperAdminModel';

const request = (over: Partial<JoinRequestRow> = {}): JoinRequestRow => ({
  id: 'r1', name: 'Tom', deviceLabel: 'phone', checkNumber: 47, createdAt: '2026-11-28T13:02:00Z',
  sameName: 1, sameNamePending: 1, sameNameMember: null, sameNameDeclinedAt: null, ...over,
});
const member = (over: Partial<HelperMemberRow> = {}): HelperMemberRow => ({
  memberId: 'm1', name: 'Tom', deviceLabel: 'phone', field: 2, mode: 'helper', revokedAt: null, acceptedAt: 'x', lastSeenAt: null, controls: [], ...over,
});

describe('checkNumberChoices (S-1, @HE-105)', () => {
  it('liefert genau vier verschiedene Zahlen von 10 bis 99, darunter die richtige, aufsteigend sortiert', () => {
    for (let n = CHECK_NUMBER_MIN; n <= CHECK_NUMBER_MAX; n += 1) {
      const choices = checkNumberChoices(`req-${n}`, n);
      expect(choices).toHaveLength(CHECK_NUMBER_CHOICES);
      expect(new Set(choices).size).toBe(CHECK_NUMBER_CHOICES);
      expect(choices).toContain(n);
      expect(choices).toEqual([...choices].sort((a, b) => a - b));
      choices.forEach((c) => {
        expect(c).toBeGreaterThanOrEqual(CHECK_NUMBER_MIN);
        expect(c).toBeLessThanOrEqual(CHECK_NUMBER_MAX);
      });
    }
  });

  it('ist stabil: dieselbe Anfrage zeigt nach jedem 2-s-Abruf dieselben Knöpfe', () => {
    expect(checkNumberChoices('abc', 47)).toEqual(checkNumberChoices('abc', 47));
  });

  it('Gegenbeispiel: die richtige Zahl steht nicht immer an derselben Stelle (die Stelle verrät nichts)', () => {
    const positions = new Set<number>();
    for (let i = 0; i < 60; i += 1) {
      positions.add(checkNumberChoices(`id-${i}`, 10 + i).indexOf(10 + i));
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it('die Randzahlen 10 und 99 gehen auf', () => {
    expect(checkNumberChoices('x', 10)).toContain(10);
    expect(checkNumberChoices('x', 99)).toContain(99);
  });
});

describe('duplicateNames (@HE-021)', () => {
  it('meldet einen Namen mit mehreren offenen Anfragen einmal, unabhängig von Groß-/Kleinschreibung und Leerzeichen', () => {
    const rows = [request({ id: 'a', name: 'Tom', sameNamePending: 2 }), request({ id: 'b', name: ' tom ', sameNamePending: 2 }), request({ id: 'c', name: 'Lena' })];
    expect(duplicateNames(rows)).toEqual([{ name: 'Tom', count: 2 }]);
  });
  it('Gegenbeispiel: eine einzige Anfrage ist kein Duplikat', () => {
    expect(duplicateNames([request()])).toEqual([]);
  });
});

describe('requestMarks (S-2, @HE-106)', () => {
  it('schon zugelassen und schon abgelehnt ergeben je eine Marke', () => {
    const marks = requestMarks(request({ sameNameMember: { deviceLabel: 'phone', acceptedAt: 'x' }, sameNameDeclinedAt: '2026-11-28T11:03:00Z' }));
    expect(marks.map((m) => m.kind)).toEqual(['member', 'declined']);
  });
  it('Gegenbeispiel: ohne Vorgeschichte keine Marke', () => {
    expect(requestMarks(request())).toEqual([]);
  });
});

describe('Zeiten in Ortszeit des Turniers', () => {
  it('formatClock zeigt 14:02 für 13:02 UTC im Winter (MEZ), auch wenn das Gerät in einer anderen Zeitzone steht', () => {
    expect(formatClock('2026-11-28T13:02:00Z', 'de-DE')).toBe('14:02');
  });
  it('formatClock gibt bei unlesbarer Zeit nichts aus', () => {
    expect(formatClock('kaputt', 'de-DE')).toBe('');
  });
  it('formatValidDay: der Server liefert 00:00 des Folgetages, angezeigt wird der letzte Turniertag (Sa 28.11.)', () => {
    expect(formatValidDay('2026-11-28T23:00:00Z', 'de-DE')).toMatch(/Sa.*28\.11\./);
  });
});

describe('Helfer-Zeilen (@HE-052)', () => {
  it('steuern vor zuletzt gesehen vor noch nicht gesehen', () => {
    expect(helperRowModel(member({ controls: [2], lastSeenAt: 'x' })).status).toEqual({ kind: 'controls' });
    expect(helperRowModel(member({ lastSeenAt: '2026-11-28T11:03:00Z' })).status).toEqual({ kind: 'seen', at: '2026-11-28T11:03:00Z' });
    expect(helperRowModel(member()).status).toEqual({ kind: 'unseen' });
  });
  it('„viewer“ ist nur zusehen, ein gesetztes revokedAt ist entzogen', () => {
    expect(helperRowModel(member({ mode: 'viewer' })).viewerOnly).toBe(true);
    expect(helperRowModel(member({ revokedAt: 'x' })).revoked).toBe(true);
    expect(helperRowModel(member()).revoked).toBe(false);
  });
  it('entzogene Zeilen kommen nach den aktiven, die Reihenfolge der Zulassung bleibt', () => {
    const rows = sortedHelperRows([member({ memberId: 'a', revokedAt: 'x' }), member({ memberId: 'b' }), member({ memberId: 'c' })]);
    expect(rows.map((r) => r.memberId)).toEqual(['b', 'c', 'a']);
  });
});
