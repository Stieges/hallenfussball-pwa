/**
 * F9 (GB1 Paket 2) — aria-label der Schließen-Knöpfe in CardDialog und
 * GoalScorerDialog kommt über i18n (t('…close')), nie hartkodiert. Die
 * Schlüssel cardDialog.close und goalScorer.close liegen in DE und EN vor.
 *
 * Mutationsprobe: Hartkodiertes aria-label macht den Test rot.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('CardDialog/GoalScorerDialog — Schließen-aria-label über i18n (F9)', () => {
  it.each([
    ['CardDialog', ['cardDialog', 'close']],
    ['GoalScorerDialog', ['goalScorer', 'close']],
  ])('%s nutzt t(…close) statt eines hartkodierten aria-label', (_name, keyPath) => {
    const source = readFileSync(
      join(SRC_ROOT, 'components', 'live-cockpit', 'components', 'Dialogs', `${_name}.tsx`),
      'utf8'
    );
    expect(source).toContain(`t('${keyPath.join('.')}')`);
    expect(source).not.toMatch(/aria-label="Schließen"|aria-label="Close"/);
  });

  it.each(['de', 'en'])('cockpit.json (%s) enthält cardDialog.close und goalScorer.close', (lang) => {
    const locale = JSON.parse(
      readFileSync(join(SRC_ROOT, 'i18n', 'locales', lang, 'cockpit.json'), 'utf8')
    ) as { cardDialog: Record<string, string>; goalScorer: Record<string, string> };
    expect(locale.cardDialog.close).toBeTruthy();
    expect(locale.goalScorer.close).toBeTruthy();
  });

  it('DE und EN tragen denselben Schlüsselumfang', () => {
    const read = (lang: string) =>
      JSON.parse(
        readFileSync(join(SRC_ROOT, 'i18n', 'locales', lang, 'cockpit.json'), 'utf8')
      ) as { cardDialog: Record<string, string>; goalScorer: Record<string, string> };
    const de = read('de');
    const en = read('en');
    expect(Object.keys(de.cardDialog).sort()).toEqual(Object.keys(en.cardDialog).sort());
    expect(Object.keys(de.goalScorer).sort()).toEqual(Object.keys(en.goalScorer).sort());
  });
});
