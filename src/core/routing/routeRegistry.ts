/**
 * Zentrale Routen-Registry. Ersetzt die Inline-Regex-Matcher aus App.tsx.
 * FIRST-MATCH-WINS: Die Reihenfolge ist semantisch (wizardEdit/admin VOR tournament).
 *
 * Alle `pattern`-Regexe sind zeichengleich aus App.tsx übernommen (siehe
 * Zeilenangaben unten). Wo App.tsx einen Regex-Match zusätzlich mit einer
 * separaten Boolean-Bedingung UND-verknüpft (z.B. isTournamentPath, App.tsx:160
 * `!location.pathname.includes('/new')`), wird das über `guard` auf dem
 * jeweiligen RouteDef abgebildet statt in den Regex hineinkompiliert — das
 * hält `pattern` weiterhin 1:1 mit der App.tsx-Quelle vergleichbar.
 */
export type RouteName =
  | 'dashboard' | 'archive' | 'trash'
  | 'wizardNew' | 'wizardEdit' | 'admin' | 'tournament'
  | 'publicLive' | 'monitorDisplay' | 'public'
  | 'authCallback' | 'authConfirm' | 'setPassword' | 'localTest'
  | 'login' | 'register' | 'invite' | 'settings' | 'profile'
  | 'impressum' | 'datenschutz';

export interface RouteMatch {
  name: RouteName;
  /**
   * Partial by design: `matchRoute` only assigns a key when its capture
   * group actually matched (see the loop below). For routes with an
   * optional segment (e.g. admin's `category`, tournament's `tab`),
   * the corresponding param is genuinely absent at runtime for some
   * matches of that same route name — `Record<string, string>` claimed
   * otherwise and let call sites read a `string` that was really
   * `undefined`. `tsconfig.json` does not set `noUncheckedIndexedAccess`,
   * so this Partial is what keeps that unsoundness from being invisible.
   */
  params: Readonly<Partial<Record<string, string>>>;
}

interface RouteDef {
  name: RouteName;
  pattern: RegExp;
  /** Namen der Capture-Groups in Pattern-Reihenfolge */
  paramNames: readonly string[];
  /**
   * Optionale Zusatzbedingung neben dem Pattern-Match (bildet eine separate
   * Boolean-AND-Verknüpfung aus App.tsx ab, siehe Kommentar am jeweiligen
   * RouteDef-Eintrag). Bekommt den vollen pathname, nicht nur die Capture-Groups
   * — App.tsx:160 prüft `.includes('/new')` auf dem gesamten Pfad, nicht nur
   * auf einem einzelnen Segment.
   */
  guard?: (pathname: string) => boolean;
}

const ROUTES: readonly RouteDef[] = [
  // App.tsx:147 — ['/', '/archiv', '/papierkorb'].includes(location.pathname)
  { name: 'dashboard', pattern: /^\/$/, paramNames: [] },
  { name: 'archive', pattern: /^\/archiv$/, paramNames: [] },
  { name: 'trash', pattern: /^\/papierkorb$/, paramNames: [] },

  // App.tsx:175 — location.pathname === '/tournament/new'
  { name: 'wizardNew', pattern: /^\/tournament\/new$/, paramNames: [] },
  // App.tsx:176 — /^\/tournament\/([a-zA-Z0-9-]+)\/edit$/
  { name: 'wizardEdit', pattern: /^\/tournament\/([a-zA-Z0-9-]+)\/edit$/, paramNames: ['tournamentId'] },
  // App.tsx:153 — /^\/tournament\/([a-zA-Z0-9-]+)\/admin(?:\/([a-z-]+))?$/
  { name: 'admin', pattern: /^\/tournament\/([a-zA-Z0-9-]+)\/admin(?:\/([a-z-]+))?$/, paramNames: ['tournamentId', 'category'] },
  // App.tsx:159 — /^\/tournament\/([a-zA-Z0-9-]+)(?:\/([a-z]+))?$/
  // App.tsx:160 — isTournamentPath UND-verknüpft zusätzlich eine
  // drei-teilige Exklusions-Kaskade:
  //   !pathname.includes('/new') && !pathname.endsWith('/edit') && !isAdminPath
  // Klausel 3 (isAdminPath) übernimmt die First-Match-Wins-Reihenfolge oben
  // (admin ist vor tournament gelistet). Klausel 2 (endsWith('/edit')) wird
  // für DREI-segmentige Pfade ebenfalls durch die Reihenfolge abgedeckt
  // (wizardEdit matcht /tournament/:id/edit zuerst) — ABER NICHT für den
  // zwei-segmentigen Sonderfall /tournament/edit: das endet auf '/edit',
  // aber wizardEdits Pattern verlangt drei Segmente und matcht hier nicht,
  // wodurch der Pfad sonst zu tournament mit tournamentId:'edit' durchfiele.
  // Klausel 1 ('/new'-Substring, auf dem GESAMTEN Pfad, nicht nur einem
  // Segment — z.B. schließt das auch /tournament/abc-123/newt aus, weil
  // "/newt" mit "/new" beginnt) hat kein Reihenfolge-Äquivalent und braucht
  // ebenfalls einen expliziten Guard. Beide verbleibenden Klauseln (1 und 2)
  // werden daher explizit im Guard reproduziert.
  {
    name: 'tournament',
    pattern: /^\/tournament\/([a-zA-Z0-9-]+)(?:\/([a-z]+))?$/,
    paramNames: ['tournamentId', 'tab'],
    guard: (pathname) => !pathname.includes('/new') && !pathname.endsWith('/edit'),
  },

  // App.tsx:164 — /^\/live\/([A-Za-z0-9]+)$/ (bewusst kein Längen-Limit, siehe
  // App.tsx:276 `/^\/live\/([A-Z0-9]{6})$/i` für den abweichenden, strengeren
  // useEffect-Matcher — Task-Brief schreibt Zeile 164 als kanonisch vor)
  { name: 'publicLive', pattern: /^\/live\/([A-Za-z0-9]+)$/, paramNames: ['shareCode'] },
  // App.tsx:168/279 — /^\/display\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)$/
  { name: 'monitorDisplay', pattern: /^\/display\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)$/, paramNames: ['tournamentId', 'monitorId'] },
  // App.tsx:275 — /^\/public\/([a-zA-Z0-9-]+)$/
  { name: 'public', pattern: /^\/public\/([a-zA-Z0-9-]+)$/, paramNames: ['tournamentId'] },

  // App.tsx:299 — path === '/auth/callback'
  { name: 'authCallback', pattern: /^\/auth\/callback$/, paramNames: [] },
  // App.tsx:302 — path === '/auth/confirm'
  { name: 'authConfirm', pattern: /^\/auth\/confirm$/, paramNames: [] },
  // App.tsx:316 — path === '/set-password'
  { name: 'setPassword', pattern: /^\/set-password$/, paramNames: [] },
  // App.tsx:305 — path === '/test-live' (DEV-only local test screen)
  { name: 'localTest', pattern: /^\/test-live$/, paramNames: [] },

  // App.tsx:314 — path === '/login'
  { name: 'login', pattern: /^\/login$/, paramNames: [] },
  // App.tsx:312 — path === '/register'
  { name: 'register', pattern: /^\/register$/, paramNames: [] },
  // App.tsx:277/292 — inviteMatch = /^\/invite$/
  { name: 'invite', pattern: /^\/invite$/, paramNames: [] },
  // App.tsx:308 — path === '/settings'
  { name: 'settings', pattern: /^\/settings$/, paramNames: [] },
  // App.tsx:310 — path === '/profile'
  { name: 'profile', pattern: /^\/profile$/, paramNames: [] },

  // App.tsx:150/318 — ['/impressum', '/datenschutz'].includes(location.pathname) / path === '/impressum'
  { name: 'impressum', pattern: /^\/impressum$/, paramNames: [] },
  // App.tsx:150/320 — path === '/datenschutz'
  { name: 'datenschutz', pattern: /^\/datenschutz$/, paramNames: [] },
];

export function matchRoute(pathname: string): RouteMatch | null {
  for (const route of ROUTES) {
    const m = route.pattern.exec(pathname);
    if (m && (!route.guard || route.guard(pathname))) {
      const params: Record<string, string> = {};
      route.paramNames.forEach((key, i) => {
        const value = m[i + 1];
        if (value !== undefined) { params[key] = value; }
      });
      return { name: route.name, params };
    }
  }
  return null;
}
