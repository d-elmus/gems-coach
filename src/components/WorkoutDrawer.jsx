import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Icon, Meter, sportLabel } from './ui'
import { BlocksList } from './Blocks'
import { fmtDay, relTime, memberName, clubError } from '../lib/clubData'
import { workoutProgress, targetLabel, deleteWorkout, rpeTone } from '../lib/workoutData'
import { toLocalDateStr } from '../lib/dateUtils'

const HB = { background: 'rgba(255,255,255,0.15)' }

// Panneau latéral d'une séance à faire : contenu + suivi (fait / pas fait / sans retour).
export default function WorkoutDrawer({ workout: w, athletes, canEdit, onClose, onEdit, onDuplicate, onChanged }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('done')
  const [error, setError] = useState(null)
  const p = workoutProgress(w, athletes)
  const todayStr = toLocalDateStr(new Date())
  const future = w.date > todayStr

  async function remove() {
    const logs = p.done.length + p.skipped.length
    if (!window.confirm(`Supprimer « ${w.title} » du ${fmtDay(w.day, { weekday: 'long', day: 'numeric', month: 'long' })} ?${logs ? `\n${logs} retour${logs > 1 ? 's' : ''} d'athlète${logs > 1 ? 's' : ''} ser${logs > 1 ? 'ont' : 'a'} perdu${logs > 1 ? 's' : ''}.` : ''}`)) return
    const { error: err } = await deleteWorkout(w.id)
    if (err) { setError(clubError(err)); return }
    onChanged?.()
    onClose()
  }

  const lists = { done: p.done, skipped: p.skipped, pending: p.pending }
  const tabs = [['done', 'Fait', p.done.length], ['skipped', 'Pas fait', p.skipped.length], ['pending', future ? 'À venir' : w.date === todayStr ? 'Pas encore' : 'Sans retour', p.pending.length]]

  return (
    <div className="fixed inset-0 z-40" onClick={onClose} style={{ background: 'rgba(26,20,16,0.25)' }}>
      <aside onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-[440px] max-w-full flex flex-col fade-up"
        style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-lg)' }}>
        <div className="hero-bg text-white px-6 pt-5 pb-6">
          <div className="flex justify-between items-center mb-5">
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={HB} aria-label="Fermer"><Icon name="x" size={16} /></button>
            {canEdit && (
              <div className="flex gap-2">
                <button onClick={() => onDuplicate(w)} title="Dupliquer" className="w-9 h-9 rounded-full flex items-center justify-center" style={HB} aria-label="Dupliquer"><Icon name="copy" size={15} /></button>
                <button onClick={() => onEdit(w)} title="Modifier" className="w-9 h-9 rounded-full flex items-center justify-center" style={HB} aria-label="Modifier"><Icon name="edit" size={15} /></button>
                <button onClick={remove} title="Supprimer" className="w-9 h-9 rounded-full flex items-center justify-center" style={HB} aria-label="Supprimer"><Icon name="trash" size={15} /></button>
              </div>
            )}
          </div>
          <p className="text-[11px] font-extrabold tracking-[0.14em] opacity-80 mb-1.5">
            {sportLabel(w.sport).toUpperCase()} · À FAIRE · {targetLabel(w).toUpperCase()}
          </p>
          <h2 className="display text-[26px] leading-tight">{w.title}</h2>
          <div className="grid grid-cols-3 gap-2 mt-5">
            {[['Durée', `${w.duration_min} min`], ['TSS', w.tss ?? '—'], ['Zone', w.zone || '—']].map(([k, v], i) => (
              <div key={k} className="rounded-xl px-3 py-2" style={i === 2 ? { background: '#fff', color: 'var(--red)' } : { background: 'rgba(255,255,255,0.14)' }}>
                <p className="text-[10px] font-extrabold tracking-wider opacity-80">{k.toUpperCase()}</p>
                <p className="text-lg font-extrabold">{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar name={w.coach?.full_name} url={w.coach?.photo_url} id={w.coach?.id} size={42} />
            <div className="min-w-0">
              <p className="font-extrabold">{w.coach?.full_name || 'Coach'}</p>
              <p className="text-[13px] muted">{fmtDay(w.day, { weekday: 'long', day: 'numeric', month: 'long' })} · dans la journée</p>
            </div>
          </div>

          {error && <p className="text-[13px] rounded-xl px-3 py-2" style={{ background: 'var(--bad-soft)', color: 'var(--bad)' }}>{error}</p>}

          {w.description && <p className="text-[13px] leading-relaxed ink2 whitespace-pre-line">{w.description}</p>}

          {w.blocks.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Contenu de la séance</p>
              <BlocksList blocks={w.blocks} />
            </div>
          )}

          {/* Suivi */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-extrabold">Suivi <span style={{ color: 'var(--red)' }}>{p.done.length}/{p.total}</span></p>
              {p.avgRpe != null && <span className={`pill pill-${rpeTone(p.avgRpe)}`}>RPE moyen {String(p.avgRpe).replace('.', ',')}</span>}
            </div>
            <Meter value={p.done.length} max={p.total || 1} tone="good" />
            {p.total === 0 ? (
              <p className="text-sm muted mt-3">Aucun athlète actif dans la cible ({targetLabel(w)}).</p>
            ) : (
              <>
                <div className="flex gap-1.5 mt-4 mb-1">
                  {tabs.map(([k, l, n]) => (
                    <button key={k} onClick={() => setTab(k)} className={`chip ${tab === k ? 'chip-on' : ''}`} style={{ height: 30, fontSize: 12, padding: '0 12px' }}>
                      {l} · {n}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col">
                  {lists[tab].length === 0 && (
                    <p className="text-sm muted py-3">
                      {tab === 'done' ? (future ? 'Séance pas encore passée.' : "Personne ne l'a encore notée comme faite.") : tab === 'skipped' ? 'Personne.' : 'Tout le monde a répondu. 👌'}
                    </p>
                  )}
                  {lists[tab].map(({ member: m, log }) => (
                    <div key={m.user_id} className="py-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-3">
                        <Avatar name={memberName(m)} url={m.profile?.photo_url} id={m.user_id} size={32} />
                        <button onClick={() => navigate(`/athletes/${m.user_id}`)} className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-semibold truncate hover:underline">{memberName(m)}</p>
                          {m.group && <p className="text-[11px] muted">{m.group.name}</p>}
                        </button>
                        {log?.rpe != null && <span className={`pill pill-${rpeTone(log.rpe)}`} title="Effort ressenti (1 = très facile, 10 = maximal)">RPE {log.rpe}</span>}
                        {log && <span className="text-[11px] muted">{relTime(log.created_at)}</span>}
                      </div>
                      {log?.comment && (
                        <p className="text-[13px] ink2 mt-2 ml-11 px-3 py-2 rounded-xl" style={{ background: 'var(--surface2)' }}>« {log.comment} »</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
