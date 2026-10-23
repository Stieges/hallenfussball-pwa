// Stub-Schalter `ausgang` (A-17b, Nachblick #335 F-1, e4 „Erst verbinden – N Einträge warten“, @HE-092): legt N wartende
// Einträge des angemeldeten Kontos in die lokale Kopie, so wie `LocalMatchStore` sie liest und `countWaitingEntries` sie zählt.
import { describe, expect, it } from 'vitest'
import { countWaitingEntries } from '../../../src/features/collaboration/outbox/countWaitingEntries'
import { MATCH_COPY_FORMAT_VERSION, matchCopyKey, type MatchCopy } from '../../../src/core/match/client/matchCopy'
// @ts-expect-error -- ESM-Hilfsmodul ohne Typen
import { ausgangSaat, installiereStub, leseStub } from '../stub.mjs'

interface Saat { datenbanken: Array<{ name: string; version: number; store: string; eintraege: Record<string, MatchCopy> }> }

describe('Stub-Schalter ausgang', () => {
  it('legt eine Kopie des Kontos mit N offenen Einträgen an, im Format und unter dem Schlüssel von LocalMatchStore', async () => {
    const saat = ausgangSaat('konto-1', 2) as Saat
    expect(saat.datenbanken).toHaveLength(1)
    const db = saat.datenbanken[0]
    expect(db).toMatchObject({ name: 'hallenfussball-matches', version: MATCH_COPY_FORMAT_VERSION, store: 'matches' })
    const [[schluessel, kopie]] = Object.entries(db.eintraege)
    expect(schluessel).toBe(matchCopyKey('konto-1', kopie.matchId))
    expect(kopie.accountId).toBe('konto-1')
    const kopien = Object.values(db.eintraege)
    expect(await countWaitingEntries({ forAccount: async (id) => kopien.filter((k) => k.accountId === id) }, 'konto-1')).toBe(2)
    expect(await countWaitingEntries({ forAccount: async (id) => kopien.filter((k) => k.accountId === id) }, 'anderes-konto')).toBe(0)
  })

  it('Zustand e4 nutzt ein Konto und 2 wartende Einträge', () => {
    const { zustand } = leseStub('helfer-join/e4') as { zustand: { ausgang?: number; konto?: { id: string } } }
    expect(zustand.ausgang).toBe(2)
    expect(zustand.konto?.id).toBeTruthy()
  })

  it('ausgang ohne Konto ist ein Fehler der Stub-Datei', async () => {
    const ctx = { addInitScript: async () => undefined, route: async () => undefined }
    await expect(installiereStub(ctx, { name: 'test/ohne-konto', zustand: { ausgang: 2 } })).rejects.toThrow('braucht "konto"')
  })
})
