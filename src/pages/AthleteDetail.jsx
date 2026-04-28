import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AthleteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [athlete, setAthlete] = useState(null)
  const [data, setData] = useState(null) // plan data used only for zones/PBs/equipment
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [{ data: profile }, { data: planData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('plans').select('pbs,zones,equipment,athlete_grades,hrmax,age,discipline,level,goal_date').eq('user_id', id).eq('is_active', true).single(),
    ])
    setAthlete(profile)
    setData(planData)
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(147,22,33,0.3)', borderTopColor: '#931621' }} />
    </div>
  )

  const pbs = data?.pbs || {}
  const zones = data?.zones || {}
  const equipment = data?.equipment || {}
  const grades = data?.athlete_grades || {}

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <button onClick={() => navigate('/')} className="text-sm mb-6 hover:opacity-70 block" style={{ color: 'var(--text3)' }}>
        ← Retour
      </button>

      <div className="flex items-center gap-4 mb-8">
        {athlete?.photo_url ? (
          <img src={athlete.photo_url} alt="" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0" style={{ background: 'var(--red)' }}>
            {athlete?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white">{athlete?.full_name}</h1>
          <p className="text-sm mb-1" style={{ color: 'var(--text3)' }}>{athlete?.email}</p>
          <div className="flex gap-2 flex-wrap">
            {athlete?.age   && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>{athlete.age} ans</span>}
            {athlete?.gender && <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>{athlete.gender}</span>}
            {(data?.hrmax || athlete?.hrmax) && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>FCmax {data?.hrmax || athlete?.hrmax}</span>}
            {data?.level && <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>{data.level}</span>}
            {data?.discipline && <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(147,22,33,0.15)', color: 'var(--red)' }}>{data.discipline}</span>}
          </div>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <button onClick={() => navigate(`/messages/${id}`)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
            💬 Message
          </button>
          <button onClick={() => navigate(`/athletes/${id}/plans`)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
            📋 Plans
          </button>
          <button onClick={() => navigate(`/athletes/${id}/builder`)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--red)' }}>
            ✏️ Construire un programme
          </button>
        </div>
      </div>

      {/* Data grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Records personnels */}
        {Object.keys(pbs).length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-white mb-4">Records personnels</h2>
            <div className="flex flex-col gap-2.5">
              {pbs.pace5k && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text3)' }}>Allure 5K</span>
                  <span className="text-sm font-mono font-bold text-white">{pbs.pace5k} /km</span>
                </div>
              )}
              {pbs.runTime && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text3)' }}>Temps course ({pbs.runDist || 'semi'})</span>
                  <span className="text-sm font-mono font-bold text-white">{pbs.runTime}</span>
                </div>
              )}
              {pbs.ftp && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text3)' }}>FTP vélo</span>
                  <span className="text-sm font-mono font-bold text-white">{pbs.ftp} W</span>
                </div>
              )}
              {pbs.css && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text3)' }}>CSS natation</span>
                  <span className="text-sm font-mono font-bold text-white">{pbs.css} /100m</span>
                </div>
              )}
              {pbs.weight && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text3)' }}>Poids</span>
                  <span className="text-sm font-mono font-bold text-white">{pbs.weight} kg</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Niveau par discipline */}
        {Object.keys(grades).length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-white mb-4">Niveau par discipline</h2>
            <div className="flex flex-col gap-3">
              {Object.entries(grades).map(([sport, grade]) => (
                <div key={sport} className="flex items-center justify-between">
                  <span className="text-sm capitalize" style={{ color: 'var(--text3)' }}>{sport}</span>
                  <span className="text-xs px-3 py-1 rounded-full font-semibold capitalize"
                    style={{ background: 'rgba(147,22,33,0.12)', color: 'var(--red)' }}>
                    {grade}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Zones Course */}
        {zones.run?.zones && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white">Zones Course</h2>
              {zones.run.vma && <span className="text-xs font-mono" style={{ color: 'var(--text3)' }}>VMA {zones.run.vma} km/h</span>}
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {zones.run.zones.map(z => (
                <div key={z.z} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: z.c }} />
                  <span className="text-xs font-bold w-6 flex-shrink-0" style={{ color: 'var(--text3)' }}>{z.z}</span>
                  <span className="text-sm text-white flex-1">{z.name}</span>
                  <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text3)' }}>{z.range}</span>
                </div>
              ))}
            </div>
            {zones.run.hrZones && (
              <div className="pt-4 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>Zones FC</p>
                {Object.entries(zones.run.hrZones).filter(([k]) => k.startsWith('z')).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text3)' }}>{v.label}</span>
                    <span className="font-mono text-white">{v.min}–{v.max === 999 ? '∞' : v.max} bpm</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Zones Vélo */}
        {zones.bike?.hrZones && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white">Zones Vélo</h2>
              {zones.bike.ftp && <span className="text-xs font-mono" style={{ color: 'var(--text3)' }}>FTP {zones.bike.ftp} W</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              {Object.entries(zones.bike.hrZones).filter(([k]) => k.startsWith('z')).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text3)' }}>{v.label}</span>
                  <span className="font-mono text-white">{v.min}–{v.max === 999 ? '∞' : v.max} bpm</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Équipement */}
        {Object.keys(equipment).length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-white mb-4">Équipement disponible</h2>
            <div className="flex flex-wrap gap-2">
              {equipment.gpsWatch    && <span className="text-sm px-3 py-1.5 rounded-xl" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>⌚ Montre GPS</span>}
              {equipment.powerMeter  && <span className="text-sm px-3 py-1.5 rounded-xl" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>⚡ Capteur de puissance</span>}
              {equipment.trainer     && <span className="text-sm px-3 py-1.5 rounded-xl" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>🚴 Home trainer</span>}
              {equipment.pool        && <span className="text-sm px-3 py-1.5 rounded-xl" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>🏊 Piscine {equipment.pool}m</span>}
              {equipment.strength    && <span className="text-sm px-3 py-1.5 rounded-xl" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>💪 Salle de sport</span>}
            </div>
          </div>
        )}

        {/* Aucune donnée */}
        {!data && (
          <div className="col-span-2 rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-3xl mb-3">📊</p>
            <p className="font-semibold text-white mb-1">Aucune donnée disponible</p>
            <p className="text-sm" style={{ color: 'var(--text3)' }}>
              L'athlète n'a pas encore renseigné ses données (zones, records, équipement).<br />
              Tu peux quand même lui construire un programme.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
