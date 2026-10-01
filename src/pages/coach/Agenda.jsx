import { useCallback, useEffect, useMemo, useState } from 'react'
import { Header } from '../../components/Layout'
import { AvatarStack, Avatar, Icon, Page, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useClub } from '../../context/ClubContext'
import WeekCalendar, { CalendarLegend } from '../../components/WeekCalendar'
import ClubSessionModal from '../../components/ClubSessionModal'
import SessionDrawer from '../../components/SessionDrawer'
import { WeekNav } from '../club/Planning'
import { startOfWeek, addDays, fetchSessions, fmtTime, fmtDay, weekLabel } from '../../lib/clubData'

export default function Agenda() {
  const { coach } = useAuth()
  const { club } = useClub()
  const [weekStart, setWeekStart] = useState(startOfWeek())
  const [sessions, setSessions] = useState(null)
  const [creating, setCreating] = useState(null)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    const { data } = await fetchSessions(club.id, weekStart, addDays(weekStart, 7), { coachId: coach.id })
    setSessions(data)
    setSelected(sel => sel ? data.find(s => s.id === sel.id) || null : null)
  }, [club.id, coach.id, weekStart])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const list = sessions || []
    const collective = list.filter(s => s.kind === 'collective')
    const oneOnOne = list.filter(s => s.kind === 'one_on_one')
    const hours = list.filter(s => s.kind === 'collective' || s.booked.length).reduce((a, s) => a + s.duration_min, 0) / 60
    return {
      collective: collective.length,
      oneOnOneBooked: oneOnOne.filter(s => s.booked.length).length,
      oneOnOne: oneOnOne.length,
      hours: Math.round(hours * 10) / 10,
      upcoming: list.filter(s => s.end > new Date() && s.booked.length).slice(0, 6),
      freeSlots: oneOnOne.filter(s => !s.booked.length && s.start > new Date()),
    }
  }, [sessions])

  return (
    <Page wide>
      <Header eyebrow={`Semaine du ${weekLabel(weekStart)}`} title="Mon agenda" search={false}>
        <WeekNav weekStart={weekStart} setWeekStart={setWeekStart} />
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Ouvrir des créneaux</button>
      </Header>

      {sessions === null ? <Spinner full /> : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
          <div className="min-w-0">
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[['Cours collectifs', stats.collective], ['Créneaux 1:1', `${stats.oneOnOneBooked}/${stats.oneOnOne} réservés`], ['Heures animées', `${String(stats.hours).replace('.', ',')} h`]].map(([l, v]) => (
                <div key={l} className="card px-5 py-4">
                  <p className="text-[13px] font-semibold ink2">{l}</p>
                  <p className="text-2xl font-extrabold mt-1">{v}</p>
                </div>
              ))}
            </div>
            <WeekCalendar weekStart={weekStart} sessions={sessions} onSelect={setSelected} onCreate={d => setCreating(d)} />
            <CalendarLegend />
          </div>

          <div className="card p-5 flex flex-col gap-1 self-start sticky top-6">
            <p className="card-title mb-3">Prochaines réservations</p>
            {stats.upcoming.length === 0 && <p className="text-sm muted py-4">Aucune réservation cette semaine.</p>}
            {stats.upcoming.map(s => (
              <button key={s.id} onClick={() => setSelected(s)} className="flex gap-4 py-3 text-left hover:opacity-80" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="w-14 flex-shrink-0">
                  <p className="text-[12px] muted">{fmtDay(s.start, { weekday: 'short', day: 'numeric' })}</p>
                  <p className="font-extrabold">{fmtTime(s.start)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{s.kind === 'one_on_one' ? `1:1 · ${s.title}` : s.title}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    {s.kind === 'one_on_one'
                      ? <><Avatar name={s.booked[0]?.profile?.full_name} url={s.booked[0]?.profile?.photo_url} id={s.booked[0]?.user_id} size={24} /><span className="text-[13px] ink2 truncate">{s.booked[0]?.profile?.full_name}</span></>
                      : <><AvatarStack people={s.booked.map(b => ({ ...b.profile, id: b.user_id }))} size={24} /><span className="text-[12px] muted">{s.booked.length} inscrits</span></>}
                  </div>
                </div>
              </button>
            ))}
            {stats.freeSlots.length > 0 && (
              <div className="mt-4 rounded-2xl p-4" style={{ background: 'var(--red-soft)', border: '1.5px dashed var(--red)' }}>
                <p className="font-extrabold text-sm">{stats.freeSlots.length} créneau{stats.freeSlots.length > 1 ? 'x' : ''} 1:1 encore libre{stats.freeSlots.length > 1 ? 's' : ''}</p>
                <p className="text-[12px] ink2 mt-1">
                  {stats.freeSlots.slice(0, 3).map(s => `${fmtDay(s.start, { weekday: 'long' })} ${fmtTime(s.start)}`).join(', ')} · visibles dans l'app athlète
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {(creating || editing) && (
        <ClubSessionModal lockCoach
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
