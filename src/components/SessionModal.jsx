import { useState } from 'react'
import { SPORT_META, SESSION_PRESETS, DAYS_SHORT, getZoneTargets } from '../lib/planHelpers'
import { Modal, Field, Icon, sportColor } from './ui'

const ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

// Types de bloc = ceux que l'app athlète comprend (SessionBlock.type).
const BLOCK_TYPES = [
  { id: 'warmup', label: 'Échauffement' },
  { id: 'work', label: 'Travail' },
  { id: 'recovery', label: 'Récupération' },
  { id: 'cooldown', label: 'Retour au calme' },
  { id: 'other', label: 'Autre' },
]

// La zone d'un bloc peut arriver en nombre (4) ou en chaîne ("Z4") : on normalise en "Z4".
function zoneToStr(z) {
  if (z == null || z === '') return ''
  if (typeof z === 'number') return 'Z' + z
  const d = String(z).match(/\d/)
  return d ? 'Z' + d[0] : ''
}
// Reprend un bloc existant en préservant ses champs inconnus (target, instructions_en…).
function normBlock(b = {}) {
  return { ...b, type: b.type || 'work', label: b.label || '', instructions: b.instructions || '', zone: zoneToStr(b.zone), duration: b.duration ?? '', distance: b.distance ?? '' }
}
function dayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00').getDay()
  return d === 0 ? 6 : d - 1
}

export default function SessionModal({ weekIdx, totalWeeks, athletePlan, onAdd, onClose, editSession, initialDay = 0 }) {
  const e = editSession
  const [sport, setSport] = useState(e?.sport || 'run')
  const [label, setLabel] = useState(e?.label || '')
  const [dayOfWeek, setDayOfWeek] = useState(e?.date ? dayOf(e.date) : initialDay)
  const [duration, setDuration] = useState(e?.duration || 45)
  const [distance, setDistance] = useState(e?.distance ?? '')
  const [zone, setZone] = useState(e?.zone || 'Z2')
  const [note, setNote] = useState(e?.coachNote || '')
  const [rpe, setRpe] = useState(e?.rpe || '')
  const [nutritionTip, setNutritionTip] = useState(e?.nutritionTip || '')
  const [blocks, setBlocks] = useState(Array.isArray(e?.blocks) ? e.blocks.map(normBlock) : [])
  const [repeat, setRepeat] = useState(1)
  const [skipRecovery, setSkipRecovery] = useState(true)
  const [more, setMore] = useState(!!(e?.rpe || e?.nutritionTip || e?.coachNote))

  const target = getZoneTargets(athletePlan, sport, zone)
  const sportM = SPORT_META[sport]
  const maxRepeat = Math.max(1, totalWeeks - weekIdx)
  const blocksMin = blocks.reduce((a, b) => a + (parseInt(b.duration) || 0), 0)

  function applyPreset(p) {
    setLabel(p.label)
    setDuration(p.duration)
    setDistance(p.distance ?? '')
    if (p.zone) setZone(p.zone)
  }
  function updateBlock(i, patch) { setBlocks(prev => prev.map((b, k) => k === i ? { ...b, ...patch } : b)) }
  function moveBlock(i, dir) {
    setBlocks(prev => {
      const n = [...prev], j = i + dir
      if (j < 0 || j >= n.length) return prev
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
  }

  function submit() {
    onAdd({
      sport, label: label.trim() || sportM?.label, dayOfWeek,
      duration: parseInt(duration) || 0,
      distance: distance !== '' ? parseFloat(distance) : null,
      zone, note, rpe: String(rpe).trim(), nutritionTip: nutritionTip.trim(),
      blocks: blocks.map(b => ({
        ...b,
        type: b.type || 'work',
        label: b.label?.trim() || undefined,
        instructions: b.instructions?.trim() || undefined,
        zone: b.zone || undefined,
        duration: b.duration === '' || b.duration == null ? undefined : (parseInt(b.duration) || undefined),
        distance: b.distance === '' || b.distance == null ? undefined : (parseFloat(b.distance) || undefined),
      })),
      repeat: e ? 1 : repeat, skipRecovery,
      editId: e?.id,
    })
  }

  return (
    <Modal eyebrow={`Semaine ${weekIdx + 1}`} title={e ? 'Modifier la séance' : 'Nouvelle séance'} onClose={onClose} width={680}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={submit}>
          {e ? 'Enregistrer' : repeat > 1 ? `Ajouter sur ${repeat} semaines` : 'Ajouter la séance'} <Icon name="arrow" size={16} />
        </button>
      </>}>

      <div className="flex gap-2 flex-wrap">
        {Object.entries(SPORT_META).map(([k, m]) => (
          <button key={k} onClick={() => setSport(k)} className="chip"
            style={sport === k ? { background: sportColor(k), borderColor: sportColor(k), color: '#fff' } : undefined}>
            {m.label}
          </button>
        ))}
      </div>

      <Field label="Titre">
        <input className="input" value={label} onChange={ev => setLabel(ev.target.value)} placeholder="Ex : Intervalles 5×1000m" autoFocus />
        {(SESSION_PRESETS[sport] || []).length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            {SESSION_PRESETS[sport].map(p => (
              <button key={p.label} onClick={() => applyPreset(p)} className="pill pill-neutral hover:opacity-80" style={label === p.label ? { background: 'var(--red-soft)', color: 'var(--red)' } : undefined}>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </Field>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr)' }}>
        <Field label="Jour">
          <div className="flex gap-1">
            {DAYS_SHORT.map((d, i) => (
              <button key={d} onClick={() => setDayOfWeek(i)} className="flex-1 h-11 rounded-xl text-[12px] font-bold"
                style={dayOfWeek === i ? { background: 'var(--red)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                {d}
              </button>
            ))}
          </div>
        </Field>
        <Field label={<>Durée (min){blocksMin > 0 && blocksMin !== parseInt(duration) && <button className="ml-1.5 underline" style={{ color: 'var(--red)' }} onClick={() => setDuration(blocksMin)}>= {blocksMin}</button>}</>}>
          <input type="number" className="input" value={duration} min={5} onChange={ev => setDuration(ev.target.value)} />
        </Field>
        <Field label={`Distance${sportM?.distUnit ? ` (${sportM.distUnit})` : ''}`}>
          <input type="number" className="input" value={distance} disabled={!sportM?.distUnit} onChange={ev => setDistance(ev.target.value)} placeholder="—" />
        </Field>
      </div>

      <Field label="Intensité dominante">
        <div className="flex gap-1.5">
          {ZONES.map(z => (
            <button key={z} onClick={() => setZone(z)} className="flex-1 h-10 rounded-xl text-[13px] font-extrabold"
              style={zone === z ? { background: 'var(--red)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
              {z}
            </button>
          ))}
        </div>
        {target && (target.pace || target.power || target.hr) && (
          <p className="text-[12px] ink2 mt-2 flex gap-3 flex-wrap">
            <span className="font-bold" style={{ color: 'var(--red)' }}>Pour cet athlète :</span>
            {target.pace && <span>{target.pace}</span>}{target.power && <span>{target.power}</span>}{target.hr && <span>{target.hr}</span>}
          </p>
        )}
      </Field>

      <Field label="Contenu (ce que voit l'athlète)">
        <div className="flex flex-col gap-2">
          {blocks.map((b, i) => (
            <div key={i} className="card-soft p-3 flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                <span className="display text-lg w-7" style={{ color: 'var(--red)' }}>{String(i + 1).padStart(2, '0')}</span>
                <select className="input" style={{ height: 36, width: 150, fontSize: 13 }} value={b.type} onChange={ev => updateBlock(i, { type: ev.target.value })}>
                  {BLOCK_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <input className="input flex-1" style={{ height: 36, fontSize: 13 }} value={b.label} onChange={ev => updateBlock(i, { label: ev.target.value })} placeholder="Ex : 5×1000m" />
                <input className="input" type="number" style={{ height: 36, width: 70, fontSize: 13 }} value={b.duration} onChange={ev => updateBlock(i, { duration: ev.target.value })} placeholder="min" />
                <select className="input" style={{ height: 36, width: 76, fontSize: 13 }} value={b.zone} onChange={ev => updateBlock(i, { zone: ev.target.value })}>
                  <option value="">—</option>{ZONES.map(z => <option key={z}>{z}</option>)}
                </select>
                <div className="flex flex-col">
                  <button className="muted hover:opacity-70 disabled:opacity-20" disabled={i === 0} onClick={() => moveBlock(i, -1)} aria-label="Monter"><Icon name="left" size={12} style={{ transform: 'rotate(90deg)' }} /></button>
                  <button className="muted hover:opacity-70 disabled:opacity-20" disabled={i === blocks.length - 1} onClick={() => moveBlock(i, 1)} aria-label="Descendre"><Icon name="right" size={12} style={{ transform: 'rotate(90deg)' }} /></button>
                </div>
                <button className="muted hover:opacity-70" onClick={() => setBlocks(prev => prev.filter((_, k) => k !== i))} aria-label="Supprimer"><Icon name="x" size={16} /></button>
              </div>
              <input className="input" style={{ height: 34, fontSize: 13 }} value={b.instructions} onChange={ev => updateBlock(i, { instructions: ev.target.value })} placeholder="Consigne (allure, récup, technique…)" />
            </div>
          ))}
          <div className="flex gap-2 flex-wrap">
            {blocks.length === 0
              ? <button className="btn btn-soft btn-sm" onClick={() => setBlocks([
                  { type: 'warmup', label: 'Échauffement', instructions: '', zone: 'Z1', duration: 15, distance: '' },
                  { type: 'work', label: label || '', instructions: '', zone, duration: '', distance: '' },
                  { type: 'cooldown', label: 'Retour au calme', instructions: '', zone: 'Z1', duration: 10, distance: '' },
                ])}><Icon name="plus" size={14} /> Échauffement · corps de séance · retour au calme</button>
              : <button className="btn btn-ghost btn-sm" onClick={() => setBlocks(prev => [...prev, { type: 'work', label: '', instructions: '', zone: '', duration: '', distance: '' }])}><Icon name="plus" size={14} /> Ajouter une étape</button>}
          </div>
        </div>
      </Field>

      <button className="text-[13px] font-bold self-start flex items-center gap-1.5" style={{ color: 'var(--red)' }} onClick={() => setMore(m => !m)}>
        <Icon name="down" size={14} style={{ transform: more ? 'rotate(180deg)' : 'none' }} /> {more ? "Moins d'options" : "Plus d'options"} (RPE, nutrition, note{!e ? ', répétition' : ''})
      </button>
      {more && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="RPE visé"><input className="input" value={rpe} onChange={ev => setRpe(ev.target.value)} placeholder="Ex : 7/10" /></Field>
            <div className="col-span-2"><Field label="Conseil nutrition"><input className="input" value={nutritionTip} onChange={ev => setNutritionTip(ev.target.value)} placeholder="Ex : 1 gel toutes les 40 min" /></Field></div>
          </div>
          <Field label="Note privée (visible par toi seulement)"><input className="input" value={note} onChange={ev => setNote(ev.target.value)} placeholder="Rappel perso, focus…" /></Field>
          {!e && maxRepeat > 1 && (
            <Field label="Répéter">
              <select className="input" value={repeat} onChange={ev => setRepeat(parseInt(ev.target.value))}>
                <option value={1}>Cette semaine uniquement</option>
                {Array.from({ length: maxRepeat - 1 }, (_, i) => i + 2).map(n => <option key={n} value={n}>Sur {n} semaines</option>)}
              </select>
              {repeat > 1 && (
                <label className="flex items-center gap-2 mt-2 text-[13px] ink2 cursor-pointer">
                  <input type="checkbox" checked={skipRecovery} onChange={ev => setSkipRecovery(ev.target.checked)} style={{ accentColor: 'var(--red)' }} />
                  Volume réduit (−30 %) les semaines de récup
                </label>
              )}
            </Field>
          )}
        </div>
      )}
    </Modal>
  )
}
