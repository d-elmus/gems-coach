import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../../components/Layout'
import { Avatar, Icon, Page, Spinner, Modal, Field } from '../../components/ui'
import { useClub } from '../../context/ClubContext'
import { supabase } from '../../lib/supabase'
import { fetchMembers, fetchLastActivity, membershipStatus, memberName, relTime, fmtDay, fmtTime, ROLE_LABELS } from '../../lib/clubData'

const PAGE = 10

function Filter({ label, value, onChange, options }) {
  return (
    <select className="input" style={{ width: 'auto', minWidth: 130, borderRadius: 999, fontWeight: 600 }} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{label}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

export function GroupPill({ group }) {
  if (!group) return <span className="text-[13px] muted">—</span>
  const c = group.color || '#9A8B72'
  return <span className="pill" style={{ background: c + '1A', color: c }}>{group.name}</span>
}

export function StatusPill({ member }) {
  const s = membershipStatus(member)
  return <span className={`pill pill-${s.tone}`}>● {s.label}</span>
}

// ─── Invitation ─────────────────────────────────────────────────────────────
export function InviteModal({ onClose, onDone, defaultRole = 'athlete' }) {
  const { club, groups } = useClub()
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState(defaultRole)
  const [groupId, setGroupId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const list = emails.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(e => /.+@.+\..+/.test(e))

  async function submit() {
    if (!list.length) { setError('Ajoute au moins un email valide.'); return }
    setSaving(true)
    const roles = role === 'coach' ? ['coach'] : role === 'admin' ? ['admin', 'coach'] : [role]
    const { error: err } = await supabase.from('club_members').insert(list.map(email => ({
      club_id: club.id, invite_email: email, roles, status: 'invited', group_id: groupId || null,
    })))
    setSaving(false)
    if (err) { setError(err.code === '23505' ? 'Un de ces emails est déjà invité.' : err.message); return }
    onDone()
  }

  function copyCode() {
    navigator.clipboard?.writeText(club.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Modal eyebrow={club.name} title="Inviter des membres" onClose={onClose}
      footer={<>
        {error && <p className="text-sm mr-auto" style={{ color: 'var(--bad)' }}>{error}</p>}
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving || !list.length}>
          {saving ? 'Envoi…' : `Inviter ${list.length || ''} ${list.length > 1 ? 'personnes' : 'personne'}`}
        </button>
      </>}>
      <div className="card-soft p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="font-bold text-sm">Code club à partager</p>
          <p className="text-[13px] muted">Les licenciés le saisissent dans l'app GEMS pour rejoindre le club.</p>
        </div>
        <button onClick={copyCode} className="display text-xl px-4 h-11 rounded-xl flex items-center gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--red)' }}>
          {club.invite_code} <Icon name={copied ? 'check' : 'copy'} size={15} />
        </button>
      </div>
      <Field label="Emails" hint="Un ou plusieurs, séparés par des virgules ou des retours à la ligne. La personne est rattachée au club dès qu'elle se connecte avec cet email.">
        <textarea className="input" rows={4} value={emails} onChange={e => setEmails(e.target.value)} placeholder={'pauline@mail.fr\nhugo@mail.fr'} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rôle">
          <select className="input" value={role} onChange={e => setRole(e.target.value)}>
            <option value="athlete">Athlète</option>
            <option value="coach">Coach</option>
            <option value="admin">Admin (+ coach)</option>
            <option value="bureau">Bureau</option>
            <option value="benevole">Bénévole</option>
            <option value="parent">Parent</option>
          </select>
        </Field>
        <Field label="Groupe">
          <select className="input" value={groupId} onChange={e => setGroupId(e.target.value)}>
            <option value="">Aucun</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  )
}

// ─── Panneau membre ─────────────────────────────────────────────────────────
function MemberPanel({ member: m, onClose, onChanged }) {
  const { club, groups, staff } = useClub()
  const navigate = useNavigate()
  const [extra, setExtra] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!m.user_id) { setExtra({}); return }
    (async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString()
      const [{ data: bookings }, { data: plan }] = await Promise.all([
        supabase.from('club_bookings').select('attended, status, session:session_id(title, starts_at, club_id)').eq('user_id', m.user_id).eq('status', 'booked'),
        supabase.from('plans').select('pbs, zones').eq('user_id', m.user_id).eq('is_active', true).maybeSingle(),
      ])
      const mine = (bookings || []).filter(b => b.session?.club_id === club.id)
      const recent = mine.filter(b => b.session.starts_at >= since && new Date(b.session.starts_at) < new Date())
      const marked = recent.filter(b => b.attended != null)
      const next = mine.filter(b => new Date(b.session.starts_at) > new Date()).sort((a, b) => a.session.starts_at.localeCompare(b.session.starts_at))[0]
      setExtra({
        presence: marked.length ? Math.round(marked.filter(b => b.attended).length / marked.length * 100) : null,
        sessions: recent.filter(b => b.attended).length,
        next: next?.session,
        pbs: plan?.pbs || {},
        vma: plan?.zones?.run?.vma,
      })
    })()
  }, [m.id])

  async function update(patch) {
    setSaving(true)
    await supabase.from('club_members').update(patch).eq('id', m.id)
    setSaving(false)
    onChanged()
  }
  async function assignCoach(coachId) {
    setSaving(true)
    const { error } = await supabase.rpc('assign_club_coach', { p_member: m.id, p_coach: coachId || null })
    setSaving(false)
    if (error) alert(error.message)
    onChanged()
  }
  function toggleRole(r) {
    const roles = m.roles?.includes(r) ? m.roles.filter(x => x !== r) : [...(m.roles || []), r]
    if (roles.length) update({ roles })
  }
  async function remove() {
    if (!window.confirm(`Retirer ${memberName(m)} du club ?`)) return
    await supabase.from('club_members').delete().eq('id', m.id)
    onClose(); onChanged()
  }

  const metrics = extra && [
    ['FTP', extra.pbs?.ftp && `${extra.pbs.ftp}W`],
    ['CSS', extra.pbs?.css && `${extra.pbs.css}/100m`],
    ['VMA', extra.vma],
    ['5K', extra.pbs?.pace5k && `${extra.pbs.pace5k}/km`],
  ].filter(([, v]) => v)

  return (
    <div className="card w-[340px] flex-shrink-0 self-start sticky top-6 overflow-hidden fade-up">
      <div className="relative h-20" style={{ background: 'linear-gradient(120deg, var(--red-soft), transparent)' }}>
        <button onClick={onClose} className="absolute right-3 top-3 btn btn-ghost btn-icon" style={{ width: 34, height: 34 }} aria-label="Fermer"><Icon name="x" size={15} /></button>
      </div>
      <div className="px-6 -mt-10 pb-6">
        <Avatar name={memberName(m)} url={m.profile?.photo_url} id={m.user_id || m.id} size={76} ring />
        <p className="text-xl font-extrabold mt-3">{memberName(m)}</p>
        <p className="text-[13px] muted">
          {[m.profile?.age && `${m.profile.age} ans`, `Membre depuis ${new Date(m.joined_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`].filter(Boolean).join(' · ')}
        </p>
        <div className="flex gap-2 mt-3 flex-wrap"><GroupPill group={m.group} /><StatusPill member={m} /></div>

        <div className="mt-5 flex flex-col text-[13px]">
          <Row label="Coach référent">
            <select className="input" style={{ height: 34, width: 160, fontSize: 13 }} disabled={saving || !m.user_id} value={m.coach_id || ''} onChange={e => assignCoach(e.target.value)}>
              <option value="">Aucun</option>
              {staff.map(s => <option key={s.user_id} value={s.user_id}>{s.profile?.full_name}</option>)}
            </select>
          </Row>
          <Row label="Groupe">
            <select className="input" style={{ height: 34, width: 160, fontSize: 13 }} disabled={saving} value={m.group_id || ''} onChange={e => update({ group_id: e.target.value || null })}>
              <option value="">Aucun</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Row>
          <Row label="Adhésion jusqu'au">
            <input type="date" className="input" style={{ height: 34, width: 160, fontSize: 13 }} value={m.membership_until || ''} onChange={e => update({ membership_until: e.target.value || null })} />
          </Row>
          <Row label="Présence (30 j)">
            <b>{extra ? (extra.presence != null ? `${extra.presence}% · ${extra.sessions} séances` : '—') : '…'}</b>
          </Row>
          <Row label="Prochaine résa">
            <b className="text-right">{extra?.next ? `${extra.next.title} · ${fmtDay(extra.next.starts_at, { weekday: 'short' })} ${fmtTime(extra.next.starts_at)}` : '—'}</b>
          </Row>
        </div>

        <div className="mt-4">
          <p className="label">Rôles</p>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(ROLE_LABELS).map(([r, l]) => (
              <button key={r} onClick={() => toggleRole(r)} className={`chip ${m.roles?.includes(r) ? 'chip-on' : ''}`} style={{ height: 28, fontSize: 12, padding: '0 10px' }}>{l}</button>
            ))}
          </div>
        </div>

        {metrics?.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-5">
            {metrics.map(([k, v]) => (
              <div key={k} className="card-soft px-3 py-2.5"><p className="text-[11px] muted font-bold">{k}</p><p className="font-extrabold">{v}</p></div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 mt-6">
          {m.user_id && <button className="btn btn-primary" onClick={() => navigate(`/athletes/${m.user_id}`)}><Icon name="trend" size={16} /> Voir le suivi</button>}
          {m.user_id && <button className="btn btn-ghost" onClick={() => navigate(`/messages/${m.user_id}`)}><Icon name="message" size={16} /> Envoyer un message</button>}
          <button className="text-[13px] font-semibold mt-1" style={{ color: 'var(--bad)' }} onClick={remove}>Retirer du club</button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5" style={{ borderTop: '1px solid var(--border)' }}>
      <span className="muted">{label}</span>{children}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function Members() {
  const { club, groups, staff, reload } = useClub()
  const [params] = useSearchParams()
  const [members, setMembers] = useState(null)
  const [lastAct, setLastAct] = useState({})
  const [q, setQ] = useState(params.get('q') || '')
  const [group, setGroup] = useState('')
  const [coachF, setCoachF] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async () => {
    const { data } = await fetchMembers(club.id)
    setMembers(data)
    setLastAct(await fetchLastActivity(data.map(m => m.user_id).filter(Boolean)))
  }, [club.id])

  useEffect(() => { load() }, [load])
  useEffect(() => { setQ(params.get('q') || '') }, [params])
  useEffect(() => { setPage(0) }, [q, group, coachF, status])

  const filtered = useMemo(() => (members || []).filter(m => {
    const text = `${memberName(m)} ${m.profile?.email || ''} ${m.invite_email || ''}`.toLowerCase()
    if (q && !text.includes(q.toLowerCase())) return false
    if (group && m.group_id !== group) return false
    if (coachF && m.coach_id !== coachF) return false
    if (status && membershipStatus(m).tone !== status) return false
    return true
  }), [members, q, group, coachF, status])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE)
  const selected = members?.find(m => m.id === selectedId)
  const athleteCount = (members || []).filter(m => m.roles?.includes('athlete')).length

  return (
    <Page wide>
      <Header eyebrow={club.name} title={<>Membres <span className="muted font-bold">· {athleteCount}</span></>} search={false}>
        <button className="btn btn-primary" onClick={() => setInviting(true)}><Icon name="plus" size={16} /> Inviter</button>
      </Header>

      <div className="flex gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Icon name="search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 muted" />
              <input className="input" style={{ paddingLeft: 42, borderRadius: 999 }} placeholder="Rechercher un athlète, un email…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <Filter label="Groupe" value={group} onChange={setGroup} options={groups.map(g => [g.id, g.name])} />
            <Filter label="Coach" value={coachF} onChange={setCoachF} options={staff.map(s => [s.user_id, s.profile?.full_name || 'Coach'])} />
            <Filter label="Statut" value={status} onChange={setStatus} options={[['good', 'Active'], ['warn', 'Expire bientôt'], ['bad', 'Expirée / inactive'], ['neutral', 'Invité']]} />
          </div>

          <div className="card overflow-hidden">
            {members === null ? <div className="py-16 flex justify-center"><Spinner /></div> : (
              <>
                <table className="table">
                  <thead style={{ background: 'var(--surface2)' }}>
                    <tr><th>Membre</th><th>Groupe</th><th>Coach assigné</th><th>Adhésion</th><th>Dernière activité</th></tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-12 muted">
                        {members.length === 0 ? 'Aucun membre. Clique sur « Inviter » pour commencer.' : 'Aucun résultat.'}
                      </td></tr>
                    )}
                    {rows.map(m => (
                      <tr key={m.id} onClick={() => setSelectedId(m.id)} className="cursor-pointer"
                        style={selectedId === m.id ? { background: 'var(--red-soft)' } : undefined}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar name={memberName(m)} url={m.profile?.photo_url} id={m.user_id || m.id} size={38} />
                            <div className="min-w-0">
                              <p className="font-bold truncate">{memberName(m)}</p>
                              <p className="text-[12px] muted truncate">
                                {m.profile?.email || (m.invite_email && 'Invitation envoyée')}
                                {m.roles?.filter(r => r !== 'athlete').map(r => ` · ${ROLE_LABELS[r]}`).join('')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td><GroupPill group={m.group} /></td>
                        <td>
                          {m.coach
                            ? <div className="flex items-center gap-2"><Avatar name={m.coach.full_name} url={m.coach.photo_url} id={m.coach.id} size={24} /><span className="text-[13px]">{m.coach.full_name}</span></div>
                            : <span className="text-[13px] muted">—</span>}
                        </td>
                        <td><StatusPill member={m} /></td>
                        <td className="text-[13px] ink2">{lastAct[m.user_id] ? relTime(lastAct[m.user_id]) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-[13px] muted">{filtered.length ? `${page * PAGE + 1}–${Math.min(filtered.length, (page + 1) * PAGE)} sur ${filtered.length}` : '0 membre'}</p>
                  {pages > 1 && (
                    <div className="flex gap-1">
                      {Array.from({ length: pages }, (_, i) => i).filter(i => i < 3 || i === pages - 1 || Math.abs(i - page) <= 1).map((i, k, arr) => (
                        <span key={i} className="flex gap-1">
                          {k > 0 && i - arr[k - 1] > 1 && <span className="px-1 muted">…</span>}
                          <button onClick={() => setPage(i)} className="w-8 h-8 rounded-lg text-[13px] font-bold"
                            style={page === i ? { background: 'var(--red-soft)', color: 'var(--red)' } : { color: 'var(--text2)' }}>{i + 1}</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {selected && <MemberPanel key={selected.id} member={selected} onClose={() => setSelectedId(null)} onChanged={() => { load(); reload() }} />}
      </div>

      {inviting && <InviteModal onClose={() => setInviting(false)} onDone={() => { setInviting(false); load(); reload() }} />}
    </Page>
  )
}
