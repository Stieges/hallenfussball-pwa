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
  | 'publicLive' | 'monitorDisplay' | 'join' | 'helperChooser'
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
  /**
   * Kiosk-Route (@ME-003, @OB-028): ohne globale Einblendungen (Offline-Hinweis, Speicherwarnung,
   * Einwilligung, Update-Hinweis, Toasts). Ohne Merkmal bleibt eine Route wie bisher.
   */
  kiosk?: true;
}

/**
 * Routen, die es NUR im Entwicklungs-Build geben darf. @OB-035: In der
 * veröffentlichten App ist `/test-live` eine unbekannte Adresse und zeigt
 * „Seite nicht gefunden" (App.tsx rendert das bei `matchRoute === null`).
 */
const DEV_ONLY_ROUTES: readonly RouteDef[] = [
  // App.tsx:305 — path === '/test-live' (DEV-only local test screen)
  { name: 'localTest', pattern: /^\/test-live$/, paramNames: [] },
];

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
  { name: 'monitorDisplay', pattern: /^\/display\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)$/, paramNames: ['tournamentId', 'monitorId'], kiosk: true },
  // A-17b (GA5, R-GA5-2): Beitritt per Helfer-QR-Code. Der Code hat 10 Zeichen; die Spanne 4–32 lässt Platz für spätere Längen
  // und fängt Fehlscans (zu kurz/zu lang) als „nicht gefunden“ statt als Beitritt mit offensichtlich falschem Code.
  { name: 'join', pattern: /^\/join\/([A-Za-z0-9]{4,32})$/, paramNames: ['code'] },

  // A-17c (GA5, @HE-099): Auswahl, wenn ein Helfer-Gerät Zugänge zu mehreren laufenden Turnieren hat
  { name: 'helperChooser', pattern: /^\/helfer$/, paramNames: [] },

  // App.tsx:299 — path === '/auth/callback'
  { name: 'authCallback', pattern: /^\/auth\/callback$/, paramNames: [] },
  // App.tsx:302 — path === '/auth/confirm'
  { name: 'authConfirm', pattern: /^\/auth\/confirm$/, paramNames: [] },
  // App.tsx:316 — path === '/set-password'
  { name: 'setPassword', pattern: /^\/set-password$/, paramNames: [] },
  // App.tsx:305 — path === '/test-live': nur im Entwicklungs-Build registriert
  ...(import.meta.env.DEV ? DEV_ONLY_ROUTES : []),

  // App.tsx:314 — path === '/login'
  { name: 'login', pattern: /^\/login$/, paramNames: [] },
  // App.tsx:312 — path === '/register'
  { name: 'register', pattern: /^\/register$/, paramNames: [] },
  // App.tsx:277/292 — inviteMatch = /^\/invite$/ (seit A-17b nur noch der Hinweis auf den Helfer-QR-Code, @HE-063)
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

/** Erste passende Route (FIRST-MATCH-WINS) mit ihrem Regex-Treffer. */
function findRoute(pathname: string): { route: RouteDef; m: RegExpExecArray } | null {
  for (const route of ROUTES) {
    const m = route.pattern.exec(pathname);
    if (m && (!route.guard || route.guard(pathname))) {
      return { route, m };
    }
  }
  return null;
}

export function matchRoute(pathname: string): RouteMatch | null {
  const found = findRoute(pathname);
  if (found === null) { return null; }
  const { route, m } = found;
  const params: Record<string, string> = {};
  route.paramNames.forEach((key, i) => {
    const value = m[i + 1];
    if (value !== undefined) { params[key] = value; }
  });
  return { name: route.name, params };
}

/** true auf Kiosk-Routen (@ME-003): keine globalen Einblendungen. Unbekannte Adressen sind keine Kiosk-Route. */
export function isKioskRoute(pathname: string): boolean {
  return findRoute(pathname)?.route.kiosk === true;
}
