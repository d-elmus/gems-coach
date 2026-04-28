import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const PHASE_COLORS = {
  PREP: '#B52E38', BASE: '#0A9DAB', BUILD: '#D9541A', PEAK: '#C0392B', TAPER: '#1E8449'
}
const SPORT_EMOJI = { swim: '🏊', bike: '🚴', run: '🏃', brick: '🔗', strength: '💪', rest: '😴' }

export default function AthletePlan() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [athlete, setAthlete] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [{ data: profile }, { data: planData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('id', id).single(),
      supabase.from('plans').select('*').eq('user_id', id).eq('is_active', true).single(),
    ])
    setAthlete(profile)
    setPlan(planData)
    // Find current week
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

  async function saveNote(sessionId) {
    if (!note.trim()) return
    setSaving(true)
    await supabase.from('coach_notes').insert({
      coach_id: (await supabase.auth.getUser()).data.user.id,
      athlete_id: id,
      plan_id: plan.id,
      session_id: sessionId,
      note: note.trim(),
    })
    setNote('')
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(147,22,33,0.3)', borderTopColor: '#931621' }} />
    </div>
  )

  const week = plan?.weeks?.[selectedWeek]
  const sessions = week?.sessions || []

  return (
    <div className="p-8">
      <button onClick={() => navigate(`/athletes/${id}`)} className="flex items-center gap-2 text-sm mb-6 hover:opacity-70" style={{ color: 'var(--text3)' }}>
        ← {athlete?.full_name}
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Plan d'entraînement</h1>
        <span className="text-sm px-3 py-1 rounded-full font-medium capitalize" style={{ background: 'rgba(147,22,33,0.15)', color: 'var(--red)' }}>
          {plan?.discipline}
        </span>
      </div>

      {/* Week selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {plan?.weeks?.map((w, i) => (
          <button
            key={i}
            onClick={() => setSelectedWeek(i)}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: selectedWeek === i ? PHASE_COLORS[w.phase] || 'var(--red)' : 'var(--surface)',
              color: selectedWeek === i ? '#fff' : 'var(--text2)',
              border: '1px solid var(--border)',
            }}
          >
            S{w.weekNum}
          </button>
        ))}
      </div>

      {/* Week header */}
      {week && (
        <div className="rounded-2xl p-4 mb-6 flex items-center justify-between" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: PHASE_COLORS[week.phase] || 'var(--red)' }}>
              {week.phase}
            </span>
            <p className="text-white font-semibold mt-0.5">Semaine {week.weekNum} · {sessions.filter(s => s.sport !== 'rest').length} séances</p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--text3)' }}>TSS cible</p>
            <p className="text-white font-bold">{week.targetTSS}</p>
          </div>
        </div>
      )}

      {/* Sessions */}
      <div className="flex flex-col gap-3">
        {sessions.filter(s => s.sport !== 'rest').map(s => {
          const isCompleted = !!plan?.completed_sessions?.[s.id]
          return (
            <div
              key={s.id}
              className="rounded-2xl p-5"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${isCompleted ? 'rgba(34,197,212,0.3)' : 'var(--border)'}`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{SPORT_EMOJI[s.sport] || '🏋️'}</span>
                  <div>
                    <p className="font-semibold text-white text-sm">{s.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                      {new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {s.duration ? ` · ${s.duration} min` : ''}
                      {s.tss ? ` · TSS ${s.tss}` : ''}
                    </p>
                  </div>
                </div>
                {isCompleted && (
                  <span className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0" style={{ background: 'rgba(34,197,212,0.1)', color: 'var(--cyan)' }}>
                    ✓ Fait
                  </span>
                )}
              </div>

              {/* Note coach */}
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <textarea
                  placeholder="Ajouter une note coach..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                />
                <button
                  onClick={() => saveNote(s.id)}
                  disabled={!note.trim() || saving}
                  className="mt-2 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity"
                  style={{ background: 'var(--red)', opacity: note.trim() && !saving ? 1 : 0.4 }}
                >
                  {saving ? 'Envoi...' : 'Enregistrer la note'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
