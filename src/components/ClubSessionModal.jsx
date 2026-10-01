import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useClub } from '../context/ClubContext'
import { saveSessions, updateSession, addDays, ZONES, estimateTss, clubError } from '../lib/clubData'
import { Modal, Field, Icon, sportColor } from './ui'
import { BlocksEditor } from './Blocks'
import { defaultBlocks, cleanBlocks } from '../lib/blocks'
import { SPORT_META } from '../lib/planHelpers'

function toDateInput(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function toTimeInput(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Crée / modifie une séance du club : cours collectif ou créneaux 1:1.
// `template` = séance à dupliquer : formulaire prérempli, même créneau la semaine suivante.
export default function ClubSessionModal({ initialDate, session: editSession, template, onClose, onSaved, lockCoach = false }) {
  const { coach } = useAuth()
  const { club, groups, staff, isAdmin } = useClub()
  const editing = !!editSession
  const session = editSession || template
  const base = editSession ? new Date(editSession.starts_at)
    : template ? addDays(new Date(template.starts_at), 7)
      : (initialDate || (() => { const d = new Date(); d.setHours(18, 0, 0, 0); return d })())

  const [kind, setKind] = useState(session?.kind || 'collective')
  const [sport, setSport] = useState(session?.sport || 'run')
  const [title, setTitle] = useState(session?.title || '')
  const [date, setDate] = useState(toDateInput(base))
  const [time, setTime] = useState(toTimeInput(base))
  const [duration, setDuration] = useState(session?.duration_min || 60)
  const [location, setLocation] = useState(session?.location || '')
  const [capacity, setCapacity] = useState(session?.capacity ?? 20)
  const [groupId, setGroupId] = useState(session?.group_id || '')
  const [coachId, setCoachId] = useState(editing ? (editSession.coach_id || coach?.id) : lockCoach ? coach?.id : (template?.coach_id || coach?.id))
  const [zone, setZone] = useState(session?.zone || 'Z2')
  const [blocks, setBlocks] = useState(Array.isArray(session?.blocks) ? session.blocks : [])
  const [description, setDescription] = useState(session?.description || '')
  const [showContent, setShowContent] = useState(!!session?.blocks?.length)
  const [repeat, setRepeat] = useState(1)
  const [slots, setSlots] = useState(4)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const oneOnOne = kind === 'one_on_one'
  const canPickCoach = isAdmin && !lockCoach && staff.length > 1

  async function submit() {
    setError(null)
    const start = new Date(`${date}T${time}:00`)
    if (isNaN(start)) { setError('Date ou heure invalide.'); return }
    const dur = parseInt(duration) || 60
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
      tss: oneOnOne ? null : estimateTss(dur, zone),
      blocks: oneOnOne ? [] : cleanBlocks(blocks),
      description: description.trim() || null,
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
    if (res.error) { setError(clubError(res.error)); return }
    onSaved?.()
  }

  return (
    <Modal eyebrow={editing ? 'Modifier' : template ? 'Dupliquer la séance' : 'Nouvelle séance'} title={oneOnOne ? 'Créneaux 1:1' : 'Cours collectif'} onClose={onClose} width={620}
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
            <BlocksEditor blocks={blocks} onChange={setBlocks} />
          </Field>
        ) : (
          <button className="btn btn-soft btn-sm self-start" onClick={() => { setShowContent(true); if (!blocks.length) setBlocks(defaultBlocks(zone)) }}>
            <Icon name="plus" size={14} /> Détailler le contenu (échauffement, corps, retour au calme)
          </button>
        )
      )}

      <Field label="Description" hint="Matériel, point de rendez-vous, consignes générales…">
        <textarea className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex : rendez-vous devant le gymnase, prévoir pointes et gourde." />
      </Field>

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
