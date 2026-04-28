import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SPORT_OPTIONS = [
  { value: 'swim',     label: '🏊 Natation', color: '#0BBCD4' },
  { value: 'bike',     label: '🚴 Vélo',     color: '#F59E0B' },
  { value: 'run',      label: '🏃 Course',   color: '#EF4444' },
  { value: 'brick',    label: '🔗 Brick',    color: '#8B5CF6' },
  { value: 'strength', label: '💪 Renfo',    color: '#10B981' },
]
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAYS_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const COACH_COLOR = '#22C5D5'

// ─── Add Session Rule Modal ───────────────────────────────────────────────────
function RuleModal({ onAdd, onClose }) {
  const [form, setForm] = useState({ sport: 'run', label: '', dayOfWeek: 0, duration: 45, note: '', repeat: 1 })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-lg">Ajouter une séance</h3>
          <button onClick={onClose} style={{ color: 'var(--text3)' }}>✕</button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Sport */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>Sport</label>
            <div className="flex gap-2 flex-wrap">
              {SPORT_OPTIONS.map(s => (
                <button key={s.value} onClick={() => setForm(f => ({ ...f, sport: s.value }))}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ background: form.sport === s.value ? s.color : 'var(--surface2)', color: form.sport === s.value ? '#fff' : 'var(--text2)', border: `1px solid ${form.sport === s.value ? s.color : 'var(--border)'}` }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>Titre de la séance</label>
            <input value={form.label} onChange={set('label')} placeholder="Ex: Sortie longue endurance fondamentale"
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Jour */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>Jour de la semaine</label>
              <div className="flex gap-1 flex-wrap">
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => setForm(f => ({ ...f, dayOfWeek: i }))}
                    className="w-8 h-8 rounded-lg text-xs font-bold"
                    style={{ background: form.dayOfWeek === i ? COACH_COLOR : 'var(--surface2)', color: form.dayOfWeek === i ? '#fff' : 'var(--text2)' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            {/* Durée */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>Durée (min)</label>
              <input type="number" value={form.duration} onChange={set('duration')} min={10} max={480}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
            </div>
          </div>

          {/* Répétition */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>
              Répéter sur <span style={{ color: COACH_COLOR }}>{form.repeat}</span> semaine{form.repeat > 1 ? 's' : ''}
            </label>
            <input type="range" min={1} max={24} value={form.repeat} onChange={set('repeat')}
              className="w-full" style={{ accentColor: COACH_COLOR }} />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text3)' }}>
              <span>1 sem.</span><span>12 sem.</span><span>24 sem.</span>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>Note coach (optionnel)</label>
            <textarea value={form.note} onChange={set('note')} placeholder="Instructions, allure cible, focus..."
              rows={2} className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
          </div>
        </div>

        <button onClick={() => onAdd(form)} disabled={!form.label.trim()}
          className="w-full py-3 rounded-xl text-sm font-bold text-white mt-5 transition-opacity"
          style={{ background: COACH_COLOR, opacity: form.label.trim() ? 1 : 0.4 }}>
          Ajouter ({form.repeat} semaine{form.repeat > 1 ? 's' : ''})
        </button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PlanBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [athlete, setAthlete] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [weeks, setWeeks] = useState([]) // local weeks state
  const [showModal, setShowModal] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0)
    // next Monday
    const day = d.getDay()
    d.setDate(d.getDate() + (day === 1 ? 0 : day === 0 ? 1 : 8 - day))
    return d.toISOString().slice(0, 10)
  })

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [{ data: profile }, { data: planData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, photo_url, age, gender').eq('id', id).single(),
      supabase.from('plans').select('*').eq('user_id', id).eq('is_active', true).single(),
    ])
    setAthlete(profile)
    setPlan(planData)
    // Load existing weeks or start fresh
    if (planData?.weeks) setWeeks(planData.weeks)
    else setWeeks([{ weekNum: 1, phase: 'BASE', weekStart: startDate, sessions: [], targetTSS: 0, actualTSS: 0, isRecovery: false }])
    setLoading(false)
  }

  function getWeekStart(weekIdx) {
    const base = new Date(startDate)
    base.setDate(base.getDate() + weekIdx * 7)
    return base
  }

  function addWeek() {
    const newIdx = weeks.length
    const ws = getWeekStart(newIdx)
    setWeeks(prev => [...prev, {
      weekNum: newIdx + 1,
      phase: 'BASE',
      weekStart: ws.toISOString().slice(0, 10),
      sessions: [],
      targetTSS: 0,
      actualTSS: 0,
      isRecovery: false,
    }])
    setSelectedWeek(newIdx)
  }

  function removeWeek(idx) {
    setWeeks(prev => prev.filter((_, i) => i !== idx).map((w, i) => ({ ...w, weekNum: i + 1 })))
    setSelectedWeek(Math.max(0, idx - 1))
  }

  function updateWeekPhase(idx, phase) {
    setWeeks(prev => prev.map((w, i) => i === idx ? { ...w, phase } : w))
  }

  function handleAddRule(form) {
    const toAdd = []
    const repeatCount = parseInt(form.repeat)
    const currentWeekIdx = selectedWeek

    for (let w = 0; w < repeatCount; w++) {
      const targetWeekIdx = currentWeekIdx + w
      // Ensure enough weeks exist
      if (targetWeekIdx >= weeks.length) {
        // Will be handled after
      }
      const weekStart = getWeekStart(targetWeekIdx)
      const sessionDate = new Date(weekStart)
      sessionDate.setDate(weekStart.getDate() + parseInt(form.dayOfWeek))
      const dateStr = sessionDate.toISOString().slice(0, 10)
      const sport = SPORT_OPTIONS.find(s => s.value === form.sport)

      toAdd.push({
        weekIdx: targetWeekIdx,
        session: {
          id: `coach-${Date.now()}-${w}`,
          sport: form.sport,
          label: form.label,
          date: dateStr,
          duration: parseInt(form.duration),
          tss: Math.round(parseInt(form.duration) * 0.8),
          color: COACH_COLOR,
          coachAdded: true,
          coachNote: form.note || undefined,
          done: false,
        }
      })
    }

    setWeeks(prev => {
      let updated = [...prev]
      // Ensure enough weeks
      while (updated.length < currentWeekIdx + repeatCount) {
        const newIdx = updated.length
        const ws = getWeekStart(newIdx)
        updated.push({ weekNum: newIdx + 1, phase: 'BASE', weekStart: ws.toISOString().slice(0, 10), sessions: [], targetTSS: 0, actualTSS: 0, isRecovery: false })
      }
      // Add sessions
      toAdd.forEach(({ weekIdx, session }) => {
        updated = updated.map((w, i) => {
          if (i !== weekIdx) return w
          const sessions = [...w.sessions, session].sort((a, b) => String(a.date).localeCompare(String(b.date)))
          return { ...w, sessions }
        })
      })
      return updated
    })
    setShowModal(false)
  }

  function removeSession(weekIdx, sessionId) {
    setWeeks(prev => prev.map((w, i) =>
      i === weekIdx ? { ...w, sessions: w.sessions.filter(s => s.id !== sessionId) } : w
    ))
  }

  async function savePlan() {
    setSaving(true)
    if (plan?.id) {
      await supabase.from('plans').update({ weeks }).eq('id', plan.id).select('id')
    } else {
      // Create a minimal plan for the athlete
      await supabase.from('plans').insert({
        user_id: id,
        discipline: 'triathlon',
        level: 'intermediate',
        is_active: true,
        start_date: startDate,
        weeks,
        completed_sessions: {},
      })
    }
    setSaving(false)
    navigate(`/athletes/${id}/plan`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(147,22,33,0.3)', borderTopColor: '#931621' }} />
    </div>
  )

  const currentWeek = weeks[selectedWeek]
  const totalSessions = weeks.reduce((acc, w) => acc + w.sessions.length, 0)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {showModal && <RuleModal onAdd={handleAddRule} onClose={() => setShowModal(false)} />}

      {/* Left panel — Athlete data */}
      <div className="w-72 flex-shrink-0 flex flex-col overflow-y-auto border-r p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <button onClick={() => navigate(`/athletes/${id}`)} className="text-xs mb-4 hover:opacity-70" style={{ color: 'var(--text3)' }}>← Retour athlète</button>

        <div className="flex items-center gap-3 mb-5">
          {athlete?.photo_url ? (
            <img src={athlete.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{ background: 'var(--red)' }}>
              {athlete?.full_name?.[0]}
            </div>
          )}
          <div>
            <p className="font-bold text-white text-sm">{athlete?.full_name}</p>
            <p className="text-xs" style={{ color: 'var(--text3)' }}>{athlete?.age && `${athlete.age} ans`} {athlete?.gender}</p>
          </div>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>Données athlète</h3>

        {plan ? (
          <div className="flex flex-col gap-3">
            {/* Plan info */}
            <div className="rounded-xl p-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--text3)' }}>PLAN ACTUEL</p>
              <p className="text-sm text-white font-semibold capitalize">{plan.discipline}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>Niveau : {plan.level}</p>
              {plan.goal_date && <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>Objectif : {new Date(plan.goal_date).toLocaleDateString('fr-FR')}</p>}
              {plan.hrmax && <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>FCmax : {plan.hrmax}</p>}
            </div>

            {/* PBs */}
            {plan.pbs && Object.keys(plan.pbs).length > 0 && (
              <div className="rounded-xl p-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-bold mb-2" style={{ color: 'var(--text3)' }}>RECORDS</p>
                {plan.pbs.pace5k && <p className="text-xs text-white">5K : {plan.pbs.pace5k}/km</p>}
                {plan.pbs.runTime && <p className="text-xs text-white">Semi : {plan.pbs.runTime}</p>}
                {plan.pbs.ftp && <p className="text-xs text-white">FTP : {plan.pbs.ftp}W</p>}
                {plan.pbs.css && <p className="text-xs text-white">CSS : {plan.pbs.css}/100m</p>}
              </div>
            )}

            {/* Run zones */}
            {plan.zones?.run?.zones && (
              <div className="rounded-xl p-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-bold mb-2" style={{ color: 'var(--text3)' }}>ZONES COURSE{plan.zones.run.vma ? ` (VMA ${plan.zones.run.vma})` : ''}</p>
                {plan.zones.run.zones.map(z => (
                  <div key={z.z} className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: z.c }} />
                    <span className="text-[11px] font-mono text-white">{z.z}</span>
                    <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--text3)' }}>{z.range}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Equipment */}
            {plan.equipment && (
              <div className="rounded-xl p-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-bold mb-2" style={{ color: 'var(--text3)' }}>ÉQUIPEMENT</p>
                <div className="flex flex-wrap gap-1">
                  {plan.equipment.gpsWatch && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text2)' }}>⌚ GPS</span>}
                  {plan.equipment.powerMeter && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text2)' }}>⚡ Puissance</span>}
                  {plan.equipment.trainer && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text2)' }}>🚴 Trainer</span>}
                  {plan.equipment.pool && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text2)' }}>🏊 Piscine {plan.equipment.pool}m</span>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl p-4 text-center" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text3)' }}>Aucun plan existant. Tu construis le premier plan de cet athlète.</p>
            <div className="mt-3">
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--text3)' }}>Date de début</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', colorScheme: 'dark' }} />
            </div>
          </div>
        )}
      </div>

      {/* Right panel — Plan builder */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div>
            <h1 className="font-bold text-white">Construire le programme</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
              {weeks.length} semaine{weeks.length > 1 ? 's' : ''} · {totalSessions} séance{totalSessions !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={addWeek}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
              + Semaine
            </button>
            <button onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: COACH_COLOR }}>
              + Séance (avec récurrence)
            </button>
            <button onClick={savePlan} disabled={saving || weeks.length === 0}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-opacity"
              style={{ background: 'var(--red)', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Sauvegarde...' : '💾 Enregistrer le plan'}
            </button>
          </div>
        </div>

        {/* Week tabs */}
        <div className="flex gap-2 px-6 py-3 overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          {weeks.map((w, i) => (
            <button key={i} onClick={() => setSelectedWeek(i)}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium"
              style={{
                background: selectedWeek === i ? 'var(--red)' : 'var(--surface)',
                color: selectedWeek === i ? '#fff' : 'var(--text2)',
                border: '1px solid var(--border)',
              }}>
              <span>S{w.weekNum}</span>
              <span className="text-[10px] px-1 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>{w.phase}</span>
              {w.sessions.length > 0 && (
                <span className="text-[10px] font-bold" style={{ color: selectedWeek === i ? 'rgba(255,255,255,0.7)' : 'var(--text3)' }}>
                  {w.sessions.length}
                </span>
              )}
            </button>
          ))}
          {weeks.length === 0 && (
            <p className="text-sm py-1" style={{ color: 'var(--text3)' }}>Aucune semaine. Clique "+ Semaine" pour commencer.</p>
          )}
        </div>

        {/* Week content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentWeek && (
            <>
              {/* Week header controls */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <h2 className="font-bold text-white">Semaine {currentWeek.weekNum}</h2>
                  <span className="text-sm" style={{ color: 'var(--text3)' }}>
                    à partir du {new Date(getWeekStart(selectedWeek)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Phase selector */}
                  <select value={currentWeek.phase} onChange={e => updateWeekPhase(selectedWeek, e.target.value)}
                    className="px-3 py-1.5 rounded-xl text-sm font-semibold text-white outline-none"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', colorScheme: 'dark' }}>
                    {['PREP','BASE','BUILD','PEAK','TAPER','RACE_SPEC'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={() => setShowModal(true)}
                    className="px-3 py-1.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: COACH_COLOR }}>
                    + Séance
                  </button>
                  <button onClick={() => removeWeek(selectedWeek)}
                    className="px-3 py-1.5 rounded-xl text-sm"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                    Supprimer
                  </button>
                </div>
              </div>

              {/* Sessions */}
              {currentWeek.sessions.length === 0 ? (
                <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="text-3xl mb-3">📅</p>
                  <p className="font-semibold text-white mb-2">Semaine vide</p>
                  <p className="text-sm mb-4" style={{ color: 'var(--text3)' }}>Ajoute des séances avec récurrence depuis le bouton ci-dessus.</p>
                  <button onClick={() => setShowModal(true)} className="text-sm font-semibold" style={{ color: COACH_COLOR }}>
                    + Ajouter une séance
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {currentWeek.sessions.map(s => {
                    const sport = SPORT_OPTIONS.find(o => o.value === s.sport)
                    const dateObj = new Date(s.date)
                    const dayName = DAYS[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1]
                    return (
                      <div key={s.id} className="rounded-2xl p-4 relative group"
                        style={{ background: 'var(--surface)', border: `1px solid ${s.coachAdded ? 'rgba(34,197,212,0.3)' : 'var(--border)'}` }}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                              style={{ background: s.coachAdded ? 'rgba(34,197,212,0.12)' : 'rgba(147,22,33,0.1)' }}>
                              {sport?.label.split(' ')[0] || '🏋️'}
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: s.coachAdded ? COACH_COLOR : 'var(--red)' }}>
                                {dayName}
                              </span>
                              <p className="text-sm font-semibold text-white leading-tight">{s.label}</p>
                            </div>
                          </div>
                          <button onClick={() => removeSession(selectedWeek, s.id)}
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-opacity flex-shrink-0"
                            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                            ✕
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text3)' }}>
                          <span>⏱ {s.duration} min</span>
                          <span>TSS ~{s.tss}</span>
                          <span>{dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        {s.coachNote && <p className="text-xs mt-1.5 italic truncate" style={{ color: COACH_COLOR }}>"{s.coachNote}"</p>}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Week summary */}
              {currentWeek.sessions.length > 0 && (
                <div className="mt-4 flex gap-4">
                  {['swim','bike','run','strength'].map(sport => {
                    const ss = currentWeek.sessions.filter(s => s.sport === sport)
                    if (!ss.length) return null
                    const totalMin = ss.reduce((acc, s) => acc + (s.duration || 0), 0)
                    const o = SPORT_OPTIONS.find(o => o.value === sport)
                    return (
                      <div key={sport} className="flex items-center gap-1.5">
                        <span>{o?.label.split(' ')[0]}</span>
                        <span className="text-sm font-mono text-white">{totalMin} min</span>
                      </div>
                    )
                  })}
                  <span className="text-sm ml-auto" style={{ color: 'var(--text3)' }}>
                    TSS total: {currentWeek.sessions.reduce((acc, s) => acc + (s.tss || 0), 0)}
                  </span>
                </div>
              )}
            </>
          )}

          {weeks.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-4xl mb-4">📅</p>
              <p className="font-semibold text-white mb-2">Aucun programme</p>
              <p className="text-sm mb-6" style={{ color: 'var(--text3)' }}>Commence par ajouter des semaines, puis des séances avec récurrence.</p>
              <button onClick={addWeek} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'var(--red)' }}>
                + Ajouter la semaine 1
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
