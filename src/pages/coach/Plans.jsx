import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/Layout'
import { Avatar, Icon, Page, Spinner, Empty, Meter } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { planWeeks, compliance, currentWeekIdx } from '../../lib/coachData'
import { relTime } from '../../lib/clubData'
import { daysUntil } from '../../lib/dateUtils'
import { DISCIPLINE_LABELS, PHASE_COLORS } from '../../lib/planHelpers'

export default function Plans() {
  const { coach } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    (async () => {
      const { data: rel } = await supabase.from('coach_athletes')
        .select('athlete:athlete_id(id, full_name, photo_url)').eq('coach_id', coach.id).eq('status', 'active')
      const athletes = Object.fromEntries((rel || []).filter(r => r.athlete).map(r => [r.athlete.id, r.athlete]))
      const ids = Object.keys(athletes)
      if (!ids.length) { setPlans([]); return }
      const { data } = await supabase.from('plans')
        .select('id,user_id,event_name,discipline,is_active,start_date,goal_date,athlete_metrics,weeks,completed_sessions,created_at')
        .in('user_id', ids).order('created_at', { ascending: false })
      setPlans((data || []).filter(p => p.athlete_metrics?.coachId === coach.id).map(p => ({ ...p, athlete: athletes[p.user_id] })))
    })()
  }, [coach.id])

  const shown = (plans || []).filter(p => filter === 'all' || (filter === 'active' ? p.is_active : !p.is_active))

  return (
    <Page>
      <Header eyebrow="Espace coach" title="Plans" search={false}>
        <div className="flex gap-2">
          {[['all', 'Tous'], ['active', 'Activés'], ['draft', 'Non activés']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`chip ${filter === k ? 'chip-on' : ''}`}>{l}</button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/athletes')}><Icon name="plus" size={16} /> Nouveau plan</button>
      </Header>

      {!plans ? <Spinner full /> : shown.length === 0 ? (
        <Empty icon="list" title={plans.length ? 'Aucun plan dans ce filtre' : 'Aucun plan créé'}
          text="Choisis un athlète puis « Créer un plan ». Tu peux partir de zéro ou importer son entraînement actuel." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
          {shown.map(p => {
            const weeks = planWeeks(p)
            const cur = currentWeekIdx(p)
            const c = compliance(p)
            const j = p.goal_date ? daysUntil(p.goal_date) : null
            return (
              <button key={p.id} onClick={() => navigate(`/athletes/${p.user_id}/builder?planId=${p.id}`)} className="card p-5 text-left flex flex-col gap-4 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3">
                  <Avatar name={p.athlete?.full_name} url={p.athlete?.photo_url} id={p.user_id} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold truncate">{p.event_name || DISCIPLINE_LABELS[p.discipline]}</p>
                    <p className="text-[12px] muted truncate">{p.athlete?.full_name} · créé {relTime(p.created_at)}</p>
                  </div>
                  {p.is_active ? <span className="pill pill-good">Activé</span> : <span className="pill pill-neutral">Non activé</span>}
                </div>
                <div className="flex gap-[3px] h-2">
                  {weeks.map((w, i) => (
                    <div key={i} className="flex-1 rounded-full" style={{ background: PHASE_COLORS[w.phase] || 'var(--border)', opacity: p.is_active && i < cur ? 0.35 : 1, outline: p.is_active && i === cur ? '2px solid var(--text1)' : 'none', outlineOffset: 1 }} />
                  ))}
                </div>
                <div className="flex items-center gap-4 text-[13px]">
                  <span><b>{weeks.length}</b> <span className="muted">sem.</span></span>
                  <span><b>{weeks.reduce((a, w) => a + (w.sessions?.length || 0), 0)}</b> <span className="muted">séances</span></span>
                  {j != null && <span className="ml-auto font-bold" style={{ color: 'var(--red)' }}>{j >= 0 ? `J-${j}` : 'Terminé'}</span>}
                </div>
                {c && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1"><Meter value={c.completed} max={c.planned} tone={c.pct >= 70 ? 'good' : 'red'} /></div>
                    <span className="text-[12px] font-bold">{c.pct}% réalisé</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </Page>
  )
}
