import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { coach } = useAuth()
  const navigate = useNavigate()
  const [athletes, setAthletes] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

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
    setAthletes(all.filter(r => r.status === 'active'))
    setPending(all.filter(r => r.status === 'pending'))
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
              <div key={id} className="rounded-2xl p-4 flex items-center gap-4" style={{ background: 'var(--surface)', border: '1px solid rgba(147,22,33,0.3)' }}>
                {athlete.photo_url ? (
                  <img src={athlete.photo_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0" style={{ background: 'var(--red)' }}>
                    {athlete.full_name?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">{athlete.full_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text3)' }}>{athlete.email}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => decline(id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text3)' }}
                  >
                    Refuser
                  </button>
                  <button
                    onClick={() => accept(id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                    style={{ background: 'var(--red)' }}
                  >
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
