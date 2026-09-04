import { supabase } from './supabase'

// Finalise le profil coach (upsert + consommation du code d'invitation) à partir
// des métadonnées stockées sur le compte auth lors de l'inscription.
// Appelé après signUp() si une session existe déjà, ou plus tard depuis
// AuthContext dès qu'une session apparaît (ex: après confirmation d'email).
// Idempotent : si le profil existe déjà, il est simplement retourné.
export async function finalizeCoachSignup(userId) {
  const { data: existing } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (existing) return existing

  const { data: { user } } = await supabase.auth.getUser()
  const meta = user?.user_metadata
  if (!meta || meta.role !== 'coach') return null

  const { data: profile } = await supabase.from('profiles').upsert({
    id: userId,
    full_name: meta.full_name || '',
    email: user.email,
    role: 'coach',
    gender: null,
    coach_available: true,
  }).select().single()

  if (meta.coach_code) {
    const { data: codeRow } = await supabase
      .from('coach_codes')
      .select('id, used_by')
      .eq('code', meta.coach_code)
      .single()
    if (codeRow && !codeRow.used_by) {
      await supabase.from('coach_codes').update({ used_by: userId, used_at: new Date().toISOString() }).eq('id', codeRow.id)
    }
  }

  return profile
}
