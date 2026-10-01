import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../../components/Layout'
import { Avatar, Icon, Page, Spinner, Empty, Meter, ErrorNotice, FilterSelect } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useClub } from '../../context/ClubContext'
import { useLoader } from '../../lib/useLoader'
import { fetchCoachAthletes, compliance } from '../../lib/coachData'
import { fetchLastActivity, fetchClubAthletes, relTime, memberName } from '../../lib/clubData'
import { daysUntil } from '../../lib/dateUtils'
import { DISCIPLINE_LABELS } from '../../lib/planHelpers'
import { GroupPill } from '../club/Members'

// ─── Mes athlètes : coaching (coach_athletes) + plan + conformité ───────────
function MyAthletes({ q }) {
  const { coach } = useAuth()
  const navigate = useNavigate()
  const { data, error, loading, reload } = useLoader(async () => {
    const r = await fetchCoachAthletes(coach.id)
    const last = await fetchLastActivity(r.active.map(x => x.athlete.id))
    return { ...r, last }
  }, [coach.id])

  const rows = useMemo(() => (data?.active || [])
    .filter(r => !q || `${r.athlete.full_name} ${r.athlete.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.athlete.full_name || '').localeCompare(b.athlete.full_name || '')), [data, q])

  if (error && !data) return <ErrorNotice error={error} onRetry={reload} />
  if (loading && !data) return <Spinner full />
  if (data.active.length === 0) return (
    <Empty icon="users" title="Aucun athlète pour l'instant"
      text="Les athlètes te rejoignent depuis l'app GEMS (onglet Coach), ou via ton club quand un admin te les assigne." />
  )
  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead style={{ background: 'var(--surface2)' }}>
          <tr><th>Athlète</th><th>Objectif</th><th style={{ width: 220 }}>Plan réalisé (30 j)</th><th>Dernière activité</th><th /></tr>
        </thead>
        <tbody>
          {rows.map(({ id, athlete: a }) => {
            const plan = data.plans[a.id]
            const c = compliance(plan)
            const j = plan?.goal_date ? daysUntil(plan.goal_date) : null
            return (
              <tr key={id} className="cursor-pointer" onClick={() => navigate(`/athletes/${a.id}`)}>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar name={a.full_name} url={a.photo_url} id={a.id} size={40} />
                    <div className="min-w-0">
                      <p className="font-bold truncate">{a.full_name}</p>
                      <p className="text-[12px] muted truncate">{a.email}</p>
                    </div>
                  </div>
                </td>
                <td>
                  {plan ? (
                    <div>
                      <p className="text-[13px] font-bold">{plan.event_name || DISCIPLINE_LABELS[plan.discipline] || plan.discipline}</p>
                      <p className="text-[12px] muted">{j != null && j >= 0 ? `J-${j}` : 'Objectif passé'}{!plan.is_active ? ' · plan non activé' : ''}</p>
                    </div>
                  ) : <span className="text-[13px] muted">Pas de plan</span>}
                </td>
                <td>
                  {c ? (
                    <div className="flex items-center gap-3">
                      <div className="flex-1"><Meter value={c.completed} max={c.planned} tone={c.pct >= 70 ? 'good' : 'red'} /></div>
                      <span className="text-[13px] font-bold w-10 text-right">{c.pct}%</span>
                    </div>
                  ) : <span className="text-[13px] muted">—</span>}
                </td>
                <td className="text-[13px] ink2">{data.last[a.id] ? relTime(data.last[a.id]) : '—'}</td>
                <td className="text-right">
                  {!plan && (
                    <button className="btn btn-soft btn-sm" onClick={e => { e.stopPropagation(); navigate(`/athletes/${a.id}/builder`) }}>
                      <Icon name="plus" size={14} /> Créer un plan
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && <tr><td colSpan={5} className="text-center py-10 muted">Aucun résultat.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

// ─── Mon club : tous les athlètes du club, avec groupe et coach référent ────
function ClubAthletes({ q }) {
  const { coach } = useAuth()
  const { club, groups, staff } = useClub()
  const navigate = useNavigate()
  const [group, setGroup] = useState('')
  const [coachF, setCoachF] = useState('')
  const { data, error, loading, reload } = useLoader(async () => {
    const athletes = await fetchClubAthletes(club.id)
    const last = await fetchLastActivity(athletes.map(m => m.user_id))
    return { athletes, last }
  }, [club.id])

  const rows = useMemo(() => (data?.athletes || []).filter(m => {
    if (q && !`${memberName(m)} ${m.profile?.email || ''}`.toLowerCase().includes(q.toLowerCase())) return false
    if (group && (group === 'none' ? m.group_id : m.group_id !== group)) return false
    if (coachF === 'none' && m.coach_id) return false
    if (coachF && coachF !== 'none' && m.coach_id !== coachF) return false
    return true
  }), [data, q, group, coachF])

  if (error && !data) return <ErrorNotice error={error} onRetry={reload} />
  if (loading && !data) return <Spinner full />
  return (
    <>
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <FilterSelect label="Tous les groupes" value={group} onChange={setGroup} options={[...groups.map(g => [g.id, g.name]), ['none', 'Sans groupe']]} />
        <FilterSelect label="Tous les coachs" value={coachF} onChange={setCoachF} options={[...staff.map(s => [s.user_id, s.user_id === coach.id ? `${s.profile?.full_name || 'Moi'} (moi)` : s.profile?.full_name || 'Coach']), ['none', 'Sans coach référent']]} />
        <span className="text-[13px] muted">{rows.length} athlète{rows.length > 1 ? 's' : ''}</span>
      </div>
      {data.athletes.length === 0 ? (
        <Empty icon="users" title="Aucun athlète dans le club" text="Les licenciés rejoignent le club avec son code dans l'app GEMS, ou via une invitation de l'admin." />
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead style={{ background: 'var(--surface2)' }}>
              <tr><th>Athlète</th><th>Groupe</th><th>Coach référent</th><th>Dernière activité</th></tr>
            </thead>
            <tbody>
              {rows.map(m => (
                <tr key={m.id} className="cursor-pointer" onClick={() => navigate(`/athletes/${m.user_id}`)}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={memberName(m)} url={m.profile?.photo_url} id={m.user_id} size={40} />
                      <div className="min-w-0">
                        <p className="font-bold truncate">{memberName(m)}</p>
                        <p className="text-[12px] muted truncate">{m.profile?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td><GroupPill group={m.group} /></td>
                  <td>
                    {m.coach ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={m.coach.full_name} url={m.coach.photo_url} id={m.coach.id} size={24} />
                        <span className="text-[13px]">{m.coach.full_name}</span>
                        {m.coach_id === coach.id && <span className="pill pill-red" style={{ height: 20, fontSize: 11 }}>Toi</span>}
                      </div>
                    ) : <span className="text-[13px] muted">—</span>}
                  </td>
                  <td className="text-[13px] ink2">{data.last[m.user_id] ? relTime(data.last[m.user_id]) : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="text-center py-10 muted">Aucun résultat pour ces filtres.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default function Athletes() {
  const { club } = useClub()
  const [params, setParams] = useSearchParams()
  const paramQ = params.get('q') || ''
  const [q, setQ] = useState(paramQ)
  const [prevQ, setPrevQ] = useState(paramQ)
  // Recherche depuis l'en-tête (?q=) : on resynchronise le champ.
  if (paramQ !== prevQ) { setPrevQ(paramQ); setQ(paramQ) }
  const view = club && params.get('view') === 'club' ? 'club' : 'mine'

  function setView(v) {
    const next = new URLSearchParams(params)
    if (v === 'club') next.set('view', 'club'); else next.delete('view')
    setParams(next, { replace: true })
  }

  return (
    <Page>
      <Header eyebrow={view === 'club' ? club.name : 'Espace coach'} title={view === 'club' ? 'Athlètes du club' : 'Mes athlètes'} search={false}>
        {club && (
          <div className="flex gap-1 p-1 rounded-full" style={{ background: 'var(--surface3)' }}>
            {[['mine', 'Mes athlètes'], ['club', 'Mon club']].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className="h-9 px-4 rounded-full text-[13px] font-bold transition-all"
                style={view === k ? { background: 'var(--surface)', color: 'var(--red)', boxShadow: 'var(--shadow)' } : { color: 'var(--text2)' }}>
                {l}
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          <Icon name="search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 muted" />
          <input className="input" style={{ paddingLeft: 42, borderRadius: 999, width: 260 }} placeholder="Rechercher un athlète…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </Header>

      {view === 'club' ? <ClubAthletes q={q} /> : <MyAthletes q={q} />}
    </Page>
  )
}
