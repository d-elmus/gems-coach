import { useState, useEffect } from 'react'
import {
  SPORT_META, SESSION_PRESETS, ZONE_COLORS, DAYS_SHORT,
  getZoneTargets,
} from '../lib/planHelpers'
import WorkoutBuilder, {
  newStep, newRepeat, stepsToMinutes, stepsToTSS,
} from './WorkoutBuilder'

const ZONES = ['Z1','Z2','Z3','Z4','Z5']

export default function SessionModal({ weekStart, weekIdx, totalWeeks, athletePlan, onAdd, onClose, editSession }) {
  const isEdit = !!editSession

  const [sport, setSport]         = useState('run')
  const [preset, setPreset]       = useState(null)
  const [label, setLabel]         = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [duration, setDuration]   = useState(45)
  const [distance, setDistance]   = useState('')
  const [zone, setZone]           = useState('Z2')
  const [note, setNote]           = useState('')
  const [instructions, setInstructions] = useState('')
  const [repeat, setRepeat]       = useState(1)
  const [skipRecovery, setSkipRecovery] = useState(true)

  // Structured workout
  const [workoutMode, setWorkoutMode] = useState('simple') // 'simple' | 'structured'
  const [workoutSteps, setWorkoutSteps] = useState([])

  const zoneTarget = getZoneTargets(athletePlan, sport, zone)

  // Populate fields when editing an existing session
  useEffect(() => {
    if (!editSession) return
    setSport(editSession.sport || 'run')
    setLabel(editSession.label || '')
    setDuration(editSession.duration || 45)
    setDistance(editSession.distance != null ? editSession.distance : '')
    setZone(editSession.zone || 'Z2')
    setNote(editSession.coachNote || '')
    setInstructions(editSession.instructions || '')
    if (editSession.structuredWorkout?.steps?.length) {
      setWorkoutMode('structured')
      setWorkoutSteps(editSession.structuredWorkout.steps)
    }
    if (editSession.date && weekStart) {
      const d = new Date(editSession.date + 'T12:00:00')
      const jsDay = d.getDay()
      setDayOfWeek(jsDay === 0 ? 6 : jsDay - 1)
    }
  }, [editSession])

  // When workout steps change in structured mode, sync duration
  useEffect(() => {
    if (workoutMode === 'structured' && workoutSteps.length > 0) {
      const mins = stepsToMinutes(workoutSteps)
      if (mins > 0) setDuration(mins)
    }
  }, [workoutSteps, workoutMode])

  function switchToStructured() {
    setWorkoutMode('structured')
    if (workoutSteps.length === 0) {
      setWorkoutSteps([newStep('warmup'), newRepeat(), newStep('cooldown')])
    }
  }

  function applyPreset(p) {
    setPreset(p)
    setLabel(p.label)
    setDuration(p.duration)
    setDistance(p.distance !== null ? p.distance : '')
    if (p.zone) setZone(p.zone)
  }

  const presets = SESSION_PRESETS[sport] || []
  const sportM  = SPORT_META[sport]
  const maxRepeat = Math.max(1, totalWeeks - weekIdx)

  const computedDuration = workoutMode === 'structured' && workoutSteps.length > 0
    ? stepsToMinutes(workoutSteps)
    : parseInt(duration) || 0

  function handleSubmit() {
    const sw = workoutMode === 'structured' && workoutSteps.length > 0
      ? { steps: workoutSteps }
      : null
    onAdd({
      sport, label, dayOfWeek,
      duration: computedDuration || parseInt(duration),
      distance: distance !== '' ? parseFloat(distance) : null,
      zone, note, instructions,
      repeat: isEdit ? 1 : repeat,
      skipRecovery,
      editId: isEdit ? editSession.id : undefined,
      structuredWorkout: sw,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <div className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl overflow-y-auto"
        style={{ background: 'var(--surface)', maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h3 className="font-bold text-white text-lg">
            {isEdit ? 'Modifier la séance' : 'Créer une séance'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--surface2)', color: 'var(--text3)' }}>✕</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Sport selector */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: 'var(--text3)' }}>Sport</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(SPORT_META).map(([s, m]) => (
                <button key={s} onClick={() => { setSport(s); setPreset(null); setZone('Z2') }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: sport === s ? m.color + '22' : 'var(--surface2)',
                    color:      sport === s ? m.color : 'var(--text2)',
                    border:     `1px solid ${sport === s ? m.color + '88' : 'var(--border)'}`,
                  }}>
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Presets */}
          {presets.length > 0 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: 'var(--text3)' }}>
                Modèle rapide <span style={{ fontWeight: 400 }}>(optionnel)</span>
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {presets.map((p, i) => (
                  <button key={i} onClick={() => applyPreset(p)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: preset?.label === p.label ? COACH_COLOR + '22' : 'var(--surface2)',
                      color:      preset?.label === p.label ? COACH_COLOR : 'var(--text3)',
                      border:     `1px solid ${preset?.label === p.label ? COACH_COLOR + '66' : 'var(--border)'}`,
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Titre */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text3)' }}>Titre de la séance *</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Intervalles 5×1000m @Z4"
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
          </div>

          {/* Jour + Durée + Distance */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text3)' }}>Jour</label>
              <div className="flex flex-wrap gap-1">
                {DAYS_SHORT.map((d, i) => (
                  <button key={i} onClick={() => setDayOfWeek(i)}
                    className="w-8 h-8 rounded-lg text-xs font-bold transition-all"
                    style={{ background: dayOfWeek === i ? COACH_COLOR : 'var(--surface2)', color: dayOfWeek === i ? '#fff' : 'var(--text2)' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text3)' }}>
                Durée (min)
                {workoutMode === 'structured' && workoutSteps.length > 0 && (
                  <span className="ml-1 normal-case font-normal" style={{ color: COACH_COLOR }}>calculée ✓</span>
                )}
              </label>
              <input type="number" value={workoutMode === 'structured' ? computedDuration : duration}
                onChange={e => setDuration(e.target.value)}
                readOnly={workoutMode === 'structured' && workoutSteps.length > 0}
                min={10} max={480}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{
                  background: 'var(--surface2)',
                  border: `1px solid ${workoutMode === 'structured' ? COACH_COLOR + '55' : 'var(--border)'}`,
                  opacity: workoutMode === 'structured' ? 0.7 : 1,
                }} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text3)' }}>
                Distance {sportM?.distUnit ? `(${sportM.distUnit})` : ''}
              </label>
              <input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="—"
                disabled={!sportM?.distUnit}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none disabled:opacity-40"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
            </div>
          </div>

          {/* Zone cible globale */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: 'var(--text3)' }}>
              Zone dominante
              {workoutMode === 'structured' && <span className="ml-1 normal-case font-normal" style={{ color: 'var(--text3)' }}>(utilisée pour le TSS si mode simple)</span>}
            </label>
            <div className="flex gap-2 mb-2">
              {ZONES.map(z => (
                <button key={z} onClick={() => setZone(z)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: zone === z ? ZONE_COLORS[z] + '33' : 'var(--surface2)',
                    color:      zone === z ? ZONE_COLORS[z] : 'var(--text3)',
                    border:     `1px solid ${zone === z ? ZONE_COLORS[z] + '88' : 'var(--border)'}`,
                  }}>
                  {z}
                </button>
              ))}
            </div>
            {zoneTarget && (
              <div className="rounded-xl px-3 py-2 flex flex-wrap gap-3 text-xs" style={{ background: 'var(--surface2)' }}>
                {zoneTarget.pace  && <span style={{ color: ZONE_COLORS[zone] }}>🏃 {zoneTarget.pace}</span>}
                {zoneTarget.power && <span style={{ color: ZONE_COLORS[zone] }}>⚡ {zoneTarget.power}</span>}
                {zoneTarget.hr    && <span style={{ color: 'var(--text3)' }}>❤️ {zoneTarget.hr}</span>}
                {zoneTarget.label && <span style={{ color: 'var(--text2)' }}>{zoneTarget.label}</span>}
              </div>
            )}
          </div>

          {/* ── Mode toggle: Simple / Structuré ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Contenu de la séance
              </label>
              <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <button onClick={() => setWorkoutMode('simple')}
                  className="px-3 py-1.5 text-xs font-semibold transition-all"
                  style={{
                    background: workoutMode === 'simple' ? 'var(--surface2)' : 'transparent',
                    color: workoutMode === 'simple' ? 'var(--text2)' : 'var(--text3)',
                  }}>
                  ✏️ Texte libre
                </button>
                <button onClick={switchToStructured}
                  className="px-3 py-1.5 text-xs font-semibold transition-all"
                  style={{
                    background: workoutMode === 'structured' ? COACH_COLOR + '22' : 'transparent',
                    color: workoutMode === 'structured' ? COACH_COLOR : 'var(--text3)',
                    borderLeft: '1px solid var(--border)',
                  }}>
                  ⚡ Structuré
                </button>
              </div>
            </div>

            {/* Simple mode: instructions textarea */}
            {workoutMode === 'simple' && (
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                placeholder="Ex: Échauffement 10 min Z1 · 5×1000m @Z4 récup 2min · Retour au calme 10 min Z1"
                rows={4} className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
            )}

            {/* Structured mode: WorkoutBuilder */}
            {workoutMode === 'structured' && (
              <div className="rounded-xl p-4" style={{ background: 'var(--surface2)', border: `1px solid ${COACH_COLOR}33` }}>
                <WorkoutBuilder value={workoutSteps} onChange={setWorkoutSteps} sport={sport} />
                {/* Optional extra instructions */}
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text3)' }}>
                    Instructions complémentaires <span style={{ fontWeight: 400 }}>(optionnel)</span>
                  </label>
                  <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                    placeholder="Consignes supplémentaires, points d'attention..."
                    rows={2} className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none resize-none"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
                </div>
              </div>
            )}
          </div>

          {/* Note coach */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text3)' }}>
              Note coach privée <span style={{ fontWeight: 400 }}>(s'affiche sur la carte)</span>
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Conseils techniques, focus de la séance..."
              rows={2} className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
          </div>

          {/* Récurrence — hidden when editing */}
          {!isEdit && (
            <div className="rounded-xl p-4" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Récurrence</label>
                <span className="text-sm font-bold" style={{ color: COACH_COLOR }}>
                  {repeat === 1 ? 'Semaine actuelle uniquement' : `Répéter sur ${repeat} semaines`}
                </span>
              </div>
              <input type="range" min={1} max={maxRepeat} value={repeat}
                onChange={e => setRepeat(parseInt(e.target.value))}
                className="w-full mb-2" style={{ accentColor: COACH_COLOR }} />
              <div className="flex justify-between text-[10px]" style={{ color: 'var(--text3)' }}>
                <span>1 sem.</span>
                <span>{Math.ceil(maxRepeat / 2)} sem.</span>
                <span>{maxRepeat} sem.</span>
              </div>
              {repeat > 1 && (
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input type="checkbox" checked={skipRecovery} onChange={e => setSkipRecovery(e.target.checked)}
                    style={{ accentColor: COACH_COLOR }} />
                  <span className="text-xs" style={{ color: 'var(--text2)' }}>
                    Volume réduit (-30%) sur les semaines de récupération
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-6 pb-6 pt-2 sticky bottom-0" style={{ background: 'var(--surface)' }}>
          <button
            onClick={handleSubmit}
            disabled={!label.trim()}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-opacity"
            style={{ background: `linear-gradient(135deg, ${COACH_COLOR}, #1A9FAD)`, opacity: label.trim() ? 1 : 0.4 }}>
            {isEdit
              ? 'Modifier la séance →'
              : repeat > 1 ? `Ajouter sur ${repeat} semaines →` : 'Ajouter à cette semaine →'}
          </button>
        </div>
      </div>
    </div>
  )
}
