import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/Layout'
import { Avatar, Icon, Page, Spinner } from '../../components/ui'
import { useClub } from '../../context/ClubContext'
import { fetchMembers, fetchSessions, startOfWeek, addDays, memberName } from '../../lib/clubData'
import { InviteModal } from './Members'

export default function Coaches() {
  const { club, reload } = useClub()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async () => {
    const ws = startOfWeek()
    const [{ data: members }, { data: sessions }] = await Promise.all([
      fetchMembers(club.id),
      fetchSessions(club.id, ws, addDays(ws, 7)),
    ])
    const coaches = members.filter(m => m.roles?.includes('coach'))
    setData(coaches.map(c => {
      const mine = sessions.filter(s => s.coach_id === c.user_id)
      return {
        ...c,
        athletes: members.filter(m => m.coach_id && m.coach_id === c.user_id),
        collective: mine.filter(s => s.kind === 'collective').length,
        slots: mine.filter(s => s.kind === 'one_on_one'),
        hours: Math.round(mine.filter(s => s.kind === 'collective' || s.booked.length).reduce((a, s) => a + s.duration_min, 0) / 6) / 10,
      }
    }))
  }, [club.id])

  useEffect(() => { load() }, [load])

  return (
    <Page>
      <Header eyebrow={club.name} title={<>Coachs <span className="muted font-bold">· {data?.length ?? ''}</span></>} search={false}>
        <button className="btn btn-primary" onClick={() => setInviting(true)}><Icon name="plus" size={16} /> Inviter un coach</button>
      </Header>

      {!data ? <Spinner full /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
          {data.map(c => (
            <div key={c.id} className="card p-6 flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <Avatar name={memberName(c)} url={c.profile?.photo_url} id={c.user_id || c.id} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold truncate">{memberName(c)}</p>
                  <p className="text-[13px] muted truncate">{c.user_id ? c.profile?.email : 'Invitation envoyée'}</p>
                </div>
                {c.roles?.includes('admin') && <span className="pill pill-red">Admin</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[['Athlètes suivis', c.athletes.length], ['Cours / sem.', c.collective], ['Heures / sem.', `${String(c.hours).replace('.', ',')} h`]].map(([l, v]) => (
                  <div key={l} className="card-soft px-3 py-3">
                    <p className="text-2xl font-extrabold">{v}</p>
                    <p className="text-[11px] muted font-semibold">{l}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="muted">Créneaux 1:1 cette semaine</span>
                <b>{c.slots.filter(s => s.booked.length).length}/{c.slots.length} réservés</b>
              </div>
              {c.athletes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {c.athletes.slice(0, 8).map(a => (
                    <button key={a.id} onClick={() => a.user_id && navigate(`/athletes/${a.user_id}`)} className="pill pill-neutral hover:opacity-80">{memberName(a)}</button>
                  ))}
                  {c.athletes.length > 8 && <span className="pill pill-neutral">+{c.athletes.length - 8}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {inviting && <InviteModal defaultRole="coach" onClose={() => setInviting(false)} onDone={() => { setInviting(false); load(); reload() }} />}
    </Page>
  )
}
