import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { finalizeCoachSignup } from '../lib/coachSignup'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [coach, setCoach] = useState(null)
  const [hasSession, setHasSession] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session?.user)
      if (session?.user) fetchCoach(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session?.user)
      if (session?.user) fetchCoach(session.user.id)
      else { setCoach(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Résout le profil coach pour un userId. Ne déconnecte JAMAIS la session :
  // un compte authentifié mais pas encore coach (ex: en attente de son code
  // d'invitation) reste connecté, l'UI lui propose de saisir son code plutôt
  // que de le rejeter en silence.
  async function resolveCoach(userId) {
    let { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (!data) data = await finalizeCoachSignup(userId)
    if (!data || (data.role !== 'coach' && data.role !== 'admin')) {
      setCoach(null)
      return null
    }
    setCoach(data)
    return data
  }

  async function fetchCoach(userId) {
    await resolveCoach(userId)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }
    const profile = await resolveCoach(data.user.id)
    if (!profile) return { error: { message: 'needs_code' } }
    return { error: null }
  }

  // Associe un code d'invitation à la session en cours puis retente la
  // finalisation du profil coach. Permet à un compte déjà créé (auth confirmé
  // mais coach_code manquant côté métadonnées) de terminer son inscription
  // sans repartir de zéro.
  async function claimCoachCode(code) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: { message: 'no_session' } }
    const { error: metaErr } = await supabase.auth.updateUser({
      data: { coach_code: code.trim().toUpperCase() },
    })
    if (metaErr) return { error: metaErr }
    const profile = await resolveCoach(user.id)
    if (!profile) return { error: { message: 'invalid_code' } }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setCoach(null)
    setHasSession(false)
  }

  async function updateCoach(updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', coach.id)
      .select()
      .single()
    if (!error && data) setCoach(data)
    return { error }
  }

  return (
    <AuthContext.Provider value={{ coach, hasSession, loading, signIn, signOut, updateCoach, claimCoachCode }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
