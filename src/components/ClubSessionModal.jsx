import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useClub } from '../context/ClubContext'
import { saveSessions, updateSession, addDays } from '../lib/clubData'
import { Modal, Field, Icon, sportColor } from './ui'
import { SPORT_META } from '../lib/planHelpers'

const ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']
const ZONE_FACTOR = { Z1: 0.5, Z2: 0.8, Z3: 1.1, Z4: 1.4, Z5: 1.6 }

function toDateInput(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function toTimeInput(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Crée / modifie une séance du club : cours collectif ou créneaux 1:1.
export default function ClubSessionModal({ initialDate, session, onClose, onSaved, lockCoach = false }) {
  const { coach } = useAuth()
  const { club, groups, staff, isAdmin } = useClub()
  const editing = !!session
  const base = session ? new Date(session.starts_at) : (initialDate || (() => { const d = new Date(); d.setHours(18, 0, 0, 0); return d })())

  const [kind, setKind] = useState(session?.kind || 'collective')
  const [sport, setSport] = useState(session?.sport || 'run')
  const [title, setTitle] = useState(session?.title || '')
  const [date, setDate] = useState(toDateInput(base))
  const [time, setTime] = useState(toTimeInput(base))
  const [duration, setDuration] = useState(session?.duration_min || 60)
  const [location, setLocation] = useState(session?.location || '')
  const [capacity, setCapacity] = useState(session?.capacity ?? 20)
  const [groupId, setGroupId] = useState(session?.group_id || '')
  const [coachId, setCoachId] = useState(session?.coach_id || coach?.id)
  const [zone, setZone] = useState(session?.zone || 'Z2')
  const [blocks, setBlocks] = useState(Array.isArray(session?.blocks) ? session.blocks : [])
  const [showContent, setShowContent] = useState(!!session?.blocks?.length)
  const [repeat, setRepeat] = useState(1)
  const [slots, setSlots] = useState(4)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const oneOnOne = kind === 'one_on_one'
  const canPickCoach = isAdmin && !lockCoach && staff.length > 1

  function updateBlock(i, patch) { setBlocks(b => b.map((x, j) => j === i ? { ...x, ...patch } : x)) }

  async function submit() {
    setError(null)
    const start = new Date(`${date}T${time}:00`)
    if (isNaN(start)) { setError('Date ou heure invalide.'); return }
    const dur = parseInt(duration) || 60
    const cleanBlocks = blocks
      .filter(b => b.label?.trim() || b.duration)
      .map(b => ({ type: b.type || 'work', label: b.label?.trim() || undefined, instructions: b.instructions?.trim() || undefined, zone: b.zone || undefined, duration: parseInt(b.duration) || undefined }))
    const common = {
      club_id: club.id,
      coach_id: coachId,
      kind,
      sport: oneOnOne ? 'coaching' : sport,
      title: title.trim() || (oneOnOne ? 'Créneau 1:1' : SPORT_META[sport]?.label || 'Séance'),
      duration_min: dur,
      location: location.trim() || null,
      group_id: oneOnOne ? null : (groupId || null),
      zone: oneOnOne ? null : zone,
      tss: oneOnOne ? null : Math.round(dur * (ZONE_FACTOR[zone] ?? 0.8)),
      blocks: oneOnOne ? [] : cleanBlocks,
    }

    setSaving(true)
    let res
    if (editing) {
      res = await updateSession(session.id, { ...common, starts_at: start.toISOString(), capacity: oneOnOne ? 1 : (parseInt(capacity) || null) })
    } else {
      const rows = []
      for (let w = 0; w < (parseInt(repeat) || 1); w++) {
        const day = addDays(start, w * 7)
        if (oneOnOne) {
          for (let k = 0; k < (parseInt(slots) || 1); k++) {
            rows.push({ ...common, capacity: 1, starts_at: new Date(day.getTime() + k * dur * 60000).toISOString() })
          }
        } else {
          rows.push({ ...common, capacity: parseInt(capacity) || null, starts_at: day.toISOString() })
        }
      }
      res = await saveSessions(rows)
    }
    setSaving(false)
    if (res.error) { setError(res.error.message); return }
    onSaved?.()
  }

  return (
    <Modal eyebrow={editing ? 'Modifier' : 'Nouvelle séance'} title={oneOnOne ? 'Créneaux 1:1' : 'Cours collectif'} onClose={onClose} width={620}
      footer={<>
        {error && <p className="text-sm mr-auto" style={{ color: 'var(--bad)' }}>{error}</p>}
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : oneOnOne ? `Ouvrir ${slots * repeat} créneau${slots * repeat > 1 ? 'x' : ''}` : repeat > 1 ? `Publier ${repeat} séances` : 'Publier la séance'}
          <Icon name="arrow" size={16} />
        </button>
      </>}>

      {/* Type */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl" style={{ background: 'var(--surface3)' }}>
        {[['collective', 'Cours collectif', 'users'], ['one_on_one', 'Créneaux 1:1', 'whistle']].map(([k, l, ic]) => (
          <button key={k} onClick={() => setKind(k)} disabled={editing}
            className="h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all"
            style={kind === k ? { background: 'var(--surface)', color: 'var(--red)', boxShadow: 'var(--shadow)' } : { color: 'var(--text2)' }}>
            <Icon name={ic} size={16} /> {l}
          </button>
        ))}
      </div>

      {!oneOnOne && (
        <Field label="Sport">
          <div className="flex gap-2 flex-wrap">
            {Object.entries(SPORT_META).map(([k, m]) => (
              <button key={k} onClick={() => setSport(k)} className="chip"
                style={sport === k ? { background: sportColor(k), borderColor: sportColor(k), color: '#fff' } : undefined}>
                {m.label}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Titre">
        <input className="input" value={title} onChange={e => setTitle(e.target.value)}
          placeholder={oneOnOne ? 'Ex : Analyse FTP, plan de course…' : 'Ex : Fractionné piste 5×1000m'} />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Date"><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Heure"><input type="time" className="input" value={time} onChange={e => setTime(e.target.value)} step={900} /></Field>
        <Field label={oneOnOne ? 'Durée d\'un créneau' : 'Durée (min)'}>
          <input type="number" className="input" value={duration} min={15} step={5} onChange={e => setDuration(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label="Lieu"><input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Stade, piscine, visio…" /></Field>
        </div>
        {oneOnOne
          ? <Field label="Nb de créneaux"><input type="number" className="input" min={1} max={12} value={slots} onChange={e => setSlots(e.target.value)} /></Field>
          : <Field label="Places"><input type="number" className="input" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} /></Field>}
      </div>

      {!oneOnOne && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ouvert à">
            <select className="input" value={groupId} onChange={e => setGroupId(e.target.value)}>
              <option value="">Tout le club</option>
              {groups.map(g => <option key={g.id} value={g.id}>Groupe {g.name}</option>)}
            </select>
          </Field>
          <Field label="Intensité dominante">
            <div className="flex gap-1">
              {ZONES.map(z => (
                <button key={z} onClick={() => setZone(z)} className="flex-1 h-11 rounded-xl text-[13px] font-extrabold"
                  style={zone === z ? { background: 'var(--red)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                  {z}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}

      {canPickCoach && (
        <Field label="Coach">
          <select className="input" value={coachId || ''} onChange={e => setCoachId(e.target.value)}>
            {staff.map(s => <option key={s.user_id} value={s.user_id}>{s.profile?.full_name || 'Coach'}</option>)}
          </select>
        </Field>
      )}

      {!oneOnOne && (
        showContent ? (
          <Field label="Contenu de la séance" hint="Chaque athlète verra ses allures / watts calculés sur ses propres zones.">
            <div className="flex flex-col gap-2">
              {blocks.map((b, i) => (
                <div key={i} className="card-soft p-3 flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    <span className="text-lg font-extrabold italic w-7" style={{ color: 'var(--red)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <input className="input flex-1" style={{ height: 38 }} value={b.label || ''} onChange={e => updateBlock(i, { label: e.target.value })} placeholder="Ex : 5×1000m @Z4" />
                    <input className="input" style={{ height: 38, width: 80 }} type="number" value={b.duration || ''} onChange={e => updateBlock(i, { duration: e.target.value })} placeholder="min" />
                    <select className="input" style={{ height: 38, width: 84 }} value={b.zone || ''} onChange={e => updateBlock(i, { zone: e.target.value })}>
                      <option value="">—</option>
                      {ZONES.map(z => <option key={z}>{z}</option>)}
                    </select>
                    <button className="muted hover:opacity-70 px-1" onClick={() => setBlocks(bl => bl.filter((_, j) => j !== i))} aria-label="Supprimer"><Icon name="x" size={16} /></button>
                  </div>
                  <input className="input" style={{ height: 36, fontSize: 13 }} value={b.instructions || ''} onChange={e => updateBlock(i, { instructions: e.target.value })} placeholder="Consigne (récup, allure, technique…)" />
                </div>
              ))}
              <button className="btn btn-ghost btn-sm self-start" onClick={() => setBlocks(b => [...b, { type: 'work', label: '', duration: '', zone: '' }])}>
                <Icon name="plus" size={14} /> Ajouter une étape
              </button>
            </div>
          </Field>
        ) : (
          <button className="btn btn-soft btn-sm self-start" onClick={() => { setShowContent(true); if (!blocks.length) setBlocks([{ type: 'warmup', label: 'Échauffement', duration: 15, zone: 'Z1' }, { type: 'work', label: '', duration: '', zone }, { type: 'cooldown', label: 'Retour au calme', duration: 10, zone: 'Z1' }]) }}>
            <Icon name="plus" size={14} /> Détailler le contenu (échauffement, corps, retour au calme)
          </button>
        )
      )}

      {!editing && (
        <Field label="Répéter">
          <select className="input" value={repeat} onChange={e => setRepeat(parseInt(e.target.value))}>
            <option value={1}>Une seule fois</option>
            {[2, 4, 6, 8, 10, 12, 16].map(n => <option key={n} value={n}>Chaque semaine pendant {n} semaines</option>)}
          </select>
        </Field>
      )}
    </Modal>
  )
}
