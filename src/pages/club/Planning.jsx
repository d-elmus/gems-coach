import { useCallback, useEffect, useMemo, useState } from 'react'
import { Header } from '../../components/Layout'
import { Icon, Page, Spinner, FilterSelect, ErrorNotice } from '../../components/ui'
import { useClub } from '../../context/ClubContext'
import WeekCalendar, { CalendarLegend } from '../../components/WeekCalendar'
import ClubSessionModal from '../../components/ClubSessionModal'
import SessionDrawer from '../../components/SessionDrawer'
import { startOfWeek, addDays, weekLabel, fetchSessions } from '../../lib/clubData'
import { SPORT_META } from '../../lib/planHelpers'

export function WeekNav({ weekStart, setWeekStart }) {
  return (
    <div className="flex items-center gap-1 h-[42px] px-1.5 rounded-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--surface2)]" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semaine précédente"><Icon name="left" size={16} /></button>
      <button className="px-2 text-sm font-bold whitespace-nowrap" onClick={() => setWeekStart(startOfWeek())} title="Revenir à cette semaine">{weekLabel(weekStart)} {weekStart.getFullYear()}</button>
      <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--surface2)]" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semaine suivante"><Icon name="right" size={16} /></button>
    </div>
  )
}

export default function Planning() {
  const { club, staff, groups } = useClub()
  const [weekStart, setWeekStart] = useState(startOfWeek())
  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(null) // Date | true
  const [editing, setEditing] = useState(null)
  const [duplicating, setDuplicating] = useState(null)
  const [selected, setSelected] = useState(null)
  const [coachF, setCoachF] = useState('')
  const [sportF, setSportF] = useState('')
  const [groupF, setGroupF] = useState('')

  const load = useCallback(async () => {
    const { data, error: err } = await fetchSessions(club.id, weekStart, addDays(weekStart, 7))
    setError(err)
    if (err) return
    setSessions(data)
    setSelected(sel => sel ? data.find(s => s.id === sel.id) || null : null)
  }, [club.id, weekStart])

  useEffect(() => { load() }, [load])

  const shown = useMemo(() => (sessions || []).filter(s => {
    if (coachF && s.coach_id !== coachF) return false
    if (sportF && (sportF === 'coaching' ? s.kind !== 'one_on_one' : s.kind === 'one_on_one' || s.sport !== sportF)) return false
    if (groupF === 'club' && (s.group_id || s.kind === 'one_on_one')) return false
    if (groupF && groupF !== 'club' && s.group_id !== groupF) return false
    return true
  }), [sessions, coachF, sportF, groupF])
  const filtersOn = coachF || sportF || groupF

  function closeModal() { setCreating(null); setEditing(null); setDuplicating(null) }

  return (
    <Page wide>
      <Header eyebrow={club.name} title="Planning du club" search={false}>
        <WeekNav weekStart={weekStart} setWeekStart={setWeekStart} />
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Créer une séance</button>
      </Header>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <FilterSelect label="Tous les coachs" value={coachF} onChange={setCoachF} options={staff.map(s => [s.user_id, s.profile?.full_name || 'Coach'])} />
        <FilterSelect label="Tous les sports" value={sportF} onChange={setSportF} options={[...Object.entries(SPORT_META).map(([k, m]) => [k, m.label]), ['coaching', 'Coaching 1:1']]} />
        <FilterSelect label="Tous les groupes" value={groupF} onChange={setGroupF} options={[['club', 'Ouvertes à tout le club'], ...groups.map(g => [g.id, `Groupe ${g.name}`])]} />
        {filtersOn && <button className="text-[13px] font-semibold muted hover:opacity-70" onClick={() => { setCoachF(''); setSportF(''); setGroupF('') }}>Réinitialiser</button>}
        {sessions && filtersOn && <span className="text-[13px] muted">{shown.length} séance{shown.length > 1 ? 's' : ''} sur {sessions.length}</span>}
      </div>

      {sessions === null && error ? <ErrorNotice error={error} onRetry={load} /> : sessions === null ? <Spinner full /> : (
        <>
          {error && <div className="mb-4"><ErrorNotice compact error={error} onRetry={load} /></div>}
          <WeekCalendar weekStart={weekStart} sessions={shown} showCoach onSelect={setSelected} onCreate={d => setCreating(d)} />
          <CalendarLegend />
          {sessions.length === 0 && <p className="text-sm muted text-center mt-4">Aucune séance cette semaine. Clique sur un créneau du calendrier pour en créer une.</p>}
        </>
      )}

      {(creating || editing || duplicating) && (
        <ClubSessionModal
          initialDate={creating instanceof Date ? creating : undefined}
          session={editing}
          template={duplicating}
          onClose={closeModal}
          onSaved={() => { closeModal(); load() }} />
      )}
      {selected && !editing && !duplicating && (
        <SessionDrawer session={selected} onClose={() => setSelected(null)} onEdit={s => setEditing(s)} onDuplicate={s => setDuplicating(s)} onChanged={load} />
      )}
    </Page>
  )
}
