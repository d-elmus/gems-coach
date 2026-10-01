import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import SessionModal from '../../components/SessionModal'
import { Avatar, Icon, Modal, Field, Spinner, SportBadge } from '../../components/ui'
import {
  autoAssignPhases, weekTSSTarget, SPORT_META,
  DISCIPLINES, DISCIPLINE_LABELS, PHASES, PHASE_COLORS, PHASE_LABELS, LEVELS, LEVEL_LABELS, DAYS_SHORT,
} from '../../lib/planHelpers'
import { toLocalDateStr, nextMonday, parseDate } from '../../lib/dateUtils'
import { planWeeks } from '../../lib/coachData'

const ZONE_FACTOR = { Z1: 0.5, Z2: 0.8, Z3: 1.1, Z4: 1.4, Z5: 1.6 }
const newId = (p = 'coach') => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const dayIdx = dateStr => { const d = parseDate(dateStr).getDay(); return d === 0 ? 6 : d - 1 }

// ─── Carte séance dans le tableau de la semaine ──────────────────────────────
function SessionCard({ s, onClick, onRemove }) {
  const m = SPORT_META[s.sport] || SPORT_META.run
  return (
    <div onClick={onClick} className="group relative rounded-xl p-2.5 cursor-pointer transition-shadow hover:shadow-md"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${m.color}` }}>
      <p className="text-[12px] font-extrabold leading-tight pr-4 line-clamp-2">{s.label || m.label}</p>
      <p className="text-[11px] muted mt-1">{s.duration} min{s.zone ? ` · ${s.zone}` : ''}</p>
      {Array.isArray(s.blocks) && s.blocks.length > 0 && <p className="text-[10px] muted">{s.blocks.length} étape{s.blocks.length > 1 ? 's' : ''}</p>}
      <button onClick={e => { e.stopPropagation(); onRemove() }} aria-label="Supprimer"
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md flex items-center justify-center"
        style={{ background: 'var(--bad-soft)', color: 'var(--bad)' }}>
        <Icon name="x" size={11} />
      </button>
    </div>
  )
}

// ─── Frise des semaines (phase + charge) ─────────────────────────────────────
function WeekStrip({ weeks, selected, onSelect, onAdd }) {
  const max = Math.max(1, ...weeks.map(w => Math.max(w.targetTSS || 0, w.actualTSS || 0)))
  return (
    <div className="card p-4">
      <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
        {weeks.map((w, i) => {
          const c = PHASE_COLORS[w.phase] || 'var(--red)'
          const on = i === selected
          return (
            <button key={i} onClick={() => onSelect(i)} className="flex-shrink-0 flex flex-col items-center gap-1.5 w-12"
              title={`S${w.weekNum} · ${PHASE_LABELS[w.phase] || w.phase}${w.isRecovery ? ' · récup' : ''} · ${w.actualTSS || 0}/${w.targetTSS} TSS`}>
              <div className="w-full h-14 flex items-end justify-center relative">
                <div className="w-7 rounded-md absolute bottom-0" style={{ height: `${((w.targetTSS || 0) / max) * 100}%`, border: `1.5px dashed ${c}`, opacity: 0.5 }} />
                <div className="w-7 rounded-md relative" style={{ height: `${Math.max(3, ((w.actualTSS || 0) / max) * 100)}%`, background: c, opacity: on ? 1 : 0.55 }} />
              </div>
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md"
                style={on ? { background: 'var(--text1)', color: '#fff' } : { color: 'var(--text2)' }}>
                S{w.weekNum}{w.isRecovery ? '·R' : ''}
              </span>
            </button>
          )
        })}
        <button onClick={onAdd} className="flex-shrink-0 w-12 h-[84px] rounded-xl flex items-center justify-center muted hover:bg-[var(--surface2)]" title="Ajouter une semaine">
          <Icon name="plus" size={18} />
        </button>
      </div>
      <div className="flex gap-4 flex-wrap mt-3 text-[11px] font-semibold ink2">
        {PHASES.filter(p => weeks.some(w => w.phase === p)).map(p => (
          <span key={p} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: PHASE_COLORS[p] }} />{PHASE_LABELS[p]}</span>
        ))}
        <span className="flex items-center gap-1.5 ml-auto"><span className="w-2.5 h-2.5 rounded-sm" style={{ border: '1.5px dashed var(--text3)' }} />Charge cible</span>
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
  const planId = searchParams.get('planId') // null = création, sinon édition

  const [athlete, setAthlete] = useState(null)
  const [athletePlan, setAthletePlan] = useState(null)
  const [editingPlanId, setEditingPlanId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // { day } | { session }
  const [showSettings, setShowSettings] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [weeks, setWeeks] = useState([])
  const [meta, setMeta] = useState({
    name: '', discipline: 'halfIronman', level: 'intermediate',
    startDate: nextMonday(), goalDate: '', daysPerWeek: 5, recoveryFreq: 4, description: '',
  })
  const setM = k => e => setMeta(m => ({ ...m, [k]: e.target.value }))

  const totalWeeks = useMemo(() => {
    if (!meta.startDate || !meta.goalDate) return weeks.length || 0
    return Math.max(1, Math.round((new Date(meta.goalDate) - new Date(meta.startDate)) / (7 * 86400000)))
  }, [meta.startDate, meta.goalDate, weeks.length])

  useEffect(() => { fetchData() }, [id, planId])

  // Cmd+S / Ctrl+S pour enregistrer
  useEffect(() => {
    const h = e => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); savePlan() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [weeks, meta, editingPlanId])

  async function fetchData() {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single()
    setAthlete(profile)
    if (planId) {
      const { data: existing } = await supabase.from('plans').select('*').eq('id', planId).single()
      if (existing) {
        setEditingPlanId(planId)
        setAthletePlan(existing)
        setMeta({
          name: existing.event_name || '', discipline: existing.discipline || 'halfIronman',
          level: existing.level || 'intermediate', startDate: existing.start_date || nextMonday(),
          goalDate: existing.goal_date || '', daysPerWeek: existing.athlete_metrics?.daysPerWeek || 5, recoveryFreq: 4,
          description: existing.athlete_metrics?.description || '',
        })
        setWeeks(planWeeks(existing))
      }
    } else {
      // Création : le plan actif sert de référence (zones, records) et de base importable.
      const { data: planData } = await supabase.from('plans').select('*').eq('user_id', id).eq('is_active', true).maybeSingle()
      setAthletePlan(planData)
      if (planData) setMeta(m => ({
        ...m, discipline: planData.discipline || m.discipline, level: planData.level || m.level,
        goalDate: planData.goal_date || '', name: planData.event_name || '',
      }))
    }
    setLoading(false)
  }

  function weekStartDate(i) {
    const b = new Date(meta.startDate + 'T12:00:00')
    b.setDate(b.getDate() + i * 7)
    return b
  }
  function emptyWeek(i, phase = 'BASE', isRecovery = false) {
    return {
      weekNum: i + 1, phase, isRecovery, weekStart: toLocalDateStr(weekStartDate(i)),
      targetTSS: weekTSSTarget(phase, isRecovery, meta.level), actualTSS: 0, note: '', sessions: [],
    }
  }
  const withTSS = w => ({ ...w, actualTSS: w.sessions.reduce((a, s) => a + (s.tss || 0), 0) })

  function generateWeeks() {
    if (!meta.startDate) return
    if (weeks.some(w => w.sessions?.length) && !window.confirm('Recréer la structure ? Les séances actuelles seront perdues.')) return
    const n = totalWeeks || 12
    const phases = autoAssignPhases(n, parseInt(meta.recoveryFreq))
    setWeeks(Array.from({ length: n }, (_, i) => emptyWeek(i, phases[i]?.phase || 'BASE', phases[i]?.isRecovery || false)))
    setSelectedWeek(0)
    setShowSettings(false)
  }

  // Reprend le plan actif de l'athlète tel quel (dates, séances, blocs) comme base éditable.
  // Non destructif : son plan n'est touché qu'à la publication.
  function importCurrentPlan() {
    const src = planWeeks(athletePlan)
    if (!src.length) { setError("Cet athlète n'a pas de plan actif à importer."); return }
    if (weeks.some(w => w.sessions?.length) && !window.confirm("Remplacer le contenu actuel par l'entraînement importé ?")) return
    const imported = src.map((w, i) => {
      const sessions = (Array.isArray(w.sessions) ? w.sessions : []).map((s, j) => ({
        ...s, id: s.id || `import-${Date.now()}-${i}-${j}`, sport: s.sport || 'run', label: s.label || '',
        duration: s.duration || 0, distance: s.distance ?? null, tss: s.tss || 0, done: false,
      }))
      const phaseRaw = String(w.phase || 'BASE').toUpperCase()
      const phase = PHASES.includes(phaseRaw) ? phaseRaw : 'BASE'
      const isRecovery = w.isRecovery ?? w.isBufferWeek ?? false
      const actualTSS = sessions.reduce((a, s) => a + (s.tss || 0), 0)
      return {
        weekNum: w.weekNum ?? i + 1, phase, isRecovery,
        weekStart: w.weekStart || toLocalDateStr(weekStartDate(i)),
        targetTSS: w.targetTSS || weekTSSTarget(phase, isRecovery, meta.level) || actualTSS,
        actualTSS, note: w.note || '', sessions,
      }
    })
    setWeeks(imported)
    setSelectedWeek(0)
    setError(null)
    const first = athletePlan?.start_date || imported[0]?.weekStart
    if (first) setMeta(m => ({ ...m, startDate: first }))
  }

  function addWeek() {
    const i = weeks.length
    setWeeks(prev => [...prev, emptyWeek(i)])
    setSelectedWeek(i)
  }
  function removeWeek(i) {
    const n = weeks[i]?.sessions?.length
    if (n && !window.confirm(`Supprimer la semaine ${i + 1} (${n} séance${n > 1 ? 's' : ''}) ?`)) return
    setWeeks(prev => prev.filter((_, k) => k !== i).map((w, k) => ({ ...w, weekNum: k + 1 })))
    setSelectedWeek(Math.max(0, i - 1))
  }
  function duplicateWeek(i) {
    const src = weeks[i]
    const ws = weekStartDate(i + 1)
    const sessions = src.sessions.map(s => {
      const nd = new Date(ws); nd.setDate(ws.getDate() + dayIdx(s.date))
      return { ...s, id: newId(), date: toLocalDateStr(nd), done: false }
    })
    setWeeks(prev => {
      const u = [...prev]
      u.splice(i + 1, 0, { ...src, weekStart: toLocalDateStr(ws), sessions })
      // Les semaines suivantes glissent d'une semaine.
      return u.map((w, k) => {
        if (k <= i + 1) return { ...w, weekNum: k + 1 }
        const nws = weekStartDate(k)
        return { ...w, weekNum: k + 1, weekStart: toLocalDateStr(nws), sessions: w.sessions.map(s => { const d = new Date(nws); d.setDate(nws.getDate() + dayIdx(s.date)); return { ...s, date: toLocalDateStr(d) } }) }
      })
    })
    setSelectedWeek(i + 1)
  }
  function updateWeek(i, patch) { setWeeks(prev => prev.map((w, k) => k === i ? { ...w, ...patch } : w)) }
  function removeSession(wi, sid) { setWeeks(prev => prev.map((w, k) => k === wi ? withTSS({ ...w, sessions: w.sessions.filter(s => s.id !== sid) }) : w)) }

  function handleSession(form) {
    const blocks = Array.isArray(form.blocks) ? form.blocks : []
    const dateFor = wk => { const d = new Date(wk.weekStart + 'T12:00:00'); d.setDate(d.getDate() + parseInt(form.dayOfWeek)); return toLocalDateStr(d) }
    const fields = dur => ({
      sport: form.sport, label: form.label, duration: dur, distance: form.distance, zone: form.zone,
      tss: Math.round(dur * (ZONE_FACTOR[form.zone] ?? 0.8)), blocks,
      rpe: form.rpe || undefined, nutritionTip: form.nutritionTip || undefined, coachNote: form.note || undefined,
    })

    if (form.editId) {
      setWeeks(prev => prev.map((wk, k) => k !== selectedWeek ? wk : withTSS({
        ...wk,
        sessions: wk.sessions.map(s => s.id === form.editId ? { ...s, ...fields(form.duration), date: dateFor(wk) } : s)
          .sort((a, b) => String(a.date).localeCompare(String(b.date))),
      })))
      setModal(null)
      return
    }

    const repeat = parseInt(form.repeat) || 1
    setWeeks(prev => {
      let u = [...prev]
      while (u.length < selectedWeek + repeat) u.push(emptyWeek(u.length))
      for (let r = 0; r < repeat; r++) {
        const wi = selectedWeek + r
        const wk = u[wi]
        const dur = wk.isRecovery && form.skipRecovery ? Math.round(form.duration * 0.7) : form.duration
        const s = { id: newId(), date: dateFor(wk), color: '#9E1B2B', coachAdded: true, done: false, ...fields(dur) }
        u = u.map((w, k) => k !== wi ? w : withTSS({ ...w, sessions: [...w.sessions, s].sort((a, b) => String(a.date).localeCompare(String(b.date))) }))
      }
      return u
    })
    setModal(null)
  }

  async function savePlan() {
    if (!meta.startDate) { setError('Définis une date de début.'); return }
    if (!weeks.reduce((a, w) => a + w.sessions.length, 0)) { setError('Ajoute au moins une séance.'); return }
    setError(null)
    setSaving(true)
    const shared = {
      discipline: meta.discipline, level: meta.level, start_date: meta.startDate, goal_date: meta.goalDate || null,
      event_name: meta.name || DISCIPLINE_LABELS[meta.discipline] || meta.discipline, weeks,
      // Champs annexes dans athlete_metrics pour que l'app mobile les lise sans colonne dédiée.
      athlete_metrics: {
        ...(athletePlan?.athlete_metrics || {}), coachId: coach?.id, description: meta.description || null,
        daysPerWeek: parseInt(meta.daysPerWeek) || 5, totalWeeks: weeks.length,
      },
    }
    let err
    if (editingPlanId) {
      err = (await supabase.from('plans').update(shared).eq('id', editingPlanId).select('id')).error
    } else {
      err = (await supabase.from('plans').insert({
        ...shared, user_id: id, is_active: false, completed_sessions: {},
        pbs: athletePlan?.pbs || {}, zones: athletePlan?.zones || {}, equipment: athletePlan?.equipment || {},
        age: athlete?.age || null, hrmax: athletePlan?.hrmax || null, skill_levels: {},
        performance_factor: { run: 1, bike: 1 }, athlete_grades: athletePlan?.athlete_grades || {}, scores: athletePlan?.scores || {},
      }).select('id')).error
    }
    setSaving(false)
    if (err) { setError('Erreur : ' + err.message); return }
    setSaved(true)
    setTimeout(() => { setSaved(false); navigate(`/athletes/${id}`, { state: { refresh: Date.now() } }) }, 1000)
  }

  async function deletePlan() {
    if (!editingPlanId) return
    if (!window.confirm(`Supprimer définitivement ce plan ?\n${meta.name || 'Ce plan'} · ${weeks.length} semaines`)) return
    const { error: err } = await supabase.from('plans').delete().eq('id', editingPlanId).select('id')
    if (err) { setError('Erreur : ' + err.message); return }
    navigate(`/athletes/${id}`, { state: { refresh: Date.now() } })
  }

  if (loading) return <Spinner full />

  const week = weeks[selectedWeek]
  const totalSessions = weeks.reduce((a, w) => a + w.sessions.length, 0)
  const importable = !editingPlanId && planWeeks(athletePlan).length

  return (
    <div className="px-8 py-7 max-w-[1400px] fade-up">
      {modal && (
        <SessionModal
          weekStart={week?.weekStart} weekIdx={selectedWeek} totalWeeks={weeks.length}
          athletePlan={athletePlan} initialDay={modal.day} editSession={modal.session}
          onAdd={handleSession} onClose={() => setModal(null)} />
      )}
      {showSettings && (
        <Modal eyebrow="Plan" title="Paramètres du plan" onClose={() => setShowSettings(false)}
          footer={<button className="btn btn-primary" onClick={() => setShowSettings(false)}>OK</button>}>
          <Field label="Nom du plan"><input className="input" value={meta.name} onChange={setM('name')} placeholder="Ex : Nice 70.3 2027" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Épreuve"><select className="input" value={meta.discipline} onChange={setM('discipline')}>{DISCIPLINES.map(d => <option key={d} value={d}>{DISCIPLINE_LABELS[d] || d}</option>)}</select></Field>
            <Field label="Niveau"><select className="input" value={meta.level} onChange={setM('level')}>{LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}</select></Field>
            <Field label="Début"><input type="date" className="input" value={meta.startDate} onChange={setM('startDate')} /></Field>
            <Field label="Date de l'objectif"><input type="date" className="input" value={meta.goalDate} onChange={setM('goalDate')} /></Field>
            <Field label="Jours d'entraînement / sem."><select className="input" value={meta.daysPerWeek} onChange={setM('daysPerWeek')}>{[3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n} jours</option>)}</select></Field>
            <Field label="Semaine de récup toutes les"><select className="input" value={meta.recoveryFreq} onChange={setM('recoveryFreq')}><option value={3}>3 semaines</option><option value={4}>4 semaines</option></select></Field>
          </div>
          <Field label="Consignes générales pour l'athlète"><textarea className="input" rows={3} value={meta.description} onChange={setM('description')} placeholder="Objectifs, points d'attention…" /></Field>
          {weeks.length > 0 && (
            <button className="btn btn-ghost btn-sm self-start" onClick={generateWeeks}><Icon name="sparkle" size={14} /> Recréer la structure ({totalWeeks} sem.)</button>
          )}
        </Modal>
      )}

      {/* En-tête */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <button onClick={() => navigate(`/athletes/${id}`)} className="btn btn-ghost btn-icon" aria-label="Retour"><Icon name="left" size={18} /></button>
        <Avatar name={athlete?.full_name} url={athlete?.photo_url} id={id} size={46} />
        <div className="flex-1 min-w-[240px]">
          <p className="eyebrow">{editingPlanId ? 'Modifier le plan' : 'Nouveau plan'} · {athlete?.full_name}</p>
          <input value={meta.name} onChange={setM('name')} placeholder="Nom du plan (ex : Nice 70.3)"
            className="page-title bg-transparent outline-none w-full" style={{ fontSize: 26 }} />
        </div>
        {weeks.length > 0 && <span className="text-[13px] muted">{weeks.length} sem. · {totalSessions} séances</span>}
        <button className="btn btn-ghost" onClick={() => setShowSettings(true)}><Icon name="settings" size={16} /> Paramètres</button>
        {editingPlanId && <button className="btn btn-ghost" onClick={deletePlan} style={{ color: 'var(--bad)' }}><Icon name="trash" size={16} /></button>}
        <button className="btn btn-primary" onClick={savePlan} disabled={saving || !weeks.length}>
          {saved ? <><Icon name="check" size={16} /> Enregistré</> : saving ? 'Enregistrement…' : editingPlanId ? 'Enregistrer' : 'Publier le plan'}
        </button>
      </div>
      {error && <p className="mb-4 text-sm px-4 py-3 rounded-xl" style={{ background: 'var(--bad-soft)', color: 'var(--bad)' }}>{error}</p>}
      {!editingPlanId && weeks.length > 0 && <p className="text-[13px] muted mb-4 -mt-2">Le plan sera envoyé à {athlete?.full_name?.split(' ')[0]} : il l'active depuis son app.</p>}

      {/* Point de départ */}
      {weeks.length === 0 && (
        <div>
          <p className="card-title mb-4">Comment veux-tu commencer ?</p>
          <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${importable ? 3 : 2}, minmax(0,1fr))` }}>
            {importable > 0 && (
              <button onClick={importCurrentPlan} className="card p-6 text-left flex flex-col gap-3 hover:shadow-lg transition-shadow" style={{ borderColor: 'var(--red)' }}>
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'var(--red)', color: '#fff' }}><Icon name="download" size={20} /></div>
                  <span className="pill pill-red">Recommandé</span>
                </div>
                <p className="text-lg font-extrabold">Partir de son plan actuel</p>
                <p className="text-sm muted">Reprend les {planWeeks(athletePlan).length} semaines et toutes les séances de {athlete?.full_name?.split(' ')[0]}. Tu ajustes ce que tu veux.</p>
              </button>
            )}
            <div className="card p-6 flex flex-col gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}><Icon name="sparkle" size={20} /></div>
              <p className="text-lg font-extrabold">Générer la structure</p>
              <p className="text-sm muted">Semaines, phases et charge cible calculées jusqu'à l'objectif. Tu remplis les séances.</p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Field label="Début"><input type="date" className="input" value={meta.startDate} onChange={setM('startDate')} /></Field>
                <Field label="Objectif"><input type="date" className="input" value={meta.goalDate} onChange={setM('goalDate')} /></Field>
              </div>
              <button className="btn btn-primary mt-auto" onClick={generateWeeks} disabled={!meta.startDate}>
                Générer {meta.goalDate ? `${totalWeeks} semaines` : '12 semaines'} <Icon name="arrow" size={16} />
              </button>
            </div>
            <button onClick={addWeek} className="card p-6 text-left flex flex-col gap-3 hover:shadow-lg transition-shadow">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface3)', color: 'var(--text2)' }}><Icon name="plus" size={20} /></div>
              <p className="text-lg font-extrabold">Partir de zéro</p>
              <p className="text-sm muted">Une semaine vide, tu construis au fur et à mesure.</p>
            </button>
          </div>
        </div>
      )}

      {weeks.length > 0 && (
        <div className="flex flex-col gap-5">
          <WeekStrip weeks={weeks} selected={selectedWeek} onSelect={setSelectedWeek} onAdd={addWeek} />

          {week && (
            <div className="card p-5">
              <div className="flex items-center gap-3 flex-wrap mb-4">
                <p className="text-lg font-extrabold">Semaine {week.weekNum}</p>
                <span className="text-[13px] muted">du {parseDate(week.weekStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
                <select className="input" style={{ width: 'auto', height: 34, fontSize: 13, fontWeight: 700, color: PHASE_COLORS[week.phase], borderRadius: 999 }}
                  value={week.phase} onChange={e => updateWeek(selectedWeek, { phase: e.target.value, targetTSS: weekTSSTarget(e.target.value, week.isRecovery, meta.level) })}>
                  {PHASES.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
                </select>
                <button className={`chip ${week.isRecovery ? 'chip-on' : ''}`} style={{ height: 34 }}
                  onClick={() => updateWeek(selectedWeek, { isRecovery: !week.isRecovery, targetTSS: weekTSSTarget(week.phase, !week.isRecovery, meta.level) })}>
                  {week.isRecovery && <Icon name="check" size={13} />} Semaine de récup
                </button>
                <span className="ml-auto text-[13px]">
                  <b>{week.actualTSS || 0}</b> <span className="muted">/ {week.targetTSS} TSS cible</span>
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => duplicateWeek(selectedWeek)} title="Dupliquer la semaine"><Icon name="copy" size={14} /> Dupliquer</button>
                <button className="btn btn-ghost btn-sm" onClick={() => removeWeek(selectedWeek)} style={{ color: 'var(--bad)' }} title="Supprimer la semaine"><Icon name="trash" size={14} /></button>
              </div>

              <input className="input mb-4" value={week.note || ''} onChange={e => updateWeek(selectedWeek, { note: e.target.value })}
                placeholder="Message de la semaine pour l'athlète (objectif, contexte…)" />

              <div className="grid grid-cols-7 gap-2">
                {DAYS_SHORT.map((d, di) => {
                  const date = new Date(week.weekStart + 'T12:00:00'); date.setDate(date.getDate() + di)
                  const list = week.sessions.filter(s => dayIdx(s.date) === di)
                  return (
                    <div key={d} className="rounded-2xl p-2 flex flex-col gap-2 min-h-[180px]" style={{ background: 'var(--surface2)' }}>
                      <p className="text-[12px] font-extrabold px-1 flex items-baseline gap-1.5">{d} <span className="muted font-semibold">{date.getDate()}</span></p>
                      {list.map(s => (
                        <SessionCard key={s.id} s={s} onClick={() => setModal({ session: s })} onRemove={() => removeSession(selectedWeek, s.id)} />
                      ))}
                      <button onClick={() => setModal({ day: di })}
                        className="mt-auto h-9 rounded-xl flex items-center justify-center muted hover:bg-[var(--surface)] transition-colors"
                        style={{ border: '1.5px dashed var(--border-strong)' }} aria-label={`Ajouter une séance ${d}`}>
                        <Icon name="plus" size={15} />
                      </button>
                    </div>
                  )
                })}
              </div>

              {week.sessions.length > 0 && (
                <div className="flex items-center gap-5 flex-wrap mt-4 pt-4 text-[13px]" style={{ borderTop: '1px solid var(--border)' }}>
                  {Object.keys(SPORT_META).map(k => {
                    const ss = week.sessions.filter(s => s.sport === k)
                    if (!ss.length) return null
                    return (
                      <span key={k} className="flex items-center gap-2">
                        <SportBadge sport={k} size={26} />
                        <b>{ss.reduce((a, s) => a + (s.duration || 0), 0)} min</b>
                        <span className="muted">{ss.length} séance{ss.length > 1 ? 's' : ''}</span>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
