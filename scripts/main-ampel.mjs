#!/usr/bin/env node
// Main-Ampel (@TA-022, Stopp-Regel; aufgerufen von .github/workflows/main-ampel.yml).
//
// Bewertet die Pflicht-Prüfungen der Branch-Regel für main im letzten abgeschlossenen Push-Lauf je Workflow und setzt auf
// den betroffenen PRs den Commit-Status „Main-Ampel (Stopp-Regel)“:
//   failure  – eine Pflicht-Prüfung ist auf main rot (mit Link auf den Lauf), außer der PR trägt das Label „main-reparatur“;
//   success  – alle Pflicht-Prüfungen grün, oder Reparatur-PR.
// Abgebrochene oder übersprungene Läufe zählen nicht, es gilt der letzte abgeschlossene davor. Nicht-Pflicht-Jobs (z. B.
// zusätzliche E2E-Projekte) und Läufe gegen die Live-Datenbank (Schema-Drift) zählen nicht.
// Fehlerverhalten (fail-closed): Schlägt eine Abfrage bei GitHub fehl, endet das Skript mit Exit 1 und setzt KEINEN
// Status – ein Pflicht-Status bleibt dann ausstehend, nie fälschlich grün. Ein einzelner PR, der nicht lesbar ist (gerade
// geschlossen), oder ein Status, der nicht geschrieben werden darf (Fork-/Dependabot-Lauf), ergibt nur eine Warnung.
//
// Umgebung: REPO, EREIGNIS (pull_request | workflow_run | workflow_dispatch), PR_NUMMER, LAUF_BRANCH, LAUF_SHA,
// LAUF_PRS (JSON-Liste der PR-Nummern), GITHUB_STEP_SUMMARY (optional). Braucht `gh` mit GH_TOKEN.
import { appendFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

export const KONTEXT = 'Main-Ampel (Stopp-Regel)'
export const REPARATUR_LABEL = 'main-reparatur'

/**
 * Pflicht-Prüfungen der Branch-Regel für main (Stand 30.10.2026, `gh api …/branches/main/protection`), je Workflow.
 * „Forbidden Terms Guard (PR-Text)“ läuft nur auf PRs und fehlt deshalb. Ändert sich die Branch-Regel, hier nachziehen.
 */
export const PFLICHT = {
  CI: ['Forbidden Terms Guard', 'Unit Tests', 'Build', 'E2E Tests (mobile-sm)', 'E2E Tests (mobile-md)', 'E2E Tests (tablet-portrait)', 'E2E Tests (desktop)', 'E2E Tests (desktop-webkit)'],
  'E2E Cloud': ['Cloud E2E Tests (lokaler Supabase-Stack)'],
  'CodeQL Security Scan': ['Analyze (javascript-typescript)'],
  'Visual Regression': ['Visual Regression (Playwright-Container)'],
}

const NICHT_ROT = new Set(['success', 'skipped', 'neutral', 'cancelled'])

class AbfrageFehler extends Error {}

function gh(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  if (r.error || r.status !== 0) throw new AbfrageFehler(`gh ${args.slice(0, 3).join(' ')} …: ${(r.stderr || String(r.error ?? '')).trim()}`)
  return r.stdout
}
const ghJson = (args) => JSON.parse(gh(args))

/** Rote Pflicht-Prüfungen auf main: [{ workflow, job, sha, url }]. Wirft AbfrageFehler bei jedem Fehler der API. */
export function rotePflichtPruefungen(repo) {
  const rot = []
  for (const [workflow, jobs] of Object.entries(PFLICHT)) {
    const laeufe = ghJson(['run', 'list', '-R', repo, '--workflow', workflow, '--branch', 'main', '--event', 'push', '--status', 'completed', '--limit', '30', '--json', 'databaseId,conclusion,headSha,url'])
    const lauf = laeufe.find((l) => l.conclusion !== 'cancelled' && l.conclusion !== 'skipped')
    if (!lauf) { console.log(`  ${workflow}: kein abgeschlossener Push-Lauf auf main`); continue }
    const { jobs: liste } = ghJson(['run', 'view', String(lauf.databaseId), '-R', repo, '--json', 'jobs'])
    const pflicht = liste.filter((j) => jobs.includes(j.name))
    const roteJobs = pflicht.filter((j) => !NICHT_ROT.has(j.conclusion))
    console.log(`  ${workflow} (${String(lauf.headSha).slice(0, 8)}): ${roteJobs.length === 0 ? 'grün' : `rot: ${roteJobs.map((j) => j.name).join(', ')}`}`)
    for (const j of roteJobs) rot.push({ workflow, job: j.name, sha: String(lauf.headSha).slice(0, 8), url: j.url ?? lauf.url })
  }
  return rot
}

/** PR-Nummern, die neu bewertet werden. */
export function ziele(env, repo) {
  if (env.EREIGNIS === 'pull_request') return [String(env.PR_NUMMER)]
  if (env.EREIGNIS === 'workflow_run' && env.LAUF_BRANCH !== 'main') {
    const prs = JSON.parse(env.LAUF_PRS || '[]').map(String)
    if (prs.length > 0) return prs
    // Fork-PRs: GitHub liefert keine pull_requests am Lauf; Suche über den Kopf-Commit.
    if (!env.LAUF_SHA) return []
    return ghJson(['pr', 'list', '-R', repo, '--state', 'open', '--search', env.LAUF_SHA, '--json', 'number']).map((p) => String(p.number))
  }
  return ghJson(['pr', 'list', '-R', repo, '--state', 'open', '--limit', '200', '--json', 'number']).map((p) => String(p.number))
}

/** Status je PR aus roten Prüfungen und Labels. */
export function bewerte(rot, labels) {
  const text = rot.map((r) => `${r.job} (${r.sha})`).join(', ')
  if (rot.length === 0) return { state: 'success', description: 'Hauptzweig grün' }
  if (labels.includes(REPARATUR_LABEL)) return { state: 'success', description: `Reparatur-PR: darf trotz rotem Hauptzweig – rot: ${text}`, url: rot[0].url }
  return { state: 'failure', description: `Hauptzweig rot: ${text} – erst reparieren (Label ${REPARATUR_LABEL})`, url: rot[0].url }
}

export function main(env = process.env) {
  const repo = env.REPO
  let rot
  let nummern
  try {
    rot = rotePflichtPruefungen(repo)
    nummern = ziele(env, repo)
  } catch (e) {
    console.error(`::error::Main-Ampel: Abfrage bei GitHub fehlgeschlagen, kein Status gesetzt (nie grün ohne Prüfung): ${e instanceof Error ? e.message : String(e)}`)
    return 1
  }
  const zusammenfassung = rot.length === 0 ? '### Main-Ampel: grün' : `### Main-Ampel: ROT – ${rot.map((r) => `${r.job} (${r.sha})`).join(', ')}`
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${zusammenfassung}\n`)
  if (rot.length > 0) console.log(`::warning::Hauptzweig rot – keine weiteren Merges außer PRs mit Label ${REPARATUR_LABEL} (Stopp-Regel).`)

  for (const nr of nummern) {
    let pr
    try {
      pr = ghJson(['pr', 'view', nr, '-R', repo, '--json', 'headRefOid,labels,state'])
    } catch (e) {
      console.log(`::warning::PR #${nr} nicht lesbar, übersprungen (${e instanceof Error ? e.message : String(e)})`)
      continue
    }
    if (pr.state && pr.state !== 'OPEN') { console.log(`  PR #${nr}: nicht offen, übersprungen`); continue }
    const s = bewerte(rot, (pr.labels ?? []).map((l) => l.name))
    console.log(`  PR #${nr} (${pr.headRefOid}): ${s.state}`)
    const args = ['api', '-X', 'POST', `repos/${repo}/statuses/${pr.headRefOid}`, '-f', `state=${s.state}`, '-f', `context=${KONTEXT}`, '-f', `description=${s.description.slice(0, 139)}`]
    if (s.url) args.push('-f', `target_url=${s.url}`)
    try {
      gh(args)
    } catch {
      // pull_request-Lauf aus Fork oder von Dependabot: Token ohne Schreibrecht. Den Status setzt der workflow_run-Lauf
      // nach dem Ende der PR-Prüfungen (Rechte des Repos; Fork-PRs findet er über den Kopf-Commit).
      console.log(`::warning::Status für PR #${nr} nicht gesetzt (Rechte des Laufs); folgt mit dem nächsten workflow_run.`)
    }
  }
  return 0
}

process.exitCode = main()
