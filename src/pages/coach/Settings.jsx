import { useState, useRef } from 'react'
import { Header } from '../../components/Layout'
import { Avatar, Icon, Page, Field } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function Settings() {
  const { coach, updateCoach } = useAuth()
  const [form, setForm] = useState({
    full_name: coach?.full_name ?? '',
    coach_bio: coach?.coach_bio ?? '',
    coach_specialties: Array.isArray(coach?.coach_specialties) ? coach.coach_specialties.join(', ') : (coach?.coach_specialties ?? ''),
    coach_email: coach?.coach_email ?? '',
    coach_phone: coach?.coach_phone ?? '',
    coach_available: coach?.coach_available ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })); setSaved(false) }

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError(null)
    const path = `coaches/${coach.id}.${file.name.split('.').pop()}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { setError('Erreur upload : ' + upErr.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await updateCoach({ photo_url: `${publicUrl}?v=${Date.now()}` })
    setUploading(false)
  }

  async function save() {
    setSaving(true); setError(null)
    const { error: err } = await updateCoach({
      full_name: form.full_name.trim(),
      coach_bio: form.coach_bio.trim(),
      coach_specialties: form.coach_specialties.split(',').map(s => s.trim()).filter(Boolean),
      coach_email: form.coach_email.trim() || null,
      coach_phone: form.coach_phone.trim() || null,
      coach_available: form.coach_available,
    })
    setSaving(false)
    if (err) setError(err.message); else setSaved(true)
  }

  return (
    <Page>
      <Header eyebrow="Espace coach" title="Mon profil coach" search={false} />
      <div className="grid gap-5" style={{ gridTemplateColumns: '320px minmax(0,1fr)' }}>
        <div className="card p-6 flex flex-col items-center text-center gap-3 self-start">
          <div className="relative">
            <Avatar name={coach?.full_name} url={coach?.photo_url} id={coach?.id} size={112} />
            {uploading && <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: 'rgba(26,20,16,0.5)' }}><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /></div>}
          </div>
          <div>
            <p className="text-lg font-extrabold">{coach?.full_name}</p>
            <p className="text-[13px] muted">{coach?.email}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}><Icon name="upload" size={14} /> Changer la photo</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          <p className="text-xs muted">Ces informations sont visibles par tes athlètes dans l'app GEMS.</p>
        </div>

        <div className="card p-6 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom complet"><input className="input" value={form.full_name} onChange={set('full_name')} /></Field>
            <Field label="Spécialités" hint="Séparées par des virgules"><input className="input" value={form.coach_specialties} onChange={set('coach_specialties')} placeholder="Ironman, natation, jeunes…" /></Field>
          </div>
          <Field label="Bio"><textarea className="input" rows={4} value={form.coach_bio} onChange={set('coach_bio')} placeholder="Ex : Coach triathlon depuis 10 ans, BF5, spécialisé longue distance…" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email de contact"><input type="email" className="input" value={form.coach_email} onChange={set('coach_email')} placeholder="contact@moncoach.fr" /></Field>
            <Field label="Téléphone"><input type="tel" className="input" value={form.coach_phone} onChange={set('coach_phone')} placeholder="+33 6 00 00 00 00" /></Field>
          </div>
          <label className="card-soft p-4 flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.coach_available} onChange={set('coach_available')} style={{ accentColor: 'var(--red)', width: 18, height: 18 }} />
            <div>
              <p className="font-bold text-sm">J'accepte de nouveaux athlètes</p>
              <p className="text-[12px] muted">Ton profil apparaît dans la liste des coachs de l'app.</p>
            </div>
          </label>
          {error && <p className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}
          <button className="btn btn-primary self-start" onClick={save} disabled={saving}>
            {saving ? 'Enregistrement…' : saved ? <><Icon name="check" size={16} /> Enregistré</> : 'Enregistrer'}
          </button>
        </div>
      </div>
    </Page>
  )
}
