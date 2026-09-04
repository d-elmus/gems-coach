import { supabase } from './supabase'

// Finalise le profil coach à partir d'un code d'invitation stocké dans les
// métadonnées du compte auth au moment de l'inscription.
//
// Le rôle n'est JAMAIS déduit de user_metadata.role : ce champ est contrôlé
// par le client (n'importe quel utilisateur connecté peut l'écrire via
// supabase.auth.updateUser({ data: { role: 'coach' } })), donc s'y fier
// reviendrait à laisser n'importe quel athlète s'auto-promouvoir coach.
// Seul un coach_code valide et pas encore utilisé peut produire un profil
// role='coach' — et on le consomme de façon atomique (UPDATE ... WHERE
// used_by IS NULL) pour empêcher deux finalisations concurrentes de
// réclamer le même code.
//
// Appelé après signUp() si une session existe déjà, ou plus tard depuis
// AuthContext dès qu'une session apparaît (ex: après confirmation d'email).
// Idempotent : si le profil existe déjà, il est simplement retourné.
export async function finalizeCoachSignup(userId) {
  const { data: existing } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (existing) return existing

  const { data: { user } } = await supabase.auth.getUser()
  const code = user?.user_metadata?.coach_code
  if (!code) return null

  const { data: claimed } = await supabase
    .from('coach_codes')
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq('code', code)
    .is('used_by', null)
    .select('id')
    .single()
  if (!claimed) return null

  const { data: profile } = await supabase.from('profiles').upsert({
    id: userId,
    full_name: user.user_metadata?.full_name || '',
    email: user.email,
    role: 'coach',
    gender: null,
    coach_available: true,
  }).select().single()

  return profile
}
