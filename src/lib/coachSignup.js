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
// AuthContext dès qu'une session apparaît (ex: après confirmation d'email,
// ou saisie a posteriori du code sur un compte déjà créé).
// Idempotent : si le profil est déjà coach/admin, il est simplement retourné.
//
// Un trigger DB (on_auth_user_created → handle_new_user) crée un profil par
// défaut (role='athlete') dès l'insertion dans auth.users, avant même que le
// code soit saisi. On ne peut donc pas se contenter de "profil absent" comme
// signal — il faut toujours retenter la promotion tant que le rôle n'est pas
// déjà coach/admin.
//
// La promotion elle-même passe par la RPC SECURITY DEFINER claim_coach_code :
// un autre trigger (trg_protect_premium_columns) réécrit silencieusement
// `role` à son ancienne valeur pour toute requête faite en tant que
// authenticated (anti auto-promotion), donc un simple update depuis le
// client ne peut plus fonctionner — la RPC tourne en tant que postgres et
// passe ce garde-fou.
export async function finalizeCoachSignup(userId) {
  const { data: existing } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (existing && (existing.role === 'coach' || existing.role === 'admin')) return existing

  const { data: { user } } = await supabase.auth.getUser()
  const code = user?.user_metadata?.coach_code
  if (!code) return existing || null

  const { data: claimed, error } = await supabase.rpc('claim_coach_code', { p_code: code })
  if (error || !claimed) return existing || null

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return profile
}
