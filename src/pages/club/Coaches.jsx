import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/Layout'
import { Avatar, Icon, Page, Spinner, Empty, ErrorNotice, Modal, Field } from '../../components/ui'
import { useClub } from '../../context/ClubContext'
import { supabase } from '../../lib/supabase'
import { fetchMembers, fetchSessions, startOfWeek, addDays, memberName, clubError, ROLE_LABELS } from '../../lib/clubData'
import { InviteModal } from './Members'

// Donner le rôle coach à un membre déjà dans le club.
function PromoteModal({ members, onClose, onDone }) {
  const [id, setId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const candidates = members.filter(m => m.user_id && m.status === 'active' && !m.roles?.includes('coach'))
    .sort((a, b) => memberName(a).localeCompare(memberName(b), 'fr'))

  async function submit() {
    const m = candidates.find(x => x.id === id)
    if (!m) return
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('club_members').update({ roles: [...(m.roles || []), 'coach'] }).eq('id', m.id)
    setSaving(false)
    if (err) { setError(clubError(err)); return }
    onDone()
  }

  return (
    <Modal eyebrow="Coachs" title="Nommer un coach" onClose={onClose}
      footer={<>
        {error && <p className="text-sm mr-auto" style={{ color: 'var(--bad)' }}>{error}</p>}
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving || !id}>{saving ? 'Enregistrement…' : 'Donner le rôle coach'}</button>
      </>}>
      <Field label="Membre du club" hint="Il garde ses autres rôles et accède au portail (espace coach) à sa prochaine connexion.">
        <select className="input" value={id} onChange={e => setId(e.target.value)}>
          <option value="">Choisir un membre…</option>
          {candidates.map(m => (
            <option key={m.id} value={m.id}>{memberName(m)} · {(m.roles || []).map(r => ROLE_LABELS[r] || r).join(', ')}</option>
          ))}
        </select>
      </Field>
      {candidates.length === 0 && <p className="text-sm muted">Tous les membres actifs sont déjà coachs. Invite un nouveau coach par email.</p>}
    </Modal>
  )
}

export default function Coaches() {
  const { club, reload } = useClub()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [members, setMembers] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [inviting, setInviting] = useState(false)
  const [promoting, setPromoting] = useState(false)

  const load = useCallback(async () => {
    const ws = startOfWeek()
    const [{ data: all, error: e1 }, { data: sessions, error: e2 }] = await Promise.all([
      fetchMembers(club.id),
      fetchSessions(club.id, ws, addDays(ws, 7)),
    ])
    setLoadError(e1 || e2)
    if (e1 || e2) return
    setMembers(all)
    const coaches = all.filter(m => m.roles?.includes('coach'))
    setData(coaches.map(c => {
      const mine = sessions.filter(s => s.coach_id === c.user_id)
      return {
        ...c,
        athletes: all.filter(m => m.coach_id && m.coach_id === c.user_id),
        collective: mine.filter(s => s.kind === 'collective').length,
        slots: mine.filter(s => s.kind === 'one_on_one'),
        hours: Math.round(mine.filter(s => s.kind === 'collective' || s.booked.length).reduce((a, s) => a + s.duration_min, 0) / 6) / 10,
      }
    }))
  }, [club.id])

  useEffect(() => { load() }, [load])

  // Retire le rôle coach : ses athlètes perdent leur coach référent (relation de coaching retirée).
  async function removeCoachRole(c) {
    const n = c.athletes.length
    const msg = `Retirer le rôle coach à ${memberName(c)} ?` +
      (n ? `\n${n} athlète${n > 1 ? 's' : ''} n'aur${n > 1 ? 'ont' : 'a'} plus de coach référent.` : '') +
      '\nIl reste membre du club avec ses autres rôles.'
    if (!window.confirm(msg)) return
    setBusy(c.id); setActionError(null)
    for (const a of c.athletes) {
      const { error } = await supabase.rpc('assign_club_coach', { p_member: a.id, p_coach: null })
      if (error) { setBusy(null); setActionError(clubError(error)); return }
    }
    const roles = c.roles.filter(r => r !== 'coach')
    const { error } = await supabase.from('club_members').update({ roles: roles.length ? roles : ['athlete'] }).eq('id', c.id)
    setBusy(null)
    if (error) setActionError(clubError(error))
    load(); reload()
  }

  async function cancelInvite(c) {
    if (!window.confirm(`Annuler l'invitation envoyée à ${c.invite_email} ?`)) return
    setBusy(c.id); setActionError(null)
    const { error } = await supabase.from('club_members').delete().eq('id', c.id)
    setBusy(null)
    if (error) setActionError(clubError(error))
    load(); reload()
  }

  return (
    <Page>
      <Header eyebrow={club.name} title={<>Coachs <span className="muted font-bold">· {data?.length ?? ''}</span></>} search={false}>
        <button className="btn btn-ghost" onClick={() => setPromoting(true)} disabled={!data}><Icon name="whistle" size={16} /> Nommer un membre</button>
        <button className="btn btn-primary" onClick={() => setInviting(true)}><Icon name="plus" size={16} /> Inviter un coach</button>
      </Header>

      {actionError && <div className="mb-4"><ErrorNotice compact error={actionError} /></div>}

      {!data && loadError ? <ErrorNotice error={loadError} onRetry={load} /> : !data ? <Spinner full /> : data.length === 0 ? (
        <Empty icon="whistle" title="Aucun coach dans le club" text="Invite un coach par email ou donne le rôle coach à un membre existant.">
          <button className="btn btn-primary" onClick={() => setInviting(true)}><Icon name="plus" size={16} /> Inviter un coach</button>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
          {data.map(c => (
            <div key={c.id} className="card p-6 flex flex-col gap-5" style={{ opacity: busy === c.id ? 0.6 : 1 }}>
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
              <div className="flex items-center gap-2 mt-auto pt-4 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
                {c.user_id ? (
                  <>
                    <button className="btn btn-soft btn-sm" onClick={() => navigate(`/club/members?coach=${c.user_id}`)}>
                      <Icon name="users" size={14} /> Ses athlètes{c.athletes.length ? ` (${c.athletes.length})` : ''}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/club/workouts?coach=${c.user_id}`)}>
                      <Icon name="clipboard" size={14} /> Ses séances
                    </button>
                    <span className="flex-1" />
                    <button className="text-[12px] font-semibold" style={{ color: 'var(--bad)' }} disabled={busy === c.id} onClick={() => removeCoachRole(c)}>Retirer le rôle coach</button>
                  </>
                ) : (
                  <>
                    <span className="text-[12px] muted flex-1 truncate">En attente : {c.invite_email}</span>
                    <button className="text-[12px] font-semibold" style={{ color: 'var(--bad)' }} disabled={busy === c.id} onClick={() => cancelInvite(c)}>Annuler l'invitation</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {inviting && <InviteModal defaultRole="coach" onClose={() => setInviting(false)} onDone={() => { setInviting(false); load(); reload() }} />}
      {promoting && <PromoteModal members={members} onClose={() => setPromoting(false)} onDone={() => { setPromoting(false); load(); reload() }} />}
    </Page>
  )
}
