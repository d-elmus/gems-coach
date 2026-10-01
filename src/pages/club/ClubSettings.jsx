import { useRef, useState } from 'react'
import { Header } from '../../components/Layout'
import { Icon, Page, Field, Mascot } from '../../components/ui'
import { useClub } from '../../context/ClubContext'
import { supabase } from '../../lib/supabase'

const GROUP_COLORS = ['#9E1B2B', '#0E9AAE', '#A0407A', '#C9731A', '#2F8F3E', '#6B4FB0']

export default function ClubSettings() {
  const { club, groups, reload } = useClub()
  const [name, setName] = useState(club.name)
  const [city, setCity] = useState(club.city || '')
  const [saved, setSaved] = useState(false)
  const [newGroup, setNewGroup] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  async function save() {
    await supabase.from('clubs').update({ name: name.trim(), city: city.trim() || null }).eq('id', club.id)
    setSaved(true); setTimeout(() => setSaved(false), 1500)
    reload()
  }

  async function uploadLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `clubs/${club.id}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('clubs').update({ logo_url: `${publicUrl}?v=${Date.now()}` }).eq('id', club.id)
      reload()
    } else alert(error.message)
    setUploading(false)
  }

  async function addGroup() {
    if (!newGroup.trim()) return
    await supabase.from('club_groups').insert({ club_id: club.id, name: newGroup.trim(), color: GROUP_COLORS[groups.length % GROUP_COLORS.length] })
    setNewGroup('')
    reload()
  }
  async function renameGroup(g, n) {
    if (n.trim() && n !== g.name) { await supabase.from('club_groups').update({ name: n.trim() }).eq('id', g.id); reload() }
  }
  async function recolorGroup(g, color) {
    await supabase.from('club_groups').update({ color }).eq('id', g.id); reload()
  }
  async function removeGroup(g) {
    if (!window.confirm(`Supprimer le groupe « ${g.name} » ? Les membres restent dans le club, sans groupe.`)) return
    await supabase.from('club_groups').delete().eq('id', g.id); reload()
  }

  return (
    <Page>
      <Header eyebrow={club.name} title="Réglages du club" search={false} />
      <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div className="card p-6 flex flex-col gap-5">
          <p className="card-title">Identité</p>
          <div className="flex items-center gap-4">
            {club.logo_url ? <img src={club.logo_url} alt="" className="w-16 h-16 rounded-full object-cover" /> : <Mascot size={64} />}
            <div>
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Icon name="upload" size={14} /> {uploading ? 'Envoi…' : 'Changer le logo'}
              </button>
              <p className="text-xs muted mt-1.5">Affiché dans le portail et l'app athlète.</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
            </div>
          </div>
          <Field label="Nom du club"><input className="input" value={name} onChange={e => setName(e.target.value)} /></Field>
          <Field label="Ville"><input className="input" value={city} onChange={e => setCity(e.target.value)} /></Field>
          <button className="btn btn-primary self-start" onClick={save}>{saved ? <><Icon name="check" size={16} /> Enregistré</> : 'Enregistrer'}</button>
        </div>

        <div className="flex flex-col gap-5">
          <div className="card p-6">
            <p className="card-title mb-1">Code d'accès du club</p>
            <p className="text-sm muted mb-4">À communiquer aux licenciés : ils le saisissent dans l'app GEMS pour rejoindre le club.</p>
            <div className="flex items-center gap-3">
              <span className="display text-3xl tracking-widest" style={{ color: 'var(--red)' }}>{club.invite_code}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(club.invite_code)}><Icon name="copy" size={14} /> Copier</button>
            </div>
          </div>

          <div className="card p-6">
            <p className="card-title mb-4">Groupes d'entraînement</p>
            <div className="flex flex-col gap-2">
              {groups.map(g => (
                <div key={g.id} className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {GROUP_COLORS.map(c => (
                      <button key={c} onClick={() => recolorGroup(g, c)} className="w-4 h-4 rounded-full" aria-label="Couleur"
                        style={{ background: c, boxShadow: g.color === c ? `0 0 0 2px var(--surface), 0 0 0 3.5px ${c}` : 'none' }} />
                    ))}
                  </div>
                  <input className="input flex-1" style={{ height: 38 }} defaultValue={g.name} onBlur={e => renameGroup(g, e.target.value)} />
                  <button className="muted hover:opacity-70" onClick={() => removeGroup(g)} aria-label="Supprimer"><Icon name="trash" size={16} /></button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input className="input flex-1" style={{ height: 38 }} placeholder="Nouveau groupe (ex : École de triathlon)" value={newGroup}
                  onChange={e => setNewGroup(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGroup()} />
                <button className="btn btn-soft btn-sm" style={{ height: 38 }} onClick={addGroup}><Icon name="plus" size={14} /> Ajouter</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}
