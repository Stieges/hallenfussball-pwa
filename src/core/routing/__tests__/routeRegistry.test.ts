import { describe, it, expect } from 'vitest';
import { matchRoute } from '../routeRegistry';

describe('matchRoute', () => {
  it.each([
    ['/', 'dashboard', {}],
    ['/archiv', 'archive', {}],
    ['/papierkorb', 'trash', {}],
    ['/tournament/new', 'wizardNew', {}],
    ['/tournament/abc-123/edit', 'wizardEdit', { tournamentId: 'abc-123' }],
    ['/tournament/abc-123/admin', 'admin', { tournamentId: 'abc-123' }],
    ['/tournament/abc-123/admin/monitore', 'admin', { tournamentId: 'abc-123', category: 'monitore' }],
    ['/tournament/abc-123', 'tournament', { tournamentId: 'abc-123' }],
    ['/tournament/abc-123/spielplan', 'tournament', { tournamentId: 'abc-123', tab: 'spielplan' }],
    // Guard-Präzision: "new" als Teil einer ID/eines Tabs, aber NICHT als
    // "/new"-Substring, darf NICHT ausgeschlossen werden (App.tsx:160 prüft
    // nur die exakte Substring-Folge "/new").
    ['/tournament/x-new-y', 'tournament', { tournamentId: 'x-new-y' }],
    ['/live/ABC123', 'publicLive', { shareCode: 'ABC123' }],
    ['/display/t-1/m-1', 'monitorDisplay', { tournamentId: 't-1', monitorId: 'm-1' }],
    ['/login', 'login', {}],
    ['/register', 'register', {}],
    ['/invite', 'invite', {}],
    // A-17b (@HE-001): Beitritt per Helfer-QR-Code, 10 Zeichen
    ['/join/ABCDEFGH23', 'join', { code: 'ABCDEFGH23' }],
    // A-17c (@HE-099): Auswahl bei mehreren Helfer-Zugängen
    ['/helfer', 'helperChooser', {}],
    ['/settings', 'settings', {}],
    ['/profile', 'profile', {}],
    ['/impressum', 'impressum', {}],
    ['/datenschutz', 'datenschutz', {}],
    // Zusätzlich in App.tsx gefunden (grep -n 'location.pathname' src/App.tsx,
    // Zeilen 275-320) — nicht im Drift-Check-Ausgangs-Testlisten, aber
    // App.tsx-Matcher, daher pflicht laut Task-Brief:
    ['/auth/callback', 'authCallback', {}],
    ['/auth/confirm', 'authConfirm', {}],
    ['/set-password', 'setPassword', {}],
    ['/test-live', 'localTest', {}],
  ] as const)('%s → %s', (path, name, params) => {
    const m = matchRoute(path);
    expect(m?.name).toBe(name);
    expect(m?.params).toEqual(params);
  });

  it('gibt null für unbekannte Pfade', () => {
    expect(matchRoute('/gibt-es-nicht')).toBeNull();
  });

  // Paket 1: Die alte Zuschauer-Seite /public/:tournamentId ist entfernt. Die Adresse ist
  // eine unbekannte Route und landet in App.tsx auf „Seite nicht gefunden".
  it.each(['/public/xyz-789', '/public/public-test-tournament'])(
    'Gegenbeispiel: %s ist keine Route mehr (unbekannt → „Seite nicht gefunden")',
    (path) => {
      expect(matchRoute(path)).toBeNull();
    },
  );

  // Gegenbeispiel: die Live-Ansicht per Teilnahmecode bleibt erreichbar.
  it('/live/E2EPUB bleibt die Live-Ansicht (publicLive)', () => {
    expect(matchRoute('/live/E2EPUB')).toEqual({ name: 'publicLive', params: { shareCode: 'E2EPUB' } });
  });

  // Reihenfolge-Fallen (Bestandssemantik App.tsx:158-161):
  it('matcht /tournament/:id/edit NIE als tournament', () => {
    expect(matchRoute('/tournament/x/edit')?.name).toBe('wizardEdit');
  });
  it('matcht /tournament/:id/admin NIE als tournament', () => {
    expect(matchRoute('/tournament/x/admin')?.name).toBe('admin');
  });
  it('matcht /tournament/new NIE als tournament (tournamentId="new")', () => {
    expect(matchRoute('/tournament/new')?.name).toBe('wizardNew');
  });

  // Reviewer-Finding: App.tsx:160 `!location.pathname.includes('/new')` gilt
  // für den GESAMTEN Pfad, nicht nur ein Segment — jede tournamentId oder jeder
  // tab, der mit "new" beginnt (also einen "/new"-Substring erzeugt), macht
  // isTournamentPath false. matchRoute muss das exakt reproduzieren.
  it('matcht /tournament/:id NIE als tournament, wenn die ID mit "new" beginnt (App.tsx:160 Substring-Guard)', () => {
    expect(matchRoute('/tournament/newYear2026')).toBeNull();
  });
  it('matcht /tournament/:id/:tab NIE als tournament, wenn der tab mit "new" beginnt (App.tsx:160 Substring-Guard)', () => {
    expect(matchRoute('/tournament/abc-123/newt')).toBeNull();
  });

  it('matcht /tournament/edit NICHT als tournament (zweisegmentig, endsWith /edit)', () => {
    expect(matchRoute('/tournament/edit')).toBeNull();
  });
});

describe('matchRoute: /join/:code (A-17b)', () => {
  it.each(['/join', '/join/', '/join/ABC', '/join/ABC DEF', '/join/AB-CDEFGH23', '/join/ABCDEFGH23/x', `/join/${'A'.repeat(33)}`])(
    'Gegenbeispiel %s ist kein Beitritt',
    (path) => {
      expect(matchRoute(path)?.name).not.toBe('join');
    },
  );
});

describe('matchRoute: /helfer (A-17c)', () => {
  it.each(['/helfer/', '/helfer/x', '/Helfer', '/helfers'])('Gegenbeispiel %s ist keine Auswahl', (path) => {
    expect(matchRoute(path)?.name).not.toBe('helperChooser');
  });
});
