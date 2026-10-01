import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Icon, Page, Field, Mascot, SetupNotice } from '../../components/ui'
import { useClub } from '../../context/ClubContext'
import { supabase } from '../../lib/supabase'

const STEPS = [
  ['users', 'Invite tes licenciés', 'Par email ou avec le code club, depuis l\'app GEMS.'],
  ['calendar', 'Publie le planning', 'Cours collectifs et créneaux 1:1, réservables dans l\'app.'],
  ['trend', 'Suis chaque athlète', 'Charge, conformité au plan, présence, activités Strava/Garmin.'],
]

export default function CreateClub() {
  const { club, setupNeeded, reload, setSpace } = useClub()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (setupNeeded) return <Page><SetupNotice /></Page>
  if (club) return <Navigate to="/club" replace />

  async function create(e) {
    e.preventDefault()
    setSaving(true)
    const { error: err } = await supabase.rpc('create_club', { p_name: name, p_city: city })
    setSaving(false)
    if (err) { setError(err.message); return }
    await reload()
    setSpace('club')
    navigate('/club')
  }

  return (
    <Page>
      <div className="grid gap-6 max-w-5xl" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div className="hero-bg rounded-[28px] p-10 text-white flex flex-col gap-8" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <Mascot size={84} />
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.2em] opacity-80 mb-2">GEMS TRIATHLON TEAM</p>
            <h1 className="display text-5xl leading-[1.02]">GEMS<br /><span style={{ color: '#F6C9CE' }}>pour les clubs</span></h1>
            <p className="mt-4 opacity-90">La plateforme tout-en-un pour organiser, coacher et engager vos adhérents.</p>
          </div>
          <div className="flex flex-col gap-4">
            {STEPS.map(([ic, t, d]) => (
              <div key={t} className="flex gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}><Icon name={ic} size={17} /></div>
                <div><p className="font-bold">{t}</p><p className="text-[13px] opacity-80">{d}</p></div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={create} className="card p-10 flex flex-col gap-5 self-center">
          <div>
            <p className="eyebrow mb-2">Nouveau club</p>
            <h2 className="page-title">Crée ton espace club</h2>
            <p className="text-sm muted mt-2">Tu en deviens admin et coach. Tu pourras inviter les autres coachs ensuite.</p>
          </div>
          <Field label="Nom du club"><input className="input" required value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Antony Triathlon" /></Field>
          <Field label="Ville"><input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="Ex : Antony" /></Field>
          {error && <p className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}
          <button className="btn btn-primary" disabled={saving || !name.trim()}>{saving ? 'Création…' : 'Créer le club'} <Icon name="arrow" size={16} /></button>
        </form>
      </div>
    </Page>
  )
}
