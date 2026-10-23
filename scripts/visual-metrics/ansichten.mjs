// Pflicht-Ansichten messen (Paket SM, @TA-011): liest ansichten.json und ruft messen.mjs je Ansicht auf
// (eigener Prozess, eigener Bericht), danach die Tabelle "Ansicht · Status · Befunde".
// Exit: 0 alle GRUEN · 1 mindestens ein ROT · 3 mindestens ein BLOCKED · 4 Werkzeugfehler.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Optionen, die an jede Ansicht weitergereicht werden (Name -> hat Wert). */
const DURCHREICHEN = { '--themen': true, '--sprachen': true, '--varianten': true, '--ohne-axe': false, '--neu-bauen': false, '--screenshots': false, '--ausfuehrlich': false }

function ansichtenListe(ordner, gruppe) {
  const datei = join(ordner, 'ansichten.json')
  const daten = JSON.parse(readFileSync(datei, 'utf8'))
  const liste = daten.ansichten.filter((a) => a.gruppen.includes(gruppe))
  if (liste.length === 0) throw new Error(`Keine Ansichten in Gruppe "${gruppe}" (${datei})`)
  return { daten, liste }
}

// `o.profil` hat in messen.mjs den Standard 'app'; nur ein ausdruecklich uebergebenes --profil ersetzt das Profil der Ansicht.
function argumenteFuer(a, daten, o, durch, berichtPfad, profilGegeben) {
  const args = ['--app', a.app, '--erwarte', a.erwarte, '--profil', a.profil === 'monitor' ? (o.monitorProfil ?? 'monitor') : (profilGegeben ? o.profil : a.profil)]
  if (a.saat !== false) args.push('--saat', typeof a.saat === 'string' ? a.saat : daten.saat)
  for (const k of a.klick ?? []) args.push('--klick', k)
  args.push('--bericht', berichtPfad, ...durch)
  return args
}

function fuehreAus(messen, args) {
  return new Promise((ok) => {
    const p = spawn('node', [messen, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { out += d })
    p.on('close', (code) => ok({ code, out }))
  })
}

export async function fuehreAnsichtenAus(o, argv, ordner) {
  let daten, liste
  try {
    ({ daten, liste } = ansichtenListe(ordner, o.ansichten))
  } catch (e) {
    process.stderr.write(`${e.message}\n`)
    return 2
  }
  const nur = o.nur ? new Set(o.nur.split(',')) : null
  if (nur) liste = liste.filter((a) => nur.has(a.id))
  // Optionen fuer jede Ansicht: nur die erlaubten aus argv.
  const durch = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a in DURCHREICHEN) { durch.push(a); if (DURCHREICHEN[a]) durch.push(argv[++i]) }
  }
  const aus = resolve(o.aus ?? 'test-results/visual-metrics-ansichten')
  mkdirSync(aus, { recursive: true })
  const messen = join(ordner, 'messen.mjs')
  const zeilen = []
  for (const a of liste) {
    const berichtPfad = join(aus, `${a.id}.json`)
    process.stderr.write(`→ ${a.id} (${a.app}) …\n`)
    const r = await fuehreAus(messen, [...argumenteFuer(a, daten, o, [...durch, '--aus', aus], berichtPfad, o.profilGegeben === true)])
    let b = null
    if (existsSync(berichtPfad)) {
      try { b = JSON.parse(readFileSync(berichtPfad, 'utf8')) } catch { b = null }
    }
    const status = b ? b.status : `WERKZEUGFEHLER (Exit ${r.code})`
    zeilen.push({
      id: a.id, titel: a.titel, app: a.app, status,
      matrix: b ? `${b.vollmatrix ? 'VOLLMATRIX' : 'TEILMATRIX'} · ${b.laeufe.length} Läufe` : '',
      hart: b?.zusammenfassung.hartBefunde ?? null,
      warnung: b?.zusammenfassung.warnBefunde ?? null,
      gruende: b ? b.gate.gruende : [r.out.split('\n').filter(Boolean).slice(-2).join(' ')],
      bericht: b ? berichtPfad : null,
      exit: r.code,
    })
  }
  const kopf = '| Ansicht | Status | Matrix | HART | WARNUNG |\n|---|---|---|---|---|'
  const tabelle = zeilen.map((z) => `| ${z.id} (${z.titel}) | ${z.status} | ${z.matrix} | ${z.hart ?? '–'} | ${z.warnung ?? '–'} |${z.status === 'BLOCKED' || z.status.startsWith('WERK') ? ` ← ${z.gruende.join('; ')}` : ''}`).join('\n')
  const text = `${kopf}\n${tabelle}\n`
  const stempel = new Date().toISOString().replace(/[:.]/g, '-')
  writeFileSync(join(aus, `ansichten-${stempel}.json`), `${JSON.stringify({ saat: daten.saat, zeilen }, null, 2)}\n`)
  writeFileSync(join(aus, `ansichten-${stempel}.md`), text)
  process.stdout.write(`\nAnsichten (${o.ansichten}), ${zeilen.length} gemessen:\n${text}`)
  if (zeilen.some((z) => z.status.startsWith('WERK'))) return 4
  if (zeilen.some((z) => z.status === 'BLOCKED')) return 3
  return zeilen.some((z) => z.status === 'ROT') ? 1 : 0
}
