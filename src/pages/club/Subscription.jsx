import { Header } from '../../components/Layout'
import { Icon, Page, Meter, Mascot } from '../../components/ui'
import { useClub } from '../../context/ClubContext'

const FEATURES = [
  'Portail web admin + coachs illimités',
  'App athlète iOS & Android pour chaque licencié',
  'Planning, réservations et liste d\'attente',
  'Séances personnalisées aux zones de chaque athlète',
  'Suivi 360° : charge, conformité, présence',
  'Synchronisation Strava, Garmin et Santé',
]

export default function Subscription() {
  const { club, memberCount } = useClub()
  const pct = Math.round((memberCount / club.seats) * 100)
  return (
    <Page>
      <Header eyebrow={club.name} title="Abonnement" search={false} />
      <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
        <div className="hero-bg rounded-[24px] p-8 text-white flex flex-col gap-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="flex items-center gap-4">
            <Mascot size={64} />
            <div>
              <p className="text-[11px] font-extrabold tracking-[0.14em] opacity-80">FORMULE ACTUELLE</p>
              <p className="display text-4xl">GEMS Club Pro</p>
            </div>
          </div>
          <div>
            <div className="flex items-end justify-between mb-2">
              <p className="text-5xl font-extrabold">{memberCount}<span className="text-2xl opacity-70"> / {club.seats}</span></p>
              <p className="text-sm opacity-80">{pct}% des licences utilisées</p>
            </div>
            <Meter value={memberCount} max={club.seats} tone="light" height={8} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(f => (
              <div key={f} className="flex gap-2 text-[13px] opacity-95"><Icon name="check" size={16} /> {f}</div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="card p-6">
            <p className="card-title mb-1">Besoin de plus de licences ?</p>
            <p className="text-sm muted mb-4">On ajuste la formule à la taille de ton club, sans engagement en cours de saison.</p>
            <a className="btn btn-primary" href={`mailto:contact@gems-triathlon.app?subject=${encodeURIComponent(`GEMS Club — ${club.name}`)}`}>
              <Icon name="mail" size={16} /> Contacter GEMS
            </a>
          </div>
          <div className="card p-6">
            <p className="card-title mb-3">Facturation</p>
            <div className="flex flex-col text-[13px]">
              {[['Club', club.name], ['Licences', club.seats], ['Membre depuis', new Date(club.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })]].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5" style={{ borderTop: '1px solid var(--border)' }}><span className="muted">{k}</span><b>{v}</b></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}
