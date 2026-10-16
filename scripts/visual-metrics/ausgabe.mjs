// Gebuendelte Befundliste (Review B-13): ein Eintrag je (Typ, Metrik, Element) mit der Liste der Profile,
// Themen, Sprachen und Varianten, in denen er auftrat. Das Feld `schluessel` enthaelt kein :nth-of-type,
// damit STUCK (derselbe Befund in 3 Runden) auch nach DOM-Korrekturen greift.

export const stabil = (sel) => String(sel).replace(/:nth-of-type\(\d+\)/g, '')

export function buendle(laeufe) {
  const gruppen = new Map()
  for (const l of laeufe) {
    for (const b of l.befunde) {
      const schluessel = `${b.metrik}|${stabil(b.selektor)}`
      const id = `${b.typ}|${b.metrik}|${b.selektor}`
      let g = gruppen.get(id)
      if (!g) {
        g = { typ: b.typ, metrik: b.metrik, selektor: b.selektor, schluessel, ist: b.ist, grenze: b.grenze, text: b.text, anzahl: 0, profile: new Set(), themen: new Set(), sprachen: new Set(), varianten: new Set(), beispiele: new Set() }
        gruppen.set(id, g)
      }
      g.anzahl++
      g.profile.add(l.profil)
      g.themen.add(l.thema)
      g.sprachen.add(l.sprache)
      g.varianten.add(l.variante)
      if (g.beispiele.size < 3) g.beispiele.add(b.ist)
    }
  }
  const liste = [...gruppen.values()].map((g) => ({
    ...g,
    profile: [...g.profile], themen: [...g.themen], sprachen: [...g.sprachen], varianten: [...g.varianten], beispiele: [...g.beispiele],
  }))
  const rang = (g) => (g.typ === 'HART' ? 0 : 1)
  liste.sort((a, b) => rang(a) - rang(b) || b.anzahl - a.anzahl || a.metrik.localeCompare(b.metrik))
  return liste
}

export function textBericht(bericht, { ausfuehrlich = false } = {}) {
  const z = []
  const kopf = [bericht.status, bericht.vollmatrix ? 'VOLLMATRIX' : 'TEILMATRIX', bericht.modus].join(' · ')
  z.push(`Visuelle Messung: ${kopf} · Ziel ${bericht.ziel}`)
  z.push(`Bericht: ${bericht.berichtPfad}`)
  if (bericht.modus === 'MOCKUP') z.push('Hinweis: Mockup-Modus – belegt nicht den Stand der App.')
  if (bericht.abweichungen.length) z.push(`Abweichungen (mit Begruendung "${bericht.begruendung}"): ${bericht.abweichungen.join('; ')}`)
  if (bericht.matrix.ergaenzt.length) z.push(`Monitor-Profile paarweise ergaenzt: ${bericht.matrix.ergaenzt.join(', ')}`)
  if (bericht.status === 'BLOCKED') {
    z.push(`GATE rot${bericht.gate.profil ? ` (${bericht.gate.profil})` : ''}:`, ...bericht.gate.gruende.map((g) => `  - ${g}`))
    return z.join('\n')
  }
  if (bericht.gate.warnungen?.length) z.push(...bericht.gate.warnungen.map((w) => `Gate-Hinweis: ${w}`))
  const hart = bericht.gebuendelt.filter((g) => g.typ === 'HART')
  const warn = bericht.gebuendelt.filter((g) => g.typ !== 'HART')
  z.push(`HART ${hart.length} Befunde (${bericht.zusammenfassung.hart} Zeilen) · WARNUNG ${warn.length} (${bericht.zusammenfassung.warnung}) · Laeufe ${bericht.laeufe.length}`)
  const m = bericht.markierungen
  z.push(`Markierungen (hoechster Wert je Lauf): data-primary ${m.primaer} · data-teamname ${m.teamname} · data-monitor ${m.monitor} · Titel ${m.titel} · Ausnahme-Attribute ${bericht.ausnahmen.length}`)
  for (const a of bericht.ausnahmen) z.push(`  Ausnahme ${a.attr} an ${a.selektor}${a.begruendung ? `: ${a.begruendung}` : ' (ohne Begruendung)'}`)
  const zeile = (g) => {
    const wo = [g.profile.join(','), g.themen.join('/'), g.sprachen.join('/'), g.varianten.join('/')].join(' · ')
    return `${g.typ === 'HART' ? 'HART   ' : 'WARNUNG'} ${g.metrik} · ${g.selektor} · ${g.beispiele.join(' | ')} (Grenze ${g.grenze})${g.text ? ` · "${g.text}"` : ''} · ${wo} · x${g.anzahl}`
  }
  if (hart.length) z.push('', '— HART —', ...hart.map(zeile))
  if (warn.length) z.push('', '— WARNUNG —', ...warn.map(zeile))
  if (ausfuehrlich) {
    z.push('', '— Einzelzeilen —')
    for (const l of bericht.laeufe) for (const b of l.befunde) z.push(`${b.metrik} | ${b.typ} | ${l.profil}/${l.thema}/${l.sprache}/${l.variante} | ${b.selektor} | ${b.ist} | ${b.grenze}`)
  }
  return z.join('\n')
}
