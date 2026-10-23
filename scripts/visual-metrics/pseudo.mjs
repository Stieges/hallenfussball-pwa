// Pseudo-Elemente (::before/::after) liegen nicht im DOM; ihre Boxen kommen ueber das DevTools-Protokoll
// (DOM.getBoxModel). Das Elternelement bekommt data-vm-pseudo, damit die Messung es zuordnen kann (B-08).
export async function pseudoRechtecke(page) {
  const cdp = await page.context().newCDPSession(page)
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: false })
    const funde = []
    const stapel = [root]
    while (stapel.length) {
      const n = stapel.pop()
      for (const p of n.pseudoElements || []) {
        if (p.pseudoType === 'before' || p.pseudoType === 'after') funde.push({ eltern: n.nodeId, knoten: p.nodeId, art: p.pseudoType })
      }
      for (const k of n.children || []) stapel.push(k)
    }
    const aus = []
    let i = 0
    for (const f of funde) {
      let modell
      try {
        ;({ model: modell } = await cdp.send('DOM.getBoxModel', { nodeId: f.knoten }))
      } catch {
        continue
      }
      const q = modell.border
      const xs = [q[0], q[2], q[4], q[6]]
      const ys = [q[1], q[3], q[5], q[7]]
      const r = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
      r.width = r.right - r.left
      r.height = r.bottom - r.top
      if (r.width <= 1 || r.height <= 1) continue
      const nr = String(i++)
      await cdp.send('DOM.setAttributeValue', { nodeId: f.eltern, name: `data-vm-pseudo-${f.art}`, value: nr })
      aus.push({ ...r, art: f.art, vmPseudo: nr })
    }
    return aus
  } finally {
    await cdp.detach().catch(() => {})
  }
}
