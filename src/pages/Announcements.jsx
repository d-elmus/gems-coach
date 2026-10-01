import { useMemo, useState } from 'react'
import { Header } from '../components/Layout'
import { Avatar, Icon, Page, Spinner, Empty, ErrorNotice, Field, Modal } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useClub } from '../context/ClubContext'
import { supabase } from '../lib/supabase'
import { useLoader } from '../lib/useLoader'
import { must, relTime, clubError } from '../lib/clubData'
import { GroupPill } from './club/Members'

async function fetchAnnouncements(clubId) {
  return must(await supabase.from('club_announcements')
    .select('*, author:author_id(id, full_name, photo_url), group:group_id(id, name, color)')
    .eq('club_id', clubId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)) || []
}

// Formulaire d'annonce (création dans la colonne, modification dans une modale).
function AnnouncementForm({ initial, onSubmit, submitLabel, onCancel }) {
  const { groups } = useClub()
  const [title, setTitle] = useState(initial?.title || '')
  const [body, setBody] = useState(initial?.body || '')
  const [groupId, setGroupId] = useState(initial?.group_id || '')
  const [pinned, setPinned] = useState(!!initial?.pinned)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    if (!title.trim()) { setError('Donne un titre à ton annonce.'); return }
    setSaving(true); setError(null)
    const err = await onSubmit({ title: title.trim(), body: body.trim() || null, group_id: groupId || null, pinned })
    setSaving(false)
    if (err) { setError(clubError(err)); return }
    if (!initial) { setTitle(''); setBody(''); setGroupId(''); setPinned(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Titre"><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex : Piscine fermée jeudi" /></Field>
      <Field label="Message">
        <textarea className="input" rows={5} value={body} onChange={e => setBody(e.target.value)} placeholder="Les détails : horaires, lieu, ce qu'il faut prévoir…" />
      </Field>
      <Field label="Destinataires">
        <select className="input" value={groupId} onChange={e => setGroupId(e.target.value)}>
          <option value="">Tout le club</option>
          {groups.map(g => <option key={g.id} value={g.id}>Groupe {g.name}</option>)}
        </select>
      </Field>
      <label className="card-soft p-3 flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} style={{ accentColor: 'var(--red)', width: 18, height: 18 }} />
        <div>
          <p className="font-bold text-sm">Épingler en haut</p>
          <p className="text-[12px] muted">Reste en tête de liste dans l'app jusqu'à ce qu'on la désépingle.</p>
        </div>
      </label>
      {error && <p className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && <button className="btn btn-ghost" onClick={onCancel}>Annuler</button>}
        <button className="btn btn-primary" onClick={submit} disabled={saving || !title.trim()}>
          {saving ? 'Publication…' : submitLabel} <Icon name="arrow" size={16} />
        </button>
      </div>
    </div>
  )
}

function AnnouncementCard({ a, canManage, onTogglePin, onEdit, onDelete }) {
  return (
    <div className="card p-5" style={a.pinned ? { borderColor: '#EBC3C7', background: 'linear-gradient(180deg, var(--red-soft), var(--surface) 70%)' } : undefined}>
      <div className="flex items-start gap-3">
        <Avatar name={a.author?.full_name} url={a.author?.photo_url} id={a.author?.id} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-extrabold">{a.author?.full_name || 'Staff du club'}</p>
            <span className="text-[12px] muted">· {relTime(a.created_at)}</span>
            {a.pinned && <span className="pill pill-red" style={{ height: 20, fontSize: 11 }}><Icon name="pinned" size={11} /> Épinglée</span>}
          </div>
          <div className="mt-1">{a.group ? <GroupPill group={a.group} /> : <span className="pill pill-neutral" style={{ height: 20, fontSize: 11 }}>Tout le club</span>}</div>
        </div>
        {canManage && (
          <div className="flex gap-1 flex-shrink-0">
            <button className="btn btn-ghost btn-icon" style={{ width: 34, height: 34 }} onClick={onTogglePin} title={a.pinned ? 'Désépingler' : 'Épingler'} aria-label={a.pinned ? 'Désépingler' : 'Épingler'}>
              <Icon name="pinned" size={15} style={a.pinned ? { color: 'var(--red)' } : undefined} />
            </button>
            <button className="btn btn-ghost btn-icon" style={{ width: 34, height: 34 }} onClick={onEdit} title="Modifier" aria-label="Modifier"><Icon name="edit" size={15} /></button>
            <button className="btn btn-ghost btn-icon" style={{ width: 34, height: 34 }} onClick={onDelete} title="Supprimer" aria-label="Supprimer"><Icon name="trash" size={15} /></button>
          </div>
        )}
      </div>
      <p className="text-[17px] font-extrabold mt-3">{a.title}</p>
      {a.body && <p className="text-[14px] leading-relaxed ink2 mt-1.5 whitespace-pre-line">{a.body}</p>}
    </div>
  )
}

// Annonces du club : espace club (/club/announcements) et espace coach (/announcements).
export default function Announcements({ space = 'coach' }) {
  const { coach } = useAuth()
  const { club, groups, isAdmin } = useClub()
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [actionError, setActionError] = useState(null)
  const { data, error, loading, reload } = useLoader(() => fetchAnnouncements(club.id), [club.id])

  const list = useMemo(() => (data || []).filter(a =>
    !filter || (filter === 'club' ? !a.group_id : a.group_id === filter)), [data, filter])

  // Tout le staff peut publier ; on modifie ses propres annonces (un admin : toutes).
  const canManage = a => isAdmin || a.author_id === coach.id

  async function create(row) {
    const { error: err } = await supabase.from('club_announcements').insert({ ...row, club_id: club.id, author_id: coach.id })
    if (!err) reload()
    return err
  }
  async function save(row) {
    const { error: err } = await supabase.from('club_announcements').update(row).eq('id', editing.id)
    if (!err) { setEditing(null); reload() }
    return err
  }
  async function togglePin(a) {
    setActionError(null)
    const { error: err } = await supabase.from('club_announcements').update({ pinned: !a.pinned }).eq('id', a.id)
    if (err) setActionError(clubError(err)); else reload()
  }
  async function remove(a) {
    if (!window.confirm(`Supprimer l'annonce « ${a.title} » ? Elle disparaîtra aussi de l'app des athlètes.`)) return
    setActionError(null)
    const { error: err } = await supabase.from('club_announcements').delete().eq('id', a.id)
    if (err) setActionError(clubError(err)); else reload()
  }

  const counts = useMemo(() => {
    const c = { club: 0 }
    for (const a of data || []) { if (a.group_id) c[a.group_id] = (c[a.group_id] || 0) + 1; else c.club++ }
    return c
  }, [data])

  return (
    <Page>
      <Header eyebrow={space === 'club' ? club.name : 'Espace coach'} title={<>Annonces <span className="muted font-bold">· {data?.length ?? ''}</span></>} search={false} />

      <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,1fr) 360px' }}>
        <div className="min-w-0 flex flex-col gap-4">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilter('')} className={`chip ${!filter ? 'chip-on' : ''}`}>Toutes</button>
            <button onClick={() => setFilter('club')} className={`chip ${filter === 'club' ? 'chip-on' : ''}`}>Tout le club · {counts.club}</button>
            {groups.map(g => (
              <button key={g.id} onClick={() => setFilter(g.id)} className={`chip ${filter === g.id ? 'chip-on' : ''}`}>
                {g.name} · {counts[g.id] || 0}
              </button>
            ))}
          </div>

          {actionError && <ErrorNotice compact error={actionError} />}

          {error && !data ? <ErrorNotice error={error} onRetry={reload} />
            : loading && !data ? <Spinner full />
              : list.length === 0 ? (
                <Empty icon="megaphone" title={filter ? 'Aucune annonce pour ce filtre' : 'Aucune annonce pour l\'instant'}
                  text="Les annonces s'affichent dans l'app GEMS des athlètes concernés : tout le club ou un groupe. Épingle celles qui doivent rester visibles." />
              ) : list.map(a => (
                <AnnouncementCard key={a.id} a={a} canManage={canManage(a)}
                  onTogglePin={() => togglePin(a)} onEdit={() => setEditing(a)} onDelete={() => remove(a)} />
              ))}
        </div>

        <div className="card p-6 self-start sticky top-6">
          <p className="card-title mb-1">Nouvelle annonce</p>
          <p className="text-[13px] muted mb-4">Visible immédiatement dans l'app des athlètes ciblés.</p>
          <AnnouncementForm onSubmit={create} submitLabel="Publier" />
        </div>
      </div>

      {editing && (
        <Modal eyebrow="Annonce" title="Modifier l'annonce" onClose={() => setEditing(null)}>
          <AnnouncementForm initial={editing} onSubmit={save} submitLabel="Enregistrer" onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </Page>
  )
}
