import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [coach, setCoach] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchCoach(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchCoach(session.user.id)
      else { setCoach(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchCoach(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setCoach(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setCoach(null)
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
    <AuthContext.Provider value={{ coach, loading, signIn, signOut, updateCoach }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
