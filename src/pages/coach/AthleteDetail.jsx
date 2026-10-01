import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Header } from '../../components/Layout'
import { Avatar, Icon, Page, Spinner, SportBadge, Empty } from '../../components/ui'
import { AreaChart, Ring } from '../../components/charts'
import { useAuth } from '../../context/AuthContext'
import { useClub } from '../../context/ClubContext'
import { supabase } from '../../lib/supabase'
import { planWeeks, compliance, currentWeekIdx, fetchActivities, weeklyLoad, normSport, fmtDuration, fmtDistance } from '../../lib/coachData'
import { fmtDay, fmtTime, relTime } from '../../lib/clubData'
import { parseDate, daysUntil } from '../../lib/dateUtils'
import { SPORT_META, ZONE_COLORS, PHASE_COLORS, PHASE_LABELS, DISCIPLINE_LABELS, DAYS_SHORT } from '../../lib/planHelpers'
import { GroupPill } from '../club/Members'

const TABS = [['overview', "Vue d'ensemble"], ['plan', 'Plan'], ['activities', 'Activités'], ['presence', 'Présence']]

function SourceBadge({ source }) {
  const s = (source || '').toLowerCase()
  const map = { strava: ['Strava', '#FC4C02'], garmin: ['Garmin', '#007CC3'], healthkit: ['Santé', '#E0245E'], health: ['Santé', '#E0245E'] }
  const [l, c] = map[s] || [source || 'App', '#9A8B72']
  return <span className="pill" style={{ height: 20, fontSize: 11, background: c + '18', color: c }}>{l}</span>
}

function ActivityRow({ a }) {
  const sport = normSport(a.sport)
  const detail = [
    fmtDistance(a),
    a.avg_pace && `${a.avg_pace}${sport === 'swim' ? '/100m' : '/km'}`,
    a.avg_power && `${a.avg_power}W`,
    fmtDuration(a.duration),
    a.avg_hr && `FC ${a.avg_hr}`,
  ].filter(Boolean).join(' · ')
  return (
    <div className="card-soft px-4 py-3 flex items-center gap-3">
      <SportBadge sport={sport} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold truncate">{a.activity_name || `${SPORT_META[sport]?.label} ${fmtDistance(a)}`}</p>
          <span className="text-[12px] muted flex-shrink-0">{relTime(a.date)}</span>
        </div>
        <p className="text-[12px] muted truncate">{detail}</p>
      </div>
    </div>
  )
}

// ─── Onglet Plan : semaine en cours + tous les plans ────────────────────────
function PlanTab({ athleteId, plans, coachId, onDeleted }) {
  const navigate = useNavigate()
  const ref = plans.find(p => p.is_active) || plans.find(p => p.athlete_metrics?.coachId === coachId) || plans[0]
  const [weekIdx, setWeekIdx] = useState(ref ? currentWeekIdx(ref) : 0)
  if (!ref) return (
    <Empty icon="list" title="Aucun plan" text="Crée le premier plan de cet athlète. Il l'active ensuite depuis son app.">
      <button className="btn btn-primary" onClick={() => navigate(`/athletes/${athleteId}/builder`)}><Icon name="plus" size={16} /> Créer un plan</button>
    </Empty>
  )
  const weeks = planWeeks(ref)
  const week = weeks[weekIdx]
  const done = ref.completed_sessions || {}
  const nowIdx = currentWeekIdx(ref)

  async function remove(p) {
    if (!window.confirm(`Supprimer le plan « ${p.event_name || p.discipline} » ? Irréversible.`)) return
    const { error } = await supabase.from('plans').delete().eq('id', p.id)
    if (error) alert(error.message); else onDeleted()
  }

  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px' }}>
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="eyebrow">{ref.is_active ? 'Plan actif' : 'Plan non activé'}</p>
              {ref.athlete_metrics?.coachId === coachId && <span className="pill pill-red" style={{ height: 20, fontSize: 11 }}>Créé par toi</span>}
            </div>
            <p className="text-xl font-extrabold">{ref.event_name || DISCIPLINE_LABELS[ref.discipline]}</p>
            <p className="text-[13px] muted">{weeks.length} semaines{ref.goal_date ? ` · objectif le ${parseDate(ref.goal_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''}</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate(ref.athlete_metrics?.coachId === coachId ? `/athletes/${athleteId}/builder?planId=${ref.id}` : `/athletes/${athleteId}/builder`)}>
            <Icon name="edit" size={14} /> {ref.athlete_metrics?.coachId === coachId ? 'Modifier' : 'Créer un plan à partir de celui-ci'}
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
          {weeks.map((w, i) => (
            <button key={i} onClick={() => setWeekIdx(i)} className="flex-shrink-0 w-11 rounded-xl py-1.5 text-center"
              style={i === weekIdx ? { background: 'var(--red)', color: '#fff' } : { background: 'var(--surface2)', color: i === nowIdx ? 'var(--red)' : 'var(--text2)', border: i === nowIdx ? '1px solid var(--red)' : '1px solid transparent' }}>
              <p className="text-[11px] font-extrabold">S{w.weekNum ?? i + 1}</p>
              <div className="h-1 mx-2 mt-1 rounded-full" style={{ background: i === weekIdx ? 'rgba(255,255,255,0.6)' : PHASE_COLORS[w.phase] || 'var(--border)' }} />
            </button>
          ))}
        </div>

        {week && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <p className="font-extrabold">Semaine {week.weekNum ?? weekIdx + 1}</p>
              <span className="pill pill-neutral">{PHASE_LABELS[week.phase] || week.phase}</span>
              {week.isRecovery && <span className="pill pill-good">Récup</span>}
              <span className="ml-auto text-[13px] muted">{(week.sessions || []).reduce((a, s) => a + (s.tss || 0), 0)} TSS</span>
            </div>
            {(week.sessions || []).length === 0 && <p className="text-sm muted py-4">Aucune séance cette semaine.</p>}
            <div className="flex flex-col gap-2">
              {(week.sessions || []).map(s => {
                const d = parseDate(s.date)
                const isDone = !!(done[s.id] || s.done)
                const past = s.date < new Date().toISOString().slice(0, 10)
                return (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--surface2)' }}>
                    <span className="text-[12px] font-extrabold w-9 muted">{DAYS_SHORT[(d.getDay() + 6) % 7]}</span>
                    <SportBadge sport={s.sport} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[13px] truncate">{s.label}</p>
                      <p className="text-[12px] muted">{s.duration} min{s.distance ? ` · ${s.distance}${SPORT_META[s.sport]?.distUnit || ''}` : ''}</p>
                    </div>
                    {s.zone && <span className="pill" style={{ background: (ZONE_COLORS[s.zone] || '#999') + '1A', color: ZONE_COLORS[s.zone] }}>{s.zone}</span>}
                    {isDone ? <span className="pill pill-good"><Icon name="check" size={12} /> Fait</span>
                      : past ? <span className="pill pill-bad">Manqué</span> : <span className="pill pill-neutral">À venir</span>}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="card p-5 self-start">
        <div className="flex items-center justify-between mb-3">
          <p className="card-title">Tous les plans</p>
          <button className="btn btn-soft btn-sm" onClick={() => navigate(`/athletes/${athleteId}/builder`)}><Icon name="plus" size={14} /> Nouveau</button>
        </div>
        {plans.map(p => (
          <div key={p.id} className="py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <p className="font-bold text-[13px] flex-1 truncate">{p.event_name || DISCIPLINE_LABELS[p.discipline]}</p>
              {p.is_active && <span className="pill pill-good" style={{ height: 20, fontSize: 11 }}>Actif</span>}
            </div>
            <p className="text-[12px] muted">{planWeeks(p).length} sem. · créé {relTime(p.created_at)}</p>
            <div className="flex gap-3 mt-1.5 text-[12px] font-bold">
              {p.athlete_metrics?.coachId === coachId && <button style={{ color: 'var(--red)' }} onClick={() => navigate(`/athletes/${athleteId}/builder?planId=${p.id}`)}>Modifier</button>}
              {p.athlete_metrics?.coachId === coachId && <button className="muted" onClick={() => remove(p)}>Supprimer</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function AthleteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state: navState } = useLocation()
  const { coach } = useAuth()
  const { club } = useClub()
  const [tab, setTab] = useState('overview')
  const [d, setD] = useState(null)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    const [{ data: profile }, { data: plans }, activities, { data: notes }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('plans').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      fetchActivities(id),
      supabase.from('coach_notes').select('*').eq('athlete_id', id).eq('coach_id', coach.id).order('created_at', { ascending: false }).limit(5),
    ])
    let member = null, bookings = []
    if (club) {
      const [{ data: m }, { data: b }] = await Promise.all([
        supabase.from('club_members').select('*, group:group_id(id, name, color)').eq('club_id', club.id).eq('user_id', id).maybeSingle(),
        supabase.from('club_bookings').select('id, attended, status, session:session_id(id, title, starts_at, club_id, sport)').eq('user_id', id).eq('status', 'booked'),
      ])
      member = m
      bookings = (b || []).filter(x => x.session?.club_id === club.id).sort((a, c) => c.session.starts_at.localeCompare(a.session.starts_at))
    }
    setD({ profile, plans: plans || [], activities, notes: notes || [], member, bookings })
  }, [id, coach.id, club?.id])

  useEffect(() => { load() }, [load, navState?.refresh])

  async function addNote() {
    if (!note.trim()) return
    await supabase.from('coach_notes').insert({ athlete_id: id, coach_id: coach.id, note: note.trim() })
    setNote('')
    load()
  }

  if (!d) return <Page><Spinner full /></Page>
  const { profile: a, plans, activities, notes, member, bookings } = d
  const active = plans.find(p => p.is_active) || plans[0]
  const pbs = active?.pbs || {}
  const vma = active?.zones?.run?.vma
  const c = compliance(active)
  const load6 = weeklyLoad(activities)
  const loadNow = load6[5]?.tss || 0, loadPrev = load6[4]?.tss || 0
  const loadDelta = loadPrev ? Math.round(((loadNow - loadPrev) / loadPrev) * 100) : null
  const pastBookings = bookings.filter(b => new Date(b.session.starts_at) < new Date())
  const marked = pastBookings.filter(b => b.attended != null)
  const presence = marked.length ? Math.round(marked.filter(b => b.attended).length / marked.length * 100) : null
  const nextBooking = bookings.filter(b => new Date(b.session.starts_at) > new Date()).pop()
  const j = active?.goal_date ? daysUntil(active.goal_date) : null
  const metrics = [['FTP', pbs.ftp && `${pbs.ftp}W`, 'bike'], ['CSS', pbs.css && `${pbs.css}/100m`, 'swim'], ['VMA', vma, 'run'], ['5K', pbs.pace5k && `${pbs.pace5k}/km`, 'run']].filter(m => m[1])
  const tabs = TABS.filter(([k]) => k !== 'presence' || club)

  return (
    <Page>
      <Header eyebrow={member?.group ? `Mes athlètes / Groupe ${member.group.name}` : 'Mes athlètes'} title={`Athlète · ${a?.full_name || ''}`} search={false} />

      <div className="card p-6 mb-5 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, var(--red-soft))' }} />
        <div className="relative flex items-center gap-5 flex-wrap">
          <Avatar name={a?.full_name} url={a?.photo_url} id={id} size={84} />
          <div className="flex-1 min-w-[260px]">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-2xl font-extrabold">{a?.full_name}</p>
              <span className="pill pill-good">● Actif</span>
              {member?.group && <GroupPill group={member.group} />}
            </div>
            <p className="text-[13px] muted mt-0.5">
              {[a?.age && `${a.age} ans`, active && `Objectif : ${active.event_name || DISCIPLINE_LABELS[active.discipline]}`, j != null && j >= 0 && `J-${j}`].filter(Boolean).join(' · ')}
            </p>
            {metrics.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {metrics.map(([k, v, s]) => (
                  <span key={k} className="pill" style={{ height: 30, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: SPORT_META[s].color }} /> {k} <b style={{ color: 'var(--text1)' }}>{v}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => navigate(`/messages/${id}`)}><Icon name="message" size={16} /> Message</button>
            <button className="btn btn-primary" onClick={() => setTab('plan')}><Icon name="list" size={16} /> {plans.length ? 'Voir le plan' : 'Créer un plan'}</button>
          </div>
        </div>
      </div>

      <div className="flex gap-7 mb-5" style={{ borderBottom: '1px solid var(--border)' }}>
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`tab ${tab === k ? 'tab-on' : ''}`}>{l}</button>)}
        <button onClick={() => navigate(`/messages/${id}`)} className="tab">Messages</button>
      </div>

      {tab === 'overview' && (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr) minmax(0,1fr)' }}>
          <div className="flex flex-col gap-5">
            <div className="card p-5">
              <div className="flex items-center justify-between"><p className="card-title">Charge d'entraînement</p><span className="text-[12px] muted">TSS · 6 sem.</span></div>
              <div className="flex items-end justify-between mt-3 mb-2">
                <p><span className="text-[34px] font-extrabold">{loadNow}</span> <span className="text-[13px] muted">TSS cette semaine</span></p>
                {loadDelta != null && <span className="text-[13px] font-bold" style={{ color: loadDelta >= 0 ? 'var(--good)' : 'var(--warn)' }}>{loadDelta >= 0 ? '+' : ''}{loadDelta}%</span>}
              </div>
              <AreaChart points={load6.map(w => w.tss)} labels={load6.map(w => w.ws.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))} format={v => `${v} TSS`} />
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4"><p className="card-title">Conformité au plan</p><span className="text-[12px] muted">30 derniers jours</span></div>
              {c ? (
                <div className="flex items-center gap-6">
                  <Ring pct={c.pct} label="réalisées" />
                  <div className="flex flex-col gap-2 text-[13px] flex-1">
                    <div className="flex justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--red)' }} />Réalisées</span><b>{c.completed}</b></div>
                    <div className="flex justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--surface3)', border: '1px solid var(--border-strong)' }} />Manquées</span><b>{c.missed}</b></div>
                  </div>
                </div>
              ) : <p className="text-sm muted">Pas de séance prévue sur la période.</p>}
            </div>
          </div>

          <div className="card p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="card-title">Activités récentes</p>
              <div className="flex gap-1">{[...new Set(activities.map(x => x.source))].slice(0, 3).map(s => <SourceBadge key={s} source={s} />)}</div>
            </div>
            {activities.length === 0 && <p className="text-sm muted">Aucune activité synchronisée (Strava, Garmin ou Santé).</p>}
            <div className="flex flex-col gap-2.5">{activities.slice(0, 5).map(x => <ActivityRow key={x.external_id} a={x} />)}</div>
            {activities[0] && <p className="text-[12px] muted mt-auto pt-4 flex items-center gap-1.5"><Icon name="link" size={13} /> Dernière synchro {relTime(activities[0].date)}</p>}
          </div>

          <div className="flex flex-col gap-5">
            {club && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3"><p className="card-title">Présence aux séances</p>{presence != null && <b style={{ color: 'var(--red)' }}>{presence}%</b>}</div>
                {pastBookings.length === 0 && <p className="text-sm muted">Aucune séance du club pour l'instant.</p>}
                {pastBookings.slice(0, 4).map(b => (
                  <div key={b.id} className="flex items-center gap-3 py-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={b.attended === false ? { background: 'var(--bad-soft)', color: 'var(--bad)' } : b.attended ? { background: 'var(--good-soft)', color: 'var(--good)' } : { background: 'var(--surface3)', color: 'var(--text3)' }}>
                      <Icon name={b.attended === false ? 'x' : b.attended ? 'check' : 'clock'} size={14} />
                    </div>
                    <div className="flex-1 min-w-0"><p className="text-[13px] font-bold truncate">{b.session.title}</p><p className="text-[12px] muted">{fmtDay(b.session.starts_at)}</p></div>
                    <span className="text-[12px] font-bold" style={{ color: b.attended === false ? 'var(--bad)' : b.attended ? 'var(--good)' : 'var(--text3)' }}>
                      {b.attended === false ? 'Absent' : b.attended ? 'Présent' : 'Non pointé'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {nextBooking && (
              <div className="rounded-[20px] p-4 flex items-center gap-3" style={{ background: 'var(--red-soft)', border: '1px solid #EBC3C7' }}>
                <SportBadge sport={nextBooking.session.sport} size={38} />
                <div><p className="eyebrow" style={{ fontSize: 10 }}>Prochaine résa</p><p className="font-extrabold">{nextBooking.session.title} · {fmtDay(nextBooking.session.starts_at, { weekday: 'short' })} {fmtTime(nextBooking.session.starts_at)}</p></div>
              </div>
            )}
            <div className="card p-5 flex-1">
              <p className="card-title mb-3">Notes coach</p>
              <textarea className="input" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Ex : surveiller la récup avant le fractionné de mercredi…" />
              <button className="btn btn-soft btn-sm mt-2" onClick={addNote} disabled={!note.trim()}>Ajouter la note</button>
              <p className="text-[11px] muted mt-2">Visibles par l'athlète dans son app, onglet Coach.</p>
              {notes.map(n => (
                <div key={n.id} className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-[13px] leading-relaxed ink2">{n.note}</p>
                  <p className="text-[11px] muted mt-1">{relTime(n.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'plan' && <PlanTab athleteId={id} plans={plans} coachId={coach.id} onDeleted={load} />}

      {tab === 'activities' && (
        activities.length === 0
          ? <Empty icon="trend" title="Aucune activité" text="L'athlète n'a pas encore connecté Strava, Garmin ou Santé dans l'app." />
          : <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{activities.map(x => <ActivityRow key={x.external_id} a={x} />)}</div>
      )}

      {tab === 'presence' && (
        <div className="card overflow-hidden">
          <table className="table">
            <thead style={{ background: 'var(--surface2)' }}><tr><th>Séance</th><th>Date</th><th>Présence</th></tr></thead>
            <tbody>
              {bookings.length === 0 && <tr><td colSpan={3} className="text-center py-10 muted">Aucune réservation.</td></tr>}
              {bookings.map(b => {
                const future = new Date(b.session.starts_at) > new Date()
                return (
                  <tr key={b.id}>
                    <td><div className="flex items-center gap-3"><SportBadge sport={b.session.sport} size={32} /><span className="font-bold">{b.session.title}</span></div></td>
                    <td className="text-[13px] ink2">{fmtDay(b.session.starts_at)} · {fmtTime(b.session.starts_at)}</td>
                    <td>{future ? <span className="pill pill-neutral">Réservé</span> : b.attended ? <span className="pill pill-good">Présent</span> : b.attended === false ? <span className="pill pill-bad">Absent</span> : <span className="pill pill-neutral">Non pointé</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  )
}
