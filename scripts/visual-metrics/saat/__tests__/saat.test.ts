/**
 * Saat "Hallencup Messlauf" (Paket SM, @TA-011): die eingefrorene Datei muss einer frischen Erzeugung mit der
 * ECHTEN App-Erzeugung entsprechen. Ändert sich das App-Format, wird der Test rot, bis die Datei neu erzeugt ist
 * (`SAAT_NEU=1 npx vitest run scripts/visual-metrics/saat`). `scripts/` liegt außerhalb von tsc – dieser Test ist
 * die Prüfung (R-SM-3).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MATCH_COPY_FORMAT_VERSION, matchCopyKey, normalizeCopy, type LegacyMatchCopy } from '../../../../src/core/match/client/matchCopy'
import { TournamentSchema } from '../../../../src/core/models/schemas/TournamentSchema'
import { erzeugeSaat, SAAT_NAME, SAAT_ZEIT, type SaatDatei } from '../erzeuge-saat'
import { vergleicheSaat } from '../saat-vergleich'

const DATEI = join(__dirname, '..', `${SAAT_NAME}.json`)
const lies = (): SaatDatei => JSON.parse(readFileSync(DATEI, 'utf8')) as SaatDatei
const turnierDerSaat = (s: SaatDatei): Record<string, unknown> => (s.datenbanken[0].eintraege.tournaments as Record<string, unknown>[])[0]

let frisch: SaatDatei
let zeitzoneAlt: string | undefined
beforeAll(async () => {
  // Der Spielplan rechnet Anpfiffzeiten in Ortszeit: feste Zeitzone, damit die Datei auf jedem Rechner gleich ist.
  zeitzoneAlt = process.env.TZ
  process.env.TZ = 'Europe/Berlin'
  vi.useFakeTimers({ toFake: ['Date'], now: Date.parse(SAAT_ZEIT) })
  frisch = JSON.parse(JSON.stringify(await erzeugeSaat())) as SaatDatei
  if (process.env.SAAT_NEU === '1') {
    writeFileSync(DATEI, `${JSON.stringify(frisch, null, 2)}\n`)
  }
})
afterAll(() => {
  vi.useRealTimers()
  if (zeitzoneAlt === undefined) { delete process.env.TZ } else { process.env.TZ = zeitzoneAlt }
})

describe('Saat Hallencup Messlauf (@TA-011)', () => {
  it('die eingefrorene Datei entspricht einer frischen Erzeugung', () => {
    expect(vergleicheSaat(lies(), frisch)).toBe('')
  })

  it('Gegenbeispiel: Altformat (teamA/teamB statt Slots) macht den Vergleich rot mit klarer Meldung', () => {
    const alt = lies()
    const turnier = turnierDerSaat(alt)
    const spiele = turnier.matches as Record<string, unknown>[]
    spiele[0].teamA = 'x'
    delete spiele[0].slotA
    const meldung = vergleicheSaat(alt, lies())
    expect(meldung).toContain('veraltet')
    expect(meldung).toMatch(/teamA|slotA/)
    expect(meldung).toContain('SAAT_NEU=1')
  })

  it('Gegenbeispiel: geänderter Wert (Teamname) wird mit Pfad gemeldet', () => {
    const alt = lies()
    ;(turnierDerSaat(alt).teams as { name: string }[])[0].name = 'Anders'
    expect(vergleicheSaat(alt, lies())).toMatch(/teams\[0\]\.name/)
  })

  it('die Saat besteht das Turnier-Schema der App', () => {
    const r = TournamentSchema.safeParse(turnierDerSaat(lies()))
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true)
  })

  it('Inhalt laut Brief (R-SM-2): Teams, Gruppen, Halbfinale/Finale, drei Sonderspiele, alle Folientypen', () => {
    const s = lies()
    const t = turnierDerSaat(s) as { teams: { name: string; group: string }[]; matches: { label?: string; finalType?: string; matchStatus?: string; decidedBy?: string }[]; monitors: { slides: { type: string }[] }[]; sponsors: unknown[] }
    expect(t.teams.map((x) => x.name)).toEqual(expect.arrayContaining(['Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921', 'Eintracht Oberweiler-Niederstetten 1919']))
    expect(new Set(t.teams.map((x) => x.group))).toEqual(new Set(['A', 'B']))
    expect(t.matches.filter((m) => /Halbfinale/.test(m.label ?? ''))).toHaveLength(2)
    expect(t.matches.filter((m) => m.finalType === 'final')).toHaveLength(1)
    expect(t.matches.filter((m) => m.matchStatus === 'running')).toHaveLength(1)
    expect(t.matches.filter((m) => m.decidedBy === 'overtime')).toHaveLength(1)
    expect(t.matches.filter((m) => m.decidedBy === 'penalty')).toHaveLength(1)
    const typen = new Set(t.monitors.flatMap((m) => m.slides.map((x) => x.type)))
    expect([...typen].sort()).toEqual(['all-standings', 'custom-text', 'live', 'next-matches', 'qr-code', 'schedule-field', 'schedule-group', 'sponsor', 'standings', 'top-scorers'])
    expect(t.sponsors).toHaveLength(1)
  })

  it('ansichten.json verweist nur auf Turniere, Spiele, Monitore und den Code der Saat (ein Fehlverweis wäre ein stilles BLOCKED)', () => {
    const saat = lies()
    const turniere = saat.datenbanken[0].eintraege.tournaments as { id: string; shareCode?: string; matches: { id: string }[]; monitors?: { id: string }[] }[]
    const liste = JSON.parse(readFileSync(join(__dirname, '..', '..', 'ansichten.json'), 'utf8')) as { saat: string; ansichten: { id: string; app: string; erwarte: string; saat?: boolean }[] }
    expect(liste.saat).toBe(SAAT_NAME)
    expect(new Set(liste.ansichten.map((a) => a.id)).size).toBe(liste.ansichten.length)
    const finde = (id: string) => turniere.find((t) => t.id === id)
    for (const a of liste.ansichten) {
      expect(a.erwarte, a.id).not.toBe('')
      if (a.saat === false) { continue }
      const turnier = /^\/#\/(?:tournament|display|public)\/([a-zA-Z0-9-]+)/.exec(a.app)?.[1]
      if (turnier !== undefined && turnier !== 'new') {
        const t = finde(turnier)
        if (t === undefined) { expect(a.id).toBe('fehler-unbekanntes-turnier'); continue }
        const spiel = /matchId=([a-z0-9-]+)/.exec(a.app)?.[1]
        if (spiel !== undefined) { expect(t.matches.map((m) => m.id), a.id).toContain(spiel) }
        const monitor = /^\/#\/display\/[^/]+\/([a-zA-Z0-9-]+)/.exec(a.app)?.[1]
        if (monitor !== undefined) { expect(t.monitors?.map((m) => m.id), a.id).toContain(monitor) }
      }
      const code = /^\/#\/live\/([A-Za-z0-9]+)/.exec(a.app)?.[1]
      if (code !== undefined) { expect(turniere.map((t) => t.shareCode), a.id).toContain(code) }
    }
  })

  it('Engine-Kopien: Format, Schlüssel und Datenbank entsprechen der App (normalizeCopy, matchCopyKey, Konstanten aus der Quelle)', () => {
    const db = lies().datenbanken[1]
    const quelle = (pfad: string) => readFileSync(join(__dirname, '..', '..', '..', '..', pfad), 'utf8')
    // Name und Store der Datenbanken stehen privat in der App: aus der Quelldatei lesen, nicht festschreiben.
    const store = /new StoreDb\('([^']+)', '([^']+)', MATCH_COPY_FORMAT_VERSION/.exec(quelle('src/core/match/client/LocalMatchStore.ts'))
    expect(store, 'LocalMatchStore: StoreDb(...) nicht mehr gefunden – Test anpassen').not.toBeNull()
    expect([db.name, db.store]).toEqual([store?.[1], store?.[2]])
    expect(db.version).toBe(MATCH_COPY_FORMAT_VERSION)
    const cache = quelle('src/core/storage/IndexedDBAdapter.ts')
    const haupt = lies().datenbanken[0]
    expect(haupt.name).toBe(/dbName = '([^']+)'/.exec(cache)?.[1])
    expect(haupt.store).toBe(/storeName = '([^']+)'/.exec(cache)?.[1])
    expect(haupt.version).toBe(Number(/version = (\d+)/.exec(cache)?.[1]))
    const kopien = Object.entries(db.eintraege) as [string, LegacyMatchCopy & { accountId: string; matchId: string }][]
    expect(kopien.length).toBeGreaterThan(0)
    for (const [key, kopie] of kopien) {
      expect(key).toBe(matchCopyKey(kopie.accountId, kopie.matchId))
      expect(normalizeCopy(kopie), key).toEqual(kopie)
    }
  })
})
