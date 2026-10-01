import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../../components/Layout'
import { Avatar, Icon, Page, Spinner, Modal, Field, FilterSelect as Filter, ErrorNotice } from '../../components/ui'
import { useClub } from '../../context/ClubContext'
import { supabase } from '../../lib/supabase'
import { fetchMembers, fetchLastActivity, membershipStatus, memberName, relTime, fmtDay, fmtTime, ROLE_LABELS, clubError, inviteText, REQUEST_LABELS, resolveRoleRequest } from '../../lib/clubData'
import { downloadCSV, parseCSV, headerKey, fileDate } from '../../lib/csv'

const PAGE = 10
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROLE_OPTIONS = [['athlete', 'Athlète'], ['coach', 'Coach'], ['admin', 'Admin (+ coach)'], ['bureau', 'Bureau'], ['benevole', 'Bénévole'], ['parent', 'Parent']]
const rolesFor = role => role === 'coach' ? ['coach'] : role === 'admin' ? ['admin', 'coach'] : [role]

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
    const roles = rolesFor(role)
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
            {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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

// ─── Demandes de rôle (coach / admin déclarés depuis l'app) ─────────────────
function RoleRequests({ members, onResolved, onOpen }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const list = members.filter(m => m.requested_role)
  if (!list.length) return null

  async function resolve(m, accept) {
    const label = REQUEST_LABELS[m.requested_role] || m.requested_role
    if (!accept && !window.confirm(`Refuser la demande « ${label} » de ${memberName(m)} ? Il reste membre du club comme athlète.`)) return
    setBusy(m.id); setError(null)
    const { error: err } = await resolveRoleRequest(m.id, accept)
    setBusy(null)
    if (err) { setError(clubError(err)); return }
    onResolved()
  }

  return (
    <div className="card p-5 mb-5" style={{ borderColor: '#EBC3C7', background: 'linear-gradient(180deg, var(--red-soft), var(--surface) 80%)' }}>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--red)', color: '#fff' }}><Icon name="shield" size={17} /></div>
        <div>
          <p className="card-title">Demandes de rôle <span style={{ color: 'var(--red)' }}>· {list.length}</span></p>
          <p className="text-[13px] muted">Ces membres ont rejoint le club depuis l'app en se déclarant coach ou admin. Ils restent athlètes tant que tu n'as pas validé.</p>
        </div>
      </div>
      {error && <p className="text-[13px] rounded-xl px-3 py-2 mt-3" style={{ background: 'var(--bad-soft)', color: 'var(--bad)' }}>{error}</p>}
      <div className="flex flex-col mt-2">
        {list.map(m => (
          <div key={m.id} className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid var(--border)', opacity: busy === m.id ? 0.6 : 1 }}>
            <Avatar name={memberName(m)} url={m.profile?.photo_url} id={m.user_id || m.id} size={40} />
            <button className="flex-1 min-w-0 text-left" onClick={() => onOpen(m.id)}>
              <p className="font-bold truncate hover:underline">{memberName(m)}</p>
              <p className="text-[12px] muted truncate">{m.profile?.email} · a rejoint {relTime(m.joined_at)}</p>
            </button>
            <span className="pill pill-red">Demande {(REQUEST_LABELS[m.requested_role] || m.requested_role).toLowerCase()}</span>
            <button className="btn btn-ghost btn-sm" disabled={busy === m.id} onClick={() => resolve(m, false)}>Refuser</button>
            <button className="btn btn-primary btn-sm" disabled={busy === m.id} onClick={() => resolve(m, true)}><Icon name="check" size={14} /> Accepter</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Import CSV → invitations ───────────────────────────────────────────────
const NAME_KEYS = ['nom', 'name', 'nomcomplet', 'fullname', 'prenomnom', 'athlete', 'membre']
const FIRST_KEYS = ['prenom', 'firstname']
const LAST_KEYS = ['nomdefamille', 'lastname']
const EMAIL_KEYS = ['email', 'mail', 'courriel', 'adresseemail', 'adressemail']
const GROUP_KEYS = ['groupe', 'group', 'section', 'categorie']

// Lit les lignes : en-têtes reconnus (nom / email / groupe), sinon colonne email devinée.
function readImport(rows) {
  if (!rows.length) return []
  const head = rows[0].map(headerKey)
  const idx = keys => head.findIndex(h => keys.includes(h))
  let iEmail = idx(EMAIL_KEYS)
  const hasHeader = iEmail !== -1 || idx(NAME_KEYS) !== -1
  const body = hasHeader ? rows.slice(1) : rows
  if (iEmail === -1) iEmail = (body[0] || []).findIndex(c => EMAIL_RE.test(c))
  const iName = hasHeader ? idx(NAME_KEYS) : (iEmail === 0 ? -1 : 0)
  const iFirst = hasHeader ? idx(FIRST_KEYS) : -1
  const iLast = hasHeader ? idx(LAST_KEYS) : -1
  const iGroup = hasHeader ? idx(GROUP_KEYS) : (body[0]?.length > 2 ? 2 : -1)
  return body.map(r => ({
    name: iName >= 0 ? r[iName] : [r[iFirst], r[iLast]].filter(Boolean).join(' '),
    email: (iEmail >= 0 ? r[iEmail] || '' : '').toLowerCase(),
    group: iGroup >= 0 ? r[iGroup] || '' : '',
  }))
}

function ImportModal({ members, onClose, onDone }) {
  const { club, groups } = useClub()
  const [rows, setRows] = useState(null)
  const [fileName, setFileName] = useState('')
  const [role, setRole] = useState('athlete')
  const [createGroups, setCreateGroups] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setResult(null); setFileName(file.name)
    try { setRows(readImport(parseCSV(await file.text()))) } catch { setError('Fichier illisible. Exporte-le en CSV (UTF-8) depuis Excel ou Google Sheets.') }
  }

  const known = useMemo(() => new Set(members.flatMap(m => [m.profile?.email, m.invite_email]).filter(Boolean).map(e => e.toLowerCase())), [members])
  const groupByName = useMemo(() => Object.fromEntries(groups.map(g => [g.name.trim().toLowerCase(), g])), [groups])
  const checked = useMemo(() => {
    const seen = new Set()
    return (rows || []).map(r => {
      let status = 'ok'
      if (!EMAIL_RE.test(r.email)) status = 'invalid'
      else if (known.has(r.email)) status = 'member'
      else if (seen.has(r.email)) status = 'duplicate'
      seen.add(r.email)
      const g = r.group ? groupByName[r.group.trim().toLowerCase()] : null
      return { ...r, status, groupMatch: g, newGroup: r.group && !g ? r.group.trim() : null }
    })
  }, [rows, known, groupByName])
  const valid = checked.filter(r => r.status === 'ok')
  const missingGroups = [...new Set(valid.map(r => r.newGroup).filter(Boolean))]

  async function submit() {
    setSaving(true); setError(null)
    // Groupes absents du club : créés à la volée (option), sinon import sans groupe.
    const created = {}
    if (createGroups && missingGroups.length) {
      const palette = ['#9E1B2B', '#0E9AAE', '#A0407A', '#C9731A', '#2F8F3E', '#6B4FB0']
      const { data, error: gErr } = await supabase.from('club_groups')
        .insert(missingGroups.map((name, i) => ({ club_id: club.id, name, color: palette[(groups.length + i) % palette.length] }))).select('id, name')
      if (gErr) { setSaving(false); setError(clubError(gErr)); return }
      for (const g of data || []) created[g.name.toLowerCase()] = g.id
    }
    const payload = valid.map(r => ({
      club_id: club.id, invite_email: r.email, roles: rolesFor(role), status: 'invited',
      group_id: r.groupMatch?.id || (r.newGroup && created[r.newGroup.toLowerCase()]) || null,
    }))
    let ok = 0, failed = 0
    const { error: err } = await supabase.from('club_members').insert(payload)
    if (!err) ok = payload.length
    else {
      // Un conflit fait échouer tout le lot : on repasse ligne par ligne.
      for (const row of payload) {
        const { error: e1 } = await supabase.from('club_members').insert(row)
        if (e1) failed++; else ok++
      }
    }
    setSaving(false)
    setResult({ ok, failed })
    if (ok) onDone(false)
  }

  const STATUS = {
    ok: ['pill-good', 'À inviter'], invalid: ['pill-bad', 'Email invalide'],
    member: ['pill-neutral', 'Déjà dans le club'], duplicate: ['pill-neutral', 'Doublon'],
  }

  return (
    <Modal eyebrow={club.name} title="Importer des membres (CSV)" onClose={() => onClose(!!result?.ok)} width={720}
      footer={result ? (
        <>
          <p className="text-sm mr-auto" style={{ color: result.failed ? 'var(--warn)' : 'var(--good)' }}>
            {result.ok} invitation{result.ok > 1 ? 's' : ''} créée{result.ok > 1 ? 's' : ''}{result.failed ? ` · ${result.failed} en échec (déjà invités ?)` : ''}.
          </p>
          <button className="btn btn-primary" onClick={() => onClose(true)}>Terminer</button>
        </>
      ) : (
        <>
          {error && <p className="text-sm mr-auto" style={{ color: 'var(--bad)' }}>{error}</p>}
          <button className="btn btn-ghost" onClick={() => onClose(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !valid.length}>
            {saving ? 'Import…' : `Inviter ${valid.length} personne${valid.length > 1 ? 's' : ''}`}
          </button>
        </>
      )}>
      <div className="card-soft p-4 text-[13px] ink2 leading-relaxed">
        Colonnes reconnues : <b>nom</b> (ou prénom + nom), <b>email</b>, <b>groupe</b>. Séparateur « ; » ou « , ». Chaque ligne crée une invitation :
        la personne est rattachée au club dès qu'elle se connecte à GEMS avec cet email. Le nom sert à l'aperçu — le nom affiché viendra de son compte.
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="btn btn-ghost cursor-pointer">
          <Icon name="upload" size={16} /> {fileName ? 'Changer de fichier' : 'Choisir un fichier CSV'}
          <input type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={onFile} />
        </label>
        {fileName && <span className="text-[13px] muted truncate">{fileName} · {checked.length} ligne{checked.length > 1 ? 's' : ''}</span>}
      </div>

      {rows && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rôle des personnes importées">
              <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            {missingGroups.length > 0 && (
              <Field label="Groupes inconnus">
                <label className="flex items-center gap-2 h-11 text-[13px] cursor-pointer">
                  <input type="checkbox" checked={createGroups} onChange={e => setCreateGroups(e.target.checked)} style={{ accentColor: 'var(--red)', width: 16, height: 16 }} />
                  Créer {missingGroups.join(', ')}
                </label>
              </Field>
            )}
          </div>
          {checked.length === 0 ? <p className="text-sm muted">Aucune ligne trouvée dans ce fichier.</p> : (
            <div className="card overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto">
                <table className="table">
                  <thead style={{ background: 'var(--surface2)' }}><tr><th>Nom</th><th>Email</th><th>Groupe</th><th>Statut</th></tr></thead>
                  <tbody>
                    {checked.map((r, i) => (
                      <tr key={i}>
                        <td className="text-[13px] font-semibold">{r.name || '—'}</td>
                        <td className="text-[13px]">{r.email || <span className="muted">—</span>}</td>
                        <td className="text-[13px]">
                          {r.groupMatch ? <GroupPill group={r.groupMatch} />
                            : r.newGroup ? <span className="muted">{r.newGroup}{createGroups ? ' (nouveau)' : ' (ignoré)'}</span>
                              : <span className="muted">—</span>}
                        </td>
                        <td><span className={`pill ${STATUS[r.status][0]}`}>{STATUS[r.status][1]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

// ─── Panneau membre ─────────────────────────────────────────────────────────
function MemberPanel({ member: m, onClose, onChanged }) {
  const { club, groups, staff } = useClub()
  const navigate = useNavigate()
  const [extra, setExtra] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const invited = !m.user_id

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
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('club_members').update(patch).eq('id', m.id)
    setSaving(false)
    if (err) setError(clubError(err))
    onChanged()
  }
  async function assignCoach(coachId) {
    setSaving(true); setError(null)
    const { error: err } = await supabase.rpc('assign_club_coach', { p_member: m.id, p_coach: coachId || null })
    setSaving(false)
    if (err) setError(clubError(err))
    onChanged()
  }
  function toggleRole(r) {
    const roles = m.roles?.includes(r) ? m.roles.filter(x => x !== r) : [...(m.roles || []), r]
    if (!roles.length) { setError('Un membre garde au moins un rôle. Pour le retirer du club, utilise « Retirer du club ».'); return }
    update({ roles })
  }
  async function resolveRequest(accept) {
    setSaving(true); setError(null)
    const { error: err } = await resolveRoleRequest(m.id, accept)
    setSaving(false)
    if (err) setError(clubError(err))
    onChanged()
  }
  function saveLicense(v) {
    const value = v.trim() || null
    if (value !== (m.license_number || null)) update({ license_number: value })
  }
  async function remove() {
    const msg = invited ? `Annuler l'invitation envoyée à ${m.invite_email} ?` : `Retirer ${memberName(m)} du club ?`
    if (!window.confirm(msg)) return
    setError(null)
    const { error: err } = await supabase.from('club_members').delete().eq('id', m.id)
    if (err) { setError(clubError(err)); return }
    onClose(); onChanged()
  }
  function copyInvite() {
    navigator.clipboard?.writeText(inviteText(club, m.invite_email))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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

        {invited && (
          <div className="card-soft p-4 mt-4">
            <p className="font-bold text-sm">Invitation en attente</p>
            <p className="text-[12px] muted mt-0.5">Rattachement automatique dès que {m.invite_email} se connecte à GEMS. Relance la personne avec le texte d'invitation (code club {club.invite_code}).</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button className="btn btn-ghost btn-sm" onClick={copyInvite}><Icon name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copié' : 'Copier le texte'}</button>
              <a className="btn btn-ghost btn-sm" href={`mailto:${m.invite_email}?subject=${encodeURIComponent(`Rejoins ${club.name} sur GEMS`)}&body=${encodeURIComponent(inviteText(club, m.invite_email))}`}>
                <Icon name="mail" size={14} /> Relancer
              </a>
            </div>
          </div>
        )}

        {m.requested_role && (
          <div className="rounded-2xl p-4 mt-4" style={{ background: 'var(--red-soft)', border: '1px solid #EBC3C7' }}>
            <p className="font-bold text-sm">Demande le rôle {(REQUEST_LABELS[m.requested_role] || m.requested_role).toLowerCase()}</p>
            <p className="text-[12px] ink2 mt-0.5">Accepter lui donne accès au portail (espace coach).</p>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => resolveRequest(false)}>Refuser</button>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => resolveRequest(true)}><Icon name="check" size={14} /> Accepter</button>
            </div>
          </div>
        )}

        {error && <p className="text-[13px] rounded-xl px-3 py-2 mt-4" style={{ background: 'var(--bad-soft)', color: 'var(--bad)' }}>{error}</p>}

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
          <Row label="N° de licence">
            <input className="input" style={{ height: 34, width: 160, fontSize: 13 }} defaultValue={m.license_number || ''} placeholder="Ex : A12345C"
              onBlur={e => saveLicense(e.target.value)} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
          </Row>
          {!invited && (
            <>
              <Row label="Présence (30 j)">
                <b>{extra ? (extra.presence != null ? `${extra.presence}% · ${extra.sessions} séances` : '—') : '…'}</b>
              </Row>
              <Row label="Prochaine résa">
                <b className="text-right">{extra?.next ? `${extra.next.title} · ${fmtDay(extra.next.starts_at, { weekday: 'short' })} ${fmtTime(extra.next.starts_at)}` : '—'}</b>
              </Row>
            </>
          )}
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
          <button className="text-[13px] font-semibold mt-1" style={{ color: 'var(--bad)' }} onClick={remove}>{invited ? "Annuler l'invitation" : 'Retirer du club'}</button>
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
  const [loadError, setLoadError] = useState(null)
  const [lastAct, setLastAct] = useState({})
  const [q, setQ] = useState(params.get('q') || '')
  const [group, setGroup] = useState(params.get('group') || '')
  const [coachF, setCoachF] = useState(params.get('coach') || '')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [inviting, setInviting] = useState(false)
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await fetchMembers(club.id)
    setLoadError(error)
    if (error) return
    setMembers(data)
    setLastAct(await fetchLastActivity(data.map(m => m.user_id).filter(Boolean)))
  }, [club.id])

  useEffect(() => { load() }, [load])
  // Recherche / filtre passés dans l'URL (en-tête, page Coachs) : resynchronisés à chaque navigation.
  const paramKey = params.toString()
  const [prevKey, setPrevKey] = useState(paramKey)
  if (paramKey !== prevKey) {
    setPrevKey(paramKey)
    setQ(params.get('q') || '')
    setCoachF(params.get('coach') || '')
    setGroup(params.get('group') || '')
  }
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

  function exportCSV() {
    downloadCSV(`membres-${club.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${fileDate()}.csv`, [
      ['Nom', 'Email', 'Rôles', 'Groupe', 'Coach référent', 'Statut', "Adhésion jusqu'au", 'N° de licence', 'Membre depuis', 'Dernière activité'],
      ...filtered.map(m => [
        m.profile?.full_name || '', m.profile?.email || m.invite_email || '',
        (m.roles || []).map(r => ROLE_LABELS[r] || r).join(', '),
        m.group?.name || '', m.coach?.full_name || '', membershipStatus(m).label,
        m.membership_until || '', m.license_number || '',
        m.joined_at ? m.joined_at.slice(0, 10) : '', lastAct[m.user_id] ? String(lastAct[m.user_id]).slice(0, 10) : '',
      ]),
    ])
  }

  return (
    <Page wide>
      <Header eyebrow={club.name} title={<>Membres <span className="muted font-bold">· {athleteCount}</span></>} search={false}>
        <button className="btn btn-ghost" onClick={exportCSV} disabled={!filtered.length} title="Exporte la liste filtrée"><Icon name="download" size={16} /> Exporter</button>
        <button className="btn btn-ghost" onClick={() => setImporting(true)} disabled={!members}><Icon name="upload" size={16} /> Importer</button>
        <button className="btn btn-primary" onClick={() => setInviting(true)}><Icon name="plus" size={16} /> Inviter</button>
      </Header>

      {members && <RoleRequests members={members} onResolved={() => { load(); reload() }} onOpen={setSelectedId} />}

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
            {members === null && loadError ? <div className="p-6"><ErrorNotice compact error={loadError} onRetry={load} /></div>
              : members === null ? <div className="py-16 flex justify-center"><Spinner /></div> : (
              <>
                <table className="table">
                  <thead style={{ background: 'var(--surface2)' }}>
                    <tr><th>Membre</th><th>Groupe</th><th>Coach assigné</th><th>Adhésion</th><th>Dernière activité</th></tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-12 muted">
                        {members.length === 0 ? 'Aucun membre. Clique sur « Inviter » ou importe un fichier CSV pour commencer.' : 'Aucun résultat pour ces filtres.'}
                      </td></tr>
                    )}
                    {rows.map(m => (
                      <tr key={m.id} onClick={() => setSelectedId(m.id)} className="cursor-pointer"
                        style={selectedId === m.id ? { background: 'var(--red-soft)' } : undefined}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar name={memberName(m)} url={m.profile?.photo_url} id={m.user_id || m.id} size={38} />
                            <div className="min-w-0">
                              <p className="font-bold truncate flex items-center gap-2">
                                {memberName(m)}
                                {m.requested_role && <span className="pill pill-red" style={{ height: 20, fontSize: 11 }}>Demande {m.requested_role === 'admin' ? 'admin' : 'coach'}</span>}
                              </p>
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
      {importing && (
        <ImportModal members={members || []}
          onDone={() => { load(); reload() }}
          onClose={changed => { setImporting(false); if (changed) { load(); reload() } }} />
      )}
    </Page>
  )
}
