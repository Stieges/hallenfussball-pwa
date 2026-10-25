import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ABGELAUFEN_MELDUNG, pruefeAdresse, pruefeFrist } from '../prodSmokeGuards';

describe('Frist des Produktions-Rauchtests', () => {
  it('@RT-007 am 15.11.2026 (UTC, letzter Tag) läuft er noch', () => {
    expect(() => { pruefeFrist(new Date('2026-11-15T23:59:59Z')); }).not.toThrow();
  });

  it('@RT-007 ab dem 16.11.2026 scheitert er mit der Abgelaufen-Meldung', () => {
    expect(() => { pruefeFrist(new Date('2026-11-16T00:00:00Z')); }).toThrow(ABGELAUFEN_MELDUNG);
  });
});

describe('Adress-Erlaubnisliste des Produktions-Rauchtests', () => {
  it('@RT-008 die Produktion und ihre Vorschauen sind erlaubt', () => {
    expect(() => { pruefeAdresse('https://hallenfussball-pwa.vercel.app'); }).not.toThrow();
    expect(() => { pruefeAdresse('https://hallenfussball-pwa-git-main-x.vercel.app/'); }).not.toThrow();
  });

  it.each([
    'https://evil.example',
    'https://hallenfussball-pwa.vercel.app.evil.example',
    'http://hallenfussball-pwa.vercel.app',
    'https://hallenfussball-pwa.vercel.app@evil.example',
    '',
  ])('@RT-008 %j bekommt keine Zugangsdaten', (adresse) => {
    expect(() => { pruefeAdresse(adresse); }).toThrow();
  });
});

describe('Workflow des Produktions-Rauchtests', () => {
  const workflow = readFileSync(path.join(__dirname, '..', '..', '..', '.github', 'workflows', 'prod-smoke.yml'), 'utf8');

  it('@RT-004 ein Deploy startet den Kurzlauf, der Volllauf kommt nur vom Zeitplan oder von Hand', () => {
    expect(workflow).toContain("(github.event_name == 'schedule' && 'voll' || 'kurz')");
    expect(workflow).toMatch(/schedule:\s*\n\s*- cron:/);
  });

  it('@RT-006 hochgeladen werden nur Bilder und die Fehlerbeschreibung, nie Spur, Video oder der ganze Ordner', () => {
    const upload = workflow.slice(workflow.indexOf('actions/upload-artifact'));
    expect(upload).toContain('test-results/prod-smoke/**/*.png');
    expect(upload).toContain('test-results/prod-smoke/**/error-context.md');
    expect(upload).not.toMatch(/path:\s*test-results\/prod-smoke\/?\s*$/m);
    expect(upload).not.toMatch(/\.zip|\.webm/);
    const config = readFileSync(path.join(__dirname, '..', '..', '..', 'playwright.prod-smoke.config.ts'), 'utf8');
    expect(config).toContain("trace: 'off'");
    expect(config).toContain("video: 'off'");
  });

  it('@RT-007 der Fristriegel ist der erste Schritt und bricht rot ab', () => {
    expect(workflow.indexOf('20261115')).toBeLessThan(workflow.indexOf('PROD_SMOKE_EMAIL" ]'));
    expect(workflow).toContain('Rauchtest gegen Produktion abgelaufen (Freigabe bis 15.11.)');
  });
});
