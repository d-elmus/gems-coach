import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AthleteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [athlete, setAthlete] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [{ data: profile }, { data: plans }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('plans').select('*').eq('user_id', id).eq('is_active', true).single(),
    ])
    setAthlete(profile)
    setPlan(plans)
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(147,22,33,0.3)', borderTopColor: '#931621' }} />
    </div>
  )

  const daysToGoal = plan?.goal_date
    ? Math.max(0, Math.round((new Date(plan.goal_date) - new Date()) / 86400000))
    : null

  const completedCount = Object.keys(plan?.completed_sessions || {}).length
  const totalSessions = plan?.weeks?.flatMap(w => w.sessions || []).length || 0

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm mb-6 hover:opacity-70 transition-opacity" style={{ color: 'var(--text3)' }}>
        ← Retour
      </button>

      <div className="flex items-center gap-4 mb-8">
        {athlete?.photo_url ? (
          <img src={athlete.photo_url} alt="" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{ background: 'var(--red)' }}>
            {athlete?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">{athlete?.full_name}</h1>
          <p className="text-sm" style={{ color: 'var(--text3)' }}>{athlete?.email}</p>
        </div>
        <div className="ml-auto flex gap-3">
          <button
            onClick={() => navigate(`/messages/${id}`)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}
          >
            💬 Message
          </button>
          {plan && (
            <button
              onClick={() => navigate(`/athletes/${id}/plan`)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'var(--red)' }}
            >
              Voir le plan →
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      {plan ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Discipline', value: plan.discipline },
            { label: 'Niveau', value: plan.level },
            { label: 'J-', value: daysToGoal !== null ? `${daysToGoal} jours` : '—' },
            { label: 'Progression', value: `${completedCount}/${totalSessions} séances` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>{label}</p>
              <p className="text-white font-semibold capitalize">{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl p-8 text-center mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-white font-semibold mb-1">Aucun plan actif</p>
          <p className="text-sm" style={{ color: 'var(--text3)' }}>Cet athlète n'a pas encore créé de plan d'entraînement.</p>
        </div>
      )}

      {/* Zones */}
      {plan?.zones?.run && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-white mb-4">Zones d'entraînement</h2>
          <div className="flex flex-col gap-2">
            {plan.zones.run.zones?.map(z => (
              <div key={z.z} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: z.c }} />
                <span className="text-xs font-bold w-6" style={{ color: 'var(--text3)' }}>{z.z}</span>
                <span className="text-sm text-white flex-1">{z.name}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text3)' }}>{z.range}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
