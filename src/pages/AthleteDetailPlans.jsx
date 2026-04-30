import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PHASE_COLORS, SPORT_META } from '../lib/planHelpers'
import { parseDate } from '../lib/dateUtils'

const COACH_COLOR = '#22C5D5'

function fmt(str) {
  const d = parseDate(str)
  return d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

export default function AthleteDetailPlans() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { coach } = useAuth()

  const [plans, setPlans]     = useState([])
  const [athlete, setAthlete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [{ data: profile }, { data: plansData }] = await Promise.all([
      supabase.from('profiles').select('full_name,photo_url').eq('id', id).single(),
      supabase.from('plans')
        .select('id,event_name,discipline,level,start_date,goal_date,is_active,weeks,athlete_metrics,created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
    ])
    setAthlete(profile)
    setPlans(plansData || [])
    setLoading(false)
  }

  async function deletePlan(plan) {
    if (!window.confirm(`Supprimer le plan "${plan.event_name || plan.discipline}" ? Cette action est irréversible.`)) return
    setDeleting(plan.id)
    const { error } = await supabase.from('plans').delete().eq('id', plan.id).select('id')
    setDeleting(null)
    if (error) { alert('Erreur : ' + error.message); return }
    setPlans(prev => prev.filter(p => p.id !== plan.id))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(147,22,33,0.3)', borderTopColor: '#931621' }} />
    </div>
  )

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => navigate(`/athletes/${id}`)} className="text-sm mb-6 hover:opacity-70 block" style={{ color: 'var(--text3)' }}>
        ← Retour à {athlete?.full_name}
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">
          Plans de {athlete?.full_name}
          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text3)' }}>({plans.length})</span>
        </h1>
        <button onClick={() => navigate(`/athletes/${id}/builder`)}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--red)' }}>
          ✏️ Créer un plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-4xl mb-4">📋</p>
          <p className="font-semibold text-white mb-1">Aucun plan</p>
          <p className="text-sm mb-5" style={{ color: 'var(--text3)' }}>
            Crée le premier programme d'entraînement de {athlete?.full_name}.
          </p>
          <button onClick={() => navigate(`/athletes/${id}/builder`)}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'var(--red)' }}>
            ✏️ Créer un plan
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map(plan => {
            const totalSessions = (plan.weeks || []).reduce((acc, w) => acc + (w.sessions?.length || 0), 0)
            const totalWeeks = (plan.weeks || []).length
            const isCoachPlan = plan.athlete_metrics?.coachId === coach?.id
            const sportCounts = {}
            ;(plan.weeks || []).forEach(w => (w.sessions || []).forEach(s => {
              sportCounts[s.sport] = (sportCounts[s.sport] || 0) + 1
            }))

            return (
              <div key={plan.id} className="rounded-2xl p-5 transition-all"
                style={{ background: 'var(--surface)', border: `1px solid ${isCoachPlan ? COACH_COLOR + '33' : 'var(--border)'}` }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h2 className="font-bold text-white truncate">{plan.event_name || plan.discipline}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0`}
                        style={{
                          background: plan.is_active ? 'rgba(74,222,128,0.1)' : 'rgba(250,204,21,0.1)',
                          color: plan.is_active ? '#4ade80' : '#facc15',
                        }}>
                        {plan.is_active ? '✓ Actif' : '○ Inactif'}
                      </span>
                      {isCoachPlan && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                          style={{ background: `${COACH_COLOR}22`, color: COACH_COLOR }}>
                          👤 Coach
                        </span>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex gap-3 text-xs flex-wrap mb-2" style={{ color: 'var(--text3)' }}>
                      <span className="capitalize">{plan.discipline}</span>
                      <span className="capitalize">{plan.level}</span>
                      {plan.start_date && <span>Début {fmt(plan.start_date)}</span>}
                      {plan.goal_date  && <span>Objectif {fmt(plan.goal_date)}</span>}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs" style={{ color: COACH_COLOR }}>{totalWeeks} sem.</span>
                      <span className="text-xs" style={{ color: 'var(--text2)' }}>{totalSessions} séances</span>
                      {Object.entries(sportCounts).slice(0, 4).map(([sport, count]) => {
                        const m = SPORT_META[sport]
                        return m ? (
                          <span key={sport} className="text-xs">{m.emoji} {count}</span>
                        ) : null
                      })}
                    </div>

                    {/* Phase strip */}
                    {totalWeeks > 0 && (
                      <div className="flex gap-0.5 mt-3 h-1.5 rounded-full overflow-hidden">
                        {(plan.weeks || []).map((w, i) => (
                          <div key={i} className="flex-1 rounded-full"
                            style={{ background: w.isRecovery ? COACH_COLOR + '66' : (PHASE_COLORS[w.phase] || '#555') + 'BB' }} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {isCoachPlan && (
                      <button onClick={() => navigate(`/athletes/${id}/builder?planId=${plan.id}`)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                        style={{ background: `${COACH_COLOR}22`, color: COACH_COLOR, border: `1px solid ${COACH_COLOR}44` }}>
                        ✏️ Modifier
                      </button>
                    )}
                    <button onClick={() => deletePlan(plan)}
                      disabled={deleting === plan.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-opacity"
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        color: '#f87171',
                        opacity: deleting === plan.id ? 0.5 : 1,
                      }}>
                      {deleting === plan.id ? '...' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
