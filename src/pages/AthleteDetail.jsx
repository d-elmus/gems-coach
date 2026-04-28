import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SPORT_META, ZONE_COLORS, PHASE_COLORS, DAYS_SHORT } from '../lib/planHelpers'

const COACH_COLOR = '#22C5D5'

function parseDate(str) {
  return str ? new Date(str + 'T12:00:00') : new Date()
}

function getCurrentWeekIdx(plan) {
  if (!plan?.weeks?.length || !plan?.start_date) return 0
  const today = new Date(); today.setHours(0,0,0,0)
  const start = parseDate(plan.start_date); start.setHours(0,0,0,0)
  const diff = Math.floor((today - start) / (7 * 86400000))
  return Math.max(0, Math.min(diff, plan.weeks.length - 1))
}

// ─── Compact session row ──────────────────────────────────────────────────────
function SessionRow({ s }) {
  const m = SPORT_META[s.sport] || SPORT_META.run
  const d = parseDate(s.date)
  const day = DAYS_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1]
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: m.color + '20' }}>
        <span className="text-sm">{m.emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-semibold truncate">{s.label}</p>
        <p className="text-xs" style={{ color: 'var(--text3)' }}>
          {day} · {s.duration}min{s.distance ? ` · ${s.distance}${m.distUnit}` : ''}
          {s.structuredWorkout?.steps?.length > 0 ? ' · ⚡ structuré' : ''}
        </p>
      </div>
      {s.zone && (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
          style={{ background: (ZONE_COLORS[s.zone]||'#fff')+'22', color: ZONE_COLORS[s.zone]||'#fff' }}>
          {s.zone}
        </span>
      )}
      <span className="text-[10px] font-mono flex-shrink-0" style={{ color: COACH_COLOR }}>
        {s.tss} TSS
      </span>
    </div>
  )
}

// ─── Coach plan widget ────────────────────────────────────────────────────────
function CoachPlanWidget({ plan, athleteId, navigate }) {
  const currentWeekIdxDefault = getCurrentWeekIdx(plan)
  const [weekIdx, setWeekIdx] = useState(currentWeekIdxDefault)
  const weeks = plan.weeks || []
  const currentWeek = weeks[weekIdx]
  const totalSessions = weeks.reduce((a, w) => a + (w.sessions?.length || 0), 0)
  const totalTSS = weeks.reduce((a, w) => a + (w.sessions || []).reduce((b, s) => b + (s.tss || 0), 0), 0)

  const sportCounts = {}
  weeks.forEach(w => (w.sessions || []).forEach(s => {
    sportCounts[s.sport] = (sportCounts[s.sport] || 0) + 1
  }))

  const daysToGoal = plan.goal_date
    ? Math.max(0, Math.round((parseDate(plan.goal_date) - new Date()) / 86400000))
    : null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: `1px solid ${COACH_COLOR}44` }}>

      {/* Plan header bar */}
      <div className="px-6 py-5" style={{ background: `linear-gradient(135deg, ${COACH_COLOR}12, transparent)`, borderBottom: `1px solid ${COACH_COLOR}22` }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COACH_COLOR }}>
                Programme Coach
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{
                  background: plan.is_active ? 'rgba(74,222,128,0.1)' : 'rgba(250,204,21,0.1)',
                  color: plan.is_active ? '#4ade80' : '#facc15',
                  border: `1px solid ${plan.is_active ? 'rgba(74,222,128,0.3)' : 'rgba(250,204,21,0.3)'}`,
                }}>
                {plan.is_active ? '✓ Actif' : '○ Inactif — en attente d\'activation'}
              </span>
            </div>
            <h2 className="font-bold text-white text-xl leading-tight mb-2">
              {plan.event_name || plan.discipline}
            </h2>
            <div className="flex items-center gap-4 flex-wrap text-xs" style={{ color: 'var(--text3)' }}>
              <span>{weeks.length} semaines</span>
              <span>{totalSessions} séances</span>
              <span>~{totalTSS} TSS total</span>
              {plan.start_date && <span>Début {parseDate(plan.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
              {daysToGoal !== null && <span style={{ color: COACH_COLOR }}>J-{daysToGoal} avant l'objectif</span>}
            </div>
            {/* Sport breakdown */}
            <div className="flex gap-3 mt-2 flex-wrap">
              {Object.entries(sportCounts).map(([sport, count]) => {
                const m = SPORT_META[sport]
                return m ? (
                  <span key={sport} className="text-xs flex items-center gap-1" style={{ color: 'var(--text2)' }}>
                    {m.emoji} <span className="font-mono">{count}</span>
                  </span>
                ) : null
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button onClick={() => navigate(`/athletes/${athleteId}/builder?planId=${plan.id}`)}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: COACH_COLOR }}>
              ✏️ Modifier le plan
            </button>
            {!plan.is_active && (
              <div className="px-3 py-2 rounded-xl text-xs text-center"
                style={{ background: 'rgba(250,204,21,0.06)', color: 'var(--text3)', border: '1px solid rgba(250,204,21,0.2)' }}>
                L'athlète active ce plan depuis son app → onglet Objectifs
              </div>
            )}
            <button onClick={() => navigate(`/athletes/${athleteId}/plans`)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-center"
              style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
              📋 Tous les plans
            </button>
          </div>
        </div>
      </div>

      {/* Week tabs */}
      <div className="px-6 py-2 overflow-x-auto" style={{ borderBottom: `1px solid ${COACH_COLOR}22` }}>
        <div className="flex gap-1.5 items-center min-w-max">
          {weeks.map((w, i) => {
            const isCurrent = i === currentWeekIdxDefault
            const isSelected = i === weekIdx
            return (
              <button key={i} onClick={() => setWeekIdx(i)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative"
                style={{
                  background: isSelected ? (PHASE_COLORS[w.phase] || 'var(--red)') : 'var(--surface2)',
                  color: isSelected ? '#fff' : isCurrent ? COACH_COLOR : 'var(--text3)',
                  border: isSelected ? 'none' : `1px solid ${isCurrent ? COACH_COLOR + '55' : 'var(--border)'}`,
                }}>
                S{w.weekNum}
                {w.isRecovery && <span className="text-[7px] ml-0.5 opacity-70">R</span>}
                {isCurrent && !isSelected && <span className="text-[7px] ml-0.5" style={{ color: COACH_COLOR }}>●</span>}
                {w.sessions?.length > 0 && (
                  <span className="ml-1 font-bold" style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : COACH_COLOR }}>
                    {w.sessions.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Current week */}
      {currentWeek && (
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="font-bold text-white">Semaine {currentWeek.weekNum}</h3>
            <span className="text-xs px-2 py-0.5 rounded font-bold"
              style={{ background: (PHASE_COLORS[currentWeek.phase]||'#555')+'33', color: PHASE_COLORS[currentWeek.phase]||'#888' }}>
              {currentWeek.phase}
            </span>
            {currentWeek.isRecovery && (
              <span className="text-xs px-2 py-0.5 rounded font-bold"
                style={{ background: `${COACH_COLOR}15`, color: COACH_COLOR }}>Récup</span>
            )}
            <span className="text-xs ml-auto" style={{ color: 'var(--text3)' }}>
              {parseDate(currentWeek.weekStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
            <span className="text-xs font-mono" style={{ color: COACH_COLOR }}>
              TSS {currentWeek.sessions?.reduce((a,s)=>a+(s.tss||0),0)} / {currentWeek.targetTSS}
            </span>
          </div>

          {currentWeek.note && (
            <div className="mb-3 px-3 py-2 rounded-xl text-xs italic" style={{ background: 'rgba(34,197,212,0.06)', color: COACH_COLOR, border: `1px solid ${COACH_COLOR}22` }}>
              📝 {currentWeek.note}
            </div>
          )}

          {currentWeek.sessions?.length === 0 ? (
            <div className="text-center py-6 rounded-xl" style={{ border: '1px dashed var(--border)' }}>
              <p className="text-sm mb-2" style={{ color: 'var(--text3)' }}>Aucune séance planifiée</p>
              <button onClick={() => navigate(`/athletes/${athleteId}/builder?planId=${plan.id}`)}
                className="text-xs font-bold" style={{ color: COACH_COLOR }}>
                + Ajouter des séances dans le plan →
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {currentWeek.sessions.map(s => <SessionRow key={s.id} s={s} />)}
              <button onClick={() => navigate(`/athletes/${athleteId}/builder?planId=${plan.id}`)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{ border: `1px dashed ${COACH_COLOR}44`, color: COACH_COLOR }}>
                ✏️ Modifier ce plan
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AthleteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { coach } = useAuth()

  const { state: navState } = useLocation()

  const [athlete, setAthlete]       = useState(null)
  const [coachPlan, setCoachPlan]   = useState(null)
  const [data, setData]             = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => { fetchData() }, [id, navState?.refresh])

  async function fetchData() {
    const [{ data: profile }, { data: allPlans }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('plans')
        .select('id,event_name,discipline,level,start_date,goal_date,is_active,pbs,zones,equipment,athlete_grades,hrmax,age,athlete_metrics,created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
    ])
    setAthlete(profile)

    const plans = allPlans || []
    const refPlan = plans.find(p => p.is_active) || plans[0] || null
    setData(refPlan)

    const coachPlanMeta = plans.find(p => p.athlete_metrics?.coachId === coach?.id)
    if (coachPlanMeta) {
      const { data: full } = await supabase.from('plans').select('*').eq('id', coachPlanMeta.id).single()
      setCoachPlan(full)
    }
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
      <button onClick={() => navigate('/')} className="text-sm mb-6 hover:opacity-70 block" style={{ color: 'var(--text3)' }}>
        ← Retour
      </button>

      {/* Athlete header */}
      <div className="flex items-center gap-4 mb-8">
        {athlete?.photo_url
          ? <img src={athlete.photo_url} alt="" className="w-16 h-16 rounded-full object-cover" />
          : <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0" style={{ background: 'var(--red)' }}>
              {athlete?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
        }
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white">{athlete?.full_name}</h1>
          <p className="text-sm mb-1" style={{ color: 'var(--text3)' }}>{athlete?.email}</p>
          <div className="flex gap-2 flex-wrap">
            {athlete?.age    && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>{athlete.age} ans</span>}
            {athlete?.gender && <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>{athlete.gender}</span>}
            {(data?.hrmax || athlete?.hrmax) && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>FCmax {data?.hrmax || athlete?.hrmax}</span>}
            {data?.level     && <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>{data.level}</span>}
            {data?.discipline && <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(147,22,33,0.15)', color: 'var(--red)' }}>{data.discipline}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => navigate(`/messages/${id}`)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
            💬 Message
          </button>
          <button onClick={() => navigate(`/athletes/${id}/builder`)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--red)' }}>
            + Nouveau plan
          </button>
        </div>
      </div>

      {/* ── Coach plan widget ── */}
      <div className="mb-8">
        {coachPlan
          ? <CoachPlanWidget plan={coachPlan} athleteId={id} navigate={navigate} />
          : (
            <div className="rounded-2xl p-6 flex items-center gap-5"
              style={{ background: `${COACH_COLOR}06`, border: `1px dashed ${COACH_COLOR}33` }}>
              <div className="flex-1">
                <p className="font-semibold text-white mb-1">Aucun programme coach créé</p>
                <p className="text-sm" style={{ color: 'var(--text3)' }}>
                  Crée un programme personnalisé pour cet athlète. Il pourra l'activer depuis son app.
                </p>
              </div>
              <button onClick={() => navigate(`/athletes/${id}/builder`)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white flex-shrink-0"
                style={{ background: 'var(--red)' }}>
                ✏️ Créer un programme
              </button>
            </div>
          )
        }
      </div>

      {/* ── Athlete stats grid ── */}
      {(Object.keys(pbs).length > 0 || Object.keys(zones).length > 0 || Object.keys(equipment).length > 0 || Object.keys(grades).length > 0) && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text3)' }}>
            Données athlète
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {Object.keys(pbs).length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <h3 className="font-bold text-white mb-4">Records personnels</h3>
                <div className="flex flex-col gap-2.5">
                  {pbs.pace5k  && <div className="flex justify-between items-center"><span className="text-sm" style={{ color: 'var(--text3)' }}>Allure 5K</span><span className="text-sm font-mono font-bold text-white">{pbs.pace5k} /km</span></div>}
                  {pbs.runTime && <div className="flex justify-between items-center"><span className="text-sm" style={{ color: 'var(--text3)' }}>Temps course ({pbs.runDist || 'semi'})</span><span className="text-sm font-mono font-bold text-white">{pbs.runTime}</span></div>}
                  {pbs.ftp     && <div className="flex justify-between items-center"><span className="text-sm" style={{ color: 'var(--text3)' }}>FTP vélo</span><span className="text-sm font-mono font-bold text-white">{pbs.ftp} W</span></div>}
                  {pbs.css     && <div className="flex justify-between items-center"><span className="text-sm" style={{ color: 'var(--text3)' }}>CSS natation</span><span className="text-sm font-mono font-bold text-white">{pbs.css} /100m</span></div>}
                  {pbs.weight  && <div className="flex justify-between items-center"><span className="text-sm" style={{ color: 'var(--text3)' }}>Poids</span><span className="text-sm font-mono font-bold text-white">{pbs.weight} kg</span></div>}
                </div>
              </div>
            )}

            {Object.keys(grades).length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <h3 className="font-bold text-white mb-4">Niveau par discipline</h3>
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

            {zones.run?.zones && (
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white">Zones Course</h3>
                  {zones.run.vma && <span className="text-xs font-mono" style={{ color: 'var(--text3)' }}>VMA {zones.run.vma} km/h</span>}
                </div>
                <div className="flex flex-col gap-2">
                  {zones.run.zones.map(z => (
                    <div key={z.z} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: z.c }} />
                      <span className="text-xs font-bold w-6 flex-shrink-0" style={{ color: 'var(--text3)' }}>{z.z}</span>
                      <span className="text-sm text-white flex-1">{z.name}</span>
                      <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text3)' }}>{z.range}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {zones.bike?.hrZones && (
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white">Zones Vélo</h3>
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

            {Object.keys(equipment).length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <h3 className="font-bold text-white mb-4">Équipement</h3>
                <div className="flex flex-wrap gap-2">
                  {equipment.gpsWatch   && <span className="text-sm px-3 py-1.5 rounded-xl" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>⌚ Montre GPS</span>}
                  {equipment.powerMeter && <span className="text-sm px-3 py-1.5 rounded-xl" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>⚡ Capteur de puissance</span>}
                  {equipment.trainer    && <span className="text-sm px-3 py-1.5 rounded-xl" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>🚴 Home trainer</span>}
                  {equipment.pool       && <span className="text-sm px-3 py-1.5 rounded-xl" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>🏊 Piscine {equipment.pool}m</span>}
                  {equipment.strength   && <span className="text-sm px-3 py-1.5 rounded-xl" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>💪 Salle de sport</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!data && !coachPlan && (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-3xl mb-3">📊</p>
          <p className="font-semibold text-white mb-1">Aucune donnée disponible</p>
          <p className="text-sm" style={{ color: 'var(--text3)' }}>L'athlète n'a pas encore renseigné ses données.</p>
        </div>
      )}
    </div>
  )
}
