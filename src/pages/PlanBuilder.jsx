import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import SessionModal from '../components/SessionModal'
import { stepsToTSS, stepsToMinutes, workoutSummary } from '../components/WorkoutBuilder'
import {
  autoAssignPhases, weekTSSTarget, SPORT_META, ZONE_COLORS,
  DISCIPLINES, PHASES, PHASE_COLORS, LEVELS, DAYS_SHORT,
} from '../lib/planHelpers'

import { toLocalDateStr, nextMonday, parseDate } from '../lib/dateUtils'

const COACH_COLOR = '#22C5D5'

// ─── Mini TSS bar chart ───────────────────────────────────────────────────────
function LoadChart({ weeks, selectedWeek, onSelect }) {
  if (!weeks.length) return null
  const maxTSS = Math.max(...weeks.map(w => Math.max(w.targetTSS || 0, w.actualTSS || 0)), 1)
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>
        Charge prévisionnelle (TSS)
      </p>
      <div className="flex items-end gap-0.5 h-16">
        {weeks.map((w, i) => (
          <div key={i} onClick={() => onSelect(i)}
            className="flex-1 flex flex-col items-end gap-0.5 group relative cursor-pointer"
            title={`S${w.weekNum} ${w.phase}${w.isRecovery?' REC':''} · cible ${w.targetTSS} · actuel ${w.actualTSS||0}`}>
            {/* Actual TSS (filled) */}
            <div className="w-full rounded-sm absolute bottom-0"
              style={{
                height: `${Math.round(((w.actualTSS || 0) / maxTSS) * 56)}px`,
                background: w.isRecovery ? 'rgba(34,197,212,0.3)' : (PHASE_COLORS[w.phase] || 'var(--red)') + '55',
                minHeight: w.actualTSS ? 2 : 0,
              }} />
            {/* Target TSS (outline) */}
            <div className="w-full rounded-sm absolute bottom-0"
              style={{
                height: `${Math.round(((w.targetTSS || 0) / maxTSS) * 56)}px`,
                border: `1px solid ${selectedWeek === i ? '#fff' : (PHASE_COLORS[w.phase] || 'var(--red)') + '88'}`,
                minHeight: 2,
              }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] mt-5" style={{ color: 'var(--text3)' }}>
        <span>S1</span>
        <span>S{Math.ceil(weeks.length/2)}</span>
        <span>S{weeks.length}</span>
      </div>
    </div>
  )
}

// ─── Week sport summary ────────────────────────────────────────────────────────
function WeekSummary({ sessions, targetTSS }) {
  const sports = ['swim','bike','run','brick','strength']
  const stats = sports.map(s => {
    const ss = sessions.filter(x => x.sport === s)
    const min = ss.reduce((a,x) => a + (x.duration || 0), 0)
    const dist = ss.reduce((a,x) => a + (x.distance || 0), 0)
    return { sport: s, count: ss.length, min, dist }
  }).filter(s => s.count > 0)
  const actualTSS = sessions.reduce((a,s) => a + (s.tss||0), 0)
  const pct = targetTSS ? Math.round((actualTSS / targetTSS) * 100) : 0

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {stats.map(s => {
        const m = SPORT_META[s.sport]
        return (
          <div key={s.sport} className="flex items-center gap-1.5 text-xs">
            <span>{m.emoji}</span>
            <span className="text-white font-mono">{s.min}min</span>
            {s.dist > 0 && <span style={{ color: 'var(--text3)' }}>{s.dist}{m.distUnit}</span>}
          </div>
        )
      })}
      <div className="ml-auto flex items-center gap-2 text-xs">
        <span className="font-mono" style={{ color: COACH_COLOR }}>TSS {actualTSS}</span>
        {targetTSS > 0 && (
          <span style={{ color: pct >= 90 ? '#4ade80' : pct >= 70 ? 'var(--text2)' : 'var(--text3)' }}>
            / {targetTSS} ({pct}%)
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Session card ──────────────────────────────────────────────────────────────
function SessionCard({ session: s, onRemove, onClick }) {
  const m = SPORT_META[s.sport] || SPORT_META.run
  const d = parseDate(s.date)
  const day = DAYS_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1]
  const hasStructured = s.structuredWorkout?.steps?.length > 0
  const summary = hasStructured ? workoutSummary(s.structuredWorkout.steps) : null
  return (
    <div className="rounded-2xl p-4 relative group cursor-pointer transition-all hover:opacity-90"
      onClick={onClick}
      style={{ background: 'var(--surface)', border: `1px solid ${COACH_COLOR}33` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
            style={{ background: m.color + '20' }}>
            {m.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase" style={{ color: COACH_COLOR }}>{day}</span>
              {s.zone && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                  style={{ background: (ZONE_COLORS[s.zone]||'#fff') + '22', color: ZONE_COLORS[s.zone]||'#fff' }}>
                  {s.zone}
                </span>
              )}
              {hasStructured && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                  style={{ background: COACH_COLOR + '22', color: COACH_COLOR }}>
                  ⚡ structuré
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white leading-tight">{s.label}</p>
            <div className="flex gap-2 text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
              <span>⏱ {s.duration}min</span>
              {s.distance != null && s.distance > 0 && <span>{s.distance}{m.distUnit}</span>}
              <span style={{ color: COACH_COLOR }}>TSS {s.tss}</span>
            </div>
            {/* Structured workout summary */}
            {summary && (
              <p className="text-[10px] mt-1.5 leading-relaxed font-mono break-all"
                style={{ color: 'var(--text3)' }}>
                {summary}
              </p>
            )}
            {s.coachNote && <p className="text-xs mt-1 italic truncate" style={{ color: COACH_COLOR }}>"{s.coachNote}"</p>}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onRemove() }}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0 transition-opacity"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>✕</button>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function PlanBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { coach } = useAuth()
  const [searchParams] = useSearchParams()
  const planId = searchParams.get('planId') // null = create mode, string = edit mode

  const [athlete, setAthlete]         = useState(null)
  const [athletePlan, setAthletePlan] = useState(null)
  const [editingPlanId, setEditingPlanId] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [error, setError]             = useState(null)
  const [showModal, setShowModal]     = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [weeks, setWeeks]             = useState([])

  const [meta, setMeta] = useState({
    name:        '',
    discipline:  'halfIronman',
    level:       'intermediate',
    startDate:   nextMonday(),
    goalDate:    '',
    daysPerWeek: 5,
    recoveryFreq: 4,
    description: '',
  })
  const setM = k => e => setMeta(m => ({ ...m, [k]: e.target.value }))

  const totalWeeks = useMemo(() => {
    if (!meta.startDate || !meta.goalDate) return weeks.length || 0
    const diff = Math.round((new Date(meta.goalDate) - new Date(meta.startDate)) / (7 * 86400000))
    return Math.max(1, diff)
  }, [meta.startDate, meta.goalDate, weeks.length])

  useEffect(() => { fetchData() }, [id, planId])

  // Cmd+S / Ctrl+S to save
  useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); savePlan() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [weeks, meta, editingPlanId])

  async function fetchData() {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single()
    setAthlete(profile)

    if (planId) {
      // ── Edit mode: load the specific plan ──
      const { data: existing } = await supabase.from('plans').select('*').eq('id', planId).single()
      if (existing) {
        setEditingPlanId(planId)
        setAthletePlan(existing)
        setMeta({
          name:         existing.event_name  || '',
          discipline:   existing.discipline  || 'halfIronman',
          level:        existing.level       || 'intermediate',
          startDate:    existing.start_date  || nextMonday(),
          goalDate:     existing.goal_date   || '',
          daysPerWeek:  5,
          recoveryFreq: 4,
          description:  existing.athlete_metrics?.description || '',
        })
        setWeeks(existing.weeks || [])
        if (existing.weeks?.length > 0) setSelectedWeek(0)
      }
    } else {
      // ── Create mode: load active plan for reference data ──
      const { data: planData } = await supabase.from('plans').select('*').eq('user_id', id).eq('is_active', true).single()
      setAthletePlan(planData)
      if (planData) {
        setMeta(m => ({
          ...m,
          discipline: planData.discipline || m.discipline,
          level:      planData.level      || m.level,
          goalDate:   planData.goal_date  || '',
          name:       planData.event_name || '',
        }))
      }
    }
    setLoading(false)
  }

  function generateWeeks() {
    if (!meta.startDate) return
    const hasExisting = weeks.some(w => w.sessions?.length > 0)
    if (editingPlanId && hasExisting) {
      if (!window.confirm('Régénérer les semaines effacera toutes les séances existantes. Continuer ?')) return
    }
    const n = totalWeeks || 12
    const phases = autoAssignPhases(n, parseInt(meta.recoveryFreq))
    setWeeks(Array.from({ length: n }, (_, i) => {
      const ws = new Date(meta.startDate + 'T12:00:00')
      ws.setDate(ws.getDate() + i * 7)
      return {
        weekNum:    i + 1,
        phase:      phases[i]?.phase || 'BASE',
        isRecovery: phases[i]?.isRecovery || false,
        weekStart:  toLocalDateStr(ws),
        targetTSS:  weekTSSTarget(phases[i]?.phase || 'BASE', phases[i]?.isRecovery || false, meta.level),
        actualTSS:  0,
        note:       '',
        sessions:   [],
      }
    }))
    setSelectedWeek(0)
  }

  function getWeekStartDate(weekIdx) {
    const base = new Date(meta.startDate + 'T12:00:00')
    base.setDate(base.getDate() + weekIdx * 7)
    return base
  }

  function addWeek() {
    const idx = weeks.length
    const ws = getWeekStartDate(idx)
    setWeeks(prev => [...prev, {
      weekNum: idx + 1, phase: 'BASE', isRecovery: false,
      weekStart: toLocalDateStr(ws),
      targetTSS: weekTSSTarget('BASE', false, meta.level),
      actualTSS: 0, note: '', sessions: [],
    }])
    setSelectedWeek(idx)
  }

  function removeWeek(idx) {
    if (weeks[idx]?.sessions?.length > 0) {
      if (!window.confirm(`Supprimer la semaine ${idx+1} (${weeks[idx].sessions.length} séance${weeks[idx].sessions.length > 1 ? 's' : ''}) ?`)) return
    }
    setWeeks(prev => prev.filter((_,i)=>i!==idx).map((w,i)=>({...w,weekNum:i+1})))
    setSelectedWeek(Math.max(0, idx - 1))
  }

  function duplicateWeek(idx) {
    const src = weeks[idx]
    const newIdx = idx + 1
    const ws = getWeekStartDate(newIdx)
    const sessions = src.sessions.map(s => {
      const origDate = parseDate(s.date)
      const origWeekStart = parseDate(src.weekStart)
      const dayOffset = Math.round((origDate - origWeekStart) / 86400000)
      const newDate = new Date(ws)
      newDate.setDate(ws.getDate() + dayOffset)
      return { ...s, id: `coach-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, date: toLocalDateStr(newDate), done: false }
    })
    setWeeks(prev => {
      const updated = [...prev]
      updated.splice(newIdx, 0, { ...src, weekNum: newIdx+1, weekStart: toLocalDateStr(ws), actualTSS: src.actualTSS, sessions })
      return updated.map((w,i) => ({ ...w, weekNum: i+1 }))
    })
    setSelectedWeek(newIdx)
  }

  function updateWeek(idx, patch) {
    setWeeks(prev => prev.map((w,i) => i===idx ? {...w,...patch} : w))
  }

  function removeSession(weekIdx, sessionId) {
    setWeeks(prev => prev.map((w,i) => {
      if (i !== weekIdx) return w
      const sessions = w.sessions.filter(s => s.id !== sessionId)
      return { ...w, sessions, actualTSS: sessions.reduce((acc,s) => acc+(s.tss||0), 0) }
    }))
  }

  function openEditSession(weekIdx, session) {
    setEditingSession({ weekIdx, session })
    setSelectedWeek(weekIdx)
    setShowModal(true)
  }

  function handleAddSessions(form) {
    const zoneFactor = { Z1: 0.5, Z2: 0.8, Z3: 1.1, Z4: 1.4, Z5: 1.6 }
    const sw = form.structuredWorkout

    // Edit mode: replace the existing session
    if (form.editId) {
      setWeeks(prev => prev.map((wk, i) => {
        if (i !== editingSession.weekIdx) return wk
        const weekStartDate = new Date(wk.weekStart + 'T12:00:00')
        const sessionDate = new Date(weekStartDate)
        sessionDate.setDate(weekStartDate.getDate() + parseInt(form.dayOfWeek))
        const dateStr = toLocalDateStr(sessionDate)
        const dur = sw ? stepsToMinutes(sw.steps) : form.duration
        const tss = sw ? stepsToTSS(sw.steps) : Math.round(dur * (zoneFactor[form.zone] ?? 0.8))
        const updated = {
          ...editingSession.session,
          sport: form.sport, label: form.label, date: dateStr,
          duration: dur, distance: form.distance,
          zone: form.zone, tss,
          coachNote: form.note || undefined,
          instructions: form.instructions || undefined,
          structuredWorkout: sw || undefined,
        }
        const sessions = wk.sessions.map(s => s.id === form.editId ? updated : s)
          .sort((a,b) => String(a.date).localeCompare(String(b.date)))
        return { ...wk, sessions, actualTSS: sessions.reduce((acc,s) => acc+(s.tss||0), 0) }
      }))
      setEditingSession(null)
      setShowModal(false)
      return
    }

    // Add mode: create new session(s) with recurrence
    const repeatCount = parseInt(form.repeat)
    setWeeks(prev => {
      let updated = [...prev]
      while (updated.length < selectedWeek + repeatCount) {
        const idx = updated.length
        const ws = getWeekStartDate(idx)
        updated.push({
          weekNum: idx+1, phase:'BASE', isRecovery:false,
          weekStart: toLocalDateStr(ws),
          targetTSS: weekTSSTarget('BASE',false,meta.level),
          actualTSS:0, note:'', sessions:[],
        })
      }
      for (let w = 0; w < repeatCount; w++) {
        const weekIdx = selectedWeek + w
        const wk = updated[weekIdx]
        const weekStartDate = new Date(wk.weekStart + 'T12:00:00')
        const sessionDate = new Date(weekStartDate)
        sessionDate.setDate(weekStartDate.getDate() + parseInt(form.dayOfWeek))
        const dateStr = toLocalDateStr(sessionDate)
        const baseDur = sw ? stepsToMinutes(sw.steps) : form.duration
        const durationAdj = wk.isRecovery && form.skipRecovery ? Math.round(baseDur * 0.7) : baseDur
        const tss = sw ? Math.round(stepsToTSS(sw.steps) * (wk.isRecovery && form.skipRecovery ? 0.7 : 1))
          : Math.round(durationAdj * (zoneFactor[form.zone] ?? 0.8))
        const newSession = {
          id: `coach-${Date.now()}-${w}-${Math.random().toString(36).slice(2,6)}`,
          sport: form.sport, label: form.label, date: dateStr,
          duration: durationAdj, distance: form.distance,
          zone: form.zone, tss,
          color: COACH_COLOR, coachAdded: true,
          coachNote: form.note || undefined,
          instructions: form.instructions || undefined,
          structuredWorkout: sw || undefined,
          done: false,
        }
        updated = updated.map((wk2, i) => {
          if (i !== weekIdx) return wk2
          const sessions = [...wk2.sessions, newSession].sort((a,b)=>String(a.date).localeCompare(String(b.date)))
          return { ...wk2, sessions, actualTSS: sessions.reduce((acc,s)=>acc+(s.tss||0),0) }
        })
      }
      return updated
    })
    setShowModal(false)
  }

  async function savePlan() {
    if (!meta.startDate) { setError('Définis une date de début.'); return }
    const totalS = weeks.reduce((acc,w)=>acc+w.sessions.length,0)
    if (totalS === 0) { setError('Ajoute au moins une séance avant de sauvegarder.'); return }
    setError(null)
    setSaving(true)

    const sharedPayload = {
      discipline:      meta.discipline,
      level:           meta.level,
      start_date:      meta.startDate,
      goal_date:       meta.goalDate || null,
      event_name:      meta.name || meta.discipline,
      weeks,
      // Store extra fields in athlete_metrics so mobile app can read them without extra columns
      athlete_metrics: {
        ...(athletePlan?.athlete_metrics || {}),
        coachId:     coach?.id,
        description: meta.description || null,
        daysPerWeek: parseInt(meta.daysPerWeek) || 5,
        totalWeeks:  weeks.length,
      },
    }

    let err
    if (editingPlanId) {
      const res = await supabase.from('plans').update(sharedPayload).eq('id', editingPlanId).select('id')
      err = res.error
    } else {
      const res = await supabase.from('plans').insert({
        ...sharedPayload,
        user_id:            id,
        is_active:          false,
        completed_sessions: {},
        pbs:                athletePlan?.pbs || {},
        zones:              athletePlan?.zones || {},
        equipment:          athletePlan?.equipment || {},
        age:                athlete?.age || null,
        hrmax:              athletePlan?.hrmax || null,
        skill_levels:       {},
        performance_factor: { run:1, bike:1 },
        athlete_grades:     athletePlan?.athlete_grades || {},
        scores:             athletePlan?.scores || {},
      }).select('id')
      err = res.error
    }

    setSaving(false)
    if (err) { setError('Erreur : ' + err.message); return }
    setSaved(true)
    setTimeout(() => { setSaved(false); navigate(`/athletes/${id}`, { state: { refresh: Date.now() } }) }, 1200)
  }

  async function deletePlan() {
    if (!editingPlanId) return
    const totalS = weeks.reduce((acc,w)=>acc+w.sessions.length,0)
    if (!window.confirm(`Supprimer ce plan définitivement ?\n${meta.name || 'Ce programme'} · ${weeks.length} semaines · ${totalS} séances`)) return
    const { error: err } = await supabase.from('plans').delete().eq('id', editingPlanId).select('id')
    if (err) { setError('Erreur suppression : ' + err.message); return }
    navigate(`/athletes/${id}`, { state: { refresh: Date.now() } })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor:'rgba(147,22,33,0.3)', borderTopColor:'#931621' }} />
    </div>
  )

  const currentWeek = weeks[selectedWeek]
  const totalSessions = weeks.reduce((acc,w)=>acc+w.sessions.length,0)
  const pbs = athletePlan?.pbs || {}
  const zones = athletePlan?.zones || {}

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {showModal && (
        <SessionModal
          weekStart={currentWeek?.weekStart}
          weekIdx={selectedWeek}
          totalWeeks={weeks.length}
          athletePlan={athletePlan}
          onAdd={handleAddSessions}
          onClose={() => { setShowModal(false); setEditingSession(null) }}
          editSession={editingSession?.session}
        />
      )}

      {/* ── LEFT PANEL ── */}
      <div className="w-72 flex-shrink-0 flex flex-col overflow-y-auto border-r"
        style={{ borderColor:'var(--border)', background:'var(--surface)' }}>

        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor:'var(--border)' }}>
          <button onClick={() => navigate(`/athletes/${id}`)} className="text-lg" style={{ color:'var(--text3)' }}>←</button>
          {athlete?.photo_url
            ? <img src={athlete.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            : <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ background:'var(--red)' }}>{athlete?.full_name?.[0]}</div>
          }
          <div className="min-w-0">
            <p className="font-bold text-white text-sm truncate">{athlete?.full_name}</p>
            <p className="text-[10px] truncate" style={{ color:'var(--text3)' }}>
              {athlete?.age && `${athlete.age} ans · `}{athlete?.gender}
            </p>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 flex flex-col gap-5 overflow-y-auto">

          {/* Plan metadata form */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'var(--text3)' }}>Paramètres du plan</p>

            <input value={meta.name} onChange={setM('name')} placeholder="Nom du plan (ex: Nice 70.3 2026)"
              className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none"
              style={{ background:'var(--surface2)', border:'1px solid var(--border)' }} />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase tracking-wider mb-1 block" style={{ color:'var(--text3)' }}>Discipline</label>
                <select value={meta.discipline} onChange={setM('discipline')}
                  className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
                  style={{ background:'var(--surface2)', border:'1px solid var(--border)', colorScheme:'dark' }}>
                  {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider mb-1 block" style={{ color:'var(--text3)' }}>Niveau</label>
                <select value={meta.level} onChange={setM('level')}
                  className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
                  style={{ background:'var(--surface2)', border:'1px solid var(--border)', colorScheme:'dark' }}>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase tracking-wider mb-1 block" style={{ color:'var(--text3)' }}>Début</label>
                <input type="date" value={meta.startDate} onChange={setM('startDate')}
                  className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
                  style={{ background:'var(--surface2)', border:'1px solid var(--border)', colorScheme:'dark' }} />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider mb-1 block" style={{ color:'var(--text3)' }}>Course / objectif</label>
                <input type="date" value={meta.goalDate} onChange={setM('goalDate')}
                  className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
                  style={{ background:'var(--surface2)', border:'1px solid var(--border)', colorScheme:'dark' }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase tracking-wider mb-1 block" style={{ color:'var(--text3)' }}>J/semaine</label>
                <select value={meta.daysPerWeek} onChange={setM('daysPerWeek')}
                  className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
                  style={{ background:'var(--surface2)', border:'1px solid var(--border)', colorScheme:'dark' }}>
                  {[3,4,5,6,7].map(n => <option key={n} value={n}>{n} jours</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider mb-1 block" style={{ color:'var(--text3)' }}>Récup toutes les</label>
                <select value={meta.recoveryFreq} onChange={setM('recoveryFreq')}
                  className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
                  style={{ background:'var(--surface2)', border:'1px solid var(--border)', colorScheme:'dark' }}>
                  <option value={3}>3 semaines</option>
                  <option value={4}>4 semaines</option>
                </select>
              </div>
            </div>

            <textarea value={meta.description} onChange={setM('description')} placeholder="Objectifs et consignes générales pour l'athlète..."
              rows={2} className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none resize-none"
              style={{ background:'var(--surface2)', border:'1px solid var(--border)' }} />

            {meta.startDate && meta.goalDate && (
              <div className="rounded-xl px-3 py-2 text-xs text-center" style={{ background:'rgba(34,197,212,0.08)', border:'1px solid rgba(34,197,212,0.2)' }}>
                <span style={{ color:COACH_COLOR }}>{totalWeeks} semaines</span>
                <span style={{ color:'var(--text3)' }}> · {totalSessions} séances</span>
              </div>
            )}

            <button onClick={generateWeeks}
              className="w-full py-2 rounded-xl text-xs font-bold text-white"
              style={{ background:'var(--red)' }}>
              ⚡ Générer les semaines automatiquement
            </button>
          </div>

          {/* Load chart */}
          {weeks.length > 0 && (
            <LoadChart weeks={weeks} selectedWeek={selectedWeek} onSelect={setSelectedWeek} />
          )}

          {/* Athlete reference — PBs */}
          {Object.keys(pbs).length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color:'var(--text3)' }}>Records athlète</p>
              <div className="rounded-xl p-3 flex flex-col gap-1.5" style={{ background:'var(--surface2)' }}>
                {pbs.pace5k  && <div className="flex justify-between text-xs"><span style={{ color:'var(--text3)' }}>5K</span><span className="font-mono text-white">{pbs.pace5k}/km</span></div>}
                {pbs.runTime && <div className="flex justify-between text-xs"><span style={{ color:'var(--text3)' }}>Semi ({pbs.runDist})</span><span className="font-mono text-white">{pbs.runTime}</span></div>}
                {pbs.ftp     && <div className="flex justify-between text-xs"><span style={{ color:'var(--text3)' }}>FTP</span><span className="font-mono text-white">{pbs.ftp}W</span></div>}
                {pbs.css     && <div className="flex justify-between text-xs"><span style={{ color:'var(--text3)' }}>CSS</span><span className="font-mono text-white">{pbs.css}/100m</span></div>}
                {pbs.weight  && <div className="flex justify-between text-xs"><span style={{ color:'var(--text3)' }}>Poids</span><span className="font-mono text-white">{pbs.weight}kg</span></div>}
              </div>
            </div>
          )}

          {/* Run zones */}
          {zones.run?.zones && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color:'var(--text3)' }}>
                Zones course {zones.run.vma && `· VMA ${zones.run.vma}`}
              </p>
              <div className="rounded-xl p-3" style={{ background:'var(--surface2)' }}>
                {zones.run.zones.map(z => (
                  <div key={z.z} className="flex items-center gap-2 mb-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:z.c }} />
                    <span className="text-[11px] font-mono w-5" style={{ color:'var(--text3)' }}>{z.z}</span>
                    <span className="text-[11px] flex-1 truncate text-white">{z.range}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bike zones / FTP */}
          {(zones.bike?.hrZones || pbs.ftp) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color:'var(--text3)' }}>
                Zones vélo {pbs.ftp && `· FTP ${pbs.ftp}W`}
              </p>
              {zones.bike?.hrZones && (
                <div className="rounded-xl p-3" style={{ background:'var(--surface2)' }}>
                  {Object.entries(zones.bike.hrZones).filter(([k])=>k.startsWith('z')).map(([k,v]) => (
                    <div key={k} className="flex justify-between text-[11px] mb-1">
                      <span style={{ color:'var(--text3)' }} className="truncate flex-1">{v.label}</span>
                      <span className="font-mono text-white ml-2">{v.min}–{v.max===999?'∞':v.max}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b flex-shrink-0"
          style={{ borderColor:'var(--border)', background:'var(--surface)' }}>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-white text-lg">{meta.name || (editingPlanId ? 'Modifier le programme' : 'Nouveau programme')}</h1>
              {editingPlanId && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: `${COACH_COLOR}22`, color: COACH_COLOR }}>Mode édition</span>}
            </div>
            <p className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>
              {weeks.length} sem. · {totalSessions} séance{totalSessions!==1?'s':''}
              {!editingPlanId && ' · sera publié comme plan inactif'}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {saved && (
              <span className="text-xs px-3 py-1.5 rounded-xl font-semibold" style={{ background:'rgba(74,222,128,0.1)', color:'#4ade80' }}>
                ✓ Sauvegardé
              </span>
            )}
            {error && (
              <span className="text-xs px-3 py-1.5 rounded-xl" style={{ background:'rgba(239,68,68,0.1)', color:'#f87171' }}>
                {error}
              </span>
            )}
            <button onClick={addWeek}
              className="px-3 py-2 rounded-xl text-sm font-semibold"
              style={{ background:'var(--surface2)', color:'var(--text2)', border:'1px solid var(--border)' }}>
              + Semaine
            </button>
            <button onClick={() => { setEditingSession(null); setShowModal(true) }}
              className="px-3 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background:COACH_COLOR }}>
              + Séance
            </button>
            {editingPlanId && (
              <button onClick={deletePlan}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)' }}>
                🗑 Supprimer
              </button>
            )}
            <button onClick={savePlan} disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background:'var(--red)', opacity:saving?0.6:1 }}>
              {saving ? 'Sauvegarde...' : editingPlanId ? '💾 Sauvegarder' : '📤 Publier le plan'}
            </button>
          </div>
        </div>

        {/* Week tabs */}
        <div className="flex gap-1.5 px-6 py-2.5 overflow-x-auto flex-shrink-0 items-center"
          style={{ borderBottom:'1px solid var(--border)' }}>
          {weeks.map((w,i) => (
            <button key={i} onClick={() => setSelectedWeek(i)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold relative"
              style={{
                background: selectedWeek===i ? (PHASE_COLORS[w.phase]||'var(--red)') : 'var(--surface)',
                color: selectedWeek===i ? '#fff' : 'var(--text2)',
                border: `1px solid ${selectedWeek===i ? 'transparent' : 'var(--border)'}`,
              }}>
              <span>S{w.weekNum}</span>
              {w.isRecovery && <span className="text-[8px] opacity-70">REC</span>}
              <span className="opacity-60 text-[9px]">{w.phase}</span>
              {w.sessions.length > 0 && (
                <span className="font-bold" style={{ color: selectedWeek===i ? 'rgba(255,255,255,0.8)' : COACH_COLOR }}>
                  {w.sessions.length}
                </span>
              )}
            </button>
          ))}
          {weeks.length === 0 && (
            <span className="text-xs py-1.5 px-2" style={{ color:'var(--text3)' }}>
              Clique "⚡ Générer" à gauche ou "+ Semaine" pour commencer
            </span>
          )}
        </div>

        {/* Week content */}
        <div className="flex-1 overflow-y-auto p-6">
          {weeks.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-5xl mb-5">📅</p>
              <p className="font-bold text-white text-xl mb-2">Programme vide</p>
              <p className="text-sm mb-6" style={{ color:'var(--text3)' }}>
                Remplis les paramètres à gauche puis clique<br/>
                <strong style={{ color:COACH_COLOR }}>"⚡ Générer les semaines"</strong> pour créer la structure automatiquement.
              </p>
              <button onClick={generateWeeks}
                className="px-6 py-3 rounded-xl text-sm font-bold text-white"
                style={{ background:COACH_COLOR }}>
                ⚡ Générer maintenant
              </button>
            </div>
          )}

          {currentWeek && (
            <>
              {/* Week controls */}
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-bold text-white text-lg">Semaine {currentWeek.weekNum}</h2>
                    {currentWeek.isRecovery && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background:'rgba(34,197,212,0.1)', color:COACH_COLOR }}>
                        Récupération
                      </span>
                    )}
                    <span className="text-sm" style={{ color:'var(--text3)' }}>
                      {parseDate(currentWeek.weekStart).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={currentWeek.phase} onChange={e => updateWeek(selectedWeek,{phase:e.target.value})}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white outline-none"
                    style={{ background:PHASE_COLORS[currentWeek.phase]||'var(--red)', border:'none', colorScheme:'dark' }}>
                    {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={() => updateWeek(selectedWeek,{isRecovery:!currentWeek.isRecovery})}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{
                      background: currentWeek.isRecovery ? 'rgba(34,197,212,0.15)' : 'var(--surface2)',
                      color: currentWeek.isRecovery ? COACH_COLOR : 'var(--text3)',
                      border: `1px solid ${currentWeek.isRecovery ? 'rgba(34,197,212,0.3)' : 'var(--border)'}`,
                    }}>
                    {currentWeek.isRecovery ? '✓ Récup' : 'Récup'}
                  </button>
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color:'var(--text3)' }}>TSS cible</span>
                    <input type="number" value={currentWeek.targetTSS}
                      onChange={e => updateWeek(selectedWeek,{targetTSS:parseInt(e.target.value)||0})}
                      className="w-16 px-2 py-1 rounded-lg text-xs text-white outline-none font-mono"
                      style={{ background:'var(--surface2)', border:'1px solid var(--border)' }} />
                  </div>
                  <button onClick={() => { setEditingSession(null); setShowModal(true) }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                    style={{ background:COACH_COLOR }}>
                    + Séance
                  </button>
                  <button onClick={() => duplicateWeek(selectedWeek)}
                    className="px-3 py-1.5 rounded-xl text-xs" title="Dupliquer cette semaine"
                    style={{ background:'var(--surface2)', color:'var(--text3)', border:'1px solid var(--border)' }}>
                    ⧉ Dupliquer
                  </button>
                  <button onClick={() => removeWeek(selectedWeek)}
                    className="px-3 py-1.5 rounded-xl text-xs"
                    style={{ background:'rgba(239,68,68,0.1)', color:'#f87171' }}>
                    Suppr.
                  </button>
                </div>
              </div>

              {/* Week note */}
              <div className="mb-5">
                <input value={currentWeek.note||''} onChange={e => updateWeek(selectedWeek,{note:e.target.value})}
                  placeholder="Note de semaine pour l'athlète (objectif, contexte...)"
                  className="w-full px-4 py-2 rounded-xl text-sm text-white outline-none"
                  style={{ background:'var(--surface)', border:'1px solid var(--border)' }} />
              </div>

              {/* Sessions grid */}
              {currentWeek.sessions.length === 0 ? (
                <div className="rounded-2xl p-12 text-center" style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
                  <p className="text-3xl mb-3">📅</p>
                  <p className="font-semibold text-white mb-1">Semaine vide</p>
                  <p className="text-sm mb-4" style={{ color:'var(--text3)' }}>
                    Ajoute des séances. Tu peux les répéter sur plusieurs semaines automatiquement.
                  </p>
                  <button onClick={() => { setEditingSession(null); setShowModal(true) }} className="text-sm font-bold" style={{ color:COACH_COLOR }}>
                    + Ajouter une séance →
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
                    {currentWeek.sessions.map(s => (
                      <SessionCard
                        key={s.id}
                        session={s}
                        onRemove={() => removeSession(selectedWeek, s.id)}
                        onClick={() => openEditSession(selectedWeek, s)}
                      />
                    ))}
                    <button onClick={() => { setEditingSession(null); setShowModal(true) }}
                      className="rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all hover:opacity-80"
                      style={{ background:'transparent', border:`2px dashed ${COACH_COLOR}44`, color:COACH_COLOR, minHeight:80 }}>
                      <span className="text-2xl">+</span>
                      <span className="text-xs font-semibold">Ajouter une séance</span>
                    </button>
                  </div>
                  <div className="pt-3 border-t" style={{ borderColor:'var(--border)' }}>
                    <WeekSummary sessions={currentWeek.sessions} targetTSS={currentWeek.targetTSS} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
