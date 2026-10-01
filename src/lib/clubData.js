import { supabase } from './supabase'

// Lève l'erreur Supabase (pour useLoader) au lieu de la renvoyer.
export function must({ data, error, count }) {
  if (error) throw error
  return count !== undefined && data == null ? count : data
}

// Message français pour les erreurs renvoyées par la base (règles du club).
export function clubError(error) {
  if (!error) return null
  const msg = error.message || String(error)
  if (/last_admin/.test(msg)) return "Impossible : c'est le dernier admin du club. Nomme d'abord un autre admin (rôle « Admin » sur un autre membre)."
  if (error.code === '23505') return 'Cette personne est déjà membre ou invitée.'
  if (error.code === '42501' || /row-level security|permission denied/i.test(msg)) return "Action non autorisée avec ton rôle dans le club."
  if (/not_a_club_coach/.test(msg)) return "Cette personne n'a pas le rôle coach dans le club."
  if (/forbidden/.test(msg)) return 'Action réservée aux admins du club.'
  return msg
}

// Intensités (séances du club et séances « à faire »).
export const ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']
export const ZONE_FACTOR = { Z1: 0.5, Z2: 0.8, Z3: 1.1, Z4: 1.4, Z5: 1.6 }
export function estimateTss(minutes, zone) {
  return Math.round((parseInt(minutes) || 0) * (ZONE_FACTOR[zone] ?? 0.8))
}

// ─── Dates ───────────────────────────────────────────────────────────────────
export function startOfWeek(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1))
  return x
}
export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
export function fmtTime(d) {
  const x = new Date(d)
  return `${x.getHours()}h${x.getMinutes() ? String(x.getMinutes()).padStart(2, '0') : '00'}`
}
// « mer. 7 oct. » → « Mer. 7 oct. » (majuscule sur le premier mot seulement)
export function fmtDay(d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const s = new Date(d).toLocaleDateString('fr-FR', opts)
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export function weekLabel(start) {
  const end = addDays(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  const a = start.toLocaleDateString('fr-FR', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'long' })
  const b = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  return `${a} – ${b}`
}
export function relTime(d) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.round(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.round(diff / 3600)}h`
  if (diff < 172800) return 'hier'
  return `il y a ${Math.round(diff / 86400)}j`
}

// ─── Séances du club ─────────────────────────────────────────────────────────
const SESSION_SELECT = `*, coach:coach_id(id, full_name, photo_url),
  group:group_id(id, name, color),
  bookings:club_bookings(id, status, attended, user_id, created_at, profile:user_id(id, full_name, photo_url))`

export async function fetchSessions(clubId, from, to, { coachId } = {}) {
  let q = supabase.from('club_sessions').select(SESSION_SELECT)
    .eq('club_id', clubId)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at')
  if (coachId) q = q.eq('coach_id', coachId)
  const { data, error } = await q
  return { data: (data || []).map(decorate), error }
}

export function decorate(s) {
  const bookings = s.bookings || []
  const booked = bookings.filter(b => b.status === 'booked')
  const waitlist = bookings.filter(b => b.status === 'waitlist')
  const full = s.capacity != null && booked.length >= s.capacity
  return { ...s, booked, waitlist, full, start: new Date(s.starts_at), end: new Date(new Date(s.starts_at).getTime() + (s.duration_min || 60) * 60000) }
}

export async function saveSessions(rows) {
  return supabase.from('club_sessions').insert(rows).select('id')
}
export async function updateSession(id, patch) {
  return supabase.from('club_sessions').update(patch).eq('id', id).select('id')
}
export async function deleteSession(id) {
  return supabase.from('club_sessions').delete().eq('id', id)
}
export async function setAttendance(bookingId, attended) {
  return supabase.from('club_bookings').update({ attended }).eq('id', bookingId)
}

// ─── Membres ─────────────────────────────────────────────────────────────────
export async function fetchMembers(clubId) {
  const { data, error } = await supabase.from('club_members')
    .select('*, profile:user_id(id, full_name, email, photo_url, age, gender), coach:coach_id(id, full_name, photo_url), group:group_id(id, name, color)')
    .eq('club_id', clubId)
    .order('joined_at', { ascending: false })
  return { data: data || [], error }
}

// Athlètes actifs du club (rôle athlète, compte rattaché) avec groupe et coach référent.
export async function fetchClubAthletes(clubId) {
  const data = must(await supabase.from('club_members')
    .select('id, user_id, roles, group_id, coach_id, status, membership_until, profile:user_id(id, full_name, email, photo_url), coach:coach_id(id, full_name, photo_url), group:group_id(id, name, color)')
    .eq('club_id', clubId).eq('status', 'active').contains('roles', ['athlete']))
  return (data || []).filter(m => m.user_id)
    .sort((a, b) => memberName(a).localeCompare(memberName(b), 'fr'))
}

// Demande de rôle (adhésion depuis l'app en se déclarant coach / admin).
export const REQUEST_LABELS = { coach: 'Coach', admin: 'Admin (+ coach)' }

// L'admin accepte (ajoute le(s) rôle(s) + accès portail) ou refuse la demande.
export async function resolveRoleRequest(memberId, accept) {
  return supabase.rpc('resolve_club_role_request', { p_member: memberId, p_accept: accept })
}

// Texte d'invitation à copier / envoyer (pas d'email automatique côté serveur).
export function inviteText(club, email) {
  return [
    'Bonjour,',
    '',
    `Tu es invité(e) à rejoindre ${club.name} sur GEMS, l'app d'entraînement du club.`,
    '',
    "1. Télécharge l'app GEMS (iPhone ou Android).",
    `2. Crée ton compte avec cette adresse : ${email} — tu seras rattaché(e) au club automatiquement.`,
    `   Autre adresse ? Saisis simplement le code club ${club.invite_code} dans l'app.`,
    '',
    'À très vite à l\'entraînement !',
  ].join('\n')
}

export function memberName(m) {
  return m.profile?.full_name || m.invite_email || 'Membre'
}

// Statut d'adhésion affiché : active / expire bientôt / expirée / invitée.
export function membershipStatus(m) {
  if (m.status === 'invited' || !m.user_id) return { tone: 'neutral', label: 'Invité' }
  if (m.status === 'inactive') return { tone: 'bad', label: 'Inactive' }
  if (!m.membership_until) return { tone: 'good', label: 'Active' }
  const days = Math.ceil((new Date(m.membership_until + 'T23:59:59') - new Date()) / 86400000)
  if (days < 0) return { tone: 'bad', label: 'Expirée' }
  if (days <= 30) return { tone: 'warn', label: `Expire dans ${days}j` }
  return { tone: 'good', label: 'Active' }
}

export const ROLE_LABELS = {
  admin: 'Admin', coach: 'Coach', athlete: 'Athlète', bureau: 'Bureau', benevole: 'Bénévole', parent: 'Parent',
}

// Dernière activité synchronisée (Strava/Garmin/Santé) par utilisateur.
export async function fetchLastActivity(userIds) {
  if (!userIds.length) return {}
  const { data } = await supabase.from('synced_activities')
    .select('user_id, date').in('user_id', userIds).order('date', { ascending: false }).limit(1000)
  const map = {}
  for (const r of data || []) if (!map[r.user_id]) map[r.user_id] = r.date
  return map
}
