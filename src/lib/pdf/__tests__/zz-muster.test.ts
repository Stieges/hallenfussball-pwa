import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildNoticePdf } from '../notice';
import { buildSchedulePdf } from '../schedulePdf';
import { toPdfInput } from '../pdfInput';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { fixtureLogo } from './pdfLogoFixture';
import { translatorFor } from './pdfText';
import { SIXTY, sharedTournament } from './pdfNoticeSupport';

const OUT = '/Users/daniel.stiegler/Downloads/hallenfussball-pwa/.superpowers/sdd/2026-10-03-mvp-bauplan/scr-B28/c8/';
const NOW = new Date(2026, 10, 14, 15, 7);
const sums: string[] = [];
function put(name: string, doc: { output: (t: 'arraybuffer') => ArrayBuffer }): void {
  const bytes = Buffer.from(doc.output('arraybuffer'));
  writeFileSync(OUT + name, bytes);
  sums.push(createHash('sha1').update(bytes).digest('hex').slice(0, 12) + '  ' + name);
}
it('muster', async () => {
  const base = 'https://hallenfussball.example';
  for (const [name, overrides, options] of [
    ['aushang-de-A4-hoch.pdf', {}, { logoLeft: fixtureLogo(2), logoRight: fixtureLogo(1) }],
    ['aushang-en-ungünstigster-A4-hoch.pdf', { title: SIXTY }, { locale: 'en' as const, logoLeft: fixtureLogo(2), logoRight: fixtureLogo(1) }],
    ['aushang-lange-adresse-A4-hoch.pdf', { title: SIXTY }, { viewerBaseUrl: 'https://hallenfussball-turnierverwaltung-nordheim.example.org' }],
    ['aushang-kinder-A4-hoch.pdf', { isKidsTournament: true }, {}],
  ] as const) {
    const tournament = sharedTournament(overrides);
    const locale = (options as { locale?: 'de' | 'en' }).locale ?? 'de';
    const input = toPdfInput({ schedule: hallencupSchedule(tournament), standings: undefined, options: { locale, translate: translatorFor(locale), tournament, viewerBaseUrl: base, now: NOW, ...options } });
    const build = await buildNoticePdf(input);
    if (!build.ok) {throw new Error('nicht geteilt');}
    put('muster-' + name, build.doc);
  }
  for (const [name, locale, edition] of [['spielplan-de', 'de', 'plan'], ['spielplan-en', 'en', 'plan'], ['ausfuellen-de', 'de', 'blank']] as const) {
    const tournament = hallencupTournament({ finalRoundGameDuration: 12 });
    const { doc } = await buildSchedulePdf({ schedule: hallencupSchedule(tournament), standings: undefined, options: { locale, translate: translatorFor(locale), tournament, edition, now: NOW, viewerBaseUrl: base, contact: 'Anna Muster, 0170 1234567' } });
    put('muster-' + name + '-A4-hoch.pdf', doc);
  }
  writeFileSync(OUT + 'pruefsummen-' + (process.env.TAG ?? 'x') + '.txt', sums.join('\n') + '\n');
});
