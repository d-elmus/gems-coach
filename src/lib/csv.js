// ─── CSV : export (Excel FR → « ; » + BOM UTF-8) et import tolérant ─────────

function cell(v) {
  const s = v == null ? '' : String(v)
  return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows) {
  return rows.map(r => r.map(cell).join(';')).join('\r\n')
}

export function downloadCSV(filename, rows) {
  const blob = new Blob(['\uFEFF' + toCSV(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Séparateur deviné sur la première ligne : « ; », « , » ou tabulation.
function guessDelimiter(text) {
  const first = text.split(/\r?\n/)[0] || ''
  const counts = [';', ',', '\t'].map(d => [d, first.split(d).length - 1])
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : ','
}

// Parse un CSV (guillemets, retours à la ligne dans les cellules) → tableau de lignes.
export function parseCSV(text) {
  const src = text.replace(/^\uFEFF/, '')
  const d = guessDelimiter(src)
  const rows = []
  let row = [], cur = '', quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === d) { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cur); rows.push(row); row = []; cur = ''
    } else cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows.map(r => r.map(x => x.trim())).filter(r => r.some(Boolean))
}

// Clé d'en-tête normalisée : « Prénom » → « prenom », « E-mail » → « email ».
export function headerKey(h) {
  return String(h || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
}

// Date du jour pour les noms de fichiers : 2026-10-01
export function fileDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
