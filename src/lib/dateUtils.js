// Centralized date utilities — avoids timezone bugs from toISOString() (UTC)

export const toLocalDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

export const parseDate = (str) =>
  str ? new Date(str + 'T12:00:00') : new Date()

export const nextMonday = (from = new Date()) => {
  const d = new Date(from)
  d.setHours(12, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 1 ? 0 : day === 0 ? 1 : 8 - day))
  return toLocalDateStr(d)
}

export const addDays = (date, n) => {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const target = parseDate(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}
