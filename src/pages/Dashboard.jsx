import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { coach } = useAuth()
  const navigate = useNavigate()
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (coach?.id) fetchAthletes()
  }, [coach?.id])

  async function fetchAthletes() {
    const { data } = await supabase
      .from('coach_athletes')
      .select(`
        id, status, started_at,
        athlete:athlete_id ( id, full_name, email, photo_url, gender )
      `)
      .eq('coach_id', coach.id)
      .eq('status', 'active')
    setAthletes(data || [])
    setLoading(false)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
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
          {athletes.map(({ id, athlete, started_at }) => (
            <button
              key={id}
              onClick={() => navigate(`/athletes/${athlete.id}`)}
              className="rounded-2xl p-5 text-left transition-all hover:scale-[1.02]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                {athlete.photo_url ? (
                  <img src={athlete.photo_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                ) : (
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ background: 'var(--red)' }}>
                    {athlete.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white">{athlete.full_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text3)' }}>{athlete.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(34,197,212,0.1)', color: 'var(--cyan)' }}>
                  Actif
                </span>
                <span className="text-xs" style={{ color: 'var(--text3)' }}>
                  Depuis {new Date(started_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
