/**
 * Start-Weiche nur, wenn die Startseite die ERSTE Adresse des Seitenaufrufs ist (@HE-096); jede andere erste Adresse
 * (Feld per QR/Link, Beitritt, Auswahl, Spielplan) gilt als Entscheidung, damit spätere Wege zur Startseite bleiben (@HE-110).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { isHelperStartHandled, noteHelperStartEntry, resetHelperStart } from '../helperStartDeps';

beforeEach(() => { resetHelperStart(); });

describe('noteHelperStartEntry', () => {
  it.each(['', '#', '#/', '#/?utm=1'])('Startseite als erste Adresse (%j) → Weiche darf entscheiden (@HE-096)', (hash) => {
    noteHelperStartEntry(hash);
    expect(isHelperStartHandled()).toBe(false);
  });

  it.each([
    '#/tournament/t-cup/live?f=2',
    '#/tournament/t-cup/schedule',
    '#/join/CUPCODE123',
    '#/helfer',
    '#/archive',
  ])('andere erste Adresse (%j) → Entscheidung gilt als getroffen (@HE-110)', (hash) => {
    noteHelperStartEntry(hash);
    expect(isHelperStartHandled()).toBe(true);
  });
});
