// Vor-Push-Prüfung (@TA-020): welche Prüfungen ein Branch braucht, abgeleitet aus seinen geänderten Pfaden.
// Reine Funktionen ohne Git und ohne Dateisystem (bis auf den übergebenen Leser), damit die Auswahl testbar ist.

/** Playwright-Specs ohne Datenbank: das, was die CI im Job „E2E Tests (…)“ fährt (testIgnore der Breakpoint-Projekte). */
export const OFFLINE_SPEC = /^tests\/e2e\/(?!(cloud|visual|auth-slow|prod-smoke)\/).*\.spec\.ts$/

/** Pfade, deren Änderung weder Härtetest noch Playwright braucht (Doku, Workflows, Anforderungs- und Meta-Dateien). */
const OHNE_OBERFLAECHE = /^(docs\/|\.github\/|\.claude\/|\.husky\/|supabase\/|tests\/meta\/|[^/]+\.md$)/

/** Test-Dateien unter src/ ändern das Verhalten der App nicht. */
const SRC_TEST = /(^|\/)__tests__\/|\.(test|spec)\.tsx?$/

/**
 * Härtetest der visuellen Messung (scripts/visual-metrics): misst die gebaute App. Nötig, wenn sich die App selbst
 * (src/ ohne Tests, index.html, public/, Build-Konfiguration, Abhängigkeiten) oder das Messskript ändert.
 */
export function haertetestNoetig(geaendert) {
  return geaendert.some((p) =>
    p.startsWith('scripts/visual-metrics/') ||
    /^(index\.html|vite\.config\.ts|package(-lock)?\.json|tsconfig[^/]*\.json)$/.test(p) ||
    p.startsWith('public/') ||
    (p.startsWith('src/') && !SRC_TEST.test(p)))
}

/**
 * Bereiche der App → Muster für die Namen der Playwright-Specs. Erste passende Zeile gewinnt NICHT: jede passende
 * Zeile trägt bei (eine Datei kann zu zwei Bereichen gehören). Muster prüfen den Pfad ohne Groß-/Kleinschreibung.
 */
export const BEREICHE = [
  { name: 'Cockpit', pfad: /cockpit|match-engine|klaerungsliste|core\/match\//i, spec: /cockpit|nichtantritt|eintraege-sperre|kartenfarben|protokoll|uhr-art|helfer-wiedereinstieg/ },
  { name: 'Monitor', pfad: /monitor/i, spec: /monitor|spielanzeige|alle-tabellen/ },
  { name: 'Zuschauer-Seite', pfad: /public-view|liveview|zuschauer/i, spec: /zuschauer|b15-|a36c/ },
  { name: 'Spielplan', pfad: /schedule|spielplan/i, spec: /spielplan|schedule-editor|zeiten-verschieben|sk-spielkarte|ob074|schnelleingabe/ },
  { name: 'Assistent', pfad: /tournament-creation|wizard|ageclass/i, spec: /wizard|altersklasse|w4-028/ },
  { name: 'Dialoge', pfad: /dialogs?\//i, spec: /dialog/ },
  { name: 'Übersicht', pfad: /dashboard|tournamentcard|trashtournament/i, spec: /dashboard|smoke/ },
  { name: 'Einstellungen', pfad: /settings/i, spec: /settings/ },
  { name: 'Anmelden', pfad: /features\/auth|\/auth\//i, spec: /\/auth\.spec|auth-resilience|production-lockout/ },
  { name: 'Abschluss und Endstand', pfad: /tournament-finish|abschluss|endstand|standings|tabelle|ranking/i, spec: /abschluss|endstand|tabelle|gruppe-abschliessen|wertung/ },
  { name: 'Turnierverwaltung', pfad: /tournament-management|tournament-admin|managementchrome/i, spec: /tournament-tabs|zustand-lesen|kopie-proben|import/ },
  { name: 'Global (Tokens, Texte, Grundbausteine, Einstieg)', pfad: /^src\/(design-tokens|styles|i18n|components\/(ui|layout)|App\.tsx|main\.tsx)/, spec: /\/smoke\.spec|dashboard|dialog-actions/ },
]

/** Ohne passenden Bereich: eine geänderte App-Datei bekommt wenigstens den Rauchtest. */
const RAUCHTEST = /\/smoke\.spec\.ts$/

/**
 * Wählt die Playwright-Specs ohne Datenbank für die geänderten Pfade.
 * @param {string[]} geaendert  geänderte Pfade (relativ zur Repo-Wurzel, mit „/“)
 * @param {string[]} specs      alle vorhandenen Spec-Dateien (relativ, mit „/“)
 * @param {(pfad: string) => string} lese  liest eine Spec (für Hilfsdateien: welche Spec sie einbindet)
 * @returns {{ specs: string[], gruende: Map<string, string[]> }} sortierte Auswahl und je Spec die Gründe
 */
export function waehleSpecs(geaendert, specs, lese) {
  const offline = specs.filter((s) => OFFLINE_SPEC.test(s)).sort()
  const gruende = new Map()
  const nimm = (spec, grund) => {
    const liste = gruende.get(spec) ?? []
    if (!liste.includes(grund)) liste.push(grund)
    gruende.set(spec, liste)
  }
  for (const pfad of geaendert) {
    if (OHNE_OBERFLAECHE.test(pfad)) continue
    if (OFFLINE_SPEC.test(pfad)) {
      if (offline.includes(pfad)) nimm(pfad, 'Spec selbst geändert')
      continue
    }
    if (pfad.startsWith('tests/e2e/') && !OFFLINE_SPEC.test(pfad)) {
      // Hilfsdatei der Specs (helpers/, fixtures/, selectors/ …): jede Spec, die sie per Namen einbindet.
      const stamm = pfad.split('/').pop().replace(/\.[^.]+$/, '')
      if (/^(cloud|visual|auth-slow|prod-smoke)\//.test(pfad.slice('tests/e2e/'.length))) continue
      for (const s of offline) {
        if (lese(s).includes(`/${stamm}'`) || lese(s).includes(`/${stamm}.`)) nimm(s, `bindet ${pfad} ein`)
      }
      continue
    }
    if (pfad === 'playwright.config.ts') {
      for (const s of offline.filter((x) => RAUCHTEST.test(x))) nimm(s, 'playwright.config.ts geändert')
      continue
    }
    if (!pfad.startsWith('src/') || SRC_TEST.test(pfad)) continue
    let getroffen = false
    for (const b of BEREICHE) {
      if (!b.pfad.test(pfad)) continue
      getroffen = true
      for (const s of offline.filter((x) => b.spec.test(x))) nimm(s, `Bereich ${b.name} (${pfad})`)
    }
    if (!getroffen) {
      for (const s of offline.filter((x) => RAUCHTEST.test(x))) nimm(s, `App-Datei ohne Bereich (${pfad})`)
    }
  }
  return { specs: [...gruende.keys()].sort(), gruende }
}
