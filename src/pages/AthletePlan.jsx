import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const PHASE_COLORS = {
  PREP: '#B52E38', BASE: '#0A9DAB', BUILD: '#D9541A', PEAK: '#C0392B', TAPER: '#1E8449'
}
const SPORT_OPTIONS = [
  { value: 'swim',     label: '🏊 Natation' },
  { value: 'bike',     label: '🚴 Vélo' },
  { value: 'run',      label: '🏃 Course' },
  { value: 'brick',    label: '🔗 Brick' },
  { value: 'strength', label: '💪 Renfo' },
]
const SPORT_EMOJI = { swim: '🏊', bike: '🚴', run: '🏃', brick: '🔗', strength: '💪' }
const COACH_COLOR = '#22C5D5'

// ─── Session Modal ────────────────────────────────────────────────────────────
function SessionModal({ session, weekStart, onSave, onDelete, onClose }) {
  const isNew = !session
  const [form, setForm] = useState({
    sport:    session?.sport    || 'run',
    label:    session?.label    || '',
    date:     session?.date     ? (typeof session.date === 'string' ? session.date.slice(0,10) : new Date(session.date).toISOString().slice(0,10)) : (weekStart ? new Date(weekStart).toISOString().slice(0,10) : ''),
    duration: session?.duration || 45,
    note:     session?.coachNote || '',
  })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-lg">{isNew ? 'Ajouter une séance' : 'Modifier la séance'}</h3>
          <button onClick={onClose} className="text-lg" style={{ color: 'var(--text3)' }}>✕</button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Sport */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>Sport</label>
            <div className="flex gap-2 flex-wrap">
              {SPORT_OPTIONS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setForm(f => ({ ...f, sport: s.value }))}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: form.sport === s.value ? COACH_COLOR : 'var(--surface2)',
                    color: form.sport === s.value ? '#fff' : 'var(--text2)',
                    border: `1px solid ${form.sport === s.value ? COACH_COLOR : 'var(--border)'}`,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>Titre</label>
            <input
              value={form.label}
              onChange={set('label')}
              placeholder="Ex: Sortie longue Z2"
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            />
          </div>

          {/* Date + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={set('date')}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>Durée (min)</label>
              <input
                type="number"
                value={form.duration}
                onChange={set('duration')}
                min={10} max={360}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          {/* Coach note */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text3)' }}>Note pour l'athlète</label>
            <textarea
              value={form.note}
              onChange={set('note')}
              placeholder="Instructions, objectifs, conseils..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          {!isNew && (
            <button
              onClick={onDelete}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
            >
              Supprimer
            </button>
          )}
          <button
            onClick={() => onSave(form)}
            disabled={!form.label.trim() || !form.date}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity"
            style={{ background: COACH_COLOR, opacity: form.label.trim() && form.date ? 1 : 0.4 }}
          >
            {isNew ? 'Ajouter au plan' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AthletePlan() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [athlete, setAthlete] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(null) // null | { type: 'new' } | { type: 'edit', session }
  const [noteMap, setNoteMap] = useState({}) // sessionId → note text
  const [savingNote, setSavingNote] = useState(null)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [{ data: profile }, { data: planData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('id', id).single(),
      supabase.from('plans').select('*').eq('user_id', id).eq('is_active', true).single(),
    ])
    setAthlete(profile)
    setPlan(planData)
    if (planData?.weeks) {
      const today = new Date(); today.setHours(0,0,0,0)
      const idx = planData.weeks.findIndex(w => {
        const ws = new Date(w.weekStart); ws.setHours(0,0,0,0)
        const we = new Date(ws); we.setDate(we.getDate() + 7)
        return today >= ws && today < we
      })
      setSelectedWeek(Math.max(0, idx))
    }
    setLoading(false)
  }

  async function saveWeeks(updatedWeeks) {
    setSaving(true)
    await supabase.from('plans').update({ weeks: updatedWeeks }).eq('id', plan.id).select('id')
    setPlan(p => ({ ...p, weeks: updatedWeeks }))
    setSaving(false)
  }

  async function handleAddSession(form) {
    const newSession = {
      id: `coach-${Date.now()}`,
      sport: form.sport,
      label: form.label,
      date: form.date,
      duration: parseInt(form.duration),
      tss: Math.round(parseInt(form.duration) * 0.8),
      color: COACH_COLOR,
      coachAdded: true,
      coachNote: form.note,
      done: false,
    }
    const updatedWeeks = plan.weeks.map((w, i) => {
      if (i !== selectedWeek) return w
      const sessions = [...(w.sessions || []), newSession]
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      return { ...w, sessions }
    })
    await saveWeeks(updatedWeeks)
    setModal(null)
  }

  async function handleEditSession(form) {
    const updatedWeeks = plan.weeks.map((w, i) => {
      if (i !== selectedWeek) return w
      const sessions = w.sessions.map(s =>
        s.id === modal.session.id
          ? { ...s, sport: form.sport, label: form.label, date: form.date, duration: parseInt(form.duration), coachNote: form.note, color: s.coachAdded ? COACH_COLOR : s.color }
          : s
      ).sort((a, b) => String(a.date).localeCompare(String(b.date)))
      return { ...w, sessions }
    })
    await saveWeeks(updatedWeeks)
    setModal(null)
  }

  async function handleDeleteSession() {
    const updatedWeeks = plan.weeks.map((w, i) => {
      if (i !== selectedWeek) return w
      return { ...w, sessions: w.sessions.filter(s => s.id !== modal.session.id) }
    })
    await saveWeeks(updatedWeeks)
    setModal(null)
  }

  async function saveNote(sessionId) {
    const note = noteMap[sessionId]
    if (!note?.trim()) return
    setSavingNote(sessionId)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('coach_notes').insert({
      coach_id: user.id,
      athlete_id: id,
      plan_id: plan.id,
      session_id: sessionId,
      note: note.trim(),
    })
    setNoteMap(m => ({ ...m, [sessionId]: '' }))
    setSavingNote(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(147,22,33,0.3)', borderTopColor: '#931621' }} />
    </div>
  )

  if (!plan) return (
    <div className="p-8">
      <button onClick={() => navigate(`/athletes/${id}`)} className="text-sm mb-6 hover:opacity-70 block" style={{ color: 'var(--text3)' }}>← Retour</button>
      <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-white font-semibold mb-1">Aucun plan actif</p>
        <p className="text-sm" style={{ color: 'var(--text3)' }}>L'athlète n'a pas encore créé de plan.</p>
      </div>
    </div>
  )

  const week = plan.weeks?.[selectedWeek]
  const sessions = (week?.sessions || []).filter(s => s.sport !== 'rest')

  return (
    <div className="p-8 max-w-3xl">
      {/* Modals */}
      {modal?.type === 'new' && (
        <SessionModal
          session={null}
          weekStart={week?.weekStart}
          onSave={handleAddSession}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'edit' && (
        <SessionModal
          session={modal.session}
          weekStart={week?.weekStart}
          onSave={handleEditSession}
          onDelete={handleDeleteSession}
          onClose={() => setModal(null)}
        />
      )}

      <button onClick={() => navigate(`/athletes/${id}`)} className="text-sm mb-6 hover:opacity-70 block" style={{ color: 'var(--text3)' }}>
        ← {athlete?.full_name}
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Plan d'entraînement</h1>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs" style={{ color: 'var(--text3)' }}>Sauvegarde...</span>}
          <span className="text-sm px-3 py-1 rounded-full font-medium capitalize" style={{ background: 'rgba(147,22,33,0.15)', color: 'var(--red)' }}>
            {plan.discipline}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: 'var(--red)' }} />
          <span className="text-xs" style={{ color: 'var(--text3)' }}>Plan GEMS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: COACH_COLOR }} />
          <span className="text-xs" style={{ color: 'var(--text3)' }}>Ajouté par le coach</span>
        </div>
      </div>

      {/* Week selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {plan.weeks?.map((w, i) => (
          <button
            key={i}
            onClick={() => setSelectedWeek(i)}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all relative"
            style={{
              background: selectedWeek === i ? PHASE_COLORS[w.phase] || 'var(--red)' : 'var(--surface)',
              color: selectedWeek === i ? '#fff' : 'var(--text2)',
              border: '1px solid var(--border)',
            }}
          >
            S{w.weekNum}
            {w.sessions?.some(s => s.coachAdded) && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2" style={{ background: COACH_COLOR, borderColor: 'var(--surface)' }} />
            )}
          </button>
        ))}
      </div>

      {/* Week header */}
      {week && (
        <div className="rounded-2xl p-4 mb-4 flex items-center justify-between" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: PHASE_COLORS[week.phase] || 'var(--red)' }}>
              {week.phase}
            </span>
            <p className="text-white font-semibold mt-0.5">
              Semaine {week.weekNum} · {sessions.length} séances
            </p>
          </div>
          <button
            onClick={() => setModal({ type: 'new' })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: COACH_COLOR }}
          >
            + Ajouter une séance
          </button>
        </div>
      )}

      {/* Sessions */}
      <div className="flex flex-col gap-3">
        {sessions.length === 0 && (
          <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-sm mb-3" style={{ color: 'var(--text3)' }}>Aucune séance cette semaine.</p>
            <button onClick={() => setModal({ type: 'new' })} className="text-sm font-semibold" style={{ color: COACH_COLOR }}>
              + Ajouter la première séance
            </button>
          </div>
        )}

        {sessions.map(s => {
          const isCompleted = !!plan.completed_sessions?.[s.id]
          const isCoach = !!s.coachAdded
          const accentColor = isCoach ? COACH_COLOR : 'var(--red)'

          return (
            <div
              key={s.id}
              className="rounded-2xl p-5"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${isCoach ? 'rgba(34,197,212,0.3)' : isCompleted ? 'rgba(34,197,212,0.2)' : 'var(--border)'}`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: isCoach ? 'rgba(34,197,212,0.12)' : 'rgba(147,22,33,0.1)' }}>
                    {SPORT_EMOJI[s.sport] || '🏋️'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white text-sm">{s.label}</p>
                      {isCoach && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(34,197,212,0.15)', color: COACH_COLOR }}>
                          COACH
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(34,197,212,0.1)', color: 'var(--cyan)' }}>
                          ✓ Fait
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                      {(() => { try { return new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) } catch { return s.date } })()}
                      {s.duration ? ` · ${s.duration} min` : ''}
                      {s.tss ? ` · TSS ${s.tss}` : ''}
                    </p>
                    {s.coachNote && (
                      <p className="text-xs mt-1 italic" style={{ color: COACH_COLOR }}>"{s.coachNote}"</p>
                    )}
                  </div>
                </div>

                {/* Edit button — only for coach-added or any session */}
                <button
                  onClick={() => setModal({ type: 'edit', session: s })}
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                  style={{ color: 'var(--text3)' }}
                  title="Modifier"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </div>

              {/* Note coach for non-coach sessions */}
              {!isCoach && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <textarea
                    placeholder="Laisser une note sur cette séance..."
                    value={noteMap[s.id] || ''}
                    onChange={e => setNoteMap(m => ({ ...m, [s.id]: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                  />
                  <button
                    onClick={() => saveNote(s.id)}
                    disabled={!noteMap[s.id]?.trim() || savingNote === s.id}
                    className="mt-2 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity"
                    style={{ background: 'var(--red)', opacity: noteMap[s.id]?.trim() && savingNote !== s.id ? 1 : 0.4 }}
                  >
                    {savingNote === s.id ? 'Envoi...' : 'Enregistrer la note'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
