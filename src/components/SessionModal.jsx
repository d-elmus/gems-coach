import { useState, useEffect } from 'react'
import {
  SPORT_META, SESSION_PRESETS, ZONE_COLORS, DAYS_SHORT,
  getZoneTargets, COACH_COLOR,
} from '../lib/planHelpers'

const ZONES = ['Z1','Z2','Z3','Z4','Z5']

// Types de bloc = ceux que l'app athlète comprend (SessionBlock.type).
const BLOCK_TYPES = [
  { id: 'warmup',   label: 'Échauffement', emoji: '🔥' },
  { id: 'work',     label: 'Travail',      emoji: '⚡' },
  { id: 'recovery', label: 'Récupération', emoji: '🌀' },
  { id: 'cooldown', label: 'Retour calme', emoji: '❄️' },
  { id: 'other',    label: 'Autre',        emoji: '●'  },
]
const BLOCK_META = Object.fromEntries(BLOCK_TYPES.map(b => [b.id, b]))

// La zone d'un bloc peut arriver en nombre (4) ou en chaîne ("Z4") depuis l'app/web.
// On normalise en "Z4" pour l'UI ; l'app relit indifféremment l'un ou l'autre.
function zoneToStr(z) {
  if (z == null || z === '') return ''
  if (typeof z === 'number') return 'Z' + z
  const d = String(z).match(/\d/)
  return d ? 'Z' + d[0] : ''
}

// Reprend un bloc existant en préservant ses champs inconnus (target, instructions_en…).
function normBlock(b = {}) {
  return {
    ...b,
    type: b.type || 'work',
    label: b.label || '',
    instructions: b.instructions || '',
    zone: zoneToStr(b.zone),
    duration: b.duration ?? '',
    distance: b.distance ?? '',
  }
}

function emptyBlock(type = 'work') {
  return { type, label: '', instructions: '', zone: BLOCK_META[type] ? (type === 'work' ? 'Z4' : type === 'warmup' || type === 'recovery' || type === 'cooldown' ? 'Z1' : 'Z2') : '', duration: '', distance: '' }
}

export default function SessionModal({ weekStart, weekIdx, totalWeeks, athletePlan, onAdd, onClose, editSession }) {
  const isEdit = !!editSession

  const [sport, setSport]         = useState('run')
  const [preset, setPreset]       = useState(null)
  const [label, setLabel]         = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [duration, setDuration]   = useState(45)
  const [distance, setDistance]   = useState('')
  const [zone, setZone]           = useState('Z2')
  const [note, setNote]           = useState('')       // note coach privée (carte coach)
  const [rpe, setRpe]             = useState('')        // RPE ressenti (lu par l'app)
  const [nutritionTip, setNutritionTip] = useState('') // conseil nutrition (lu par l'app)
  const [blocks, setBlocks]       = useState([])        // contenu détaillé (lu par l'app)
  const [repeat, setRepeat]       = useState(1)
  const [skipRecovery, setSkipRecovery] = useState(true)

  const zoneTarget = getZoneTargets(athletePlan, sport, zone)

  // Pré-remplit tous les champs quand on édite une séance existante (dont une séance importée).
  useEffect(() => {
    if (!editSession) return
    setSport(editSession.sport || 'run')
    setLabel(editSession.label || '')
    setDuration(editSession.duration || 45)
    setDistance(editSession.distance != null ? editSession.distance : '')
    setZone(editSession.zone || 'Z2')
    setNote(editSession.coachNote || '')
    setRpe(editSession.rpe || '')
    setNutritionTip(editSession.nutritionTip || '')
    setBlocks(Array.isArray(editSession.blocks) ? editSession.blocks.map(normBlock) : [])
    if (editSession.date && weekStart) {
      const d = new Date(editSession.date + 'T12:00:00')
      const jsDay = d.getDay()
      setDayOfWeek(jsDay === 0 ? 6 : jsDay - 1)
    }
  }, [editSession])

  function applyPreset(p) {
    setPreset(p)
    setLabel(p.label)
    setDuration(p.duration)
    setDistance(p.distance !== null ? p.distance : '')
    if (p.zone) setZone(p.zone)
  }

  // ── Manipulation des blocs ──
  function addBlock(type = 'work') { setBlocks(prev => [...prev, emptyBlock(type)]) }
  function updateBlock(i, patch)   { setBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, ...patch } : b)) }
  function removeBlock(i)          { setBlocks(prev => prev.filter((_, idx) => idx !== i)) }
  function moveBlock(i, dir) {
    setBlocks(prev => {
      const n = [...prev]
      const j = i + dir
      if (j < 0 || j >= n.length) return prev
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
  }

  const presets = SESSION_PRESETS[sport] || []
  const sportM  = SPORT_META[sport]
  const maxRepeat = Math.max(1, totalWeeks - weekIdx)
  const blocksTotalMin = blocks.reduce((a, b) => a + (parseInt(b.duration) || 0), 0)

  function handleSubmit() {
    const cleanBlocks = blocks.map(b => ({
      ...b,
      type: b.type || 'work',
      label: b.label?.trim() || undefined,
      instructions: b.instructions?.trim() || undefined,
      zone: b.zone || undefined,
      duration: b.duration === '' || b.duration == null ? undefined : (parseInt(b.duration) || undefined),
      distance: b.distance === '' || b.distance == null ? undefined : (parseFloat(b.distance) || undefined),
    }))
    onAdd({
      sport, label, dayOfWeek,
      duration: parseInt(duration) || 0,
      distance: distance !== '' ? parseFloat(distance) : null,
      zone,
      note,
      rpe: rpe.trim(),
      nutritionTip: nutritionTip.trim(),
      blocks: cleanBlocks,
      repeat: isEdit ? 1 : repeat,
      skipRecovery,
      editId: isEdit ? editSession.id : undefined,
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
                {blocksTotalMin > 0 && (
                  <button onClick={() => setDuration(blocksTotalMin)} className="ml-1 normal-case font-normal underline" style={{ color: COACH_COLOR }}>
                    Σ blocs {blocksTotalMin}
                  </button>
                )}
              </label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                min={10} max={480}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
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

          {/* Zone dominante */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: 'var(--text3)' }}>
              Zone dominante <span className="normal-case font-normal">(sert au calcul du TSS)</span>
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

          {/* ── Contenu détaillé : blocs (ce que voit l'athlète) ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Contenu détaillé <span className="normal-case font-normal">— affiché à l'athlète</span>
              </label>
              <button onClick={() => addBlock('work')}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: COACH_COLOR + '22', color: COACH_COLOR, border: `1px solid ${COACH_COLOR}55` }}>
                + Bloc
              </button>
            </div>

            {blocks.length === 0 ? (
              <div className="rounded-xl p-4 text-center" style={{ background: 'var(--surface2)', border: '1px dashed var(--border)' }}>
                <p className="text-xs mb-3" style={{ color: 'var(--text3)' }}>
                  Aucun bloc. Ajoute l'échauffement, le travail, la récup… chacun avec son commentaire.
                </p>
                <div className="flex gap-1.5 flex-wrap justify-center">
                  {BLOCK_TYPES.map(t => (
                    <button key={t.id} onClick={() => addBlock(t.id)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium"
                      style={{ background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                      + {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {blocks.map((b, i) => {
                  const m = BLOCK_META[b.type] || BLOCK_META.other
                  return (
                    <div key={i} className="rounded-xl p-3 flex flex-col gap-2"
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                      {/* Ligne 1 : type · durée · zone · déplacer · suppr */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <select value={b.type} onChange={e => updateBlock(i, { type: e.target.value })}
                          className="text-xs font-bold outline-none rounded-lg px-2 py-1.5 flex-shrink-0"
                          style={{ background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', colorScheme: 'dark' }}>
                          {BLOCK_TYPES.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
                        </select>
                        <div className="flex items-center gap-1">
                          <input type="number" value={b.duration} onChange={e => updateBlock(i, { duration: e.target.value })}
                            placeholder="min" min={1} max={480}
                            className="w-16 px-2 py-1.5 rounded-lg text-xs text-white outline-none font-mono text-center"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
                          <span className="text-[10px]" style={{ color: 'var(--text3)' }}>min</span>
                        </div>
                        {sportM?.distUnit && (
                          <div className="flex items-center gap-1">
                            <input type="number" value={b.distance} onChange={e => updateBlock(i, { distance: e.target.value })}
                              placeholder={sportM.distUnit} min={0}
                              className="w-16 px-2 py-1.5 rounded-lg text-xs text-white outline-none font-mono text-center"
                              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
                            <span className="text-[10px]" style={{ color: 'var(--text3)' }}>{sportM.distUnit}</span>
                          </div>
                        )}
                        <div className="flex gap-0.5">
                          {ZONES.map(z => (
                            <button key={z} onClick={() => updateBlock(i, { zone: b.zone === z ? '' : z })}
                              className="w-7 h-7 rounded-lg text-[10px] font-bold transition-all"
                              style={{
                                background: b.zone === z ? (ZONE_COLORS[z] || '#fff') + '33' : 'var(--surface)',
                                color:      b.zone === z ? (ZONE_COLORS[z] || '#fff') : 'var(--text3)',
                                border:     `1px solid ${b.zone === z ? (ZONE_COLORS[z] || '#fff') + '66' : 'var(--border)'}`,
                              }}>
                              {z.replace('Z', '')}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                          <button onClick={() => moveBlock(i, -1)} disabled={i === 0}
                            className="w-6 h-6 rounded flex items-center justify-center text-[9px] disabled:opacity-20"
                            style={{ background: 'var(--surface)', color: 'var(--text3)' }}>▲</button>
                          <button onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1}
                            className="w-6 h-6 rounded flex items-center justify-center text-[9px] disabled:opacity-20"
                            style={{ background: 'var(--surface)', color: 'var(--text3)' }}>▼</button>
                          <button onClick={() => removeBlock(i)}
                            className="w-6 h-6 rounded flex items-center justify-center text-xs"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>✕</button>
                        </div>
                      </div>
                      {/* Ligne 2 : nom court du bloc */}
                      <input value={b.label} onChange={e => updateBlock(i, { label: e.target.value })}
                        placeholder={`Nom du bloc (ex: ${m.label}, 5×1000m…)`}
                        className="w-full px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
                      {/* Ligne 3 : commentaire / consignes du bloc */}
                      <textarea value={b.instructions} onChange={e => updateBlock(i, { instructions: e.target.value })}
                        placeholder="Commentaire / consignes de ce bloc (allure, sensations, technique…)"
                        rows={2} className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none resize-none"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
                    </div>
                  )
                })}
                <div className="flex gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] self-center pr-1" style={{ color: 'var(--text3)' }}>+ Bloc :</span>
                  {BLOCK_TYPES.map(t => (
                    <button key={t.id} onClick={() => addBlock(t.id)}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium"
                      style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RPE + Conseil nutrition (lus par l'app) */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text3)' }}>RPE</label>
              <input value={rpe} onChange={e => setRpe(e.target.value)} placeholder="ex: 7/10"
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text3)' }}>Conseil nutrition</label>
              <input value={nutritionTip} onChange={e => setNutritionTip(e.target.value)} placeholder="ex: 1 gel toutes les 40 min"
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
            </div>
          </div>

          {/* Note coach privée */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text3)' }}>
              Note coach <span style={{ fontWeight: 400 }}>(s'affiche sur la carte du builder)</span>
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Rappel perso, focus de la séance..."
              rows={2} className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
          </div>

          {/* Récurrence — masquée en édition */}
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
