// Messung im Browser. Die exportierten Funktionen werden per page.evaluate in die Seite gegeben und muessen
// deshalb in sich geschlossen sein (keine Importe, keine Variablen von aussen).
//
// messeSeite(opt), opt = {
//   art: 'handy'|'tablet'|'desktop'|'monitor'|'reflow',
//   g: { '<grenzwert-id>': zahl|string },   // nur die fuer diese Art geltenden Grenzwerte
//   randPx: number,                          // Rand, den die Seite selbst freihalten soll (Profil)
//   monitorSchrift: { stand, lesetext, nah } // Anteil Bildhoehe (Sehwinkel)
//   primarySelektor, ausfuehrlich, extraInhalte: [{ left, top, right, bottom, art, selektor }]
// }
// Rueckgabe: { befunde, zaehler, info, markierungen, ausnahmen }

export function messeSeite(opt) {
  const g = opt.g
  const hat = (id) => Object.prototype.hasOwnProperty.call(g, id)
  const W = window.innerWidth
  const H = window.innerHeight
  const befunde = []
  const zaehler = {}
  const kurz = (t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  const r1 = (n) => Math.round(n * 10) / 10
  const melde = (metrik, el, ist, grenze, extra) => {
    zaehler[metrik] = (zaehler[metrik] || 0) + 1
    befunde.push({ metrik, selektor: el ? selektor(el) : 'document', ist, grenze, text: el ? kurz(el.textContent) : '', ...(extra || {}) })
  }

  function selektor(el) {
    if (!(el instanceof Element)) return '?'
    if (el.id) return `#${el.id}`
    const tid = el.getAttribute('data-testid')
    if (tid) return `[data-testid="${tid}"]`
    const teile = []
    let e = el
    for (let i = 0; e && e.nodeType === 1 && i < 4; i++) {
      if (e.id) { teile.unshift(`#${e.id}`); break }
      const t = e.getAttribute('data-testid')
      if (t) { teile.unshift(`[data-testid="${t}"]`); break }
      let s = e.tagName.toLowerCase()
      const kl = [...e.classList].filter((k) => !/^\d/.test(k)).slice(0, 2).join('.')
      if (kl) s += `.${kl}`
      const p = e.parentElement
      if (p) {
        const gleich = [...p.children].filter((c) => c.tagName === e.tagName)
        if (gleich.length > 1) s += `:nth-of-type(${gleich.indexOf(e) + 1})`
      }
      teile.unshift(s)
      e = p
    }
    return teile.join(' > ')
  }

  const stil = (el, pseudo) => getComputedStyle(el, pseudo)
  function sichtbar(el) {
    const s = stil(el)
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false
    const r = el.getBoundingClientRect()
    if (r.width <= 1 || r.height <= 1) return false
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const se = stil(e)
      if (se.clip && se.clip !== 'auto') return false
      if (se.clipPath && se.clipPath !== 'none' && se.clipPath.includes('inset(50%')) return false
      if (se.display === 'none' || parseFloat(se.opacity) === 0) return false
      // C-VM-DISPLAY-CONTENTS: ein Huellelement mit display:contents hat keine eigene Box (0x0), seine Kinder sehr wohl.
      if (se.display === 'contents') continue
      const re = e.getBoundingClientRect()
      if (re.width <= 1 || re.height <= 1) return false
    }
    return true
  }
  const ausnahme = (el, attr) => !!el.closest(`[${attr}]`)

  // ---------- Schicht: offener modaler Dialog → nur diese Schicht messen (Review B-05) ----------
  const modale = [...document.querySelectorAll('[aria-modal="true"], dialog')].filter((d) => {
    if (d.tagName === 'DIALOG' && !(d.open && d.matches(':modal'))) return false
    return sichtbar(d)
  })
  const schicht = modale.length ? modale[modale.length - 1] : document.body
  const inSchicht = (el) => schicht.contains(el)

  // ---------- Texttraeger ----------
  const traeger = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const gesehen = new Set()
  for (let n; (n = walker.nextNode()); ) {
    if (!n.textContent || !n.textContent.trim()) continue
    const el = n.parentElement
    if (!el || gesehen.has(el)) continue
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION'].includes(el.tagName)) continue
    gesehen.add(el)
    if (!inSchicht(el) || !sichtbar(el)) continue
    const rects = []
    // Range-Rechtecke umfassen den Inhaltsbereich der Schrift; ist er hoeher als die Zeilenhoehe,
    // wird er auf die Zeilenbox gekuerzt (sonst melden enge Zeilenhoehen Scheinbefunde).
    const lh = parseFloat(stil(el).lineHeight)
    let eigenerText = ''
    for (const k of el.childNodes) {
      if (k.nodeType !== 3 || !k.textContent.trim()) continue
      eigenerText += k.textContent
      const rg = document.createRange()
      rg.selectNodeContents(k)
      for (const r of rg.getClientRects()) {
        if (r.width <= 0.5 || r.height <= 0.5) continue
        const kuerzen = Number.isFinite(lh) && r.height > lh ? (r.height - lh) / 2 : 0
        rects.push({ left: r.left, right: r.right, width: r.width, top: r.top + kuerzen, bottom: r.bottom - kuerzen, height: r.height - 2 * kuerzen })
      }
    }
    // Nur Piktogramme (Emoji) oder nur Satz-/Trennzeichen (z. B. "•"): kein Textkontrast (Zierde, B-15).
    if (rects.length) traeger.push({ el, rects, piktogramm: !/[\p{L}\p{N}]/u.test(eigenerText) })
  }
  const vereinige = (rects) => {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
    for (const x of rects) { l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom) }
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t }
  }

  // ---------- Bedienelemente, Bilder ----------
  const BEDIEN = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=radio], [role=switch], [role=menuitem], [tabindex]:not([tabindex="-1"])'
  const bedien = [...document.querySelectorAll(BEDIEN)].filter((el) => inSchicht(el) && sichtbar(el))
  const bilder = [...document.querySelectorAll('svg, img, canvas, video, [role=img]')]
    .filter((el) => !(el.tagName.toLowerCase() !== 'svg' && el.closest('svg')) && !(el.parentElement && el.parentElement.closest('svg')))
    .filter((el) => inSchicht(el) && sichtbar(el))

  // ---------- Markierungen und Ausnahmen sichtbar zaehlen (Review B-07) ----------
  const primaer = new Set(opt.primarySelektor ? [...document.querySelectorAll(opt.primarySelektor)].filter((el) => inSchicht(el) && sichtbar(el)) : [])
  const markierungen = {
    primaer: primaer.size,
    teamname: document.querySelectorAll('[data-teamname]').length,
    monitor: document.querySelectorAll('[data-monitor]').length,
    titel: document.querySelectorAll('h1, [data-title]').length,
  }
  const ausnahmen = []
  for (const attr of ['data-overflow-ok', 'data-truncate-ok', 'data-overlap-ok', 'data-touch-ok', 'data-overscan-ok']) {
    for (const el of document.querySelectorAll(`[${attr}]`)) ausnahmen.push({ attr, selektor: selektor(el), begruendung: el.getAttribute(attr) || '' })
  }
  if (hat('ausnahme.attribut')) for (const a of ausnahmen) melde('ausnahme.attribut', null, `${a.attr}${a.begruendung ? ` (${a.begruendung})` : ' ohne Begruendung'}`, 'nur mit Begruendung', { selektor: a.selektor })
  if (hat('markierung.primaer') && primaer.size === 0) melde('markierung.primaer', null, '0 Haupttasten markiert', 'data-primary an der Haupttaste')
  if (hat('markierung.monitor') && markierungen.monitor === 0) melde('markierung.monitor', null, '0 data-monitor', 'Stand/Uhr/nah markiert')

  // ---------- M1 Ueberlauf ----------
  if (hat('ueberlauf.dokument')) {
    const sw = document.documentElement.scrollWidth
    if (sw > W + g['ueberlauf.dokument']) melde('ueberlauf.dokument', null, `scrollWidth ${sw} px`, `<= ${W} px`)
  }
  const inScroller = (el) => {
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const ox = stil(e).overflowX
      if (ox === 'auto' || ox === 'scroll') return true
    }
    return false
  }
  if (hat('ueberlauf.element')) {
    const tol = g['ueberlauf.element']
    const kandidaten = []
    for (const el of schicht.querySelectorAll('*')) {
      const s = stil(el)
      if (s.display === 'inline' || s.display === 'contents' || s.position === 'fixed') continue
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue
      if (ausnahme(el, 'data-overflow-ok') || inScroller(el) || !sichtbar(el)) continue
      const r = el.getBoundingClientRect()
      if (r.right > W + tol || r.left < -tol) kandidaten.push({ el, ist: `links ${r1(r.left)} / rechts ${r1(r.right)} px`, grenze: `0..${W} px` })
      else if (s.overflowX === 'visible' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + tol) kandidaten.push({ el, ist: `Inhalt ${el.scrollWidth} px breit`, grenze: `<= ${el.clientWidth} px` })
    }
    // Nur das tiefste Element melden; die Vorfahren-Kette (#root, #root > div …) nur auf Wunsch (B-13).
    const melden = opt.ausfuehrlich ? kandidaten : kandidaten.filter((k) => !kandidaten.some((a) => a !== k && k.el.contains(a.el)))
    for (const k of melden) melde('ueberlauf.element', k.el, k.ist, k.grenze)
  }

  // ---------- M2 Abgeschnitten ----------
  if (hat('text.abgeschnitten')) {
    const tol = g['text.abgeschnitten']
    for (const { el, rects } of traeger) {
      if (ausnahme(el, 'data-truncate-ok')) continue
      const u = vereinige(rects)
      const s = stil(el)
      let grund = null
      if ((s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none') &&
          (el.scrollWidth > el.clientWidth + tol || el.scrollHeight > el.clientHeight + tol)) {
        grund = `gekuerzt (${s.textOverflow === 'ellipsis' ? 'Ellipse' : 'line-clamp'})`
      }
      if (!grund && (u.top < -tol || u.left < -tol)) grund = `ausserhalb Fenster (oben ${r1(u.top)}, links ${r1(u.left)})`
      if (!grund) {
        // Liegt zwischen Text und clippendem Vorfahren ein Scroll-Container, ist der Text erreichbar (kein Befund).
        let scrollX = false, scrollY = false
        for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
          const sa = stil(a)
          const clipX = !scrollX && (sa.overflowX === 'hidden' || sa.overflowX === 'clip')
          const clipY = !scrollY && (sa.overflowY === 'hidden' || sa.overflowY === 'clip')
          if (a !== el && /(auto|scroll)/.test(sa.overflowX)) scrollX = true
          if (a !== el && /(auto|scroll)/.test(sa.overflowY)) scrollY = true
          if (!clipX && !clipY) continue
          const ra = a.getBoundingClientRect()
          const bl = parseFloat(sa.borderLeftWidth) || 0
          const bt = parseFloat(sa.borderTopWidth) || 0
          const innen = { left: ra.left + bl, top: ra.top + bt, right: ra.left + bl + a.clientWidth, bottom: ra.top + bt + a.clientHeight }
          if (clipX && (u.left < innen.left - tol || u.right > innen.right + tol)) { grund = `seitlich abgeschnitten von ${selektor(a)}`; break }
          if (clipY && (u.top < innen.top - tol || u.bottom > innen.bottom + tol)) { grund = `oben/unten abgeschnitten von ${selektor(a)}`; break }
        }
      }
      if (grund) melde('text.abgeschnitten', el, grund, 'vollstaendig sichtbar')
    }
  }

  // ---------- M3 Ueberlappung (Text, Bedienelemente, SVG/Bilder) ----------
  if (hat('ueberlappung.text')) {
    const min = g['ueberlappung.text']
    const items = []
    // Text zaehlt nur mit dem Teil, den seine Vorfahren zeigen: abgeschnitten (Ellipse, overflow:hidden) ist schon
    // Befund text.abgeschnitten, in Scroll-Containern verborgen ist erreichbar (keine Doppel- und Scheinmeldung).
    const sichtbarerTeil = (el, rects) => {
      let out = rects
      for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
        const sa = stil(a)
        if (!/(hidden|clip|auto|scroll)/.test(sa.overflowX + sa.overflowY)) continue
        const ra = a.getBoundingClientRect()
        out = out.map((r) => {
          const left = /(hidden|clip|auto|scroll)/.test(sa.overflowX) ? Math.max(r.left, ra.left) : r.left
          const right = /(hidden|clip|auto|scroll)/.test(sa.overflowX) ? Math.min(r.right, ra.right) : r.right
          const top = /(hidden|clip|auto|scroll)/.test(sa.overflowY) ? Math.max(r.top, ra.top) : r.top
          const bottom = /(hidden|clip|auto|scroll)/.test(sa.overflowY) ? Math.min(r.bottom, ra.bottom) : r.bottom
          return { left, right, top, bottom, width: right - left, height: bottom - top }
        }).filter((r) => r.width > 0 && r.height > 0)
      }
      return out
    }
    for (const t of traeger) if (!ausnahme(t.el, 'data-overlap-ok')) items.push({ el: t.el, rects: sichtbarerTeil(t.el, t.rects), text: true })
    for (const b of bedien) if (!ausnahme(b, 'data-overlap-ok')) items.push({ el: b, rects: [b.getBoundingClientRect()], text: false })
    for (const b of bilder) if (!ausnahme(b, 'data-overlap-ok')) items.push({ el: b, rects: [b.getBoundingClientRect()], text: false })
    // Feste/klebende Leisten ueber scrollbarem Inhalt sind kein Ueberlappungsbefund (Inhalt laesst sich
    // darunter hervorscrollen); verdeckte Leisten-Inhalte prueft Regel P4 (nicht gemessen, Sichtkritik).
    const fest = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const p = stil(e).position; if (p === 'fixed' || p === 'sticky') return e } return null }
    for (const it of items) it.fest = fest(it.el)
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const A = items[i], B = items[j]
        if (!A.text && !B.text) continue // Bild ueber Taste o. ae. ist kein Lesebefund
        if (A.fest !== B.fest && (A.fest === null || B.fest === null)) continue
        if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue
        let treffer = null
        for (const a of A.rects) {
          for (const b of B.rects) {
            const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
            const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
            if (w > min && h > min) { treffer = `${r1(w)}x${r1(h)} px`; break }
          }
          if (treffer) break
        }
        if (treffer) {
          const T = A.text ? A : B, O = A.text ? B : A
          melde('ueberlappung.text', T.el, `schneidet ${selektor(O.el)} (${treffer})`, '0 Schnittflaeche', { mit: kurz(O.el.textContent) || O.el.tagName.toLowerCase() })
        }
      }
    }
  }

  // ---------- M9 Umbruch: Zeilen, Wortbruch, hyphens (Review B-08) ----------
  const zeilenTops = (rects) => {
    const tops = []
    for (const r of rects) if (!tops.some((t) => Math.abs(t - r.top) < Math.max(2, r.height / 2))) tops.push(r.top)
    return tops.length
  }
  const TITEL = 'h1, [data-title]'
  const KEIN_BRUCH = 'h1, h2, h3, h4, [data-title], [role=heading], header *, button, [role=tab], [role=button], [data-teamname]'
  const FLIESSTEXT = 'p, li, dd, blockquote, [data-fliesstext]'
  if (hat('titel.zeilen')) {
    for (const el of schicht.querySelectorAll(TITEL)) {
      if (!sichtbar(el)) continue
      const rg = document.createRange()
      rg.selectNodeContents(el)
      const z = zeilenTops([...rg.getClientRects()].filter((r) => r.width > 0.5))
      if (z > g['titel.zeilen']) melde('titel.zeilen', el, `${z} Zeilen`, `<= ${g['titel.zeilen']}`)
    }
  }
  if (hat('text.hyphens')) {
    for (const { el } of traeger) {
      const s = stil(el)
      if ((s.hyphens || s.webkitHyphens) === 'auto' && !el.closest(FLIESSTEXT)) melde('text.hyphens', el, 'hyphens: auto ausserhalb Fliesstext', 'manual oder none')
    }
  }
  if (hat('dialogfuss.taste-zeilen')) {
    // Tasten im Dialog-Fuss (Baustein DialogActions, Markierung data-dialog-actions): hoechstens eine Zeile je Beschriftung
    for (const el of schicht.querySelectorAll('[data-dialog-actions] button, [data-dialog-actions] a, [data-dialog-actions] [role=button]')) {
      if (!sichtbar(el)) continue
      const rg = document.createRange()
      rg.selectNodeContents(el)
      const z = zeilenTops([...rg.getClientRects()].filter((r) => r.width > 0.5))
      if (z > g['dialogfuss.taste-zeilen']) melde('dialogfuss.taste-zeilen', el, `${z} Zeilen`, `<= ${g['dialogfuss.taste-zeilen']} Zeile`)
    }
  }
  if (hat('titel.wortbruch')) {
    const gepr = new Set()
    for (const el of schicht.querySelectorAll(KEIN_BRUCH)) {
      if (!sichtbar(el)) continue
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      // Woerter ueber mehrere Textknoten (Wort in zwei <span>) werden zusammen geprueft.
      const knoten = []
      for (let n; (n = w.nextNode()); ) if (!gepr.has(n)) { gepr.add(n); knoten.push(n) }
      let wort = []
      const pruefe = () => {
        if (!wort.length) return
        const rects = []
        let txt = ''
        for (const [n, a, b] of wort) {
          const rg = document.createRange()
          rg.setStart(n, a)
          rg.setEnd(n, b)
          txt += n.textContent.slice(a, b)
          for (const r of rg.getClientRects()) if (r.width > 0.5) rects.push(r)
        }
        const z = zeilenTops(rects)
        if (z > 1) melde('titel.wortbruch', el, `Wort "${txt.replace(/­/g, '')}" auf ${z} Zeilen`, 'Wort auf einer Zeile')
        wort = []
      }
      const blockVon = (n) => {
        let e = n.parentElement
        while (e && e !== el && /^(inline|contents)$/.test(stil(e).display)) e = e.parentElement
        return e
      }
      let letzterBlock = null
      for (const n of knoten) {
        const b = blockVon(n)
        if (b !== letzterBlock) pruefe()
        letzterBlock = b
        const t = n.textContent
        let i = 0
        while (i < t.length) {
          if (/\s/.test(t[i])) { pruefe(); i++; continue }
          let j = i
          while (j < t.length && !/\s/.test(t[j])) j++
          wort.push([n, i, j])
          if (j < t.length) pruefe()
          i = j
        }
      }
      pruefe()
    }
  }

  // ---------- M4 Kontrast (Verlauf: schlechteste Endfarbe; Piktogramme ausgenommen, B-15) ----------
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const cx = cv.getContext('2d', { willReadFrequently: true })
  const farbe = (str) => {
    cx.clearRect(0, 0, 1, 1)
    // Unbekannte Farbangaben ergeben transparent (statt die vorige Farbe zu behalten).
    cx.fillStyle = CSS.supports('color', str) ? str : 'rgba(0,0,0,0)'
    cx.fillRect(0, 0, 1, 1)
    const d = cx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2], d[3] / 255]
  }
  const lum = ([r, gg, b]) => {
    const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b)
  }
  const mische = (oben, unten) => {
    const a = oben[3]
    return [oben[0] * a + unten[0] * (1 - a), oben[1] * a + unten[1] * (1 - a), oben[2] * a + unten[2] * (1 - a), 1]
  }
  // Liefert alle moeglichen Hintergruende (bei Verlauf je Farbstopp einen) oder null (Bild, unbestimmt).
  function hintergruende(el) {
    const schichten = []
    for (let e = el; e; e = e.parentElement) {
      const s = stil(e)
      const c = farbe(s.backgroundColor)
      const bi = s.backgroundImage
      if (bi && bi !== 'none') {
        if (/url\(/.test(bi) || !/gradient/.test(bi)) return null
        const stopps = (bi.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b|\b(?:white|black|transparent)\b/gi) || []).map(farbe)
        if (!stopps.length) return null
        schichten.push({ verlauf: stopps, farbe: c })
        if (stopps.every((x) => x[3] >= 0.999)) break
        continue
      }
      if (c[3] > 0) schichten.push({ farbe: c })
      if (c[3] >= 0.999) break
    }
    const unten = schichten[schichten.length - 1]
    const deckend = unten && ((unten.verlauf && unten.verlauf.every((x) => x[3] >= 0.999)) || (!unten.verlauf && unten.farbe[3] >= 0.999))
    if (!deckend && matchMedia('(prefers-color-scheme: dark)').matches) return null
    let basen = [[255, 255, 255, 1]]
    for (let i = schichten.length - 1; i >= 0; i--) {
      const sc = schichten[i]
      const neu = []
      for (const b of basen) {
        const mitFarbe = sc.farbe[3] > 0 ? mische(sc.farbe, b) : b
        if (sc.verlauf) for (const v of sc.verlauf) neu.push(mische(v, mitFarbe))
        else neu.push(mitFarbe)
      }
      basen = neu.slice(0, 16)
    }
    return basen
  }
  if (hat('kontrast.text')) {
    for (const { el, piktogramm } of traeger) {
      if (piktogramm) continue
      const s = stil(el)
      // Verlaufstext (background-clip: text) ist mit Farbwerten nicht messbar: Sichtkritik.
      let clipText = false
      for (let e = el; e && !clipText; e = e.parentElement) {
        const se = stil(e)
        clipText = se.backgroundClip === 'text' || se.webkitBackgroundClip === 'text'
      }
      if (clipText) {
        if (hat('kontrast.unsicher')) melde('kontrast.unsicher', el, 'Verlaufstext (background-clip: text)', 'Sichtkritik')
        continue
      }
      const bgs = hintergruende(el)
      if (!bgs) {
        if (hat('kontrast.unsicher')) melde('kontrast.unsicher', el, 'Hintergrund Bild oder unbestimmt', 'Sichtkritik')
        continue
      }
      let k = Infinity
      for (const bg of bgs) {
        const fg = mische(farbe(s.color), bg)
        const l1 = lum(fg), l2 = lum(bg)
        k = Math.min(k, (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))
      }
      const px = parseFloat(s.fontSize)
      const gross = px >= 24 || (px >= 18.66 && parseInt(s.fontWeight, 10) >= 700)
      const soll = gross ? g['kontrast.text-gross'] : g['kontrast.text']
      const ist = `${(Math.floor(k * 100) / 100).toFixed(2)}:1${bgs.length > 1 ? ' (schlechteste Verlaufsfarbe)' : ''}`
      if (k < soll) melde(gross ? 'kontrast.text-gross' : 'kontrast.text', el, ist, `>= ${soll}:1`)
      else if (hat('kontrast.monitor') && k < g['kontrast.monitor']) melde('kontrast.monitor', el, ist, `>= ${g['kontrast.monitor']}:1`)
    }
  }

  // ---------- M5 Touch-Ziele, Haupttaste ----------
  const imFliesstext = (el) => {
    if (el.tagName !== 'A' || stil(el).display !== 'inline') return false
    const p = el.parentElement
    return !!p && kurz(p.textContent).length > kurz(el.textContent).length + 3
  }
  const zielBox = (el) => {
    let r = el.getBoundingClientRect()
    if (el.tagName === 'INPUT' && /^(checkbox|radio)$/i.test(el.type)) {
      const lab = el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`))
      if (lab) {
        const rl = lab.getBoundingClientRect()
        if (rl.width * rl.height > r.width * r.height) r = rl
      }
    }
    return r
  }
  if (hat('touch.min')) {
    for (const el of bedien) {
      if (ausnahme(el, 'data-touch-ok') || imFliesstext(el)) continue
      if (el.parentElement && el.parentElement.closest(BEDIEN) && !primaer.has(el)) continue
      const r = zielBox(el)
      if (r.width < g['touch.min'] || r.height < g['touch.min']) melde('touch.min', el, `${r1(r.width)}x${r1(r.height)} px`, `>= ${g['touch.min']}x${g['touch.min']} px`)
    }
  }
  if (hat('touch.primaer')) {
    for (const el of primaer) {
      const r = el.getBoundingClientRect()
      if (r.width < g['touch.primaer'] || r.height < g['touch.primaer']) melde('touch.primaer', el, `${r1(r.width)}x${r1(r.height)} px`, `>= ${g['touch.primaer']} px`)
    }
  }
  if (hat('primaer.sichtbar')) {
    for (const el of primaer) {
      const r = el.getBoundingClientRect()
      if (r.top < 0 || r.left < 0 || r.bottom > H + g['primaer.sichtbar'] || r.right > W) melde('primaer.sichtbar', el, `oben ${r1(r.top)} / unten ${r1(r.bottom)} px`, `im Fenster 0..${H} px ohne Scrollen`)
    }
  }

  // ---------- M6 Mindestschrift ----------
  if (hat('schrift.eingabe')) {
    for (const el of schicht.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')) {
      if (!sichtbar(el)) continue
      const px = parseFloat(stil(el).fontSize)
      if (px < g['schrift.eingabe']) melde('schrift.eingabe', el, `${px} px`, `>= ${g['schrift.eingabe']} px`)
    }
  }
  if (hat('schrift.min')) {
    for (const { el } of traeger) {
      const px = parseFloat(stil(el).fontSize)
      if (px < g['schrift.min']) melde('schrift.min', el, `${px} px`, `>= ${g['schrift.min']} px`)
      else if (hat('schrift.min-ziel') && px < g['schrift.min-ziel']) melde('schrift.min-ziel', el, `${px} px`, `>= ${g['schrift.min-ziel']} px`)
    }
  }
  if (opt.monitorSchrift) {
    for (const { el } of traeger) {
      const px = parseFloat(stil(el).fontSize)
      if (hat('monitor.schrift.record') && px / H + 1e-6 < g['monitor.schrift.record']) {
        melde('monitor.schrift.record', el, `${px} px (${r1((px / H) * 100)} % Bildhoehe)`, `>= ${r1(g['monitor.schrift.record'] * 100)} % (Record @ZM-125)`)
      }
      const stufeEl = el.closest('[data-monitor]')
      const stufe = stufeEl ? stufeEl.getAttribute('data-monitor') : ''
      const key = stufe === 'stand' || stufe === 'uhr' ? 'stand' : stufe === 'nah' ? 'nah' : 'lesetext'
      const id = `monitor.schrift.${key}`
      if (!hat(id)) continue
      const soll = opt.monitorSchrift[key] * H
      if (px + 0.01 < soll) melde(id, el, `${px} px (${r1((px / H) * 100)} % Bildhoehe)`, `>= ${Math.ceil(soll)} px (${r1(opt.monitorSchrift[key] * 100)} %)`)
    }
  }

  // ---------- Cockpit-Ziffern (@SL-178): Ziffernhoehe >= 11 mm, in Bildpunkten je Profilbreite ----------
  // Gemessen wird die gerenderte Ziffer (Canvas-Metrik der berechneten Schrift), nie font-size * Annahme. Schrift nicht geladen = Befund
  // (kein Messen mit Ersatzschrift); transform:scale der Vorfahren wird einbezogen.
  if (hat('cockpit.ziffern') && opt.ziffern) {
    const soll = opt.ziffern.mm * opt.ziffern.pxProMm
    const leinwand = document.createElement('canvas').getContext('2d')
    for (const el of document.querySelectorAll('[data-ziffern]')) {
      if (!sichtbar(el)) continue
      const s = stil(el)
      const schrift = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
      if (!document.fonts.check(schrift, '0')) {
        melde('cockpit.ziffern', el, 'Schrift nicht geladen', 'geladene Schrift', { schrift: s.fontFamily })
        continue
      }
      leinwand.font = schrift
      const m = leinwand.measureText('0')
      let skala = 1
      if (el.offsetWidth > 0) skala = el.getBoundingClientRect().width / el.offsetWidth
      const px = m.actualBoundingBoxAscent * skala
      if (px + 0.01 < soll) {
        melde('cockpit.ziffern', el, `${r1(px)} px (${r1(px / opt.ziffern.pxProMm)} mm bei ${opt.ziffern.pxProMm} px/mm)`, `>= ${Math.ceil(soll)} px (${opt.ziffern.mm} mm)`)
      }
    }
  }

  // ---------- M7 Overscan (Text, Bilder, Hintergrundbilder, Pseudo-Elemente; B-08) ----------
  if (hat('overscan.app-rand') || hat('overscan.ebu-grafik')) {
    const inhalte = traeger.map((t) => ({ el: t.el, r: vereinige(t.rects) }))
    for (const el of bilder) inhalte.push({ el, r: el.getBoundingClientRect() })
    for (const el of bedien) inhalte.push({ el, r: el.getBoundingClientRect() })
    for (const el of schicht.querySelectorAll('*')) {
      const bi = stil(el).backgroundImage
      if (!bi || bi === 'none' || !sichtbar(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width * r.height >= 0.9 * W * H) continue // vollflaechiger Hintergrund darf bis an den Rand
      inhalte.push({ el, r })
    }
    // Pseudo-Elemente (::before/::after) kommen per CDP als Rechteck mit Markierung am Elternelement.
    const extra = []
    for (const x of opt.extraInhalte || []) {
      const el = document.querySelector(`[data-vm-pseudo-${x.art}="${x.vmPseudo}"]`)
      if (!el || !inSchicht(el) || !sichtbar(el)) continue
      const ps = stil(el, `::${x.art}`)
      const mitText = /^["'].*[\p{L}\p{N}]/u.test(ps.content || '')
      const mitBild = ps.backgroundImage && ps.backgroundImage !== 'none'
      if (!mitText && !mitBild) continue
      if (ausnahme(el, 'data-overscan-ok')) continue
      extra.push({ el: null, r: x, sel: `${selektor(el)}::${x.art}`, art: `::${x.art}` })
    }
    const pruefe = (id, rx, ry) => {
      for (const { el, r, sel, art } of [...inhalte, ...extra]) {
        if (el && ausnahme(el, 'data-overscan-ok')) continue
        if (r.width * r.height >= 0.9 * W * H) continue
        if (r.left < rx - 1 || r.top < ry - 1 || r.right > W - rx + 1 || r.bottom > H - ry + 1) {
          const ist = `${art ? `${art} ` : ''}Box ${r1(r.left)},${r1(r.top)} bis ${r1(r.right)},${r1(r.bottom)}`
          if (el) melde(id, el, ist, `innerhalb ${rx}/${ry} px Rand (${W}x${H})`)
          else melde(id, null, ist, `innerhalb ${rx}/${ry} px Rand (${W}x${H})`, { selektor: sel })
        }
      }
    }
    if (hat('overscan.app-rand')) pruefe('overscan.app-rand', opt.randPx, opt.randPx)
    if (hat('overscan.ebu-grafik') && opt.ebuPruefen) pruefe('overscan.ebu-grafik', Math.round(W * g['overscan.ebu-grafik']), Math.round(H * g['overscan.ebu-grafik']))
  }
  if (hat('monitor.bedienelemente') && bedien.length > 0) melde('monitor.bedienelemente', bedien[0], `${bedien.length} fokussierbare Elemente`, '0')

  // ---------- M10 Verdeckte Bedienelemente (@TA-012) ----------
  // Die Ansicht wird von oben bis ganz unten in Schritten gescrollt (Fenster, dazu jeder sichtbare Rollbereich).
  // Bei jedem Schritt prueft document.elementFromPoint die Mitte jedes Bedienelements, das mit seiner Mitte im Fenster
  // und in allen Rollbereichen/Beschnitten seiner Vorfahren liegt. Liefert es weder das Element, eines seiner Kinder
  // noch das zugehoerige Label, ist es in diesem Schritt verdeckt. Verstoss ist ein Element, das in keinem Schritt
  // frei war (was nur unter einer Leiste hindurchrollt oder ueber den Rand ragt und beim Scrollen frei wird, zaehlt nicht).
  // Ausnahme: liegt ein offener Dialog (aria-modal, role=dialog/alertdialog, <dialog open>) darueber, der das Element
  // nicht enthaelt, ist das Verdecken gewollt.
  // Warnregel verdeckt.schwebend: war das Element in mindestens einem Schritt von einem schwebenden Element (position fixed/sticky,
  // Leiste oder Hinweis) verdeckt, wurde aber in einem anderen frei, ist das eine WARNUNG (erreichbar, beim Hineinscrollen verdeckt).
  // Feste Navigation (nav, role=navigation) zaehlt dafuer nicht als Verdecker; bleibt ein Element ganz unten unter ihr verdeckt,
  // meldet verdeckt.bedienelement es als HART.
  if (hat('verdeckt.bedienelement') || hat('verdeckt.schwebend')) {
    const VBEDIEN = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [tabindex]'
    const kandidaten = [...document.querySelectorAll(VBEDIEN)].filter((el) => {
      if (el.hasAttribute('tabindex') && !el.matches('button, a[href], input, select, textarea, [role=button]') && Number(el.getAttribute('tabindex')) < 0) return false
      if (stil(el).pointerEvents === 'none') return false
      return sichtbar(el)
    })
    const MODAL = '[aria-modal="true"], [role=dialog], [role=alertdialog], dialog[open]'
    // Ein Dialog zaehlt, sobald er im Dokument steht und nicht verborgen ist (auch waehrend er einblendet: Deckkraft 0 ist kein Grund,
    // den Hintergrund zu melden).
    const modale2 = () => [...document.querySelectorAll(MODAL)].filter((d) => { const sd = stil(d); return sd.display !== 'none' && sd.visibility !== 'hidden' })
    const mitte = (el) => {
      const rs = [...el.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
      const r = stil(el).display === 'inline' && rs.length ? rs[0] : el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    // Liegt der Punkt im Fenster und in jedem beschneidenden Vorfahren (overflow ausser visible)? Fixierte Elemente
    // entkommen den Beschnitten ihrer Vorfahren.
    const imSichtbaren = (el, p) => {
      if (p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return false
      let fest = stil(el).position === 'fixed'
      for (let a = el.parentElement; a && a !== document.documentElement && !fest; a = a.parentElement) {
        const sa = stil(a)
        if (sa.position === 'fixed') fest = true
        if (sa.overflowX === 'visible' && sa.overflowY === 'visible') continue
        if (a === document.body) continue
        const ra = a.getBoundingClientRect()
        const bl = parseFloat(sa.borderLeftWidth) || 0
        const bt = parseFloat(sa.borderTopWidth) || 0
        const innen = { left: ra.left + bl, top: ra.top + bt, right: ra.left + bl + a.clientWidth, bottom: ra.top + bt + a.clientHeight }
        if (sa.overflowX !== 'visible' && (p.x < innen.left || p.x >= innen.right)) return false
        if (sa.overflowY !== 'visible' && (p.y < innen.top || p.y >= innen.bottom)) return false
      }
      return true
    }
    const labelOk = (el, hit) => {
      if (hit.tagName !== 'LABEL') return false
      return hit.contains(el) || (el.labels && [...el.labels].includes(hit))
    }
    // Stand je Element: wie oft im Fenster, wie oft frei, wer hat verdeckt.
    const stand = new Map(kandidaten.map((el) => [el, { gesehen: 0, frei: 0, hits: new Map(), schweb: new Map(), gewollt: 0 }]))
    const pruefeSchritt = () => {
      const modale = modale2()
      for (const el of kandidaten) {
        const p = mitte(el)
        if (!imSichtbaren(el, p)) continue
        const s = stand.get(el)
        s.gesehen++
        const hit = document.elementFromPoint(p.x, p.y)
        if (!hit || hit === el || el.contains(hit) || labelOk(el, hit)) { s.frei++; continue }
        if (modale.some((m) => !m.contains(el) && (m.contains(hit) || hit.contains(m)))) { s.gewollt++; continue }
        s.hits.set(hit, (s.hits.get(hit) || 0) + 1)
        // Feste Navigation (<nav>, role=navigation) gehoert zum Rahmen der Seite; ihr Verdecken ganz unten ist HART, beim Hineinscrollen normal.
        if (!hit.closest('nav, [role=navigation]')) for (let e = hit; e && e !== document.body; e = e.parentElement) {
          const ps = stil(e).position
          if (ps === 'fixed' || ps === 'sticky') { s.schweb.set(hit, (s.schweb.get(hit) || 0) + 1); break }
        }
      }
    }
    const scroller = () => {
      const liste = []
      for (const el of document.body.querySelectorAll('*')) {
        const s = stil(el)
        if (!/(auto|scroll|overlay)/.test(s.overflowY) || el.scrollHeight <= el.clientHeight + 1) continue
        if (!sichtbar(el)) continue
        liste.push(el)
      }
      return liste
    }
    const root = document.scrollingElement || document.documentElement
    const inner = scroller()
    const alt = [[root, root.scrollTop], ...inner.map((e) => [e, e.scrollTop])]
    const setze = (e, y) => { e.scrollTo({ top: y, left: e.scrollLeft, behavior: 'instant' }) }
    const positionen = (e) => {
      const max = e.scrollHeight - e.clientHeight
      const schritt = Math.max(24, Math.floor((e === root ? H : e.clientHeight) / 4))
      const l = []
      for (let y = 0; y < max; y += schritt) l.push(y)
      l.push(max)
      return l
    }
    for (const [e] of alt) setze(e, 0)
    for (const y of positionen(root)) {
      setze(root, y)
      pruefeSchritt()
      for (const e of inner) {
        const r = e.getBoundingClientRect()
        if (r.bottom <= 0 || r.top >= H) continue
        for (const yi of positionen(e)) {
          if (yi === 0) continue // Stand 0 wurde mit dem Fenster-Schritt geprueft
          setze(e, yi)
          pruefeSchritt()
        }
        setze(e, 0)
      }
    }
    for (const [e, y] of alt) setze(e, y)
    const verstoesse = []
    const schwebend = []
    for (const [el, s] of stand) {
      if (s.gesehen === 0 || s.hits.size === 0) continue
      if (s.frei > 0) { if (hat('verdeckt.schwebend') && s.schweb.size) schwebend.push({ el, hit: [...s.schweb.entries()].sort((a, b) => b[1] - a[1])[0][0] }); continue }
      const hit = [...s.hits.entries()].sort((a, b) => b[1] - a[1])[0][0]
      verstoesse.push({ el, hit })
    }
    // Nur das innerste Element melden, wenn ein Bedienelement ein anderes enthaelt (Karte mit Knopf darin).
    // Das verdeckende Element wird als Hinweis (role=alert/status), sonst als Bedienelement bzw. Testkennung beschrieben (nicht als Symbol-Pfad darin).
    const beschreibe = (hit) => {
      const e = hit.closest('[role=alert], [role=status]') || hit.closest('button, a[href], [role=button], [data-testid]') || hit
      const t = kurz(e.textContent)
      return `${selektor(e)}${t ? ` "${t}"` : ''}`
    }
    for (const v of schwebend.filter((a) => !schwebend.some((b) => b !== a && a.el.contains(b.el)))) {
      const von = beschreibe(v.hit)
      const name = kurz(v.el.textContent) || v.el.getAttribute('aria-label') || v.el.getAttribute('title') || v.el.getAttribute('placeholder') || ''
      melde('verdeckt.schwebend', v.el, `von schwebendem ${von} verdeckt, erst durch Weiterscrollen frei`, 'nie von schwebenden Elementen verdeckt', { verdecktVon: von, text: name })
    }
    if (hat('verdeckt.bedienelement')) for (const v of verstoesse.filter((a) => !verstoesse.some((b) => b !== a && a.el.contains(b.el)))) {
      const von = beschreibe(v.hit)
      const name = kurz(v.el.textContent) || v.el.getAttribute('aria-label') || v.el.getAttribute('title') || v.el.getAttribute('placeholder') || ''
      melde('verdeckt.bedienelement', v.el, `von ${von} verdeckt`, 'Mitte frei, auch ganz unten gescrollt', { verdecktVon: von, text: name })
    }
  }

  return {
    befunde,
    zaehler,
    markierungen,
    ausnahmen,
    info: { breite: W, hoehe: H, schicht: schicht === document.body ? 'seite' : `modal ${selektor(schicht)}`, texttraeger: traeger.length, bedienelemente: bedien.length, bilder: bilder.length },
  }
}

// Gate im Browser: Schriften, Attrappe, Dev-Server, Geraete-Rahmen (Mockup), Ersatzschrift.
export function pruefeGate({ modus }) {
  const gruende = []
  const warnungen = []
  const faces = [...document.fonts]
  const fehler = faces.filter((f) => f.status === 'error').map((f) => f.family)
  if (fehler.length) gruende.push(`Schrift nicht geladen: ${[...new Set(fehler)].join(', ')}`)
  if (document.fonts.status !== 'loaded') gruende.push(`document.fonts.status = ${document.fonts.status}`)
  const quelle = document.querySelector('meta[name="visual-metrics:quelle"]')
  const q = quelle ? (quelle.getAttribute('content') || '').toLowerCase() : ''
  if (q === 'mock' || q === 'attrappe' || q === 'fixture') gruende.push(`Seite ist eine Attrappe (meta visual-metrics:quelle=${q}), nicht der echte Stand`)
  if (document.querySelector('script[src*="/@vite/client"]')) gruende.push('Vite-Dev-Server erkannt: gegen gebautes Preview messen (--app)')

  // Ersatzschrift: erste Schriftfamilie der Texte gegen monospace vermessen.
  const familien = new Map()
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n, i = 0; (n = w.nextNode()) && i < 400; i++) {
    if (!n.textContent.trim() || !n.parentElement) continue
    const f = getComputedStyle(n.parentElement).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '')
    familien.set(f, (familien.get(f) || 0) + 1)
  }
  const GENERISCH = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|-apple-system|BlinkMacSystemFont|emoji|math)$/i
  const cv = document.createElement('canvas').getContext('2d')
  const breite = (font) => { cv.font = font; return cv.measureText('Turnierverwaltung 0123456789 Wg').width }
  for (const [f] of familien) {
    if (GENERISCH.test(f)) continue
    if (breite(`20px "${f}", monospace`) === breite('20px monospace') && breite(`20px "${f}", serif`) === breite('20px serif')) warnungen.push(`Schrift "${f}" nicht verfuegbar, gemessen wird die Ersatzschrift`)
  }

  // Mockup: Geraete-Rahmen oder Verkleinerung (Review B-14). Mockups rendern ohne Rahmen im echten Viewport.
  if (modus === 'MOCKUP') {
    const W = window.innerWidth
    const texte = [...document.body.querySelectorAll('*')].filter((e) => [...e.childNodes].some((k) => k.nodeType === 3 && k.textContent.trim()))
    let skaliert = null
    for (const t of texte.slice(0, 300)) {
      for (let e = t; e && e !== document.documentElement; e = e.parentElement) {
        const s = getComputedStyle(e)
        const m = s.transform && s.transform !== 'none' ? s.transform.match(/matrix\(([^)]+)\)/) : null
        const sc = m ? Math.hypot(...m[1].split(',').slice(0, 2).map(Number)) : 1
        const zoom = parseFloat(s.zoom || '1')
        if (Math.abs(sc - 1) > 0.01 || (Number.isFinite(zoom) && Math.abs(zoom - 1) > 0.01)) { skaliert = { e, sc: Math.abs(sc - 1) > 0.01 ? sc : zoom }; break }
      }
      if (skaliert) break
    }
    if (skaliert) gruende.push(`Mockup verkleinert (Faktor ${skaliert.sc.toFixed(3)} an ${skaliert.e.tagName.toLowerCase()}${skaliert.e.id ? `#${skaliert.e.id}` : ''}): ohne Geraete-Rahmen im echten Viewport rendern`)
    const GERAETE = [320, 360, 375, 390, 412, 768, 820, 1024, 1280, 1440]
    if (!document.querySelector('[data-vm-kein-rahmen]')) {
      for (const e of document.body.querySelectorAll('*')) {
        const s = getComputedStyle(e)
        if (!/(hidden|clip)/.test(s.overflow)) continue
        const r = e.getBoundingClientRect()
        if (r.width >= W - 1 || !GERAETE.some((gw) => Math.abs(gw - r.width) <= 1)) continue
        const drin = texte.filter((t) => e.contains(t)).length
        if (texte.length && drin / texte.length >= 0.3) {
          gruende.push(`Geraete-Rahmen erkannt (${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''} ${Math.round(r.width)} px in ${W} px Fenster): Mockup ohne Rahmen im echten Viewport rendern`)
          break
        }
      }
    }
  }
  return { gruende, warnungen, lang: document.documentElement.lang || null }
}

// Langtext: Teamnamen auf 50 Zeichen; uebrige Texte +dehnung als trennbare Fuellwoerter in Klammern (B-04).
export function dehneTexte({ dehnung, teamname, teamSelektor }) {
  const team = new Set()
  for (const el of document.querySelectorAll(teamSelektor)) { el.textContent = teamname; team.add(el) }
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const knoten = []
  for (let n; (n = w.nextNode()); ) {
    const p = n.parentElement
    if (!p || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(p.tagName)) continue
    if ([...team].some((t) => t.contains(n))) continue
    if (!/\p{L}/u.test(n.textContent)) continue
    knoten.push(n)
  }
  for (const n of knoten) {
    const roh = n.textContent
    const t = roh.trim()
    let rest = Math.max(2, Math.ceil(t.length * dehnung))
    const fueller = []
    for (let i = 0; rest > 0; i++) {
      const l = Math.min(rest, i % 2 ? 3 : 2)
      fueller.push('ä'.repeat(l))
      rest -= l + 1
    }
    n.textContent = roh.replace(t, `[${t} ${fueller.join(' ')}]`)
  }
  return knoten.length
}
