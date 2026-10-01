import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/Layout'
import { Avatar, Icon, Page, Spinner, StatCard, SportBadge, AvatarStack } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useClub } from '../../context/ClubContext'
import { useNotifications } from '../../context/NotificationsContext'
import { supabase } from '../../lib/supabase'
import { fetchCoachAthletes, compliance } from '../../lib/coachData'
import { fetchSessions, fetchLastActivity, startOfWeek, addDays, weekLabel, fmtDay, fmtTime, relTime } from '../../lib/clubData'

function RequestRow({ person, sub, onAccept, onDecline, declineLabel = 'Refuser' }) {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
      <Avatar name={person.full_name} url={person.photo_url} id={person.id} size={40} />
      <div className="flex-1 min-w-0">
        <p className="font-bold truncate">{person.full_name || 'Athlète'}</p>
        <p className="text-[12px] muted truncate">{sub}</p>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onDecline}>{declineLabel}</button>
      <button className="btn btn-primary btn-sm" onClick={onAccept}><Icon name="check" size={14} /> Accepter</button>
    </div>
  )
}

export default function CoachDashboard() {
  const { coach } = useAuth()
  const { club } = useClub()
  const { unread } = useNotifications()
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    const { active, pending, plans } = await fetchCoachAthletes(coach.id)
    const linked = new Set([...active, ...pending].map(r => r.athlete.id))

    // File d'attente générale (demandes « un coach » depuis l'app, sans coach choisi).
    const { data: wl } = await supabase.from('coach_waitlist').select('user_id').eq('status', 'waiting')
    const waitIds = [...new Set((wl || []).map(r => r.user_id))].filter(id => id && !linked.has(id))
    const { data: waiting } = waitIds.length
      ? await supabase.from('profiles').select('id, full_name, email, photo_url').in('id', waitIds)
      : { data: [] }

    const last = await fetchLastActivity(active.map(r => r.athlete.id))
    const now = Date.now()
    const watch = active.map(r => {
      const c = compliance(plans[r.athlete.id], 14)
      const lastAt = last[r.athlete.id]
      const idle = lastAt ? Math.floor((now - new Date(lastAt)) / 86400000) : null
      const reasons = []
      if (idle == null || idle >= 7) reasons.push(idle == null ? 'Aucune activité synchronisée' : `Rien depuis ${idle} jours`)
      if (c && c.pct < 60) reasons.push(`${c.pct}% du plan réalisé (14 j)`)
      if (!plans[r.athlete.id]) reasons.push('Pas de plan')
      return { ...r.athlete, reasons, lastAt }
    }).filter(a => a.reasons.length).slice(0, 6)

    let sessions = []
    if (club) {
      const now2 = new Date()
      const { data: s } = await fetchSessions(club.id, now2, addDays(now2, 7), { coachId: coach.id })
      sessions = s
    }
    setData({ active, pending, waiting: waiting || [], watch, sessions, plans })
  }, [coach.id, club?.id])

  useEffect(() => { load() }, [load])

  async function accept(relId) {
    await supabase.from('coach_athletes').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', relId)
    load()
  }
  async function decline(relId) {
    await supabase.from('coach_athletes').delete().eq('id', relId)
    load()
  }
  async function acceptWaiting(athleteId) {
    const { data: ex } = await supabase.from('coach_athletes').select('id, status').eq('coach_id', coach.id).eq('athlete_id', athleteId).maybeSingle()
    if (ex) {
      if (ex.status !== 'active') await supabase.from('coach_athletes').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', ex.id)
    } else {
      await supabase.from('coach_athletes').insert({ coach_id: coach.id, athlete_id: athleteId, status: 'active', started_at: new Date().toISOString() })
    }
    await supabase.from('coach_waitlist').update({ status: 'approved' }).eq('user_id', athleteId)
    load()
  }
  async function dismissWaiting(athleteId) {
    await supabase.from('coach_waitlist').delete().eq('user_id', athleteId)
    load()
  }

  const firstName = coach?.full_name?.split(' ')[0] || ''
  const requests = data ? data.pending.length + data.waiting.length : 0

  return (
    <Page>
      <Header eyebrow={`Bonjour ${firstName} · Semaine du ${weekLabel(startOfWeek())}`} title="Tableau de bord" />
      {!data ? <Spinner full /> : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard label="Athlètes suivis" icon="users" value={data.active.length} sub={`${Object.keys(data.plans).length} avec un plan`} />
            <StatCard label="Demandes" icon="plus" value={requests} sub={requests ? 'À traiter ci-dessous' : 'Aucune en attente'} subTone={requests ? 'warn' : undefined} />
            <StatCard label="Messages non lus" icon="message" value={unread} sub={unread ? 'Ouvre la messagerie' : 'Tout est lu'} />
            <StatCard label="À surveiller" icon="target" value={data.watch.length} sub={data.watch.length ? 'Voir la liste' : 'Tout le monde roule'} subTone={data.watch.length ? 'warn' : 'good'} />
          </div>

          {requests > 0 && (
            <div className="card p-6">
              <p className="card-title mb-1">Demandes de coaching</p>
              <p className="text-[13px] muted mb-2">Accepte un athlète pour lui créer un plan et échanger avec lui.</p>
              {data.pending.map(r => (
                <RequestRow key={r.id} person={r.athlete} sub={`${r.athlete.email} · t'a choisi comme coach`}
                  onAccept={() => accept(r.id)} onDecline={() => decline(r.id)} />
              ))}
              {data.waiting.map(p => (
                <RequestRow key={p.id} person={p} sub={`${p.email || ''} · cherche un coach`} declineLabel="Ignorer"
                  onAccept={() => acceptWaiting(p.id)} onDecline={() => dismissWaiting(p.id)} />
              ))}
            </div>
          )}

          <div className="grid gap-5" style={{ gridTemplateColumns: club ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)' }}>
            <div className="card p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="card-title">À surveiller</p>
                <button className="text-[13px] font-semibold muted hover:opacity-70 flex items-center gap-1" onClick={() => navigate('/athletes')}>Mes athlètes <Icon name="right" size={14} /></button>
              </div>
              {data.watch.length === 0 && <p className="text-sm muted py-6">Tous tes athlètes s'entraînent et suivent leur plan. 👌</p>}
              {data.watch.map(a => (
                <button key={a.id} onClick={() => navigate(`/athletes/${a.id}`)} className="w-full flex items-center gap-3 py-3 text-left hover:opacity-80" style={{ borderTop: '1px solid var(--border)' }}>
                  <Avatar name={a.full_name} url={a.photo_url} id={a.id} size={38} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{a.full_name}</p>
                    <p className="text-[12px] truncate" style={{ color: 'var(--warn)' }}>{a.reasons.join(' · ')}</p>
                  </div>
                  <span className="text-[12px] muted">{a.lastAt ? relTime(a.lastAt) : ''}</span>
                </button>
              ))}
            </div>

            {club && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="card-title">Mes prochaines séances</p>
                  <button className="text-[13px] font-semibold muted hover:opacity-70 flex items-center gap-1" onClick={() => navigate('/agenda')}>Agenda <Icon name="right" size={14} /></button>
                </div>
                {data.sessions.length === 0 && (
                  <div className="py-6">
                    <p className="text-sm muted mb-3">Rien de programmé ces 7 prochains jours.</p>
                    <button className="btn btn-soft btn-sm" onClick={() => navigate('/agenda')}><Icon name="plus" size={14} /> Ouvrir des créneaux</button>
                  </div>
                )}
                {data.sessions.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <SportBadge sport={s.kind === 'one_on_one' ? 'coaching' : s.sport} size={38} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{s.kind === 'one_on_one' && s.booked[0] ? `1:1 · ${s.booked[0].profile?.full_name}` : s.title}</p>
                      <p className="text-[12px] muted">{fmtDay(s.start)} · {fmtTime(s.start)}{s.location ? ` · ${s.location}` : ''}</p>
                    </div>
                    {s.kind === 'collective' && <AvatarStack people={s.booked.map(b => ({ ...b.profile, id: b.user_id }))} size={24} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Page>
  )
}
