import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useClub } from '../context/ClubContext'
import { ZONES, estimateTss, clubError, memberName } from '../lib/clubData'
import { saveWorkouts, updateWorkout, targetKind } from '../lib/workoutData'
import { toLocalDateStr, parseDate, addDays } from '../lib/dateUtils'
import { defaultBlocks, cleanBlocks } from '../lib/blocks'
import { SPORT_META, SESSION_PRESETS } from '../lib/planHelpers'
import { Modal, Field, Icon, sportColor } from './ui'
import { BlocksEditor } from './Blocks'

const TARGETS = [['club', 'Tout le club', 'users'], ['group', 'Un groupe', 'shield'], ['athlete', 'Un athlète', 'target']]

// Crée / modifie une séance « à faire » (date sans heure, sans réservation).
// - workout  : séance à modifier
// - template : séance à dupliquer (préremplie, semaine suivante)
// - preset   : { date, athleteId, groupId } pour préremplir la cible / le jour
// - athletes : athlètes actifs du club (fetchClubAthletes) pour la cible « un athlète »
export default function WorkoutModal({ workout, template, preset = {}, athletes = [], lockCoach = false, onClose, onSaved }) {
  const { coach } = useAuth()
  const { club, groups, staff, isAdmin } = useClub()
  const editing = !!workout
  const src = workout || template

  const initialDate = workout ? workout.date
    : template ? toLocalDateStr(addDays(parseDate(template.date), 7))
      : preset.date || toLocalDateStr(new Date())
  const initialTarget = src ? targetKind(src) : preset.athleteId ? 'athlete' : preset.groupId ? 'group' : 'club'

  const [target, setTarget] = useState(initialTarget)
  const [groupId, setGroupId] = useState(src?.group_id || preset.groupId || '')
  const [athleteId, setAthleteId] = useState(src?.athlete_id || preset.athleteId || '')
  const [date, setDate] = useState(initialDate)
  const [repeat, setRepeat] = useState(1)
  const [sport, setSport] = useState(src?.sport || 'run')
  const [title, setTitle] = useState(src?.title || '')
  const [duration, setDuration] = useState(src?.duration_min || 45)
  const [zone, setZone] = useState(src?.zone || 'Z2')
  const [blocks, setBlocks] = useState(src?.blocks?.length ? src.blocks : [])
  const [description, setDescription] = useState(src?.description || '')
  const [coachId, setCoachId] = useState(editing ? (workout.coach_id || coach?.id) : lockCoach ? coach?.id : (template?.coach_id || coach?.id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const canPickCoach = isAdmin && !lockCoach && staff.length > 1
  const presets = SESSION_PRESETS[sport] || []

  // Athlètes regroupés par groupe dans la liste déroulante.
  const byGroup = groups.map(g => [g, athletes.filter(a => a.group_id === g.id)]).filter(([, l]) => l.length)
  const noGroup = athletes.filter(a => !a.group_id || !groups.some(g => g.id === a.group_id))

  function applyPreset(p) {
    setTitle(p.label)
    setDuration(p.duration)
    if (p.zone) setZone(p.zone)
  }

  async function submit() {
    setError(null)
    if (!date) { setError('Choisis une date.'); return }
    if (target === 'group' && !groupId) { setError('Choisis le groupe concerné.'); return }
    if (target === 'athlete' && !athleteId) { setError("Choisis l'athlète concerné."); return }
    const dur = parseInt(duration) || 45
    const row = {
      club_id: club.id,
      coach_id: coachId || coach.id,
      group_id: target === 'group' ? groupId : null,
      athlete_id: target === 'athlete' ? athleteId : null,
      sport,
      title: title.trim() || SPORT_META[sport]?.label || 'Séance',
      duration_min: dur,
      zone: sport === 'strength' ? null : zone,
      tss: estimateTss(dur, sport === 'strength' ? 'Z2' : zone),
      blocks: cleanBlocks(blocks),
      description: description.trim() || null,
    }
    setSaving(true)
    let res
    if (editing) {
      res = await updateWorkout(workout.id, { ...row, date })
    } else {
      const first = parseDate(date)
      const rows = Array.from({ length: parseInt(repeat) || 1 }, (_, w) => ({ ...row, date: toLocalDateStr(addDays(first, w * 7)) }))
      res = await saveWorkouts(rows)
    }
    setSaving(false)
    if (res.error) { setError(clubError(res.error)); return }
    onSaved?.()
  }

  const n = parseInt(repeat) || 1
  return (
    <Modal eyebrow={editing ? 'Modifier' : template ? 'Dupliquer' : 'Nouvelle séance à faire'} title={editing ? (workout.title || 'Séance à faire') : 'Prescrire une séance'} onClose={onClose} width={640}
      footer={<>
        {error && <p className="text-sm mr-auto" style={{ color: 'var(--bad)' }}>{error}</p>}
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : n > 1 ? `Publier ${n} séances` : 'Publier la séance'}
          <Icon name="arrow" size={16} />
        </button>
      </>}>

      <p className="text-[13px] muted">
        Une séance à faire n'a pas d'horaire ni de réservation : chaque athlète la réalise quand il veut dans la journée, puis indique dans l'app s'il l'a faite, son ressenti (RPE) et un commentaire.
      </p>

      {/* Cible */}
      <Field label="Pour qui ?">
        <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl" style={{ background: 'var(--surface3)' }}>
          {TARGETS.map(([k, l, ic]) => (
            <button key={k} onClick={() => setTarget(k)}
              className="h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all"
              style={target === k ? { background: 'var(--surface)', color: 'var(--red)', boxShadow: 'var(--shadow)' } : { color: 'var(--text2)' }}>
              <Icon name={ic} size={16} /> {l}
            </button>
          ))}
        </div>
      </Field>
      {target === 'group' && (
        <Field label="Groupe">
          {groups.length === 0
            ? <p className="text-sm muted">Aucun groupe : crée-en dans Réglages du club.</p>
            : (
              <div className="flex gap-2 flex-wrap">
                {groups.map(g => (
                  <button key={g.id} onClick={() => setGroupId(g.id)} className="chip"
                    style={groupId === g.id ? { background: g.color || 'var(--red)', borderColor: g.color || 'var(--red)', color: '#fff' } : undefined}>
                    {g.name}
                  </button>
                ))}
              </div>
            )}
        </Field>
      )}
      {target === 'athlete' && (
        <Field label="Athlète" hint={athletes.length ? null : "Aucun athlète actif dans le club pour l'instant."}>
          <select className="input" value={athleteId} onChange={e => setAthleteId(e.target.value)}>
            <option value="">Choisir un athlète…</option>
            {byGroup.map(([g, list]) => (
              <optgroup key={g.id} label={`Groupe ${g.name}`}>
                {list.map(a => <option key={a.user_id} value={a.user_id}>{memberName(a)}</option>)}
              </optgroup>
            ))}
            {noGroup.length > 0 && (
              <optgroup label="Sans groupe">
                {noGroup.map(a => <option key={a.user_id} value={a.user_id}>{memberName(a)}</option>)}
              </optgroup>
            )}
            {/* Athlète ciblé qui n'est plus dans la liste (parti du club) */}
            {athleteId && !athletes.some(a => a.user_id === athleteId) && <option value={athleteId}>{src?.athlete?.full_name || 'Athlète'}</option>}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></Field>
        {!editing ? (
          <Field label="Répéter">
            <select className="input" value={repeat} onChange={e => setRepeat(parseInt(e.target.value))}>
              <option value={1}>Une seule fois</option>
              {[2, 3, 4, 6, 8, 10, 12].map(k => <option key={k} value={k}>Chaque semaine pendant {k} semaines</option>)}
            </select>
          </Field>
        ) : <div />}
      </div>

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

      <Field label="Titre">
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex : Footing + 6 lignes droites" />
        {presets.length > 0 && !editing && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            {presets.slice(0, 6).map(p => (
              <button key={p.label} onClick={() => applyPreset(p)} className="pill pill-neutral hover:opacity-80">{p.label}</button>
            ))}
          </div>
        )}
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Durée (min)">
          <input type="number" className="input" value={duration} min={5} step={5} onChange={e => setDuration(e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="Intensité dominante">
            <div className="flex gap-1">
              {ZONES.map(z => (
                <button key={z} onClick={() => setZone(z)} disabled={sport === 'strength'} className="flex-1 h-11 rounded-xl text-[13px] font-extrabold disabled:opacity-40"
                  style={zone === z && sport !== 'strength' ? { background: 'var(--red)', color: '#fff' } : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                  {z}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      <Field label="Contenu" hint="Étapes numérotées. L'app calcule les allures / watts de chaque athlète selon ses zones.">
        {blocks.length ? <BlocksEditor blocks={blocks} onChange={setBlocks} /> : (
          <button className="btn btn-soft btn-sm" onClick={() => setBlocks(defaultBlocks(zone))}>
            <Icon name="plus" size={14} /> Détailler (échauffement, corps de séance, retour au calme)
          </button>
        )}
      </Field>

      <Field label="Description">
        <textarea className="input" rows={3} value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Objectif de la séance, terrain conseillé, alternatives si fatigue…" />
      </Field>

      {canPickCoach && (
        <Field label="Coach">
          <select className="input" value={coachId || ''} onChange={e => setCoachId(e.target.value)}>
            {staff.map(s => <option key={s.user_id} value={s.user_id}>{s.profile?.full_name || 'Coach'}</option>)}
          </select>
        </Field>
      )}
    </Modal>
  )
}
