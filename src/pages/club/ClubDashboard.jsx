import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/Layout'
import { Avatar, Icon, Page, Spinner, StatCard, SportBadge, Meter, ErrorNotice } from '../../components/ui'
import { useClub } from '../../context/ClubContext'
import { useAuth } from '../../context/AuthContext'
import { fetchMembers, fetchSessions, startOfWeek, addDays, fmtDay, fmtTime, relTime, weekLabel, membershipStatus } from '../../lib/clubData'

// Semaine ISO (numéro affiché sous les barres : S34, S35…)
function isoWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = x.getUTCDay() || 7
  x.setUTCDate(x.getUTCDate() + 4 - day)
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1))
  return Math.ceil(((x - y0) / 86400000 + 1) / 7)
}

// Présence hebdomadaire : une barre par semaine, la semaine en cours en rouge plein.
function AttendanceChart({ weeks }) {
  const [hover, setHover] = useState(null)
  const H = 190
  return (
    <div className="relative" style={{ height: H + 34 }}>
      {[100, 75, 50, 25, 0].map(v => (
        <div key={v} className="absolute left-0 right-0 flex items-center gap-3" style={{ top: H - (v / 100) * H - 7 }}>
          <span className="text-[11px] muted w-9 text-right">{v}%</span>
          <div className="flex-1" style={{ borderTop: v ? '1px dashed var(--border)' : '1px solid var(--border-strong)' }} />
        </div>
      ))}
      <div className="absolute flex items-end gap-4" style={{ left: 52, right: 8, top: 0, height: H }}>
        {weeks.map((w, i) => {
          const last = i === weeks.length - 1
          const h = w.rate == null ? 0 : Math.max(4, (w.rate / 100) * H)
          return (
            <div key={i} className="flex-1 h-full flex flex-col justify-end items-center relative"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {(hover === i || last) && w.rate != null && (
                <div className="absolute px-2 py-1 rounded-lg text-[11px] font-extrabold text-white whitespace-nowrap z-10"
                  style={{ bottom: h + 8, background: 'var(--red)' }}>
                  {w.rate}%{hover === i && ` · ${w.present}/${w.total}`}
                </div>
              )}
              {w.rate == null
                ? <div className="w-full max-w-[56px] rounded-t-lg" style={{ height: 4, background: 'var(--surface3)' }} title="Pas de présence pointée" />
                : <div className="w-full max-w-[56px]" style={{ height: h, borderRadius: '8px 8px 2px 2px', background: last ? 'var(--red)' : '#D9A2A8', transition: 'height .3s' }} />}
              <span className="absolute text-[12px] font-semibold" style={{ top: H + 10, color: last ? 'var(--text1)' : 'var(--text3)', fontWeight: last ? 800 : 600 }}>S{w.num}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ClubDashboard() {
  const { club, staff } = useClub()
  const { coach } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    (async () => {
      const now = new Date()
      const thisWeek = startOfWeek(now)
      const from = addDays(thisWeek, -7 * 7)
      const [{ data: members, error: e1 }, { data: sessions, error: e2 }] = await Promise.all([
        fetchMembers(club.id),
        fetchSessions(club.id, from, addDays(thisWeek, 14)),
      ])
      if (e1 || e2) { setError(e1 || e2); return }
      setError(null)

      const athletes = members.filter(m => m.roles?.includes('athlete'))
      const monthAgo = addDays(now, -30)
      const newThisMonth = athletes.filter(m => new Date(m.joined_at) > monthAgo).length
      const statuses = athletes.map(membershipStatus)
      const activeMemberships = statuses.filter(s => s.tone === 'good' || s.tone === 'warn').length
      const expiring = statuses.filter(s => s.tone === 'warn').length

      // Présence par semaine = présents / pointés (séances passées uniquement).
      const weeks = Array.from({ length: 8 }, (_, i) => {
        const ws = addDays(thisWeek, (i - 7) * 7)
        const we = addDays(ws, 7)
        const marked = sessions.filter(s => s.start >= ws && s.start < we && s.start < now)
          .flatMap(s => s.booked).filter(b => b.attended != null)
        const present = marked.filter(b => b.attended).length
        return { num: isoWeek(ws), total: marked.length, present, rate: marked.length ? Math.round((present / marked.length) * 100) : null }
      })
      const cur = weeks[7].rate ?? weeks[6].rate
      const prevRates = weeks.slice(3, 7).map(w => w.rate).filter(r => r != null)
      const prevAvg = prevRates.length ? Math.round(prevRates.reduce((a, b) => a + b, 0) / prevRates.length) : null

      // Activité récente : réservations + arrivées de membres.
      const feed = [
        ...sessions.flatMap(s => s.bookings.filter(b => b.status === 'booked').map(b => ({
          at: b.created_at, who: b.profile, text: 'a réservé', what: s.title,
        }))),
        ...members.filter(m => m.profile).map(m => ({
          at: m.joined_at, who: m.profile, text: m.group ? 'a rejoint le groupe' : 'a rejoint le club', what: m.group?.name,
        })),
      ].filter(f => f.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6)

      const upcoming = sessions.filter(s => s.end > now && s.kind === 'collective').slice(0, 6)

      const requests = members.filter(m => m.requested_role)

      setData({ athletes, newThisMonth, activeMemberships, expiring, weeks, cur, prevAvg, feed, upcoming, requests })
    })().catch(setError)
  }, [club.id, retry])

  const firstName = coach?.full_name?.split(' ')[0] || ''

  return (
    <Page>
      <Header eyebrow={`Bonjour ${firstName} · Semaine du ${weekLabel(startOfWeek())}`} title="Tableau de bord" />
      {!data && error ? <ErrorNotice error={error} onRetry={() => setRetry(r => r + 1)} /> : !data ? <Spinner full /> : (
        <div className="flex flex-col gap-5">
          {data.requests.length > 0 && (
            <button onClick={() => navigate('/club/members')} className="card px-5 py-4 flex items-center gap-4 text-left hover:shadow-lg transition-shadow"
              style={{ borderColor: '#EBC3C7', background: 'linear-gradient(90deg, var(--red-soft), var(--surface))' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--red)', color: '#fff' }}><Icon name="shield" size={18} /></div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold">{data.requests.length} demande{data.requests.length > 1 ? 's' : ''} de rôle à valider</p>
                <p className="text-[13px] muted truncate">{data.requests.slice(0, 3).map(m => `${m.profile?.full_name || 'Membre'} (${m.requested_role})`).join(', ')}{data.requests.length > 3 ? '…' : ''}</p>
              </div>
              <span className="btn btn-primary btn-sm">Valider <Icon name="right" size={14} /></span>
            </button>
          )}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard label="Adhérents" icon="users" value={data.athletes.length}
              sub={data.newThisMonth ? `+${data.newThisMonth} ce mois` : 'Aucune arrivée ce mois'} subTone={data.newThisMonth ? 'good' : undefined} />
            <StatCard label="Coachs actifs" icon="whistle" value={staff.length}
              sub={staff.slice(0, 3).map(s => s.profile?.full_name?.split(' ')[0]).filter(Boolean).join(', ') + (staff.length > 3 ? ` +${staff.length - 3}` : '')} />
            <StatCard label="Taux de présence" icon="check" value={data.cur != null ? `${data.cur}%` : '—'}
              sub={data.cur != null && data.prevAvg != null ? `${data.cur - data.prevAvg >= 0 ? '+' : ''}${data.cur - data.prevAvg} pts vs mois dernier` : 'Pointe la présence depuis le planning'}
              subTone={data.cur != null && data.prevAvg != null && data.cur >= data.prevAvg ? 'good' : undefined} />
            <StatCard label="Adhésions actives" icon="card" value={data.activeMemberships}
              sub={data.expiring ? `${data.expiring} expirent sous 30 j` : 'Aucune expiration proche'} subTone={data.expiring ? 'warn' : undefined} />
          </div>

          <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <p className="card-title">Présence hebdomadaire</p>
                <span className="text-[13px] font-semibold muted">8 dernières semaines</span>
              </div>
              <AttendanceChart weeks={data.weeks} />
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="card-title">Activité récente</p>
                <button className="text-[13px] font-semibold muted hover:opacity-70" onClick={() => navigate('/club/members')}>Tout voir</button>
              </div>
              {data.feed.length === 0 && <p className="text-sm muted py-6">Rien pour l'instant. Invite tes premiers membres !</p>}
              <div className="flex flex-col gap-4">
                {data.feed.map((f, i) => (
                  <div key={i} className="flex gap-3">
                    <Avatar name={f.who?.full_name} url={f.who?.photo_url} id={f.who?.id} size={38} />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-snug">
                        <b>{f.who?.full_name}</b> {f.text} {f.what && <span style={{ color: 'var(--red)', fontWeight: 600 }}>{f.what}</span>}
                      </p>
                      <p className="text-[12px] muted">{relTime(f.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="card-title">Prochaines séances du club</p>
              <button className="text-[13px] font-semibold muted hover:opacity-70 flex items-center gap-1" onClick={() => navigate('/club/planning')}>
                Voir le planning <Icon name="right" size={14} />
              </button>
            </div>
            {data.upcoming.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm muted mb-3">Aucune séance programmée.</p>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/club/planning')}><Icon name="plus" size={14} /> Créer une séance</button>
              </div>
            ) : (
              <table className="table">
                <thead><tr><th>Séance</th><th>Coach</th><th>Date</th><th style={{ width: 260 }}>Réservations</th></tr></thead>
                <tbody>
                  {data.upcoming.map(s => (
                    <tr key={s.id} className="cursor-pointer" onClick={() => navigate('/club/planning')}>
                      <td><div className="flex items-center gap-3"><SportBadge sport={s.sport} size={34} /><span className="font-bold">{s.title}</span></div></td>
                      <td><div className="flex items-center gap-2"><Avatar name={s.coach?.full_name} url={s.coach?.photo_url} id={s.coach?.id} size={26} /><span className="text-[13px]">{s.coach?.full_name}</span></div></td>
                      <td className="text-[13px] ink2">{fmtDay(s.start)} · {fmtTime(s.start)}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex-1"><Meter value={s.booked.length} max={s.capacity || s.booked.length || 1} tone={s.full ? 'red' : 'good'} /></div>
                          <span className="text-[13px] font-bold w-24 text-right" style={{ color: s.full ? 'var(--red)' : 'var(--good)' }}>
                            {s.full ? 'Complet' : s.capacity ? `${s.booked.length}/${s.capacity} places` : `${s.booked.length} inscrits`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </Page>
  )
}
