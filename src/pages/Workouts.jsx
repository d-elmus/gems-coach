import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Header } from '../components/Layout'
import { Avatar, Icon, Page, Spinner, Meter, ErrorNotice, FilterSelect, sportColor, sportLabel } from '../components/ui'
import WorkoutModal from '../components/WorkoutModal'
import WorkoutDrawer from '../components/WorkoutDrawer'
import { useAuth } from '../context/AuthContext'
import { useClub } from '../context/ClubContext'
import { useLoader } from '../lib/useLoader'
import { startOfWeek, addDays, sameDay, weekLabel, fetchClubAthletes } from '../lib/clubData'
import { fetchWorkouts, workoutProgress, targetLabel } from '../lib/workoutData'
import { toLocalDateStr } from '../lib/dateUtils'
import { WeekNav } from './club/Planning'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function WorkoutCard({ w, athletes, showCoach, onClick }) {
  const p = workoutProgress(w, athletes)
  const future = w.date > toLocalDateStr(new Date())
  const color = sportColor(w.sport)
  return (
    <button onClick={onClick} className="card text-left px-3 py-2.5 flex flex-col gap-1.5 transition-shadow hover:shadow-lg min-w-0"
      style={{ borderRadius: 14, borderLeft: `4px solid ${color}` }}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-extrabold tracking-wider uppercase truncate" style={{ color }}>{sportLabel(w.sport)}</span>
        {w.zone && <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md" style={{ background: 'var(--surface3)', color: 'var(--text2)' }}>{w.zone}</span>}
      </div>
      <p className="text-[13px] font-extrabold leading-tight line-clamp-2">{w.title}</p>
      <p className="text-[11px] muted truncate">{w.duration_min} min · {targetLabel(w)}</p>
      {future ? (
        <p className="text-[11px] font-semibold ink2">{p.total} athlète{p.total > 1 ? 's' : ''}</p>
      ) : (
        <div>
          <Meter value={p.done.length} max={p.total || 1} tone="good" height={4} />
          <p className="text-[11px] font-bold mt-1" style={{ color: p.total && p.done.length === p.total ? 'var(--good)' : 'var(--text2)' }}>
            {p.done.length}/{p.total} fait{p.done.length > 1 ? 's' : ''}{p.skipped.length ? ` · ${p.skipped.length} non` : ''}
          </p>
        </div>
      )}
      {showCoach && w.coach && (
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
          <Avatar name={w.coach.full_name} url={w.coach.photo_url} id={w.coach.id} size={18} />
          <span className="text-[11px] muted truncate">{w.coach.full_name}</span>
        </div>
      )}
    </button>
  )
}

// « Séances à faire » : espace coach (/workouts) et espace club (/club/workouts).
export default function Workouts({ space = 'coach' }) {
  const { coach } = useAuth()
  const { club, groups, staff, isAdmin } = useClub()
  const [params] = useSearchParams()
  const isClub = space === 'club'
  const [weekStart, setWeekStart] = useState(startOfWeek())
  const [scope, setScope] = useState(isClub ? 'all' : 'mine') // espace coach : mes séances / tout le club
  const [coachF, setCoachF] = useState(params.get('coach') || '')
  const [targetF, setTargetF] = useState('')
  const [creating, setCreating] = useState(null) // { date } | true
  const [editing, setEditing] = useState(null)
  const [duplicating, setDuplicating] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const { data, error, loading, reload } = useLoader(async () => {
    const [workouts, athletes] = await Promise.all([
      fetchWorkouts(club.id, weekStart, addDays(weekStart, 7)),
      fetchClubAthletes(club.id),
    ])
    return { workouts, athletes }
  }, [club.id, weekStart.getTime()])

  const athletes = useMemo(() => data?.athletes || [], [data])
  const shown = useMemo(() => (data?.workouts || []).filter(w => {
    if (!isClub && scope === 'mine' && w.coach_id !== coach.id) return false
    if (isClub && coachF && w.coach_id !== coachF) return false
    if (targetF === 'club' && (w.group_id || w.athlete_id)) return false
    if (targetF === 'athlete' && !w.athlete_id) return false
    if (targetF && !['club', 'athlete'].includes(targetF) && w.group_id !== targetF) return false
    return true
  }), [data, isClub, scope, coach.id, coachF, targetF])

  // Synthèse de la semaine (séances passées ou du jour uniquement pour le taux).
  const stats = useMemo(() => {
    const today = toLocalDateStr(new Date())
    let expected = 0, done = 0, comments = 0
    const rpes = []
    for (const w of shown) {
      const p = workoutProgress(w, athletes)
      comments += p.comments
      if (w.date <= today) { expected += p.total; done += p.done.length }
      for (const r of p.done) if (r.log.rpe != null) rpes.push(r.log.rpe)
    }
    return {
      count: shown.length,
      rate: expected ? Math.round((done / expected) * 100) : null,
      done, expected,
      rpe: rpes.length ? (Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10) : null,
      comments,
    }
  }, [shown, athletes])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const selected = data?.workouts.find(w => w.id === selectedId) || null
  const canEdit = w => isAdmin || w.coach_id === coach.id
  const showCoach = isClub || scope === 'all'
  const filtersOn = isClub ? (coachF || targetF) : (scope !== 'mine' || targetF)
  const targetOptions = [['club', 'Tout le club'], ...groups.map(g => [g.id, `Groupe ${g.name}`]), ['athlete', 'Individuelles']]

  function closeModal() { setCreating(null); setEditing(null); setDuplicating(null) }

  return (
    <Page wide>
      <Header eyebrow={isClub ? club.name : `Semaine du ${weekLabel(weekStart)}`} title="Séances à faire" search={false}>
        <WeekNav weekStart={weekStart} setWeekStart={setWeekStart} />
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Prescrire une séance</button>
      </Header>

      <div className="flex items-center gap-3 flex-wrap mb-5">
        {!isClub && (
          <div className="flex gap-1 p-1 rounded-full" style={{ background: 'var(--surface3)' }}>
            {[['mine', 'Mes séances'], ['all', 'Tout le club']].map(([k, l]) => (
              <button key={k} onClick={() => setScope(k)} className="h-9 px-4 rounded-full text-[13px] font-bold transition-all"
                style={scope === k ? { background: 'var(--surface)', color: 'var(--red)', boxShadow: 'var(--shadow)' } : { color: 'var(--text2)' }}>
                {l}
              </button>
            ))}
          </div>
        )}
        {isClub && <FilterSelect label="Tous les coachs" value={coachF} onChange={setCoachF} options={staff.map(s => [s.user_id, s.profile?.full_name || 'Coach'])} />}
        <FilterSelect label="Toutes les cibles" value={targetF} onChange={setTargetF} options={targetOptions} />
        {filtersOn && (
          <button className="text-[13px] font-semibold muted hover:opacity-70" onClick={() => { setCoachF(''); setTargetF(''); if (!isClub) setScope('mine') }}>Réinitialiser</button>
        )}
        <span className="flex-1" />
        <p className="text-[12px] muted max-w-md text-right">Sans horaire ni réservation : chaque athlète la fait seul et la note dans l'app (fait / pas fait, RPE, commentaire).</p>
      </div>

      {error && !data ? <ErrorNotice error={error} onRetry={reload} /> : loading && !data ? <Spinner full /> : (
        <>
          {error && <div className="mb-4"><ErrorNotice compact error={error} onRetry={reload} /></div>}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            {[
              ['Séances prescrites', stats.count],
              ['Réalisation', stats.rate != null ? `${stats.rate}%` : '—', stats.expected ? `${stats.done} faites sur ${stats.expected} attendues` : 'Rien à mesurer pour l\'instant'],
              ['RPE moyen', stats.rpe != null ? String(stats.rpe).replace('.', ',') : '—', 'Effort ressenti, de 1 à 10'],
              ['Commentaires', stats.comments, 'Retours écrits des athlètes'],
            ].map(([l, v, sub]) => (
              <div key={l} className="card px-5 py-4">
                <p className="text-[13px] font-semibold ink2">{l}</p>
                <p className="text-2xl font-extrabold mt-1">{v}</p>
                {sub && <p className="text-[12px] muted mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-3" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
            {days.map((d, i) => {
              const ds = toLocalDateStr(d)
              const list = shown.filter(w => w.date === ds)
              const isToday = sameDay(d, new Date())
              return (
                <div key={ds} className="flex flex-col gap-2 min-w-0 rounded-2xl p-2"
                  style={{ background: isToday ? 'rgba(158,27,43,0.05)' : 'transparent', border: isToday ? '1px solid #EBC3C7' : '1px solid transparent' }}>
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[13px] font-semibold" style={{ color: isToday ? 'var(--red)' : 'var(--text3)' }}>{DAY_NAMES[i]}</span>
                      <span className="text-lg font-extrabold" style={{ color: isToday ? 'var(--red)' : 'var(--text1)' }}>{d.getDate()}</span>
                    </div>
                    <button onClick={() => setCreating({ date: ds })} className="w-7 h-7 rounded-full flex items-center justify-center muted hover:bg-[var(--surface)]" aria-label={`Ajouter une séance le ${DAY_NAMES[i]} ${d.getDate()}`} title="Ajouter une séance ce jour">
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                  {list.map(w => <WorkoutCard key={w.id} w={w} athletes={athletes} showCoach={showCoach} onClick={() => setSelectedId(w.id)} />)}
                  {list.length === 0 && (
                    <button onClick={() => setCreating({ date: ds })} className="h-16 rounded-xl flex items-center justify-center text-[12px] font-semibold muted hover:opacity-70"
                      style={{ border: '1.5px dashed var(--border-strong)' }}>
                      Repos
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {shown.length === 0 && (
            <p className="text-sm muted text-center mt-6">
              {filtersOn ? 'Aucune séance ne correspond aux filtres cette semaine.' : 'Aucune séance à faire cette semaine. Clique sur « + » sous un jour ou sur « Prescrire une séance ».'}
            </p>
          )}
        </>
      )}

      {(creating || editing || duplicating) && (
        <WorkoutModal
          workout={editing}
          template={duplicating}
          preset={creating && creating !== true ? creating : {}}
          athletes={athletes}
          lockCoach={!isClub}
          onClose={closeModal}
          onSaved={() => { closeModal(); reload() }} />
      )}
      {selected && !editing && !duplicating && (
        <WorkoutDrawer workout={selected} athletes={athletes} canEdit={canEdit(selected)}
          onClose={() => setSelectedId(null)}
          onEdit={w => setEditing(w)}
          onDuplicate={w => setDuplicating(w)}
          onChanged={reload} />
      )}
    </Page>
  )
}
