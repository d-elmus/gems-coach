import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function CoachProfile() {
  const { coach, updateCoach } = useAuth()

  const [form, setForm] = useState({
    full_name:         coach?.full_name         ?? '',
    coach_bio:         coach?.coach_bio         ?? '',
    coach_specialties: Array.isArray(coach?.coach_specialties)
      ? coach.coach_specialties.join(', ')
      : (coach?.coach_specialties ?? ''),
    coach_email: coach?.coach_email ?? '',
    coach_phone: coach?.coach_phone ?? '',
  })
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState(null)
  const [uploading, setUploading] = useState(false)
  const [photoUrl, setPhotoUrl]   = useState(coach?.photo_url ?? null)
  const fileRef = useRef(null)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const ext  = file.name.split('.').pop()
    const path = `coaches/${coach.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { setError('Erreur upload : ' + upErr.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    setPhotoUrl(publicUrl)
    await updateCoach({ photo_url: publicUrl })
    setUploading(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    const specialties = form.coach_specialties
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const { error: err } = await updateCoach({
      full_name:         form.full_name.trim(),
      coach_bio:         form.coach_bio.trim(),
      coach_specialties: specialties,
      coach_email:       form.coach_email.trim() || null,
      coach_phone:       form.coach_phone.trim() || null,
    })

    setSaving(false)
    if (err) setError(err.message)
    else setSaved(true)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-1">Mon profil</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text3)' }}>
        Ces informations sont visibles par tes athlètes dans l'application GEMS.
      </p>

      {/* Photo */}
      <div className="flex items-center gap-5 mb-8 p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="relative flex-shrink-0">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white"
              style={{ background: 'var(--red)' }}>
              {coach?.full_name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
              <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-white mb-1">{coach?.full_name}</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text3)' }}>{coach?.email}</p>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-xs font-semibold px-4 py-2 rounded-lg transition-colors hover:opacity-80"
            style={{ background: 'var(--red)', color: '#fff' }}
          >
            {uploading ? 'Upload…' : 'Changer la photo'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-5">
        <Field label="Nom complet" value={form.full_name} onChange={v => set('full_name', v)} />
        <Field label="Bio" value={form.coach_bio} onChange={v => set('coach_bio', v)} multiline
          placeholder="Ex : Coach triathlon depuis 10 ans, spécialisé Ironman…" />
        <Field label="Spécialités" value={form.coach_specialties} onChange={v => set('coach_specialties', v)}
          placeholder="Ex : Ironman, Sprint, Natation (séparées par des virgules)" />
        <Field label="Email de contact" value={form.coach_email} onChange={v => set('coach_email', v)}
          type="email" placeholder="contact@moncoach.fr" />
        <Field label="Téléphone" value={form.coach_phone} onChange={v => set('coach_phone', v)}
          type="tel" placeholder="+33 6 00 00 00 00" />
      </div>

      {error && (
        <p className="text-sm mt-4 px-4 py-3 rounded-xl" style={{ background: 'rgba(201,53,63,0.12)', color: '#ff6b6b' }}>
          {error}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 w-full py-3 rounded-xl font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
        style={{ background: saved ? '#16a34a' : 'var(--red)', fontSize: 15 }}
      >
        {saving ? 'Sauvegarde…' : saved ? '✓ Sauvegardé' : 'Sauvegarder les modifications'}
      </button>

      <p className="text-xs text-center mt-4" style={{ color: 'var(--text3)' }}>
        Les modifications sont visibles immédiatement dans l'application GEMS.
      </p>
    </div>
  )
}

function Field({ label, value, onChange, multiline, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none transition-colors"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text1)', fontFamily: 'inherit' }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text1)' }}
        />
      )}
    </div>
  )
}
