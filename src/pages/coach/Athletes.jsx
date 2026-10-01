import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../../components/Layout'
import { Avatar, Icon, Page, Spinner, Empty, Meter } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { fetchCoachAthletes, compliance } from '../../lib/coachData'
import { fetchLastActivity, relTime } from '../../lib/clubData'
import { daysUntil } from '../../lib/dateUtils'
import { DISCIPLINE_LABELS } from '../../lib/planHelpers'

export default function Athletes() {
  const { coach } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [data, setData] = useState(null)
  const [q, setQ] = useState(params.get('q') || '')

  useEffect(() => { setQ(params.get('q') || '') }, [params])
  useEffect(() => {
    (async () => {
      const r = await fetchCoachAthletes(coach.id)
      const last = await fetchLastActivity(r.active.map(x => x.athlete.id))
      setData({ ...r, last })
    })()
  }, [coach.id])

  const rows = useMemo(() => (data?.active || [])
    .filter(r => !q || `${r.athlete.full_name} ${r.athlete.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.athlete.full_name || '').localeCompare(b.athlete.full_name || '')), [data, q])

  return (
    <Page>
      <Header eyebrow="Espace coach" title={<>Mes athlètes <span className="muted font-bold">· {data?.active.length ?? ''}</span></>} search={false}>
        <div className="relative">
          <Icon name="search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 muted" />
          <input className="input" style={{ paddingLeft: 42, borderRadius: 999, width: 280 }} placeholder="Rechercher un athlète…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </Header>

      {!data ? <Spinner full /> : data.active.length === 0 ? (
        <Empty icon="users" title="Aucun athlète pour l'instant"
          text="Les athlètes te rejoignent depuis l'app GEMS (onglet Coach), ou via ton club quand un admin te les assigne." />
      ) : (
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
      )}
    </Page>
  )
}
