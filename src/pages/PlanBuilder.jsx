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
const DISCIPLINES = ['sprint','olympique','halfIronman','ironman','run5k','run10k','semi','marathon','triathlon']
const LEVELS = ['beginner','intermediate','advanced','expert']
const PHASES = ['PREP','BASE','BUILD','RACE_SPEC','PEAK','TAPER']
const PHASE_COLORS = { PREP:'#B52E38', BASE:'#0A9DAB', BUILD:'#D9541A', RACE_SPEC:'#8B1A1A', PEAK:'#C0392B', TAPER:'#1E8449' }
const COACH_COLOR = '#22C5D5'

function nextMonday() {
  const d = new Date(); d.setHours(0,0,0,0)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 1 ? 0 : day === 0 ? 1 : 8 - day))
  return d.toISOString().slice(0,10)
}

// ─── Session Modal ─────────────────────────────────────────────────────────────
function SessionModal({ weekStart, onAdd, onClose }) {
  const [form, setForm] = useState({ sport:'run', label:'', dayOfWeek:0, duration:45, note:'', repeat:1 })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const sport = SPORT_OPTIONS.find(s => s.value === form.sport)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background:'var(--surface)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-lg">Ajouter une séance</h3>
          <button onClick={onClose} style={{ color:'var(--text3)' }}>✕</button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color:'var(--text3)' }}>Sport</label>
            <div className="flex gap-2 flex-wrap">
              {SPORT_OPTIONS.map(s => (
                <button key={s.value} onClick={() => setForm(f => ({ ...f, sport:s.value }))}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ background:form.sport===s.value ? s.color:'var(--surface2)', color:form.sport===s.value?'#fff':'var(--text2)', border:`1px solid ${form.sport===s.value?s.color:'var(--border)'}` }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color:'var(--text3)' }}>Titre</label>
            <input value={form.label} onChange={set('label')} placeholder="Ex: Sortie longue endurance fondamentale"
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background:'var(--surface2)', border:'1px solid var(--border)' }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color:'var(--text3)' }}>Jour</label>
              <div className="flex gap-1 flex-wrap">
                {DAYS.map((d,i) => (
                  <button key={i} onClick={() => setForm(f => ({ ...f, dayOfWeek:i }))}
                    className="w-8 h-8 rounded-lg text-xs font-bold"
                    style={{ background:form.dayOfWeek===i?COACH_COLOR:'var(--surface2)', color:form.dayOfWeek===i?'#fff':'var(--text2)' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color:'var(--text3)' }}>Durée (min)</label>
              <input type="number" value={form.duration} onChange={set('duration')} min={10} max={480}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background:'var(--surface2)', border:'1px solid var(--border)' }} />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color:'var(--text3)' }}>
              Répéter sur <span style={{ color:COACH_COLOR }}>{form.repeat}</span> semaine{form.repeat>1?'s':''}
            </label>
            <input type="range" min={1} max={24} value={form.repeat} onChange={set('repeat')} className="w-full" style={{ accentColor:COACH_COLOR }} />
            <div className="flex justify-between text-xs mt-0.5" style={{ color:'var(--text3)' }}>
              <span>1</span><span>12</span><span>24 sem.</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color:'var(--text3)' }}>Note pour l'athlète (optionnel)</label>
            <textarea value={form.note} onChange={set('note')} placeholder="Instructions, allure cible, objectif..."
              rows={2} className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
              style={{ background:'var(--surface2)', border:'1px solid var(--border)' }} />
          </div>
        </div>

        <button onClick={() => onAdd(form)} disabled={!form.label.trim()}
          className="w-full py-3 rounded-xl text-sm font-bold text-white mt-5"
          style={{ background:COACH_COLOR, opacity:form.label.trim()?1:0.4 }}>
          Ajouter {form.repeat > 1 ? `sur ${form.repeat} semaines` : 'à cette semaine'}
        </button>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function PlanBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [athlete, setAthlete] = useState(null)
  const [athletePlan, setAthletePlan] = useState(null) // existing plan for reference
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [weeks, setWeeks] = useState([])
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [showModal, setShowModal] = useState(false)

  // Plan metadata
  const [meta, setMeta] = useState({
    discipline: 'halfIronman',
    level: 'intermediate',
    startDate: nextMonday(),
    goalDate: '',
    eventName: '',
  })
  const setMetaField = k => e => setMeta(m => ({ ...m, [k]: e.target.value }))

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [{ data: profile }, { data: planData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, photo_url, age, gender').eq('id', id).single(),
      supabase.from('plans').select('*').eq('user_id', id).eq('is_active', true).single(),
    ])
    setAthlete(profile)
    setAthletePlan(planData)
    // Pre-fill meta from existing plan
    if (planData) {
      setMeta(m => ({
        ...m,
        discipline: planData.discipline || m.discipline,
        level: planData.level || m.level,
        goalDate: planData.goal_date || '',
        eventName: planData.event_name || '',
      }))
    }
    // Start with week 1
    setWeeks([{ weekNum:1, phase:'PREP', sessions:[], isRecovery:false }])
    setLoading(false)
  }

  function getWeekStartDate(weekIdx) {
    const base = new Date(meta.startDate)
    base.setDate(base.getDate() + weekIdx * 7)
    return base
  }

  function addWeek() {
    const newIdx = weeks.length
    setWeeks(prev => [...prev, { weekNum:newIdx+1, phase:'BASE', sessions:[], isRecovery:false }])
    setSelectedWeek(newIdx)
  }

  function removeWeek(idx) {
    setWeeks(prev => prev.filter((_,i)=>i!==idx).map((w,i)=>({...w,weekNum:i+1})))
    setSelectedWeek(Math.max(0, idx-1))
  }

  function updateWeekPhase(idx, phase) {
    setWeeks(prev => prev.map((w,i) => i===idx ? {...w, phase} : w))
  }

  function handleAddRule(form) {
    const repeatCount = parseInt(form.repeat)
    setWeeks(prev => {
      let updated = [...prev]
      // Ensure enough weeks exist
      while (updated.length < selectedWeek + repeatCount) {
        const newIdx = updated.length
        updated.push({ weekNum:newIdx+1, phase:'BASE', sessions:[], isRecovery:false })
      }
      for (let w = 0; w < repeatCount; w++) {
        const weekIdx = selectedWeek + w
        const weekStartDate = getWeekStartDate(weekIdx)
        const sessionDate = new Date(weekStartDate)
        sessionDate.setDate(weekStartDate.getDate() + parseInt(form.dayOfWeek))
        const dateStr = sessionDate.toISOString().slice(0,10)
        const newSession = {
          id: `coach-${Date.now()}-${w}-${Math.random().toString(36).slice(2,6)}`,
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
        updated = updated.map((wk, i) => {
          if (i !== weekIdx) return wk
          const sessions = [...wk.sessions, newSession].sort((a,b)=>String(a.date).localeCompare(String(b.date)))
          return { ...wk, sessions }
        })
      }
      return updated
    })
    setShowModal(false)
  }

  function removeSession(weekIdx, sessionId) {
    setWeeks(prev => prev.map((w,i) =>
      i===weekIdx ? {...w, sessions:w.sessions.filter(s=>s.id!==sessionId)} : w
    ))
  }

  async function savePlan() {
    if (!meta.startDate) { alert('Définis une date de début.'); return }
    if (weeks.length === 0) { alert('Ajoute au moins une semaine.'); return }
    const totalSessions = weeks.reduce((acc,w)=>acc+w.sessions.length,0)
    if (totalSessions === 0) { alert('Ajoute au moins une séance.'); return }

    setSaving(true)
    try {
      // Build weeks with proper weekStart dates
      const weeksWithDates = weeks.map((w, i) => ({
        ...w,
        weekStart: getWeekStartDate(i).toISOString().slice(0,10),
        targetTSS: w.sessions.reduce((acc,s)=>acc+(s.tss||0),0),
        actualTSS: 0,
      }))

      // Create the new coach plan (athlete activates it themselves from their Goals tab)
      const { error } = await supabase.from('plans').insert({
        user_id: id,
        discipline: meta.discipline,
        level: meta.level,
        start_date: meta.startDate,
        goal_date: meta.goalDate || null,
        event_name: meta.eventName || meta.discipline,
        is_active: false,
        weeks: weeksWithDates,
        completed_sessions: {},
        pbs: athletePlan?.pbs || {},
        zones: athletePlan?.zones || {},
        equipment: athletePlan?.equipment || {},
        age: athlete?.age || null,
        hrmax: athletePlan?.hrmax || null,
        skill_levels: {},
        performance_factor: { run:1, bike:1 },
        athlete_grades: athletePlan?.athlete_grades || {},
        scores: athletePlan?.scores || {},
        athlete_metrics: athletePlan?.athlete_metrics || {},
      })

      if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
      navigate(`/athletes/${id}`)
    } catch(e) {
      alert('Erreur : ' + e.message)
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor:'rgba(147,22,33,0.3)', borderTopColor:'#931621' }} />
    </div>
  )

  const currentWeek = weeks[selectedWeek]
  const totalSessions = weeks.reduce((acc,w)=>acc+w.sessions.length,0)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background:'var(--bg)' }}>
      {showModal && <SessionModal weekStart={meta.startDate} onAdd={handleAddRule} onClose={() => setShowModal(false)} />}

      {/* ── Left panel — Athlete data ── */}
      <div className="w-64 flex-shrink-0 flex flex-col overflow-y-auto border-r p-5 gap-4" style={{ borderColor:'var(--border)', background:'var(--surface)' }}>
        <button onClick={() => navigate(`/athletes/${id}`)} className="text-xs hover:opacity-70 self-start" style={{ color:'var(--text3)' }}>← Retour</button>

        {/* Athlete */}
        <div className="flex items-center gap-3">
          {athlete?.photo_url
            ? <img src={athlete.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            : <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ background:'var(--red)' }}>{athlete?.full_name?.[0]}</div>}
          <div>
            <p className="font-bold text-white text-sm">{athlete?.full_name}</p>
            <p className="text-xs" style={{ color:'var(--text3)' }}>{athlete?.age && `${athlete.age} ans`}</p>
          </div>
        </div>

        {/* Plan meta form */}
        <div className="rounded-xl p-3 flex flex-col gap-3" style={{ background:'var(--surface2)', border:'1px solid var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'var(--text3)' }}>Paramètres du plan</p>

          <div>
            <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color:'var(--text3)' }}>Discipline</label>
            <select value={meta.discipline} onChange={setMetaField('discipline')}
              className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
              style={{ background:'var(--surface)', border:'1px solid var(--border)', colorScheme:'dark' }}>
              {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color:'var(--text3)' }}>Niveau</label>
            <select value={meta.level} onChange={setMetaField('level')}
              className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
              style={{ background:'var(--surface)', border:'1px solid var(--border)', colorScheme:'dark' }}>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color:'var(--text3)' }}>Début du plan</label>
            <input type="date" value={meta.startDate} onChange={setMetaField('startDate')}
              className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
              style={{ background:'var(--surface)', border:'1px solid var(--border)', colorScheme:'dark' }} />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color:'var(--text3)' }}>Date objectif (course)</label>
            <input type="date" value={meta.goalDate} onChange={setMetaField('goalDate')}
              className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
              style={{ background:'var(--surface)', border:'1px solid var(--border)', colorScheme:'dark' }} />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color:'var(--text3)' }}>Nom de l'événement</label>
            <input type="text" value={meta.eventName} onChange={setMetaField('eventName')} placeholder="Ex: Nice Ironman 70.3"
              className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
              style={{ background:'var(--surface)', border:'1px solid var(--border)' }} />
          </div>
        </div>

        {/* Athlete reference data */}
        {athletePlan && (
          <>
            {athletePlan.pbs && Object.keys(athletePlan.pbs).length > 0 && (
              <div className="rounded-xl p-3" style={{ background:'var(--surface2)', border:'1px solid var(--border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color:'var(--text3)' }}>Records</p>
                {athletePlan.pbs.pace5k && <p className="text-xs text-white">5K : {athletePlan.pbs.pace5k}/km</p>}
                {athletePlan.pbs.runTime && <p className="text-xs text-white">Semi : {athletePlan.pbs.runTime}</p>}
                {athletePlan.pbs.ftp && <p className="text-xs text-white">FTP : {athletePlan.pbs.ftp}W</p>}
                {athletePlan.pbs.css && <p className="text-xs text-white">CSS : {athletePlan.pbs.css}/100m</p>}
              </div>
            )}

            {athletePlan.zones?.run?.zones && (
              <div className="rounded-xl p-3" style={{ background:'var(--surface2)', border:'1px solid var(--border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color:'var(--text3)' }}>Zones course{athletePlan.zones.run.vma ? ` · VMA ${athletePlan.zones.run.vma}` : ''}</p>
                {athletePlan.zones.run.zones.map(z => (
                  <div key={z.z} className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:z.c }} />
                    <span className="text-[11px] font-mono" style={{ color:'var(--text3)' }}>{z.z}</span>
                    <span className="text-[11px] flex-1 truncate text-white">{z.range}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Right panel — Week builder ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor:'var(--border)', background:'var(--surface)' }}>
          <div>
            <h1 className="font-bold text-white">Construire le programme</h1>
            <p className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>
              {weeks.length} sem. · {totalSessions} séance{totalSessions!==1?'s':''} · ajouté à la liste des plans de l'athlète
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={addWeek}
              className="px-3 py-2 rounded-xl text-sm font-semibold"
              style={{ background:'var(--surface2)', color:'var(--text2)', border:'1px solid var(--border)' }}>
              + Semaine
            </button>
            <button onClick={() => setShowModal(true)}
              className="px-3 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background:COACH_COLOR }}>
              + Séance
            </button>
            <button onClick={savePlan} disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background:'var(--red)', opacity:saving?0.6:1 }}>
              {saving ? 'Envoi...' : '✅ Publier le plan'}
            </button>
          </div>
        </div>

        {/* Week tabs */}
        <div className="flex gap-1.5 px-6 py-3 overflow-x-auto flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
          {weeks.map((w,i) => (
            <button key={i} onClick={() => setSelectedWeek(i)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                background: selectedWeek===i ? (PHASE_COLORS[w.phase]||'var(--red)') : 'var(--surface)',
                color: selectedWeek===i ? '#fff' : 'var(--text2)',
                border: '1px solid var(--border)',
              }}>
              S{w.weekNum}
              <span className="opacity-70">{w.phase}</span>
              {w.sessions.length > 0 && <span className="font-bold">{w.sessions.length}</span>}
            </button>
          ))}
          {weeks.length === 0 && (
            <span className="text-xs py-1.5" style={{ color:'var(--text3)' }}>Clique "+ Semaine" pour commencer</span>
          )}
        </div>

        {/* Week content */}
        <div className="flex-1 overflow-y-auto p-6">
          {weeks.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-4xl mb-4">📅</p>
              <p className="font-semibold text-white mb-2">Programme vide</p>
              <p className="text-sm mb-5" style={{ color:'var(--text3)' }}>Commence par ajouter des semaines, puis ajoute des séances avec récurrence.</p>
              <button onClick={addWeek} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background:'var(--red)' }}>
                + Semaine 1
              </button>
            </div>
          )}

          {currentWeek && (
            <>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <h2 className="font-bold text-white text-lg">Semaine {currentWeek.weekNum}</h2>
                  <span className="text-sm" style={{ color:'var(--text3)' }}>
                    {getWeekStartDate(selectedWeek).toLocaleDateString('fr-FR', { day:'numeric', month:'long' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select value={currentWeek.phase} onChange={e => updateWeekPhase(selectedWeek, e.target.value)}
                    className="px-3 py-1.5 rounded-xl text-sm font-semibold text-white outline-none"
                    style={{ background:'var(--surface2)', border:'1px solid var(--border)', colorScheme:'dark' }}>
                    {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={() => setShowModal(true)}
                    className="px-3 py-1.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background:COACH_COLOR }}>
                    + Séance
                  </button>
                  <button onClick={() => removeWeek(selectedWeek)}
                    className="px-3 py-1.5 rounded-xl text-sm"
                    style={{ background:'rgba(239,68,68,0.1)', color:'#f87171' }}>
                    Suppr.
                  </button>
                </div>
              </div>

              {currentWeek.sessions.length === 0 ? (
                <div className="rounded-2xl p-10 text-center" style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
                  <p className="text-3xl mb-3">📅</p>
                  <p className="font-semibold text-white mb-1">Semaine vide</p>
                  <p className="text-sm mb-4" style={{ color:'var(--text3)' }}>Ajoute des séances — tu peux les répéter automatiquement sur plusieurs semaines.</p>
                  <button onClick={() => setShowModal(true)} className="text-sm font-semibold" style={{ color:COACH_COLOR }}>+ Ajouter une séance</button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
                    {currentWeek.sessions.map(s => {
                      const sOpt = SPORT_OPTIONS.find(o => o.value === s.sport)
                      const dateObj = new Date(s.date)
                      const dayName = DAYS[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1]
                      return (
                        <div key={s.id} className="rounded-2xl p-4 relative group"
                          style={{ background:'var(--surface)', border:`1px solid rgba(34,197,212,0.25)` }}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                                style={{ background:'rgba(34,197,212,0.1)' }}>
                                {sOpt?.label.split(' ')[0] || '🏋️'}
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color:COACH_COLOR }}>{dayName}</span>
                                <p className="text-sm font-semibold text-white leading-tight">{s.label}</p>
                              </div>
                            </div>
                            <button onClick={() => removeSession(selectedWeek, s.id)}
                              className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                              style={{ background:'rgba(239,68,68,0.15)', color:'#f87171' }}>
                              ✕
                            </button>
                          </div>
                          <div className="flex items-center gap-3 text-xs" style={{ color:'var(--text3)' }}>
                            <span>⏱ {s.duration} min</span>
                            <span>TSS ~{s.tss}</span>
                          </div>
                          {s.coachNote && <p className="text-xs mt-1.5 italic truncate" style={{ color:COACH_COLOR }}>"{s.coachNote}"</p>}
                        </div>
                      )
                    })}
                  </div>

                  {/* Week summary */}
                  <div className="flex gap-4 pt-3 border-t text-sm" style={{ borderColor:'var(--border)' }}>
                    {['swim','bike','run','strength'].map(sport => {
                      const ss = currentWeek.sessions.filter(s => s.sport === sport)
                      if (!ss.length) return null
                      const min = ss.reduce((a,s)=>a+(s.duration||0),0)
                      const o = SPORT_OPTIONS.find(o => o.value === sport)
                      return <span key={sport}>{o?.label.split(' ')[0]} <span className="text-white font-mono">{min}min</span></span>
                    })}
                    <span className="ml-auto" style={{ color:'var(--text3)' }}>
                      TSS {currentWeek.sessions.reduce((a,s)=>a+(s.tss||0),0)}
                    </span>
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
