import { ZONE_COLORS } from '../lib/planHelpers'

const COACH_COLOR = '#22C5D5'
const ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

export const STEP_META = {
  warmup:   { label: 'Échauffement', emoji: '🔥', color: '#60a5fa', defaultZone: 'Z1', defaultDur: 10, defaultUnit: 'min' },
  work:     { label: 'Travail',      emoji: '⚡', color: '#fbbf24', defaultZone: 'Z4', defaultDur: 5,  defaultUnit: 'min' },
  recovery: { label: 'Récupération', emoji: '🌀', color: '#34d399', defaultZone: 'Z1', defaultDur: 2,  defaultUnit: 'min' },
  cooldown: { label: 'Retour calme', emoji: '❄️', color: '#818cf8', defaultZone: 'Z1', defaultDur: 10, defaultUnit: 'min' },
  other:    { label: 'Autre',        emoji: '●',  color: '#9ca3af', defaultZone: 'Z2', defaultDur: 5,  defaultUnit: 'min' },
}

const STEP_TYPES = Object.entries(STEP_META).map(([id, m]) => ({ id, ...m }))

function uid() { return Math.random().toString(36).slice(2, 10) }

export function newStep(type = 'work') {
  const m = STEP_META[type] || STEP_META.work
  return { id: uid(), type, zone: m.defaultZone, dur: m.defaultDur, durUnit: m.defaultUnit, notes: '' }
}

export function newRepeat() {
  return { id: uid(), type: 'repeat', count: 5, label: '', steps: [newStep('work'), newStep('recovery')] }
}

// Total minutes from a steps array (including nested repeat blocks)
export function stepsToMinutes(steps = []) {
  const toMin = s => {
    if (!s?.dur) return 0
    if (s.durUnit === 'sec') return s.dur / 60
    if (s.durUnit === 'km')  return s.dur * 5
    if (s.durUnit === 'm')   return (s.dur / 1000) * 5
    return s.dur
  }
  let total = 0
  for (const item of steps) {
    if (item.type === 'repeat')
      total += (item.steps || []).reduce((a, s) => a + toMin(s), 0) * (item.count || 1)
    else
      total += toMin(item)
  }
  return Math.round(total)
}

// TSS estimate from steps
export function stepsToTSS(steps = []) {
  const f = { Z1: 0.5, Z2: 0.8, Z3: 1.1, Z4: 1.4, Z5: 1.6 }
  const toMin = s => {
    if (!s?.dur) return 0
    if (s.durUnit === 'sec') return s.dur / 60
    if (s.durUnit === 'km')  return s.dur * 5
    if (s.durUnit === 'm')   return (s.dur / 1000) * 5
    return s.dur
  }
  const tss = s => toMin(s) * (f[s.zone] ?? 0.8)
  let total = 0
  for (const item of steps) {
    if (item.type === 'repeat')
      total += (item.steps || []).reduce((a, s) => a + tss(s), 0) * (item.count || 1)
    else
      total += tss(item)
  }
  return Math.round(total)
}

// Compact one-liner for session card display
export function workoutSummary(steps = []) {
  const fmtDur = s => s.durUnit === 'sec' ? `${s.dur}s`
    : s.durUnit === 'km' ? `${s.dur}km`
    : s.durUnit === 'm'  ? `${s.dur}m`
    : `${s.dur}min`
  const fmtStep = s => `${fmtDur(s)}${s.zone ? '@' + s.zone : ''}${s.notes ? ' "' + s.notes + '"' : ''}`
  return steps.map(item => {
    if (item.type === 'repeat') {
      const inner = (item.steps || []).map(fmtStep).join(' + ')
      return `${item.count}×(${inner})`
    }
    const m = STEP_META[item.type]
    return `${m?.emoji || '●'} ${fmtStep(item)}`
  }).join('  →  ')
}

// ─── Single step row ──────────────────────────────────────────────────────────
function StepRow({ step, onUpdate, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown, sport }) {
  const m = STEP_META[step.type] || STEP_META.other
  const units = sport === 'swim'
    ? ['min', 'sec', 'm']
    : sport === 'run'
    ? ['min', 'sec', 'km', 'm']
    : ['min', 'sec', 'km']

  return (
    <div className="flex items-center gap-1.5 flex-wrap rounded-xl px-3 py-2"
      style={{ background: 'var(--surface)', border: `1px solid ${m.color}33` }}>

      {/* Up/down */}
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <button onClick={onMoveUp} disabled={!canMoveUp}
          className="w-5 h-[14px] rounded text-[7px] flex items-center justify-center disabled:opacity-20 transition-opacity"
          style={{ background: 'var(--surface2)', color: 'var(--text3)' }}>▲</button>
        <button onClick={onMoveDown} disabled={!canMoveDown}
          className="w-5 h-[14px] rounded text-[7px] flex items-center justify-center disabled:opacity-20 transition-opacity"
          style={{ background: 'var(--surface2)', color: 'var(--text3)' }}>▼</button>
      </div>

      {/* Type */}
      <select value={step.type}
        onChange={e => onUpdate({ ...step, type: e.target.value, zone: STEP_META[e.target.value]?.defaultZone || 'Z2' })}
        className="text-xs font-bold outline-none rounded-lg px-2 py-1.5 flex-shrink-0"
        style={{ background: m.color + '22', color: m.color, border: `1px solid ${m.color}55`, colorScheme: 'dark' }}>
        {STEP_TYPES.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
      </select>

      {/* Duration */}
      <input type="number" value={step.dur} min={1} max={9999}
        onChange={e => onUpdate({ ...step, dur: parseInt(e.target.value) || 1 })}
        className="w-14 px-2 py-1.5 rounded-lg text-xs text-white outline-none font-mono text-center flex-shrink-0"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
      <select value={step.durUnit} onChange={e => onUpdate({ ...step, durUnit: e.target.value })}
        className="text-xs outline-none rounded-lg px-1.5 py-1.5 flex-shrink-0"
        style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)', colorScheme: 'dark' }}>
        {units.map(u => <option key={u} value={u}>{u}</option>)}
      </select>

      {/* Zone buttons */}
      <div className="flex gap-0.5 flex-shrink-0">
        {ZONES.map(z => (
          <button key={z} onClick={() => onUpdate({ ...step, zone: step.zone === z ? null : z })}
            className="w-8 h-7 rounded-lg text-[10px] font-bold transition-all"
            style={{
              background: step.zone === z ? (ZONE_COLORS[z] || '#fff') + '33' : 'var(--surface2)',
              color:      step.zone === z ? (ZONE_COLORS[z] || '#fff') : 'var(--text3)',
              border:     `1px solid ${step.zone === z ? (ZONE_COLORS[z] || '#fff') + '66' : 'var(--border)'}`,
            }}>
            {z}
          </button>
        ))}
      </div>

      {/* Notes / allure cible */}
      <input value={step.notes} onChange={e => onUpdate({ ...step, notes: e.target.value })}
        placeholder="Note, allure, puissance… (ex: 4:30/km, 280W)"
        className="flex-1 min-w-[120px] px-2 py-1.5 rounded-lg text-xs text-white outline-none"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />

      {/* Delete */}
      <button onClick={onRemove}
        className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-xs"
        style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}>✕</button>
    </div>
  )
}

// ─── Repeat block ─────────────────────────────────────────────────────────────
function RepeatBlock({ block, onUpdate, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown, sport }) {
  function updateSub(idx, step) {
    const steps = [...block.steps]; steps[idx] = step
    onUpdate({ ...block, steps })
  }
  function removeSub(idx) { onUpdate({ ...block, steps: block.steps.filter((_, i) => i !== idx) }) }
  function moveSub(idx, dir) {
    const steps = [...block.steps]
    const [item] = steps.splice(idx, 1)
    steps.splice(idx + dir, 0, item)
    onUpdate({ ...block, steps })
  }
  function addSub(type) { onUpdate({ ...block, steps: [...block.steps, newStep(type)] }) }

  return (
    <div className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: 'var(--surface)', border: `2px solid ${COACH_COLOR}55` }}>

      {/* Block header */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button onClick={onMoveUp} disabled={!canMoveUp}
            className="w-5 h-[14px] rounded text-[7px] flex items-center justify-center disabled:opacity-20"
            style={{ background: 'var(--surface2)', color: 'var(--text3)' }}>▲</button>
          <button onClick={onMoveDown} disabled={!canMoveDown}
            className="w-5 h-[14px] rounded text-[7px] flex items-center justify-center disabled:opacity-20"
            style={{ background: 'var(--surface2)', color: 'var(--text3)' }}>▼</button>
        </div>
        <span className="text-lg flex-shrink-0">🔁</span>
        <span className="text-xs font-bold flex-shrink-0" style={{ color: COACH_COLOR }}>Répéter</span>
        <input type="number" value={block.count} min={2} max={50}
          onChange={e => onUpdate({ ...block, count: parseInt(e.target.value) || 2 })}
          className="w-16 px-2 py-1.5 rounded-lg text-sm font-bold text-center outline-none flex-shrink-0"
          style={{ background: 'var(--surface2)', border: `1px solid ${COACH_COLOR}66`, color: COACH_COLOR }} />
        <span className="text-xs font-bold flex-shrink-0" style={{ color: COACH_COLOR }}>fois</span>
        <input value={block.label} onChange={e => onUpdate({ ...block, label: e.target.value })}
          placeholder="Nom du bloc (optionnel)"
          className="flex-1 min-w-[120px] px-2 py-1.5 rounded-lg text-xs text-white outline-none"
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
        <button onClick={onRemove}
          className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-xs"
          style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}>✕</button>
      </div>

      {/* Sub-steps */}
      <div className="flex flex-col gap-1.5 pl-4 border-l-2" style={{ borderColor: COACH_COLOR + '55' }}>
        {block.steps.map((step, idx) => (
          <StepRow key={step.id} step={step} sport={sport}
            canMoveUp={idx > 0} canMoveDown={idx < block.steps.length - 1}
            onMoveUp={() => moveSub(idx, -1)} onMoveDown={() => moveSub(idx, 1)}
            onUpdate={s => updateSub(idx, s)} onRemove={() => removeSub(idx)} />
        ))}
      </div>

      {/* Add sub-step */}
      <div className="flex gap-1.5 pl-4 flex-wrap">
        {STEP_TYPES.map(t => (
          <button key={t.id} onClick={() => addSub(t.id)}
            className="px-2 py-1 rounded-lg text-[10px] font-medium transition-all"
            style={{ background: t.color + '18', color: t.color, border: `1px solid ${t.color}44` }}>
            + {t.emoji} {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function WorkoutBuilder({ value = [], onChange, sport = 'run' }) {
  function update(idx, item) { const n = [...value]; n[idx] = item; onChange(n) }
  function remove(idx) { onChange(value.filter((_, i) => i !== idx)) }
  function move(idx, dir) {
    const n = [...value]; const [item] = n.splice(idx, 1); n.splice(idx + dir, 0, item); onChange(n)
  }

  const totalMin = stepsToMinutes(value)
  const totalTSS = stepsToTSS(value)

  return (
    <div className="flex flex-col gap-2">
      {/* Stats */}
      {value.length > 0 && (
        <div className="flex gap-4 text-xs px-1" style={{ color: 'var(--text3)' }}>
          <span>⏱ <span className="text-white font-mono">{totalMin} min</span> calculé</span>
          <span>TSS estimé : <span className="font-mono" style={{ color: COACH_COLOR }}>{totalTSS}</span></span>
        </div>
      )}

      {/* Steps list */}
      {value.map((item, idx) =>
        item.type === 'repeat' ? (
          <RepeatBlock key={item.id} block={item} sport={sport}
            canMoveUp={idx > 0} canMoveDown={idx < value.length - 1}
            onMoveUp={() => move(idx, -1)} onMoveDown={() => move(idx, 1)}
            onUpdate={b => update(idx, b)} onRemove={() => remove(idx)} />
        ) : (
          <StepRow key={item.id} step={item} sport={sport}
            canMoveUp={idx > 0} canMoveDown={idx < value.length - 1}
            onMoveUp={() => move(idx, -1)} onMoveDown={() => move(idx, 1)}
            onUpdate={s => update(idx, s)} onRemove={() => remove(idx)} />
        )
      )}

      {/* Add buttons */}
      <div className="flex gap-1.5 flex-wrap pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <span className="text-[10px] self-center pr-1 flex-shrink-0" style={{ color: 'var(--text3)' }}>+ Étape :</span>
        {STEP_TYPES.map(t => (
          <button key={t.id} onClick={() => onChange([...value, newStep(t.id)])}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: t.color + '18', color: t.color, border: `1px solid ${t.color}44` }}>
            {t.emoji} {t.label}
          </button>
        ))}
        <button onClick={() => onChange([...value, newRepeat()])}
          className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={{ background: COACH_COLOR + '22', color: COACH_COLOR, border: `1px solid ${COACH_COLOR}55` }}>
          🔁 Bloc répété
        </button>
      </div>
    </div>
  )
}
