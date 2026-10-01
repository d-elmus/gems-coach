import { supabase } from './supabase'
import { must } from './clubData'
import { toLocalDateStr, parseDate } from './dateUtils'

// ─── Séances « à faire » (club_workouts) ─────────────────────────────────────
// Prescrites par un coach pour une DATE (sans heure ni réservation) à tout le club,
// un groupe ou un athlète. L'athlète la fait seul puis la note dans l'app :
// fait / pas fait + RPE + commentaire (club_workout_logs).

const WORKOUT_SELECT = `*, coach:coach_id(id, full_name, photo_url),
  group:group_id(id, name, color),
  athlete:athlete_id(id, full_name, photo_url),
  logs:club_workout_logs(id, user_id, status, rpe, comment, created_at, profile:user_id(id, full_name, photo_url))`

export function decorateWorkout(w) {
  return { ...w, day: parseDate(w.date), logs: w.logs || [], blocks: Array.isArray(w.blocks) ? w.blocks : [] }
}

// Séances du club entre deux dates (from inclus, to exclu).
export async function fetchWorkouts(clubId, from, to) {
  const data = must(await supabase.from('club_workouts').select(WORKOUT_SELECT)
    .eq('club_id', clubId)
    .gte('date', toLocalDateStr(from))
    .lt('date', toLocalDateStr(to))
    .order('date')
    .order('created_at'))
  return (data || []).map(decorateWorkout)
}

export async function saveWorkouts(rows) {
  return supabase.from('club_workouts').insert(rows).select('id')
}
export async function updateWorkout(id, patch) {
  return supabase.from('club_workouts').update(patch).eq('id', id).select('id')
}
export async function deleteWorkout(id) {
  return supabase.from('club_workouts').delete().eq('id', id)
}

// La séance concerne-t-elle ce membre du club (ligne club_members) ?
export function appliesTo(w, member) {
  if (!member) return false
  if (w.athlete_id) return w.athlete_id === member.user_id
  return !w.group_id || w.group_id === member.group_id
}

// Athlètes ciblés par la séance, parmi les athlètes actifs du club.
export function workoutTargets(w, athletes = []) {
  return athletes.filter(m => appliesTo(w, m))
}

// Suivi : fait / pas fait / sans retour — uniquement parmi les athlètes ciblés.
export function workoutProgress(w, athletes = []) {
  const targets = workoutTargets(w, athletes)
  const byUser = Object.fromEntries(w.logs.map(l => [l.user_id, l]))
  const rows = targets.map(m => ({ member: m, log: byUser[m.user_id] || null }))
  const done = rows.filter(r => r.log?.status === 'done')
  const skipped = rows.filter(r => r.log?.status === 'skipped')
  const pending = rows.filter(r => !r.log)
  const rpes = done.map(r => r.log.rpe).filter(v => v != null)
  return {
    total: targets.length, done, skipped, pending,
    avgRpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
    comments: rows.filter(r => r.log?.comment).length,
  }
}

export function targetLabel(w) {
  if (w.athlete_id) return w.athlete?.full_name || 'Un athlète'
  if (w.group_id) return w.group ? `Groupe ${w.group.name}` : 'Un groupe'
  return 'Tout le club'
}

export function targetKind(w) {
  return w.athlete_id ? 'athlete' : w.group_id ? 'group' : 'club'
}

// Statut d'un athlète pour une séance : fait / pas fait / à venir / sans retour.
export function logStatus(w, log) {
  if (log?.status === 'done') return { tone: 'good', label: 'Fait', icon: 'check' }
  if (log?.status === 'skipped') return { tone: 'bad', label: 'Pas fait', icon: 'x' }
  const today = toLocalDateStr(new Date())
  if (w.date > today) return { tone: 'neutral', label: 'À venir', icon: 'clock' }
  if (w.date === today) return { tone: 'neutral', label: "Aujourd'hui", icon: 'clock' }
  return { tone: 'warn', label: 'Sans retour', icon: 'clock' }
}

// Couleur RPE : facile → vert, dur → rouge.
export function rpeTone(rpe) {
  if (rpe == null) return 'neutral'
  return rpe <= 4 ? 'good' : rpe <= 7 ? 'warn' : 'bad'
}
