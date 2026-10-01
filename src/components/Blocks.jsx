import { Icon } from './ui'
import { ZONES } from '../lib/clubData'
import { ZONE_COLORS } from '../lib/planHelpers'

// Éditeur d'étapes numérotées (zone + durée + consigne).
export function BlocksEditor({ blocks, onChange }) {
  function update(i, patch) { onChange(blocks.map((x, j) => j === i ? { ...x, ...patch } : x)) }
  function move(i, dir) {
    const j = i + dir
    if (j < 0 || j >= blocks.length) return
    const next = [...blocks]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((b, i) => (
        <div key={i} className="card-soft p-3 flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <span className="text-lg font-extrabold italic w-7" style={{ color: 'var(--red)' }}>{String(i + 1).padStart(2, '0')}</span>
            <input className="input flex-1" style={{ height: 38 }} value={b.label || ''} onChange={e => update(i, { label: e.target.value })} placeholder="Ex : 5×1000m @Z4" />
            <input className="input" style={{ height: 38, width: 80 }} type="number" min={0} value={b.duration || ''} onChange={e => update(i, { duration: e.target.value })} placeholder="min" aria-label="Durée (min)" />
            <select className="input" style={{ height: 38, width: 84 }} value={b.zone || ''} onChange={e => update(i, { zone: e.target.value })} aria-label="Zone">
              <option value="">—</option>
              {ZONES.map(z => <option key={z}>{z}</option>)}
            </select>
            <div className="flex flex-col">
              <button className="muted hover:opacity-70 disabled:opacity-25" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter"><Icon name="left" size={13} style={{ transform: 'rotate(90deg)' }} /></button>
              <button className="muted hover:opacity-70 disabled:opacity-25" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} aria-label="Descendre"><Icon name="down" size={13} /></button>
            </div>
            <button className="muted hover:opacity-70 px-1" onClick={() => onChange(blocks.filter((_, j) => j !== i))} aria-label="Supprimer l'étape"><Icon name="x" size={16} /></button>
          </div>
          <input className="input" style={{ height: 36, fontSize: 13 }} value={b.instructions || ''} onChange={e => update(i, { instructions: e.target.value })} placeholder="Consigne (récup, allure, technique…)" />
        </div>
      ))}
      <button className="btn btn-ghost btn-sm self-start" onClick={() => onChange([...blocks, { type: 'work', label: '', duration: '', zone: '' }])}>
        <Icon name="plus" size={14} /> Ajouter une étape
      </button>
    </div>
  )
}

// Affichage des étapes (panneaux latéraux, fiche athlète).
export function BlocksList({ blocks }) {
  if (!Array.isArray(blocks) || !blocks.length) return null
  return (
    <div>
      {blocks.map((b, i) => (
        <div key={i} className="flex items-center gap-4 py-3" style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
          <span className="display text-2xl w-9" style={{ color: 'var(--red)' }}>{String(i + 1).padStart(2, '0')}</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold">{b.label || 'Étape'}</p>
            <p className="text-[13px] muted">{[b.duration && `${b.duration} min`, b.instructions].filter(Boolean).join(' · ')}</p>
          </div>
          {b.zone && <span className="pill" style={{ background: (ZONE_COLORS[b.zone] || '#9A8B72') + '1A', color: ZONE_COLORS[b.zone] || 'var(--text2)' }}>{b.zone}</span>}
        </div>
      ))}
    </div>
  )
}
