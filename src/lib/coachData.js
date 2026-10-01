import { supabase } from './supabase'
import { parseDate, toLocalDateStr } from './dateUtils'

// Semaines d'un plan (JSONB → tableau ; parfois stocké en chaîne JSON).
export function planWeeks(plan) {
  if (!plan) return []
  let w = plan.weeks
  if (typeof w === 'string') { try { w = JSON.parse(w) } catch { return [] } }
  return Array.isArray(w) ? w : []
}

// Athlètes du coach (actifs + demandes) et leur plan de référence.
export async function fetchCoachAthletes(coachId) {
  const { data } = await supabase
    .from('coach_athletes')
    .select('id, status, started_at, athlete:athlete_id ( id, full_name, email, photo_url, age )')
    .eq('coach_id', coachId)
    .in('status', ['active', 'pending'])
  const all = (data || []).filter(r => r.athlete)
  const active = all.filter(r => r.status === 'active')
  const pending = all.filter(r => r.status === 'pending')

  const plans = {}
  if (active.length) {
    const { data: rows } = await supabase.from('plans')
      .select('id,user_id,event_name,discipline,is_active,start_date,goal_date,athlete_metrics,weeks,completed_sessions,pbs,zones')
      .in('user_id', active.map(r => r.athlete.id))
      .order('created_at', { ascending: false })
    for (const p of rows || []) {
      const cur = plans[p.user_id]
      // Priorité : plan actif, sinon le plus récent créé par ce coach, sinon le plus récent.
      if (!cur || (p.is_active && !cur.is_active) || (!cur.is_active && !cur._mine && p.athlete_metrics?.coachId === coachId)) {
        plans[p.user_id] = { ...p, _mine: p.athlete_metrics?.coachId === coachId }
      }
    }
  }
  return { active, pending, plans }
}

// Conformité au plan sur N jours : séances prévues passées vs cochées « faites ».
export function compliance(plan, days = 30) {
  // Un plan pas encore activé par l'athlète n'est pas suivi : pas de conformité.
  if (!plan?.is_active) return null
  const today = toLocalDateStr(new Date())
  const from = toLocalDateStr(new Date(Date.now() - days * 86400000))
  const done = plan.completed_sessions || {}
  let planned = 0, completed = 0
  for (const w of planWeeks(plan)) {
    for (const s of w.sessions || []) {
      if (!s.date || s.date < from || s.date >= today || s.sport === 'rest') continue
      planned++
      if (done[s.id] || s.done) completed++
    }
  }
  return planned ? { planned, completed, missed: planned - completed, pct: Math.round((completed / planned) * 100) } : null
}

// Séances du plan cette semaine (lun → dim).
export function thisWeekSessions(plan) {
  const now = new Date()
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const from = toLocalDateStr(monday)
  const to = toLocalDateStr(new Date(monday.getTime() + 7 * 86400000))
  return planWeeks(plan).flatMap(w => w.sessions || []).filter(s => s.date >= from && s.date < to)
}

export function currentWeekIdx(plan) {
  const weeks = planWeeks(plan)
  if (!weeks.length || !plan.start_date) return 0
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = parseDate(plan.start_date); start.setHours(0, 0, 0, 0)
  return Math.max(0, Math.min(Math.floor((today - start) / (7 * 86400000)), weeks.length - 1))
}

export async function fetchActivities(userId, limit = 60) {
  const { data } = await supabase.from('synced_activities')
    .select('external_id, source, sport, date, data')
    .eq('user_id', userId).order('date', { ascending: false }).limit(limit)
  return (data || []).map(a => ({ ...a, ...(a.data || {}) }))
}

// Charge hebdo (TSS estimé des activités réalisées) sur les N dernières semaines.
export function weeklyLoad(activities, weeks = 6) {
  const now = new Date()
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  return Array.from({ length: weeks }, (_, i) => {
    const ws = new Date(monday.getTime() - (weeks - 1 - i) * 7 * 86400000)
    const we = new Date(ws.getTime() + 7 * 86400000)
    const tss = activities.filter(a => { const d = new Date(a.date); return d >= ws && d < we })
      .reduce((s, a) => s + (a.tss_estimate || Math.round((a.duration || 0) * 0.8)), 0)
    return { ws, tss }
  })
}

export function normSport(s = '') {
  const x = s.toLowerCase()
  if (x.includes('swim') || x.includes('nat')) return 'swim'
  if (x.includes('ride') || x.includes('bike') || x.includes('cycl') || x.includes('vélo') || x.includes('velo')) return 'bike'
  if (x.includes('run') || x.includes('cours')) return 'run'
  if (x.includes('strength') || x.includes('weight') || x.includes('renf')) return 'strength'
  return 'run'
}

// Activités synchronisées : durée en minutes, distance en km (en mètres pour la natation).
export function fmtDuration(min) {
  if (!min) return ''
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

export function fmtDistance(a) {
  if (a.distance == null) return ''
  return normSport(a.sport) === 'swim' ? `${(a.distance / 1000).toFixed(1).replace('.', ',')} km` : `${Number(a.distance).toFixed(1).replace('.', ',')} km`
}
