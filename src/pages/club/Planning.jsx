import { useCallback, useEffect, useState } from 'react'
import { Header } from '../../components/Layout'
import { Icon, Page, Spinner } from '../../components/ui'
import { useClub } from '../../context/ClubContext'
import WeekCalendar, { CalendarLegend } from '../../components/WeekCalendar'
import ClubSessionModal from '../../components/ClubSessionModal'
import SessionDrawer from '../../components/SessionDrawer'
import { startOfWeek, addDays, weekLabel, fetchSessions } from '../../lib/clubData'

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
  const { club } = useClub()
  const [weekStart, setWeekStart] = useState(startOfWeek())
  const [sessions, setSessions] = useState(null)
  const [creating, setCreating] = useState(null) // Date | true
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    const { data } = await fetchSessions(club.id, weekStart, addDays(weekStart, 7))
    setSessions(data)
    setSelected(sel => sel ? data.find(s => s.id === sel.id) || null : null)
  }, [club.id, weekStart])

  useEffect(() => { load() }, [load])

  return (
    <Page wide>
      <Header eyebrow={club.name} title="Planning du club" search={false}>
        <WeekNav weekStart={weekStart} setWeekStart={setWeekStart} />
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Créer une séance</button>
      </Header>

      {sessions === null ? <Spinner full /> : (
        <>
          <WeekCalendar weekStart={weekStart} sessions={sessions} showCoach onSelect={setSelected} onCreate={d => setCreating(d)} />
          <CalendarLegend />
        </>
      )}

      {(creating || editing) && (
        <ClubSessionModal
          initialDate={creating instanceof Date ? creating : undefined}
          session={editing}
          onClose={() => { setCreating(null); setEditing(null) }}
          onSaved={() => { setCreating(null); setEditing(null); load() }} />
      )}
      {selected && !editing && (
        <SessionDrawer session={selected} onClose={() => setSelected(null)} onEdit={s => setEditing(s)} onChanged={load} />
      )}
    </Page>
  )
}
