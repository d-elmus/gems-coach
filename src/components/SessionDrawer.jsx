import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Icon, sportLabel, Meter } from './ui'
import { BlocksList } from './Blocks'
import { fmtTime, fmtDay, setAttendance, deleteSession, clubError } from '../lib/clubData'

// Panneau latéral d'une séance : infos, contenu, inscrits + pointage de présence.
// `onDuplicate` (facultatif) ouvre la création préremplie avec cette séance.
export default function SessionDrawer({ session: s, onClose, onEdit, onDuplicate, onChanged }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const past = s.start < new Date()

  async function mark(b, value) {
    setBusy(b.id); setError(null)
    const { error: err } = await setAttendance(b.id, b.attended === value ? null : value)
    setBusy(null)
    if (err) setError(clubError(err))
    onChanged?.()
  }

  async function remove() {
    const n = s.booked.length
    if (!window.confirm(`Supprimer « ${s.title} » ?${n ? `\n${n} inscrit${n > 1 ? 's' : ''} ser${n > 1 ? 'ont' : 'a'} désinscrit${n > 1 ? 's' : ''}.` : ''}`)) return
    const { error: err } = await deleteSession(s.id)
    if (err) { setError(clubError(err)); return }
    onChanged?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40" onClick={onClose} style={{ background: 'rgba(26,20,16,0.25)' }}>
      <aside onClick={e => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-[420px] max-w-full flex flex-col fade-up"
        style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-lg)' }}>
        <div className="hero-bg text-white px-6 pt-5 pb-6">
          <div className="flex justify-between items-center mb-5">
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }} aria-label="Fermer">
              <Icon name="x" size={16} />
            </button>
            <div className="flex gap-2">
              {onDuplicate && <button onClick={() => onDuplicate(s)} title="Dupliquer" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }} aria-label="Dupliquer"><Icon name="copy" size={15} /></button>}
              <button onClick={() => onEdit(s)} title="Modifier" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }} aria-label="Modifier"><Icon name="edit" size={15} /></button>
              <button onClick={remove} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }} title="Supprimer" aria-label="Supprimer"><Icon name="trash" size={15} /></button>
            </div>
          </div>
          <p className="text-[11px] font-extrabold tracking-[0.14em] opacity-80 mb-1.5">
            {sportLabel(s.kind === 'one_on_one' ? 'coaching' : s.sport).toUpperCase()} · {s.kind === 'one_on_one' ? '1:1' : 'COLLECTIF'}
          </p>
          <h2 className="display text-[26px] leading-tight">{s.title}</h2>
          <div className="grid grid-cols-3 gap-2 mt-5">
            {[['Durée', `${s.duration_min} min`], ['TSS', s.tss ?? '—'], ['Zone', s.zone || '—']].map(([k, v], i) => (
              <div key={k} className="rounded-xl px-3 py-2" style={i === 2 ? { background: '#fff', color: 'var(--red)' } : { background: 'rgba(255,255,255,0.14)' }}>
                <p className="text-[10px] font-extrabold tracking-wider opacity-80">{k.toUpperCase()}</p>
                <p className="text-lg font-extrabold">{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar name={s.coach?.full_name} url={s.coach?.photo_url} id={s.coach?.id} size={42} />
            <div className="min-w-0">
              <p className="font-extrabold">{s.coach?.full_name || 'Coach'}</p>
              <p className="text-[13px] muted">{fmtDay(s.start, { weekday: 'long', day: 'numeric', month: 'short' })} · {fmtTime(s.start)}{s.location ? ` · ${s.location}` : ''}</p>
              {s.kind === 'collective' && <p className="text-[12px] font-semibold mt-0.5" style={{ color: s.group?.color || 'var(--text2)' }}>{s.group ? `Groupe ${s.group.name}` : 'Ouvert à tout le club'}</p>}
            </div>
          </div>

          {error && <p className="text-[13px] rounded-xl px-3 py-2" style={{ background: 'var(--bad-soft)', color: 'var(--bad)' }}>{error}</p>}

          {s.description && <p className="text-[13px] leading-relaxed ink2 whitespace-pre-line">{s.description}</p>}

          {Array.isArray(s.blocks) && s.blocks.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Contenu de la séance</p>
              <BlocksList blocks={s.blocks} />
            </div>
          )}

          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-extrabold">Participants <span style={{ color: 'var(--red)' }}>{s.booked.length}{s.capacity ? `/${s.capacity}` : ''}</span></p>
              {past && s.booked.length > 0 && <p className="text-xs muted">Pointe la présence</p>}
            </div>
            {s.capacity ? <Meter value={s.booked.length} max={s.capacity} tone={s.full ? 'red' : 'good'} /> : null}
            <div className="flex flex-col mt-3">
              {s.booked.length === 0 && <p className="text-sm muted py-2">Personne n'a encore réservé.</p>}
              {s.booked.map(b => (
                <div key={b.id} className="flex items-center gap-3 py-2">
                  <Avatar name={b.profile?.full_name} url={b.profile?.photo_url} id={b.user_id} size={32} />
                  <button onClick={() => navigate(`/athletes/${b.user_id}`)} className="flex-1 text-left text-sm font-semibold truncate hover:underline">
                    {b.profile?.full_name || 'Athlète'}
                  </button>
                  <div className="flex gap-1">
                    {[[true, 'check', 'Présent', 'var(--good)', 'var(--good-soft)'], [false, 'x', 'Absent', 'var(--bad)', 'var(--bad-soft)']].map(([v, ic, l, fg, bg]) => (
                      <button key={l} title={l} disabled={busy === b.id} onClick={() => mark(b, v)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                        style={b.attended === v ? { background: bg, color: fg } : { background: 'var(--surface2)', color: 'var(--text3)' }}>
                        <Icon name={ic} size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {s.waitlist.length > 0 && (
              <p className="text-xs muted mt-2">{s.waitlist.length} en liste d'attente</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
