// Messung im Browser. `messeSeite` wird per page.evaluate in die Seite gegeben und muss deshalb
// in sich geschlossen sein (keine Importe, keine Variablen von aussen).
//
// opt = {
//   art: 'handy'|'tablet'|'desktop'|'monitor'|'reflow',
//   g: { '<grenzwert-id>': zahl|string },   // nur die fuer diese Art geltenden Grenzwerte
//   randPx: number,                          // Monitor: eingestellter TV-Rand des Profils
//   monitorSchrift: { stand, lesetext, neben } // Anteil Bildhoehe (berechnet aus Sehwinkel)
//   primarySelektor: string,
//   maxJeMetrik: number,
// }
// Rueckgabe: { befunde: [{ metrik, selektor, ist, grenze, text }], info: {...} }

export function messeSeite(opt) {
  const g = opt.g
  const hat = (id) => Object.prototype.hasOwnProperty.call(g, id)
  const W = window.innerWidth
  const H = window.innerHeight
  const befunde = []
  const zaehler = {}
  const melde = (metrik, el, ist, grenze, extra) => {
    zaehler[metrik] = (zaehler[metrik] || 0) + 1
    if (zaehler[metrik] > opt.maxJeMetrik) return
    befunde.push({
      metrik,
      selektor: el ? selektor(el) : 'document',
      ist,
      grenze,
      text: el ? kurz(el.textContent) : '',
      ...(extra || {}),
    })
  }
  const kurz = (t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  const r1 = (n) => Math.round(n * 10) / 10

  function selektor(el) {
    if (!(el instanceof Element)) return '?'
    if (el.id) return `#${el.id}`
    const tid = el.getAttribute('data-testid')
    if (tid) return `[data-testid="${tid}"]`
    const teile = []
    let e = el
    for (let i = 0; e && e.nodeType === 1 && i < 4; i++) {
      if (e.id) { teile.unshift(`#${e.id}`); break }
      let s = e.tagName.toLowerCase()
      const kl = [...e.classList].slice(0, 2).join('.')
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

  const stil = (el) => getComputedStyle(el)
  function sichtbar(el) {
    const s = stil(el)
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false
    if (parseFloat(s.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    if (r.width <= 1 || r.height <= 1) return false
    // sr-only / clip-Muster: unsichtbar gewollt
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const se = stil(e)
      if (se.clip && se.clip !== 'auto') return false
      if (se.clipPath && se.clipPath !== 'none') return false
      if (se.display === 'none' || parseFloat(se.opacity) === 0) return false
      const re = e.getBoundingClientRect()
      if (re.width <= 1 || re.height <= 1) return false
    }
    return true
  }
  const ausnahme = (el, attr) => !!el.closest(`[${attr}]`)

  // ---------- Texttraeger: Elemente mit eigenem, nicht leerem Textknoten ----------
  const traeger = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const gesehen = new Set()
  for (let n; (n = walker.nextNode()); ) {
    if (!n.textContent || !n.textContent.trim()) continue
    const el = n.parentElement
    if (!el || gesehen.has(el)) continue
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION'].includes(el.tagName)) continue
    gesehen.add(el)
    if (!sichtbar(el)) continue
    const rects = []
    // Range-Rechtecke umfassen den Inhaltsbereich der Schrift (Ober-/Unterlaengen-Reserve). Ist er hoeher
    // als die Zeilenhoehe, wird er auf die Zeilenbox gekuerzt, sonst melden enge Zeilenhoehen Scheinbefunde.
    const lh = parseFloat(stil(el).lineHeight)
    for (const k of el.childNodes) {
      if (k.nodeType !== 3 || !k.textContent.trim()) continue
      const rg = document.createRange()
      rg.selectNodeContents(k)
      for (const r of rg.getClientRects()) {
        if (r.width <= 0.5 || r.height <= 0.5) continue
        const kuerzen = Number.isFinite(lh) && r.height > lh ? (r.height - lh) / 2 : 0
        rects.push({ left: r.left, right: r.right, width: r.width, top: r.top + kuerzen, bottom: r.bottom - kuerzen, height: r.height - 2 * kuerzen })
      }
    }
    if (rects.length) traeger.push({ el, rects })
  }
  const vereinige = (rects) => {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
    for (const x of rects) { l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom) }
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t }
  }

  // ---------- Bedienelemente ----------
  const BEDIEN = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=radio], [role=switch], [role=menuitem], [tabindex]:not([tabindex="-1"])'
  const bedien = [...document.querySelectorAll(BEDIEN)].filter(sichtbar)

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
    const gemeldet = []
    for (const el of document.body.querySelectorAll('*')) {
      if (gemeldet.some((p) => el.contains(p))) continue // Vorfahren gemeldeter Elemente nicht doppeln
      const s = stil(el)
      if (s.display === 'inline' || s.display === 'contents' || s.position === 'fixed') continue
      if (ausnahme(el, 'data-overflow-ok') || inScroller(el)) continue
      if (!sichtbar(el)) continue
      const r = el.getBoundingClientRect()
      if (r.right > W + tol || r.left < -tol) {
        melde('ueberlauf.element', el, `links ${r1(r.left)} / rechts ${r1(r.right)} px`, `0..${W} px`)
        gemeldet.push(el)
        continue
      }
      if (s.overflowX === 'visible' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + tol) {
        melde('ueberlauf.element', el, `Inhalt ${el.scrollWidth} px breit`, `<= ${el.clientWidth} px`)
        gemeldet.push(el)
      }
    }
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
        for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
          const sa = stil(a)
          const clipX = sa.overflowX === 'hidden' || sa.overflowX === 'clip'
          const clipY = sa.overflowY === 'hidden' || sa.overflowY === 'clip'
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

  // ---------- M3 Ueberlappung ----------
  if (hat('ueberlappung.text')) {
    const min = g['ueberlappung.text']
    const items = []
    for (const t of traeger) if (!ausnahme(t.el, 'data-overlap-ok')) items.push({ el: t.el, rects: t.rects })
    for (const b of bedien) if (!ausnahme(b, 'data-overlap-ok')) items.push({ el: b, rects: [b.getBoundingClientRect()] })
    const begrenzt = items.slice(0, 1500)
    for (let i = 0; i < begrenzt.length; i++) {
      for (let j = i + 1; j < begrenzt.length; j++) {
        const A = begrenzt[i], B = begrenzt[j]
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
        if (treffer) melde('ueberlappung.text', A.el, `schneidet ${selektor(B.el)} (${treffer})`, '0 Schnittflaeche', { mit: kurz(B.el.textContent) })
      }
    }
  }

  // ---------- M9 Titel: Zeilen, Wortbruch, hyphens ----------
  const zeilenTops = (rects) => {
    const tops = []
    for (const r of rects) if (!tops.some((t) => Math.abs(t - r.top) < Math.max(2, r.height / 2))) tops.push(r.top)
    return tops.length
  }
  const TITEL = 'h1, [data-title]'
  const KEIN_BRUCH = 'h1, h2, h3, [data-title], button, [role=tab], [role=button]'
  if (hat('titel.zeilen')) {
    for (const el of document.querySelectorAll(TITEL)) {
      if (!sichtbar(el)) continue
      const rg = document.createRange()
      rg.selectNodeContents(el)
      const z = zeilenTops([...rg.getClientRects()].filter((r) => r.width > 0.5))
      if (z > g['titel.zeilen']) melde('titel.zeilen', el, `${z} Zeilen`, `<= ${g['titel.zeilen']}`)
    }
  }
  if (hat('titel.hyphens')) {
    for (const el of document.querySelectorAll(KEIN_BRUCH)) {
      if (!sichtbar(el)) continue
      const s = stil(el)
      const h = s.hyphens || s.webkitHyphens
      if (h === 'auto') melde('titel.hyphens', el, 'hyphens: auto', 'manual oder none')
    }
  }
  if (hat('titel.wortbruch')) {
    for (const el of document.querySelectorAll(KEIN_BRUCH)) {
      if (!sichtbar(el)) continue
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let n; (n = w.nextNode()); ) {
        for (const m of n.textContent.matchAll(/[^\s]+/g)) {
          const rg = document.createRange()
          rg.setStart(n, m.index)
          rg.setEnd(n, m.index + m[0].length)
          const rects = [...rg.getClientRects()].filter((r) => r.width > 0.5)
          if (zeilenTops(rects) > 1) {
            melde('titel.wortbruch', el, `Wort "${m[0].replace(/­/g, '')}" auf ${zeilenTops(rects)} Zeilen`, 'Wort auf einer Zeile')
          }
        }
      }
    }
  }

  // ---------- M4 Kontrast ----------
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const cx = cv.getContext('2d', { willReadFrequently: true })
  const farbe = (str) => {
    cx.clearRect(0, 0, 1, 1)
    cx.fillStyle = 'rgba(0,0,0,0)'
    cx.fillStyle = str
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
  function hintergrund(el) {
    const schichten = []
    for (let e = el; e; e = e.parentElement) {
      const s = stil(e)
      if (s.backgroundImage && s.backgroundImage !== 'none') return null
      const c = farbe(s.backgroundColor)
      if (c[3] > 0) schichten.push(c)
      if (c[3] >= 0.999) break
    }
    let basis = [255, 255, 255, 1]
    if (!schichten.length || schichten[schichten.length - 1][3] < 0.999) {
      if (matchMedia('(prefers-color-scheme: dark)').matches) return null
    }
    for (let i = schichten.length - 1; i >= 0; i--) basis = mische(schichten[i], basis)
    return basis
  }
  if (hat('kontrast.text')) {
    for (const { el } of traeger) {
      const s = stil(el)
      const bg = hintergrund(el)
      if (!bg) {
        if (hat('kontrast.unsicher')) melde('kontrast.unsicher', el, 'Hintergrund Bild/Verlauf/unbestimmt', 'Sichtkritik')
        continue
      }
      const fgRoh = farbe(s.color)
      const fg = mische(fgRoh, bg)
      const l1 = lum(fg), l2 = lum(bg)
      const k = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      const px = parseFloat(s.fontSize)
      const gross = px >= 24 || (px >= 18.66 && parseInt(s.fontWeight, 10) >= 700)
      const soll = gross ? g['kontrast.text-gross'] : g['kontrast.text']
      if (k < soll) melde(gross ? 'kontrast.text-gross' : 'kontrast.text', el, `${(Math.floor(k * 100) / 100).toFixed(2)}:1`, `>= ${soll}:1`)
      else if (hat('kontrast.monitor') && k < g['kontrast.monitor']) melde('kontrast.monitor', el, `${(Math.floor(k * 100) / 100).toFixed(2)}:1`, `>= ${g['kontrast.monitor']}:1`)
    }
  }

  // ---------- M5 Touch-Ziele, Haupttaste ----------
  const imFliesstext = (el) => {
    if (el.tagName !== 'A') return false
    if (stil(el).display !== 'inline') return false
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
  const primaer = new Set(opt.primarySelektor ? [...document.querySelectorAll(opt.primarySelektor)].filter(sichtbar) : [])
  if (hat('touch.min')) {
    for (const el of bedien) {
      if (ausnahme(el, 'data-touch-ok') || imFliesstext(el)) continue
      if (el.parentElement && el.parentElement.closest(BEDIEN) && !primaer.has(el)) continue // Kind eines Bedienelements
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
      if (r.top < 0 || r.left < 0 || r.bottom > H + g['primaer.sichtbar'] || r.right > W) {
        melde('primaer.sichtbar', el, `oben ${r1(r.top)} / unten ${r1(r.bottom)} px`, `im Fenster 0..${H} px ohne Scrollen`)
      }
    }
  }

  // ---------- M6 Mindestschrift ----------
  if (hat('schrift.eingabe')) {
    for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')) {
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
      const stufeEl = el.closest('[data-monitor]')
      const stufe = stufeEl ? stufeEl.getAttribute('data-monitor') : 'lesetext'
      const key = stufe === 'stand' || stufe === 'uhr' ? 'stand' : stufe === 'neben' ? 'neben' : 'lesetext'
      const id = `monitor.schrift.${key}`
      if (!hat(id)) continue
      const px = parseFloat(stil(el).fontSize)
      const soll = opt.monitorSchrift[key] * H
      if (px + 0.01 < soll) melde(id, el, `${px} px (${r1((px / H) * 100)} % Bildhoehe)`, `>= ${Math.ceil(soll)} px (${r1(opt.monitorSchrift[key] * 100)} %)`)
    }
  }

  // ---------- M7 Overscan ----------
  if (hat('overscan.app-rand') || hat('overscan.ebu-grafik')) {
    const inhalte = traeger.map((t) => ({ el: t.el, r: vereinige(t.rects) }))
    for (const el of document.querySelectorAll('img, svg, canvas, video, button, [data-monitor-inhalt]')) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue
      if (sichtbar(el)) inhalte.push({ el, r: el.getBoundingClientRect() })
    }
    const pruefe = (id, rx, ry) => {
      for (const { el, r } of inhalte) {
        if (ausnahme(el, 'data-overscan-ok')) continue
        if (r.left < rx - 1 || r.top < ry - 1 || r.right > W - rx + 1 || r.bottom > H - ry + 1) { // 1 px Rundung (Schriftmetrik)
          melde(id, el, `Box ${r1(r.left)},${r1(r.top)} bis ${r1(r.right)},${r1(r.bottom)}`, `innerhalb ${rx}/${ry} px Rand (${W}x${H})`)
        }
      }
    }
    if (hat('overscan.app-rand')) pruefe('overscan.app-rand', opt.randPx, opt.randPx)
    if (hat('overscan.ebu-grafik') && opt.randPx > 0) pruefe('overscan.ebu-grafik', Math.round(W * g['overscan.ebu-grafik']), Math.round(H * g['overscan.ebu-grafik']))
  }
  if (hat('monitor.bedienelemente') && bedien.length > 0) {
    melde('monitor.bedienelemente', bedien[0], `${bedien.length} fokussierbare Elemente`, '0')
  }

  return {
    befunde,
    zaehler,
    info: { breite: W, hoehe: H, texttraeger: traeger.length, bedienelemente: bedien.length, haupttasten: primaer.size },
  }
}

// Gate-Pruefung im Browser: Schriften, Attrappe, Dev-Server.
export function pruefeGate() {
  const gruende = []
  const faces = [...document.fonts]
  const fehler = faces.filter((f) => f.status === 'error').map((f) => f.family)
  if (fehler.length) gruende.push(`Schrift nicht geladen: ${[...new Set(fehler)].join(', ')}`)
  if (document.fonts.status !== 'loaded') gruende.push(`document.fonts.status = ${document.fonts.status}`)
  const quelle = document.querySelector('meta[name="visual-metrics:quelle"]')
  const q = quelle ? (quelle.getAttribute('content') || '').toLowerCase() : ''
  if (q === 'mock' || q === 'attrappe' || q === 'fixture') gruende.push(`Seite ist eine Attrappe (meta visual-metrics:quelle=${q}), nicht der echte Stand`)
  if (document.querySelector('script[src*="/@vite/client"]')) gruende.push('Vite-Dev-Server erkannt: gegen gebautes Preview (npm run build && npm run preview) messen')
  const build = document.querySelector('meta[name="build-hash"]')
  return { gruende, build: build ? build.getAttribute('content') : null, lang: document.documentElement.lang || null }
}

// Langtext-Variante: Teamnamen auf 50 Zeichen, uebrige Texte +dehnung in Klammern.
export function dehneTexte({ dehnung, teamname, teamSelektor }) {
  const team = new Set()
  for (const el of document.querySelectorAll(teamSelektor)) {
    el.textContent = teamname
    team.add(el)
  }
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
    const zusatz = 'ä'.repeat(Math.max(1, Math.ceil(t.length * dehnung) - 1))
    n.textContent = roh.replace(t, `[${t} ${zusatz}]`)
  }
  return knoten.length
}
