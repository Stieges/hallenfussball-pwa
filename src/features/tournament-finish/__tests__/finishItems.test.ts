/**
 * R3-4 Liste „noch offen“ im Dialog „Turnier abschließen“ (Zustand A). Erwartungen aus dem Gherkin
 * docs/anforderungen/2026-10-01_turnier-lebenszyklus.md, nicht am Code abgelesen; echte deutsche Texte.
 *
 * Szenarien: @LZ-010 (je offener Punkt ein Eintrag zur Sache; ein Tipp führt zur Stelle), @LZ-012 (mehrere Punkte gemeinsam,
 * auch die Klärungen), @LZ-013 (Gruppe noch nicht abgeschlossen, führt zum Abschluss der Gruppe), @LZ-029 (Folgen-Hinweis).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import i18n from 'i18next';
import { initRealDeI18n } from '../../../test/realDeI18n';
import type { Tournament } from '../../../types/tournament';
import type { FinishItem } from '../../../core/repositories/lifecycleRpc';
import { NK } from '../../../core/standings/__tests__/groupCompletionKit';
import { nikolausFertig } from '../../../core/services/__tests__/finishKit';
import { describeFinishItem, finishItemTarget, type FinishT } from '../model/finishItems';

const t: FinishT = (key, options) => String(i18n.t(key, options as never));
let turnier: Tournament;

beforeAll(async () => {
  await initRealDeI18n();
  turnier = await nikolausFertig();
});

const view = (item: FinishItem, index = 0) => describeFinishItem(item, turnier, t, index);

describe('@LZ-010 Abschluss wird verweigert, solange etwas offen ist – Eintrag zur Sache, Tipp führt zur Stelle', () => {
  it('das Spiel um Platz 3 läuft auf Feld 2 → „Spiel um Platz 3 läuft noch“, Feld 2, Sprung zum Spiel', () => {
    const match = turnier.matches[0];
    const v = view({ kind: 'match_running', matchId: match.id, matchNumber: 15, field: 2, finalType: 'thirdPlace' });
    expect(v.title).toBe('Spiel um Platz 3 läuft noch');
    expect(v.detail).toContain('Feld 2');
    expect(v.target).toBe(`/tournament/${turnier.id}/live?matchId=${match.id}`);
  });

  it('das Spiel um Platz 3 ist noch nicht angepfiffen → „nicht entschieden“, Sprung zum Spiel', () => {
    const match = turnier.matches[1];
    const v = view({ kind: 'match_undecided', matchId: match.id, matchNumber: 15, field: 1, finalType: 'thirdPlace' });
    expect(v.title).toBe('Spiel um Platz 3 ist noch offen');
    expect(v.target).toContain(`matchId=${match.id}`);
  });

  it('das Finale steht 1:1 nach Verlängerung, das Strafstoßschießen fehlt → „Finale ist noch offen“, Sprung zum Finale', () => {
    const match = turnier.matches[2];
    const v = view({ kind: 'match_undecided', matchId: match.id, matchNumber: 16, finalType: 'final' });
    expect(v.title).toBe('Finale ist noch offen');
    expect(v.target).toContain('/live?matchId=');
  });

  it('ein Spiel ohne Endspiel-Art heißt „Spiel 14“ und nennt die Paarung mit Feld', () => {
    const match = turnier.matches[13];
    const v = view({ kind: 'match_undecided', matchId: match.id, matchNumber: 14, field: 1 });
    expect(v.title).toBe('Spiel 14 ist noch offen');
    expect(v.detail).toMatch(/ – /);
    expect(v.detail).toContain('Feld 1');
  });

  it('ein Eintrag der Klärungsliste führt zur Klärungsliste (Spielplan mit geöffneter Liste)', () => {
    const v = view({ kind: 'review_open', eventId: 'e1', matchId: 'm9', matchNumber: 9, field: 2 });
    expect(v.title).toBe('Klärungsliste: Eintrag zu Spiel 9');
    expect(v.target).toBe(`/tournament/${turnier.id}/schedule?klaerung=1`);
  });

  it('ein offener Folgen-Hinweis führt zum Folgen-Hinweis (Tabelle der Gruppe, dort steht der Hinweis)', () => {
    const v = view({ kind: 'notice_open', noticeId: 4, matchId: turnier.matches[0].id, side: 'A' });
    expect(v.title).toBe('Folgen-Hinweis ist offen');
    expect(v.target).toBe(`/tournament/${turnier.id}/standings`);
  });

  it('Nikolaus: Gleichstand Petting/Otting auf Platz 3 und 4 → „Entscheidung nötig“ mit beiden Namen, führt zur Tabelle der Gruppe', () => {
    const v = view({ kind: 'tie_open', groupId: '', places: [3, 4], teamIds: [NK.petting, NK.otting] });
    expect(v.title).toBe('Gleichstand auf Platz 3/4: Entscheidung nötig');
    expect(v.detail).toBe('TSV Petting und DJK Otting sind gleichauf. Die Gruppe ist noch nicht abgeschlossen.');
    expect(v.target).toBe(`/tournament/${turnier.id}/standings`);
  });

  it('Gegenbeispiel: ein unbekannter Punkt des Servers verschwindet nicht – er steht als „Noch etwas ist offen“ in der Liste', () => {
    const v = view({ kind: 'unknown', serverKind: 'zukunft' });
    expect(v.title).toBe('Noch etwas ist offen');
    expect(v.detail).toContain('App neu');
  });
});

describe('@LZ-013 Eine nicht abgeschlossene Gruppe steht in der Liste und führt zum Abschluss der Gruppe', () => {
  it('Jeder gegen jeden (eine Gruppe): „Gruppe noch nicht abgeschlossen“ ohne Gruppennamen, Sprung zur Tabelle', () => {
    const v = view({ kind: 'group_open', groupId: '' });
    expect(v.title).toBe('Gruppe noch nicht abgeschlossen');
    expect(v.target).toBe(`/tournament/${turnier.id}/standings`);
  });

  it('mehrere Gruppen: der Name der Gruppe steht dabei', () => {
    expect(view({ kind: 'group_open', groupId: 'B' }).title).toBe('Gruppe B ist noch nicht abgeschlossen');
  });

  it('eine Gruppe, die nach einer Korrektur neu abgeschlossen werden muss, steht ebenfalls in der Liste', () => {
    expect(view({ kind: 'group_stale', groupId: 'B' }).title).toBe('Gruppe B muss neu abgeschlossen werden');
  });
});

describe('@LZ-012 Mehrere offene Punkte stehen gemeinsam in der Liste', () => {
  it('das Spiel um Platz 3 läuft und 2 Einträge der Klärungsliste sind offen → 3 Einträge, jeder mit eigenem Schlüssel', () => {
    const items: FinishItem[] = [
      { kind: 'match_running', matchId: turnier.matches[0].id, matchNumber: 15, field: 2, finalType: 'thirdPlace' },
      { kind: 'review_open', eventId: 'k1', matchId: 'm1', matchNumber: 3, field: 1 },
      { kind: 'review_open', eventId: 'k2', matchId: 'm2', matchNumber: 4, field: 2 },
    ];
    const views = items.map((item, index) => view(item, index));
    expect(views).toHaveLength(3);
    expect(new Set(views.map((v) => v.id)).size).toBe(3);
    expect(views[0].title).toBe('Spiel um Platz 3 läuft noch');
    expect(views.slice(1).every((v) => v.target.endsWith('/schedule?klaerung=1'))).toBe(true);
  });
});

describe('Sprungziele sind App-intern und führen nie ins Leere', () => {
  it.each([
    ['match_running', { kind: 'match_running', matchId: 'a b', matchNumber: 1 }, '/live?matchId=a%20b'],
    ['group_stale', { kind: 'group_stale', groupId: 'A' }, '/standings'],
    ['clarification_open', { kind: 'clarification_open', clarificationId: 3 }, '/standings'],
  ] as const)('%s', (_name, item, suffix) => {
    expect(finishItemTarget(item as FinishItem, 'x1')).toBe(`/tournament/x1${suffix}`);
  });
});
