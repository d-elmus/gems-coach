import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const Ctx = createContext(null)

// Table absente = db/clubs.sql pas encore exécuté.
export function isMissingTable(error) {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202' ||
    /does not exist|could not find the (table|function)/i.test(error.message || '')
}

function readSpace() {
  try { return localStorage.getItem('gems.space') } catch { return null }
}

// Club courant de l'utilisateur + ses rôles, et l'« espace » affiché
// (« club » = administration, « coach » = suivi de ses athlètes).
export function ClubProvider({ children }) {
  const { coach } = useAuth()
  const [club, setClub] = useState(null)
  const [membership, setMembership] = useState(null)
  const [groups, setGroups] = useState([])
  const [staff, setStaff] = useState([]) // coachs du club : { user_id, roles, profile }
  const [memberCount, setMemberCount] = useState(0)
  const [roleRequests, setRoleRequests] = useState(0) // demandes coach/admin à valider (admins)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [space, setSpaceState] = useState(readSpace() || 'club')

  const load = useCallback(async () => {
    if (!coach?.id) return
    // Rattache d'éventuelles invitations envoyées à cet email.
    await supabase.rpc('claim_club_invites').then(() => {}, () => {})

    const { data: rows, error } = await supabase
      .from('club_members')
      .select('*, club:club_id(*)')
      .eq('user_id', coach.id)
      .eq('status', 'active')
      .order('joined_at', { ascending: true })

    if (isMissingTable(error)) { setSetupNeeded(true); setLoading(false); return }
    setSetupNeeded(false)

    // Un club où l'on est staff en priorité.
    const mine = (rows || []).filter(r => r.club && (r.roles?.includes('admin') || r.roles?.includes('coach')))
    const m = mine[0] || null
    setMembership(m)
    setClub(m?.club || null)

    if (m?.club) {
      const [{ data: g }, { data: members }, { count }, { count: requests }] = await Promise.all([
        supabase.from('club_groups').select('*').eq('club_id', m.club_id).order('created_at'),
        supabase.from('club_members').select('user_id, roles, profile:user_id(id, full_name, photo_url, email)')
          .eq('club_id', m.club_id).eq('status', 'active').contains('roles', ['coach']),
        supabase.from('club_members').select('id', { count: 'exact', head: true })
          .eq('club_id', m.club_id).contains('roles', ['athlete']),
        // Colonne absente (V3 non exécuté) : erreur ignorée → 0.
        supabase.from('club_members').select('id', { count: 'exact', head: true })
          .eq('club_id', m.club_id).not('requested_role', 'is', null),
      ])
      setGroups(g || [])
      setStaff(members || [])
      setMemberCount(count || 0)
      setRoleRequests(requests || 0)
    }
    setLoading(false)
  }, [coach?.id])

  useEffect(() => { load() }, [load])

  const isAdmin = !!membership?.roles?.includes('admin')
  const effectiveSpace = isAdmin ? space : 'coach'

  function setSpace(s) {
    setSpaceState(s)
    try { localStorage.setItem('gems.space', s) } catch { /* stockage indisponible */ }
  }

  return (
    <Ctx.Provider value={{
      club, membership, groups, staff, memberCount, roleRequests, isAdmin, setupNeeded, loading,
      space: effectiveSpace, setSpace, reload: load,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useClub = () => useContext(Ctx)
