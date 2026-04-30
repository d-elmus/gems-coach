import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { parseDate } from '../lib/dateUtils'

const COACH_COLOR = '#22C5D5'

export default function Dashboard() {
  const { coach } = useAuth()
  const navigate = useNavigate()
  const [athletes, setAthletes] = useState([])
  const [pending, setPending]   = useState([])
  const [planMap, setPlanMap]   = useState({}) // athleteId → plan metadata
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (coach?.id) fetchAll()
  }, [coach?.id])

  async function fetchAll() {
    const { data } = await supabase
      .from('coach_athletes')
      .select(`id, status, started_at, athlete:athlete_id ( id, full_name, email, photo_url )`)
      .eq('coach_id', coach.id)
      .in('status', ['active', 'pending'])

    const all = data || []
    const activeAthletes = all.filter(r => r.status === 'active')
    const pendingAthletes = all.filter(r => r.status === 'pending')
    setAthletes(activeAthletes)
    setPending(pendingAthletes)

    // Load plan metadata for all active athletes in one query
    if (activeAthletes.length > 0) {
      const ids = activeAthletes.map(r => r.athlete.id)
      const { data: plansData } = await supabase
        .from('plans')
        .select('id,user_id,event_name,discipline,is_active,start_date,goal_date,athlete_metrics')
        .in('user_id', ids)
        .order('created_at', { ascending: false })

      // For each athlete, find their coach plan
      const map = {}
      ;(plansData || []).forEach(plan => {
        const uid = plan.user_id
        if (!map[uid] && plan.athlete_metrics?.coachId === coach.id) {
          map[uid] = plan
        }
      })
      setPlanMap(map)
    }

    setLoading(false)
  }

  async function accept(relationId) {
    await supabase.from('coach_athletes').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', relationId)
    fetchAll()
  }

  async function decline(relationId) {
    await supabase.from('coach_athletes').delete().eq('id', relationId)
    fetchAll()
  }

  return (
    <div className="p-8">

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-white">Demandes en attente</h2>
            <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ background: 'var(--red)' }}>
              {pending.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {pending.map(({ id, athlete }) => (
              <div key={id} className="rounded-2xl p-4 flex items-center gap-4"
                style={{ background: 'var(--surface)', border: '1px solid rgba(147,22,33,0.3)' }}>
                {athlete.photo_url
                  ? <img src={athlete.photo_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                  : <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0" style={{ background: 'var(--red)' }}>
                      {athlete.full_name?.[0]?.toUpperCase()}
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">{athlete.full_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text3)' }}>{athlete.email}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => decline(id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text3)' }}>
                    Refuser
                  </button>
                  <button onClick={() => accept(id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: 'var(--red)' }}>
                    Accepter ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active athletes */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Mes athlètes</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>
            {athletes.length} athlète{athletes.length !== 1 ? 's' : ''} actif{athletes.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(147,22,33,0.3)', borderTopColor: '#931621' }} />
        </div>
      ) : athletes.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-4xl mb-4">👥</p>
          <p className="text-white font-semibold mb-2">Aucun athlète pour l'instant</p>
          <p className="text-sm" style={{ color: 'var(--text3)' }}>
            Les athlètes te rejoindront depuis l'app GEMS en cherchant ton profil.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {athletes.map(({ id: relId, athlete, started_at }) => {
            const plan = planMap[athlete.id]
            const hasPlan = !!plan
            const totalSessions = 0 // sessions count not loaded at this level (perf)
            const daysToGoal = plan?.goal_date
              ? Math.max(0, Math.round((parseDate(plan.goal_date) - new Date()) / 86400000))
              : null

            return (
              <div key={relId}
                onClick={() => navigate(`/athletes/${athlete.id}`)}
                className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

                {/* Athlete info */}
                <div className="flex items-center gap-3 p-5 pb-4">
                  {athlete.photo_url
                    ? <img src={athlete.photo_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0" style={{ background: 'var(--red)' }}>
                        {athlete.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{athlete.full_name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text3)' }}>{athlete.email}</p>
                  </div>
                  {daysToGoal !== null && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold" style={{ color: COACH_COLOR }}>J-{daysToGoal}</p>
                      <p className="text-[9px]" style={{ color: 'var(--text3)' }}>objectif</p>
                    </div>
                  )}
                </div>

                {/* Plan status */}
                {hasPlan ? (
                  <div className="px-5 pb-4">
                    <div className="rounded-xl p-3" style={{ background: `${COACH_COLOR}08`, border: `1px solid ${COACH_COLOR}22` }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-white truncate">{plan.event_name || plan.discipline}</span>
                        <span className="text-xs flex-shrink-0 ml-2 px-1.5 py-0.5 rounded font-bold"
                          style={{ background: plan.is_active ? 'rgba(74,222,128,0.1)' : 'rgba(250,204,21,0.08)', color: plan.is_active ? '#4ade80' : '#facc15' }}>
                          {plan.is_active ? '● Actif' : '○ Inactif'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text3)' }}>
                        <span>{plan.discipline}</span>
                        {plan.start_date && <span>→ {parseDate(plan.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 pb-4">
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/athletes/${athlete.id}/builder`) }}
                      className="w-full py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ border: `1px dashed ${COACH_COLOR}44`, color: COACH_COLOR }}>
                      + Créer un programme
                    </button>
                  </div>
                )}

                <div className="px-5 pb-4 flex items-center justify-between">
                  <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(34,197,212,0.08)', color: COACH_COLOR }}>
                    Coach depuis {new Date(started_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>Voir →</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
