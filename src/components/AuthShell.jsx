import { Mascot } from './ui'

// Écrans connexion / inscription : visuel GEMS à gauche, formulaire à droite.
export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ background: 'var(--bg)' }}>
      <div className="hero-bg hidden lg:flex flex-col justify-between p-14 text-white">
        <div>
          <p className="display text-3xl leading-none">GEMS</p>
          <p className="text-[10px] font-extrabold tracking-[0.3em] opacity-80 mt-1">TRIATHLON TEAM</p>
        </div>
        <div>
          <Mascot size={110} />
          <h1 className="display text-[64px] leading-[0.98] mt-8">GEMS<br /><span style={{ color: '#F6C9CE' }}>pour les<br />clubs</span></h1>
          <p className="text-lg opacity-90 mt-5 max-w-md">La plateforme tout-en-un pour organiser, coacher et engager vos adhérents.</p>
        </div>
        <p className="text-[12px] opacity-70">Portail web · app iOS & Android</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm fade-up">
          <div className="lg:hidden flex items-center gap-3 mb-10"><Mascot size={44} /><p className="display text-2xl" style={{ color: 'var(--red)' }}>GEMS</p></div>
          <h2 className="page-title mb-2">{title}</h2>
          <p className="text-sm muted mb-8">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  )
}
